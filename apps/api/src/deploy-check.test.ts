// @vitest-environment node
/**
 * Dağıtılmış yığının duman testi. Demo jüri önünde Vercel URL'sinden yapılacağı için
 * yerelde geçen uçtan uca test bunun yerine geçmez: rewrite, env veya bundle kayması
 * yalnız dağıtımda görünür. Stub fetcher ile koşar; gerçek URL'ye `pnpm test:deploy` gider.
 */
import { Keypair, Networks, Operation, TransactionBuilder, WebAuth, Account } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { runDeployChecks } from "./deploy-check";

const ORIGIN = "https://kasa.example.app";
const HOST = "kasa.example.app";
const ACCOUNT = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 7)).publicKey();
const ISSUER = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 9)).publicKey();
const SIGNING = Keypair.fromRawEd25519Seed(Buffer.alloc(32, 11));
const CONTRACT_ID = "CCQRVAEEVD3NTKNILHWRWSUMW6IYWXTWWFEV6C2HFE2UHLG3EDVGOBLH";

/** Sequence 0 olan gerçek bir SEP-10 challenge üretir (Bölüm 9 kural 1). */
function challengeXdr(): string {
  return WebAuth.buildChallengeTx(SIGNING, ACCOUNT, HOST, 300, Networks.TESTNET, HOST);
}

/** Sequence'i 0 olmayan sahte challenge — anchor'ın kuralı çiğnediği durum. */
function badSequenceChallengeXdr(): string {
  return new TransactionBuilder(new Account(SIGNING.publicKey(), "41"), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: `${HOST} auth`, value: "x", source: ACCOUNT }))
    .setTimeout(300)
    .build()
    .toXDR();
}

interface StubOverrides {
  readonly toml?: string;
  readonly challenge?: string;
  readonly anchorIssuer?: string;
  readonly chunk?: string;
  readonly health?: unknown;
}

const defaultToml = (origin: string) =>
  [
    `SIGNING_KEY="${SIGNING.publicKey()}"`,
    `TRANSFER_SERVER_SEP0024="${origin}/sep24"`,
    `WEB_AUTH_ENDPOINT="${origin}/auth"`,
    `ANCHOR_QUOTE_SERVER="${origin}/sep38"`,
    "[[CURRENCIES]]",
    'code="USDC"',
    `issuer="${ISSUER}"`,
  ].join("\n");

/** Dağıtılmış yığını taklit eden fetcher; her test yalnız bozmak istediği yanıtı değiştirir. */
function stubFetcher(overrides: StubOverrides = {}) {
  return async (input: string): Promise<Response> => {
    const { pathname } = new URL(input);
    const text = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers });
    const json = (body: unknown) => Response.json(body);
    switch (pathname) {
      case "/health":
        return json(overrides.health ?? { ok: true });
      case "/.well-known/stellar.toml":
        return text(overrides.toml ?? defaultToml(ORIGIN), {
          "content-type": "text/plain",
          "access-control-allow-origin": "*",
        });
      case "/sep24/info":
        return json({
          deposit: { USDC: { enabled: true, min_amount: "100.00", max_amount: "50000.00" } },
          withdraw: { USDC: { enabled: true, min_amount: "200.00", max_amount: "50000.00" } },
          features: { account_creation: false, claimable_balances: false },
        });
      case "/auth":
        return json({ transaction: overrides.challenge ?? challengeXdr() });
      case "/api/anchor/info":
        return json({
          mode: "simulation",
          homeDomain: HOST,
          assetCode: "USDC",
          assetIssuer: overrides.anchorIssuer ?? ISSUER,
          rate: "50.0000000",
          deposit: { enabled: true },
          withdraw: { enabled: true },
        });
      case "/api/vault":
        return json({
          name: "Moda Ev Kasası",
          labels: {},
          contractId: CONTRACT_ID,
          balance: "1600000000",
          members: [{ address: ACCOUNT, joinedAt: 1, contributed: "500000000", withdrawn: "0" }],
          requests: [],
          ledger: [],
        });
      case "/giris":
        return text('<html><script src="/_next/static/chunks/a.js"></script></html>', { "content-type": "text/html" });
      case "/_next/static/chunks/a.js":
        return text(overrides.chunk ?? `const API="${ORIGIN}";`, { "content-type": "application/javascript" });
      default:
        return new Response("not found", { status: 404 });
    }
  };
}

describe("dağıtım duman testi", () => {
  it("sağlıklı dağıtımda rapor üretir", async () => {
    const report = await runDeployChecks({ origin: ORIGIN, account: ACCOUNT }, { fetcher: stubFetcher() });

    expect(report.origin).toBe(ORIGIN);
    expect(report.challengeSequence).toBe("0");
    expect(report.signingKey).toBe(SIGNING.publicKey());
    expect(report.contractId).toBe(CONTRACT_ID);
    expect(report.memberCount).toBe(1);
    expect(report.trustlineRequired).toBe(true);
  });

  it("dağıtılmış bundle localhost API'sine bakıyorsa durur", async () => {
    await expect(
      runDeployChecks({ origin: ORIGIN, account: ACCOUNT }, { fetcher: stubFetcher({ chunk: 'const API="http://localhost:8787";' }) }),
    ).rejects.toThrow(/localhost/u);
  });

  it("TOML uçları başka origin'e bakıyorsa durur", async () => {
    await expect(
      runDeployChecks({ origin: ORIGIN, account: ACCOUNT }, { fetcher: stubFetcher({ toml: defaultToml("https://eski-surum.example.app") }) }),
    ).rejects.toThrow(/TRANSFER_SERVER_SEP0024/u);
  });

  it("challenge sequence 0 değilse durur", async () => {
    await expect(
      runDeployChecks({ origin: ORIGIN, account: ACCOUNT }, { fetcher: stubFetcher({ challenge: badSequenceChallengeXdr() }) }),
    ).rejects.toThrow(/sequence/u);
  });

  it("API'nin varlığı TOML'daki issuer ile uyuşmuyorsa durur", async () => {
    await expect(
      runDeployChecks({ origin: ORIGIN, account: ACCOUNT }, { fetcher: stubFetcher({ anchorIssuer: Keypair.random().publicKey() }) }),
    ).rejects.toThrow(/issuer/u);
  });

  it("health ucu bozuksa durur", async () => {
    await expect(
      runDeployChecks({ origin: ORIGIN, account: ACCOUNT }, { fetcher: stubFetcher({ health: { ok: false } }) }),
    ).rejects.toThrow(/health/u);
  });

  it("HTTPS olmayan origin reddedilir", async () => {
    await expect(
      runDeployChecks({ origin: "http://localhost:3000", account: ACCOUNT }, { fetcher: stubFetcher() }),
    ).rejects.toThrow(/HTTPS/u);
  });
});
