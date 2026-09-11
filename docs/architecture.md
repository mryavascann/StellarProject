# Teknik Tasarım

Durum: **taslak — Faz S1.** Kontrat ve adaptörler yazıldıkça (S2, S3) güncellenir.
Kilitli kararların gerekçeleri burada tekrarlanmaz; `docs/decisions.md` esastır.

---

## 1. Katmanlar

```
apps/web         Next.js · kullanıcı arayüzü, cüzdan, imzalama
   │  HTTP
apps/api         Hono · anchor ve DeFindex adaptörleri, durum makinesi eşlemesi
   │                  ├─ anchor/client.ts    ← MOD SINIRI
   │                  └─ defindex/client.ts  ← MOD SINIRI
   ├───────────── apps/mock-anchor   (yalnızca simulation)
   │
packages/core    para (decimal.js), stellar yardımcıları, marka tokenları
   │
contracts/shared-vault   Rust + Soroban SDK 27 · testnet
```

**Mod sınırı iki dosyadır** (K-003). `KASA_MODE` başka hiçbir yerde okunmaz.
`anchor/client.ts` ve `defindex/client.ts` birer **fabrika**dır: moda göre mock ya da live
uygulamasını döndürür, geri kalan kod yalnızca arayüzü görür.

---

## 2. Para akışı

Adım adım, hangi katmanın ne yaptığı:

| # | Adım | Kim yapar | Simülasyonda |
|---|---|---|---|
| ① | TL → USDC (SEP-24 deposit) | web popup açar, anchor yürütür | `apps/mock-anchor` |
| ② | USDC → dfToken (`depositToVault`) | api XDR üretir, üye imzalar | `defindex/mock.ts` |
| ③ | dfToken → kasa (`deposit()`) | **gerçek Soroban kontratı** | **gerçek** |
| ④ | `request_spend` → `approve` → `execute` | **gerçek Soroban kontratı** | **gerçek** |
| ⑤ | dfToken → USDC (`withdrawShares`) | api XDR üretir, üye imzalar | `defindex/mock.ts` |
| ⑥ | USDC → TL (SEP-24 withdraw) | **üye kendi hesabından**, doğru memo ile | `apps/mock-anchor` |

③ ve ④ simülasyonda da **tamamen gerçektir**: gerçek testnet, gerçek kontrat, gerçek transfer.
Bu yüzden etkinlik günü değişmezler.

**⑥ neden kontrattan değil üyeden çıkıyor:** K-002. Özet: anchor'ın çekim hedefi paylaşımlı bir
custodial hesaptır ve fonun sahibi yalnızca `memo`'dan anlaşılır; klasik memo işlem seviyesinde
bir alandır ve kontrat kaynaklı transferle güvenilir taşınamaz.

---

## 3. Kontrat

`contracts/shared-vault` — tuttuğu tek varlık **dfToken** (vault payı, K-001).
Cross-contract DeFindex çağrısı yok; kontrat yalnızca SEP-41 token arayüzünü kullanır.

**Veri modeli** (MASTER PROMPT 7.1): `Member { address, joined_at, contributed, withdrawn }`,
`SpendRequest { id, requester, amount, note, approvals, status, created_at, expires_at }`.
`contributed`/`withdrawn` **yalnızca defter içindir** — oransal pay hakkı hesabı MVP'de yapılmaz.

**Public fonksiyonlar:** `init` · `add_member` · `remove_member` · `deposit` · `request_spend`
· `approve` · `execute` · `cancel` · `emergency_exit` · `get_balance` / `get_members` /
`get_requests` / `get_ledger`.

**Onay kuralı:** `amount <= threshold` → talep doğrudan `Approved`. Üstü → `quorum` kadar onay.
Sınır `<=`, yani tam eşik kadar tutar onaysız geçer.

