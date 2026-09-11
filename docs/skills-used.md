# Kullanılan Skill Dosyaları

Bu dosya hackathon teslim paketinin zorunlu bir parçasıdır (Bölüm 4 / Bölüm 15).
Her satırda: skill'in yolu + projede **hangi kararı etkilediği**.

Okunma tarihi: 2026-09-11 · Mod: simulation

---

## Resmî Stellar skill'leri

### 1. `https://skills.stellar.org/`
**Ne:** Skill dizini. Resmî 8 skill + 30+ topluluk skill'inin yol haritası.
**Etkilediği karar:** Hangi skill'leri okuyacağımızı bu dizinden doğruladık. DeFindex SDK ve
anchor skill'lerinin topluluk listesinde yer aldığını teyit etti.
**Not:** Rust/Soroban SDK veya CLI sürüm numarası içermiyor — sürümler smart-contracts skill'inden alındı.

### 2. `https://skills.stellar.org/skills/smart-contracts/SKILL.md`
**Ne:** Rust/Soroban kontrat yazımı, test, güvenlik, deploy.
**Etkilediği kararlar:**
- `soroban-sdk = "27"` (protokol 27) → `contracts/shared-vault/Cargo.toml`
- Wasm hedefi **`wasm32v1-none`** — runtime'ın desteklediği tek hedef. Eski `wasm32-unknown-unknown` **kullanılmayacak**.
- `[profile.release]` → `opt-level = "z"`, `overflow-checks = true`, `lto = true`.
  `overflow-checks` Bölüm 8.1 test 22'nin (`i128` taşması) temeli.
- `crate-type = ["lib", "cdylib"]` — `lib` olmadan `test.rs` içinden kontrat çağrılamaz.
- Storage üç tip: Instance / Persistent / Temporary. `env.storage().instance().extend_ttl(threshold, extend_to)`
  → Bölüm 8.1 test 30 (TTL uzatması).
- `#[contracterror] #[repr(u32)]` + `Result<T, Error>` → panik değil hata döndürme (test 22).
- `require_auth()` → Bölüm 8.1 test 1–6 (yetkilendirme).
- CLI: `stellar contract build`, `stellar keys generate <ad> --network testnet --fund`,
  `stellar contract deploy --wasm target/wasm32v1-none/release/*.wasm --source-account <ad> --network testnet`
  → `scripts/deploy.sh` bu komutları kullanır.

### 3. `https://skills.stellar.org/skills/dapp/SKILL.md`
**Ne:** Frontend + cüzdan entegrasyonu.
**Etkilediği kararlar:**
- **Node 22 minimum** (`@stellar/stellar-sdk` v16+). Makinede Node 24.19 var — uygun.
- Yalnızca `@stellar/stellar-sdk` import edilecek; `@stellar/stellar-base` ile birlikte import
  `instanceof` kontrollerini kırıyor. → `packages/core/src/stellar.ts` tek giriş noktası olacak.
- Soroban işlemleri `rpc.Server`'a, klasik işlemler Horizon'a gider. Bölüm 5.3'teki
  "son adımı üye atar" kararı klasik ödeme → Horizon yolunu kullanır.
- `rpc.prepareTransaction()` → simülasyon + footprint/auth, sonra `rpc.sendTransaction()`,
  onay için `rpc.pollTransaction()` (elle döngü yazma).
- Cüzdan: `@creit-tech/stellar-wallets-kit` v2 **JSR** üzerinden dağıtılıyor ve tamamen statik
  (`StellarWalletsKit.init({ modules: defaultModules(), network })`, `authModal()`, `signTransaction(xdr)`).
  v1 npm'deki `@creit.tech/stellar-wallets-kit` — **nokta farkına dikkat**. Faz S3'te v2 kullanılacak.

### 4. `https://skills.stellar.org/skills/assets/SKILL.md`
**Ne:** Klasik varlıklar, SAC, SEP-41 token arayüzü.
**Etkilediği kararlar:**
- SEP-41 imzaları: `balance(id) -> i128`, `transfer(from, to, amount)`,
  `approve(from, spender, amount, expiration_ledger)`, `allowance(from, spender) -> i128`,
  `decimals() -> u32`, `name() -> String`, `symbol() -> Symbol`.
  → KARAR 1'in temeli: mock dfToken ile gerçek dfToken kontrat açısından aynı arayüz.
