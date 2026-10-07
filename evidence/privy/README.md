# Privy identity-to-action proof

Dibs uses Privy as the product boundary between a Farcaster participant and an onchain Monad
position. The integration is intentionally broader than login: it creates a wallet for a new user,
links social identity, protects authenticated server mutations, submits user-approved contract
transactions, and sponsors embedded-wallet gas.

## Reproducible judge flow

1. Open [`/privy`](https://dibs-metropolis.vercel.app/privy) and select **Start with Privy**.
2. Sign in with email, passkey, wallet, or Farcaster. A user without an external wallet receives a
   Privy embedded EVM wallet.
3. Link Farcaster. The page shows the linked username and FID without exposing a token or secret.
4. Open **Discover**, choose a live signal, and call Dibs. The confirmation keeps the MON conviction
   amount explicit before the user signs.
5. With an embedded wallet, Privy sponsors network gas. An external wallet stays supported and pays
   its own gas.
6. After confirmation, the Envio-indexed position appears in the feed, activity ledger, and scout
   profile under the resolved Farcaster identity.

## Implementation map

| Responsibility | Implementation |
| --- | --- |
| Provider, login methods and embedded-wallet policy | `components/identity-provider.tsx` |
| Session, wallet type, Farcaster link and transaction submission | `components/identity-provider.tsx` |
| Access-token verification and linked-account checks | `lib/privy-auth.ts` |
| Authenticated public market nomination | `app/api/markets/candidates/route.ts` |
| Public secret-free readiness status | `lib/privy-integration.ts`, `/api/health` |
| Judge-facing live proof | `app/privy/page.tsx` |

## Security and custody boundary

- `PRIVY_APP_SECRET` is server-only and is never returned by the health or evidence endpoints.
- Public cast nominations require a verified Privy access token and a linked Farcaster account.
- Dibs never signs for a scout and never takes custody of a scout wallet.
- Gas sponsorship applies only to Privy embedded wallets when production sponsorship is enabled.
- The user still sees and approves the MON conviction value; the position remains economically at
  risk under the market contract.

## Production verification

The live `/privy` page and `/api/health` report capability readiness from production configuration
without returning configuration values. For the strongest field proof, record a fresh embedded-
wallet Dibs transaction during the demo and show both the successful Monad receipt and the matching
Envio-indexed position.
