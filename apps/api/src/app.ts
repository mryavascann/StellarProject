import type { ContractMember, ContractSpendRequest } from "@kasa/core";
import { Hono } from "hono";
import { cors } from "hono/cors";

export interface VaultSnapshot {
  readonly balance: bigint;
  readonly members: readonly ContractMember[];
  readonly requests: readonly ContractSpendRequest[];
}

export interface ApiDependencies {
  readonly readVault: () => Promise<VaultSnapshot>;
}

function jsonSnapshot(snapshot: VaultSnapshot) {
  return {
    balance: snapshot.balance.toString(),
    members: snapshot.members.map((member) => ({
      ...member,
      contributed: member.contributed.toString(),
      withdrawn: member.withdrawn.toString(),
    })),
    requests: snapshot.requests.map((request) => ({
      ...request,
      amount: request.amount.toString(),
    })),
  };
}

/** Web arayüzünün kullandığı HTTP API'yi bağımlılıkları dışarıdan alarak kurar. */
export function createApi(dependencies: ApiDependencies) {
  const app = new Hono();
  app.use("/api/*", cors({ origin: "*" }));
  app.get("/health", (context) => context.json({ ok: true }));
  app.get("/api/vault", async (context) => {
    try {
      return context.json(jsonSnapshot(await dependencies.readVault()));
    } catch {
      return context.json({ error: "Kasa verisi şu an alınamıyor. Tekrar dene." }, 503);
    }
  });
  return app;
}
