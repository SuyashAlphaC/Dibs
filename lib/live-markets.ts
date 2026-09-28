import type {CastMarket, LiveScoutSignal, MarketStatus} from "@/lib/types";
import {toNeynarCastHash} from "@/lib/farcaster";
import {decodeQualityBaseline} from "@/lib/quality-baseline";

type IndexedMarket = {
  id: string;
  epochId: string;
  castHash: string;
  creator: string;
  baselineEngagement: string;
  openedAt: string;
  closesAt: string;
  seedStake: string;
  totalStake: string;
  totalUnits: string;
  scoutCount: number;
  qualityGrowthScore: string;
  evidenceHash?: string;
  resultSubmittedAt?: string;
  status: "OPEN" | "PENDING" | "CHALLENGED" | "SETTLED";
  challenged: boolean;
  challengeUpheld?: boolean;
  scoutAllocation: string;
  creatorAllocation: string;
};

type IndexedPosition = {marketId: string};

type IndexedScout = {
  id: string;
  calls: number;
  successfulCalls: number;
  units: string;
  spent: string;
  claimed: string;
  withdrawnCredit: string;
};

type IndexedScoutPosition = {
  marketId: string;
  units: string;
  spent: string;
  claimed: string;
  firstScoutedAt: string;
};

type IndexedMarketPosition = IndexedScoutPosition & {scout: string};

export type MarketScoutPosition = {
  scout: string;
  units: number;
  spent: number;
  claimed: number;
  leadMinutes: number;
};

export type ScoutDashboard = {
  calls: number;
  successfulCalls: number;
  units: number;
  spent: number;
  claimed: number;
  withdrawnCredit: number;
  hitRate: number;
  roi: number;
  resolvedCalls: number;
  pendingCalls: number;
  resolvedSuccessfulCalls: number;
  realizedHitRate: number | null;
  realizedRoi: number | null;
  averageLeadMinutes: number;
  positions: Array<{
    market: CastMarket;
    units: number;
    spent: number;
    claimed: number;
    leadMinutes: number;
  }>;
};

export type SettlementMarket = {
  marketId: number;
  castHash: `0x${string}`;
  baselineQualifiedScore: number;
  openedAt: number;
  closesAt: number;
  action: "submit" | "resolve";
  previousQualityGrowthScore: number;
};

type NeynarCast = {
  hash: string;
  text: string;
  timestamp: string;
  parent_url?: string;
  author: {
    fid: number;
    username: string;
    display_name?: string;
    pfp_url?: string;
  };
  reactions?: {likes_count?: number; recasts_count?: number};
  replies?: {count?: number};
};

const MARKET_FIELDS = `
  id epochId castHash creator baselineEngagement openedAt closesAt seedStake
  totalStake totalUnits scoutCount qualityGrowthScore evidenceHash resultSubmittedAt status
  challenged challengeUpheld scoutAllocation creatorAllocation
`;

function endpoint() {
  return process.env.ENVIO_GRAPHQL_URL || process.env.NEXT_PUBLIC_ENVIO_GRAPHQL_URL;
}

