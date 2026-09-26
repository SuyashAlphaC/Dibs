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
  const [stakeState,setStakeState]=useState<"idle"|"pending"|"success"|"error">(market.userHasDibs?"success":"idle");
  const [stakeError,setStakeError]=useState("");
  async function callDibs(){
    if(!isOnchainMarket)return;
    if(!identity.authenticated||!identity.walletReady){identity.login();return;}
    setStakeState("pending");
    try{
      const transaction=await scoutTransaction(market.id);
      await identity.sendStake(transaction);
      setStakeState("success");
    }catch(error){
      const message=error instanceof Error&&/rejected|denied|cancelled/i.test(error.message)
        ?"You cancelled the wallet request. Nothing was charged."
        :error instanceof Error&&/fund|balance/i.test(error.message)
          ?"This wallet does not have enough MON for the transaction."
          :"The transaction did not confirm. Nothing was recorded by Dibs.";
      setStakeError(message);setStakeState("error");
    }
  }
  const nextUnits=Array.from({length:4},(_,index)=>({
    unit:market.totalUnits+index+1,
    price:market.nextUnitCost+(index*.001),
  }));
  return <div className="detail-page">
    <div className="market-command"><Link className="back-link" href="/discover">← Back to live discovery</Link><span className={`status-pill ${market.status}`}>{market.status} · {market.timeLeftMinutes?`${market.timeLeftMinutes}m left`:"window complete"}</span><strong>Market #{market.id}</strong></div>
    <div className="detail-workspace"><div className="detail-primary">
      <section className="detail-cast"><div className="detail-author"><Avatar name={market.author.displayName} src={market.author.avatarUrl} size={50}/><div><strong>{market.author.displayName}</strong><span>@{market.author.username} · spotted {market.ageMinutes}m ago</span></div><span className="consensus-mark">Scout consensus<br/><b>Live signal</b></span></div><p>{market.text}</p><div className="social-proof"><span>♡ {market.likes}</span><span>↻ {market.recasts}</span><span>◌ {market.replies}</span><span>{market.category}</span></div></section>
      {market.status==="challenged"&&<div className="challenge-banner"><Icon name="clock"/><div><strong>This market is under review</strong><p>Settlement is paused while the protocol checks an abnormal engagement pattern. Your position remains safe.</p></div></div>}
      <section className="detail-metrics"><div><span>Onchain conviction</span><strong>{market.totalStaked.toFixed(3)} MON</strong><small>{market.totalUnits} conviction units</small></div><div><span>Market rank</span><strong>#{market.rank}</strong><small>{market.rankDelta>0?`↑ ${market.rankDelta} places`:"Live index"}</small></div><div><span>Scouts</span><strong>{market.newScouts}</strong><small>Unique wallets</small></div><div><span>Closes in</span><strong>{market.timeLeftMinutes||"—"}m</strong><small>{market.status}</small></div></section>
      <section className="chart-panel"><div className="panel-heading"><div><p className="eyebrow">Conviction pricing curve</p><h2>Earlier conviction costs less.</h2></div><span className="data-chip">Deterministic · onchain</span></div><div className="curve-terminal"><div><span>Current supply</span><strong>{market.totalUnits}</strong><small>units</small></div><svg viewBox="0 0 700 190" role="img" aria-label="Deterministic linear conviction pricing curve"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8B5CF6" stopOpacity=".32"/><stop offset="1" stopColor="#8B5CF6" stopOpacity="0"/></linearGradient></defs><g className="grid-lines"><path d="M0 40H700M0 100H700M0 160H700"/></g><path className="area" d="M0 168L700 24V190H0Z"/><path className="chart-line" d="M0 168L700 24"/><circle cx="175" cy="132" r="4"/><circle cx="350" cy="96" r="4"/><circle cx="525" cy="60" r="4"/><circle cx="700" cy="24" r="5"/></svg></div><div className="curve-tiers">{nextUnits.map((item,index)=><div className={index===0?"active":""} key={item.unit}><span>{index===0?"Next":"Then"} · unit {item.unit}</span><strong>{item.price.toFixed(3)} MON</strong></div>)}</div></section>
      <section className="leaderboard"><div className="panel-heading"><div><p className="eyebrow">Early scout ledger</p><h2>Onchain participation</h2></div><span>{isOnchainMarket?"Envio indexed":"Preview"}</span></div>{market.newScouts?<div className="leader-row"><span>1</span><span className="scout-avatar">D</span><strong>{market.newScouts} unique scouts</strong><span>{market.totalUnits} units</span><b>{market.totalStaked.toFixed(3)} MON</b></div>:<div className="ledger-empty"><strong>The first position is open.</strong><p>Be the first wallet recorded in this market&apos;s scout ledger.</p></div>}</section>
    </div><aside className="stake-panel sticky-stake"><p className="eyebrow">Claim your Dibs</p><h2>Back the signal.</h2><p>One transaction buys one conviction unit at the contract&apos;s live quote.</p><div><span>Next unit</span><strong>{market.nextUnitCost.toFixed(3)} MON</strong></div><div><span>Wallet balance</span><strong>{identity.balance?`${identity.balance} MON`:"—"}</strong></div><div><span>Current rank</span><strong>#{market.rank}</strong></div><button className="primary-button" disabled={!identity.ready||!isOnchainMarket||stakeState==="pending"||stakeState==="success"||market.status==="closed"||market.status==="settled"||market.status==="challenged"} onClick={callDibs}>{!identity.ready?"Loading wallet…":!isOnchainMarket?"Preview market · view only":stakeState==="success"?"Dibs called ✓":stakeState==="pending"?"Confirming on Monad…":identity.authenticated&&identity.walletReady?`Claim Dibs · ${market.nextUnitCost.toFixed(3)} MON`:"Connect wallet to claim Dibs"}</button><small>{!isOnchainMarket?"Live staking appears after Envio publishes the market.":stakeState==="error"?stakeError:"Final price is quoted from the contract before signing."}</small>{market.status==="settled"&&<Link href={`/market/${market.id}/settlement`}>View settlement →</Link>}<div className="settlement-note"><Icon name="spark"/><span>Quality-filtered settlement through Chainlink CRE and Envio.</span></div></aside></div>
  </div>;
}
