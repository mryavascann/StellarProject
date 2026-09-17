import { Keypair, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { NETWORK_PASSPHRASE } from "./config";

/** İmzalayıcı: cüzdan (Stellar Wallets Kit) ya da test anahtarı. Akışlar yalnızca bu arayüzü görür. */
export interface Signer {
  readonly kind: "wallet" | "key";
  readonly address: string;
  sign(unsignedXdr: string): Promise<string>;
  disconnect?(): Promise<void>;
}

/**
 * Gizli anahtarla imzalayıcı — YALNIZCA test ve demo hesapları için.
 * Neden var: tarayıcı eklentisi olmayan makinede (ve uçtan uca testte) akışı sonuna kadar
 * koşturmak gerekiyor. Anahtar sekme belleğinde durur, sunucuya asla gitmez.
 */
export function createKeySigner(secret: string): Signer {
  const keypair = Keypair.fromSecret(secret);
  return {
    kind: "key",
    address: keypair.publicKey(),
    async sign(unsignedXdr) {
      const transaction = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
      if (!(transaction instanceof Transaction)) throw new Error("Fee-bump işlemi imzalanmaz.");
      transaction.sign(keypair);
      return transaction.toXDR();
    },
  };
}

let kitReady = false;

/**
 * Modalda gösterilmeyen cüzdanlar.
 *
 * LOBSTR: modülü `networkPassphrase` değerini kaynak kodunda açıkça atlıyor
 * ("Lobstr doesn't allow specifying the network that should be used, we skip the value"),
 * yani ona testnet için imzalatamayız. Ayrıca lobstr.co web cüzdanını değil ayrı bir
 * tarayıcı eklentisi ister; eklenti yokken kullanıcı lobstr.co'ya düşer ve hiçbir şey olmaz.
 * Listede görünüp çalışmamak, demoda olabilecek en kötü sonuç.
 */
const NON_TESTNET_WALLETS = new Set(["lobstr"]);

/** Cüzdan testnet'te imzalayabiliyor mu; modal yalnızca bunları gösterir. */
export function isTestnetCapableWallet(productId: string): boolean {
  return !NON_TESTNET_WALLETS.has(productId);
}

/**
 * Stellar Wallets Kit v2 (Freighter, xBull, Albedo…). Yalnızca tarayıcıda çalışır;
 * bu yüzden dinamik import edilir ve sunucu tarafında hiç yüklenmez.
 */
export async function connectWalletKit(): Promise<Signer> {
  const [{ StellarWalletsKit }, { defaultModules }] = await Promise.all([
    import("@creit.tech/stellar-wallets-kit/sdk"),
    import("@creit.tech/stellar-wallets-kit/modules/utils"),
  ]);
  if (!kitReady) {
    StellarWalletsKit.init({ modules: defaultModules({ filterBy: (module) => isTestnetCapableWallet(module.productId) }) });
    kitReady = true;
  }
  const { address } = await StellarWalletsKit.authModal();
  return {
    kind: "wallet",
    address,
    async sign(unsignedXdr) {
      const { signedTxXdr } = await StellarWalletsKit.signTransaction(unsignedXdr, { networkPassphrase: NETWORK_PASSPHRASE, address });
      return signedTxXdr;
    },
    disconnect: () => StellarWalletsKit.disconnect(),
  };
}
