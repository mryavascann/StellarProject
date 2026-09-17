import { type DefindexSDK, SupportedNetworks } from "@defindex/sdk";
import Decimal from "decimal.js";

import type { DefindexAdapter, UnsignedVaultTransaction, VaultBalance, VaultInfo, VaultSubmission } from "./types.js";

/**
 * SDK'nın kullandığımız kesiti. `Pick` olması bilinçli: gerçek `DefindexSDK` sınıfıyla
 * yapısal olarak birebir uyumlu kalır, testler sahte nesne geçebilir.
 */
export type DefindexSdkLike = Pick<
  DefindexSDK,
  "depositToVault" | "withdrawShares" | "getVaultBalance" | "getVaultInfo" | "getVaultAPY" | "sendTransaction"
>;

export interface LiveDefindexOptions {
  readonly sdk: DefindexSdkLike;
  readonly vaultAddress: string;
}

/**
 * Ağ enum'u SDK'nınkidir (`SupportedNetworks`), XDR ayrıştırmada kullanılan `Networks` DEĞİL.
 * İkisi farklı değerlerdir; karıştırma live.test.ts'teki regresyon testiyle korunur.
 */
const NETWORK = SupportedNetworks.TESTNET;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** bigint stroop → SDK'nın istediği number. Güvenli tamsayı dışına çıkarsa sessizce bozulmak yerine durur. */
function toSdkStroops(amount: bigint, field: string): number {
  if (amount <= 0n) throw new RangeError(`${field} sıfırdan büyük olmalı.`);
  if (amount > MAX_SAFE) throw new RangeError(`${field} güvenli tamsayı sınırını aşıyor: ${amount}`);
  return Number(amount);
}

/** SDK'dan gelen number stroop → bigint. Tamsayı olmayan değer para hassasiyeti kaybıdır, reddedilir. */
function fromSdkStroops(value: number, field: string): bigint {
  if (!Number.isSafeInteger(value)) throw new TypeError(`${field} güvenli tamsayı olmalı, geldi: ${value}`);
  return BigInt(value);
}

function requireXdr(xdr: string | null, functionName: string): string {
  if (typeof xdr !== "string" || xdr === "") throw new Error(`DeFindex ${functionName} için XDR döndürmedi.`);
  return xdr;
}

/** APY para değildir; SDK'nın number'ı yüzde metnine çevrilir. ⚠ Alanın yüzde mi oran mı olduğu canlıda doğrulanacak. */
function apyPercentText(apy: number): string {
  return new Decimal(apy).toFixed(2, Decimal.ROUND_DOWN);
}

/** Gerçek `@defindex/sdk` üzerinden çalışan adaptör. Mod sınırı `client.ts`'tedir, burada mod kontrolü yoktur. */
export function createLiveDefindex(options: LiveDefindexOptions): DefindexAdapter {
  const { sdk, vaultAddress } = options;
  return {
    mode: "live",
    vaultAddress,

    async depositToVault(caller, amountStroops): Promise<UnsignedVaultTransaction> {
      const amount = toSdkStroops(amountStroops, "Yatırılacak tutar");
      const response = await sdk.depositToVault(vaultAddress, { caller, amounts: [amount], invest: true }, NETWORK);
      return { xdr: requireXdr(response.xdr, "deposit"), functionName: "deposit" };
    },

    async withdrawShares(caller, shareStroops): Promise<UnsignedVaultTransaction> {
      const shares = toSdkStroops(shareStroops, "Bozdurulacak pay");
      const response = await sdk.withdrawShares(vaultAddress, { caller, shares }, NETWORK);
      return { xdr: requireXdr(response.xdr, "withdraw"), functionName: "withdraw" };
    },

    async getVaultBalance(account): Promise<VaultBalance> {
      const response = await sdk.getVaultBalance(vaultAddress, account, NETWORK);
      const underlying = response.underlyingBalance[0];
      if (underlying === undefined) throw new Error("DeFindex bakiye yanıtında underlyingBalance boş.");
      return {
        shares: fromSdkStroops(response.dfTokens, "dfTokens"),
        underlying: fromSdkStroops(underlying, "underlyingBalance[0]"),
      };
    },

    async getVaultInfo(): Promise<VaultInfo> {
      const response = await sdk.getVaultInfo(vaultAddress, NETWORK);
      return {
        name: response.name,
        symbol: response.symbol,
        apyPercent: apyPercentText(response.apy),
        // SDK pay fiyatını doğrudan vermez; arayüz bakiye/pay oranından türetir (info.ts).
        sharePrice: null,
      };
    },

    async getVaultAPY(): Promise<string> {
      return apyPercentText((await sdk.getVaultAPY(vaultAddress, NETWORK)).apy);
    },

    async sendTransaction(signedXdr): Promise<VaultSubmission> {
      const response = await sdk.sendTransaction(signedXdr, NETWORK);
      if (!response.success) throw new Error(`DeFindex işlemi başarısız: ${response.txHash}`);
      return { txHash: response.txHash, success: true };
    },
  };
}
