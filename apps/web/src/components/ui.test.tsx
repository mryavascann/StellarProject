import { ANCHOR_STATUSES, BRAND } from "@kasa/core";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

import { statusText } from "@/lib/format";

import { EmptyState, ErrorState, Skeleton, StatusBadge, Steps } from "./ui";

describe("ekran durumları", () => {
  it("boş durum mesajı ve tek birincil eylemi gösterir", () => {
    render(<EmptyState message={BRAND.messages.emptyLedger} actionLabel="Para yatır" href="/yatir" />);
    expect(screen.getByText(BRAND.messages.emptyLedger)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Para yatır" }).getAttribute("href")).toBe("/yatir");
  });

  it("yükleniyor durumu iskelet gösterir, 'Yükleniyor…' yazısı yok", () => {
    const { container } = render(<Skeleton lines={2} />);
    expect(screen.getByTestId("skeleton")).toBeTruthy();
    expect(container.textContent).not.toContain("Yükleniyor");
  });

  it("hata durumu mesaj + tekrar dene gösterir; ham ayrıntı yalnızca geliştirici modunda", () => {
    const retry = vi.fn();
    const { rerender } = render(<ErrorState message="Kasa verisi alınamadı." detail="rpc timeout" onRetry={retry} />);
    expect(screen.queryByText("rpc timeout")).toBeNull();
    screen.getByRole("button", { name: BRAND.messages.retry }).click();
    expect(retry).toHaveBeenCalled();
    rerender(<ErrorState message="Kasa verisi alınamadı." detail="rpc timeout" devMode />);
    expect(screen.getByText("rpc timeout")).toBeTruthy();
  });
});

describe("durum rozeti", () => {
  it.each(ANCHOR_STATUSES)("%s için brand.md başlığını ve tonunu gösterir", (status) => {
    const text = statusText("deposit", status);
    render(<StatusBadge tone={text.tone} label={text.title} />);
    const badge = screen.getByText(BRAND.statusText.deposit[status].title).closest("[data-tone]");
    expect(badge?.getAttribute("data-tone")).toBe(BRAND.statusText.deposit[status].tone);
  });

  it("adımlar Türkçe etiket ve durumla listelenir", () => {
    render(<Steps steps={[{ key: "banka", label: "Banka bağlantısı", state: "done" }, { key: "kasa", label: "Kasaya kilitle", state: "active" }]} />);
    expect(screen.getByText("Banka bağlantısı")).toBeTruthy();
    expect(screen.getByText("Sürüyor")).toBeTruthy();
  });
});
