import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ANCHOR, NETWORK, PORTS } from "../../../config/simulation.js";
import { createHorizonAnchorChain, createMockAnchor } from "./app.js";

function environmentValue(environment: string, key: string): string {
  const match = new RegExp(`^${key}=(.*)$`, "mu").exec(environment);
  if (!match?.[1]) throw new Error(`${key} eksik veya boş.`);
  return match[1];
}

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const environment = readFileSync(path.join(workspace, ".env.simulation"), "utf8");
const issuerSecret = environmentValue(environment, "MOCK_USDC_ISSUER_SECRET");
const issuerPublic = environmentValue(environment, "MOCK_USDC_ISSUER_PUBLIC");

// ⚠ SİM: custodial hesap = ihraççı. Kullanıcının ödemesi ihraççıya gidince varlık yanar,
// bu da gerçek anchor'daki "fiat'a çevrildi" adımının zincirdeki karşılığıdır.
const app = createMockAnchor({
  signingSecret: environmentValue(environment, "MOCK_ANCHOR_SIGNING_SECRET"),
  issuerPublic,
  custodialPublic: issuerPublic,
  chain: createHorizonAnchorChain({ issuerSecret, assetCode: ANCHOR.assetCode, horizonUrl: NETWORK.horizonUrl }),
});

serve({ fetch: app.fetch, port: PORTS.mockAnchor }, ({ port }) => {
  console.log(`Mock banka bağlantısı http://localhost:${port} adresinde hazır.`);
});
