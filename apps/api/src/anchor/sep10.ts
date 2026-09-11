import { Networks, WebAuth } from "@stellar/stellar-sdk";

import type { AnchorMetadata } from "./types.js";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type ChallengeSigner = (transactionXdr: string) => Promise<string>;

/** SEP-10 challenge'ı doğrulatıp cüzdanda yerel imzalatır; işlem hiçbir zaman ağa gönderilmez. */
export async function authenticateSep10(
  metadata: AnchorMetadata,
  account: string,
  signChallenge: ChallengeSigner,
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

  const signed = await signChallenge(challengeBody.transaction);
  const tokenResponse = await fetcher(metadata.webAuthEndpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: signed }),
  });
  if (!tokenResponse.ok) throw new Error(`SEP-10 doğrulanamadı: HTTP ${tokenResponse.status}`);
  const tokenBody = await tokenResponse.json() as { token?: unknown };
  if (typeof tokenBody.token !== "string") throw new Error("SEP-10 JWT eksik.");
  return tokenBody.token;
}
