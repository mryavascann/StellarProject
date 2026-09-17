import { BRAND, assetToFiat, formatShares, fromStroops, resolveStatusText, toStroops, type StatusText } from "@kasa/core";
import Decimal from "decimal.js";

import { SPEND_QUORUM, SPEND_THRESHOLD_STROOPS } from "./config";

/**
 * Kasa payı (stroop) → TL metni. Pay × pay fiyatı × kur. Aşağı yuvarlar (brand.md Bölüm 5).
 * `sharePrice` null ise (live SDK vermezse) 1 kabul edilmez; USDC karşılığı ayrıca verilmelidir.
 */
export function sharesToFiat(shareStroops: bigint, sharePrice: string, rate: string): string {
  const usdc = new Decimal(fromStroops(shareStroops)).times(sharePrice);
  return assetToFiat(usdc, rate);
}

/** TL → kasa payı (stroop). Talep formunda kullanılır; aşağı yuvarlar ki olmayan pay istenmesin. */
export function fiatToShares(amountFiat: string, sharePrice: string, rate: string): bigint {
  const usdc = new Decimal(amountFiat).div(rate);
  return toStroops(usdc.div(sharePrice));
}

/** Kullanıcının yazdığı "1.250,50" biçimini API'nin beklediği "1250.50" metnine çevirir. */
export function normalizeFiatInput(raw: string): string | null {
  const cleaned = raw.trim().replace(/\./gu, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/u.test(cleaned)) return null;
  const [whole = "0", fraction = ""] = cleaned.split(".");
  return `${whole}.${fraction.padEnd(2, "0")}`;
}

/** Tipografik eksi (U+2212). Intl ASCII tire verir; marka tipografik eksi ister (brand.md Bölüm 5). */
const MINUS = "−";

/**
 * Arayüzdeki TEK para biçimlendiricisi (brand.md Bölüm 5).
 *
 * Neden böyle:
 * - `Intl.NumberFormat`'a **metin** verilir (Intl v3). `Number`'a çevirmek büyük tutarlarda
 *   kuruş kaybettirir; para asla float'a düşmez.
 * - Hesap `decimal.js` ile yapılır, gösterimde **aşağı** yuvarlanır: olmayan kuruş gösterilmez.
 * - `signed` yalnız kazanç bağlamında kullanılır ("+₺84,20").
 */
export function formatTRY(value: string | Decimal, options: { signed?: boolean } = {}): string {
  const amount = new Decimal(value);
  const rounded = amount.toFixed(2, Decimal.ROUND_DOWN);
  const formatter = new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    ...(options.signed === true ? { signDisplay: "exceptZero" as const } : {}),
  });
  // Intl v3 `format()`'a metin verilmesine izin verir; TypeScript'in kütüphane tipleri
  // hâlâ yalnız `number | bigint` diyor. Metin vermek ŞART: `Number`'a çevirmek kuruş kaybettirir.
  const format = formatter.format as unknown as (value: string) => string;
  return format(rounded).replace("-", MINUS);
}

/** Kısa ad: ekranlarda `tl(...)` okunuyor. Tüm tutarlar buradan `formatTRY`'ye gider. */
export const tl = (value: string | Decimal, signed = false) => formatTRY(value, { signed });
export const shares = (stroops: bigint) => formatShares(stroops);

/** Getiri: pay × (fiyat − başlangıç fiyatı) × kur. Başlangıç fiyatı 1 (⚠ SİM, config). */
export function yieldFiat(shareStroops: bigint, sharePrice: string, rate: string, initialPrice: string): string {
  const gain = new Decimal(fromStroops(shareStroops)).times(new Decimal(sharePrice).minus(initialPrice));
  return assetToFiat(gain, rate);
}

/** Yıllık getiri gösterimi: `%` önde, virgüllü (brand.md Bölüm 5). */
export function apyText(apyPercent: string): string {
  return `%${apyPercent.replace(".", ",")}`;
}

/** Harcama talebi formunun eşik mesajı (brand.md Bölüm 8). */
export function spendMessage(amountStroops: bigint, vaultBalanceStroops: bigint, balanceFiat: string): string {
  if (amountStroops <= 0n) return BRAND.messages.spendNonPositive;
  if (amountStroops > vaultBalanceStroops) return BRAND.messages.spendInsufficient.replace("{tutar}", tl(balanceFiat));
  if (amountStroops <= SPEND_THRESHOLD_STROOPS) return BRAND.messages.spendNoApprovalNeeded;
  return BRAND.messages.spendApprovalNeeded.replace("{n}", String(SPEND_QUORUM));
}

/** Anchor durum rozeti metni; `{tutar}` yer tutucusu doldurulur. Memo eşleşmedi ayrı metindir. */
export function statusText(direction: "deposit" | "withdraw", status: string, amountFiat?: string, memoMatched?: boolean): StatusText {
  const base = direction === "withdraw" && status === "pending_external" && memoMatched === false
    ? BRAND.statusText.memoMismatch
    : resolveStatusText(direction, status);
  return { ...base, description: base.description.replace("{tutar}", amountFiat ? tl(amountFiat) : "tutar") };
}

export interface WithdrawBreakdown {
  readonly gross: string;
  readonly fee: string;
  readonly net: string;
}

/**
 * Çekim öncesi üç zorunlu satır (brand.md Bölüm 5): hesaptan düşecek · komisyon · bankaya geçecek.
 * Komisyon anchor `/info`'dan gelir; kodda sabit yoktur. Net aşağı yuvarlanır.
 */
export function withdrawBreakdown(grossFiat: string, limits: { feePercent: string | null; feeFixed: string | null }): WithdrawBreakdown {
  const gross = new Decimal(grossFiat);
  const fee = gross.times(new Decimal(limits.feePercent ?? "0").div(100)).plus(limits.feeFixed ?? "0");
  const net = Decimal.max(gross.minus(fee), 0);
  return { gross: gross.toFixed(2, Decimal.ROUND_DOWN), fee: fee.toFixed(2, Decimal.ROUND_UP), net: net.toFixed(2, Decimal.ROUND_DOWN) };
}

/** Pay fiyatı: mock verir; live SDK vermezse bakiye/pay oranından türetilir, o da yoksa başlangıç fiyatı. */
export function effectiveSharePrice(overview: { balance: { shares: string; underlying: string }; info: { sharePrice: string | null } } | null, initial: string): string {
  if (!overview) return initial;
  if (overview.info.sharePrice) return overview.info.sharePrice;
  const shares = BigInt(overview.balance.shares);
  if (shares === 0n) return initial;
  return new Decimal(overview.balance.underlying).div(overview.balance.shares).toFixed(7, Decimal.ROUND_DOWN);
}

/** Kısa tarih: defter satırı için. */
export function dateText(unixSeconds: number): string {
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(unixSeconds * 1000);
}
