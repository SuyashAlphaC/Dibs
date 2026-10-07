import type {Metadata} from "next";
import {PrivyIntegrationProof} from "@/components/privy-integration-proof";
import {getPrivyIntegrationStatus} from "@/lib/privy-integration";

export const dynamic="force-dynamic";
export const metadata:Metadata={title:"Privy Integration",description:"How Privy powers Dibs identity, embedded wallets, Farcaster linking, protected mutations and sponsored Monad transactions."};

export default function PrivyPage(){return <PrivyIntegrationProof deployment={getPrivyIntegrationStatus()}/>;}
