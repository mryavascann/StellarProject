import { describe, expect, it, vi } from "vitest";

import { deployMockShareToken } from "./deploy-mock-token.js";

const ENV = `MOCK_USDC_ISSUER_SECRET=S-ISSUER
MOCK_USDC_ISSUER_PUBLIC=G-ISSUER
ADMIN_SECRET=S-ADMIN
MEMBER_A_SECRET=S-A
MEMBER_B_SECRET=S-B
MEMBER_C_SECRET=S-C
MOCK_DFTOKEN_CONTRACT_ID=
`;

describe("deployMockShareToken", () => {
  it("kUSDC varlığını deploy eder, dört üyeye bakiye verir ve contract ID'yi yazar", async () => {
    const deployAsset = vi.fn(async () => `C${"A".repeat(55)}`);
    const establishBalance = vi.fn(async () => undefined);

    const result = await deployMockShareToken(ENV, "1000.0000000", {
      deployAsset,
      establishBalance,
    });

    expect(deployAsset).toHaveBeenCalledWith("kUSDC:G-ISSUER", "S-ISSUER");
    expect(establishBalance.mock.calls).toEqual([
      ["S-ADMIN", "kUSDC", "G-ISSUER", "1000.0000000"],
      ["S-A", "kUSDC", "G-ISSUER", "1000.0000000"],
      ["S-B", "kUSDC", "G-ISSUER", "1000.0000000"],
      ["S-C", "kUSDC", "G-ISSUER", "1000.0000000"],
    ]);
    expect(result.environment).toContain(`MOCK_DFTOKEN_CONTRACT_ID=${result.contractId}`);
  });

  it("geçersiz contract ID çıktısını env'e yazmaz", async () => {
    await expect(
      deployMockShareToken(ENV, "1000.0000000", {
        deployAsset: async () => "not-a-contract",
        establishBalance: async () => undefined,
      }),
    ).rejects.toThrow("contract ID");
  });

  it("zorunlu secret eksikse ağ çağrısından önce durur", async () => {
    const deployAsset = vi.fn(async () => `C${"A".repeat(55)}`);
    await expect(
      deployMockShareToken("MOCK_DFTOKEN_CONTRACT_ID=\n", "1000.0000000", {
        deployAsset,
        establishBalance: async () => undefined,
      }),
    ).rejects.toThrow("MOCK_USDC_ISSUER_SECRET");
    expect(deployAsset).not.toHaveBeenCalled();
  });
});
