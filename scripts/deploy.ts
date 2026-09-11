import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NETWORK, VAULT_INIT } from "../config/simulation.js";

interface VaultInitConfig {
  readonly threshold: bigint;
  readonly quorum: number;
  readonly requestTtlSeconds: number;
}

export interface VaultDeploymentDependencies {
  readonly deployContract: (adminSecret: string) => Promise<string>;
  readonly invokeContract: (
    contractId: string,
    sourceSecret: string,
    functionName: string,
    args: readonly string[],
  ) => Promise<void>;
}

const CONTRACT_ID_PATTERN = /^C[A-Z2-7]{55}$/u;

function environmentValue(environment: string, key: string): string {
  const match = new RegExp(`^${key}=(.*)$`, "mu").exec(environment);
  if (!match || !match[1]) throw new Error(`${key} eksik veya boş.`);
  return match[1];
}

function setEnvironmentValue(environment: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}=.*$`, "mu");
  if (!pattern.test(environment)) throw new Error(`${key} env şablonunda bulunamadı.`);
  return environment.replace(pattern, `${key}=${value}`);
}

/**
 * Kasa Wasm'ını deploy eder, init çağrısını yapar ve üç demo üyesini admin üzerinden ekler.
 * Contract ID ancak bütün çağrılar başarılı olursa yazılmaya hazır env metnine alınır.
 */
export async function deploySharedVault(
  environment: string,
  config: VaultInitConfig,
  dependencies: VaultDeploymentDependencies,
): Promise<{ readonly contractId: string; readonly environment: string }> {
  const adminSecret = environmentValue(environment, "ADMIN_SECRET");
  const adminPublic = environmentValue(environment, "ADMIN_PUBLIC");
  const members = ["MEMBER_A_PUBLIC", "MEMBER_B_PUBLIC", "MEMBER_C_PUBLIC"].map((key) =>
    environmentValue(environment, key),
  );
  const shareToken = environmentValue(environment, "MOCK_DFTOKEN_CONTRACT_ID");
  if (!CONTRACT_ID_PATTERN.test(shareToken)) throw new Error("MOCK_DFTOKEN_CONTRACT_ID geçersiz.");

  const contractId = (await dependencies.deployContract(adminSecret)).trim();
  if (!CONTRACT_ID_PATTERN.test(contractId)) {
    throw new Error(`Stellar CLI geçerli contract ID döndürmedi: ${contractId}`);
  }

  await dependencies.invokeContract(contractId, adminSecret, "init", [
    "--admin",
    adminPublic,
    "--share_token",
    shareToken,
    "--threshold",
    config.threshold.toString(),
    "--quorum",
    config.quorum.toString(),
    "--request_ttl",
    config.requestTtlSeconds.toString(),
  ]);
  for (const member of members) {
    await dependencies.invokeContract(contractId, adminSecret, "add_member", [
      "--caller",
      adminPublic,
      "--new_member",
      member,
    ]);
  }

  return {
    contractId,
    environment: setEnvironmentValue(environment, "SHARED_VAULT_CONTRACT_ID", contractId),
  };
}

function stellarExecutable(): string {
  const installed = `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\Stellar CLI\\stellar.exe`;
  return existsSync(installed) ? installed : "stellar";
}

function networkArguments(): string[] {
  return ["--rpc-url", NETWORK.rpcUrl, "--network-passphrase", NETWORK.networkPassphrase];
}

/** Derlenmiş shared_vault Wasm'ını testnet'e deploy eder ve gerçek contract ID'yi döndürür. */
export async function deployVaultContract(adminSecret: string): Promise<string> {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const wasm = path.join(
    workspace,
    "contracts",
    "shared-vault",
    "target",
    "wasm32v1-none",
    "release",
    "shared_vault.wasm",
  );
  if (!existsSync(wasm)) throw new Error(`Wasm bulunamadı: ${wasm}`);
  return execFileSync(
    stellarExecutable(),
    ["contract", "deploy", "--wasm", wasm, ...networkArguments(), "--quiet"],
    { encoding: "utf8", env: { ...process.env, STELLAR_ACCOUNT: adminSecret } },
  );
}

/** Kontrat fonksiyonunu admin kaynağıyla çağırır; CLI hatasını sessizce yutmaz. */
export async function invokeVaultContract(
  contractId: string,
  sourceSecret: string,
  functionName: string,
  args: readonly string[],
): Promise<void> {
  execFileSync(
    stellarExecutable(),
    [
      "contract",
      "invoke",
      "--id",
      contractId,
      ...networkArguments(),
      "--quiet",
      "--",
      functionName,
      ...args,
    ],
    { encoding: "utf8", env: { ...process.env, STELLAR_ACCOUNT: sourceSecret } },
  );
}

async function main(): Promise<void> {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = path.join(workspace, ".env.simulation");
  const environment = await readFile(envPath, "utf8");
  const result = await deploySharedVault(environment, VAULT_INIT, {
    deployContract: deployVaultContract,
    invokeContract: invokeVaultContract,
  });
  await writeFile(envPath, result.environment, { encoding: "utf8", mode: 0o600 });
  console.log(`SharedVault deploy ve init tamamlandı: ${result.contractId}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
