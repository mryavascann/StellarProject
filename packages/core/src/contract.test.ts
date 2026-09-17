import { describe, expect, it } from "vitest";

import { parseContractMembers, parseContractRequests } from "./contract";

const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";

describe("kontrat yanıt ayrıştırıcıları", () => {
  it("para alanlarını number'a çevirmeden bigint olarak korur", () => {
    const [member] = parseContractMembers([
      { address: ADDRESS, joined_at: 123, contributed: "900719925474099300000", withdrawn: "0" },
    ]);

    expect(member?.contributed).toBe(900_719_925_474_099_300_000n);
    expect(member?.withdrawn).toBe(0n);
  });

  it("RPC'den gelen dizi biçimli enum durumunu (['Pending']) metinle aynı kabul eder", () => {
    const [request] = parseContractRequests([
      { id: 1, requester: ADDRESS, amount: 1n, note: "x", approvals: [], status: ["Pending"], created_at: 1n, expires_at: 2n },
    ]);
    expect(request?.status).toBe("Pending");
    expect(() =>
      parseContractRequests([{ id: 1, requester: ADDRESS, amount: 1n, note: "x", approvals: [], status: ["Bilinmeyen"], created_at: 1, expires_at: 2 }]),
    ).toThrow("bilinmeyen kontrat durumu");
  });

  it("talepleri durum ve onaylarıyla ayrıştırır", () => {
    const [request] = parseContractRequests([
      {
        id: 4,
        requester: ADDRESS,
        amount: "1200000000",
        note: "Kira Ekim",
        approvals: [ADDRESS],
        status: "Pending",
        created_at: 100,
        expires_at: 200,
      },
    ]);

    expect(request).toEqual({
      id: 4,
      requester: ADDRESS,
      amount: 1_200_000_000n,
      note: "Kira Ekim",
      approvals: [ADDRESS],
      status: "Pending",
      createdAt: 100,
      expiresAt: 200,
    });
  });

  it("bilinmeyen durum ve güvensiz tamsayıları reddeder", () => {
    expect(() =>
      parseContractRequests([
        {
          id: 1,
          requester: ADDRESS,
          amount: "1",
          note: "x",
          approvals: [],
          status: "Kayip",
          created_at: 1,
          expires_at: 2,
        },
      ]),
    ).toThrow("durum");
    expect(() => parseContractMembers([{ address: ADDRESS, joined_at: 1.5, contributed: "1", withdrawn: "0" }])).toThrow("tamsayı");
  });

  it("Soroban u64 zaman damgasını güvenli aralıktaysa bigint'ten dönüştürür", () => {
    const [member] = parseContractMembers([
      { address: ADDRESS, joined_at: 1_789_134_842n, contributed: 1n, withdrawn: 0n },
    ]);
    expect(member?.joinedAt).toBe(1_789_134_842);
  });
});
