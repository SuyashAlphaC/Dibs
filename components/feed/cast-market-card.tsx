import Link from "next/link";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import type {CastMarket} from "@/lib/types";

export function CastMarketCard({market,onDibs,justDibsed=false}: {market:CastMarket;onDibs:(market:CastMarket)=>void;justDibsed?:boolean}) {
  const disabled = market.status !== "active" && market.status !== "closing";
  return <article className={`market-card ${justDibsed?"just-dibsed":""} status-${market.status}`} style={{viewTransitionName:`market-${market.id}`}}>
    <div className="card-topline"><div className="rank-column"><strong>#{String(market.rank).padStart(2,"0")}</strong>{market.rankDelta!==0&&<span className={market.rankDelta>0?"up":"down"}>{market.rankDelta>0?"↑":"↓"}{Math.abs(market.rankDelta)} positions</span>}</div><span className={`status-pill ${market.status}`}><i/>{market.status==="active"?(market.ageMinutes<30?"Early":"Live"):market.status}</span></div>
    <div className="cast-body">
      <div className="author-row">
        <Avatar name={market.author.displayName} src={market.author.avatarUrl} size={34}/>
        <div><strong>{market.author.displayName}</strong><span>@{market.author.username} · {market.ageMinutes}m</span></div>
      </div>
      <Link className="cast-text" href={`/market/${market.id}`}>{market.text}</Link>
      <div className="social-proof"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span><span>{market.category}</span></div>
      <div className="conviction-row"><div><span>Conviction</span><strong>{market.totalStaked.toFixed(3)} <small>MON</small></strong></div><b className={market.movementPercent>=0?"positive":"negative"}>{market.movementPercent>=0?"▲ ":"▼ "}{Math.abs(market.movementPercent)}%</b></div>
      <div className="card-spark"><svg viewBox="0 0 240 32" preserveAspectRatio="none" aria-hidden="true"><path d="M0 27 C35 26 42 15 70 18 S110 28 132 14 S175 8 194 15 S220 8 240 4"/></svg></div>
      <div className="signal-strip"><div><span>Scouts</span><strong>{market.newScouts}</strong></div><div><span>Units</span><strong>{market.totalUnits}</strong></div><div><span>{market.timeLeftMinutes?"Time remaining":"Status"}</span><strong>{market.timeLeftMinutes?`${Math.floor(market.timeLeftMinutes/60)}h ${market.timeLeftMinutes%60}m`:market.status}</strong></div></div>
    </div>
    <div className="card-action">
      <button disabled={disabled||market.userHasDibs} onClick={()=>onDibs(market)}>{market.userHasDibs?"Dibs called":disabled?market.status:`Dibs · ${market.nextUnitCost.toFixed(3)}`}</button>
      <Link href={`/market/${market.id}`}>View market <span>→</span></Link>
    </div>
  </article>;
}
