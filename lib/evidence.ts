import "server-only";
import {getEnvioIndexStatus,getLiveMarkets,getMarketsAwaitingResult,getScoutLeaderboard} from "@/lib/live-markets";

export type EvidenceState="verified"|"partial"|"pending";
export type EvidenceCheck={id:string;title:string;detail:string;state:EvidenceState;href?:string};

export async function getEvidenceSnapshot(){
  const [markets,indexer,queue,scouts]=await Promise.all([getLiveMarkets(),getEnvioIndexStatus(),getMarketsAwaitingResult(),getScoutLeaderboard()]);
  const liveMarkets=markets??[];
  const leaderboard=scouts??[];
  const settled=liveMarkets.filter(market=>market.status==="settled");
  const positive=settled.filter(market=>(market.settlementScore??0)>0);
  const multiScout=liveMarkets.filter(market=>market.newScouts>=2);
  const resolvedIdentities=leaderboard.filter(scout=>Boolean(scout.identity.fid)).length;
  const claimed=leaderboard.reduce((sum,scout)=>sum+scout.claimed,0);
  const challenged=settled.filter(market=>market.challengeUpheld===true);
  const isDon=process.env.NEXT_PUBLIC_CRE_SETTLEMENT_MODE==="don";
  const mode=isDon?"Chainlink DON":"CRE simulation-broadcast";
  const checks:EvidenceCheck[]=[
    {id:"integrations",title:"Live data plane",detail:indexer?`Envio indexes ${indexer.marketCount} markets; Monad, Neynar and receiver health are exposed publicly.`:"The Envio index is unavailable.",state:indexer?"verified":"pending",href:"/api/health"},
    {id:"participation",title:"Genuine scout participation",detail:`${leaderboard.length} unique onchain scouts are indexed. Submission target: 10 genuine Farcaster scouts.`,state:leaderboard.length>=10?"verified":leaderboard.length?"partial":"pending",href:"/profile"},
    {id:"identity",title:"Farcaster identity resolution",detail:`${resolvedIdentities} of ${leaderboard.length} indexed scouts currently resolve to a Farcaster identity.`,state:leaderboard.length>0&&resolvedIdentities===leaderboard.length?"verified":resolvedIdentities?"partial":"pending",href:"/profile"},
    {id:"ranking",title:"Collective conviction",detail:multiScout.length?`${multiScout.length} market${multiScout.length===1?"":"s"} contain multiple independent scout positions indexed by Envio.`:"No multi-scout market is currently indexed.",state:multiScout.length?"verified":"pending",href:multiScout[0]?`/market/${multiScout[0].id}`:"/discover"},
    {id:"settlement",title:"Quality-weighted settlement",detail:positive.length?`${positive.length} market${positive.length===1?"":"s"} have a positive indexed quality-growth score.`:"No positive indexed settlement exists yet.",state:positive.length?"verified":"pending",href:positive[0]?`/market/${positive[0].id}/settlement`:"/simulation"},
    {id:"reward",title:"Scout reward claimed",detail:claimed>0?`${claimed.toFixed(4)} MON has been claimed by indexed scouts.`:"A non-zero scout reward claim still requires a positive market with participating scouts.",state:claimed>0?"verified":"pending",href:"/profile"},
    {id:"challenge",title:"Optimistic challenge corrected",detail:challenged.length?`${challenged.length} challenged market result has been upheld and indexed.`:"The deterministic challenge path is contract-tested; a live upheld challenge is still pending.",state:challenged.length?"verified":"pending",href:challenged[0]?`/market/${challenged[0].id}/settlement`:"/simulation"},
    {id:"cre",title:"Settlement execution boundary",detail:isDon?`Current mode: Chainlink DON. Workflow reports are authenticated by the pinned receiver; ${queue?.length??0} observations are awaiting execution.`:`Current mode: CRE simulation-broadcast. ${queue?.length??0} observations are awaiting execution. DON deployment is not active.`,state:isDon?"verified":"partial",href:"/simulation"},
    {id:"growth",title:"Farcaster receipt growth loop",detail:"The Mini App can compose a Dibs receipt after a call or win; a public receipt from an independent tester is still required as field evidence.",state:"pending",href:"/discover"},
  ];
  return {generatedAt:new Date().toISOString(),mode,metrics:{markets:liveMarkets.length,settled:settled.length,positiveSettlements:positive.length,scouts:leaderboard.length,resolvedIdentities,multiScoutMarkets:multiScout.length,claimedMon:claimed,awaitingObservations:queue?.length??0},checks};
}
