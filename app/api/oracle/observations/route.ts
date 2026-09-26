import {NextResponse} from "next/server";
import {getMarketsAwaitingResult,type SettlementMarket} from "@/lib/live-markets";

type InteractionKind="like"|"recast"|"reply";
type NeynarUser={
  fid:number;
  registered_at:string;
  score?:number;
  experimental?:{neynar_user_score?:number};
};
type NeynarReaction={object:"likes"|"recasts";user:NeynarUser};
type NeynarReply={author:NeynarUser;direct_replies?:NeynarReply[]};
type QualifiedInteraction={fid:number;kind:InteractionKind;accountAgeDays:number;neynarScoreBps:number};

function userInteraction(user:NeynarUser,kind:InteractionKind,observedAt:number):QualifiedInteraction{
  const registeredAt=Date.parse(user.registered_at);
  const accountAgeDays=Number.isFinite(registeredAt)?Math.max(0,Math.floor((observedAt*1000-registeredAt)/86_400_000)):0;
  const score=user.score??user.experimental?.neynar_user_score??0;
  return {fid:user.fid,kind,accountAgeDays,neynarScoreBps:Math.round(Math.max(0,Math.min(1,score))*10_000)};
}

async function neynar(path:string,params:Record<string,string>,apiKey:string){
  const url=new URL(`https://api.neynar.com${path}`);
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  const response=await fetch(url,{headers:{"x-api-key":apiKey,"x-neynar-experimental":"true"},cache:"no-store"});
  if(!response.ok)throw new Error(`Neynar ${path} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function flattenReplies(replies:NeynarReply[]):NeynarReply[]{
  return replies.flatMap(reply=>[reply,...flattenReplies(reply.direct_replies??[])]);
}

async function observeMarket(market:SettlementMarket,apiKey:string){
  const [reactionPayload,conversationPayload]=await Promise.all([
    neynar("/v2/farcaster/reactions/cast/",{hash:market.castHash,types:"all",limit:"100"},apiKey) as Promise<{reactions?:NeynarReaction[]}>,
    neynar("/v2/farcaster/cast/conversation/",{identifier:market.castHash,type:"hash",reply_depth:"5",limit:"50",sort_type:"chron"},apiKey) as Promise<{conversation?:{cast?:{direct_replies?:NeynarReply[]}}}>,
  ]);
  const observedAt=market.closesAt;
  const reactions=(reactionPayload.reactions??[]).map(reaction=>userInteraction(reaction.user,reaction.object==="likes"?"like":"recast",observedAt));
  const replies=flattenReplies(conversationPayload.conversation?.cast?.direct_replies??[]).map(reply=>userInteraction(reply.author,"reply",observedAt));
  return {
    marketId:market.marketId,
    castHash:market.castHash,
    baselineQualifiedScore:market.baselineEngagement*1_000,
    observedAt,
    interactions:[...reactions,...replies],
  };
}

export async function GET(){
  const apiKey=process.env.NEYNAR_API_KEY;
  if(!apiKey)return NextResponse.json({error:"NEYNAR_API_KEY is not configured"},{status:503});
  const markets=await getMarketsAwaitingResult();
  if(!markets)return NextResponse.json({error:"Envio is unavailable"},{status:503});
  try{
    const observations=await Promise.all(markets.map(market=>observeMarket(market,apiKey)));
    return NextResponse.json({observations},{headers:{"cache-control":"s-maxage=30, stale-while-revalidate=30"}});
  }catch(error){
    console.error("Oracle observation collection failed",error);
    return NextResponse.json({error:"Observation collection failed"},{status:502});
  }
}
