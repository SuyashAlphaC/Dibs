import assert from "node:assert/strict";
import test from "node:test";
import {discoveryPriority, hasPromotionalSpam, qualifiesForDiscovery} from "./discovery-quality";

const now = Date.parse("2026-09-28T10:00:00Z") / 1_000;
const strong = {
  timestamp:"2026-09-28T09:50:00Z",
  parent_hash:null,
  text:"A concrete early observation about an emerging protocol and why its design matters.",
  author:{score:0.91,follower_count:420,registered_at:"2024-01-01T00:00:00Z"},
  reactions:{likes_count:2,recasts_count:1},
  replies:{count:1},
};

test("discovery quality accepts early substantive casts from established quality accounts",()=>{
  assert.equal(qualifiesForDiscovery(strong,now),true);
});

test("discovery quality rejects greetings and low-quality authors",()=>{
  assert.equal(qualifiesForDiscovery({...strong,text:"gm everyone"},now),false);
  assert.equal(qualifiesForDiscovery({...strong,author:{...strong.author,score:0.2}},now),false);
});

test("discovery quality rejects referral promotions and engagement spam",()=>{
  assert.equal(hasPromotionalSpam("Join me on FidCaster and get 250 bonus points from my referral link"),true);
  assert.equal(qualifiesForDiscovery({...strong,text:"Join me on FidCaster and get 250 bonus points from my referral link today."},now),false);
  assert.equal(qualifiesForDiscovery({...strong,text:"A real observation with enough context #one #two #three #four #five"},now),false);
  assert.equal(qualifiesForDiscovery({...strong,text:"A thoughtful analysis mentioning @one @two @three @four @five @six @seven"},now),false);
});

test("discussion of incentive design is not mistaken for a referral promotion",()=>{
  const analysis={...strong,text:"Airdrops often fail when incentives reward extraction instead of durable community participation."};
  assert.equal(qualifiesForDiscovery(analysis,now),true);
});

test("quality priority favors stronger authors without ignoring recency",()=>{
  const weak={...strong,author:{...strong.author,score:0.65,follower_count:12}};
  assert.ok(discoveryPriority(strong,now)>discoveryPriority(weak,now));
});
