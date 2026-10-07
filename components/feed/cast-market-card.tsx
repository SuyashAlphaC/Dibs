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
  const entryPosition=market.totalUnits+1;
  const earlinessLabel=market.ageMinutes<30?"First wave":market.ageMinutes<360?"Early":"Established";
  return <article className={`market-card conviction-market ${justDibsed?"just-dibsed":""} status-${market.status}`} style={{viewTransitionName:`market-${market.id}`}}>
    <div className="card-topline"><span className="market-rank">#{String(market.rank).padStart(2,"0")}</span><span className={`status-pill ${market.status}`}><i/>{market.status==="active"?"Market live":market.status}</span><span className="taste-rank">24h signal market</span></div>
    <div className="cast-body">
      <div className="author-row">
        <Avatar name={market.author.displayName} src={market.author.avatarUrl} size={34}/>
        <div><strong>{market.author.displayName}</strong><span>@{market.author.username} · {formatAgeMinutes(market.ageMinutes)}</span></div>
      </div>
      <Link className="cast-text" href={`/market/${market.id}`}>{market.text}</Link>
      <div className="scout-proof"><div className="scout-proof-avatars">{market.scoutPreview?.slice(0,3).map(identity=><Avatar key={identity.address} name={identity.displayName} src={identity.avatarUrl} size={24}/>)}</div><span>{scoutProof}</span></div>
      <div className="social-proof"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span><span>{market.category}</span></div>
      <div className="market-thesis" aria-label="Signal market state"><div><span>Earliness</span><strong>{earlinessLabel}</strong><small>{formatAgeMinutes(market.ageMinutes)} old</small></div><div><span>Consensus</span><strong>{market.newScouts} scout{market.newScouts===1?"":"s"}</strong><small>{market.totalUnits} conviction units</small></div><div><span>Your entry</span><strong>#{entryPosition}</strong><small>{market.nextUnitCost.toFixed(3)} MON</small></div></div>
      <div className="conviction-meter"><div><span>Collective conviction</span><strong>{market.totalStaked.toFixed(3)} MON</strong></div><div className="earliness-track"><i style={{width:`${elapsed}%`}}/></div><small>Earlier conviction receives a larger share of the scout side</small></div>
      <div className="card-lower-data"><span>{market.timeLeftMinutes?`${Math.floor(market.timeLeftMinutes/60)}h ${market.timeLeftMinutes%60}m until settlement`:market.status}</span><span>Quality-weighted outcome</span></div>
      <p className="seed-disclosure">Community seed {market.communitySeed.toFixed(3)} MON · excluded from rank</p>
    </div>
    <div className="card-action">
      {/^[1-9]\d*$/.test(market.id)&&<Link className="lens-discover-link" href={`/market/${market.id}#conviction-lens`}>Inspect who backs this · Nansen ↗</Link>}
      <button disabled={disabled||market.userHasDibs} onClick={()=>onDibs(market)}>{market.userHasDibs?"Position confirmed":disabled?market.status:`Back this signal · ${market.nextUnitCost.toFixed(3)} MON`}</button>
      <div className="action-context"><span>Enter as scout #{entryPosition} · est. {projectedScoutShare.toFixed(projectedScoutShare<10?1:0)}% scout share</span><Link href={`/market/${market.id}`}>Open market <span>→</span></Link></div>
    </div>
  </article>;
}
