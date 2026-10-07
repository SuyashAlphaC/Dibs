# Dibs × Nansen: Conviction Lens

## Submission status

Genuine API field evidence was captured on 2026-10-07 for Elisa's market `32`.
[`market-32-base-live.json`](market-32-base-live.json) joins six actual Envio backers and
`0.075 MON` of scout conviction with six successful Nansen Base-context queries. Each query
includes its actual request ID, source timestamp and one reported credit used. No relationship
records were returned; the largest backer's share is `20.0%`. No independence claim follows.

The judge-facing `/intelligence` page presents this **historical operator capture**, separately
from its labelled synthetic teaching fixture. It makes no paid request on page load. Fresh scans
remain on market pages behind Privy/Farcaster authorization. The operator capture is not proof
of an authenticated end-user scan; that demo remains a submission handoff requirement.

## Meaningful product feature

Dibs ranks Farcaster signals by scouts' committed MON, not likes. A wallet count alone says little
about stake concentration or observed connections between backers. Conviction Lens gives scouts
an evidence-based context layer before committing:

1. Read genuine scout positions from Envio, retaining exact wei and exact event seconds.
2. Query up to eight earliest backer addresses through Nansen's related-wallet endpoint.
3. Join returned related addresses against this market's actual backers; ignore unrelated wallets.
4. Explain the largest wallet's stake share, linked backer count and linked stake share; show a map
   and relationship transaction links rather than a raw response table.
5. Preserve uncertainty, partial coverage, source request IDs, timestamps and downloadable JSON.

The feature appears on indexed market pages before the existing position controls; feed cards
link to its anchor. `/intelligence` explains the feature with an isolated labelled teaching fixture.

## Exact integration

- Method: `POST`
- Endpoint: `https://api.nansen.ai/api/v1/profiler/address/related-wallets`
- Authentication: server-only `apikey` header
- Body: `{ "wallet_address": "<indexed scout>", "chain": "monad", "pagination": { "page": 1, "per_page": 100 } }`
- Supported context selectors: `monad`, `base`, `ethereum`, validated against a fixed allowlist.
- Used response fields: related `address`, `relation`, `transaction_hash`, `block_timestamp`,
  `chain`, and `pagination.is_last_page`.
- Provenance headers: `X-Request-Id` and `X-Nansen-Credits-Used`, when returned.
- No MCP, CLI or language-model integration is claimed or needed for this API-based feature.
- `address_label` is deliberately dropped; no label or Smart Money endpoint is called.

