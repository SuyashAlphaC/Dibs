import {NextResponse} from "next/server";
import {demoCasts} from "@/lib/demo-data";
import {getLiveMarkets, getLiveScoutSignals} from "@/lib/live-markets";

export async function GET(request: Request) {
  const searchParams=new URL(request.url).searchParams;
  const scout = searchParams.get("scout") ?? undefined;
  const viewerFidValue=Number(searchParams.get("viewerFid"));
  const viewerFid=Number.isSafeInteger(viewerFidValue)&&viewerFidValue>0?viewerFidValue:undefined;
  const validScout = scout && /^0x[a-fA-F0-9]{40}$/.test(scout) ? scout : undefined;
  const [markets, signals] = await Promise.all([
    getLiveMarkets(validScout,viewerFid),
    getLiveScoutSignals(viewerFid),
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
