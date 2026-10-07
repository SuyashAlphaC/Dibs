import assert from "node:assert/strict";
import test from "node:test";
import {getPrivyIntegrationStatus} from "./privy-integration";

test("Privy integration is ready only with client and server boundaries configured",()=>{
  assert.deepEqual(getPrivyIntegrationStatus({
    NEXT_PUBLIC_PRIVY_APP_ID:"app-id",
    PRIVY_APP_SECRET:"secret",
    NEXT_PUBLIC_SPONSOR_TRANSACTIONS:"true",
  }),{
    status:"ready",
    appIdConfigured:true,
    serverVerificationConfigured:true,
    embeddedWalletsEnabled:true,
    farcasterLinkingEnabled:true,
    sponsoredTransactionsEnabled:true,
  });
});

test("Privy capability proof never upgrades partial configuration",()=>{
  const status=getPrivyIntegrationStatus({NEXT_PUBLIC_PRIVY_APP_ID:"app-id"});
  assert.equal(status.status,"partial");
  assert.equal(status.serverVerificationConfigured,false);
  assert.equal(status.sponsoredTransactionsEnabled,false);
});