**Güvenlik duruşu** (kaynak: smart-contracts + soroban-common-mistakes skill'leri):
- Her mutasyon fonksiyonunda `require_auth()`; auth öznesi işlemi yapan üyedir.
- `init` bir kez; ikinci çağrı hata döndürür (yeniden init açığı).
- Aritmetik `overflow-checks = true` ile derlenir; taşma **panik değil hata** döndürür.
- **Durum transferden önce yazılır** — `execute()` önce `Executed` işaretler, sonra transfer eder.
- Storage TTL açıkça uzatılır (`extend_ttl`), aksi hâlde kayıtlar arşivlenir.
- Hatalar `#[contracterror] #[repr(u32)]` enum'u ile döner; `unwrap` kullanılmaz.

**Derleme hedefi:** `wasm32v1-none` (K-008) · `soroban-sdk = "27"`.

---

## 4. Anchor adaptörü

`apps/api/src/anchor/` — `sep1.ts` (TOML), `sep10.ts` (auth), `sep24.ts` (interactive),
`sep38.ts` (quote), `status.ts` (durum makinesi), `client.ts` (mod sınırı).

Bölüm 9'daki 11 kural bu katmanın sözleşmesidir; her biri bir testle korunur. Kritik olanlar:
- SEP-10 challenge'ın sequence'i **0** ve **ağa gönderilmez** — yerelde imzalanıp POST edilir.
- `home_domain` ≠ `web_auth_domain`; ikisi ayrı geçirilir.
- Interactive URL **popup**'ta açılır; `postMessage` dinleyicisi pencere açılmadan **önce** kaydedilir.
- Çekimde `memo` + `memo_type` birebir ödemeye aktarılır.
- `/info` açılışta okunur ve akış ona göre kurulur; komisyon/limit kodda sabit değildir.
- Tutarlar **string**; `parseFloat` yasak, `decimal.js` kullanılır.
- 401 → SEP-10 şeffaf tekrar; kullanıcı akışın başına atılmaz.
- SEP-38 `expires_at` dolmuşsa **sessizce yeniden fiyatla**.

**Durum makinesi** (`status.ts`): 10 dalın hepsi `packages/core/src/brand.ts`'teki Türkçe metne ve
bir aksiyona eşlenir. Tanınmayan durum `unknown` dalına düşer, uygulama çökmez (K-009).

---

## 5. DeFindex adaptörü

`apps/api/src/defindex/` — `client.ts` (mod sınırı), `mock.ts`, `live.ts`, `deposit.ts`,
`withdraw.ts`, `info.ts`.

`mock.ts` ve `live.ts` **aynı arayüzü** uygular; bu hem tip seviyesinde hem davranış testiyle
doğrulanır — canlıya geçişin kırılmayacağının tek garantisi budur.

İmzasız XDR akışı (live): SDK metodu → `TransactionBuilder.fromXDR(res.xdr, Networks.TESTNET)
as Transaction` → imzala → `sendTransaction(xdr, SupportedNetworks.TESTNET)`.
**İki farklı enum** kullanılır; karıştırma bir regresyon testiyle korunur.
Tutarlar **stroop**: 7 ondalıklı token için 1 birim = 10.000.000 stroop.

---

## 6. Para temsili

| Katman | Tip | Kural |
|---|---|---|
| Kontrat | `i128` | stroop; taşma denetimi açık |
| TypeScript, zincir sınırı | `bigint` | stroop; `number`'a asla çevrilmez |
| TypeScript, hesap | `Decimal` (`decimal.js`) | oran, komisyon, kur |
| Anchor sınırı | `string` | `"1250.0000000"` — `parseFloat` yasak |
| Gösterim | `string` | `Intl.NumberFormat("tr-TR")`, `docs/brand.md` Bölüm 5 |

`packages/core/src/money.ts` bu dönüşümlerin tek adresidir ve float kullanımının hassasiyet
kaybettirdiğini gösteren bir **regresyon testi** içerir.

---

## 7. Açık noktalar

| Konu | Ne zaman kapanır |
|---|---|
| `deposit()` `transfer` mi `transfer_from` mu kullanacak (K-004) | Faz S2, testle |
| Gerçek dfToken transfer edilebilir mi (K-001'i bozabilir) | Etkinlik, Faz 2 |
| Gerçek anchor SEP-12 istiyor mu | Etkinlik, Faz 0–1 |
| Gerçek anchor'ın döndürdüğü ek durum dalları | Etkinlik, Faz 1 |
