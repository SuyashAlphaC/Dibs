"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useIdentity} from "@/components/identity-provider";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import {activePositions} from "@/lib/mock/markets";

const nav = [
  {href:"/discover",label:"Discover",icon:"discover" as const},
  {href:"/dibs",label:"My Dibs",icon:"dibs" as const},
  {href:"/activity",label:"Activity",icon:"activity" as const},
  {href:"/profile",label:"Profile",icon:"profile" as const},
];

export function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const identity = useIdentity();
  return <div className="app-frame">
    <header className="topbar">
      <Link href="/discover" className="brand" aria-label="Dibs home"><span className="brand-mark">D</span><span>DIBS</span></Link>
      <nav className="topnav" aria-label="Primary navigation">
        {nav.slice(0,3).map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}>{item.label}</Link>)}
      </nav>
      <div className="topbar-actions">
        <button className="icon-button" aria-label="Notifications"><Icon name="bell"/></button>
        <div className="balance"><span>Balance</span><strong>12.40 MON</strong></div>
        {identity.authenticated ? <button className="avatar-button" onClick={identity.logout} title="Sign out"><Avatar name="Alex Morgan" size={34}/></button> : <button className="connect-button" onClick={identity.login}>Sign in</button>}
      </div>
    </header>
    <div className="app-grid">
      <aside className="left-rail">
        <nav className="side-nav" aria-label="App sections">
          <p className="eyebrow">Explore</p>
          {nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span>{item.label==="Activity"&&<i>3</i>}</Link>)}
        </nav>
        <div className="discovery-block">
          <p className="eyebrow">Discovery</p>
          <Link href="/discover?mode=trending">Trending <span>48</span></Link>
          <Link href="/discover?mode=early">Early signals <span>21</span></Link>
          <Link href="/discover?mode=opened">Just opened <span>12</span></Link>
          <Link href="/discover?mode=community">Community <span>36</span></Link>
        </div>
        <div className="reputation-mini">
          <div><span>Your signal</span><strong>742</strong></div>
          <div className="mini-progress"><i/></div>
          <p>Top 12% of scouts</p>
        </div>
        <Link className="side-profile" href="/profile"><Avatar name="Alex Morgan" size={38}/><span><strong>Alex.eth</strong><small>@alex</small></span><span className="online-dot"/></Link>
      </aside>
      <main className="main-content">{children}</main>
      <aside className="right-rail">
        <div className="rail-heading"><div><span className="live-dot"/> Active Dibs</div><Link href="/dibs">View all</Link></div>
        <div className="position-list">
          {activePositions.slice(0,2).map((position)=><Link className="position-card" href={`/market/${position.marketId}`} key={position.marketId}>
            <div className="position-top"><strong>{position.author}</strong><span>#{position.currentRank}</span></div>
            <p>{position.excerpt}</p>
            <div className="position-meta"><span>Entry #{position.entryRank}</span><strong>+{position.potentialReward.toFixed(2)} MON</strong></div>
          </Link>)}
        </div>
        <div className="rail-summary">
          <span>Active conviction</span><strong>0.40 MON</strong>
          <div><span>Potential return</span><b>7.25 MON</b></div>
        </div>
        <div className="protocol-note"><Icon name="spark"/><p><strong>Signal, not popularity.</strong><br/>Dibs rewards people who recognize quality before consensus.</p></div>
      </aside>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{nav.map((item)=><Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?"active":""}><Icon name={item.icon}/><span>{item.label}</span></Link>)}</nav>
  </div>;
}
