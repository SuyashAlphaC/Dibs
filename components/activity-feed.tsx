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
  return <div className="standard-page"><div className="standard-heading"><div><p className="eyebrow">Public market ledger</p><h1>Market tape</h1><p>{live?"Positions, rank movement, settlements, and rewards indexed from Monad.":"The immutable timeline behind your scout reputation."}</p></div><Link className="simulation-link" href="/simulation"><span>Settlement engine</span><strong>Inspect quality proof →</strong></Link></div><section className="activity-list">{events.map(event=><Link className="activity-event" href={`/market/${event.id}`} key={event.id}><span className="activity-mark"/><div><strong>{event.title}</strong><p>{event.detail}</p></div><time>Onchain</time><b>{event.value}</b></Link>)}{!loading&&!events.length&&<div className="empty-state"><strong>{identity.authenticated?"No market events yet":"Connect to see your market tape"}</strong><p>{identity.authenticated?"Confirmed positions, rank movement, outcomes, and rewards will appear here.":"Your wallet connects every signal call to a verifiable track record."}</p><button className="primary-button" onClick={identity.authenticated?()=>{window.location.href="/discover"}:identity.login}>{identity.authenticated?"Open conviction feed":"Connect wallet"}</button></div>}{loading&&<div className="empty-state"><span className="loading-orbit"/><p>Loading indexed market events…</p></div>}</section></div>;
}
