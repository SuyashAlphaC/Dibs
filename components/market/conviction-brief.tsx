import Link from "next/link";
import {convictionDecision} from "@/lib/conviction-decision";
import type {ConvictionReport} from "@/lib/conviction-intelligence";

const short = (address: string) => `${address.slice(0, 6)}…${address.slice(-4)}`;
export function ConvictionBrief({report}: {report: ConvictionReport}) {
  const brief = convictionDecision(report), fixture = report.source === "fixture";
  const largest = [...report.backers].sort((a, b) => BigInt(a.spentWei) > BigInt(b.spentWei) ? -1 : BigInt(a.spentWei) < BigInt(b.spentWei) ? 1 : a.address.localeCompare(b.address))[0];
  return <section className="lens-brief" data-review-state={brief.state} aria-label="Conviction decision brief">
    <header><div><p className="eyebrow">Before you back this signal</p><h3>{brief.title}</h3></div><span className="data-chip">Evidence review · not a safety score</span></header>
    <p className="lens-brief-boundary">Envio measures conviction. Nansen adds observed connections. Neither wallet count nor an empty scan proves independent support.</p>
    {brief.groups.length > 0 && <div className="lens-groups"><p className="eyebrow">Connected stake · review together, not common owners</p>{brief.groups.map((group, index) => <article key={group.addresses.join(":")}><div><strong>Group {index + 1} · {group.addresses.length} backers</strong><b>{(group.shareBps / 100).toFixed(1)}% of scout conviction</b></div><div className="lens-group-bar" role="img" aria-label={`${(group.shareBps / 100).toFixed(1)} percent of scout conviction`}><span style={{width: `${group.shareBps / 100}%`}}/></div><p>{group.addresses.map((address, member) => <span key={address}>{member > 0 && " · "}{fixture ? short(address) : <Link href={`/scout/${address}`}>{short(address)}</Link>}</span>)}</p></article>)}</div>}
    <ol className="lens-review-steps">{brief.actions.map((action, index) => <li key={index}><span>{String(index + 1).padStart(2, "0")}</span><p>{action.text}</p>{action.kind === "ledger" ? !fixture && largest && <Link href={`/scout/${largest.address}`}>Review scout history →</Link> : <a href={`#lens-evidence-${report.marketId}`} onClick={() => {const evidence = document.getElementById(`lens-evidence-${report.marketId}`); if (evidence instanceof HTMLDetailsElement) evidence.open = true;}}>{action.kind === "transactions" ? "Inspect transaction evidence →" : "Inspect coverage →"}</a>}</li>)}</ol>
    {!brief.sharedCounterpartiesInspected && <small>This historical report checked direct relationships only. Run a fresh scan to inspect shared counterparties.</small>}
    <small>Deterministic evidence summary—not generated investment advice. Shared exchanges, contracts or services may connect unrelated people.</small>
  </section>;
}
