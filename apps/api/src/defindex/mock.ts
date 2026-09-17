import {
  Account,
  Asset,
  BASE_FEE,
  Horizon,
  Keypair,
  Operation,
  Transaction,
  TransactionBuilder,
  type xdr,
} from "@stellar/stellar-sdk";
import Decimal from "decimal.js";
import { fromStroops, toStroops, toStroopsExact } from "@kasa/core";

import { ANCHOR, DEFINDEX, NETWORK } from "../../../../config/simulation.js";
import type { DefindexAdapter, UnsignedVaultTransaction, VaultBalance, VaultInfo, VaultSubmission } from "./types.js";

/**
 * Mock adaptörün zincirle konuştuğu dar kapı. Testler bunu sahte nesneyle değiştirir;
 * üretimde `createHorizonVaultChain` gerçek Horizon'a gider.
 */
export interface MockVaultChain {
  loadSequence(accountId: string): Promise<string>;
  shareBalance(accountId: string): Promise<bigint>;
  submit(transaction: Transaction): Promise<{ hash: string }>;
}

export interface MockDefindexOptions {
  /** Mock pay token'ının (kUSDC) ve mock USDC'nin ihraççısı; vault'un "imzası" budur. */
  readonly issuerSecret: string;
  readonly chain: MockVaultChain;
  readonly now?: () => Date;
  readonly sleep?: (ms: number) => Promise<void>;
}

const SHARE_DECIMALS = 7;

function requirePositive(amount: bigint, field: string): void {
  if (amount <= 0n) throw new RangeError(`${field} sıfırdan büyük olmalı.`);
}

/**
 * Pay fiyatı: başlangıç + (dakika × artış). Simülasyon sabitleri `⚠ SİM` etiketli
 * (config/simulation.ts). Demo sırasında getirinin gözle görülmesi için vardır.
 */
function sharePriceAt(now: Date): Decimal {
  const epoch = new Date(DEFINDEX.sharePriceEpoch).getTime();
  const minutes = Math.max(0, Math.floor((now.getTime() - epoch) / 60_000));
  return new Decimal(DEFINDEX.initialSharePrice).plus(
    new Decimal(DEFINDEX.sharePriceIncrementPerMinute).times(minutes),
  );
}

/**
 * Gerçek DeFindex'in dış davranışını taklit eden adaptör (KARAR K-012).
 *
 * SDK imzasız XDR döndürür, kullanıcı imzalar, vault gönderir; aynı üçlü burada da yaşanır.
 * Deposit: üye USDC'yi ihraççıya öder (yakar), ihraççı (vault imzası) payı üyeye öder.
 * Withdraw: üye payı ihraççıya öder (yakar), ihraççı USDC'yi üyeye öder.
 * Trustline'lar aynı işlemde açılır; gerçek dfToken Soroban token'ıdır ve trustline istemez,
 * bu yüzden bu adım yalnızca mock'a özgüdür ve kontratı ilgilendirmez.
 */
