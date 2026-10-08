# Dibs Envio indexer

This indexer makes the live feed, positions, settlement history, timeout state, allocations, and
scout reputation queryable through GraphQL. The application treats indexed `totalStake` as the
authoritative feed ranking and polls it for live re-ordering.

## Production testnet

The deployed testnet indexer follows [`config.testnet.yaml`](config.testnet.yaml): Monad testnet
chain `10143`, start block `65900523`, and the Dibs contract
`0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84`. The current HyperIndex endpoint is supplied to the
Next.js server through the server-only `ENVIO_GRAPHQL_URL`; do not expose provider tokens in the
browser. The production app consumes the indexer through `/api/casts`, market pages, settlement
views and scout profiles.

## Local/indexer deployment

The root `config.yaml` intentionally keeps a deterministic placeholder for code generation. Before
deploying a new indexer, replace that address and `start_block`, add `ENVIO_API_TOKEN` to `.env`,
then run:

```sh
npm run codegen
npm run typecheck
npm run dev
```

`NEXT_PUBLIC_ENVIO_GRAPHQL_URL` remains supported as a compatibility fallback, but production
credentials and the canonical endpoint belong in `ENVIO_GRAPHQL_URL`.
