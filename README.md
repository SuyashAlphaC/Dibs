# Dibs

Hackathon judges: see the [submission guide](./SUBMISSION.md) and the live [/evidence](https://dibs-metropolis.vercel.app/evidence) ledger for the demo path, architecture, sponsor evidence, and explicit execution boundaries.

**Call culture before it matters.** Dibs is a conviction-ranked Farcaster feed on Monad. Scouts buy increasingly expensive conviction units on casts they believe will grow; quality-weighted engagement resolves each epoch, and successful early scouts share the reward allocation.

## What is implemented

- Responsive Next.js feed, market action, settlement console, and scout ledger.
- Privy Farcaster/email/passkey authentication and embedded-wallet transaction path.
- Neynar-backed early-cast API with explicit live, unavailable, empty, and labelled preview states.
- Persistent Privy wallet-to-Farcaster identity resolution for scout cards and ledgers.
- Native-MON Solidity contract with bounded epochs, linear conviction curves, sponsor funding, permissioned market opening, oracle results, evidence hashes, bonded challenges, per-market payout caps, creator rewards, and pull-based claims.
- Envio indexer for epochs, markets, positions, timeouts, allocations, settlements, and scout reputation; the feed polls indexed stake totals for live ranking.
- Chainlink CRE workflow for observation consensus, deterministic quality scoring, evidence hashing, Monad settlement reports, and secondary challenge review.
- ERC-165 CRE settlement receiver with Keystone Forwarder authentication, optional workflow-ID pinning, chain-bound reports, and a strict settlement-function allowlist.
- Authenticated market keeper with fail-closed kill switches, bounded epoch funding, a retained-balance guard before every write, per-run transaction ceilings, exact 24-hour epochs, lifecycle expiry, and finalization.
- Privy-authenticated Farcaster nominations that can open eligible casts only inside an existing keeper-funded epoch and can never create or fund epochs.
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

Production never substitutes fixtures for live data. Set `NEXT_PUBLIC_DEMO_MODE=true` only for
an explicitly labelled, non-stakeable preview. Add `NEXT_PUBLIC_PRIVY_APP_ID`,
`PRIVY_APP_SECRET`, and `NEYNAR_API_KEY` to resolve linked Farcaster identities. Add the
deployed `NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS` to make the Dibs action submit a Monad transaction.

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
3. Configure `MARKET_OPENER_PRIVATE_KEY` and `CRON_SECRET`; set explicit `MARKET_EPOCH_SEED_MON`, `MARKET_MAX_EPOCH_SEED_MON`, `MARKET_MIN_OPERATOR_BALANCE_MON`, `MAX_MARKETS_PER_RUN`, and `MAX_MAINTENANCE_TRANSACTIONS_PER_RUN` limits. Enable `MARKET_AUTOMATION_ENABLED` and `MARKET_OPENING_ENABLED` only after validating those limits. The keeper opens only substantive root casts younger than 30 minutes with fewer than 25 interactions; referral promotions, bonus/airdrop solicitations, and hashtag/mention/link spam are rejected before any chain write.
4. Put the Dibs deployment address and block in `indexer/config.yaml`, deploy the indexer, and expose its GraphQL URL to the frontend.
5. Configure Privy, Neynar, and transaction sponsorship.
6. Put the **receiver address** in `oracle/config.testnet.json`. For the hackathon submission, run the reproducible `simulation-settings` target documented in `oracle/SIMULATION_EVIDENCE.md`. Production registration still awaits Chainlink organization deploy-access approval; only after deployment should the receiver be pinned to the returned workflow ID.
7. Rehearse one normal settlement and one challenged/bot-filtered settlement before recording the demo.

The production keeper is invoked automatically by the deployed Vercel Cron and can also be
invoked by GitHub Actions (`.github/workflows/market-keeper.yml`) as a recovery path. The GitHub
workflow runs on a ten-minute schedule when GitHub dispatches it.
The endpoint rejects requests without the shared bearer
secret, retries transient failures, and then checks `/api/health` for the Envio/oracle queue. The
schedule intentionally runs at minutes `3,13,23,33,43,53` to avoid GitHub's documented
top-of-hour congestion window. Farcaster ownership for `dibs-metropolis.vercel.app` is signed by FID `2459338`; the
association is stored in Vercel and served through the production manifest.

The deployed app also configures a five-minute Vercel Cron for `/api/markets/open`. Vercel sends
the `CRON_SECRET` bearer automatically when that production environment variable is present, so
market opening and lifecycle maintenance do not depend on a user clicking the UI or manually
dispatching GitHub Actions. GitHub's keeper remains a recovery and audit path. The endpoint is
idempotent at the contract boundary and refuses to spend when the operator safety floor or
epoch limits would be violated.

Automation is fail-closed: unset switches perform no writes, the seed defaults to zero in code,
the configured seed may not exceed the explicit cap, and the operator must retain the configured
minimum balance after funding. `MARKET_OPENING_ENABLED=false` pauses new spending while allowing
the keeper to advance existing lifecycle state. Public nominations require a verified Privy
session plus a linked Farcaster account, are rate-limited per Privy user, emit a structured audit
record, respect the epoch market cap, and never create a funded epoch.

The CRE settlement keeper is defined in `.github/workflows/cre-settlement.yml`. It installs Bun
(required by current CRE TypeScript workflows), Foundry, and Chainlink's checksummed CRE CLI. Configure the
`MONAD_RPC_URL`, `CRE_RECEIVER_OWNER_PRIVATE_KEY`, and `CRE_API_KEY` repository secrets plus the four public
contract-address repository variables used by that workflow. Set the repository variable
`CRE_SETTLEMENT_AUTOMATION_ENABLED=true` only after those values are present. A run with an empty observation
queue is a successful no-op. The workflow installs the checksummed CRE CLI using Chainlink's
official installer and broadcasts only after the script's owner, receiver, forwarder, core, and
deadline preflight checks pass.

`npm run proof:stake` is the reproducible live proof harness. It buys one unit on an active,
compliant market with a dedicated testnet key and fails unless the resulting position appears in
the production Envio-backed API. For an adversarial rehearsal, set
`CHALLENGE_DEMO_ENABLED=true` and `CHALLENGE_DEMO_MARKET_ID` only for a closed market without a
result, then run
`CRE_TARGET=challenge-demo-settings DIBS_OBSERVATION_URL=https://dibs-metropolis.vercel.app/api/oracle/challenge-demo npm run cre:broadcast`.
The fixture is explicitly labelled as simulated; disable it immediately after the inflated report,
challenge through the UI, and use the normal production broadcast to recompute from real Neynar
data. The endpoint is disabled by default.

The in-app Scout Assistant is a deterministic, transparent scan over live Envio markets. It can
rank early, high-momentum, or closing signals, but it never signs or submits a wallet transaction.
