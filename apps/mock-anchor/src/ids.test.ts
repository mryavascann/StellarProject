import { describe, expect, it } from "vitest";

import { decodeSigned, encodeSigned, type TransferPayload } from "./ids";

const SECRET = "SCLO43GUH7V3K3XTS47OYX4SUVTDIJQCZRPKL6FPXAEJO5P5HUB4N54R";
const payload: TransferPayload = {
  kind: "withdraw",
  account: "GACCOUNT",
  amount: "15.0000000",
  memo: "12345",
  createdAt: 1_789_000_000_000,
};

describe("imzalı işlem kimlikleri", () => {
  it("kimliği kodlar ve aynı sırrı bilen okur", async () => {
    const id = await encodeSigned(payload, SECRET);
    expect(await decodeSigned<TransferPayload>(id, SECRET)).toEqual(payload);
  });

  it("kimlik URL'de taşınabilir: yalnız URL-güvenli karakterler içerir", async () => {
    const id = await encodeSigned(payload, SECRET);
    expect(id).toMatch(/^[A-Za-z0-9_.-]+$/u);
    expect(encodeURIComponent(id)).toBe(id);
  });

  it("gövdesi kurcalanan kimliği reddeder", async () => {
    const id = await encodeSigned(payload, SECRET);
    const [body, signature] = id.split(".");
    const forged = Buffer.from(JSON.stringify({ ...payload, amount: "9999.0000000" })).toString("base64url");
    expect(body).not.toBe(forged);
    expect(await decodeSigned(`${forged}.${signature ?? ""}`, SECRET)).toBeNull();
  });

  it("başka sırla imzalanmış kimliği reddeder", async () => {
    const id = await encodeSigned(payload, otherSecret());
    expect(await decodeSigned(id, SECRET)).toBeNull();
  });

  it("bozuk veya eksik kimliğe null döner", async () => {
    expect(await decodeSigned("", SECRET)).toBeNull();
    expect(await decodeSigned("tek-parca", SECRET)).toBeNull();
    expect(await decodeSigned("!!!.???", SECRET)).toBeNull();
  });
});

/** Farklı bir sır: aynı gövde başka anahtarla imzalanınca kabul edilmemeli. */
function otherSecret(): string {
  return "SDIFFERENTSECRETVALUEFORNEGATIVETESTONLY0000000000000000";
}
