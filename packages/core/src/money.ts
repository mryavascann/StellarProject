/**
 * PARA — tüm tutar dönüşümlerinin tek adresi.
 *
 * Neden bu dosya var: Bölüm 0.5 "parada float yok" diyor. Tek bir `Number` kullanımı
 * büyük tutarlarda sessizce para kaybettirir ve bu hata testlerde değil, demoda görünür.
 * Bu yüzden dönüşüm mantığı tek yerde toplanır, her yerde buradan çağrılır.
 *
 * Tip sözleşmesi (docs/architecture.md Bölüm 6):
 *   zincir sınırı  → `bigint` (stroop)
 *   hesap          → `Decimal` (decimal.js)
 *   anchor sınırı  → `string` ("1250.0000000")
 *   gösterim       → `string` (Intl, tr-TR)
 * `number` hiçbir aşamada kabul edilmez.
 */

import Decimal from "decimal.js";

// Yeterli hassasiyet: 7 ondalıklı stroop çarpımlarında taşma/yuvarlama olmasın.
// toExpNeg/toExpPos: toFixed dışındaki metinselleştirmelerde bilimsel gösterime kaçmasın.
Decimal.set({ precision: 40, toExpNeg: -30, toExpPos: 40 });

/** Stellar'da 7 ondalıklı varlık standardı. Simüle değil, ağ gerçeği. */
export const ASSET_DECIMALS = 7;

/** TL gösterimi her zaman 2 ondalıklıdır (docs/brand.md Bölüm 5). */
export const FIAT_DECIMALS = 2;

/** 7 ondalıklı bir token'ın bir biriminin stroop karşılığı. */
export const STROOPS_PER_UNIT = 10_000_000n;

/** Eksi işareti U+2212 — klavye tiresi değil (docs/brand.md Bölüm 5). */
const MINUS = "−";

/**
 * Metni `Decimal`'e çevirir; `number` veya bozuk metni kapıda reddeder.
 *
 * Neden `number` reddediliyor: bir kez `number` girdiğinde hassasiyet zaten kaybolmuş olur;
 * hatayı hesabın sonunda değil, girdiği anda yakalamak gerekir.
 */
function parseAmount(value: string | Decimal, alan = "tutar"): Decimal {
  if (value instanceof Decimal) return value;
  if (typeof value !== "string") {
    throw new TypeError(`[money] ${alan} metin olmalı, ${typeof value} verildi. Parada float yok.`);
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    throw new TypeError(`[money] ${alan} boş olamaz.`);
  }
  let parsed: Decimal;
  try {
    parsed = new Decimal(trimmed);
  } catch {
    throw new TypeError(`[money] ${alan} sayıya çevrilemedi: "${value}"`);
  }
  if (!parsed.isFinite()) {
    throw new TypeError(`[money] ${alan} geçerli bir sayı değil: "${value}"`);
  }
  return parsed;
}

/**
 * Ondalık metni stroop'a çevirir; fazla ondalığı SIFIRA DOĞRU kırpar.
 *
 * Neden yukarı değil aşağı: yukarı yuvarlamak, kullanıcıya kasada olmayan parayı vaat etmektir.
 * Kırpma kabul edilemez olduğunda `toStroopsExact` kullanılır.
 */
export function toStroops(value: string | Decimal, decimals: number = ASSET_DECIMALS): bigint {
  const amount = parseAmount(value);
  const scaled = amount.times(new Decimal(10).pow(decimals));
  // ROUND_DOWN: sıfıra doğru kırpar, yani negatiflerde de mutlak değeri küçültür.
  return BigInt(scaled.toFixed(0, Decimal.ROUND_DOWN));
}

/**
 * Ondalık metni stroop'a çevirir; en ufak hassasiyet kaybında HATA verir.
 *
 * Neden ayrı bir fonksiyon: anchor'dan gelen tutarı veya kullanıcının yazdığı tutarı
 * sessizce kırpmak, farkın nereye gittiği sorulamayan bir para kaybıdır.
 */
export function toStroopsExact(value: string | Decimal, decimals: number = ASSET_DECIMALS): bigint {
  const amount = parseAmount(value);
  const scaled = amount.times(new Decimal(10).pow(decimals));
  if (!scaled.isInteger()) {
    throw new RangeError(
      `[money] "${amount.toString()}" ${decimals} ondalığa hassasiyet kaybı olmadan sığmıyor.`,
    );
  }
  return BigInt(scaled.toFixed(0));
}

