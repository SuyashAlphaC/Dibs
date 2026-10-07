import {parseAbi} from "viem";

export const settlementReadAbi = parseAbi([
  "function dibs() view returns (address)",
  "function markets(uint256) view returns (uint32 epochId, uint40 openedAt, uint40 resultSubmittedAt, uint64 baselineEngagement, uint128 totalUnits, uint256 totalStake, uint256 qualityGrowthScore, uint256 scoutAllocation, uint256 creatorAllocation, bytes32 castHash, bytes32 evidenceHash, address creator, address challenger, bool resultSubmitted, bool challenged, bool challengeResolved)",
]);

export function isSettlementPending(action: "submit" | "resolve", state: {resultSubmitted: boolean; challenged: boolean; challengeResolved: boolean}) {
  return action === "submit" ? !state.resultSubmitted : state.resultSubmitted && state.challenged && !state.challengeResolved;
}
