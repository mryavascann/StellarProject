import { Transaction, TransactionBuilder, Networks } from "@stellar/stellar-sdk";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createAnchorClient, type AnchorClient } from "./anchor/client";
import { createDefindexAdapter } from "./defindex/client";
import type { DefindexAdapter } from "./defindex/types";
import { loadEnvironment, type Environment } from "./env";

export interface LiveCheckDependencies {
  readonly anchor?: AnchorClient;
  readonly defindex?: DefindexAdapter;
}

export interface LiveCheckReport {
  readonly anchorHomeDomain: string;
  readonly asset: string;
  readonly depositEnabled: boolean;
  readonly withdrawEnabled: boolean;
  readonly trustlineRequired: boolean;
  readonly challengeSequence: string;
  readonly vaultName: string;
  readonly vaultSymbol: string;
  readonly apyPercent: string;
}

function required(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik veya boş.`);
  return value;
}

function assertEqual(actual: string, expected: string, key: string): void {
  if (actual !== expected) {
    throw new Error(`${key} uyuşmuyor: beklenen "${expected}", anchor "${actual}" döndürdü.`);
  }
}

/**
 * Etkinlik günü canlı anchor ve DeFindex bağlantılarını salt-okunur çağrılarla doğrular.
 * Para hareketi yapmaz; yanlış domain, varlık veya SEP-10 sequence değeriyle teslimi durdurur.
 */
export async function runLiveChecks(
  environment: Environment,
  dependencies: LiveCheckDependencies = {},
): Promise<LiveCheckReport> {
  if (environment.KASA_MODE !== "live") {
    throw new Error("Canlı geçiş kontrolü yalnız KASA_MODE=live ile çalışır.");
  }

  const account = required(environment, "ADMIN_PUBLIC");
  const expectedHomeDomain = required(environment, "ANCHOR_HOME_DOMAIN");
  const expectedAssetCode = required(environment, "ANCHOR_ASSET_CODE");
  const expectedAssetIssuer = required(environment, "ANCHOR_ASSET_ISSUER");
  const anchor = dependencies.anchor ?? createAnchorClient(environment);
  const defindex = dependencies.defindex ?? createDefindexAdapter(environment);

  if (anchor.mode !== "live" || defindex.mode !== "live") {
    throw new Error("Canlı geçiş kontrolüne simulation adaptörü verilemez.");
  }

  const metadata = await anchor.metadata();
  assertEqual(metadata.homeDomain, expectedHomeDomain, "ANCHOR_HOME_DOMAIN");
  assertEqual(metadata.assetCode, expectedAssetCode, "ANCHOR_ASSET_CODE");
  assertEqual(metadata.assetIssuer, expectedAssetIssuer, "ANCHOR_ASSET_ISSUER");

  const [info, challengeXdr, vaultInfo, apyPercent] = await Promise.all([
    anchor.info(),
    anchor.challenge(account),
    defindex.getVaultInfo(),
    defindex.getVaultAPY(),
  ]);

  if (!info.deposit.enabled) throw new Error("Canlı anchor'da deposit kapalı.");
  if (!info.withdraw.enabled) throw new Error("Canlı anchor'da withdraw kapalı.");

  const challenge = TransactionBuilder.fromXDR(challengeXdr, Networks.TESTNET);
  if (!(challenge instanceof Transaction)) throw new Error("SEP-10 challenge normal bir transaction olmalı.");
  if (challenge.sequence !== "0") {
    throw new Error(`SEP-10 challenge sequence number 0 olmalı; gelen: ${challenge.sequence}.`);
  }

  if (!vaultInfo.name || !vaultInfo.symbol || !vaultInfo.apyPercent || !apyPercent) {
    throw new Error("DeFindex vault bilgisi eksik.");
  }
  if (vaultInfo.apyPercent !== apyPercent) {
    throw new Error(`DeFindex APY uçları uyuşmuyor: ${vaultInfo.apyPercent} / ${apyPercent}.`);
  }

  return {
    anchorHomeDomain: metadata.homeDomain,
    asset: `${metadata.assetCode}:${metadata.assetIssuer}`,
    depositEnabled: info.deposit.enabled,
    withdrawEnabled: info.withdraw.enabled,
    trustlineRequired: info.trustlineRequired,
    challengeSequence: challenge.sequence,
    vaultName: vaultInfo.name,
    vaultSymbol: vaultInfo.symbol,
    apyPercent,
  };
}

async function main(): Promise<void> {
  const report = await runLiveChecks(loadEnvironment());
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Canlı geçiş kontrolü başarısız: ${message}\n`);
    process.exitCode = 1;
  });
}
