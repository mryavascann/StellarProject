import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { createMockAnchor } from "./app.js";

const anchor = Keypair.random();
const issuer = Keypair.random();
const customer = Keypair.random();

function app(now = () => new Date("2026-09-11T12:00:00.000Z")) {
  return createMockAnchor({
    signingSecret: anchor.secret(),
    issuerPublic: issuer.publicKey(),
    custodialPublic: issuer.publicKey(),
    now,
  });
}

async function authenticate(instance = app()): Promise<string> {
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

describe("mock anchor", () => {
  it("SEP-1 TOML'ı CORS, issuer ve bütün uçlarla sunar", async () => {
    const response = await app().request("/.well-known/stellar.toml");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("content-type")).toContain("text/plain");
    expect(body).toContain(`SIGNING_KEY="${anchor.publicKey()}"`);
    expect(body).toContain(`issuer="${issuer.publicKey()}"`);
    expect(body).toContain("TRANSFER_SERVER_SEP0024");
    expect(body).toContain("ANCHOR_QUOTE_SERVER");
  });

  it("SEP-10 challenge sequence 0 üretir, home ve web auth alanlarını ayrı taşır", async () => {
    const response = await app().request(`/auth?account=${customer.publicKey()}`);
    const { transaction } = (await response.json()) as { transaction: string };
    const tx = TransactionBuilder.fromXDR(transaction, Networks.TESTNET) as Transaction;

    expect(tx.sequence).toBe("0");
    expect(tx.operations[0]).toMatchObject({ name: "localhost:8788 auth", source: customer.publicKey() });
    expect(tx.operations[1]).toMatchObject({ name: "web_auth_domain" });
  });

  it("yerelde imzalanan challenge karşılığında 15 dakikalık JWT verir", async () => {
    const token = await authenticate();
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp: number; iat: number };

    expect(payload.exp - payload.iat).toBe(15 * 60);
  });

  it("info yanıtında string limitleri ve claimable_balances false sözleşmesini korur", async () => {
    const response = await app().request("/sep24/info");
    const body = await response.json() as Record<string, any>;

    expect(body.deposit.USDC.min_amount).toBe("100.00");
    expect(body.withdraw.USDC.max_amount).toBe("50000.00");
    expect(body.features.claimable_balances).toBe(false);
  });

  it("withdraw yanıtında memo ve memo_type değerlerini birlikte döndürür", async () => {
    const instance = app();
    const token = await authenticate(instance);
    const response = await instance.request("/sep24/transactions/withdraw/interactive", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ asset_code: "USDC", amount: "15.0000000" }),
    });
    const body = await response.json() as Record<string, any>;

    expect(body.memo_type).toBe("id");
    expect(body.memo).toMatch(/^\d+$/u);
    expect(body.account_id).toBe(issuer.publicKey());
  });

  it("interactive ekranı iframe'e kapatır ve işlem durumunu zamanla ilerletir", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const instance = app(() => current);
    const token = await authenticate(instance);
    const created = await instance.request("/sep24/transactions/deposit/interactive", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ asset_code: "USDC", amount: "10.0000000" }),
    });
    const transaction = await created.json() as { id: string; url: string };
    const popup = await instance.request(new URL(transaction.url).pathname);
    expect(popup.headers.get("x-frame-options")).toBe("DENY");

    current = new Date("2026-09-11T12:00:06.100Z");
    const status = await instance.request(`/sep24/transaction?id=${transaction.id}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await status.json()).toMatchObject({ status: "pending_anchor" });
  });

  it("ek durum dallarını simulate parametresiyle tetikler", async () => {
    const instance = app();
    const token = await authenticate(instance);
    const response = await instance.request("/sep24/transaction?id=test&simulate=on_hold", {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(await response.json()).toMatchObject({ status: "on_hold" });
  });

  it("90 saniyelik quote üretir ve süresi dolan quote'u interactive istekte reddeder", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const instance = app(() => current);
    const quoteResponse = await instance.request("/sep38/quote", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sell_amount: "500.0000000" }),
    });
    const quote = await quoteResponse.json() as { id: string; expires_at: string };
    expect(new Date(quote.expires_at).getTime() - current.getTime()).toBe(90_000);

    current = new Date("2026-09-11T12:01:31.000Z");
    const token = await authenticate(instance);
    const response = await instance.request("/sep24/transactions/deposit/interactive", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ asset_code: "USDC", amount: "10.0000000", quote_id: quote.id }),
    });
    expect(response.status).toBe(400);
  });

  it("15 dakika dolan JWT ile korumalı isteğe 401 döner", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const instance = app(() => current);
    const token = await authenticate(instance);
    current = new Date("2026-09-11T12:15:01.000Z");

    const response = await instance.request("/sep24/transactions/deposit/interactive", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ asset_code: "USDC", amount: "10.0000000" }),
    });
    expect(response.status).toBe(401);
  });

  it("yanlış memo ile gelen ödemeyi eşleştirmez ve pending_external durumunda tutar", async () => {
    let current = new Date("2026-09-11T12:00:00.000Z");
    const instance = app(() => current);
    const token = await authenticate(instance);
    const created = await instance.request("/sep24/transactions/withdraw/interactive", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ asset_code: "USDC", amount: "15.0000000" }),
    });
    const transaction = await created.json() as { id: string; memo: string };
    const payment = await instance.request("/mock/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: transaction.id, memo: `${transaction.memo}9` }),
    });
    expect(payment.status).toBe(422);

    current = new Date("2026-09-11T12:00:30.000Z");
    const status = await instance.request(`/sep24/transaction?id=${transaction.id}`);
    expect(await status.json()).toMatchObject({ status: "pending_external", memo_matched: false });
  });
});
