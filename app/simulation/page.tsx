import Link from "next/link";

const donMode=process.env.NEXT_PUBLIC_CRE_SETTLEMENT_MODE==="don";
const workflowId=process.env.CRE_WORKFLOW_ID||"0087c79221932bb3a2dbee759ffd89a1325e58db7ba736b6abaca52e20128552";
const stages=donMode?[
  {index:"01",title:"Production observations fetched",detail:"The active CRE workflow reads closed markets and genuine Neynar interactions from the production observation endpoint.",status:"DON live"},
  {index:"02",title:"Identity quality applied",detail:"Every workflow execution applies the deterministic account-age and Neynar-quality gates before growth is counted.",status:"Consensus"},
  {index:"03",title:"Growth calculated",detail:"Quality-qualified closing engagement is compared with the versioned opening baseline and evidence is hashed.",status:"Deterministic"},
  {index:"04",title:"Monad report submitted",detail:"The Chainlink DON produces a signed report and the Keystone Forwarder delivers it to the pinned Dibs receiver.",status:"Onchain"},
  {index:"05",title:"Receiver guard verified",detail:`The receiver accepts only workflow ${workflowId.slice(0,10)}…${workflowId.slice(-6)} and the Dibs settlement allowlist.`,status:"Pinned"},
  {index:"06",title:"Challenge and finalization",detail:"The protocol opens its challenge window, finalizes the epoch, and makes eligible scout rewards claimable.",status:"Live path"},
]:[
  {index:"01",title:"Production observations fetched",detail:"CRE HTTP capability reads closed markets and genuine Neynar interactions from the production observation endpoint.",status:"Live data"},
  {index:"02",title:"Identity quality applied",detail:"Account age and Neynar quality thresholds reject low-credibility engagement before growth is counted.",status:"Deterministic"},
  {index:"03",title:"Growth calculated",detail:"Quality-qualified closing engagement is compared with the versioned opening baseline.",status:"Deterministic"},
  {index:"04",title:"Monad report broadcast",detail:"Markets 12–14 were submitted through CRE simulate --broadcast and confirmed on Monad testnet.",status:"Broadcast"},
  {index:"05",title:"Oracle restored",detail:"The guarded runner restores the production receiver after every success, failure, or interruption.",status:"Verified"},
  {index:"06",title:"DON boundary disclosed",detail:"The exact workflow awaits Chainlink deployment access; no interface labels simulation-broadcast as DON execution.",status:"Pending access"},
];

export default function SimulationEvidencePage(){
  if(donMode)return <div className="simulation-page">
    <div className="market-command"><Link className="back-link" href="/evidence">← Back to live evidence</Link><span className="status-pill verified">Chainlink DON</span><strong>Production workflow</strong></div>
    <section className="simulation-hero"><div><p className="eyebrow">Chainlink CRE · decentralized execution</p><h1>Quality decides<br/><em>what conviction earns.</em></h1><p>The settlement workflow is deployed and active on the Chainlink DON. Independent DON nodes fetch, score, reach consensus, and deliver the authenticated report to Monad.</p></div><div className="simulation-score"><span>Workflow status</span><strong>LIVE</strong><small>{workflowId.slice(0,10)}…{workflowId.slice(-6)}</small></div></section>
    <section className="simulation-grid" aria-label="CRE production stages">{stages.map(stage=><article key={stage.index}><i>{stage.index}</i><div><span>{stage.status}</span><h2>{stage.title}</h2><p>{stage.detail}</p></div></article>)}</section>
    <section className="simulation-proof"><div><p className="eyebrow">Authenticated production path</p><h2>Consensus, then settlement.</h2><p>The app no longer invokes the local broadcast simulator for settlement. The DON owns execution; the Monad receiver verifies the Keystone Forwarder and pinned workflow ID before forwarding only approved settlement calls.</p></div><dl><div><dt>Workflow</dt><dd>{workflowId.slice(0,10)}…</dd></div><div><dt>Chain</dt><dd>Monad testnet · 10143</dd></div><div><dt>Mode</dt><dd>Chainlink DON</dd></div><div><dt>Receiver</dt><dd>Keystone pinned</dd></div></dl></section>
    <section className="simulation-actions"><a className="secondary-button" href="/api/health" target="_blank" rel="noreferrer">Inspect live health ↗</a><a className="primary-button" href="https://app.chain.link/cre/discover" target="_blank" rel="noreferrer">Open CRE monitor ↗</a></section>
  </div>;
  return <div className="simulation-page">
    <div className="market-command"><Link className="back-link" href="/evidence">← Back to live evidence</Link><span className="status-pill challenged">Simulation-broadcast</span><strong>Judge evidence</strong></div>
    <section className="simulation-hero"><div><p className="eyebrow">Chainlink CRE · honest execution boundary</p><h1>Quality decides<br/><em>what conviction earns.</em></h1><p>The workflow has processed real production observations and broadcast confirmed Monad testnet writes through the isolated simulation receiver. Chainlink DON deployment remains pending access.</p></div><div className="simulation-score"><span>Confirmed live scores</span><strong>3</strong><small>Markets 12 · 13 · 14</small></div></section>
    <section className="simulation-grid" aria-label="CRE simulation stages">{stages.map(stage=><article key={stage.index}><i>{stage.index}</i><div><span>{stage.status}</span><h2>{stage.title}</h2><p>{stage.detail}</p></div></article>)}</section>
    <section className="simulation-proof"><div><p className="eyebrow">Production-path reproduction</p><h2>Evidence, not theatre.</h2><p>The guarded runner checks ownership, receiver wiring, deadlines and the observation queue before temporarily routing reports through an isolated simulation receiver. It restores the production receiver on exit.</p></div><dl><div><dt>Markets</dt><dd>#12–14</dd></div><div><dt>Chain</dt><dd>Monad testnet · 10143</dd></div><div><dt>Mode</dt><dd>simulate --broadcast</dd></div><div><dt>Receipts</dt><dd>3 confirmed</dd></div></dl></section>
    <section className="simulation-proof simulation-challenge-proof"><div><p className="eyebrow">Optimistic challenge proof</p><h2>Manipulation gets a second look.</h2><p>Market #3 enters with a reported score of 8,000. The same deterministic quality gate recomputes 3,800, rejects two weak identities, and prepares an upheld challenge that refunds the scout&apos;s bond.</p></div><dl><div><dt>Reported</dt><dd>8,000</dd></div><div><dt>Verified</dt><dd>3,800</dd></div><div><dt>Decision</dt><dd>Upheld</dd></div><div><dt>Calldata</dt><dd>resolveChallenge</dd></div></dl></section>
    <section className="simulation-actions"><a className="secondary-button" href="/api/oracle/simulation-fixture" target="_blank" rel="noreferrer">Inspect labelled fixture ↗</a><a className="primary-button" href="https://github.com/SuyashAlphaC/Dibs/tree/main/evidence/live-market-12" target="_blank" rel="noreferrer">Inspect broadcast evidence ↗</a></section>
  </div>;
}
