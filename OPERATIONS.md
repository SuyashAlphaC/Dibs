# Dibs production operations

This is the canonical runbook for the live Monad testnet deployment. It describes the path judges
should exercise and the small set of operator actions that are still manual. It supersedes older
simulation-first notes; simulation remains available only as an isolated rehearsal.

## Current production state

- App: <https://dibs-metropolis.vercel.app/discover>
- Chain: Monad testnet (`10143`)
- Dibs contract: `0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84`
- CRE receiver: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- Official Keystone Forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`
- Active CRE workflow: `dibs-settlement-testnet`
- Pinned workflow ID: `0x00733a308f4ccaf2b3bdf6952866e293ce85b31be878e6883c54390b944b72fb`
- Envio HyperIndex endpoint: configured server-side through `ENVIO_GRAPHQL_URL`

The live health check at `2026-10-08T13:54:33Z` reported `ok: true`, a ready DON receiver with
the pinned workflow, an empty settlement queue, and ready Privy capabilities. Re-check before a
demo because health is a point-in-time observation:

```sh
curl -sS https://dibs-metropolis.vercel.app/api/health | jq
```

## The end-to-end flow

```text
Farcaster/Neynar
  -> QStash POST /api/markets/open (every 5 minutes)
  -> funded 24-hour epoch + eligible market on Monad
  -> Privy-authenticated scout signs an explicit MON position
  -> Dibs events -> Envio HyperIndex -> feed, profiles and ledgers
  -> CRE DON (every 2 minutes) reads the observation API
  -> each DON node scores and hashes evidence before compact consensus
  -> Keystone Forwarder -> pinned receiver -> submitResult/resolveChallenge
  -> Envio indexes settlement -> allocation, reputation and pull-based claims
```

### 1. Discovery and market opening

The authenticated market keeper calls `/api/markets/open`. It advances lifecycle timeouts and epoch
finalization, then opens only quality-gated root casts in an already funded epoch. It does not create
an epoch from a public nomination and it never spends when the safety switches, balance floor, or
per-run transaction limits fail.

The Discover feed's **New** view means markets indexed within the last 30 minutes; it can be empty
even while older active/closing markets are visible in **All**. Category filters are text/category
matches over the indexed cast metadata, not settlement states.

Production delivery is owned by Upstash QStash:

- schedule ID: `dibs-market-keeper-production`
- destination: `https://dibs-metropolis.vercel.app/api/markets/open`
- method: `POST`
- cron: `*/5 * * * *`
- timeout: 120 seconds; retries: 3 with exponential delay

Vercel stores the delivery secret as `CRON_SECRET`. The QStash management workflow stores the same
value as the GitHub secret `DIBS_CRON_SECRET` and forwards it as the bearer token. `QSTASH_TOKEN`
is used only by the management workflow; it is not a runtime app credential.

Configure or verify the schedule (these are operator actions, not the normal market loop):

```sh
gh workflow run qstash-market-keeper.yml -f operation=configure
gh workflow run qstash-market-keeper.yml -f operation=verify
```

The workflow in `market-keeper.yml` has `workflow_dispatch` only and is an emergency recovery path.
It is not the production scheduler. Do not re-enable its schedule while QStash owns the endpoint.

### 2. Identity, wallet and staking

Privy is the identity-to-action boundary, not a login-only badge:

1. The scout signs in with email, passkey, external wallet, or Farcaster.
2. Privy creates an embedded EVM wallet for a user without an external wallet; an external wallet
   remains supported.
3. The scout may link Farcaster. Server routes verify the Privy access token and linked account before
   accepting public nominations or a paid Nansen scan.
4. The confirmation UI shows the exact MON conviction amount. The user approves the transaction;
   Dibs never signs for the scout and never takes custody.
5. Embedded-wallet gas sponsorship is optional and does not subsidize the MON position. External
   wallets pay their own gas.
6. Monad events are indexed by Envio and resolve to the linked Farcaster identity in the feed,
   activity ledger and scout profile.

Use <https://dibs-metropolis.vercel.app/privy> for the judge-facing proof and keep
`PRIVY_APP_SECRET` server-only.

### 3. Nansen Conviction Lens

The market page's Conviction Lens is an explicit, pre-stake decision feature. It joins the actual
Envio backer addresses and exact stake weights with Nansen's
`POST /api/v1/profiler/address/related-wallets` endpoint. It reports concentration, direct/shared
counterparty evidence, source timestamps, request IDs and coverage limits; it does not alter rank,
quality scores, payouts or CRE settlement.

Live scans require a verified Privy session with a linked Farcaster account and an explicit context
chain (`monad`, `base`, or `ethereum`). The server queries at most eight earliest indexed backers,
two at a time, caches successful results for 15 minutes, and enforces a per-user cooldown. Nansen
credentials are server-only:

