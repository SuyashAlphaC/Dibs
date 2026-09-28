export type InteractionKind = "like" | "recast" | "reply";

export type QualifiedInteraction = {
  fid: number;
  kind: InteractionKind;
  accountAgeDays: number;
  neynarScoreBps: number;
};

const QUALITY_BASELINE_FLAG = 1n << 63n;
const QUALITY_BASELINE_VALUE_MASK = QUALITY_BASELINE_FLAG - 1n;
const MIN_ACCOUNT_AGE_DAYS = 30;
const MIN_NEYNAR_SCORE_BPS = 6_000;
const WEIGHTS: Record<InteractionKind, number> = {
  like: 1_000,
  recast: 2_500,
  reply: 3_000,
};

export function qualifiedInteractionScore(interactions: QualifiedInteraction[]) {
  return interactions.reduce((total, interaction) => {
    if (
      interaction.accountAgeDays < MIN_ACCOUNT_AGE_DAYS ||
      interaction.neynarScoreBps < MIN_NEYNAR_SCORE_BPS
    ) return total;
    return total + Math.floor(
      (WEIGHTS[interaction.kind] * Math.min(interaction.neynarScoreBps, 10_000)) / 10_000,
    );
  }, 0);
}

export function encodeQualityBaseline(score: number) {
  const normalized = BigInt(Math.max(0, Math.floor(score)));
  if (normalized > QUALITY_BASELINE_VALUE_MASK) throw new Error("Quality baseline exceeds uint63");
  return QUALITY_BASELINE_FLAG | normalized;
}

export function decodeQualityBaseline(value: string | number | bigint) {
  const encoded = BigInt(value);
  const weighted = (encoded & QUALITY_BASELINE_FLAG) !== 0n;
  return {
    weighted,
    qualifiedScore: Number(weighted ? encoded & QUALITY_BASELINE_VALUE_MASK : encoded * 1_000n),
    rawEngagement: weighted ? undefined : Number(encoded),
  };
}
