import { describe, expect, it, vi } from "vitest";

import { seedSimulation, type SeedChainState } from "./seed.js";

const ENV = `ADMIN_SECRET=S-ADMIN
ADMIN_PUBLIC=G-ADMIN
MEMBER_A_SECRET=S-A
MEMBER_A_PUBLIC=G-A
MEMBER_B_SECRET=S-B
MEMBER_B_PUBLIC=G-B
MEMBER_C_SECRET=S-C
MEMBER_C_PUBLIC=G-C
SHARED_VAULT_CONTRACT_ID=C${"V".repeat(55)}
`;

const EMPTY_STATE: SeedChainState = {
  members: [
    { address: "G-ADMIN", contributed: 0n },
    { address: "G-A", contributed: 0n },
    { address: "G-B", contributed: 0n },
    { address: "G-C", contributed: 0n },
  ],
  requests: [],
};

describe("seedSimulation", () => {
  it("demo katkılarını ve iki örnek talebi doğru stroop tutarlarıyla yazar", async () => {
    const invoke = vi.fn(async (_secret: string, fn: string) => (fn === "request_spend" ? "0" : ""));

    await seedSimulation(ENV, EMPTY_STATE, invoke);

    expect(invoke.mock.calls).toEqual([
      ["S-ADMIN", "deposit", ["--member", "G-ADMIN", "--amount", "500000000"]],
      ["S-A", "deposit", ["--member", "G-A", "--amount", "500000000"]],
      ["S-B", "deposit", ["--member", "G-B", "--amount", "300000000"]],
      ["S-C", "deposit", ["--member", "G-C", "--amount", "300000000"]],
      ["S-ADMIN", "request_spend", ["--member", "G-ADMIN", "--amount", "1200000000", "--note", "Kira Ekim"]],
      ["S-A", "approve", ["--member", "G-A", "--request_id", "0"]],
      ["S-A", "request_spend", ["--member", "G-A", "--amount", "150000000", "--note", "İnternet faturası"]],
    ]);
  });

  it("mevcut katkı ve talepleri ikinci kez yazmaz", async () => {
    const invoke = vi.fn(async () => "");
    const state: SeedChainState = {
      members: [
        { address: "G-ADMIN", contributed: 500_000_000n },
        { address: "G-A", contributed: 500_000_000n },
        { address: "G-B", contributed: 300_000_000n },
        { address: "G-C", contributed: 300_000_000n },
      ],
      requests: [
        { id: 4, requester: "G-ADMIN", amount: 1_200_000_000n, note: "Kira Ekim", approvals: ["G-A"] },
        { id: 5, requester: "G-A", amount: 150_000_000n, note: "İnternet faturası", approvals: [] },
      ],
    };

    await seedSimulation(ENV, state, invoke);

    expect(invoke).not.toHaveBeenCalled();
  });

  it("yarım kalmış katkıyı yalnızca hedefe kadar tamamlar ve eksik onayı ekler", async () => {
    const invoke = vi.fn(async () => "");
    const state: SeedChainState = {
      members: [
        { address: "G-ADMIN", contributed: 400_000_000n },
        { address: "G-A", contributed: 500_000_000n },
        { address: "G-B", contributed: 300_000_000n },
        { address: "G-C", contributed: 300_000_000n },
      ],
      requests: [
        { id: 7, requester: "G-ADMIN", amount: 1_200_000_000n, note: "Kira Ekim", approvals: [] },
        { id: 8, requester: "G-A", amount: 150_000_000n, note: "İnternet faturası", approvals: [] },
      ],
    };

    await seedSimulation(ENV, state, invoke);

    expect(invoke.mock.calls).toEqual([
      ["S-ADMIN", "deposit", ["--member", "G-ADMIN", "--amount", "100000000"]],
      ["S-A", "approve", ["--member", "G-A", "--request_id", "7"]],
    ]);
  });

  it("aynı notla uyuşmayan zincir verisini sessizce kabul etmez", async () => {
    const invoke = vi.fn(async () => "");
    const state: SeedChainState = {
      ...EMPTY_STATE,
      requests: [
        { id: 1, requester: "G-C", amount: 1n, note: "Kira Ekim", approvals: [] },
      ],
    };

    await expect(seedSimulation(ENV, state, invoke)).rejects.toThrow("Kira Ekim");
    expect(invoke).not.toHaveBeenCalled();
  });
});
