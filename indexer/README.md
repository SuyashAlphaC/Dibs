# Dibs Envio indexer

This indexer makes the live feed, positions, settlement history, timeout state, allocations, and scout reputation queryable through GraphQL. The application treats indexed `totalStake` as the authoritative feed ranking and polls it for live re-ordering.

Before deployment:

1. Replace the placeholder Dibs address and `start_block` in `config.yaml`.
2. Add `ENVIO_API_TOKEN` to `.env`.
3. Run `npm run codegen`, `npm run typecheck`, then `npm run dev`.

The web server should use the deployed GraphQL endpoint through `ENVIO_GRAPHQL_URL`. `NEXT_PUBLIC_ENVIO_GRAPHQL_URL` remains supported as a compatibility fallback.