export function createMockDefindex(options: MockDefindexOptions): DefindexAdapter {
  const issuer = Keypair.fromSecret(options.issuerSecret);
  const shareAsset = new Asset(DEFINDEX.vaultSymbol, issuer.publicKey());
  const usdcAsset = new Asset(ANCHOR.assetCode, issuer.publicKey());
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  async function buildTransaction(caller: string, operations: readonly xdr.Operation[]) {
    await sleep(DEFINDEX.latencyMs);
    const account = new Account(caller, await options.chain.loadSequence(caller));
    const builder = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: NETWORK.networkPassphrase });
    for (const operation of operations) builder.addOperation(operation);
    return builder.setTimeout(300).build();
  }

  return {
    mode: "simulation",
    vaultAddress: shareAsset.contractId(NETWORK.networkPassphrase),

    async depositToVault(caller, amountStroops): Promise<UnsignedVaultTransaction> {
      requirePositive(amountStroops, "Yatırılacak tutar");
      const shares = new Decimal(fromStroops(amountStroops))
        .div(sharePriceAt(now()))
        .toFixed(SHARE_DECIMALS, Decimal.ROUND_DOWN);
      const transaction = await buildTransaction(caller, [
        Operation.changeTrust({ asset: shareAsset }),
        Operation.payment({ destination: issuer.publicKey(), asset: usdcAsset, amount: fromStroops(amountStroops) }),
        Operation.payment({ source: issuer.publicKey(), destination: caller, asset: shareAsset, amount: shares }),
      ]);
      return { xdr: transaction.toXDR(), functionName: "deposit" };
    },

    async withdrawShares(caller, shareStroops): Promise<UnsignedVaultTransaction> {
      requirePositive(shareStroops, "Bozdurulacak pay");
      const usdcOut = new Decimal(fromStroops(shareStroops))
        .times(sharePriceAt(now()))
        .toFixed(SHARE_DECIMALS, Decimal.ROUND_DOWN);
      const transaction = await buildTransaction(caller, [
        Operation.changeTrust({ asset: usdcAsset }),
        Operation.payment({ destination: issuer.publicKey(), asset: shareAsset, amount: fromStroops(shareStroops) }),
        Operation.payment({ source: issuer.publicKey(), destination: caller, asset: usdcAsset, amount: usdcOut }),
      ]);
      return { xdr: transaction.toXDR(), functionName: "withdraw" };
    },

    async getVaultBalance(account): Promise<VaultBalance> {
      const shares = await options.chain.shareBalance(account);
      const underlying = toStroops(new Decimal(fromStroops(shares)).times(sharePriceAt(now())));
      return { shares, underlying };
    },

    async getVaultInfo(): Promise<VaultInfo> {
      return {
        name: DEFINDEX.vaultName,
        symbol: DEFINDEX.vaultSymbol,
        apyPercent: DEFINDEX.apyPercent,
        sharePrice: sharePriceAt(now()).toFixed(SHARE_DECIMALS, Decimal.ROUND_DOWN),
      };
    },

    async getVaultAPY(): Promise<string> {
      return DEFINDEX.apyPercent;
    },

    async sendTransaction(signedXdr): Promise<VaultSubmission> {
      const transaction = TransactionBuilder.fromXDR(signedXdr, NETWORK.networkPassphrase);
      if (!(transaction instanceof Transaction)) throw new Error("Fee-bump işlemi desteklenmiyor.");
      const source = Keypair.fromPublicKey(transaction.source);
      const hash = transaction.hash();
      const callerSigned = transaction.signatures.some((entry) => source.verify(hash, entry.signature));
      if (!callerSigned) throw new Error("İşlemde çağıranın imzası yok; vault imzasız işlemi göndermez.");

      // Vault "imzası": yalnızca ihraççı kaynaklı bir ödeme varsa eklenir.
      if (transaction.operations.some((operation) => operation.source === issuer.publicKey())) {
        transaction.sign(issuer);
      }
      const result = await options.chain.submit(transaction);
      return { txHash: result.hash, success: true };
    },
  };
}

/** Horizon'a giden gerçek zincir kapısı; simülasyonda mock adaptörün varsayılanıdır. */
export function createHorizonVaultChain(issuerPublic: string, horizonUrl: string = NETWORK.horizonUrl): MockVaultChain {
  const server = new Horizon.Server(horizonUrl);
  return {
    async loadSequence(accountId) {
      return (await server.loadAccount(accountId)).sequenceNumber();
    },
    async shareBalance(accountId) {
      const account = await server.loadAccount(accountId);
      const line = account.balances.find(
        (balance) =>
          "asset_code" in balance &&
          balance.asset_code === DEFINDEX.vaultSymbol &&
          balance.asset_issuer === issuerPublic,
      );
      return line ? toStroopsExact(line.balance) : 0n;
    },
    async submit(transaction) {
      const response = await server.submitTransaction(transaction);
      return { hash: response.hash };
    },
  };
}
