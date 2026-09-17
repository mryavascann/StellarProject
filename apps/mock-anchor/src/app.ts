import { Keypair } from "@stellar/stellar-sdk";
import { Hono } from "hono";

import { ANCHOR } from "../../../config/simulation.js";
import { buildChallenge, issueToken, verifyChallenge, verifyToken } from "./auth.js";
import type { MockAnchorChain } from "./chain.js";
import { registerSep38 } from "./sep38.js";

export { createHorizonAnchorChain, createMemoryAnchorChain, type MockAnchorChain, type ObservedPayment } from "./chain.js";

export interface MockAnchorOptions {
  readonly signingSecret: string;
  readonly issuerPublic: string;
  readonly custodialPublic: string;
  readonly chain: MockAnchorChain;
  readonly now?: () => Date;
}

interface MockTransaction {
  readonly createdAt: number;
  readonly kind: "deposit" | "withdraw";
  readonly account: string;
  readonly amount: string;
  readonly memo?: string;
  memoMatched?: boolean;
  matchedAt?: number;
  payoutHash?: string;
}

type Variables = { account: string };

const DEPOSIT_STATES = ["incomplete", "pending_user_transfer_start", "pending_anchor", "completed"] as const;
const SIMULATED_STATUSES = ["pending_trust", "pending_user", "on_hold", "pending_customer_info_update", "error"] as const;

function sevenDecimalAmount(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d{7}$/u.test(value);
}

