// @vitest-environment node
/**
 * Ana ekranın veri yüklemesi. Kasa ve banka bilgisi zorunlu; getiri özeti kişiye özeldir
 * ve düşerse ekran ayakta kalmalı — yeni katılan üye kasayı yine de görebilmeli.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadVaultData } from "./useVault";

const VAULT = { name: "Moda Ev Kasası", labels: {}, contractId: "C1", balance: "1600000000", members: [], requests: [], ledger: [] };
const ANCHOR = { mode: "simulation", homeDomain: "h", assetCode: "USDC", assetIssuer: "G1", rate: "50.0000000", deposit: {}, withdraw: {}, trustlineRequired: true };
const OVERVIEW = { mode: "simulation", vaultAddress: "C2", balance: { shares: "9500000000", underlying: "10004070000" }, info: { name: "v", symbol: "kUSDC", apyPercent: "6.50", sharePrice: "1.0530600" }, apyPercent: "6.50" };

function mockFetch(handler: (url: string) => { status?: number; body: unknown }) {
  vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
    const result = handler(String(input));
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { "content-type": "application/json" } });
  }));
}

afterEach(() => vi.unstubAllGlobals());

describe("kasa ekranı verisi", () => {
  it("üç okuma da başarılıysa getiri özetini kullanır", async () => {
    mockFetch((url) => {
      if (url.includes("/api/vault")) return { body: VAULT };
      if (url.includes("/api/anchor/info")) return { body: ANCHOR };
      return { body: OVERVIEW };
    });

    const data = await loadVaultData("GACCOUNT");
    expect(data.vault.name).toBe("Moda Ev Kasası");
    expect(data.sharePrice).toBe("1.0530600");
  });

  it("getiri özeti düşse bile kasa görünür; pay fiyatı başlangıç değerine düşer", async () => {
    mockFetch((url) => {
      if (url.includes("/api/vault")) return { body: VAULT };
      if (url.includes("/api/anchor/info")) return { body: ANCHOR };
      return { status: 503, body: { error: "İşlem şu an yapılamıyor. Tekrar dene." } };
    });

    const data = await loadVaultData("GACCOUNT");
    expect(data.vault.name).toBe("Moda Ev Kasası");
    expect(data.overview).toBeNull();
    expect(data.rate).toBe("50.0000000");
  });

  it("kasa okunamıyorsa ekran hata durumuna geçer", async () => {
    mockFetch((url) => (url.includes("/api/vault") ? { status: 503, body: { error: "İşlem şu an yapılamıyor. Tekrar dene." } } : { body: ANCHOR }));
    await expect(loadVaultData("GACCOUNT")).rejects.toThrow();
  });
});
