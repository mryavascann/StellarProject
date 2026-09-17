import type { JwtProvider, WithdrawalPayment, WithdrawalResponse } from "./types";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function withToken(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);
  return { ...init, headers };
}

/** 401 alınca SEP-10 JWT'yi bir kez yeniler ve aynı isteği şeffaf biçimde tekrarlar. */
export async function requestWithFreshJwt(
  url: string,
  init: RequestInit,
  tokenProvider: JwtProvider,
  fetcher: Fetcher = fetch,
): Promise<Response> {
  let response = await fetcher(url, withToken(init, await tokenProvider(false)));
  if (response.status === 401) {
    response = await fetcher(url, withToken(init, await tokenProvider(true)));
  }
  return response;
}

/** Anchor çekim yanıtını klasik ödemeye dönüştürür; memo alanlarını değiştirmez. */
export function buildWithdrawalPayment(
  response: WithdrawalResponse,
  amount: string,
): WithdrawalPayment {
  if (!/^\d+\.\d{7}$/u.test(amount)) throw new Error("Çekim tutarı 7 ondalıklı metin olmalı.");
  if (typeof response.account_id !== "string") throw new Error("Withdraw account_id eksik.");
  if (typeof response.memo !== "string") throw new Error("Withdraw memo eksik.");
  if (response.memo_type !== "id") throw new Error("Withdraw memo_type id olmalı.");
  return {
    destination: response.account_id,
    amount,
    memo: response.memo,
    memoType: response.memo_type,
  };
}
