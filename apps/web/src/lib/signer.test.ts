// @vitest-environment node
// Neden node: jsdom ortamında Buffer farklı realm'den geldiği için XDR kodlayıcı Uint8Array kontrolünü geçemiyor.
import { Account, Keypair, Networks, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { createKeySigner } from "./signer";

describe("anahtar imzalayıcı (yalnızca test/demo)", () => {
  it("işlemi kendi anahtarıyla imzalar ve imza doğrulanır", async () => {
    const keypair = Keypair.random();
    const signer = createKeySigner(keypair.secret());
    const transaction = new TransactionBuilder(new Account(keypair.publicKey(), "1"), { fee: "100", networkPassphrase: Networks.TESTNET })
      .addOperation(Operation.manageData({ name: "k", value: null }))
      .setTimeout(30)
      .build();

    const signed = TransactionBuilder.fromXDR(await signer.sign(transaction.toXDR()), Networks.TESTNET) as Transaction;
    expect(signer.address).toBe(keypair.publicKey());
    expect(signed.signatures).toHaveLength(1);
    expect(keypair.verify(signed.hash(), signed.signatures[0]!.signature)).toBe(true);
  });

  it("geçersiz gizli anahtarı reddeder", () => {
    expect(() => createKeySigner("SBOZUK")).toThrow();
  });
});
