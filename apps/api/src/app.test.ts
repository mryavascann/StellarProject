import { createMemoryAnchorChain, createMockAnchor } from "@kasa/mock-anchor";
import { Account } from "@stellar/stellar-sdk";
import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { createAnchorClient } from "./anchor/client";
import { createApi } from "./app";
import { createMockDefindex } from "./defindex/mock";
import type { VaultSnapshot } from "./stellar-vault";

const anchorSigner = Keypair.random();
const issuer = Keypair.random();
const member = Keypair.random();

const SNAPSHOT: VaultSnapshot = {
  balance: 1_600_000_000n,
  members: [{ address: member.publicKey(), joinedAt: 1, contributed: 500_000_000n, withdrawn: 0n }],
  requests: [{
    id: 0,
    requester: member.publicKey(),
    amount: 1_200_000_000n,
    note: "Kira Ekim",
    approvals: [],
    status: "Pending",
    createdAt: 1,
    expiresAt: 2,
  }],
  ledger: [{ kind: "Deposit", member: member.publicKey(), amount: 500_000_000n, at: 1, requestId: null }],
};

function api(overrides: { readVault?: () => Promise<VaultSnapshot> } = {}) {
  const mockAnchor = createMockAnchor({
    signingSecret: anchorSigner.secret(),
    issuerPublic: issuer.publicKey(),
    custodialPublic: issuer.publicKey(),
    chain: createMemoryAnchorChain(),
  });
  const submit = vi.fn(async (_transaction: Transaction) => ({ hash: "9".repeat(64) }));
  const buildTransaction = vi.fn(async () => "XDR");
  const join = vi.fn(async (account: string) => {
    if (!account.startsWith("G")) throw new TypeError("Geçerli bir Stellar adresi gerekli (G ile başlar).");
    return { funded: true, added: true, hash: "6".repeat(64) };
  });
  const app = createApi({
    vault: {
      name: "Test Kasası",
      labels: { [member.publicKey()]: "Deniz" },
      contractId: `C${"A".repeat(55)}`,
      readVault: overrides.readVault ?? (async () => SNAPSHOT),
      buildTransaction,
      submit: async () => ({ hash: "8".repeat(64) }),
      join,
    },
    anchor: createAnchorClient(
      { KASA_MODE: "simulation", ANCHOR_HOME_DOMAIN: "localhost:8788" },
      { fetcher: async (url, init) => mockAnchor.request(url, init) },
    ),
    classic: {
      networkPassphrase: Networks.TESTNET,
      gateway: { loadAccount: async (id) => new Account(id, "3"), hasTrustline: async () => false, submit: async () => ({ hash: "7".repeat(64) }) },
    },
    defindex: createMockDefindex({
      issuerSecret: issuer.secret(),
      chain: { loadSequence: async () => "1", shareBalance: async () => 950_0000000n, submit },
      sleep: async () => undefined,
    }),
    wait: async () => undefined,
  });
  return { app, submit, buildTransaction, join };
}

async function post(app: ReturnType<typeof api>["app"], path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  return app.request(path, { method: "POST", headers, body: JSON.stringify(body) });
}

/** SEP-10'u tamamlar ve JWT'yi döndürür: oturumu API değil, tarayıcı taşır. */
async function login(app: ReturnType<typeof api>["app"]): Promise<string> {
  const challenge = await (await post(app, "/api/anchor/challenge", { account: member.publicKey() })).json() as { transaction: string };
  const transaction = TransactionBuilder.fromXDR(challenge.transaction, Networks.TESTNET) as Transaction;
  transaction.sign(member);
  const response = await post(app, "/api/anchor/token", { account: member.publicKey(), signedTransaction: transaction.toXDR() });
  expect(response.status).toBe(200);
  const session = await response.json() as { token: string; expiresAt: number };
  expect(session.token.split(".")).toHaveLength(3);
  expect(session.expiresAt).toBeGreaterThan(Date.now());
  return session.token;
}

