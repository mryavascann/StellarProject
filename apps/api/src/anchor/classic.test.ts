import { Account, Keypair, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import {
  AccountNotFoundError,
  buildTrustlineTransaction,
  buildWithdrawalPaymentTransaction,
  createHorizonGateway,
  submitClassicTransaction,
  type ClassicGateway,
} from "./classic";

const member = Keypair.random();
const issuer = Keypair.random().publicKey();
const custodial = Keypair.random().publicKey();
const ASSET = { code: "USDC", issuer };

function gateway(overrides: Partial<ClassicGateway> = {}): ClassicGateway {
  return {
    loadAccount: async (id) => new Account(id, "5"),
    hasTrustline: async () => false,
    submit: async () => ({ hash: "1".repeat(64) }),
    ...overrides,
  };
}

const parse = (xdr: string) => TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;

describe("klasik işlemler", () => {
  it("trustline işlemi: kaynağı üye, tek changeTrust, doğru varlık", async () => {
    const xdr = await buildTrustlineTransaction(gateway(), Networks.TESTNET, member.publicKey(), ASSET);
    const transaction = parse(xdr);
    const operation = transaction.operations[0] as Operation.ChangeTrust;
    expect(transaction.source).toBe(member.publicKey());
    expect(operation.type).toBe("changeTrust");
    expect(operation.line).toMatchObject({ code: "USDC", issuer });
  });

  it("çekim ödemesi: memo id BİREBİR taşınır, hedef custodial, tutar metin", async () => {
    const xdr = await buildWithdrawalPaymentTransaction(gateway(), Networks.TESTNET, member.publicKey(), ASSET, {
      destination: custodial,
      amount: "15.0000000",
      memo: "8123456789",
      memoType: "id",
    });
    const transaction = parse(xdr);
    const operation = transaction.operations[0] as Operation.Payment;
    expect(transaction.memo.type).toBe("id");
    expect(String(transaction.memo.value)).toBe("8123456789");
    expect(operation).toMatchObject({ type: "payment", destination: custodial, amount: "15.0000000" });
    expect(operation.asset).toMatchObject({ code: "USDC", issuer });
  });

  it("memo_type id değilse ödeme kurulmaz (para askıda kalır)", async () => {
    await expect(
      buildWithdrawalPaymentTransaction(gateway(), Networks.TESTNET, member.publicKey(), ASSET, {
        destination: custodial,
        amount: "15.0000000",
        memo: "abc",
        memoType: "text" as "id",
      }),
    ).rejects.toThrow("memo");
  });

  it("imzalı işlemi gönderir; imzasızı ve fee-bump'ı reddeder", async () => {
    const submit = vi.fn(async (_transaction: Transaction) => ({ hash: "2".repeat(64) }));
    const xdr = await buildTrustlineTransaction(gateway(), Networks.TESTNET, member.publicKey(), ASSET);
    await expect(submitClassicTransaction(gateway({ submit }), Networks.TESTNET, xdr)).rejects.toThrow("imzasız");
    const transaction = parse(xdr);
    transaction.sign(member);
    await expect(submitClassicTransaction(gateway({ submit }), Networks.TESTNET, transaction.toXDR())).resolves.toEqual({ hash: "2".repeat(64) });
    expect(submit).toHaveBeenCalledOnce();
  });
});

describe("zincirde olmayan hesap", () => {
  const horizon = (status: number) => ({
    loadAccount: async () => {
      throw Object.assign(new Error("Not Found"), { response: { status } });
    },
  });

  it("hesap yoksa kullanıcıya ne yapacağını söyleyen hata verir, genel 'yapılamıyor' değil", async () => {
    const chain = createHorizonGateway("https://horizon-testnet.stellar.org", horizon(404) as never);
    await expect(chain.hasTrustline("GYOK", ASSET)).rejects.toBeInstanceOf(AccountNotFoundError);
    await expect(chain.loadAccount("GYOK")).rejects.toThrow(/test ağında/u);
  });

  it("Horizon başka sebeple düşerse hata olduğu gibi yukarı çıkar", async () => {
    const chain = createHorizonGateway("https://horizon-testnet.stellar.org", horizon(502) as never);
    await expect(chain.hasTrustline("GACCOUNT", ASSET)).rejects.toThrow("Not Found");
    await expect(chain.hasTrustline("GACCOUNT", ASSET)).rejects.not.toBeInstanceOf(AccountNotFoundError);
  });
});
