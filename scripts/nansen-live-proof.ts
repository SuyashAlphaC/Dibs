import {mkdir, writeFile} from "node:fs/promises";
import {resolve} from "node:path";
import {getMarketConviction} from "../lib/live-markets";
import {buildConvictionReport, intelligenceChain, MAX_INTELLIGENCE_BACKERS, NANSEN_RELATED_ENDPOINT, normalizeBackers, type WalletQuery} from "../lib/conviction-intelligence";
import {createNansenClient, NansenError} from "../lib/nansen-client";

// Explicit operator proof only: no cron, browser auth bypass, signing, or arbitrary wallets.
async function main() {
  const [marketId = "32", chainInput = "monad"] = process.argv.slice(2);
  const chain = intelligenceChain(chainInput);
  if (!/^\d{1,12}$/.test(marketId) || !chain || process.argv.length > 4) throw new Error("Use: npm run proof:nansen -- <indexed market ID> <monad|base|ethereum>");
  const key = process.env.NANSEN_API_KEY?.trim();
  if (!key || process.env.NANSEN_INTELLIGENCE_ENABLED !== "true") throw new Error("Configure server-only Nansen key and explicit enablement in .env");
  const indexed = await getMarketConviction(marketId);
  if (!indexed?.exists || !indexed.positions.length) throw new Error("No genuine indexed market backers available; no paid query was made");
  const selected = normalizeBackers(indexed.positions).slice(0, MAX_INTELLIGENCE_BACKERS);
  const client = createNansenClient({apiKey: key});
  const queries: WalletQuery[] = [];
  for (let offset = 0; offset < selected.length; offset += 2) {
    queries.push(...await Promise.all(selected.slice(offset, offset + 2).map(async position => {
      try {return {address: position.address, context: await client(position.address, chain)};}
      catch (error) {return {address: position.address, error: error instanceof NansenError ? error.code : "upstream-unavailable"};}
    })));
  }
  const report = buildConvictionReport({marketId, chain, positions: indexed.positions, queries});
  if (!report.coverage.succeeded) throw new Error(`No successful Nansen queries: ${[...new Set(queries.map(query => query.error))].join(", ")}`);
  const evidence = {...report, attribution: "Powered by Nansen API", endpoint: NANSEN_RELATED_ENDPOINT, captureMethod: "operator-cli", historicalSnapshot: true};
  const serialized = JSON.stringify(evidence, null, 2) + "\n";
  if (serialized.includes(key) || serialized.includes("address_label")) throw new Error("Public evidence redaction check failed");
  const directory = resolve("evidence/nansen");
  await mkdir(directory, {recursive: true});
  const file = resolve(directory, `market-${marketId}-${chain}-live.json`);
  // Each explicit run refreshes this one named historical artifact; never masquerades as live UI.
  await writeFile(file, serialized, {mode: 0o644});
  console.log(JSON.stringify({file, marketId, chain, captureMethod: "operator-cli", generatedAt: report.generatedAt, status: report.status, coverage: report.coverage, largestShareBps: report.largestShareBps, linkedBackers: report.linkedBackers, creditsUsed: report.queries.reduce((sum, query) => sum + (query.creditsUsed ?? 0), 0)}));
}

main().catch(error => {console.error(error instanceof Error ? error.message : "Nansen field verification failed"); process.exitCode = 1;});
