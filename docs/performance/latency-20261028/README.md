# Latency pass, 2026-10-28

Branch `claude/performance-optimization-03b955`, from `main` at `8a1dee0f`.

## How it is measured

QA Supabase no longer resolves, so signed-in pages could not be timed locally before. `scripts/performance/signed-in-latency/` adds a harness that runs the production build (`next start`, built with `scripts/performance/isolated-command.mjs`, so no secrets and no hosted URLs) against a fake Supabase Auth/PostgREST and Upstash Redis:

- Three synthetic owners (Lite, Base, Free) signed in with real ES256 session cookies. Production signs with ES256 too (its public JWKS lists one ES256 key), so Proxy verifies tokens locally, as here.
- Every Supabase call waits 30 ms and every Redis call 10 ms, a modelled Vercel bom1 → Supabase/Upstash Mumbai round trip including query time. The fake backend logs each call, so a run counts calls per page and **sequential waits**: the longest chain of calls where each began only after the previous one ended. Sequential waits do not depend on the modelled delay; the milliseconds do.
- Per route: two warm-up passes, then 5 timed requests, medians reported. JS is the gzip-9 total of the `<script src>` chunks in the returned HTML (polyfills excluded): what a first visit downloads before the page is interactive, lazy chunks excluded.

Run (on Raj's laptop through `heavyq`):

```bash
node scripts/performance/isolated-command.mjs bash -c 'node scripts/reset-build-type-cache.mjs && ./node_modules/.bin/next build --webpack'
node scripts/performance/signed-in-latency/run.mjs docs/performance/latency-20261028/<name>.json --iterations 5
```

`baseline.json` is the starting point. Each task below adds an `after-<task>.json`.

## Findings

Ranked by expected effect on what users wait for. "Waits" are sequential backend round trips before the page's HTML is complete.

### Server latency (every signed-in page)

1. **Identity is read in series.** `getVerifiedIdentity` (`lib/auth.ts`) calls `auth.getUser()` and only then reads the `profiles` row. Every signed-in page, server action and API route pays both round trips back to back. The session cookie already names the user, so the profile read can start alongside Auth and be used only if Auth confirms the same user. Saves 1 wait everywhere.
2. **The plan lookup waits for the profile.** Owner and Free layouts read the plan only after the profile resolves, though the session token already carries the org id. Starting the plan read with the token's org id (used only if the verified profile names the same org) saves 1 more wait.
3. **The owner shell reads the organization row after the plan, and Base reads it a third time.** `OwnerRouteBoundary` renders the page only after the owner organization read, which starts after the plan lookup (and, on Base, after `isBaseOnboardingComplete`, a separate read of the same `organizations` row). Starting the organization read with the plan read, and taking the Base onboarding fields from that same row, saves 1 wait on every owner page and 1 call on Base.
4. **The estimator (the post-sign-in landing page) reads its two inputs in series.** `getFactoryCostProfile` reads `factory_cost_profile`, then the fixed-salary staff. They are independent. Saves 1 wait on `/owner/estimator`.
5. **Free pages read the organization after the grant.** `freeContext` (`lib/free-service.ts`) reads the Free grant, then the organization, then the plan. The organization and plan reads only need the verified org id. Saves 1 wait on every Free page.
6. **App launch (`/login` while signed in) waits on Redis, then the profile.** Proxy's revocation check and its routing profile read are independent. Running them together shortens the launch redirect hop.

### Client bundles (first visit and every new deploy)

7. **zod is back in the paid estimator and Free first load (25 KB gzip).** `EstimatorClient` statically imports `lib/free-estimator-draft.ts` (added 2026-10-13), which imports the server zod schema from `lib/free-estimator-input.ts`. The paid estimator never calls it (Free mode only) and an earlier pass removed zod from this bundle on purpose; the source-string guard in `__tests__/performance-bundle-boundaries.test.ts` did not catch the new path. Loading the draft helper on demand removes zod from `/owner/estimator` and `/free`.
8. **The costing document renderer ships on page load (about 25 KB gzip).** The estimator, Saved Costings, Free and Free costings import `createCostingExportModel` from `lib/estimator-export.ts`, which also holds the print/PDF HTML builder, a 15 KB base64 Weavly logo and all three languages' document labels. The model builder needs none of that. Splitting it into its own module keeps the renderer in the export dialog's lazy chunk.
9. **Hindi and Gujarati pages scan the whole phrase table for each new string.** `translateKnownFragments` (`lib/i18n/context.tsx`) copies and filters every phrase (thousands) and sorts the matches for each untranslated text on legacy surfaces. Sorting the candidates once per language keeps the output identical and removes the per-string copy and sort. Main-thread time for hi/gu users on page changes.

### Found, not changed (need a decision or a larger refactor)

10. **Sentry is the largest shared chunk.** The root chunk every page loads (146 KB gzip) is mostly Sentry's browser SDK, about half of it the tracing integration. `bundleSizeOptimizations.excludeTracing` (with client `tracesSampleRate` 0) would cut roughly 30–40 KB from every page, landing and login included, but ends Sentry browser performance traces. Your own web-vitals reporting (`/api/analytics/web-vitals`) is unaffected. Owner decision.
11. **The English dictionary loads on every page (24.5 KB gzip),** landing and login included, because `I18nProvider` in the root layout imports `locales/en.ts` whole. Splitting it by surface is a large i18n refactor; not attempted here.
12. **Proxy runs a Redis revocation check on every request**, prefetches included (one Upstash round trip, ~3–10 ms in region). Caching it per instance would weaken instant revocation; left as is.
13. **`getUser()` is a network call on every request** even though tokens are ES256 and verifiable locally. Replacing it with `getClaims()` would save another Auth round trip per request but means a signed-out or deleted session stays valid until its access token expires (up to an hour). Security decision; left as is.

## Results

Each task below was built and measured on its own, on top of the previous ones. Numbers are harness medians (30 ms per Supabase call); waits and calls do not depend on that delay.

### Task A: identity, plan and organization reads in parallel (findings 1, 2, 3, 5)

- Proxy forwards the user and org ids of the token it just verified in an internal header (`lib/session-hint.ts`; browser values are stripped, like the existing revocation marker).
- `getVerifiedIdentity` starts the profile read for that user alongside `auth.getUser()` and uses it only if Auth returns the same user, after the revocation check. A different user's row is discarded and the verified user's row is read (`__tests__/session-hint-early-reads.test.ts`).
- `requireRole` (pages and server actions), the owner layout (`startOwnerShellReads`) and the Free layout start the plan, organization and Free grant reads with the hinted org, and use them only for the same verified org.
- The owner organization read now carries `base_onboarding`, so the Base setup check reuses it instead of reading the row again (`isBaseOnboardingCompleteRow`).
- `freeContext` reads the grant, organization and plan together and still checks them in the original order.

| Account | Route | TTFB ms | Full page ms | Waits | Calls |
| --- | --- | --- | --- | --- | --- |
| public | `/` | 9.9 → 10.5 (+6%) | 12 → 12.5 (+4%) | 0 → 0 | 0 → 0 |
| public | `/login` | 12.9 → 11.6 (-10%) | 15.7 → 14.1 (-10%) | 0 → 0 | 0 → 0 |
| lite | `/login` (redirect) | 52.9 → 52.9 (0%) | 53 → 53 (0%) | 2 → 2 | 2 → 2 |
| lite | `/owner/estimator` | 130.7 → 64.3 (-51%) | 203.6 → 138 (-32%) | 6 → 4 | 8 → 8 |
| lite | `/owner/quotes` | 130.9 → 64.7 (-51%) | 199.6 → 133 (-33%) | 6 → 4 | 9 → 9 |
| lite | `/owner/rates` | 130.2 → 64.5 (-50%) | 168.6 → 102 (-40%) | 5 → 3 | 9 → 9 |
| lite | `/owner/settings` | 127.1 → 68.3 (-46%) | 166.7 → 99.3 (-40%) | 5 → 3 | 6 → 6 |
| lite | `/owner/billing` | 129.7 → 64.9 (-50%) | 202.2 → 137.3 (-32%) | 6 → 4 | 10 → 10 |
| base | `/owner/estimator` | 162.4 → 65.1 (-60%) | 202.9 → 136.4 (-33%) | 6 → 4 | 9 → 8 |
| base | `/owner/production` | 163.7 → 70 (-57%) | 199.9 → 106.5 (-47%) | 6 → 3 | 22 → 21 |
| base | `/owner/production/daily-sheet` | 167 → 69 (-59%) | 203 → 105.7 (-48%) | 6 → 3 | 22 → 21 |
| base | `/owner/stock` | 164.2 → 67.4 (-59%) | 202 → 102.5 (-49%) | 6 → 3 | 12 → 11 |
| base | `/owner/dispatches` | 165.9 → 66.7 (-60%) | 197.3 → 101.2 (-49%) | 6 → 3 | 12 → 11 |
| base | `/owner/payroll` | 166.4 → 68.3 (-59%) | 204.2 → 106.4 (-48%) | 6 → 3 | 20 → 19 |
| base | `/owner/machines` | 162.5 → 64.8 (-60%) | 200.5 → 98.2 (-51%) | 6 → 3 | 12 → 11 |
| base | `/owner/workers` | 162.5 → 62.2 (-62%) | 199.8 → 99.8 (-50%) | 6 → 3 | 10 → 9 |
| base | `/owner/assignments` | 165.8 → 63 (-62%) | 205.3 → 132.3 (-36%) | 6 → 4 | 14 → 13 |
| free | `/login` (redirect) | 51.7 → 51.4 (-1%) | 51.8 → 51.5 (-1%) | 2 → 2 | 2 → 2 |
| free | `/free` | 127.6 → 67.6 (-47%) | 167.8 → 72.4 (-57%) | 5 → 2 | 6 → 6 |
| free | `/free/costings` | 128.2 → 66.7 (-48%) | 161.7 → 69.4 (-57%) | 5 → 2 | 6 → 6 |
| free | `/free/account` | 129.1 → 62.8 (-51%) | 165 → 65.7 (-60%) | 5 → 2 | 6 → 6 |
| free | `/free/billing` | 130.6 → 63.5 (-51%) | 133.6 → 93.8 (-30%) | 4 → 3 | 7 → 8 |

Signed-in owner and Free pages now send their first byte after one backend wait instead of four. Base pages make one call fewer. `/free/billing` makes one extra (discarded) organization read: the Free layout starts the Free workspace read for every Free page, and billing does not use it.

Not changed by this task, found while reading the timelines: `/owner/assignments` reads its go-live state and pay-cycle rule before its workers, machines and jobs (two waits inside the page).
