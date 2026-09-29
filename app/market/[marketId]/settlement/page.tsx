import Link from "next/link";
import {notFound} from "next/navigation";
import {Avatar} from "@/components/shared/avatar";
import {findMarket} from "@/lib/mock/markets";
import {getLiveMarket} from "@/lib/live-markets";
import {LifecycleActions} from "@/components/market/lifecycle-actions";
import {scoreBarWidth,settlementMetrics} from "@/lib/settlement";
import {SettlementReveal} from "@/components/market/settlement-reveal";

export default async function SettlementPage({params}:{params:Promise<{marketId:string}>}){
  const {marketId}=await params;const market=(await getLiveMarket(marketId))??findMarket(marketId);if(!market)notFound();
  const settled=market.status==="settled";
  const qualityScore=market.settlementScore??0;
  const metrics=settlementMetrics(market);
  const settlementMode=process.env.NEXT_PUBLIC_CRE_SETTLEMENT_MODE==="don"?"CRE DON report":"CRE simulation broadcast · Monad write";
  return <div className="settlement-page">
    <div className="market-command"><Link className="back-link" href={`/market/${market.id}`}>← Back to market</Link><span className={`status-pill ${settled?"settled":"open"}`}>{settled?"settled onchain":"settlement pending"}</span><strong>Market #{market.id}</strong></div>
    <section className={`settlement-hero ${settled?"is-settled":"is-pending"}`}><span className="settled-seal">{settled?"✓":"◷"}</span><div><p className="eyebrow">{settled?"Verified market outcome":"Quality window in progress"}</p><h1>{settled?<>A real signal,<br/><em>recognized early.</em></>:<>Conviction is recorded.<br/><em>Quality decides the outcome.</em></>}</h1><p>{settled?"The Chainlink CRE report was verified by the contract and the indexed outcome is ready for review.":"The market remains open while the protocol observes qualified engagement. No outcome is shown before the onchain report arrives."}</p></div></section>
    <section className="settled-cast"><Avatar name={market.author.displayName} src={market.author.avatarUrl} size={44}/><div><span>Origin cast · @{market.author.username}</span><strong>{market.author.displayName}</strong><p>{market.text}</p></div><span className="data-chip">Envio indexed</span></section>
    <section className="settlement-metrics" aria-label="Settlement metrics"><div><span>{metrics.openingLabel}</span><strong>{metrics.openingValue.toLocaleString()}</strong><small>{metrics.openingDetail}</small></div><div><span>Closing engagement</span><strong>{metrics.closingInteractions}</strong><small>Observed interactions</small></div><div><span>Quality-weighted growth</span><strong className="positive">{metrics.qualityGrowth===null?"—":`+${metrics.qualityGrowth.toLocaleString()}`}</strong><small>{settled?"Onchain weighted points":"Awaiting report"}</small></div><div><span>Reward pool</span><strong>{market.potentialReward.toFixed(3)} MON</strong><small>Scout + creator</small></div></section>
    <SettlementReveal opening={metrics.openingValue} closing={metrics.closingInteractions} score={qualityScore} settled={settled} mode={settlementMode}/>
    {settled&&<LifecycleActions market={market}/>}
    <section className="settlement-console"><div className="settlement-pipeline"><div className="panel-heading"><div><p className="eyebrow">Anti-manipulation pipeline</p><h2>From reach to verified quality.</h2></div><span className="data-chip">Chainlink CRE</span></div><div className="pipeline-step"><i>01</i><div><span>Observed interactions</span><strong>{metrics.closingInteractions}</strong><small>Likes + recasts + replies from the indexed cast</small></div></div><div className="pipeline-step"><i>02</i><div><span>Quality gate</span><strong>Neynar-filtered</strong><small>Account age ≥30 days · quality score ≥0.60</small></div></div><div className={`pipeline-step ${settled?"complete":"waiting"}`}><i>03</i><div><span>Onchain weighted growth</span><strong>{settled?qualityScore.toLocaleString():"Awaiting report"}</strong><small>{settled?"Verified settlement points":"Published only after the CRE report is accepted"}</small></div></div></div>
      <aside className="settlement-ledger"><p className="eyebrow">Settlement ledger</p><div><span>Status</span><strong>{settled?"Final":"Observing"}</strong></div><div><span>Conviction</span><strong>{market.totalUnits} units</strong></div><div><span>Scout wallets</span><strong>{market.newScouts}</strong></div><div><span>Market rank</span><strong>#{market.rank}</strong></div>{settled&&<div className="score-readout"><span>Weighted growth</span><strong>{qualityScore.toLocaleString()} pts</strong><i style={{width:`${scoreBarWidth(qualityScore)}%`}}/></div>}</aside>
    </section>
    <section className={`reward-card ${settled?"":"pending"}`}><div><p className="eyebrow">Protocol outcome</p><h2>{settled?"Allocation recorded.":"Rewards remain locked."}</h2><p>{settled?"Eligible scouts can claim their proportional share directly from the Dibs contract.":"The contract unlocks allocations only after a valid quality report settles this market."}</p></div><div><span>{settled?"Total allocation":"Projected allocation"}</span><strong>{market.potentialReward.toFixed(3)} MON</strong><small>Scout and creator pools</small></div></section>
    {!settled&&<LifecycleActions market={market}/>}
  </div>;
}
