import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import "./avatar.css";
import "./integration.css";
import "./stitch.css";
import "./premium.css";
import "./social.css";
import "./minimalist.css";
import "./moat.css";
import "./cultural.css";
import {IdentityProvider} from "@/components/identity-provider";
import {AppShell} from "@/components/layout/app-shell";
import {MiniAppReady} from "@/components/mini-app-ready";

const body = Geist({subsets: ["latin"], variable: "--font-body"});
const mono = Geist_Mono({subsets: ["latin"], variable: "--font-mono"});

export const metadata: Metadata = {
  title: {default:"Farcaster Discovery: Find Early Casts | Dibs",template:"%s | Dibs"},
  description: "Discover early Farcaster casts, back your conviction with MON on Monad, and build an onchain scout reputation. Explore live Dibs markets now.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL??"https://dibs-metropolis.vercel.app"),
  alternates:{canonical:"/discover"},
  applicationName:"Dibs",
  authors:[{name:"Dibs contributors",url:"https://github.com/SuyashAlphaC/Dibs"}],
  creator:"Dibs contributors",
  publisher:"Dibs",
  keywords:["Farcaster discovery","early casts","social discovery","Monad","onchain reputation","Dibs"],
  category:"social discovery",
  icons:{icon:"/dibs_logo.png",apple:"/dibs_logo.png"},
  openGraph:{type:"website",url:"/discover",siteName:"Dibs",locale:"en_US",title:"Farcaster Discovery: Find Early Casts | Dibs",description:"Discover early Farcaster casts, back your conviction with MON on Monad, and build an onchain scout reputation.",images:[{url:"/dibs-hero.png",width:1200,height:630,alt:"Dibs Farcaster discovery dashboard on Monad"}]},
  twitter:{card:"summary_large_image",title:"Farcaster Discovery: Find Early Casts | Dibs",description:"Back early Farcaster signals with onchain conviction and build your scout reputation.",images:["/dibs-hero.png"]},
  robots:{index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large","max-snippet":-1,"max-video-preview":-1}},
  other:{"fc:miniapp":JSON.stringify({version:"1",imageUrl:"https://dibs-metropolis.vercel.app/dibs-hero.png",button:{title:"Call Dibs",action:{type:"launch_miniapp",name:"Dibs",url:"https://dibs-metropolis.vercel.app/discover?miniApp=true",splashImageUrl:"https://dibs-metropolis.vercel.app/dibs-splash.png",splashBackgroundColor:"#08090d"}}})},
};

const structuredData={
  "@context":"https://schema.org",
  "@graph":[
    {"@type":"WebApplication","@id":"https://dibs-metropolis.vercel.app/#app",name:"Dibs",url:"https://dibs-metropolis.vercel.app/discover",description:"Farcaster discovery markets where scouts back early casts with onchain conviction on Monad.",applicationCategory:"SocialNetworkingApplication",operatingSystem:"Web",author:{"@type":"Organization",name:"Dibs contributors",url:"https://github.com/SuyashAlphaC/Dibs"},offers:{"@type":"Offer",price:"0",priceCurrency:"USD"}},
    {"@type":"FAQPage","@id":"https://dibs-metropolis.vercel.app/discover#faq",mainEntity:[
      {"@type":"Question",name:"How does Dibs find early Farcaster signals?",acceptedAnswer:{"@type":"Answer",text:"Envio indexes eligible Farcaster casts and Monad markets. Dibs ranks them by collective onchain conviction from scouts."}},
      {"@type":"Question",name:"What happens when a scout calls Dibs?",acceptedAnswer:{"@type":"Answer",text:"The scout confirms a Monad transaction that buys one conviction unit at the contract's live quote. Dibs never signs without wallet confirmation."}},
      {"@type":"Question",name:"How are Dibs markets settled?",acceptedAnswer:{"@type":"Answer",text:"Chainlink CRE submits quality-weighted engagement results, and the Dibs contracts distribute rewards according to the verified settlement."}}
    ]}
  ]
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body className={`${body.className} ${body.variable} ${mono.variable}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData)}}/>
        <MiniAppReady/><IdentityProvider><AppShell>{children}</AppShell></IdentityProvider>
      </body>
    </html>
  );
}
