import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import "./avatar.css";
import "./integration.css";
import "./stitch.css";
import {IdentityProvider} from "@/components/identity-provider";
import {AppShell} from "@/components/layout/app-shell";
import {MiniAppReady} from "@/components/mini-app-ready";

const body = Geist({subsets: ["latin"], variable: "--font-body"});
const mono = Geist_Mono({subsets: ["latin"], variable: "--font-mono"});

export const metadata: Metadata = {
  title: "Dibs — Call culture early",
  description: "Put conviction behind the casts you believe will matter.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL??"https://dibs-metropolis.vercel.app"),
  openGraph:{title:"Dibs — Call culture early",description:"Discover early Farcaster casts and back your signal on Monad.",images:["/dibs-hero.png"]},
  other:{"fc:miniapp":JSON.stringify({version:"1",imageUrl:"https://dibs-metropolis.vercel.app/dibs-hero.png",button:{title:"Call Dibs",action:{type:"launch_miniapp",name:"Dibs",url:"https://dibs-metropolis.vercel.app/discover?miniApp=true",splashImageUrl:"https://dibs-metropolis.vercel.app/dibs-splash.png",splashBackgroundColor:"#08090d"}}})},
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body className={`${body.className} ${body.variable} ${mono.variable}`}>
        <MiniAppReady/><IdentityProvider><AppShell>{children}</AppShell></IdentityProvider>
      </body>
    </html>
  );
}
