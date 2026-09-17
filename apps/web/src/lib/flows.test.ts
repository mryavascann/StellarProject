import { BRAND } from "@kasa/core";
import { afterEach, describe, expect, it, vi } from "vitest";

import { depositFlow, openAnchorPopup, withdrawFlow } from "./flows";
import type { Signer } from "./signer";

const signer: Signer = { kind: "key", address: "GACC", sign: vi.fn(async (xdr: string) => `signed:${xdr}`) };

function mockApi(handlers: Record<string, (init?: RequestInit) => unknown>) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const path = new URL(String(input)).pathname + (new URL(String(input)).search ? "?" : "");
      const key = Object.keys(handlers).find((candidate) => path.startsWith(candidate));
      if (!key) throw new Error(`beklenmeyen istek: ${path}`);
      calls.push(key);
      return new Response(JSON.stringify(handlers[key]!(init)), { headers: { "content-type": "application/json" } });
    }),
  );
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("popup", () => {
  it("postMessage dinleyicisini pencereyi açmadan ÖNCE kaydeder", () => {
    const order: string[] = [];
    vi.spyOn(window, "addEventListener").mockImplementation(() => order.push("listen"));
    vi.spyOn(window, "open").mockImplementation(() => {
      order.push("open");
      return null;
    });
    const popup = openAnchorPopup(() => undefined);
    expect(order).toEqual(["listen", "open"]);
    // Pencere açılamadıysa adres yollanamaz; akış bunu kullanıcıya söyleyecek.
    expect(popup.show("http://anchor/x")).toBe(false);
  });
});

describe("para yatırma akışı", () => {
  it("trustline yoksa hesabı hazırlar, popup'ı açar, tamamlanınca pay üretip kasaya kilitler", async () => {
    let shares = "100000000";
    let polls = 0;
    const calls = mockApi({
      "/api/anchor/info": () => ({ trustlineRequired: true }),
      "/api/anchor/trustline/tx": () => ({ xdr: "TRUST" }),
      "/api/anchor/trustline?": () => ({ exists: false }),
      "/api/anchor/classic/submit": () => ({ hash: "h1" }),
      "/api/anchor/deposit": () => ({ id: "d1", url: "http://anchor/i", amountAsset: "20.0000000", quoteExpiresAt: "x" }),
      "/api/anchor/transaction": () => ({ status: ++polls < 2 ? "pending_anchor" : "completed", title: "t", description: "d", action: null, tone: "success" }),
      "/api/defindex/overview": () => ({ balance: { shares, underlying: shares } }),
      "/api/defindex/deposit/tx": () => ({ xdr: "DFX" }),
      "/api/defindex/submit": () => {
        shares = "300000000";
        return { txHash: "h2" };
      },
      "/api/vault/tx": (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ account: "GACC", function: "deposit", amount: "200000000" });
        return { xdr: "VX" };
      },
      "/api/vault/submit": () => ({ hash: "h3" }),
    });
    const steps: string[] = [];
    const show = vi.fn((_url: string) => true);
    const popup = { show, close: vi.fn() };

    const result = await depositFlow({
      signer,
      amountFiat: "1000.00",
      report: (key, state) => steps.push(`${key}:${state}`),
      onStatus: () => undefined,
      popup,
      pollMs: 1,
    });

    expect(result.vaultHash).toBe("h3");
    expect(show).toHaveBeenCalledWith("http://anchor/i");
    expect(popup.close).toHaveBeenCalledOnce();
    expect(steps).toEqual(["banka:active", "hesap:active", "banka:done", "getiri:active", "getiri:done", "kasa:active", "kasa:done"]);
    expect(calls.indexOf("/api/anchor/trustline/tx")).toBeLessThan(calls.indexOf("/api/anchor/deposit"));
  });
});

describe("para çekme akışı", () => {
  it("payı bozdurur, memo'lu ödemeyi üyeye imzalatır, bildirir ve tamamlanmayı bekler", async () => {
    let underlying = "500000000";
    const payment = { destination: "GCUST", amount: "30.0000000", memo: "42", memoType: "id" };
    const calls = mockApi({
      "/api/defindex/overview": () => ({ balance: { shares: "0", underlying } }),
      "/api/defindex/withdraw/tx": () => ({ xdr: "WX" }),
      "/api/defindex/submit": () => {
        underlying = "200000000";
        return { txHash: "h1" };
      },
      "/api/anchor/withdraw": (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ account: "GACC", amountAsset: "30.0000000" });
        return { id: "w1", url: "u", memo: "42", payment };
      },
      "/api/anchor/payment/tx": (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ account: "GACC", ...payment });
        return { xdr: "PX" };
      },
      "/api/anchor/classic/submit": () => ({ hash: "PH" }),
      "/api/anchor/payment": (init) => {
        expect(JSON.parse(String(init?.body))).toEqual({ id: "w1", memo: "42", txHash: "PH" });
        return { ok: true };
      },
      "/api/anchor/transaction": () => ({ status: "completed", title: "t", description: "d", action: null, tone: "success" }),
    });

    const result = await withdrawFlow({ signer, shareStroops: 300000000n, report: () => undefined, onStatus: () => undefined, pollMs: 1 });
    expect(result.paymentHash).toBe("PH");
    expect(calls.indexOf("/api/anchor/classic/submit")).toBeLessThan(calls.indexOf("/api/anchor/payment"));
  });
});

describe("banka ekranı popup'ı", () => {
  it("tarayıcı pencereyi engellerse ne yapılacağını söyler", async () => {
    mockApi({
      "/api/anchor/info": () => ({ trustlineRequired: false }),
      "/api/anchor/challenge": () => ({ transaction: "CH" }),
      "/api/anchor/token": () => ({ token: "JWT", expiresAt: Date.now() + 900_000 }),
      "/api/anchor/deposit": () => ({ id: "1", url: "http://anchor/i", amountAsset: "20.0000000", quoteExpiresAt: "x" }),
    });

    await expect(
      depositFlow({
        signer,
        amountFiat: "1000.00",
        report: () => undefined,
        onStatus: () => undefined,
        popup: { show: () => false, close: () => undefined },
        pollMs: 1,
      }),
    ).rejects.toThrow(BRAND.messages.popupBlocked);
  });
});
