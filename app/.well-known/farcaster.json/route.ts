import {NextResponse} from "next/server";

type AccountAssociation={header:string;payload:string;signature:string};

function accountAssociation():AccountAssociation|undefined{
  const raw=process.env.FARCASTER_ACCOUNT_ASSOCIATION;
  if(!raw)return undefined;
  try{
    const value=JSON.parse(raw) as Partial<AccountAssociation>;
    if(value.header&&value.payload&&value.signature)return {header:value.header,payload:value.payload,signature:value.signature};
  }catch{/* Invalid owner-provided data is omitted instead of breaking the manifest. */}
  return undefined;
}

export function GET(request:Request){
  const configured=process.env.NEXT_PUBLIC_APP_URL;
  const origin=configured?.replace(/\/$/,"")??new URL(request.url).origin;
  const association=accountAssociation();
  return NextResponse.json({
    ...(association?{accountAssociation:association}:{}),
    miniapp:{
      version:"1",
      name:"Dibs",
      homeUrl:`${origin}/discover?miniApp=true`,
      iconUrl:`${origin}/dibs-icon.png`,
      splashImageUrl:`${origin}/dibs-splash.png`,
      splashBackgroundColor:"#08090d",
      subtitle:"Call culture early",
      description:"Back early Farcaster signals with onchain conviction and earn when quality attention arrives.",
      primaryCategory:"social",
      tags:["farcaster","discovery","curation","monad"],
      heroImageUrl:`${origin}/dibs-hero.png`,
      tagline:"Conviction finds culture",
      ogTitle:"Dibs on what matters next",
      ogDescription:"Discover early Farcaster casts and back your signal on Monad.",
      ogImageUrl:`${origin}/dibs-hero.png`,
      requiredChains:["eip155:10143"],
      requiredCapabilities:["wallet.getEthereumProvider"],
      noindex:false,
    },
  });
}
