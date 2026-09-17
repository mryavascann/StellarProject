# Kasa — web arayüzü tasarım sistemi

Bu dosya **web paketinin görsel uygulama katmanıdır**. Her UI değişikliğinden **önce** okunur.

- Ürün geneli marka kararları (ton, Türkçe mikro metinler, anchor durum cümleleri):
  `docs/brand.md` ve `packages/core/src/brand.ts`. Kullanıcıya gösterilen **metin** oradan gelir.
- **Görsel token'lar** (renk, ölçek, yarıçap, boşluk) burada tanımlıdır ve tek uygulama yeri
  `src/app/globals.css` içindeki `@theme` bloğudur. Bileşenlerin içine hex yazılmaz.

---

## 1. Ton ve yön

Bu bir **para uygulaması**, kripto uygulaması değil.

- Sıcak nötr zemin, **tek** net vurgu rengi, sakin ve güven veren finans arayüzü.
- Cömert boşluk, minimum gölge, gradient yok, neon yok, animasyon en az.
- Ekranda tek birincil eylem. Buton metni fiille başlar ("Para yatır", "Kasaya katıl").
- Kullanıcıya "vault", "stroop", "XDR", "trustline", "SEP-24" gösterilmez.

**Gitmeyeceğimiz yer:** koyu mor zemin + neon vurgu + parlayan kart kenarı. Bu estetik
"spekülatif kripto" hissi verir; ürün ise ev arkadaşlarının kira parası.

---

## 2. Renk paleti

Renkler `oklch` değil hex olarak yazılır (kaynak okunabilirliği için) ve `@theme` içinde yaşar.

### Açık tema

| Token | Hex | Rol |
|---|---|---|
| `--color-kasa-bg` | `#F7F7F5` | Sayfa zemini — sıcak nötr, saf beyaz değil |
| `--color-kasa-surface` | `#FFFFFF` | Kart yüzeyi |
| `--color-kasa-surface-2` | `#F0F0EC` | İkincil yüzey, iskelet (skeleton), tablo başlığı |
| `--color-kasa-border` | `#E3E2DD` | Kenarlık ve ayırıcı |
| `--color-kasa-text` | `#1A1A18` | Birincil metin |
| `--color-kasa-text-muted` | `#6B6B64` | İkincil metin, açıklama, etiket |
| `--color-kasa-accent` | `#1F5F4B` | **Tek vurgu**: birincil buton, bağlantı, odak halkası |
| `--color-kasa-on-accent` | `#FFFFFF` | Vurgu üstündeki metin |
| `--color-kasa-positive` | `#1F7A4C` | Getiri, tamamlandı |
| `--color-kasa-warning` | `#8A6A12` | Bekliyor, sıra sende |
| `--color-kasa-danger` | `#A32B2B` | Hata, iptal, askıda |

### Koyu tema

| Token | Hex |
|---|---|
| `--color-kasa-bg` | `#121312` |
| `--color-kasa-surface` | `#1B1C1B` |
| `--color-kasa-surface-2` | `#232523` |
| `--color-kasa-border` | `#2F312F` |
| `--color-kasa-text` | `#F2F2EF` |
| `--color-kasa-text-muted` | `#A0A099` |
| `--color-kasa-accent` | `#4FA588` |
| `--color-kasa-on-accent` | `#0E1A15` |
| `--color-kasa-positive` | `#4FA588` |
| `--color-kasa-warning` | `#D4A72C` |
| `--color-kasa-danger` | `#E07A7A` |

**Kurallar**
- Vurgu rengi tek. İkinci bir "marka rengi" eklenmez; ayrım boşluk ve tipografiyle yapılır.
- Renk tek başına anlam taşımaz: her durum rozeti renk **ve** metin taşır (erişilebilirlik).
- shadcn'in semantik token'ları (`--background`, `--primary`, `--border` …) bu palete bağlanır;
  bileşen dosyalarında `bg-primary`, `text-muted-foreground` gibi semantik sınıflar kullanılır.

---

## 3. Tipografi

