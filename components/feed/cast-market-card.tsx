import Link from "next/link";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import type {CastMarket} from "@/lib/types";

export function CastMarketCard({market,onDibs,justDibsed=false}: {market:CastMarket;onDibs:(market:CastMarket)=>void;justDibsed?:boolean}) {
  const disabled = market.status !== "active" && market.status !== "closing";
  return <article className={`market-card ${justDibsed?"just-dibsed":""} status-${market.status}`} style={{viewTransitionName:`market-${market.id}`}}>
    <div className="rank-column"><strong>#{market.rank}</strong>{market.rankDelta!==0&&<span className={market.rankDelta>0?"up":"down"}>{market.rankDelta>0?"↑":"↓"}{Math.abs(market.rankDelta)}</span>}</div>
    <div className="cast-body">
      <div className="author-row">
        <Avatar name={market.author.displayName} size={42}/>
        <div><strong>{market.author.displayName}</strong><span>@{market.author.username} · {market.ageMinutes}m</span></div>
        <span className={`status-pill ${market.status}`}>{market.status==="active"?"Open":market.status}</span>
      </div>
      <Link className="cast-text" href={`/market/${market.id}`}>{market.text}</Link>
      <div className="social-proof"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span><span>{market.category}</span></div>
      <div className="signal-strip">
        <div><span>Conviction</span><strong>{market.convictionScore.toFixed(market.convictionScore<0.01?3:2)}</strong></div>
        <div><span>Momentum</span><strong className={market.movementPercent>=0?"positive":"negative"}>{market.movementPercent>=0?"+":""}{market.movementPercent}%</strong></div>
        <div><span>Scouts</span><strong>{market.newScouts}</strong></div>
        <div><span>{market.timeLeftMinutes?"Closes in":"Status"}</span><strong>{market.timeLeftMinutes?`${market.timeLeftMinutes}m`:market.status}</strong></div>
      </div>
      <div className="why-rising"><Icon name={market.status==="challenged"?"clock":"trend"}/><span>{market.whyRising}</span></div>
    </div>
    <div className="card-action">
      <div className="reward-preview"><span>Potential</span><strong>{market.potentialReward?`${market.potentialReward.toFixed(2)} MON`:market.status==="settled"?"Settled":"Pool forming"}</strong></div>
      <button disabled={disabled||market.userHasDibs} onClick={()=>onDibs(market)}>{market.userHasDibs?"Dibs called":disabled?market.status:`Dibs · ${market.nextUnitCost.toFixed(3)}`}</button>
      <Link href={`/market/${market.id}`}>View market <span>→</span></Link>
    </div>
  </article>;
}
