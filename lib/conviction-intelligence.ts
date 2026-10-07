/** Public DTOs and deterministic analysis. No credentials, wallet control or settlement writes. */
export const NANSEN_CHAINS = ["monad", "base", "ethereum"] as const;
export type IntelligenceChain = typeof NANSEN_CHAINS[number];
export const MAX_INTELLIGENCE_BACKERS = 8;
export const NANSEN_RELATED_ENDPOINT = "https://api.nansen.ai/api/v1/profiler/address/related-wallets";
export type ConvictionBacker = {address: string; spentWei: string; units: number; leadMinutes: number; firstScoutedAt?: number};
export type WalletRelation = {address: string; relation: string; transactionHash: string; timestamp: string; chain: IntelligenceChain};
export type WalletContext = {
  address: string; chain: IntelligenceChain; fetchedAt: string; requestId: string | null;
  creditsUsed: number | null; truncated: boolean; relations: WalletRelation[];
};
export type WalletQuery = {address: string; context?: WalletContext; error?: string};
export type ConvictionLink = WalletRelation & {from: string; to: string};
export type SharedCounterparty = {address: string; backers: string[]; proofs: Array<WalletRelation & {from: string}>};
export type ConvictionReport = {
  version: 1; source: "nansen" | "fixture"; marketId: string; chain: IntelligenceChain;
  generatedAt: string; status: "ready" | "partial" | "unavailable";
  backers: Array<ConvictionBacker & {shareBps: number; contextStatus: "records" | "no-records" | "unavailable" | "not-queried"}>;
  totalConvictionWei: string; largestShareBps: number; linkedConvictionBps: number;
  linkedBackers: number; links: ConvictionLink[];
  /** Additive: older retained reports did not inspect shared counterparties. */
  sharedCounterparties?: SharedCounterparty[];
  coverage: {total: number; queried: number; succeeded: number; withRecords: number; truncated: number; stale: number};
  queries: Array<Omit<WalletQuery, "context"> & {fetchedAt?: string; requestId?: string | null; creditsUsed?: number | null; truncated?: boolean}>;
  findings: string[]; limitations: string[];
};

export function intelligenceChain(value: unknown): IntelligenceChain | null {
  return NANSEN_CHAINS.includes(value as IntelligenceChain) ? value as IntelligenceChain : null;
}

export function normalizeBackers(positions: ConvictionBacker[]): ConvictionBacker[] {
  const seen = new Set<string>();
  return positions.map(position => {
    const address = position.address.toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(address) || seen.has(address)) throw new Error("Invalid or duplicate indexed backer");
    if (!/^\d+$/.test(position.spentWei) || !Number.isSafeInteger(position.units) || position.units < 1 || !Number.isSafeInteger(position.leadMinutes) || position.leadMinutes < 0) throw new Error("Invalid indexed conviction");
    if (position.firstScoutedAt !== undefined && (!Number.isSafeInteger(position.firstScoutedAt) || position.firstScoutedAt < 0)) throw new Error("Invalid indexed scout time");
    seen.add(address);
    return {...position, address};
  }).sort((a, b) => (a.firstScoutedAt ?? a.leadMinutes * 60) - (b.firstScoutedAt ?? b.leadMinutes * 60) || a.address.localeCompare(b.address));
}

/** Reject schema drift; never turn an upstream error into a clean relationship scan. */
export function parseRelatedWallets(payload: unknown, chain: IntelligenceChain): Pick<WalletContext, "relations" | "truncated"> {
  const body = payload as {data?: unknown; pagination?: {is_last_page?: unknown}} | null;
  if (!body || !Array.isArray(body.data) || typeof body.pagination?.is_last_page !== "boolean" || body.data.length > 100) throw new Error("Invalid Nansen response");
  const relations = body.data.map((item: unknown): WalletRelation => {
    const row = item as Record<string, unknown> | null;
    if (!row || typeof row.address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(row.address) || row.chain !== chain || typeof row.relation !== "string" || !row.relation.trim() || row.relation.length > 200 || typeof row.transaction_hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(row.transaction_hash) || typeof row.block_timestamp !== "string" || !Number.isFinite(Date.parse(row.block_timestamp))) throw new Error("Invalid Nansen relationship record");
    // Deliberately omit address_label and all proprietary label data.
    return {address: row.address.toLowerCase(), relation: row.relation, transactionHash: row.transaction_hash.toLowerCase(), timestamp: row.block_timestamp, chain};
  });
  return {relations, truncated: !body.pagination.is_last_page};
}

