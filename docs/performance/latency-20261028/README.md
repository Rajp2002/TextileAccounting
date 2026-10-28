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

14. **The service worker precaches 5.6 MB on install** (found after the first list; `scripts/performance/precache-report.mjs`). Every route's JS, every font subset and every file in `public/images` is downloaded in the background on a phone's first visit, the landing page included, competing with the page itself. 2.1 MB of it is images, mostly screenshots and logos nothing references, and 1 MB is font subsets the pages never use. Documents and RSC are network-only, so none of it makes pages work offline.

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

### Task B: page reads in parallel (findings 4, 6, and three pages found in the Task A timelines)

- `getFactoryCostProfile` (the estimator, the post-sign-in landing page) reads the cost profile and the fixed-salary staff together.
- Proxy starts the signed-in `/login` routing read (installed-app launch) alongside the revocation check; a failure still falls back to the optimistic route.
- `/owner/assignments` reads its go-live date with the board's rows (it only shapes them).
- `/owner/quotes` reads the Free grant (prior Free history) with the page's other reads.
- `/owner/billing` runs its two batches of independent reads as one.

Measured from `after-task-a.json` to `after-task-b.json` (built after Tasks C and D, which change no server reads):

| Account | Route | TTFB ms | Full page ms | Waits | Calls |
| --- | --- | --- | --- | --- | --- |
| public | `/` | 10.5 → 9.9 (-6%) | 12.5 → 11.9 (-5%) | 0 → 0 | 0 → 0 |
| public | `/login` | 11.6 → 11.6 (0%) | 14.1 → 14.2 (+1%) | 0 → 0 | 0 → 0 |
| lite | `/login` (redirect) | 52.9 → 39.4 (-26%) | 53 → 39.5 (-25%) | 2 → 1 | 2 → 2 |
| lite | `/owner/estimator` | 64.3 → 65.1 (+1%) | 138 → 106.5 (-23%) | 4 → 3 | 8 → 8 |
| lite | `/owner/quotes` | 64.7 → 66.7 (+3%) | 133 → 106.6 (-20%) | 4 → 3 | 9 → 9 |
| lite | `/owner/rates` | 64.5 → 67.3 (+4%) | 102 → 104.8 (+3%) | 3 → 3 | 9 → 9 |
| lite | `/owner/settings` | 68.3 → 66.3 (-3%) | 99.3 → 95.6 (-4%) | 3 → 3 | 6 → 6 |
| lite | `/owner/billing` | 64.9 → 66.1 (+2%) | 137.3 → 107.3 (-22%) | 4 → 3 | 10 → 10 |
| base | `/owner/estimator` | 65.1 → 63.2 (-3%) | 136.4 → 103.8 (-24%) | 4 → 3 | 8 → 8 |
| base | `/owner/production` | 70 → 69.4 (-1%) | 106.5 → 106.1 (0%) | 3 → 3 | 21 → 21 |
| base | `/owner/production/daily-sheet` | 69 → 66.8 (-3%) | 105.7 → 105.7 (0%) | 3 → 3 | 21 → 21 |
| base | `/owner/stock` | 67.4 → 64.9 (-4%) | 102.5 → 100.7 (-2%) | 3 → 3 | 11 → 11 |
| base | `/owner/dispatches` | 66.7 → 65.7 (-1%) | 101.2 → 101.8 (+1%) | 3 → 3 | 11 → 11 |
| base | `/owner/payroll` | 68.3 → 66.3 (-3%) | 106.4 → 105.8 (-1%) | 3 → 3 | 19 → 19 |
| base | `/owner/machines` | 64.8 → 65.9 (+2%) | 98.2 → 102.1 (+4%) | 3 → 3 | 11 → 11 |
| base | `/owner/workers` | 62.2 → 65.5 (+5%) | 99.8 → 101.7 (+2%) | 3 → 3 | 9 → 9 |
| base | `/owner/assignments` | 63 → 64.7 (+3%) | 132.3 → 102 (-23%) | 4 → 3 | 13 → 13 |
| free | `/login` (redirect) | 51.4 → 39.4 (-23%) | 51.5 → 39.5 (-23%) | 2 → 1 | 2 → 2 |
| free | `/free` | 67.6 → 68.2 (+1%) | 72.4 → 72.5 (+0%) | 2 → 2 | 6 → 6 |
| free | `/free/costings` | 66.7 → 65.4 (-2%) | 69.4 → 69.2 (0%) | 2 → 2 | 6 → 6 |
| free | `/free/account` | 62.8 → 64.9 (+3%) | 65.7 → 67.7 (+3%) | 2 → 2 | 6 → 6 |
| free | `/free/billing` | 63.5 → 63.3 (0%) | 93.8 → 96.5 (+3%) | 3 → 3 | 8 → 8 |

