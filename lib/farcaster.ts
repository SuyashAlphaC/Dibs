/** Convert the bytes32 value emitted by Dibs back to Neynar's canonical bytes20 cast hash. */
export function toNeynarCastHash(hash:string){
  if(/^0x[0-9a-fA-F]{64}$/.test(hash)&&hash.endsWith("0".repeat(24)))return hash.slice(0,42);
  return hash;
}

import type {ScoutIdentity} from "@/lib/types";

type NeynarAddressUser={
  fid:number;
  username:string;
  display_name?:string;
  pfp_url?:string;
  viewer_context?:{following?:boolean}|null;
};

const identityCache=new Map<string,{identity:ScoutIdentity;expiresAt:number}>();
const IDENTITY_CACHE_MS=5*60_000;

function fallbackIdentity(address:string):ScoutIdentity{
  return {address,displayName:`${address.slice(0,6)}…${address.slice(-4)}`};
}

/** Resolve verified/custody wallets to Farcaster profiles in one Neynar request. */
export async function resolveFarcasterIdentities(addresses:string[],viewerFid?:number){
  const unique=[...new Set(addresses.filter(address=>/^0x[a-fA-F0-9]{40}$/.test(address)).map(address=>address.toLowerCase()))];
  const now=Date.now();
  const identities=new Map<string,ScoutIdentity>();
  const unresolved:string[]=[];
  for(const address of unique){
    const cached=identityCache.get(`${viewerFid??0}:${address}`);
    if(cached&&cached.expiresAt>now)identities.set(address,cached.identity);
    else {identities.set(address,fallbackIdentity(address));unresolved.push(address);}
  }
  const apiKey=process.env.NEYNAR_API_KEY;
  if(!apiKey||!unresolved.length)return identities;
  try{
    const url=new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address");
    url.searchParams.set("addresses",unresolved.join(","));
    if(viewerFid)url.searchParams.set("viewer_fid",String(viewerFid));
    const response=await fetch(url,{headers:{"x-api-key":apiKey,"x-neynar-experimental":"true"},next:{revalidate:300},signal:AbortSignal.timeout(4000)});
    if(response.status===404){
      for(const address of unresolved)identityCache.set(`${viewerFid??0}:${address}`,{identity:identities.get(address)!,expiresAt:now+IDENTITY_CACHE_MS});
      return identities;
    }
    if(!response.ok)throw new Error(`Neynar address lookup returned ${response.status}`);
    const payload=await response.json() as Record<string,NeynarAddressUser[]>;
    for(const [address,users] of Object.entries(payload)){
      const user=users[0];
      if(!user)continue;
      const normalized=address.toLowerCase();
      identities.set(normalized,{
        address:normalized,
        fid:user.fid,
        username:user.username,
        displayName:user.display_name||user.username,
        avatarUrl:user.pfp_url,
        followedByViewer:Boolean(user.viewer_context?.following),
      });
    }
  }catch(error){console.error("Neynar scout identity lookup failed",error);}
  for(const address of unresolved)identityCache.set(`${viewerFid??0}:${address}`,{identity:identities.get(address)!,expiresAt:now+IDENTITY_CACHE_MS});
  return identities;
}
