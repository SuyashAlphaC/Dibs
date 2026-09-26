"use client";
import Link from "next/link";
import {useState} from "react";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import {useIdentity} from "@/components/identity-provider";
import {scoutTransaction} from "@/lib/contract";
import type {CastMarket} from "@/lib/types";

export function MarketDetail({market}: {market:CastMarket}) {
  const identity=useIdentity();
  const isOnchainMarket=/^\d+$/.test(market.id);
  const [range,setRange]=useState("1H");
  const [stakeState,setStakeState]=useState<"idle"|"pending"|"success"|"error">(market.userHasDibs?"success":"idle");
  async function callDibs(){
    if(!isOnchainMarket)return;
    if(!identity.authenticated){identity.login();return;}
    setStakeState("pending");
    try{
      const numericId=Number(market.id);
      const transaction=Number.isFinite(numericId)?scoutTransaction(numericId,market.totalUnits):null;
      await identity.sendStake(transaction);
      setStakeState("success");
    }catch{setStakeState("error");}
  }
  return <div className="detail-page">
    <Link className="back-link" href="/discover">← Back to discovery</Link>
    <section className="detail-cast"><div className="detail-author"><Avatar name={market.author.displayName} size={50}/><div><strong>{market.author.displayName}</strong><span>@{market.author.username} · {market.ageMinutes}m ago</span></div><span className={`status-pill ${market.status}`}>{market.status}</span></div><p>{market.text}</p><div className="social-proof"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span><span>{market.category}</span></div></section>
    {market.status==="challenged"&&<div className="challenge-banner"><Icon name="clock"/><div><strong>This market is under review</strong><p>Settlement is paused while the protocol checks an abnormal engagement pattern. Your position remains safe.</p></div></div>}
    <section className="detail-metrics"><div><span>Onchain conviction</span><strong>{market.totalStaked.toFixed(3)} MON</strong><small>{market.totalUnits} conviction units</small></div><div><span>Market rank</span><strong>#{market.rank}</strong><small>{market.rankDelta>0?`↑ ${market.rankDelta} places`:"Live index"}</small></div><div><span>Scouts</span><strong>{market.newScouts}</strong><small>Unique wallets</small></div><div><span>Closes in</span><strong>{market.timeLeftMinutes||"—"}m</strong><small>{market.status}</small></div></section>
    <section className="chart-panel"><div className="panel-heading"><div><p className="eyebrow">Conviction momentum</p><h2>Attention is compounding</h2></div><div className="range-tabs">{["15M","1H","6H"].map((item)=><button key={item} className={range===item?"active":""} onClick={()=>setRange(item)}>{item}</button>)}</div></div><div className="line-chart"><svg viewBox="0 0 700 230" role="img" aria-label="Conviction score rising over time"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8B5CF6" stopOpacity=".28"/><stop offset="1" stopColor="#8B5CF6" stopOpacity="0"/></linearGradient></defs><g className="grid-lines"><path d="M0 40H700M0 100H700M0 160H700M0 220H700"/></g><path className="area" d="M0 210 C80 207 100 188 150 190 S240 173 290 176 S350 120 405 128 S470 100 520 104 S590 52 700 34 V230 H0Z"/><path className="chart-line" d="M0 210 C80 207 100 188 150 190 S240 173 290 176 S350 120 405 128 S470 100 520 104 S590 52 700 34"/><circle cx="700" cy="34" r="5"/></svg><div className="chart-labels"><span>60m ago</span><span>45m</span><span>30m</span><span>15m</span><span>Now</span></div></div></section>
    <div className="detail-grid"><section className="leaderboard"><div className="panel-heading"><div><p className="eyebrow">Market participation</p><h2>Onchain conviction</h2></div><span>{isOnchainMarket?"Live":"Preview"}</span></div><div className="leader-row"><span>1</span><span className="scout-avatar">D</span><strong>{market.newScouts} unique scouts</strong><span>{market.totalUnits} units</span><b>{market.totalStaked.toFixed(3)} MON</b></div></section><aside className="stake-panel"><p className="eyebrow">Your signal</p><h2>Call it early.</h2><p>Back this cast before the market closes. Each unit gets more expensive along the curve.</p><div><span>Next unit</span><strong>{market.nextUnitCost.toFixed(3)} MON</strong></div><div><span>Market conviction</span><strong className="positive">{market.totalStaked.toFixed(3)} MON</strong></div><button className="primary-button" disabled={!isOnchainMarket||stakeState==="pending"||stakeState==="success"||market.status==="closed"||market.status==="settled"||market.status==="challenged"} onClick={callDibs}>{!isOnchainMarket?"Preview market · view only":stakeState==="success"?"Dibs called ✓":stakeState==="pending"?"Confirming…":identity.authenticated?`Call Dibs · ${market.nextUnitCost.toFixed(3)} MON`:"Sign in to call Dibs"}</button><small>{!isOnchainMarket?"Live staking appears here after the Envio indexer publishes this market.":stakeState==="error"?"Transaction failed. Your balance was not changed.":"Price is read from the indexed onchain supply."}</small>{market.status==="settled"&&<Link href={`/market/${market.id}/settlement`}>View settlement →</Link>}</aside></div>
  </div>;
}
