import { Asset, BASE_FEE, Horizon, Keypair, Memo, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

/** Zincirde görülen bir klasik ödeme — anchor'ın "havale geldi mi" sorusunun cevabı. */
export interface ObservedPayment {
  readonly destination: string;
  readonly amount: string;
  readonly assetCode: string;
  readonly assetIssuer: string;
  readonly memo: string | null;
  readonly memoType: string | null;
  /** Ödemenin zincire yazıldığı an (ms). Anchor'ın işleme süresi buradan sayılır. */
  readonly createdAt: number;
}

/**
 * Mock anchor'ın zincirle konuştuğu dar kapı.
 * Neden var: gerçek anchor deposit'te ZİNCİRE öder ve withdraw'da ZİNCİRİ izler. Bunları
 * bellekte taklit eden bir mock, canlıya geçişte trustline ve memo hatalarını gizlerdi.
 */
export interface MockAnchorChain {
  hasTrustline(account: string): Promise<boolean>;
  /** Ödemeye `memo` konur: aynı deposit için ikinci ödemeyi zincire bakarak engellemeyi sağlar. */
  payAsset(destination: string, amount: string, memo: string): Promise<{ hash: string }>;
  findPayment(txHash: string): Promise<ObservedPayment | null>;
  /** Anchor daha önce bu hesaba bu etiketle ödeme yaptı mı? Bellekte kayıt tutmadan idempotenslik. */
  findPayout(destination: string, memo: string): Promise<{ hash: string } | null>;
}

export interface MemoryAnchorChain extends MockAnchorChain {
  grantTrustline(account: string): void;
  recordPayment(txHash: string, payment: ObservedPayment): void;
  readonly payouts: ReadonlyArray<{ destination: string; amount: string; hash: string; memo: string }>;
}

/** Testler için deterministik zincir: trustline'lar ve ödemeler elle kurulur. */
export function createMemoryAnchorChain(): MemoryAnchorChain {
  const trustlines = new Set<string>();
  const payments = new Map<string, ObservedPayment>();
  const payouts: Array<{ destination: string; amount: string; hash: string; memo: string }> = [];
  return {
    payouts,
    grantTrustline: (account) => void trustlines.add(account),
    recordPayment: (txHash, payment) => void payments.set(txHash, payment),
    hasTrustline: async (account) => trustlines.has(account),
    async payAsset(destination, amount, memo) {
      const hash = `mock${payouts.length}`.padEnd(64, "0");
      payouts.push({ destination, amount, hash, memo });
      return { hash };
    },
    findPayment: async (txHash) => payments.get(txHash) ?? null,
    async findPayout(destination, memo) {
      const found = payouts.find((payout) => payout.destination === destination && payout.memo === memo);
      return found ? { hash: found.hash } : null;
    },
  };
}

export interface HorizonAnchorChainOptions {
  readonly issuerSecret: string;
  readonly assetCode: string;
  readonly horizonUrl: string;
}

/** Testnet Horizon'a giden gerçek kapı; simülasyon sunucusunun varsayılanıdır. */
export function createHorizonAnchorChain(options: HorizonAnchorChainOptions): MockAnchorChain {
  const server = new Horizon.Server(options.horizonUrl);
  const issuer = Keypair.fromSecret(options.issuerSecret);
  const asset = new Asset(options.assetCode, issuer.publicKey());

  return {
    async hasTrustline(account) {
      const loaded = await server.loadAccount(account);
      return loaded.balances.some(
        (balance) =>
          "asset_code" in balance && balance.asset_code === asset.code && balance.asset_issuer === asset.issuer,
      );
    },
    async payAsset(destination, amount, memo) {
      const source = await server.loadAccount(issuer.publicKey());
      const transaction = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
        .addOperation(Operation.payment({ destination, asset, amount }))
        .addMemo(Memo.text(memo))
        .setTimeout(30)
        .build();
      transaction.sign(issuer);
      const response = await server.submitTransaction(transaction);
      return { hash: response.hash };
    },
    async findPayment(txHash) {
      let record: Horizon.ServerApi.TransactionRecord;
      try {
        record = await server.transactions().transaction(txHash).call();
      } catch {
        return null;
      }
      const operations = await server.operations().forTransaction(txHash).call();
      const payment = operations.records.find((operation) => operation.type === "payment");
      if (!payment || payment.type !== "payment") return null;
      return {
        destination: payment.to,
        amount: payment.amount,
        assetCode: payment.asset_code ?? "native",
        assetIssuer: payment.asset_issuer ?? "",
        memo: record.memo ?? null,
        memoType: record.memo_type ?? null,
        createdAt: Date.parse(record.created_at),
      };
    },
    /**
     * Anchor'ın bu hesaba yaptığı ödemeler arasında etiketi eşleşeni arar.
     * Yalnız son işlemlere bakar: idempotenslik kontrolü ödemeden hemen önce yapılır.
     */
    async findPayout(destination, memo) {
      try {
        const page = await server.transactions().forAccount(destination).order("desc").limit(50).call();
        const found = page.records.find(
          (record) => record.source_account === issuer.publicKey() && record.memo === memo && record.successful,
        );
        return found ? { hash: found.hash } : null;
      } catch {
        return null;
      }
    },
  };
}
