import assert from "node:assert/strict";
import test from "node:test";
import {scoreObservation, type MarketObservation} from "./scoring.js";

const base: MarketObservation = {
  marketId: 7,
  castHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  baselineQualifiedScore: 500,
  observedAt: 1_800_000_000,
  interactions: [],
};

test("rejects young and low-quality accounts from growth", () => {
  const result = scoreObservation({
    ...base,
    interactions: [
      {fid: 1, kind: "like", accountAgeDays: 2, neynarScoreBps: 9_900},
      {fid: 2, kind: "recast", accountAgeDays: 900, neynarScoreBps: 2_000},
      {fid: 3, kind: "reply", accountAgeDays: 365, neynarScoreBps: 8_000},
    ],
  });

  assert.equal(result.acceptedInteractions, 1);
  assert.equal(result.rejectedInteractions, 2);
  assert.equal(result.qualityGrowthScore, 1_900n);
});

test("never reports negative growth", () => {
  const result = scoreObservation({...base, baselineQualifiedScore: 10_000});
  assert.equal(result.qualityGrowthScore, 0n);
});

test("evidence hash is stable regardless of API ordering", () => {
  const interactions = [
    {fid: 20, kind: "reply" as const, accountAgeDays: 100, neynarScoreBps: 8_000},
    {fid: 10, kind: "like" as const, accountAgeDays: 100, neynarScoreBps: 9_000},
  ];
  const first = scoreObservation({...base, interactions});
  const second = scoreObservation({...base, interactions: [...interactions].reverse()});
  assert.equal(first.evidenceHash, second.evidenceHash);
  assert.equal(first.qualityGrowthScore, second.qualityGrowthScore);
});

