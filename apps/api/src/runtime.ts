import { Keypair, Networks, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";

import { NETWORK, SEED } from "../../../config/simulation";
import { createHorizonGateway } from "./anchor/classic";
import { createAnchorClient, type AnchorClient } from "./anchor/client";
import { createApi } from "./app";
import { createDefindexAdapter } from "./defindex/client";
import type { Environment } from "./env";
import { buildVaultTransaction, createVaultRpc, readVaultSnapshot, submitVaultTransaction } from "./stellar-vault";
import { createVaultJoiner } from "./vault-join";

export interface RuntimeDependencies {
  readonly anchor?: AnchorClient;
}

function required(environment: Environment, key: string): string {
  const value = environment[key];
  if (!value) throw new Error(`${key} eksik veya boş.`);
  return value;
}

/**
 * API'nin zincir, anchor ve DeFindex bağımlılıklarını ortamdan kurar.
 * Aynı fabrika yerel Node sunucusu ile Vercel route handler'ın farklılaşmasını önler.
 */
export function createRuntimeApi(environment: Environment, dependencies: RuntimeDependencies = {}) {
  const contractId = required(environment, "SHARED_VAULT_CONTRACT_ID");
  const adminPublic = required(environment, "ADMIN_PUBLIC");
  const rpc = createVaultRpc(NETWORK.rpcUrl);
  const vaultOptions = (sourceAccount: string) => ({
    networkPassphrase: NETWORK.networkPassphrase,
    contractId,
    sourceAccount,
  });

  const labels: Record<string, string> = {};
  (["ADMIN_PUBLIC", "MEMBER_A_PUBLIC", "MEMBER_B_PUBLIC", "MEMBER_C_PUBLIC"] as const).forEach((key, index) => {
    const address = environment[key];
    const seeded = SEED.members[index];
    if (address && seeded) labels[address] = seeded.name;
  });

  /**
   * Davet akışı: hesabı friendbot ile açar, `add_member`'ı ADMIN adına imzalayıp gönderir.
   * Kontrat değişmiyor; imzayı sunucudaki admin anahtarı atıyor (bkz. K-016).
   */
  const join = createVaultJoiner({
    adminSecret: environment.ADMIN_SECRET,
    members: async () => (await readVaultSnapshot(vaultOptions(adminPublic), rpc)).members.map((member) => member.address),
    accountExists: async (account) => (await fetch(`${NETWORK.horizonUrl}/accounts/${account}`)).ok,
    fund: async (account) => {
      const response = await fetch(`${NETWORK.friendbotUrl}?addr=${account}`);
      if (!response.ok) throw new Error(`Test hesabı açılamadı: friendbot HTTP ${response.status}`);
    },
    addMember: async (account) => {
      const admin = Keypair.fromSecret(required(environment, "ADMIN_SECRET"));
      const xdr = await buildVaultTransaction(vaultOptions(admin.publicKey()), rpc, {
        function: "add_member",
        caller: admin.publicKey(),
        newMember: account,
      });
      const transaction = TransactionBuilder.fromXDR(xdr, Networks.TESTNET) as Transaction;
      transaction.sign(admin);
      return submitVaultTransaction(vaultOptions(admin.publicKey()), rpc, transaction.toXDR());
    },
  });

  return createApi({
    vault: {
      name: SEED.vaultName,
      labels,
      contractId,
      readVault: () => readVaultSnapshot(vaultOptions(adminPublic), rpc),
      buildTransaction: (account, call) => buildVaultTransaction(vaultOptions(account), rpc, call),
      submit: (signedXdr) => submitVaultTransaction(vaultOptions(adminPublic), rpc, signedXdr),
      join,
    },
    anchor: dependencies.anchor ?? createAnchorClient(environment),
    classic: { gateway: createHorizonGateway(NETWORK.horizonUrl), networkPassphrase: NETWORK.networkPassphrase },
    defindex: createDefindexAdapter(environment),
  });
}
