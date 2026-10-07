# Local verification — 2026-10-07

The first implementation checks were not live field proof. The activation checks below now
include a genuine provider capture; authenticated end-user proof remains separate.

- Application tests: 41 passed, including 13 new Conviction Lens tests.
- TypeScript: `npm run typecheck` passed.
- Production build: `npm run build` passed with Next.js 16.3.6 / Turbopack.
- The production output includes `/intelligence` and `/api/intelligence/market/[marketId]`.
- Generated fixture HTML contains attribution, the synthetic/non-live/non-stakeable disclosure,
  the ownership boundary and the warning that absence of lines is unknown—not independence.
- The production-built route is checked directly without localhost/network access: GET performs
  no paid calls, cross-site POST is rejected, disabled scans return 503, and configured scans
  without a verified session return 401. Network calls are intercepted and must remain at zero.
- Contract, indexer, keeper and CRE workflow sources were not changed by this feature.

The initial build with an external dependency symlink hit Turbopack's filesystem-root constraint.
Using a local copy of the already installed dependencies resolved that environment-only issue;
no application configuration or package versions were changed to work around it.

The initial restricted execution environment blocked Chrome and localhost connections and had
no Nansen key. Those initial limitations were removed for the following activation work.

## Activation verification — 2026-10-07

- Corrected the ignored local `.env` indexer URL: the old endpoint returned HTTP 404; the user's
  newer Envio endpoint returned genuine market data. No production indexer setting was changed.
- Added `NANSEN_API_KEY` as a sensitive production-only Vercel variable, and explicit enablement.
  The key was passed through stdin, never committed, printed, or included in command arguments.
- Genuine operator capture for market 32: six actual backers, `0.075 MON` of scout conviction,
  six successful Nansen Base queries, six source request IDs and six reported credits used.
  No relationship records were returned. A separate first-wallet Monad check also succeeded
  without relationship records. No independent-ownership conclusion is claimed.
- Public `/intelligence` shows that retained historical capture separately from the synthetic
  example. It requires no login and makes no paid request. Fresh market scans still require
  verified Privy/Farcaster authorization; the operator proof is not an authenticated UI proof.
- Desktop (1366×900) and mobile (390×844) Chrome checks reproduced and then verified fixes for
  multi-node SVG `<title>` hydration and the global 20px SVG height inherited by the map.
  After fixes: no runtime exceptions, no horizontal overflow, one H1, both disclosure labels,
  visible full-size map, enabled configuration GET, and unauthenticated POST rejected with 401.
- 42 application tests pass, including an additional retained-field-proof regression.
- Client-bundle secret scan checked 199 JavaScript files: no Nansen key appeared. The captured
  JSON and generated public HTML also passed the same secret-exposure check.

## Production verification

Feature commit: `7b7bc88`. Vercel deployment: `91khcTvEXRTqqaK9JgtMMtNJmCDm`.
Deployment URL: https://dibs-metropolis-1w19eqa9c-suyashagrawal862-5919s-projects.vercel.app
Production alias: https://dibs-metropolis.vercel.app

- `/intelligence`, `/market/32`, `/api/intelligence/market/32` and `/api/health`: HTTP 200.
- Production Nansen configuration: enabled and configured, at most eight wallets, 900-second cache.
- `/api/health`: healthy, Envio ready, CRE receiver still in pinned DON mode.
- Cross-site scan POST: HTTP 403. Unauthenticated same-origin browser POST: HTTP 401.
- Desktop and mobile checks passed at `2026-10-07T17:27:15.959Z`, with zero runtime exceptions,
  no horizontal overflow, a full-size map and separate historical/synthetic disclosures.
- Public responses passed the real-key redaction check. Browser smoke checks made zero paid calls.
- [Machine-readable production browser proof](production-browser-verification.json),
  [desktop screenshot](desktop.png), [mobile screenshot](mobile.png).

The live provider capture was made through the explicit operator CLI, not a signed-in browser.
No complete authenticated user scan or demo video is claimed. See the
[setup, proof artifact and remaining demo checklist](README.md).
