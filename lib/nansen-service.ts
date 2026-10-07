import "server-only";
import {unstable_cache} from "next/cache";
import {buildConvictionReport, normalizeBackers, MAX_INTELLIGENCE_BACKERS, type ConvictionBacker, type IntelligenceChain, type WalletQuery} from "./conviction-intelligence";
import {createNansenClient, NansenError} from "./nansen-client";

export function nansenIntegrationStatus() {
  return {enabled: process.env.NANSEN_INTELLIGENCE_ENABLED === "true", configured: Boolean(process.env.NANSEN_API_KEY?.trim()), maxWalletsPerScan: MAX_INTELLIGENCE_BACKERS, cacheSeconds: 900};
}

// Cache only successful, sanitized DTOs. No key or Privy token enters the cached arguments.
const client = createNansenClient({apiKey: process.env.NANSEN_API_KEY ?? ""});
const getWalletContext = unstable_cache(client, ["dibs-nansen-related-wallets-v1"], {revalidate: 900});

export async function analyzeMarketConviction(marketId: string, chain: IntelligenceChain, positions: ConvictionBacker[]) {
  const selected = normalizeBackers(positions).slice(0, MAX_INTELLIGENCE_BACKERS);
  const queries: WalletQuery[] = [];
  // Two parallel calls at a time; no retry storm or unbounded market-wide fan-out.
  for (let offset = 0; offset < selected.length; offset += 2) {
    const batch = await Promise.all(selected.slice(offset, offset + 2).map(async position => {
      try { return {address: position.address, context: await getWalletContext(position.address, chain)}; }
      catch (error) { return {address: position.address, error: error instanceof NansenError ? error.code : "upstream-unavailable"}; }
    }));
    queries.push(...batch);
  }
  return buildConvictionReport({marketId, chain, positions, queries});
}
