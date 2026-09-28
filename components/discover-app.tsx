"use client";

import {useEffect,useMemo,useState} from "react";
import {CastMarketCard} from "@/components/feed/cast-market-card";
import {Icon} from "@/components/shared/icons";
import {Avatar} from "@/components/shared/avatar";
import {useIdentity} from "@/components/identity-provider";
import {markets as seedMarkets} from "@/lib/mock/markets";
import type {CastMarket} from "@/lib/types";
import {scoutTransaction} from "@/lib/contract";
import {MetricCard} from "@/components/dashboard/metric-card";

type ModalState = {market:CastMarket;state:"confirm"|"pending"|"error";error?:string}|null;

function transactionMessage(error:unknown){
  if(error instanceof Error){
    if(/rejected|denied|cancelled/i.test(error.message))return "You cancelled the wallet request. Nothing was charged.";
    if(/fund|balance/i.test(error.message))return "This wallet does not have enough MON for the transaction.";
    if(/network|chain/i.test(error.message))return "Switch to Monad Testnet in your wallet and try again.";
  }
  return "The transaction did not confirm. Nothing was recorded by Dibs.";
}

export function DiscoverApp({initialMode="trending",initialQuery=""}:{initialMode?:string;initialQuery?:string}) {
  const identity = useIdentity();
  const [mode,setMode] = useState(initialMode);
  const [category,setCategory] = useState("All");
  const [marketList,setMarketList] = useState(seedMarkets);
  const [dataSource,setDataSource] = useState<"demo"|"envio">("demo");
  const [modal,setModal] = useState<ModalState>(null);
  const [toast,setToast] = useState<string|null>(null);
  const [recentId,setRecentId] = useState<string|null>(null);
  const categories = ["All","AI","Crypto","Social","Culture"];
  const query=initialQuery.trim().toLowerCase();
  const visible = useMemo(()=>marketList.filter((market)=>{
    if(query&&!`${market.author.displayName} ${market.author.username} ${market.text} ${market.category}`.toLowerCase().includes(query))return false;
    if(category!=="All"&&market.category!==category)return false;
    if(mode==="opened")return market.ageMinutes<=30;
    if(mode==="early")return market.status==="active"||market.status==="closing";
    return true;
  }),[marketList,category,mode,query]);
  const activeMarkets=marketList.filter(market=>market.status==="active"||market.status==="closing");
  const totalConviction=marketList.reduce((sum,market)=>sum+market.totalStaked,0);
  const totalScouts=marketList.reduce((sum,market)=>sum+market.newScouts,0);

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
      window.dispatchEvent(new Event("dibs:position-confirmed"));
      const newRank=updated.find((market)=>market.id===target.id)?.rank;
      setRecentId(target.id); setModal(null); setToast(`Dibs confirmed — ${target.author.displayName} moved from #${target.rank} to #${newRank}.`);
      window.setTimeout(()=>setRecentId(null),2400); window.setTimeout(()=>setToast(null),5200);
    } catch(error) { setModal({...modal,state:"error",error:transactionMessage(error)}); }
  }

  return <>
    <section className="discover-hero terminal-hero">
      <div><p className="eyebrow">Live social discovery</p><h1>Farcaster Discovery for Early Casts</h1><h2>Find what&apos;s about to matter before it trends.</h2><p><i className={dataSource==="envio"?"live-dot":""}/> {dataSource==="envio"?"Live casts ranked by collective onchain conviction":"Curated protocol preview · Transactions are disabled"}</p></div>
      <div className="rpc-chip"><Icon name="spark"/><span>Monad + Envio</span><strong>{dataSource==="envio"?"Synced":"Preview"}</strong></div>
    </section>
    <section className="metric-grid">
      <MetricCard label="Active markets" value={String(activeMarkets.length)} detail="24 hour windows" points={[3,6,5,9,8,12,11,14]} />
      <MetricCard label="Total conviction" value={`${totalConviction.toFixed(2)} MON`} detail="Across live signals" tone="pink" points={[4,5,4,8,7,11,10,14]} />
      <MetricCard label="Scouts active" value={String(totalScouts)} detail="Unique early calls" tone="green" points={[3,4,7,6,9,8,11,13]} />
      <MetricCard label="Your Dibs" value={String(marketList.filter(market=>market.userHasDibs).length)} detail="Confirmed positions" points={[2,2,3,5,4,7,7,9]} />
    </section>
    <section className="feed-controls">
      <div className="mode-tabs">{["trending","early","opened"].map((item)=><button key={item} className={mode===item?"active":""} onClick={()=>setMode(item)}>{item==="opened"?"New":item==="early"?"Early":"All"}</button>)}</div>
      <div className="category-filter">{categories.map((item)=><button key={item} className={category===item?"active":""} onClick={()=>setCategory(item)}>{item}</button>)}</div>
    </section>
    <div className="feed-label"><span>{visible.length} signal{visible.length===1?"":"s"}{query?` matching “${initialQuery.trim()}”`:""}</span><span>{dataSource==="envio"?"Sort · Conviction high to low":"Preview data · staking disabled"}</span></div>
    <section className="market-feed" aria-labelledby="live-markets-title"><h2 className="sr-only" id="live-markets-title">Live Farcaster discovery markets</h2>{visible.map((market)=><CastMarketCard key={market.id} market={market} onDibs={startDibs} justDibsed={recentId===market.id}/>)}</section>
    {!visible.length&&<section className="empty-state search-empty"><strong>No matching signals</strong><p>Try a Farcaster username, topic, or phrase from a cast.</p></section>}
    <section className="discovery-explainer" aria-labelledby="how-dibs-works">
      <p className="eyebrow">Transparent discovery</p><h2 id="how-dibs-works">How does Dibs find early Farcaster signals?</h2>
      <p>Dibs turns early social discovery into an accountable onchain signal. Scouts back promising casts with MON, collective conviction determines discovery rank, and quality-weighted engagement settles each market.</p>
      <ol><li><strong>Discover early.</strong><span>Envio indexes eligible Farcaster casts and live Monad markets.</span></li><li><strong>Call Dibs.</strong><span>A wallet-confirmed stake records conviction without taking custody of your wallet.</span></li><li><strong>Build reputation.</strong><span>Chainlink CRE settlement rewards accurate early calls using quality-filtered growth.</span></li></ol>
      <div className="protocol-sources"><span>Protocol sources</span><a href="https://docs.monad.xyz/" target="_blank" rel="noreferrer">Monad</a><a href="https://docs.envio.dev/" target="_blank" rel="noreferrer">Envio</a><a href="https://docs.chain.link/cre" target="_blank" rel="noreferrer">Chainlink CRE</a><a href="https://miniapps.farcaster.xyz/" target="_blank" rel="noreferrer">Farcaster</a></div>
    </section>
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