[Current endpoint schema](https://docs.nansen.ai/api/profiler/address-related-wallets) uses
`wallet_address`; the older `address` input is deprecated. Nansen permits public redistribution of
related-wallet data with attribution. The UI and exports visibly say **Powered by Nansen API**.
See the [redistribution guide](https://docs.nansen.ai/guides/redistribution-guide).

## Setup

1. Open the [Nansen API dashboard](https://app.nansen.ai/api), create an API key, and confirm that
   the account can call related-wallets with sufficient credits. Review current credit costs and
   usage limits in the dashboard; do not assume queries are free.
2. Work only in `/home/suyashagrawal/Downloads/Dibs`, the canonical repository.
3. In Vercel → Dibs project → Settings → Environment Variables, add **server-only**
   `NANSEN_API_KEY` to Production. Set `NANSEN_INTELLIGENCE_ENABLED=true` in Production.
   Never use `NEXT_PUBLIC_NANSEN_API_KEY` or put a real key in GitHub, screenshots or chat.
4. Redeploy the app. Keep the existing Privy, Envio and Monad configuration unchanged.
5. Open an indexed market with genuine scout positions, sign in through Privy, link Farcaster,
   select the desired external context chain, and click **Run Nansen conviction scan**.
6. If the selected dataset returns no records, report that honestly; try Base or Ethereum only
   as explicitly selected external context. No testnet coverage or ownership is inferred.
7. If queries fail, inspect the safe error codes in the evidence details and the account's
   credits/plan. Do not label an unavailable response as zero relationships or independent scouts.

CLI alternative (interactive prompts, never put the API key in shell arguments):

```sh
cd /home/suyashagrawal/Downloads/Dibs
vercel env add NANSEN_API_KEY production
vercel env add NANSEN_INTELLIGENCE_ENABLED production
# Enter true for the second prompt, then deploy after these changes are installed.
vercel --prod --yes
```

Local development: put the two values in ignored `.env.local`, together with the existing Privy
and Envio settings, and run `npm run dev`. Live scans require a real Privy session; demo identities
cannot authorize a paid query.

## Paid-query and security boundary

- Page visits and `GET /api/intelligence/market/<id>` read configuration only, never Nansen.
- POST requires same-origin, a verified Privy session and a linked Farcaster profile.
- Only numeric indexed market IDs and allowlisted context chains are accepted. Clients cannot
  submit addresses, endpoints or fixture IDs. Envio supplies the actual wallets.
- Maximum eight wallet queries, two in parallel, five-second timeout each; first 100 records only.
- Success DTOs are cached for 15 minutes in Next's existing Data Cache. The app has not enabled
  Cache Components; the supported compatibility cache avoids a unrelated caching migration.
- A per-instance cache coalesces concurrent calls. Failed or malformed responses are not cached
  as clean scans. Source timestamps remain visible; old snapshots mark the report partial.
- One scan per authenticated user per 60 seconds, plus a 60-provider-request/hour per-instance cap.
  **These are not distributed account-wide limits.** Serverless replicas can each consume their
  own allowance. Set an account/provider spending limit where available and monitor usage. Keep
  the enable switch off if an acceptable total budget cannot be enforced; use Vercel WAF/global
  controls for broader public rollout rather than treating in-memory limits as a hard budget.
- No automatic retries, polling, paid fetches during build, transaction signing or contract writes.
- Provider errors become bounded safe codes. Secrets, raw diagnostics and prohibited labels never
  enter client props, the report, browser code or console scan logs.

## Interpretation boundary

Connections can reflect ordinary transfers, exchange activity or other relationships. They are
not proof of shared ownership, Sybil behavior or manipulation. No returned connection does not
prove independence. Failed, unqueried, old and truncated context is explicit.

Nansen's external context dataset and Envio's Dibs staking dataset are separate. The integration
does not assume Nansen indexes chain `10143` or Dibs' testnet transactions. A cross-chain address
match is context, not a claim that a relationship occurred in the market itself. Nansen does not
change rank, reputation, quality-growth scores, payouts, challenge decisions or the CRE workflow.

## Judge demo (under two minutes)

- 0:00–0:20: Open a genuine multi-scout market; explain why wallet count and total MON are not enough.
- 0:20–0:45: Run the authenticated Nansen scan and show its explicitly selected context dataset.
- 0:45–1:15: Explain concentration, actual returned backer connections and any coverage gaps.
  If no connections were returned, show that honest result—do not replace it with the fixture.
- 1:15–1:40: Inspect a genuine relationship transaction if one exists; expand the source request
  IDs and timestamps. Download the derived report.
- 1:40–2:00: Show the code/data-source join and explain that CRE remains the settlement authority.

## Live evidence acceptance gate

- [x] This implementation is deployed on the judge-facing app: [Conviction Lens](https://dibs-metropolis.vercel.app/intelligence).
- [x] A genuine Nansen query succeeds for an actual indexed market backer.
- [x] Retain the derived report with `source: "nansen"`, selected chain, successful queries,
  actual request IDs where supplied, and source timestamps. A fixture export does not pass.
- [ ] Record a short demo of the core pre-stake decision feature and coverage boundaries.
- [ ] Show the public source and this integration guide to judges.

Production browser/boundary checks are retained in
[`production-browser-verification.json`](production-browser-verification.json).
[Desktop](desktop.png) and [mobile](mobile.png) screenshots show the genuine captured report.
These checks make no paid query and do not claim to verify a signed-in user scan.

Do not mark Nansen verified merely because its key is configured. The existing `/evidence` ledger
keeps configuration-only status pending/partial. Retained genuine field evidence must be evaluated
separately; merely creating a download does not automatically upgrade that ledger.

### Reproduce bounded operator field proof

```sh
cd /home/suyashagrawal/Downloads/Dibs
npm run proof:nansen -- 32 base
```

This explicit command reads only real indexed backers, runs at most eight paid queries in batches
of two, and refreshes the named sanitized artifact. It requires `.env` with the server-only key
and enable switch. Each execution can spend credits; it is not a cron or an authorization bypass
in the web app. Failures are not converted to successful empty scans. No raw provider labels or
credentials are retained. Changing the recorded capture requires rechecking its fixture/proof
regression test and redeploying before the public historical snapshot changes.

## Bounty coverage assessment

The screenshot's technical criteria are covered: a real Nansen API endpoint, a core pre-stake
decision feature rather than a token-price/raw-response widget, a working web interface,
public integration documentation, and retained genuine provider evidence. No language model,
MCP integration or Nansen testnet coverage is claimed; the stated track accepts API integration.

Competitive evidence is not complete: record a signed-in scout using a fresh scan on a market
and explaining how it affects their decision (under two minutes). Current market-32 evidence
contains zero returned relationships, so it proves the data join and uncertainty treatment, not
real connected-backers detection. If genuine backers with external network activity participate,
demonstrate actual returned relationship transactions; do not fabricate accounts or substitute
the teaching fixture. No implementation can guarantee bounty eligibility or winning placement.

## Verification and implementation map

```sh
npm test
npm run typecheck
npm run build
npm run test:nansen-route
```

- `lib/conviction-intelligence.ts`: schema validation, exact-wei analysis and safe public DTOs.
- `lib/nansen-client.ts`: current API schema, timeouts, credit/error codes, cache and coalescing.
- `lib/nansen-service.ts`: server-only credentials, persistent cache and bounded batch execution.
- `lib/intelligence-request.ts`: input/origin validation and user scan cooldown.
- `app/api/intelligence/market/[marketId]/route.ts`: authorization and genuine indexed wallet join.
- `components/market/conviction-lens.tsx`: decision map, coverage, transaction proof and report export.
- `lib/conviction-intelligence.test.ts`: relationship join, exact stake shares, errors, cache budgets,
  freshness, origins, input validation, label/secret isolation and explicit fixture boundaries.
- `scripts/check-nansen-route.mjs`: real production-built GET/POST boundaries in disabled and
  configured states, with all network calls blocked and no real credentials involved.
- `scripts/nansen-live-proof.ts`: explicitly invoked, bounded genuine provider field capture.
- `lib/nansen-evidence.ts`: isolated retained historical evidence, not a live-scan fallback.
