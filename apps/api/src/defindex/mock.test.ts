import { Keypair, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { ANCHOR, DEFINDEX } from "../../../../config/simulation.js";
import { createMockDefindex, type MockVaultChain } from "./mock.js";

const issuer = Keypair.random();
const caller = Keypair.random();
const EPOCH = new Date("2026-09-16T00:00:00.000Z");

function chain(overrides: Partial<MockVaultChain> = {}) {
  const submit = vi.fn(async (_transaction: Transaction) => ({ hash: "a".repeat(64) }));
  return {
    chain: {
      loadSequence: async () => "100",
      shareBalance: async () => 950_0000000n,
      submit,
      ...overrides,
    } satisfies MockVaultChain,
    submit,
  };
}

function adapter(options: { now?: () => Date; chain?: MockVaultChain; sleep?: (ms: number) => Promise<void> } = {}) {
  return createMockDefindex({
    issuerSecret: issuer.secret(),
    chain: options.chain ?? chain().chain,
    now: options.now ?? (() => EPOCH),
    sleep: options.sleep ?? (async () => undefined),
  });
}

function parse(xdr: string): Transaction {
  return TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
}

function payments(transaction: Transaction): Operation.Payment[] {
  return transaction.operations.filter((operation): operation is Operation.Payment => operation.type === "payment");
}

describe("mock DeFindex adaptörü", () => {
  it("deposit: çağıran USDC'yi ihraççıya öder, ihraççı payı çağırana öder; işlem imzasızdır", async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    const unsigned = await adapter({ sleep }).depositToVault(caller.publicKey(), 100_0000000n);
    const transaction = parse(unsigned.xdr);
    const [usdcLeg, shareLeg] = payments(transaction);

    expect(unsigned.functionName).toBe("deposit");
    expect(transaction.source).toBe(caller.publicKey());
    expect(transaction.signatures).toHaveLength(0);
    expect(transaction.operations[0]?.type).toBe("changeTrust");
    expect(usdcLeg).toMatchObject({ destination: issuer.publicKey(), amount: "100.0000000" });
    expect(usdcLeg?.asset.code).toBe(ANCHOR.assetCode);
    expect(shareLeg).toMatchObject({ source: issuer.publicKey(), destination: caller.publicKey(), amount: "100.0000000" });
    expect(shareLeg?.asset.code).toBe(DEFINDEX.vaultSymbol);
    expect(sleep).toHaveBeenCalledWith(DEFINDEX.latencyMs);
  });

  it("pay fiyatı zamanla artar; aynı USDC daha az pay alır ve aşağı yuvarlanır", async () => {
    const tenMinutesLater = () => new Date(EPOCH.getTime() + 10 * 60_000);
    const unsigned = await adapter({ now: tenMinutesLater }).depositToVault(caller.publicKey(), 100_0000000n);
    const [, shareLeg] = payments(parse(unsigned.xdr));
    // 100 / 1.0002 = 99.98000399... → 7 ondalığa aşağı
    expect(shareLeg?.amount).toBe("99.9800039");
    expect((await adapter({ now: tenMinutesLater }).getVaultInfo()).sharePrice).toBe("1.0002000");
  });

  it("withdraw: çağıran payı ihraççıya öder (yakar), ihraççı pay fiyatı kadar USDC öder", async () => {
    const tenMinutesLater = () => new Date(EPOCH.getTime() + 10 * 60_000);
    const unsigned = await adapter({ now: tenMinutesLater }).withdrawShares(caller.publicKey(), 50_0000000n);
    const transaction = parse(unsigned.xdr);
    const [shareLeg, usdcLeg] = payments(transaction);

    expect(unsigned.functionName).toBe("withdraw");
    expect(transaction.source).toBe(caller.publicKey());
    expect(shareLeg).toMatchObject({ destination: issuer.publicKey(), amount: "50.0000000" });
    expect(shareLeg?.asset.code).toBe(DEFINDEX.vaultSymbol);
    // 50 × 1.0002 = 50.01
    expect(usdcLeg).toMatchObject({ source: issuer.publicKey(), destination: caller.publicKey(), amount: "50.0100000" });
    expect(usdcLeg?.asset.code).toBe(ANCHOR.assetCode);
  });

  it.each([0n, -1n])("sıfır veya negatif tutarı (%s) reddeder", async (amount) => {
    await expect(adapter().depositToVault(caller.publicKey(), amount)).rejects.toThrow("sıfırdan büyük");
    await expect(adapter().withdrawShares(caller.publicKey(), amount)).rejects.toThrow("sıfırdan büyük");
  });

  it("çağıranın imzası olmayan işlemi ağa göndermez", async () => {
    const { chain: fake, submit } = chain();
    const instance = adapter({ chain: fake });
    const unsigned = await instance.depositToVault(caller.publicKey(), 10_0000000n);
    await expect(instance.sendTransaction(unsigned.xdr)).rejects.toThrow("imza");
    expect(submit).not.toHaveBeenCalled();
  });

  it("çağıran imzaladıktan sonra ihraççı imzasını ekleyip gönderir ve hash döndürür", async () => {
    const { chain: fake, submit } = chain();
    const instance = adapter({ chain: fake });
    const unsigned = await instance.depositToVault(caller.publicKey(), 10_0000000n);
    const transaction = parse(unsigned.xdr);
    transaction.sign(caller);

    const result = await instance.sendTransaction(transaction.toXDR());
    expect(result).toEqual({ txHash: "a".repeat(64), success: true });
    const submitted = submit.mock.calls[0]?.[0];
    expect(submitted?.signatures).toHaveLength(2);
  });

  it("ağ hatasını yutmaz", async () => {
    const { chain: fake } = chain({
      submit: async () => {
        throw new Error("tx_bad_seq");
      },
    });
    const instance = adapter({ chain: fake });
    const unsigned = await instance.withdrawShares(caller.publicKey(), 1_0000000n);
    const transaction = parse(unsigned.xdr);
    transaction.sign(caller);
    await expect(instance.sendTransaction(transaction.toXDR())).rejects.toThrow("tx_bad_seq");
  });

  it("bakiyeyi zincirden okur ve USDC karşılığını pay fiyatıyla hesaplar", async () => {
    const tenMinutesLater = () => new Date(EPOCH.getTime() + 10 * 60_000);
    const balance = await adapter({ now: tenMinutesLater }).getVaultBalance(caller.publicKey());
    // 950 × 1.0002 = 950.19
    expect(balance).toEqual({ shares: 950_0000000n, underlying: 950_1900000n });
  });

  it("vault bilgisi ve APY'yi simülasyon sabitlerinden metin olarak verir", async () => {
    const instance = adapter();
    expect(await instance.getVaultInfo()).toEqual({
      name: DEFINDEX.vaultName,
      symbol: DEFINDEX.vaultSymbol,
      apyPercent: DEFINDEX.apyPercent,
      sharePrice: DEFINDEX.initialSharePrice,
    });
    expect(await instance.getVaultAPY()).toBe(DEFINDEX.apyPercent);
    expect(instance.mode).toBe("simulation");
  });
});
