import { createHorizonAnchorChain, createMockAnchor, type MockAnchorChain } from "@kasa/mock-anchor";
import { Keypair } from "@stellar/stellar-sdk";
import { Hono } from "hono";

import { ANCHOR, NETWORK } from "../../../config/simulation";
import { createAnchorClient } from "./anchor/client";
import type { Environment } from "./env";
import { createRuntimeApi } from "./runtime";

export interface VercelAppOptions {
  readonly publicOrigin: string;
  readonly chain?: MockAnchorChain;
}

function required(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik veya boş.`);
  return value;
}

/**
 * Vercel'de API ile simülasyon anchor'ını tek Node route handler altında birleştirir.
 * Anchor çağrıları aynı süreçte yapıldığı için JWT ve işlem durumu ayrı servislere dağılmaz.
 */
export function createVercelApp(environment: Environment, options: VercelAppOptions) {
  if (environment.KASA_MODE !== "simulation") {
    throw new Error("Vercel birleşik uygulaması yalnız KASA_MODE=simulation için kullanılır.");
  }
  const publicUrl = new URL(options.publicOrigin);
  if (publicUrl.protocol !== "https:") throw new Error("Vercel public origin HTTPS olmalı.");
  const homeDomain = required(environment, "ANCHOR_HOME_DOMAIN");
  if (publicUrl.host !== homeDomain) {
    throw new Error(`ANCHOR_HOME_DOMAIN (${homeDomain}) public origin (${publicUrl.host}) ile uyuşmuyor.`);
  }

  const issuerSecret = required(environment, "MOCK_USDC_ISSUER_SECRET");
  const issuerPublic = required(environment, "MOCK_USDC_ISSUER_PUBLIC");
  if (Keypair.fromSecret(issuerSecret).publicKey() !== issuerPublic) {
    throw new Error("MOCK_USDC_ISSUER_PUBLIC, MOCK_USDC_ISSUER_SECRET ile uyuşmuyor.");
  }

  const mockAnchor = createMockAnchor({
    signingSecret: required(environment, "MOCK_ANCHOR_SIGNING_SECRET"),
    issuerPublic,
    custodialPublic: issuerPublic,
    chain: options.chain ?? createHorizonAnchorChain({ issuerSecret, assetCode: ANCHOR.assetCode, horizonUrl: NETWORK.horizonUrl }),
    homeDomain,
    publicOrigin: publicUrl.origin,
  });
  const anchor = createAnchorClient(environment, {
    fetcher: async (input, init) => mockAnchor.request(input, init),
  });
  const api = createRuntimeApi(environment, { anchor });
  const app = new Hono();
  app.get("/api/health", (context) => context.json({ ok: true }));
  app.route("/api/anchor-proxy", mockAnchor);
  app.route("/", api);
  return app;
}
