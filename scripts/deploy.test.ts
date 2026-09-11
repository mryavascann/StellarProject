import { describe, expect, it, vi } from "vitest";

import { deploySharedVault } from "./deploy.js";

const CONTRACT_ID = `C${"B".repeat(55)}`;
const SHARE_TOKEN_ID = `C${"A".repeat(55)}`;
const ENV = `ADMIN_SECRET=S-ADMIN
ADMIN_PUBLIC=G-ADMIN
MEMBER_A_PUBLIC=G-A
MEMBER_B_PUBLIC=G-B
MEMBER_C_PUBLIC=G-C
MOCK_DFTOKEN_CONTRACT_ID=${SHARE_TOKEN_ID}
SHARED_VAULT_CONTRACT_ID=
`;

describe("deploySharedVault", () => {
  it("Wasm'ı deploy eder, simülasyon ayarlarıyla init çağırır ve üyeleri ekler", async () => {
    const deployContract = vi.fn(async () => CONTRACT_ID);
    const invokeContract = vi.fn(async () => undefined);

    const result = await deploySharedVault(
      ENV,
      { threshold: 200_000_000n, quorum: 2, requestTtlSeconds: 259_200 },
      { deployContract, invokeContract },
    );

    expect(deployContract).toHaveBeenCalledWith("S-ADMIN");
    expect(invokeContract.mock.calls).toEqual([
      [CONTRACT_ID, "S-ADMIN", "init", ["--admin", "G-ADMIN", "--share_token", SHARE_TOKEN_ID, "--threshold", "200000000", "--quorum", "2", "--request_ttl", "259200"]],
      [CONTRACT_ID, "S-ADMIN", "add_member", ["--caller", "G-ADMIN", "--new_member", "G-A"]],
      [CONTRACT_ID, "S-ADMIN", "add_member", ["--caller", "G-ADMIN", "--new_member", "G-B"]],
      [CONTRACT_ID, "S-ADMIN", "add_member", ["--caller", "G-ADMIN", "--new_member", "G-C"]],
    ]);
    expect(result.environment).toContain(`SHARED_VAULT_CONTRACT_ID=${CONTRACT_ID}`);
  });

  it("geçersiz deploy çıktısıyla init çağırmaz", async () => {
    const invokeContract = vi.fn(async () => undefined);
    await expect(
      deploySharedVault(
        ENV,
        { threshold: 1n, quorum: 1, requestTtlSeconds: 1 },
        { deployContract: async () => "hatalı", invokeContract },
      ),
    ).rejects.toThrow("contract ID");
    expect(invokeContract).not.toHaveBeenCalled();
  });

  it("mock token ID eksikse deploy öncesi durur", async () => {
    const deployContract = vi.fn(async () => CONTRACT_ID);
    await expect(
      deploySharedVault("ADMIN_SECRET=S\n", { threshold: 1n, quorum: 1, requestTtlSeconds: 1 }, {
        deployContract,
        invokeContract: async () => undefined,
      }),
    ).rejects.toThrow("ADMIN_PUBLIC");
    expect(deployContract).not.toHaveBeenCalled();
  });
});
