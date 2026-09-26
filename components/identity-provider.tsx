"use client";

import {PrivyProvider, usePrivy, useSendTransaction, useWallets} from "@privy-io/react-auth";
import {createContext, useContext, useMemo, useState} from "react";
import {monad} from "@/lib/contract";

type Transaction = {to: `0x${string}`; data: `0x${string}`; value: bigint};
type Identity = {
  authenticated: boolean;
  address?: string;
  mode: "privy" | "demo";
  login: () => void;
  logout: () => void;
  sendStake: (transaction: Transaction | null) => Promise<string>;
};

const IdentityContext = createContext<Identity | null>(null);

function PrivyIdentity({children}: {children: React.ReactNode}) {
  const {authenticated, login, logout} = usePrivy();
  const {wallets} = useWallets();
  const {sendTransaction} = useSendTransaction();
  const value = useMemo<Identity>(
    () => ({
      authenticated,
      address: wallets[0]?.address,
      mode: "privy",
      login,
      logout,
      sendStake: async (transaction) => {
        if (!transaction) throw new Error("Contract address is not configured.");
        const result = await sendTransaction(transaction, {
          address: wallets[0]?.address,
          sponsor: process.env.NEXT_PUBLIC_SPONSOR_TRANSACTIONS === "true",
        });
        return result.hash;
      },
    }),
    [authenticated, login, logout, sendTransaction, wallets],
  );
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

function DemoIdentity({children}: {children: React.ReactNode}) {
  const [authenticated, setAuthenticated] = useState(false);
  const value = useMemo<Identity>(
    () => ({
      authenticated,
      address: authenticated ? "0xD1b5…A143" : undefined,
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
        loginMethods: ["farcaster", "email", "passkey"],
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
