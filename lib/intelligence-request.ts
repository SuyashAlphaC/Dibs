import {intelligenceChain} from "./conviction-intelligence";

export function parseIntelligenceRequest(marketId: string, body: unknown) {
  if (!/^[1-9]\d{0,15}$/.test(marketId)) return null;
  if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => key !== "chain")) return null;
  const chain = intelligenceChain((body as {chain?: unknown}).chain);
  return chain ? {marketId, chain} : null;
}

export function intelligenceSameOrigin(request: Request) {
  try {
    return request.headers.get("origin") === new URL(request.url).origin && !["cross-site", "same-site"].includes(request.headers.get("sec-fetch-site") ?? "");
  } catch { return false; }
}

export function createScanLimiter(now = Date.now) {
  const attempts = new Map<string, number>();
  return (userId: string) => {
    const time = now();
    for (const [user, started] of attempts) if (time - started >= 60_000) attempts.delete(user);
    const started = attempts.get(userId);
    if (started !== undefined) return Math.max(1, Math.ceil((60_000 - (time - started)) / 1_000));
    if (attempts.size >= 1_000) return 60;
    attempts.set(userId, time);
    return 0;
  };
}
