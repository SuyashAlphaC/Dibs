# Dibs

Hackathon judges: see the [submission guide](./SUBMISSION.md) for the live demo path, architecture, sponsor evidence, and the explicit CRE simulation boundary.

**Call culture before it matters.** Dibs is a conviction-ranked Farcaster feed on Monad. Scouts buy increasingly expensive conviction units on casts they believe will grow; quality-weighted engagement resolves each epoch, and successful early scouts share the reward allocation.

## What is implemented

- Responsive Next.js feed, market action, settlement console, and scout ledger.
- Privy Farcaster/email/passkey authentication and embedded-wallet transaction path.
- Neynar-backed early-cast API with an offline demo fallback.
- Native-MON Solidity contract with bounded epochs, linear conviction curves, sponsor funding, permissioned market opening, oracle results, evidence hashes, bonded challenges, per-market payout caps, creator rewards, and pull-based claims.
- Envio indexer for epochs, markets, positions, timeouts, allocations, settlements, and scout reputation; the feed polls indexed stake totals for live ranking.
- Chainlink CRE workflow for observation consensus, deterministic quality scoring, evidence hashing, Monad settlement reports, and secondary challenge review.
- ERC-165 CRE settlement receiver with Keystone Forwarder authentication, optional workflow-ID pinning, chain-bound reports, and a strict settlement-function allowlist.
- Authenticated market keeper that discovers eligible Neynar casts, creates exact 24-hour epochs, opens seeded markets, expires missed reports/challenges, and finalizes ready epochs.
- Quality-gated discovery that requires an established Farcaster account, a Neynar score of at least `0.6`, and substantive root-cast text before a market can open.
- Farcaster Mini App SDK bootstrap, hosted manifest, launch metadata, and compliant icon/splash/social assets.

This is hackathon software and has not been audited. Do not use it with production funds.

## Monad testnet deployment

- App: https://dibs-metropolis.vercel.app
- Network: Monad testnet (`10143`)
- Dibs: `0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84`
- CRE receiver: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- CRE forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`
- Deployment block: `65900523`
- Compliant live epoch: `2`, exactly 24 hours, funded with `1 MON`, three eligible markets

Transaction hashes and the receiver's current fail-closed CRE state are recorded in
[`deployments/monad-testnet.md`](deployments/monad-testnet.md).

## Settlement liveness policy

The deployment script configures a one-hour result-submission grace period after an epoch
closes. If the oracle misses that deadline, anyone can record a deterministic zero result with
`expireMissingResult`, so one unavailable observation cannot block the epoch.

Scouts have two hours to challenge a submitted result. The oracle then has an additional three
hours to resolve any challenge. If that deadline is missed, anyone can call `expireChallenge`:
the challenger receives its bond back, the disputed market fails closed at a zero score, and the
epoch can continue to finalization. Finalization emits `MarketAllocated` for every market,
including markets with zero allocation, so indexers can mark the entire epoch settled.

## Repository map

```text
app/          Next.js application and server routes
components/   Privy identity and transaction boundary
lib/          UI models, contract calldata, and demo fixtures
contracts/    Foundry contract, deployment script, and tests
indexer/      Envio HyperIndex configuration, schema, and handlers
oracle/       Chainlink CRE workflow and quality-scoring tests
```

## Run the demo

```sh
npm install
cp .env.example .env.local
npm run dev
```

The UI intentionally enters demo mode when credentials are absent. Add `NEXT_PUBLIC_PRIVY_APP_ID` and `NEYNAR_API_KEY` to enable those live integrations. Add the deployed `NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS` to make the Dibs action submit a Monad transaction.

## Verify

```sh
npm run typecheck
npm run build
npm run contracts:test
npm run proof:stake -- <optional-market-id>

cd indexer && npm run codegen && npm run typecheck
cd ../oracle && npm test && npm run typecheck
```

## Deployment order

1. Set `CRE_FORWARDER_ADDRESS` to the official forwarder for the target Monad network. Confirm the address for your CRE tenant with `cre workflow supported-chains --output json`.
2. Run `contracts/script/Deploy.s.sol`. It deploys Dibs, deploys `DibsSettlementReceiver`, and makes the receiver Dibs' oracle atomically in one broadcast.
3. Configure `MARKET_OPENER_PRIVATE_KEY` and `CRON_SECRET`; the protected keeper creates exact 24-hour epochs and opens only casts younger than 30 minutes with fewer than 25 interactions.
4. Put the Dibs deployment address and block in `indexer/config.yaml`, deploy the indexer, and expose its GraphQL URL to the frontend.
5. Configure Privy, Neynar, and transaction sponsorship.
6. Put the **receiver address** in `oracle/config.testnet.json`. For the hackathon submission, run the reproducible `simulation-settings` target documented in `oracle/SIMULATION_EVIDENCE.md`. Production registration still awaits Chainlink organization deploy-access approval; only after deployment should the receiver be pinned to the returned workflow ID.
7. Rehearse one normal settlement and one challenged/bot-filtered settlement before recording the demo.

The production keeper is invoked every ten minutes by
`.github/workflows/market-keeper.yml`. The endpoint rejects requests without the shared bearer
secret, retries transient failures, and then checks `/api/health` for the Envio/oracle queue. The
schedule intentionally runs at minutes `3,13,23,33,43,53` to avoid GitHub's documented
top-of-hour congestion window. Farcaster ownership for `dibs-metropolis.vercel.app` is signed by FID `2459338`; the
association is stored in Vercel and served through the production manifest.

`npm run proof:stake` is the reproducible live proof harness. It buys one unit on an active,
compliant market with a dedicated testnet key and fails unless the resulting position appears in
the production Envio-backed API. `CHALLENGE_DEMO_MARKET_ID` can nominate that market for one
transparent optimistic-challenge rehearsal after its result is submitted; it is never enabled by
default.

The in-app Scout Assistant is a deterministic, transparent scan over live Envio markets. It can
rank early, high-momentum, or closing signals, but it never signs or submits a wallet transaction.
