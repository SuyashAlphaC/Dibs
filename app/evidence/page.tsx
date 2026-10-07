import type {Metadata} from "next";
import Link from "next/link";
import {getEvidenceSnapshot,type EvidenceState} from "@/lib/evidence";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Live Evidence",description:"Verifiable Monad, Envio, Farcaster and Chainlink CRE evidence for Dibs."};

const stateLabel:Record<EvidenceState,string>={verified:"Verified",partial:"Partial",pending:"Pending field proof"};
const contract="0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84";
const deploymentTx="0x6ebeb478e4d248bddd9405c91d76b97ccd3a278bc6fc74dfffb823e8e417e113";
const stakeTx="0x7d9a7df64dbc0a24f4127dad8e8b6d93eb00c946fc8ce5f865b4547bdbda7eb0";
const donSettlementTx="0x8d0fa1b3d862e896c8fe161b22928a64089ae96adb8281fde03fd588306b5fd4";
const positiveDonSettlementTx="0xeee2341f26b475d0c1f44a69625d4f6b640326b357313ca132e85aa7cece887a";
const explorer="https://testnet.monadexplorer.com";

export default async function EvidencePage(){
  const snapshot=await getEvidenceSnapshot();
  const verified=snapshot.checks.filter(check=>check.state==="verified").length;
  return <div className="evidence-page">
    <header className="evidence-hero"><div><p className="eyebrow">Judge verification desk</p><h1>Proof over promises.</h1><p>Every row separates production evidence, simulation evidence, and work that still needs an independent user. This page never upgrades a fixture into a live claim.</p></div><div className="evidence-score"><span>Acceptance checks</span><strong>{verified}/{snapshot.checks.length}</strong><small>Updated {new Date(snapshot.generatedAt).toLocaleString("en-IN",{timeZone:"Asia/Kolkata"})} IST</small></div></header>
    <section className="evidence-metrics" aria-label="Live evidence metrics"><div><span>Indexed markets</span><strong>{snapshot.metrics.markets}</strong></div><div><span>Unique scouts</span><strong>{snapshot.metrics.scouts}</strong></div><div><span>Resolved FIDs</span><strong>{snapshot.metrics.resolvedIdentities}</strong></div><div><span>Positive results</span><strong>{snapshot.metrics.positiveSettlements}</strong></div><div><span>Rewards claimed</span><strong>{snapshot.metrics.claimedMon.toFixed(3)} MON</strong></div></section>
    <section className="evidence-ledger" aria-labelledby="evidence-ledger-title"><header><div><p className="eyebrow">Live acceptance ledger</p><h2 id="evidence-ledger-title">What the deployment proves now</h2></div><span>{snapshot.mode}</span></header>{snapshot.checks.map(check=><article key={check.id}><i className={check.state}/><div><strong>{check.title}</strong><p>{check.detail}</p></div><b className={check.state}>{stateLabel[check.state]}</b>{check.href&&<Link href={check.href}>Inspect →</Link>}</article>)}</section>
    <section className="evidence-links"><div><p className="eyebrow">Public artifacts</p><h2>Reproduce the system.</h2><p>The active Chainlink DON delivers authenticated reports through the official Keystone Forwarder. Privy carries scouts from familiar identity to user-confirmed Monad transactions, with its client and server boundaries disclosed separately.</p></div><dl><div><dt>Dibs contract</dt><dd><a href={`${explorer}/address/${contract}`} target="_blank" rel="noreferrer">{contract.slice(0,10)}…{contract.slice(-6)} ↗</a></dd></div><div><dt>Deployment</dt><dd><a href={`${explorer}/tx/${deploymentTx}`} target="_blank" rel="noreferrer">Open transaction ↗</a></dd></div><div><dt>Indexed scout call</dt><dd><a href={`${explorer}/tx/${stakeTx}`} target="_blank" rel="noreferrer">Open transaction ↗</a></dd></div><div><dt>Privy integration</dt><dd><Link href="/privy">Identity-to-action proof →</Link></dd></div><div><dt>DON settlement · market 32</dt><dd><a href={`${explorer}/tx/${donSettlementTx}`} target="_blank" rel="noreferrer">Open transaction ↗</a></dd></div><div><dt>Positive DON result · market 33</dt><dd><a href={`${explorer}/tx/${positiveDonSettlementTx}`} target="_blank" rel="noreferrer">Open transaction ↗</a></dd></div><div><dt>Machine-readable status</dt><dd><a href="/api/evidence" target="_blank" rel="noreferrer">/api/evidence ↗</a></dd></div><div><dt>Integration health</dt><dd><a href="/api/health" target="_blank" rel="noreferrer">/api/health ↗</a></dd></div><div><dt>Source</dt><dd><a href="https://github.com/SuyashAlphaC/Dibs" target="_blank" rel="noreferrer">GitHub repository ↗</a></dd></div></dl></section>
  </div>;
}
