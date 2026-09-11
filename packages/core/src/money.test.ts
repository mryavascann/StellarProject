/**
 * Para testleri — MASTER PROMPT Bölüm 8.2.
 *
 * Bu dosya implementasyondan ÖNCE yazıldı ve kırmızı olduğu görüldü (kural 0.2).
 * Testler "çalışıyor mu" diye değil, "yanlış yapılabilecek şeyi yapıyor mu" diye yazıldı:
 * her fonksiyonun bir sınır değeri, bir hata ve bir hassasiyet testi var.
 */

import { describe, expect, it } from "vitest";
import {
  ASSET_DECIMALS,
  assetToFiat,
  fiatToAsset,
  formatFiat,
  formatShares,
  fromStroops,
  toStroops,
  toStroopsExact,
} from "./money";

describe("toStroops — ondalık → stroop", () => {
  it("7 ondalıklı tam değeri birebir çevirir", () => {
    expect(toStroops("1")).toBe(10_000_000n);
    expect(toStroops("1.0000001")).toBe(10_000_001n);
    expect(toStroops("0.0000001")).toBe(1n);
  });

  it("sıfırı sıfır yapar, işaret üretmez", () => {
    expect(toStroops("0")).toBe(0n);
    expect(toStroops("0.0000000")).toBe(0n);
    expect(toStroops("-0")).toBe(0n);
  });

  it("negatif değerleri korur", () => {
    expect(toStroops("-1.5")).toBe(-15_000_000n);
  });

  it("7 ondalıktan fazlasını SIFIRA DOĞRU kırpar, yukarı yuvarlamaz", () => {
    // Yukarı yuvarlamak, kullanıcıya kasada olmayan parayı vaat etmek demektir.
    expect(toStroops("0.99999999")).toBe(9_999_999n);
    expect(toStroops("-0.99999999")).toBe(-9_999_999n);
  });

  it("çok büyük sayıda hassasiyet kaybetmez", () => {
    // 2^53'ten büyük: Number ile yapılsa bozulurdu.
    expect(toStroops("9007199254.7405991")).toBe(90_071_992_547_405_991n);
  });

  it("sayı olmayan girdiyi reddeder", () => {
    expect(() => toStroops("abc")).toThrow();
    expect(() => toStroops("")).toThrow();
    expect(() => toStroops("1,5")).toThrow(); // virgüllü girdi ayrıştırılmadan gelmemeli
  });

  it("`number` tipini kabul etmez — float kapıdan giremez", () => {
    // @ts-expect-error number kabul edilmiyor; bu satırın derlenmemesi testin bir parçası.
    expect(() => toStroops(1.5)).toThrow();
  });
});

describe("toStroopsExact — hassasiyet kaybına izin vermeyen çevrim", () => {
  it("tam çevrilebilen değeri çevirir", () => {
    expect(toStroopsExact("12.3456789")).toBe(123_456_789n);
  });

  it("kırpma gerektiren değerde HATA verir, sessizce kaybetmez", () => {
    expect(() => toStroopsExact("0.12345678")).toThrow(/hassasiyet/i);
  });
});

describe("fromStroops — stroop → ondalık metin", () => {
  it("7 ondalığı her zaman yazar", () => {
    expect(fromStroops(10_000_000n)).toBe("1.0000000");
    expect(fromStroops(1n)).toBe("0.0000001");
    expect(fromStroops(0n)).toBe("0.0000000");
  });

  it("negatifi doğru yazar", () => {
    expect(fromStroops(-15_000_000n)).toBe("-1.5000000");
  });

  it("toStroops ile gidiş-dönüş kayıpsızdır", () => {
    for (const v of ["0.0000000", "1.0000000", "-1.5000000", "9007199254.7405991"]) {
      expect(fromStroops(toStroops(v))).toBe(v);
    }
  });
});

describe("float regresyon testi — neden decimal.js kullanıyoruz", () => {
  it("aynı hesap Number ile YANLIŞ, Decimal ile DOĞRU sonuç verir", () => {
    // Klasik IEEE-754 hatası: 0.1 + 0.2 !== 0.3
    expect(0.1 + 0.2).not.toBe(0.3);

    // Aynı işlem stroop tam sayılarıyla kayıpsız:
    expect(toStroops("0.1") + toStroops("0.2")).toBe(toStroops("0.3"));
  });

  it("Number.parseFloat ile çevrim büyük tutarda para kaybettirir", () => {
    const amount = "9007199254.7405991";
    const viaFloat = BigInt(Math.round(Number.parseFloat(amount) * 10 ** ASSET_DECIMALS));
    const viaDecimal = toStroops(amount);
    // parseFloat yolu sapıyor; bu yüzden anchor tutarları asla parseFloat ile okunmaz.
    expect(viaFloat).not.toBe(viaDecimal);
    expect(viaDecimal).toBe(90_071_992_547_405_991n);
  });
});

describe("kur çevrimi — TL ↔ USDC (simüle kur)", () => {
  const rate = "50.0000000"; // ⚠ SİM — config/simulation.ts

  it("TL tutarını varlığa çevirir", () => {
    expect(fiatToAsset("500.00", rate)).toBe("10.0000000");
    expect(fiatToAsset("1250.00", rate)).toBe("25.0000000");
  });

  it("varlığı TL'ye çevirir", () => {
    expect(assetToFiat("25.0000000", rate)).toBe("1250.00");
  });

  it("gidiş-dönüşte ondalık kaybı yok", () => {
    expect(assetToFiat(fiatToAsset("6000.00", rate), rate)).toBe("6000.00");
  });

  it("tam bölünmeyen tutarda aşağı yuvarlar", () => {
    // 100 / 3 = 33.333... → kullanıcıya fazlası vaat edilmez
    expect(fiatToAsset("100.00", "3")).toBe("33.3333333");
  });

  it("sıfır kuru reddeder", () => {
    expect(() => fiatToAsset("100.00", "0")).toThrow();
  });
});

describe("formatFiat — kullanıcıya gösterilen TL", () => {
  it("brand.md Bölüm 5'teki biçimi uygular", () => {
    expect(formatFiat("12450.00")).toBe("₺12.450,00");
    expect(formatFiat("0")).toBe("₺0,00");
  });

  it("negatifi eksi işaretiyle (U+2212) yazar, tire ile değil", () => {
    expect(formatFiat("-750.00")).toBe("−₺750,00");
  });

  it("artı işaretini yalnızca istendiğinde yazar", () => {
    expect(formatFiat("84.20", { signed: true })).toBe("+₺84,20");
    expect(formatFiat("84.20")).toBe("₺84,20");
  });

  it("gösterimde aşağı yuvarlar", () => {
    expect(formatFiat("0.999")).toBe("₺0,99");
  });
});

describe("formatShares — kasa payı", () => {
  it("7 ondalığı kırpmadan yazar ve Türkçe etiketi kullanır", () => {
    expect(formatShares(124_500_000_0n)).toBe("124,5000000 kasa payı");
  });

  it("sıfırı boş bırakmaz", () => {
    expect(formatShares(0n)).toBe("0,0000000 kasa payı");
  });
});
