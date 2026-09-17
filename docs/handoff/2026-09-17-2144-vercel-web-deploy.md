# Devir — Vercel web dağıtımı

Tarih: 2026-09-17 21:44 · Ajan: codex-vercel-deploy · Mod: simulation

## Ne yaptım
- Vercel'de `stellar-kasa` projesi oluşturuldu ve monorepo kökü `apps/web` seçildi.
- Next.js 16 üretim derlemesi Vercel'de başarıyla tamamlandı; 7 statik rota üretildi.
- Kalıcı URL: https://stellar-kasa.vercel.app
- Proje SSO koruması kapatıldı; `/giris` dış ağdan HTTP 200 doğrulandı.
- `.vercelignore` eklendi; ilk 834 MB paket 1,9 MB kaynak yüklemesine indirildi.
- README ve STATE canlı URL ile güncellendi.

## Kanıt
- Vercel deployment: `dpl_2R5EeVMCtSE3GciHntxjggQredq7` · READY · production.
- `curl -I https://stellar-kasa.vercel.app/giris`: HTTP 200, `Server: Vercel`.
- Vercel build: Next.js compile + TypeScript + 8/8 static page üretimi başarılı.

## Açık iş
- Yalnız web yayınlandı; API/mock-anchor yerel olduğu için işlem akışları uzakta henüz çalışmaz.
- API dağıtıldıktan sonra Vercel'e `NEXT_PUBLIC_KASA_API_URL` eklenip yeniden deploy edilmeli.
- Bağlı tarayıcı oturumu olmadığı için görsel/tıklamalı manuel test yapılmadı.

## Değişen dosyalar
`.gitignore`, `.vercelignore`, `README.md`, `docs/STATE.md`,
`docs/handoff/2026-09-17-2144-vercel-web-deploy.md`
