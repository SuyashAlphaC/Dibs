import {NextResponse} from "next/server";
import {demoCasts} from "@/lib/demo-data";
import {getLiveMarkets} from "@/lib/live-markets";

export async function GET(request: Request) {
  const scout = new URL(request.url).searchParams.get("scout") ?? undefined;
  const validScout = scout && /^0x[a-fA-F0-9]{40}$/.test(scout) ? scout : undefined;
  const markets = await getLiveMarkets(validScout);

  if (markets?.length) return NextResponse.json({source: "envio", casts: markets});
  return NextResponse.json({source: "demo", casts: demoCasts});
}
