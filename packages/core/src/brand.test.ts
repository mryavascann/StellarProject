/**
 * Marka tokenları testleri.
 *
 * En kritik iddia: anchor durum makinesinin HER dalı bir Türkçe metne ve bir aksiyona
 * eşlenmiş olmalı (Bölüm 8.3'ün zorunlu testi). Eşlenmemiş dal kalırsa bu dosya kırmızı olur.
 * Testler Türkçe cümleleri elle yazmaz — tek kaynak `brand.ts`'tir (K-010).
 */

import { describe, expect, it } from "vitest";
import {
  ANCHOR_STATUSES,
  BRAND,
  type AnchorStatus,
  type TransferDirection,
  resolveStatusText,
} from "./brand";

const DIRECTIONS: TransferDirection[] = ["deposit", "withdraw"];

/** Bölüm 8.3'te adı geçen 10 dal. Bu liste testin sözleşmesidir, kısaltılamaz. */
const ZORUNLU_DALLAR: AnchorStatus[] = [
  "incomplete",
  "pending_user_transfer_start",
  "pending_anchor",
  "pending_external",
  "pending_trust",
  "pending_user",
  "on_hold",
  "pending_customer_info_update",
  "completed",
  "error",
];

describe("anchor durum makinesi — her dal eşlenmiş olmalı", () => {
  it("Bölüm 8.3'teki 10 dalın hepsi tanımlı", () => {
    for (const dal of ZORUNLU_DALLAR) {
      expect(ANCHOR_STATUSES).toContain(dal);
    }
  });

  it.each(DIRECTIONS)("%s yönünde her dalın metni ve tonu var", (direction) => {
    for (const dal of ZORUNLU_DALLAR) {
      const metin = resolveStatusText(direction, dal);
      expect(metin.title.length, `${dal} başlıksız`).toBeGreaterThan(0);
      expect(metin.description.length, `${dal} açıklamasız`).toBeGreaterThan(0);
      expect(BRAND.tones).toContain(metin.tone);
    }
  });

  it.each(DIRECTIONS)("%s yönünde aksiyon gereken dallarda buton metni var", (direction) => {
    // Kullanıcıdan bir şey bekleyen dal, aksiyonsuz bırakılamaz — yoksa ekran çıkmaz sokak olur.
    const aksiyonGerekenler: AnchorStatus[] = [
      "incomplete",
      "pending_user_transfer_start",
      "pending_trust",
      "pending_user",
      "pending_customer_info_update",
      "error",
    ];
    for (const dal of aksiyonGerekenler) {
      expect(resolveStatusText(direction, dal).action, `${dal} aksiyonsuz`).toBeTruthy();
    }
  });

  it.each(DIRECTIONS)("%s yönünde bekleme dallarında aksiyon butonu YOK", (direction) => {
    // Kullanıcıya yapamayacağı bir şey için buton göstermek yanlış beklenti üretir.
    for (const dal of ["pending_anchor", "pending_external", "on_hold"] as AnchorStatus[]) {
      expect(resolveStatusText(direction, dal).action).toBeNull();
    }
  });
});

describe("tanınmayan durum", () => {
  it("çökmez, `unknown` dalına düşer", () => {
    // Gerçek anchor SEP-24'te tanımadığımız bir durum döndürebilir (karar K-009).
    const metin = resolveStatusText("deposit", "refunded" as AnchorStatus);
    expect(metin.tone).toBe("danger");
    expect(metin.action).toBeTruthy();
  });

  it("`unknown` metni kullanıcıya parasının kaybolmadığını söyler", () => {
    expect(resolveStatusText("withdraw", "bilinmeyen_durum" as AnchorStatus).description).toMatch(
      /kayıp değil/i,
    );
  });
});

describe("askıda kalan para — memo eşleşmedi", () => {
  it("sessizce pending_external olarak gösterilmez", () => {
    const askida = BRAND.statusText.memoMismatch;
    const normal = resolveStatusText("withdraw", "pending_external");
    expect(askida.title).not.toBe(normal.title);
    expect(askida.tone).toBe("danger");
    expect(askida.action).toBeTruthy();
  });
});

describe("yasaklı kelimeler", () => {
  it("hiçbir kullanıcı metninde teknik terim geçmiyor", () => {
    // docs/brand.md Bölüm 1. Bir terim sızarsa kullanıcı ne olduğunu anlamaz.
    const yasak = [
      "vault",
      "dfToken",
      "stroop",
      "XDR",
      "trustline",
      "SEP-24",
      "SEP-10",
      "anchor",
      "wallet",
      "blockchain",
      "quorum",
      "threshold",
    ];

    const tumMetinler: string[] = [];
    for (const direction of DIRECTIONS) {
      for (const dal of [...ANCHOR_STATUSES, "unknown" as AnchorStatus]) {
        const m = resolveStatusText(direction, dal);
        tumMetinler.push(m.title, m.description, m.action ?? "");
      }
    }
    tumMetinler.push(...Object.values(BRAND.messages));

    for (const metin of tumMetinler) {
      for (const kelime of yasak) {
        expect(
          metin.toLowerCase().includes(kelime.toLowerCase()),
          `"${kelime}" sızmış: "${metin}"`,
        ).toBe(false);
      }
    }
  });
});

describe("renk tokenları", () => {
  it("açık ve koyu tema aynı token adlarını taşıyor", () => {
    // Bir tokenın yalnızca bir temada tanımlı olması, diğer temada görünmez metin demektir.
    expect(Object.keys(BRAND.colors.light).sort()).toEqual(Object.keys(BRAND.colors.dark).sort());
  });

  it("kodda hardcoded hex kalmaması için hepsi CSS değişkeni adıyla anahtarlanmış", () => {
    for (const token of Object.keys(BRAND.colors.light)) {
      expect(token).toMatch(/^--kasa-[a-z0-9-]+$/);
    }
  });
});
