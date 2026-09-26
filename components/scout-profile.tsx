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
  return <div className="profile-page">
    <section className="profile-hero"><div className="profile-person"><Avatar name={displayAddress} size={78}/><div><span className="reputation-label">{identity.authenticated?live?"Signal scout · indexed onchain":"Signal scout":"Connect to begin"}</span><h1>{displayAddress}</h1><p>{identity.authenticated?loading?"Loading your onchain record…":`${dashboard?.units??0} conviction units across ${dashboard?.calls??0} calls.`:"Connect a wallet to build a portable record of early calls."}</p></div></div>{identity.authenticated?<button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(window.location.href)}>Share profile</button>:<button className="secondary-button" onClick={identity.login}>Connect wallet</button>}</section>
    <section className="reputation-grid"><div className="reputation-primary"><span>Reputation score</span><strong>{stats.score}</strong><div className="reputation-track"><i style={{width:`${Math.min(100,stats.score/10)}%`}}/></div><small>Quality-weighted track record</small></div><div><span>Hit rate</span><strong>{stats.hit}</strong><small>Claimed winning calls</small></div><div><span>Avg. lead</span><strong>{stats.lead}</strong><small>After market opened</small></div><div><span>Scout ROI</span><strong className={dashboard&&dashboard.roi<0?"negative":"positive"}>{stats.roi}</strong><small>Claims plus challenge credits</small></div><div><span>Successful calls</span><strong>{stats.successes}</strong><small>of {stats.calls} positions</small></div></section>
    <section className="profile-insight"><div><span>Proof of taste</span><strong>{(dashboard?.claimed??0).toFixed(3)} MON</strong><p>Total scout rewards claimed from settled markets.</p></div><div className="skill-chart"><span style={{height:`${Math.max(4,stats.score/10)}%`}}/><span style={{height:`${Math.max(4,Number.parseFloat(stats.hit))}%`}}/><span style={{height:`${Math.max(4,Math.min(100,(dashboard?.calls??0)*10))}%`}}/><span style={{height:`${Math.max(4,Math.min(100,(dashboard?.successfulCalls??0)*14))}%`}}/><span style={{height:`${Math.max(4,Math.min(100,(dashboard?.units??0)*8))}%`}}/></div></section>
    <section className="history-section"><div className="section-heading"><div><p className="eyebrow">Track record</p><h2>Recent calls</h2></div><span>{live?"Indexed by Envio":"Onchain history"}</span></div><div className="history-table"><div className="table-head"><span>Signal</span><span>Rank</span><span>Conviction</span><span>Outcome</span></div>{history.slice(0,5).map((market)=>{const position=dashboard?.positions.find(item=>item.market.id===market.id);return <Link href={`/market/${market.id}`} className="history-row" key={market.id}><span><Avatar name={market.author.displayName} size={34}/><i><strong>{market.author.displayName}</strong><small>{market.text.slice(0,42)}…</small></i></span><span>#{market.rank}</span><span>{position?.spent.toFixed(3)} MON</span><strong className={(position?.claimed??0)>0?"positive":""}>{position&&position.claimed>0?`+${position.claimed.toFixed(3)} MON`:market.status}</strong></Link>;})}{!history.length&&<div className="empty-state"><strong>{identity.authenticated?"No calls yet":"Your track record starts here"}</strong><p>{identity.authenticated?"Call Dibs on a live market and the confirmed position will appear here.":"Connect your wallet, discover an early signal, and make your first onchain call."}</p><Link className="primary-button" href="/discover">Explore signals</Link></div>}</div></section>
  </div>;
}
