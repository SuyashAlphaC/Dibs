"use client";

import Link from "next/link";
import {useMemo} from "react";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";
import {Avatar} from "@/components/shared/avatar";
import {ScoutLeaderboard} from "@/components/scout-leaderboard";

export function ScoutProfile({address,showLeaderboard=false}:{address?:string;showLeaderboard?:boolean}){
  const identity=useIdentity();
  const profileAddress=address??identity.address;
  const ownProfile=!address||Boolean(identity.address&&identity.address.toLowerCase()===address.toLowerCase());
  const {dashboard,loading,live,scoutIdentity}=useScoutDashboard(profileAddress);
  const displayAddress=profileAddress?.match(/^0x[a-fA-F0-9]{40}$/)?`${profileAddress.slice(0,6)}…${profileAddress.slice(-4)}`:"Guest scout";
  const linkedFarcaster=(ownProfile?identity.farcaster:undefined)??(scoutIdentity?.fid?{
    fid:scoutIdentity.fid,username:scoutIdentity.username,displayName:scoutIdentity.displayName,avatarUrl:scoutIdentity.avatarUrl,
  }:undefined);
  const profileName=linkedFarcaster?.displayName||linkedFarcaster?.username||displayAddress;
  const profileHandle=linkedFarcaster?.username?`@${linkedFarcaster.username}`:displayAddress;
  const stats=useMemo(()=>dashboard?{
    score:Math.min(999,Math.round((dashboard.realizedHitRate??0)*8+Math.min(dashboard.calls,199))),
    hit:dashboard.realizedHitRate===null?"Pending":`${dashboard.realizedHitRate.toFixed(0)}%`,lead:`${dashboard.averageLeadMinutes.toFixed(1)}m`,
    roi:dashboard.realizedRoi===null?"Pending":`${dashboard.realizedRoi>=0?"+":""}${dashboard.realizedRoi.toFixed(1)}%`,
    successes:dashboard.resolvedCalls?`${dashboard.resolvedSuccessfulCalls}`:"—",calls:`${dashboard.calls}`,
    pending:`${dashboard.pendingCalls}`,resolved:`${dashboard.resolvedCalls}`,
  }:{score:0,hit:"—",lead:"—",roi:"—",successes:"—",calls:"0",pending:"0",resolved:"0"},[dashboard]);
  const history=dashboard?.positions.map(position=>position.market)??[];
  const signalBars=[Math.min(100,stats.score/10),Number.parseFloat(stats.hit)||0,Math.min(100,(dashboard?.calls??0)*10),Math.min(100,(dashboard?.resolvedSuccessfulCalls??0)*14),Math.min(100,(dashboard?.units??0)*8)];
  return <div className="profile-page">
    {showLeaderboard&&<ScoutLeaderboard/>}
    <div className="profile-command"><span>SCOUT / REPUTATION</span><strong>{live?"LIVE INDEX":"ONCHAIN READ"}</strong></div>
    <section className="profile-hero"><div className="profile-person"><div className="profile-avatar-wrap"><Avatar name={profileName} src={linkedFarcaster?.avatarUrl} size={86}/><span>{stats.score} REP</span></div><div><span className="reputation-label">{linkedFarcaster?"Farcaster verified":profileAddress?"Verified wallet scout":"Connect to begin"}</span><h1>{profileName}</h1>{linkedFarcaster&&<p className="profile-handle">{profileHandle} · FID {linkedFarcaster.fid}</p>}<p className="profile-statline"><b>{stats.calls}</b> calls <i/> <b>{stats.pending}</b> pending <i/> <b>{stats.hit}</b> hit rate</p><div className="profile-badges"><span>◉ Monad</span>{linkedFarcaster&&<span>◈ Farcaster</span>}<span>↗ Envio</span><span>◇ Onchain record</span></div></div></div><div className="profile-actions">{ownProfile&&identity.authenticated&&!identity.farcaster&&<button className="primary-button" onClick={identity.linkFarcaster}>◈ Link Farcaster profile</button>}{profileAddress?<button className="secondary-button" onClick={()=>navigator.clipboard?.writeText(`${window.location.origin}/scout/${profileAddress}`)}>＋ Copy profile link</button>:<button className="secondary-button" onClick={identity.login}>＋ Connect wallet</button>}</div></section>
    <section className="reputation-grid"><div className="reputation-primary"><span>Reputation score</span><strong>{stats.score}</strong><div className="reputation-track"><i style={{width:`${Math.min(100,stats.score/10)}%`}}/></div><small>Quality-weighted settled record</small></div><div><span>Hit rate</span><strong>{stats.hit}</strong><small>{dashboard?.resolvedCalls?`${stats.resolved} settled calls`:`${stats.pending} unresolved calls`}</small></div><div><span>Avg. lead</span><strong>{stats.lead}</strong><small>After market opened</small></div><div><span>Scout ROI</span><strong className={dashboard?.realizedRoi===null?"":dashboard&&dashboard.realizedRoi<0?"negative":"positive"}>{stats.roi}</strong><small>{dashboard?.realizedRoi===null?"Settles after market outcome":"Realized settled positions"}</small></div><div><span>Successful calls</span><strong>{stats.successes}</strong><small>{dashboard?.resolvedCalls?`of ${stats.resolved} settled`:`${stats.pending} position pending`}</small></div></section>
    <section className="profile-insight"><div><p className="eyebrow">Current indexed snapshot</p><span>Proof of taste</span><strong>{(dashboard?.claimed??0).toFixed(3)} MON</strong><p>Total scout rewards claimed from settled markets.</p></div><div className="signal-matrix"><div className="matrix-grid">{signalBars.map((height,index)=><span key={index} style={{height:`${Math.max(4,height)}%`}}/>)}</div><div className="matrix-labels"><span>Rep</span><span>Hit</span><span>Calls</span><span>Wins</span><span>Units</span></div></div></section>
    <section className="history-section"><div className="section-heading"><div><p className="eyebrow">Immutable track record</p><h2>Recent calls</h2></div><span>{live?"Indexed by Envio":"Onchain history"}</span></div><div className="history-table"><div className="table-head"><span>Signal</span><span>Rank</span><span>Conviction</span><span>Outcome</span></div>{history.slice(0,5).map((market)=>{const position=dashboard?.positions.find(item=>item.market.id===market.id);return <Link href={`/market/${market.id}`} className="history-row" key={market.id}><span><Avatar name={market.author.displayName} src={market.author.avatarUrl} size={34}/><i><strong>{market.author.displayName}</strong><small>{market.text.slice(0,42)}…</small></i></span><span>#{market.rank}</span><span>{position?.spent.toFixed(3)} MON</span><strong className={(position?.claimed??0)>0?"positive":""}>{position&&position.claimed>0?`+${position.claimed.toFixed(3)} MON`:market.status}</strong></Link>;})}{!history.length&&<div className="empty-state"><strong>{profileAddress?"No calls yet":"Your track record starts here"}</strong><p>{profileAddress?"This address has no indexed Dibs positions yet.":"Connect your wallet, discover an early signal, and make your first onchain call."}</p>{ownProfile&&<Link className="primary-button" href="/discover">Explore signals</Link>}</div>}</div></section>
  </div>;
}
