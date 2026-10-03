import {createWalletClient,http,isAddress,padHex,type Address,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {monad,monadClient} from "@/lib/contract";
import {collectQualifiedInteractions} from "@/lib/neynar-observations";
import {encodeQualityBaseline,qualifiedInteractionScore} from "@/lib/quality-baseline";
import type {MarketCandidate} from "@/lib/types";
import {
  DEFAULT_DISCOVERY_POLICY,
  discoveryPriority,
  qualifiesForDiscovery,
  type DiscoveryPolicy,
} from "@/lib/discovery-quality";
import {assertOperatorBalanceFloor,assertOperatorCanSpend,marketAutomationPolicy} from "@/lib/operator-safety";

const openerAbi=[
  {type:"function",name:"epochCount",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"marketCount",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"challengePeriod",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint40"}]},
  {type:"function",name:"resultSubmissionGracePeriod",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint40"}]},
  {type:"function",name:"challengeResolutionPeriod",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint40"}]},
  {type:"function",name:"epochs",stateMutability:"view",inputs:[{name:"",type:"uint256"}],outputs:[{name:"opensAt",type:"uint40"},{name:"closesAt",type:"uint40"},{name:"latestResultAt",type:"uint40"},{name:"marketCount",type:"uint32"},{name:"resultCount",type:"uint32"},{name:"rewardPool",type:"uint256"},{name:"allocated",type:"uint256"},{name:"finalized",type:"bool"}]},
  {type:"function",name:"marketIdByCastHash",stateMutability:"view",inputs:[{name:"",type:"bytes32"}],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"markets",stateMutability:"view",inputs:[{name:"",type:"uint256"}],outputs:[{name:"epochId",type:"uint32"},{name:"openedAt",type:"uint40"},{name:"resultSubmittedAt",type:"uint40"},{name:"baselineEngagement",type:"uint64"},{name:"totalUnits",type:"uint128"},{name:"totalStake",type:"uint256"},{name:"qualityGrowthScore",type:"uint256"},{name:"scoutAllocation",type:"uint256"},{name:"creatorAllocation",type:"uint256"},{name:"castHash",type:"bytes32"},{name:"evidenceHash",type:"bytes32"},{name:"creator",type:"address"},{name:"challenger",type:"address"},{name:"resultSubmitted",type:"bool"},{name:"challenged",type:"bool"},{name:"challengeResolved",type:"bool"}]},
  {type:"function",name:"createEpoch",stateMutability:"payable",inputs:[{name:"opensAt",type:"uint40"},{name:"closesAt",type:"uint40"}],outputs:[{name:"epochId",type:"uint256"}]},
  {type:"function",name:"openMarket",stateMutability:"nonpayable",inputs:[{name:"epochId",type:"uint256"},{name:"castHash",type:"bytes32"},{name:"creator",type:"address"},{name:"baselineEngagement",type:"uint64"}],outputs:[{name:"marketId",type:"uint256"}]},
  {type:"function",name:"expireMissingResult",stateMutability:"nonpayable",inputs:[{name:"marketId",type:"uint256"}],outputs:[]},
  {type:"function",name:"expireChallenge",stateMutability:"nonpayable",inputs:[{name:"marketId",type:"uint256"}],outputs:[]},
  {type:"function",name:"finalizeEpoch",stateMutability:"nonpayable",inputs:[{name:"epochId",type:"uint256"}],outputs:[]},
  {type:"function",name:"challenge",stateMutability:"payable",inputs:[{name:"marketId",type:"uint256"}],outputs:[]},
  {type:"function",name:"challengeBond",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint96"}]},
  {type:"function",name:"unitsOf",stateMutability:"view",inputs:[{name:"marketId",type:"uint256"},{name:"scout",type:"address"}],outputs:[{name:"",type:"uint256"}]},
] as const;

type NeynarCast={hash:string;timestamp:string;parent_hash?:string|null;parent_url?:string|null;text?:string;author:{fid?:number;username?:string;display_name?:string;pfp_url?:string;custody_address?:string;score?:number;follower_count?:number;registered_at?:string;verified_addresses?:{primary?:{eth_address?:string};eth_addresses?:string[]}};reactions?:{likes_count?:number;recasts_count?:number};replies?:{count?:number}};

function creator(cast:NeynarCast):Address|null{
  const candidate=cast.author.verified_addresses?.primary?.eth_address??cast.author.verified_addresses?.eth_addresses?.[0]??cast.author.custody_address;
  return candidate&&isAddress(candidate)?candidate:null;
}
function discoveryPolicy():DiscoveryPolicy{
  return {
    ...DEFAULT_DISCOVERY_POLICY,
    minAuthorScore:Number(process.env.MARKET_MIN_AUTHOR_SCORE??DEFAULT_DISCOVERY_POLICY.minAuthorScore),
    minAuthorAgeDays:Number(process.env.MARKET_MIN_AUTHOR_AGE_DAYS??DEFAULT_DISCOVERY_POLICY.minAuthorAgeDays),
    minCastCharacters:Number(process.env.MARKET_MIN_CAST_CHARACTERS??DEFAULT_DISCOVERY_POLICY.minCastCharacters),
  };
}
function eligible(cast:NeynarCast,now:number,policy:DiscoveryPolicy){
  return /^0x[0-9a-fA-F]{40}$/.test(cast.hash)
    && creator(cast)!==null
    && qualifiesForDiscovery(cast,now,policy);
}

async function neynarFeed(apiKey:string,requestedIdentifier?:string){
  const fetchCasts=async(url:URL)=>{
    const response=await fetch(url,{headers:{"x-api-key":apiKey,"x-neynar-experimental":"true"},cache:"no-store"});
    if(!response.ok)throw new Error(`Neynar discovery returned ${response.status}`);
    const payload=await response.json() as {cast?:NeynarCast;casts?:NeynarCast[]};
    return payload.cast?[payload.cast]:(payload.casts??[]);
  };
  if(requestedIdentifier){
    const url=new URL("https://api.neynar.com/v2/farcaster/cast");url.searchParams.set("identifier",requestedIdentifier);url.searchParams.set("type",/^0x[0-9a-fA-F]{40}$/.test(requestedIdentifier)?"hash":"url");
    return fetchCasts(url);
  }
  const sources=(process.env.MARKET_SOURCE_CHANNELS??"farcaster,monad,ethereum,builders").split(",").map(value=>value.trim()).filter(Boolean);
  const batches=await Promise.all(sources.map(async channel=>{
    const url=new URL("https://api.neynar.com/v2/farcaster/feed/");url.searchParams.set("feed_type","filter");url.searchParams.set("filter_type","channel_id");url.searchParams.set("channel_id",channel);url.searchParams.set("limit","25");url.searchParams.set("with_recasts","false");
    try{return await fetchCasts(url);}catch{return [];}
  }));
  const byHash=new Map(batches.flat().map(cast=>[cast.hash,cast]));
  return [...byHash.values()].sort((a,b)=>Date.parse(b.timestamp)-Date.parse(a.timestamp));
}

function category(cast:NeynarCast){
  const value=cast.parent_url?.split("/").filter(Boolean).at(-1)??"Farcaster";
  if(value.startsWith("erc721:"))return "Collectibles";
  if(value.startsWith("erc20:"))return "Tokens";
  return value.length>24?"Onchain":value.replaceAll("-"," ").replace(/\b\w/g,letter=>letter.toUpperCase());
}

function publicCandidate(cast:NeynarCast,now:number):MarketCandidate{
  const username=cast.author.username??`fid-${cast.author.fid??0}`;
  return {
    hash:cast.hash as `0x${string}`,
    author:{
      fid:cast.author.fid??0,
      username,
      displayName:cast.author.display_name??username,
      avatarUrl:cast.author.pfp_url??`https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(username)}&backgroundColor=18181b`,
    },
    text:cast.text?.trim()??"",
    timestamp:cast.timestamp,
    ageMinutes:Math.max(0,Math.floor((now-Date.parse(cast.timestamp)/1000)/60)),
    likes:cast.reactions?.likes_count??0,
    recasts:cast.reactions?.recasts_count??0,
    replies:cast.replies?.count??0,
    category:category(cast),
  };
}

async function discoverEligibleCasts(apiKey:string,requestedIdentifier?:string,limit=12){
  const discovered=await neynarFeed(apiKey,requestedIdentifier);
  const now=Math.floor(Date.now()/1000);
  const policy=discoveryPolicy();
  const casts=discovered
    .filter(cast=>eligible(cast,now,policy))
    .sort((a,b)=>discoveryPriority(b,now)-discoveryPriority(a,now))
    .slice(0,limit);
  return {discovered:discovered.length,now,casts};
}

export async function getEligibleMarketCandidates(requestedIdentifier?:string){
  const apiKey=process.env.NEYNAR_API_KEY;
  const contract=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as Address|undefined;
  if(!apiKey||!contract)throw new Error("Market candidate environment is incomplete");
  const result=await discoverEligibleCasts(apiKey,requestedIdentifier);
  const candidates=(await Promise.all(result.casts.map(async cast=>{
    const castHash=padHex(cast.hash as Hex,{size:32,dir:"right"});
    const existing=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"marketIdByCastHash",args:[castHash]});
    return existing===0n?publicCandidate(cast,result.now):null;
  }))).filter((candidate):candidate is MarketCandidate=>candidate!==null);
  return {discovered:result.discovered,eligible:result.casts.length,candidates};
}

async function active24HourEpoch(contract:Address,now:bigint){
  const count=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochCount"});
  for(let id=count;id>0n;id--){
    const epoch=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochs",args:[id]});
    const [opensAt,closesAt,,, ,,,finalized]=epoch;
    const duration=closesAt-opensAt;
    if(!finalized&&opensAt<=now&&closesAt>now&&duration>=86_340n&&duration<=86_460n)return id;
  }
  return null;
}

export async function openEligibleMarkets(requestedIdentifier?:string,maxMarkets?:number,epochMarketCap?:number,allowEpochCreation=true){
  const policy=marketAutomationPolicy();
  const requestedLimit=maxMarkets??policy.maxMarketsPerRun;
  const safeLimit=Math.min(requestedLimit,policy.maxMarketsPerRun);
  const key=process.env.MARKET_OPENER_PRIVATE_KEY as Hex|undefined;
  const apiKey=process.env.NEYNAR_API_KEY;
  const contract=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as Address|undefined;
  const rpc=process.env.NEXT_PUBLIC_MONAD_RPC_URL;
  if(!key||!apiKey||!contract||!rpc)throw new Error("Market opener environment is incomplete");
  const account=privateKeyToAccount(key);
  const wallet=createWalletClient({account,chain:monad,transport:http(rpc)});
  const now=BigInt(Math.floor(Date.now()/1000));
  const discovery=await discoverEligibleCasts(apiKey,requestedIdentifier,Math.max(1,safeLimit));
  const candidates=discovery.casts;
  if(!candidates.length)return {epochId:null,discovered:discovery.discovered,eligible:0,opened:[],skipped:[]};
  let epochId=await active24HourEpoch(contract,now);
  if(epochId&&epochMarketCap){
    const epoch=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochs",args:[epochId]});
    if(Number(epoch[3])>=epochMarketCap)return {epochId:epochId.toString(),discovered:discovery.discovered,eligible:candidates.length,opened:[],skipped:candidates.map(cast=>({hash:cast.hash,reason:`public epoch limit ${epochMarketCap} reached`}))};
  }
  const skipped:Array<{hash:string;reason:string}>=[];
  const prepared:Array<{cast:NeynarCast;castHash:Hex;castCreator:Address;baseline:bigint}>=[];
  for(const cast of candidates){
    const castHash=padHex(cast.hash as Hex,{size:32,dir:"right"});
    const existing=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"marketIdByCastHash",args:[castHash]});
    if(existing!==0n){skipped.push({hash:cast.hash,reason:`already market ${existing}`});continue;}
    const castCreator=creator(cast);
    if(!castCreator){skipped.push({hash:cast.hash,reason:"no EVM creator address"});continue;}
    try{
      const interactions=await collectQualifiedInteractions(cast.hash,Number(now),apiKey);
      prepared.push({cast,castHash,castCreator,baseline:encodeQualityBaseline(qualifiedInteractionScore(interactions))});
    }catch{skipped.push({hash:cast.hash,reason:"qualified baseline unavailable"});}
  }
  if(!prepared.length)return {epochId:epochId?.toString()??null,discovered:discovery.discovered,eligible:candidates.length,opened:[],skipped};
  assertOperatorBalanceFloor(await monadClient.getBalance({address:account.address}),policy);
  let epochTransaction:Hex|undefined;
  if(!epochId){
    if(!allowEpochCreation)return {epochId:null,discovered:discovery.discovered,eligible:candidates.length,opened:[],skipped:prepared.map(({cast})=>({hash:cast.hash,reason:"No active epoch. The funded keeper opens epochs; public nominations cannot spend sponsor funds."}))};
    const balance=await monadClient.getBalance({address:account.address});
    assertOperatorCanSpend(balance,policy);
    const count=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochCount"});
    epochId=count+1n;
    epochTransaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"createEpoch",args:[Number(now),Number(now+86_400n)],value:policy.epochSeed});
    await monadClient.waitForTransactionReceipt({hash:epochTransaction});
  }
  const opened:Array<{hash:string;transaction:Hex;candidate:MarketCandidate}>=[];
  for(const {cast,castHash,castCreator,baseline} of prepared){
    assertOperatorBalanceFloor(await monadClient.getBalance({address:account.address}),policy);
    const transaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"openMarket",args:[epochId,castHash,castCreator,baseline]});
    await monadClient.waitForTransactionReceipt({hash:transaction});
    opened.push({hash:cast.hash,transaction,candidate:publicCandidate(cast,discovery.now)});
  }
  return {epochId:epochId.toString(),epochTransaction,discovered:discovery.discovered,eligible:candidates.length,opened,skipped};
}

