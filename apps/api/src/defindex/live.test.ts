import { SupportedNetworks } from "@defindex/sdk";
import { Networks } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { createLiveDefindex, type DefindexSdkLike } from "./live";

const VAULT = `C${"A".repeat(55)}`;
const CALLER = "GCALLER";

// Sahte SDK yanıtları bilerek kısmi: testler yalnızca kullandığımız alanları kurar.
function sdk(overrides: Partial<Record<keyof DefindexSdkLike, unknown>> = {}) {
  const fake = {
    depositToVault: vi.fn(async () => ({ xdr: "XDR-DEPOSIT", simulationResponse: null, functionName: "deposit", params: [] })),
    withdrawShares: vi.fn(async () => ({ xdr: "XDR-WITHDRAW", simulationResponse: null, functionName: "withdraw", params: [] })),
    getVaultBalance: vi.fn(async () => ({ dfTokens: 950_0000000, underlyingBalance: [951_0000000] })),
    getVaultInfo: vi.fn(async () => ({ name: "Vault", symbol: "DFV", apy: 6.5 })),
    getVaultAPY: vi.fn(async () => ({ apy: 6.5 })),
    sendTransaction: vi.fn(async () => ({ txHash: "b".repeat(64), success: true })),
    ...overrides,
  };
  return { fake, adapter: createLiveDefindex({ sdk: fake as unknown as DefindexSdkLike, vaultAddress: VAULT }) };
}

describe("live DeFindex adaptörü", () => {
  it("SDK ağı için SupportedNetworks, XDR için Networks kullanılır — ikisi farklı değerlerdir", () => {
    expect(SupportedNetworks.TESTNET).toBe("testnet");
    expect(Networks.TESTNET).toBe("Test SDF Network ; September 2015");
    expect(SupportedNetworks.TESTNET as string).not.toBe(Networks.TESTNET);
  });

  it("deposit'i stroop tamsayısı ve invest:true ile SDK'ya iletir, XDR'ı olduğu gibi döndürür", async () => {
    const { fake, adapter } = sdk();
    const unsigned = await adapter.depositToVault(CALLER, 100_0000000n);
    expect(fake.depositToVault).toHaveBeenCalledWith(
      VAULT,
      { caller: CALLER, amounts: [1_000_000_000], invest: true },
      SupportedNetworks.TESTNET,
    );
    expect(unsigned).toEqual({ xdr: "XDR-DEPOSIT", functionName: "deposit" });
  });

  it("withdrawShares'i pay stroop'uyla iletir", async () => {
    const { fake, adapter } = sdk();
    const unsigned = await adapter.withdrawShares(CALLER, 50_0000000n);
    expect(fake.withdrawShares).toHaveBeenCalledWith(VAULT, { caller: CALLER, shares: 500_000_000 }, SupportedNetworks.TESTNET);
    expect(unsigned.functionName).toBe("withdraw");
  });

  it("güvenli tamsayı sınırını aşan tutarı SDK'ya göndermeden reddeder", async () => {
    const { fake, adapter } = sdk();
    await expect(adapter.depositToVault(CALLER, 2n ** 60n)).rejects.toThrow("güvenli");
    expect(fake.depositToVault).not.toHaveBeenCalled();
  });

  it("SDK null XDR döndürürse hata verir", async () => {
    const { adapter } = sdk({
      depositToVault: vi.fn(async () => ({ xdr: null, simulationResponse: null, functionName: "deposit", params: [] })),
    });
    await expect(adapter.depositToVault(CALLER, 1n)).rejects.toThrow("XDR");
  });

  it("bakiyeyi bigint'e çevirir; tamsayı olmayan SDK değerini reddeder", async () => {
    const { adapter } = sdk();
    expect(await adapter.getVaultBalance(CALLER)).toEqual({ shares: 950_0000000n, underlying: 951_0000000n });
    const broken = sdk({ getVaultBalance: vi.fn(async () => ({ dfTokens: 1.5, underlyingBalance: [1] })) });
    await expect(broken.adapter.getVaultBalance(CALLER)).rejects.toThrow("tamsayı");
  });

  it("vault bilgisini ve APY'yi metin olarak verir", async () => {
    const { adapter } = sdk();
    expect(await adapter.getVaultInfo()).toMatchObject({ name: "Vault", symbol: "DFV", apyPercent: "6.50" });
    expect(await adapter.getVaultAPY()).toBe("6.50");
    expect(adapter.mode).toBe("live");
  });

  it("gönderim başarısızsa veya SDK hata fırlatırsa sessizce geçmez", async () => {
    const failed = sdk({ sendTransaction: vi.fn(async () => ({ txHash: "c".repeat(64), success: false })) });
    await expect(failed.adapter.sendTransaction("XDR")).rejects.toThrow("c".repeat(64));
    const thrown = sdk({
      sendTransaction: vi.fn(async () => {
        throw new Error("API 500");
      }),
    });
    await expect(thrown.adapter.sendTransaction("XDR")).rejects.toThrow("API 500");
  });
});
