/**
 * MARKA TOKENLARI — `docs/brand.md`'nin kod karşılığı (KARAR K-010).
 *
 * Neden burada: Bölüm 0.5 "tasarım kararı koda gömülmez" diyor. Renk, ölçek, para biçimi
 * ve kullanıcıya gösterilen HER cümle tek kaynaktan gelir; API (durum → mesaj eşlemesi),
 * web (rozet, form metni) ve testler aynı bu modülü okur. İki kopya olsaydı kaçınılmaz
 * biçimde ayrışırlardı ve test bir metni, ekran başka bir metni doğrulardı.
 *
 * Bu dosya değişince `docs/brand.md` de güncellenir. Tersi de geçerli.
 */

/** Durum rozeti tonları — renk TEK BAŞINA anlam taşımaz, her zaman metinle birlikte. */
export const TONES = ["neutral", "progress", "action", "success", "danger"] as const;
export type Tone = (typeof TONES)[number];

/**
 * SEP-24 durum makinesinin ele alınan dalları (Bölüm 8.3).
 * Bu listeden bir dal çıkarılırsa testler kırmızıya döner.
 */
export const ANCHOR_STATUSES = [
  "incomplete",
  "pending_user_transfer_start",
  "pending_anchor",
  "pending_external",
  "pending_trust",
  "pending_user",
  "on_hold",
  "pending_customer_info_update",
  "completed",
  "error",
] as const;
export type AnchorStatus = (typeof ANCHOR_STATUSES)[number];

/** Para yatırma mı çekme mi — aynı durum kodu iki yönde farklı şey anlatır. */
export type TransferDirection = "deposit" | "withdraw";

export interface StatusText {
  readonly title: string;
  readonly description: string;
  /** `null` = kullanıcının yapabileceği bir şey yok, buton gösterme. */
  readonly action: string | null;
  readonly tone: Tone;
}

const DEPOSIT_TEXT: Record<AnchorStatus, StatusText> = {
  incomplete: {
    title: "Yarım kaldı",
    description: "Banka bağlantısı ekranını kapattın. Kaldığın yerden devam edebilirsin.",
    action: "Devam et",
    tone: "action",
  },
  pending_user_transfer_start: {
    title: "Sıra sende",
    description:
      "{tutar} tutarındaki havaleyi bankandan gönder. Ekrandaki bilgileri birebir kullan.",
    action: "Bilgileri göster",
    tone: "action",
  },
  pending_anchor: {
    title: "İşleniyor",
    description: "Paran alındı, karşılığı hazırlanıyor. Genelde birkaç dakika sürer.",
    action: null,
    tone: "progress",
  },
  pending_external: {
    title: "Bankanda bekliyor",
    description: "Havale banka tarafında ilerliyor. Bu adım bize bağlı değil.",
    action: null,
    tone: "progress",
  },
  pending_trust: {
    title: "Hesabın hazırlanıyor",
    description: "Paranın gelebilmesi için hesabında tek seferlik bir ayar gerekiyor.",
    action: "Hesabımı hazırla",
    tone: "action",
  },
  pending_user: {
    title: "Senden bir şey lazım",
    description: "İşlemi sürdürmek için banka bağlantısı ekranında bir adım kaldı.",
    action: "Ekranı aç",
    tone: "action",
  },
  on_hold: {
    title: "Kontrol ediliyor",
    description: "İşlem güvenlik kontrolünde. Sonuç genelde birkaç saat içinde çıkar.",
    action: null,
    tone: "progress",
  },
  pending_customer_info_update: {
    title: "Bilgin güncellenmeli",
    description: "Banka bağlantısı bazı bilgilerinin güncellenmesini istiyor.",
    action: "Bilgilerimi güncelle",
    tone: "action",
  },
  completed: {
    title: "Tamamlandı",
    description: "{tutar} kasaya girdi ve getiri kazanmaya başladı.",
    action: "Kasaya dön",
    tone: "success",
  },
  error: {
    title: "İşlem tamamlanamadı",
    description: "Para hesabından çıktıysa iade edilir. Tekrar deneyebilirsin.",
    action: "Tekrar dene",
    tone: "danger",
  },
};

