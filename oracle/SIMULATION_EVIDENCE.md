# Chainlink CRE simulation evidence

This is the historical reproducible fixture proof created before DON deployment access was
granted. It remains useful for reproducing quality filtering and challenge correction, but it is
not the submission's production-execution evidence. The verified live DON record is in
[`evidence/live-don-settlement`](../evidence/live-don-settlement/README.md).

## Command

From `oracle/`:

```sh
cre workflow simulate . --target simulation-settings
```

## Verified run

- Timestamp: `2026-09-28T15:46:51Z`
- CRE CLI: `1.33.0`
- Network configuration: Monad testnet (`10143`)
- Receiver encoded into the report: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- Binary hash: `0ded2d257d90635098f513bf49746add2a67d3a88e783bfd616997fc5fe9e5df`
- Config hash: `1d9db45337742e3528773ca39f4a50cf436b40e999bb7a9998d8c2ec6d35c5e5`
- Workflow result: `2`

Key user log:

```text
market=2 action=submit score=3800 upheld=false accepted=3 rejected=2 report=prepared-dry-run
market=3 action=resolve score=3800 upheld=true accepted=3 rejected=2 report=prepared-dry-run
```

## What the run proves

1. CRE fetched the observation envelope through its HTTP capability and identical-consensus
   aggregation.
2. The deterministic scorer rejected a two-day-old account and an account below the Neynar
   quality threshold.
3. Three qualified interactions produced a closing score of `5000`; subtracting the fixture's
   `1200` baseline produced quality growth of `3800`.
4. The workflow encoded `submitResult(2, 3800, evidenceHash)` for Monad, wrapped it in the
   chain-bound receiver payload, and prepared a CRE report.
5. A second challenged observation began with a reported score of `8000`, recomputed to `3800`,
   and prepared `resolveChallenge(3, 3800, evidenceHash, true)` so the challenger bond is refunded.

## Safety boundary

- `config.simulation.json` sets `dryRun: true`, so the report is prepared but not submitted.
- The deterministic fixture is served from `/api/oracle/simulation-fixture`, returns
  `simulation: true`, and is never used by `config.testnet.json`.
- At the time of this run, the receiver used its fail-closed pre-deployment configuration. It is
  now pinned to active workflow ID
  `0x0087c79221932bb3a2dbee759ffd89a1325e58db7ba736b6abaca52e20128552`.
- Contract-side receiver forwarding is covered separately by seven Foundry tests, including
  wrong-forwarder, wrong-chain, wrong-workflow, and function-allowlist rejection cases.

## Fixture

The public, labeled fixture can be inspected at:

`https://dibs-metropolis.vercel.app/api/oracle/simulation-fixture`

Production observations remain at:

`https://dibs-metropolis.vercel.app/api/oracle/observations`
