/**
 * SİMÜLASYON SABİTLERİ — MASTER PROMPT Bölüm A.2
 *
 * Bu dosya simüle edilmiş her değerin TEK adresidir. Başka hiçbir yerde bu değerler
 * tekrar yazılmaz; çünkü etkinlik günü (A.5) bunların bir kısmı gerçeğiyle değişecek ve
 * dağınık kopyalar tek tek avlanamaz.
 *
 * `⚠ SİM` etiketli her satır TAHMİNDİR ve etkinlik günü değişebilir. ETİKETİ SİLME.
 * Etiketsiz satırlar Stellar testnet'in gerçek, doğrulanmış değerleridir
 * (kaynak: skills.stellar.org/skills/data/SKILL.md).
 *
 * Para birimleri: tutarlar asla `number` değildir. Zincir tarafı `bigint` (stroop),
 * gösterim/oran tarafı `string` (decimal.js ile ayrıştırılır). Bölüm 0.5: parada float yok.
 */

/** 7 ondalıklı bir token'ın bir biriminin stroop karşılığı. Stellar standardı, simüle değil. */
export const STROOPS_PER_UNIT = 10_000_000n;

/**
 * Ağ ve altyapı uçları.
 * `⚠ SİM` olmayanlar gerçektir; portlar yerel geliştirme tercihidir.
 */
export const NETWORK = {
  /** Stellar Testnet — gerçek */
  name: "testnet",
  /** gerçek */
  rpcUrl: "https://soroban-testnet.stellar.org",
  /** gerçek */
  horizonUrl: "https://horizon-testnet.stellar.org",
  /** gerçek */
  networkPassphrase: "Test SDF Network ; September 2015",
  /** gerçek */
  friendbotUrl: "https://friendbot.stellar.org",
} as const;

export const PORTS = {
  /** ⚠ SİM — mock anchor portu */
  mockAnchor: 8788,
  /** ⚠ SİM — API portu */
  api: 8787,
  /** ⚠ SİM — web portu */
  web: 3000,
} as const;

/**
 * Mock anchor davranışı — A.2 + A.4.
 * Bu değerler anchor'ın `/info` ucundan OKUNUR; kod bunları varsaymaz (Bölüm 9 kural 11).
 * Buradaki kopyalar yalnızca mock anchor'ın kendi yanıtlarını üretmesi ve testlerin
 * beklenen değeri bilmesi içindir.
 */
export const ANCHOR = {
  /** ⚠ SİM — gerçek domain Workshop #3'te alınacak, env'den gelir */
  homeDomain: "localhost:8788",
  /** ⚠ SİM */
  name: "Simüle TRY Anchor",
  /** gerçek olacak — fiat kodu */
  fiatCode: "TRY",
  /** ⚠ SİM — Stellar varlığı; issuer gen-accounts.ts tarafından üretilir, ezberden yazılmaz (K-007) */
  assetCode: "USDC",

  /** ⚠ SİM — 1 USDC = 50,0000000 TRY. String; float'a çevrilmez. */
  rate: "50.0000000",
  /** ⚠ SİM — her quote'ta ±%0,3 rastgele oynama */
  rateJitterPercent: "0.3",

  deposit: {
    /** ⚠ SİM — %0,5 oransal komisyon */
    feePercent: "0.5",
    /** ⚠ SİM — 15,00 TRY sabit komisyon */
    feeFixedFiat: "15.00",
    /** ⚠ SİM — min 100 TRY */
    minAmountFiat: "100.00",
    /** ⚠ SİM — max 50.000 TRY */
    maxAmountFiat: "50000.00",
  },

  withdraw: {
    /** ⚠ SİM — %0,7 oransal komisyon */
    feePercent: "0.7",
    /** ⚠ SİM — 25,00 TRY sabit komisyon */
    feeFixedFiat: "25.00",
    /** ⚠ SİM — min 200 TRY */
    minAmountFiat: "200.00",
    /** ⚠ SİM — max 50.000 TRY */
    maxAmountFiat: "50000.00",
  },

  /** ⚠ SİM — SEP-38 firm quote ömrü (saniye). Dolmuş quote → 400 (A.4 davranış 3). */
  quoteTtlSeconds: 90,
  /** ⚠ SİM — SEP-10 JWT ömrü (saniye). Dolmuş JWT → 401 (A.4 davranış 4). */
  jwtTtlSeconds: 15 * 60,

  /** ⚠ SİM — SEP-12 KYC yok; interactive ekranda tek "Onayla" butonu */
  kycRequired: false,

  features: {
    /** ⚠ SİM — referans anchor da böyle */
    account_creation: false,
    /** ⚠ SİM — false: deposit öncesi trustline ZORUNLU (Bölüm 9 kural 5) */
    claimable_balances: false,
  },

  /** ⚠ SİM — durum makinesinin her adımı arası bekleme (saniye), A.4 davranış 6 */
  stateStepSeconds: 3,
} as const;

