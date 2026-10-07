import test from "node:test";
import assert from "node:assert/strict";
import {buildConvictionReport, type ConvictionBacker, type WalletContext} from "./conviction-intelligence";
import {ageConvictionReport, convictionDecision} from "./conviction-decision";
import {scanReducer, scanRetryDeadline, scanSecondsRemaining, scanState} from "./conviction-scan";
import {nansenFieldReport} from "./nansen-evidence";

const a = `0x${"1".repeat(40)}`, b = `0x${"2".repeat(40)}`, c = `0x${"3".repeat(40)}`, common = `0x${"4".repeat(40)}`;
const time = "2026-10-07T12:00:00Z", hash = `0x${"a".repeat(64)}`;
const positions: ConvictionBacker[] = [a, b, c].map((address, index) => ({address, spentWei: ["60000000000000001", "30000000000000001", "10000000000000001"][index], units: 1, leadMinutes: index}));
const context = (address: string, related: string[], truncated = false): WalletContext => ({address, chain: "base", fetchedAt: time, requestId: "test-not-provider-evidence", creditsUsed: null, truncated, relations: related.map((address, index) => ({address, chain: "base", relation: "Transfer", transactionHash: index ? `0x${"b".repeat(64)}` : hash, timestamp: time}))});
const build = (queries: Parameters<typeof buildConvictionReport>[0]["queries"]) => buildConvictionReport({marketId: "32", chain: "base", positions, queries, now: time});

test("shared counterparties join genuine backers without inventing a direct transfer", () => {
  const result = build([{address: a, context: context(a, [common, common])}, {address: b, context: context(b, [common])}, {address: c, context: context(c, [])}]);
  assert.equal(result.links.length, 0);
  assert.equal(result.sharedCounterparties?.length, 1);
  assert.deepEqual(result.sharedCounterparties![0].backers, [a, b]);
  assert.equal(result.sharedCounterparties![0].proofs.length, 2);
  assert(result.sharedCounterparties![0].proofs.every(proof => proof.address === common && [a, b].includes(proof.from)));
  assert.equal(result.backers.length, 3); // External counterparties never become scouts.
  assert.equal(result.linkedBackers, 2);
  const brief = convictionDecision(result);
  assert.equal(brief.groups.length, 1);
  assert.equal(brief.groups[0].spentWei, "90000000000000002");
  assert.equal(brief.groups[0].shareBps, 8999);
  assert.equal(brief.state, "review-evidence");
  assert.match(brief.actions[0].text, /Ordinary services/);
});

test("direct and indirect paths form a component with no double-counted stake", () => {
  const result = build([{address: a, context: context(a, [b, common])}, {address: b, context: context(b, [a])}, {address: c, context: context(c, [common])}]);
  const brief = convictionDecision(result);
  assert.equal(result.links.length, 1);
  assert.equal(result.linkedBackers, 3);
  assert.equal(brief.groups.length, 1);
  assert.deepEqual(brief.groups[0].addresses, [a, b, c]);
  assert.equal(brief.groups[0].shareBps, 10000);
  assert.equal(brief.groups[0].spentWei, result.totalConvictionWei);
});

test("one-sided external relationships and missing context never invent shared counterparties", () => {
  const result = build([{address: a, context: context(a, [common])}, {address: b, error: "provider-rate-limited"}]);
  assert.equal(result.sharedCounterparties?.length, 0);
  assert.equal(result.linkedBackers, 0);
  assert.equal(convictionDecision(result).groups.length, 0);
  assert(convictionDecision(result).actions.some(action => action.kind === "coverage"));
  assert.throws(() => build([{address: a, context: {...context(a, [common]), relations: [{...context(a, [common]).relations[0], chain: "monad"}]}}]), /Mismatched relationship chain/);
});

test("shared proof selection is deterministic and context gaps remain explicit", () => {
  const queries = [{address: a, context: context(a, [common, common], true)}, {address: b, context: context(b, [common])}];
  const first = build(queries), second = build(queries.reverse().map(query => ({...query, context: {...query.context, relations: query.context.relations.reverse()}})));
  assert.deepEqual(first.sharedCounterparties, second.sharedCounterparties);
  assert.equal(first.status, "partial");
  assert(convictionDecision(first).actions.some(action => /1 truncated/.test(action.text)));
});

test("empty scans and older genuine reports never claim safe or independent backing", () => {
  const empty = buildConvictionReport({marketId: "32", chain: "base", positions: [], queries: [], now: time});
  assert.equal(convictionDecision(empty).state, "awaiting-backers");
  const historical = convictionDecision(nansenFieldReport);
  assert.equal(historical.state, "no-overlap-returned");
  assert.equal(historical.sharedCounterpartiesInspected, false);
  assert.match(historical.title, /not verified independence/);
  assert.match(historical.actions[0].text, /No relationship records/);
});

test("scan retries preserve previous reports and keep context chains separate", () => {
  let state = scanState(nansenFieldReport);
  state = scanReducer(state, {type: "start"});
  assert.equal(state.reports.base, nansenFieldReport);
  assert.equal(scanReducer(state, {type: "select", chain: "monad"}), state);
  state = scanReducer(state, {type: "failure", error: "Provider unavailable", retryAt: 60000});
  assert.equal(state.reports.base, nansenFieldReport);
  assert.equal(state.busy, false);
  state = scanReducer(state, {type: "select", chain: "monad"});
  assert.equal(state.reports.monad, undefined);
  assert.equal(state.retryAt, 60000);
  state = scanReducer(state, {type: "select", chain: "base"});
  assert.equal(state.reports[state.chain], nansenFieldReport);
  state = scanReducer(state, {type: "result", report: {...nansenFieldReport, chain: "monad"}, retryAt: 120000});
  assert.equal(state.reports.base, nansenFieldReport);
  assert.equal(state.reports.monad?.chain, "monad");
});

test("cooldown countdown obeys Retry-After, expires, and rejects malformed delays", () => {
  const deadline = scanRetryDeadline("53", 1000);
  assert.equal(deadline, 54000);
  assert.equal(scanSecondsRemaining(deadline, 1000), 53);
  assert.equal(scanSecondsRemaining(deadline, 2001), 52);
  assert.equal(scanSecondsRemaining(deadline, 54000), 0);
  assert.equal(scanSecondsRemaining(deadline, 99000), 0);
  for (const bad of [null, "-1", "Infinity", "1.5", "9999999999999999999", "3601"]) assert.equal(scanRetryDeadline(bad, 1000), 0);
});

test("a live report ages into incomplete coverage without rewriting provider timestamps", () => {
  const result = build([{address: a, context: context(a, [])}, {address: b, context: context(b, [])}, {address: c, context: context(c, [])}]);
  assert.equal(ageConvictionReport(result, Date.parse(time) + 899999), result);
  const aged = ageConvictionReport(result, Date.parse(time) + 900000);
  assert.equal(aged.status, "partial");
  assert.equal(aged.coverage.stale, 3);
  assert.equal(aged.generatedAt, result.generatedAt);
  assert.equal(aged.queries, result.queries);
  assert.equal(result.coverage.stale, 0);
  assert(convictionDecision(aged).actions.some(action => /3 stale/.test(action.text)));
});
