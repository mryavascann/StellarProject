import { Hono } from "hono";

import {
  buildTrustlineTransaction,
  buildWithdrawalPaymentTransaction,
  submitClassicTransaction,
  type ClassicGateway,
} from "../anchor/classic";
import type { AnchorClient } from "../anchor/client";
import { mapAnchorStatus } from "../anchor/status";
import { json, requireText } from "./respond";

const FIAT_PATTERN = /^\d+\.\d{2}$/u;
const ASSET_PATTERN = /^\d+\.\d{7}$/u;

export interface ClassicDependencies {
  readonly gateway: ClassicGateway;
  readonly networkPassphrase: string;
}

/** Banka bağlantısı (anchor) uçları. Oturum yoksa 401 `auth_required`; web SEP-10'u tekrarlar. */
export function anchorRoutes(anchor: AnchorClient, classic: ClassicDependencies) {
  const app = new Hono();
  const asset = async () => {
    const metadata = await anchor.metadata();
    return { code: metadata.assetCode, issuer: metadata.assetIssuer };
  };
  /** Anchor JWT'si tarayıcıdan gelir; yoksa boş metin, istemci anchor'a gitmeden auth_required der. */
  const bearer = (context: { req: { header(name: string): string | undefined } }): string => {
    const header = context.req.header("authorization");
    return header?.startsWith("Bearer ") ? header.slice(7) : "";
  };

  app.get("/info", async (context) => {
    const [metadata, info, price] = await Promise.all([anchor.metadata(), anchor.info(), anchor.price()]);
    return json(context, {
      mode: anchor.mode,
      homeDomain: anchor.homeDomain,
      assetCode: metadata.assetCode,
      assetIssuer: metadata.assetIssuer,
      rate: price.rate,
      ...info,
    });
  });

  app.post("/challenge", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    return json(context, { transaction: await anchor.challenge(requireText(body, "account")) });
  });

  /** SEP-10 sonucu JWT'yi tarayıcıya verir; API onu saklamaz (sunucu örnekleri arasında kaybolurdu). */
  app.post("/token", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const session = await anchor.exchangeToken(requireText(body, "account"), requireText(body, "signedTransaction"));
    return json(context, session);
  });

  app.get("/trustline", async (context) => {
    const account = context.req.query("account");
    if (!account) throw new TypeError("account gerekli.");
    return json(context, { exists: await classic.gateway.hasTrustline(account, await asset()) });
  });

  app.post("/trustline/tx", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const xdr = await buildTrustlineTransaction(classic.gateway, classic.networkPassphrase, requireText(body, "account"), await asset());
    return json(context, { xdr });
  });

  app.post("/deposit", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const account = requireText(body, "account");
    const amountFiat = requireText(body, "amountFiat");
    if (!FIAT_PATTERN.test(amountFiat)) throw new TypeError("amountFiat 2 ondalıklı metin olmalı (örn. 500.00).");
    // SEP-38: TL → USDC firm quote; süresi dolmuşsa istemci sessizce yeniden fiyatlar.
    const quote = await anchor.quote(`${amountFiat}00000`);
    const started = await anchor.startDeposit(account, quote.buy_amount, bearer(context));
    return json(context, { ...started, amountAsset: quote.buy_amount, quoteExpiresAt: quote.expires_at });
  });

  app.post("/withdraw", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const account = requireText(body, "account");
    const amountAsset = requireText(body, "amountAsset");
    if (!ASSET_PATTERN.test(amountAsset)) throw new TypeError("amountAsset 7 ondalıklı metin olmalı.");
    return json(context, await anchor.startWithdraw(account, amountAsset, bearer(context)));
  });

  /** Çekim ödemesinin imzasız XDR'ı: memo anchor yanıtından birebir, üye imzalar (K-002). */
  app.post("/payment/tx", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const account = requireText(body, "account");
    const memoType = body.memoType;
    if (memoType !== "id") throw new TypeError("memoType id olmalı.");
    const xdr = await buildWithdrawalPaymentTransaction(classic.gateway, classic.networkPassphrase, account, await asset(), {
      destination: requireText(body, "destination"),
      amount: requireText(body, "amount"),
      memo: requireText(body, "memo"),
      memoType,
    });
    return json(context, { xdr });
  });

  app.post("/classic/submit", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    return json(context, await submitClassicTransaction(classic.gateway, classic.networkPassphrase, requireText(body, "signedXdr")));
  });

  app.get("/transaction", async (context) => {
    const account = context.req.query("account");
    const id = context.req.query("id");
    const direction = context.req.query("direction");
    if (!account || !id) throw new TypeError("account ve id gerekli.");
    if (direction !== "deposit" && direction !== "withdraw") throw new TypeError("direction deposit veya withdraw olmalı.");
    const raw = await anchor.transaction(account, id, bearer(context), context.req.query("paymentHash"));
    return json(context, mapAnchorStatus(direction, raw.status, raw.memoMatched));
  });

  app.post("/payment", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    await anchor.reportWithdrawalPayment(requireText(body, "id"), requireText(body, "memo"), requireText(body, "txHash"));
    return json(context, { ok: true });
  });

  return app;
}
