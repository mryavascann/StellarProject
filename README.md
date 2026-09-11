# Kasa

**Ev arkadaşları, ekipler ve aileler için ortak kasa** — herkes Türk lirası yatırır, kasa dolar
cinsinden bekleyip getiri kazanır, harcamalar kurala göre onaylanır ve gerektiğinde tekrar
Türk lirası olarak çıkar.

> Stellar Pro Hackathon 2026 · Genesis Track · 19–20 Eylül 2026, Grand Pera, İstanbul

---

## Neden

Türkiye'de ortak para yönetimi iki kötü seçenek arasında sıkışmış. Ya birinin şahsi hesabında
toplanır — güven riski, o kişi ulaşılmaz olunca kimse ödeme yapamaz, kimin ne yatırdığı
WhatsApp'ta kaybolur — ya da hiç toplanmaz, her fatura ayrı ayrı bölüşülür. Üstelik bekleyen
ortak para eriyor.

**Kasa'nın vaadi:** Kimsenin şahsi hesabında değil. Kim ne yatırdı defterde yazıyor. Beklerken
eriyeceğine getiri kazanıyor. Harcamak için ortak kural var. Çıkmak istediğinde yine Türk lirası
olarak bankana geliyor.

---

## Durum

| | |
|---|---|
| Faz | **S1 — iskelet** (simülasyon modu) |
| Canlı demo URL | henüz yok |
| Demo videosu | henüz yok |
| Kontrat adresi | henüz deploy edilmedi |
| Ağ | Stellar **Testnet** |

Projenin canlı ve kanıtlı durumu: [`docs/STATE.md`](docs/STATE.md).
Bu tablo STATE.md ile çelişirse **STATE.md ve testler esastır.**

---

## Hackathon gereksinimleri

| # | Gereksinim | Nasıl karşılanıyor | Durum |
|---|---|---|---|
| 1 | **Integration** — uygun bir protokol ile entegrasyon | **DeFindex** vault'u: kasanın bakiyesi vault payı olarak tutulur | simülasyonda mock adaptör, canlıda `@defindex/sdk` |
| 2 | **Anchor / Local Payments** — gerçek fiat giriş/çıkışı | **TRY anchor**, SEP-1 / SEP-10 / SEP-24 (+ SEP-38, mümkünse SEP-12) | simülasyonda `apps/mock-anchor`, canlıda gerçek anchor |
| 3 | **Core Feature** | Kasanın bakiyesi **doğrudan** DeFindex vault payı olarak tutulur; paranın giriş/çıkış yolu **yalnızca** anchor'dır | mimari kilitli (bkz. `docs/decisions.md` K-001) |

---

## Mimari

```
[TL] banka
  │ ① SEP-24 deposit (TRY anchor)
  ▼
USDC → üyenin Stellar hesabı
  │ ② DeFindex: depositToVault → dfToken
  ▼
dfToken → üyenin hesabı
  │ ③ SharedVault.deposit(): kontrata kilitlenir, defter yazılır
  ▼
K A S A   (içeride vault payı durduğu için getiri işlemeye devam eder)
  │ ④ request_spend() → approve() → execute()
  ▼
dfToken → talep eden üyenin hesabı
  │ ⑤ DeFindex: withdrawShares → USDC
  │ ⑥ SEP-24 withdraw → üyenin KENDİ hesabından, doğru memo ile
  ▼
[TL] banka
```

Ayrıntı: [`docs/architecture.md`](docs/architecture.md) · Kilitli kararlar: [`docs/decisions.md`](docs/decisions.md)

---

## Kullanılan skill dosyaları

Tam liste, yolları ve **hangi kararı etkilediği** ile birlikte:
[`docs/skills-used.md`](docs/skills-used.md)

Özet: Stellar smart-contracts · dapp · assets · data · standards skill'leri,
CheesecakeLabs anchor skill'i, PaltaLabs DeFindex SDK skill'i,
`soroban-common-mistakes` güvenlik skill'i.

---

## Kurulum

Gereksinimler: **Node 22+**, **pnpm**, **Rust + `wasm32v1-none` hedefi**, **Stellar CLI**.

```bash
pnpm install
cp .env.example .env.simulation

pnpm gen:accounts     # 4 hesap + mock USDC issuer üretir, friendbot ile fonlar
bash scripts/deploy-mock-token.sh   # simülasyon dfToken'ı
pnpm deploy           # shared_vault → testnet, init
pnpm seed             # demo verisi
```

`make` kuruluysa aynı komutlar: `make install`, `make accounts`, `make deploy`, `make seed`.

## Çalıştırma

```bash
pnpm sim    # yalnızca mock anchor  (http://localhost:8788)
pnpm dev    # mock anchor + API + web
```

## Testler

```bash
pnpm test           # HEPSİ: Soroban kontrat testleri + TypeScript testleri
pnpm test:contract  # yalnızca kontrat  (cargo test)
pnpm test:ts        # yalnızca TypeScript (vitest)
pnpm test:live      # canlı modda entegrasyon testleri (etkinlik günü)
```

**Test yoksa kod yoktur.** Test listesi ve disiplini: MASTER PROMPT Bölüm 8.

---

## Simülasyon modu

Etkinlik öncesi her şey `KASA_MODE=simulation` ile geliştirilir: anchor çağrıları
`apps/mock-anchor`'a, DeFindex çağrıları mock adaptöre gider. Mock anchor bilerek
**zorlaştırılmıştır** — string tutarlar, 90 saniyede dolan quote'lar, 15 dakikada dolan JWT,
yanlış memo'yu eşleştirmeme, `X-Frame-Options: DENY`.

Mod farkı yalnızca **iki adaptör dosyasında** yaşar. Simüle edilmiş her sabit
`config/simulation.ts` içinde ve `⚠ SİM` etiketlidir.

---

## Bilinen sınırlar

- Şu an yalnızca **testnet**. Mainnet kapsam dışı.
- Tek kasa. Çoklu kasa ve kasalar arası transfer kapsam dışı.
- Defterdeki `contributed`/`withdrawn` kayıtları bilgi amaçlıdır; **oransal pay hakkı hesabı yapılmaz.**
- Tek varlık (USDC → dfToken). Çoklu varlık kapsam dışı.

Roadmap: [`docs/decisions.md`](docs/decisions.md) sonundaki liste.