export async function maintainMarkets(){
  const policy=marketAutomationPolicy();
  const key=process.env.MARKET_OPENER_PRIVATE_KEY as Hex|undefined;
  const contract=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as Address|undefined;
  const rpc=process.env.NEXT_PUBLIC_MONAD_RPC_URL;
  if(!key||!contract||!rpc)throw new Error("Market keeper environment is incomplete");
  const account=privateKeyToAccount(key);
  const wallet=createWalletClient({account,chain:monad,transport:http(rpc)});
  const now=Math.floor(Date.now()/1000);
  const challengeDemoMarket=process.env.CHALLENGE_DEMO_MARKET_ID;
  const [marketCount,challengePeriod,resultGrace,resolutionPeriod]=await Promise.all([
    monadClient.readContract({address:contract,abi:openerAbi,functionName:"marketCount"}),
    monadClient.readContract({address:contract,abi:openerAbi,functionName:"challengePeriod"}),
    monadClient.readContract({address:contract,abi:openerAbi,functionName:"resultSubmissionGracePeriod"}),
    monadClient.readContract({address:contract,abi:openerAbi,functionName:"challengeResolutionPeriod"}),
  ]);
  const transactions:Array<{action:string,id:string,transaction:Hex}>=[];
  const write=async(action:string,id:string,execute:()=>Promise<Hex>)=>{
    if(transactions.length>=policy.maxMaintenanceTransactionsPerRun)return false;
    assertOperatorBalanceFloor(await monadClient.getBalance({address:account.address}),policy);
    const transaction=await execute();
    await monadClient.waitForTransactionReceipt({hash:transaction});
    transactions.push({action,id,transaction});
    return true;
  };
  const epochIds=new Set<number>();
  for(let id=1n;id<=marketCount;id++){
    const market=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"markets",args:[id]});
    const [epochId,,resultSubmittedAt,,,,,,,,,,,resultSubmitted,challenged,challengeResolved]=market;
    epochIds.add(epochId);
    const epoch=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochs",args:[BigInt(epochId)]});
    const closesAt=epoch[1];
    let action:"expireMissingResult"|"expireChallenge"|null=null;
    if(!resultSubmitted&&now>=closesAt+resultGrace)action="expireMissingResult";
    else if(challenged&&!challengeResolved&&now>=resultSubmittedAt+challengePeriod+resolutionPeriod)action="expireChallenge";
    if(action){
      const executed=await write(action,id.toString(),()=>wallet.writeContract({address:contract,abi:openerAbi,functionName:action,args:[id]}));
      if(!executed)break;
      if(action==="expireMissingResult"&&challengeDemoMarket===id.toString()){
        const [units,bond]=await Promise.all([
          monadClient.readContract({address:contract,abi:openerAbi,functionName:"unitsOf",args:[id,account.address]}),
          monadClient.readContract({address:contract,abi:openerAbi,functionName:"challengeBond"}),
        ]);
        if(units>0n){
          await write("challengeDemo",id.toString(),()=>wallet.writeContract({address:contract,abi:openerAbi,functionName:"challenge",args:[id],value:bond}));
        }
      }
    }else if(challengeDemoMarket===id.toString()&&resultSubmitted&&!challenged&&now<resultSubmittedAt+challengePeriod){
      const [units,bond]=await Promise.all([
        monadClient.readContract({address:contract,abi:openerAbi,functionName:"unitsOf",args:[id,account.address]}),
        monadClient.readContract({address:contract,abi:openerAbi,functionName:"challengeBond"}),
      ]);
      if(units>0n){
        await write("challengeDemo",id.toString(),()=>wallet.writeContract({address:contract,abi:openerAbi,functionName:"challenge",args:[id],value:bond}));
      }
    }
  }
  for(const epochId of epochIds){
    const epoch=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochs",args:[BigInt(epochId)]});
    const [, ,latestResultAt,marketTotal,resultCount,,,finalized]=epoch;
    if(!finalized&&marketTotal>0&&resultCount===marketTotal&&now>=latestResultAt+challengePeriod){
      try{
        await write("finalizeEpoch",String(epochId),()=>wallet.writeContract({address:contract,abi:openerAbi,functionName:"finalizeEpoch",args:[BigInt(epochId)]}));
      }catch{/* An unresolved challenge keeps finalization safely locked. */}
    }
  }
  return transactions;
}
