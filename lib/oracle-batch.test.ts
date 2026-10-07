import assert from "node:assert/strict";
import test from "node:test";
import {ORACLE_BATCH_SIZE, ORACLE_HTTP_BUDGET_BYTES, packOracleBatch, selectOracleBatch, splitOracleQueue} from "./oracle-batch";

test("backlogs are bounded, oldest first and independent of indexer tie order", () => {
  const markets = Array.from({length: 39}, (_, i) => ({marketId: i + 1, closesAt: 100, action: "submit" as const}));
  assert.deepEqual(selectOracleBatch([...markets].reverse()), markets.slice(0, ORACLE_BATCH_SIZE));
  assert.equal(markets.length, 39);
});

test("elapsed submission windows do not block live work or masquerade as valid oracle results", () => {
  const markets = [
    {marketId: 1, closesAt: 100, action: "submit" as const},
    {marketId: 2, closesAt: 500, action: "submit" as const},
    {marketId: 3, closesAt: 100, resultSubmittedAt: 400, action: "resolve" as const},
  ];
  const queue = splitOracleQueue(markets, 600, {submissionGrace: 300, challengePeriod: 200, resolutionPeriod: 300});
  assert.deepEqual(queue.ready.map(market => market.marketId), [2, 3]);
  assert.deepEqual(queue.expired, [1]);
});

test("a challenged market is not starved behind the submission backlog", () => {
  const markets = Array.from({length: 20}, (_, i) => ({marketId: i + 1, closesAt: 100, action: "submit" as "submit" | "resolve"}));
  markets.push({marketId: 21, closesAt: 200, action: "resolve"});
  assert.equal(selectOracleBatch(markets)[0].marketId, 21);
});

test("HTTP packing preserves complete evidence and exposes oversized markets", () => {
  const small = {marketId: 2, interactions: [{fid: 1}]};
  const oversized = {marketId: 1, interactions: [{fid: "a".repeat(ORACLE_HTTP_BUDGET_BYTES)}]};
  const packed = packOracleBatch([oversized, small]);
  assert.deepEqual(packed.observations, [small]);
  assert.deepEqual(packed.deferred, [1]);
  assert.ok(Buffer.byteLength(JSON.stringify(packed)) < ORACLE_HTTP_BUDGET_BYTES + 100);
});
