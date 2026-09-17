import { serve } from "@hono/node-server";

import { PORTS } from "../../../config/simulation";
import { loadEnvironment } from "./env";
import { createRuntimeApi } from "./runtime";

const environment = loadEnvironment();
const app = createRuntimeApi(environment);

serve({ fetch: app.fetch, port: PORTS.api }, ({ port }) => {
  console.log(`Kasa API (${environment.KASA_MODE}) http://localhost:${port} adresinde hazır.`);
});
