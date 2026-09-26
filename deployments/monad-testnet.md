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

## CRE safety state

The receiver is temporarily pinned to
`0xfd3e92890c58024b698d936cf54ff046bfae874768c2d0de4eeb4208d02bcc78`
and therefore fails closed until the CRE workflow is registered. After deployment, replace it
with the real workflow ID using `setExpectedWorkflowId(bytes32)`.

- Lock transaction: `0x0b1d773a532c41a39b0c77302c6002de5cee72c9cd7db25a447db05b192809fd`
