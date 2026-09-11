import { StrKey } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { assertAccountAddress, assertContractAddress, explorerUrl, shortAddress } from "./stellar.js";

const ACCOUNT = StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 7));
const CONTRACT = StrKey.encodeContract(Buffer.alloc(32, 9));

describe("Stellar yardımcıları", () => {
  it("hesap ve kontrat adreslerini türlerine göre doğrular", () => {
    expect(assertAccountAddress(ACCOUNT)).toBe(ACCOUNT);
    expect(assertContractAddress(CONTRACT)).toBe(CONTRACT);
    expect(() => assertAccountAddress(CONTRACT)).toThrow("hesap");
    expect(() => assertContractAddress(ACCOUNT)).toThrow("kontrat");
  });

  it("adresi okunabilir biçimde kısaltır", () => {
    expect(shortAddress(ACCOUNT)).toBe(`${ACCOUNT.slice(0, 6)}…${ACCOUNT.slice(-6)}`);
  });

  it("yalnızca desteklenen ağ için güvenli explorer bağlantısı üretir", () => {
    expect(explorerUrl("contract", CONTRACT, "testnet")).toBe(
      `https://stellar.expert/explorer/testnet/contract/${CONTRACT}`,
    );
    expect(() => explorerUrl("account", "bozuk", "testnet")).toThrow("hesap");
  });
});
