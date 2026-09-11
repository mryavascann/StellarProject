# Devir notu · 2026-09-11 16:55 · testnet deploy

Mod: simulation · Faz: S3 başlangıcı

## Ne yaptım
- `deploy-mock-token.ts` + `.sh` yazıldı: builtin SAC `kUSDC` deploy, trustline ve hedef bakiye.
- Script idempotent bakiye kuruyor: mevcut bakiye hedeften azsa yalnızca farkı gönderiyor.
- `deploy.ts` + `.sh` yazıldı: Wasm deploy → `init` → üç `add_member`.
- Contract ID yalnızca tüm ağ işlemleri başarılı olunca `.env.simulation` içine yazılıyor.
- Simülasyon config'ine `mockShareBalancePerMember: "1000.0000000"` (`⚠ SİM`) eklendi.

## Test / zincir kanıtı
- Script testleri 9/9; core 38/38; kontrat 30/30 → toplam **77/77**.
- Mock dfToken: `CAAYBD6KZBCKTIIN7EAHIGH725UTMGJHTHLZWAQK5KODOEULGYC6WNLF`.
- SharedVault: `CDJ5OBFXZB6NLG3MJDL7MV4HK4FAS7SCM62KCLUCO5GD7IICHKVIE656`.
- SAC ID, `Asset.contractId(Networks.TESTNET)` ile birebir eşleşti.
- Horizon: dört üyenin bakiyesi 4/4 × `1000.0000000` kUSDC.
- On-chain: `get_members` 4 kayıt; kasa ve token(vault) bakiyesi başlangıçta 0.

## Yapmadım / sonraki iş
- `seed.ts` henüz yok; demo katkıları ve talepleri zincire yazılmadı.
- Sonraki iş seed'i test-first yazmak, sonra mock-anchor'a geçmek.
- Web ilk çalışabilir hâle geldiğinde ilk iş local sunucuyu açıp kullanıcıya göster (açık talep).
- Secret'lar yalnız `.env.simulation` içinde ve ignore; hiçbir rapora/loga alma.

## Değişen dosyalar
`scripts/{deploy-mock-token.ts,deploy-mock-token.test.ts,deploy-mock-token.sh}`
`scripts/{deploy.ts,deploy.test.ts,deploy.sh}` · `config/simulation.ts` · `package.json`
`docs/STATE.md` · bu devir notu
