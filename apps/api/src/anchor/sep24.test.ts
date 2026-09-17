import { describe, expect, it, vi } from "vitest";

import { buildWithdrawalPayment, requestWithFreshJwt } from "./sep24";

describe("SEP-24", () => {
  it("401 sonrasında JWT'yi yenileyip kullanıcı akışını aynı istekten sürdürür", async () => {
    const token = vi.fn(async (refresh: boolean) => refresh ? "yeni" : "eski");
    const fetcher = vi.fn(async (_url: string, init?: RequestInit) =>
      new Response(null, { status: new Headers(init?.headers).get("authorization") === "Bearer eski" ? 401 : 200 }),
    );
    const response = await requestWithFreshJwt("https://anchor.test/info", {}, token, fetcher);

    expect(response.status).toBe(200);
    expect(token.mock.calls).toEqual([[false], [true]]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

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
