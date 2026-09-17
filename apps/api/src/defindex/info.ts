import type { DefindexAdapter, VaultBalance, VaultInfo } from "./types.js";

export interface VaultOverview {
  readonly balance: VaultBalance;
  readonly info: VaultInfo;
  readonly apyPercent: string;
}

/**
 * Kasa ana ekranı için tek çağrı: bakiye + vault bilgisi + APY.
 * Üç okuma paralel yapılır; biri düşerse tamamı hata verir — yarım ekran, yanlış ekrandır.
 */
export async function readVaultOverview(adapter: DefindexAdapter, account: string): Promise<VaultOverview> {
  const [balance, info, apyPercent] = await Promise.all([
    adapter.getVaultBalance(account),
    adapter.getVaultInfo(),
    adapter.getVaultAPY(),
  ]);
  return { balance, info, apyPercent };
}
