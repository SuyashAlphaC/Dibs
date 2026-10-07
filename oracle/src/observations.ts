import {scoreObservation, type MarketObservation} from "./scoring.js";

export const MAX_SETTLEMENTS_PER_RUN = 8;
export const MAX_HTTP_BYTES = 200_000;
export const MAX_CONSENSUS_BYTES = 12_000;
export type WorkflowObservation = MarketObservation & {action?: "submit" | "resolve"; previousQualityGrowthScore?: number};
export type SettlementDecision = {
  marketId: number; action: "submit" | "resolve"; castHash: MarketObservation["castHash"];
  qualityGrowthScore: string; evidenceHash: MarketObservation["castHash"];
  acceptedInteractions: number; rejectedInteractions: number; upheld: boolean;
};

function unsigned(value: unknown, field: string, positive = false): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0)) throw new Error(`Invalid ${field}`);
}

/** Executed independently on every DON node, before the consensus observation is serialized. */
export function compactSettlementJson(body: string, allowSimulation = false): string {
  if (new TextEncoder().encode(body).length > MAX_HTTP_BYTES) throw new Error("Observation HTTP budget exceeded");
  const envelope = JSON.parse(body) as {observations?: WorkflowObservation[]; simulation?: boolean; deferred?: number[]; failed?: number[]};
  if (envelope.simulation && !allowSimulation) throw new Error("Simulation evidence is forbidden for production settlement");
  if (!Array.isArray(envelope.observations) || envelope.observations.length > MAX_SETTLEMENTS_PER_RUN) throw new Error("Invalid observation batch size");
  const ids = new Set<number>();
  const settlements = envelope.observations.map((observation): SettlementDecision => {
    unsigned(observation.marketId, "marketId", true);
    if (ids.has(observation.marketId)) throw new Error("Duplicate market in observation batch");
    ids.add(observation.marketId);
    if (!/^0x[0-9a-fA-F]{64}$/.test(observation.castHash)) throw new Error("Invalid cast hash");
    unsigned(observation.observedAt, "observedAt", true);
    unsigned(observation.baselineQualifiedScore, "baselineQualifiedScore");
    const action = observation.action ?? "submit";
    if (action !== "submit" && action !== "resolve") throw new Error("Invalid settlement action");
    if (action === "resolve") unsigned(observation.previousQualityGrowthScore, "previousQualityGrowthScore");
    if (!Array.isArray(observation.interactions)) throw new Error("Missing interactions");
    const interactions = new Set<string>();
    for (const interaction of observation.interactions) {
      unsigned(interaction.fid, "fid", true);
      unsigned(interaction.accountAgeDays, "accountAgeDays");
      unsigned(interaction.neynarScoreBps, "neynarScoreBps");
      if (interaction.neynarScoreBps > 10_000 || !["like", "reply", "recast"].includes(interaction.kind)) throw new Error("Invalid interaction");
      const key = `${interaction.fid}:${interaction.kind}`;
      if (interactions.has(key)) throw new Error("Duplicate interaction");
      interactions.add(key);
    }
    const result = scoreObservation(observation);
    if (result.qualityGrowthScore > 1_000_000_000_000n) throw new Error("Score exceeds contract limit");
    return {...result, action, castHash: observation.castHash.toLowerCase() as MarketObservation["castHash"], qualityGrowthScore: result.qualityGrowthScore.toString(),
      upheld: action === "resolve" && result.qualityGrowthScore < BigInt(observation.previousQualityGrowthScore!)};
  }).sort((a, b) => a.marketId - b.marketId);
  const deferred = [...(envelope.deferred ?? []), ...(envelope.failed ?? [])].sort((a, b) => a - b);
  for (const id of deferred) unsigned(id, "deferred marketId", true);
  const compact = JSON.stringify({settlements, deferred});
  if (new TextEncoder().encode(compact).length > MAX_CONSENSUS_BYTES) throw new Error("Compact consensus budget exceeded");
  return compact;
}