/**
 * Stroop'u ondalık metne çevirir. Ondalık hane sayısı SABİTTİR (sondaki sıfırlar kırpılmaz).
 *
 * Neden sabit: anchor ve zincir tarafındaki karşılaştırmalar metin üzerinden yapılıyor;
 * "1.0" ile "1.0000000" farklı metinlerdir ve eşitlik kontrolünü sessizce bozar.
 */
export function fromStroops(stroops: bigint, decimals: number = ASSET_DECIMALS): string {
  const value = new Decimal(stroops.toString()).div(new Decimal(10).pow(decimals));
  return value.toFixed(decimals, Decimal.ROUND_DOWN);
}

/** Kuru doğrular. Sıfır veya negatif kur sessiz bölme hatasına yol açar, erken patlasın. */
function parseRate(rate: string | Decimal): Decimal {
  const parsed = parseAmount(rate, "kur");
  if (parsed.lte(0)) {
    throw new RangeError(`[money] Kur sıfırdan büyük olmalı, "${parsed.toString()}" verildi.`);
  }
  return parsed;
}

/**
 * Fiat tutarını varlık tutarına çevirir (TL → USDC). Aşağı yuvarlar.
 * `rate` = 1 varlık biriminin fiat karşılığı (örn. 1 USDC = 50 TRY).
 */
export function fiatToAsset(
  fiatAmount: string | Decimal,
  rate: string | Decimal,
  decimals: number = ASSET_DECIMALS,
): string {
  const amount = parseAmount(fiatAmount);
  return amount.div(parseRate(rate)).toFixed(decimals, Decimal.ROUND_DOWN);
}

/** Varlık tutarını fiat tutarına çevirir (USDC → TL). Aşağı yuvarlar. */
export function assetToFiat(
  assetAmount: string | Decimal,
  rate: string | Decimal,
  decimals: number = FIAT_DECIMALS,
): string {
  const amount = parseAmount(assetAmount);
  return amount.times(parseRate(rate)).toFixed(decimals, Decimal.ROUND_DOWN);
}

function formatTurkishDecimal(fixed: string): string {
  const [whole = "0", fraction] = fixed.split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return fraction === undefined ? grouped : `${grouped},${fraction}`;
}

export interface FormatFiatOptions {
  /** Getiri gibi artı yönlü değerlerde `+` işareti zorunlu (docs/brand.md Bölüm 5). */
  readonly signed?: boolean;
}

/**
 * TL tutarını kullanıcıya gösterilecek metne çevirir.
 *
 * Neden işareti Intl'e bırakmıyoruz: Intl ASCII tire (-) üretir; marka kuralı U+2212 (−)
 * istiyor. İşareti kendimiz koyup Intl'e her zaman mutlak değeri veriyoruz.
 */
export function formatFiat(value: string | Decimal, options: FormatFiatOptions = {}): string {
  const amount = parseAmount(value);
  // Gösterimde aşağı yuvarla: olmayan kuruşu gösterme.
  const rounded = new Decimal(amount.toFixed(FIAT_DECIMALS, Decimal.ROUND_DOWN));
  // Decimal metnini doğrudan grupluyoruz; Number'a dönüşüm büyük tutarda hassasiyet kaybettirir.
  const body = `₺${formatTurkishDecimal(rounded.abs().toFixed(FIAT_DECIMALS))}`;

  if (rounded.isNegative() && !rounded.isZero()) return `${MINUS}${body}`;
  if (options.signed === true && rounded.gt(0)) return `+${body}`;
  return body;
}

/**
 * Kasa payını kullanıcıya gösterilecek metne çevirir.
 * "dfToken" / "vault" kelimeleri kullanıcıya gösterilmez (docs/brand.md Bölüm 1).
 */
export function formatShares(stroops: bigint): string {
  const value = new Decimal(stroops.toString()).div(new Decimal(10).pow(ASSET_DECIMALS));
  const body = formatTurkishDecimal(value.toFixed(ASSET_DECIMALS));
  return `${body} kasa payı`;
}
