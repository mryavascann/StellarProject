import { Account, Keypair, Networks, Operation, StrKey, Transaction, TransactionBuilder, scValToNative } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  buildVaultTransaction,
  encodeVaultCall,
  readVaultSnapshot,
  submitVaultTransaction,
  type VaultRpc,
} from "./stellar-vault";

const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 7));
const member = Keypair.random().publicKey();
const options = { networkPassphrase: Networks.TESTNET, contractId: CONTRACT, sourceAccount: member };

function rpc(overrides: Partial<VaultRpc> = {}): VaultRpc {
  return {
    getAccount: async (id) => new Account(id, "41"),
    simulate: async () => null,
    prepare: async (transaction) => transaction,
    send: async () => ({ hash: "e".repeat(64), status: "PENDING" }),
    poll: async () => ({ status: "SUCCESS" }),
    ...overrides,
  };
}

describe("kontrat çağrısı kodlaması", () => {
  it("deposit argümanlarını address ve i128 olarak kodlar", () => {
    const [address, amount] = encodeVaultCall({ function: "deposit", member, amount: 12_0000000n });
    expect(scValToNative(address!)).toBe(member);
    expect(scValToNative(amount!)).toBe(12_0000000n);
  });

  it("request_spend notunu string, approve id'sini u32 olarak kodlar", () => {
    const spend = encodeVaultCall({ function: "request_spend", member, amount: 1n, note: "Kira Ekim" });
    expect(scValToNative(spend[2]!)).toBe("Kira Ekim");
    const approve = encodeVaultCall({ function: "approve", member, requestId: 7 });
    expect(scValToNative(approve[1]!)).toBe(7);
    expect(encodeVaultCall({ function: "execute", requestId: 2 })).toHaveLength(1);
  });

  it("üye ekleme/çıkarma iki adres kodlar; bozuk adres reddedilir", () => {
    const other = Keypair.random().publicKey();
    const added = encodeVaultCall({ function: "add_member", caller: member, newMember: other });
    expect(added.map((value) => scValToNative(value))).toEqual([member, other]);
    expect(encodeVaultCall({ function: "remove_member", caller: member, member: other })).toHaveLength(2);
    expect(() => encodeVaultCall({ function: "add_member", caller: member, newMember: "GBOZUK" })).toThrow("adres");
  });

  it.each([
    [{ function: "deposit", member, amount: 0n }, "sıfırdan büyük"],
    [{ function: "request_spend", member, amount: 5n, note: "   " }, "not"],
    [{ function: "approve", member: "GBOZUK", requestId: 1 }, "adres"],
    [{ function: "cancel", caller: member, requestId: -1 }, "request_id"],
  ] as const)("geçersiz çağrıyı (%o) reddeder", (call, message) => {
    expect(() => encodeVaultCall(call as never)).toThrow(message);
  });
});

describe("kontrat işlemi üretimi ve gönderimi", () => {
  it("kaynağı üye olan, hazırlanmış ve imzasız XDR üretir", async () => {
    const prepare = vi.fn(async (transaction: Transaction) => transaction);
    const xdr = await buildVaultTransaction(options, rpc({ prepare }), { function: "execute", requestId: 1 });
    const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
    expect(transaction.source).toBe(member);
    expect(transaction.signatures).toHaveLength(0);
    expect(transaction.operations[0]?.type).toBe("invokeHostFunction");
    expect(prepare).toHaveBeenCalledOnce();
  });

  it("gönderimde ERROR durumunu ve başarısız poll sonucunu hata olarak yükseltir", async () => {
    const transaction = new TransactionBuilder(new Account(member, "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.manageData({ name: "x", value: null }))
      .setTimeout(30)
      .build();
    await expect(
      submitVaultTransaction(options, rpc({ send: async () => ({ hash: "e".repeat(64), status: "ERROR" }) }), transaction.toXDR()),
    ).rejects.toThrow("ERROR");
    await expect(
      submitVaultTransaction(options, rpc({ poll: async () => ({ status: "FAILED" }) }), transaction.toXDR()),
    ).rejects.toThrow("FAILED");
    await expect(submitVaultTransaction(options, rpc(), transaction.toXDR())).resolves.toEqual({ hash: "e".repeat(64) });
  });

  it("snapshot dört getter'ı okur ve defteri de içerir", async () => {
    const simulate = vi.fn(async (_transaction: Transaction, functionName: string) => {
      if (functionName === "get_balance") return 160_0000000n;
      if (functionName === "get_ledger") return [{ kind: "Deposit", member, amount: 1n, at: 1, request_id: null }];
      return [];
    });
    const snapshot = await readVaultSnapshot(options, rpc({ simulate }));
    expect(snapshot.balance).toBe(160_0000000n);
    expect(snapshot.ledger[0]?.kind).toBe("Deposit");
    expect(simulate.mock.calls.map(([, name]) => name).sort()).toEqual(["get_balance", "get_ledger", "get_members", "get_requests"]);
  });
});
