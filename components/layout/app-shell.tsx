"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useEffect,useState} from "react";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import type {CastMarket} from "@/lib/types";
import {ScoutAssistant} from "@/components/scout-assistant";

const nav = [
  {href:"/discover",label:"Discover",icon:"discover" as const},
  {href:"/dibs",label:"My Dibs",icon:"dibs" as const},
  {href:"/activity",label:"Activity",icon:"activity" as const},
  {href:"/profile",label:"Scouts",icon:"profile" as const},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const identity = useIdentity();
  const {dashboard}=useScoutDashboard(identity.address);
  const [markets,setMarkets]=useState<CastMarket[]>([]);
  const shortAddress=identity.address?.match(/^0x[a-fA-F0-9]{40}$/)?`${identity.address.slice(0,6)}…${identity.address.slice(-4)}`:identity.address;
  const score=dashboard?Math.min(999,Math.round(dashboard.hitRate*8+Math.min(dashboard.calls,199))):0;
  const positions=dashboard?.positions??[];
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/casts",{signal:controller.signal}).then(response=>response.json()).then((payload:{casts?:CastMarket[]})=>setMarkets(payload.casts??[])).catch(()=>{});
    return()=>controller.abort();
  },[]);
  const topics=Array.from(new Set(markets.map(market=>market.category))).slice(0,7);
  const momentMarkets=Array.from(new Map(markets.map(market=>[market.author.fid||market.author.username,market])).values());
  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Skip to discovery content</a>
    <header className="topbar">
      <Link href="/discover" className="brand" aria-label="Dibs home"><img className="brand-logo" src="/dibs_logo.png" alt="Dibs Farcaster discovery" width="92" height="54" decoding="async" fetchPriority="high"/></Link>
      <nav className="topnav" aria-label="Primary navigation">
        {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}>{item.label}</Link>)}
      </nav>
      <div className="topbar-actions">
        <label className="header-search"><Icon name="discover"/><input type="search" autoComplete="off" aria-label="Search casts and scouts" placeholder="Search casts, scouts…"/></label>
        <span className="network-live"><i/>Live</span>
        <Link className="icon-button" aria-label="Activity" href="/activity"><Icon name="bell"/></Link>
        <div className="balance"><span>Monad balance</span><strong>{identity.balance?`${identity.balance} MON`:identity.authenticated?"—":"Not connected"}</strong></div>
        {identity.authenticated&&identity.walletReady ? <button className="avatar-button" onClick={identity.logout} aria-label={`Sign out wallet ${shortAddress}`} title={`${shortAddress} · Sign out`}><Avatar name={identity.address??"Wallet"} size={34}/></button> : <button className="connect-button" onClick={identity.login} disabled={!identity.ready}>{identity.ready?"Connect wallet":"Loading…"}</button>}
      </div>
    </header>
    <div className="app-grid">
      <aside className="left-rail">
        <div className="mode-switch"><Link className={pathname.startsWith("/discover")?"active":""} href="/discover">Discover</Link><Link className={pathname.startsWith("/dibs")?"active":""} href="/dibs">My Dibs</Link></div>
        <nav className="side-nav" aria-label="App sections">
          <p className="eyebrow">Navigation</p>
          {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}
        </nav>
        <div className="reputation-mini">
          <p className="eyebrow">Scout metric alpha</p><div><span>Signal score</span><strong>{identity.authenticated?score:"—"}</strong></div>
          <div className="mini-progress"><i style={{width:`${Math.min(100,score/10)}%`}}/></div>
          <p>{identity.authenticated?`${dashboard?.calls??0} onchain calls`:"Connect to build reputation"}</p>
        </div>
        <ScoutAssistant markets={markets}/>
        <Link className="side-profile" href="/profile"><Avatar name={identity.address??"Guest"} size={38}/><span><strong>{shortAddress??"Guest scout"}</strong><small>{identity.authenticated?identity.chainReady?"Monad Testnet":"Switching network":"Wallet not connected"}</small></span>{identity.authenticated&&<span className="online-dot"/>}</Link>
      </aside>
      <main className="main-content" id="main-content" tabIndex={-1}>{children}<footer className="site-footer"><span>© 2026 Dibs · Social discovery on Monad</span><nav aria-label="Product and trust links"><Link href="/privacy">Privacy</Link><a href="https://github.com/SuyashAlphaC/Dibs" target="_blank" rel="noreferrer">Source</a><a href="https://github.com/SuyashAlphaC/Dibs/issues" target="_blank" rel="noreferrer">Contact</a><a href="/.well-known/security.txt">Security</a></nav></footer></main>
      <aside className="right-rail">
        <div className="rail-heading"><div>Moments <em>&amp; Signals</em></div><Link href="/discover">View all</Link></div>
        <div className="moment-row" role="list" tabIndex={0} aria-label="Moments from live scouts">{momentMarkets.map(market=><Link role="listitem" aria-label={`Open ${market.author.displayName}'s moment`} title={market.author.displayName} href={`/market/${market.id}`} key={`${market.author.fid}-${market.id}`}><Avatar name={market.author.displayName} src={market.author.avatarUrl} size={38}/><span>{market.author.displayName.split(" ")[0]}</span></Link>)}{!markets.length&&["D","I","B","S"].map(letter=><span className="moment-placeholder" key={letter}>{letter}</span>)}</div>
        <p className="rail-section-label">Trending topics</p>
        <div className="topic-cloud">{(topics.length?topics:["Farcaster","AI","Culture","Crypto","Builders"]).map(topic=><Link href={`/discover?topic=${encodeURIComponent(topic)}`} key={topic}>#{topic.toLowerCase().replaceAll(" ","")}</Link>)}</div>
        <p className="rail-section-label">Closing soon</p>
        <div className="closing-list">{markets.slice().sort((a,b)=>a.timeLeftMinutes-b.timeLeftMinutes).slice(0,2).map(market=><Link href={`/market/${market.id}`} className="closing-card" key={market.id}><span className="status-pill active"><i/>Live</span><strong>{market.author.displayName}</strong><p>{market.text.slice(0,76)}{market.text.length>76?"…":""}</p><small>{market.timeLeftMinutes?`${Math.floor(market.timeLeftMinutes/60)}h ${market.timeLeftMinutes%60}m left`:market.status}</small></Link>)}</div>
        <div className="rail-summary"><span>Your conviction</span><strong>{(dashboard?.spent??0).toFixed(3)} MON</strong><div><span>Rewards claimed</span><b>{(dashboard?.claimed??0).toFixed(3)} MON</b></div></div>
      </aside>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
  </div>;
}
