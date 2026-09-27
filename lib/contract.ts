import {createPublicClient, defineChain, encodeFunctionData, http} from "viem";

const configuredChainId=Number(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID??10143);
const configuredRpcUrl=process.env.NEXT_PUBLIC_MONAD_RPC_URL??(configuredChainId===10143?"https://testnet-rpc.monad.xyz":"https://rpc.monad.xyz");

export const monad=defineChain({id:configuredChainId,name:configuredChainId===10143?"Monad Testnet":"Monad",nativeCurrency:{name:"MON",symbol:"MON",decimals:18},rpcUrls:{default:{http:[configuredRpcUrl]}}});
export const monadClient=createPublicClient({chain:monad,transport:http(configuredRpcUrl)});

export const dibsAbi=[
  {type:"function",name:"quote",stateMutability:"view",inputs:[{name:"marketId",type:"uint256"},{name:"units",type:"uint256"}],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"scout",stateMutability:"payable",inputs:[{name:"marketId",type:"uint256"},{name:"units",type:"uint256"}],outputs:[]},
  {type:"function",name:"challenge",stateMutability:"payable",inputs:[{name:"marketId",type:"uint256"}],outputs:[]},
  {type:"function",name:"expireMissingResult",stateMutability:"nonpayable",inputs:[{name:"marketId",type:"uint256"}],outputs:[]},
  {type:"function",name:"expireChallenge",stateMutability:"nonpayable",inputs:[{name:"marketId",type:"uint256"}],outputs:[]},
  {type:"function",name:"finalizeEpoch",stateMutability:"nonpayable",inputs:[{name:"epochId",type:"uint256"}],outputs:[]},
  {type:"function",name:"claimScout",stateMutability:"nonpayable",inputs:[{name:"marketId",type:"uint256"}],outputs:[{name:"amount",type:"uint256"}]},
  {type:"function",name:"claimCreator",stateMutability:"nonpayable",inputs:[{name:"marketId",type:"uint256"}],outputs:[{name:"amount",type:"uint256"}]},
  {type:"function",name:"withdrawCredit",stateMutability:"nonpayable",inputs:[],outputs:[{name:"amount",type:"uint256"}]},
  {type:"function",name:"challengeBond",stateMutability:"view",inputs:[],outputs:[{name:"",type:"uint96"}]},
  {type:"function",name:"unitsOf",stateMutability:"view",inputs:[{name:"marketId",type:"uint256"},{name:"scout",type:"address"}],outputs:[{name:"",type:"uint256"}]},
  {type:"function",name:"scoutClaimed",stateMutability:"view",inputs:[{name:"marketId",type:"uint256"},{name:"scout",type:"address"}],outputs:[{name:"",type:"bool"}]},
  {type:"function",name:"creatorClaimed",stateMutability:"view",inputs:[{name:"marketId",type:"uint256"}],outputs:[{name:"",type:"bool"}]},
  {type:"function",name:"credits",stateMutability:"view",inputs:[{name:"account",type:"address"}],outputs:[{name:"",type:"uint256"}]},
] as const;

export type DibsTransaction={to:`0x${string}`;data:`0x${string}`;value:bigint};

function contractAddress(){return process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as `0x${string}`|undefined;}

function transaction(functionName:"scout"|"challenge"|"expireMissingResult"|"expireChallenge"|"finalizeEpoch"|"claimScout"|"claimCreator"|"withdrawCredit",args:readonly bigint[],value=0n):DibsTransaction|null{
  const to=contractAddress();if(!to)return null;
  return {to,data:encodeFunctionData({abi:dibsAbi,functionName,args} as Parameters<typeof encodeFunctionData>[0]),value};
}

export async function scoutTransaction(marketId:string|number|bigint){
  const address=contractAddress();if(!address)return null;const id=BigInt(marketId);
  const cost=await monadClient.readContract({address,abi:dibsAbi,functionName:"quote",args:[id,1n]});
  return transaction("scout",[id,1n],cost);
}

export async function challengeTransaction(marketId:string|number|bigint){
  const address=contractAddress();if(!address)return null;
  const bond=await monadClient.readContract({address,abi:dibsAbi,functionName:"challengeBond"});
  return transaction("challenge",[BigInt(marketId)],bond);
}

export const expireResultTransaction=(marketId:string|number|bigint)=>transaction("expireMissingResult",[BigInt(marketId)]);
export const expireChallengeTransaction=(marketId:string|number|bigint)=>transaction("expireChallenge",[BigInt(marketId)]);
export const finalizeEpochTransaction=(epochId:string|number|bigint)=>transaction("finalizeEpoch",[BigInt(epochId)]);
export const claimScoutTransaction=(marketId:string|number|bigint)=>transaction("claimScout",[BigInt(marketId)]);
export const claimCreatorTransaction=(marketId:string|number|bigint)=>transaction("claimCreator",[BigInt(marketId)]);
export const withdrawCreditTransaction=()=>transaction("withdrawCredit",[]);

export async function walletMarketState(marketId:string|number|bigint,address:`0x${string}`){
  const contract=contractAddress();if(!contract)return null;const id=BigInt(marketId);
  const [units,claimed,creatorClaimed,credits,bond]=await Promise.all([
    monadClient.readContract({address:contract,abi:dibsAbi,functionName:"unitsOf",args:[id,address]}),
    monadClient.readContract({address:contract,abi:dibsAbi,functionName:"scoutClaimed",args:[id,address]}),
    monadClient.readContract({address:contract,abi:dibsAbi,functionName:"creatorClaimed",args:[id]}),
    monadClient.readContract({address:contract,abi:dibsAbi,functionName:"credits",args:[address]}),
    monadClient.readContract({address:contract,abi:dibsAbi,functionName:"challengeBond"}),
  ]);
  return {units,claimed,creatorClaimed,credits,bond};
}
