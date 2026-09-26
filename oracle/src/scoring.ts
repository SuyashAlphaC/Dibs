import {encodeAbiParameters, keccak256, type Hex} from "viem";

export type InteractionKind = "like" | "recast" | "reply";

export type QualifiedInteraction = {
  fid: number;
  kind: InteractionKind;
  accountAgeDays: number;
  neynarScoreBps: number;
};

export type MarketObservation = {
  marketId: number;
  castHash: Hex;
  baselineQualifiedScore: number;
  observedAt: number;
  interactions: QualifiedInteraction[];
};

export type ScoredObservation = {
  marketId: number;
  qualityGrowthScore: bigint;
  evidenceHash: Hex;
  acceptedInteractions: number;
  rejectedInteractions: number;
};

const MIN_ACCOUNT_AGE_DAYS = 30;
const MIN_NEYNAR_SCORE_BPS = 6_000;
const WEIGHTS: Record<InteractionKind, number> = {
  like: 1_000,
  recast: 2_500,
  reply: 3_000,
};
const KIND_CODE: Record<InteractionKind, number> = {like: 0, recast: 1, reply: 2};

export function scoreObservation(observation: MarketObservation): ScoredObservation {
  const canonical = [...observation.interactions].sort(
    (a, b) => a.fid - b.fid || KIND_CODE[a.kind] - KIND_CODE[b.kind],
  );
  let closingQualifiedScore = 0;
  let acceptedInteractions = 0;

  for (const interaction of canonical) {
    if (
      interaction.accountAgeDays < MIN_ACCOUNT_AGE_DAYS ||
      interaction.neynarScoreBps < MIN_NEYNAR_SCORE_BPS
    ) continue;

    closingQualifiedScore += Math.floor(
      (WEIGHTS[interaction.kind] * Math.min(interaction.neynarScoreBps, 10_000)) / 10_000,
    );
    acceptedInteractions++;
  }

  const qualityGrowthScore = BigInt(
    Math.max(0, closingQualifiedScore - observation.baselineQualifiedScore),
  );
  const evidenceHash = keccak256(
    encodeAbiParameters(
      [
        {type: "uint256"},
        {type: "bytes32"},
        {type: "uint256"},
        {type: "uint256"},
        {
          type: "tuple[]",
          components: [
            {name: "fid", type: "uint256"},
            {name: "kind", type: "uint8"},
            {name: "accountAgeDays", type: "uint256"},
            {name: "neynarScoreBps", type: "uint256"},
          ],
        },
      ],
      [
        BigInt(observation.marketId),
        observation.castHash,
        BigInt(observation.baselineQualifiedScore),
        BigInt(observation.observedAt),
        canonical.map((interaction) => ({
          fid: BigInt(interaction.fid),
          kind: KIND_CODE[interaction.kind],
          accountAgeDays: BigInt(interaction.accountAgeDays),
          neynarScoreBps: BigInt(interaction.neynarScoreBps),
        })),
      ],
    ),
  );

  return {
    marketId: observation.marketId,
    qualityGrowthScore,
    evidenceHash,
    acceptedInteractions,
    rejectedInteractions: canonical.length - acceptedInteractions,
  };
}

