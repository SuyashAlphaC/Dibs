import test from "node:test";
import assert from "node:assert/strict";
import {buildConvictionReport, normalizeBackers, parseRelatedWallets, type ConvictionBacker, type WalletContext} from "./conviction-intelligence";
import {createNansenClient, NansenError} from "./nansen-client";
import {createScanLimiter, intelligenceSameOrigin, parseIntelligenceRequest} from "./intelligence-request";
import {convictionFixture} from "./conviction-fixture";
import {hasNansenFieldEvidence,nansenFieldReport} from "./nansen-evidence";

const a = `0x${"1".repeat(40)}`, b = `0x${"2".repeat(40)}`, c = `0x${"3".repeat(40)}`, outside = `0x${"4".repeat(40)}`;
const hash = `0x${"a".repeat(64)}`, time = "2026-10-07T12:00:00Z";
const positions: ConvictionBacker[] = [{address: a, spentWei: "60000000000000000000001", units: 1, leadMinutes: 1}, {address: b, spentWei: "30000000000000000000001", units: 1, leadMinutes: 2}, {address: c, spentWei: "10000000000000000000001", units: 1, leadMinutes: 3}];
const row = {address: b, relation: "Transfer", transaction_hash: hash, block_timestamp: time, chain: "monad", address_label: "MUST NOT LEAVE SERVER"};
const payload = {data: [row], pagination: {is_last_page: true}};
const context = (address = a): WalletContext => ({...parseRelatedWallets(payload, "monad"), address, chain: "monad", fetchedAt: time, requestId: "req-1", creditsUsed: 1});
const report = (queries: Parameters<typeof buildConvictionReport>[0]["queries"]) => buildConvictionReport({marketId: "32", chain: "monad", positions, queries, now: time});

test("Nansen relationships join only genuine indexed backers and keep exact wei concentration", () => {
  const result = report([{address: a, context: {...context(), relations: [...context().relations, {...context().relations[0], address: outside}]}}]);
  assert.equal(result.totalConvictionWei, "100000000000000000000003");
  assert.equal(result.largestShareBps, 5999); // floor, never floating point rounding
  assert.equal(result.linkedBackers, 2);
  assert.equal(result.linkedConvictionBps, 8999);
  assert.equal(result.links.length, 1);
  assert.equal(result.backers[2].contextStatus, "not-queried");
  assert.equal(result.status, "partial");
  assert(!JSON.stringify(result).includes("MUST NOT LEAVE SERVER"));
});

test("missing context and empty results never become verified independent wallets", () => {
  const empty = report([{address: a, context: {...context(), relations: []}}, {address: b, error: "provider-rate-limited"}]);
  assert.equal(empty.coverage.succeeded, 1);
  assert.equal(empty.backers[0].contextStatus, "no-records");
  assert.equal(empty.backers[1].contextStatus, "unavailable");
  assert.match(empty.findings.join(" "), /does not establish independent ownership/);
  const failed = report([{address: a, error: "authentication-failed"}]);
  assert.equal(failed.status, "unavailable");
  assert.match(failed.findings.join(" "), /independence is unknown/);
});

test("truncated provider coverage stays partial and mirrored evidence is not double-counted", () => {
  const result = report([{address: a, context: {...context(), truncated: true}}, {address: b, context: {...context(b), relations: [{...context().relations[0], address: a}]}}, {address: c, context: {...context(c), relations: []}}]);
  assert.equal(result.links.length, 1);
  assert.equal(result.linkedBackers, 2);
  assert.equal(result.coverage.truncated, 1);
  assert.equal(result.status, "partial");
});

test("provider schema drift, mismatched chain and malformed proof fail closed", () => {
  assert.throws(() => parseRelatedWallets({data: [], error: "not found"}, "monad"));
  assert.throws(() => parseRelatedWallets({...payload, data: [{...row, chain: "base"}]}, "monad"));
  assert.throws(() => parseRelatedWallets({...payload, data: [{...row, transaction_hash: "javascript:alert(1)"}]}, "monad"));
  assert.throws(() => report([{address: a, context: {...context(), chain: "base"}}]));
  assert.throws(() => report([{address: outside, context: context(outside)}]));
});

test("indexed addresses, duplicate positions and stake units are validated", () => {
  assert.throws(() => normalizeBackers([...positions, positions[0]]));
  assert.throws(() => normalizeBackers([{...positions[0], spentWei: "-1"}]));
  assert.throws(() => normalizeBackers([{...positions[0], units: 1.5}]));
  assert.deepEqual(normalizeBackers([...positions].reverse()), positions);
});

test("the live request cannot specify arbitrary wallets, endpoints, fixture IDs or unsupported chains", () => {
  assert.deepEqual(parseIntelligenceRequest("32", {chain: "base"}), {marketId: "32", chain: "base"});
  for (const [id, body] of [["example", {chain: "base"}], ["32", {chain: "testnet"}], ["32", {chain: "monad", address: a}], ["32", {chain: "base", endpoint: "https://evil.test"}], ["32", null]] as const) assert.equal(parseIntelligenceRequest(id, body), null);
});

