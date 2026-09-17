import { NETWORK, PORTS, VAULT_INIT } from "../../../../config/simulation";

/**
 * Web'in bildiği sabitler. Hepsi config/simulation.ts'ten gelir; burada yeni sabit tanımlanmaz.
 * API adresi build ortamından geçilebilir; yoksa ⚠ SİM port kullanılır.
 */
export const API_URL = process.env.NEXT_PUBLIC_KASA_API_URL ?? `http://localhost:${PORTS.api}`;
export const NETWORK_PASSPHRASE = NETWORK.networkPassphrase;
export const EXPLORER_NETWORK = "testnet" as const;

/** Onaysız üst limit ve onay sayısı — kontrat `init` argümanlarıyla aynı kaynaktan (⚠ SİM). */
export const SPEND_THRESHOLD_STROOPS: bigint = VAULT_INIT.threshold;
export const SPEND_QUORUM = VAULT_INIT.quorum;

/** Anchor durumunu yoklama aralığı (ms). Mock adım süresi 3 sn; gerçek anchor'da da makul. */
export const STATUS_POLL_MS = 2000;
