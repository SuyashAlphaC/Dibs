import type {InteractionKind, QualifiedInteraction} from "@/lib/quality-baseline";

type NeynarUser = {
  fid: number;
  registered_at: string;
  score?: number;
  experimental?: {neynar_user_score?: number};
};
type NeynarReaction = {object: "likes" | "recasts"; user: NeynarUser};
type NeynarReply = {author: NeynarUser; direct_replies?: NeynarReply[]};
type CursorPage = {next?: {cursor?: string | null}};

async function neynar(path: string, params: Record<string, string>, apiKey: string) {
  const url = new URL(`https://api.neynar.com${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: {"x-api-key": apiKey, "x-neynar-experimental": "true"},
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Neynar ${path} returned ${response.status}`);
  return response.json() as Promise<unknown>;
}

function interaction(user: NeynarUser, kind: InteractionKind, observedAt: number): QualifiedInteraction {
  const registeredAt = Date.parse(user.registered_at);
  const accountAgeDays = Number.isFinite(registeredAt)
    ? Math.max(0, Math.floor((observedAt * 1_000 - registeredAt) / 86_400_000))
    : 0;
  const score = user.score ?? user.experimental?.neynar_user_score ?? 0;
  return {
    fid: user.fid,
    kind,
    accountAgeDays,
    neynarScoreBps: Math.round(Math.max(0, Math.min(1, score)) * 10_000),
  };
}

function flattenReplies(replies: NeynarReply[]): NeynarReply[] {
  return replies.flatMap((reply) => [reply, ...flattenReplies(reply.direct_replies ?? [])]);
}

async function paged<T>(load: (cursor?: string) => Promise<{items: T[]; cursor?: string | null}>) {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 20; page++) {
    const result = await load(cursor);
    items.push(...result.items);
    if (!result.cursor || result.cursor === cursor) break;
    cursor = result.cursor;
  }
  return items;
}

export async function collectQualifiedInteractions(castHash: string, observedAt: number, apiKey: string) {
  const [reactions, replies] = await Promise.all([
    paged<NeynarReaction>(async (cursor) => {
      const payload = await neynar("/v2/farcaster/reactions/cast/", {
        hash: castHash,
        types: "all",
        limit: "100",
        ...(cursor ? {cursor} : {}),
      }, apiKey) as CursorPage & {reactions?: NeynarReaction[]};
      return {items: payload.reactions ?? [], cursor: payload.next?.cursor};
    }),
    paged<NeynarReply>(async (cursor) => {
      const payload = await neynar("/v2/farcaster/cast/conversation/", {
        identifier: castHash,
        type: "hash",
        reply_depth: "5",
        limit: "50",
        sort_type: "chron",
        ...(cursor ? {cursor} : {}),
      }, apiKey) as CursorPage & {conversation?: {cast?: {direct_replies?: NeynarReply[]}}};
      return {
        items: flattenReplies(payload.conversation?.cast?.direct_replies ?? []),
        cursor: payload.next?.cursor,
      };
    }),
  ]);

  // A reaction/reply can be repeated at page boundaries. Count a scout once per interaction kind.
  const canonical = new Map<string, QualifiedInteraction>();
  for (const reaction of reactions) {
    const value = interaction(reaction.user, reaction.object === "likes" ? "like" : "recast", observedAt);
    canonical.set(`${value.fid}:${value.kind}`, value);
  }
  for (const reply of replies) {
    const value = interaction(reply.author, "reply", observedAt);
    canonical.set(`${value.fid}:${value.kind}`, value);
  }
  return [...canonical.values()];
}
