import type {SettlementMarket} from "@/lib/live-markets";

export function buildInflatedChallengeObservation(market:SettlementMarket){
  if(market.action!=="submit")throw new Error("The challenge rehearsal must start before a result is submitted.");
  return {
    marketId:market.marketId,
    castHash:market.castHash,
    baselineQualifiedScore:market.baselineQualifiedScore,
    observedAt:market.closesAt,
    interactions:Array.from({length:64},(_,index)=>({
      fid:9_000_000+index,
      kind:"reply" as const,
      accountAgeDays:730,
      neynarScoreBps:10_000,
    })),
    action:"submit" as const,
    previousQualityGrowthScore:0,
  };
}
