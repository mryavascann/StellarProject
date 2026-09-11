import { serve } from "@hono/node-server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PORTS } from "../../../config/simulation.js";
import { createMockAnchor } from "./app.js";

function environmentValue(environment: string, key: string): string {
  const match = new RegExp(`^${key}=(.*)$`, "mu").exec(environment);
  if (!match?.[1]) throw new Error(`${key} eksik veya boş.`);
  return match[1];
}

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const environment = readFileSync(path.join(workspace, ".env.simulation"), "utf8");
const app = createMockAnchor({
  signingSecret: environmentValue(environment, "MOCK_ANCHOR_SIGNING_SECRET"),
  issuerPublic: environmentValue(environment, "MOCK_USDC_ISSUER_PUBLIC"),
  custodialPublic: environmentValue(environment, "MOCK_USDC_ISSUER_PUBLIC"),
});

serve({ fetch: app.fetch, port: PORTS.mockAnchor }, ({ port }) => {
  console.log(`Mock banka bağlantısı http://localhost:${port} adresinde hazır.`);
});
