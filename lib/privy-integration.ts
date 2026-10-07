export type PrivyIntegrationStatus={
  status:"ready"|"partial"|"unconfigured";
  appIdConfigured:boolean;
  serverVerificationConfigured:boolean;
  embeddedWalletsEnabled:true;
  farcasterLinkingEnabled:true;
  sponsoredTransactionsEnabled:boolean;
};
type PrivyEnvironment=Partial<Record<"NEXT_PUBLIC_PRIVY_APP_ID"|"PRIVY_APP_SECRET"|"NEXT_PUBLIC_SPONSOR_TRANSACTIONS",string>>;

/** Public, secret-free proof of which Privy boundaries are enabled in this deployment. */
export function getPrivyIntegrationStatus(env:PrivyEnvironment=process.env as PrivyEnvironment):PrivyIntegrationStatus{
  const appIdConfigured=Boolean(env.NEXT_PUBLIC_PRIVY_APP_ID);
  const serverVerificationConfigured=Boolean(env.PRIVY_APP_SECRET);
  return {
    status:appIdConfigured&&serverVerificationConfigured?"ready":appIdConfigured||serverVerificationConfigured?"partial":"unconfigured",
    appIdConfigured,
    serverVerificationConfigured,
    embeddedWalletsEnabled:true,
    farcasterLinkingEnabled:true,
    sponsoredTransactionsEnabled:env.NEXT_PUBLIC_SPONSOR_TRANSACTIONS==="true",
  };
}
