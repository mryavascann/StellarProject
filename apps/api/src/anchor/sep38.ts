export interface AnchorQuote {
  readonly id: string;
  readonly expires_at: string;
  readonly buy_amount: string;
}

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

async function requestQuote(quoteServer: string, sellAmount: string, fetcher: Fetcher): Promise<AnchorQuote> {
  const response = await fetcher(`${quoteServer}/quote`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sell_amount: sellAmount }),
  });
  if (!response.ok) throw new Error(`SEP-38 quote alınamadı: HTTP ${response.status}`);
  const body = await response.json() as Record<string, unknown>;
  if (typeof body.id !== "string" || typeof body.expires_at !== "string" || typeof body.buy_amount !== "string") {
    throw new Error("SEP-38 quote yanıtı eksik.");
  }
  return { id: body.id, expires_at: body.expires_at, buy_amount: body.buy_amount };
}

/** Firm quote süresi dolmuş gelirse ham hatayı göstermeden bir kez yeniden fiyatlar. */
export async function requestFreshQuote(
  quoteServer: string,
  sellAmount: string,
  now: () => Date = () => new Date(),
  fetcher: Fetcher = fetch,
): Promise<AnchorQuote> {
  if (!/^\d+\.\d{7}$/u.test(sellAmount)) throw new Error("Quote tutarı 7 ondalıklı metin olmalı.");
  let quote = await requestQuote(quoteServer, sellAmount, fetcher);
  if (new Date(quote.expires_at).getTime() <= now().getTime()) {
    quote = await requestQuote(quoteServer, sellAmount, fetcher);
  }
  if (new Date(quote.expires_at).getTime() <= now().getTime()) {
    throw new Error("Yenilenen SEP-38 quote da süresi dolmuş geldi.");
  }
  return quote;
}
