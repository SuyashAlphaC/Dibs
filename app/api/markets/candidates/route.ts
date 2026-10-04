import {NextResponse} from "next/server";
import {getEligibleMarketCandidates,openEligibleMarkets} from "@/lib/market-opener";
import {authenticateScout} from "@/lib/privy-auth";
import {marketAutomationPolicy} from "@/lib/operator-safety";

const attempts=new Map<string,number>();
const RATE_LIMIT_MS=30_000;
let candidateCache:{expiresAt:number;payload:Awaited<ReturnType<typeof getEligibleMarketCandidates>>}|null=null;

function sameOrigin(request:Request){
  const origin=request.headers.get("origin");
  const fetchSite=request.headers.get("sec-fetch-site");
  if(!origin)return false;
  try{
    const requestHost=request.headers.get("x-forwarded-host")??request.headers.get("host")??new URL(request.url).host;
    return new URL(origin).host===requestHost&&(!fetchSite||fetchSite==="same-origin");
  }catch{return false;}
}

function identifier(value:unknown){
  if(typeof value!=="string")return null;
  const normalized=value.trim();
  if(/^0x[0-9a-fA-F]{40}$/.test(normalized))return normalized;
  try{
    const url=new URL(normalized);
    return url.protocol==="https:"&&(url.hostname==="farcaster.xyz"||url.hostname.endsWith(".farcaster.xyz"))&&normalized.length<=500?normalized:null;
  }catch{return null;}
}

export async function GET(){
  try{
    if(candidateCache&&candidateCache.expiresAt>Date.now())return NextResponse.json(candidateCache.payload,{headers:{"cache-control":"public, s-maxage=15, stale-while-revalidate=30"}});
    const payload=await getEligibleMarketCandidates();
    candidateCache={payload,expiresAt:Date.now()+15_000};
    return NextResponse.json(payload,{headers:{"cache-control":"public, s-maxage=15, stale-while-revalidate=30"}});
  }
  catch(error){
    console.error("Candidate discovery failed",error);
    return NextResponse.json({error:"Fresh Farcaster candidates are temporarily unavailable"},{status:503});
  }
}

export async function POST(request:Request){
  if(!sameOrigin(request))return NextResponse.json({error:"Cross-site nominations are not allowed"},{status:403});
  let scout;
  try{scout=await authenticateScout(request);}catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Authentication failed"},{status:401});}
  const policy=marketAutomationPolicy();
  if(!policy.publicNominationsEnabled)return NextResponse.json({error:"Public nominations are temporarily paused"},{status:503});
  const client=scout.userId;
  const lastAttempt=attempts.get(client)??0;
  const elapsed=Date.now()-lastAttempt;
  if(elapsed<RATE_LIMIT_MS){
    const retryAfterSeconds=Math.max(1,Math.ceil((RATE_LIMIT_MS-elapsed)/1000));
    return NextResponse.json(
      {error:`Wait ${retryAfterSeconds} seconds before nominating another cast`,retryAfterSeconds},
      {status:429,headers:{"retry-after":String(retryAfterSeconds)}},
    );
  }
  let body:unknown;
  try{body=await request.json();}catch{return NextResponse.json({error:"Invalid request body"},{status:400});}
  const requested=identifier((body as {identifier?:unknown})?.identifier);
  if(!requested)return NextResponse.json({error:"Enter a full Farcaster cast URL or cast hash"},{status:400});
  attempts.set(client,Date.now());
  try{
    const result=await openEligibleMarkets(requested,1,policy.publicEpochMarketCap,false);
    if(result.opened.length){
      console.info(JSON.stringify({event:"public_market_nomination",userId:scout.userId,fid:scout.fid,username:scout.username,identifier:requested,marketHash:result.opened[0].hash,transaction:result.opened[0].transaction}));
      return NextResponse.json(result,{status:201});
    }
    const reason=result.skipped[0]?.reason;
    return NextResponse.json({error:reason??"This cast is not currently eligible for an early market",...result},{status:409});
  }catch(error){
    console.error("Public market nomination failed",error);
    return NextResponse.json({error:"Market nomination failed before confirmation"},{status:500});
  }
}
