import { describe, expect, it } from "vitest";

import { parseContractLedger } from "./contract";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("defter ayrıştırıcısı", () => {
  it("satır türünü, tutarı bigint olarak ve talep bağını korur", () => {
    const entries = parseContractLedger([
      { kind: "Deposit", member: ADDRESS, amount: "500000000", at: 10, request_id: null },
      { kind: "Spend", member: ADDRESS, amount: 150000000n, at: 20, request_id: 3 },
      { kind: "EmergencyExit", member: ADDRESS, amount: "1", at: 30 },
    ]);
    expect(entries).toEqual([
      { kind: "Deposit", member: ADDRESS, amount: 500_000_000n, at: 10, requestId: null },
      { kind: "Spend", member: ADDRESS, amount: 150_000_000n, at: 20, requestId: 3 },
      { kind: "EmergencyExit", member: ADDRESS, amount: 1n, at: 30, requestId: null },
    ]);
  });

  it("RPC'nin scValToNative biçimini (birim enum = tek elemanlı dizi, Option None = undefined) kabul eder", () => {
    const [entry] = parseContractLedger([{ kind: ["Spend"], member: ADDRESS, amount: 5n, at: 9n, request_id: undefined }]);
    expect(entry).toEqual({ kind: "Spend", member: ADDRESS, amount: 5n, at: 9, requestId: null });
  });

  it("bilinmeyen satır türünü ve bozuk tutarı reddeder", () => {
    expect(() => parseContractLedger([{ kind: "Refund", member: ADDRESS, amount: "1", at: 1 }])).toThrow("kind");
    expect(() => parseContractLedger([{ kind: "Deposit", member: ADDRESS, amount: 1.5, at: 1 }])).toThrow("amount");
  });
});
