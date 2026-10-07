# Monad testnet deployment

- Chain ID: `10143`
- Dibs: `0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84`
- CRE settlement receiver: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- Keystone Forwarder: `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`
- Owner/deployer: `0x335E58172fC8895Bc380471972A22Ea921152F6d`
- Deployment block: `65900523`
- Deployment transaction: `0x6ebeb478e4d248bddd9405c91d76b97ccd3a278bc6fc74dfffb823e8e417e113`
- Receiver deployment transaction: `0xae2b2605bb0f4eda08901fb85ac3def9310b905a48643b34a996e7ff8421014c`
- Source verification: exact runtime match for both contracts (Monad Sourcify)
- Farcaster Mini App ownership: FID `2459338`, verified through the production
  `/.well-known/farcaster.json` account association.

## Initial epoch

- Epoch: `1`
- Opens: `2026-09-26 16:54:32 UTC`
- Closes: `2026-10-03 16:55:32 UTC`
- Reward pool: `1 MON`
- Creation transaction: `0x5aa07cfe37b002e90e8dce6ccc7a5ef9bea4686ac4f38099009306a085148a82`

## First live market

- Market: `1`
- Cast: `0x3808d724117a8251b9ded16fe060e0c17d5a908a` (Vitalik Buterin, PeerDAS)
- Creator: `0x96b6bb2bd2eba3b4fbefd7dbac448ad7b6cbf279`
- Opening baseline: `72`
- Seed conviction: `0.002 MON`
- Block: `65922439`
- Transaction: `0xe94b53cafc4b2b9c4f0970d36c5e6dba16ef8c4d452434ba0a650d9265fe1912`

## Compliant 24-hour epoch

- Epoch: `2`
- Opens: `2026-09-27 07:10:18 UTC`
- Closes: `2026-09-28 07:10:18 UTC`
- Reward pool at creation: `1 MON`
- Creation transaction: `0xe513bceeb4a6e3b96647a1d87cdadc07d08d50fe2408eb7e325eaae3e25a6478`

All casts below were opened while younger than 30 minutes and below 25 interactions. Each
received the configured `0.002 MON` community seed.

| Market | Cast | Opening transaction |
|---:|---|---|
| 2 | `0x3e3481042393bdb0fb8549978e0ccb120e79c401` | `0x98aab32e8abcc71a5225752a74040872016e7f472ceb80ce70ab3625fb9b4c33` |
| 3 | `0xaff95fb8cc8dd1b979e2b58f523185c353e0b059` | `0x74b8ffc860cd618b3c13264f551d3f272751affde4d431b45590f8e2a0ae4fda` |
| 4 | `0x58cea065a5346d576d69f3a6577eedd3b2bfe0e1` | `0x5170e286c199baaed275333033ed7b048e1ce594958b126632fcc3e98f9f7c08` |

The production market keeper runs every five minutes through Upstash QStash and advances oracle
timeouts, challenge timeouts, and epoch finalization in addition to opening eligible markets.
GitHub Actions is retained only as an operator-triggered recovery path.

## CRE safety state

The receiver is pinned to the updated DON workflow:

- Workflow: `dibs-settlement-testnet`
- Workflow ID: `0x00733a308f4ccaf2b3bdf6952866e293ce85b31be878e6883c54390b944b72fb`
- Pin transaction: `0x2b98996faa3ec8229c24f7c2243728f5093ca2590c8532c38c62782605c71148`
- Updated on 2026-10-07 with bounded batches, node-side scoring before consensus, and a two-minute trigger.
- CRE registry status: `ACTIVE`

### Live DON deployment — 2026-10-05

- CRE account: authenticated to organization `org_5KhPGUSaC3kQiPUM`.
- Monad testnet is supported by CRE and resolves to Keystone Forwarder
  `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, matching the receiver.
- Workflow: `dibs-settlement-testnet`.
- Workflow ID: `0x0087c79221932bb3a2dbee759ffd89a1325e58db7ba736b6abaca52e20128552`.
- Registry: private; status: `ACTIVE`.
- Registered: `2026-10-05T03:07:55Z`; deployed: `2026-10-05T03:07:56Z`.
- Verified on 2026-10-07: latest execution status `SUCCESS` with no workflow errors.
- Scoring tests: 3/3 passing.
- TypeScript: passing.
- Production deployment access: enabled through `cre account access`.

### Verified DON settlements — 2026-10-05

| Market | Score | Block | Forwarder transaction |
|---:|---:|---:|---|
| 32 | `0` | `68455332` | `0x8d0fa1b3d862e896c8fe161b22928a64089ae96adb8281fde03fd588306b5fd4` |
| 33 | `6685` | `68455340` | `0xeee2341f26b475d0c1f44a69625d4f6b640326b357313ca132e85aa7cece887a` |

Both transactions succeeded with the official Keystone Forwarder as their destination and emitted
`SettlementReportForwarded` from `DibsSettlementReceiver` plus `ResultSubmitted` from `Dibs`.
Market 33 committed evidence hash
`0x41cf811e176df841e67522a66bd5a8cfef28301340bb43006f8a966f96f811dc`.
See [`evidence/live-don-settlement`](../evidence/live-don-settlement/README.md).

### Historical simulation evidence — 2026-09-27

Before deployment access was granted, the checked-in `simulation-settings` target completed
successfully against the explicitly labelled public fixture:

- Result: `2` observations processed.
- Markets: `2` normal submission and `3` challenged re-observation.
- Quality-growth score: `3800`.
- Quality gate: `3` interactions accepted, `2` rejected.
- Report state: `prepared-dry-run` (no production broadcast claimed).
- Challenge decision: market `3` recomputed from `8000` to `3800`; `upheld=true`.
- Binary hash: `0ded2d257d90635098f513bf49746add2a67d3a88e783bfd616997fc5fe9e5df`.
- Config hash: `1d9db45337742e3528773ca39f4a50cf436b40e999bb7a9998d8c2ec6d35c5e5`.
- Evidence: [`oracle/SIMULATION_EVIDENCE.md`](../oracle/SIMULATION_EVIDENCE.md).

This section is retained as historical reproduction evidence. It is not the production execution
claim; the active DON deployment and Forwarder transactions above supersede it.

## Live stake → Envio proof — 2026-09-28

- Quality-gated market: `11`
- Cast: `0x60585b815eedf9626a5ee94f0f1d5b6eaeb22b41`
- Scout: `0x335E58172fC8895Bc380471972A22Ea921152F6d`
- Stake transaction: `0x7d9a7df64dbc0a24f4127dad8e8b6d93eb00c946fc8ce5f865b4547bdbda7eb0`
- Block: `66411040`
- Result: confirmed on Monad and observed through the production Envio-backed `/api/casts` signal list.
- Follow-up: market `11` is configured as the transparent optimistic-challenge rehearsal after
  its result window opens. The keeper will challenge it only because the proof wallet owns a unit.
