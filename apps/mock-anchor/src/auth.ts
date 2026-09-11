import { Keypair, Networks, WebAuth } from "@stellar/stellar-sdk";

interface TokenPayload {
  readonly sub: string;
  readonly iat: number;
  readonly exp: number;
}

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function signature(content: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const result = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content));
  return Buffer.from(result).toString("base64url");
}

/** Doğrulanmış hesap için kısa ömürlü mock JWT üretir. */
export async function issueToken(account: string, secret: string, now: Date, ttlSeconds: number) {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode({ sub: account, iat: issuedAt, exp: issuedAt + ttlSeconds });
  const content = `${header}.${payload}`;
  return `${content}.${await signature(content, secret)}`;
}

/** Mock JWT'nin imzasını ve sona erme zamanını doğrular. */
export async function verifyToken(token: string, secret: string, now: Date): Promise<TokenPayload | null> {
  const [header, payload, provided] = token.split(".");
  if (!header || !payload || !provided) return null;
  const expected = await signature(`${header}.${payload}`, secret);
  if (provided !== expected) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenPayload;
    if (!parsed.sub || parsed.exp <= Math.floor(now.getTime() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** SEP-10 challenge üretir; işlem yalnızca yerelde imzalanmak içindir ve ağa gönderilmez. */
export function buildChallenge(
  account: string,
  signingSecret: string,
  homeDomain: string,
  webAuthDomain: string,
): string {
  return WebAuth.buildChallengeTx(
    Keypair.fromSecret(signingSecret),
    account,
    homeDomain,
    300,
    Networks.TESTNET,
    webAuthDomain,
  );
}

/** İmzalı challenge'ın sunucu ve müşteri imzalarını doğrular, müşteri hesabını döndürür. */
export function verifyChallenge(
  transaction: string,
  signingSecret: string,
  homeDomain: string,
  webAuthDomain: string,
): string {
  const server = Keypair.fromSecret(signingSecret);
  const { clientAccountID } = WebAuth.readChallengeTx(
    transaction,
    server.publicKey(),
    Networks.TESTNET,
    homeDomain,
    webAuthDomain,
  );
  WebAuth.verifyChallengeTxSigners(
    transaction,
    server.publicKey(),
    Networks.TESTNET,
    [clientAccountID],
    homeDomain,
    webAuthDomain,
  );
  return clientAccountID;
}
