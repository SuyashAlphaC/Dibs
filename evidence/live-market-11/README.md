# Live market 11 settlement attempt

Market 11 had three independently indexed scout positions and closed normally. It did **not**
complete the intended positive CRE settlement lifecycle.

## Timeline

- `cre-broadcast-failed-01.log`: the first broadcast stopped before simulation because
  `CRE_ETH_PRIVATE_KEY` was not configured.
- At Unix time `1790681701`, markets 10 and 11 reached the submission timeout and were finalized by
  `expireMissingResult` with a zero score.
- `cre-broadcast-false-positive-02.log`: the next CRE simulation computed scores `71190` and `5300`,
  but its EVM writes could not be accepted. The workflow version used for that run ignored the
  returned chain-write status and therefore printed `report=submitted` incorrectly.
- Direct contract reads subsequently showed `resultSubmitted=true`, `qualityGrowthScore=0`, and the
  timeout evidence hashes. The production oracle was restored to
  `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`.

This directory is retained as failure evidence, not presented as a successful CRE settlement.

## Remediation

- Workflow writes now require `TX_STATUS_SUCCESS` and log the transaction hash.
- Broadcast simulation uses an isolated receiver at
  `0x3D0AC36a876fB3bB077F115DC48F1Ae692BA7F01`, configured for CRE's Monad MockForwarder.
- Deployment transaction:
  `0x479c0ddfcb69f75de551c979bf8aae84b1eb3778fe24a6790f141928c1f97ef2`.
- The broadcast script temporarily assigns that receiver as the Dibs oracle and restores the
  production Keystone receiver through an exit trap.

The remediated path must be demonstrated on a later eligible market before it is marked complete.