| Rol | Değer |
|---|---|
| Arayüz ailesi | `Geist` → `--font-sans` (shadcn kurulumuyla geldi), yedek: system-ui |
| Monospace | `ui-monospace, "SF Mono", "Cascadia Mono", monospace` — adres ve işlem hash'i |

Ölçek (boyut / satır yüksekliği):

| Token | px | Kullanım |
|---|---|---|
| `--text-hero` | 56 / 60 | Kasadaki tutar — ekranın tek büyük sayısı |
| `--text-xl` | 28 / 34 | Sayfa başlığı |
| `--text-lg` | 20 / 28 | Kart başlığı, satır tutarı |
| `--text-md` | 16 / 24 | Gövde (taban) |
| `--text-sm` | 14 / 20 | İkincil bilgi |
| `--text-xs` | 12 / 16 | Rozet, dipnot |

Ağırlıklar: gövde 400, vurgulu 500, başlık ve tutar 600. 700 kullanılmaz.
Hero tutarda `letter-spacing: -0.02em`.

---

## 4. Yarıçap, gölge, boşluk

| Token | Değer | Kullanım |
|---|---|---|
| `--radius-card` | 12px | Kart, diyalog, tablo çerçevesi |
| `--radius-control` | 8px | Buton, input, sekme |
| `--radius-pill` | 999px | Durum rozeti |

**Gölge:** tek bir seviye vardır → `0 1px 2px rgb(0 0 0 / 0.06)`. Sadece kartta.
Renkli gölge, glow, çoklu katman **yok**. Yükseklik hissi kenarlıkla verilir.

**Boşluk ritmi:** taban birim **4px**; tüm boşluklar katıdır (4, 8, 12, 16, 24, 32, 48).
- Sayfa genişliği en fazla **560px**, yanlardan **16px** boşluk (telefonda da aynı).
- Kart iç boşluğu **20px**, kartlar arası **16px**.
- Dokunma hedefi en az **44px**.

---

## 5. Para gösterimi

- **Tüm tutarlar** `src/lib/format.ts` içindeki tek `formatTRY()` helper'ından geçer.
  Bileşenlerde ayrı bir `Intl` veya elle biçimlendirme yazılmaz.
- `Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" })` kullanılır ve
  formatter'a **metin** verilir (Intl v3), böylece `Number`'a dönüş olmaz ve kuruş kaybolmaz.
- Değerler `decimal.js` ile hesaplanır; **float aritmetiği yasak**.
- Gösterimde **aşağı** yuvarlanır: olmayan kuruş gösterilmez.
- Eksi işareti tipografik eksidir (`−`, U+2212), ASCII tire değil.
- Artı işareti yalnızca getiri gibi "kazanç" bağlamında (`signed`) gösterilir.
- **Tutar gösteren her element `tabular-nums` kullanır** (`.num` sınıfı veya
  `font-variant-numeric: tabular-nums`). Sayı değişince kolon kaymaz.

---

## 6. Bileşenler

Temel bileşenler shadcn/ui (Base UI primitive'leri) ile gelir: `src/components/ui/`.

- Özelleştirme **kopyalanan dosyanın içinde** yapılır; üstüne sarmalayıcı yazılmaz.
- Alan adları semantiktir (`bg-background`, `text-muted-foreground`), palete `@theme` üzerinden bağlıdır.
- Kurulu olanlar: `button`, `card`, `dialog`, `input`, `field` (+`label`, `separator`),
  `table`, `tabs`, `badge`, `sonner`, `skeleton`.
- **Grafik, data grid ve tarih aralığı seçici kapsam dışıdır.** Bakiye/getiri grafiği
  gerekirse Recharts ayrıca kurulur; olmayan bir shadcn bileşeni uydurulmaz.

Alan üstü kurallar:
- Boş, yükleniyor ve hata durumu **her** veri ekranında vardır.
- Hata metni ne olduğunu ve ne yapılacağını söyler; "bir şeyler ters gitti" yazılmaz.
- Yükleniyor durumunda `skeleton` kullanılır, spinner değil.
