import {NextResponse} from "next/server";
import {getMarketsAwaitingResult,type SettlementMarket} from "@/lib/live-markets";
import {toNeynarCastHash} from "@/lib/farcaster";
import {collectQualifiedInteractions} from "@/lib/neynar-observations";
import {ORACLE_BATCH_SIZE,packOracleBatch,selectOracleBatch,splitOracleQueue} from "@/lib/oracle-batch";
import {getOracleTiming} from "@/lib/oracle-policy";

export const dynamic = "force-dynamic";

async function observeMarket(market:SettlementMarket,apiKey:string){
  const neynarHash=toNeynarCastHash(market.castHash);
  const observedAt=market.closesAt;
  const interactions=await collectQualifiedInteractions(neynarHash,observedAt,apiKey,AbortSignal.timeout(7_000));
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
    const timing=await getOracleTiming();
    const {ready,expired}=splitOracleQueue(markets,Math.floor(Date.now()/1_000),timing);
    const batch=selectOracleBatch(ready);
    const collected=await Promise.allSettled(batch.map(market=>observeMarket(market,apiKey)));
    const observations=collected.flatMap(result=>result.status==="fulfilled"?[result.value]:[]);
    const packed=packOracleBatch(observations);
    const failed=collected.flatMap((result,index)=>result.status==="rejected"?[batch[index].marketId]:[]);
    if(failed.length)console.error("Oracle observations deferred",failed);
    return NextResponse.json(
      {...packed,failed,pending:ready.length,expired,batchLimit:ORACLE_BATCH_SIZE},
      {status:batch.length&&!packed.observations.length?503:200,headers:{"cache-control":"no-store","x-dibs-oracle-source":"envio-neynar"}},
    );
  }catch(error){
    console.error("Oracle observation collection failed",error);
    return NextResponse.json({error:"Observation collection failed"},{status:502});
  }
}
