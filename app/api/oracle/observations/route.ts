import {NextResponse} from "next/server";
import {getMarketsAwaitingResult,type SettlementMarket} from "@/lib/live-markets";
import {toNeynarCastHash} from "@/lib/farcaster";
import {collectQualifiedInteractions} from "@/lib/neynar-observations";

export const dynamic = "force-dynamic";

async function observeMarket(market:SettlementMarket,apiKey:string){
  const neynarHash=toNeynarCastHash(market.castHash);
  const observedAt=market.closesAt;
  const interactions=await collectQualifiedInteractions(neynarHash,observedAt,apiKey);
  return {
    marketId:market.marketId,
    castHash:market.castHash,
    baselineQualifiedScore:market.baselineQualifiedScore,
    observedAt,
    interactions,
    action:market.action,
    previousQualityGrowthScore:market.previousQualityGrowthScore,
  };
}

export async function GET(){
  const apiKey=process.env.NEYNAR_API_KEY;
  if(!apiKey)return NextResponse.json({error:"NEYNAR_API_KEY is not configured"},{status:503});
  const markets=await getMarketsAwaitingResult();
  if(!markets)return NextResponse.json({error:"Envio is unavailable"},{status:503});
  try{
    const observations=await Promise.all(markets.map(market=>observeMarket(market,apiKey)));
    return NextResponse.json(
      {observations},
      {headers:{"cache-control":"no-store","x-dibs-oracle-source":"envio-neynar"}},
    );
  }catch(error){
    console.error("Oracle observation collection failed",error);
    return NextResponse.json({error:"Observation collection failed"},{status:502});
  }
}
