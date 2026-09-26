"use client";

import {useEffect,useMemo,useState} from "react";
import {useSearchParams} from "next/navigation";
import {CastMarketCard} from "@/components/feed/cast-market-card";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import {useIdentity} from "@/components/identity-provider";
import {markets as seedMarkets} from "@/lib/mock/markets";
import type {CastMarket} from "@/lib/types";
import {scoutTransaction} from "@/lib/contract";

type ModalState = {market:CastMarket;state:"confirm"|"pending"|"error";error?:string}|null;

function transactionMessage(error:unknown){
  if(error instanceof Error){
    if(/rejected|denied|cancelled/i.test(error.message))return "You cancelled the wallet request. Nothing was charged.";
    if(/fund|balance/i.test(error.message))return "This wallet does not have enough MON for the transaction.";
    if(/network|chain/i.test(error.message))return "Switch to Monad Testnet in your wallet and try again.";
  }
  return "The transaction did not confirm. Nothing was recorded by Dibs.";
}

export function DiscoverApp() {
  const params = useSearchParams();
  const identity = useIdentity();
  const initialMode = params.get("mode") || "trending";
  const [mode,setMode] = useState(initialMode);
  const [category,setCategory] = useState("All");
  const [marketList,setMarketList] = useState(seedMarkets);
  const [dataSource,setDataSource] = useState<"demo"|"envio">("demo");
  const [modal,setModal] = useState<ModalState>(null);
  const [toast,setToast] = useState<string|null>(null);
  const [recentId,setRecentId] = useState<string|null>(null);
  const categories = ["All","AI","Crypto","Social","Culture"];
  const visible = useMemo(()=>marketList.filter((market)=>{
    if(category!=="All"&&market.category!==category)return false;
    if(mode==="opened")return market.ageMinutes<=30;
    if(mode==="early")return market.status==="active"||market.status==="closing";
    return true;
  }),[marketList,category,mode]);

  useEffect(()=>{
    const controller=new AbortController();
    const refresh=()=>{
      const query=identity.address?.match(/^0x[a-fA-F0-9]{40}$/)?`?scout=${identity.address}`:"";
      fetch(`/api/casts${query}`,{signal:controller.signal})
        .then(response=>response.json())
        .then((payload:{source:string;casts:CastMarket[]})=>{
          if(payload.source==="envio"&&payload.casts.length){setMarketList(payload.casts);setDataSource("envio");}
          else {setMarketList(seedMarkets);setDataSource("demo");}
        })
        .catch(()=>{});
    };
    refresh();
    const interval=window.setInterval(refresh,5000);
    return()=>{controller.abort();window.clearInterval(interval);};
  },[identity.address]);

  function startDibs(market:CastMarket) {
    if(!/^\d+$/.test(market.id)){
      setToast("Preview market — live staking unlocks when the Envio indexer is connected.");
      window.setTimeout(()=>setToast(null),5200);
      return;
    }
    setModal({market,state:"confirm"});
  }
  async function confirmDibs() {
    if (!modal) return;
    if (!identity.authenticated||!identity.walletReady) { identity.login(); setToast("Connect your wallet, then confirm once more to call Dibs."); return; }
    setModal({...modal,state:"pending"});
    try {
      const target = modal.market;
      const transaction=await scoutTransaction(target.id);
      await identity.sendStake(transaction);
      const updated = marketList.map((market)=>market.id===target.id?{...market,convictionScore:market.convictionScore+market.nextUnitCost,totalUnits:market.totalUnits+1,totalStaked:market.totalStaked+market.nextUnitCost,nextUnitCost:market.nextUnitCost+0.001,userHasDibs:true,userStake:market.nextUnitCost}:market).sort((a,b)=>b.totalStaked-a.totalStaked).map((market,index)=>({...market,rank:index+1,rankDelta:market.id===target.id?target.rank-(index+1):market.rankDelta}));
      const update=()=>setMarketList(updated);
      if ("startViewTransition" in document) (document as Document & {startViewTransition:(cb:()=>void)=>void}).startViewTransition(update); else update();
      const newRank=updated.find((market)=>market.id===target.id)?.rank;
      setRecentId(target.id); setModal(null); setToast(`Dibs confirmed — ${target.author.displayName} moved from #${target.rank} to #${newRank}.`);
      window.setTimeout(()=>setRecentId(null),2400); window.setTimeout(()=>setToast(null),5200);
    } catch(error) { setModal({...modal,state:"error",error:transactionMessage(error)}); }
  }

  return <>
    <section className="discover-hero">
      <div><div className="section-kicker"><span className={dataSource==="envio"?"live-dot":""}/> {dataSource==="envio"?"Live discovery":"Curated preview"}</div><h1>Spot what matters<br/><em>before everyone else.</em></h1><p>Back emerging ideas with conviction. Build a reputation for being early.</p></div>
      <div className="hero-stat"><span>{dataSource==="envio"?"Markets live":"Preview markets"}</span><strong>{marketList.filter(m=>m.status==="active"||m.status==="closing").length}</strong><small>{dataSource==="envio"?"Indexed on Monad":"Live contract deployed on Monad"}</small></div>
    </section>
    <div className="ticker" aria-label="Live market updates"><span>LIVE</span><div><b>AI agents</b> +31%</div><div><b>Consumer crypto</b> +24%</div><div><b>Social graphs</b> +14%</div></div>
    <section className="feed-controls">
      <div className="mode-tabs">{["trending","early","opened"].map((item)=><button key={item} className={mode===item?"active":""} onClick={()=>setMode(item)}>{item==="opened"?"Just opened":item}</button>)}</div>
      <div className="category-filter">{categories.map((item)=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    </section>
    <div className="feed-label"><span>{visible.length} signals</span><span>{dataSource==="envio"?"Ranked by onchain conviction":"Preview data · staking disabled"}</span></div>
    <section className="market-feed">{visible.map((market)=><CastMarketCard key={market.id} market={market} onDibs={startDibs} justDibsed={recentId===market.id}/>)}</section>
    {modal&&<div className="modal-backdrop" role="presentation" onMouseDown={(event)=>event.target===event.currentTarget&&setModal(null)}><section className="dibs-modal" role="dialog" aria-modal="true" aria-labelledby="dibs-title">
      <button className="modal-close" onClick={()=>setModal(null)} aria-label="Close"><Icon name="close"/></button>
      {modal.state==="pending"?<div className="modal-status"><span className="loading-orbit"/><h2>Confirming on Monad…</h2><p>Keep this window open while your transaction is mined.</p></div>:modal.state==="error"?<div className="modal-status"><span className="error-mark">!</span><h2>That didn’t go through</h2><p>{modal.error}</p><button className="primary-button" onClick={()=>setModal({...modal,state:"confirm",error:undefined})}>Try again</button></div>:<>
        <div className="modal-icon"><Icon name="spark"/></div><p className="eyebrow">Confirm your signal</p><h2 id="dibs-title">Call Dibs on this cast?</h2>
        <div className="modal-cast"><div><Avatar name={modal.market.author.displayName} size={30}/><span><strong>{modal.market.author.displayName}</strong><small>@{modal.market.author.username}</small></span></div><p>“{modal.market.text.slice(0,125)}…”</p></div>
        <div className="confirm-grid"><div><span>Your conviction</span><strong>{modal.market.nextUnitCost.toFixed(3)} MON</strong></div><div><span>Current rank</span><strong>#{modal.market.rank}</strong></div><div><span>Market conviction</span><strong className="positive">{modal.market.totalStaked.toFixed(3)} MON</strong></div></div>
        <p className="modal-note">If the cast sustains quality attention, early scouts share the reward.</p>
        <button className="primary-button" onClick={confirmDibs} disabled={!identity.ready}>{!identity.ready?"Loading wallet…":identity.authenticated&&identity.walletReady?`Confirm Dibs · ${modal.market.nextUnitCost.toFixed(3)} MON`:"Connect wallet to confirm"}</button>
      </>}
    </section></div>}
    {toast&&<div className="toast" role="status"><span><Icon name="check"/></span><p>{toast}</p><button onClick={()=>setToast(null)} aria-label="Dismiss"><Icon name="close"/></button></div>}
  </>;
}
