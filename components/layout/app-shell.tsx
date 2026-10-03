"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import type {CastMarket,LiveScoutSignal} from "@/lib/types";

const nav = [
  {href:"/discover",label:"Home",icon:"discover" as const},
  {href:"/dibs",label:"My Dibs",icon:"dibs" as const},
  {href:"/activity",label:"Activity",icon:"activity" as const},
  {href:"/profile",label:"Scouts",icon:"profile" as const},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const identity = useIdentity();
  const {dashboard}=useScoutDashboard(identity.address);
  const [markets,setMarkets]=useState<CastMarket[]>([]);
  const [scoutSignals,setScoutSignals]=useState<LiveScoutSignal[]>([]);
  const shortAddress=identity.address?.match(/^0x[a-fA-F0-9]{40}$/)?`${identity.address.slice(0,6)}…${identity.address.slice(-4)}`:identity.address;
  const accountName=identity.farcaster?.displayName||identity.farcaster?.username||shortAddress||"Wallet scout";
  const accountAvatar=identity.farcaster?<Avatar name={accountName} src={identity.farcaster.avatarUrl} size={34}/>:<span className="wallet-avatar-fallback"><Icon name="profile"/></span>;
  const score=dashboard?Math.min(999,Math.round((dashboard.realizedHitRate??0)*8+Math.min(dashboard.calls,199))):0;
  const positions=dashboard?.positions??[];
  useEffect(()=>{
    const controller=new AbortController();
    const viewer=identity.farcaster?.fid?`?viewerFid=${identity.farcaster.fid}`:"";
    fetch(`/api/casts${viewer}`,{signal:controller.signal}).then(response=>response.json()).then((payload:{casts?:CastMarket[];signals?:LiveScoutSignal[]})=>{
      setMarkets(payload.casts??[]);
      setScoutSignals((payload.signals??[]).map(signal=>identity.farcaster&&signal.scout.toLowerCase()===identity.address?.toLowerCase()?{...signal,identity:{address:signal.scout,fid:identity.farcaster.fid,username:identity.farcaster.username,displayName:identity.farcaster.displayName||identity.farcaster.username||signal.identity?.displayName||shortScout(signal.scout),avatarUrl:identity.farcaster.avatarUrl}}:signal));
    }).catch(()=>{});
    return()=>controller.abort();
  },[identity.address,identity.farcaster]);
  const topics=Array.from(new Set(markets.map(market=>market.category))).slice(0,7);
  const shortScout=(address:string)=>`${address.slice(0,6)}…${address.slice(-4)}`;
  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Skip to discovery content</a>
    <header className="topbar">
      <div className="brand-cluster">
        <Link href="/discover" className="brand" aria-label="Dibs home"><img className="brand-logo" src="/dibs_logo.png" alt="Dibs Farcaster discovery" width="92" height="54" decoding="async" fetchPriority="high"/></Link>
        <p className="brand-mantra">DIBS: Cultural Foresight Protocol</p>
        <p className="brand-network">[Monad testnet] <i/> <span>{markets.reduce((total,market)=>total+market.newScouts,0)} scouts indexed</span></p>
      </div>
      <nav className="topnav" aria-label="Primary navigation">
        {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}>{item.label}</Link>)}
      </nav>
      <div className="topbar-actions">
        <form className="header-search" action="/discover" method="get" role="search"><Icon name="discover"/><input name="q" type="search" autoComplete="off" aria-label="Search casts and scouts" placeholder="Search casts, scouts…"/></form>
        <span className="network-live"><i/>Live</span>
        <Link className="icon-button" aria-label="Activity" href="/activity"><Icon name="bell"/></Link>
        <div className="balance"><span>Monad balance</span><strong>{identity.balance?`${identity.balance} MON`:identity.authenticated?"—":"Not connected"}</strong></div>
        {identity.authenticated&&identity.walletReady ? <button className="avatar-button" onClick={identity.logout} aria-label={`Sign out ${accountName}`} title={`${accountName} · Sign out`}>{accountAvatar}</button> : <button className="connect-button" onClick={identity.login} disabled={!identity.ready}>{identity.ready?"Connect wallet":"Loading…"}</button>}
      </div>
    </header>
    <div className="app-grid">
      <aside className="left-rail">
        <nav className="side-nav" aria-label="App sections">
          <p className="eyebrow">Navigation</p>
          {nav.map((item,index)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><b>{String(index+1).padStart(2,"0")}</b><Icon name={item.icon}/><span>{item.label}</span><i>→</i></Link>)}
        </nav>
        <div className="reputation-mini">
          <p className="eyebrow">Scout reputation</p><div><span>Verified signal score</span><strong>{identity.authenticated?score:"—"}</strong></div>
          <div className="mini-progress"><i style={{width:`${Math.min(100,score/10)}%`}}/></div>
          <p>{identity.authenticated?`${dashboard?.calls??0} onchain calls`:"Connect to build reputation"}</p>
        </div>
        <Link className="evidence-link" href="/evidence"><Icon name="spark"/><span><strong>Judge evidence</strong><small>Live system proof</small></span><i>→</i></Link>
        <Link className="side-profile" href="/profile">{identity.farcaster?<Avatar name={accountName} src={identity.farcaster.avatarUrl} size={38}/>:<span className="wallet-avatar-fallback"><Icon name="profile"/></span>}<span><strong>{accountName}</strong><small>{identity.authenticated?identity.chainReady?"Monad Testnet":"Switching network":"Wallet not connected"}</small></span>{identity.authenticated&&<span className="online-dot"/>}</Link>
      </aside>
      <main className="main-content" id="main-content" tabIndex={-1}>{children}<footer className="site-footer"><span>© 2026 Dibs · Social discovery on Monad testnet</span><nav aria-label="Product and trust links"><Link href="/evidence">Evidence</Link><Link href="/privacy">Privacy</Link><a href="https://github.com/SuyashAlphaC/Dibs" target="_blank" rel="noreferrer">Source</a><a href="https://github.com/SuyashAlphaC/Dibs/issues" target="_blank" rel="noreferrer">Contact</a><a href="/.well-known/security.txt">Security</a></nav></footer></main>
      <aside className="right-rail">
        <div className="rail-heading"><div>Conviction <em>tape</em></div><Link href="/activity">Full ledger</Link></div>
        <p className="rail-kicker">Latest scouts putting MON behind an early call.</p>
        <div className="moment-row" role="list" tabIndex={0} aria-label="Recent onchain scout positions">{scoutSignals.map(signal=>{const label=signal.identity?.username?`@${signal.identity.username}`:signal.identity?.displayName||shortScout(signal.scout);return <Link role="listitem" aria-label={`Open scout ${label}`} title={`${label} · ${signal.spent.toFixed(3)} MON committed`} href={`/scout/${signal.scout}`} key={signal.scout}><Avatar name={label} src={signal.identity?.avatarUrl} size={38}/><span>{label.replace(/^@/,"").slice(0,8)}</span><small>{signal.spent.toFixed(3)}</small></Link>;})}{!scoutSignals.length&&<span className="moment-empty">No scout positions yet</span>}</div>
        <div className="rank-logic"><span>How the feed ranks</span><strong>Scout conviction</strong><i>sets discovery rank</i><strong>Quality attention</strong><i>settles the outcome</i></div>
        <p className="rail-section-label">Signal sectors</p>
        <div className="topic-cloud">{(topics.length?topics:["Farcaster","AI","Culture","Crypto","Builders"]).map(topic=><Link href={`/discover?topic=${encodeURIComponent(topic)}`} key={topic}>{topic}</Link>)}</div>
        <p className="rail-section-label">Markets closing next</p>
        <div className="closing-list">{markets.slice().sort((a,b)=>a.timeLeftMinutes-b.timeLeftMinutes).slice(0,2).map(market=><Link href={`/market/${market.id}`} className="closing-card" key={market.id}><span className="status-pill active"><i/>Live</span><strong>{market.author.displayName}</strong><p>{market.text.slice(0,76)}{market.text.length>76?"…":""}</p><small>{market.timeLeftMinutes?`${Math.floor(market.timeLeftMinutes/60)}h ${market.timeLeftMinutes%60}m left`:market.status}</small></Link>)}</div>
        <div className="rail-summary"><span>Your open conviction</span><strong>{(dashboard?.spent??0).toFixed(3)} MON</strong><div><span>Verified scout rewards</span><b>{(dashboard?.claimed??0).toFixed(3)} MON</b></div></div>
      </aside>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
  </div>;
}
