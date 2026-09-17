import { Keypair, Networks, Transaction, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { authenticateSep10 } from "./sep10";
import type { AnchorMetadata } from "./types";

const server = Keypair.random();
const customer = Keypair.random();
const metadata: AnchorMetadata = {
  homeDomain: "home.test",
  signingKey: server.publicKey(),
  transferServer: "https://home.test/sep24",
  webAuthEndpoint: "https://auth.test/auth",
  quoteServer: "https://home.test/sep38",
  assetCode: "USDC",
  assetIssuer: Keypair.random().publicKey(),
};

describe("SEP-10", () => {
  it("challenge'ı yalnızca yerelde imzalar; home_domain ve web_auth_domain ayrı doğrulanır", async () => {
    const challenge = WebAuth.buildChallengeTx(server, customer.publicKey(), "home.test", 300, Networks.TESTNET, "auth.test");
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST"
        ? new Response(JSON.stringify({ token: "jwt" }), { headers: { "content-type": "application/json" } })
        : new Response(JSON.stringify({ transaction: challenge }), { headers: { "content-type": "application/json" } }),
    );
    const sign = vi.fn(async (xdr: string) => {
      const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
      transaction.sign(customer);
      return transaction.toEnvelope().toXDR("base64");
    });

    await expect(authenticateSep10(metadata, customer.publicKey(), sign, fetcher)).resolves.toBe("jwt");
    expect(sign).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      `https://auth.test/auth?account=${customer.publicKey()}`,
      "https://auth.test/auth",
    ]);
  });

  it("yanlış web_auth_domain içeren challenge'ı imzalamadan reddeder", async () => {
    const challenge = WebAuth.buildChallengeTx(server, customer.publicKey(), "home.test", 300, Networks.TESTNET, "wrong.test");
    const sign = vi.fn(async (xdr: string) => xdr);
    await expect(authenticateSep10(metadata, customer.publicKey(), sign, async () =>
      new Response(JSON.stringify({ transaction: challenge }), { headers: { "content-type": "application/json" } }),
    )).rejects.toThrow();
    expect(sign).not.toHaveBeenCalled();
  });
});
