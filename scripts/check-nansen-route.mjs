import assert from "node:assert/strict";
import {createRequire} from "node:module";

// Exercise the actual production-built handlers without network access or real credentials.
const configured = process.argv.includes("--configured");
process.env.NANSEN_INTELLIGENCE_ENABLED = configured ? "true" : "false";
process.env.NANSEN_API_KEY = configured ? "route-test-not-a-real-key" : "";
let upstreamCalls = 0;
globalThis.fetch = async () => { upstreamCalls++; throw new Error("Unexpected upstream request"); };
const require = createRequire(import.meta.url);
const {GET, POST} = require("../.next/server/app/api/intelligence/market/[marketId]/route.js").routeModule.userland;
const context = {params: Promise.resolve({marketId: "32"})};
const status = await GET();
assert.equal(status.status, 200);
const configuration = await status.json();
assert.equal(configuration.enabled, configured);
assert.equal(configuration.configured, configured);
assert(!JSON.stringify(configuration).includes("route-test-not-a-real-key"));
const request = origin => new Request("https://dibs.test/api/intelligence/market/32", {method: "POST", headers: {origin, "content-type": "application/json"}, body: JSON.stringify({chain: "monad"})});
assert.equal((await POST(request("https://evil.test"), context)).status, 403);
assert.equal((await POST(request("https://dibs.test"), context)).status, configured ? 401 : 503);
assert.equal(upstreamCalls, 0);
console.log(`Production Nansen route: ${configured ? "configured/auth-required" : "disabled"} boundary passed; zero upstream calls.`);
