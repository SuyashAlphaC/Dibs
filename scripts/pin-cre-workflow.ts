import {createWalletClient,http,zeroHash,type Hex} from "viem";
import {privateKeyToAccount} from "viem/accounts";
import {monad,monadClient} from "../lib/contract";

async function main(){
const workflowId=process.argv[2] as Hex;
if(!/^0x[0-9a-f]{64}$/i.test(workflowId??"")||workflowId===zeroHash)throw new Error("Provide the exact nonzero deployed workflow ID");
const key=(process.env.CRE_RECEIVER_OWNER_PRIVATE_KEY??process.env.DEPLOYER_PRIVATE_KEY) as Hex|undefined;
const receiver=process.env.CRE_SETTLEMENT_RECEIVER_ADDRESS as Hex|undefined;
const core=process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS;
const forwarder=process.env.CRE_FORWARDER_ADDRESS;
if(!key||!receiver||!core||!forwarder)throw new Error("Receiver owner, receiver, core and official Forwarder configuration are required");
const account=privateKeyToAccount(key);
const abi=[
  {type:"function",name:"owner",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
  {type:"function",name:"dibs",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
  {type:"function",name:"forwarder",stateMutability:"view",inputs:[],outputs:[{type:"address"}]},
  {type:"function",name:"expectedWorkflowId",stateMutability:"view",inputs:[],outputs:[{type:"bytes32"}]},
  {type:"function",name:"setExpectedWorkflowId",stateMutability:"nonpayable",inputs:[{type:"bytes32"}],outputs:[]},
] as const;
const [owner,receiverCore,receiverForwarder,previousId,chainId]=await Promise.all([
  monadClient.readContract({address:receiver,abi,functionName:"owner"}),
  monadClient.readContract({address:receiver,abi,functionName:"dibs"}),
  monadClient.readContract({address:receiver,abi,functionName:"forwarder"}),
  monadClient.readContract({address:receiver,abi,functionName:"expectedWorkflowId"}),
  monadClient.getChainId(),
]);
if(owner.toLowerCase()!==account.address.toLowerCase()||receiverCore.toLowerCase()!==core.toLowerCase()||receiverForwarder.toLowerCase()!==forwarder.toLowerCase()||chainId!==monad.id)throw new Error("Receiver ownership, core, chain or official Forwarder check failed");
if(previousId===workflowId){console.log(JSON.stringify({workflowId,status:"already-pinned"}));process.exit(0);}
const wallet=createWalletClient({account,chain:monad,transport:http(monad.rpcUrls.default.http[0])});
const hash=await wallet.writeContract({address:receiver,abi,functionName:"setExpectedWorkflowId",args:[workflowId]});
const receipt=await monadClient.waitForTransactionReceipt({hash});
if(receipt.status!=="success")throw new Error(`Pin transaction failed: ${hash}`);
const pinned=await monadClient.readContract({address:receiver,abi,functionName:"expectedWorkflowId"});
if(pinned!==workflowId)throw new Error("Receiver workflow ID did not match after confirmation");
console.log(JSON.stringify({previousId,workflowId,transaction:hash,block:receipt.blockNumber.toString(),status:"pinned"},null,2));
}
main().catch(error=>{console.error(error instanceof Error?error.message:"Workflow pin failed");process.exitCode=1;});
