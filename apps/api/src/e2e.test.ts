// @vitest-environment node
/**
 * UÇTAN UCA (Bölüm 8.5) — gerçek testnet + mock anchor + mock DeFindex (zincirde).
 * Taze bir üyeyle tam döngü: üye ekle → hesap hazırla → TL yatır (SEP-24) → USDC → pay →
 * kasaya kilitle → eşik üstü talep → 2 onay → execute → pay bozdur → memo'lu ödemeyle bankaya çek.
 *
 * Yalnızca `KASA_E2E=1` ile koşar (`pnpm test:e2e`); ağ gerektirir, dakikalar sürer.
 */
import { createHorizonAnchorChain, createMockAnchor } from "@kasa/mock-anchor";
import { fiatToAsset, toStroopsExact } from "@kasa/core";
import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { describe, expect, it } from "vitest";

import { ANCHOR, NETWORK, SEED, VAULT_INIT } from "../../../config/simulation";
import { createHorizonGateway } from "./anchor/classic";
import { createAnchorClient } from "./anchor/client";
import { createApi } from "./app";
import { createHorizonVaultChain, createMockDefindex } from "./defindex/mock";
import { loadEnvironment } from "./env";
import { buildVaultTransaction, createVaultRpc, readVaultSnapshot, submitVaultTransaction } from "./stellar-vault";

const DEPOSIT_FIAT = "1500.00"; // ⚠ SİM: 1500 TRY ≈ 30 USDC → eşik (20 pay) üstü talep açılabilsin
const enabled = process.env.KASA_E2E === "1";

