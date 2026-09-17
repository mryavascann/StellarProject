import { Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import type { DefindexAdapter, UnsignedVaultTransaction, VaultSubmission } from "./types";

/** Bölüm 10: imzaladıktan sonra göndermeden önce ~1 saniye beklenir. */
export const SEND_DELAY_MS = 1000;

export type XdrSigner = (unsignedXdr: string) => Promise<string>;
export type Waiter = (ms: number) => Promise<void>;

export interface VaultDepositRun {
  readonly caller: string;
  readonly amountStroops: bigint;
  readonly sign: XdrSigner;
  readonly wait?: Waiter;
}

const defaultWait: Waiter = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SDK XDR'ını imzaya götürmeden önce doğrular: XDR `Networks.TESTNET` ile ayrıştırılır
 * (SDK'nın `SupportedNetworks` enum'u DEĞİL) ve kaynağı çağıran olmalıdır.
 * Neden: cüzdana yabancı bir işlem imzalatmak, kullanıcının parasını başka yere yollatabilir.
 */
function assertOwnedBy(unsigned: UnsignedVaultTransaction, caller: string): void {
  const transaction = TransactionBuilder.fromXDR(unsigned.xdr, Networks.TESTNET);
  if (!(transaction instanceof Transaction)) throw new Error("Fee-bump işlemi imzalanmaz.");
  if (transaction.source !== caller) {
    throw new Error(`İşlemin kaynağı çağıran değil (${transaction.source}); imzalanmadı.`);
  }
}

/** Ortak üçlü: doğrula → imzala → bekle → gönder. deposit ve withdraw aynı yolu kullanır. */
export async function signAndSubmit(
  adapter: DefindexAdapter,
  unsigned: UnsignedVaultTransaction,
  caller: string,
  sign: XdrSigner,
  wait: Waiter = defaultWait,
): Promise<VaultSubmission> {
  assertOwnedBy(unsigned, caller);
  const signed = await sign(unsigned.xdr);
  await wait(SEND_DELAY_MS);
  return adapter.sendTransaction(signed);
}

/** USDC → vault payı. Akış ②: XDR üret → imzala → bekle → gönder. */
export async function depositThroughVault(adapter: DefindexAdapter, run: VaultDepositRun): Promise<VaultSubmission> {
  const unsigned = await adapter.depositToVault(run.caller, run.amountStroops);
  return signAndSubmit(adapter, unsigned, run.caller, run.sign, run.wait);
}
