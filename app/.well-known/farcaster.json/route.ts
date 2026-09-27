import {NextResponse} from "next/server";

export function GET(request:Request){
  const configured=process.env.NEXT_PUBLIC_APP_URL;
  const origin=configured?.replace(/\/$/,"")??new URL(request.url).origin;
  return NextResponse.json({
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
