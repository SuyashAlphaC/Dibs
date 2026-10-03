export type DiscoveryAuthor = {
  score?: number;
  follower_count?: number;
  registered_at?: string;
};

export type DiscoveryCandidate = {
  timestamp: string;
  parent_hash?: string | null;
  text?: string;
  author: DiscoveryAuthor;
  reactions?: {likes_count?: number; recasts_count?: number};
  replies?: {count?: number};
};

export type DiscoveryPolicy = {
  maxAgeSeconds: number;
  maxEngagement: number;
  minAuthorScore: number;
  minAuthorAgeDays: number;
  minCastCharacters: number;
  minCastWords: number;
  maxHashtags: number;
  maxMentions: number;
  maxLinks: number;
};

export const DEFAULT_DISCOVERY_POLICY: DiscoveryPolicy = {
  maxAgeSeconds: 30 * 60,
  maxEngagement: 25,
  minAuthorScore: 0.6,
  minAuthorAgeDays: 30,
  minCastCharacters: 48,
  minCastWords: 8,
  maxHashtags: 4,
  maxMentions: 6,
  maxLinks: 2,
};

const PROMOTIONAL_PATTERNS = [
  /\bjoin me on\b/i,
  /\b(?:get|earn|receive)\s+\d[\d,.]*\s+(?:bonus\s+)?points?\b/i,
  /\b(?:use|enter)\s+(?:my\s+)?(?:referral|invite|promo)\s+code\b/i,
  /\breferral\s+(?:link|bonus|code)\b/i,
  /\bclaim\s+(?:your\s+)?(?:free|bonus|airdrop)\b/i,
  /\b(?:free|guaranteed)\s+(?:tokens?|money|mon)\b/i,
];

export function hasPromotionalSpam(text: string, policy: DiscoveryPolicy = DEFAULT_DISCOVERY_POLICY) {
  const hashtags = text.match(/(^|\s)#[\p{L}\p{N}_]+/gu)?.length ?? 0;
  const mentions = text.match(/(^|\s)@[\w.-]+/g)?.length ?? 0;
  const links = text.match(/https?:\/\/\S+/gi)?.length ?? 0;
  return PROMOTIONAL_PATTERNS.some(pattern => pattern.test(text))
    || hashtags > policy.maxHashtags
    || mentions > policy.maxMentions
    || links > policy.maxLinks;
}

export function castEngagement(cast: DiscoveryCandidate) {
  return (cast.reactions?.likes_count ?? 0)
    + (cast.reactions?.recasts_count ?? 0)
    + (cast.replies?.count ?? 0);
}

export function qualifiesForDiscovery(
  cast: DiscoveryCandidate,
  nowSeconds: number,
  policy: DiscoveryPolicy = DEFAULT_DISCOVERY_POLICY,
) {
  const castAge = nowSeconds - Date.parse(cast.timestamp) / 1_000;
  const registeredAt = Date.parse(cast.author.registered_at ?? "");
  const authorAgeDays = Number.isFinite(registeredAt)
    ? (nowSeconds - registeredAt / 1_000) / 86_400
    : 0;
  const text = cast.text?.trim() ?? "";
  const words = text.split(/\s+/).filter(Boolean).length;
  const authorScore = cast.author.score ?? 0;

  return castAge >= 0
    && castAge < policy.maxAgeSeconds
    && castEngagement(cast) < policy.maxEngagement
    && !cast.parent_hash
    && authorScore >= policy.minAuthorScore
    && authorAgeDays >= policy.minAuthorAgeDays
    && text.length >= policy.minCastCharacters
    && words >= policy.minCastWords
    && !hasPromotionalSpam(text, policy);
}

export function discoveryPriority(cast: DiscoveryCandidate, nowSeconds: number) {
  const ageMinutes = Math.max(0, (nowSeconds - Date.parse(cast.timestamp) / 1_000) / 60);
  const authorScore = cast.author.score ?? 0;
  const followers = Math.max(0, cast.author.follower_count ?? 0);
  const substance = Math.min(15, (cast.text?.trim().length ?? 0) / 20);
  return (authorScore * 100)
    + Math.min(32, Math.log10(followers + 1) * 8)
    + substance
    - castEngagement(cast) * 0.5
    - ageMinutes / 5;
}
