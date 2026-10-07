import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

export function verifyCreHealth(snapshot, executions, now = Date.now()) {
  const fresh = (value, maxAge) => {
    const age = now - Date.parse(value);
    return Number.isFinite(age) && age >= 0 && age < maxAge;
  };
  if (snapshot.workflow?.status !== "ACTIVE" || !snapshot.workflow?.workflowId) throw new Error("DON workflow is not active");
  const latest = snapshot.lastExecution;
  if (!latest || (latest.errors ?? []).length || latest.status === "FAILURE") throw new Error("Latest DON execution failed or is unavailable");
  if (latest.status !== "SUCCESS" && !(["IN_PROGRESS", "TRIGGERED"].includes(latest.status) && fresh(latest.startedAt, 300_000))) throw new Error("Latest DON execution is stalled");
  const completed = executions.filter(execution => ["SUCCESS", "FAILURE"].includes(execution.status))
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  if (!completed || completed.status !== "SUCCESS" || !fresh(completed.finishedAt, 600_000)) throw new Error("No recent successful completed DON execution");
  if (Date.parse(completed.startedAt) < Date.parse(snapshot.deployment?.deployedAt)) throw new Error("Success belongs to a previous deployment");
  return {workflowId: snapshot.workflow.workflowId, executionId: completed.uuid, status: "ready"};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(verifyCreHealth(JSON.parse(readFileSync(process.argv[2], "utf8")), JSON.parse(readFileSync(process.argv[3], "utf8")))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