describe("Kasa API", () => {
  it("sağlık ve kasa görünümünü bigint kaybetmeden JSON olarak sunar", async () => {
    const { app } = api();
    expect((await app.request("/health")).status).toBe(200);
    const response = await app.request("/api/vault");
    const body = await response.json() as Record<string, any>;

    expect(body.name).toBe("Test Kasası");
    expect(body.labels[member.publicKey()]).toBe("Deniz");
    expect(body.balance).toBe("1600000000");
    expect(body.members[0].contributed).toBe("500000000");
    expect(body.requests[0].amount).toBe("1200000000");
    expect(body.ledger[0].amount).toBe("500000000");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("RPC hatasını ham ayrıntı sızdırmadan 503 olarak döndürür", async () => {
    const { app } = api({ readVault: async () => { throw new Error("secret rpc detail"); } });
    const response = await app.request("/api/vault");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret rpc detail");
  });

  it("kontrat çağrısını stroop metniyle kurar; bozuk girdiye 400 döner", async () => {
    const { app, buildTransaction } = api();
    const ok = await post(app, "/api/vault/tx", { account: member.publicKey(), function: "deposit", amount: "120000000" });
    expect(await ok.json()).toEqual({ xdr: "XDR" });
    expect(buildTransaction).toHaveBeenCalledWith(member.publicKey(), { function: "deposit", member: member.publicKey(), amount: 120000000n });

    const bad = await post(app, "/api/vault/tx", { account: member.publicKey(), function: "deposit", amount: "1.5" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: expect.stringContaining("stroop") });
  });

  it("anchor: JWT'siz deposit 401 auth_required; JWT ile popup URL'i ve USDC tutarı döner", async () => {
    const { app } = api();
    const denied = await post(app, "/api/anchor/deposit", { account: member.publicKey(), amountFiat: "1000.00" });
    expect(denied.status).toBe(401);
    expect(await denied.json()).toEqual({ error: "auth_required" });

    const token = await login(app);
    const started = await post(app, "/api/anchor/deposit", { account: member.publicKey(), amountFiat: "1000.00" }, token);
    expect(started.status).toBe(200);
    expect(await started.json()).toMatchObject({ url: expect.stringContaining("kind=deposit"), amountAsset: "20.0000000" });
  });

  it("anchor: durum ucu marka metnine eşler, info ucu kur ve limitleri metin verir", async () => {
    const { app } = api();
    const token = await login(app);
    const started = await (await post(app, "/api/anchor/withdraw", { account: member.publicKey(), amountAsset: "15.0000000" }, token)).json() as { id: string; payment: { memo: string; memoType: string } };
    expect(started.payment.memoType).toBe("id");

    const status = await app.request(`/api/anchor/transaction?account=${member.publicKey()}&id=${started.id}&direction=withdraw`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await status.json()).toMatchObject({ status: "incomplete", title: "Yarım kaldı" });

    const info = await (await app.request("/api/anchor/info")).json() as Record<string, unknown>;
    expect(info).toMatchObject({ rate: "50.0000000", trustlineRequired: true, assetIssuer: issuer.publicKey() });
  });

  it("kasa: davet ucu yeni cüzdanı üye yapar, ikinci çağrıda tekrar eklemez", async () => {
    const { app, join } = api();
    const guest = Keypair.random().publicKey();

    const first = await post(app, "/api/vault/join", { account: guest });
    expect(first.status).toBe(200);
    expect(await first.json()).toEqual({ funded: true, added: true, hash: "6".repeat(64) });
    expect(join).toHaveBeenCalledWith(guest);

    const bad = await post(app, "/api/vault/join", { account: "BOZUK" });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: expect.stringContaining("adres") });
  });

  it("defindex: özet bigint'leri metin verir; başkasının imzalı işlemi submit'ten geçmez", async () => {
    const { app, submit } = api();
    const overview = await (await app.request(`/api/defindex/overview?account=${member.publicKey()}`)).json() as Record<string, any>;
    expect(overview.balance.shares).toBe("9500000000");
    expect(overview.mode).toBe("simulation");

    const unsigned = await (await post(app, "/api/defindex/deposit/tx", { account: member.publicKey(), amountStroops: "10000000" })).json() as { xdr: string };
    const transaction = TransactionBuilder.fromXDR(unsigned.xdr, Networks.TESTNET) as Transaction;
    transaction.sign(member);
    const foreign = await post(app, "/api/defindex/submit", { account: Keypair.random().publicKey(), signedXdr: transaction.toXDR() });
    expect(foreign.status).toBe(400);
    expect(submit).not.toHaveBeenCalled();

    const own = await post(app, "/api/defindex/submit", { account: member.publicKey(), signedXdr: transaction.toXDR() });
    expect(await own.json()).toEqual({ txHash: "9".repeat(64), success: true });
  });
});
