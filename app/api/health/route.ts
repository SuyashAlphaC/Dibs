import {NextResponse} from "next/server";
import {getAddress,zeroAddress,zeroHash} from "viem";
import {monadClient} from "@/lib/contract";
import {getEnvioIndexStatus,getMarketsAwaitingResult} from "@/lib/live-markets";

export const dynamic="force-dynamic";

const coreAbi=[{type:"function",name:"oracle",stateMutability:"view",inputs:[],outputs:[{type:"address"}]}] as const;
const receiverAbi=[
  {type:"function",name:"dibs",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
  {type:"function",name:"expectedWorkflowId",stateMutability:"view",inputs:[],outputs:[{type:"bytes32"}]},
] as const;

async function neynarHealth(){
  const apiKey=process.env.NEYNAR_API_KEY;
  if(!apiKey)throw new Error("not configured");
  const response=await fetch("https://api.neynar.com/v2/farcaster/user/bulk?fids=3",{
    headers:{"x-api-key":apiKey,"x-neynar-experimental":"true"},
    cache:"no-store",
    signal:AbortSignal.timeout(4_000),
  });
  if(!response.ok)throw new Error(`HTTP ${response.status}`);
  return true;
}

async function contractHealth(){
  const configuredCore=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS;
  if(!configuredCore)throw new Error("core contract not configured");
  const core=getAddress(configuredCore);
  const oracle=await monadClient.readContract({address:core,abi:coreAbi,functionName:"oracle"});
  if(oracle===zeroAddress)throw new Error("core oracle is zero");
  const [receiverCore,workflowId]=await Promise.all([
    monadClient.readContract({address:oracle,abi:receiverAbi,functionName:"dibs"}),
    monadClient.readContract({address:oracle,abi:receiverAbi,functionName:"expectedWorkflowId"}),
  ]);
  if(receiverCore.toLowerCase()!==core.toLowerCase())throw new Error("receiver targets a different Dibs core");
  const mode=process.env.NEXT_PUBLIC_CRE_SETTLEMENT_MODE==="don"?"don":"simulation-broadcast";
  if(mode==="don"&&workflowId===zeroHash)throw new Error("DON workflow guard is not pinned");
  return {core,receiver:oracle,mode,workflowPinned:workflowId!==zeroHash};
}

function failure(reason:unknown){return {status:"unavailable" as const,reason:reason instanceof Error?reason.message:"unknown"};}

export async function GET(){
  const checkedAt=new Date().toISOString();
  const [indexer,queue,rpc,neynar,receiver]=await Promise.allSettled([
    getEnvioIndexStatus(),getMarketsAwaitingResult(),monadClient.getBlockNumber(),neynarHealth(),contractHealth(),
  ]);
  const indexValue=indexer.status==="fulfilled"?indexer.value:null;
  const queueValue=queue.status==="fulfilled"?queue.value:null;
  const ok=Boolean(indexValue&&queueValue&&rpc.status==="fulfilled"&&neynar.status==="fulfilled"&&receiver.status==="fulfilled");
  const actions=(queueValue??[]).reduce((counts,market)=>{counts[market.action]++;return counts;},{submit:0,resolve:0});
  const services={
    envio:indexValue?{status:"ready" as const,...indexValue}:failure(indexer.status==="rejected"?indexer.reason:"query failed"),
    oracleQueue:queueValue?{status:"ready" as const,awaitingResults:queueValue.length,actions}:failure(queue.status==="rejected"?queue.reason:"query failed"),
    monad:rpc.status==="fulfilled"?{status:"ready" as const,blockNumber:rpc.value.toString()}:failure(rpc.reason),
    neynar:neynar.status==="fulfilled"?{status:"ready" as const}:failure(neynar.reason),
    creReceiver:receiver.status==="fulfilled"?{status:"ready" as const,...receiver.value}:failure(receiver.reason),
  };
  return NextResponse.json({ok,checkedAt,services},{status:ok?200:503,headers:{"cache-control":"no-store"}});
}
