# Devir notu · 2026-09-11 15:37 · bootstrap-iskelet

Mod: simulation · Faz: S1

## Ne yaptım
- Bölüm 16 adım 1–6 uygulandı. Repo tamamen boştu (`.gitattributes` + 1 commit).
- 9 skill dosyası okundu → `docs/skills-used.md` (her biri "hangi kararı etkiledi" ile).
- `docs/brand.md`, `docs/decisions.md` (K-001…K-010), `docs/architecture.md` (taslak), `docs/STATE.md`.
- Bölüm 6 klasör iskeleti kuruldu (fazlası yok, eksiği yok).
- `config/simulation.ts` (A.2'nin tamamı, her simüle satırda `⚠ SİM`) + `config/live.ts` (sabitsiz).
- `Makefile`, `package.json` script köprüsü, `pnpm-workspace.yaml`, `tsconfig.json`,
  `.env.example`, `.gitignore`, `README.md`.
- `pnpm install` + `pnpm typecheck` → **temiz geçti** (tek gerçek doğrulama bu).

## Hangi testleri yazdım/geçirdim
**Hiçbiri.** Bu fazda üretilen tek çalıştırılabilir şey `config/*.ts`; onun da doğrulaması
`tsc --noEmit`. Test listesi Faz S2'de (Bölüm 8.1, 30 test) başlıyor.

## Ne yapmadım ve neden
- **Kontrat yazmadım.** Bölüm 16 adım 7: önce 30 test, sonra kontrat. Ama `cargo`/`rustc`/
  `stellar` CLI makinede **kurulu değil** — test bile koşturulamaz.
- **Rust/Stellar CLI kurmadım.** Kullanıcının makinesine kurulum yapan, geri alması zahmetli
  bir iş; açık onay bekliyor. Soruldu, henüz cevap gelmedi.
- **Hesap üretmedim, hiçbir şey deploy etmedim.** Dolayısıyla repoda tek bir Stellar adresi
  veya contract id yok — uydurulmuş değer yok.
- **Commit atmadım.** Kural 0.2: testler yeşil olmadan commit yok; ortada test yok.

## Bir sonraki ajana uyarı
1. **STATE.md'nin "Çalışan" listesi TESTLE kanıtlanmış değil**, yazılmış ve gözle doğrulanmış.
   Tek kanıtlı satır: `pnpm typecheck` temiz.
2. Rust kurulmadan S2'ye girme. Kurulunca `rustup target add wasm32v1-none` ŞART (K-008).
3. `make test:live` gibi iki noktalı hedefler Makefile'da `%` yakalayıcı kuralla çalışıyor;
   açık hedef olarak yazmaya kalkma, Make bozulur.
4. `config/simulation.ts`'in `KasaRuntimeConfig`'i (live.ts) karşıladığı **doğrulanmadı**.
   API kurulurken `satisfies` + davranış testiyle kapat.
5. Türkçe metinleri test dosyasına elle yazma — `packages/core/src/brand.ts` tek kaynak (K-010).
6. K-004 (`deposit()` `transfer` mi `transfer_from` mu) **açık**; tahminle değil testle kapanacak.

## Değişen dosyalar
`docs/{skills-used,brand,decisions,architecture,STATE}.md` · `docs/handoff/2026-09-11-1537-bootstrap-iskelet.md`
`config/{simulation,live}.ts` · `Makefile` · `package.json` · `pnpm-workspace.yaml` · `tsconfig.json`
`.env.example` · `.gitignore` · `README.md` · (boş klasörler: contracts, packages, apps, scripts)
