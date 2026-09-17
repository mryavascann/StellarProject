import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { createMemoryAnchorChain, createMockAnchor, type ObservedPayment } from "./app";

const anchor = Keypair.random();
const issuer = Keypair.random();
const customer = Keypair.random();

function app(now = () => new Date("2026-09-11T12:00:00.000Z"), chain = createMemoryAnchorChain()) {
  return {
    instance: createMockAnchor({
      signingSecret: anchor.secret(),
      issuerPublic: issuer.publicKey(),
      custodialPublic: issuer.publicKey(),
      chain,
      now,
    }),
    chain,
  };
}

type Instance = ReturnType<typeof app>["instance"];

async function authenticate(instance: Instance): Promise<string> {
  const challengeResponse = await instance.request(`/auth?account=${customer.publicKey()}`);
  const { transaction } = (await challengeResponse.json()) as { transaction: string };
  const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET) as Transaction;
  tx.sign(customer);
  const response = await instance.request("/auth", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: tx.toEnvelope().toXDR("base64") }),
  });
  const body = (await response.json()) as { token: string };
  return body.token;
}

async function interactive(instance: Instance, token: string, kind: "deposit" | "withdraw", amount: string, extra = {}) {
  const response = await instance.request(`/sep24/transactions/${kind}/interactive`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ asset_code: "USDC", amount, ...extra }),
  });
  return { response, body: (await response.json()) as Record<string, any> };
}

async function status(instance: Instance, token: string, id: string) {
  const response = await instance.request(`/sep24/transaction?id=${id}`, { headers: { authorization: `Bearer ${token}` } });
  return (await response.json()) as Record<string, any>;
}

function payment(overrides: Partial<ObservedPayment> = {}): ObservedPayment {
  return { destination: issuer.publicKey(), amount: "15.0000000", assetCode: "USDC", assetIssuer: issuer.publicKey(), memo: "1", memoType: "id", ...overrides };
}

