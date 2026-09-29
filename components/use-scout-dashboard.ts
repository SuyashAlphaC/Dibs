"use client";

import {useEffect,useState} from "react";
import type {ScoutDashboard} from "@/lib/live-markets";
import type {ScoutIdentity} from "@/lib/types";

export function useScoutDashboard(address?:string){
  const [dashboard,setDashboard]=useState<ScoutDashboard|null>(null);
  const [loading,setLoading]=useState(false);
  const [live,setLive]=useState(false);
  const [scoutIdentity,setScoutIdentity]=useState<ScoutIdentity|null>(null);

  useEffect(()=>{
    setDashboard(null);
    setLive(false);
    setScoutIdentity(null);
    if(!address?.match(/^0x[a-fA-F0-9]{40}$/)){setLoading(false);return;}
    const controller=new AbortController();
    let refreshing=false;
    setLoading(true);
    const refresh=async()=>{
      if(refreshing||controller.signal.aborted)return;
      refreshing=true;
      try{
        const response=await fetch(`/api/scout?address=${address}`,{signal:controller.signal,cache:"no-store"});
        if(!response.ok)throw new Error("Scout data unavailable");
        const payload=await response.json() as {source:string;dashboard:ScoutDashboard|null;identity?:ScoutIdentity};
        setLive(payload.source==="envio");
        setDashboard(payload.dashboard);
        setScoutIdentity(payload.identity??null);
      }catch{
        if(!controller.signal.aborted)setLive(false);
      }finally{
        refreshing=false;
        if(!controller.signal.aborted)setLoading(false);
      }
    };
    void refresh();
    const interval=window.setInterval(refresh,5000);
    window.addEventListener("dibs:position-confirmed",refresh);
    return()=>{controller.abort();window.clearInterval(interval);window.removeEventListener("dibs:position-confirmed",refresh);};
  },[address]);

  return {dashboard,loading,live,scoutIdentity};
}
