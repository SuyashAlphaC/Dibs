# Local verification — 2026-10-07

These are implementation checks, **not live Nansen field proof**.

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

This execution environment blocks localhost browser connections and Chrome startup. Visual
browser/responsive verification remains pending despite the successful production build and
markup checks. No Nansen API key was available, so live upstream verification and a judge-facing
deployment remain pending too. See [the setup and field-proof checklist](README.md).