function required(environment: Readonly<Record<string, string | undefined>>, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik.`);
  return value;
}

const sign = (keypair: Keypair) => async (xdr: string) => {
  const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
  transaction.sign(keypair);
  return transaction.toXDR();
};

describe.skipIf(!enabled)("uçtan uca: TL → kasa → talep → onay → execute → TL", () => {
  it("tam döngü testnet üzerinde tamamlanır", async () => {
    const environment = loadEnvironment({ KASA_MODE: "simulation" });
    const admin = Keypair.fromSecret(required(environment, "ADMIN_SECRET"));
    const approver = Keypair.fromSecret(required(environment, "MEMBER_A_SECRET"));
    const issuerSecret = required(environment, "MOCK_USDC_ISSUER_SECRET");
    const issuerPublic = required(environment, "MOCK_USDC_ISSUER_PUBLIC");
    const contractId = required(environment, "SHARED_VAULT_CONTRACT_ID");
    const member = Keypair.random();

    // Mock anchor ve API bellek içi, ama her ikisi de gerçek Horizon/RPC'ye gider.
    const mockAnchor = createMockAnchor({
      signingSecret: required(environment, "MOCK_ANCHOR_SIGNING_SECRET"),
      issuerPublic,
      custodialPublic: issuerPublic,
      chain: createHorizonAnchorChain({ issuerSecret, assetCode: ANCHOR.assetCode, horizonUrl: NETWORK.horizonUrl }),
    });
    const rpc = createVaultRpc(NETWORK.rpcUrl);
    const vaultOptions = (sourceAccount: string) => ({ networkPassphrase: NETWORK.networkPassphrase, contractId, sourceAccount });
    const app = createApi({
      vault: {
        name: SEED.vaultName,
        labels: {},
        contractId,
        readVault: () => readVaultSnapshot(vaultOptions(admin.publicKey()), rpc),
        buildTransaction: (account, call) => buildVaultTransaction(vaultOptions(account), rpc, call),
        submit: (signedXdr) => submitVaultTransaction(vaultOptions(admin.publicKey()), rpc, signedXdr),
      },
      anchor: createAnchorClient(environment, { fetcher: async (url, init) => mockAnchor.request(url, init) }),
      classic: { gateway: createHorizonGateway(NETWORK.horizonUrl), networkPassphrase: NETWORK.networkPassphrase },
      defindex: createMockDefindex({ issuerSecret, chain: createHorizonVaultChain(issuerPublic) }),
    });

    const call = async <T>(path: string, body?: unknown): Promise<T> => {
      const response = await app.request(path, body === undefined ? undefined : {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await response.json()) as T & { error?: string };
      if (!response.ok) throw new Error(`${path} → ${response.status}: ${json.error ?? ""}`);
      return json;
    };
    const vaultCall = async (keypair: Keypair, payload: Record<string, unknown>) => {
      const { xdr } = await call<{ xdr: string }>("/api/vault/tx", { account: keypair.publicKey(), ...payload });
      return call<{ hash: string }>("/api/vault/submit", { signedXdr: await sign(keypair)(xdr) });
    };

    // 0. Taze hesap: friendbot ile fonla, admin üye yapsın.
    const funded = await fetch(`${NETWORK.friendbotUrl}?addr=${member.publicKey()}`);
    expect(funded.ok).toBe(true);
    await vaultCall(admin, { function: "add_member", newMember: member.publicKey() });

    // 1. Banka bağlantısı oturumu (SEP-10) + hesap hazırlığı (trustline).
    const { transaction: challenge } = await call<{ transaction: string }>("/api/anchor/challenge", { account: member.publicKey() });
    await call("/api/anchor/token", { account: member.publicKey(), signedTransaction: await sign(member)(challenge) });
    const { xdr: trustXdr } = await call<{ xdr: string }>("/api/anchor/trustline/tx", { account: member.publicKey() });
    await call("/api/anchor/classic/submit", { signedXdr: await sign(member)(trustXdr) });
    expect((await call<{ exists: boolean }>(`/api/anchor/trustline?account=${member.publicKey()}`)).exists).toBe(true);

    // 2. TL yatır: mock anchor 3 adım sonra USDC'yi zincire öder.
    const deposit = await call<{ id: string; amountAsset: string }>("/api/anchor/deposit", { account: member.publicKey(), amountFiat: DEPOSIT_FIAT });
    expect(deposit.amountAsset).toBe(fiatToAsset(DEPOSIT_FIAT, ANCHOR.rate));
    let status = "";
    for (let attempt = 0; attempt < 30 && status !== "completed"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      status = (await call<{ status: string }>(`/api/anchor/transaction?account=${member.publicKey()}&id=${deposit.id}&direction=deposit`)).status;
      expect(["incomplete", "pending_user_transfer_start", "pending_anchor", "completed"]).toContain(status);
    }
    expect(status).toBe("completed");

    // 3. USDC → pay (mock DeFindex, zincirde), sonra pay → kasa (gerçek kontrat).
    const amountStroops = toStroopsExact(deposit.amountAsset);
    const depositTx = await call<{ xdr: string }>("/api/defindex/deposit/tx", { account: member.publicKey(), amountStroops: amountStroops.toString() });
    await call("/api/defindex/submit", { account: member.publicKey(), signedXdr: await sign(member)(depositTx.xdr) });
    const minted = BigInt((await call<{ balance: { shares: string } }>(`/api/defindex/overview?account=${member.publicKey()}`)).balance.shares);
    expect(minted).toBeGreaterThan(0n);
    const balanceBefore = BigInt((await call<{ balance: string }>("/api/vault")).balance);
    await vaultCall(member, { function: "deposit", amount: minted.toString() });
    expect(BigInt((await call<{ balance: string }>("/api/vault")).balance)).toBe(balanceBefore + minted);

    // 4. Eşik üstü talep → Pending; iki onay (admin + üye A) → Approved; execute → pay talep edende.
    // Basılan payın tamamı istenir: eşik üstü kalır ve koşu sonunda kasa bakiyesi değişmez.
    const requestAmount = minted;
    expect(requestAmount).toBeGreaterThan(VAULT_INIT.threshold);
    await vaultCall(member, { function: "request_spend", amount: requestAmount.toString(), note: "e2e Kira" });
    const snapshot = await call<{ requests: Array<{ id: number; requester: string; status: string; note: string }> }>("/api/vault");
    const request = snapshot.requests.find((item) => item.requester === member.publicKey() && item.note === "e2e Kira");
    expect(request?.status).toBe("Pending");
    await vaultCall(admin, { function: "approve", requestId: request!.id });
    await vaultCall(approver, { function: "approve", requestId: request!.id });
    await vaultCall(member, { function: "execute", requestId: request!.id });
    const executed = (await call<{ requests: Array<{ id: number; status: string }> }>("/api/vault")).requests.find((item) => item.id === request!.id);
    expect(executed?.status).toBe("Executed");
    const inWallet = BigInt((await call<{ balance: { shares: string } }>(`/api/defindex/overview?account=${member.publicKey()}`)).balance.shares);
    expect(inWallet).toBe(requestAmount);

    // 5. Pay → USDC (mock DeFindex), sonra memo'lu klasik ödemeyle banka bağlantısına (K-002).
    const withdrawTx = await call<{ xdr: string }>("/api/defindex/withdraw/tx", { account: member.publicKey(), shareStroops: requestAmount.toString() });
    await call("/api/defindex/submit", { account: member.publicKey(), signedXdr: await sign(member)(withdrawTx.xdr) });
    const usdcOut = "20.0000000"; // pay fiyatı ≥ 1 olduğundan en az 20 USDC elde var; sabit tutar çekiyoruz
    const withdrawal = await call<{ id: string; memo: string; payment: { destination: string; amount: string; memo: string; memoType: "id" } }>(
      "/api/anchor/withdraw",
      { account: member.publicKey(), amountAsset: usdcOut },
    );
    expect(withdrawal.payment.memoType).toBe("id");
    const { xdr: paymentXdr } = await call<{ xdr: string }>("/api/anchor/payment/tx", { account: member.publicKey(), ...withdrawal.payment });
    const { hash } = await call<{ hash: string }>("/api/anchor/classic/submit", { signedXdr: await sign(member)(paymentXdr) });
    await call("/api/anchor/payment", { id: withdrawal.id, memo: withdrawal.memo, txHash: hash });
    status = "";
    for (let attempt = 0; attempt < 10 && status !== "completed"; attempt += 1) {
      status = (await call<{ status: string }>(`/api/anchor/transaction?account=${member.publicKey()}&id=${withdrawal.id}&direction=withdraw`)).status;
      if (status !== "completed") await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    expect(status).toBe("completed");

    // 6. Temizlik: taze üye kasadan çıkarılır; demo üye listesi büyümez, kasa bakiyesi başa döner.
    await vaultCall(admin, { function: "remove_member", member: member.publicKey() });
    expect(BigInt((await call<{ balance: string }>("/api/vault")).balance)).toBe(balanceBefore);
  }, 600_000);
});
