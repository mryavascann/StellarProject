import { Keypair } from "@stellar/stellar-sdk";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NETWORK } from "../config/simulation.js";

interface GeneratedKeypair {
  readonly publicKey: string;
  readonly secret: string;
}

export interface AccountGenerationDependencies {
  readonly createKeypair: () => GeneratedKeypair;
  readonly fundAccount: (publicKey: string) => Promise<void>;
}

const ACCOUNT_ENV_KEYS = [
  ["ADMIN_SECRET", "ADMIN_PUBLIC"],
  ["MEMBER_A_SECRET", "MEMBER_A_PUBLIC"],
  ["MEMBER_B_SECRET", "MEMBER_B_PUBLIC"],
  ["MEMBER_C_SECRET", "MEMBER_C_PUBLIC"],
  ["MOCK_USDC_ISSUER_SECRET", "MOCK_USDC_ISSUER_PUBLIC"],
] as const;

function replaceEnvironmentValue(template: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, "mu");
  if (!pattern.test(template)) throw new Error(`.env.example içinde ${key} bulunamadı.`);
  return template.replace(pattern, `${key}=${value}`);
}

/**
 * Simülasyon hesaplarını üretip fonlar ve yazılmaya hazır `.env.simulation` metnini döndürür.
 * Yazmayı çağırana bırakır; böylece Friendbot yarıda kalırsa eksik secret dosyası oluşmaz.
 */
export async function generateSimulationEnvironment(
  template: string,
  dependencies: AccountGenerationDependencies,
): Promise<string> {
  const accounts = Array.from({ length: ACCOUNT_ENV_KEYS.length }, () =>
    dependencies.createKeypair(),
  );
  const anchorSigner = dependencies.createKeypair();

  for (const account of accounts) {
    await dependencies.fundAccount(account.publicKey);
  }

  let output = template;
  ACCOUNT_ENV_KEYS.forEach(([secretKey, publicKey], index) => {
    const account = accounts[index]!;
    output = replaceEnvironmentValue(output, secretKey, account.secret);
    output = replaceEnvironmentValue(output, publicKey, account.publicKey);
  });
  return replaceEnvironmentValue(output, "MOCK_ANCHOR_SIGNING_SECRET", anchorSigner.secret);
}

/** Friendbot üzerinden testnet hesabını fonlar; HTTP hatalarını ayrıntısıyla yukarı taşır. */
export async function fundWithFriendbot(publicKey: string): Promise<void> {
  const url = new URL(NETWORK.friendbotUrl);
  url.searchParams.set("addr", publicKey);
  const response = await fetch(url);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Friendbot ${response.status}: ${detail}`);
  }
}

/** Gerçek Stellar keypair üretir; secret hiçbir zaman konsola yazılmaz. */
export function createStellarKeypair(): GeneratedKeypair {
  const keypair = Keypair.random();
  return { publicKey: keypair.publicKey(), secret: keypair.secret() };
}

async function main(): Promise<void> {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const template = await readFile(path.join(workspace, ".env.example"), "utf8");
  const output = await generateSimulationEnvironment(template, {
    createKeypair: createStellarKeypair,
    fundAccount: fundWithFriendbot,
  });
  await writeFile(path.join(workspace, ".env.simulation"), output, {
    encoding: "utf8",
    mode: 0o600,
  });

  for (const [, publicKey] of ACCOUNT_ENV_KEYS) {
    const match = new RegExp(`^${publicKey}=(.+)$`, "mu").exec(output);
    console.log(`${publicKey}=${match?.[1] ?? ""}`);
  }
  console.log(".env.simulation yazıldı; secret değerleri konsola basılmadı.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
