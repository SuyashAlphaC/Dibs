# CRE settlement broadcast — markets 12–14

Date: 2026-09-30

This is production-path evidence for a Chainlink CRE **simulation broadcast** to
Monad. The workflow used real observations returned by the production oracle
endpoint, and the CRE simulator broadcast the encoded reports through the
isolated simulation receiver. It is not represented as a DON deployment.

## Command

```bash
CRE_MIN_DEADLINE_BUFFER_SECONDS=120 npm run cre:broadcast
```

The reduced buffer was an explicit operator override because 211 seconds
remained before the submission deadline. The script still performed all owner,
receiver, forwarder, core, workflow-guard, and onchain-deadline checks. It also
forced the cron trigger immediately and restored the production oracle on exit.

The complete CLI output is in `cre-broadcast.log`.

## Confirmed settlement writes

| Market | Quality score | Accepted | Rejected | Transaction |
|---:|---:|---:|---:|---|
| 12 | 21,500 | 15 | 0 | `0xb15e1fd0a1d90d80d578eb34d4ff1332cd3bd73461aa971d63a313b7f7ba9975` |
| 13 | 27,030 | 20 | 6 | `0x0eb6c13f46596050b5bc8a1d63f287525fa7b8f7f3b2d7156c48278f9bed0032` |
| 14 | 950 | 2 | 0 | `0xbfff66f4cb2125193dc35fb7b31d35019b310cca2d0eeb3e473f3d9d78f27166` |

All three transaction receipts returned status `0x1`. Market 12 emitted both
`ResultSubmitted` from the Dibs core and `SettlementReportForwarded` from the
simulation receiver.

## Oracle safety

- Temporary oracle switch: `0xf39e8e3af7846ba85b99ce5f5f71cc126e284716d90c339f226b8055c6cbb03e`
- Production oracle restoration: `0x662dcc6fa953ad49a247d19263bcd7d4b4551fe109db3c05feecdd967ed1dc9d`
- Restored oracle: `0x78B87B938cbdd9453F2dA6adA043d74d792C9A81`
- The restoration receipt returned status `0x1`.
- The production observation queue was empty after the writes.

## Scope and limitation

Markets 12, 13, and 14 had zero scout units. This evidence proves the real-data
observation, quality-filter computation, CRE report, Monad write, receiver
forwarding, and Envio submission indexing path. It does **not** prove rank
movement, scout allocation, or a reward claim. Those acceptance items require a
new market with genuine scout participation.
