import { StrKey } from "@stellar/stellar-sdk";

export interface JoinResult {
  /** Hesap zincirde yoktu ve test parasıyla açıldı mı? */
  readonly funded: boolean;
  /** Bu çağrıda kasaya üye eklendi mi? (zaten üyeyse false) */
  readonly added: boolean;
  readonly hash?: string;
}

export interface VaultJoinerDependencies {
  /** Kontratın admin anahtarı. Yoksa katılma kapalıdır ve bunu açıkça söyleriz. */
  readonly adminSecret: string | undefined;
  members(): Promise<readonly string[]>;
  accountExists(account: string): Promise<boolean>;
  /** Testnet'te hesabı açan friendbot çağrısı. */
  fund(account: string): Promise<void>;
  /** admin adına `add_member` kurar, imzalar, gönderir. */
  addMember(account: string): Promise<{ hash: string }>;
}

/**
 * Davet akışı: bir cüzdan adresi verilir, gerekiyorsa hesap açılır ve kasaya üye yapılır.
 *
 * Neden sunucu imzalıyor: kontratın yetki modeli değişmiyor — `add_member` hâlâ yalnız
 * admin'e açık (Bölüm 8.1 test 5). Demo kasasının adminini sunucu taşıdığı için davet linkiyle
 * gelen herkes tek dokunuşla katılabiliyor; arkadaşların cüzdanını tek tek elle eklemek gerekmiyor.
 */
export function createVaultJoiner(dependencies: VaultJoinerDependencies) {
  return async function join(account: string): Promise<JoinResult> {
    if (!StrKey.isValidEd25519PublicKey(account)) {
      throw new TypeError("Geçerli bir Stellar adresi gerekli (G ile başlar).");
    }
    if (!dependencies.adminSecret) {
      throw new Error("Kasaya katılma kapalı: sunucuda ADMIN_SECRET tanımlı değil.");
    }

    const members = await dependencies.members();
    if (members.includes(account)) return { funded: false, added: false };

    const exists = await dependencies.accountExists(account);
    if (!exists) await dependencies.fund(account);

    const { hash } = await dependencies.addMember(account);
    return { funded: !exists, added: true, hash };
  };
}
