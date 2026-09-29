"use client";

import Link from "next/link";
import {useRef,useState} from "react";
import {Avatar} from "@/components/shared/avatar";
import {formatAgeMinutes} from "@/lib/time";
import type {CastMarket} from "@/lib/types";

export function MobileDibsStack({markets,onDibs}:{markets:CastMarket[];onDibs:(market:CastMarket)=>void}){
  const [index,setIndex]=useState(0);
  const [holding,setHolding]=useState(false);
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const market=markets[Math.min(index,Math.max(0,markets.length-1))];
  const cancel=()=>{if(timer.current)clearTimeout(timer.current);timer.current=null;setHolding(false);};
  const begin=()=>{
    if(!market||market.userHasDibs||!['active','closing'].includes(market.status))return;
    cancel();setHolding(true);
    timer.current=setTimeout(()=>{setHolding(false);timer.current=null;onDibs(market);},850);
  };
  if(!market)return <div className="stack-empty">No signals match this scan.</div>;
  const scout=market.scoutPreview?.[0];
  return <section className="dibs-stack" aria-label="Mobile Dibs Stack">
    <header><span>{String(index+1).padStart(2,"0")} / {String(markets.length).padStart(2,"0")}</span><strong>You&apos;d be scout #{market.newScouts+1}</strong></header>
    <div className="stack-author"><Avatar name={market.author.displayName} src={market.author.avatarUrl} size={44}/><div><strong>{market.author.displayName}</strong><span>@{market.author.username} · {formatAgeMinutes(market.ageMinutes)}</span></div></div>
    <Link href={`/market/${market.id}`} className="stack-cast">{market.text}</Link>
    <div className="stack-social"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span></div>
    <div className="stack-proof">{scout&&<Avatar name={scout.displayName} src={scout.avatarUrl} size={26}/>}<span>{scout?(scout.username?`@${scout.username}`:scout.displayName):"No scout yet"}{market.newScouts>1?` + ${market.newScouts-1} more`:""}</span></div>
    <div className="stack-early"><p>Earliness check</p><div><span>Cast age<strong>{formatAgeMinutes(market.ageMinutes)}</strong></span><span>Scouts<strong>{market.newScouts}</strong></span><span>Entry<strong>Unit #{market.totalUnits+1}</strong></span></div></div>
    <div className="stack-price"><span>Next conviction unit</span><strong>{market.nextUnitCost.toFixed(3)} MON</strong><small>Upside is quality-settled—not guaranteed.</small></div>
    <button className={`hold-dibs ${holding?"is-holding":""}`} disabled={market.userHasDibs||!['active','closing'].includes(market.status)} onPointerDown={begin} onPointerUp={cancel} onPointerCancel={cancel} onPointerLeave={cancel}><i/>{market.userHasDibs?"Dibs called":`Hold to call Dibs · ${market.nextUnitCost.toFixed(3)} MON`}</button>
    <nav><button disabled={index===0} onClick={()=>setIndex(value=>Math.max(0,value-1))}>← Previous</button><button disabled={index===markets.length-1} onClick={()=>setIndex(value=>Math.min(markets.length-1,value+1))}>Next signal →</button></nav>
  </section>;
}
