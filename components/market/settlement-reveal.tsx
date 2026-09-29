"use client";

import {useEffect,useState} from "react";

export function SettlementReveal({opening,closing,score,settled,mode}:{opening:number;closing:number;score:number;settled:boolean;mode:string}){
  const [shown,setShown]=useState(settled?0:score);
  useEffect(()=>{
    if(!settled)return;
    const started=performance.now();let frame=0;
    const tick=(now:number)=>{const progress=Math.min(1,(now-started)/950);setShown(Math.round(score*(1-Math.pow(1-progress,3))));if(progress<1)frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[score,settled]);
  return <section className={`settlement-reveal ${settled?"revealed":"waiting"}`} aria-live="polite">
    <div><span>Before</span><strong>{opening.toLocaleString()}</strong><small>opening signal</small></div><i>→</i><div><span>After</span><strong>{closing.toLocaleString()}</strong><small>observed interactions</small></div><i>→</i><div className="reveal-score"><span>Quality reveal</span><strong>{settled?`+${shown.toLocaleString()}`:"Pending"}</strong><small>weighted points</small></div><b>{mode}</b>
  </section>;
}
