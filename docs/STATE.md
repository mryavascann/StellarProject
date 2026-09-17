# PROJE DURUMU

Son güncelleme: 2026-09-18 00:20 · Ajan: claude-durumsuz-dagitim · Mod: **simulation**

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
- [x] **Durumsuz düzeltme yayında ve ölçümle doğrulandı** (23:05, commit `ad1bbf5`):
      SEP-10 token'ından hemen sonra deposit **200** (önce 401) · 12 eşzamanlı durum sorgusu **12/12**
      (önce 4/12) · 1 sn arayla 5 sıralı sorgu **5/5** (önce 0/5) · withdraw memo'su `memo_type: id` ile geliyor.
      Son durum `pending_trust`: trustline yoksa anchor ödemeyi yapmıyor — A.4 davranışı korunuyor.
- [x] **Tarayıcıda bulunan iki hata düzeltildi ve yayında** (23:18):
      zincirde olmayan hesap için `/api/defindex/overview` artık `shares: 0` ile **200** dönüyor
      (önce 503 → ana ekran komple düşüyordu); getiri özeti ayrıca en-iyi-çaba oldu.
      LOBSTR cüzdan listesinden çıkarıldı: modülü `networkPassphrase`'i yok sayıyor, testnet'te imzalatılamıyor.
- [x] **Kullanıcı canlıda tam akışı denedi ve çalıştı** (yatır → getiri → kasaya kilitle).
      Çıkan iki pürüz düzeltildi: banka ekranı popup'ı artık **tıklama anında** açılıyor
      (engellenirse ne yapılacağını söylüyor), zincirde olmayan hesap net mesaj alıyor.
- [x] **Davetle katılma** (K-016): `POST /api/vault/join` → hesabı friendbot ile açar,
      `add_member`'ı sunucudaki admin anahtarıyla imzalar. Web'de "Kasaya katıl" kartı.
      Canlıda uç çalışıyor ve `ADMIN_SECRET` tanımlı olmadığını **açıkça söylüyor**.
- [x] **Arayüz shadcn/ui (Base UI) üzerine taşındı** (K-017): 12 bileşen `apps/web/src/components/ui/`,
      görsel token'lar `globals.css` `@theme` bloğunda, yazılı kaynak `apps/web/brand.md`.
      Tüm tutarlar tek `formatTRY()` helper'ından geçiyor (Intl + decimal.js, float yok).
- [x] `pnpm typecheck` ve `pnpm --filter @kasa/web build` temiz.

## Kırık / eksik
- [ ] Web tarayıcıda elle denendi (kullanıcı tarafından); iki hata çıktı ve düzeltildi.
      Düzeltme sonrası akışın tamamı (yatır → talep → onay → çek) elle tekrar denenmeli.
- [ ] Cüzdan kiti gerçek eklentiyle denenmedi. LOBSTR testnet'te çalışmaz (listeden çıkarıldı);
      Freighter / xBull / Albedo / Rabet / Hana denenmeli.
- [ ] `pnpm test:live` gerçek uçlara karşı çalıştırılmadı; `.env.live` değerleri etkinlik günü gelecek.
- [ ] Canlı `getVaultInfo` pay fiyatı vermez → web bakiye/pay oranından türetir; canlıda doğrulanacak.

## Test durumu
- Kontrat **30/30** · Core **49/49** · Scripts **13/13** · Mock anchor **22/22** · API **104/104** · Web **48/48**
- Toplam **266/266 yeşil** · Uçtan uca **1/1** (bugün testnet'te iki kez) · `pnpm typecheck` temiz

## Ortam
- node 24.19 · pnpm 11.22 · stellar CLI 28 · rustc 1.98 GNU · TypeScript 5.9
- `.env.simulation` dolu; `KASA_DEPLOY_URL` eklendi. Secret'lar loga yazılmadı.
- Vercel projesi GitHub deposuna bağlı: `git push origin main` üretim dağıtımını tetikler.
- Vercel: proje `stellar-kasa`, kök `apps/web`; API ve mock anchor aynı Next route handler'ında
  (`apps/web/src/app/api/[[...route]]/route.ts` → `@kasa/api/vercel`).

## Sıradaki iş (öncelik sırasıyla)
0. **Karar bekliyor:** `ADMIN_SECRET` Vercel'e eklenecek mi? Eklenmeden "Kasaya katıl" çalışmaz
   (uç kapalı olduğunu söylüyor). Bedeli K-016'da yazılı: sunucu admin yetkisi kazanır.
1. https://stellar-kasa.vercel.app/giris → test hesabıyla gir, tam akışı elle dene
   (yatır → talep → onay → çek). Hata çıkarsa footer'daki "Geliştirici modu" kutusu ham hatayı gösterir.
2. Etkinlik Faz 0: `docs/faz0-canli-gecis.md` adım adım uygulanır → GO/NO-GO raporu.
3. Demo paketi: README güncel, sunum, video.

## Tuzaklar / öğrenilenler
- **Serverless'ta bellekteki her şey kaybolur.** Ölçüm (17 Eylül): SEP-10'dan hemen sonraki
  deposit isteği 401; 12 eşzamanlı oturum yoklamasının 4'ü, 5 sıralı yoklamanın 0'ı aktif.
  Yerel `pnpm dev` tek süreç olduğu için bunu ASLA göstermez — dağıtımda ölç.
- Oturum/işlem durumu için üç yer var: tarayıcı (JWT, işlem kimliği, ödeme hash'i),
  imzalı kimliğin içi (tutar, hesap, memo, zaman) ve zincir (ödeme yapıldı mı). Sunucu belleği yok.
- Stellar metin memo'su 28 bayt: ödeme etiketi kimliğin imzasından kısaltılarak üretilir.
- **Kişiye özel okuma, herkese ait ekranı düşürmemeli.** Zincirde olmayan hesap hata değil,
  sıfır bakiyedir; `Promise.all` içindeki isteğe bağlı çağrı tüm ekranı kırıyordu.
- LOBSTR modülü `networkPassphrase`'i kaynak kodunda atlıyor → testnet imzası mümkün değil.
- **Popup yalnız tıklama anında açılır.** Ağ çağrılarından sonra `window.open` çağırmak
  tarayıcıda engellenir; pencere boş açılıp adres sonradan yollanmalı.
- shadcn kurulumu artık `-b base|radix|aria` bayrağıyla primitive seçtiriyor ve preset soruyor
  (`-p nova`); `form` bileşeni kayıttan kalkmış, yerine `field` var.
- Tailwind 4'te semantik adların çalışması için `@theme inline` eşlemesi şart; onu silersen
  bileşenler stilsiz kalır (build hata vermez, sessizce bozulur).
- Stellar'da hesabın var olması için minimum XLM gerekir; testnet'te friendbot açar.
  Kasaya para yatırmak ayrıca **üyelik** ister (kontrat üye olmayanı reddeder).
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
