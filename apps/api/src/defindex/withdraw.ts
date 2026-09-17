import { signAndSubmit, type Waiter, type XdrSigner } from "./deposit";
import type { DefindexAdapter, VaultSubmission } from "./types";

export interface VaultWithdrawRun {
  readonly caller: string;
  readonly shareStroops: bigint;
  readonly sign: XdrSigner;
  readonly wait?: Waiter;
}

/**
 * Vault payı → USDC. Akış ⑤: `execute()` payı talep edenin hesabına bıraktıktan sonra çağrılır.
 * Fon üyenin kendi hesabındadır (KARAR K-002); bu yüzden imza da üyeden gelir.
 */
export async function withdrawThroughVault(adapter: DefindexAdapter, run: VaultWithdrawRun): Promise<VaultSubmission> {
  const unsigned = await adapter.withdrawShares(run.caller, run.shareStroops);
  return signAndSubmit(adapter, unsigned, run.caller, run.sign, run.wait);
}
