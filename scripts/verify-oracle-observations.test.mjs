import assert from "node:assert/strict";
import test from "node:test";
import {verifyOracleObservations} from "./verify-oracle-observations.mjs";

const healthy = {observations: [{marketId: 2}], retryable: [], unavailable: [1], expired: [3], pending: 2, batchLimit: 8};

test("an unavailable cast is visible without blocking valid CRE observations", () => {
  assert.deepEqual(verifyOracleObservations(healthy), {ready: 1, unavailable: [1], expired: [3]});
  assert.deepEqual(verifyOracleObservations({...healthy, observations: [], pending: 1}), {ready: 0, unavailable: [1], expired: [3]});
});

test("retryable collection and size failures alert independently of DON execution", () => {
  assert.throws(() => verifyOracleObservations({...healthy, retryable: [4], pending: 3}), /need retry for markets 4/);
});

test("missing or overlapping status cannot pass monitoring", () => {
  assert.throws(() => verifyOracleObservations({observations: []}), /malformed/);
  assert.throws(() => verifyOracleObservations({...healthy, retryable: [2]}), /duplicate/);
  assert.throws(() => verifyOracleObservations({...healthy, expired: [0]}), /invalid/);
  assert.throws(() => verifyOracleObservations({...healthy, observations: []}), /omits a selected market/);
});
