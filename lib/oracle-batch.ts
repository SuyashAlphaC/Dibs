export const ORACLE_BATCH_SIZE = 8;
export const ORACLE_HTTP_BUDGET_BYTES = 180_000;

type PendingMarket = {marketId: number; closesAt: number; action: "submit" | "resolve"; resultSubmittedAt?: number};

export function splitOracleQueue<T extends PendingMarket>(markets: T[], now: number, timing: {submissionGrace: number; challengePeriod: number; resolutionPeriod: number}) {
  const ready: T[] = [];
  const expired: number[] = [];
  for (const market of markets) {
    const deadline = market.action === "resolve"
      ? (market.resultSubmittedAt ?? 0) + timing.challengePeriod + timing.resolutionPeriod
      : market.closesAt + timing.submissionGrace;
    // Leave a confirmation buffer; expired work belongs to the permissionless keeper timeout path.
    if (now + 60 >= deadline) expired.push(market.marketId);
    else ready.push(market);
  }
  return {ready, expired};
}

/** Challenges first; stable oldest-first ordering prevents an indexer's tie order starving markets. */
export function selectOracleBatch<T extends PendingMarket>(markets: T[]): T[] {
  return [...markets].sort((a, b) =>
    Number(b.action === "resolve") - Number(a.action === "resolve") ||
    a.closesAt - b.closesAt || a.marketId - b.marketId,
  ).slice(0, ORACLE_BATCH_SIZE);
}

/** Keep whole observations. Never truncate interactions or fabricate a score to fit a quota. */
export function packOracleBatch<T extends {marketId: number}>(observations: T[]) {
  const included: T[] = [];
  const deferred: number[] = [];
  for (const observation of observations) {
    const bytes = new TextEncoder().encode(JSON.stringify({observations: [...included, observation]})).length;
    if (bytes > ORACLE_HTTP_BUDGET_BYTES) deferred.push(observation.marketId);
    else included.push(observation);
  }
  return {observations: included, deferred};
}
