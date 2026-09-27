import {NextResponse} from "next/server";
import {maintainMarkets,openEligibleMarkets} from "@/lib/market-opener";

function authorized(request:Request){
  const secret=process.env.CRON_SECRET;
  return Boolean(secret&&request.headers.get("authorization")===`Bearer ${secret}`);
}

async function run(request:Request){
  if(!authorized(request))return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const hash=new URL(request.url).searchParams.get("hash")??undefined;
    const maintenance=await maintainMarkets();
    return NextResponse.json({...await openEligibleMarkets(hash),maintenance});
  }catch(error){
    console.error("Market opener failed",error);
    return NextResponse.json({error:error instanceof Error?error.message:"Market opener failed"},{status:500});
  }
}

export const GET=run;
export const POST=run;
