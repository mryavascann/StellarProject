import { toStroopsExact } from "@kasa/core";

import { api, withAnchorSession, type AnchorStatusView } from "./api";
import { STATUS_POLL_MS } from "./config";
import type { Signer } from "./signer";

export type StepState = "waiting" | "active" | "done" | "error";
export interface FlowStep {
  readonly key: string;
  readonly label: string;
  readonly state: StepState;
  readonly detail?: string;
}
export type StepReporter = (key: string, state: StepState, detail?: string) => void;

const FINAL = new Set(["completed", "error", "unknown"]);
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Popup dinleyicisi pencere AÇILMADAN ÖNCE kaydedilir (Bölüm 9 kural 3). */
export function openAnchorPopup(url: string, onDone: () => void): () => void {
  const listener = (event: MessageEvent) => {
    const data = event.data as { type?: unknown } | null;
    if (data && typeof data === "object" && data.type === "KASA_ANCHOR_DONE") onDone();
  };
  window.addEventListener("message", listener);
  window.open(url, "kasa-banka", "width=480,height=640");
  return () => window.removeEventListener("message", listener);
}

/** Anchor durumunu yoklar; her adımda arayüze durum metnini verir. Uçtan uca `completed` bekler. */
export async function pollAnchorStatus(
  account: string,
  id: string,
  direction: "deposit" | "withdraw",
  onStatus: (status: AnchorStatusView) => void,
  options: {
    readonly poll?: number | undefined;
    readonly until?: (status: AnchorStatusView) => boolean;
    /** Çekimde üyenin yaptığı ödemenin hash'i; anchor durumu bundan doğrular. */
    readonly paymentHash?: string;
  } = {},
): Promise<AnchorStatusView> {
  const done = options.until ?? ((status) => FINAL.has(status.status));
  for (;;) {
    const status = await api.anchorTransaction(account, id, direction, options.paymentHash);
    onStatus(status);
    if (done(status)) return status;
    await sleep(options.poll ?? STATUS_POLL_MS);
  }
}

/** Kontrat çağrısı: imzasız XDR → cüzdan imzası → gönderim. */
export async function runVaultCall(signer: Signer, call: Record<string, unknown>): Promise<{ hash: string }> {
  const { xdr } = await api.vaultTx(signer.address, call);
  return api.vaultSubmit(await signer.sign(xdr));
}

async function ensureTrustline(signer: Signer, report: StepReporter): Promise<void> {
  const { exists } = await api.anchorTrustline(signer.address);
  if (exists) return;
  report("hesap", "active", "Hesabın hazırlanıyor");
  const { xdr } = await api.anchorTrustlineTx(signer.address);
  await api.anchorClassicSubmit(await signer.sign(xdr));
}

export interface DepositRun {
  readonly signer: Signer;
  readonly amountFiat: string;
  readonly report: StepReporter;
  readonly onStatus: (status: AnchorStatusView) => void;
  readonly openPopup?: typeof openAnchorPopup;
  readonly pollMs?: number;
}

/**
 * Para yatırma: ① banka bağlantısı (SEP-24) → ② getiri katmanı (USDC → pay) → ③ kasaya kilitle.
 * Adım ① tamamlanınca USDC üyenin hesabındadır; ② pay üretir; ③ payı kontrata koyar.
 */
export async function depositFlow(run: DepositRun): Promise<{ vaultHash: string }> {
  const { signer, report } = run;
  report("banka", "active");
  const info = await api.anchorInfo();
  if (info.trustlineRequired) await ensureTrustline(signer, report);
  const started = await withAnchorSession(signer, () => api.anchorDeposit(signer.address, run.amountFiat));
  const close = (run.openPopup ?? openAnchorPopup)(started.url, () => undefined);
  try {
    const finalStatus = await pollAnchorStatus(signer.address, started.id, "deposit", run.onStatus, { poll: run.pollMs });
    if (finalStatus.status !== "completed") throw new Error(finalStatus.description);
  } finally {
    close();
  }
  report("banka", "done");

  report("getiri", "active");
  const before = BigInt((await api.defindexOverview(signer.address)).balance.shares);
  const depositTx = await api.defindexDepositTx(signer.address, toStroopsExact(started.amountAsset).toString());
  await api.defindexSubmit(signer.address, await signer.sign(depositTx.xdr));
  const after = BigInt((await api.defindexOverview(signer.address)).balance.shares);
  const minted = after - before;
  if (minted <= 0n) throw new Error("Getiri katmanı pay üretmedi.");
  report("getiri", "done");

  report("kasa", "active");
  const { hash } = await runVaultCall(signer, { function: "deposit", amount: minted.toString() });
  report("kasa", "done");
  return { vaultHash: hash };
}

export interface WithdrawRun {
  readonly signer: Signer;
  /** Üyenin hesabındaki (execute ile gelen) pay, stroop. */
  readonly shareStroops: bigint;
  readonly report: StepReporter;
  readonly onStatus: (status: AnchorStatusView) => void;
  readonly pollMs?: number;
}

/**
 * Para çekme: ⑤ pay → USDC (getiri katmanı) → ⑥ banka bağlantısına memo'lu ödeme (ÜYE imzalar, K-002).
 * Memo anchor yanıtından birebir gelir; yanlış memo = askıda para. Bu yüzden ödeme XDR'ını API kurar.
 */
export async function withdrawFlow(run: WithdrawRun): Promise<{ paymentHash: string }> {
  const { signer, report } = run;
  report("getiri", "active");
  const beforeUsdc = BigInt((await api.defindexOverview(signer.address)).balance.underlying);
  const withdrawTx = await api.defindexWithdrawTx(signer.address, run.shareStroops.toString());
  await api.defindexSubmit(signer.address, await signer.sign(withdrawTx.xdr));
  const afterUsdc = BigInt((await api.defindexOverview(signer.address)).balance.underlying);
  const usdcStroops = beforeUsdc - afterUsdc;
  if (usdcStroops <= 0n) throw new Error("Getiri katmanı USDC vermedi.");
  report("getiri", "done");

  report("banka", "active");
  const whole = usdcStroops / 10_000_000n;
  const fraction = (usdcStroops % 10_000_000n).toString().padStart(7, "0");
  const started = await withAnchorSession(signer, () => api.anchorWithdraw(signer.address, `${whole}.${fraction}`));
  const { xdr } = await api.anchorPaymentTx(signer.address, started.payment);
  const { hash } = await api.anchorClassicSubmit(await signer.sign(xdr));
  await api.anchorPaymentReport(started.id, started.payment.memo, hash);
  const finalStatus = await pollAnchorStatus(signer.address, started.id, "withdraw", run.onStatus, {
    poll: run.pollMs,
    paymentHash: hash,
  });
  if (finalStatus.status !== "completed") throw new Error(finalStatus.description);
  report("banka", "done");
  return { paymentHash: hash };
}
