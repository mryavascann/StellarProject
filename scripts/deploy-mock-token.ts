import {
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFINDEX, NETWORK } from "../config/simulation.js";

export interface MockTokenDeploymentDependencies {
  readonly deployAsset: (asset: string, issuerSecret: string) => Promise<string>;
  readonly establishBalance: (
    accountSecret: string,
    assetCode: string,
    issuerPublic: string,
    targetAmount: string,
  ) => Promise<void>;
}

const MEMBER_SECRET_KEYS = ["ADMIN_SECRET", "MEMBER_A_SECRET", "MEMBER_B_SECRET", "MEMBER_C_SECRET"];
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

function toStroops(amount: string): bigint {
  if (!/^\d+(\.\d{1,7})?$/u.test(amount)) throw new Error(`Geçersiz Stellar tutarı: ${amount}`);
  const [whole = "0", fraction = ""] = amount.split(".");
  return BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
}

function fromStroops(amount: bigint): string {
  const whole = amount / 10_000_000n;
  const fraction = (amount % 10_000_000n).toString().padStart(7, "0");
  return `${whole}.${fraction}`;
}

/**
 * Mock vault payını deploy eder, üyelerin hedef bakiyesini kurar ve güncel env metnini döndürür.
 * Env dosyası tüm ağ işlemleri bitmeden yazılmaz; yarım deploy secret/ID tutarsızlığı üretmez.
 */
export async function deployMockShareToken(
  environment: string,
  targetAmount: string,
  dependencies: MockTokenDeploymentDependencies,
): Promise<{ readonly contractId: string; readonly environment: string }> {
  const issuerSecret = environmentValue(environment, "MOCK_USDC_ISSUER_SECRET");
  const issuerPublic = environmentValue(environment, "MOCK_USDC_ISSUER_PUBLIC");
  const memberSecrets = MEMBER_SECRET_KEYS.map((key) => environmentValue(environment, key));
  const assetCode = "kUSDC";
  const contractId = (await dependencies.deployAsset(`${assetCode}:${issuerPublic}`, issuerSecret)).trim();
  if (!CONTRACT_ID_PATTERN.test(contractId)) {
    throw new Error(`Stellar CLI geçerli contract ID döndürmedi: ${contractId}`);
  }

  for (const secret of memberSecrets) {
    await dependencies.establishBalance(secret, assetCode, issuerPublic, targetAmount);
  }
  return {
    contractId,
    environment: setEnvironmentValue(environment, "MOCK_DFTOKEN_CONTRACT_ID", contractId),
  };
}

/** Classic varlığı builtin Stellar Asset Contract olarak testnet'e deploy eder. */
export async function deployAssetContract(asset: string, issuerSecret: string): Promise<string> {
  const installed = `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\Stellar CLI\\stellar.exe`;
  const executable = existsSync(installed) ? installed : "stellar";
  return execFileSync(
    executable,
    [
      "contract",
      "asset",
      "deploy",
      "--asset",
      asset,
      "--rpc-url",
      NETWORK.rpcUrl,
      "--network-passphrase",
      NETWORK.networkPassphrase,
      "--quiet",
    ],
    {
      encoding: "utf8",
      env: { ...process.env, STELLAR_ACCOUNT: issuerSecret },
    },
  );
}

/** Üyenin trustline'ını açar ve mevcut bakiyeyi yalnızca hedefe kadar tamamlar. */
export async function establishClassicBalance(
  accountSecret: string,
  assetCode: string,
  issuerPublic: string,
  issuerSecret: string,
  targetAmount: string,
): Promise<void> {
  const server = new Horizon.Server(NETWORK.horizonUrl);
  const member = Keypair.fromSecret(accountSecret);
  const issuer = Keypair.fromSecret(issuerSecret);
  const asset = new Asset(assetCode, issuerPublic);
  let account = await server.loadAccount(member.publicKey());
  const trustline = account.balances.find(
    (balance) =>
      "asset_code" in balance && balance.asset_code === assetCode && balance.asset_issuer === issuerPublic,
  );

  if (!trustline) {
    const trust = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({ asset }))
      .setTimeout(30)
      .build();
    trust.sign(member);
    await server.submitTransaction(trust);
    account = await server.loadAccount(member.publicKey());
  }

  const currentLine = account.balances.find(
    (balance) =>
      "asset_code" in balance && balance.asset_code === assetCode && balance.asset_issuer === issuerPublic,
  );
  const current = currentLine ? toStroops(currentLine.balance) : 0n;
  const target = toStroops(targetAmount);
  if (current >= target) return;

  const issuerAccount = await server.loadAccount(issuer.publicKey());
  const payment = new TransactionBuilder(issuerAccount, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(
      Operation.payment({
        destination: member.publicKey(),
        asset,
        amount: fromStroops(target - current),
      }),
    )
    .setTimeout(30)
    .build();
  payment.sign(issuer);
  await server.submitTransaction(payment);
}

async function main(): Promise<void> {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const envPath = path.join(workspace, ".env.simulation");
  const environment = await readFile(envPath, "utf8");
  const issuerSecret = environmentValue(environment, "MOCK_USDC_ISSUER_SECRET");
  const result = await deployMockShareToken(environment, DEFINDEX.mockShareBalancePerMember, {
    deployAsset: deployAssetContract,
    establishBalance: (accountSecret, assetCode, issuerPublic, targetAmount) =>
      establishClassicBalance(accountSecret, assetCode, issuerPublic, issuerSecret, targetAmount),
  });
  await writeFile(envPath, result.environment, { encoding: "utf8", mode: 0o600 });
  console.log(`Mock dfToken deploy edildi: ${result.contractId}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
