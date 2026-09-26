"use client";

import {PrivyProvider, usePrivy, useSendTransaction, useWallets} from "@privy-io/react-auth";
import {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {formatEther} from "viem";
import {monad, monadClient} from "@/lib/contract";

type Transaction = {to: `0x${string}`; data: `0x${string}`; value: bigint};
type Identity = {
  ready: boolean;
  authenticated: boolean;
  walletReady: boolean;
  chainReady: boolean;
  address?: string;
  balance?: string;
  mode: "privy" | "demo";
  login: () => void;
  logout: () => void;
  sendStake: (transaction: Transaction | null) => Promise<string>;
};

const IdentityContext = createContext<Identity | null>(null);

function PrivyIdentity({children}: {children: React.ReactNode}) {
  const {ready:privyReady, authenticated, connectOrCreateWallet, logout} = usePrivy();
  const {ready:walletsReady, wallets} = useWallets();
  const {sendTransaction} = useSendTransaction();
  const wallet=wallets[0];
  const [balance,setBalance]=useState<string>();
  const refreshBalance=useCallback(async()=>{
    if(!wallet?.address){setBalance(undefined);return;}
    try{
      const value=await monadClient.getBalance({address:wallet.address as `0x${string}`});
      setBalance(Number(formatEther(value)).toLocaleString(undefined,{maximumFractionDigits:3}));
    }catch{setBalance(undefined);}
  },[wallet?.address]);
  useEffect(()=>{void refreshBalance();},[refreshBalance]);
  const value = useMemo<Identity>(
    () => ({
      ready: privyReady&&walletsReady,
      authenticated,
      walletReady: Boolean(wallet),
      chainReady: wallet?.chainId===`eip155:${monad.id}`,
      address: wallet?.address,
      balance,
      mode: "privy",
      login: connectOrCreateWallet,
      logout,
      sendStake: async (transaction) => {
        if (!transaction) throw new Error("Contract address is not configured.");
        if (!wallet) throw new Error("Connect a wallet before calling Dibs.");
        if(wallet.chainId!==`eip155:${monad.id}`) await wallet.switchChain(monad.id);
        const result = await sendTransaction(transaction, {
          address: wallet.address,
          sponsor: process.env.NEXT_PUBLIC_SPONSOR_TRANSACTIONS === "true",
        });
        const receipt=await monadClient.waitForTransactionReceipt({hash:result.hash});
        if(receipt.status!=="success")throw new Error("The transaction reverted.");
        await refreshBalance();
        return result.hash;
      },
    }),
    [authenticated, balance, connectOrCreateWallet, logout, privyReady, refreshBalance, sendTransaction, wallet, walletsReady],
  );
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

function DemoIdentity({children}: {children: React.ReactNode}) {
  const [authenticated, setAuthenticated] = useState(false);
  const value = useMemo<Identity>(
    () => ({
      ready:true,
      authenticated,
      walletReady:authenticated,
      chainReady:true,
      address: authenticated ? "0xD1b5…A143" : undefined,
      balance:authenticated?"12.4":undefined,
      mode: "demo",
      login: () => setAuthenticated(true),
      logout: () => setAuthenticated(false),
      sendStake: async () => {
        await new Promise((resolve) => setTimeout(resolve, 700));
        return `demo-${Date.now()}`;
      },
    }),
    [authenticated],
  );
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

export function IdentityProvider({children}: {children: React.ReactNode}) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) return <DemoIdentity>{children}</DemoIdentity>;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["wallet", "farcaster", "email", "passkey"],
        embeddedWallets: {ethereum: {createOnLogin: "users-without-wallets"}},
        defaultChain: monad,
        supportedChains: [monad],
        appearance: {theme: "dark", accentColor: "#8B5CF6", logo: undefined},
      }}
    >
      <PrivyIdentity>{children}</PrivyIdentity>
    </PrivyProvider>
  );
}

export function useIdentity() {
  const context = useContext(IdentityContext);
  if (!context) throw new Error("useIdentity must be used inside IdentityProvider");
  return context;
}
