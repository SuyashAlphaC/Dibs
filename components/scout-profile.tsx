"use client";

import Link from "next/link";
import {useMemo} from "react";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";
import {Avatar} from "@/components/shared/avatar";

export function ScoutProfile(){
  const identity=useIdentity();
  const {dashboard,loading,live}=useScoutDashboard(identity.address);
  const displayAddress=identity.address?.match(/^0x[a-fA-F0-9]{40}$/)?`${identity.address.slice(0,6)}…${identity.address.slice(-4)}`:"Guest scout";
  const stats=useMemo(()=>dashboard?{
    score:Math.min(999,Math.round(dashboard.hitRate*8+Math.min(dashboard.calls,199))),
    hit:`${dashboard.hitRate.toFixed(0)}%`,lead:`${dashboard.averageLeadMinutes.toFixed(1)}m`,
    roi:`${dashboard.roi>=0?"+":""}${dashboard.roi.toFixed(1)}%`,successes:`${dashboard.successfulCalls}`,calls:`${dashboard.calls}`,
  }:{score:0,hit:"0%",lead:"0.0m",roi:"0.0%",successes:"0",calls:"0"},[dashboard]);
  const history=dashboard?.positions.map(position=>position.market)??[];
  const signalBars=[Math.min(100,stats.score/10),Number.parseFloat(stats.hit),Math.min(100,(dashboard?.calls??0)*10),Math.min(100,(dashboard?.successfulCalls??0)*14),Math.min(100,(dashboard?.units??0)*8)];
  return <div className="profile-page">
    <div className="profile-command"><span>SCOUT / REPUTATION</span><strong>{live?"LIVE INDEX":"ONCHAIN READ"}</strong></div>
    <section className="profile-hero"><div className="profile-person"><div className="profile-avatar-wrap"><Avatar name={displayAddress} size={86}/><span>{stats.score} REP</span></div><div><span className="reputation-label">{identity.authenticated?"Verified scout":"Connect to begin"}</span><h1>{displayAddress}</h1><p className="profile-statline"><b>{stats.calls}</b> calls <i/> <b>{stats.successes}</b> successful <i/> <b>{stats.hit}</b> hit rate</p><div className="profile-badges"><span>◉ Monad</span><span>↗ Envio</span><span>◇ Onchain record</span></div></div></div>{identity.authenticated?<button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(window.location.href)}>＋ Copy profile link</button>:<button className="secondary-button" onClick={identity.login}>＋ Connect wallet</button>}</section>
    <section className="reputation-grid"><div className="reputation-primary"><span>Reputation score</span><strong>{stats.score}</strong><div className="reputation-track"><i style={{width:`${Math.min(100,stats.score/10)}%`}}/></div><small>Quality-weighted track record</small></div><div><span>Hit rate</span><strong>{stats.hit}</strong><small>Claimed winning calls</small></div><div><span>Avg. lead</span><strong>{stats.lead}</strong><small>After market opened</small></div><div><span>Scout ROI</span><strong className={dashboard&&dashboard.roi<0?"negative":"positive"}>{stats.roi}</strong><small>Claims plus challenge credits</small></div><div><span>Successful calls</span><strong>{stats.successes}</strong><small>of {stats.calls} positions</small></div></section>
    <section className="profile-insight"><div><p className="eyebrow">Current indexed snapshot</p><span>Proof of taste</span><strong>{(dashboard?.claimed??0).toFixed(3)} MON</strong><p>Total scout rewards claimed from settled markets.</p></div><div className="signal-matrix"><div className="matrix-grid">{signalBars.map((height,index)=><span key={index} style={{height:`${Math.max(4,height)}%`}}/>)}</div><div className="matrix-labels"><span>Rep</span><span>Hit</span><span>Calls</span><span>Wins</span><span>Units</span></div></div></section>
    <section className="history-section"><div className="section-heading"><div><p className="eyebrow">Immutable track record</p><h2>Recent calls</h2></div><span>{live?"Indexed by Envio":"Onchain history"}</span></div><div className="history-table"><div className="table-head"><span>Signal</span><span>Rank</span><span>Conviction</span><span>Outcome</span></div>{history.slice(0,5).map((market)=>{const position=dashboard?.positions.find(item=>item.market.id===market.id);return <Link href={`/market/${market.id}`} className="history-row" key={market.id}><span><Avatar name={market.author.displayName} src={market.author.avatarUrl} size={34}/><i><strong>{market.author.displayName}</strong><small>{market.text.slice(0,42)}…</small></i></span><span>#{market.rank}</span><span>{position?.spent.toFixed(3)} MON</span><strong className={(position?.claimed??0)>0?"positive":""}>{position&&position.claimed>0?`+${position.claimed.toFixed(3)} MON`:market.status}</strong></Link>;})}{!history.length&&<div className="empty-state"><strong>{identity.authenticated?"No calls yet":"Your track record starts here"}</strong><p>{identity.authenticated?"Call Dibs on a live market and the confirmed position will appear here.":"Connect your wallet, discover an early signal, and make your first onchain call."}</p><Link className="primary-button" href="/discover">Explore signals</Link></div>}</div></section>
  </div>;
}
