import {NextResponse} from "next/server";
import {getMarketsAwaitingResult} from "@/lib/live-markets";

export const dynamic = "force-dynamic";

export async function GET(){
  const awaiting=await getMarketsAwaitingResult();
  const checkedAt=new Date().toISOString();
  if(!awaiting){
    return NextResponse.json(
      {ok:false,checkedAt,services:{envio:"unavailable",oracleQueue:"unknown"}},
      {status:503,headers:{"cache-control":"no-store"}},
    );
  }
  return NextResponse.json(
    {
      ok:true,
      checkedAt,
      services:{envio:"ready",oracleQueue:"ready"},
      awaitingResults:awaiting.length,
      actions:awaiting.reduce((counts,market)=>{
        counts[market.action]++;
        return counts;
      },{submit:0,resolve:0}),
    },
    {headers:{"cache-control":"no-store"}},
  );
}