function bearer(header: string | undefined): string | null {
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/**
 * Gerçek anchor sınırlarını taklit eden Hono uygulaması.
 * Kolaylaştırılmış hiçbir şey yok: JWT dolar, quote dolar, trustline yoksa para gelmez,
 * memo yanlışsa para askıda kalır (A.4). Zincir erişimi `chain` kapısından yapılır.
 */
export function createMockAnchor(options: MockAnchorOptions) {
  const app = new Hono<{ Variables: Variables }>();
  const now = options.now ?? (() => new Date());
  const signingKey = Keypair.fromSecret(options.signingSecret).publicKey();
  const origin = `http://${ANCHOR.homeDomain}`;
  const webAuthDomain = ANCHOR.homeDomain;
  const transactions = new Map<string, MockTransaction>();
  const quotes = new Map<string, number>();
  const stepMs = ANCHOR.stateStepSeconds * 1000;

  app.get("/.well-known/stellar.toml", (context) => {
    const body = [
      `SIGNING_KEY="${signingKey}"`,
      `TRANSFER_SERVER_SEP0024="${origin}/sep24"`,
      `WEB_AUTH_ENDPOINT="${origin}/auth"`,
      `ANCHOR_QUOTE_SERVER="${origin}/sep38"`,
      "[[CURRENCIES]]",
      `code="${ANCHOR.assetCode}"`,
      `issuer="${options.issuerPublic}"`,
    ].join("\n");
    return context.text(body, 200, {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "text/plain; charset=utf-8",
    });
  });

  app.get("/auth", (context) => {
    const account = context.req.query("account");
    if (!account) return context.json({ error: "account gerekli" }, 400);
    try {
      return context.json({
        transaction: buildChallenge(account, options.signingSecret, ANCHOR.homeDomain, webAuthDomain),
        network_passphrase: "Test SDF Network ; September 2015",
      });
    } catch {
      return context.json({ error: "account geçersiz" }, 400);
    }
  });

  app.post("/auth", async (context) => {
    try {
      const body = await context.req.json<{ transaction?: string }>();
      if (!body.transaction) return context.json({ error: "transaction gerekli" }, 400);
      const account = verifyChallenge(body.transaction, options.signingSecret, ANCHOR.homeDomain, webAuthDomain);
      const token = await issueToken(account, options.signingSecret, now(), ANCHOR.jwtTtlSeconds);
      return context.json({ token });
    } catch {
      return context.json({ error: "challenge doğrulanamadı" }, 400);
    }
  });

  app.get("/sep24/info", (context) =>
    context.json({
      deposit: {
        [ANCHOR.assetCode]: {
          enabled: true,
          min_amount: ANCHOR.deposit.minAmountFiat,
          max_amount: ANCHOR.deposit.maxAmountFiat,
          fee_fixed: ANCHOR.deposit.feeFixedFiat,
          fee_percent: ANCHOR.deposit.feePercent,
        },
      },
      withdraw: {
        [ANCHOR.assetCode]: {
          enabled: true,
          min_amount: ANCHOR.withdraw.minAmountFiat,
          max_amount: ANCHOR.withdraw.maxAmountFiat,
          fee_fixed: ANCHOR.withdraw.feeFixedFiat,
          fee_percent: ANCHOR.withdraw.feePercent,
        },
      },
      features: ANCHOR.features,
    }),
  );

  // Hesap kimliği istemcinin beyanı değil, JWT'nin `sub` alanıdır (gerçek anchor da böyle yapar).
  app.use("/sep24/transactions/*", async (context, next) => {
    const token = bearer(context.req.header("authorization"));
    const payload = token ? await verifyToken(token, options.signingSecret, now()) : null;
    if (!payload) return context.json({ error: "token geçersiz veya süresi dolmuş" }, 401);
    context.set("account", payload.sub);
    await next();
  });

  app.post("/sep24/transactions/deposit/interactive", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    if (!sevenDecimalAmount(body.amount)) return context.json({ error: "amount 7 ondalıklı metin olmalı" }, 400);
    if (typeof body.quote_id === "string" && (quotes.get(body.quote_id) ?? 0) <= now().getTime()) {
      return context.json({ error: "quote süresi doldu" }, 400);
    }
    const id = crypto.randomUUID();
    transactions.set(id, { createdAt: now().getTime(), kind: "deposit", account: context.get("account"), amount: body.amount });
    return context.json({ id, url: `${origin}/interactive/${id}?kind=deposit` });
  });

  app.post("/sep24/transactions/withdraw/interactive", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    if (!sevenDecimalAmount(body.amount)) return context.json({ error: "amount 7 ondalıklı metin olmalı" }, 400);
    const id = crypto.randomUUID();
    const memo = BigInt(`0x${id.replaceAll("-", "").slice(0, 15)}`).toString();
    transactions.set(id, { createdAt: now().getTime(), kind: "withdraw", account: context.get("account"), amount: body.amount, memo });
    return context.json({
      id,
      url: `${origin}/interactive/${id}?kind=withdraw`,
      account_id: options.custodialPublic,
      memo,
      memo_type: "id",
    });
  });

  app.get("/interactive/:id", (context) =>
    context.html(
      "<!doctype html><html lang=\"tr\"><body><button id=\"approve\">Onayla</button><script>approve.onclick=()=>{opener?.postMessage({type:'KASA_ANCHOR_DONE'},'*');window.close()}</script></body></html>",
      200,
      { "X-Frame-Options": "DENY" },
    ),
  );

  /** Deposit: adımlar zamanla ilerler; son adımda trustline yoksa `pending_trust`, varsa gerçek ödeme bir kez yapılır. */
  async function depositStatus(id: string, transaction: MockTransaction) {
    const index = Math.min(Math.floor((now().getTime() - transaction.createdAt) / stepMs), DEPOSIT_STATES.length - 1);
    if (index < DEPOSIT_STATES.length - 1) return { id, kind: transaction.kind, status: DEPOSIT_STATES[index] };
    if (!transaction.payoutHash) {
      if (!(await options.chain.hasTrustline(transaction.account))) {
        return { id, kind: transaction.kind, status: "pending_trust" };
      }
      transaction.payoutHash = (await options.chain.payAsset(transaction.account, transaction.amount)).hash;
    }
    return { id, kind: transaction.kind, status: "completed", stellar_transaction_id: transaction.payoutHash };
  }

  /** Withdraw: ödeme zincirde eşleşene kadar `pending_user_transfer_start`'ta bekler; sonra işlenir. */
  function withdrawStatus(id: string, transaction: MockTransaction) {
    if (transaction.memoMatched === false) {
      return { id, kind: transaction.kind, status: "pending_external", memo_matched: false };
    }
    if (transaction.matchedAt === undefined) {
      const waiting = now().getTime() - transaction.createdAt < stepMs ? "incomplete" : "pending_user_transfer_start";
      return { id, kind: transaction.kind, status: waiting };
    }
    const done = now().getTime() - transaction.matchedAt >= stepMs;
    return { id, kind: transaction.kind, status: done ? "completed" : "pending_anchor", memo_matched: true };
  }

  app.get("/sep24/transaction", async (context) => {
    const simulated = context.req.query("simulate");
    if (SIMULATED_STATUSES.includes(simulated as (typeof SIMULATED_STATUSES)[number])) {
      return context.json({ id: context.req.query("id"), status: simulated });
    }
    const id = context.req.query("id") ?? "";
    const transaction = transactions.get(id);
    if (!transaction) return context.json({ error: "işlem bulunamadı" }, 404);
    return context.json(transaction.kind === "deposit" ? await depositStatus(id, transaction) : withdrawStatus(id, transaction));
  });

  /**
   * Anchor'ın zincir izleyicisi: bildirilen tx hash'i Horizon'dan okunur, hedef/varlık/memo
   * birebir karşılaştırılır. Yanlış memo = eşleşmez ve para askıda kalır (A.4 davranış 5).
   */
  app.post("/mock/payments", async (context) => {
    const body = await context.req.json<{ id?: string; tx_hash?: string }>();
    const transaction = body.id ? transactions.get(body.id) : undefined;
    if (!transaction || transaction.kind !== "withdraw") return context.json({ error: "çekim işlemi bulunamadı" }, 404);
    const payment = body.tx_hash ? await options.chain.findPayment(body.tx_hash) : null;
    if (!payment) return context.json({ error: "ödeme zincirde bulunamadı" }, 404);
    if (
      payment.destination !== options.custodialPublic ||
      payment.assetCode !== ANCHOR.assetCode ||
      payment.assetIssuer !== options.issuerPublic
    ) {
      return context.json({ error: "ödeme bu anchor'a veya bu varlığa yapılmamış" }, 422);
    }
    transaction.memoMatched = payment.memoType === "id" && payment.memo === transaction.memo;
    if (!transaction.memoMatched) return context.json({ error: "memo eşleşmedi", status: "pending_external" }, 422);
    transaction.matchedAt = now().getTime();
    return context.json({ matched: true });
  });

  registerSep38(app as unknown as Hono, options.issuerPublic, quotes, now);
  return app;
}
