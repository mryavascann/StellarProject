import Decimal from "decimal.js";
import type { Hono } from "hono";

import { ANCHOR } from "../../../config/simulation.js";

function sevenDecimalAmount(value: unknown): value is string {
  return typeof value === "string" && /^\d+\.\d{7}$/u.test(value);
}

/** SEP-38: endikatif fiyat ve 90 saniyelik firm quote. Quote kayıtları interactive uçlarla paylaşılır. */
export function registerSep38(app: Hono, issuerPublic: string, quotes: Map<string, number>, now: () => Date): void {
  app.get("/sep38/price", (context) =>
    context.json({
      price: ANCHOR.rate,
      sell_asset: `iso4217:${ANCHOR.fiatCode}`,
      buy_asset: `stellar:${ANCHOR.assetCode}:${issuerPublic}`,
    }),
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
}
