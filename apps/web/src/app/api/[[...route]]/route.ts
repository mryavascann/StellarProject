import { createVercelApp } from "@kasa/api/vercel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let app: ReturnType<typeof createVercelApp> | undefined;

interface RouteContext {
  readonly params: Promise<{ readonly route?: readonly string[] }>;
}

function getApp() {
  const publicOrigin = process.env.KASA_PUBLIC_ORIGIN;
  if (!publicOrigin) throw new Error("KASA_PUBLIC_ORIGIN eksik veya boş.");
  return (app ??= createVercelApp(process.env, { publicOrigin }));
}

/** Rewrite sonrasındaki route parçalarından Hono'nun işleyeceği URL'yi üretir. */
export function forwardedApiUrl(request: Request, route: readonly string[] = []): string {
  const url = new URL(request.url);
  url.pathname = `/api/${route.map(encodeURIComponent).join("/")}`;
  return url.toString();
}

/** Next.js route handler isteklerini birleşik Hono uygulamasına iletir. */
async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { route } = await context.params;
  return getApp().fetch(new Request(forwardedApiUrl(request, route), request));
}

export { handle as DELETE, handle as GET, handle as OPTIONS, handle as PATCH, handle as POST, handle as PUT };
