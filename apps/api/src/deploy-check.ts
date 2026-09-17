import { Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PORTS } from "../../../config/simulation";
import { loadEnvironment } from "./env";

export interface DeployCheckOptions {
  /** Jüri demosunun açılacağı adres; HTTPS olmak zorunda. */
  readonly origin: string;
  /** SEP-10 challenge istenecek hesap; para hareketi olmaz, yalnız imzasız challenge okunur. */
  readonly account: string;
}

export interface DeployCheckDependencies {
  readonly fetcher?: (input: string, init?: RequestInit) => Promise<Response>;
}

export interface DeployCheckReport {
  readonly origin: string;
  readonly signingKey: string;
  readonly assetIssuer: string;
  readonly anchorMode: string;
  readonly trustlineRequired: boolean;
  readonly challengeSequence: string;
  readonly contractId: string;
  readonly balance: string;
  readonly memberCount: number;
  readonly scannedChunks: number;
}

interface TomlView {
  readonly signingKey: string;
  readonly issuer: string;
}

const TOML_ENDPOINT_KEYS = ["TRANSFER_SERVER_SEP0024", "WEB_AUTH_ENDPOINT", "ANCHOR_QUOTE_SERVER"] as const;

/** TOML'daki tırnaklı tek satırlık alanı okur; eksikse hangi alanın eksik olduğunu söyler. */
function tomlField(body: string, key: string): string {
  const match = new RegExp(`^${key}\\s*=\\s*"([^"]+)"`, "mu").exec(body);
  if (!match?.[1]) throw new Error(`stellar.toml içinde ${key} yok.`);
  return match[1];
}

/**
 * Dağıtılmış yığının demo için hazır olduğunu salt-okunur çağrılarla doğrular.
 * Yerel testler geçse bile rewrite kuralı, env değeri veya istemci paketi kaymış olabilir;
 * bu kontrol tam olarak o kaymaları yakalar, çünkü demo bu origin üzerinden yapılacak.
 */
export async function runDeployChecks(
  options: DeployCheckOptions,
  dependencies: DeployCheckDependencies = {},
): Promise<DeployCheckReport> {
  const fetcher = dependencies.fetcher ?? ((input: string, init?: RequestInit) => fetch(input, init));
  const url = new URL(options.origin);
  if (url.protocol !== "https:") throw new Error(`Dağıtım origin'i HTTPS olmalı; gelen: ${options.origin}`);
  const origin = url.origin;

  const get = async (pathname: string): Promise<Response> => {
    const response = await fetcher(`${origin}${pathname}`);
    if (!response.ok) throw new Error(`${pathname} → HTTP ${response.status}`);
    return response;
  };
  const getJson = async <T>(pathname: string): Promise<T> => (await get(pathname)).json() as Promise<T>;

  const health = await getJson<{ ok?: boolean }>("/health");
  if (health.ok !== true) throw new Error("/health ucu ok dönmedi; dağıtım ayakta değil.");

  const toml = await readToml(get, origin);
  const info = await readSep24Info(getJson);
  const challengeSequence = await readChallengeSequence(getJson, options.account);
  const anchor = await readAnchorInfo(getJson, url.host, toml);
  const vault = await readVault(getJson);
  const scannedChunks = await scanClientBundle(get, origin, fetcher);

  return {
    origin,
    signingKey: toml.signingKey,
    assetIssuer: toml.issuer,
    anchorMode: anchor.mode,
    trustlineRequired: info.trustlineRequired,
    challengeSequence,
    contractId: vault.contractId,
    balance: vault.balance,
    memberCount: vault.members.length,
    scannedChunks,
  };
}

/** SEP-1: TOML'un varlığını ve tüm uçlarının aynı origin'i gösterdiğini doğrular. */
async function readToml(get: (pathname: string) => Promise<Response>, origin: string): Promise<TomlView> {
  const response = await get("/.well-known/stellar.toml");
  if (response.headers.get("access-control-allow-origin") !== "*") {
    throw new Error("stellar.toml CORS başlığı yıldız değil; cüzdanlar okuyamaz.");
  }
  const body = await response.text();
  for (const key of TOML_ENDPOINT_KEYS) {
    const value = tomlField(body, key);
    if (!value.startsWith(`${origin}/`)) {
      throw new Error(`${key} bu dağıtımı göstermiyor: ${value} (beklenen ${origin}/…).`);
    }
  }
  return { signingKey: tomlField(body, "SIGNING_KEY"), issuer: tomlField(body, "issuer") };
}

