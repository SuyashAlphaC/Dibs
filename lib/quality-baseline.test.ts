import assert from "node:assert/strict";
import test from "node:test";
import {decodeQualityBaseline,encodeQualityBaseline,qualifiedInteractionScore} from "./quality-baseline";

test("versioned weighted baselines round-trip without changing legacy markets",()=>{
  assert.deepEqual(decodeQualityBaseline(12),{weighted:false,qualifiedScore:12_000,rawEngagement:12});
  assert.deepEqual(decodeQualityBaseline(encodeQualityBaseline(4_250)),{
    weighted:true,
    qualifiedScore:4_250,
    rawEngagement:undefined,
  });
});

test("quality scoring rejects weak identities and weights interaction kinds",()=>{
  const score=qualifiedInteractionScore([
    {fid:1,kind:"like",accountAgeDays:300,neynarScoreBps:8_000},
    {fid:2,kind:"reply",accountAgeDays:300,neynarScoreBps:7_000},
    {fid:3,kind:"recast",accountAgeDays:2,neynarScoreBps:9_900},
  ]);
  assert.equal(score,2_900);
});