export function buildConvictionReport(input: {marketId: string; chain: IntelligenceChain; positions: ConvictionBacker[]; queries: WalletQuery[]; now?: string; source?: "nansen" | "fixture"}): ConvictionReport {
  const generatedAt = input.now ?? new Date().toISOString();
  const positions = normalizeBackers(input.positions);
  const byAddress = new Map(positions.map(position => [position.address, position]));
  const queries = new Map<string, WalletQuery>();
  for (const query of input.queries) {
    const address = query.address.toLowerCase();
    if (!byAddress.has(address) || queries.has(address) || (query.context && (query.context.chain !== input.chain || query.context.address.toLowerCase() !== address))) throw new Error("Mismatched wallet context");
    queries.set(address, {...query, address});
  }
  const total = positions.reduce((sum, position) => sum + BigInt(position.spentWei), 0n);
  const share = (value: bigint) => total ? Number(value * 10_000n / total) : 0;
  const links: ConvictionLink[] = [];
  const counterparties = new Map<string, Map<string, WalletRelation & {from: string}>>();
  const seen = new Set<string>();
  for (const [address, query] of queries) {
    for (const relation of query.context?.relations ?? []) {
      if (relation.chain !== input.chain) throw new Error("Mismatched relationship chain");
      if (relation.address !== address && !byAddress.has(relation.address)) {
        const members = counterparties.get(relation.address) ?? new Map();
        // One deterministic source transaction per backer/counterparty; no extra API call.
        const prior = members.get(address);
        if (!prior || `${relation.transactionHash}:${relation.relation}:${relation.timestamp}`.localeCompare(`${prior.transactionHash}:${prior.relation}:${prior.timestamp}`) < 0) members.set(address, {...relation, from: address});
        counterparties.set(relation.address, members);
      }
      if (!byAddress.has(relation.address) || relation.address === address) continue;
      const pair = [address, relation.address].sort();
      const key = `${pair.join(":")}:${relation.transactionHash}:${relation.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({...relation, from: address, to: relation.address});
    }
  }
  links.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to) || a.transactionHash.localeCompare(b.transactionHash));
  const sharedCounterparties = [...counterparties].filter(([, members]) => members.size > 1).sort(([a], [b]) => a.localeCompare(b)).map(([address, members]) => ({address, backers: [...members.keys()].sort(), proofs: [...members.values()].sort((a, b) => a.from.localeCompare(b.from))}));
  const linked = new Set([...links.flatMap(link => [link.from, link.to]), ...sharedCounterparties.flatMap(counterparty => counterparty.backers)]);
  const succeeded = [...queries.values()].filter(query => query.context);
  const withRecords = succeeded.filter(query => query.context!.relations.length).length;
  const largest = positions.reduce((max, position) => BigInt(position.spentWei) > max ? BigInt(position.spentWei) : max, 0n);
  const largestShareBps = share(largest);
  const linkedConvictionBps = share(positions.filter(position => linked.has(position.address)).reduce((sum, position) => sum + BigInt(position.spentWei), 0n));
  const coverage = {total: positions.length, queried: queries.size, succeeded: succeeded.length, withRecords, truncated: succeeded.filter(query => query.context!.truncated).length, stale: succeeded.filter(query => Date.parse(generatedAt) - Date.parse(query.context!.fetchedAt) >= 900_000).length};
  const findings = [positions.length ? `The largest wallet supplied ${(largestShareBps / 100).toFixed(1)}% of scout conviction; protocol seed is excluded.` : "No scout conviction is indexed yet."];
  if (linked.size) findings.push(`Nansen reports connections involving ${linked.size} backers representing ${(linkedConvictionBps / 100).toFixed(1)}% of stake. Inspect the transactions before interpreting the crowd.`);
  else if (succeeded.length) findings.push("No direct connection between market backers was returned in the sampled Nansen records. This does not establish independent ownership.");
  else findings.push("Nansen relationship coverage is unavailable; wallet independence is unknown.");
  if (succeeded.length && !withRecords) findings.push("Nansen returned no relationship records for the queried addresses on this dataset. Try another context chain if these wallets have activity there.");
  if (sharedCounterparties.length) findings.push(`${sharedCounterparties.length} shared counterparties appear in multiple backers' returned records. These can be ordinary services or contracts, not common owners or direct transfers between scouts.`);
  if (coverage.stale) findings.push(`${coverage.stale} wallet context snapshots are at least 15 minutes old. Check the source timestamps before acting; refresh may be pending or unavailable.`);
  if (largestShareBps >= 5_000 && positions.length > 1) findings.push("Half or more of the visible conviction comes from one wallet. Review the scout ledger rather than treating wallet count as equal support.");
  const limitations = ["Connections can reflect ordinary transfers or exchange activity. They are not proof of common ownership, Sybil behavior or manipulation.", "External wallet context does not change Dibs rank, reputation, reward eligibility or CRE quality settlement.", "Nansen context and Envio's Dibs staking network are separate datasets; testnet activity is not assumed to be indexed by Nansen.", `At most ${MAX_INTELLIGENCE_BACKERS} earliest backers are queried, with the first 100 relationship records per wallet. Missing, failed and truncated data are not evidence of independence.`];
  return {version: 1, source: input.source ?? "nansen", marketId: input.marketId, chain: input.chain, generatedAt, status: !succeeded.length ? positions.length ? "unavailable" : "partial" : coverage.succeeded < coverage.total || coverage.truncated || coverage.stale ? "partial" : "ready", backers: positions.map(position => {
    const query = queries.get(position.address);
    return {...position, shareBps: share(BigInt(position.spentWei)), contextStatus: !query ? "not-queried" : !query.context ? "unavailable" : query.context.relations.length ? "records" : "no-records"};
  }), totalConvictionWei: total.toString(), largestShareBps, linkedConvictionBps, linkedBackers: linked.size, links, sharedCounterparties, coverage, queries: [...queries.values()].map(query => ({address: query.address, ...(query.context ? {fetchedAt: query.context.fetchedAt, requestId: query.context.requestId, creditsUsed: query.context.creditsUsed, truncated: query.context.truncated} : {error: query.error ?? "unavailable"})})), findings, limitations};
}
