"use client";

import {useCallback,useEffect,useMemo,useState} from "react";
import {formatEther} from "viem";
import {useIdentity} from "@/components/identity-provider";
import {
  challengeTransaction,
  claimCreatorTransaction,
  claimScoutTransaction,
  expireChallengeTransaction,
  expireResultTransaction,
  finalizeEpochTransaction,
  walletMarketState,
  withdrawCreditTransaction,
  type DibsTransaction,
} from "@/lib/contract";
import type {CastMarket} from "@/lib/types";

type Action="challenge"|"expire-result"|"expire-challenge"|"finalize"|"claim-scout"|"claim-creator"|"withdraw";

const LABELS:Record<Action,string>={
  challenge:"Flag result · post bond",
  "expire-result":"Record oracle timeout",
  "expire-challenge":"Resolve missed review",
  finalize:"Finalize epoch",
  "claim-scout":"Claim scout reward",
  "claim-creator":"Claim creator reward",
  withdraw:"Withdraw challenge credit",
};

function message(error:unknown){
  if(error instanceof Error){
    if(/rejected|denied|cancelled/i.test(error.message))return "Wallet request cancelled. No state changed.";
    if(/InvalidTime|revert/i.test(error.message))return "This action is not available until its onchain window opens.";
    if(/AlreadyClaimed/i.test(error.message))return "This reward has already been claimed.";
    if(/InvalidAmount/i.test(error.message))return "This wallet is not eligible for that action.";
  }
  return "The transaction did not confirm. Check the market state and try again.";
}

export function LifecycleActions({market}:{market:CastMarket}){
  const identity=useIdentity();
  const [pending,setPending]=useState<Action|null>(null);
  const [notice,setNotice]=useState("");
  const [walletState,setWalletState]=useState<Awaited<ReturnType<typeof walletMarketState>>>(null);
  const address=identity.address?.match(/^0x[a-fA-F0-9]{40}$/)?.[0] as `0x${string}`|undefined;

  const refresh=useCallback(async()=>{
    if(!address||!/^[0-9]+$/.test(market.id)){setWalletState(null);return;}
    setWalletState(await walletMarketState(market.id,address));
  },[address,market.id]);
  useEffect(()=>{void refresh();},[refresh]);

  const actions=useMemo(()=>{
    const result:Action[]=[];
    if(market.status==="closed"){
      if(!market.resultSubmittedAt)result.push("expire-result");
      else if((walletState?.units??0n)>0n)result.push("challenge");
      if(market.epochId)result.push("finalize");
    }
    if(market.status==="challenged")result.push("expire-challenge");
    if(market.status==="settled"){
      if((walletState?.units??0n)>0n&&!walletState?.claimed&&(market.scoutAllocation??0)>0)result.push("claim-scout");
      if(address&&market.creator?.toLowerCase()===address.toLowerCase()&&!walletState?.creatorClaimed&&(market.creatorAllocation??0)>0)result.push("claim-creator");
    }
    if((walletState?.credits??0n)>0n)result.push("withdraw");
    return result;
  },[address,market,walletState]);

  async function run(action:Action){
    if(!identity.authenticated||!identity.walletReady){identity.login();return;}
    let tx:DibsTransaction|null=null;
    if(action==="challenge")tx=await challengeTransaction(market.id);
    if(action==="expire-result")tx=expireResultTransaction(market.id);
    if(action==="expire-challenge")tx=expireChallengeTransaction(market.id);
    if(action==="finalize"&&market.epochId)tx=finalizeEpochTransaction(market.epochId);
    if(action==="claim-scout")tx=claimScoutTransaction(market.id);
    if(action==="claim-creator")tx=claimCreatorTransaction(market.id);
    if(action==="withdraw")tx=withdrawCreditTransaction();
    setPending(action);setNotice("");
    try{
      const hash=await identity.sendStake(tx);
      setNotice(`Confirmed on Monad · ${hash.slice(0,10)}…`);
      await refresh();
      window.dispatchEvent(new Event("dibs:position-confirmed"));
    }catch(error){setNotice(message(error));}
    finally{setPending(null);}
  }

  if(market.status==="active"||market.status==="closing")return null;
  return <section className="lifecycle-actions" aria-live="polite">
    <p className="eyebrow">Onchain lifecycle</p>
    <h3>{market.status==="settled"?"Rewards are ready.":market.status==="challenged"?"Secondary review active.":"Settlement controls"}</h3>
    {walletState&&<div className="lifecycle-wallet"><span>{walletState.units.toString()} scout units</span><span>{Number(formatEther(walletState.bond)).toFixed(3)} MON bond</span></div>}
    <div className="lifecycle-buttons">
      {actions.map(action=><button key={action} className={action.startsWith("claim")||action==="withdraw"?"primary-button":"secondary-button"} disabled={pending!==null} onClick={()=>void run(action)}>{pending===action?"Confirming on Monad…":LABELS[action]}</button>)}
    </div>
    {!actions.length&&<p className="lifecycle-empty">No wallet action is due yet. The protocol advances when its current time window completes.</p>}
    {notice&&<p className="lifecycle-notice">{notice}</p>}
  </section>;
}
