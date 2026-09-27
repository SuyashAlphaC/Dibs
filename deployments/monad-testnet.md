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

The production market keeper runs every ten minutes through GitHub Actions and advances oracle
timeouts, challenge timeouts, and epoch finalization in addition to opening eligible markets.

## CRE safety state

The receiver is temporarily pinned to
`0xfd3e92890c58024b698d936cf54ff046bfae874768c2d0de4eeb4208d02bcc78`
and therefore fails closed until the CRE workflow is registered. After deployment, replace it
with the real workflow ID using `setExpectedWorkflowId(bytes32)`.

- Lock transaction: `0x0b1d773a532c41a39b0c77302c6002de5cee72c9cd7db25a447db05b192809fd`

### Workflow readiness — 2026-09-27

- CRE account: authenticated to organization `org_5KhPGUSaC3kQiPUM`.
- Monad testnet is supported by CRE and resolves to Keystone Forwarder
  `0xF8344CFd5c43616a4366C34E3EEE75af79a74482`, matching the receiver.
- Scoring tests: 3/3 passing.
- TypeScript: passing.
- Workflow simulation: passing with result `0` while no market is awaiting a result.
- Compiled binary hash: `b74267d0de96a54f0fa599781c38d5cb9c374e955b82f2da12857c1249ae50e5`.
- Config hash: `df0fba1c906b5d7633840818a9fdeb93d2c263611ecacec60bbf2188b4babb91`.
- Production deployment access: requested through `cre account access`; Chainlink approval is pending.

### Hackathon simulation evidence — 2026-09-27

The submission uses CRE simulation while production deploy access is pending. The checked-in
`simulation-settings` target completed successfully against the explicitly labeled public fixture:

- Result: `1` observation processed.
- Market: `2`.
- Quality-growth score: `3800`.
- Quality gate: `3` interactions accepted, `2` rejected.
- Report state: `prepared-dry-run` (no production broadcast claimed).
- Binary hash: `0ded2d257d90635098f513bf49746add2a67d3a88e783bfd616997fc5fe9e5df`.
- Config hash: `1d9db45337742e3528773ca39f4a50cf436b40e999bb7a9998d8c2ec6d35c5e5`.
- Evidence: [`oracle/SIMULATION_EVIDENCE.md`](../oracle/SIMULATION_EVIDENCE.md).

Do not replace the temporary expected workflow ID until `cre workflow deploy` succeeds and returns
the registered workflow ID. Keeping the sentinel value makes the receiver fail closed during the
approval wait.
