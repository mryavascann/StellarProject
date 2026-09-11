import { describe, expect, it } from "vitest";

import { createApi, type VaultSnapshot } from "./app.js";

const SNAPSHOT: VaultSnapshot = {
  balance: 1_600_000_000n,
  members: [{ address: "GADMIN", joinedAt: 1, contributed: 500_000_000n, withdrawn: 0n }],
  requests: [{
    id: 0,
    requester: "GADMIN",
    amount: 1_200_000_000n,
    note: "Kira Ekim",
    approvals: ["GMEMBER"],
    status: "Pending",
    createdAt: 1,
    expiresAt: 2,
  }],
};

describe("Kasa API", () => {
  it("sağlık ve kasa görünümünü bigint kaybetmeden JSON olarak sunar", async () => {
    const app = createApi({ readVault: async () => SNAPSHOT });
    expect((await app.request("/health")).status).toBe(200);
    const response = await app.request("/api/vault");
    const body = await response.json() as Record<string, any>;

    expect(body.balance).toBe("1600000000");
    expect(body.members[0].contributed).toBe("500000000");
    expect(body.requests[0].amount).toBe("1200000000");
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("RPC hatasını ham ayrıntı sızdırmadan 503 olarak döndürür", async () => {
    const app = createApi({ readVault: async () => { throw new Error("secret rpc detail"); } });
    const response = await app.request("/api/vault");
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret rpc detail");
  });
});
