# Dibs Chainlink CRE workflow

The workflow runs every 15 minutes, fetches closing Farcaster-market observations, applies the quality filter deterministically, commits an evidence hash, and writes chain-bound `submitResult` reports to `DibsSettlementReceiver` on Monad.

The application exposes `/api/oracle/observations`. It selects closed, unresolved markets from Envio, fetches each cast's likes, recasts, and reply tree from Neynar, and derives account age from Neynar's `registered_at` field plus account quality from `score`/`experimental.neynar_user_score`. The deterministic market close time is used as `observedAt`, so CRE nodes hash identical evidence rather than their individual wall clocks.

Quality rules are executable rather than narrative:

- Accounts younger than 30 days are rejected.
- Neynar scores below 0.60 are rejected.
- Likes, recasts, and replies receive weights of 1.0, 2.5, and 3.0.
- The opening quality-weighted baseline is subtracted.
- Canonically ordered evidence is hashed and stored with the result.

Run `npm test` and `npm run typecheck` locally. `config.testnet.json` targets the deployed **receiver** address (not the core Dibs address). Authenticate the CRE CLI, then simulate and deploy the workflow through the checked-in target manifests:

```sh
cre workflow simulate . --target staging-settings
cre workflow deploy . --target staging-settings --yes
```

With deployment access enabled, verify the registered workflow with:

```sh
cre workflow get . --target staging-settings --json
cre workflow list --output json
```

The deploy command returns a workflow ID. Pin that exact ID on the deployed receiver using its owner
key, then set `NEXT_PUBLIC_CRE_SETTLEMENT_MODE=don` in the app. The receiver remains fail-closed until
the ID is pinned. The DON's cron trigger owns settlement execution; GitHub only monitors deployment
health and does not run the local broadcast simulator.

For a local fallback or reproducible hackathon rehearsal, a ready testnet observation can be submitted through the
CRE broadcast simulator from the repository root:

```sh
npm run cre:broadcast
```

The script refuses to change onchain state when the production observation queue is empty. For
`simulate --broadcast`, it validates a dedicated receiver that trusts CRE's Monad MockForwarder,
temporarily routes only the Dibs oracle role to that receiver, broadcasts the reports, and restores
the production Keystone receiver on success, failure, or interruption. The workflow verifies every
`writeReport` status and prints its transaction hash; a simulator log is not treated as submission
proof without `TX_STATUS_SUCCESS`. It also requires at least 20 minutes before every submit or
challenge-resolution deadline, leaving room for the cron trigger and transaction confirmation.

`config.broadcast.json` is intentionally separate from `config.testnet.json`. The former targets
the simulation-only receiver; the latter remains the DON/production configuration. Never point a
production workflow at the MockForwarder receiver.

## Historical hackathon simulation

The repository retains a checked-in deterministic simulation target for reproducibility. It exercises CRE HTTP consensus, quality filtering, evidence hashing,
Monad settlement calldata encoding, and report preparation without broadcasting a transaction:

```sh
cre workflow simulate . --target simulation-settings
```

The fixture is explicitly labeled and is never read by the production settlement target. The
latest reproducible output and hashes are recorded in
[`SIMULATION_EVIDENCE.md`](SIMULATION_EVIDENCE.md).

The dedicated simulation receiver must trust the network's official MockForwarder, while the
production receiver must trust the KeystoneForwarder. Query the current addresses with
`cre workflow supported-chains --output json`. Keep the simulation receiver's expected workflow ID
unset because MockForwarder omits production metadata. The production receiver is now pinned to the
active DON workflow above and must never be replaced by the MockForwarder receiver.
