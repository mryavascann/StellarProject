/**
 * DeFindex adaptör arayüzü — mock ve live BU arayüzü birebir uygular (KARAR K-003).
 *
 * Neden SDK'nın kendi tipleri değil: `@defindex/sdk` tutarları `number` olarak alır ve
 * döndürür. Bölüm 0.5 "parada float yok" der; bu yüzden uygulamanın geri kalanı yalnızca
 * `bigint` (stroop) görür, `number` dönüşümü tek yerde (live.ts) güvenli-tamsayı kontrolüyle
 * yapılır. Metot adları bilerek SDK ile aynı tutuldu ki canlıya geçişte eşleme akılda kalsın.
 */

export type DefindexMode = "simulation" | "live";

/** SDK'nın döndürdüğü imzasız işlem. Kullanıcı imzalar, `sendTransaction` gönderir. */
export interface UnsignedVaultTransaction {
  readonly xdr: string;
  readonly functionName: "deposit" | "withdraw";
}

export interface VaultBalance {
  /** Kullanıcının elindeki vault payı (dfToken), stroop. */
  readonly shares: bigint;
  /** Payların bugünkü USDC karşılığı, stroop. */
  readonly underlying: bigint;
}

export interface VaultInfo {
  readonly name: string;
  readonly symbol: string;
  /** Yüzde olarak, metin: "6.50". Gösterimde `%6,50` olur (brand.md Bölüm 5). */
  readonly apyPercent: string;
  /** 1 payın USDC karşılığı, 7 ondalıklı metin. Live SDK bunu vermez → `null`; arayüz satırı gizler. */
  readonly sharePrice: string | null;
}

export interface VaultSubmission {
  readonly txHash: string;
  readonly success: boolean;
}

export interface DefindexAdapter {
  readonly mode: DefindexMode;
  readonly vaultAddress: string;
  /** USDC (stroop) yatırıp karşılığında pay alacak imzasız işlemi üretir. */
  depositToVault(caller: string, amountStroops: bigint): Promise<UnsignedVaultTransaction>;
  /** Payı (stroop) bozdurup USDC alacak imzasız işlemi üretir. */
  withdrawShares(caller: string, shareStroops: bigint): Promise<UnsignedVaultTransaction>;
  getVaultBalance(account: string): Promise<VaultBalance>;
  getVaultInfo(): Promise<VaultInfo>;
  getVaultAPY(): Promise<string>;
  /** İmzalı XDR'ı ağa gönderir. Başarısız sonuç sessizce yutulmaz, hata fırlatılır. */
  sendTransaction(signedXdr: string): Promise<VaultSubmission>;
}
