"use client";

import Link from "next/link";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";

export function ScoutPortfolio(){
  const identity=useIdentity();
  const {dashboard,loading}=useScoutDashboard(identity.address);
  const positions=dashboard?.positions??[];
  const realizedRoi=dashboard?.realizedRoi;
  return <div className="standard-page"><div className="standard-heading"><div><p className="eyebrow">Portfolio</p><h1>My Dibs</h1><p>{loading?"Loading confirmed positions…":"Your active conviction and settled calls."}</p></div><div className="portfolio-value"><span>Realized return</span><strong className={realizedRoi!==null&&realizedRoi!==undefined&&realizedRoi<0?"negative":""}>{realizedRoi===null||realizedRoi===undefined?"Pending":`${realizedRoi>=0?"+":""}${realizedRoi.toFixed(1)}%`}</strong></div></div><section className="portfolio-stats"><div><span>Active positions</span><strong>{positions.filter(position=>position.market.status!=="settled").length}</strong></div><div><span>Conviction placed</span><strong>{(dashboard?.spent??0).toFixed(3)} MON</strong></div><div><span>Rewards earned</span><strong className="positive">{((dashboard?.claimed??0)+(dashboard?.withdrawnCredit??0)).toFixed(3)} MON</strong></div></section><div className="position-table"><div className="table-head"><span>Cast</span><span>Current rank</span><span>Conviction</span><span>Outcome</span></div>{positions.map(position=><Link href={`/market/${position.market.id}`} className="position-row" key={position.market.id}><span><strong>{position.market.author.displayName}</strong><small>{position.market.text.slice(0,44)}…</small></span><span>#{position.market.rank}</span><span>{position.spent.toFixed(3)} MON</span><strong className={position.claimed>0?"positive":""}>{position.claimed>0?`+${position.claimed.toFixed(3)} MON`:position.market.status}</strong></Link>)}{!loading&&!positions.length&&<div className="empty-state"><strong>{identity.authenticated?"No positions yet":"Connect your wallet"}</strong><p>{identity.authenticated?"Your confirmed Dibs will be indexed here automatically.":"Connect through Privy to see your positions, conviction, and rewards."}</p><button className="primary-button" onClick={identity.authenticated?()=>{window.location.href="/discover"}:identity.login}>{identity.authenticated?"Explore signals":"Connect wallet"}</button></div>}</div></div>;
}
