import assert from "node:assert/strict";
import test from "node:test";
import {buildInflatedChallengeObservation} from "./challenge-demo";

const market={marketId:12,castHash:`0x${"1".repeat(64)}` as `0x${string}`,baselineQualifiedScore:1_200,openedAt:1,closesAt:2,action:"submit" as const,previousQualityGrowthScore:0};

test("challenge rehearsal builds a deterministic, clearly inflated fixture",()=>{
  const observation=buildInflatedChallengeObservation(market);
  assert.equal(observation.marketId,12);
  assert.equal(observation.interactions.length,64);
  assert.ok(observation.interactions.every(item=>item.kind==="reply"&&item.neynarScoreBps===10_000));
});

test("challenge rehearsal refuses an already challenged market",()=>{
  assert.throws(()=>buildInflatedChallengeObservation({...market,action:"resolve"}),/before a result/);
});
