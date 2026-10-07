import {NANSEN_RELATED_ENDPOINT, intelligenceChain, parseRelatedWallets, type IntelligenceChain, type WalletContext} from "./conviction-intelligence";

export class NansenError extends Error {
  constructor(public readonly code: string) { super(code); }
}

/** The server wrapper owns credentials. Injected fetch/time keep credit and error behavior testable. */
export function createNansenClient({apiKey, fetcher = fetch, now = Date.now}: {apiKey: string; fetcher?: typeof fetch; now?: () => number}) {
  const cache = new Map<string, {expires: number; value: WalletContext}>();
  const inFlight = new Map<string, Promise<WalletContext>>();
  let windowStarted = now();
  let requests = 0;
  return async function relatedWallets(address: string, chain: IntelligenceChain): Promise<WalletContext> {
    if (!apiKey.trim()) throw new NansenError("not-configured");
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) throw new NansenError("invalid-address");
    if (!intelligenceChain(chain)) throw new NansenError("invalid-chain");
    address = address.toLowerCase();
    const key = `${chain}:${address}`;
    const existing = cache.get(key);
    if (existing && existing.expires > now()) return existing.value;
    const pending = inFlight.get(key);
    if (pending) return pending;
    if (now() - windowStarted >= 3_600_000) { windowStarted = now(); requests = 0; }
    // Additional per-instance ceiling. Not a distributed account-wide spending guarantee.
    if (requests >= 60) throw new NansenError("instance-budget-exhausted");
    requests++;
    const job = (async () => {
      let response: Response;
      try {
        response = await fetcher(NANSEN_RELATED_ENDPOINT, {method: "POST", headers: {apikey: apiKey, "content-type": "application/json"}, body: JSON.stringify({wallet_address: address, chain, pagination: {page: 1, per_page: 100}}), cache: "no-store", signal: AbortSignal.timeout(5_000)});
      } catch { throw new NansenError("upstream-unavailable"); }
      if (!response.ok) throw new NansenError(response.status === 401 ? "authentication-failed" : response.status === 402 || response.status === 403 ? "credits-or-plan-required" : response.status === 429 ? "provider-rate-limited" : "upstream-unavailable");
      let parsed: ReturnType<typeof parseRelatedWallets>;
      try {
        const text = await response.text();
        if (new TextEncoder().encode(text).length > 250_000) throw new Error("Response budget exceeded");
        parsed = parseRelatedWallets(JSON.parse(text), chain);
      } catch { throw new NansenError("invalid-provider-response"); }
      const credits = response.headers.get("x-nansen-credits-used");
      const creditValue = credits === null ? null : Number(credits);
      const requestId = response.headers.get("x-request-id");
      const value: WalletContext = {...parsed, address, chain, fetchedAt: new Date(now()).toISOString(), requestId: requestId?.slice(0, 200) ?? null, creditsUsed: creditValue !== null && Number.isFinite(creditValue) && creditValue >= 0 ? creditValue : null};
      if (cache.size >= 256) cache.delete(cache.keys().next().value!);
      cache.set(key, {expires: now() + 900_000, value});
      return value;
    })();
    inFlight.set(key, job);
    try { return await job; } finally { inFlight.delete(key); }
  };
}
