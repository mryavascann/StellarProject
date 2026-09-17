import { ANCHOR_STATUSES, BRAND } from "@kasa/core";
import { describe, expect, it } from "vitest";

import { mapAnchorStatus } from "./status";

describe("anchor durum eşlemesi", () => {
  it.each(ANCHOR_STATUSES)("%s durumunu marka metnine ve aksiyona eşler", (status) => {
    expect(mapAnchorStatus("deposit", status)).toEqual({ status, ...BRAND.statusText.deposit[status] });
  });

  it("bilinmeyen durumu çöktürmez", () => {
    expect(mapAnchorStatus("withdraw", "refunded")).toMatchObject({ status: "unknown", title: BRAND.statusText.unknown.title });
  });

  it("memo eşleşmediyse pending_external yerine açık hata metni verir", () => {
    expect(mapAnchorStatus("withdraw", "pending_external", false)).toEqual({
      status: "pending_external",
      ...BRAND.statusText.memoMismatch,
    });
  });
});
