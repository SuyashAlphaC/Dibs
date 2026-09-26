"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {useIdentity} from "@/components/identity-provider";
import {activePositions as demoPositions} from "@/lib/mock/markets";
import type {ScoutDashboard} from "@/lib/live-markets";

export function ScoutPortfolio(){
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
  const positions=dashboard?.positions;
  return <div className="standard-page"><div className="standard-heading"><div><p className="eyebrow">Portfolio</p><h1>My Dibs</h1><p>Your active conviction and settled calls.</p></div><div className="portfolio-value"><span>Portfolio return</span><strong className={dashboard&&dashboard.roi<0?"negative":""}>{dashboard?`${dashboard.roi>=0?"+":""}${dashboard.roi.toFixed(1)}%`:`+38.2%`}</strong></div></div><section className="portfolio-stats"><div><span>Active positions</span><strong>{positions?positions.filter(position=>position.market.status!=="settled").length:2}</strong></div><div><span>Conviction placed</span><strong>{dashboard?dashboard.spent.toFixed(3):"11.00"} MON</strong></div><div><span>Rewards earned</span><strong className="positive">{dashboard?(dashboard.claimed+dashboard.withdrawnCredit).toFixed(3):"24.18"} MON</strong></div></section><div className="position-table"><div className="table-head"><span>Cast</span><span>Current rank</span><span>Conviction</span><span>Outcome</span></div>{positions?positions.map(position=><Link href={`/market/${position.market.id}`} className="position-row" key={position.market.id}><span><strong>{position.market.author.displayName}</strong><small>{position.market.text.slice(0,44)}…</small></span><span>#{position.market.rank}</span><span>{position.spent.toFixed(3)} MON</span><strong className={position.claimed>0?"positive":""}>{position.claimed>0?`+${position.claimed.toFixed(3)} MON`:position.market.status}</strong></Link>):demoPositions.map(position=><Link href={`/market/${position.marketId}`} className="position-row" key={position.marketId}><span><strong>{position.author}</strong><small>{position.excerpt}</small></span><span>#{position.currentRank}</span><span>{position.amount.toFixed(2)} MON</span><strong className={position.status==="settled"?"":"positive"}>{position.status==="settled"?"Settled":`+${position.potentialReward.toFixed(2)} MON`}</strong></Link>)}</div></div>;
}
