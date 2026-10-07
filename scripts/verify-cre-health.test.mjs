import assert from "node:assert/strict";
import test from "node:test";
import {verifyCreHealth} from "./verify-cre-health.mjs";

const now = Date.parse("2026-10-07T16:10:00Z");
const success = {uuid: "execution-1", status: "SUCCESS", startedAt: "2026-10-07T16:08:01Z", finishedAt: "2026-10-07T16:08:45Z"};
const snapshot = {workflow: {status: "ACTIVE", workflowId: "abc"}, deployment: {deployedAt: "2026-10-07T16:04:25Z"}, lastExecution: {...success, errors: []}};

test("a recent successful run verifies health", () => {
  assert.equal(verifyCreHealth(snapshot, [success], now).status, "ready");
});
test("an active workflow with a failed run never passes", () => {
  assert.throws(() => verifyCreHealth({...snapshot, lastExecution: {...success, status: "FAILURE"}}, [success], now), /failed/);
});
test("healthy in-progress execution does not create a false alarm", () => {
  assert.equal(verifyCreHealth({...snapshot, lastExecution: {status: "IN_PROGRESS", startedAt: "2026-10-07T16:10:00Z"}}, [success], now).status, "ready");
});
test("a newer failed completion wins over an older success", () => {
  assert.throws(() => verifyCreHealth(snapshot, [success, {...success, status: "FAILURE", startedAt: "2026-10-07T16:09:01Z"}], now), /No recent/);
});
test("stalled execution and stale success fail monitoring", () => {
  assert.throws(() => verifyCreHealth({...snapshot, lastExecution: {status: "IN_PROGRESS", startedAt: "2026-10-07T16:00:00Z"}}, [success], now), /stalled/);
  assert.throws(() => verifyCreHealth(snapshot, [{...success, finishedAt: "2026-10-07T15:50:00Z"}], now), /No recent/);
});
test("old deployment success and execution errors cannot verify a new deployment", () => {
  assert.throws(() => verifyCreHealth(snapshot, [{...success, startedAt: "2026-10-07T16:00:00Z"}], now), /previous deployment/);
  assert.throws(() => verifyCreHealth({...snapshot, lastExecution: {...success, errors: [{}]}}, [success], now), /failed/);
});
