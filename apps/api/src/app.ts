import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AnchorClient } from "./anchor/client";
import type { Waiter } from "./defindex/deposit";
import type { DefindexAdapter } from "./defindex/types";
import { anchorRoutes, type ClassicDependencies } from "./routes/anchor";
import { defindexRoutes } from "./routes/defindex";
import { handleError, json } from "./routes/respond";
import { vaultRoutes, type VaultRouteDependencies } from "./routes/vault";

export type { VaultSnapshot } from "./stellar-vault";

export interface ApiDependencies {
  readonly vault: VaultRouteDependencies;
  readonly anchor: AnchorClient;
  readonly classic: ClassicDependencies;
  readonly defindex: DefindexAdapter;
  readonly wait?: Waiter;
}

/**
 * Web arayüzünün kullandığı HTTP API. Bağımlılıklar dışarıdan gelir; mod bilgisi yalnızca
 * iki fabrikada okunur (K-003), bu dosya moddan habersizdir.
 */
export function createApi(dependencies: ApiDependencies) {
  const app = new Hono();
  app.use("/api/*", cors({ origin: "*" }));
  app.onError(handleError);
  app.get("/health", (context) => json(context, { ok: true }));
  app.route("/api/vault", vaultRoutes(dependencies.vault));
  app.route("/api/anchor", anchorRoutes(dependencies.anchor, dependencies.classic));
  app.route("/api/defindex", defindexRoutes(dependencies.defindex, dependencies.wait));
  return app;
}
