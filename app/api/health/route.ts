import {NextResponse} from "next/server";
import {formatEther,getAddress,zeroAddress,zeroHash,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {monadClient} from "@/lib/contract";
import {getEnvioIndexStatus,getMarketsAwaitingResult} from "@/lib/live-markets";
import {assertOperatorCanSpend,marketAutomationPolicy} from "@/lib/operator-safety";
import {getPrivyIntegrationStatus} from "@/lib/privy-integration";
import {getOracleTiming} from "@/lib/oracle-policy";
import {splitOracleQueue} from "@/lib/oracle-batch";

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
  return {core,receiver:oracle,mode,workflowPinned:workflowId!==zeroHash,workflowId};
}

async function automationHealth(){
  const policy=marketAutomationPolicy();
  const key=process.env.MARKET_OPENER_PRIVATE_KEY as Hex|undefined;
  if(!key)return {...policy,epochSeed:formatEther(policy.epochSeed),maxEpochSeed:formatEther(policy.maxEpochSeed),minOperatorBalance:formatEther(policy.minOperatorBalance),operatorBalance:null,status:"unconfigured" as const};
  const account=privateKeyToAccount(key);
  const balance=await monadClient.getBalance({address:account.address});
  if(policy.automationEnabled&&policy.openingEnabled)assertOperatorCanSpend(balance,policy);
  return {...policy,epochSeed:formatEther(policy.epochSeed),maxEpochSeed:formatEther(policy.maxEpochSeed),minOperatorBalance:formatEther(policy.minOperatorBalance),operatorBalance:formatEther(balance),status:"ready" as const};
}

function failure(reason:unknown){return {status:"unavailable" as const,reason:reason instanceof Error?reason.message:"unknown"};}

export async function GET(){
  const checkedAt=new Date().toISOString();
  const [indexer,queue,rpc,neynar,receiver,automation,timing]=await Promise.allSettled([
    getEnvioIndexStatus(),getMarketsAwaitingResult(),monadClient.getBlockNumber(),neynarHealth(),contractHealth(),automationHealth(),getOracleTiming(),
  ]);
  const indexValue=indexer.status==="fulfilled"?indexer.value:null;
  const queueValue=queue.status==="fulfilled"?queue.value:null;
  const privy=getPrivyIntegrationStatus();
  const expired=queueValue&&timing.status==="fulfilled"?splitOracleQueue(queueValue,Math.floor(Date.now()/1_000),timing.value).expired:[];
  const ok=Boolean(indexValue&&queueValue&&rpc.status==="fulfilled"&&neynar.status==="fulfilled"&&receiver.status==="fulfilled"&&automation.status==="fulfilled"&&timing.status==="fulfilled"&&!expired.length&&privy.status==="ready");
  const actions=(queueValue??[]).reduce((counts,market)=>{counts[market.action]++;return counts;},{submit:0,resolve:0});
  const services={
    envio:indexValue?{status:"ready" as const,...indexValue}:failure(indexer.status==="rejected"?indexer.reason:"query failed"),
    oracleQueue:queueValue&&timing.status==="fulfilled"?{status:expired.length?"degraded" as const:"ready" as const,awaitingResults:queueValue.length,actions,expired}:failure(queue.status==="rejected"?queue.reason:"queue or deadline policy unavailable"),
    monad:rpc.status==="fulfilled"?{status:"ready" as const,blockNumber:rpc.value.toString()}:failure(rpc.reason),
    neynar:neynar.status==="fulfilled"?{status:"ready" as const}:failure(neynar.reason),
    privy,
    creReceiver:receiver.status==="fulfilled"?{status:"ready" as const,...receiver.value}:failure(receiver.reason),
    marketAutomation:automation.status==="fulfilled"?automation.value:failure(automation.reason),
  };
  return NextResponse.json({ok,scope:"dependencies-and-queue; DON execution is verified by the CRE monitor",checkedAt,services},{status:ok?200:503,headers:{"cache-control":"no-store"}});
}
