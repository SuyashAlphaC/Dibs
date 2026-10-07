import {
  Runner,
  TxStatus,
  bytesToHex,
  encodeCallMsg,
  LATEST_BLOCK_NUMBER,
  consensusIdenticalAggregation,
  cre,
  getNetwork,
  ok,
  prepareReportRequest,
  text,
  type HTTPSendRequester,
  type Runtime,
  type Workflow,
} from "@chainlink/cre-sdk";
import {decodeFunctionResult,encodeAbiParameters, encodeFunctionData,zeroAddress, type Address} from "viem";
import {compactSettlementJson, type SettlementDecision} from "./observations.js";
import {isSettlementPending,settlementReadAbi} from "./chain-state.js";

type Config = {
  schedule: string;
  observationApiUrl: string;
  dryRun?: boolean;
  allowSimulation?: boolean;
  evm: {
    chainSelectorName: string;
    chainId: number;
    contractAddress: Address;
    isTestnet: boolean;
  };
};

const submitResultAbi = [
  {
    type: "function",
    name: "submitResult",
    stateMutability: "nonpayable",
    inputs: [
      {name: "marketId", type: "uint256"},
      {name: "score", type: "uint256"},
      {name: "evidenceHash", type: "bytes32"},
    ],
    outputs: [],
  },
] as const;

const resolveChallengeAbi=[{
  type:"function",name:"resolveChallenge",stateMutability:"nonpayable",
  inputs:[{name:"marketId",type:"uint256"},{name:"correctedScore",type:"uint256"},{name:"correctedEvidenceHash",type:"bytes32"},{name:"upheld",type:"bool"}],outputs:[],
}] as const;

function fetchObservationJson(requester: HTTPSendRequester, config: Config) {
  const response = requester
    .sendRequest({url: config.observationApiUrl, method: "GET",timeout:"10s",cacheSettings:{store:true,maxAge:"10s"}})
    .result();
  if (!ok(response)) throw new Error(`Observation API returned ${response.statusCode}`);
  return compactSettlementJson(text(response),config.dryRun||config.allowSimulation);
}

function settleReadyMarkets(runtime: Runtime<Config>) {
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evm.chainSelectorName,
    isTestnet: runtime.config.evm.isTestnet,
  });
  if (!network) throw new Error("Configured EVM network is not available in CRE");

  const http = new cre.capabilities.HTTPClient();
  const body = http
    .sendRequest(runtime, fetchObservationJson, consensusIdenticalAggregation<string>())(
      runtime.config,
    )
    .result();
  const envelope = JSON.parse(body) as {settlements:SettlementDecision[];deferred:number[]};
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);
  const core=runtime.config.dryRun?undefined:decodeFunctionResult({abi:settlementReadAbi,functionName:"dibs",data:bytesToHex(evm.callContract(runtime,{
    call:encodeCallMsg({from:zeroAddress,to:runtime.config.evm.contractAddress,data:encodeFunctionData({abi:settlementReadAbi,functionName:"dibs"})}),
    blockNumber:LATEST_BLOCK_NUMBER,
  }).result().data)});

  runtime.log(`consensusBytes=${body.length} batch=${envelope.settlements.length} deferred=${envelope.deferred.length}`);
  for (const result of envelope.settlements) {
    if(core){
      const market=decodeFunctionResult({abi:settlementReadAbi,functionName:"markets",data:bytesToHex(evm.callContract(runtime,{
        call:encodeCallMsg({from:zeroAddress,to:core,data:encodeFunctionData({abi:settlementReadAbi,functionName:"markets",args:[BigInt(result.marketId)]})}),
        blockNumber:LATEST_BLOCK_NUMBER,
      }).result().data)});
      if(!isSettlementPending(result.action,{resultSubmitted:market[13],challenged:market[14],challengeResolved:market[15]})){
        runtime.log(`market=${result.marketId} skipped=already-processed-or-stale-action`);
        continue;
      }
      if(market[0]===0||market[9].toLowerCase()!==result.castHash)throw new Error(`Market ${result.marketId} does not match onchain cast`);
    }
    const score=BigInt(result.qualityGrowthScore);
    const settlementCalldata=result.action==="resolve"
      ?encodeFunctionData({abi:resolveChallengeAbi,functionName:"resolveChallenge",args:[BigInt(result.marketId),score,result.evidenceHash,result.upheld]})
      :encodeFunctionData({abi:submitResultAbi,functionName:"submitResult",args:[BigInt(result.marketId),score,result.evidenceHash]});
    const reportPayload = encodeAbiParameters(
      [{type: "uint256", name: "targetChainId"}, {type: "bytes", name: "settlementCalldata"}],
      [BigInt(runtime.config.evm.chainId), settlementCalldata],
    );
    const report = runtime.report(prepareReportRequest(reportPayload)).result();
    let reportState = "prepared-dry-run";
    if (!runtime.config.dryRun) {
      const writeResult = evm
        .writeReport(runtime, {
          receiver: runtime.config.evm.contractAddress,
          report,
        })
        .result();
      const txHash = writeResult.txHash ? bytesToHex(writeResult.txHash) : "unavailable";
      if (writeResult.txStatus !== TxStatus.SUCCESS) {
        throw new Error(
          `CRE report write failed status=${writeResult.txStatus} tx=${txHash} error=${writeResult.errorMessage ?? "unknown"}`,
        );
      }
      reportState = `submitted tx=${txHash}`;
    }
    runtime.log(
      `market=${result.marketId} action=${result.action} score=${result.qualityGrowthScore} upheld=${result.upheld} accepted=${result.acceptedInteractions} rejected=${result.rejectedInteractions} report=${reportState}`,
    );
  }

  if(envelope.deferred.length)throw new Error(`Observation collection deferred markets=${envelope.deferred.join(",")}; successful reports were delivered`);
  return envelope.settlements.length;
}

function initWorkflow(config: Config): Workflow<Config> {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({schedule: config.schedule}), settleReadyMarkets)];
}

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
