import { describe, expect, it, vi } from "vitest";

import { requestFreshQuote } from "./sep38";

describe("SEP-38", () => {
  it("süresi dolmuş quote'u sessizce yeniden fiyatlar ve string tutarı korur", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "old", expires_at: "2026-09-11T11:59:00Z", buy_amount: "9.0000000" })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "new", expires_at: "2026-09-11T12:02:00Z", buy_amount: "10.0000000" })));

    const quote = await requestFreshQuote(
      "https://anchor.test/sep38",
      "500.0000000",
      () => new Date("2026-09-11T12:00:00Z"),
      fetcher,
    );

    expect(quote.id).toBe("new");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ sell_amount: "500.0000000" }));
  });
});
