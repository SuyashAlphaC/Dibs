export type MarketStatus = "active" | "closing" | "closed" | "challenged" | "settled";

export interface CastAuthor {
  fid: number;
  username: string;
  displayName: string;
  avatarUrl: string;
}

export interface ScoutIdentity {
  address: string;
  fid?: number;
  username?: string;
  displayName: string;
  avatarUrl?: string;
  followedByViewer?: boolean;
}

export interface CastMarket {
  id: string;
  epochId?: string;
  hash: `0x${string}`;
  creator?: string;
  author: CastAuthor;
  text: string;
  timestamp: string;
  ageMinutes: number;
  likes: number;
  recasts: number;
  replies: number;
  totalUnits: number;
  totalStaked: number;
  convictionScore: number;
  rank: number;
  rankDelta: number;
  movementPercent: number;
  newScouts: number;
  category: string;
  status: MarketStatus;
  timeLeftMinutes: number;
  whyRising: string;
  nextUnitCost: number;
  potentialReward: number;
  userHasDibs?: boolean;
  userStake?: number;
  settlementScore?: number;
  baselineEngagement?: number;
  baselineQualifiedScore?: number;
  resultSubmittedAt?: number;
  challengeUpheld?: boolean;
  scoutAllocation?: number;
  creatorAllocation?: number;
  scoutPreview?: ScoutIdentity[];
}

export interface ScoutPosition {
  marketId: string;
  author: string;
  excerpt: string;
  entryRank: number;
  currentRank: number;
  amount: number;
  potentialReward: number;
  status: MarketStatus;
}

export interface LiveScoutSignal {
  scout: string;
  marketId: string;
  spent: number;
  firstScoutedAt: number;
  identity?: ScoutIdentity;
}