async function queryEnvio<T>(query: string, variables?: Record<string, unknown>): Promise<T | null> {
  const url = endpoint();
  if (!url) return null;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {"content-type": "application/json"},
      body: JSON.stringify({query, variables}),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Envio returned ${response.status}`);
    const payload = (await response.json()) as {data?: T; errors?: {message: string}[]};
    if (payload.errors?.length) throw new Error(payload.errors[0].message);
    return payload.data ?? null;
  } catch (error) {
    console.error("Envio query failed", error);
    return null;
  }
}

async function fetchNeynarCast(hash: string): Promise<NeynarCast | null> {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL("https://api.neynar.com/v2/farcaster/cast");
    url.searchParams.set("identifier", toNeynarCastHash(hash));
    url.searchParams.set("type", "hash");
    const response = await fetch(url, {
      headers: {"x-api-key": apiKey, "x-neynar-experimental": "true"},
      next: {revalidate: 30},
    });
    if (!response.ok) throw new Error(`Neynar returned ${response.status}`);
    const payload = (await response.json()) as {cast?: NeynarCast};
    return payload.cast ?? null;
  } catch (error) {
    console.error(`Neynar cast lookup failed for ${hash}`, error);
    return null;
  }
}

function mon(value: string) {
  return Number(BigInt(value)) / 1e18;
}

export function scoutConvictionWei(totalStake: string, seedStake: string) {
  const total = BigInt(totalStake);
  const seed = BigInt(seedStake);
  return total > seed ? total - seed : 0n;
}

export function isSubmissionMarketWindow(openedAt: string | number, closesAt: string | number) {
  const duration = Number(closesAt) - Number(openedAt);
  return duration > 0 && duration <= 86_460;
}

export function needsOracleObservation(
  status: IndexedMarket["status"],
  closesAt: string | number,
  resultSubmittedAt: string | undefined,
  now: number,
) {
  return status === "CHALLENGED" || (!resultSubmittedAt && Number(closesAt) <= now);
}

function rankByScoutConviction(markets: IndexedMarket[]) {
  return [...markets].sort((a, b) => {
    const aConviction = scoutConvictionWei(a.totalStake, a.seedStake);
    const bConviction = scoutConvictionWei(b.totalStake, b.seedStake);
    if (aConviction !== bConviction) return aConviction > bConviction ? -1 : 1;
    if (a.scoutCount !== b.scoutCount) return b.scoutCount - a.scoutCount;
    return Number(b.openedAt) - Number(a.openedAt);
  });
}

function statusOf(status: IndexedMarket["status"], closesAt: number): MarketStatus {
  if (status === "SETTLED") return "settled";
  if (status === "CHALLENGED") return "challenged";
  if (status === "PENDING") return "closed";
  if (closesAt * 1000 <= Date.now()) return "closed";
  return closesAt * 1000 - Date.now() <= 60 * 60_000 ? "closing" : "active";
}

function placeholderCast(market: IndexedMarket): NeynarCast {
  const castHash=toNeynarCastHash(market.castHash);
  const shortCreator = `${market.creator.slice(0, 6)}…${market.creator.slice(-4)}`;
  return {
    hash: castHash,
    text: `Farcaster cast ${castHash.slice(0, 10)}…`,
    timestamp: new Date(Number(market.openedAt) * 1000).toISOString(),
    author: {fid: 0, username: shortCreator, display_name: shortCreator},
  };
}

async function toCastMarket(
  market: IndexedMarket,
  rank: number,
  ownedMarketIds: ReadonlySet<string>,
): Promise<CastMarket> {
  const cast = (await fetchNeynarCast(market.castHash)) ?? placeholderCast(market);
  const now = Date.now();
  const closesAt = Number(market.closesAt);
  const ageMinutes = Math.max(1, Math.floor((now - Date.parse(cast.timestamp)) / 60_000));
  const timeLeftMinutes = Math.max(0, Math.ceil((closesAt * 1000 - now) / 60_000));
  const totalStaked = mon(scoutConvictionWei(market.totalStake, market.seedStake).toString());
  const totalUnits = Number(market.totalUnits);
  const qualityScore = Number(market.qualityGrowthScore);
  const baseline = decodeQualityBaseline(market.baselineEngagement);
  const status = statusOf(market.status, closesAt);
  const allocation = mon(market.scoutAllocation) + mon(market.creatorAllocation);

  return {
    id: market.id,
    epochId: market.epochId,
    hash: cast.hash as `0x${string}`,
    creator: market.creator,
    author: {
      fid: cast.author.fid,
      username: cast.author.username,
      displayName: cast.author.display_name || cast.author.username,
      avatarUrl:
        cast.author.pfp_url ||
        `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(cast.author.username)}&backgroundColor=18181b`,
    },
    text: cast.text,
    timestamp: cast.timestamp,
    ageMinutes,
    likes: cast.reactions?.likes_count ?? 0,
    recasts: cast.reactions?.recasts_count ?? 0,
    replies: cast.replies?.count ?? 0,
    totalUnits,
    totalStaked,
    convictionScore: totalStaked,
    rank,
    rankDelta: 0,
    movementPercent: 0,
    newScouts: market.scoutCount,
    category: cast.parent_url?.split("/").at(-1) || "Farcaster",
    status,
    timeLeftMinutes,
    whyRising:
      status === "challenged"
        ? "A scout flagged this result for secondary review"
        : status === "settled"
          ? `Settled with a quality-growth score of ${qualityScore}`
          : market.scoutCount
            ? `${market.scoutCount} scout${market.scoutCount === 1 ? "" : "s"} committed ${totalStaked.toFixed(3)} MON`
            : "Awaiting first scout",
    nextUnitCost: 0.01 + totalUnits * 0.001,
    potentialReward: status === "settled" ? allocation : 0,
    userHasDibs: ownedMarketIds.has(market.id),
    settlementScore: status === "settled" ? qualityScore : undefined,
    baselineEngagement: baseline.rawEngagement,
    baselineQualifiedScore: baseline.qualifiedScore,
    resultSubmittedAt: market.resultSubmittedAt ? Number(market.resultSubmittedAt) : undefined,
    challengeUpheld: market.challengeUpheld,
    scoutAllocation: mon(market.scoutAllocation),
    creatorAllocation: mon(market.creatorAllocation),
  };
}

export async function getLiveMarkets(scoutAddress?: string): Promise<CastMarket[] | null> {
  const positionSelection = scoutAddress
    ? `Position(where: {scout: {_eq: $scout}}) { marketId }`
    : "";
  const data = await queryEnvio<{Market: IndexedMarket[]; Position?: IndexedPosition[]}>(
    `query LiveDibsMarkets${scoutAddress ? "($scout: String!)" : ""} {
      Market(order_by: {totalStake: desc}) { ${MARKET_FIELDS} }
      ${positionSelection}
    }`,
    scoutAddress ? {scout: scoutAddress.toLowerCase()} : undefined,
  );
  if (!data) return null;

  const owned = new Set((data.Position ?? []).map((position) => position.marketId));
  // Epoch one was an early seven-day deployment rehearsal. Keep it available by
  // direct URL and in scout history, but never mix it into the judge-facing
  // 24-hour discovery feed.
  const qualityGateActivatedAt=Number(process.env.MARKET_QUALITY_GATE_ACTIVATED_AT??0);
  const submissionMarkets = data.Market.filter((market) =>
    isSubmissionMarketWindow(market.openedAt, market.closesAt)
      && Number(market.openedAt)>=qualityGateActivatedAt,
  );
  return Promise.all(
    rankByScoutConviction(submissionMarkets).map((market, index) => toCastMarket(market, index + 1, owned)),
  );
}

export async function getLiveMarket(marketId: string): Promise<CastMarket | null> {
  const data = await queryEnvio<{Market: IndexedMarket[]}>(
    `query RankedDibsMarkets { Market(order_by: {totalStake: desc}) { ${MARKET_FIELDS} } }`,
  );
  if (!data) return null;
  const ranked = rankByScoutConviction(data.Market);
  const index = ranked.findIndex((market) => market.id === marketId);
  if (index < 0) return null;
  return toCastMarket(ranked[index], index + 1, new Set());
}

export async function getLiveScoutSignals(): Promise<LiveScoutSignal[] | null> {
  const data = await queryEnvio<{Position: IndexedMarketPosition[]}>(
    `query LiveScoutSignals {
      Position(order_by: {firstScoutedAt: desc}, limit: 50) {
        marketId scout units spent claimed firstScoutedAt
      }
    }`,
  );
  if (!data) return null;
  const unique = new Map<string, LiveScoutSignal>();
  for (const position of data.Position) {
    const scout = position.scout.toLowerCase();
    if (!unique.has(scout)) unique.set(scout, {
      scout,
      marketId: position.marketId,
      spent: mon(position.spent),
      firstScoutedAt: Number(position.firstScoutedAt),
    });
  }
  return [...unique.values()];
}

export async function getMarketPositions(marketId: string): Promise<MarketScoutPosition[] | null> {
  const data=await queryEnvio<{Position:IndexedMarketPosition[];Market:IndexedMarket[]}>(
    `query MarketScoutLedger($marketId: String!) {
      Position(where: {marketId: {_eq: $marketId}}, order_by: {firstScoutedAt: asc}) {
        marketId scout units spent claimed firstScoutedAt
      }
      Market(where: {id: {_eq: $marketId}}, limit: 1) { ${MARKET_FIELDS} }
    }`,
    {marketId},
  );
  if(!data)return null;
  const openedAt=Number(data.Market[0]?.openedAt??0);
  return data.Position.map(position=>({
    scout:position.scout,
    units:Number(position.units),
    spent:mon(position.spent),
    claimed:mon(position.claimed),
    leadMinutes:Math.max(0,Math.floor((Number(position.firstScoutedAt)-openedAt)/60)),
  }));
}


export async function getScoutDashboard(scoutAddress: string): Promise<ScoutDashboard | null> {
  const scoutId = scoutAddress.toLowerCase();
  const data = await queryEnvio<{
    Scout: IndexedScout[];
    Position: IndexedScoutPosition[];
    Market: IndexedMarket[];
  }>(
    `query ScoutDashboard($scout: String!) {
      Scout(where: {id: {_eq: $scout}}, limit: 1) {
        id calls successfulCalls units spent claimed withdrawnCredit
      }
      Position(where: {scout: {_eq: $scout}}, order_by: {firstScoutedAt: desc}) {
        marketId units spent claimed firstScoutedAt
      }
      Market(order_by: {totalStake: desc}) { ${MARKET_FIELDS} }
    }`,
    {scout: scoutId},
  );
  const scout = data?.Scout[0];
  if (!data) return null;
  if (!scout) return {
    calls: 0,
    successfulCalls: 0,
    units: 0,
    spent: 0,
    claimed: 0,
    withdrawnCredit: 0,
    hitRate: 0,
    roi: 0,
    resolvedCalls: 0,
    pendingCalls: 0,
    resolvedSuccessfulCalls: 0,
    realizedHitRate: null,
    realizedRoi: null,
    averageLeadMinutes: 0,
    positions: [],
  };

  const owned = new Set(data.Position.map((position) => position.marketId));
  const rankedMarkets = await Promise.all(
    rankByScoutConviction(data.Market).map((market, index) => toCastMarket(market, index + 1, owned)),
  );
  const marketById = new Map(rankedMarkets.map((market) => [market.id, market]));
  const indexedMarketById = new Map(data.Market.map((market) => [market.id, market]));
  const positions = data.Position.flatMap((position) => {
    const market = marketById.get(position.marketId);
    const indexedMarket = indexedMarketById.get(position.marketId);
    if (!market || !indexedMarket) return [];
    return [{
      market,
      units: Number(position.units),
      spent: mon(position.spent),
      claimed: mon(position.claimed),
      leadMinutes: Math.max(
        0,
        Math.floor((Number(position.firstScoutedAt) - Number(indexedMarket.openedAt)) / 60),
      ),
    }];
  });
  const spent = mon(scout.spent);
  const claimed = mon(scout.claimed);
  const withdrawnCredit = mon(scout.withdrawnCredit);
  const averageLeadMinutes = positions.length
    ? positions.reduce((total, position) => total + position.leadMinutes, 0) / positions.length
    : 0;
  const resolvedPositions=positions.filter(position=>position.market.status==="settled");
  const pendingCalls=positions.length-resolvedPositions.length;
  const resolvedSuccessfulCalls=resolvedPositions.filter(position=>(position.market.scoutAllocation??0)>0).length;
  const realizedPositions=resolvedPositions.filter(position=>position.claimed>0||(position.market.scoutAllocation??0)<=0);
  const realizedSpent=realizedPositions.reduce((total,position)=>total+position.spent,0);
  const realizedReturns=realizedPositions.reduce((total,position)=>total+position.claimed,0);

  return {
    calls: scout.calls,
    // A successful call is a settled winning position, not merely a reward that was claimed.
    successfulCalls: resolvedSuccessfulCalls,
    units: Number(scout.units),
    spent,
    claimed,
    withdrawnCredit,
    hitRate: resolvedPositions.length ? (resolvedSuccessfulCalls / resolvedPositions.length) * 100 : 0,
    roi: spent ? ((claimed + withdrawnCredit - spent) / spent) * 100 : 0,
    resolvedCalls: resolvedPositions.length,
    pendingCalls,
    resolvedSuccessfulCalls,
    realizedHitRate: resolvedPositions.length ? (resolvedSuccessfulCalls/resolvedPositions.length)*100 : null,
    realizedRoi: realizedSpent ? ((realizedReturns-realizedSpent)/realizedSpent)*100 : null,
    averageLeadMinutes,
    positions,
  };
}

export async function getMarketsAwaitingResult(): Promise<SettlementMarket[] | null> {
  const data = await queryEnvio<{Market: IndexedMarket[]}>(
    // Use the same unfiltered query shape as the live feed, which is known to be
    // accepted by every deployed HyperIndex schema revision. Filtering locally
    // also avoids enum-coercion incompatibilities between Hasura versions.
    `query MarketsAwaitingResult {
      Market(order_by: {closesAt: asc}) { ${MARKET_FIELDS} }
    }`,
  );
  if (!data) return null;
  const now = Math.floor(Date.now() / 1000);
  return data.Market.filter((market) =>
    needsOracleObservation(market.status,market.closesAt,market.resultSubmittedAt,now),
  ).map((market) => ({
    marketId: Number(market.id),
    castHash: market.castHash as `0x${string}`,
    baselineQualifiedScore: decodeQualityBaseline(market.baselineEngagement).qualifiedScore,
    openedAt: Number(market.openedAt),
    closesAt: Number(market.closesAt),
    action: market.status === "CHALLENGED" ? "resolve" : "submit",
    previousQualityGrowthScore: Number(market.qualityGrowthScore),
  }));
}
