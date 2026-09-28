"use client";

import Link from "next/link";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";

export function ActivityFeed(){
  const identity=useIdentity();
  const {dashboard,loading,live}=useScoutDashboard(identity.address);
  const events=(dashboard?.positions??[]).map(position=>({
    id:position.market.id,
    title:position.claimed>0?"Reward claimed":"Dibs confirmed",
    detail:`${position.market.author.displayName} · ${position.units} conviction unit${position.units===1?"":"s"}`,
    value:position.claimed>0?`+${position.claimed.toFixed(3)} MON`:`${position.spent.toFixed(3)} MON`,
  }));
  return <div className="standard-page"><div className="standard-heading"><div><p className="eyebrow">Updates</p><h1>Activity</h1><p>{live?"Confirmed activity indexed from Monad.":"Movement across your signals and reputation."}</p></div><Link className="simulation-link" href="/simulation"><span>CRE simulation</span><strong>Inspect quality proof →</strong></Link></div><section className="activity-list">{events.map(event=><Link className="activity-event" href={`/market/${event.id}`} key={event.id}><span className="activity-mark"/><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>Onchain</time><b>{event.value}</b></Link>)}{!loading&&!events.length&&<div className="empty-state"><strong>{identity.authenticated?"No activity yet":"Connect to see your activity"}</strong><p>{identity.authenticated?"Confirmed calls, rank movement, and rewards will appear here.":"Your wallet is the key to your Dibs history."}</p><button className="primary-button" onClick={identity.authenticated?()=>{window.location.href="/discover"}:identity.login}>{identity.authenticated?"Discover signals":"Connect wallet"}</button></div>}{loading&&<div className="empty-state"><span className="loading-orbit"/><p>Loading indexed activity…</p></div>}</section></div>;
}
