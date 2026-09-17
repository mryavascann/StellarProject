import { describe, expect, it } from "vitest";

import { buildWithdrawalPayment } from "./sep24";

describe("SEP-24", () => {
  it("withdraw memo ve memo_type değerlerini ödemeye birebir taşır", () => {
    expect(buildWithdrawalPayment({ account_id: "GDEST", memo: "001234", memo_type: "id" }, "15.0000000")).toEqual({
      destination: "GDEST",
      amount: "15.0000000",
      memo: "001234",
      memoType: "id",
    });
  });

  it("eksik memo'lu withdraw yanıtını reddeder", () => {
    expect(() => buildWithdrawalPayment({ account_id: "GDEST", memo_type: "id" }, "1.0000000")).toThrow("memo");
  });
});
