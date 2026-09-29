import Link from "next/link";
import {Avatar} from "@/components/shared/avatar";
import {formatAgeMinutes} from "@/lib/time";
import type {CastMarket} from "@/lib/types";

export function CastMarketCard({market,onDibs,justDibsed=false}: {market:CastMarket;onDibs:(market:CastMarket)=>void;justDibsed?:boolean}) {
  const disabled = market.status !== "active" && market.status !== "closing";
  const elapsed=Math.max(4,Math.min(100,((1440-market.timeLeftMinutes)/1440)*100));
  const projectedScoutShare=100/(market.totalUnits+1);
  const scout=market.scoutPreview?.[0];
  const scoutProof=scout
    ? `${scout.followedByViewer?"You follow ":""}${scout.username?`@${scout.username}`:scout.displayName}${market.newScouts>1?` · +${market.newScouts-1} more`:""} called this`
    : market.newScouts?`${market.newScouts} verified wallet scout${market.newScouts===1?"":"s"} called this`:"First call is open";
  return <article className={`market-card ${justDibsed?"just-dibsed":""} status-${market.status}`} style={{viewTransitionName:`market-${market.id}`}}>
    <div className="card-topline"><span className={`status-pill ${market.status}`}><i/>{market.status==="active"?(market.ageMinutes<30?"Early":"Live"):market.status}</span><span className="taste-rank">Signal #{String(market.rank).padStart(2,"0")}</span></div>
    <div className="cast-body">
      <div className="author-row">
        <Avatar name={market.author.displayName} src={market.author.avatarUrl} size={34}/>
        <div><strong>{market.author.displayName}</strong><span>@{market.author.username} · {formatAgeMinutes(market.ageMinutes)}</span></div>
      </div>
      <Link className="cast-text" href={`/market/${market.id}`}>{market.text}</Link>
      <div className="scout-proof"><div className="scout-proof-avatars">{market.scoutPreview?.slice(0,3).map(identity=><Avatar key={identity.address} name={identity.displayName} src={identity.avatarUrl} size={24}/>)}</div><span>{scoutProof}</span></div>
      <div className="social-proof"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span><span>{market.category}</span></div>
      <div className="earliness-block"><div className="earliness-heading"><span>Earliness</span><strong>{market.ageMinutes<30?"Fresh":market.ageMinutes<360?"Early":"Established"}</strong></div><div className="earliness-track"><i style={{width:`${elapsed}%`}}/></div><div className="earliness-stats"><div><span>Age</span><strong>{formatAgeMinutes(market.ageMinutes)}</strong></div><div><span>Scouts</span><strong>{market.newScouts}</strong></div><div><span>Next unit</span><strong>{market.nextUnitCost.toFixed(3)} MON</strong></div></div></div>
      <div className="card-lower-data"><span>Collective conviction <b>{market.totalStaked.toFixed(3)} MON</b></span><span>{market.timeLeftMinutes?`${Math.floor(market.timeLeftMinutes/60)}h ${market.timeLeftMinutes%60}m left`:market.status}</span></div>
    </div>
    <div className="card-action">
      <button disabled={disabled||market.userHasDibs} onClick={()=>onDibs(market)}>{market.userHasDibs?"Dibs called":disabled?market.status:`Dibs · ${market.nextUnitCost.toFixed(3)} MON → est. ${projectedScoutShare.toFixed(projectedScoutShare<10?1:0)}% scout share`}</button>
      <Link href={`/market/${market.id}`}>View market <span>→</span></Link>
    </div>
  </article>;
}
