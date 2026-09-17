# Kasa — Marka ve Arayüz Kuralları

> **Web arayüzünün görsel uygulama katmanı:** `apps/web/brand.md`.
> Renk/ölçek/yarıçap değerleri ve `@theme` token'ları orada; bu dosya ürün geneli
> marka kararlarını, tonu ve Türkçe mikro metinleri tutar (K-017).


Bu dosya **tek doğruluk kaynağıdır**. Renk, tipografi, boşluk, para biçimi ve kullanıcıya
gösterilen her cümle burada tanımlanır; koda **token olarak** gelir (Bölüm 0.5).

**Kodda hardcoded hex yok. Kodda hardcoded kullanıcı metni yok.**
Tokenların kod karşılığı: `packages/core/src/brand.ts` (tek kaynak, hem API hem web okur).
Testler metinleri bu modülden alır — test dosyasına elle Türkçe cümle yazılmaz.

---

## 1. İsim ve ton

**İsim:** Kasa. Her yerde büyük K ile, tırnaksız, açıklamasız.

**Ton:** Senli, samimi, ama **ciddi**. Para konuşuyoruz. Şaka yok, emoji yok, ünlem yok.
Kısa cümle. Edilgen değil etken çatı. Kullanıcıya ne olduğunu ve **ne yapması gerektiğini** söyle.

- ✅ "Bankandan gelen parayı bekliyoruz. Genelde birkaç dakika sürer."
- ❌ "İşleminiz işleme alınmıştır. Lütfen bekleyiniz!"

**Yasaklı kelimeler ve yerine ne denecek:**

| Yasak | Yerine |
|---|---|
| vault | kasa |
| dfToken / share / pay token | kasa payı |
| stroop | (hiç gösterme — TL veya kasa payı olarak göster) |
| XDR, işlem zarfı | (hiç gösterme — geliştirici modu hariç) |
| trustline | (hiç gösterme — "hesabın hazırlanıyor" de) |
| SEP-24, SEP-10, anchor | banka bağlantısı |
| on-ramp / off-ramp | para yatırma / para çekme |
| wallet | cüzdan |
| transaction | işlem |
| deposit / withdraw | yatır / çek |
| stake, yield farming, APY | getiri, yıllık getiri |
| kripto, blockchain, token | (hiç gösterme) |
| quorum, threshold | onay sayısı, onaysız üst limit |
| lütfen, buyurunuz, ediniz | (kullanma — etken ve kısa yaz) |

