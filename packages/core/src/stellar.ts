import { StrKey } from "@stellar/stellar-sdk";

export type StellarNetwork = "testnet";
export type ExplorerResource = "account" | "contract" | "tx";

/** Stellar G-adresini doğrular ve tip daraltmaya uygun biçimde geri döndürür. */
export function assertAccountAddress(value: string): string {
  if (!StrKey.isValidEd25519PublicKey(value)) {
    throw new TypeError(`Geçersiz Stellar hesap adresi: ${value}`);
  }
  return value;
}

/** Stellar C-adresini doğrular ve tip daraltmaya uygun biçimde geri döndürür. */
export function assertContractAddress(value: string): string {
  if (!StrKey.isValidContract(value)) {
    throw new TypeError(`Geçersiz Stellar kontrat adresi: ${value}`);
  }
  return value;
}

/** Uzun Stellar adresini arayüzde güvenli ve ayırt edilebilir biçimde kısaltır. */
export function shortAddress(value: string): string {
  if (value.length <= 13) return value;
  return `${value.slice(0, 6)}…${value.slice(-6)}`;
}

/** Testnet kaynağı için Stellar Expert bağlantısı üretir. */
export function explorerUrl(
  resource: ExplorerResource,
  identifier: string,
  network: StellarNetwork,
): string {
  if (resource === "account") assertAccountAddress(identifier);
  if (resource === "contract") assertContractAddress(identifier);
  if (resource === "tx" && !/^[a-f\d]{64}$/iu.test(identifier)) {
    throw new TypeError(`Geçersiz Stellar işlem özeti: ${identifier}`);
  }
  return `https://stellar.expert/explorer/${network}/${resource}/${identifier}`;
}
