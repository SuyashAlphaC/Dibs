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
  {href:"/activity",label:"Activity",icon:"activity" as const},
  {href:"/profile",label:"Scouts",icon:"profile" as const},
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
      <Link href="/discover" className="brand" aria-label="Dibs home"><img className="brand-logo" src="/dibs_logo.png" alt="Dibs"/></Link>
      <nav className="topnav" aria-label="Primary navigation">
        {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}>{item.label}</Link>)}
      </nav>
      <div className="topbar-actions">
        <label className="header-search"><Icon name="discover"/><input aria-label="Search casts and scouts" placeholder="Search casts, scouts…"/></label>
        <span className="network-live"><i/>Live</span>
        <Link className="icon-button" aria-label="Activity" href="/activity"><Icon name="bell"/></Link>
        <div className="balance"><span>Monad balance</span><strong>{identity.balance?`${identity.balance} MON`:identity.authenticated?"—":"Not connected"}</strong></div>
        {identity.authenticated&&identity.walletReady ? <button className="avatar-button" onClick={identity.logout} title={`${shortAddress} · Sign out`}><Avatar name={identity.address??"Wallet"} size={34}/></button> : <button className="connect-button" onClick={identity.login} disabled={!identity.ready}>{identity.ready?"Connect wallet":"Loading…"}</button>}
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
        <div className="scout-assistant"><span><Icon name="spark"/></span><p className="eyebrow">Scout assistant</p><strong>Find the next early opportunity.</strong><Link href="/discover?mode=early">Explore <Icon name="arrow"/></Link></div>
        <Link className="side-profile" href="/profile"><Avatar name={identity.address??"Guest"} size={38}/><span><strong>{shortAddress??"Guest scout"}</strong><small>{identity.authenticated?identity.chainReady?"Monad Testnet":"Switching network":"Wallet not connected"}</small></span>{identity.authenticated&&<span className="online-dot"/>}</Link>
      </aside>
      <main className="main-content">{children}</main>
      <aside className="right-rail">
        <div className="rail-heading"><div>Your Dibs</div><Link href="/dibs">View all</Link></div>
        <div className="allocation-card"><div className="allocation-ring" style={{"--allocation":`${Math.min(86,Math.max(14,(dashboard?.spent??0)*24))}%`} as React.CSSProperties}><span><strong>{(dashboard?.spent??0).toFixed(2)}</strong><small>MON active</small></span></div><div><p className="eyebrow">Conviction allocation</p><strong>{positions.length} active market{positions.length===1?"":"s"}</strong><small>Signals backed on Monad</small></div></div>
        <p className="rail-section-label">Active markets</p>
        <div className="position-list">
          {positions.slice(0,4).map((position,index)=><Link className="position-card" href={`/market/${position.market.id}`} key={position.market.id}>
            <div className="position-top"><span><Avatar name={position.market.author.displayName} src={position.market.author.avatarUrl} size={26}/><strong>@{position.market.author.username}</strong></span><b>{position.spent.toFixed(2)} MON</b></div>
            <i><span style={{width:`${Math.max(22,100-index*19)}%`}}/></i>
          </Link>)}
          {!positions.length&&<div className="rail-empty"><strong>{identity.authenticated?"No active Dibs yet":"Connect your wallet"}</strong><p>{identity.authenticated?"Your first confirmed signal will appear here.":"See your live positions and rewards."}</p></div>}
        </div>
        <div className="rail-summary">
          <span>Conviction placed</span><strong>{(dashboard?.spent??0).toFixed(3)} MON</strong>
          <div><span>Rewards claimed</span><b>{(dashboard?.claimed??0).toFixed(3)} MON</b></div>
        </div>
        <div className="protocol-note"><Icon name="spark"/><p><strong>Signal, not popularity.</strong><br/>Quality recognized before consensus builds your reputation.</p></div>
      </aside>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
  </div>;
}
