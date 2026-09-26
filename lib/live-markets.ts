import type {CastMarket, MarketStatus} from "@/lib/types";

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
  status: "OPEN" | "PENDING" | "CHALLENGED" | "SETTLED";
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

export type ScoutDashboard = {
  calls: number;
  successfulCalls: number;
  units: number;
  spent: number;
  claimed: number;
  withdrawnCredit: number;
  hitRate: number;
  roi: number;
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
  baselineEngagement: number;
  openedAt: number;
  closesAt: number;
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
  totalStake totalUnits scoutCount qualityGrowthScore evidenceHash status
  scoutAllocation creatorAllocation
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
      next: {revalidate: 3},
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
    url.searchParams.set("identifier", hash);
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

function statusOf(status: IndexedMarket["status"], closesAt: number): MarketStatus {
  if (status === "SETTLED") return "settled";
  if (status === "CHALLENGED") return "challenged";
  if (status === "PENDING") return "closed";
  return closesAt * 1000 - Date.now() <= 60 * 60_000 ? "closing" : "active";
}

function placeholderCast(market: IndexedMarket): NeynarCast {
  const shortCreator = `${market.creator.slice(0, 6)}…${market.creator.slice(-4)}`;
  return {
    hash: market.castHash,
    text: `Farcaster cast ${market.castHash.slice(0, 10)}…`,
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
  const totalStaked = mon(market.totalStake);
  const totalUnits = Number(market.totalUnits);
  const qualityScore = Number(market.qualityGrowthScore);
  const status = statusOf(market.status, closesAt);
  const allocation = mon(market.scoutAllocation) + mon(market.creatorAllocation);

  return {
    id: market.id,
    hash: market.castHash as `0x${string}`,
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
          : `${market.scoutCount} scouts committed ${totalStaked.toFixed(3)} MON`,
    nextUnitCost: 0.01 + totalUnits * 0.001,
    potentialReward: status === "settled" ? allocation : 0,
    userHasDibs: ownedMarketIds.has(market.id),
    settlementScore: status === "settled" ? qualityScore : undefined,
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
  return Promise.all(
    data.Market.map((market, index) => toCastMarket(market, index + 1, owned)),
  );
}

export async function getLiveMarket(marketId: string): Promise<CastMarket | null> {
  const data = await queryEnvio<{Market: IndexedMarket[]}>(
    `query RankedDibsMarkets { Market(order_by: {totalStake: desc}) { ${MARKET_FIELDS} } }`,
  );
  const index = data?.Market.findIndex((market) => market.id === marketId) ?? -1;
  if (!data || index < 0) return null;
  return toCastMarket(data.Market[index], index + 1, new Set());
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
  if (!data || !scout) return null;

  const owned = new Set(data.Position.map((position) => position.marketId));
  const rankedMarkets = await Promise.all(
    data.Market.map((market, index) => toCastMarket(market, index + 1, owned)),
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

  return {
    calls: scout.calls,
    successfulCalls: scout.successfulCalls,
    units: Number(scout.units),
    spent,
    claimed,
    withdrawnCredit,
    hitRate: scout.calls ? (scout.successfulCalls / scout.calls) * 100 : 0,
    roi: spent ? ((claimed + withdrawnCredit - spent) / spent) * 100 : 0,
    averageLeadMinutes,
    positions,
  };
}

export async function getMarketsAwaitingResult(): Promise<SettlementMarket[] | null> {
  const data = await queryEnvio<{Market: IndexedMarket[]}>(
    `query MarketsAwaitingResult {
      Market(where: {status: {_eq: OPEN}}, order_by: {closesAt: asc}) { ${MARKET_FIELDS} }
    }`,
  );
  if (!data) return null;
  const now = Math.floor(Date.now() / 1000);
  return data.Market.filter((market) => Number(market.closesAt) <= now).map((market) => ({
    marketId: Number(market.id),
    castHash: market.castHash as `0x${string}`,
    baselineEngagement: Number(market.baselineEngagement),
    openedAt: Number(market.openedAt),
    closesAt: Number(market.closesAt),
  }));
}
