import { Asset, Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { DEFINDEX } from "../../../../config/simulation.js";
import { createDefindexAdapter } from "./client.js";
import type { DefindexSdkLike } from "./live.js";

const issuer = Keypair.random();
const SIMULATION_ENV = {
  KASA_MODE: "simulation",
  MOCK_USDC_ISSUER_SECRET: issuer.secret(),
  MOCK_DFTOKEN_CONTRACT_ID: new Asset(DEFINDEX.vaultSymbol, issuer.publicKey()).contractId(Networks.TESTNET),
};
const LIVE_ENV = { KASA_MODE: "live", DEFINDEX_API_KEY: "sk_test", DEFINDEX_VAULT_ID: `C${"B".repeat(55)}` };
const createSdk = vi.fn((_apiKey: string) => ({}) as DefindexSdkLike);

describe("DeFindex fabrikası (mod sınırı)", () => {
  it("simülasyonda mock adaptör döndürür ve vault adresi mock pay token'ıdır", () => {
    const adapter = createDefindexAdapter(SIMULATION_ENV, { createSdk });
    expect(adapter.mode).toBe("simulation");
    expect(adapter.vaultAddress).toBe(SIMULATION_ENV.MOCK_DFTOKEN_CONTRACT_ID);
    expect(createSdk).not.toHaveBeenCalled();
  });

  it("simülasyonda env'deki token ID ihraççıdan türetilenle uyuşmuyorsa açılışta durur", () => {
    expect(() =>
      createDefindexAdapter({ ...SIMULATION_ENV, MOCK_DFTOKEN_CONTRACT_ID: `C${"C".repeat(55)}` }, { createSdk }),
    ).toThrow("MOCK_DFTOKEN_CONTRACT_ID");
  });

  it("canlı modda live adaptör döndürür ve SDK'yı API anahtarıyla kurar", () => {
    const adapter = createDefindexAdapter(LIVE_ENV, { createSdk });
    expect(adapter.mode).toBe("live");
    expect(adapter.vaultAddress).toBe(LIVE_ENV.DEFINDEX_VAULT_ID);
    expect(createSdk).toHaveBeenCalledWith("sk_test");
  });

  it.each(["DEFINDEX_API_KEY", "DEFINDEX_VAULT_ID"])("canlı modda %s boşsa varsayılana düşmez, patlar", (key) => {
    expect(() => createDefindexAdapter({ ...LIVE_ENV, [key]: "" }, { createSdk })).toThrow(key);
  });

  it("bilinmeyen modu reddeder", () => {
    expect(() => createDefindexAdapter({ KASA_MODE: "staging" }, { createSdk })).toThrow("KASA_MODE");
  });
});
