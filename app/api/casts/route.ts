import {NextResponse} from "next/server";
import {demoCasts} from "@/lib/demo-data";
import {getLiveMarkets, getLiveScoutSignals} from "@/lib/live-markets";

export async function GET(request: Request) {
  const scout = new URL(request.url).searchParams.get("scout") ?? undefined;
  const validScout = scout && /^0x[a-fA-F0-9]{40}$/.test(scout) ? scout : undefined;
  const [markets, signals] = await Promise.all([
    getLiveMarkets(validScout),
    getLiveScoutSignals(),
  ]);

  if (markets?.length) {
    const visibleMarketIds = new Set(markets.map((market) => market.id));
    return NextResponse.json({
      source: "envio",
      casts: markets,
      signals: (signals ?? []).filter((signal) => visibleMarketIds.has(signal.marketId)),
    });
  }
  return NextResponse.json({source: "demo", casts: demoCasts, signals: []});
}
