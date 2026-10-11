import {readFileSync} from "node:fs";
import {pathToFileURL} from "node:url";

export function verifyOracleObservations(payload) {
  if (!payload || !Array.isArray(payload.observations) || !Array.isArray(payload.retryable)
      || !Array.isArray(payload.unavailable) || !Array.isArray(payload.expired)
      || !Number.isSafeInteger(payload.pending) || payload.pending < 0
      || !Number.isSafeInteger(payload.batchLimit) || payload.batchLimit < 1) {
    throw new Error("Oracle observation status is malformed or unavailable");
  }
  const ids = [...payload.observations.map(item => item?.marketId), ...payload.retryable,
    ...payload.unavailable, ...payload.expired];
  if (ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) {
    throw new Error("Oracle observation status contains invalid or duplicate market IDs");
  }
  if (payload.observations.length + payload.retryable.length + payload.unavailable.length
      !== Math.min(payload.pending, payload.batchLimit)) {
    throw new Error("Oracle observation status omits a selected market");
  }
  if (payload.retryable.length) throw new Error(`Oracle observations need retry for markets ${payload.retryable.join(",")}`);
  return {ready: payload.observations.length, unavailable: payload.unavailable, expired: payload.expired};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(verifyOracleObservations(JSON.parse(readFileSync(process.argv[2], "utf8")))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
