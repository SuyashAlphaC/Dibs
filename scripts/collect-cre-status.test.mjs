import assert from "node:assert/strict";
import {mkdtemp, readFile, rm, writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import test from "node:test";
import {collectCreStatus} from "./collect-cre-status.mjs";
import {verifyCreHealth} from "./verify-cre-health.mjs";

const success = {uuid: "current", status: "SUCCESS", startedAt: "2026-10-09T06:00:03Z", finishedAt: "2026-10-09T06:00:11Z"};
const snapshot = {workflow: {status: "ACTIVE", workflowId: "abc"}, deployment: {deployedAt: "2026-10-07T16:04:25Z"}, lastExecution: {...success, errors: []}};
const response = value => ({stdout: JSON.stringify(value)});
async function directory(t) {
  const path = await mkdtemp(join(tmpdir(), "dibs-monitor-test-"));
  t.after(() => rm(path, {recursive: true, force: true}));
  return path;
}

test("transient credential rejection retries and saves usable fresh evidence", async t => {
  const outputDir = await directory(t);
  let statusCalls = 0;
  const waits = [];
  await collectCreStatus({outputDir, log: () => {}, wait: async ms => waits.push(ms), run: async args => {
    if (args[0] === "execution") return response([success]);
    if (++statusCalls === 1) throw new Error("credential validation failed");
    return response(snapshot);
  }});
  assert.equal(statusCalls, 2);
  assert.deepEqual(waits, [2000]);
  const saved = JSON.parse(await readFile(join(outputDir, "cre-don-status.json"), "utf8"));
  const history = JSON.parse(await readFile(join(outputDir, "cre-don-executions.json"), "utf8"));
  assert.equal(verifyCreHealth(saved, history, Date.parse("2026-10-09T06:01:59Z")).status, "ready");
});

test("empty, malformed and wrong-shape status cannot become evidence", async t => {
  const outputDir = await directory(t);
  const attempts = [{stdout: "\n\n"}, {stdout: "{incomplete"}, response({}), response(snapshot)];
  const waits = [];
  await collectCreStatus({outputDir, log: () => {}, wait: async ms => waits.push(ms), run: async args => args[0] === "workflow" ? attempts.shift() : response([success])});
  assert.equal(attempts.length, 0);
  assert.deepEqual(waits, [2000, 4000, 8000]);
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, "cre-don-status.json"), "utf8")), snapshot);
});

test("execution-list failures also retry before evidence is saved", async t => {
  const outputDir = await directory(t);
  let calls = 0;
  await collectCreStatus({outputDir, log: () => {}, wait: async () => {}, run: async args => {
    if (args[0] === "workflow") return response(snapshot);
    return ++calls === 1 ? response({error: "unavailable"}) : response([success]);
  }});
  assert.equal(calls, 2);
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, "cre-don-executions.json"), "utf8")), [success]);
});

test("persistent auth failure fails closed, removes stale evidence and retains the successful history", async t => {
  const outputDir = await directory(t);
  await writeFile(join(outputDir, "cre-don-status.json"), JSON.stringify(snapshot));
  let attempts = 0;
  const logs = [];
  await assert.rejects(collectCreStatus({outputDir, log: line => logs.push(line), wait: async () => {}, run: async args => {
    if (args[0] === "execution") return response([success]);
    attempts++;
    throw new Error("authentication failed: PRIVATE-CREDENTIAL");
  }}), /monitoring data unavailable after bounded retries/);
  assert.equal(attempts, 4);
  assert.equal(logs.join("\n").includes("PRIVATE-CREDENTIAL"), false);
  await assert.rejects(readFile(join(outputDir, "cre-don-status.json")), {code: "ENOENT"});
  assert.deepEqual(JSON.parse(await readFile(join(outputDir, "cre-don-executions.json"), "utf8")), [success]);
});

test("a valid failed DON execution is preserved and rejected without retries", async t => {
  const outputDir = await directory(t);
  const failed = {...success, status: "FAILURE"};
  const bad = {...snapshot, lastExecution: {...failed, errors: ["execution error"]}};
  await collectCreStatus({outputDir, wait: async () => assert.fail("Do not retry genuine DON failures"), run: async args => response(args[0] === "workflow" ? bad : [failed])});
  const saved = JSON.parse(await readFile(join(outputDir, "cre-don-status.json"), "utf8"));
  assert.throws(() => verifyCreHealth(saved, [failed]), /Latest DON execution failed/);
});
