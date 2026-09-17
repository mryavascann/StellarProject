/**
 * İşlem ve quote kimlikleri: gövdesi imzalı, kendini anlatan metinler.
 *
 * Neden: anchor birden çok sunucu örneğinde koşabilir (Vercel'de koşuyor). Kimliği bellekteki
 * bir tabloda tutarsak, işlemi başlatan örnek ile durumunu soran örnek farklı olduğunda işlem
 * "bulunamadı" olur — kullanıcı için para kaybolmuş gibi görünür. Kimliğin içine yazılan veri
 * her örnekte okunabilir; imza, istemcinin tutarı veya hesabı değiştirmesini engeller.
 */

export interface TransferPayload {
  readonly kind: "deposit" | "withdraw";
  readonly account: string;
  readonly amount: string;
  /** Yalnız çekimde: anchor'ın ödemeyi sahibiyle eşleştirdiği memo. */
  readonly memo?: string;
  readonly createdAt: number;
}

export interface QuotePayload {
  readonly sellAmount: string;
  readonly buyAmount: string;
  readonly expiresAt: number;
}

async function signature(content: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Buffer.from(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(content))).toString("base64url");
}

/** Gövdeyi base64url'e çevirip HMAC ile imzalar; sonuç URL'de taşınabilir. */
export async function encodeSigned<T>(payload: T, secret: string): Promise<string> {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${await signature(body, secret)}`;
}

/** İmzayı doğrular ve gövdeyi okur; kurcalanmış, yabancı veya bozuk kimlikte `null` döner. */
export async function decodeSigned<T>(id: string, secret: string): Promise<T | null> {
  const [body, provided] = id.split(".");
  if (!body || !provided) return null;
  if ((await signature(body, secret)) !== provided) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString()) as T;
  } catch {
    return null;
  }
}

/**
 * Anchor'ın kendi ödemesine koyduğu kısa etiket. Aynı deposit için ikinci kez ödeme
 * yapılmasını engeller: ödeme zincire bu etiketle gider ve önce zincirde aranır.
 * Stellar metin memo'su 28 bayt olduğu için kimliğin imzasından kısa bir parça kullanılır.
 */
export function payoutMemo(id: string): string {
  const signaturePart = id.split(".")[1] ?? id;
  return `kasa-${signaturePart.slice(0, 16)}`;
}
