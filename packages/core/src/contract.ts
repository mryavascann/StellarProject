import { assertAccountAddress } from "./stellar.js";

export const REQUEST_STATUSES = ["Pending", "Approved", "Executed", "Cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface ContractMember {
  readonly address: string;
  readonly joinedAt: number;
  readonly contributed: bigint;
  readonly withdrawn: bigint;
}

export interface ContractSpendRequest {
  readonly id: number;
  readonly requester: string;
  readonly amount: bigint;
  readonly note: string;
  readonly approvals: readonly string[];
  readonly status: RequestStatus;
  readonly createdAt: number;
  readonly expiresAt: number;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${field} nesne olmalı.`);
  }
  return value as Record<string, unknown>;
}

function stringField(value: unknown, field: string): string {
  if (typeof value !== "string") throw new TypeError(`${field} metin olmalı.`);
  return value;
}

function integerField(value: unknown, field: string): number {
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new TypeError(`${field} güvenli tamsayı olmalı.`);
    }
    return Number(value);
  }
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`${field} güvenli tamsayı olmalı.`);
  }
  return value;
}

function bigintField(value: unknown, field: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value !== "string" || !/^-?\d+$/u.test(value)) {
    throw new TypeError(`${field} zincir tamsayısı olmalı.`);
  }
  return BigInt(value);
}

function addressField(value: unknown, field: string): string {
  return assertAccountAddress(stringField(value, field));
}

/** `get_members` JSON yanıtını para hassasiyetini koruyan uygulama tiplerine dönüştürür. */
export function parseContractMembers(value: unknown): readonly ContractMember[] {
  if (!Array.isArray(value)) throw new TypeError("Üye yanıtı dizi olmalı.");
  return value.map((item, index) => {
    const member = record(item, `members[${index}]`);
    return {
      address: addressField(member.address, `members[${index}].address`),
      joinedAt: integerField(member.joined_at, `members[${index}].joined_at`),
      contributed: bigintField(member.contributed, `members[${index}].contributed`),
      withdrawn: bigintField(member.withdrawn, `members[${index}].withdrawn`),
    };
  });
}

function requestStatus(value: unknown, field: string): RequestStatus {
  if (typeof value !== "string" || !REQUEST_STATUSES.includes(value as RequestStatus)) {
    throw new TypeError(`${field} bilinmeyen kontrat durumuna sahip: ${String(value)}`);
  }
  return value as RequestStatus;
}

/** `get_requests` JSON yanıtını doğrular; tutarları hiçbir zaman `number` yapmaz. */
export function parseContractRequests(value: unknown): readonly ContractSpendRequest[] {
  if (!Array.isArray(value)) throw new TypeError("Talep yanıtı dizi olmalı.");
  return value.map((item, index) => {
    const request = record(item, `requests[${index}]`);
    if (!Array.isArray(request.approvals)) {
      throw new TypeError(`requests[${index}].approvals dizi olmalı.`);
    }
    return {
      id: integerField(request.id, `requests[${index}].id`),
      requester: addressField(request.requester, `requests[${index}].requester`),
      amount: bigintField(request.amount, `requests[${index}].amount`),
      note: stringField(request.note, `requests[${index}].note`),
      approvals: request.approvals.map((address, approvalIndex) =>
        addressField(address, `requests[${index}].approvals[${approvalIndex}]`),
      ),
      status: requestStatus(request.status, `requests[${index}].status`),
      createdAt: integerField(request.created_at, `requests[${index}].created_at`),
      expiresAt: integerField(request.expires_at, `requests[${index}].expires_at`),
    };
  });
}