**Geliştirici modu** (footer'daki anahtar, jüri demosunda açılır): yasak listesi burada geçersiz.
Kontrat adresi, işlem hash'i, ham durum kodu, stroop değeri, XDR — hepsi açıkça gösterilir.

---

## 2. Renk

CSS değişkeni adları. Tailwind'e bu değişkenler üzerinden bağlanır, sınıf içinde hex yazılmaz.

**Açık tema (`:root`)**

| Token | Değer | Kullanım |
|---|---|---|
| `--kasa-bg` | `#F7F7F5` | Sayfa zemini |
| `--kasa-surface` | `#FFFFFF` | Kart, panel |
| `--kasa-surface-2` | `#F0F0EC` | İkincil yüzey, satır vurgusu |
| `--kasa-border` | `#E3E2DD` | Kenarlık, ayraç |
| `--kasa-text` | `#1A1A18` | Ana metin, büyük rakam |
| `--kasa-text-muted` | `#6B6B64` | İkincil metin, etiket |
| `--kasa-accent` | `#1F5F4B` | Birincil buton, vurgu |
| `--kasa-on-accent` | `#FFFFFF` | Vurgu üstündeki metin |
| `--kasa-positive` | `#1F7A4C` | Getiri, tamamlandı |
| `--kasa-warning` | `#8A6A12` | Bekliyor, aksiyon gerekiyor |
| `--kasa-danger` | `#A32B2B` | Hata, iptal |

**Koyu tema (`[data-theme="dark"]`)**

| Token | Değer |
|---|---|
| `--kasa-bg` | `#121312` |
| `--kasa-surface` | `#1B1C1B` |
| `--kasa-surface-2` | `#232523` |
| `--kasa-border` | `#2F312F` |
| `--kasa-text` | `#F2F2EF` |
| `--kasa-text-muted` | `#A0A099` |
| `--kasa-accent` | `#4FA588` |
| `--kasa-on-accent` | `#0E1A15` |
| `--kasa-positive` | `#4FA588` |
| `--kasa-warning` | `#D4A72C` |
| `--kasa-danger` | `#E07A7A` |

**Kurallar:** Gradient yok. Gölge yalnızca tek seviye (`0 1px 2px rgb(0 0 0 / 0.06)`).
Renk tek başına anlam taşımaz — her durum rozetinde renk + metin birlikte bulunur.
Renkli metin yalnızca rakamlarda (getiri yeşil, çıkış nötr).

---

## 3. Tipografi

**Aileler**
- Arayüz ve rakam: `Inter`, fallback `system-ui, -apple-system, "Segoe UI", sans-serif`
- Hash / adres / geliştirici modu: `ui-monospace, "SF Mono", "Cascadia Mono", monospace`

**Ölçek** (rem, 16px kök)

| Token | Boyut / satır | Kullanım |
|---|---|---|
| `--fs-hero` | 56 / 60 | Kasa ana ekranındaki tek büyük sayı |
| `--fs-xl` | 28 / 34 | Ekran başlığı |
| `--fs-lg` | 20 / 28 | Kart başlığı, tutar |
| `--fs-md` | 16 / 24 | Gövde |
| `--fs-sm` | 14 / 20 | İkincil metin, defter satırı |
| `--fs-xs` | 12 / 16 | Etiket, rozet |

**Rakam kuralı:** Tutar gösteren her yerde `font-variant-numeric: tabular-nums;`.
Kolonlar kaymasın, sayı değişince zıplamasın. Bu opsiyonel değil.

**Ağırlık:** 400 gövde, 500 etiket/buton, 600 başlık ve tutar. 700 kullanma.

---

## 4. Boşluk ve yerleşim

- Temel birim: **4px**. Tüm boşluklar 4'ün katı (4, 8, 12, 16, 24, 32, 48).
- Sayfa genişliği: `max-width: 560px`, ortalanmış. Kasa bir para uygulaması, gösterge paneli değil.
- Yanlardan minimum boşluk: **16px** (her ekran genişliğinde).
- Kart iç boşluğu: 20px. Kartlar arası: 16px.
- Köşe yarıçapı: `--radius-card: 12px`, `--radius-control: 8px`, `--radius-pill: 999px`.
- Dokunma hedefi minimum 44px yükseklik.

---

## 5. Para gösterimi

**Float yasak.** Her hesap `decimal.js` (TS) veya `i128` (Rust) ile yapılır.
Formatlama yalnızca **gösterim anında**, `Intl.NumberFormat("tr-TR")` ile.

| Ne | Biçim | Örnek |
|---|---|---|
| TL tutarı | `₺` + binlik `.` + ondalık `,` + **2 hane** | `₺12.450,00` |
| TL, kullanıcı girişi | 2 hane, `,` ondalık ayracı | `500,00` |
| Kasa payı (dfToken) | 7 hane, sondaki sıfırlar kırpılmaz | `124,5000000 kasa payı` |
| Zincir tutarı (ham) | stroop, tam sayı — **yalnızca geliştirici modu** | `1245000000` |
| Getiri | `+` işareti zorunlu, yeşil | `+₺84,20` |
| Çıkış / harcama | `−` (U+2212, tire değil), nötr renk | `−₺750,00` |
| Yıllık getiri | `%` **önde**, virgüllü | `%6,50` |

**Kurallar**
- Kullanıcıya **her zaman TL** gösterilir. Kasa payı yalnızca ikincil satırda, küçük ve gri.
- Sıfır `₺0,00` yazılır; boş bırakılmaz, `-` konmaz.
- Yuvarlama yalnızca gösterimde ve **aşağı** (kullanıcıya olmayan parayı vaat etme).
- Çekim öncesi **üç satır zorunlu**: kasadan düşecek · banka bağlantısı komisyonu · bankana geçecek.

---

## 6. Bileşenler

**Buton varyantları**

| Varyant | Zemin | Metin | Kullanım |
|---|---|---|---|
| `primary` | `--kasa-accent` | `--kasa-on-accent` | Ekranda **tek** birincil eylem |
| `secondary` | `--kasa-surface` + kenarlık | `--kasa-text` | İkincil eylem |
| `ghost` | şeffaf | `--kasa-text-muted` | Vazgeç, geri |
| `danger` | şeffaf + `--kasa-danger` kenarlık | `--kasa-danger` | İptal et, kasadan çık |

Buton metni **fiil** ile başlar: "Para yatır", "Onayla", "Talebi gönder". "Tamam" / "OK" yok.
Yükleniyor durumunda buton metni değişir ("Gönderiliyor…") ve buton kilitlenir.

**Durum rozetleri** — renk + metin, sadece renk değil.

| Ton | Renk | Örnek |
|---|---|---|
| `neutral` | `--kasa-text-muted` | Başlanmadı |
| `progress` | `--kasa-warning` | Bekliyor |
| `action` | `--kasa-accent` | Senden bir şey lazım |
| `success` | `--kasa-positive` | Tamamlandı |
| `danger` | `--kasa-danger` | Hata |

**Üç zorunlu ekran durumu** — her liste ve her veri çeken ekran bunları uygular:
- **Boş:** ne olduğunu söyle + tek birincil eylem. Örn. "Bu kasada henüz hareket yok." / "Para yatır"
- **Yükleniyor:** iskelet (skeleton) kutular. Dönen çark yok, "Yükleniyor…" yazısı yok.
- **Hata:** ne olduğu + ne yapılacağı + "Tekrar dene" butonu. Ham hata mesajı yalnızca geliştirici modunda.

---

## 7. Mikro metinler — banka bağlantısı durum makinesi

**Bu bölüm kodun ve testlerin referansıdır.** Bölüm 8.3'ün zorunlu testi: aşağıdaki dalların
**hepsi** bir metne ve bir aksiyona eşlenmiş olacak; eşlenmemiş dal kalırsa test kırmızıdır.

Her dal için: `başlık` · `açıklama` · `aksiyon` (buton metni veya `null` = buton yok) · `ton`.
`{tutar}` ve `{banka}` çalışma zamanında doldurulur.

### Para yatırma (deposit)

| Durum | Başlık | Açıklama | Aksiyon | Ton |
|---|---|---|---|---|
| `incomplete` | Yarım kaldı | Banka bağlantısı ekranını kapattın. Kaldığın yerden devam edebilirsin. | Devam et | `action` |
| `pending_user_transfer_start` | Sıra sende | {tutar} tutarındaki havaleyi bankandan gönder. Ekrandaki bilgileri birebir kullan. | Bilgileri göster | `action` |
| `pending_anchor` | İşleniyor | Paran alındı, karşılığı hazırlanıyor. Genelde birkaç dakika sürer. | — | `progress` |
| `pending_external` | Bankanda bekliyor | Havale banka tarafında ilerliyor. Bu adım bize bağlı değil. | — | `progress` |
| `pending_trust` | Hesabın hazırlanıyor | Paranın gelebilmesi için hesabında tek seferlik bir ayar gerekiyor. | Hesabımı hazırla | `action` |
| `pending_user` | Senden bir şey lazım | İşlemi sürdürmek için banka bağlantısı ekranında bir adım kaldı. | Ekranı aç | `action` |
| `on_hold` | Kontrol ediliyor | İşlem güvenlik kontrolünde. Sonuç genelde birkaç saat içinde çıkar. | — | `progress` |
| `pending_customer_info_update` | Bilgin güncellenmeli | Banka bağlantısı bazı bilgilerinin güncellenmesini istiyor. | Bilgilerimi güncelle | `action` |
| `completed` | Tamamlandı | {tutar} kasaya girdi ve getiri kazanmaya başladı. | Kasaya dön | `success` |
| `error` | İşlem tamamlanamadı | Para hesabından çıktıysa iade edilir. Tekrar deneyebilirsin. | Tekrar dene | `danger` |
| `unknown` | Durum belirsiz | İşlemin durumunu şu an okuyamıyoruz. Paran kayıp değil. | Destekle iletişime geç | `danger` |

### Para çekme (withdraw)

| Durum | Başlık | Açıklama | Aksiyon | Ton |
|---|---|---|---|---|
| `incomplete` | Yarım kaldı | Çekim ekranını kapattın. Kaldığın yerden devam edebilirsin. | Devam et | `action` |
| `pending_user_transfer_start` | Gönderimi onayla | Kasadan çıkan {tutar} banka bağlantısına gönderilecek. Onayınla imzalanacak. | Gönder ve imzala | `action` |
| `pending_anchor` | İşleniyor | Para banka bağlantısına ulaştı, bankana gönderilmek üzere hazırlanıyor. | — | `progress` |
| `pending_external` | Bankaya gönderildi | Havale bankaya geçti. Bankanın yatırma süresi işliyor. | — | `progress` |
| `pending_trust` | Hesabın hazırlanıyor | İşlemin tamamlanması için hesabında tek seferlik bir ayar gerekiyor. | Hesabımı hazırla | `action` |
| `pending_user` | Senden bir şey lazım | Çekimi sürdürmek için banka bağlantısı ekranında bir adım kaldı. | Ekranı aç | `action` |
| `on_hold` | Kontrol ediliyor | Çekim güvenlik kontrolünde. Sonuç genelde birkaç saat içinde çıkar. | — | `progress` |
| `pending_customer_info_update` | Bilgin güncellenmeli | Banka bağlantısı bazı bilgilerinin güncellenmesini istiyor. | Bilgilerimi güncelle | `action` |
| `completed` | Bankana geçti | {tutar} banka hesabına gönderildi. | Kasaya dön | `success` |
| `error` | Çekim tamamlanamadı | Para kasada veya hesabında duruyor. Tekrar deneyebilirsin. | Tekrar dene | `danger` |
| `unknown` | Durum belirsiz | İşlemin durumunu şu an okuyamıyoruz. Paran kayıp değil. | Destekle iletişime geç | `danger` |

### Askıda kalan para (memo eşleşmedi)

`pending_external` durumunda ve gönderdiğimiz memo anchor tarafından eşleştirilmediyse
(A.4 davranış 5) kullanıcıya **farklı** bir metin gösterilir — bu sessizce `pending_external`
olarak bırakılmaz:

> **Havale eşleşmedi** · Gönderim bankaya ulaştı ama işlemle eşleştirilemedi. Bu tür işlemler
> kendiliğinden düzelmez. · **Aksiyon:** Destekle iletişime geç · **Ton:** `danger`

---

## 8. Diğer mikro metinler

**Harcama talebi**
- Eşik altı: "Bu tutar için onay gerekmiyor. Talebi gönderdiğinde doğrudan kullanılabilir."
- Eşik üstü: "Bu tutar için {n} kişinin onayı gerekiyor."
- Bakiye yetmiyor: "Kasada {tutar} var. Talebin bundan fazla olamaz."
- Sıfır/negatif: "Tutar sıfırdan büyük olmalı."

**Onay**
- Bekleyen talep: "{isim} {tutar} istedi — {not}"
- Kendi talebi: "Kendi talebini onaylayamazsın."
- Zaten onaylamış: "Bu talebi zaten onayladın."
- Süresi dolmuş: "Bu talebin süresi doldu."

**Kasa ana ekranı**
- Büyük sayı altı: "kasada"
- Getiri satırı: "bu ay kazanılan getiri"
- Boş kasa: "Kasa henüz boş. İlk parayı sen yatır."

**Onboarding**
- Davet: "{isim} seni {kasa} kasasına çağırdı."
- Cüzdan yok: "Devam etmek için bir cüzdana ihtiyacın var."

---

## 9. Erişilebilirlik ve hareket

- Metin kontrastı en az **4.5:1**, büyük rakamlarda en az 3:1. Yeni renk eklenirse ölçülür.
- Odak halkası her zaman görünür: 2px `--kasa-accent`, 2px offset. `outline: none` yasak.
- Animasyon minimum: yalnızca 150ms opaklık/renk geçişi. Kayan, zıplayan, dönen hiçbir şey yok.
- `prefers-reduced-motion: reduce` → tüm geçişler kapanır.
- Her ikon yanında metin bulunur. Yalnız ikonlu buton yok.
