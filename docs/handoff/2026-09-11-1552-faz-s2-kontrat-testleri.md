# Devir notu · 2026-09-11 15:52 · faz-s2-kontrat-testleri

Mod: simulation · Faz: S2 (yarıda kesildi — kullanıcı devri istedi)

## Ne yaptım
- Faz S1 bitti: 9 skill okundu, `skills-used.md` / `brand.md` / `decisions.md` (K-001…K-010) /
  `architecture.md` / `README.md` / `STATE.md` yazıldı, Bölüm 6 iskeleti kuruldu,
  `config/simulation.ts` (A.2'nin tamamı, `⚠ SİM`) ve `config/live.ts` (sabitsiz) hazır.
- **Toolchain kuruldu** (kullanıcı onayıyla): rustc/cargo 1.98.1 **gnu** host, rustup 1.29.1,
  `wasm32v1-none` hedefi, stellar CLI 28.0.0 (winget, `Stellar.StellarCLI`).
  MSVC yoktu; ~2 GB'lık Build Tools yerine GNU toolchain seçildi. **Bu seçim şu an sorun çıkarıyor**
  (aşağıya bak) — bir sonraki ajan kararı yeniden verebilir.
- `soroban-sdk` sürümü crates.io'dan doğrulandı: max stable **27.0.6** → `"27"` doğru.
- **Faz S2 testleri yazıldı:** `contracts/shared-vault/src/test.rs` içinde Bölüm 8.1'in
  **30 testinin tamamı**, numaralı ve Türkçe isimli (`t01_…` … `t30_…`).
- Kontrat iskeleti: `types.rs` (Member, SpendRequest, RequestStatus, LedgerEntry, Config, 17 hata
  kodu), `storage.rs` (DataKey + TTL sabitleri), `policy.rs` (**gerçek**: `add_i128`, `sub_i128`,
  `add_u64`, `require_positive`, `is_below_threshold`, `has_quorum`), `lib.rs` (**imzalar var,
  gövdeler `todo!()`**).
- `packages/core` erken bitirildi (Rust beklerken): `money.ts` + `brand.ts`.

## Hangi testleri yazdım / geçirdim
- ✅ `packages/core` **38/38 yeşil** — money 25, brand 13. Hepsi önce kırmızı yazıldı, sonra
  implementasyon geldi (kural 0.2'ye uyuldu, kırmızı çıktılar oturumda görüldü).
- ✅ `pnpm typecheck` temiz.
- 🔴 **Kontratın 30 testi YAZILDI ama HİÇ KOŞMADI** — `cargo test` linker'da patlıyor.
  30/30 "kırmızı" bile diyemem; derleme link aşamasını geçemedi.

## Ne yapmadım ve neden
- **Kontrat gövdelerini yazmadım.** Testlerin kırmızı koştuğunu göremeden implementasyona
  geçmek kural 0.2'nin ihlali olurdu.
- **Commit atmadım.** Testler yeşil değil.
- **Linker sorununu çözmedim** — kullanıcı tam o noktada devri istedi.

## Bir sonraki ajana uyarı
1. 🔴 **İLK İŞ: linker.** `cargo test` şunu veriyor:
   `ld: cannot find C:\Users\Buğra\.rustup\...\libcore-….rlib: No such file or directory`
   Dosyalar yerinde. **Hipotezim: MinGW `ld` yoldaki `ğ` karakterini çözemiyor.**
   Kanıtlanmadı — önce `cargo new C:\temp\linktest && cargo build …` ile ASCII yolda doğrula.
   Seçenekler (ucuzdan pahalıya): (a) 8.3 kısa yol `C:\Users\BURA~1\…` ile `RUSTUP_HOME`/
   `CARGO_HOME`, (b) toolchain'i `C:\rust`'a + projeyi `C:\dev\kasa`'ya taşı, (c) MSVC Build
   Tools kur ve `stable-x86_64-pc-windows-msvc`'ye geç. Kararı **K-011** olarak yaz.
2. **PATH:** `stellar` Machine PATH'te, `cargo` User PATH'te — bu oturumun kabuğunda görünmüyordu,
   yeni terminal açınca gelir. Komut başına: `$env:PATH = "$env:USERPROFILE\.cargo\bin;${env:ProgramFiles(x86)}\Stellar CLI;$env:PATH"`.
3. **`test.rs` API'lerini doğrula.** Hiç derlenmediler; şunlar kâğıt üzerinde:
   `env.register_stellar_asset_contract_v2(admin)`, `env.register(SharedVault, ())`,
   `env.set_auths(&[])`, `storage().instance().get_ttl()`, `try_*` dönüş tipi
   `Err(Ok(Error::X))`. SDK 27'de isim değiştiyse **testi değil imzayı düzelt**, testin iddiasını
   zayıflatma.
4. **Bölüm 7.2'ye iki okuma fonksiyonu eklendi:** `get_request(id)` ve `get_member(addr)`.
   Testler bunları kullanıyor. Salt-okunur, kapsamı genişletmiyor.
5. **Test 22 (`i128` taşması)** zincir üzerinden değil, `policy::add_i128` üzerinden sınanıyor —
   token arzını `i128::MAX`'a taşımak gerekirdi. Kontrattaki **her** toplama bu yardımcıdan
   geçmeli, yoksa test yalan söyler.
6. **K-004 hâlâ açık:** `deposit()` `transfer` mi `transfer_from` mu kullanacak. Eğilim `transfer`
   (tek imza). Testle kapat, tahminle değil.
7. Türkçe metinleri test dosyasına elle yazma — `packages/core/src/brand.ts` tek kaynak (K-010).
8. `emergency_exit` imzası `(member) -> i128`: net katkı kadar (`contributed - withdrawn`) çeker,
   tükendiyse `ExceedsContribution`. Test 28 bunu bekliyor.

## Değişen dosyalar
`docs/{skills-used,brand,decisions,architecture,STATE}.md` · `docs/handoff/*` · `README.md`
`config/{simulation,live}.ts` · `Makefile` · `package.json` · `pnpm-workspace.yaml` · `tsconfig.json`
`.env.example` · `.gitignore`
`packages/core/{package.json, src/money.ts, src/money.test.ts, src/brand.ts, src/brand.test.ts}`
`contracts/shared-vault/{Cargo.toml, src/lib.rs, src/types.rs, src/storage.rs, src/policy.rs, src/test.rs}`
