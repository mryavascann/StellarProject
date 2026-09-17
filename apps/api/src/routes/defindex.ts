import { Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { Hono } from "hono";

import { SEND_DELAY_MS, type Waiter } from "../defindex/deposit.js";
import { readVaultOverview } from "../defindex/info.js";
import type { DefindexAdapter } from "../defindex/types.js";
import { json, requireStroops, requireText } from "./respond.js";

const defaultWait: Waiter = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** İmzalı XDR'ın kaynağı istekteki hesap olmalı; başkasının işlemi bu uçtan geçmez. */
function assertSignedBy(signedXdr: string, account: string): void {
  const transaction = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
  if (!(transaction instanceof Transaction)) throw new TypeError("Fee-bump işlemi kabul edilmiyor.");
  if (transaction.source !== account) throw new TypeError("İşlemin kaynağı bu hesap değil.");
  if (transaction.signatures.length === 0) throw new TypeError("İşlem imzasız.");
}

/** Getiri katmanı uçları: özet, imzasız XDR üretimi, imzalı gönderim. Mod farkı yoktur. */
export function defindexRoutes(defindex: DefindexAdapter, wait: Waiter = defaultWait) {
  const app = new Hono();

  app.get("/overview", async (context) => {
    const account = context.req.query("account");
    if (!account) throw new TypeError("account gerekli.");
    return json(context, { mode: defindex.mode, vaultAddress: defindex.vaultAddress, ...(await readVaultOverview(defindex, account)) });
  });

  app.post("/deposit/tx", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    return json(context, await defindex.depositToVault(requireText(body, "account"), requireStroops(body, "amountStroops")));
  });

  app.post("/withdraw/tx", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    return json(context, await defindex.withdrawShares(requireText(body, "account"), requireStroops(body, "shareStroops")));
  });

  app.post("/submit", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const signedXdr = requireText(body, "signedXdr");
    assertSignedBy(signedXdr, requireText(body, "account"));
    await wait(SEND_DELAY_MS);
    return json(context, await defindex.sendTransaction(signedXdr));
  });

  return app;
}