test("cross-site scans and user retry storms are rejected", () => {
  assert(intelligenceSameOrigin(new Request("https://dibs.test/api/intelligence", {headers: {origin: "https://dibs.test", "sec-fetch-site": "same-origin"}})));
  assert(!intelligenceSameOrigin(new Request("https://dibs.test/api/intelligence", {headers: {origin: "https://evil.test"}})));
  assert(!intelligenceSameOrigin(new Request("https://dibs.test/api/intelligence")));
  let now = 0; const limiter = createScanLimiter(() => now);
  assert.equal(limiter("user-1"), 0); assert.equal(limiter("user-1"), 60);
  now = 30_000; assert.equal(limiter("user-1"), 30); assert.equal(limiter("user-2"), 0);
  now = 60_000; assert.equal(limiter("user-1"), 0);
});

test("Nansen client uses current wallet_address schema, keeps secrets out of DTOs, and coalesces paid calls", async () => {
  let requests = 0;
  const fetcher: typeof fetch = async (url, options) => {
    requests++;
    assert.match(String(url), /^https:\/\/api\.nansen\.ai\//);
    assert.equal(new Headers(options?.headers).get("apikey"), "secret-test-key");
    assert.deepEqual(JSON.parse(String(options?.body)), {wallet_address: a, chain: "monad", pagination: {page: 1, per_page: 100}});
    return Response.json(payload, {headers: {"x-request-id": "nansen-request", "x-nansen-credits-used": "1"}});
  };
  const client = createNansenClient({apiKey: "secret-test-key", fetcher});
  const [first, second] = await Promise.all([client(a, "monad"), client(a, "monad")]);
  assert.equal(first, second); assert.equal(requests, 1);
  assert.equal((await client(a, "monad")).requestId, "nansen-request");
  assert.equal(requests, 1);
  assert(!JSON.stringify(first).includes("secret-test-key"));
  assert(!JSON.stringify(first).includes("MUST NOT LEAVE SERVER"));
});

test("credit, authentication, rate-limit and provider failures are explicit, never clean empty scans", async () => {
  for (const [status, code] of [[401, "authentication-failed"], [402, "credits-or-plan-required"], [403, "credits-or-plan-required"], [429, "provider-rate-limited"], [500, "upstream-unavailable"]] as const) {
    const client = createNansenClient({apiKey: "test", fetcher: async () => new Response("private upstream diagnostic", {status})});
    await assert.rejects(client(a, "monad"), error => error instanceof NansenError && error.code === code && !error.message.includes("private"));
  }
  await assert.rejects(createNansenClient({apiKey: "", fetcher: async () => {throw new Error("Should not call");}})(a, "monad"), /not-configured/);
});

test("cache expiry and bounded per-instance provider spending are enforced", async () => {
  let now = 0, requests = 0;
  const client = createNansenClient({apiKey: "test", now: () => now, fetcher: async () => {requests++; return Response.json(payload);}});
  await client(a, "monad"); now = 899_999; await client(a, "monad"); assert.equal(requests, 1);
  now = 900_000; await client(a, "monad"); assert.equal(requests, 2);
  for (let index = 0; index < 58; index++) await client(`0x${(index + 100).toString(16).padStart(40, "0")}`, "monad");
  await assert.rejects(client(outside, "monad"), /instance-budget-exhausted/);
  now = 3_600_000; await client(outside, "monad");
});

test("the teaching fixture is permanently and unambiguously separated from live Nansen data", () => {
  assert.equal(convictionFixture.source, "fixture");
  assert.equal(convictionFixture.marketId, "example");
  assert.equal(convictionFixture.largestShareBps, 6000);
  assert.equal(convictionFixture.linkedConvictionBps, 9000);
  assert.equal(convictionFixture.status, "partial");
});

test("cached context ages remain explicit and a market without backers cannot claim a completed Nansen scan", () => {
  const result = buildConvictionReport({marketId: "32", chain: "monad", positions, queries: [{address: a, context: context()}], now: "2026-10-07T12:15:00Z"});
  assert.equal(result.coverage.stale, 1);
  assert.match(result.findings.join(" "), /at least 15 minutes old/);
  assert.equal(buildConvictionReport({marketId: "32", chain: "monad", positions: [], queries: []}).status, "partial");
});

test("earliest backer sampling respects exact event seconds, not rounded age display", () => {
  const result = normalizeBackers([{...positions[0], firstScoutedAt: 1009}, {...positions[1], firstScoutedAt: 1001}]);
  assert.equal(result[0].address, b);
});

test("retained field proof is genuine, attributable historical context, never substituted fixture data", () => {
  assert(hasNansenFieldEvidence);
  assert.equal(nansenFieldReport.source, "nansen");
  assert.equal(nansenFieldReport.marketId, "32");
  assert.equal(nansenFieldReport.chain, "base");
  assert.equal(nansenFieldReport.coverage.total, 6);
  assert.equal(nansenFieldReport.coverage.succeeded, 6);
  assert.equal(nansenFieldReport.totalConvictionWei, "75000000000000000");
  assert.equal(nansenFieldReport.largestShareBps, 2000);
  assert.equal(nansenFieldReport.coverage.withRecords, 0);
  assert.equal(nansenFieldReport.links.length, 0);
  assert(nansenFieldReport.queries.every(query => query.requestId && query.fetchedAt));
  assert(!JSON.stringify(nansenFieldReport).includes("address_label"));
  assert.match(nansenFieldReport.findings.join(" "), /does not establish independent ownership/);
});
