# Devir — shadcn/ui (Base UI) tasarım sistemi

Tarih: 2026-09-18 00:20 · Ajan: claude-tasarim-sistemi · Mod: simulation

## Ne yaptım
- `apps/web` içine shadcn/ui kuruldu: `init -b base -p nova --no-monorepo`.
  Base UI bayrağı ezberden değil, CLI'ın kendi `--help` çıktısından doğrulandı (`base, radix, aria`).
- `components.json` alias'ları web tsconfig'iyle eşleşiyor (`@/components`, `@/lib/utils` → `src/*`).
- Bileşenler: button, card, dialog, input, **field** (form yerine), table, tabs, badge, sonner,
  skeleton + field'ın zorunlu bağımlılıkları label, separator.
- `apps/web/brand.md` yazıldı; `docs/brand.md`'ye çapraz bağ kondu (K-017).
- Görsel token'lar `globals.css` `@theme` bloğuna taşındı; çalışma anında stil üreten
  `lib/theme.ts` silindi. Koyu tema hem sistem tercihi hem `data-theme` ile çalışıyor.
- `formatTRY()` eklendi (Intl v3'e **metin** verilir, decimal.js ile hesap, aşağı yuvarlama,
  tipografik eksi). `tl()` ona delege oldu; arayüzdeki tüm tutarlar tek noktadan geçiyor.
- Eski özel primitive'ler (Button/Card/.btn/.input) çağrı yerleriyle birlikte shadcn'e taşındı;
  ürüne özel bileşenler (StatusBadge, EmptyState, ErrorState, Steps, Skeleton) kaldı ve
  shadcn primitive'lerini kullanıyor. Sarmalayıcı yazılmadı; kopyalanan dosyalar düzenlendi.

## Kanıt
- `pnpm test`: **266/266 yeşil** (kontrat 30 · core 49 · scripts 13 · mock 22 · API 104 · web 48).
- `pnpm typecheck`: temiz. `pnpm --filter @kasa/web build`: 8 rota üretildi.
- Üretilen CSS'te `--primary: var(--color-kasa-accent)` ve `--background: var(--color-kasa-bg)`;
  yani bileşenler Kasa paletinden besleniyor, hex bileşen dosyalarında değil.

## Yapmadım / neden
- `form` bileşeni eklenmedi: güncel kayıtta yok, yerine `field` var (K-017'de yazılı).
- Grafik/data grid/tarih aralığı: kapsam dışı (istendiği gibi).
- `dialog`, `table`, `tabs`, `sonner` kuruldu ama henüz bir ekranda kullanılmıyor; hazır duruyorlar.
- Arayüz tarayıcıda gözle kontrol edilmedi; build + testler geçiyor.

## Bir sonraki ajana uyarı
- **Her UI değişikliğinden önce `apps/web/brand.md` okunacak.**
- Bileşen özelleştirmesi `src/components/ui/*` kopyalarının içinde yapılır.
- `globals.css`'teki `@theme inline` bloğunu silme: semantik sınıflar ona bağlı.
- Yeni tutar gösterimi `formatTRY()` üzerinden geçecek; ayrı `Intl` yazma.

## Değişen dosyalar
`apps/web/{brand.md,components.json,package.json}`, `apps/web/src/components/ui/*` (yeni),
`apps/web/src/components/{ui.tsx,Footer.tsx,JoinCard.tsx,RequestCard.tsx}`,
`apps/web/src/app/{layout.tsx,globals.css,page.tsx,cek,giris,talep,yatir}`,
`apps/web/src/lib/{format.ts,format.test.ts,utils.ts}`, `apps/web/src/lib/theme.ts` (silindi),
`docs/{STATE.md,decisions.md,brand.md}`, bu devir notu.
