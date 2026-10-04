"use client";

import {FormEvent,useCallback,useEffect,useState} from "react";
import {Avatar} from "@/components/shared/avatar";
import {formatAgeMinutes} from "@/lib/time";
import type {MarketCandidate} from "@/lib/types";
import {useIdentity} from "@/components/identity-provider";

type CandidatePayload={candidates?:MarketCandidate[];error?:string};
type OpenPayload={opened?:Array<{hash:string;transaction:string;candidate?:MarketCandidate}>;error?:string;retryAfterSeconds?:number};

export function MarketCandidateStrip({onMarketOpened}:{onMarketOpened:(candidate:MarketCandidate,transaction:string)=>void}){
  const identity=useIdentity();
  const [candidates,setCandidates]=useState<MarketCandidate[]>([]);
  const [loading,setLoading]=useState(true);
  const [identifier,setIdentifier]=useState("");
  const [opening,setOpening]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const [cooldownSeconds,setCooldownSeconds]=useState(0);

  useEffect(()=>{
    if(cooldownSeconds<=0)return;
    const timer=window.setInterval(()=>setCooldownSeconds(value=>Math.max(0,value-1)),1000);
    return()=>window.clearInterval(timer);
  },[cooldownSeconds]);

  const refresh=useCallback(async()=>{
    try{
      const response=await fetch("/api/markets/candidates",{cache:"no-store"});
      const payload=await response.json() as CandidatePayload;
      if(response.ok)setCandidates(payload.candidates??[]);
      else if(!notice)setNotice(payload.error??"Fresh Farcaster candidates are temporarily unavailable.");
    }catch(error){
      if(error instanceof DOMException&&error.name==="AbortError")return;
      if(!notice)setNotice("Fresh Farcaster candidates are temporarily unavailable. Try again shortly.");
    }finally{setLoading(false);}
  },[]);

  useEffect(()=>{
    void refresh();
    const interval=window.setInterval(()=>void refresh(),30_000);
    return()=>window.clearInterval(interval);
  },[refresh]);

  async function open(candidate:MarketCandidate,input:string){
    if(!identity.authenticated){identity.login();setNotice("Connect with Privy, then nominate this cast again.");return;}
    if(!identity.farcaster){identity.linkFarcaster();setNotice("Link Farcaster, then nominate this cast again.");return;}
    setOpening(candidate.hash);setNotice("Validating eligibility and preparing the Monad market…");
    try{
      const token=await identity.getAccessToken();
      if(!token)throw new Error("Your Privy session expired. Reconnect and try again.");
      const response=await fetch("/api/markets/candidates",{method:"POST",headers:{"content-type":"application/json",authorization:`Bearer ${token}`},body:JSON.stringify({identifier:input})});
      const payload=await response.json() as OpenPayload;
      if(!response.ok){
        if(response.status===429){
          const retryAfter=payload.retryAfterSeconds ?? (Number(response.headers.get("retry-after")) || 30);
          setCooldownSeconds(retryAfter);
          setNotice(`Nomination cooldown active. Try again in ${retryAfter} seconds.`);
          return;
        }
        throw new Error(payload.error??"The market could not be opened");
      }
      const opened=payload.opened?.[0];
      if(!opened)throw new Error("No market transaction was returned");
      setCandidates(current=>current.filter(item=>item.hash!==candidate.hash));
      setIdentifier("");setNotice("Market confirmed on Monad. Envio is indexing it now…");
      onMarketOpened(opened.candidate??candidate,opened.transaction);
      window.setTimeout(()=>{setNotice(null);void refresh();},12_000);
    }catch(error){setNotice(error instanceof Error?error.message:"The market could not be opened");}
    finally{setOpening(null);}
  }

  async function nominate(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const value=identifier.trim();
    if(!value)return;
    const known=candidates.find(candidate=>candidate.hash.toLowerCase()===value.toLowerCase());
    const placeholder:MarketCandidate=known??{hash:"0x0000000000000000000000000000000000000000",author:{fid:0,username:"candidate",displayName:"Candidate",avatarUrl:""},text:"",timestamp:new Date().toISOString(),ageMinutes:0,likes:0,recasts:0,replies:0,category:"Farcaster"};
    await open(placeholder,value);
  }

  return <section className="candidate-console" aria-labelledby="candidate-title">
    <header><div><p className="eyebrow">Pre-market radar</p><h2 id="candidate-title">Fresh Farcaster candidates</h2></div><span>{loading?"Scanning…":`${candidates.length} eligible now`}</span></header>
    <form onSubmit={nominate}><label htmlFor="cast-nomination">Nominate a cast</label><input id="cast-nomination" value={identifier} onChange={event=>setIdentifier(event.target.value)} placeholder="Paste a farcaster.xyz cast URL or full hash"/><button disabled={!identifier.trim()||Boolean(opening)}>{opening?"Opening…":"Open signal →"}</button></form>
    {notice&&<p className="candidate-notice" role="status">{notice}</p>}
    {candidates.length>0&&<div className="candidate-list">{candidates.slice(0,4).map(candidate=><article key={candidate.hash}>
      <div className="candidate-author"><Avatar name={candidate.author.displayName} src={candidate.author.avatarUrl} size={32}/><span><strong>{candidate.author.displayName}</strong><small>@{candidate.author.username} · {formatAgeMinutes(candidate.ageMinutes)}</small></span><b>{candidate.category}</b></div>
      <p>{candidate.text}</p>
      <footer><span>♡ {candidate.likes} &nbsp; ↻ {candidate.recasts} &nbsp; ◌ {candidate.replies}</span><button onClick={()=>void open(candidate,candidate.hash)} disabled={Boolean(opening)||cooldownSeconds>0}>{opening===candidate.hash?"Opening on Monad…":cooldownSeconds>0?`Wait ${cooldownSeconds}s`:"Open market →"}</button></footer>
    </article>)}</div>}
    {!loading&&!candidates.length&&!notice&&<p className="candidate-empty">No qualifying cast in the current scan. Paste a fresh cast URL above or wait for the next 30-second scan.</p>}
    <small className="candidate-rule">Authenticated Farcaster scouts may nominate eligible root casts into an existing keeper-funded epoch. Public nominations never create or fund epochs.</small>
  </section>;
}
