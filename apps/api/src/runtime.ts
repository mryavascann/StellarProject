import { NETWORK, SEED } from "../../../config/simulation";
import { createHorizonGateway } from "./anchor/classic";
import { createAnchorClient, type AnchorClient } from "./anchor/client";
import { createApi } from "./app";
import { createDefindexAdapter } from "./defindex/client";
import type { Environment } from "./env";
import { buildVaultTransaction, createVaultRpc, readVaultSnapshot, submitVaultTransaction } from "./stellar-vault";

export interface RuntimeDependencies {
  readonly anchor?: AnchorClient;
}

function required(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik veya boş.`);
  return value;
}

/**
 * API'nin zincir, anchor ve DeFindex bağımlılıklarını ortamdan kurar.
 * Aynı fabrika yerel Node sunucusu ile Vercel route handler'ın farklılaşmasını önler.
 */
export function createRuntimeApi(environment: Environment, dependencies: RuntimeDependencies = {}) {
  const contractId = required(environment, "SHARED_VAULT_CONTRACT_ID");
  const adminPublic = required(environment, "ADMIN_PUBLIC");
  const rpc = createVaultRpc(NETWORK.rpcUrl);
  const vaultOptions = (sourceAccount: string) => ({
    networkPassphrase: NETWORK.networkPassphrase,
    contractId,
    sourceAccount,
  });

  const labels: Record<string, string> = {};
  (["ADMIN_PUBLIC", "MEMBER_A_PUBLIC", "MEMBER_B_PUBLIC", "MEMBER_C_PUBLIC"] as const).forEach((key, index) => {
    const address = environment[key];
    const seeded = SEED.members[index];
    if (address && seeded) labels[address] = seeded.name;
  });

  return createApi({
    vault: {
      name: SEED.vaultName,
      labels,
      contractId,
      readVault: () => readVaultSnapshot(vaultOptions(adminPublic), rpc),
      buildTransaction: (account, call) => buildVaultTransaction(vaultOptions(account), rpc, call),
      submit: (signedXdr) => submitVaultTransaction(vaultOptions(adminPublic), rpc, signedXdr),
    },
    anchor: dependencies.anchor ?? createAnchorClient(environment),
    classic: { gateway: createHorizonGateway(NETWORK.horizonUrl), networkPassphrase: NETWORK.networkPassphrase },
    defindex: createDefindexAdapter(environment),
  });
}
