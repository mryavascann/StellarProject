# Kararlar

Kilitli kararlar **tartışmaya kapalıdır** (Bölüm 0.4). İyi fikirler en aşağıdaki roadmap'e yazılır.
Bir kilitli kararı ancak kanıtlı bir teknik engel bozar; o durumda ajan **kendi başına mimari değiştirmez**,
bulguyu kanıtıyla raporlar ve karar bekler.

Format: `K-###` · durum · karar · gerekçe · neyi etkiler · nasıl bozulur.

---

## K-001 · 🔒 KİLİTLİ · Kasa USDC değil, dfToken (vault payı) tutar

**Karar:** `shared_vault` kontratının içinde tuttuğu tek varlık DeFindex vault payıdır (dfToken).
Kontrat tek token türüyle çalışır, cross-contract DeFindex çağrısı yapmaz.

**Gerekçe:** Kasada bekleyen para otomatik getiri kazanır (pay başına değer artar). Kontrat
basit kalır, saldırı yüzeyi küçülür, hackathon "Core Feature" şartı (Bölüm 4.3) doğrudan karşılanır.

**Etkiler:** `contracts/shared-vault` tamamı · `init(share_token)` argümanı · defterdeki tüm tutarlar.

**Simülasyon:** dfToken yerine kendi deploy ettiğimiz Soroban token örnek kontratı kullanılır.
İkisi de SEP-41 arayüzü olduğu için kontrat açısından fark sıfırdır. Canlıda yalnızca
`SHARE_TOKEN_ID` değişir ve kontrat yeniden `init` edilir.

**Nasıl bozulur:** Gerçek dfToken transfer edilemiyorsa (kısıtlı/soulbound) veya kontrat
onu alamıyorsa. → **Dur, kanıtla raporla, karar bekle.** Alternatif mimariye kendi başına geçme.

Kaynak: MASTER PROMPT Bölüm 5.2.

---

## K-002 · 🔒 KİLİTLİ · Off-ramp'in son adımını kontrat değil üye atar

**Karar:** `execute()` fonu **talep edenin kendi Stellar hesabına** bırakır. Anchor'a giden
klasik ödemeyi (doğru `memo` + `memo_type` ile) frontend kurar ve üye imzalar.

**Gerekçe:** Anchor çekimlerinde hedef adres tüm kullanıcılar için aynı paylaşımlı custodial
hesaptır; fonun sahibi **yalnızca memo'dan** anlaşılır. Klasik memo işlem seviyesinde bir alandır,
kontrat kaynaklı transferle güvenilir taşınamaz. Yanlış/eksik memo = askıda kalan para; çoğu
anchor bunu otomatik kurtarmaz.

**Etkiler:** `execute()` imzası · SEP-24 withdraw akışı · frontend çekim ekranı · Bölüm 8.3'ün
"memo birebir aktarılıyor" zorunlu testi.

**Nasıl bozulur:** Etkinlikteki anchor kullanıcı başına ayrı hesap veriyorsa memo riski düşer —
ama karar yine de değişmez, çünkü akış tek kod yolunda kalmalı.

Kaynak: MASTER PROMPT Bölüm 5.3 · anchor skill gotcha #4.

---

## K-003 · 🔒 KİLİTLİ · Mod farkı yalnızca iki adaptör dosyasında yaşar

**Karar:** `KASA_MODE` yalnızca `apps/api/src/anchor/client.ts` ve
`apps/api/src/defindex/client.ts` içinde okunur. Kontratta, kontrat testlerinde, frontend'de,
iş mantığında `if (KASA_MODE === ...)` **yasaktır**.

**Gerekçe:** Mod kontrolü kodun geneline sızarsa canlıya geçiş (Faz 0, 2 saat) her dosyayı
tek tek düzeltmeye dönüşür ve etkinlik günü batar.

**Etkiler:** Tüm API mimarisi. Mock ve live adaptörleri **aynı TypeScript arayüzünü** uygular;
bu tip seviyesinde ve davranış testiyle doğrulanır (Bölüm 8.3).

Kaynak: MASTER PROMPT Bölüm A.1.

---

## K-004 · 🔒 KİLİTLİ · `deposit()` doğrudan `transfer` kullanır

**Karar:** Kontrat `member.require_auth()` sonrasında SEP-41 `transfer(from=member, to=kasa)`
çağırır. Ayrı `approve` ve `transfer_from` işlemi yoktur.

**Gerekçe:** Kullanıcı için tek imza yeterlidir ve `expiration_ledger` yaşam döngüsü oluşmaz.
Bölüm 8.1 test 1, auth kaydı olmadan deposit'i reddetti; normal deposit testleri aynı nested
auth zinciriyle token'ı kasaya taşıdı. Karar tahminle değil çalışan SDK 27 testiyle kapandı.

---

## K-005 · KARAR · Paket yöneticisi pnpm, monorepo pnpm workspaces