Every owner page now waits three times before its HTML is complete: Proxy's Redis check, the identity/plan/organization reads, and the page's own reads. The redirect hop an installed app makes on launch is one wait.

### Task C: smaller estimator, Saved Costings and Free first loads (findings 7, 8)

- `EstimatorClient` loads `lib/free-estimator-draft.ts` (and with it the Free input schema and zod) only when Free mode mounts. Writes still wait until the stored draft has been checked; once loaded, writes and clears are synchronous as before.
- `createCostingExportModel` and `shortDocumentReference` move to `lib/costing-export-model.ts`, which imports only the costing engine. `lib/estimator-export.ts` keeps the print/PDF renderer (with the 15 KB base64 logo and every language's labels) and re-exports the model for existing callers. Free costings' export dialog is now lazy, as on the estimator and Saved Costings.
- `__tests__/performance-bundle-boundaries.test.ts` now walks each page's static import graph and fails if zod, the renderer, the logo or the document labels become reachable again. On `main` it fails for all four pages, which is the regression it is meant to catch.

Measured from `after-task-a.json` to `after-task-bcd.json` (same harness, HTML `<script src>` chunks, gzip 9):

| Account | Route | First-load JS, KB gzip |
| --- | --- | --- |
| lite, base | `/owner/estimator` (the post-sign-in landing page) | 562.2 → 513.5 (−48.7) |
| lite | `/owner/quotes` | 482.8 → 445.0 (−37.8) |
| free | `/free` | 553.8 → 505.1 (−48.7) |
| free | `/free/costings` | 433.0 → 385.5 (−47.5) |
| all | every other page | +0.2 (Task D's phrase index, in the shared i18n provider) |

Saved Costings still loads zod-free code but keeps the document labels it shows on screen elsewhere; it gains less than the estimator.

### Task D: Hindi and Gujarati phrase scan (finding 9)

`lib/i18n/known-fragments.ts` replaces the per-text full scan in `lib/i18n/context.tsx`. It sorts the phrase table once per language and indexes it by each phrase's first four characters, so a text is checked only against phrases that could occur in it; candidates are applied in exactly the old order. Each boundary regex is compiled once per phrase instead of once per use.

`scripts/performance/i18n-fragment-benchmark.mjs` runs the old function (taken verbatim from `main`) and the new one on the real phrase tables and asserts identical output for every string (`i18n-fragments.json`; `__tests__/i18n-known-fragments.test.ts` covers the edge cases):

| Language | Phrases | New texts translated | Before | After |
| --- | ---: | ---: | ---: | ---: |
| Hindi | 5,824 | 4,090 | 2,093 ms (0.51 ms each) | 71 ms (0.017 ms each) |
| Gujarati | 5,813 | 4,090 | 1,968 ms (0.48 ms each) | 72 ms (0.018 ms each) |

Measured on Raj's laptop (Intel i9, Node 24). A mid-range phone is several times slower, so a Base page showing a few hundred new strings in Hindi or Gujarati spent a few hundred milliseconds of main-thread time here before and spends a few tens now. The pass runs only for Hindi/Gujarati on non-Lite surfaces (Lite pages use exact phrases).

### Task E: smaller service-worker install (finding 14)

`next.config.ts` stops precaching `public/images/**` and the `next/font` files. The existing CacheFirst static-asset rule still caches every image and font a page actually loads, so revisits and offline use of those are unchanged; the offline fallback page, app icons and all JS/CSS stay precached. No image was deleted: some may be linked from outside the app (for example email templates).

| Precache | Entries | Raw | Transfer |
| --- | ---: | ---: | ---: |
| Before (`precache-before.json`) | 367 | 11.44 MB | 5.62 MB |
| After (`precache-after.json`) | 330 | 8.35 MB | 2.53 MB (−55%) |

Not verified on a device: an installed iPhone/Android app picking up the new worker. Nothing in the update flow depends on these files.


### Task F: Free usage meter, Calculate, and Free billing (HANDOFF next task 1)

Branch `claude/perf-latency-pass-2` from `main@91a12427` (PR #287 was merged before this work started).

- `freeContext` (every Free API route and page) starts the grant, organization and plan reads from Proxy's session hint while Auth verifies the session, and holds the promises itself: route handlers have no React request cache or fetch memoisation, so before this the API routes waited for the session and then for these reads. Reads started for a different user or org are discarded and the verified org is read instead.
- `getOrgPlanAccess` takes an optional, already started Free-grant read. For a Free org it used to read the grant again after the plan row (a second, sequential grant read in every Free API request).
- `freeStatus` (`/api/free/status`, fetched right after a Free page opens) starts the rollout and the database clock with the account reads, and reads monthly usage and tour state together. `calculateFreeSubmission` starts the rollout with the account reads. Error order is unchanged: authorization errors first, then throttling, then `FREE_PAUSED`; the production `FREE_TEMPORARY_ERROR` on a failed clock is unchanged.
- `/free/billing` takes the organization name from the organization read the Free layout already starts (it read the organization twice), and starts its payment-history read (RLS client) from the session hint.
- Harness: `/api/free/status` and `/api/free/calculate` added to `ROUTES`. Calculate posts `free-estimate.json` (written by `make-free-estimate.ts`, the estimate the Free service tests submit) with a fresh request token fetched outside the timed request. The fixture policy gained `version` and `receipt_retention_days`, and `complete_free_saved_costing` answers with a receipt. The fake Upstash answers `evalsha` in a shape the rate limiter rejects, so it uses its local fallback after the call; the call and its wait are still counted.

`before-task-f.json` (main) → `after-task-f.json`:

| Account | Route | TTFB ms | Full page ms | Waits | Calls |
| --- | --- | --- | --- | --- | --- |
| free | `/free` | 70.1 → 70.6 | 74.5 → 75 | 2 → 2 | 6 → 6 |
| free | `/free/costings` | 65.4 → 68.1 | 68.4 → 71.1 | 2 → 2 | 6 → 6 |
| free | `/free/account` | 65 → 67.5 | 69 → 70.8 | 2 → 2 | 6 → 6 |
| free | `/free/billing` | 63.4 → 63.8 | 94.1 → 66.6 (−29%) | 3 → 2 | 8 → 7 |
| free | `/api/free/status` | 254 → 91.7 (−64%) | 254.3 → 92 (−64%) | 8 → 3 | 11 → 10 |
| free | `/api/free/calculate` | 202.3 → 107.2 (−47%) | 202.6 → 107.5 (−47%) | 7 → 4 | 10 → 9 |

Checks: `npx tsc --noEmit` clean, `npx vitest run` 418 files / 4,208 passed / 1 skipped, `npm run lint` clean.

The usage meter's request now waits for Proxy's Redis check, one batch of account/rollout/clock reads, and the usage and tour-state reads. Calculate waits for Redis, the account batch, the rate limiter and the save RPC. The Free pages themselves were already at two waits; their ±3 ms differences are run-to-run noise.

### Task G: cold starts, the first request a Vercel function serves (HANDOFF next task 2)

No app change: the one candidate that measured well changes Sentry's monitoring and is left for Raj (below); the other lost once measured fairly. Committed: the cold-start harness and its measurements.

**Harness.** `run.mjs --cold N` starts a fresh `next start` per sample and times its first request. `cold-modules.cjs` (preloaded) turns off `next start`'s boot-time loading of every route (`experimental.preloadEntriesOnStart`), which Vercel's minimal mode doesn't do, and records each CommonJS file evaluated with its own time, grouped by the file that pulled it in (Proxy's `middleware.js`, `instrumentation.js`, the route's `page.js`, `next.config`). `next start` also evaluates `next.config.ts` (with Sentry's build plugin, webpack, rollup and babel: about 1,600 files, 0.8–1.5 s) on its first request, which Vercel never does, so it is subtracted. `cold-ab.mjs` alternates two builds round by round and takes medians, so the laptop's CPU limit drifting during a run affects both builds alike; it records the limit per round. `NEXT_PUBLIC_SENTRY_DSN` is compiled in, so builds take a loopback harness DSN (`WEAVLY_HARNESS_SENTRY_DSN`, accepted only for `127.0.0.1` by `isolated-command.mjs`) and Sentry initialises as in production; `sentry-check.mjs` makes one page fail and confirms the error event (and sampled transactions) reach the fake backend.

**Where a cold request's time goes** (`main`, `/owner/rates`, own evaluation time): Proxy's `middleware.js` 128–160 ms (a 2.1 MB bundle), `instrumentation.js` 92 ms (1.5 MB, the Sentry SDK and OpenTelemetry), the page's own code 150 ms, of which 70 ms is chunks `1317`/`5009` (3.4 MB: another bundled copy of Sentry and OpenTelemetry). Sentry's build plugin wraps Proxy and every page and route in Sentry, so each bundle carries its own copy. The rest of a ~1 s first request is React's first render and V8 warming up.

**Rejected: Sentry as a server external** (`serverExternalPackages: ['@sentry/nextjs']`). Bundles shrink (instrumentation 1.5 MB → 3 KB, Proxy 2.1 MB → 578 KB, the page copies gone) and `cold-ab-sentry-external.json` shows −20% to −42% per route, but that run is unfair: `next start` had already loaded `@sentry/nextjs` from `node_modules` while evaluating `next.config.ts`, so the externalized build found it cached. On Vercel each function would load it cold, and `sentry-require-cost.mjs` measures that at a median 433 ms (9 fresh Node processes), more than the bundled copies cost. Net on Vercel: about even or slower. Sentry did keep reporting (1 error event, 11 transactions in `sentry-check.mjs`).

**Measured, needs Raj's decision: Sentry's automatic wrappers off** (`webpack.autoInstrumentServerFunctions`, `autoInstrumentMiddleware`, `autoInstrumentAppDirectory` set to `false` in `withSentryConfig`). Sentry stays bundled as on `main`; only the wrappers go. Request errors are still reported through `onRequestError` in `instrumentation.ts`: `sentry-check.mjs` received the error event and 5 transactions. Lost: Sentry's per-page and per-route spans and its Proxy transactions. `cold-ab-sentry-no-wrappers.json`, 3 rounds, CPU limit 100 in every round, first request without `next.config`:

| Route | `main` → no wrappers, ms | Own evaluation ms |
| --- | --- | --- |
| `/` | 558 → 430 (−23%) | 383 → 264 |
| `/login` | 732 → 570 (−22%) | 391 → 298 |
| lite `/owner/estimator` | 1,012 → 811 (−20%) | 445 → 315 |
| lite `/owner/quotes` | 997 → 811 (−19%) | 431 → 319 |
| lite `/owner/rates` | 985 → 793 (−19%) | 427 → 319 |
| lite `/owner/settings` | 989 → 800 (−19%) | 444 → 333 |
| lite `/owner/billing` | 959 → 784 (−18%) | 414 → 303 |
| free `/free` | 986 → 812 (−18%) | 454 → 326 |
| free `/free/costings` | 960 → 782 (−19%) | 440 → 323 |
| free `/free/account` | 943 → 769 (−18%) | 432 → 320 |
| free `/free/billing` | 921 → 739 (−20%) | 417 → 290 |
| free `/api/free/status` | 748 → 569 (−24%) | 429 → 254 |

Most of it is Proxy: its bundle drops to 563 KB and its own time from 128 to 38 ms (`autoInstrumentMiddleware` alone may give most of the gain; not measured separately). Pages keep one 1.9 MB Sentry chunk because `app/global-error.tsx` imports `@sentry/nextjs` and is part of every page's server tree. `main`'s absolute numbers differ between the two A/B runs (the charger negotiated 65 W, not 100 W, during the second), so only the paired before/after within one file is meaningful.

Checks: `npx tsc --noEmit` clean, `npx vitest run` 418 files / 4,208 passed / 1 skipped, `npm run lint` clean. Not verified on Vercel: real cold starts there also include function boot and network.

### Task H: the estimator on phones (HANDOFF next task 3)

**Harness.** `scripts/performance/signed-in-latency/phone.mjs` loads signed-in pages in Playwright Chromium as a phone: 390×844 at 3×, touch, CPU slowed 4× through CDP, an empty cache per sample, `next start` and the fake backend (server warmed first). It reports FCP, LCP, the app's own `route_primary_usable` mark (set once React has hydrated the page's main view), long tasks (count, longest, total blocking time after FCP) and JavaScript fetched versus run (V8 coverage). `--modules` splits large chunks into their webpack modules and top-level declarations with their coverage (client builds here have no source maps); `--profile` records a V8 CPU profile and totals main-thread time by script; `--compare-legacy-queue` alternates every sample between the two cleanup cases below.

**Where the time goes** (`phone-before.json`, 5 samples, CPU limit 100):

| Route | FCP | LCP | Usable | Total blocking | Longest task | JS fetched / ran |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| lite `/owner/estimator` | 252 | 1,588 | 2,229 | 1,363 | 692 | 2,088 / 689 KB |
| free `/free` | 432 | 1,396 | 2,157 | 1,058 | 477 | 1,898 / 688 KB |
| lite `/owner/quotes` | 256 | 2,060 | 1,930 | 816 | 424 | 1,799 / 610 KB |
| free `/free/costings` | 268 | 1,372 | (no mark) | 583 | 325 | 1,293 / 581 KB |

(ms; KB uncompressed.) The estimator's shell and main view become usable together: React hydrates the page in one pass, with one ~690 ms task. A CPU profile of one load (about 2.9 s of main-thread work at 4×) puts React DOM at ~410 ms, webpack module evaluation ~300 ms, the estimator's own chunk ~250 ms, the Sentry browser SDK ~200 ms, and parsing, compiling and layout ~1.3 s. Per-function attribution is unreliable under CDP's throttling, so only script totals are quoted.

**Why panels were not split.** `--modules` shows the estimator chunk is a single scope-hoisted 311 KB module. Of that, 164 KB is `EstimatorClient` itself (45 KB runs on load). The separate components inside it that do not run on load (Free usage card, saved-yarn dropdown, Free transaction recovery, the live-cost action hub, the save review and a few smaller ones) total about 40 KB uncompressed, roughly 10 KB gzip: about 2% of the JavaScript the page fetches. Moving them behind `next/dynamic` would not change these numbers measurably, and several carry guided-tour anchors. The large levers are the Sentry browser SDK (475 KB fetched, 157 KB run; already under "Needs Raj's decision") and hydrating the 7,700-line `EstimatorClient` in parts, which is a refactor rather than a split and is left as a follow-up.

**Changed: the retired offline queue no longer loads Dexie on every page.** `AuthBoundaryCleanup` deletes rows from the offline-write queue older app versions left in IndexedDB. It ran on every signed-in owner page load and imported Dexie (93 KB, 30.6 KB gzip) to do it, and because opening the database with Dexie creates it, every browser that had visited kept an empty `TextileDB` and paid for this on every load. `lib/client-storage-cleanup.ts` now checks `indexedDB.databases()` first and skips Dexie when the database is absent (browsers without that API keep the old behaviour), and after the cleanup deletes the database once it holds no rows. Rows are never dropped by this. An existing user's first load after the deploy still loads Dexie once, empties and removes the database; later loads skip it. `__tests__/legacy-queue-cleanup.test.ts` covers the four cases.

Measured on one build, alternating every sample between a browser with a non-empty legacy database (today's behaviour) and one without (`phone-legacy-queue-ab.json`, 5 pairs):

| Route | Usable ms | Total blocking ms | JS fetched |
| --- | --- | --- | --- |
| lite `/owner/estimator` | 2,212 → 2,126 | 1,185 → 1,149 | 93 KB less |
| lite `/owner/quotes` | 1,922 → 1,919 | 796 → 816 | 1,799 → 1,706 KB |
| free `/free` (control: no cleanup there) | 2,163 → 2,168 | 1,057 → 1,112 | unchanged |

The cleanup runs in an idle callback after hydration, so the gain is mostly the download, the parse and an IndexedDB open after the page is usable; timing differences under ~100 ms are within run-to-run noise. `phone-after.json` (a separate run after the rebuild) differs from `phone-before.json` by up to 200 ms in both directions on every sample, which is why the comparison above alternates within one run instead.

Checks: `npx tsc --noEmit` clean; `npm run lint` clean; `npx vitest run` 418 of 419 files passed (4,211 tests, 1 skipped), the one failure was the Lite copy audit reading the database name `TextileDB` as screen text, fixed by listing `lib/client-storage-cleanup.ts` with `lib/db.ts` in `scripts/i18n/lite-copy-audit.ts`, after which that file passes. A full rerun after the fix timed out with the CPU latched at 20%.
