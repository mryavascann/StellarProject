# PROJE DURUMU

Son güncelleme: 2026-09-17 22:55 · Ajan: claude-durumsuz-dagitim · Mod: **simulation**

## Faz
Şu an: **Faz S3 tamamlandı** — simülasyonda tam döngü testnet'te çalışıyor, tam yığın Vercel'de yayında.
Tamamlanan: Faz S1 · S2 · S3. Sıradaki: etkinlik günü Faz 0 (`docs/faz0-canli-gecis.md`).

## Çalışan (test edilmiş, kanıtlı)
- [x] `shared_vault` testnet'te: `CCQRVAEEVD3NTKNILHWRWSUMW6IYWXTWWFEV6C2HFE2UHLG3EDVGOBLH` — **30/30**.
- [x] Mock dfToken (kUSDC SAC): `CBYA6NYDXYXSO2CFS66GWMDSKQL6XTT6OOCL4C55OUGM5KV4AHXVKICD`.
- [x] `packages/core`: **49/49** · Scripts: **13/13**.
- [x] Mock anchor: **22/22** — SEP-1/10/24/38, JWT 15 dk, quote 90 sn, popup DENY,
      deposit tamamlanınca gerçek USDC ödemesi (trustline yoksa `pending_trust`),
      withdraw ödemesi Horizon'dan doğrulanır, yanlış memo → `pending_external` askıda.
      **Durum artık bellekte değil: kimlikler imzalı ve kendini anlatır (K-015).**
- [x] API: **93/93** — anchor istemcisi (mod sınırı, Bearer JWT, 401 → `auth_required`),
      DeFindex mock/live aynı arayüz + fabrika, klasik işlemler, kontrat XDR üretimi/gönderimi,
      route'lar, hata eşlemesi, canlı geçiş kapısı, **dağıtım duman testi**.
- [x] Web: **38/38** — API istemcisi (anchor JWT'sini tarayıcı tutar, şeffaf SEP-10 tekrarı),
      biçimlendirme, akışlar, bileşenler.
- [x] **Uçtan uca (8.5): testnet'te bugün 2 kez geçti (~80-84 sn)** — `pnpm test:e2e`, durumsuz
      tasarımdan sonra da yeşil. Taze üye: add_member → trustline → 1500 TL yatır → USDC → pay →
      kasaya kilitle → eşik üstü talep → 2 onay → execute → pay bozdur → memo'lu ödeme → `completed`.
- [x] **Tam yığın Vercel'de yayında:** https://stellar-kasa.vercel.app — web + API + mock anchor
      tek origin. `pnpm test:deploy` yeşil: TOML uçları dağıtımı gösteriyor, SEP-10 sequence 0,
      `/api/vault` testnet'ten 4 üyeli snapshot, istemci paketinde `localhost` kalıntısı yok.
      **Not:** bu doğrulama durumsuz düzeltmeden ÖNCEKİ sürüme aittir (aşağıya bak).
- [x] `pnpm typecheck` temiz.

## Kırık / eksik
- [ ] **Durumsuz düzeltme henüz dağıtılmadı.** Üretim dağıtımı için izin gerekti; commit
      `f061a20` yerelde tam yeşil ama canlı URL hâlâ eski (durumlu) sürümü sunuyor.
      Dağıtımdan sonra ilk iş: `pnpm test:deploy` + oturum yoklaması (devir notundaki ölçüm).
- [ ] Web tarayıcıda **elle** tıklanarak denenmedi (kullanılabilir tarayıcı oturumu yok).
- [ ] Cüzdan kiti (Freighter vb.) gerçek eklentiyle denenmedi.
- [ ] `pnpm test:live` gerçek uçlara karşı çalıştırılmadı; `.env.live` değerleri etkinlik günü gelecek.
- [ ] Canlı `getVaultInfo` pay fiyatı vermez → web bakiye/pay oranından türetir; canlıda doğrulanacak.

## Test durumu
- Kontrat **30/30** · Core **49/49** · Scripts **13/13** · Mock anchor **22/22** · API **93/93** · Web **38/38**
- Toplam **245/245 yeşil** · Uçtan uca **1/1** (bugün testnet'te iki kez) · `pnpm typecheck` temiz

## Ortam
- node 24.19 · pnpm 11.22 · stellar CLI 28 · rustc 1.98 GNU · TypeScript 5.9
- `.env.simulation` dolu; `KASA_DEPLOY_URL` eklendi. Secret'lar loga yazılmadı.
- Vercel: proje `stellar-kasa`, kök `apps/web`; API ve mock anchor aynı Next route handler'ında
  (`apps/web/src/app/api/[[...route]]/route.ts` → `@kasa/api/vercel`).

## Sıradaki iş (öncelik sırasıyla)
1. **Durumsuz sürümü dağıt** (üretim dağıtımı izni gerekiyor), sonra `pnpm test:deploy` ve
   oturum yoklamasını tekrarla: SEP-10 sonrası deposit 200 dönmeli, sıralı yoklamalar aktif kalmalı.
2. Tarayıcı bağlantısı sağlanınca https://stellar-kasa.vercel.app/giris üzerinden akışı elle dene.
3. Etkinlik Faz 0: `docs/faz0-canli-gecis.md` adım adım uygulanır → GO/NO-GO raporu.
4. Demo paketi: README güncel, sunum, video.

## Tuzaklar / öğrenilenler
- **Serverless'ta bellekteki her şey kaybolur.** Ölçüm (17 Eylül): SEP-10'dan hemen sonraki
  deposit isteği 401; 12 eşzamanlı oturum yoklamasının 4'ü, 5 sıralı yoklamanın 0'ı aktif.
  Yerel `pnpm dev` tek süreç olduğu için bunu ASLA göstermez — dağıtımda ölç.
- Oturum/işlem durumu için üç yer var: tarayıcı (JWT, işlem kimliği, ödeme hash'i),
  imzalı kimliğin içi (tutar, hesap, memo, zaman) ve zincir (ödeme yapıldı mı). Sunucu belleği yok.
- Stellar metin memo'su 28 bayt: ödeme etiketi kimliğin imzasından kısaltılarak üretilir.
- `pnpm test:deploy` yalnız 200 kontrolü değil; dağıtılmış JS paketini indirip API adresini
  denetler. HTTP smoke testi bunu yakalamaz.
- **RPC `scValToNative` birim enum'u `["Pending"]` dizisi verir**, CLI JSON `"Pending"` verir; core ikisini de kabul eder.
- **Turbopack `./x.js` uzantılı TS import'unu çözmüyor** → core içi import'lar uzantısız.
- **TS 5.9+ `baseUrl` kullanımdan kalktı**; `paths` tsconfig'e göreli çalışır.
- stellar-sdk v17: `DecoratedSignature.signature` metot değil **alan**.
- jsdom ortamında XDR kodlama Buffer realm'i yüzünden bozulur → imza testleri `@vitest-environment node`.
- pnpm 11 onaylanmamış build script'lerini hata sayar → `allowBuilds` ile açıkça reddet.
- Mock DeFindex payı klasik varlık olduğu için trustline ister; gerçek dfToken Soroban token'ıdır, istemez.
- DeFindex SDK gerçek tipleri: `getVaultAPY → {apy:number}`, `xdr: string|null`, tutarlar `number[]`.
- Bu makinede `make` yok; PowerShell ilkesi `pnpm.ps1` dosyasını engelliyor. `pnpm.cmd` kullan.
- MinGW/Windows: `pnpm test:contract` kullan, `--lib`.
