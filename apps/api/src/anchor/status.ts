import { ANCHOR_STATUSES, BRAND, resolveStatusText, type TransferDirection } from "@kasa/core";

/** Ham anchor durumunu kullanıcı metniyle eşler; bilinmeyen dallar güvenli `unknown` olur. */
export function mapAnchorStatus(
  direction: TransferDirection,
  status: string,
  memoMatched: boolean | undefined = undefined,
) {
  if (direction === "withdraw" && status === "pending_external" && memoMatched === false) {
    return { status, ...BRAND.statusText.memoMismatch };
  }
  const known = ANCHOR_STATUSES.includes(status as (typeof ANCHOR_STATUSES)[number]);
  return { status: known ? status : "unknown", ...resolveStatusText(direction, status) };
}
