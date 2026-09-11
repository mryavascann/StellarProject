# Devir notu · 2026-09-11 16:15 · Faz S2 kontrat ve hesaplar

Mod: simulation · Faz: S2 deploy hazırlığı

## Ne yaptım
- GNU linker sorununun Unicode yoldan geldiğini kanıtladım; `C:\rust` ASCII toolchain kuruldu.
- `scripts/run-cargo.mjs` ile Windows test/build taşınabilir hâle geldi; K-011 yazıldı.
- Önceden yazılmış 30 testi gerçekten kırmızı koştum (1 geçti, 29 `todo!()` nedeniyle kırmızı).
- `shared_vault` tamamlandı: auth, üyeler, deposit, talepler, quorum, execute, cancel,
  emergency exit, okuma API'leri, persistent defter ve TTL.
- K-004 testle kapandı: deposit tek işlemde SEP-41 `transfer` kullanıyor.
- `lib.rs` 280, `storage.rs` 284 satır; 300 satır sınırı korunuyor.
- Para formatında TypeScript/Intl tip açığı giderildi; Decimal metni hassasiyetsiz dönüştürülmüyor.
- `gen-accounts.ts` yazıldı; `.env.simulation` oluşturuldu, 5/5 zincir hesabı fonlandı.

## Testler / kanıt
- `pnpm test`: 3 script + 38 core + 30 kontrat = **71/71 yeşil**.
- `pnpm typecheck` temiz; `cargo fmt --check` temiz.
- `pnpm build:contract` yeşil; release Wasm **26.992 bayt**.
- Horizon sorgusu: admin + 3 üye + issuer hesaplarının **5/5'i mevcut**.

## Yapmadım / sonraki ajan
- Mock dfToken ve kasa henüz testnet'e deploy edilmedi; env'deki iki contract ID boş.
- İlk iş test-first deploy-mock-token akışı. Classic `kUSDC` SAC veya örnek token seçimini
  testnet davranışıyla kanıtla; adres/issuer uydurma.
- `.env.simulation` secret içerir ve ignore edilir; içeriğini asla rapora/loga basma.
- PowerShell'de `pnpm.ps1` policy engeli var; otomasyonda `pnpm.cmd` kullan.

## Değişen ana dosyalar
`contracts/shared-vault/src/{lib,storage,test}.rs` · `packages/core/src/money.ts`
`scripts/{run-cargo.mjs,gen-accounts.ts,gen-accounts.test.ts}` · `package.json`
`docs/{STATE,decisions}.md` · bu devir notu