**Karar:** `pnpm` + `pnpm-workspace.yaml`. `packages/core`, `apps/api`, `apps/mock-anchor`, `apps/web` ayrı paketler.

**Gerekçe:** Makinede pnpm 11.22 kurulu. DeFindex skill'i de kurulum örneğinde `pnpm add` kullanıyor.
Workspace, `packages/core`'un para/stellar yardımcılarını üç uygulamanın da tek kopyadan
kullanmasını sağlar — `decimal.js` kuralının tek yerden uygulanması için şart.

---

## K-006 · KARAR · Makefile kalır, yanına pnpm script köprüsü konur

**Karar:** Bölüm 6'daki `Makefile` yazılır (dosya yapısı bozulmaz), ama her hedefin karşılığı
`package.json` script'i olarak da bulunur: `pnpm test`, `pnpm test:live`, `pnpm dev`, `pnpm sim`, `pnpm deploy`.
Makefile hedefleri bu script'leri çağırır.

**Gerekçe:** Geliştirme makinesi Windows ve `make` kurulu değil. Makefile'ı tek yol yapmak
geliştirmeyi durdurur; script'i tek yol yapmak Bölüm 6'yı ihlal eder. İkisi aynı komutu çağırdığı
için ikilik (drift) riski yok.

---

## K-007 · KARAR · Mock USDC issuer'ı üretilir, SAC adresi türetilir

**Karar:** `scripts/gen-accounts.ts` bir issuer keypair'i üretir; `USDC` klasik varlığı ondan çıkarılır.
Contract id **uydurulmaz**, `new Asset("USDC", issuer).contractId(Networks.TESTNET)` ile türetilir
veya `stellar contract asset deploy` çıktısından okunur.

**Gerekçe:** Bölüm 0.3 (uydurma yasağı) + A.3. Gerçek Circle testnet USDC issuer'ı ezberden
yazılmaz; canlıda `faucet.circle.com`'dan doğrulanarak alınır.

Kaynak: assets skill — SAC adresi deterministiktir.

---

## K-008 · KARAR · Wasm hedefi `wasm32v1-none`

**Karar:** Kontrat `wasm32v1-none` hedefine derlenir; `wasm32-unknown-unknown` kullanılmaz.
`soroban-sdk = "27"`.

**Gerekçe:** smart-contracts skill: "the only Wasm target the Stellar runtime supports".
Yanlış hedef, deploy anında (yani etkinlik gününde) patlar.

---

## K-009 · KARAR · Bilinmeyen anchor durumu çökmez, "bilinmiyor" dalına düşer

**Karar:** Durum makinesi Bölüm 8.3'teki 10 dalı **eksiksiz** karşılar; bunların dışında bir durum
gelirse `unknown` dalına düşüp kullanıcıya nötr bir mesaj ve "Destekle iletişime geç" aksiyonu
gösterilir, uygulama çökmez. Test: 10 dalın hepsi eşlenmiş olmalı; eşlenmemiş dal kalırsa test kırmızı.

**Gerekçe:** `/info` bir sözleşmedir ama gerçek anchor'lar SEP-24'te ek durumlar döndürebilir
(`refunded`, `expired` gibi). Etkinlik günü tanımadığımız bir durum yüzünden demo çökmemeli.
`unknown` dalı bir **kolaylaştırma değil**, bilinen dalların testini zayıflatmıyor.

---

## K-010 · KARAR · Marka tokenları `packages/core/src/brand.ts` içinde yaşar

**Karar:** `docs/brand.md`'deki renk/ölçek/para biçimi/mikro metin tanımlarının kod karşılığı
`packages/core/src/brand.ts` dosyasıdır. Hem `apps/api` (durum → mesaj eşlemesi) hem `apps/web`
(rozet, form metni) **aynı modülü** okur. Testler Türkçe cümleleri elle yazmaz, bu modülden alır.

**Gerekçe:** Bölüm 0.5 "mikro metin koda token olarak gelir" diyor; Bölüm 8.3 API testinin,
Bölüm 8.4 web testinin **aynı** metni doğrulaması gerekiyor. İki kopya olursa ikisi kaçınılmaz
biçimde ayrışır. `packages/core` zaten üç uygulamanın da ortak bağımlılığı (K-005).

**Not:** Bölüm 6 `packages/core/src` altında `{stellar.ts, contract.ts, money.ts}` sayıyor.
`brand.ts` aynı klasöre eklenen 4. dosyadır — **yeni üst klasör açılmamıştır**, kapsam kuralı korunur.

---

## K-011 · KARAR · Windows GNU testleri ASCII sysroot ve target dizini kullanır

**Karar:** Kontrat test/build komutları `scripts/run-cargo.mjs` üzerinden çalışır. Windows'ta
`C:\rust` altındaki minimal ASCII toolchain tercih edilir, build çıktısı
`C:\temp\kasa-cargo-target` dizinine yönlendirilir ve testler `cargo test --lib` kullanır.