/** SEP-24 `/info`: para giriş/çıkışı açık mı ve trustline zorunlu mu (Bölüm 9 kural 5, 11). */
async function readSep24Info(
  getJson: <T>(pathname: string) => Promise<T>,
): Promise<{ readonly trustlineRequired: boolean }> {
  const info = await getJson<{
    deposit?: Record<string, { enabled?: boolean }>;
    withdraw?: Record<string, { enabled?: boolean }>;
    features?: { claimable_balances?: boolean };
  }>("/sep24/info");
  const enabled = (side: Record<string, { enabled?: boolean }> | undefined) =>
    Object.values(side ?? {}).some((entry) => entry.enabled === true);
  if (!enabled(info.deposit)) throw new Error("Dağıtımdaki anchor'da deposit kapalı.");
  if (!enabled(info.withdraw)) throw new Error("Dağıtımdaki anchor'da withdraw kapalı.");
  return { trustlineRequired: info.features?.claimable_balances !== true };
}

/** SEP-10: challenge geliyor mu ve sequence number 0 mı (ağa gönderilmeyecek işlem). */
async function readChallengeSequence(
  getJson: <T>(pathname: string) => Promise<T>,
  account: string,
): Promise<string> {
  const { transaction } = await getJson<{ transaction?: string }>(
    `/auth?account=${encodeURIComponent(account)}`,
  );
  if (!transaction) throw new Error("/auth challenge döndürmedi.");
  const challenge = TransactionBuilder.fromXDR(transaction, Networks.TESTNET);
  if (!(challenge instanceof Transaction)) throw new Error("SEP-10 challenge normal bir transaction olmalı.");
  if (challenge.sequence !== "0") {
    throw new Error(`SEP-10 challenge sequence number 0 olmalı; gelen: ${challenge.sequence}.`);
  }
  return challenge.sequence;
}

/** API ile anchor aynı varlığı mı gösteriyor: `asset_code` tek başına belirsizdir (kural 7). */
async function readAnchorInfo(
  getJson: <T>(pathname: string) => Promise<T>,
  host: string,
  toml: TomlView,
): Promise<{ readonly mode: string }> {
  const info = await getJson<{ mode?: string; homeDomain?: string; assetIssuer?: string }>("/api/anchor/info");
  if (info.homeDomain !== host) {
    throw new Error(`API'nin anchor domain'i dağıtımla uyuşmuyor: ${info.homeDomain ?? "yok"} ≠ ${host}.`);
  }
  if (info.assetIssuer !== toml.issuer) {
    throw new Error(`API varlığının issuer değeri TOML ile uyuşmuyor: ${info.assetIssuer ?? "yok"} ≠ ${toml.issuer}.`);
  }
  return { mode: info.mode ?? "bilinmiyor" };
}

/** Kasa gerçekten okunuyor mu: kontrat kimliği, bakiye ve en az bir üye. */
async function readVault(getJson: <T>(pathname: string) => Promise<T>) {
  const vault = await getJson<{
    contractId?: string;
    balance?: string;
    members?: readonly unknown[];
  }>("/api/vault");
  if (!vault.contractId) throw new Error("/api/vault kontrat kimliği döndürmedi.");
  if (typeof vault.balance !== "string") throw new Error("/api/vault bakiyesi string değil; tutarlar string taşınır.");
  const members = vault.members ?? [];
  if (members.length === 0) throw new Error("/api/vault üye döndürmedi; demo kasası boş.");
  return { contractId: vault.contractId, balance: vault.balance, members };
}

/**
 * Dağıtılmış istemci paketinin hangi API adresine baktığını denetler.
 * `NEXT_PUBLIC_KASA_API_URL` build sırasında gömülür; ayarlanmadıysa paket sessizce
 * localhost portuna bakar ve hata yalnız jürinin tarayıcısında görünür.
 */
async function scanClientBundle(
  get: (pathname: string) => Promise<Response>,
  origin: string,
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
): Promise<number> {
  const page = await (await get("/giris")).text();
  const sources = [...page.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/gu)].map((match) => match[1] as string);
  if (sources.length === 0) throw new Error("/giris sayfasında istemci paketi bulunamadı.");

  const localhostApi = `localhost:${PORTS.api}`;
  let originReferences = 0;
  for (const source of sources) {
    const body = await (await fetcher(`${origin}${source}`)).text();
    if (body.includes(localhostApi)) {
      throw new Error(`Dağıtılmış paket ${localhostApi} adresine bakıyor: ${source}. NEXT_PUBLIC_KASA_API_URL eksik.`);
    }
    if (body.includes(origin)) originReferences += 1;
  }
  if (originReferences === 0) {
    throw new Error(`Dağıtılmış paket ${origin} adresini hiç içermiyor; API adresi yanlış gömülmüş olabilir.`);
  }
  return sources.length;
}

async function main(): Promise<void> {
  const environment = loadEnvironment();
  const origin = process.env.KASA_DEPLOY_URL ?? environment.KASA_DEPLOY_URL;
  const account = environment.ADMIN_PUBLIC;
  if (!origin) throw new Error("KASA_DEPLOY_URL eksik.");
  if (!account) throw new Error("ADMIN_PUBLIC eksik.");
  const report = await runDeployChecks({ origin, account });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Dağıtım duman testi başarısız: ${message}\n`);
    process.exitCode = 1;
  });
}
