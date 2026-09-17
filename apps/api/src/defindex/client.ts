import { DefindexSDK, SupportedNetworks } from "@defindex/sdk";
import { Asset, Keypair } from "@stellar/stellar-sdk";

import { DEFINDEX, NETWORK } from "../../../../config/simulation.js";
import { createLiveDefindex, type DefindexSdkLike } from "./live.js";
import { createHorizonVaultChain, createMockDefindex, type MockVaultChain } from "./mock.js";
import type { DefindexAdapter } from "./types.js";

/**
 * MOD SINIRI (KARAR K-003). `KASA_MODE` yalnızca burada ve `anchor/client.ts`'te okunur.
 * Geri kalan kod yalnızca `DefindexAdapter` arayüzünü görür.
 */

export type Environment = Readonly<Record<string, string | undefined>>;

export interface DefindexClientDependencies {
  readonly createSdk?: (apiKey: string) => DefindexSdkLike;
  readonly chain?: MockVaultChain;
  readonly now?: () => Date;
  readonly sleep?: (ms: number) => Promise<void>;
}

function required(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik veya boş.`);
  return value;
}

function defaultSdk(apiKey: string): DefindexSdkLike {
  return new DefindexSDK({ apiKey, defaultNetwork: SupportedNetworks.TESTNET });
}

/** Moda göre mock ya da live DeFindex adaptörünü kurar; eksik env varsayılana düşmez, açılışta patlar. */
export function createDefindexAdapter(
  environment: Environment,
  dependencies: DefindexClientDependencies = {},
): DefindexAdapter {
  const mode = environment.KASA_MODE;
  if (mode === "simulation") {
    const issuerSecret = required(environment, "MOCK_USDC_ISSUER_SECRET");
    const issuerPublic = Keypair.fromSecret(issuerSecret).publicKey();
    const configured = required(environment, "MOCK_DFTOKEN_CONTRACT_ID");
    const derived = new Asset(DEFINDEX.vaultSymbol, issuerPublic).contractId(NETWORK.networkPassphrase);
    if (configured !== derived) {
      throw new Error(
        `MOCK_DFTOKEN_CONTRACT_ID (${configured}) ihraççıdan türetilen adresle (${derived}) uyuşmuyor; deploy-mock-token yeniden çalıştırılmalı.`,
      );
    }
    return createMockDefindex({
      issuerSecret,
      chain: dependencies.chain ?? createHorizonVaultChain(issuerPublic),
      ...(dependencies.now ? { now: dependencies.now } : {}),
      ...(dependencies.sleep ? { sleep: dependencies.sleep } : {}),
    });
  }
  if (mode === "live") {
    const apiKey = required(environment, "DEFINDEX_API_KEY");
    const vaultAddress = required(environment, "DEFINDEX_VAULT_ID");
    return createLiveDefindex({ sdk: (dependencies.createSdk ?? defaultSdk)(apiKey), vaultAddress });
  }
  throw new Error(`KASA_MODE geçersiz: "${String(mode)}". "simulation" veya "live" olmalı.`);
}
