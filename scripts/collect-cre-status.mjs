import {execFile} from "node:child_process";
import {mkdir, rm, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {promisify} from "node:util";
import {setTimeout as delay} from "node:timers/promises";

const root = fileURLToPath(new URL("../", import.meta.url));
const execute = promisify(execFile);
const runCre = args => execute("cre", args, {cwd: resolve(root, "oracle"), timeout: 45_000, maxBuffer: 2 * 1024 * 1024});
const requests = [
  {
    label: "workflow status", file: "cre-don-status.json",
    args: ["workflow", "get", ".", "--target", "staging-settings", "--json"],
    valid: value => value && typeof value.workflow?.workflowId === "string" && typeof value.workflow?.status === "string",
  },
  {
    label: "execution history", file: "cre-don-executions.json",
    args: ["execution", "list", "dibs-settlement-testnet", "--limit", "5", "--output", "json"],
    valid: value => Array.isArray(value) && value.every(item => item && typeof item.status === "string"),
  },
];

// Retry collection failures only. A valid FAILURE/PAUSED response must reach the health verifier.
export async function collectCreStatus({outputDir = root, run = runCre, wait = delay, log = console.warn} = {}) {
  await mkdir(outputDir, {recursive: true});
  // Never let a previous invocation's evidence satisfy this check.
  for (const request of requests) await rm(resolve(outputDir, request.file), {force: true});
  const failures = [];
  for (const request of requests) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      let value;
      let reason;
      try {
        const {stdout} = await run(request.args);
        try { value = JSON.parse(stdout); } catch { reason = "empty or invalid JSON"; }
        if (!reason && !request.valid(value)) reason = "unexpected response structure";
      } catch (error) {
        // Keep provider diagnostics/credentials out of logs and uploaded evidence.
        const diagnostic = `${error.stderr ?? ""} ${error.message ?? ""}`;
        reason = /credential|authentication|unauthorized/i.test(diagnostic)
          ? "CRE credential validation unavailable or rejected"
          : "CRE command failed or timed out";
      }
      if (!reason) {
        await writeFile(resolve(outputDir, request.file), JSON.stringify(value, null, 2) + "\n");
        break;
      }
      log(`CRE ${request.label}: attempt ${attempt}/4: ${reason}.`);
      if (attempt === 4) failures.push(`${request.label}: ${reason}`);
      else await wait(2000 * 2 ** (attempt - 1));
    }
  }
  if (failures.length) {
    throw new Error(`CRE monitoring data unavailable after bounded retries (${failures.join("; ")}). Settlement health could not be verified. Check CRE service availability and the GitHub CRE_API_KEY secret if this persists.`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await collectCreStatus({outputDir: process.argv[2] ? resolve(process.argv[2]) : root});
    console.log("Fresh CRE status and execution history collected.");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
