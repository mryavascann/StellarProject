# PROJE DURUMU

Son güncelleme: 2026-09-11 17:09 · Ajan: codex-integration-04 · Mod: **simulation**

## Faz
Şu an: **Faz S3 (entegrasyon)** — S2 kontrat, token ve testnet deploy tamamlandı.
Tamamlanan: Faz S1 · Faz S2 · S3 seed ve ortak core katmanı.

## Çalışan (test edilmiş, kanıtlı)
- [x] `shared_vault`: **30/30 test yeşil**; yetki, onay, execute, sınır, durum ve TTL kapsamı.
- [x] Release Wasm: `contracts/shared-vault/target/wasm32v1-none/release/shared_vault.wasm` (26.992 bayt).
- [x] `packages/core`: **44/44 test yeşil**; money, brand, Stellar adresleri ve kontrat yanıtları.
- [x] `scripts/gen-accounts.ts`: **3/3 test yeşil**; 6 keypair üretir, 5 zincir hesabını fonlar.
- [x] Deploy scriptleri: **6/6 test yeşil**; eksik env/geçersiz ID/ağ hatası güvenli biçimde durur.
- [x] `.env.simulation` üretildi; 5/5 hesap Horizon testnet'te fonlu doğrulandı, git tarafından yok sayılıyor.
- [x] Mock dfToken testnet'te: `CAAYBD6KZBCKTIIN7EAHIGH725UTMGJHTHLZWAQK5KODOEULGYC6WNLF`.
- [x] Dört üyenin kUSDC bakiyesi Horizon'da **4/4 × 1000.0000000** doğrulandı.
- [x] SharedVault testnet'te: `CDJ5OBFXZB6NLG3MJDL7MV4HK4FAS7SCM62KCLUCO5GD7IICHKVIE656`.
- [x] On-chain `get_members`: 4 üye; `get_balance`: 0; token `balance(vault)`: 0.
- [x] `scripts/seed.ts`: **4/4 test yeşil**, yeniden çalıştırılabilir; testnet demo verisi yazıldı.
- [x] On-chain seed: katkılar 50/50/30/30 pay, kasa 160 pay; talepler Pending(1 onay) + Approved.
- [x] Mock anchor ilk dilim: **9/9 test yeşil**; SEP-1/10/24/38, JWT, popup ve durum akışı.
- [x] Mock anchor yerelde `:8788` üzerinde gerçek HTTP çağrısıyla doğrulandı; doğrulama sonrası kapatıldı.
- [x] `pnpm typecheck` ve `cargo fmt --check` temiz.
- [x] Windows Unicode linker çözümü: minimal GNU toolchain `C:\rust`, `scripts/run-cargo.mjs`.

## Kırık / eksik
- [ ] `apps/api` ve `apps/web` henüz boş.
- [ ] Mock anchor'da yanlış memo ödeme eşleştirme davranışı ve API karşılıklı testleri eksik.

## Test durumu
- Kontrat: **30/30** · Core: **44/44** · Script: **13/13** · Mock anchor: **9/9** · Toplam: **96/96 yeşil**
- API: 0 · Web: 0 · Uçtan uca: 0/1

## Ortam
- node 24.19 · pnpm 11.22 · stellar CLI 28.0.0 · rustc/cargo 1.98.1 GNU
- `wasm32v1-none` ve rustfmt kurulu; ASCII toolchain: `C:\rust\rustup`
- `.env.simulation` dolu mu: **evet**; secret'lar konsola/loga yazılmadı.
- Üretilmiş contract ID'ler: mock dfToken ve SharedVault yukarıdaki testnet kayıtları.

## Sıradaki iş (öncelik sırasıyla)
1. Mock anchor yanlış memo/ödeme eşleştirme davranışını test-first tamamla.
2. API anchor ve DeFindex adaptörleri; mod kontrolü yalnızca iki fabrika dosyasında.
3. Web → testnet uçtan uca test.
4. **Kullanıcı talebi:** Web ilk çalışabilir hâle geldiği anda ciladan önce local sunucuyu başlat,
   tarayıcıdan doğrula ve erişim adresini paylaş.

## Tuzaklar / öğrenilenler
- MinGW uzun Unicode yolu okuyamıyor; doğrudan `cargo` yerine `pnpm test:contract` kullan.
- Native Windows testte `--lib` gerekli; aksi hâlde PE `cdylib` export ordinal sınırı aşılabiliyor.
- SDK 27 TTL testi için `testutils::storage::Instance` trait'i scope'ta olmalı.
- `extend_ttl` yalnızca eşik altındayken uzatır; test zamanı 100.000 ledger eşiğinin altına indirmeli.
- Workspace paketi çalışırken CWD paket dizinidir; kök env yolu `import.meta.url` üzerinden çözülmeli.
