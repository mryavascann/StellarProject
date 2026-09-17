import { createVercelApp } from "@kasa/api/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let app: ReturnType<typeof createVercelApp> | undefined;

function getApp() {
  const publicOrigin = process.env.KASA_PUBLIC_ORIGIN;
  if (!publicOrigin) throw new Error("KASA_PUBLIC_ORIGIN eksik veya boş.");
  return (app ??= createVercelApp(process.env, { publicOrigin }));
}

/** Next.js route handler isteklerini birleşik Hono uygulamasına iletir. */
async function handle(request: Request): Promise<Response> {
  return getApp().fetch(request);
}

export { handle as DELETE, handle as GET, handle as OPTIONS, handle as PATCH, handle as POST, handle as PUT };
