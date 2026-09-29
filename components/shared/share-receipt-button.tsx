"use client";

import {useState} from "react";
import type {CastMarket} from "@/lib/types";
import {formatAgeMinutes} from "@/lib/time";

export function ShareReceiptButton({market,kind="dibs",rank}:{market:CastMarket;kind?:"dibs"|"win";rank?:number}){
  const [state,setState]=useState<"idle"|"opening"|"copied">("idle");
  async function share(){
    const url=`${window.location.origin}/market/${market.id}${kind==="win"?"/settlement":""}`;
    const text=kind==="win"
      ? `My early call on @${market.author.username} settled with ${market.settlementScore?.toLocaleString()??0} quality-weighted points on Dibs.`
      : `Called Dibs on @${market.author.username} ${formatAgeMinutes(market.ageMinutes)} after the cast${rank?` · now signal #${rank}`:""}. Proof of taste, recorded on Monad.`;
    setState("opening");
    try{
      const {sdk}=await import("@farcaster/miniapp-sdk");
      if(await sdk.isInMiniApp()){
        await sdk.actions.composeCast({text,embeds:[url]});
        setState("idle");return;
      }
    }catch{}
    try{
      if(navigator.share){await navigator.share({text,url});setState("idle");return;}
      await navigator.clipboard.writeText(`${text}\n${url}`);setState("copied");
      window.setTimeout(()=>setState("idle"),2200);
    }catch{setState("idle");}
  }
  return <button className="share-receipt" onClick={()=>void share()} disabled={state==="opening"}>{state==="opening"?"Opening composer…":state==="copied"?"Receipt copied ✓":"Share Farcaster receipt ↗"}</button>;
}