**Gerekçe:** MinGW linker, `C:\Users\Buğra` yolundaki `ğ` karakterini okuyamadığı için mevcut
dosyaları “No such file” diye reddediyor. Aynı toolchain ASCII sysroot/target ile 30 testi çalıştırdı.
`--lib`, Windows GNU'nun test sırasında gereksiz `cdylib` üretirken ulaştığı PE export ordinal
sınırını atlar; deploy için gereken Wasm `stellar contract build` ile ayrıca üretilir.

**Etkiler:** `pnpm test`, `pnpm test:contract`, `pnpm build:contract`, yerel Windows geliştirme
ortamı. Build sarmalayıcısı Stellar CLI'ın kullandığı `cargo rustc --target=wasm32v1-none`
çağrısını yapar ve Wasm'ı standart kontrat target dizinine kopyalar. Linux/macOS'ta ASCII yol
müdahalesi uygulamaz.

---

## K-012 · KARAR · Simülasyonda USDC ve pay zincirdedir, fiat ayağı bellektedir

**Karar:** Mock anchor deposit tamamlanınca **gerçek** mock USDC'yi (ihraççı = `MOCK_USDC_ISSUER`) üyenin
hesabına öder; trustline yoksa `pending_trust` döner. Withdraw'da ödeme **Horizon'dan okunarak**
doğrulanır: hedef custodial hesap (= ihraççı), varlık ve `memo` birebir eşleşmezse işlem
`pending_external`da askıda kalır. Mock DeFindex, SDK gibi imzasız XDR üretir; deposit'te ihraççı
(vault imzası) payı üyeye öder, withdraw'da üye payı ihraççıya geri gönderir (yakma). Yalnızca
TL tarafı (banka havalesi) bellektedir.

**Gerekçe:** A.4 "kolay mock yazarsan canlıya geçişte her şey kırılır". Trustline, memo ve
imza sırası gibi gerçek anchor/DeFindex tuzakları ancak zincirde yaşanırsa test edilir.
Uçtan uca test (8.5) böylece kontrat dahil tamamen testnet üzerinde koşar.

**Etkiler:** `apps/mock-anchor/src/chain.ts` (Horizon/bellek kapısı), `apps/api/src/defindex/mock.ts`,
`apps/api/src/anchor/classic.ts` (trustline + memo'lu ödeme XDR'ı). USDC ayağı canlıda
zaten gerçektir; bu karar canlıya geçişte hiçbir şeyi değiştirmez.

---

## K-013 · KARAR · API anchor ağ geçididir, JWT'yi sunucu tutar, imza her zaman cüzdanda

**Karar:** SEP-10/24/38 çağrılarını `apps/api` yapar; JWT hesap başına sunucu belleğinde
tutulur. Sunucu hiçbir zaman imza atamaz: oturum yoksa/dolmuşsa 401 `auth_required` döner,
web challenge'ı cüzdana imzalatıp aynı isteği **bir kez** tekrarlar (`withAnchorSession`).
Kontrat ve DeFindex XDR'larını da API kurar, üye imzalar, API gönderir.

**Gerekçe:** Bölüm 8.3'teki anchor testleri API kodunu mock anchor'a karşı koşturmalı; kod
web'de olsaydı test yüzeyi bölünürdü. "401'de şeffaf tekrar" kuralı (Bölüm 9 kural 10) böylece
tek yerde (`apps/web/src/lib/api.ts`) uygulanır. Secret'lar sunucuya gitmez.

---

## K-014 · KARAR · Demo/test için gizli anahtarla imzalayıcı, cüzdan kitiyle aynı arayüzde

**Karar:** Web'de `Signer` arayüzü var; `connectWalletKit()` (Stellar Wallets Kit v2, npm
`@creit.tech/stellar-wallets-kit@2.6.0`) ve `createKeySigner(secret)` aynı arayüzü uygular.
Anahtar yalnızca sekme belleğinde (sessionStorage) durur, "Test hesabıyla gir" olarak etiketlidir.

**Gerekçe:** Seed hesapları tarayıcı eklentisinde değil; uçtan uca test ve eklentisiz demo için
şart. Mod kontrolü değildir (K-003 ihlali yok): canlı testnet'te de aynı şekilde çalışır.
**Not:** skills-used.md'deki "v2 yalnızca JSR" notu eskimiş; npm'deki 2.6.0 v2 API'sini taşıyor.

---

## Roadmap (kapsam dışı — dokunma, buraya yaz)

Bölüm 13'ün kapsam dışı listesi: çoklu kasa, kasalar arası transfer, karmaşık davet akışı,
mobil uygulama, çoklu varlık, yönetişim oylaması, bildirim altyapısı, Soroswap,
cross-contract DeFindex çağrısı, oransal getiri dağıtımı, mainnet.

Eklenen fikirler:
- (henüz yok)
