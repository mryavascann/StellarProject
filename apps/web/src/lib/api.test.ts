import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, api, withAnchorSession } from "./api";
import type { Signer } from "./signer";

const signer: Signer = { kind: "key", address: "GACCOUNT", sign: vi.fn(async (xdr: string) => `signed:${xdr}`) };

function mockFetch(handler: (url: string, init?: RequestInit) => { status?: number; body: unknown }) {
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const result = handler(String(input), init);
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetcher);
  return fetcher;
}

afterEach(() => vi.unstubAllGlobals());

describe("API istemcisi", () => {
  it("hata gövdesindeki Türkçe mesajı ApiError olarak yükseltir", async () => {
    mockFetch(() => ({ status: 400, body: { error: "amountFiat 2 ondalıklı metin olmalı (örn. 500.00)." } }));
    await expect(api.anchorDeposit("G", "5")).rejects.toMatchObject({ status: 400, message: expect.stringContaining("amountFiat") });
  });

  it("401 auth_required gelince SEP-10'u cüzdanla şeffafça tekrarlar ve isteği yeniler", async () => {
    let authenticated = false;
    const fetcher = mockFetch((url, init) => {
      if (url.endsWith("/api/anchor/challenge")) return { body: { transaction: "CHALLENGE" } };
      if (url.endsWith("/api/anchor/token")) {
        authenticated = true;
        expect(JSON.parse(String(init?.body))).toEqual({ account: "GACCOUNT", signedTransaction: "signed:CHALLENGE" });
        return { body: { ok: true } };
      }
      if (url.endsWith("/api/anchor/deposit")) {
        return authenticated ? { body: { id: "1", url: "u", amountAsset: "20.0000000", quoteExpiresAt: "x" } } : { status: 401, body: { error: "auth_required" } };
      }
      throw new Error(`beklenmeyen istek: ${url}`);
    });

    const result = await withAnchorSession(signer, () => api.anchorDeposit("GACCOUNT", "1000.00"));
    expect(result.id).toBe("1");
    expect(signer.sign).toHaveBeenCalledWith("CHALLENGE");
    expect(fetcher.mock.calls.filter(([url]) => String(url).endsWith("/api/anchor/deposit"))).toHaveLength(2);
  });

  it("auth dışı hataları tekrarlamadan yükseltir", async () => {
    const fetcher = mockFetch(() => ({ status: 503, body: { error: "İşlem şu an yapılamıyor. Tekrar dene." } }));
    await expect(withAnchorSession(signer, () => api.vault())).rejects.toBeInstanceOf(ApiError);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
