import assert from "node:assert/strict";
import test from "node:test";
import {isSubmissionMarketWindow, needsOracleObservation, scoutConvictionWei} from "./live-markets";

test("scout conviction excludes protocol seed stake", () => {
  assert.equal(scoutConvictionWei("35000000000000000", "2000000000000000"), 33000000000000000n);
});

test("seed-only and malformed-under-seed totals never appear as conviction", () => {
  assert.equal(scoutConvictionWei("2000000000000000", "2000000000000000"), 0n);
  assert.equal(scoutConvictionWei("1000000000000000", "2000000000000000"), 0n);
});

test("the discovery feed excludes legacy windows longer than 24 hours", () => {
  assert.equal(isSubmissionMarketWindow(1_000, 1_000 + 86_400), true);
  assert.equal(isSubmissionMarketWindow(1_000, 1_000 + 86_460), true);
  assert.equal(isSubmissionMarketWindow(1_000, 1_000 + 86_461), false);
  assert.equal(isSubmissionMarketWindow(1_000, 999), false);
});

test("the oracle queue never resubmits an already recorded timeout", () => {
  assert.equal(needsOracleObservation("OPEN",900,undefined,1_000),true);
  assert.equal(needsOracleObservation("OPEN",900,"950",1_000),false);
  assert.equal(needsOracleObservation("PENDING",900,"950",1_000),false);
  assert.equal(needsOracleObservation("CHALLENGED",900,"950",1_000),true);
});