const WITHDRAW_TEXT: Record<AnchorStatus, StatusText> = {
  incomplete: {
    title: "Yarım kaldı",
    description: "Çekim ekranını kapattın. Kaldığın yerden devam edebilirsin.",
    action: "Devam et",
    tone: "action",
  },
  pending_user_transfer_start: {
    title: "Gönderimi onayla",
    description: "Kasadan çıkan {tutar} banka bağlantısına gönderilecek. Onayınla imzalanacak.",
    action: "Gönder ve imzala",
    tone: "action",
  },
  pending_anchor: {
    title: "İşleniyor",
    description: "Para banka bağlantısına ulaştı, bankana gönderilmek üzere hazırlanıyor.",
    action: null,
    tone: "progress",
  },
  pending_external: {
    title: "Bankaya gönderildi",
    description: "Havale bankaya geçti. Bankanın yatırma süresi işliyor.",
    action: null,
    tone: "progress",
  },
  pending_trust: {
    title: "Hesabın hazırlanıyor",
    description: "İşlemin tamamlanması için hesabında tek seferlik bir ayar gerekiyor.",
    action: "Hesabımı hazırla",
    tone: "action",
  },
  pending_user: {
    title: "Senden bir şey lazım",
    description: "Çekimi sürdürmek için banka bağlantısı ekranında bir adım kaldı.",
    action: "Ekranı aç",
    tone: "action",
  },
  on_hold: {
    title: "Kontrol ediliyor",
    description: "Çekim güvenlik kontrolünde. Sonuç genelde birkaç saat içinde çıkar.",
    action: null,
    tone: "progress",
  },
  pending_customer_info_update: {
    title: "Bilgin güncellenmeli",
    description: "Banka bağlantısı bazı bilgilerinin güncellenmesini istiyor.",
    action: "Bilgilerimi güncelle",
    tone: "action",
  },
  completed: {
    title: "Bankana geçti",
    description: "{tutar} banka hesabına gönderildi.",
    action: "Kasaya dön",
    tone: "success",
  },
  error: {
    title: "Çekim tamamlanamadı",
    description: "Para kasada veya hesabında duruyor. Tekrar deneyebilirsin.",
    action: "Tekrar dene",
    tone: "danger",
  },
};

/**
 * Tanınmayan durum kodu için ortak metin (KARAR K-009).
 * Gerçek anchor ek durumlar döndürebilir; demo bunun yüzünden çökmemeli.
 */
const UNKNOWN_TEXT: StatusText = {
  title: "Durum belirsiz",
  description: "İşlemin durumunu şu an okuyamıyoruz. Paran kayıp değil.",
  action: "Destekle iletişime geç",
  tone: "danger",
};

/**
 * Havale gönderildi ama memo eşleşmedi — para askıda.
 * Bu durum `pending_external` gibi görünür ama ÖYLE GÖSTERİLMEZ: kendiliğinden düzelmez
 * ve kullanıcının harekete geçmesi gerekir (KARAR K-002'nin görünen yüzü).
 */
const MEMO_MISMATCH_TEXT: StatusText = {
  title: "Havale eşleşmedi",
  description:
    "Gönderim bankaya ulaştı ama işlemle eşleştirilemedi. Bu tür işlemler kendiliğinden düzelmez.",
  action: "Destekle iletişime geç",
  tone: "danger",
};

/**
 * Durum kodunu kullanıcı metnine çevirir.
 * Tanınmayan kod hata fırlatmaz, `unknown` dalına düşer — demo çökmesin (K-009).
 */
export function resolveStatusText(
  direction: TransferDirection,
  status: AnchorStatus | string,
): StatusText {
  const table = direction === "deposit" ? DEPOSIT_TEXT : WITHDRAW_TEXT;
  return (table as Record<string, StatusText | undefined>)[status] ?? UNKNOWN_TEXT;
}