/**
 * Mock DeFindex davranışı — A.2.
 * Mock adaptör `@defindex/sdk` ile AYNI imzaları uygular (K-003, Bölüm 8.3 arayüz eşitliği testi).
 */
export const DEFINDEX = {
  /** ⚠ SİM */
  vaultName: "Kasa USDC Vault",
  /** ⚠ SİM */
  vaultSymbol: "kUSDC",
  /** ⚠ SİM — %6,50 sabit yıllık getiri */
  apyPercent: "6.50",
  /** ⚠ SİM — başlangıçta 1 dfToken = 1,0000000 USDC */
  initialSharePrice: "1.0000000",
  /** ⚠ SİM — demoda getiri görünsün diye dakikada +0,00002 */
  sharePriceIncrementPerMinute: "0.00002",
  /**
   * ⚠ SİM — pay fiyatının artmaya başladığı an (ISO 8601).
   * Sabit bir tarih olmasının sebebi: süreç yeniden başlayınca fiyat 1,0'a dönmesin,
   * daha önce alınan paylar aniden değer kaybetmesin.
   */
  sharePriceEpoch: "2026-09-16T00:00:00.000Z",
  /** ⚠ SİM — vault komisyonu 100 bps (%1) */
  feeBps: 100,
  /** ⚠ SİM — deposit/withdraw yapay gecikmesi (ms) */
  latencyMs: 1500,
  /** ⚠ SİM — deploy sırasında her demo üyesine verilecek mock vault payı */
  mockShareBalancePerMember: "1000.0000000",
} as const;

/**
 * `shared_vault.init()` argümanları — A.2.
 * Kontrat bunları kurulum anında alır; kontratın içinde hiçbir sabit yoktur.
 */
export const VAULT_INIT = {
  /**
   * ⚠ SİM — onaysız harcama üst limiti, dfToken stroop cinsinden.
   * 20_0000000 stroop = 20 dfToken ≈ 1.000 TRY (50 TRY/USDC kuruyla).
   * Sınır davranışı `<=`: tam bu tutar onaysız geçer (Bölüm 8.1 test 21).
   */
  threshold: 20_0000000n,
  /** ⚠ SİM — eşik üstü talepler için gereken onay sayısı */
  quorum: 2,
  /** ⚠ SİM — talep ömrü: 259200 saniye = 72 saat */
  requestTtlSeconds: 259_200,
  /** ⚠ SİM — demo üye sayısı: 1 admin + 3 üye */
  memberCount: 4,
} as const;

/**
 * Demo verisi — `scripts/seed.ts` bunu kullanır (A.2).
 * Adresler BURADA YOK; gen-accounts.ts üretir ve .env.simulation'a yazar (A.3).
 */
export const SEED = {
  /** ⚠ SİM */
  vaultName: "Moda Ev Kasası",
  /** ⚠ SİM — sıra: admin önce */
  members: [
    { name: "Deniz", role: "admin", contributionFiat: "2500.00" }, // ⚠ SİM
    { name: "Ece", role: "member", contributionFiat: "2500.00" }, // ⚠ SİM
    { name: "Kerem", role: "member", contributionFiat: "1500.00" }, // ⚠ SİM
    { name: "Sıla", role: "member", contributionFiat: "1500.00" }, // ⚠ SİM
  ],
  /** ⚠ SİM — örnek talepler: biri eşik üstü (1 onay var), biri eşik altı (hazır) */
  requests: [
    { note: "Kira Ekim", amountFiat: "6000.00", approvals: 1 }, // ⚠ SİM
    { note: "İnternet faturası", amountFiat: "750.00", approvals: 0 }, // ⚠ SİM
  ],
} as const;

/** Simülasyon konfigürasyonunun tamamı. `config/live.ts` aynı şekli uygular. */
export const SIMULATION_CONFIG = {
  mode: "simulation",
  network: NETWORK,
  ports: PORTS,
  anchor: ANCHOR,
  defindex: DEFINDEX,
  vaultInit: VAULT_INIT,
  seed: SEED,
} as const;

export type KasaConfig = typeof SIMULATION_CONFIG;
