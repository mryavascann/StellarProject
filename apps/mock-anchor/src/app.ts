import { Keypair } from "@stellar/stellar-sdk";
import Decimal from "decimal.js";
import { Hono } from "hono";

import { ANCHOR } from "../../../config/simulation.js";
import { buildChallenge, issueToken, verifyChallenge, verifyToken } from "./auth.js";

export interface MockAnchorOptions {
  readonly signingSecret: string;
  readonly issuerPublic: string;
  readonly custodialPublic: string;
  readonly now?: () => Date;
}

interface MockTransaction {
  readonly createdAt: number;
  readonly kind: "deposit" | "withdraw";
  readonly memo?: string;
  memoMatched?: boolean;
}

function sevenDecimalAmount(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d{7}$/u.test(value);
}

function bearer(header: string | undefined): string | null {
  return header?.startsWith("Bearer ") ? header.slice(7) : null;
}

/** Gerçek anchor sınırlarını taklit eden, ağ işlemi yapmayan Hono uygulamasını kurar. */
export function createMockAnchor(options: MockAnchorOptions) {
  const app = new Hono();
  const now = options.now ?? (() => new Date());
  const signingKey = Keypair.fromSecret(options.signingSecret).publicKey();
  const origin = `http://${ANCHOR.homeDomain}`;
  const webAuthDomain = ANCHOR.homeDomain;
  const transactions = new Map<string, MockTransaction>();
  const quotes = new Map<string, number>();
  const simulatedStatuses = [
    "pending_trust",
    "pending_user",
    "on_hold",
    "pending_customer_info_update",
    "error",
  ] as const;

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
      const account = verifyChallenge(
        body.transaction,
        options.signingSecret,
        ANCHOR.homeDomain,
        webAuthDomain,
      );
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

  app.use("/sep24/transactions/*", async (context, next) => {
    const token = bearer(context.req.header("authorization"));
    if (!token || !(await verifyToken(token, options.signingSecret, now()))) {
      return context.json({ error: "token geçersiz veya süresi dolmuş" }, 401);
    }
    await next();
  });

  app.post("/sep24/transactions/deposit/interactive", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    if (!sevenDecimalAmount(body.amount)) return context.json({ error: "amount 7 ondalıklı metin olmalı" }, 400);
    if (typeof body.quote_id === "string" && (quotes.get(body.quote_id) ?? 0) <= now().getTime()) {
      return context.json({ error: "quote süresi doldu" }, 400);
    }
    const id = crypto.randomUUID();
    transactions.set(id, { createdAt: now().getTime(), kind: "deposit" });
    return context.json({ id, url: `${origin}/interactive/${id}?kind=deposit` });
  });

  app.post("/sep24/transactions/withdraw/interactive", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    if (!sevenDecimalAmount(body.amount)) return context.json({ error: "amount 7 ondalıklı metin olmalı" }, 400);
    const id = crypto.randomUUID();
    const memo = BigInt(`0x${id.replaceAll("-", "").slice(0, 15)}`).toString();
    transactions.set(id, { createdAt: now().getTime(), kind: "withdraw", memo });
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
      "<!doctype html><html lang=\"tr\"><body><button id=\"approve\">Onayla</button><script>approve.onclick=()=>opener?.postMessage({type:'KASA_ANCHOR_DONE'},location.origin)</script></body></html>",
      200,
      { "X-Frame-Options": "DENY" },
    ),
  );

  app.get("/sep24/transaction", (context) => {
    const simulated = context.req.query("simulate");
    if (simulatedStatuses.includes(simulated as (typeof simulatedStatuses)[number])) {
      return context.json({ id: context.req.query("id"), status: simulated });
    }
    const id = context.req.query("id") ?? "";
    const transaction = transactions.get(id);
    if (!transaction) return context.json({ error: "işlem bulunamadı" }, 404);
    if (transaction.memoMatched === false) {
      return context.json({ id, kind: transaction.kind, status: "pending_external", memo_matched: false });
    }
    const elapsed = now().getTime() - transaction.createdAt;
    const states = ["incomplete", "pending_user_transfer_start", "pending_anchor", "completed"] as const;
    const index = Math.min(Math.floor(elapsed / (ANCHOR.stateStepSeconds * 1000)), states.length - 1);
    return context.json({ id, kind: transaction.kind, status: states[index] });
  });

  app.post("/mock/payments", async (context) => {
    const body = await context.req.json<{ id?: string; memo?: string }>();
    const transaction = body.id ? transactions.get(body.id) : undefined;
    if (!transaction || transaction.kind !== "withdraw") {
      return context.json({ error: "çekim işlemi bulunamadı" }, 404);
    }
    transaction.memoMatched = body.memo === transaction.memo;
    if (!transaction.memoMatched) {
      return context.json({ error: "memo eşleşmedi", status: "pending_external" }, 422);
    }
    return context.json({ matched: true });
  });

  app.get("/sep38/price", (context) =>
    context.json({ price: ANCHOR.rate, sell_asset: "iso4217:TRY", buy_asset: `stellar:${ANCHOR.assetCode}:${options.issuerPublic}` }),
  );

  app.post("/sep38/quote", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    if (!sevenDecimalAmount(body.sell_amount)) {
      return context.json({ error: "sell_amount 7 ondalıklı metin olmalı" }, 400);
    }
    const id = crypto.randomUUID();
    const expiresAt = now().getTime() + ANCHOR.quoteTtlSeconds * 1000;
    quotes.set(id, expiresAt);
    const buyAmount = new Decimal(body.sell_amount).div(ANCHOR.rate).toFixed(7, Decimal.ROUND_DOWN);
    return context.json({
      id,
      price: ANCHOR.rate,
      sell_amount: body.sell_amount,
      buy_amount: buyAmount,
      expires_at: new Date(expiresAt).toISOString(),
    });
  });

  return app;
}