/** Ekranlarda geçen sabit mikro metinler (docs/brand.md Bölüm 8). */
const MESSAGES = {
  spendNoApprovalNeeded:
    "Bu tutar için onay gerekmiyor. Talebi gönderdiğinde doğrudan kullanılabilir.",
  spendApprovalNeeded: "Bu tutar için {n} kişinin onayı gerekiyor.",
  spendInsufficient: "Kasada {tutar} var. Talebin bundan fazla olamaz.",
  spendNonPositive: "Tutar sıfırdan büyük olmalı.",
  requestLine: "{isim} {tutar} istedi — {not}",
  approveSelf: "Kendi talebini onaylayamazsın.",
  approveTwice: "Bu talebi zaten onayladın.",
  requestExpired: "Bu talebin süresi doldu.",
  balanceCaption: "kasada",
  yieldCaption: "bu ay kazanılan getiri",
  emptyVault: "Kasa henüz boş. İlk parayı sen yatır.",
  emptyLedger: "Bu kasada henüz hareket yok.",
  inviteLine: "{isim} seni {kasa} kasasına çağırdı.",
  noWallet: "Devam etmek için bir cüzdana ihtiyacın var.",
  retry: "Tekrar dene",
} as const;

/** Renk tokenları. Anahtarlar doğrudan CSS değişkeni adlarıdır; kodda hex yazılmaz. */
const COLORS = {
  light: {
    "--kasa-bg": "#F7F7F5",
    "--kasa-surface": "#FFFFFF",
    "--kasa-surface-2": "#F0F0EC",
    "--kasa-border": "#E3E2DD",
    "--kasa-text": "#1A1A18",
    "--kasa-text-muted": "#6B6B64",
    "--kasa-accent": "#1F5F4B",
    "--kasa-on-accent": "#FFFFFF",
    "--kasa-positive": "#1F7A4C",
    "--kasa-warning": "#8A6A12",
    "--kasa-danger": "#A32B2B",
  },
  dark: {
    "--kasa-bg": "#121312",
    "--kasa-surface": "#1B1C1B",
    "--kasa-surface-2": "#232523",
    "--kasa-border": "#2F312F",
    "--kasa-text": "#F2F2EF",
    "--kasa-text-muted": "#A0A099",
    "--kasa-accent": "#4FA588",
    "--kasa-on-accent": "#0E1A15",
    "--kasa-positive": "#4FA588",
    "--kasa-warning": "#D4A72C",
    "--kasa-danger": "#E07A7A",
  },
} as const;

/** Tipografi ölçeği: [boyut, satır yüksekliği] piksel. */
const TYPOGRAPHY = {
  families: {
    ui: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, "SF Mono", "Cascadia Mono", monospace',
  },
  scale: {
    "--fs-hero": [56, 60],
    "--fs-xl": [28, 34],
    "--fs-lg": [20, 28],
    "--fs-md": [16, 24],
    "--fs-sm": [14, 20],
    "--fs-xs": [12, 16],
  },
  /** Tutar gösteren her yerde zorunlu. Sayı değişince kolon kaymasın. */
  tabularNums: "tabular-nums",
} as const;

const LAYOUT = {
  /** Tüm boşluklar bu birimin katıdır. */
  baseUnit: 4,
  maxWidth: 560,
  gutter: 16,
  cardPadding: 20,
  radius: { "--radius-card": 12, "--radius-control": 8, "--radius-pill": 999 },
  minTouchTarget: 44,
} as const;

export const BRAND = {
  name: "Kasa",
  tones: TONES,
  colors: COLORS,
  typography: TYPOGRAPHY,
  layout: LAYOUT,
  messages: MESSAGES,
  statusText: {
    deposit: DEPOSIT_TEXT,
    withdraw: WITHDRAW_TEXT,
    unknown: UNKNOWN_TEXT,
    memoMismatch: MEMO_MISMATCH_TEXT,
  },
} as const;
