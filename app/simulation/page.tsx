import Link from "next/link";

const stages=[
  {index:"01",title:"Observation fetched",detail:"CRE HTTP capability fetched the deterministic observation envelope.",status:"Simulated"},
  {index:"02",title:"Identity quality applied",detail:"Three qualified interactions passed; two weak identities were rejected.",status:"Simulated"},
  {index:"03",title:"Growth calculated",detail:"5,000 closing points − 1,200 opening baseline = 3,800 weighted growth.",status:"Simulated"},
  {index:"04",title:"Monad report prepared",detail:"submitResult(2, 3800, evidenceHash) was encoded for the verified receiver.",status:"Dry run"},
  {index:"05",title:"Challenge re-observed",detail:"A claimed score of 8,000 is recomputed as 3,800; CRE prepares resolveChallenge with upheld=true.",status:"Simulated"},
  {index:"06",title:"Allocation and claims",detail:"Reward caps, proportional scout allocation, and one-time claims pass Foundry tests.",status:"Contract-tested"},
];

export default function SimulationEvidencePage(){
  return <div className="simulation-page">
    <div className="market-command"><Link className="back-link" href="/activity">← Back to activity</Link><span className="status-pill challenged">Explicit simulation</span><strong>Judge evidence</strong></div>
    <section className="simulation-hero"><div><p className="eyebrow">Chainlink CRE · reproducible dry run</p><h1>Quality decides<br/><em>what conviction earns.</em></h1><p>This page documents a deterministic CRE simulation. It does not claim that a production workflow report was broadcast.</p></div><div className="simulation-score"><span>Quality-weighted growth</span><strong>+3,800</strong><small>3 accepted · 2 rejected</small></div></section>
    <section className="simulation-grid" aria-label="CRE simulation stages">{stages.map(stage=><article key={stage.index}><i>{stage.index}</i><div><span>{stage.status}</span><h2>{stage.title}</h2><p>{stage.detail}</p></div></article>)}</section>
    <section className="simulation-proof"><div><p className="eyebrow">Reproduction</p><h2>Evidence, not theatre.</h2><p>The workflow uses identical-consensus aggregation, deterministic sorting, a chain-bound receiver payload, and a dry-run configuration that cannot submit.</p></div><dl><div><dt>Market</dt><dd>#2</dd></div><div><dt>Chain</dt><dd>Monad testnet · 10143</dd></div><div><dt>Receiver</dt><dd>0x78B8…9A81</dd></div><div><dt>Result</dt><dd>prepared-dry-run</dd></div></dl></section>
    <section className="simulation-proof simulation-challenge-proof"><div><p className="eyebrow">Optimistic challenge proof</p><h2>Manipulation gets a second look.</h2><p>Market #3 enters with a reported score of 8,000. The same deterministic quality gate recomputes 3,800, rejects two weak identities, and prepares an upheld challenge that refunds the scout&apos;s bond.</p></div><dl><div><dt>Reported</dt><dd>8,000</dd></div><div><dt>Verified</dt><dd>3,800</dd></div><div><dt>Decision</dt><dd>Upheld</dd></div><div><dt>Calldata</dt><dd>resolveChallenge</dd></div></dl></section>
    <section className="simulation-actions"><a className="secondary-button" href="/api/oracle/simulation-fixture" target="_blank" rel="noreferrer">Inspect public fixture ↗</a><a className="primary-button" href="https://github.com/SuyashAlphaC/Dibs/blob/main/oracle/SIMULATION_EVIDENCE.md" target="_blank" rel="noreferrer">Reproduce the simulation ↗</a></section>
  </div>;
}
