import { serve } from "@hono/node-server";

import { NETWORK, PORTS, SEED } from "../../../config/simulation.js";
import { createHorizonGateway } from "./anchor/classic.js";
import { createAnchorClient } from "./anchor/client.js";
import { createApi } from "./app.js";
import { createDefindexAdapter } from "./defindex/client.js";
import { loadEnvironment } from "./env.js";
import { buildVaultTransaction, createVaultRpc, readVaultSnapshot, submitVaultTransaction } from "./stellar-vault.js";

const environment = loadEnvironment();
const contractId = environment.SHARED_VAULT_CONTRACT_ID;
const adminPublic = environment.ADMIN_PUBLIC;
if (!contractId || !adminPublic) throw new Error("SHARED_VAULT_CONTRACT_ID ve ADMIN_PUBLIC gerekli.");

const rpc = createVaultRpc(NETWORK.rpcUrl);
const vaultOptions = (sourceAccount: string) => ({
  networkPassphrase: NETWORK.networkPassphrase,
  contractId,
  sourceAccount,
});

// Demo üye etiketleri: env'deki adresler → config'deki isimler (⚠ SİM). Kontrat isim tutmaz.
const labels: Record<string, string> = {};
(["ADMIN_PUBLIC", "MEMBER_A_PUBLIC", "MEMBER_B_PUBLIC", "MEMBER_C_PUBLIC"] as const).forEach((key, index) => {
  const address = environment[key];
  const seeded = SEED.members[index];
  if (address && seeded) labels[address] = seeded.name;
});

const app = createApi({
  vault: {
    name: SEED.vaultName,
    labels,
    contractId,
    readVault: () => readVaultSnapshot(vaultOptions(adminPublic), rpc),
    buildTransaction: (account, call) => buildVaultTransaction(vaultOptions(account), rpc, call),
    submit: (signedXdr) => submitVaultTransaction(vaultOptions(adminPublic), rpc, signedXdr),
  },
  anchor: createAnchorClient(environment),
  classic: { gateway: createHorizonGateway(NETWORK.horizonUrl), networkPassphrase: NETWORK.networkPassphrase },
  defindex: createDefindexAdapter(environment),
});

serve({ fetch: app.fetch, port: PORTS.api }, ({ port }) => {
  console.log(`Kasa API (${environment.KASA_MODE}) http://localhost:${port} adresinde hazır.`);
});
