# Chainlink CRE DON settlement evidence

This directory records the verified production settlement boundary for Dibs on Monad testnet.
Unlike the older `live-market-12` artifact, these are not local `simulate --broadcast` writes.
The active `dibs-settlement-testnet` workflow executed on the Chainlink DON and delivered both
reports through the official Monad testnet Keystone Forwarder.

## Workflow

- Status: `ACTIVE`
- Registry: private
- Registered: `2026-10-05T03:07:55Z`
- Deployed: `2026-10-05T03:07:56Z`
- Workflow ID: `0x0087c79221932bb3a2dbee759ffd89a1325e58db7ba736b6abaca52e20128552`
- Cron trigger: every fifteen minutes
- Observation endpoint: `https://dibs-metropolis.vercel.app/api/oracle/observations`
- Historical status captured earlier on 2026-10-07: `SUCCESS`, with no workflow errors
- Captured registry response: [`workflow-status.json`](workflow-status.json)

This is evidence for the original deployment. The workflow was updated on 2026-10-07 after a
consensus payload limit incident. Its current ID, pin and successful scheduled recovery are recorded
in [`../cre-recovery-2026-10-07`](../cre-recovery-2026-10-07/README.md).

## Authenticated onchain boundary

- Chain: Monad testnet (`10143`)
- Keystone Forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`
- Settlement receiver: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- Dibs: `0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84`

The receiver authenticates the Forwarder and pinned workflow ID, checks the report's chain and
contract binding, and permits only `submitResult` and `resolveChallenge` settlement calldata.

## Confirmed reports

### Market 32 — zero-growth result

- Transaction: `0x8d0fa1b3d862e896c8fe161b22928a64089ae96adb8281fde03fd588306b5fd4`
- Block: `68455332`
- Transaction status: success
- Transaction destination: official Keystone Forwarder
- Quality-growth score: `0`
- Events: `SettlementReportForwarded`, `ResultSubmitted`

### Market 33 — positive result

- Transaction: `0xeee2341f26b475d0c1f44a69625d4f6b640326b357313ca132e85aa7cece887a`
- Block: `68455340`
- Transaction status: success
- Transaction destination: official Keystone Forwarder
- Quality-growth score: `6685`
- Evidence hash: `0x41cf811e176df841e67522a66bd5a8cfef28301340bb43006f8a966f96f811dc`
- Events: `SettlementReportForwarded`, `ResultSubmitted`

The corresponding results are indexed by Envio and visible in the production market and evidence
views. The public health endpoint reports receiver mode `don` and `workflowPinned: true`.
The distilled receipt record is checked in as [`settlements.json`](settlements.json).

## Reproduce the checks

```bash
cd oracle
cre workflow get . --target staging-settings --json

curl -sS https://dibs-metropolis.vercel.app/api/health | jq
curl -sS https://dibs-metropolis.vercel.app/api/evidence | jq
```

The production observation endpoint aggregates Neynar observations before DON consensus. This is
the disclosed external-data trust boundary; Dibs does not claim that each node talks directly to
Neynar. Historical simulation artifacts remain available for deterministic fixture reproduction,
but they are not used as evidence of the live execution described here.
