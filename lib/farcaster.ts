import {PrivyClient} from "@privy-io/node";
import type {User} from "@privy-io/node";
import type {ScoutIdentity} from "@/lib/types";

/** Convert the bytes32 value emitted by Dibs back to Neynar's canonical bytes20 cast hash. */
export function toNeynarCastHash(hash:string){
  if(/^0x[0-9a-fA-F]{64}$/.test(hash)&&hash.endsWith("0".repeat(24)))return hash.slice(0,42);
  return hash;
}

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

type PrivyFarcasterAccount=Extract<User["linked_accounts"][number],{type:"farcaster"}>;

function isFarcasterAccount(account:User["linked_accounts"][number]):account is PrivyFarcasterAccount{
  return account.type==="farcaster";
}

export function identityFromPrivyUser(address:string,user:Pick<User,"linked_accounts">):ScoutIdentity|undefined{
  const farcaster=user.linked_accounts.find(isFarcasterAccount);
  if(!farcaster)return undefined;
  const username=farcaster.username||undefined;
  return {
    address:address.toLowerCase(),
    fid:farcaster.fid,
    username,
    displayName:farcaster.display_name||username||`FID ${farcaster.fid}`,
    avatarUrl:farcaster.profile_picture_url||farcaster.profile_picture,
  };
}

async function resolveWithPrivy(addresses:string[]){
  const appId=process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret=process.env.PRIVY_APP_SECRET;
  const resolved=new Map<string,ScoutIdentity>();
  if(!appId||!appSecret||!addresses.length)return resolved;
  const privy=new PrivyClient({appId,appSecret});
  const results=await Promise.allSettled(addresses.map(async address=>{
    const user=await privy.users().getByWalletAddress({address});
    return [address,identityFromPrivyUser(address,user)] as const;
  }));
  for(const result of results){
    if(result.status==="fulfilled"&&result.value[1])resolved.set(result.value[0],result.value[1]);
  }
  return resolved;
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
  const stillUnresolved=new Set(unresolved);
  if(apiKey&&unresolved.length)try{
    const url=new URL("https://api.neynar.com/v2/farcaster/user/bulk-by-address");
    url.searchParams.set("addresses",unresolved.join(","));
    if(viewerFid)url.searchParams.set("viewer_fid",String(viewerFid));
    const response=await fetch(url,{headers:{"x-api-key":apiKey,"x-neynar-experimental":"true"},next:{revalidate:300},signal:AbortSignal.timeout(4000)});
    if(response.status===404){
      // A missing verified-address match is expected for Privy embedded wallets.
    }else{
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
        stillUnresolved.delete(normalized);
      }
    }
  }catch(error){console.error("Neynar scout identity lookup failed",error);}

  try{
    const privyIdentities=await resolveWithPrivy([...stillUnresolved]);
    for(const [address,identity] of privyIdentities){
      identities.set(address,identity);
      stillUnresolved.delete(address);
    }
  }catch(error){console.error("Privy scout identity lookup failed",error);}
  for(const address of unresolved)identityCache.set(`${viewerFid??0}:${address}`,{identity:identities.get(address)!,expiresAt:now+IDENTITY_CACHE_MS});
  return identities;
}
