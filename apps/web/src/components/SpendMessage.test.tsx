import { BRAND } from "@kasa/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

afterEach(cleanup);

import { SPEND_THRESHOLD_STROOPS } from "@/lib/config";
import { fiatToShares, spendMessage } from "@/lib/format";

/** Harcama formunun gösterdiği mesaj tek fonksiyondan gelir; burada ekran çıktısı doğrulanır. */
function SpendMessage({ amountFiat }: { amountFiat: string }) {
  const balance = 160_0000000n;
  const amount = fiatToShares(amountFiat, "1.0000000", "50.0000000");
  return <p data-testid="spend-message">{spendMessage(amount, balance, "8000.00")}</p>;
}

describe("harcama formu mesajı", () => {
  it("eşik altı tutar için onay gerekmediğini söyler", () => {
    render(<SpendMessage amountFiat="750.00" />);
    expect(screen.getByTestId("spend-message").textContent).toBe(BRAND.messages.spendNoApprovalNeeded);
  });

  it("eşik üstü tutar için onay sayısını söyler", () => {
    render(<SpendMessage amountFiat="6000.00" />);
    expect(screen.getByTestId("spend-message").textContent).toBe("Bu tutar için 2 kişinin onayı gerekiyor.");
    expect(fiatToShares("6000.00", "1.0000000", "50.0000000") > SPEND_THRESHOLD_STROOPS).toBe(true);
  });
});
