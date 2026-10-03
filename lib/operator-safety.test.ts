import assert from "node:assert/strict";
import test from "node:test";
import {parseEther} from "viem";
import {assertOperatorBalanceFloor,assertOperatorCanSpend,marketAutomationPolicy} from "./operator-safety";

test("market automation is fail-closed and unfunded by default",()=>{
  const policy=marketAutomationPolicy({});
  assert.equal(policy.automationEnabled,false);
  assert.equal(policy.openingEnabled,false);
  assert.equal(policy.publicNominationsEnabled,false);
  assert.equal(policy.epochSeed,0n);
});

test("epoch funding cannot exceed the configured cap",()=>{
  assert.throws(()=>marketAutomationPolicy({MARKET_EPOCH_SEED_MON:"0.06",MARKET_MAX_EPOCH_SEED_MON:"0.05"}),/exceeds/);
});

test("operator balance retains the configured floor after seeding",()=>{
  const policy=marketAutomationPolicy({MARKET_EPOCH_SEED_MON:"0.02",MARKET_MIN_OPERATOR_BALANCE_MON:"0.5"});
  assert.doesNotThrow(()=>assertOperatorCanSpend(parseEther("0.52"),policy));
  assert.throws(()=>assertOperatorCanSpend(parseEther("0.519"),policy),/balance guard/);
});

test("every automated transaction respects the retained balance floor",()=>{
  const policy=marketAutomationPolicy({MARKET_MIN_OPERATOR_BALANCE_MON:"0.5"});
  assert.doesNotThrow(()=>assertOperatorBalanceFloor(parseEther("0.5001"),policy));
  assert.throws(()=>assertOperatorBalanceFloor(parseEther("0.5"),policy),/retained balance floor/);
});

test("market and epoch caps reject unsafe values",()=>{
  assert.throws(()=>marketAutomationPolicy({MAX_MARKETS_PER_RUN:"100"}),/between 1 and 10/);
  assert.throws(()=>marketAutomationPolicy({PUBLIC_NOMINATION_MARKET_CAP:"0"}),/between 1 and 50/);
  assert.throws(()=>marketAutomationPolicy({MAX_MAINTENANCE_TRANSACTIONS_PER_RUN:"21"}),/between 1 and 20/);
});
