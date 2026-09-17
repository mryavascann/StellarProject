import { Account, Keypair, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it, vi } from "vitest";

import type { AnchorClient } from "./anchor/client.js";
import type { DefindexAdapter } from "./defindex/types.js";
import { runLiveChecks } from "./live-check.js";

const account = Keypair.random().publicKey();
const issuer = Keypair.random().publicKey();

function challenge(sequence = "-1"): string {
  return new TransactionBuilder(new Account(account, sequence), {
    fee: "100",
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(Operation.manageData({ name: "test", value: "ok" }))
    .setTimeout(30)
    .build()
    .toXDR();
}

function dependencies(overrides: { assetCode?: string; challengeXdr?: string } = {}) {
  const anchor = {
    mode: "live",
    metadata: vi.fn(async () => ({
      homeDomain: "anchor.example",
      signingKey: Keypair.random().publicKey(),
      transferServer: "https://anchor.example/sep24",
      webAuthEndpoint: "https://anchor.example/auth",
      quoteServer: "https://anchor.example/sep38",
      assetCode: overrides.assetCode ?? "USDC",
      assetIssuer: issuer,
    })),
    info: vi.fn(async () => ({
      deposit: { enabled: true, minAmount: "1", maxAmount: "100", feeFixed: "0", feePercent: "1" },
      withdraw: { enabled: true, minAmount: "1", maxAmount: "100", feeFixed: "0", feePercent: "1" },
      trustlineRequired: true,
    })),
    challenge: vi.fn(async () => overrides.challengeXdr ?? challenge()),
  } as unknown as AnchorClient;
  const defindex = {
    mode: "live",
    vaultAddress: `C${"A".repeat(55)}`,
    getVaultInfo: vi.fn(async () => ({ name: "Canlı Vault", symbol: "dfUSDC", apyPercent: "6.50", sharePrice: null })),
    getVaultAPY: vi.fn(async () => "6.50"),
  } as unknown as DefindexAdapter;
  return { anchor, defindex };
}

const environment = {
  KASA_MODE: "live",
  ADMIN_PUBLIC: account,
  ANCHOR_HOME_DOMAIN: "anchor.example",
  ANCHOR_ASSET_CODE: "USDC",
  ANCHOR_ASSET_ISSUER: issuer,
};

describe("canlı geçiş kontrolü", () => {
  it("anchor sözleşmesini, sequence 0 SEP-10 challenge'ını ve DeFindex vault bilgisini doğrular", async () => {
    const { anchor, defindex } = dependencies();

    const report = await runLiveChecks(environment, { anchor, defindex });

    expect(report).toMatchObject({
      anchorHomeDomain: "anchor.example",
      asset: `USDC:${issuer}`,
      depositEnabled: true,
      withdrawEnabled: true,
      challengeSequence: "0",
      vaultName: "Canlı Vault",
      vaultSymbol: "dfUSDC",
      apyPercent: "6.50",
    });
    expect(anchor.challenge).toHaveBeenCalledWith(account);
    expect(defindex.getVaultInfo).toHaveBeenCalledOnce();
    expect(defindex.getVaultAPY).toHaveBeenCalledOnce();
  });

  it("live dışında çalışmayı ve eksik yönetici hesabını ağ çağrısından önce reddeder", async () => {
    const { anchor, defindex } = dependencies();
    await expect(runLiveChecks({ ...environment, KASA_MODE: "simulation" }, { anchor, defindex })).rejects.toThrow("KASA_MODE=live");
    await expect(runLiveChecks({ ...environment, ADMIN_PUBLIC: undefined }, { anchor, defindex })).rejects.toThrow("ADMIN_PUBLIC");
    expect(anchor.metadata).not.toHaveBeenCalled();
  });

  it("TOML varlığı env ile uyuşmazsa ve challenge sequence 0 değilse kırmızı olur", async () => {
    const wrongAsset = dependencies({ assetCode: "EURC" });
    await expect(runLiveChecks(environment, wrongAsset)).rejects.toThrow("ANCHOR_ASSET_CODE");

    const wrongSequence = dependencies({ challengeXdr: challenge("0") });
    await expect(runLiveChecks(environment, wrongSequence)).rejects.toThrow("sequence number 0");
  });

  it("deposit veya withdraw kapalıysa ve vault bilgisi eksikse teslim kapısını açmaz", async () => {
    const unavailable = dependencies();
    unavailable.anchor.info = vi.fn(async () => ({
      deposit: { enabled: true, minAmount: null, maxAmount: null, feeFixed: null, feePercent: null },
      withdraw: { enabled: false, minAmount: null, maxAmount: null, feeFixed: null, feePercent: null },
      trustlineRequired: false,
    }));
    await expect(runLiveChecks(environment, unavailable)).rejects.toThrow("withdraw kapalı");

    const missingVault = dependencies();
    missingVault.defindex.getVaultInfo = vi.fn(async () => ({ name: "", symbol: "", apyPercent: "", sharePrice: null }));
    await expect(runLiveChecks(environment, missingVault)).rejects.toThrow("vault bilgisi eksik");
  });
});
