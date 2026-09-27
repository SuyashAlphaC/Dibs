import {
  Runner,
  consensusIdenticalAggregation,
  cre,
  getNetwork,
  hexToBase64,
  ok,
  prepareReportRequest,
  text,
  type HTTPSendRequester,
  type Runtime,
  type Workflow,
} from "@chainlink/cre-sdk";
import {encodeAbiParameters, encodeFunctionData, type Address} from "viem";
import {scoreObservation, type MarketObservation} from "./scoring.js";

type Config = {
  schedule: string;
  observationApiUrl: string;
  evm: {
    chainSelectorName: string;
    chainId: number;
    contractAddress: Address;
    isTestnet: boolean;
  };
};

type WorkflowObservation = MarketObservation & {action?: "submit" | "resolve";previousQualityGrowthScore?: number};
type ObservationEnvelope = {observations: WorkflowObservation[]};

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
    .sendRequest({url: config.observationApiUrl, method: "GET"})
    .result();
  if (!ok(response)) throw new Error(`Observation API returned ${response.statusCode}`);
  return text(response);
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
  const envelope = JSON.parse(body) as ObservationEnvelope;
  const evm = new cre.capabilities.EVMClient(network.chainSelector.selector);

  for (const observation of envelope.observations) {
    const result = scoreObservation(observation);
    const upheld=observation.action==="resolve"&&result.qualityGrowthScore<BigInt(observation.previousQualityGrowthScore??0);
    const settlementCalldata=observation.action==="resolve"
      ?encodeFunctionData({abi:resolveChallengeAbi,functionName:"resolveChallenge",args:[BigInt(result.marketId),result.qualityGrowthScore,result.evidenceHash,upheld]})
      :encodeFunctionData({abi:submitResultAbi,functionName:"submitResult",args:[BigInt(result.marketId),result.qualityGrowthScore,result.evidenceHash]});
    const reportPayload = encodeAbiParameters(
      [{type: "uint256", name: "targetChainId"}, {type: "bytes", name: "settlementCalldata"}],
      [BigInt(runtime.config.evm.chainId), settlementCalldata],
    );
    const report = runtime.report(prepareReportRequest(reportPayload)).result();
    evm
      .writeReport(runtime, {
        receiver: hexToBase64(runtime.config.evm.contractAddress),
        report,
      })
      .result();
    runtime.log(
      `market=${result.marketId} action=${observation.action??"submit"} score=${result.qualityGrowthScore} upheld=${upheld} accepted=${result.acceptedInteractions} rejected=${result.rejectedInteractions}`,
    );
  }

  return envelope.observations.length;
}

function initWorkflow(config: Config): Workflow<Config> {
  const cron = new cre.capabilities.CronCapability();
  return [cre.handler(cron.trigger({schedule: config.schedule}), settleReadyMarkets)];
}

export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
