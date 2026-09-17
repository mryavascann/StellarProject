import { Networks, WebAuth } from "@stellar/stellar-sdk";

import type { AnchorMetadata } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type ChallengeSigner = (transactionXdr: string) => Promise<string>;

/**
 * SEP-10 adım 1: challenge'ı alır ve imzalatmadan ÖNCE doğrular.
 * Sequence 0 olan bu işlem hiçbir zaman ağa gönderilmez. `home_domain` ile `web_auth_domain`
 * ayrı alanlardır ve ayrı doğrulanır (Bölüm 9 kural 1–2).
 */
export async function fetchChallenge(
  metadata: AnchorMetadata,
  account: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const separator = metadata.webAuthEndpoint.includes("?") ? "&" : "?";
  const challengeResponse = await fetcher(
    `${metadata.webAuthEndpoint}${separator}account=${encodeURIComponent(account)}`,
  );
  if (!challengeResponse.ok) throw new Error(`SEP-10 challenge alınamadı: HTTP ${challengeResponse.status}`);
  const challengeBody = await challengeResponse.json() as { transaction?: unknown };
  if (typeof challengeBody.transaction !== "string") throw new Error("SEP-10 transaction eksik.");

  const webAuthDomain = new URL(metadata.webAuthEndpoint).host;
  const parsed = WebAuth.readChallengeTx(
    challengeBody.transaction,
    metadata.signingKey,
    Networks.TESTNET,
    metadata.homeDomain,
    webAuthDomain,
  );
  if (parsed.clientAccountID !== account) throw new Error("SEP-10 müşteri hesabı eşleşmiyor.");
  return challengeBody.transaction;
}

/** SEP-10 adım 2: cüzdanda imzalanmış challenge'ı anchor'a verir, JWT alır. */
export async function exchangeChallenge(
  metadata: AnchorMetadata,
  signedTransaction: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const tokenResponse = await fetcher(metadata.webAuthEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: signedTransaction }),
  });
  if (!tokenResponse.ok) throw new Error(`SEP-10 doğrulanamadı: HTTP ${tokenResponse.status}`);
  const tokenBody = await tokenResponse.json() as { token?: unknown };
  if (typeof tokenBody.token !== "string") throw new Error("SEP-10 JWT eksik.");
  return tokenBody.token;
}

/** İki adımı tek çağrıda birleştirir: imzalayıcı elde olduğunda (script, test) kullanılır. */
export async function authenticateSep10(
  metadata: AnchorMetadata,
  account: string,
  signChallenge: ChallengeSigner,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const challenge = await fetchChallenge(metadata, account, fetcher);
  const signed = await signChallenge(challenge);
  return exchangeChallenge(metadata, signed, fetcher);
}
