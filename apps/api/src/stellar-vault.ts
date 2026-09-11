import {
  BASE_FEE,
  Contract,
  rpc,
  scValToNative,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { parseContractMembers, parseContractRequests } from "@kasa/core";

import type { VaultSnapshot } from "./app.js";

export interface VaultReaderOptions {
  readonly rpcUrl: string;
  readonly networkPassphrase: string;
  readonly contractId: string;
  readonly sourceAccount: string;
}

/** Bir kontrat getter'ını RPC simulation ile okur; imza veya zincir mutasyonu yapmaz. */
async function simulateGetter(options: VaultReaderOptions, functionName: string): Promise<unknown> {
  const server = new rpc.Server(options.rpcUrl);
  const source = await server.getAccount(options.sourceAccount);
  const transaction = new TransactionBuilder(source, {
    fee: BASE_FEE,
    networkPassphrase: options.networkPassphrase,
  })
    .addOperation(new Contract(options.contractId).call(functionName))
    .setTimeout(30)
    .build();
  const response = await server.simulateTransaction(transaction);
  if (!rpc.Api.isSimulationSuccess(response) || !response.result) {
    throw new Error(`Kontrat getter simulation başarısız: ${functionName}`);
  }
  return scValToNative(response.result.retval);
}

/** Kasa ana ekranı için üç getter'ı paralel okuyup doğrulanmış snapshot döndürür. */
export async function readVaultSnapshot(options: VaultReaderOptions): Promise<VaultSnapshot> {
  const [balance, members, requests] = await Promise.all([
    simulateGetter(options, "get_balance"),
    simulateGetter(options, "get_members"),
    simulateGetter(options, "get_requests"),
  ]);
  return {
    balance: typeof balance === "bigint" ? balance : BigInt(String(balance)),
    members: parseContractMembers(members),
    requests: parseContractRequests(requests),
  };
}
