import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ANCHOR, NETWORK, SEED } from "../config/simulation.js";
import { fiatToAsset, toStroopsExact } from "../packages/core/src/money.js";

interface ChainMember {
  readonly address: string;
  readonly contributed: bigint;
}

interface ChainRequest {
  readonly id: number;
  readonly requester: string;
  readonly amount: bigint;
  readonly note: string;
  readonly approvals: readonly string[];
}

export interface SeedChainState {
  readonly members: readonly ChainMember[];
  readonly requests: readonly ChainRequest[];
}

export type SeedInvoker = (
  sourceSecret: string,
  functionName: string,
  args: readonly string[],
) => Promise<string>;

interface DemoAccount {
  readonly secret: string;
  readonly publicKey: string;
  readonly contribution: bigint;
}

function environmentValue(environment: string, key: string): string {
  const match = new RegExp(`^${key}=(.*)$`, "mu").exec(environment);
  if (!match?.[1]) throw new Error(`${key} eksik veya boş.`);
  return match[1];
}

function demoAccounts(environment: string): readonly DemoAccount[] {
  const prefixes = ["ADMIN", "MEMBER_A", "MEMBER_B", "MEMBER_C"] as const;
  return prefixes.map((prefix, index) => {
    const seedMember = SEED.members[index];
    if (!seedMember) throw new Error(`SEED üye ayarı eksik: ${index}`);
    return {
      secret: environmentValue(environment, `${prefix}_SECRET`),
      publicKey: environmentValue(environment, `${prefix}_PUBLIC`),
      contribution: toStroopsExact(fiatToAsset(seedMember.contributionFiat, ANCHOR.rate)),
    };
  });
}

function expectedRequests(accounts: readonly DemoAccount[]) {
  const admin = accounts[0];
  const memberA = accounts[1];
  if (!admin || !memberA) throw new Error("Demo hesapları eksik.");
  return [
    {
      requester: admin,
      approver: memberA,
      note: SEED.requests[0].note,
      amount: toStroopsExact(fiatToAsset(SEED.requests[0].amountFiat, ANCHOR.rate)),
      approvals: SEED.requests[0].approvals,
    },
    {
      requester: memberA,
      approver: undefined,
      note: SEED.requests[1].note,
      amount: toStroopsExact(fiatToAsset(SEED.requests[1].amountFiat, ANCHOR.rate)),
      approvals: SEED.requests[1].approvals,
    },
  ] as const;
}

function parseRequestId(output: string): number {
  const normalized = output.trim().replace(/^"|"$/gu, "");
  if (!/^\d+$/u.test(normalized)) throw new Error(`Talep ID çözümlenemedi: ${output}`);
  return Number.parseInt(normalized, 10);
}

/** Demo katkılarını ve taleplerini mevcut zincir durumunu bozmadan, yeniden çalıştırılabilir biçimde yazar. */
export async function seedSimulation(
  environment: string,
  state: SeedChainState,
  invoke: SeedInvoker,
): Promise<void> {
  environmentValue(environment, "SHARED_VAULT_CONTRACT_ID");
  const accounts = demoAccounts(environment);
  const expected = expectedRequests(accounts);

  for (const request of expected) {
    const existing = state.requests.find((item) => item.note === request.note);
    if (
      existing &&
      (existing.requester !== request.requester.publicKey || existing.amount !== request.amount)
    ) {
      throw new Error(`"${request.note}" talebi zincirde beklenen veriyle uyuşmuyor.`);
    }
  }

  for (const account of accounts) {
    const member = state.members.find((item) => item.address === account.publicKey);
    if (!member) throw new Error(`Kontratta demo üyesi bulunamadı: ${account.publicKey}`);
    if (member.contributed > account.contribution) {
      throw new Error(`Üye katkısı seed hedefini aşmış: ${account.publicKey}`);
    }
    const missing = account.contribution - member.contributed;
    if (missing > 0n) {
      await invoke(account.secret, "deposit", [
        "--member",
        account.publicKey,
        "--amount",
        missing.toString(),
      ]);
    }
  }

  for (const request of expected) {
    let existing = state.requests.find((item) => item.note === request.note);
    if (!existing) {
      const output = await invoke(request.requester.secret, "request_spend", [
        "--member",
        request.requester.publicKey,
        "--amount",
        request.amount.toString(),
        "--note",
        request.note,
      ]);
      existing = {
        id: parseRequestId(output),
        requester: request.requester.publicKey,
        amount: request.amount,
        note: request.note,
        approvals: [],
      };
    }
    if (request.approvals === 1 && existing.approvals.length === 0 && request.approver) {
      await invoke(request.approver.secret, "approve", [
        "--member",
        request.approver.publicKey,
        "--request_id",
        existing.id.toString(),
      ]);
    }
  }
}

function stellarExecutable(): string {
  const installed = `${process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)"}\\Stellar CLI\\stellar.exe`;
  return existsSync(installed) ? installed : "stellar";
}

function invokeArguments(contractId: string, source: string, functionName: string, args: readonly string[]) {
  return [
    "contract",
    "invoke",
    "--id",
    contractId,
    "--source-account",
    source,
    "--rpc-url",
    NETWORK.rpcUrl,
    "--network-passphrase",
    NETWORK.networkPassphrase,
    "--quiet",
    "--",
    functionName,
    ...args,
  ];
}

/** Zincirdeki üye katkılarını ve talepleri salt okunur çağrılarla getirir. */
export async function readChainState(environment: string): Promise<SeedChainState> {
  const contractId = environmentValue(environment, "SHARED_VAULT_CONTRACT_ID");
  const source = environmentValue(environment, "ADMIN_PUBLIC");
  const read = (functionName: string) =>
    execFileSync(stellarExecutable(), invokeArguments(contractId, source, functionName, []), {
      encoding: "utf8",
    });
  const rawMembers = JSON.parse(read("get_members")) as Array<Record<string, unknown>>;
  const rawRequests = JSON.parse(read("get_requests")) as Array<Record<string, unknown>>;
  return {
    members: rawMembers.map((member) => ({
      address: String(member.address),
      contributed: BigInt(String(member.contributed)),
    })),
    requests: rawRequests.map((request) => ({
      id: Number(request.id),
      requester: String(request.requester),
      amount: BigInt(String(request.amount)),
      note: String(request.note),
      approvals: Array.isArray(request.approvals) ? request.approvals.map(String) : [],
    })),
  };
}

/** Verilen gizli anahtarla kontrat çağrısını testnet'e gönderir. */
export async function invokeSeedContract(
  environment: string,
  sourceSecret: string,
  functionName: string,
  args: readonly string[],
): Promise<string> {
  const contractId = environmentValue(environment, "SHARED_VAULT_CONTRACT_ID");
  return execFileSync(
    stellarExecutable(),
    invokeArguments(contractId, sourceSecret, functionName, args),
    { encoding: "utf8" },
  );
}

async function main(): Promise<void> {
  const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const environment = await readFile(path.join(workspace, ".env.simulation"), "utf8");
  const state = await readChainState(environment);
  await seedSimulation(environment, state, (secret, functionName, args) =>
    invokeSeedContract(environment, secret, functionName, args),
  );
  console.log(`Demo verisi hazır: ${SEED.vaultName}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
