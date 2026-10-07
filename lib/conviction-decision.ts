import type {ConvictionReport} from "./conviction-intelligence";

/** Retained live reports age while on screen; timestamps are never refreshed by presentation. */
export function ageConvictionReport(report: ConvictionReport, now: number): ConvictionReport {
  const stale = report.queries.filter(query => query.fetchedAt && now - Date.parse(query.fetchedAt) >= 900000).length;
  if (stale <= report.coverage.stale) return report;
  return {...report, status: report.status === "ready" ? "partial" : report.status, coverage: {...report.coverage, stale}};
}

/** An evidence review brief, never an ownership classification or stake recommendation. */
export function convictionDecision(report: ConvictionReport) {
  const byAddress = new Map(report.backers.map(backer => [backer.address, backer]));
  const neighbors = new Map(report.backers.map(backer => [backer.address, new Set<string>()]));
  const join = (a: string, b: string) => {
    if (a === b || !neighbors.has(a) || !neighbors.has(b)) return;
    neighbors.get(a)!.add(b); neighbors.get(b)!.add(a);
  };
  for (const link of report.links) join(link.from, link.to);
  for (const common of report.sharedCounterparties ?? []) for (const backer of common.backers.slice(1)) join(common.backers[0], backer);
  const visited = new Set<string>();
  const groups: Array<{addresses: string[]; spentWei: string; shareBps: number}> = [];
  const total = BigInt(report.totalConvictionWei);
  for (const backer of report.backers) {
    if (visited.has(backer.address)) continue;
    const pending = [backer.address], addresses: string[] = [];
    while (pending.length) {
      const address = pending.pop()!;
      if (visited.has(address)) continue;
      visited.add(address); addresses.push(address);
      pending.push(...neighbors.get(address)!);
    }
    if (addresses.length < 2) continue;
    addresses.sort();
    const spent = addresses.reduce((sum, address) => sum + BigInt(byAddress.get(address)!.spentWei), 0n);
    groups.push({addresses, spentWei: spent.toString(), shareBps: total ? Number(spent * 10_000n / total) : 0});
  }
  groups.sort((a, b) => BigInt(a.spentWei) > BigInt(b.spentWei) ? -1 : BigInt(a.spentWei) < BigInt(b.spentWei) ? 1 : a.addresses[0].localeCompare(b.addresses[0]));
  const coverageGap = report.status !== "ready" || report.coverage.succeeded < report.coverage.total || report.coverage.truncated > 0 || report.coverage.stale > 0;
  const state = !report.backers.length ? "awaiting-backers" : groups.length || report.largestShareBps >= 5000 ? "review-evidence" : coverageGap ? "coverage-gap" : "no-overlap-returned";
  const title = {"awaiting-backers": "No crowd to inspect yet", "review-evidence": "Review the backing pattern", "coverage-gap": "The picture is incomplete", "no-overlap-returned": "No overlap returned—not verified independence"}[state];
  const actions: Array<{kind: "transactions" | "coverage" | "ledger"; text: string}> = [];
  if (groups.length) actions.push({kind: "transactions", text: `Inspect ${groups.length} observed connected group${groups.length === 1 ? "" : "s"} before counting wallets as separate signals. Ordinary services can connect unrelated people.`});
  if (report.largestShareBps >= 5000 && report.backers.length) actions.push({kind: "ledger", text: `One wallet supplies ${(report.largestShareBps / 100).toFixed(1)}% of conviction. Review its scout history rather than relying on the headline wallet count.`});
  if (coverageGap && report.backers.length) actions.push({kind: "coverage", text: `Check coverage: ${report.coverage.succeeded}/${report.coverage.total} successful queries, ${report.coverage.truncated} truncated and ${report.coverage.stale} stale. Missing evidence stays unknown.`});
  if (!groups.length && report.coverage.succeeded) actions.push({kind: "coverage", text: report.coverage.withRecords ? "No overlap was found in the sampled records. Review source timestamps and sampling limits; separate ownership was not established." : "No relationship records were returned. Inspect another dataset only if these same wallets have activity there; do not read this as a safety score."});
  if (!report.backers.length) actions.push({kind: "ledger", text: "Wait for genuine indexed scout positions. No Nansen wallet queries are needed for an empty market."});
  return {state, title, groups, actions, sharedCounterpartiesInspected: report.sharedCounterparties !== undefined};
}
