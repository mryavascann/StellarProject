import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

import { JoinCard } from "./JoinCard";

const ADDRESS = "GAFLY62VHV6AHVNXQWXCRG7OGQRXHIYGVO2OIT3QYVRBHVJGKUOGEPIP";

describe("kasaya katılma kartı", () => {
  it("tek dokunuşla katılır ve ekranı tazeler", async () => {
    const join = vi.fn(async () => ({ funded: true, added: true, hash: "a".repeat(64) }));
    const onJoined = vi.fn();
    render(<JoinCard address={ADDRESS} join={join} onJoined={onJoined} />);

    fireEvent.click(screen.getByRole("button", { name: /katıl/iu }));

    await waitFor(() => expect(onJoined).toHaveBeenCalledOnce());
    expect(join).toHaveBeenCalledWith(ADDRESS);
  });

  it("katılamazsa sebebi ekranda söyler ve tekrar denenebilir", async () => {
    const join = vi.fn(async () => {
      throw new Error("Kasaya katılma kapalı: sunucuda ADMIN_SECRET tanımlı değil.");
    });
    render(<JoinCard address={ADDRESS} join={join} onJoined={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /katıl/iu }));

    await waitFor(() => expect(screen.getByText(/ADMIN_SECRET/u)).toBeTruthy());
    expect(screen.getByRole("button", { name: /katıl/iu })).toBeTruthy();
  });
});
