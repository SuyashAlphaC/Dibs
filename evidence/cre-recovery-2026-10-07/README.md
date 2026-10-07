# CRE consensus incident and verified recovery — 2026-10-07

## Failure reproduced

The old workflow returned the entire HTTP response as its consensus observation. Once 39 markets
closed, the raw endpoint response reached 30,408 bytes and the DON reported observations above
30 KB against its 25 KB limit. Several nodes also exceeded the default HTTP timeout. The workflow
remained `ACTIVE` while its executions failed; deployment state alone did not establish liveness.

## Production repair

- Every DON node now validates, scores and hashes the complete interaction evidence inside its HTTP
  callback. Consensus compares compact settlement decisions containing the score and evidence hash.
- The API processes up to eight markets, prioritizing challenges and using stable oldest-first
  ordering. It reports deferred observations explicitly rather than truncating evidence or scoring
  unavailable observations as zero.
- The API response budget is 180 KB; the workflow HTTP budget is 200 KB and its compact consensus
  budget is 12 KB. CRE requests use a ten-second timeout and a ten-second shared cache. Neynar
  collection has a seven-second bound per market.
- The production trigger runs every two minutes. Before a write, CRE reads the receiver's core and
  market state on Monad to skip submitted results and resolved challenges despite indexer lag.
- Expired contract deadlines use the existing keeper timeout path. Health reports overdue queued
  work as degraded, and the CRE monitor separately checks recent execution success and exact pinning.
- The monitor preserves execution artifacts after failure and allows a fresh execution in progress
  only when there is a recent completed success from the current deployment.

## Updated deployed workflow

- Name: `dibs-settlement-testnet`
- Registry: private; status: `ACTIVE`
- Workflow ID: `0x00733a308f4ccaf2b3bdf6952866e293ce85b31be878e6883c54390b944b72fb`
- Binary hash: `1761b8b0e4490d74e497d7188ed7588f3ce7bdb9745d87e18c0c397a9020461d`
- Config hash: `2527d3e900742a6087259804401bae62240c0eddddb13205f28dde3a68615c9c`
- Receiver pin transaction: `0x2b98996faa3ec8229c24f7c2243728f5093ca2590c8532c38c62782605c71148`
- Receiver: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- Official Monad testnet Forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`

The workflow was paused, updated, pinned to its new nonzero ID, and then activated. The receiver's
workflow guard was never cleared during this update.

## First scheduled success

Execution `467103b4-84ac-46ec-a294-8db1bc8d0ec9` ran from `2026-10-07T16:06:01Z` to
`2026-10-07T16:06:45Z` and completed with `SUCCESS`. All ten DON nodes logged
`consensusBytes=2350 batch=8 deferred=0`. Markets 37–44 were submitted with their genuine computed
scores, including both positive growth and zero growth. [`first-success.json`](first-success.json)
retains one node's logs and the execution identity.

All eight transaction receipts were independently checked through Monad RPC: successful status,
official Forwarder destination, a `SettlementReportForwarded` event containing the new workflow ID,
and a `ResultSubmitted` event with the matching market and score. The records are in
[`receipts.json`](receipts.json).

For example, market 44 recorded score `45555` through
[`0xc1f34fc0…dc2e4`](https://testnet.monadexplorer.com/tx/0xc1f34fc0b8926ab00ffc221185f005860fb46bb2e8cacaa489238719032dc2e4).

## Backlog cleared automatically

Five scheduled successful executions between `16:06:01Z` and `16:14:40Z` processed the 39-market
backlog. The observation queue then reported `pending: 0`, with no failed, deferred or expired
markets. Subsequent scheduled executions also succeeded with an empty queue. The execution list
and queue snapshot are retained in [`executions.json`](executions.json). These are result
submissions, not a claim that the two-hour challenge window has already elapsed or rewards have
been claimed.

## Regression proof

- A raw observation larger than 25 KB retains all 600 interactions and produces the same score and
  evidence hash after node-side compaction.
- Ordering changes cannot change canonical evidence or the compact consensus result.
- Lower corrected observations uphold a challenge; equal or higher observations do not.
- Malformed batches, duplicate markets/interactions and simulation evidence fail closed.
- Onchain preflight skips stale submitted markets and resolved challenges.
- A 39-market queue is bounded, with challenges prioritized and expired deadlines excluded.
- Recent success, current progress, failure, errors, stale success and deployment replacement are
  covered by monitor regression tests.
- Application tests, oracle tests, monitor tests, TypeScript and production builds pass. The CRE
  fixture and live-data dry run both pass with default production limits enabled.

## Reproduce

```sh
cd oracle
cre workflow get . --target staging-settings --json
cre execution list dibs-settlement-testnet --output json
cre execution logs 467103b4-84ac-46ec-a294-8db1bc8d0ec9 --output json
cd ..
curl -sS https://dibs-metropolis.vercel.app/api/oracle/observations
curl -sS https://dibs-metropolis.vercel.app/api/health
node --test scripts/verify-cre-health.test.mjs
```

Neynar collection remains behind the application's observation API. Each DON node independently
computes the score and hash from those inputs; this evidence does not claim independent upstream
data providers or direct node-to-Neynar access. The production recovery was executed by the DON's
schedule, with no simulator broadcast used to drain the backlog.
