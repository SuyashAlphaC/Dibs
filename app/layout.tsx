import type {Metadata} from "next";
import {Geist, Geist_Mono} from "next/font/google";
import "./globals.css";
import "./avatar.css";
import "./integration.css";
import "./stitch.css";
import {IdentityProvider} from "@/components/identity-provider";
import {AppShell} from "@/components/layout/app-shell";

const body = Geist({subsets: ["latin"], variable: "--font-body"});
const mono = Geist_Mono({subsets: ["latin"], variable: "--font-mono"});

export const metadata: Metadata = {
  title: "Dibs — Call culture early",
  description: "Put conviction behind the casts you believe will matter.",
};

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en">
      <body className={`${body.className} ${body.variable} ${mono.variable}`}>
        <IdentityProvider><AppShell>{children}</AppShell></IdentityProvider>
      </body>
    </html>
  );
}
