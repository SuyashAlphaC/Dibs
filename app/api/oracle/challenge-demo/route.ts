import {NextResponse} from "next/server";
import {buildInflatedChallengeObservation} from "@/lib/challenge-demo";
import {getMarketsAwaitingResult} from "@/lib/live-markets";

export const dynamic="force-dynamic";

export async function GET(){
  if(process.env.CHALLENGE_DEMO_ENABLED!=="true")return NextResponse.json({error:"Challenge rehearsal is disabled."},{status:404});
  const marketId=Number(process.env.CHALLENGE_DEMO_MARKET_ID);
  if(!Number.isSafeInteger(marketId)||marketId<=0)return NextResponse.json({error:"CHALLENGE_DEMO_MARKET_ID is not configured."},{status:503});
  const markets=await getMarketsAwaitingResult();
  if(!markets)return NextResponse.json({error:"Envio is unavailable."},{status:503});
  const market=markets.find(candidate=>candidate.marketId===marketId);
  if(!market)return NextResponse.json({error:`Market ${marketId} is not ready for the rehearsal.`},{status:409});
  try{
    return NextResponse.json({
      simulation:true,
      purpose:"Optimistic challenge rehearsal with an intentionally inflated first report.",
      warning:"Never use this endpoint for normal production settlement.",
      observations:[buildInflatedChallengeObservation(market)],
    },{headers:{"cache-control":"no-store","x-dibs-simulation":"true"}});
  }catch(error){
    return NextResponse.json({error:error instanceof Error?error.message:"Invalid challenge rehearsal state."},{status:409});
  }
}
