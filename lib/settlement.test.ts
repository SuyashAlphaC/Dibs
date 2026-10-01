import assert from "node:assert/strict";
import test from "node:test";
import {settlementMetrics} from "./settlement";
import type {CastMarket} from "./types";

const market={
  id:"1",hash:"0x0000000000000000000000000000000000000000",author:{fid:1,username:"scout",displayName:"Scout",avatarUrl:""},
  text:"signal",timestamp:new Date(0).toISOString(),ageMinutes:1,likes:40,recasts:5,replies:3,totalUnits:1,totalStaked:.01,communitySeed:1,
  convictionScore:.01,rank:1,rankDelta:0,movementPercent:0,newScouts:1,category:"Social",status:"settled",timeLeftMinutes:0,
  whyRising:"settled",nextUnitCost:.011,potentialReward:.1,baselineQualifiedScore:1_200,settlementScore:3_800,
} satisfies CastMarket;

test("settlement displays the onchain score as weighted growth, never a percentage",()=>{
  assert.deepEqual(settlementMetrics(market),{
    closingInteractions:48,
    openingValue:1_200,
    openingLabel:"Opening quality baseline",
    openingDetail:"Qualified weighted points",
    qualityGrowth:3_800,
  });
});
