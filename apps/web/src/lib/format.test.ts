import { BRAND } from "@kasa/core";
import { describe, expect, it } from "vitest";

import { SPEND_THRESHOLD_STROOPS } from "./config";
import Decimal from "decimal.js";

import {
  apyText,
  effectiveSharePrice,
  fiatToShares,
  formatTRY,
  normalizeFiatInput,
  shares,
  sharesToFiat,
  spendMessage,
  statusText,
  tl,
  withdrawBreakdown,
  yieldFiat,
} from "./format";

describe("para biçimlendirme", () => {
  it("TL: binlik nokta, ondalık virgül, sıfır ve eksi (U+2212)", () => {
    expect(tl("12450.00")).toBe("₺12.450,00");
    expect(tl("0")).toBe("₺0,00");
    expect(tl("-750")).toBe("−₺750,00");
    expect(tl("84.2", true)).toBe("+₺84,20");
  });

  it("formatTRY tek geçiş noktasıdır: Intl'e metin verilir, Number'a düşülmez", () => {
    // Number(...) bu değeri bozar: 9007199254740993 → 9007199254740992.
    expect(formatTRY("9007199254740993.45")).toBe("₺9.007.199.254.740.993,45");
    expect(formatTRY(new Decimal("1250.5"))).toBe("₺1.250,50");
  });

  it("formatTRY aşağı yuvarlar: olmayan kuruş gösterilmez", () => {
    expect(formatTRY("10.999")).toBe("₺10,99");
    expect(formatTRY("-10.999")).toBe("−₺10,99");
  });

  it("kasa payı 7 ondalıkla ve 'kasa payı' etiketiyle gösterilir", () => {
    expect(shares(124_5000000n)).toBe("124,5000000 kasa payı");
    expect(shares(0n)).toBe("0,0000000 kasa payı");
  });

  it("pay ↔ TL dönüşümü kur ve pay fiyatıyla, aşağı yuvarlayarak", () => {
    expect(sharesToFiat(160_0000000n, "1.0000000", "50.0000000")).toBe("8000.00");
    expect(sharesToFiat(160_0000000n, "1.0002000", "50.0000000")).toBe("8001.60");
    expect(fiatToShares("1000.00", "1.0000000", "50.0000000")).toBe(20_0000000n);
    expect(fiatToShares("1000.00", "1.0002000", "50.0000000")).toBe(19_9960007n);
  });

  it("kullanıcı girişini normalize eder, bozuk girdiyi reddeder", () => {
    expect(normalizeFiatInput("1.250,5")).toBe("1250.50");
    expect(normalizeFiatInput("500")).toBe("500.00");
    expect(normalizeFiatInput("abc")).toBeNull();
    expect(normalizeFiatInput("1,234")).toBeNull();
  });

  it("getiri ve yıllık getiri metni", () => {
    expect(yieldFiat(160_0000000n, "1.0002000", "50.0000000", "1.0000000")).toBe("1.60");
    expect(apyText("6.50")).toBe("%6,50");
  });
});

describe("harcama formu mesajı", () => {
  const balance = 160_0000000n;
  it("eşik altı ve tam eşik onaysız, üstü onay ister", () => {
    expect(spendMessage(SPEND_THRESHOLD_STROOPS, balance, "8000.00")).toBe(BRAND.messages.spendNoApprovalNeeded);
    expect(spendMessage(SPEND_THRESHOLD_STROOPS + 1n, balance, "8000.00")).toBe("Bu tutar için 2 kişinin onayı gerekiyor.");
  });
  it("sıfır ve bakiye üstü reddedilir", () => {
    expect(spendMessage(0n, balance, "8000.00")).toBe(BRAND.messages.spendNonPositive);
    expect(spendMessage(balance + 1n, balance, "8000.00")).toBe("Kasada ₺8.000,00 var. Talebin bundan fazla olamaz.");
  });
});

describe("çekim dökümü", () => {
  it("komisyonu anchor limitlerinden hesaplar, neti aşağı, komisyonu yukarı yuvarlar", () => {
    expect(withdrawBreakdown("1000.00", { feePercent: "0.7", feeFixed: "25.00" })).toEqual({ gross: "1000.00", fee: "32.00", net: "968.00" });
    expect(withdrawBreakdown("10.00", { feePercent: "0.7", feeFixed: "25.00" }).net).toBe("0.00");
    expect(withdrawBreakdown("100.00", { feePercent: null, feeFixed: null })).toEqual({ gross: "100.00", fee: "0.00", net: "100.00" });
  });

  it("pay fiyatı: verilmişse onu, yoksa bakiye/pay oranını, o da yoksa başlangıcı kullanır", () => {
    expect(effectiveSharePrice({ balance: { shares: "10", underlying: "11" }, info: { sharePrice: "1.5000000" } }, "1.0000000")).toBe("1.5000000");
    expect(effectiveSharePrice({ balance: { shares: "100000000", underlying: "110000000" }, info: { sharePrice: null } }, "1.0000000")).toBe("1.1000000");
    expect(effectiveSharePrice({ balance: { shares: "0", underlying: "0" }, info: { sharePrice: null } }, "1.0000000")).toBe("1.0000000");
    expect(effectiveSharePrice(null, "1.0000000")).toBe("1.0000000");
  });
});

describe("durum metni", () => {
  it("her anchor dalı marka metnine eşlenir ve tutar yer tutucusu dolar", () => {
    expect(statusText("deposit", "completed", "500.00").description).toBe("₺500,00 kasaya girdi ve getiri kazanmaya başladı.");
    expect(statusText("withdraw", "pending_external", "1.00", false).title).toBe(BRAND.statusText.memoMismatch.title);
    expect(statusText("withdraw", "refunded").title).toBe(BRAND.statusText.unknown.title);
  });
});
