# Dibs

Hackathon judges: see the [submission guide](./SUBMISSION.md), the [production operations runbook](./OPERATIONS.md), and the live [/evidence](https://dibs-metropolis.vercel.app/evidence) ledger for the demo path, architecture, sponsor evidence, and explicit execution boundaries.

**Call culture before it matters.** Dibs is a conviction-ranked Farcaster feed on Monad. Scouts buy increasingly expensive conviction units on casts they believe will grow; quality-weighted engagement informs settlement when observations are available, and successful early scouts share the reward allocation.

## The case for Dibs: Track 2 and four sponsor bounties

### Main track — Social, Attention & Culture

The track asks how open social graphs and competitive feeds can turn cultural participation into
real ownership. Dibs answers with a working loop, not a feed mockup: **a Farcaster cast becomes a
Monad market; scouts put MON behind an early call; their onchain conviction changes discovery rank;
and the outcome becomes a public, inspectable record.** The scout owns a real contract position,
not a platform-assigned badge. The contract also reserves a creator reward allocation, connecting
discovery to the person whose work drew the early belief.

This is a competitive feed algorithm with economic accountability. Popularity alone cannot buy the
top spot: the feed uses Envio-indexed scout positions and stake, while the market's closing result
uses quality-weighted attention when source observations are available. Farcaster provides the
open cultural graph and Mini App distribution; Monad provides positions, challenges, allocations,
and claims. A scout profile makes repeated early calls legible over time. A new participant can
start with Privy rather than first learning wallet setup, while Nansen's pre-stake context helps
them question whether apparent community support is concentrated or connected.

The social promise is concrete: creators can be discovered before an algorithm declares them
popular, communities can see who backed a signal early, and participants can inspect the rules and
results instead of trusting a private engagement score. The [live Discover feed](https://dibs-metropolis.vercel.app/discover),
[scout and market evidence](https://dibs-metropolis.vercel.app/evidence), and
[Monad deployment](./deployments/monad-testnet.md) let judges follow that complete loop. Dibs
does not claim measured community impact beyond the activity visible in those records.

### Four sponsor bounties — one product, four indispensable integrations

| Bounty | Why Dibs makes a strong case | What judges can verify |
| --- | --- | --- |
| **Best Use of Envio** | HyperIndex is the product's read layer: it turns Monad events into the live conviction feed, stake-ranked markets, early-scout ledger, settlement states, and reputation. Remove Envio and the discovery and proof experience loses its current onchain state. | Inspect the [indexer](./indexer), an indexed market in [Discover](https://dibs-metropolis.vercel.app/discover), and the [live evidence ledger](https://dibs-metropolis.vercel.app/evidence). |
| **Best workflow with CRE** | The deployed DON workflow is the settlement orchestrator, not a local-only proof. DON nodes compute deterministic quality scores and evidence hashes, reach consensus, and deliver chain-bound reports through the Keystone Forwarder to a workflow-pinned Monad receiver. Challenge re-observation is part of the same design. | Check the [active workflow and authenticated market-32 and market-33 receipts](./evidence/live-don-settlement/README.md), including a positive score for market 33, then inspect the [workflow code](./oracle). |
| **Privy!** | Privy participates beyond login: it creates embedded wallets, links Farcaster identity, protects nominations with verified sessions, and lets a scout approve an explicit MON conviction transaction while eligible embedded-wallet gas is sponsored. Identity, action, and the resulting Envio position form one user journey. | Follow the [judge-facing Privy flow](https://dibs-metropolis.vercel.app/privy) and [identity-to-action implementation map](./evidence/privy/README.md). A fresh wallet transaction is the strongest end-to-end demo proof. |
| **Best use of Nansen** | Conviction Lens makes wallet intelligence a pre-stake decision feature: exact Envio stakes are joined to Nansen related-wallet results, with concentration, observed connections, inspectable source evidence, and explicit coverage limits. Nansen does not decide settlement or silently label wallets safe. | Inspect the [integration and live field capture](./evidence/nansen/README.md) and [Conviction Lens](https://dibs-metropolis.vercel.app/intelligence). Six real market-32 backers were queried; no relationships were returned, and the UI says so. |

The differentiator is the **connected path from social discovery to user-owned conviction to
verifiable outcome**. Each sponsor powers a necessary stage of that path rather than an isolated
API call. The evidence also exposes limits honestly: an unavailable Farcaster cast is not assigned
a fabricated quality score, Nansen's empty response is not proof of independent ownership, and a
configured integration is not presented as a completed user transaction. This is Dibs' strongest
evidence-backed submission case; comparative ranking and prizes remain the judges' decision.

## What is implemented

- Responsive Next.js feed, market action, settlement console, and scout ledger.
- Privy Farcaster/email/passkey authentication and embedded-wallet transaction path.
- Privy-sponsored gas for embedded-wallet transactions, with the MON conviction amount kept explicit and user-approved.
- Neynar-backed early-cast API with explicit live, unavailable, empty, and labelled preview states.
- Persistent Privy wallet-to-Farcaster identity resolution for scout cards and ledgers.
- Nansen Conviction Lens joins indexed scout stakes with permitted related-wallet evidence to explain concentration and observed backer connections before staking. Live access requires a Nansen API key; fixtures are isolated and labelled.
- Native-MON Solidity contract with bounded epochs, linear conviction curves, sponsor funding, permissioned market opening, oracle results, evidence hashes, bonded challenges, per-market payout caps, creator rewards, and pull-based claims.
- Envio indexer for epochs, markets, positions, timeouts, allocations, settlements, and scout reputation; the feed polls indexed stake totals for live ranking.
- Chainlink CRE workflow for observation consensus, deterministic quality scoring, evidence hashing, Monad settlement reports, and secondary challenge review.
- ERC-165 CRE settlement receiver with Keystone Forwarder authentication, optional workflow-ID pinning, chain-bound reports, and a strict settlement-function allowlist.
- Authenticated market keeper with fail-closed kill switches, just-in-time seed top-ups within a cumulative per-epoch funding cap, a retained-balance guard before every write, per-run transaction ceilings, exact 24-hour epochs, lifecycle expiry, and finalization.
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
- Active CRE workflow: `dibs-settlement-testnet`
- Workflow ID: `0x00733a308f4ccaf2b3bdf6952866e293ce85b31be878e6883c54390b944b72fb`
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

## Privy identity-to-action integration

The public [`/privy`](https://dibs-metropolis.vercel.app/privy) page exposes the complete Privy
boundary for judges without revealing credentials: familiar sign-in, automatic embedded-wallet
creation, optional Farcaster linking, server-side access-token verification, user-approved Monad
transactions, and gas sponsorship for embedded wallets. External wallets remain supported and pay
their own gas. Sponsorship never hides or subsidizes the MON conviction amount being put at risk.

The reproducible judge flow and implementation map are recorded in
[`evidence/privy/README.md`](evidence/privy/README.md).

## Nansen conviction intelligence

Market pages expose a **Conviction Lens** and feed cards link directly to it. The feature combines
exact Envio scout stakes with Nansen's `POST /api/v1/profiler/address/related-wallets` endpoint;
it is decision context, not a settlement input or a Smart Money leaderboard. The standalone
`/intelligence` page includes a genuine historical market-32 capture (six successful Base queries,
no returned relationships), separately from an explicitly synthetic, non-stakeable teaching example.
The pre-stake review brief combines direct relationships and shared counterparties into
stake-weighted groups, links each finding to inspectable evidence, and prioritizes concentration
and coverage checks. Indirect connections are not labelled as direct transfers or common owners.
Failed retries retain previous results, dataset results stay separate, and the cooldown counts down
without automatic paid retries. No-backers markets do not offer an unnecessary wallet scan.

Configure server-only `NANSEN_API_KEY` and `NANSEN_INTELLIGENCE_ENABLED=true` only after checking
the Nansen account's credit allowance. Paid queries are explicit, Privy/Farcaster-authenticated,
bounded and cached. Missing credentials do not trigger fixture substitution. Integration details,
setup instructions, retained provider proof, limits and the remaining end-user demo gate are in
[`evidence/nansen/README.md`](evidence/nansen/README.md).

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

The canonical current deployment, runtime, recovery, and judge-demo sequence is maintained in the
[production operations runbook](./OPERATIONS.md). The details below remain as a quick reference.

1. Set `CRE_FORWARDER_ADDRESS` to the official forwarder for the target Monad network. Confirm the address for your CRE tenant with `cre workflow supported-chains --output json`.
2. Run `contracts/script/Deploy.s.sol`. It deploys Dibs, deploys `DibsSettlementReceiver`, and makes the receiver Dibs' oracle atomically in one broadcast.
3. Configure `MARKET_OPENER_PRIVATE_KEY` and `CRON_SECRET`; set explicit `MARKET_EPOCH_SEED_MON`, `MARKET_MAX_EPOCH_SEED_MON`, `MARKET_MIN_OPERATOR_BALANCE_MON`, `MAX_MARKETS_PER_RUN`, and `MAX_MAINTENANCE_TRANSACTIONS_PER_RUN` limits. Enable `MARKET_AUTOMATION_ENABLED` and `MARKET_OPENING_ENABLED` only after validating those limits. The keeper opens only substantive root casts younger than 30 minutes with fewer than 25 interactions; referral promotions, bonus/airdrop solicitations, and hashtag/mention/link spam are rejected before any chain write.
4. Put the Dibs deployment address and block in `indexer/config.yaml`, deploy the indexer, and expose its GraphQL URL to the frontend.
5. Configure Privy, Neynar, and transaction sponsorship.
6. Put the **receiver address** in `oracle/config.testnet.json`, deploy with `cre workflow deploy . --target staging-settings --yes`, and pin the returned workflow ID on the receiver. Confirm `cre workflow get . --target staging-settings --json` reports `ACTIVE` before enabling DON mode in the app.
7. Rehearse one normal settlement and one challenged/bot-filtered settlement before recording the demo.

The production keeper is scheduled by Upstash QStash every five minutes. QStash calls the
authenticated `/api/markets/open` endpoint, retries transient delivery failures, and redacts the
forwarded bearer token from its logs. Its stable schedule ID is
`dibs-market-keeper-production`; configuration, verification, and recovery steps are in the
[operations runbook](./OPERATIONS.md). Farcaster ownership for
`dibs-metropolis.vercel.app` is signed by FID `2459338`; the association is stored in Vercel and
served through the production manifest.

The endpoint is idempotent at the contract boundary and refuses to spend when the operator safety
floor or epoch limits would be violated. QStash is the external production scheduler; Vercel does
not provide the sub-daily cron that drives this endpoint.

Automation is fail-closed: unset switches perform no writes, the seed defaults to zero in code,
the configured seed may not exceed the explicit cap, and the operator must retain the configured
minimum balance after funding. `MARKET_OPENING_ENABLED=false` pauses new spending while allowing
the keeper to advance existing lifecycle state. Public nominations require a verified Privy
session plus a linked Farcaster account, are rate-limited per Privy user, emit a structured audit
record, respect the epoch market cap, and never create a funded epoch.

The deployed CRE workflow owns settlement execution on the DON; it wakes every two minutes from
its Cron trigger and processes up to eight markets through the pinned Keystone receiver. Each node
scores full observations before consensus, reducing the agreed payload to scores and evidence hashes.
Onchain reads skip stale indexer results. The separate health monitor checks that the workflow is
`ACTIVE`, that a recent execution succeeded, that the receiver pins the deployed workflow ID,
and that the observation queue is healthy. `/api/health` checks dependencies and queue readiness;
it does not substitute for DON execution evidence. Market-level provider gaps remain explicit and
retryable without blocking other valid markets; global dependency, consensus, or onchain failures
remain visible rather than being reported as successful settlements.

`npm run proof:stake` is the reproducible live proof harness. It buys one unit on an active,
compliant market with a dedicated testnet key and fails unless the resulting position appears in
the production Envio-backed API. For settlement proof, use the
[recorded live DON receipts](./evidence/live-don-settlement/README.md) and inspect the active
workflow with `cre workflow get . --target staging-settings --json` from `oracle/`.
