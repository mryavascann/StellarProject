import { describe, expect, it, vi } from "vitest";

import { fetchAnchorMetadata } from "./sep1.js";

const VALID = `SIGNING_KEY="GABC"
TRANSFER_SERVER_SEP0024="http://anchor.test/sep24"
WEB_AUTH_ENDPOINT="http://auth.test/auth"
ANCHOR_QUOTE_SERVER="http://anchor.test/sep38"
[[CURRENCIES]]
code="USDC"
issuer="GISSUER"`;

describe("SEP-1", () => {
  it("TOML uçlarını, para kodunu ve issuer'ı ayrıştırır", async () => {
    const fetcher = vi.fn(async () => new Response(VALID, { headers: { "access-control-allow-origin": "*" } }));
    const metadata = await fetchAnchorMetadata("anchor.test", fetcher);

    expect(fetcher).toHaveBeenCalledWith("https://anchor.test/.well-known/stellar.toml");
    expect(metadata).toMatchObject({ homeDomain: "anchor.test", assetCode: "USDC", assetIssuer: "GISSUER" });
  });

  it.each([
    ["bozuk TOML", "=bozuk", "TOML"],
    ["eksik alan", "SIGNING_KEY=\"GABC\"", "TRANSFER_SERVER_SEP0024"],
  ])("%s yanıtını reddeder", async (_name, body, error) => {
    const fetcher = async () => new Response(body, { headers: { "access-control-allow-origin": "*" } });
    await expect(fetchAnchorMetadata("anchor.test", fetcher)).rejects.toThrow(error);
  });

  it("CORS header'ı olmayan TOML'ı reddeder", async () => {
    await expect(fetchAnchorMetadata("anchor.test", async () => new Response(VALID))).rejects.toThrow("CORS");
  });
});
