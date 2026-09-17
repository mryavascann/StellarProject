import { createMemoryAnchorChain } from "@kasa/mock-anchor";
import { Asset, Keypair, Networks } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { DEFINDEX } from "../../../config/simulation";
import { createVercelApp } from "./vercel-app";

const admin = Keypair.random();
const issuer = Keypair.random();
const anchorSigner = Keypair.random();

const environment = {
  KASA_MODE: "simulation",
  ADMIN_PUBLIC: admin.publicKey(),
  MEMBER_A_PUBLIC: Keypair.random().publicKey(),
  MEMBER_B_PUBLIC: Keypair.random().publicKey(),
  MEMBER_C_PUBLIC: Keypair.random().publicKey(),
  SHARED_VAULT_CONTRACT_ID: `C${"A".repeat(55)}`,
  MOCK_USDC_ISSUER_SECRET: issuer.secret(),
  MOCK_USDC_ISSUER_PUBLIC: issuer.publicKey(),
  MOCK_DFTOKEN_CONTRACT_ID: new Asset(DEFINDEX.vaultSymbol, issuer.publicKey()).contractId(Networks.TESTNET),
  MOCK_ANCHOR_SIGNING_SECRET: anchorSigner.secret(),
  ANCHOR_HOME_DOMAIN: "stellar-kasa.vercel.app",
  DEFINDEX_API_KEY: "simulation-not-used",
};

describe("Vercel birleşik sunucu uygulaması", () => {
  it("web API ve mock anchor'ı aynı origin üzerinde eksiksiz sunar", async () => {
    const app = createVercelApp(environment, {
      publicOrigin: "https://stellar-kasa.vercel.app",
      chain: createMemoryAnchorChain(),
    });

    expect((await app.request("/health")).status).toBe(200);
    expect((await app.request("/api/health")).status).toBe(200);

    const tomlResponse = await app.request("/api/anchor-proxy/.well-known/stellar.toml");
    const toml = await tomlResponse.text();
    expect(tomlResponse.headers.get("access-control-allow-origin")).toBe("*");
    expect(toml).toContain('TRANSFER_SERVER_SEP0024="https://stellar-kasa.vercel.app/sep24"');
    expect(toml).toContain(`issuer="${issuer.publicKey()}"`);

    const info = await (await app.request("/api/anchor/info")).json() as Record<string, unknown>;
    expect(info).toMatchObject({
      mode: "simulation",
      homeDomain: "stellar-kasa.vercel.app",
      assetCode: "USDC",
      assetIssuer: issuer.publicKey(),
      rate: "50.0000000",
    });
  });

  it("public origin HTTPS değilse ve issuer adresi secret ile eşleşmiyorsa açılışta durur", () => {
    expect(() => createVercelApp(environment, { publicOrigin: "http://stellar-kasa.vercel.app", chain: createMemoryAnchorChain() })).toThrow("HTTPS");
    expect(() => createVercelApp(
      { ...environment, MOCK_USDC_ISSUER_PUBLIC: Keypair.random().publicKey() },
      { publicOrigin: "https://stellar-kasa.vercel.app", chain: createMemoryAnchorChain() },
    )).toThrow("MOCK_USDC_ISSUER_PUBLIC");
  });
});
