"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {useIdentity} from "@/components/identity-provider";
import {Avatar} from "@/components/shared/avatar";
import {markets as demoMarkets} from "@/lib/mock/markets";
import type {ScoutDashboard} from "@/lib/live-markets";

export function ScoutProfile(){
  const identity=useIdentity();
  const [dashboard,setDashboard]=useState<ScoutDashboard|null>(null);
  useEffect(()=>{
    if(!identity.address?.match(/^0x[a-fA-F0-9]{40}$/))return;
    const controller=new AbortController();
    fetch(`/api/scout?address=${identity.address}`,{signal:controller.signal})
      .then(response=>response.json())
      .then((payload:{source:string;dashboard:ScoutDashboard|null})=>payload.source==="envio"&&setDashboard(payload.dashboard))
      .catch(()=>{});
    return()=>controller.abort();
  },[identity.address]);
  const displayAddress=identity.address?`${identity.address.slice(0,6)}…${identity.address.slice(-4)}`:"Alex.eth";
  const stats=useMemo(()=>dashboard?{
    score:Math.min(999,Math.round(dashboard.hitRate*8+Math.min(dashboard.calls,199))),
    hit:`${dashboard.hitRate.toFixed(0)}%`,lead:`${dashboard.averageLeadMinutes.toFixed(1)}m`,
    roi:`${dashboard.roi>=0?"+":""}${dashboard.roi.toFixed(1)}%`,successes:`${dashboard.successfulCalls}`,calls:`${dashboard.calls}`,
  }:{score:742,hit:"74%",lead:"11.4m",roi:"+38.2%",successes:"41",calls:"55"},[dashboard]);
  const history=dashboard?.positions.map(position=>position.market)??demoMarkets.slice(0,5);
  return <div className="profile-page">
    <section className="profile-hero"><div className="profile-person"><Avatar name={displayAddress} size={78}/><div><span className="reputation-label">Signal scout · verified onchain</span><h1>{displayAddress}</h1><p>{dashboard?`${dashboard.units} conviction units across ${dashboard.calls} calls.`:"Spotting durable ideas before consensus."}</p></div></div><button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(window.location.href)}>Share profile</button></section>
    <section className="reputation-grid"><div className="reputation-primary"><span>Reputation score</span><strong>{stats.score}</strong><div className="reputation-track"><i style={{width:`${Math.min(100,stats.score/10)}%`}}/></div><small>Quality-weighted track record</small></div><div><span>Hit rate</span><strong>{stats.hit}</strong><small>Claimed winning calls</small></div><div><span>Avg. lead</span><strong>{stats.lead}</strong><small>After market opened</small></div><div><span>Scout ROI</span><strong className={dashboard&&dashboard.roi<0?"negative":"positive"}>{stats.roi}</strong><small>Claims plus challenge credits</small></div><div><span>Successful calls</span><strong>{stats.successes}</strong><small>of {stats.calls} positions</small></div></section>
    <section className="profile-insight"><div><span>Proof of taste</span><strong>{dashboard?`${dashboard.claimed.toFixed(3)} MON`:`8.7/10`}</strong><p>{dashboard?"Total scout rewards claimed from settled markets.":"You perform best on cultural and product signals between ranks 18–40."}</p></div><div className="skill-chart"><span style={{height:"72%"}}/><span style={{height:"91%"}}/><span style={{height:"64%"}}/><span style={{height:"82%"}}/><span style={{height:"56%"}}/></div></section>
    <section className="history-section"><div className="section-heading"><div><p className="eyebrow">Track record</p><h2>Recent calls</h2></div><span>{dashboard?"Indexed by Envio":"Demo history"}</span></div><div className="history-table"><div className="table-head"><span>Signal</span><span>Rank</span><span>Conviction</span><span>Outcome</span></div>{history.slice(0,5).map((market,index)=>{const position=dashboard?.positions.find(item=>item.market.id===market.id);return <Link href={`/market/${market.id}`} className="history-row" key={market.id}><span><Avatar name={market.author.displayName} size={34}/><i><strong>{market.author.displayName}</strong><small>{market.text.slice(0,42)}…</small></i></span><span>#{market.rank}</span><span>{position?`${position.spent.toFixed(3)} MON`:`#${18+index*3}`}</span><strong className={(position?.claimed??1)>0?"positive":""}>{position?position.claimed>0?`+${position.claimed.toFixed(3)} MON`:market.status:`+${(1.22+index*.47).toFixed(2)} MON`}</strong></Link>;})}</div></section>
  </div>;
}
