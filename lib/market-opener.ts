import {createWalletClient,http,isAddress,padHex,parseEther,type Address,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {monad,monadClient} from "@/lib/contract";
import {collectQualifiedInteractions} from "@/lib/neynar-observations";
import {encodeQualityBaseline,qualifiedInteractionScore} from "@/lib/quality-baseline";
import {
  DEFAULT_DISCOVERY_POLICY,
  discoveryPriority,
  qualifiesForDiscovery,
  type DiscoveryPolicy,
} from "@/lib/discovery-quality";

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

type NeynarCast={hash:string;timestamp:string;parent_hash?:string|null;text?:string;author:{custody_address?:string;score?:number;follower_count?:number;registered_at?:string;verified_addresses?:{primary?:{eth_address?:string};eth_addresses?:string[]}};reactions?:{likes_count?:number;recasts_count?:number};replies?:{count?:number}};

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

async function neynarFeed(apiKey:string,requestedHash?:string){
  const fetchCasts=async(url:URL)=>{
    const response=await fetch(url,{headers:{"x-api-key":apiKey,"x-neynar-experimental":"true"},cache:"no-store"});
    if(!response.ok)throw new Error(`Neynar discovery returned ${response.status}`);
    const payload=await response.json() as {cast?:NeynarCast;casts?:NeynarCast[]};
    return payload.cast?[payload.cast]:(payload.casts??[]);
  };
  if(requestedHash){
    const url=new URL("https://api.neynar.com/v2/farcaster/cast");url.searchParams.set("identifier",requestedHash);url.searchParams.set("type","hash");
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

export async function openEligibleMarkets(requestedHash?:string){
  const key=(process.env.MARKET_OPENER_PRIVATE_KEY??process.env.DEPLOYER_PRIVATE_KEY) as Hex|undefined;
  const apiKey=process.env.NEYNAR_API_KEY;
  const contract=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as Address|undefined;
  const rpc=process.env.NEXT_PUBLIC_MONAD_RPC_URL;
  if(!key||!apiKey||!contract||!rpc)throw new Error("Market opener environment is incomplete");
  const account=privateKeyToAccount(key);
  const wallet=createWalletClient({account,chain:monad,transport:http(rpc)});
  const now=BigInt(Math.floor(Date.now()/1000));
  const discovered=await neynarFeed(apiKey,requestedHash);
  const nowSeconds=Number(now);
  const policy=discoveryPolicy();
  const candidates=discovered
    .filter(cast=>eligible(cast,nowSeconds,policy))
    .sort((a,b)=>discoveryPriority(b,nowSeconds)-discoveryPriority(a,nowSeconds))
    .slice(0,Number(process.env.MAX_MARKETS_PER_RUN??5));
  if(!candidates.length)return {epochId:null,discovered:discovered.length,eligible:0,opened:[],skipped:[]};
  let epochId=await active24HourEpoch(contract,now);
  let epochTransaction:Hex|undefined;
  if(!epochId){
    const count=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochCount"});
    epochId=count+1n;
    epochTransaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"createEpoch",args:[Number(now),Number(now+86_400n)],value:parseEther(process.env.MARKET_EPOCH_SEED_MON??"1")});
    await monadClient.waitForTransactionReceipt({hash:epochTransaction});
  }
  const opened:Array<{hash:string;transaction:Hex}>=[];
  const skipped:Array<{hash:string;reason:string}>=[];
  for(const cast of candidates){
    const castHash=padHex(cast.hash as Hex,{size:32,dir:"right"});
    const existing=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"marketIdByCastHash",args:[castHash]});
    if(existing!==0n){skipped.push({hash:cast.hash,reason:`already market ${existing}`});continue;}
    const castCreator=creator(cast);
    if(!castCreator){skipped.push({hash:cast.hash,reason:"no EVM creator address"});continue;}
    let baseline:bigint;
    try{
      const interactions=await collectQualifiedInteractions(cast.hash,Number(now),apiKey);
      baseline=encodeQualityBaseline(qualifiedInteractionScore(interactions));
    }catch{
      skipped.push({hash:cast.hash,reason:"qualified baseline unavailable"});
      continue;
    }
    const transaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"openMarket",args:[epochId,castHash,castCreator,baseline]});
    await monadClient.waitForTransactionReceipt({hash:transaction});
    opened.push({hash:cast.hash,transaction});
  }
  return {epochId:epochId.toString(),epochTransaction,discovered:discovered.length,eligible:candidates.length,opened,skipped};
}

export async function maintainMarkets(){
  const key=(process.env.MARKET_OPENER_PRIVATE_KEY??process.env.DEPLOYER_PRIVATE_KEY) as Hex|undefined;
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
      const transaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:action,args:[id]});
      await monadClient.waitForTransactionReceipt({hash:transaction});transactions.push({action,id:id.toString(),transaction});
      if(action==="expireMissingResult"&&challengeDemoMarket===id.toString()){
        const [units,bond]=await Promise.all([
          monadClient.readContract({address:contract,abi:openerAbi,functionName:"unitsOf",args:[id,account.address]}),
          monadClient.readContract({address:contract,abi:openerAbi,functionName:"challengeBond"}),
        ]);
        if(units>0n){
          const challengeTransaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"challenge",args:[id],value:bond});
          await monadClient.waitForTransactionReceipt({hash:challengeTransaction});
          transactions.push({action:"challengeDemo",id:id.toString(),transaction:challengeTransaction});
        }
      }
    }else if(challengeDemoMarket===id.toString()&&resultSubmitted&&!challenged&&now<resultSubmittedAt+challengePeriod){
      const [units,bond]=await Promise.all([
        monadClient.readContract({address:contract,abi:openerAbi,functionName:"unitsOf",args:[id,account.address]}),
        monadClient.readContract({address:contract,abi:openerAbi,functionName:"challengeBond"}),
      ]);
      if(units>0n){
        const transaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"challenge",args:[id],value:bond});
        await monadClient.waitForTransactionReceipt({hash:transaction});
        transactions.push({action:"challengeDemo",id:id.toString(),transaction});
      }
    }
  }
  for(const epochId of epochIds){
    const epoch=await monadClient.readContract({address:contract,abi:openerAbi,functionName:"epochs",args:[BigInt(epochId)]});
    const [, ,latestResultAt,marketTotal,resultCount,,,finalized]=epoch;
    if(!finalized&&marketTotal>0&&resultCount===marketTotal&&now>=latestResultAt+challengePeriod){
      try{
        const transaction=await wallet.writeContract({address:contract,abi:openerAbi,functionName:"finalizeEpoch",args:[BigInt(epochId)]});
        await monadClient.waitForTransactionReceipt({hash:transaction});transactions.push({action:"finalizeEpoch",id:String(epochId),transaction});
      }catch{/* An unresolved challenge keeps finalization safely locked. */}
    }
  }
  return transactions;
}
