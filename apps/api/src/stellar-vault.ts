import {
  Account,
  BASE_FEE,
  Contract,
  nativeToScVal,
  rpc as StellarRpc,
  scValToNative,
  Transaction,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  assertAccountAddress,
  parseContractLedger,
  parseContractMembers,
  parseContractRequests,
  type ContractLedgerEntry,
  type ContractMember,
  type ContractSpendRequest,
} from "@kasa/core";

export interface VaultSnapshot {
  readonly balance: bigint;
  readonly members: readonly ContractMember[];
  readonly requests: readonly ContractSpendRequest[];
  readonly ledger: readonly ContractLedgerEntry[];
}

export interface VaultOptions {
  readonly networkPassphrase: string;
  readonly contractId: string;
  /** Okumalarda simulation kaynağı, yazmalarda işlemi imzalayacak üye. */
  readonly sourceAccount: string;
}

/** RPC'nin kullandığımız kesiti; testler sahte nesne geçer, üretimde `createVaultRpc` gerçek sunucuya gider. */
export interface VaultRpc {
  getAccount(accountId: string): Promise<Account>;
  simulate(transaction: Transaction, functionName: string): Promise<unknown>;
  prepare(transaction: Transaction): Promise<Transaction>;
  send(transaction: Transaction): Promise<{ hash: string; status: string }>;
  poll(hash: string): Promise<{ status: string }>;
}

/** Kontratın yazma fonksiyonları — argümanlar Bölüm 7.2'deki imzalarla birebir. */
export type VaultCall =
  | { readonly function: "add_member"; readonly caller: string; readonly newMember: string }
  | { readonly function: "remove_member"; readonly caller: string; readonly member: string }
  | { readonly function: "deposit"; readonly member: string; readonly amount: bigint }
  | { readonly function: "request_spend"; readonly member: string; readonly amount: bigint; readonly note: string }
  | { readonly function: "approve"; readonly member: string; readonly requestId: number }
  | { readonly function: "execute"; readonly requestId: number }
  | { readonly function: "cancel"; readonly caller: string; readonly requestId: number }
  | { readonly function: "emergency_exit"; readonly member: string };

function address(value: string): xdr.ScVal {
  return nativeToScVal(assertAccountAddress(value), { type: "address" });
}

function amount(value: bigint): xdr.ScVal {
  if (value <= 0n) throw new RangeError("Tutar sıfırdan büyük olmalı.");
  return nativeToScVal(value, { type: "i128" });
}

function requestId(value: number): xdr.ScVal {
  if (!Number.isInteger(value) || value < 0) throw new RangeError(`request_id negatif olamaz: ${value}`);
  return nativeToScVal(value, { type: "u32" });
}

function note(value: string): xdr.ScVal {
  if (value.trim() === "") throw new RangeError("Talep notu boş olamaz.");
  return nativeToScVal(value, { type: "string" });
}

/** Çağrıyı kontratın beklediği ScVal listesine çevirir; geçersiz girdi ağa gitmeden burada durur. */
export function encodeVaultCall(call: VaultCall): xdr.ScVal[] {
  switch (call.function) {
    case "add_member":
      return [address(call.caller), address(call.newMember)];
    case "remove_member":
      return [address(call.caller), address(call.member)];
    case "deposit":
      return [address(call.member), amount(call.amount)];
    case "request_spend":
      return [address(call.member), amount(call.amount), note(call.note)];
    case "approve":
      return [address(call.member), requestId(call.requestId)];
    case "execute":
      return [requestId(call.requestId)];
    case "cancel":
      return [address(call.caller), requestId(call.requestId)];
    case "emergency_exit":
      return [address(call.member)];
  }
}

async function unsignedInvocation(
  options: VaultOptions,
  rpc: VaultRpc,
  functionName: string,
  args: xdr.ScVal[],
): Promise<Transaction> {
  const source = await rpc.getAccount(options.sourceAccount);
  return new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: options.networkPassphrase })
    .addOperation(new Contract(options.contractId).call(functionName, ...args))
    .setTimeout(300)
    .build();
}

/** Üyenin cüzdanda imzalayacağı, footprint ve auth'u hazırlanmış imzasız XDR'ı üretir. */
export async function buildVaultTransaction(options: VaultOptions, rpc: VaultRpc, call: VaultCall): Promise<string> {
  const transaction = await unsignedInvocation(options, rpc, call.function, encodeVaultCall(call));
  return (await rpc.prepare(transaction)).toXDR();
}

/** İmzalı XDR'ı gönderir ve sonucu bekler; PENDING dışındaki her şey hata olarak yükselir. */
export async function submitVaultTransaction(
  options: VaultOptions,
  rpc: VaultRpc,
  signedXdr: string,
): Promise<{ hash: string }> {
  const transaction = TransactionBuilder.fromXDR(signedXdr, options.networkPassphrase);
  if (!(transaction instanceof Transaction)) throw new Error("Fee-bump işlemi desteklenmiyor.");
  const sent = await rpc.send(transaction);
  if (sent.status === "ERROR") throw new Error(`İşlem ağ tarafından reddedildi: ERROR (${sent.hash})`);
  const result = await rpc.poll(sent.hash);
  if (result.status !== "SUCCESS") throw new Error(`İşlem başarısız: ${result.status} (${sent.hash})`);
  return { hash: sent.hash };
}

/** Bir getter'ı simulation ile okur; imza veya zincir mutasyonu yapmaz. */
async function readGetter(options: VaultOptions, rpc: VaultRpc, functionName: string): Promise<unknown> {
  return rpc.simulate(await unsignedInvocation(options, rpc, functionName, []), functionName);
}

/** Kasa ana ekranı için dört getter'ı paralel okuyup doğrulanmış snapshot döndürür. */
export async function readVaultSnapshot(options: VaultOptions, rpc: VaultRpc): Promise<VaultSnapshot> {
  const [balance, members, requests, ledger] = await Promise.all([
    readGetter(options, rpc, "get_balance"),
    readGetter(options, rpc, "get_members"),
    readGetter(options, rpc, "get_requests"),
    readGetter(options, rpc, "get_ledger"),
  ]);
  return {
    balance: typeof balance === "bigint" ? balance : BigInt(String(balance)),
    members: parseContractMembers(members),
    requests: parseContractRequests(requests),
    ledger: parseContractLedger(ledger),
  };
}

/** Gerçek Soroban RPC kapısı. */
export function createVaultRpc(rpcUrl: string): VaultRpc {
  const server = new StellarRpc.Server(rpcUrl);
  return {
    getAccount: (accountId) => server.getAccount(accountId),
    async simulate(transaction, functionName) {
      const response = await server.simulateTransaction(transaction);
      if (!StellarRpc.Api.isSimulationSuccess(response) || !response.result) {
        throw new Error(`Kontrat getter simulation başarısız: ${functionName}`);
      }
      return scValToNative(response.result.retval);
    },
    prepare: (transaction) => server.prepareTransaction(transaction),
    async send(transaction) {
      const response = await server.sendTransaction(transaction);
      return { hash: response.hash, status: response.status };
    },
    async poll(hash) {
      const response = await server.pollTransaction(hash);
      return { status: response.status };
    },
  };
}
