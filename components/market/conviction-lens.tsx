"use client";

import Link from "next/link";
import {useEffect, useReducer, useRef, useState} from "react";
import {formatEther} from "viem";
import {useIdentity} from "@/components/identity-provider";
import {NANSEN_CHAINS, type ConvictionReport, type IntelligenceChain} from "@/lib/conviction-intelligence";
import {scanReducer, scanRetryDeadline, scanSecondsRemaining, scanState} from "@/lib/conviction-scan";
import {ConvictionBrief} from "@/components/market/conviction-brief";
import {ageConvictionReport, convictionDecision} from "@/lib/conviction-decision";

const shorten = (value: string) => `${value.slice(0, 6)}…${value.slice(-4)}`;
const percent = (value: number) => `${(value / 100).toFixed(1)}%`;
const names = {monad: "Monad", base: "Base", ethereum: "Ethereum"};
const explorers = {monad: "https://monadexplorer.com/tx/", base: "https://basescan.org/tx/", ethereum: "https://etherscan.io/tx/"};
const statuses = {records: "Context returned", "no-records": "No records returned", unavailable: "Coverage unavailable", "not-queried": "Outside query sample"};

export function ConvictionLens({marketId, initialReport, historicalSnapshot = false, backerCount}: {marketId: string; initialReport?: ConvictionReport; historicalSnapshot?: boolean; backerCount?: number}) {
  const identity = useIdentity();
  const fixture = initialReport?.source === "fixture";
  const [state, dispatch] = useReducer(scanReducer, initialReport, scanState);
  const {chain, busy, error} = state;
  const retainedReport = state.reports[chain];
  const [clock, setClock] = useState(0);
  const report = retainedReport && !fixture && !historicalSnapshot ? ageConvictionReport(retainedReport, clock) : retainedReport;
  const cooldown = scanSecondsRemaining(state.retryAt, clock);
  const noBackers = backerCount === 0;
  const [availability, setAvailability] = useState<{enabled: boolean; configured: boolean} | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    if (fixture || historicalSnapshot) return;
    const controller = new AbortController();
    fetch(`/api/intelligence/market/${marketId}`, {signal: controller.signal}).then(response => {
      if (!response.ok) throw new Error("Unavailable");
      return response.json();
    }).then(setAvailability).catch(() => {if (!controller.signal.aborted) dispatch({type: "failure", error: "Nansen configuration status could not be loaded."});});
    return () => {controller.abort(); pending.current?.abort();};
  }, [marketId, fixture, historicalSnapshot]);
  useEffect(() => {
    if (!state.retryAt) return;
    const tick = () => setClock(Date.now());
    tick();
    const timer = setInterval(() => {tick(); if (Date.now() >= state.retryAt) clearInterval(timer);}, 1000);
    return () => clearInterval(timer);
  }, [state.retryAt]);
  useEffect(() => {
    if (!retainedReport || fixture || historicalSnapshot) return;
    const expiry = Math.min(...retainedReport.queries.flatMap(query => query.fetchedAt ? [Date.parse(query.fetchedAt) + 900000] : []).filter(expiry => expiry > clock));
    if (!Number.isFinite(expiry)) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.max(1, Math.min(900000, expiry - Date.now())));
    return () => clearTimeout(timer);
  }, [retainedReport, clock, fixture, historicalSnapshot]);

  async function scan() {
    if (!identity.authenticated) {identity.login(); return;}
    if (!identity.farcaster) {identity.linkFarcaster(); return;}
    if (busy || fixture || historicalSnapshot || noBackers || scanSecondsRemaining(state.retryAt, Date.now()) > 0) return;
    const controller = new AbortController(); pending.current = controller;
    dispatch({type: "start"});
    try {
      const token = await identity.getAccessToken();
      if (!token) throw new Error("A verified Privy session is required. Sign in again.");
      const response = await fetch(`/api/intelligence/market/${marketId}`, {method: "POST", headers: {"content-type": "application/json", authorization: `Bearer ${token}`}, body: JSON.stringify({chain}), signal: controller.signal});
      const payload = await response.json() as {report?: ConvictionReport; error?: string};
      if (controller.signal.aborted) return;
      const retryAt = scanRetryDeadline(response.headers.get("retry-after"), Date.now());
      setClock(Date.now());
      if (response.ok && payload.report?.version === 1 && payload.report.marketId === marketId && payload.report.chain === chain && payload.report.source === "nansen") dispatch({type: "result", report: payload.report, retryAt});
      else {
        const codes = payload.report?.queries.map(query => query.error).filter(Boolean).filter((value, index, all) => all.indexOf(value) === index).join(", ");
        dispatch({type: "failure", error: response.status === 429 ? "Scan cooldown protects API credits. No automatic retry will run." : payload.error ?? `Latest scan unavailable${codes ? `: ${codes}` : ""}. No wallet conclusions were inferred.`, ...(retryAt ? {retryAt} : {})});
      }
    } catch (failure) {
      if (!controller.signal.aborted) dispatch({type: "failure", error: failure instanceof Error ? failure.message : "Nansen is unavailable; no wallet conclusions were inferred."});
    }
  }

  function download() {
    if (!report) return;
    const blob = new Blob([JSON.stringify({...report, decisionBrief: convictionDecision(report), analysisVersion: "conviction-review-v2", attribution: "Powered by Nansen API", endpoint: "https://api.nansen.ai/api/v1/profiler/address/related-wallets", historicalSnapshot, captureMethod: fixture ? "synthetic-fixture" : historicalSnapshot ? "operator-cli" : "authenticated-ui"}, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob), anchor = document.createElement("a");
    anchor.href = url; anchor.download = `dibs-conviction-${report.marketId}-${report.chain}-${report.source}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }

  const nodes = report?.backers.slice(0, 12) ?? [];
  const points = new Map(nodes.map((node, index) => {
    const angle = index / nodes.length * Math.PI * 2 - Math.PI / 2;
    return [node.address, {x: 200 + Math.cos(angle) * 138, y: 170 + Math.sin(angle) * 120}];
  }));
  const available = availability?.configured && availability.enabled;
  const sharedPairs = [...new Map((report?.sharedCounterparties ?? []).flatMap(common => common.backers.slice(1).map(to => ({from: common.backers[0], to, via: common.address}))).map(link => [[link.from, link.to].sort().join(":"), link])).values()];
  return <section className="conviction-lens" id="conviction-lens" aria-labelledby={`lens-title-${marketId}`}>
    <header className="lens-heading"><div><p className="eyebrow">Context before conviction</p><h2 id={`lens-title-${marketId}`}>Look beyond the wallet count.</h2><p>Understand stake concentration and observed connections before you back the crowd.</p></div><a className="lens-attribution" href="https://nansen.ai/" target="_blank" rel="noreferrer">Powered by Nansen API ↗</a></header>
    {fixture && <p className="lens-fixture-label" role="note">Illustrative fixture · synthetic wallets and relationships · not a live Nansen response · not stakeable</p>}
    {historicalSnapshot && report && <p className="lens-empty" role="note">Recorded genuine API evidence · market #{report.marketId} · {names[report.chain]} context · captured {report.generatedAt}. This operator-captured historical snapshot is not a current scan or an authenticated user-flow proof. Zero records do not prove independent ownership.<Link href={`/market/${marketId}#conviction-lens`}>Open this market to run a fresh authenticated scan →</Link></p>}
    {!fixture && !historicalSnapshot && <div className="lens-toolbar"><label>Wallet context dataset<select value={chain} disabled={busy} onChange={event => dispatch({type: "select", chain: event.target.value as IntelligenceChain})}>{NANSEN_CHAINS.map(value => <option key={value} value={value}>{names[value]}</option>)}</select></label><button className="primary-button" disabled={busy || !identity.ready || !available || noBackers || cooldown > 0} onClick={scan}>{noBackers ? "Waiting for scout positions" : busy ? "Inspecting up to 8 backers…" : cooldown > 0 ? `Next scan in ${cooldown}s` : !identity.authenticated ? "Sign in to inspect conviction" : !identity.farcaster ? "Link Farcaster to inspect" : "Run Nansen conviction scan"}</button><small>No transaction or wallet signature. Up to 8 earliest backers; successful API results cached for 15 minutes. Selected dataset is external wallet context, not Monad testnet coverage.</small>{cooldown > 0 && <small role="status">Cooldown: {cooldown}s. Existing results stay visible; scans never retry automatically.</small>}</div>}
    <div aria-live="polite" aria-busy={busy}>{error && <p className="lens-error" role="alert">{error}</p>}{!fixture && availability && !available && <p className="lens-empty">Live Nansen scans are not configured on this deployment. No wallet intelligence is being inferred. <Link href="/intelligence">See the feature and its data boundaries →</Link></p>}{busy && <p className="lens-empty">Joining Envio’s scout positions with Nansen’s relationship evidence…</p>}</div>
    {noBackers && !report && <p className="lens-empty">No scout positions are indexed yet. There are no backing wallets to query; this market needs genuine scout participation first.</p>}
    {report ? <>
      {error && <p className="lens-retained" role="note">Showing the previous {names[report.chain]} result below. The failed attempt did not replace it; check its source timestamps.</p>}
      <ConvictionBrief report={report}/>
      <div className="lens-metrics"><div><span>Largest wallet’s conviction</span><strong>{percent(report.largestShareBps)}</strong><small>Envio stake · community seed excluded</small></div><div><span>Backers with observed connections</span><strong>{report.linkedBackers}</strong><small>{percent(report.linkedConvictionBps)} of scout stake</small></div><div><span>Successful context queries</span><strong>{report.coverage.succeeded}<em> / {report.coverage.total}</em></strong><small>{report.coverage.withRecords} returned records · {report.coverage.truncated} truncated · {report.coverage.stale} stale</small></div></div>
      <div className="lens-workspace">
        <div className="lens-map"><div className="lens-map-heading"><span>{fixture ? "Illustrative" : names[report.chain]} relationship map</span><span>{report.status === "ready" ? "Sample returned" : "Coverage incomplete"}</span></div>
          {nodes.length ? <svg viewBox="0 0 400 340" role="img" aria-label={`${report.linkedBackers} backers have observed Nansen connections. Solid lines are direct relationships; dashed lines share a counterparty, not a direct transfer or proven ownership.`}>
            <circle className="lens-orbit" cx="200" cy="170" r="128"/>
            {report.links.map((link, index) => {const from = points.get(link.from), to = points.get(link.to); return from && to ? <line className="lens-connection" key={`direct-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}><title>{link.relation}</title></line> : null;})}
            {sharedPairs.map((link, index) => {const from = points.get(link.from), to = points.get(link.to); return from && to ? <line className="lens-connection shared" key={`shared-${index}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y}><title>{`Shared counterparty ${link.via}; not a direct transfer between scouts`}</title></line> : null;})}
            <text x="200" y="162" className="lens-map-count" textAnchor="middle">{report.coverage.total}</text><text x="200" y="184" textAnchor="middle">indexed backers</text>
            {nodes.map((node, index) => {const point = points.get(node.address)!; const linked = report.links.some(link => link.from === node.address || link.to === node.address) || sharedPairs.some(link => link.from === node.address || link.to === node.address); return <g key={node.address} className={linked ? "lens-node linked" : "lens-node"}><circle cx={point.x} cy={point.y} r="19"/><text x={point.x} y={point.y + 4} textAnchor="middle">{index + 1}</text><text x={point.x} y={point.y + 36} textAnchor="middle">{percent(node.shareBps)}</text><title>{`${fixture ? `Example scout ${index + 1}` : node.address}: ${statuses[node.contextStatus]}`}</title></g>;})}
          </svg> : <p className="lens-empty">No scout positions are indexed yet.</p>}
          <p>Solid: direct relationships. Dashed: shared counterparty, not a direct scout-to-scout transfer. No line means unknown—not verified independence.{report.backers.length > 12 && " Map shows the first 12 backers; all findings remain in the report."}</p>
        </div>
        <div className="lens-findings"><p className="eyebrow">What this changes for your decision</p><h3>Read the crowd, not just its size.</h3><ul>{report.findings.map(finding => <li key={finding}>{finding}</li>)}</ul><div className="lens-boundary"><strong>Context is not a verdict.</strong><p>Ordinary transfers can connect genuine scouts. Nansen does not decide this market’s settlement, rewards or reputation.</p></div></div>
      </div>
      <details className="lens-evidence" id={`lens-evidence-${marketId}`}><summary>Inspect backers, relationship transactions and coverage</summary>
        <div className="lens-backer-list">{report.backers.map((backer, index) => <div key={backer.address}>{fixture ? <span>Example scout {index + 1}</span> : <Link href={`/scout/${backer.address}`}>{shorten(backer.address)}</Link>}<span>{Number(formatEther(BigInt(backer.spentWei))).toLocaleString(undefined, {maximumFractionDigits: 6})} MON · {percent(backer.shareBps)}</span><small>{statuses[backer.contextStatus]}</small></div>)}</div>
        {report.links.length ? <ul className="lens-transactions">{report.links.map((link, index) => <li key={index}><strong>{shorten(link.from)} ↔ {shorten(link.to)} · direct relationship</strong><span>{link.relation} · {new Date(link.timestamp).toLocaleDateString("en-US", {timeZone: "UTC"})}</span>{fixture ? <small>Synthetic transaction · no explorer proof</small> : <a href={`${explorers[link.chain]}${link.transactionHash}`} target="_blank" rel="noreferrer">Inspect relationship transaction ↗</a>}</li>)}</ul> : <p>No direct backer-to-backer relationship transactions were returned. Coverage limits still apply.</p>}
        {(report.sharedCounterparties?.length ?? 0) > 0 && <div className="lens-shared-evidence"><h4>Shared counterparties · indirect context</h4><p>Each backer has its own returned relationship to this address. This is not a direct transfer between backers or proof of common ownership.</p><ul className="lens-transactions">{report.sharedCounterparties!.slice(0, 12).map(common => <li key={common.address}><strong>{shorten(common.address)} · {common.backers.length} backers</strong>{common.proofs.map(proof => <div key={proof.from}><span>{shorten(proof.from)} · {proof.relation} · {proof.timestamp}</span>{fixture ? <small>Synthetic transaction · no explorer proof</small> : <a href={`${explorers[proof.chain]}${proof.transactionHash}`} target="_blank" rel="noreferrer">Inspect this backer’s source transaction ↗</a>}</div>)}</li>)}</ul>{report.sharedCounterparties!.length > 12 && <p>Showing 12 of {report.sharedCounterparties!.length} shared counterparties. All retained source proofs are in the evidence download.</p>}</div>}
        <ul className="lens-source-list">{report.queries.map(query => <li key={query.address}><span>{shorten(query.address)}</span><small>{query.fetchedAt ? `Fetched ${query.fetchedAt} · request ${query.requestId ?? "ID unavailable"}${query.truncated ? " · first page only" : ""}` : `Query unavailable: ${query.error}`}</small></li>)}</ul>
      </details>
      <footer className="lens-footer"><span>{fixture ? "Fixture report" : "Nansen + Envio derived report"} · generated {new Date(report.generatedAt).toLocaleString("en-US", {timeZone: "UTC"})} UTC</span><button className="secondary-button" onClick={download}>Download {fixture ? "fixture" : "evidence"} JSON ↓</button></footer>
    </> : !busy && available && !noBackers && <p className="lens-empty">Run a scan to replace assumptions about the crowd with sourced wallet context. No records, failures and truncated results remain explicit.</p>}
  </section>;
}
