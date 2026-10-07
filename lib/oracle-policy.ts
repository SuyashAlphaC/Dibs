import {monadClient} from "@/lib/contract";
import {parseAbi, type Address} from "viem";

const timingAbi = parseAbi([
  "function resultSubmissionGracePeriod() view returns (uint40)",
  "function challengePeriod() view returns (uint40)",
  "function challengeResolutionPeriod() view returns (uint40)",
]);

export async function getOracleTiming() {
  const address = process.env.NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS as Address | undefined;
  if (!address) throw new Error("Dibs contract is not configured");
  const [submissionGrace, challengePeriod, resolutionPeriod] = await Promise.all([
    monadClient.readContract({address, abi: timingAbi, functionName: "resultSubmissionGracePeriod"}),
    monadClient.readContract({address, abi: timingAbi, functionName: "challengePeriod"}),
    monadClient.readContract({address, abi: timingAbi, functionName: "challengeResolutionPeriod"}),
  ]);
  return {submissionGrace, challengePeriod, resolutionPeriod};
}
