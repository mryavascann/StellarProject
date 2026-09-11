/**
 * CANLI KONFİGÜRASYON — MASTER PROMPT Bölüm A.5
 *
 * Burada SABİT YOKTUR. Etkinlik günü alınacak her değer ya `.env`'den ya da anchor'ın
 * `/info` ucundan gelir. Bilinmeyen bir değeri buraya yazmak Bölüm 0.3'ün (uydurma yasağı)
 * ihlalidir — bu yüzden dosya, eksik env'de açılışta PATLAR; sessizce varsayılana düşmez.
 *
 * Neden patlıyor: canlıya geçiş 2 saatlik bir fazda (Faz 0) yapılacak. Eksik bir env yüzünden
 * yanlış anchor'a veya yanlış vault'a bağlanmak, sessiz bir hatayla saatler kaybettirir.
 *
 * DİKKAT — bu dosyada olmayan ve KASITLI olarak olmayacak şeyler:
 *   komisyonlar, min/max limitler, quote ömrü, JWT ömrü, `features` bayrakları.
 * Bunların hepsi anchor `/info`'sundan ÇALIŞMA ZAMANINDA okunur (Bölüm 9 kural 11:
 * "`/info` sözleşmedir"). A.5: "Gerçek komisyon ve limitler → otomatik okunur, kod değişmez."
 */

import { NETWORK, PORTS, STROOPS_PER_UNIT } from "./simulation";

/**
 * Zorunlu ortam değişkenini okur, yoksa anlaşılır bir hatayla durur.
 * Neden ayrı fonksiyon: her eksik env için aynı, aranabilir hata metnini üretmek;
 * etkinlik günü "neden bağlanmıyor" sorusunun cevabı ilk satırda görünsün.
 */
function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value.trim() === "") {
    throw new Error(
      `[config/live] Zorunlu ortam değişkeni eksik: ${key}. ` +
        `Canlı modda varsayılan değer kullanılmaz (bkz. MASTER PROMPT A.5 geçiş listesi).`,
    );
  }
  return value.trim();
}

/**
 * Uygulama kodunun okumaya hakkı olan konfigürasyon yüzeyi.
 * Hem `config/live.ts` hem `config/simulation.ts` bunu karşılar; böylece mod değişince
 * iş mantığında hiçbir alan kaybolmaz (K-003).
 */
export interface KasaRuntimeConfig {
  readonly mode: "simulation" | "live";
  readonly network: typeof NETWORK;
  readonly ports: typeof PORTS;
  readonly anchor: {
    /** SEP-1 TOML'in aranacağı domain. Kodda hardcoded domain YOK (Bölüm 9 sonu). */
    readonly homeDomain: string;
    readonly fiatCode: string;
    readonly assetCode: string;
    /** `asset_code` tek başına belirsizdir; issuer ile eşlenir (Bölüm 9 kural 7). */
    readonly assetIssuer: string | null;
  };
  readonly defindex: {
    readonly vaultId: string | null;
    readonly apiKey: string;
  };
  readonly contracts: {
    readonly sharedVaultId: string | null;
    /** Kasanın tuttuğu tek varlık (K-001). Canlıda gerçek dfToken adresi. */
    readonly shareTokenId: string | null;
  };
}

/**
 * Canlı konfigürasyonu ortamdan kurar.
 * Fonksiyon olmasının sebebi: modül yüklenir yüklenmez patlamasın — testler simülasyon
 * modunda bu dosyayı import edebilmeli, ama canlı env'leri istemeye hakkı olmamalı.
 */
export function loadLiveConfig(): KasaRuntimeConfig {
  return {
    mode: "live",
    network: NETWORK,
    ports: PORTS,
    anchor: {
      // A.5: Workshop #3'ten alınır
      homeDomain: requireEnv("ANCHOR_HOME_DOMAIN"),
      fiatCode: requireEnv("ANCHOR_FIAT_CODE"),
      assetCode: requireEnv("ANCHOR_ASSET_CODE"),
      // A.5: gerçek USDC issuer faucet.circle.com'dan DOĞRULANARAK alınır, ezberden yazılmaz
      assetIssuer: requireEnv("ANCHOR_ASSET_ISSUER"),
    },
    defindex: {
      // A.5: DeFindex Discord / docs
      vaultId: requireEnv("DEFINDEX_VAULT_ID"),
      apiKey: requireEnv("DEFINDEX_API_KEY"),
    },
    contracts: {
      sharedVaultId: requireEnv("SHARED_VAULT_CONTRACT_ID"),
      // A.5: getVaultInfo() çıktısından; değişince kontrat yeniden init edilir
      shareTokenId: requireEnv("SHARE_TOKEN_ID"),
    },
  };
}

export { STROOPS_PER_UNIT };
