import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NETWORK, PORTS } from "../../../config/simulation.js";
import { createApi } from "./app.js";
import { readVaultSnapshot } from "./stellar-vault.js";

function environmentValue(environment: string, key: string): string {
  const match = new RegExp(`^${key}=(.*)$`, "mu").exec(environment);
  if (!match?.[1]) throw new Error(`${key} eksik veya boş.`);
  return match[1];
}

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const environment = readFileSync(path.join(workspace, ".env.simulation"), "utf8");
const app = createApi({
  readVault: () => readVaultSnapshot({
    rpcUrl: NETWORK.rpcUrl,
    networkPassphrase: NETWORK.networkPassphrase,
    contractId: environmentValue(environment, "SHARED_VAULT_CONTRACT_ID"),
    sourceAccount: environmentValue(environment, "ADMIN_PUBLIC"),
  }),
});

serve({ fetch: app.fetch, port: PORTS.api }, ({ port }) => {
  console.log(`Kasa API http://localhost:${port} adresinde hazır.`);
});
