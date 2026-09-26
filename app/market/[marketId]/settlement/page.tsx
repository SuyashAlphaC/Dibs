import Link from "next/link";
import {notFound} from "next/navigation";
import {Avatar} from "@/components/shared/avatar";
import {findMarket} from "@/lib/mock/markets";
import {getLiveMarket} from "@/lib/live-markets";

export default async function SettlementPage({params}:{params:Promise<{marketId:string}>}){
  const {marketId}=await params;const market=(await getLiveMarket(marketId))??findMarket(marketId);if(!market)notFound();
  const qualityScore=market.settlementScore??94;
  return <div className="settlement-page"><Link className="back-link" href={`/market/${market.id}`}>← Back to market</Link>
    <section className="settlement-hero"><span className="settled-seal">✓</span><p className="eyebrow">Market settled</p><h1>A high-quality signal,<br/><em>recognized early.</em></h1><p>Organic attention held through the full market window. Early scouts earned the strongest multiplier.</p></section>
    <section className="settled-cast"><Avatar name={market.author.displayName} size={44}/><div><strong>{market.author.displayName}</strong><p>{market.text}</p></div></section>
    <section className="quality-score"><div><span>Quality-growth score</span><strong>{qualityScore}</strong><p>Computed from interactions that passed the account-age and Neynar quality filters.</p></div><div className="score-ring" style={{"--score":`${Math.min(100,qualityScore)}%`} as React.CSSProperties}><span>{qualityScore}</span></div></section>
    <section className="settlement-stats"><div><span>Opening engagement</span><strong>{market.likes+market.recasts+market.replies}</strong></div><span className="growth-arrow">→</span><div><span>Final rank</span><strong>#{market.rank}</strong></div><div><span>Conviction units</span><strong>{market.totalUnits}</strong></div><div><span>Scouts</span><strong>{market.newScouts}</strong></div></section>
    <section className="reward-card"><div><p className="eyebrow">Market outcome</p><h2>Settlement recorded.</h2><p>Eligible scouts can claim their proportional share directly from the Dibs contract.</p></div><div><span>Total allocation</span><strong>{market.potentialReward.toFixed(3)} MON</strong><small>Scout and creator pools</small></div></section>
  </div>;
}
