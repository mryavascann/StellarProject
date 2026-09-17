import { fetchAnchorMetadata } from "./sep1";
import { exchangeChallenge, fetchChallenge } from "./sep10";
import { buildWithdrawalPayment } from "./sep24";
import { requestFreshQuote, type AnchorQuote } from "./sep38";
import type { AnchorMetadata, WithdrawalPayment } from "./types";

/**
 * MOD SINIRI (KARAR K-003). `KASA_MODE` yalnızca burada ve `defindex/client.ts`'te okunur.
 * Simülasyon ile canlı arasındaki TEK fark `reportWithdrawalPayment`: mock anchor zinciri
 * izlemediği için ödeme ona bildirilir; gerçek anchor kendi izler.
 */

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;
export type Environment = Readonly<Record<string, string | undefined>>;

export interface AnchorLimits {
  readonly enabled: boolean;
  readonly minAmount: string | null;
  readonly maxAmount: string | null;
  readonly feeFixed: string | null;
  readonly feePercent: string | null;
}

/** `/info` sözleşmesi (Bölüm 9 kural 11): açılışta okunur, komisyon ve limit kodda sabit değildir. */
export interface AnchorInfo {
  readonly deposit: AnchorLimits;
  readonly withdraw: AnchorLimits;
  readonly trustlineRequired: boolean;
}

export interface InteractiveStart {
  readonly id: string;
  readonly url: string;
}

export interface WithdrawalStart extends InteractiveStart {
  readonly memo: string;
  readonly payment: WithdrawalPayment;
}

export interface RawTransactionStatus {
  readonly status: string;
  readonly memoMatched?: boolean;
}

/** SEP-10 sonucunda doğan oturum. API bunu SAKLAMAZ; tarayıcıya verir, tarayıcı geri gönderir. */
export interface AnchorSession {
  readonly token: string;
  readonly expiresAt: number;
}

export interface AnchorClient {
  readonly mode: "simulation" | "live";
  readonly homeDomain: string;
  metadata(): Promise<AnchorMetadata>;
  info(): Promise<AnchorInfo>;
  challenge(account: string): Promise<string>;
  exchangeToken(account: string, signedTransaction: string): Promise<AnchorSession>;
  startDeposit(account: string, amountAsset: string, token: string): Promise<InteractiveStart>;
  startWithdraw(account: string, amountAsset: string, token: string): Promise<WithdrawalStart>;
  /** `paymentHash`: çekimde üyenin yaptığı ödeme; anchor onu zincirden doğrular (K-002). */
  transaction(account: string, id: string, token: string, paymentHash?: string): Promise<RawTransactionStatus>;
  price(): Promise<{ rate: string }>;
  quote(sellAmountFiat: string): Promise<AnchorQuote>;
  reportWithdrawalPayment(id: string, memo: string, txHash: string): Promise<void>;
}

/** Oturum yok ya da düştü: web, cüzdanla SEP-10'u şeffafça tekrarlar ve isteği yeniler. */
export class AnchorAuthRequiredError extends Error {
  readonly code = "auth_required";
  constructor(account: string) {
    super(`Anchor oturumu gerekli: ${account}`);
  }
}

export interface AnchorClientDependencies {
  readonly fetcher?: Fetcher;
  readonly now?: () => Date;
}

