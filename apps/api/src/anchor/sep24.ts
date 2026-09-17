import type { WithdrawalPayment, WithdrawalResponse } from "./types";

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
