"use client";

import {useEffect,useState} from "react";
import type {ScoutDashboard} from "@/lib/live-markets";

export function useScoutDashboard(address?:string){
  const [dashboard,setDashboard]=useState<ScoutDashboard|null>(null);
  const [loading,setLoading]=useState(false);
  const [live,setLive]=useState(false);

  useEffect(()=>{
    setDashboard(null);
    setLive(false);
    if(!address?.match(/^0x[a-fA-F0-9]{40}$/)){setLoading(false);return;}
    const controller=new AbortController();
    setLoading(true);
    fetch(`/api/scout?address=${address}`,{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)throw new Error("Scout data unavailable");
        return response.json() as Promise<{source:string;dashboard:ScoutDashboard|null}>;
      })
      .then(payload=>{setLive(payload.source==="envio");setDashboard(payload.dashboard);})
      .catch(()=>{if(!controller.signal.aborted){setLive(false);setDashboard(null);}})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[address]);

  return {dashboard,loading,live};
}