describe("mock anchor", () => {
  it("SEP-1 TOML'ı CORS, issuer ve bütün uçlarla sunar", async () => {
    const response = await app().instance.request("/.well-known/stellar.toml");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain(`SIGNING_KEY="${anchor.publicKey()}"`);
    expect(body).toContain(`issuer="${issuer.publicKey()}"`);
    expect(body).toContain("TRANSFER_SERVER_SEP0024");
    expect(body).toContain("ANCHOR_QUOTE_SERVER");
  });

  it("Vercel dağıtımında TOML ve popup URL'lerini dış HTTPS origin'iyle üretir", async () => {
    const instance = createMockAnchor({
      signingSecret: anchor.secret(),
      issuerPublic: issuer.publicKey(),
      custodialPublic: issuer.publicKey(),
      chain: createMemoryAnchorChain(),
      homeDomain: "stellar-kasa.vercel.app",
      publicOrigin: "https://stellar-kasa.vercel.app",
    });
    const toml = await (await instance.request("/.well-known/stellar.toml")).text();
    expect(toml).toContain('TRANSFER_SERVER_SEP0024="https://stellar-kasa.vercel.app/sep24"');
    expect(toml).toContain('WEB_AUTH_ENDPOINT="https://stellar-kasa.vercel.app/auth"');

    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "deposit", "10.0000000");
    expect(body.url).toMatch(/^https:\/\/stellar-kasa\.vercel\.app\/interactive\//u);
  });

  it("SEP-10 challenge sequence 0 üretir, home ve web auth alanlarını ayrı taşır", async () => {
    const response = await app().instance.request(`/auth?account=${customer.publicKey()}`);
    const { transaction } = (await response.json()) as { transaction: string };
    const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET) as Transaction;

    expect(tx.sequence).toBe("0");
    expect(tx.operations[0]).toMatchObject({ name: "localhost:8788 auth", source: customer.publicKey() });
    expect(tx.operations[1]).toMatchObject({ name: "web_auth_domain" });
  });

  it("yerelde imzalanan challenge karşılığında 15 dakikalık JWT verir", async () => {
    const token = await authenticate(app().instance);
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp: number; iat: number };
    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it("info yanıtında string limitleri ve claimable_balances false sözleşmesini korur", async () => {
    const response = await app().instance.request("/sep24/info");
    const body = await response.json() as Record<string, any>;
    expect(body.deposit.USDC.min_amount).toBe("100.00");
    expect(body.withdraw.USDC.max_amount).toBe("50000.00");
    expect(body.features.claimable_balances).toBe(false);
  });

  it("withdraw yanıtında memo ve memo_type değerlerini birlikte döndürür", async () => {
    const { instance } = app();
    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "withdraw", "15.0000000");
    expect(body.memo_type).toBe("id");
    expect(body.memo).toMatch(/^\d+$/u);
    expect(body.account_id).toBe(issuer.publicKey());
  });

  it("interactive ekranı iframe'e kapatır ve deposit durumunu zamanla ilerletir", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const { instance } = app(() => current);
    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "deposit", "10.0000000");
    const popup = await instance.request(new URL(body.url).pathname);
    expect(popup.headers.get("x-frame-options")).toBe("DENY");

    current = new Date("2026-09-11T12:00:06.100Z");
    expect(await status(instance, token, body.id)).toMatchObject({ status: "pending_anchor" });
  });

  it("deposit trustline yokken pending_trust'ta kalır; trustline gelince USDC'yi zincire bir kez öder", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const { instance, chain } = app(() => current);
    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "deposit", "10.0000000");

    current = new Date("2026-09-11T12:00:09.500Z");
    expect(await status(instance, token, body.id)).toMatchObject({ status: "pending_trust" });
    expect(chain.payouts).toHaveLength(0);

    chain.grantTrustline(customer.publicKey());
    const completed = await status(instance, token, body.id);
    expect(completed).toMatchObject({ status: "completed", stellar_transaction_id: chain.payouts[0]?.hash });
    await status(instance, token, body.id);
    expect(chain.payouts).toEqual([{ destination: customer.publicKey(), amount: "10.0000000", hash: expect.any(String) }]);
  });

  it("ek durum dallarını simulate parametresiyle tetikler", async () => {
    const { instance } = app();
    const token = await authenticate(instance);
    const response = await instance.request("/sep24/transaction?id=test&simulate=on_hold", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await response.json()).toMatchObject({ status: "on_hold" });
  });

  it("90 saniyelik quote üretir ve süresi dolan quote'u interactive istekte reddeder", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const { instance } = app(() => current);
    const quoteResponse = await instance.request("/sep38/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sell_amount: "500.0000000" }),
    });
    const quote = await quoteResponse.json() as { id: string; expires_at: string };
    expect(new Date(quote.expires_at).getTime() - current.getTime()).toBe(90_000);

    current = new Date("2026-09-11T12:01:31.000Z");
    const token = await authenticate(instance);
    const { response } = await interactive(instance, token, "deposit", "10.0000000", { quote_id: quote.id });
    expect(response.status).toBe(400);
  });

  it("15 dakika dolan JWT ile korumalı isteğe 401 döner", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const { instance } = app(() => current);
    const token = await authenticate(instance);
    current = new Date("2026-09-11T12:15:01.000Z");
    const { response } = await interactive(instance, token, "deposit", "10.0000000");
    expect(response.status).toBe(401);
  });

  it("withdraw, doğru memo'lu zincir ödemesi görülene kadar sıra kullanıcıda bekler; sonra tamamlanır", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const { instance, chain } = app(() => current);
    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "withdraw", "15.0000000");

    current = new Date("2026-09-11T12:00:30.000Z");
    expect(await status(instance, token, body.id)).toMatchObject({ status: "pending_user_transfer_start" });

    chain.recordPayment("a".repeat(64), payment({ memo: body.memo }));
    const report = await instance.request("/mock/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: body.id, tx_hash: "a".repeat(64) }),
    });
    expect(await report.json()).toEqual({ matched: true });
    expect(await status(instance, token, body.id)).toMatchObject({ status: "pending_anchor" });
    current = new Date("2026-09-11T12:00:34.000Z");
    expect(await status(instance, token, body.id)).toMatchObject({ status: "completed" });
  });

  it("yanlış memo ile gelen ödemeyi eşleştirmez ve pending_external durumunda tutar", async () => {
    const { instance, chain } = app();
    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "withdraw", "15.0000000");
    chain.recordPayment("b".repeat(64), payment({ memo: `${body.memo}9` }));

    const report = await instance.request("/mock/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: body.id, tx_hash: "b".repeat(64) }),
    });
    expect(report.status).toBe(422);
    expect(await status(instance, token, body.id)).toMatchObject({ status: "pending_external", memo_matched: false });
  });

  it("zincirde olmayan ya da başka hesaba giden ödemeyi kabul etmez", async () => {
    const { instance, chain } = app();
    const token = await authenticate(instance);
    const { body } = await interactive(instance, token, "withdraw", "15.0000000");

    const missing = await instance.request("/mock/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: body.id, tx_hash: "c".repeat(64) }),
    });
    expect(missing.status).toBe(404);

    chain.recordPayment("d".repeat(64), payment({ memo: body.memo, destination: Keypair.random().publicKey() }));
    const elsewhere = await instance.request("/mock/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: body.id, tx_hash: "d".repeat(64) }),
    });
    expect(elsewhere.status).toBe(422);
    // Zaman ilerlemedi ve eşleşme olmadı: işlem başlangıç durumunda kalır, askıya düşmez.
    expect(await status(instance, token, body.id)).toMatchObject({ status: "incomplete" });
  });
});