function required(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik veya boş.`);
  return value;
}

function limitText(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  return typeof value === "string" ? value : null;
}

function parseLimits(entry: unknown): AnchorLimits {
  const record = (typeof entry === "object" && entry !== null ? entry : {}) as Record<string, unknown>;
  return {
    enabled: record.enabled === true,
    minAmount: limitText(record.min_amount),
    maxAmount: limitText(record.max_amount),
    feeFixed: limitText(record.fee_fixed),
    feePercent: limitText(record.fee_percent),
  };
}

/** JWT `exp` alanını okur; okunamıyorsa oturumu hemen dolmuş sayar (güvenli taraf). */
function tokenExpiry(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString()) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

/** Anchor ağ geçidi: SEP-1/10/24/38 tek yerde. Durum tutmaz; JWT çağrıyla birlikte gelir. */
export function createAnchorClient(environment: Environment, dependencies: AnchorClientDependencies = {}): AnchorClient {
  const mode = environment.KASA_MODE;
  if (mode !== "simulation" && mode !== "live") {
    throw new Error(`KASA_MODE geçersiz: "${String(mode)}". "simulation" veya "live" olmalı.`);
  }
  const homeDomain = required(environment, "ANCHOR_HOME_DOMAIN");
  const fetcher = dependencies.fetcher ?? fetch;
  const now = dependencies.now ?? (() => new Date());
  let metadataPromise: Promise<AnchorMetadata> | undefined;

  const metadata = () => (metadataPromise ??= fetchAnchorMetadata(homeDomain, fetcher));

  /**
   * Oturum sunucuda tutulmaz: JWT her istekte tarayıcıdan gelir. Neden: API birden çok
   * sunucu örneğinde koşabilir (Vercel'de koşuyor) ve bellekteki oturum örnekler arasında
   * kaybolur; kaybolan her oturum kullanıcıya yeni bir cüzdan imzası olarak geri döner.
   * Süresi dolmuş veya boş JWT anchor'a hiç gitmez.
   */
  function usableToken(account: string, token: string): string {
    if (!token || tokenExpiry(token) <= now().getTime()) throw new AnchorAuthRequiredError(account);
    return token;
  }

  async function interactive(kind: "deposit" | "withdraw", account: string, amountAsset: string, token: string) {
    if (!/^\d+\.\d{7}$/u.test(amountAsset)) throw new Error("Tutar 7 ondalıklı metin olmalı.");
    const meta = await metadata();
    const response = await fetcher(`${meta.transferServer}/transactions/${kind}/interactive`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${usableToken(account, token)}` },
      body: JSON.stringify({ account, asset_code: meta.assetCode, asset_issuer: meta.assetIssuer, amount: amountAsset }),
    });
    if (response.status === 401) throw new AnchorAuthRequiredError(account);
    if (!response.ok) throw new Error(`SEP-24 ${kind} başlatılamadı: HTTP ${response.status}`);
    return response.json() as Promise<Record<string, unknown>>;
  }

  return {
    mode,
    homeDomain,
    metadata,

    async info() {
      const meta = await metadata();
      const response = await fetcher(`${meta.transferServer}/info`);
      if (!response.ok) throw new Error(`SEP-24 info alınamadı: HTTP ${response.status}`);
      const body = await response.json() as Record<string, Record<string, unknown> | undefined>;
      const features = body.features ?? {};
      return {
        deposit: parseLimits(body.deposit?.[meta.assetCode]),
        withdraw: parseLimits(body.withdraw?.[meta.assetCode]),
        trustlineRequired: features.claimable_balances !== true,
      };
    },

    async challenge(account) {
      return fetchChallenge(await metadata(), account, fetcher);
    },

    async exchangeToken(account, signedTransaction) {
      const token = await exchangeChallenge(await metadata(), signedTransaction, fetcher);
      return { token, expiresAt: tokenExpiry(token) };
    },

    async startDeposit(account, amountAsset, token) {
      const body = await interactive("deposit", account, amountAsset, token);
      if (typeof body.id !== "string" || typeof body.url !== "string") throw new Error("SEP-24 deposit yanıtı eksik.");
      return { id: body.id, url: body.url };
    },

    async startWithdraw(account, amountAsset, token) {
      const body = await interactive("withdraw", account, amountAsset, token);
      if (typeof body.id !== "string" || typeof body.url !== "string") throw new Error("SEP-24 withdraw yanıtı eksik.");
      const payment = buildWithdrawalPayment(body, amountAsset);
      return { id: body.id, url: body.url, memo: payment.memo, payment };
    },

    async transaction(account, id, token, paymentHash) {
      const meta = await metadata();
      const query = `id=${encodeURIComponent(id)}${paymentHash ? `&payment_hash=${encodeURIComponent(paymentHash)}` : ""}`;
      const response = await fetcher(`${meta.transferServer}/transaction?${query}`, {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) throw new Error(`SEP-24 işlem durumu alınamadı: HTTP ${response.status}`);
      const body = await response.json() as { status?: unknown; memo_matched?: unknown };
      if (typeof body.status !== "string") throw new Error("SEP-24 işlem durumu eksik.");
      return {
        status: body.status,
        ...(typeof body.memo_matched === "boolean" ? { memoMatched: body.memo_matched } : {}),
      };
    },

    async price() {
      const meta = await metadata();
      const response = await fetcher(`${meta.quoteServer}/price`);
      if (!response.ok) throw new Error(`SEP-38 fiyat alınamadı: HTTP ${response.status}`);
      const body = await response.json() as { price?: unknown };
      if (typeof body.price !== "string") throw new Error("SEP-38 fiyat metin değil.");
      return { rate: body.price };
    },

    async quote(sellAmountFiat) {
      return requestFreshQuote((await metadata()).quoteServer, sellAmountFiat, now, fetcher);
    },

    async reportWithdrawalPayment(id, memo, txHash) {
      if (mode === "live") return; // gerçek anchor ödemeyi zincirden kendisi görür
      const meta = await metadata();
      const origin = new URL(meta.transferServer).origin;
      const response = await fetcher(`${origin}/mock/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, memo, tx_hash: txHash }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { error?: unknown };
        throw new Error(typeof body.error === "string" ? body.error : `Ödeme bildirimi reddedildi: HTTP ${response.status}`);
      }
    },
  };
}
