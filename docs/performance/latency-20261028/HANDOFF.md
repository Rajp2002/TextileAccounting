# Handoff: continue the 2026-10-28 latency pass

Written 2026-10-28 for the next session (another Claude account on Raj's laptop). Read this whole file before doing anything; it replaces the conversation that produced it.

## Paste this to start the session

> Continue the Weavly performance work on branch `claude/performance-optimization-03b955` (PR open against `main`). First read `CLAUDE.md`, `~/.claude/CLAUDE.md` (laptop rules: every heavy job goes through `heavyq`), then `docs/performance/latency-20261028/HANDOFF.md`, `summary.md` and `README.md` in that folder. Free and Lite roll out first; Base is unfinished and ships later, so rank work by Free/Lite impact. Work through the "Next tasks" list in HANDOFF.md in order. For each task: take a before measurement, make the change, take an after measurement, run tsc/vitest/lint, then commit and push to the same branch with the numbers in the commit message and a new section in README.md. Do not merge, do not run `npm run build`/`npm start` with production env, and ask me before anything listed under "Needs Raj's decision".

## Where things stand

**Pass 2 (2026-10-28):** PR #287 was merged, so work continues on `claude/perf-latency-pass-2` (draft PR #288, worktree `.claude/worktrees/performance-optimization-03b955-cfb26c`). Task 1 is done (README Task F); task 2 is measured with no app change (README Task G: the candidate fix is a Sentry decision, below); task 3 is done (README Task H: the retired offline queue no longer loads Dexie; estimator panels not split, with the evidence why); task 4 is measured with no app change (README Task I: sidebar prefetches start after the landing page is usable and make clicks ~130 ms faster, so they stay). Next: task 5.


- Branch `claude/performance-optimization-03b955`, 8 commits on `main@8a1dee0f`, pushed, PR open. Worktree used so far: `.claude/worktrees/performance-optimization-03b955`. If you work elsewhere, check out this branch; check `gh pr view` first: if Raj merged it, later commits on this branch never reach `main`, so branch again from `main` and open a new PR.
- Done and measured (detail in `README.md`, headline in `summary.md`):
  - **A** `41d2aff4`: Proxy forwards `x-weavly-session-hint` (user:org of the verified token, browser values stripped; `lib/session-hint.ts`). `getVerifiedIdentity`, `requireRole`, the owner layout (`startOwnerShellReads` in `lib/owner-organization.ts`) and the Free layout start the profile/plan/org/grant reads from it; each is used only for the same verified ids. Base's onboarding check reuses the owner org row. `freeContext` reads grant/org/plan together.
  - **C** `066c588d`: Free draft helpers load on demand in `EstimatorClient` (zod off the estimator and `/free`); `lib/costing-export-model.ts` split from the renderer in `lib/estimator-export.ts`; Free costings' export dialog lazy. The bundle-boundary test now walks static import graphs.
  - **D** `05d04a97`: `lib/i18n/known-fragments.ts` indexes the Hindi/Gujarati phrase table (benchmark `scripts/performance/i18n-fragment-benchmark.mjs`, identical output).
  - **B** `14dfe3a5`: estimator cost profile + staff in parallel; Proxy's signed-in `/login` routing read alongside Redis; assignments, Saved Costings and Billing page reads in parallel.
  - **E** `b288c5b9`: service worker no longer precaches `public/images/**` or font files (install 5.62 → 2.53 MB; `scripts/performance/precache-report.mjs`).
- Result: signed-in owner pages 6 → 3 sequential backend waits (first byte ~130/164 → ~66 ms in the harness), Free pages 5 → 2, estimator/Free first-load JS −49 KB gzip.
- Last full checks (at `14dfe3a5`, before E which only touched `next.config.ts`): `npx tsc --noEmit` clean, `npx vitest run` 418 files / 4205 passed / 1 skipped, `npm run lint` clean.
- Not verified: anything against real Supabase (QA DNS is dead; production must not be used locally), installed-app behaviour of the smaller service worker, phone timings.

## How to measure

All of this runs on the laptop through `heavyq` (it times out jobs at 2× estimate + 30 s; exit 124 means hung, investigate). The worktree has no `.env*` files, which is what keeps builds off production; keep it that way.

```bash
# 0. Dependencies match the lockfile (run if node_modules is new or stale)
heavyq run --est 4m --label npm-ci -- npm ci --no-audit --no-fund
# 1. Isolated production build (no secrets, Supabase URL compiled as http://127.0.0.1:9)
heavyq run --est 8m --label perf-build -- node scripts/performance/isolated-command.mjs bash -c 'node scripts/reset-build-type-cache.mjs && ./node_modules/.bin/next build --webpack'
# 2. Signed-in latency harness (fake Supabase/Upstash on :54399, next start on :3012)
heavyq run --est 2m --label perf-harness -- node scripts/performance/signed-in-latency/run.mjs docs/performance/latency-20261028/<name>.json --iterations 5
# 3. Before/after table (add --js for first-load JS)
node scripts/performance/signed-in-latency/compare.mjs docs/performance/latency-20261028/after-task-b.json docs/performance/latency-20261028/<name>.json
```

- Run the build in the background (`run_in_background`), then queue the harness with `heavyq` in the foreground; it starts when the build finishes. Don't edit app source while a build runs.
- The harness (`scripts/performance/signed-in-latency/`): `fake-backend.mjs` serves Auth (ES256 JWKS, `/user`), PostgREST (fixture rows filtered by `eq`/`in`/`is.null`, `[]` otherwise) and Upstash, delays every call (30 ms Supabase, 10 ms Redis) and logs it; `fixtures.mjs` has the Lite, Base and Free owners; `redirect-fetch.cjs` is preloaded into `next start` to send `127.0.0.1:9` traffic to the fake. "Waits" = longest chain of calls each starting after the previous ended; it doesn't depend on the delay. Production also signs with ES256 (public JWKS), so Proxy's `getClaims` is local there too.
- `--only "free:/free,lite:/owner/estimator"` limits routes. To time a route that is not in `ROUTES` (e.g. an API route), add it there.
- If a page shows a server error in the run's `serverErrors`, a fixture is missing (add a row or an `rpc` entry in `fixtures.mjs`), as happened with `get_quality_stock_board`.
- Source-contract tests read file text (over half the suite); search `__tests__/` for any string or path you change.

## Next tasks (Free/Lite first, in this order)

1. **Free usage meter and Calculate requests.** `hooks/use-free-meter.tsx` calls `/api/free/status` right after the Free page opens, and `/api/free/calculate` on Calculate. `freeStatus()` in `lib/free-service.ts` reads in series: `freeContext` → `getFreeRollout()` → `rpc('free_server_time')` → `free_monthly_usage` (needs the grant subject and the clock's window) → `free_account_subjects.tour_state`. Rollout, clock and tour state are independent, so it can be about three waits. Check `/api/free/calculate` and `lib/free-service.ts` calculate path for the same pattern. Keep the error order and the production fail-closed rules (`FREE_TEMPORARY_ERROR` when the clock fails). Add both API routes to the harness `ROUTES` (POST body for calculate from `freeAttemptPayload`) for before/after. Also fix the small one: the Free layout starts `getFreeOrganization` for every Free page, and `/free/billing` never uses it (one wasted read).
2. **Cold starts (first open of the day).** On Vercel a cold page render was ~1.4 s against ~0.2 s warm, mostly loading route server code (memory `first-open-cold-start-diagnosis`). Measure each Free/Lite route's first request after `next start` boots (extend the harness: one request per route with a fresh server, or time the first request per route before the warm-up passes), find heavy modules loaded at import time on every page (server Sentry/OpenTelemetry, dictionaries, PDF/Razorpay libraries, `lib/*` barrels), and move them behind dynamic imports where the code path is rare. Report the before/after per route.
3. **The estimator on phones.** `EstimatorClient.tsx` is ~7,700 lines and the main Lite page (Free renders the same component in Free mode). Measure hydration and long tasks with Playwright Chromium at 4× CPU throttle against `next start` + the fake backend (memory `tour-harness-local-setup` has the Playwright/Chromium paths). Split rarely opened panels and dialogs into `next/dynamic` chunks, keeping guided-tour anchors (`data-*-tour`) on the real components.
4. **Clicking between Lite pages.** Only full document loads were measured. Time RSC navigation requests (`RSC: 1` plus a captured `Next-Router-State-Tree`) and the five sidebar prefetches that fire right after sign-in; reduce prefetching only if it measurably competes with the landing page.
5. Lower priority: 43 live RLS policies call `auth.uid()` per row instead of `(select auth.uid())` (mostly Base/legacy and billing tables; the main Lite costing tables are not among them). Measure on the disposable Postgres used by `npm run test:db` with EXPLAIN ANALYZE before proposing a migration file. Never apply migrations; Raj does.

## Needs Raj's decision (do not change without asking)

- **Sentry's automatic server wrappers** (added 2026-10-28, pass 2, README Task G): `webpack.autoInstrument*: false` in `withSentryConfig` cut every Free/Lite route's cold first request by 18–24% (~170–200 ms), mostly Proxy's bundle. Errors still reach Sentry through `onRequestError`; Sentry's per-page/route spans and Proxy transactions would stop.

- **Sentry browser tracing**: about half of the 146 KB gzip shared chunk on every page, landing and login included. `bundleSizeOptimizations.excludeTracing` + client `tracesSampleRate: 0` would save ~30–40 KB per page but end Sentry browser performance traces.
- **`getUser()` → `getClaims()`** on the server: one more wait per page saved, but a signed-out or deleted session stays valid until its access token expires (up to an hour).
- **Splitting the English dictionary** (24.5 KB gzip on every page): large i18n refactor.

## Gotchas met in this pass

- The repo path contains a space: quote it in `NODE_OPTIONS` (`--require "…"`), as `run.mjs` does.
- `lib/auth` is wholesale-mocked by ~33 test files; put new shared helpers in their own module (as `lib/start-early.ts`) or those tests break.
- React `cache()` does not memoise inside server actions; a read started early for an action must be held and passed explicitly (see `requireRole`'s `earlyAccess`).
- Supabase query builders are lazy thenables: wrap in `Promise.resolve(...)` or an async function to actually start the request, and mark early reads handled with `startEarly`.
- `scripts/i18n/lite-copy-audit.ts` lists modules excluded from the Lite copy audit; a new module split out of an excluded one needs adding there.
- Laptop thermals: one heavy job at a time, all through `heavyq`; check `heavyq status` and `uptime` before starting long work.
