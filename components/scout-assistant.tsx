"use client";

import Link from "next/link";
import {useEffect,useMemo,useState} from "react";
import {createPortal} from "react-dom";
import {Avatar} from "@/components/shared/avatar";
import {Icon} from "@/components/shared/icons";
import type {CastMarket} from "@/lib/types";

type ScanMode="early"|"momentum"|"closing";

function rankMarket(market:CastMarket,mode:ScanMode){
  if(mode==="early")return Math.max(0,30-market.ageMinutes)*5+market.movementPercent+market.newScouts;
  if(mode==="closing")return Math.max(0,1440-market.timeLeftMinutes)+market.totalStaked*10;
  return market.movementPercent*3+market.newScouts*2+market.totalStaked;
}

export function ScoutAssistant({markets}:{markets:CastMarket[]}){
  const [open,setOpen]=useState(false);
  const [mode,setMode]=useState<ScanMode>("early");
  useEffect(()=>{
    if(!open)return;
    const close=(event:KeyboardEvent)=>event.key==="Escape"&&setOpen(false);
    const previousOverflow=document.documentElement.style.overflow;
    document.documentElement.style.overflow="hidden";
    window.addEventListener("keydown",close);
    return()=>{
      window.removeEventListener("keydown",close);
      document.documentElement.style.overflow=previousOverflow;
    };
  },[open]);
  const eligible=useMemo(()=>markets.filter(market=>market.status==="active"||market.status==="closing"),[markets]);
  const recommendation=useMemo(()=>eligible.slice().sort((a,b)=>rankMarket(b,mode)-rankMarket(a,mode))[0],[eligible,mode]);
  const reason=mode==="early"?"Best combination of low age and early scout activity.":mode==="closing"?"Strongest conviction among markets nearest to close.":"Highest current momentum and scout velocity.";
  return <>
    <aside className="scout-assistant" aria-label="Scout Assistant recommendation">
      <div className="assistant-rail-head">
        <button className="assistant-orb" onClick={()=>setOpen(true)} aria-label="Open Scout Assistant" aria-haspopup="dialog" aria-expanded={open}><Icon name="spark"/></button>
        <div><p className="eyebrow">Scout assistant</p><strong>{recommendation?`${mode} signal`:`Scanning signals`}</strong></div>
        <span className="assistant-live"><i/>Live</span>
      </div>
      {recommendation?<>
        <Link className="assistant-rail-pick" href={`/market/${recommendation.id}`}>
          <Avatar name={recommendation.author.displayName} src={recommendation.author.avatarUrl} size={30}/>
          <span><strong>{recommendation.author.displayName}</strong><small>{Math.floor(recommendation.timeLeftMinutes/60)}h {recommendation.timeLeftMinutes%60}m left · {recommendation.totalStaked.toFixed(3)} MON</small></span>
          <b>#{recommendation.rank}</b>
        </Link>
        <p className="assistant-rail-reason">{recommendation.whyRising||reason}</p>
        <div className="assistant-rail-actions"><Link href={`/market/${recommendation.id}`}>Inspect pick <Icon name="arrow"/></Link><button onClick={()=>setOpen(true)}>Change scan</button></div>
      </>:<div className="assistant-rail-empty"><span className="loading-orbit"/><span><strong>Scanning Envio</strong><small>Waiting for a live market signal.</small></span></div>}
    </aside>
    {open&&typeof document!=="undefined"&&createPortal(<div className="assistant-backdrop" onMouseDown={event=>event.target===event.currentTarget&&setOpen(false)}><section className="assistant-panel" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
      <header><div><p className="eyebrow">Live signal scan</p><h2 id="assistant-title">Scout Assistant</h2></div><button onClick={()=>setOpen(false)} aria-label="Close Scout Assistant"><Icon name="close"/></button></header>
      <p className="assistant-intro">A transparent rules-based scan of live Envio markets. It never stakes or signs for you.</p>
      <div className="assistant-modes" role="tablist" aria-label="Signal scan mode">{(["early","momentum","closing"] as ScanMode[]).map(item=><button role="tab" aria-selected={mode===item} className={mode===item?"active":""} onClick={()=>setMode(item)} key={item}>{item}</button>)}</div>
      {recommendation?<article className="assistant-pick"><div className="assistant-author"><Avatar name={recommendation.author.displayName} src={recommendation.author.avatarUrl} size={42}/><span><strong>{recommendation.author.displayName}</strong><small>@{recommendation.author.username} · {recommendation.ageMinutes}m</small></span><b>#{recommendation.rank}</b></div><p>{recommendation.text}</p><div className="assistant-facts"><span><small>Conviction</small><strong>{recommendation.totalStaked.toFixed(3)} MON</strong></span><span><small>Scouts</small><strong>{recommendation.newScouts}</strong></span><span><small>Momentum</small><strong>+{Math.max(0,recommendation.movementPercent)}%</strong></span></div><div className="assistant-why"><Icon name="trend"/><span><strong>Why this signal</strong>{reason}</span></div><Link href={`/market/${recommendation.id}`} onClick={()=>setOpen(false)}>Inspect market <span>→</span></Link></article>:<div className="assistant-empty"><span className="loading-orbit"/><strong>Scanning live markets…</strong><p>The recommendation will appear as soon as Envio returns an active signal.</p></div>}
      <footer><span><i/> Envio live data</span><small>Decision support only · wallet confirmation always required</small></footer>
    </section></div>,document.body)}
  </>;
}
