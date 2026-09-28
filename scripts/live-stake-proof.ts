import {createWalletClient,http,type Address,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {dibsAbi,monad,monadClient} from "../lib/contract";

type ApiMarket={id:string;status:string;totalUnits:number;author:{username:string};text:string};
type ApiResponse={source:string;casts:ApiMarket[];signals:Array<{scout:string;marketId:string}>};

const appUrl=process.env.NEXT_PUBLIC_APP_URL??"https://dibs-metropolis.vercel.app";
const contract=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as Address|undefined;
const key=(process.env.LIVE_PROOF_PRIVATE_KEY??process.env.MARKET_OPENER_PRIVATE_KEY) as Hex|undefined;
if(!contract||!key)throw new Error("LIVE_PROOF_PRIVATE_KEY/MARKET_OPENER_PRIVATE_KEY and contract address are required");

const account=privateKeyToAccount(key);
const wallet=createWalletClient({account,chain:monad,transport:http(process.env.NEXT_PUBLIC_MONAD_RPC_URL)});
const requested=process.argv[2];
const before=await fetch(`${appUrl}/api/casts`,{cache:"no-store"}).then(response=>response.json() as Promise<ApiResponse>);
if(before.source!=="envio")throw new Error("The live proof requires Envio-backed markets");
const market=before.casts.find(candidate=>candidate.id===requested)
  ??before.casts.find(candidate=>candidate.status==="active"&&/^\d+$/.test(candidate.id));
if(!market)throw new Error("No active compliant market is available");

const marketId=BigInt(market.id);
const cost=await monadClient.readContract({address:contract,abi:dibsAbi,functionName:"quote",args:[marketId,1n]});
const transaction=await wallet.writeContract({address:contract,abi:dibsAbi,functionName:"scout",args:[marketId,1n],value:cost});
const receipt=await monadClient.waitForTransactionReceipt({hash:transaction});
if(receipt.status!=="success")throw new Error("The live proof stake reverted");

let indexed=false;
for(let attempt=0;attempt<12;attempt++){
  const snapshot=await fetch(`${appUrl}/api/casts`,{cache:"no-store"}).then(response=>response.json() as Promise<ApiResponse>);
  indexed=snapshot.signals.some(signal=>signal.marketId===market.id&&signal.scout===account.address.toLowerCase());
  if(indexed)break;
  await new Promise(resolve=>setTimeout(resolve,5_000));
}

console.log(JSON.stringify({
  proof:"live-stake-to-envio",
  marketId:market.id,
  cast:`@${market.author.username}: ${market.text.slice(0,80)}`,
  scout:account.address,
  transaction,
  blockNumber:receipt.blockNumber.toString(),
  indexed,
},null,2));
if(!indexed)process.exitCode=2;
