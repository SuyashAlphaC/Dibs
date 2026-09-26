"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useIdentity} from "@/components/identity-provider";
import {useScoutDashboard} from "@/components/use-scout-dashboard";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";

const nav = [
  {href:"/discover",label:"Discover",icon:"discover" as const},
  {href:"/dibs",label:"My Dibs",icon:"dibs" as const},
  {href:"/profile",label:"Reputation",icon:"profile" as const},
  {href:"/activity",label:"Activity",icon:"activity" as const},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const identity = useIdentity();
  const {dashboard}=useScoutDashboard(identity.address);
  const shortAddress=identity.address?.match(/^0x[a-fA-F0-9]{40}$/)?`${identity.address.slice(0,6)}…${identity.address.slice(-4)}`:identity.address;
  const score=dashboard?Math.min(999,Math.round(dashboard.hitRate*8+Math.min(dashboard.calls,199))):0;
  const positions=dashboard?.positions??[];
  return <div className="app-frame">
    <header className="topbar">
      <Link href="/discover" className="brand" aria-label="Dibs home"><span className="brand-mark">D</span><span>DIBS</span><i>Monad Metropolis</i></Link>
      <nav className="topnav" aria-label="Primary navigation">
        {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}>{item.label}</Link>)}
      </nav>
      <div className="topbar-actions">
        <span className="network-live"><i/>Live</span>
        <Link className="icon-button" aria-label="Activity" href="/activity"><Icon name="bell"/></Link>
        <div className="balance"><span>Monad balance</span><strong>{identity.balance?`${identity.balance} MON`:identity.authenticated?"—":"Not connected"}</strong></div>
        {identity.authenticated&&identity.walletReady ? <button className="avatar-button" onClick={identity.logout} title={`${shortAddress} · Sign out`}><Avatar name={identity.address??"Wallet"} size={34}/></button> : <button className="connect-button" onClick={identity.login} disabled={!identity.ready}>{identity.ready?"Connect wallet":"Loading…"}</button>}
      </div>
    </header>
    <div className="network-stream"><strong><span/>Protocol stream</strong><p>Monad Testnet · Market #1 open · Envio indexing live · Quality-weighted CRE settlement</p></div>
    <div className="app-grid">
      <aside className="left-rail">
        <nav className="side-nav" aria-label="App sections">
          <p className="eyebrow">Workspace</p>
          {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}
        </nav>
        <div className="discovery-block">
          <p className="eyebrow">Discovery rails</p>
          <Link href="/discover?mode=trending">Trending <span>↗</span></Link>
          <Link href="/discover?mode=early">Early discovery <span>&lt;30m</span></Link>
          <Link href="/discover?mode=opened">Just opened <span>New</span></Link>
          <Link href="/discover?mode=community">Farcaster <span>Live</span></Link>
        </div>
        <div className="reputation-mini">
          <p className="eyebrow">Scout metric alpha</p><div><span>Signal score</span><strong>{identity.authenticated?score:"—"}</strong></div>
          <div className="mini-progress"><i style={{width:`${Math.min(100,score/10)}%`}}/></div>
          <p>{identity.authenticated?`${dashboard?.calls??0} onchain calls`:"Connect to build reputation"}</p>
        </div>
        <Link className="side-profile" href="/profile"><Avatar name={identity.address??"Guest"} size={38}/><span><strong>{shortAddress??"Guest scout"}</strong><small>{identity.authenticated?identity.chainReady?"Monad Testnet":"Switching network":"Wallet not connected"}</small></span>{identity.authenticated&&<span className="online-dot"/>}</Link>
      </aside>
      <main className="main-content">{children}</main>
      <aside className="right-rail">
        <div className="rail-heading"><div><span className="live-dot"/> Your Dibs</div><Link href="/dibs">View all</Link></div>
        <div className="position-list">
          {positions.slice(0,2).map((position)=><Link className="position-card" href={`/market/${position.market.id}`} key={position.market.id}>
            <div className="position-top"><strong>{position.market.author.displayName}</strong><span>#{position.market.rank}</span></div>
            <p>{position.market.text.slice(0,72)}{position.market.text.length>72?"…":""}</p>
            <div className="position-meta"><span>{position.units} unit{position.units===1?"":"s"}</span><strong>{position.claimed?`+${position.claimed.toFixed(3)}`:"Active"}</strong></div>
          </Link>)}
          {!positions.length&&<div className="rail-empty"><strong>{identity.authenticated?"No active Dibs yet":"Connect your wallet"}</strong><p>{identity.authenticated?"Your first confirmed signal will appear here.":"See your live positions and rewards."}</p></div>}
        </div>
        <div className="rail-summary">
          <span>Conviction placed</span><strong>{(dashboard?.spent??0).toFixed(3)} MON</strong>
          <div><span>Rewards claimed</span><b>{(dashboard?.claimed??0).toFixed(3)} MON</b></div>
        </div>
        <div className="protocol-note"><Icon name="spark"/><p><strong>Signal, not popularity.</strong><br/>Dibs rewards people who recognize quality before consensus.</p></div>
      </aside>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
  </div>;
}