```text
NANSEN_API_KEY=<server-only key>
NANSEN_INTELLIGENCE_ENABLED=true
```

No key, failed response, empty response, or synthetic fixture is silently converted into a claim of
independence. The retained market-32 Base capture is genuine provider evidence and returned no
relationships; the UI states that limitation. The fixture on `/intelligence` is labelled synthetic
and is never used by the production route.

### 4. CRE DON settlement

The active CRE target is `staging-settings` in `oracle/workflow.yaml`, using
`oracle/config.testnet.json` and a six-field CRE cron of `0 */2 * * * *` (every two minutes).
The DON fetches at most eight closing or challenged markets from
`/api/oracle/observations`. Each node performs the quality gate and canonical evidence hash before
consensus, so raw interaction lists do not enter the consensus payload. Onchain preflight skips
already-submitted or resolved markets. The receiver accepts only the official Forwarder, the pinned
workflow ID, chain `10143`, the deployed Dibs address, and the allowlisted settlement calls.

Normal settlement requires no command from the operator. The DON cron owns execution. The GitHub
workflow `.github/workflows/cre-settlement.yml` is scheduled every 15 minutes as a health monitor
(GitHub can delay scheduled runs): it
checks an `ACTIVE` workflow, recent successful executions, pin consistency and `/api/health`, then
uploads evidence. It must not invoke `simulate --broadcast`.

The monitor retries CRE CLI collection failures up to four times, with 2-, 4-, and 8-second delays.
Each request has a 45-second timeout, and only validated JSON is saved. An authentication/API
outage is reported as monitoring data unavailable; a returned failed execution still fails the
health check immediately. Existing freshness and receiver-pin checks remain enforced. The
`CRE_SETTLEMENT_AUTOMATION_ENABLED=true` GitHub variable enables this monitor, and the
`CRE_API_KEY` GitHub secret authenticates its read-only CRE requests.

On 2026-10-09, monitor run `37891396913` failed during CRE credential validation and then tried to
parse an empty status file. Its retained execution history showed five successful DON executions,
including the `06:00:11Z` completion. This was a monitoring collection failure, not evidence of a
failed settlement. Persistent collection failures require checking CRE service availability and
the CI credential; they must never be treated as verified healthy.

Inspect the current DON without writing to chain:

```sh
cd oracle
cre workflow get . --target staging-settings --json
cre execution list dibs-settlement-testnet --limit 10 --output json
cd ..
curl -sS https://dibs-metropolis.vercel.app/api/health | jq '.services.creReceiver,.services.oracleQueue'
```

The latest verified execution at `2026-10-08T12:24:07Z` was `SUCCESS`; the current queue was empty
at the health check above. Production settlement is in DON mode (`NEXT_PUBLIC_CRE_SETTLEMENT_MODE=don`).

### 5. Settlement, rewards and claims

After the 24-hour market window, the DON submits the quality result. The challenge window and any
challenge-resolution window are enforced by the contract. Finalization allocates the reward pool and
scout positions use the contract's pull-based claim path. Nansen context is informational and cannot
settle a market or move funds.

## Deployment and recovery actions

These are the only expected manual operations:

1. **QStash schedule management:** configure or verify the stable schedule after changing secrets or
   the production URL.
2. **CRE deployment rotation:** pause, deploy, pin the new nonzero workflow ID, verify the receiver pin,
   then activate. Never clear the receiver pin during rotation.
3. **CRE monitoring:** inspect failed monitor artifacts and the execution logs before changing code.
4. **Emergency recovery:** use `market-keeper.yml` only when QStash is paused/deleted. Restore QStash
   ownership immediately after recovery.

The isolated `npm run cre:broadcast` path and `simulation-settings` target are rehearsal tools only.
They use a separate receiver/fixture, must never be pointed at the production DON receiver, and are
not evidence of live settlement. Keep `CRE_SETTLEMENT_MODE=don` in production.

## Evidence map

- `evidence/cre-recovery-2026-10-07/` — current workflow recovery, compact consensus and receipts.
- `evidence/live-don-settlement/` — confirmed Monad Forwarder writes; older JSON files are retained
  as historical captures and are not the current workflow registry state.
- `evidence/nansen/` — genuine provider capture, route/security verification and Nansen limits.
- `evidence/privy/` — identity-to-action and custody boundary proof.
- `deployments/monad-testnet.md` — contract, receiver, workflow and transaction ledger.

For judge-facing sequence and sponsor coverage, see [`SUBMISSION.md`](SUBMISSION.md). For the CRE
implementation details, see [`oracle/README.md`](oracle/README.md).
