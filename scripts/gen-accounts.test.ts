import { describe, expect, it, vi } from "vitest";

import { generateSimulationEnvironment } from "./gen-accounts.js";

const TEMPLATE = `KASA_MODE=simulation
ADMIN_SECRET=
ADMIN_PUBLIC=
MEMBER_A_SECRET=
MEMBER_A_PUBLIC=
MEMBER_B_SECRET=
MEMBER_B_PUBLIC=
MEMBER_C_SECRET=
MEMBER_C_PUBLIC=
MOCK_USDC_ISSUER_SECRET=
MOCK_USDC_ISSUER_PUBLIC=
MOCK_DFTOKEN_CONTRACT_ID=
SHARED_VAULT_CONTRACT_ID=
ANCHOR_HOME_DOMAIN=localhost:8788
MOCK_ANCHOR_SIGNING_SECRET=
DEFINDEX_API_KEY=simulation-not-used
`;

describe("generateSimulationEnvironment", () => {
  it("benzersiz hesapları üretir, zincir hesaplarını fonlar ve env metnini doldurur", async () => {
    let index = 0;
    const generated = Array.from({ length: 6 }, (_, position) => ({
      publicKey: `G-PUBLIC-${position}`,
      secret: `S-SECRET-${position}`,
    }));
    const fundAccount = vi.fn(async (_publicKey: string) => undefined);

    const result = await generateSimulationEnvironment(TEMPLATE, {
      createKeypair: () => generated[index++]!,
      fundAccount,
    });

    expect(index).toBe(6);
    expect(fundAccount.mock.calls.flat()).toEqual([
      "G-PUBLIC-0",
      "G-PUBLIC-1",
      "G-PUBLIC-2",
      "G-PUBLIC-3",
      "G-PUBLIC-4",
    ]);
    expect(result).toContain("ADMIN_SECRET=S-SECRET-0");
    expect(result).toContain("MEMBER_C_PUBLIC=G-PUBLIC-3");
    expect(result).toContain("MOCK_USDC_ISSUER_SECRET=S-SECRET-4");
    expect(result).toContain("MOCK_ANCHOR_SIGNING_SECRET=S-SECRET-5");
    expect(result).toContain("MOCK_DFTOKEN_CONTRACT_ID=\n");
    expect(result).toContain("SHARED_VAULT_CONTRACT_ID=\n");
  });

  it("Friendbot hatasını yutmaz ve çıktı üretmez", async () => {
    let index = 0;
    const fundAccount = vi.fn(async (publicKey: string) => {
      if (publicKey === "G-2") throw new Error("Friendbot 429");
    });

    await expect(
      generateSimulationEnvironment(TEMPLATE, {
        createKeypair: () => ({ publicKey: `G-${index}`, secret: `S-${index++}` }),
        fundAccount,
      }),
    ).rejects.toThrow("Friendbot 429");
  });

  it("şablonda zorunlu anahtar eksikse açık hata döndürür", async () => {
    await expect(
      generateSimulationEnvironment("KASA_MODE=simulation\n", {
        createKeypair: () => ({ publicKey: "G", secret: "S" }),
        fundAccount: async () => undefined,
      }),
    ).rejects.toThrow("ADMIN_SECRET");
  });
});
