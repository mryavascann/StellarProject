import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { depositThroughVault } from "./deposit";
import { readVaultOverview } from "./info";
import { createMockDefindex } from "./mock";
import type { DefindexAdapter } from "./types";
import { withdrawThroughVault } from "./withdraw";

const issuer = Keypair.random();
const caller = Keypair.random();
const stranger = Keypair.random();

function mock(submit = vi.fn(async (_transaction: Transaction) => ({ hash: "d".repeat(64) }))) {
  return createMockDefindex({
    issuerSecret: issuer.secret(),
    chain: { loadSequence: async () => "7", shareBalance: async () => 0n, submit },
    now: () => new Date("2026-09-16T00:00:00.000Z"),
    sleep: async () => undefined,
  });
}

const signAs = (keypair: Keypair) => async (xdr: string) => {
  const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  transaction.sign(keypair);
  return transaction.toXDR();
};

describe("DeFindex akışları", () => {
  it("deposit: XDR üret → imzala → 1 sn bekle → gönder sırasını izler", async () => {
    const events: string[] = [];
    const adapter = mock(
      vi.fn(async () => {
        events.push("send");
        return { hash: "d".repeat(64) };
      }),
    );
    const sign = vi.fn(async (xdr: string) => {
      events.push("sign");
      return signAs(caller)(xdr);
    });
    const wait = vi.fn(async (ms: number) => {
      events.push(`wait:${ms}`);
    });

    const result = await depositThroughVault(adapter, { caller: caller.publicKey(), amountStroops: 5_0000000n, sign, wait });
    expect(result.txHash).toBe("d".repeat(64));
    expect(events).toEqual(["sign", "wait:1000", "send"]);
  });

  it("kaynağı çağıran olmayan bir XDR'ı imzaya göndermez (yabancı işlem koruması)", async () => {
    const foreign = await mock().depositToVault(stranger.publicKey(), 1_0000000n);
    const base = mock();
    const adapter: DefindexAdapter = {
      mode: base.mode,
      vaultAddress: base.vaultAddress,
      depositToVault: async () => foreign,
      withdrawShares: (...args) => base.withdrawShares(...args),
      getVaultBalance: (...args) => base.getVaultBalance(...args),
      getVaultInfo: () => base.getVaultInfo(),
      getVaultAPY: () => base.getVaultAPY(),
      sendTransaction: (...args) => base.sendTransaction(...args),
    };
    const sign = vi.fn(signAs(caller));
    await expect(
      depositThroughVault(adapter, { caller: caller.publicKey(), amountStroops: 1_0000000n, sign, wait: async () => undefined }),
    ).rejects.toThrow("kaynağı");
    expect(sign).not.toHaveBeenCalled();
  });

  it("withdraw aynı sırayı izler ve pay tutarını taşır", async () => {
    const adapter = mock();
    const build = vi.spyOn(adapter, "withdrawShares");
    const result = await withdrawThroughVault(adapter, {
      caller: caller.publicKey(),
      shareStroops: 3_0000000n,
      sign: signAs(caller),
      wait: async () => undefined,
    });
    expect(build).toHaveBeenCalledWith(caller.publicKey(), 3_0000000n);
    expect(result.txHash).toBe("d".repeat(64));
  });

  it("özet: bakiye, vault bilgisi ve APY'yi tek nesnede toplar; hata yutulmaz", async () => {
    const overview = await readVaultOverview(mock(), caller.publicKey());
    expect(overview).toMatchObject({ balance: { shares: 0n, underlying: 0n }, apyPercent: "6.50" });
    expect(overview.info.sharePrice).toBe("1.0000000");

    const base = mock();
    const broken: DefindexAdapter = {
      mode: base.mode,
      vaultAddress: base.vaultAddress,
      depositToVault: (...args) => base.depositToVault(...args),
      withdrawShares: (...args) => base.withdrawShares(...args),
      getVaultBalance: (...args) => base.getVaultBalance(...args),
      getVaultInfo: async () => {
        throw new Error("vault info yok");
      },
      getVaultAPY: () => base.getVaultAPY(),
      sendTransaction: (...args) => base.sendTransaction(...args),
    };
    await expect(readVaultOverview(broken, caller.publicKey())).rejects.toThrow("vault info yok");
  });
});
