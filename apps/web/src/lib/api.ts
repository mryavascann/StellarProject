import type { StatusText } from "@kasa/core";

import { API_URL } from "./config";
import type { Signer } from "./signer";

/** API'nin döndürdüğü hata; `code` yalnızca `auth_required` gibi makine-okur durumlarda dolu. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

export interface VaultMemberView {
  readonly address: string;
  readonly joinedAt: number;
  readonly contributed: string;
  readonly withdrawn: string;
}

export interface VaultRequestView {
  readonly id: number;
  readonly requester: string;
  readonly amount: string;
  readonly note: string;
  readonly approvals: readonly string[];
  readonly status: "Pending" | "Approved" | "Executed" | "Cancelled";
  readonly createdAt: number;
  readonly expiresAt: number;
}

export interface VaultLedgerView {
  readonly kind: "Deposit" | "Spend" | "EmergencyExit";
  readonly member: string;
  readonly amount: string;
  readonly at: number;
  readonly requestId: number | null;
}

export interface VaultView {
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly contractId: string;
  readonly balance: string;
  readonly members: readonly VaultMemberView[];
  readonly requests: readonly VaultRequestView[];
  readonly ledger: readonly VaultLedgerView[];
}

export interface AnchorLimitsView {
  readonly enabled: boolean;
  readonly minAmount: string | null;
  readonly maxAmount: string | null;
  readonly feeFixed: string | null;
  readonly feePercent: string | null;
}

export interface AnchorInfoView {
  readonly mode: "simulation" | "live";
  readonly homeDomain: string;
  readonly assetCode: string;
  readonly assetIssuer: string;
  readonly rate: string;
  readonly deposit: AnchorLimitsView;
  readonly withdraw: AnchorLimitsView;
  readonly trustlineRequired: boolean;
}

export interface OverviewView {
  readonly mode: "simulation" | "live";
  readonly vaultAddress: string;
  readonly balance: { readonly shares: string; readonly underlying: string };
  readonly info: { readonly name: string; readonly symbol: string; readonly apyPercent: string; readonly sharePrice: string | null };
  readonly apyPercent: string;
}

export interface WithdrawalPaymentView {
  readonly destination: string;
  readonly amount: string;
  readonly memo: string;
  readonly memoType: "id";
}

export type AnchorStatusView = { readonly status: string } & StatusText;
export type TransferDirection = "deposit" | "withdraw";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, init);
  const body = (await response.json().catch(() => ({}))) as { error?: unknown };
  if (!response.ok) {
    const message = typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new ApiError(message, response.status, message === "auth_required" ? message : undefined);
  }
  return body as T;
}

function post(payload: unknown): RequestInit {
  return { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}

/** Tüm API çağrıları tek yerde; tutarlar metin olarak gider ve gelir. */
export const api = {
  vault: () => request<VaultView>("/api/vault"),
  vaultTx: (account: string, call: Record<string, unknown>) => request<{ xdr: string }>("/api/vault/tx", post({ account, ...call })),
  vaultSubmit: (signedXdr: string) => request<{ hash: string }>("/api/vault/submit", post({ signedXdr })),

  anchorInfo: () => request<AnchorInfoView>("/api/anchor/info"),
  anchorChallenge: (account: string) => request<{ transaction: string }>("/api/anchor/challenge", post({ account })),
  anchorToken: (account: string, signedTransaction: string) => request<{ ok: true }>("/api/anchor/token", post({ account, signedTransaction })),
  anchorTrustline: (account: string) => request<{ exists: boolean }>(`/api/anchor/trustline?account=${encodeURIComponent(account)}`),
  anchorTrustlineTx: (account: string) => request<{ xdr: string }>("/api/anchor/trustline/tx", post({ account })),
  anchorDeposit: (account: string, amountFiat: string) =>
    request<{ id: string; url: string; amountAsset: string; quoteExpiresAt: string }>("/api/anchor/deposit", post({ account, amountFiat })),
  anchorWithdraw: (account: string, amountAsset: string) =>
    request<{ id: string; url: string; memo: string; payment: WithdrawalPaymentView }>("/api/anchor/withdraw", post({ account, amountAsset })),
  anchorPaymentTx: (account: string, payment: WithdrawalPaymentView) => request<{ xdr: string }>("/api/anchor/payment/tx", post({ account, ...payment })),
  anchorClassicSubmit: (signedXdr: string) => request<{ hash: string }>("/api/anchor/classic/submit", post({ signedXdr })),
  anchorTransaction: (account: string, id: string, direction: TransferDirection) =>
    request<AnchorStatusView>(`/api/anchor/transaction?account=${encodeURIComponent(account)}&id=${encodeURIComponent(id)}&direction=${direction}`),
  anchorPaymentReport: (id: string, memo: string, txHash: string) => request<{ ok: true }>("/api/anchor/payment", post({ id, memo, txHash })),

  defindexOverview: (account: string) => request<OverviewView>(`/api/defindex/overview?account=${encodeURIComponent(account)}`),
  defindexDepositTx: (account: string, amountStroops: string) => request<{ xdr: string }>("/api/defindex/deposit/tx", post({ account, amountStroops })),
  defindexWithdrawTx: (account: string, shareStroops: string) => request<{ xdr: string }>("/api/defindex/withdraw/tx", post({ account, shareStroops })),
  defindexSubmit: (account: string, signedXdr: string) => request<{ txHash: string }>("/api/defindex/submit", post({ account, signedXdr })),
};

/** SEP-10'u cüzdanla yapar: challenge → imza → JWT. Kullanıcı bunu bir "giriş" olarak görmez. */
export async function authenticateAnchor(signer: Signer): Promise<void> {
  const { transaction } = await api.anchorChallenge(signer.address);
  await api.anchorToken(signer.address, await signer.sign(transaction));
}

/**
 * Bölüm 9 kural 10: JWT dolunca (401 `auth_required`) SEP-10 şeffafça tekrarlanır ve aynı
 * istek bir kez daha denenir; kullanıcı akışın başına atılmaz.
 */
export async function withAnchorSession<T>(signer: Signer, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (!(error instanceof ApiError) || error.code !== "auth_required") throw error;
    await authenticateAnchor(signer);
    return run();
  }
}
