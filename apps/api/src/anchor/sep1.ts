import * as TOML from "@iarna/toml";

import type { AnchorMetadata } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function requiredString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  if (typeof value !== "string" || value === "") throw new Error(`SEP-1 alanı eksik: ${key}`);
  return value;
}

function tomlUrl(homeDomain: string): string {
  const protocol = /^(localhost|127\.0\.0\.1)(:|$)/u.test(homeDomain) ? "http" : "https";
  return `${protocol}://${homeDomain}/.well-known/stellar.toml`;
}

/** Anchor SEP-1 belgesini indirir; CORS, zorunlu uçlar ve issuer birlikte doğrulanır. */
export async function fetchAnchorMetadata(
  homeDomain: string,
  fetcher: Fetcher = fetch,
): Promise<AnchorMetadata> {
  const response = await fetcher(tomlUrl(homeDomain));
  if (!response.ok) throw new Error(`SEP-1 alınamadı: HTTP ${response.status}`);
  if (response.headers.get("access-control-allow-origin") !== "*") {
    throw new Error("SEP-1 CORS header'ı eksik.");
  }
  let data: Record<string, unknown>;
  try {
    data = TOML.parse(await response.text()) as Record<string, unknown>;
  } catch {
    throw new Error("SEP-1 TOML ayrıştırılamadı.");
  }
  const signingKey = requiredString(data, "SIGNING_KEY");
  const transferServer = requiredString(data, "TRANSFER_SERVER_SEP0024");
  const webAuthEndpoint = requiredString(data, "WEB_AUTH_ENDPOINT");
  const quoteServer = requiredString(data, "ANCHOR_QUOTE_SERVER");
  const currencies = data.CURRENCIES;
  if (!Array.isArray(currencies) || typeof currencies[0] !== "object" || currencies[0] === null) {
    throw new Error("SEP-1 CURRENCIES alanı eksik.");
  }
  const currency = currencies[0] as Record<string, unknown>;
  return {
    homeDomain,
    signingKey,
    transferServer,
    webAuthEndpoint,
    quoteServer,
    assetCode: requiredString(currency, "code"),
    assetIssuer: requiredString(currency, "issuer"),
  };
}
