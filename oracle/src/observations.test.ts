import assert from "node:assert/strict";
import test from "node:test";
import {compactSettlementJson,MAX_CONSENSUS_BYTES} from "./observations.js";
import {scoreObservation} from "./scoring.js";
import {isSettlementPending} from "./chain-state.js";

const observation = {marketId: 1, castHash: `0x${"a".repeat(64)}` as `0x${string}`, observedAt: 1_800_000_000, baselineQualifiedScore: 1200,
  interactions: Array.from({length: 600}, (_, i) => ({fid: i + 1, kind: "like" as const, accountAgeDays: 100, neynarScoreBps: 8000}))};

test("oversized raw evidence is scored on the node and compacted before consensus without losing interactions", () => {
  const body = JSON.stringify({observations: [observation]});
  assert.ok(Buffer.byteLength(body) > 25_000);
  const compact = compactSettlementJson(body);
  const result = JSON.parse(compact).settlements[0];
  const expected = scoreObservation(observation);
  assert.ok(Buffer.byteLength(compact) < MAX_CONSENSUS_BYTES);
  assert.equal(result.acceptedInteractions, 600);
  assert.equal(result.qualityGrowthScore, expected.qualityGrowthScore.toString());
  assert.equal(result.evidenceHash, expected.evidenceHash);
});

test("API ordering cannot change the agreed evidence hash or compact result", () => {
  assert.equal(compactSettlementJson(JSON.stringify({observations: [observation]})),
    compactSettlementJson(JSON.stringify({observations: [{...observation, interactions: [...observation.interactions].reverse()}]})));
});

test("challenge decisions retain corrected score and uphold only lower observations", () => {
  const challenged = {...observation, action: "resolve", previousQualityGrowthScore: 1_000_000};
  assert.equal(JSON.parse(compactSettlementJson(JSON.stringify({observations: [challenged]}))).settlements[0].upheld, true);
  assert.equal(JSON.parse(compactSettlementJson(JSON.stringify({observations: [{...challenged, previousQualityGrowthScore: 0}]}))).settlements[0].upheld, false);
  assert.throws(() => compactSettlementJson(JSON.stringify({observations: [{...challenged, previousQualityGrowthScore: undefined}]})), /previousQualityGrowthScore/);
});

test("malformed batches and simulation cannot become production settlements", () => {
  assert.throws(() => compactSettlementJson(JSON.stringify({observations: [observation], simulation: true})), /Simulation/);
  assert.throws(() => compactSettlementJson(JSON.stringify({observations: [observation, observation]})), /Duplicate market/);
  assert.throws(() => compactSettlementJson(JSON.stringify({observations: Array(9).fill({...observation, interactions: []})})), /batch size/);
  assert.throws(() => compactSettlementJson(JSON.stringify({observations: [{...observation, action: "expire"}]})), /action/);
  assert.throws(() => compactSettlementJson(JSON.stringify({observations: [{...observation, interactions: [observation.interactions[0], observation.interactions[0]]}]})), /Duplicate interaction/);
});

test("onchain preflight skips stale indexer results and resolved challenges", () => {
  assert.equal(isSettlementPending("submit", {resultSubmitted: true, challenged: false, challengeResolved: false}), false);
  assert.equal(isSettlementPending("submit", {resultSubmitted: false, challenged: false, challengeResolved: false}), true);
  assert.equal(isSettlementPending("resolve", {resultSubmitted: true, challenged: true, challengeResolved: true}), false);
  assert.equal(isSettlementPending("resolve", {resultSubmitted: true, challenged: true, challengeResolved: false}), true);
});