- `transfer_from` allowance gerektirir; `transfer` doğrudan `from`'un yetkisiyle çalışır.
  → `deposit()` içinde token çekme yöntemi buradan belirlenir (bkz. `docs/decisions.md` K-004).
- Klasik varlığın SAC adresi deterministik: `new Asset("USDC", issuer).contractId(Networks.TESTNET)`
  → mock USDC'nin contract id'si **uydurulmaz, türetilir**.
- Trustline: `Operation.changeTrust({ asset, limit })`. Ödemeden önce varlığı kontrol et.
  → Bölüm 9 kural 5 ve `claimable_balances: false` simülasyon ayarı.
- "Validate asset issuer, not just code" → Bölüm 9 kural 7 (`asset_code` + `asset_issuer` eşlemesi).

### 5. `https://skills.stellar.org/skills/data/SKILL.md`
**Ne:** RPC ve Horizon ile zincir verisi okuma.
**Etkilediği kararlar:**
- Testnet uçları doğrulandı (A.2'deki "gerçek" satırlar):
  RPC `https://soroban-testnet.stellar.org` · Horizon `https://horizon-testnet.stellar.org`
  · Friendbot `https://friendbot.stellar.org`
- Olay okuma: `rpc.getEvents({ startLedger, filters })` → defter ekranının zincir doğrulaması.
- **RPC geçmişi ~7 gün** — defter verisinin tek kaynağı RPC olayları olamaz, kontrat storage'ı esastır.
- RPC'de streaming yok, polling şart; iki API de 429 veriyor → üstel geri çekilme.

### 6. `https://skills.stellar.org/skills/standards/SKILL.md`
**Ne:** SEP/CAP seçim haritası.
**Etkilediği karar:** Bu dosya bir **yönlendirme indeksidir**, teknik alan/uç listesi içermez.
SEP-1/10/24/38 alan adları bu skill'den **alınmadı**; anchor skill'inden (#7) ve mock anchor'ın
taklit ettiği davranıştan alındı. Etkinlikte gerçek anchor `/info`'su tek doğruluk kaynağı olacak.

---

## Topluluk skill'leri

### 7. `https://raw.githubusercontent.com/CheesecakeLabs/stellar-anchor-skill/main/SKILL.md`
**Ne:** Anchor entegrasyonu (SEP-1/6/10/12/24/31/38), istemci ve sunucu tarafı.
**Etkilediği kararlar:** Bölüm 9'daki 11 kuralın tamamı bu skill'in 13 "gotcha"sıyla birebir doğrulandı.
Projeye doğrudan yansıyanlar:
1. SEP-10 challenge'ın sequence'i **0**, **ağa gönderilmez** → `apps/api/src/anchor/sep10.ts` + zorunlu test.
2. `home_domain` ≠ `web_auth_domain` → ayrı alanlar, ayrı test.
3. SEP-24 interactive **iframe'de değil popup'ta**; anchor `X-Frame-Options: DENY` gönderir;
   tamamlanma `postMessage` ile → `apps/mock-anchor` bunu birebir taklit edecek (A.4).
4. Çekimde **tam `memo` + `memo_type`**; eksikse para askıda kalır → KARAR 2'nin (5.3) gerekçesi.
5. `/info`'da `claimable_balance_supported` yoksa **trustline şart**.
6. Tutarlar **string**; `parseFloat` yasak → `decimal.js`.
7. `asset_code` tek başına belirsiz; `asset_issuer` ile eşle.
8. Durum bir **state machine**; her dal bir kullanıcı aksiyonuna eşlenir → `docs/brand.md` mikro metinleri.
9. SEP-38 `expires_at` katı; dolmuşsa **sessizce yeniden fiyatla**, ham hatayı kullanıcıya gösterme.
10. `stellar.toml` `/.well-known/` altında ve **CORS** ile; CORS yoksa tarayıcı cüzdanları ölür.
11. JWT ömrü anchor'a göre değişir; **401'de şeffaf yeniden auth**, akışı baştan başlatma.
12. `/info` bir **sözleşmedir**; açılışta oku, yetenek varsayma.
13. TOML `SIGNING_KEY` hem SEP-10 hem SEP-24 callback'lerini doğrular; bir kez çöz, önbellekle.
**Ayrıca:** `testanchor.stellar.org` uyumluluk süiti referans olarak not edildi — mock anchor'ın
davranışı buna yakın tutulacak.

### 8. `https://raw.githubusercontent.com/paltalabs/defindex-sdk/main/defindex-sdk-skill.md`
**Ne:** DeFindex SDK kullanımı.
**Etkilediği kararlar:**
- Paket: `@defindex/sdk` (+ `@stellar/stellar-sdk`).
- **İki farklı enum:** SDK çağrılarında `SupportedNetworks.TESTNET`, XDR parse'ında `Networks.TESTNET`.
  → Bölüm 8.3'teki karıştırma regresyon testi buradan geliyor.
- İmzasız XDR akışı (birebir): SDK metodu → `TransactionBuilder.fromXDR(res.xdr, Networks.TESTNET) as Transaction`
  → `tx.sign(keypair)` → `tx.toXDR()` → `sdk.sendTransaction(xdr, SupportedNetworks.TESTNET)`.
  `as Transaction` cast'ini unutmak listelenmiş tuzaklardan biri.
- Metot imzaları: `depositToVault(vaultAddress, depositParams, network)`,
  `withdrawShares(vaultAddress, shareParams, network)`,
  `getVaultBalance(vaultAddr, userPublicKey, network)`,
  `getVaultInfo(vaultAddress, network)`, `getVaultAPY(vaultAddress, network)`.
  → `apps/api/src/defindex/mock.ts` **aynı imzaları** uygulayacak (Bölüm 8.3 arayüz eşitliği testi).
- Tüm tutarlar **stroop**; 7 ondalıklı token için 1 birim = 10.000.000 stroop.
- API key `DefindexSDK` başlatılırken `apiKey` parametresiyle verilir; çoğu işlem için zorunlu.

### 9. `https://raw.githubusercontent.com/mariaelisaaraya/stellar-security-guide/main/skills/soroban-common-mistakes/SKILL.md`
**Ne:** 23 bilinen Soroban hata kalıbına karşı kontrat denetleyicisi (interaktif reviewer).
**Etkilediği kararlar:** Skill bir **denetleyici ajandır**, statik kural listesi vermez; kapsadığı
5 kategori Bölüm 8.1 test listesiyle eşleştirildi:
- Yetkilendirme & erişim: eksik `require_auth()`, **yeniden init** açığı, yanlış auth öznesi → test 1–6, 27
- Storage & TTL: yanlış storage tipi, TTL uzatmama, anahtar çakışması → test 30
- Matematik & mantık: kontrolsüz aritmetik, bölme yuvarlaması, doğrulanmamış girdi, durum ezme → test 18–22
- Dış çağrı & token: doğrulanmamış dönüş, Stellar varlık uç durumları → test 13–17
- Kod kalitesi: hata yönetimi, `unwrap` kullanımı, olay yokluğu, sır hijyeni → tüm kontrat
**Faz S2 sonunda kontrat bu skill'e denetletilecek** ve bulgular `docs/decisions.md`'ye işlenecek.

---

## Kapatılmayan boşluklar

| Boşluk | Nasıl kapatılacak |
|---|---|
| SEP-1/10/24/38 alan adlarının resmî metni | `github.com/stellar/stellar-protocol` SEP dosyaları; etkinlikte gerçek anchor `/info` |
| Gerçek DeFindex testnet vault adresi | DeFindex Discord / docs — **uydurulmayacak** (A.5) |
| Gerçek Circle testnet USDC issuer | `faucet.circle.com` — **ezberden yazılmayacak** (A.3) |
| Anchor `home_domain` | Workshop #3, Day 1 12:40 |
