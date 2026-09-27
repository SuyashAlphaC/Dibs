"use client";

import {useEffect} from "react";

export function MiniAppReady(){
  useEffect(()=>{
    let active=true;
    void import("@farcaster/miniapp-sdk").then(({sdk})=>{
      if(active)return sdk.actions.ready();
    }).catch(()=>{});
    return()=>{active=false;};
  },[]);
  return null;
}
