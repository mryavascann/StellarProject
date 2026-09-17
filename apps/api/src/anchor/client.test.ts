import { createMemoryAnchorChain, createMockAnchor } from "@kasa/mock-anchor";
import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { AnchorAuthRequiredError, createAnchorClient, type AnchorClient } from "./client";

const signer = Keypair.random();
const issuer = Keypair.random();
const member = Keypair.random();
const HOME = "localhost:8788";

function setup(options: { mode?: string; now?: () => Date } = {}) {
  const chain = createMemoryAnchorChain();
  const anchor = createMockAnchor({
    chain,
    signingSecret: signer.secret(),
    issuerPublic: issuer.publicKey(),
    custodialPublic: issuer.publicKey(),
    ...(options.now ? { now: options.now } : {}),
  });
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => anchor.request(url, init));
  const client = createAnchorClient(
    { KASA_MODE: options.mode ?? "simulation", ANCHOR_HOME_DOMAIN: HOME },
    { fetcher, now: options.now ?? (() => new Date()) },
  );
  return { client, fetcher, chain };
}

async function login(client: AnchorClient): Promise<void> {
  const challenge = await client.challenge(member.publicKey());
  const transaction = TransactionBuilder.fromXDR(challenge, Networks.TESTNET) as Transaction;
  transaction.sign(member);
  await client.exchangeToken(member.publicKey(), transaction.toXDR());
}

describe("anchor istemcisi (mod sınırı)", () => {
  it("SEP-1'i bir kez indirir ve sonraki çağrılarda önbellekten okur", async () => {
    const { client, fetcher } = setup();
    await client.metadata();
    await client.metadata();
    expect(fetcher.mock.calls.filter(([url]) => url.includes("stellar.toml"))).toHaveLength(1);
    expect(client.mode).toBe("simulation");
  });

  it("/info'yu okur: limitler metin kalır, claimable_balances false → trustline zorunlu", async () => {
    const { client } = setup();
    const info = await client.info();
    expect(info.deposit).toEqual({ enabled: true, minAmount: "100.00", maxAmount: "50000.00", feeFixed: "15.00", feePercent: "0.5" });
    expect(info.withdraw.feePercent).toBe("0.7");
    expect(info.trustlineRequired).toBe(true);
  });

  it("challenge → cüzdan imzası → JWT oturumu; deposit isteği Bearer ile gider", async () => {
    const { client, fetcher } = setup();
    expect(client.hasSession(member.publicKey())).toBe(false);
    await login(client);
    expect(client.hasSession(member.publicKey())).toBe(true);

    const started = await client.startDeposit(member.publicKey(), "20.0000000");
    expect(started.id).toBeTypeOf("string");
    expect(started.url).toContain("kind=deposit");
    const depositCall = fetcher.mock.calls.find(([url]) => url.includes("deposit/interactive"));
    const headers = new Headers(depositCall?.[1]?.headers);
    expect(headers.get("authorization")).toMatch(/^Bearer /u);
    expect(JSON.parse(String(depositCall?.[1]?.body))).toMatchObject({
      account: member.publicKey(),
      asset_code: "USDC",
      asset_issuer: issuer.publicKey(),
      amount: "20.0000000",
    });
  });

  it("oturum yokken anchor'a gitmeden auth_required hatası verir", async () => {
    const { client, fetcher } = setup();
    await expect(client.startDeposit(member.publicKey(), "20.0000000")).rejects.toBeInstanceOf(AnchorAuthRequiredError);
    expect(fetcher.mock.calls.some(([url]) => url.includes("interactive"))).toBe(false);
  });

  it("JWT süresi dolunca (401) oturumu düşürür ve auth_required ile yeniden girişi ister", async () => {
    let current = new Date("2026-09-16T12:00:00.000Z");
    const { client } = setup({ now: () => current });
    await login(client);
    current = new Date("2026-09-16T12:16:00.000Z");
    await expect(client.startDeposit(member.publicKey(), "20.0000000")).rejects.toBeInstanceOf(AnchorAuthRequiredError);
    expect(client.hasSession(member.publicKey())).toBe(false);
  });

  it("withdraw yanıtındaki memo ve memo_type'ı ödemeye birebir taşır", async () => {
    const { client } = setup();
    await login(client);
    const started = await client.startWithdraw(member.publicKey(), "15.0000000");
    expect(started.payment).toEqual({
      destination: issuer.publicKey(),
      amount: "15.0000000",
      memo: started.memo,
      memoType: "id",
    });
    expect(started.memo).toMatch(/^\d+$/u);
  });

  it("işlem durumunu ham olarak verir; yanlış memo bildirimi sonrası memo_matched false gelir", async () => {
    const { client, chain } = setup();
    await login(client);
    const started = await client.startWithdraw(member.publicKey(), "15.0000000");
    chain.recordPayment("f".repeat(64), { destination: issuer.publicKey(), amount: "15.0000000", assetCode: "USDC", assetIssuer: issuer.publicKey(), memo: `${started.memo}9`, memoType: "id" });
    await expect(client.reportWithdrawalPayment(started.id, `${started.memo}9`, "f".repeat(64))).rejects.toThrow("memo");
    expect(await client.transaction(member.publicKey(), started.id)).toMatchObject({ status: "pending_external", memoMatched: false });
  });

  it("canlı modda ödeme bildirimi anchor'a gitmez (anchor zinciri kendisi izler)", async () => {
    const { client, fetcher } = setup({ mode: "live" });
    await client.reportWithdrawalPayment("id", "1", "f".repeat(64));
    expect(fetcher).not.toHaveBeenCalled();
    expect(client.mode).toBe("live");
  });

  it("SEP-38 fiyat ve quote'u metin tutarla verir", async () => {
    const { client } = setup();
    expect(await client.price()).toEqual({ rate: "50.0000000" });
    const quote = await client.quote("1000.0000000");
    expect(quote.buy_amount).toBe("20.0000000");
  });

  it("ANCHOR_HOME_DOMAIN yoksa açılışta durur", () => {
    expect(() => createAnchorClient({ KASA_MODE: "live" }, { fetcher: vi.fn() })).toThrow("ANCHOR_HOME_DOMAIN");
    expect(() => createAnchorClient({ KASA_MODE: "x", ANCHOR_HOME_DOMAIN: HOME }, { fetcher: vi.fn() })).toThrow("KASA_MODE");
  });
});
