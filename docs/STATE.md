# PROJE DURUMU

Son güncelleme: 2026-09-17 21:27 · Ajan: codex-live-gate · Mod: **simulation**

## Faz
Şu an: **Faz S3 tamamlandı** — simülasyonda tam döngü testnet'te çalışıyor.
Tamamlanan: Faz S1 · S2 · S3. Sıradaki: etkinlik günü Faz 0 (A.5 listesi, `KASA_MODE=live`).

## Çalışan (test edilmiş, kanıtlı)
- [x] `shared_vault` testnet'te: `CDJ5OBFXZB6NLG3MJDL7MV4HK4FAS7SCM62KCLUCO5GD7IICHKVIE656` — **30/30**.
- [x] Mock dfToken (kUSDC SAC): `CAAYBD6KZBCKTIIN7EAHIGH725UTMGJHTHLZWAQK5KODOEULGYC6WNLF`.
- [x] `packages/core`: **49/49** (para, marka, adres, kontrat yanıtları — RPC `["Pending"]` enum biçimi dahil, defter ayrıştırıcı).
- [x] Scripts: **13/13** (gen-accounts, deploy-mock-token, deploy, seed).
- [x] Mock anchor: **13/13** — SEP-1/10/24/38, JWT 15 dk, quote 90 sn, popup DENY,
      **deposit tamamlanınca gerçek USDC ödemesi (trustline yoksa `pending_trust`)**,
      **withdraw ödemesi Horizon'dan doğrulanır, yanlış memo → `pending_external` askıda**.
- [x] API: **84/84** — anchor istemcisi (mod sınırı, JWT oturumu, 401 → `auth_required`),
      DeFindex mock/live aynı arayüz + fabrika, klasik işlemler (trustline, memo'lu ödeme),
      kontrat XDR üretimi/gönderimi, route'lar, hata eşlemesi ve canlı geçiş kapısı.
- [x] `pnpm test:live`: gerçek anchor TOML + `/info` + SEP-10 sequence 0 ve gerçek DeFindex
      vault/APY kontrolünü çalıştıracak şekilde hazır; yanlış env/TOML eşleşmesinde duruyor.
- [x] Web: **34/34** — API istemcisi (şeffaf SEP-10 tekrarı), biçimlendirme, akışlar, bileşenler.
- [x] **Uçtan uca (8.5): testnet'te 2 kez geçti (~85 sn)** — `pnpm test:e2e`. Taze üye: add_member →
      trustline → 1500 TL yatır → USDC (zincir) → pay (zincir) → kasaya kilitle → eşik üstü talep →
      2 onay → execute → pay bozdur → memo'lu ödeme → `completed` → remove_member; kasa bakiyesi başa döner.
- [x] Yerel sunucular çalıştı ve tarayıcı/curl ile doğrulandı: web `:3000` (6 sayfa 200),
      API `:8787` (testnet'ten `Moda Ev Kasası` snapshot'ı), mock anchor `:8788`.
- [x] `pnpm typecheck` temiz (web dahil, `baseUrl` kaldırıldı).

## Kırık / eksik
- [ ] Web tarayıcıda **elle** tıklanarak denenmedi. 17 Eylül denemesinde üç sunucu açıldı fakat
      kullanılabilir in-app/harici tarayıcı oturumu bulunamadı; bağlantı gelince test hesabıyla akış izlenecek.
- [ ] Cüzdan kiti (Freighter vb.) gerçek eklentiyle denenmedi; kod d.ts'e göre yazıldı.
- [ ] `pnpm test:live` gerçek uçlara karşı çalıştırılmadı; etkinlik günü verilecek `.env.live` değerleri henüz yok.
- [ ] Canlı `getVaultInfo` pay fiyatı vermez → web bakiye/pay oranından türetir; canlıda doğrulanacak.
- [ ] Bu görevdeki canlı kontrol ve doküman değişiklikleri commit edilmedi.

## Test durumu
- Kontrat **30/30** · Core **49/49** · Scripts **13/13** · Mock anchor **13/13** · API **84/84** · Web **34/34**
- Toplam **223/223 yeşil** · Uçtan uca **1/1** (önceki testnet kanıtı; bu görevde tekrar koşulmadı)
- `pnpm typecheck` temiz · Next.js üretim derlemesi temiz (7 statik rota)

## Ortam
- node 24.19 · pnpm 11.22 · stellar CLI 28 · rustc 1.98 GNU · TypeScript 5.9
- Yeni paketler: `@defindex/sdk@0.3.0` (api), `next@16.3.5`, `react@19.3`, `tailwindcss@4.3`,
  `@creit.tech/stellar-wallets-kit@2.6.0`, `jsdom`, `@testing-library/react` (web)
- `.env.simulation` dolu; secret'lar loga yazılmadı. Mock USDC = kUSDC ile aynı ihraççı.
- pnpm-workspace `allowBuilds`: appkit/bufferutil/secp256k1/utf-8-validate açıkça `false`.

## Sıradaki iş (öncelik sırasıyla)
1. Tarayıcı bağlantısı sağlanınca web'i elle dene (`pnpm dev` → http://localhost:3000/giris, test hesabı).
2. Etkinlik Faz 0: A.5 listesi → `.env.live`, `KASA_MODE=live` → `pnpm test:live`.
3. Canlı kontrolden sonra GO/NO-GO raporu; ardından gerçek uçtan uca akış.
4. Demo senaryosu (Bölüm 14): QR/davet linki, sunum, video.

## Tuzaklar / öğrenilenler
- **RPC `scValToNative` birim enum'u `["Pending"]` dizisi verir**, CLI JSON `"Pending"` verir; core ikisini de kabul eder.
- **Turbopack `./x.js` uzantılı TS import'unu çözmüyor** → core içi import'lar uzantısız.
- **TS 5.9+ `baseUrl` kullanımdan kalktı**; `paths` tsconfig'e göreli çalışır.
- stellar-sdk v17: `DecoratedSignature.signature` metot değil **alan**.
- `@vitejs/plugin-react@6` vite 6 ister; vitest 2 (vite 5) ile `esbuild.jsx: "automatic"` yeter.
- jsdom ortamında XDR kodlama Buffer realm'i yüzünden bozulur → imza testleri `@vitest-environment node`.
- pnpm 11 onaylanmamış build script'lerini `pnpm test` öncesi kurulumda hata sayar → `allowBuilds` ile açıkça reddet.
- Mock DeFindex payı klasik varlık olduğu için trustline ister; gerçek dfToken Soroban token'ıdır, istemez. Mock aynı işlemde `changeTrust` ekler.
- DeFindex SDK gerçek tipleri: `getVaultAPY → {apy:number}`, `xdr: string|null`, tutarlar `number[]` (skill dokümanından farklı).
- E2E her koşuda friendbot'tan yeni hesap alır ve ~10 USDC'yi o hesapta bırakır (önemsiz).
- MinGW/Windows notları önceki STATE'ten geçerli: `pnpm test:contract` kullan, `--lib`.
- Bu makinede `make` yok; PowerShell ilkesi `pnpm.ps1` dosyasını engelliyor. `pnpm.cmd` kullan.
- Browser eklentisi/oturumu bağlı değilse elle UI testi yapılamıyor; HTTP smoke veya kaynak incelemesi bunun yerine geçmez.
