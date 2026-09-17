# Devir — dağıtımda durum kaybı ve durumsuz tasarım

Tarih: 2026-09-17 22:55 · Ajan: claude-durumsuz-dagitim · Mod: simulation

## Ne yaptım
- Bootstrap: STATE, son iki handoff, kararlar okundu; `pnpm test` ile gerçek durum doğrulandı.
  STATE'in bilmediği iki commit çıktı (API + mock anchor Vercel'e taşınmış, çalışıyor).
- **Dağıtım duman testi** eklendi (`apps/api/src/deploy-check.ts`, `pnpm test:deploy`):
  TOML uçları dağıtımı gösteriyor mu, SEP-10 sequence 0 mı, `/api/vault` okunuyor mu,
  dağıtılmış istemci paketi `localhost:8787`'ye mi bakıyor. Önce 7 test kırmızı yazıldı.
- Duman testi geçti ama **serverless durum kaybı** bulundu ve ölçüldü (aşağıda).
- Kullanıcı "kodu durumsuz yap" seçeneğini onayladı. Uygulandı (K-015):
  - Anchor JWT'si tarayıcıda; API `Authorization: Bearer` ile alır, oturum tablosu kalktı.
  - `/api/anchor/session` ucu ve ölü `requestWithFreshJwt` yardımcısı kaldırıldı.
  - Mock anchor'ın SEP-24 işlem ve SEP-38 quote kimlikleri imzalı ve kendini anlatır (`ids.ts`).
  - Deposit ödemesinin tekliği zincirde: ödeme kendi etiketiyle gider, önce zincirde aranır.
  - Çekim eşleşmesi her sorguda zincirden doğrulanır; ödeme hash'ini tarayıcı taşır.
- `docs/faz0-canli-gecis.md`: A.5'in çalıştırılabilir kontrol listesi + `.env.live` şablonu.

## Kanıt
- Ölçüm (dağıtılmış eski sürüm, `stellar-kasa.vercel.app`): SEP-10 token 200 → hemen sonraki
  `POST /api/anchor/deposit` **401 auth_required**. 12 eşzamanlı oturum yoklaması → 4 aktif.
  1 sn arayla 5 sıralı yoklama → **0 aktif**.
- `pnpm test`: **245/245 yeşil** (kontrat 30 · core 49 · scripts 13 · mock 22 · API 93 · web 38).
- `pnpm typecheck`: temiz.
- `pnpm test:e2e`: testnet'te iki kez geçti (84 sn ve 80 sn) — ikincisi durumsuz tasarımla.
- Yeni regresyon testleri: iki ayrı mock anchor örneği aynı işlemi okuyor, aynı deposit'i
  iki kez ödemiyor, kurcalanmış kimlik 404.

## Yapmadım / neden
- **Dağıtmadım:** `vercel deploy --prod` izin sınıflandırıcısı tarafından reddedildi.
  Commit `f061a20` hazır ve yeşil; canlı URL hâlâ eski (durumlu) sürümü sunuyor.
  Önizleme dağıtımı da çözmüyor: `KASA_PUBLIC_ORIGIN`/`ANCHOR_HOME_DOMAIN` üretim
  domainine bağlı, önizleme URL'i önceden bilinmediği için uygulama açılışta durur.
- `git push` yapmadım: Vercel git-bağlantılıysa bu da dolaylı üretim dağıtımı olurdu.
- Elle tarayıcı akışı yine denenemedi (tarayıcı oturumu yok).
- `pnpm test:live` koşmadı; `.env.live` değerleri henüz yok (uydurulmadı).

## Bir sonraki ajana uyarı
- **İlk iş dağıtım.** Sonra `pnpm test:deploy` ve oturum yoklamasını tekrarla: SEP-10'dan
  sonraki deposit 200 dönmeli, sıralı yoklamalar oturumu aktif görmeli.
- Sunucuya durum ekleme. Oturum tarayıcıda, işlem verisi imzalı kimlikte, ödeme kanıtı zincirde.
- Yerel `pnpm dev` tek süreç olduğu için bu sınıf hatayı göstermez; dağıtımda ölç.
- Windows: `make` yok, `pnpm.ps1` engelli → `pnpm.cmd`.

## Değişen dosyalar
`apps/api/src/{deploy-check.ts,deploy-check.test.ts,e2e.test.ts,app.test.ts}`,
`apps/api/src/anchor/{client.ts,client.test.ts,sep24.ts,sep24.test.ts,types.ts}`,
`apps/api/src/routes/anchor.ts`, `apps/api/package.json`,
`apps/mock-anchor/src/{ids.ts,ids.test.ts,app.ts,app.test.ts,chain.ts,sep38.ts}`,
`apps/web/src/lib/{api.ts,api.test.ts,flows.ts}`, `package.json`, `.env.example`,
`docs/{STATE.md,decisions.md,faz0-canli-gecis.md}`, bu devir notu.
