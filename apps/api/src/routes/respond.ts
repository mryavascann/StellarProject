import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import { AnchorAuthRequiredError } from "../anchor/client";
import { JoinDisabledError } from "../vault-join";

/** bigint alanlarını metne çevirerek JSON yazar; `number`'a dönüşüm hassasiyet kaybettirir. */
export function json(context: Context, value: unknown, status: ContentfulStatusCode = 200): Response {
  const body = JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString() : item));
  return context.body(body, status, { "content-type": "application/json; charset=utf-8" });
}

/**
 * Hata → HTTP eşlemesi. Doğrulama hataları (TypeError/RangeError) kullanıcıya dönen Türkçe
 * metinlerdir → 400. Oturum hatası → 401 ve `auth_required` (web SEP-10'u şeffafça tekrarlar).
 * Geri kalanı 503 ve ham ayrıntı sızmaz; ayrıntı sunucu logunda kalır.
 */
export function handleError(error: unknown, context: Context): Response {
  if (error instanceof AnchorAuthRequiredError) return json(context, { error: error.code }, 401);
  // Yapılandırma eksiği: 503 ama sebebi söylenir, çünkü kullanıcı aksi hâlde neyin eksik olduğunu bilemez.
  if (error instanceof JoinDisabledError) return json(context, { error: error.message }, 503);
  if (error instanceof TypeError || error instanceof RangeError) return json(context, { error: error.message }, 400);
  console.error("[api]", error instanceof Error ? error.message : error);
  return json(context, { error: "İşlem şu an yapılamıyor. Tekrar dene." }, 503);
}

/** Zorunlu metin alanını okur; boşsa 400'e dönüşecek TypeError fırlatır. */
export function requireText(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || value === "") throw new TypeError(`${key} alanı gerekli.`);
  return value;
}

/** Stroop alanını bigint olarak okur; ondalık veya negatif değer kabul edilmez. */
export function requireStroops(body: Record<string, unknown>, key: string): bigint {
  const value = body[key];
  if (typeof value !== "string" || !/^\d+$/u.test(value)) throw new TypeError(`${key} tamsayı metin (stroop) olmalı.`);
  return BigInt(value);
}
