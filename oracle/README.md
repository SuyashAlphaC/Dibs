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

While DON deployment access is pending, a ready testnet observation can be submitted through the
CRE broadcast simulator from the repository root:

```sh
npm run cre:broadcast
```

The script refuses to modify the receiver when the production observation queue is empty, verifies
that the configured key owns the receiver, temporarily clears the workflow-ID guard for the mock
forwarder, broadcasts the report, and restores the exact previous guard on success or failure.

## Hackathon simulation

The hackathon submission uses the checked-in deterministic simulation target while production
deployment access is pending. It exercises CRE HTTP consensus, quality filtering, evidence hashing,
Monad settlement calldata encoding, and report preparation without broadcasting a transaction:

```sh
cre workflow simulate . --target simulation-settings
```

The fixture is explicitly labeled and is never read by the production settlement target. The
latest reproducible output and hashes are recorded in
[`SIMULATION_EVIDENCE.md`](SIMULATION_EVIDENCE.md).

The receiver must trust the network's official MockForwarder for a broadcast simulation or KeystoneForwarder for production; query your tenant's current addresses with `cre workflow supported-chains --output json`. Keep its expected workflow ID unset during simulation because MockForwarder omits production metadata. After production workflow deployment, call `setExpectedWorkflowId(bytes32)` with its ID before broadcasting reports.
