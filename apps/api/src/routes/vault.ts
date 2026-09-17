import { Hono } from "hono";

import type { VaultCall, VaultSnapshot } from "../stellar-vault";
import type { JoinResult } from "../vault-join";
import { json, requireStroops, requireText } from "./respond";

export interface VaultRouteDependencies {
  /** Kasa adı ve üye etiketleri kontratta değil, demo yapılandırmasındadır (⚠ SİM, config/simulation.ts). */
  readonly name: string;
  readonly labels: Readonly<Record<string, string>>;
  readonly contractId: string;
  readVault(): Promise<VaultSnapshot>;
  buildTransaction(account: string, call: VaultCall): Promise<string>;
  submit(signedXdr: string): Promise<{ hash: string }>;
  /** Davetle katılma; sunucuda admin anahtarı yoksa çağrı anlaşılır hatayla döner. */
  join(account: string): Promise<JoinResult>;
}

const FUNCTIONS = ["add_member", "remove_member", "deposit", "request_spend", "approve", "execute", "cancel", "emergency_exit"] as const;

/** İstek gövdesini tipli kontrat çağrısına çevirir; tutarlar stroop metni olarak gelir. */
function parseCall(account: string, body: Record<string, unknown>): VaultCall {
  const fn = body.function;
  if (typeof fn !== "string" || !FUNCTIONS.includes(fn as (typeof FUNCTIONS)[number])) {
    throw new TypeError(`function alanı geçersiz: ${String(fn)}`);
  }
  const id = () => {
    const value = body.requestId;
    if (typeof value !== "number" || !Number.isInteger(value)) throw new TypeError("requestId tamsayı olmalı.");
    return value;
  };
  switch (fn as (typeof FUNCTIONS)[number]) {
    case "add_member":
      return { function: "add_member", caller: account, newMember: requireText(body, "newMember") };
    case "remove_member":
      return { function: "remove_member", caller: account, member: requireText(body, "member") };
    case "deposit":
      return { function: "deposit", member: account, amount: requireStroops(body, "amount") };
    case "request_spend":
      return { function: "request_spend", member: account, amount: requireStroops(body, "amount"), note: requireText(body, "note") };
    case "approve":
      return { function: "approve", member: account, requestId: id() };
    case "execute":
      return { function: "execute", requestId: id() };
    case "cancel":
      return { function: "cancel", caller: account, requestId: id() };
    case "emergency_exit":
      return { function: "emergency_exit", member: account };
  }
}

/** Kasa uçları: okuma snapshot'ı, imzasız kontrat işlemi üretimi ve imzalı gönderim. */
export function vaultRoutes(dependencies: VaultRouteDependencies) {
  const app = new Hono();

  app.get("/", async (context) =>
    json(context, {
      name: dependencies.name,
      labels: dependencies.labels,
      contractId: dependencies.contractId,
      ...(await dependencies.readVault()),
    }),
  );

  app.post("/tx", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    const account = requireText(body, "account");
    const xdr = await dependencies.buildTransaction(account, parseCall(account, body));
    return json(context, { xdr });
  });

  app.post("/submit", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    return json(context, await dependencies.submit(requireText(body, "signedXdr")));
  });

  /** Davet: cüzdan adresi gelir, gerekiyorsa hesap açılır ve kasaya üye yapılır. */
  app.post("/join", async (context) => {
    const body = await context.req.json<Record<string, unknown>>();
    return json(context, await dependencies.join(requireText(body, "account")));
  });

  return app;
}
