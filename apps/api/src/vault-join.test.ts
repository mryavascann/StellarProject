// @vitest-environment node
/**
 * Davetle katılma: arkadaşın cüzdanını tek tek admin'e ekletmek zorunda kalmamak için.
 * Kontratın yetki modeli DEĞİŞMEZ (add_member hâlâ yalnız admin'e açık); imzayı sunucu atar.
 */
import { Keypair } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import { createVaultJoiner } from "./vault-join";

const admin = Keypair.random();
const guest = Keypair.random().publicKey();
const existing = Keypair.random().publicKey();

function joiner(overrides: { adminSecret?: string | undefined; accountExists?: boolean; members?: readonly string[] } = {}) {
  const fund = vi.fn(async () => undefined);
  const addMember = vi.fn(async () => ({ hash: "a".repeat(64) }));
  const join = createVaultJoiner({
    adminSecret: "adminSecret" in overrides ? overrides.adminSecret : admin.secret(),
    members: async () => overrides.members ?? [existing],
    accountExists: async () => overrides.accountExists ?? false,
    fund,
    addMember,
  });
  return { join, fund, addMember };
}

describe("kasaya katılma", () => {
  it("zincirde olmayan yeni cüzdanı önce fonlar, sonra üye yapar", async () => {
    const { join, fund, addMember } = joiner();
    const result = await join(guest);

    expect(result).toEqual({ funded: true, added: true, hash: "a".repeat(64) });
    expect(fund).toHaveBeenCalledWith(guest);
    expect(addMember).toHaveBeenCalledWith(guest);
  });

  it("hesap zaten zincirdeyse test parası istemez", async () => {
    const { join, fund, addMember } = joiner({ accountExists: true });
    expect(await join(guest)).toEqual({ funded: false, added: true, hash: "a".repeat(64) });
    expect(fund).not.toHaveBeenCalled();
    expect(addMember).toHaveBeenCalledOnce();
  });

  it("zaten üye olanı ikinci kez eklemez", async () => {
    const { join, fund, addMember } = joiner({ accountExists: true, members: [existing, guest] });
    expect(await join(guest)).toEqual({ funded: false, added: false });
    expect(addMember).not.toHaveBeenCalled();
    expect(fund).not.toHaveBeenCalled();
  });

  it("geçersiz adresi zincire hiç gitmeden reddeder", async () => {
    const { join, addMember } = joiner();
    await expect(join("BOZUKADRES")).rejects.toBeInstanceOf(TypeError);
    await expect(join(admin.secret())).rejects.toThrow(/adres/iu);
    expect(addMember).not.toHaveBeenCalled();
  });

  it("sunucuda admin anahtarı yoksa ne olduğunu söyler", async () => {
    const { join } = joiner({ adminSecret: undefined });
    await expect(join(guest)).rejects.toThrow(/ADMIN_SECRET/u);
  });
});
