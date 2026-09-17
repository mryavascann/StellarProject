import { Keypair } from "@stellar/stellar-sdk";
import { Hono } from "hono";

import { ANCHOR } from "../../../config/simulation";
import { buildChallenge, issueToken, verifyChallenge, verifyToken } from "./auth";
import { decodeSigned, encodeSigned, payoutMemo, type QuotePayload, type TransferPayload } from "./ids";
import type { MockAnchorChain, ObservedPayment } from "./chain";
import { registerSep38 } from "./sep38";

export { createHorizonAnchorChain, createMemoryAnchorChain, type MockAnchorChain, type ObservedPayment } from "./chain";

export interface MockAnchorOptions {
  readonly signingSecret: string;
  readonly issuerPublic: string;
  readonly custodialPublic: string;
  readonly chain: MockAnchorChain;
  readonly now?: () => Date;
  readonly homeDomain?: string;
  readonly publicOrigin?: string;
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
  const homeDomain = options.homeDomain ?? ANCHOR.homeDomain;
  const origin = (options.publicOrigin ?? `http://${homeDomain}`).replace(/\/$/u, "");
  const webAuthDomain = new URL(origin).host;
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
        transaction: buildChallenge(account, options.signingSecret, homeDomain, webAuthDomain),
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
      const account = verifyChallenge(body.transaction, options.signingSecret, homeDomain, webAuthDomain);
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
    if (typeof body.quote_id === "string") {
      const quote = await decodeSigned<QuotePayload>(body.quote_id, options.signingSecret);
      if (!quote || quote.expiresAt <= now().getTime()) return context.json({ error: "quote süresi doldu" }, 400);
    }
    const id = await encodeSigned<TransferPayload>(
      { kind: "deposit", account: context.get("account"), amount: body.amount, createdAt: now().getTime() },
      options.signingSecret,
    );
    return context.json({ id, url: `${origin}/interactive/${encodeURIComponent(id)}?kind=deposit` });
  });

  app.post("/sep24/transactions/withdraw/interactive", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    if (!sevenDecimalAmount(body.amount)) return context.json({ error: "amount 7 ondalıklı metin olmalı" }, 400);
    // Memo önce üretilir ve imzalı kimliğin İÇİNE yazılır; böylece her sunucu örneği aynı memo'yu bilir.
    const memo = BigInt(`0x${crypto.randomUUID().replaceAll("-", "").slice(0, 15)}`).toString();
    const id = await encodeSigned<TransferPayload>(
      { kind: "withdraw", account: context.get("account"), amount: body.amount, memo, createdAt: now().getTime() },
      options.signingSecret,
    );
    return context.json({
      id,
      url: `${origin}/interactive/${encodeURIComponent(id)}?kind=withdraw`,
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

  /**
   * Deposit: adımlar zamanla ilerler; son adımda trustline yoksa `pending_trust`.
   * Ödemenin bir kez yapılması bellekte değil ZİNCİRDE tutulur: anchor kendi ödemesine
   * işleme özel bir etiket koyar ve ödemeden önce o etiketi zincirde arar. Böylece iki
   * sunucu örneği aynı anda son adıma gelse bile ikinci ödeme yapılmaz.
   */
  async function depositStatus(id: string, transfer: TransferPayload) {
    const index = Math.min(Math.floor((now().getTime() - transfer.createdAt) / stepMs), DEPOSIT_STATES.length - 1);
    if (index < DEPOSIT_STATES.length - 1) return { id, kind: transfer.kind, status: DEPOSIT_STATES[index] };

    const memo = payoutMemo(id);
    const existing = await options.chain.findPayout(transfer.account, memo);
    if (existing) return { id, kind: transfer.kind, status: "completed", stellar_transaction_id: existing.hash };
    if (!(await options.chain.hasTrustline(transfer.account))) {
      return { id, kind: transfer.kind, status: "pending_trust" };
    }
    const payout = await options.chain.payAsset(transfer.account, transfer.amount, memo);
    return { id, kind: transfer.kind, status: "completed", stellar_transaction_id: payout.hash };
  }

  /**
   * Withdraw: üye ödemeyi yapıp hash'ini bildirir; anchor her sorguda ZİNCİRDEN doğrular.
   * Memo yanlışsa eşleşme olmaz ve işlem `pending_external`'da askıda kalır (A.4 davranış 5).
   */
  async function withdrawStatus(id: string, transfer: TransferPayload, paymentHash: string | undefined) {
    const payment = paymentHash ? await options.chain.findPayment(paymentHash) : null;
    if (!payment) {
      const waiting = now().getTime() - transfer.createdAt < stepMs ? "incomplete" : "pending_user_transfer_start";
      return { id, kind: transfer.kind, status: waiting };
    }
    if (!matchesAnchorAsset(payment) || payment.memoType !== "id" || payment.memo !== transfer.memo) {
      return { id, kind: transfer.kind, status: "pending_external", memo_matched: false };
    }
    const done = now().getTime() - payment.createdAt >= stepMs;
    return { id, kind: transfer.kind, status: done ? "completed" : "pending_anchor", memo_matched: true };
  }

  /** Ödeme gerçekten bu anchor'a ve bu varlığa mı yapılmış? */
  function matchesAnchorAsset(payment: ObservedPayment): boolean {
    return (
      payment.destination === options.custodialPublic &&
      payment.assetCode === ANCHOR.assetCode &&
      payment.assetIssuer === options.issuerPublic
    );
  }

  app.get("/sep24/transaction", async (context) => {
    const simulated = context.req.query("simulate");
    if (SIMULATED_STATUSES.includes(simulated as (typeof SIMULATED_STATUSES)[number])) {
      return context.json({ id: context.req.query("id"), status: simulated });
    }
    const id = context.req.query("id") ?? "";
    const transfer = await decodeSigned<TransferPayload>(id, options.signingSecret);
    if (!transfer) return context.json({ error: "işlem bulunamadı" }, 404);
    return context.json(
      transfer.kind === "deposit"
        ? await depositStatus(id, transfer)
        : await withdrawStatus(id, transfer, context.req.query("payment_hash")),
    );
  });

  /**
   * Anchor'ın zincir izleyicisi: bildirilen tx hash'i Horizon'dan okunur, hedef/varlık/memo
   * birebir karşılaştırılır. Kayıt tutmaz; durum sorgusu aynı doğrulamayı yeniden yapar.
   */
  app.post("/mock/payments", async (context) => {
    const body = await context.req.json<{ id?: string; tx_hash?: string }>();
    const transfer = body.id ? await decodeSigned<TransferPayload>(body.id, options.signingSecret) : null;
    if (!transfer || transfer.kind !== "withdraw") return context.json({ error: "çekim işlemi bulunamadı" }, 404);
    const payment = body.tx_hash ? await options.chain.findPayment(body.tx_hash) : null;
    if (!payment) return context.json({ error: "ödeme zincirde bulunamadı" }, 404);
    if (!matchesAnchorAsset(payment)) {
      return context.json({ error: "ödeme bu anchor'a veya bu varlığa yapılmamış" }, 422);
    }
    if (payment.memoType !== "id" || payment.memo !== transfer.memo) {
      return context.json({ error: "memo eşleşmedi", status: "pending_external" }, 422);
    }
    return context.json({ matched: true });
  });

  registerSep38(app as unknown as Hono, options.issuerPublic, options.signingSecret, now);
  return app;
}
