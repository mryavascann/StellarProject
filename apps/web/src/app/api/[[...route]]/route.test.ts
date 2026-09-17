import { describe, expect, it } from "vitest";

import { forwardedApiUrl } from "./route";

describe("Vercel route iletimi", () => {
  it("rewrite sonrasindaki route parametrelerini Hono URL'sine tasir", () => {
    expect(forwardedApiUrl(
      new Request("https://stellar-kasa.vercel.app/.well-known/stellar.toml"),
      ["anchor-proxy", ".well-known", "stellar.toml"],
    )).toBe("https://stellar-kasa.vercel.app/api/anchor-proxy/.well-known/stellar.toml");
  });

  it("dogrudan API isteklerinin query string'ini korur", () => {
    expect(forwardedApiUrl(
      new Request("https://stellar-kasa.vercel.app/api/vault?fresh=1"),
      ["vault"],
    )).toBe("https://stellar-kasa.vercel.app/api/vault?fresh=1");
  });
});
