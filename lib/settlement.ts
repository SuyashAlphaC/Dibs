import type {CastMarket} from "@/lib/types";

export function settlementMetrics(market: CastMarket) {
  const closingInteractions = market.likes + market.recasts + market.replies;
  const hasWeightedBaseline = market.baselineEngagement === undefined && market.baselineQualifiedScore !== undefined;
  return {
    closingInteractions,
    openingValue: hasWeightedBaseline
      ? market.baselineQualifiedScore ?? 0
      : market.baselineEngagement ?? 0,
    openingLabel: hasWeightedBaseline ? "Opening quality baseline" : "Opening engagement",
    openingDetail: hasWeightedBaseline ? "Qualified weighted points" : "Raw interactions at open",
    qualityGrowth: market.status === "settled" ? market.settlementScore ?? 0 : null,
  };
}

export function scoreBarWidth(score: number) {
  if (score <= 0) return 0;
  return Math.min(100, Math.log10(score + 1) * 24);
}
