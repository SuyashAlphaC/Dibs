"use client";

import Link from "next/link";
import {useEffect,useState} from "react";
import {Avatar} from "@/components/shared/avatar";
import type {ScoutLeaderboardEntry} from "@/lib/live-markets";

export function ScoutLeaderboard(){
  const [scouts,setScouts]=useState<ScoutLeaderboardEntry[]>([]);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/scouts",{signal:controller.signal,cache:"no-store"}).then(response=>response.json()).then((payload:{scouts?:ScoutLeaderboardEntry[]})=>setScouts(payload.scouts??[])).catch(()=>{}).finally(()=>setLoading(false));
    return()=>controller.abort();
  },[]);
  return <section className="scout-leaderboard" aria-labelledby="scout-leaderboard-title">
    <div className="section-heading"><div><p className="eyebrow">Seven-day signal board</p><h1 id="scout-leaderboard-title">Top scouts</h1></div><span>Envio calls · Neynar identities</span></div>
    <div className="scout-leader-grid">{scouts.slice(0,8).map((scout,index)=><Link href={`/scout/${scout.address}`} className="scout-leader-card" key={scout.address}>
      <b className="scout-place">{String(index+1).padStart(2,"0")}</b><Avatar name={scout.identity.displayName} src={scout.identity.avatarUrl} size={48}/>
      <div><strong>{scout.identity.username?`@${scout.identity.username}`:scout.identity.displayName}</strong><span>{scout.specialty}</span></div>
      <dl><div><dt>7d calls</dt><dd>{scout.weeklyCalls}</dd></div><div><dt>Lead</dt><dd>{scout.averageLeadMinutes.toFixed(0)}m</dd></div><div><dt>Streak</dt><dd>{scout.streakDays}d</dd></div></dl>
    </Link>)}</div>
    {!loading&&!scouts.length&&<div className="leaderboard-empty"><strong>The weekly board is forming.</strong><p>Verified scout identities appear after their first Envio-indexed call.</p></div>}
    {loading&&<p className="leaderboard-loading">Resolving onchain scouts to Farcaster…</p>}
  </section>;
}
