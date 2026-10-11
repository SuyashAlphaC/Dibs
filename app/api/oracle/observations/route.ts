import {NextResponse} from "next/server";
import {getMarketsAwaitingResult,type SettlementMarket} from "@/lib/live-markets";
import {toNeynarCastHash} from "@/lib/farcaster";
import {collectQualifiedInteractions,NeynarCastNotFound} from "@/lib/neynar-observations";
import {ORACLE_BATCH_SIZE,prepareOracleBatch,selectOracleBatch,splitOracleQueue} from "@/lib/oracle-batch";
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
  try{
    // Read independent sources concurrently to leave room for Neynar's bounded
    // collection inside the CRE HTTP capability's 10-second request budget.
    const [markets,timing]=await Promise.all([getMarketsAwaitingResult(),getOracleTiming()]);
    if(!markets)return NextResponse.json({error:"Envio is unavailable"},{status:503});
    const {ready,expired}=splitOracleQueue(markets,Math.floor(Date.now()/1_000),timing);
    const batch=selectOracleBatch(ready);
    const collected=await Promise.allSettled(batch.map(market=>observeMarket(market,apiKey)));
    // The deployed DON binary treats `failed`/`deferred` as an execution error.
    // Keep market-level collection gaps explicit, but let valid markets settle.
    // The independent monitor alerts on retryable work; the keeper owns timeouts.
    const {observations,retryable,unavailable}=prepareOracleBatch(batch,collected,reason=>reason instanceof NeynarCastNotFound);
    if(retryable.length)console.error("Oracle observations require retry",retryable);
    if(unavailable.length)console.warn("Oracle casts unavailable; awaiting permissionless result timeout",unavailable);
    return NextResponse.json(
      {observations,retryable,unavailable,pending:ready.length,expired,batchLimit:ORACLE_BATCH_SIZE},
      {headers:{"cache-control":"no-store","x-dibs-oracle-source":"envio-neynar"}},
    );
  }catch(error){
    console.error("Oracle observation collection failed",error);
    return NextResponse.json({error:"Observation collection failed"},{status:502});
  }
}
