import { Account, Asset, BASE_FEE, Horizon, Memo, Operation, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import type { WithdrawalPayment } from "./types";

/**
 * Klasik Stellar işlemleri (Horizon): trustline ve anchor'a giden memo'lu ödeme.
 * Neden burada: KARAR K-002 — off-ramp'in son adımını kontrat değil ÜYE atar. Ödemeyi
 * API kurar, üye cüzdanda imzalar, memo işlem seviyesinde birebir taşınır.
 */

export interface ClassicAsset {
  readonly code: string;
  readonly issuer: string;
}

export interface ClassicGateway {
  loadAccount(accountId: string): Promise<Account>;
  hasTrustline(accountId: string, asset: ClassicAsset): Promise<boolean>;
  submit(transaction: Transaction): Promise<{ hash: string }>;
}

async function builder(gateway: ClassicGateway, networkPassphrase: string, account: string) {
  const source = await gateway.loadAccount(account);
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase }).setTimeout(300);
}

/** Deposit öncesi zorunlu adım (Bölüm 9 kural 5): claimable balance yoksa trustline şart. */
export async function buildTrustlineTransaction(
  gateway: ClassicGateway,
  networkPassphrase: string,
  account: string,
  asset: ClassicAsset,
): Promise<string> {
  const transaction = (await builder(gateway, networkPassphrase, account))
    .addOperation(Operation.changeTrust({ asset: new Asset(asset.code, asset.issuer) }))
    .build();
  return transaction.toXDR();
}

/** Anchor çekim ödemesi. `memo` ve `memo_type` anchor yanıtından değiştirilmeden gelir (kural 4). */
export async function buildWithdrawalPaymentTransaction(
  gateway: ClassicGateway,
  networkPassphrase: string,
  account: string,
  asset: ClassicAsset,
  payment: WithdrawalPayment,
): Promise<string> {
  if (payment.memoType !== "id" || !/^\d+$/u.test(payment.memo)) {
    throw new TypeError("Çekim memo'su id türünde ve sayısal olmalı; aksi hâlde para askıda kalır.");
  }
  const transaction = (await builder(gateway, networkPassphrase, account))
    .addOperation(
      Operation.payment({
        destination: payment.destination,
        asset: new Asset(asset.code, asset.issuer),
        amount: payment.amount,
      }),
    )
    .addMemo(Memo.id(payment.memo))
    .build();
  return transaction.toXDR();
}

/** Cüzdanda imzalanmış klasik işlemi Horizon'a gönderir. */
export async function submitClassicTransaction(
  gateway: ClassicGateway,
  networkPassphrase: string,
  signedXdr: string,
): Promise<{ hash: string }> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  if (!(transaction instanceof Transaction)) throw new TypeError("Fee-bump işlemi kabul edilmiyor.");
  if (transaction.signatures.length === 0) throw new TypeError("İşlem imzasız gönderilemez.");
  return gateway.submit(transaction);
}

/**
 * Hesap Stellar ağında hiç yok. Ayrı bir hata tipi olmasının sebebi: bu bir arıza değil,
 * kullanıcının yapabileceği bir eksiklik. Genel "İşlem şu an yapılamıyor" mesajına karışırsa
 * kullanıcı ne yapacağını bilemez ve tekrar tekrar aynı düğmeye basar.
 */
export class AccountNotFoundError extends TypeError {
  constructor(accountId: string) {
    super(
      `Bu hesap Stellar test ağında yok: ${accountId.slice(0, 4)}…${accountId.slice(-4)}. ` +
        "Önce hesabı test parasıyla açman gerekiyor.",
    );
  }
}

/** Horizon "hesap yok" cevabını 404 ile verir; başka her hata gerçek bir arızadır. */
function asAccountError(error: unknown, accountId: string): unknown {
  return (error as { response?: { status?: number } } | null)?.response?.status === 404
    ? new AccountNotFoundError(accountId)
    : error;
}

/** Gerçek Horizon kapısı. */
export function createHorizonGateway(
  horizonUrl: string,
  server: Pick<Horizon.Server, "loadAccount" | "submitTransaction"> = new Horizon.Server(horizonUrl),
): ClassicGateway {
  const load = async (accountId: string) => {
    try {
      return await server.loadAccount(accountId);
    } catch (error) {
      throw asAccountError(error, accountId);
    }
  };
  return {
    async loadAccount(accountId) {
      const response = await load(accountId);
      return new Account(response.accountId(), response.sequenceNumber());
    },
    async hasTrustline(accountId, asset) {
      const account = await load(accountId);
      return account.balances.some(
        (balance) => "asset_code" in balance && balance.asset_code === asset.code && balance.asset_issuer === asset.issuer,
      );
    },
    async submit(transaction) {
      const response = await server.submitTransaction(transaction);
      return { hash: response.hash };
    },
  };
}
