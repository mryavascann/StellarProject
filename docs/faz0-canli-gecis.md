# Faz 0 — canlı geçiş kontrol listesi

Etkinlik günü (19–20 Eylül 2026) ilk 2 saatte uygulanır. MASTER PROMPT A.5'in
çalıştırılabilir hâli: her satırda **nereden alınacağı** ve **nasıl doğrulanacağı** yazar.

> Hiçbir değer buraya önceden yazılmaz. Boş bırakılan bir alanı tahminle doldurmak
> yasaktır (Bölüm 0.3); değeri alamıyorsan dur ve sor.

## 1. Bilgi toplama (Workshop #3, Day 1 12:40)

| # | Alınacak bilgi | Kaynak | Doğrulaması |
|---|---|---|---|
| 1 | Anchor `home_domain` | Workshop / mentor | `curl https://<domain>/.well-known/stellar.toml` 200 ve `text/plain` döner |
| 2 | Desteklenen fiat / varlık çifti | anchor TOML `CURRENCIES` + `/info` | `ANCHOR_ASSET_CODE` ile `ANCHOR_ASSET_ISSUER` birlikte not edilir |
| 3 | Gerçek USDC issuer | `faucet.circle.com` | TOML'daki issuer ile birebir aynı mı |
| 4 | KYC (SEP-12) gerekiyor mu | TOML'da `KYC_SERVER` + `/info` | Gerekiyorsa Faz 1'de SEP-12 modülü açılır |
| 5 | DeFindex testnet vault adresi | DeFindex Discord / docs | `getVaultInfo()` isim ve sembol döndürüyor mu |
| 6 | DeFindex API key | DeFindex | `getVaultAPY()` 200 dönüyor mu |
| 7 | Gerçek dfToken adresi | `getVaultInfo()` | Transfer edilebiliyor mu (K-001 kırılma şartı) |

## 2. `.env.live` dosyasını oluştur

`.env.live` git'e girmez. Aşağıdaki şablonu kopyala ve 1. adımda topladığın
değerlerle doldur. Canlı modda bunlardan biri boşsa uygulama **açılışta durur**,
sessizce varsayılana düşmez (`config/live.ts`).

```bash
KASA_MODE=live

# --- Hesaplar: simülasyondakiler yeniden kullanılır (testnet) ---
ADMIN_SECRET=            ADMIN_PUBLIC=
MEMBER_A_SECRET=         MEMBER_A_PUBLIC=
MEMBER_B_SECRET=         MEMBER_B_PUBLIC=
MEMBER_C_SECRET=         MEMBER_C_PUBLIC=

# --- Anchor (A.5 · 1, 2, 3) ---
ANCHOR_HOME_DOMAIN=      # workshop'tan; şema YOK, yalnız domain
ANCHOR_FIAT_CODE=        # anchor /info
ANCHOR_ASSET_CODE=       # anchor /info
ANCHOR_ASSET_ISSUER=     # faucet.circle.com ile doğrulanmış issuer

# --- DeFindex (A.5 · 5, 6, 7) ---
DEFINDEX_VAULT_ID=
DEFINDEX_API_KEY=
SHARE_TOKEN_ID=          # getVaultInfo() çıktısı; değişirse kontrat yeniden init edilir

# --- Kontrat ---
SHARED_VAULT_CONTRACT_ID=   # gerçek dfToken ile yeniden init edilmiş kontrat

# --- Dağıtım ---
KASA_DEPLOY_URL=https://stellar-kasa.vercel.app
```

**Not:** komisyon, limit, quote ömrü, JWT ömrü ve `features` bayrakları env'e
**yazılmaz** — anchor `/info`'sundan çalışma zamanında okunur (Bölüm 9 kural 11).

## 3. Kontratı gerçek dfToken ile yeniden kur

```bash
pnpm deploy            # yeni SHARED_VAULT_CONTRACT_ID üretir, .env.live'a yazılır
pnpm seed              # demo üyeleri ve örnek talepler
```

`init` argümanları A.2'deki ⚠ SİM değerlerdir; etkinlikte değişmesi gerekirse
`docs/decisions.md`'ye kayıt düşülür.

## 4. Kapıları çalıştır

```bash
pnpm test              # tümü yeşil olmadan devam yok (245 test)
pnpm test:live         # gerçek anchor TOML + /info + SEP-10 sequence 0 + DeFindex vault/APY
pnpm test:e2e          # testnet üzerinde tam döngü
pnpm test:deploy       # dağıtılmış demo URL'i: TOML, SEP-10, kasa, istemci paketi
```

`pnpm test:live` şunlarda **durur** (hepsi kasıtlı):
- TOML'daki domain env ile uyuşmuyorsa
- `ANCHOR_ASSET_CODE` / `ANCHOR_ASSET_ISSUER` anchor'ın verdiğinden farklıysa
- SEP-10 challenge'ın sequence number'ı 0 değilse
- deposit veya withdraw kapalıysa
- DeFindex'in iki ucu farklı APY veriyorsa

## 5. GO / NO-GO raporu

Faz 0'ın çıktısı bir karardır. Şu formatta yazılır ve `docs/STATE.md`'ye işlenir:

```
GO/NO-GO — <saat>
- Anchor: <domain> · deposit <açık/kapalı> · withdraw <açık/kapalı> · KYC <var/yok>
- Varlık: <code>:<issuer> (faucet ile doğrulandı mı)
- DeFindex: vault <id> · APY <%> · dfToken <adres> · transfer edilebilir mi
- Kontrat: <id> (gerçek dfToken ile init edildi mi)
- Kapılar: test <X/Y> · test:live <geçti/kaldı> · test:e2e <geçti/kaldı> · test:deploy <geçti/kaldı>
- KARAR: GO / NO-GO · gerekçe
```

**NO-GO ise:** kilitli kararı kendi başına değiştirme (K-001, K-002, K-003).
Bulguyu kanıtıyla raporla ve karar bekle. Simülasyon modu çalışır durumda
kalmaya devam eder; demo en kötü ihtimalle simülasyonda verilir.
