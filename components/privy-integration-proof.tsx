"use client";

import Link from "next/link";
import {useIdentity} from "@/components/identity-provider";
import type {PrivyIntegrationStatus} from "@/lib/privy-integration";

const capabilities=[
  {step:"01",title:"One-tap identity",detail:"Email, passkey, wallet or Farcaster starts the same signed Privy session.",tag:"Authentication"},
  {step:"02",title:"Wallet when needed",detail:"Privy creates an embedded EVM wallet for scouts who arrive without one.",tag:"Embedded wallet"},
  {step:"03",title:"Social identity linked",detail:"A scout can attach Farcaster, giving an onchain position a human profile and FID.",tag:"Farcaster"},
  {step:"04",title:"Mutation authorized",detail:"The server verifies the Privy access token and linked FID before a scout can nominate a cast.",tag:"Server verified"},
  {step:"05",title:"Conviction signed",detail:"Privy submits the user-approved Monad transaction; Dibs never signs or takes custody.",tag:"Transaction"},
  {step:"06",title:"Gas abstracted",detail:"Embedded-wallet network gas is sponsored while the MON conviction remains explicit and at risk.",tag:"Sponsorship"},
];

function stateLabel(value:boolean,ready="Ready"){return value?ready:"Not configured";}

export function PrivyIntegrationProof({deployment}:{deployment:PrivyIntegrationStatus}){
  const identity=useIdentity();
  const connected=identity.authenticated&&identity.walletReady;
  const walletLabel=identity.walletKind==="embedded"?"Privy embedded":identity.walletKind==="external"?"External wallet":identity.walletKind==="demo"?"Demo wallet":"Waiting for scout";
  const gasLabel=!connected?deployment.sponsoredTransactionsEnabled?"Enabled for embedded wallets":"User pays network gas":identity.gasSponsored?"Sponsored by Privy":identity.walletKind==="external"?"External wallet pays gas":"Not sponsored";
  return <div className="privy-page">
    <header className="privy-hero">
      <div><p className="eyebrow">Privy × Dibs · identity-to-action infrastructure</p><h1>Social identity becomes<br/><em>onchain conviction.</em></h1><p>Privy carries a scout from familiar sign-in to a real Monad position—creating a wallet when needed, linking Farcaster, authorizing protected mutations, and sponsoring embedded-wallet gas.</p><div className="privy-hero-actions">{!identity.authenticated?<button className="primary-button" onClick={identity.login}>Start with Privy</button>:!identity.farcaster?<button className="primary-button" onClick={identity.linkFarcaster}>Link Farcaster identity</button>:<Link className="primary-button" href="/discover">Call Dibs on a signal</Link>}<a className="secondary-button" href="https://docs.privy.io/" target="_blank" rel="noreferrer">Privy documentation ↗</a></div></div>
      <aside className="privy-session" aria-live="polite"><div className="privy-orbit"><span>◈</span></div><p>Live scout session</p><strong>{connected?"IDENTITY READY":"CONNECT TO VERIFY"}</strong><small>No secret or personal identifier is exposed.</small></aside>
    </header>

    <section className="privy-state-grid" aria-label="Current Privy session state">
      <article><span>Authentication</span><strong>{identity.authenticated?"Signed in":"Not connected"}</strong><small>{identity.authenticated?"Privy session active":"Email · passkey · wallet · Farcaster"}</small></article>
      <article><span>Wallet boundary</span><strong>{walletLabel}</strong><small>{identity.address?`${identity.address.slice(0,6)}…${identity.address.slice(-4)}`:"Created automatically when required"}</small></article>
      <article><span>Social account</span><strong>{identity.farcaster?`@${identity.farcaster.username??`fid-${identity.farcaster.fid}`}`:"Optional Farcaster link"}</strong><small>{identity.farcaster?`FID ${identity.farcaster.fid} · nomination eligible`:"Required only to nominate casts"}</small></article>
      <article><span>Transaction UX</span><strong>{gasLabel}</strong><small>Conviction value always remains visible</small></article>
    </section>

    <section className="privy-flow" aria-labelledby="privy-flow-title"><header><div><p className="eyebrow">Beyond login</p><h2 id="privy-flow-title">One identity boundary. Six product responsibilities.</h2></div><span>{deployment.status==="ready"?"Production configured":"Configuration incomplete"}</span></header><div>{capabilities.map(capability=><article key={capability.step}><i>{capability.step}</i><span>{capability.tag}</span><h3>{capability.title}</h3><p>{capability.detail}</p></article>)}</div></section>

    <section className="privy-boundary"><div><p className="eyebrow">Public deployment proof</p><h2>Configured without exposing credentials.</h2><p>This status is computed server-side from production configuration. It reveals capability readiness, never the Privy app secret.</p></div><dl><div><dt>Client application</dt><dd className={deployment.appIdConfigured?"ready":""}>{stateLabel(deployment.appIdConfigured)}</dd></div><div><dt>Server token verification</dt><dd className={deployment.serverVerificationConfigured?"ready":""}>{stateLabel(deployment.serverVerificationConfigured)}</dd></div><div><dt>Embedded wallet policy</dt><dd className="ready">Users without wallets</dd></div><div><dt>Farcaster account linking</dt><dd className="ready">Enabled</dd></div><div><dt>Transaction sponsorship</dt><dd className={deployment.sponsoredTransactionsEnabled?"ready":""}>{stateLabel(deployment.sponsoredTransactionsEnabled,"Enabled")}</dd></div><div><dt>Custody model</dt><dd className="ready">User confirmed</dd></div></dl></section>

    <section className="privy-safety"><article><span>01</span><div><strong>The secret stays server-side.</strong><p><code>PRIVY_APP_SECRET</code> is used only to verify access tokens at protected nomination boundaries.</p></div></article><article><span>02</span><div><strong>Social proof is purpose-bound.</strong><p>Farcaster linking is optional for staking and required only when a user asks to nominate a public cast.</p></div></article><article><span>03</span><div><strong>The user approves value.</strong><p>Gas may be sponsored, but every conviction amount is displayed and signed by the scout before it reaches Monad.</p></div></article></section>

    <footer className="privy-source"><div><span>Inspect the implementation</span><strong>Open source, production configured.</strong></div><a href="https://github.com/SuyashAlphaC/Dibs/blob/main/components/identity-provider.tsx" target="_blank" rel="noreferrer">Wallet + transaction boundary ↗</a><a href="https://github.com/SuyashAlphaC/Dibs/blob/main/lib/privy-auth.ts" target="_blank" rel="noreferrer">Server verification boundary ↗</a></footer>
  </div>;
}
