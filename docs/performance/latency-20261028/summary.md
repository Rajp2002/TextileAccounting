# Latency pass, 2026-10-28: before and after

Branch `claude/performance-optimization-03b955` (six commits on `main` at `8a1dee0f`; not merged, no PR yet). Method, findings and per-task detail: `README.md` in this folder.

## Headline

| What | Before | After |
| --- | ---: | ---: |
| Owner page, first byte (Lite, median of 5 pages) | 130 ms | 66 ms (−49%) |
| Owner page, first byte (Base, median of 9 pages) | 164 ms | 66 ms (−60%) |
| Owner page, complete HTML (estimator, the post-sign-in landing page) | 204 ms | 107 ms (−48%) |
| Free page, complete HTML (`/free`) | 168 ms | 73 ms (−57%) |
| Installed-app launch redirect (signed-in `/login`) | 53 ms | 39 ms (−26%) |
| Sequential backend waits before an owner page's HTML is complete | 5–6 | 3 |
| First-load JS, estimator and `/free` | 562 / 554 KB | 514 / 505 KB (−49 KB gzip) |
| First-load JS, Free costings / Saved Costings | 433 / 483 KB | 386 / 445 KB |
| Hindi/Gujarati text pass, 4,090 new strings | 2,093 ms | 71 ms (−97%) |
| Service-worker install download | 5.62 MB | 2.53 MB (−55%) |

Page times come from the local harness, where every Supabase call takes 30 ms. In production each removed wait saves one real Vercel bom1 → Supabase Mumbai round trip (query time included), so the saving scales with real latency: three fewer waits on every signed-in owner page, three on Free pages. Behaviour is unchanged: every early read is used only when the verified identity names the same user and org.

## Per route

`baseline.json` → `after-task-b.json` (all server and bundle changes):

| Account | Route | First byte, ms | Complete HTML, ms | Waits | First-load JS, KB gzip |
| --- | --- | --- | --- | --- | --- |
| lite | `/owner/estimator` | 130.7 → 65.1 | 203.6 → 106.5 | 6 → 3 | 562.2 → 513.5 |
| lite | `/owner/quotes` | 130.9 → 66.7 | 199.6 → 106.6 | 6 → 3 | 482.8 → 445.0 |
| lite | `/owner/rates` | 130.2 → 67.3 | 168.6 → 104.8 | 5 → 3 | 389.5 → 390.4 |
| lite | `/owner/settings` | 127.1 → 66.3 | 166.7 → 95.6 | 5 → 3 | 485.8 → 485.9 |
| lite | `/owner/billing` | 129.7 → 66.1 | 202.2 → 107.3 | 6 → 3 | 341.6 → 341.8 |
| base | `/owner/estimator` | 162.4 → 63.2 | 202.9 → 103.8 | 6 → 3 | 562.2 → 513.5 |
| base | `/owner/production` | 163.7 → 69.4 | 199.9 → 106.1 | 6 → 3 | 514.1 → 514.3 |
| base | `/owner/production/daily-sheet` | 167.0 → 66.8 | 203.0 → 105.7 | 6 → 3 | 514.1 → 514.3 |
| base | `/owner/stock` | 164.2 → 64.9 | 202.0 → 100.7 | 6 → 3 | 404.9 → 405.1 |
| base | `/owner/dispatches` | 165.9 → 65.7 | 197.3 → 101.8 | 6 → 3 | 415.3 → 415.6 |
| base | `/owner/payroll` | 166.4 → 66.3 | 204.2 → 105.8 | 6 → 3 | 533.9 → 534.2 |
| base | `/owner/machines` | 162.5 → 65.9 | 200.5 → 102.1 | 6 → 3 | 397.6 → 397.8 |
| base | `/owner/workers` | 162.5 → 65.5 | 199.8 → 101.7 | 6 → 3 | 379.0 → 379.1 |
| base | `/owner/assignments` | 165.8 → 64.7 | 205.3 → 102.0 | 6 → 3 | 387.3 → 387.5 |
| free | `/free` | 127.6 → 68.2 | 167.8 → 72.5 | 5 → 2 | 553.8 → 505.1 |
| free | `/free/costings` | 128.2 → 65.4 | 161.7 → 69.2 | 5 → 2 | 433.0 → 385.5 |
| free | `/free/account` | 129.1 → 64.9 | 165.0 → 67.7 | 5 → 2 | 406.4 → 406.5 |
| free | `/free/billing` | 130.6 → 63.3 | 133.6 → 96.5 | 4 → 3 | 342.9 → 343.2 |
| lite, free | `/login` signed in (launch redirect) | 52.9 → 39.4 | | 2 → 1 | |
| public | `/`, `/login` | unchanged (no backend calls) | | | +0.2 |

## Commits

| Commit | Task | Findings |
| --- | --- | --- |
| `56f4d716` | Harness, baseline, findings | |
| `41d2aff4` | A: identity, plan and organization reads in parallel | 1, 2, 3, 5 |
| `066c588d` | C: zod and the document renderer off first loads | 7, 8 |
| `05d04a97` | D: indexed Hindi/Gujarati phrase scan | 9 |
| `14dfe3a5` | B: independent page reads together | 4, 6 + three pages |
| `b288c5b9` | E: smaller service-worker install | 14 |

Checks at the last code commit: `npx tsc --noEmit` clean, `npx vitest run` 418 files / 4,205 passed / 1 skipped, `npm run lint` clean. Builds used `scripts/performance/isolated-command.mjs` (no secrets, no production or QA env).

## Not verified

- No signed-in check against real Supabase: QA no longer resolves and local builds must not use production. Real per-call latency in production is unknown; waits and call counts are exact.
- No installed iPhone/Android check of the smaller service worker.
- No phone measurement of the Hindi/Gujarati pass; the benchmark ran on the laptop.

## Needs your decision (not changed)

1. **Sentry browser tracing** is about half of the 146 KB gzip chunk every page loads, landing and login included. Turning it off (`bundleSizeOptimizations.excludeTracing`, client `tracesSampleRate: 0`) would save roughly 30–40 KB per page, but ends Sentry browser performance traces. Your own web-vitals reporting keeps working.
2. **`getUser()` on every request** is an Auth network call. Tokens are ES256, so `getClaims()` could verify locally and save one more wait per page, but a signed-out or deleted session would stay valid until its access token expires (up to an hour). Security trade-off.
3. **The English dictionary on every page** (24.5 KB gzip). Splitting it by surface is a large i18n refactor.

## Pass 2 (branch `claude/perf-latency-pass-2`, PR #288)

Detail in `README.md`, Tasks F–J.

| What | Before | After |
| --- | ---: | ---: |
| Free usage meter request (`/api/free/status`), harness | 254 ms, 8 waits | 92 ms, 3 waits |
| Free Calculate (`/api/free/calculate`), harness | 202 ms, 7 waits | 107 ms, 4 waits |
| `/free/billing` complete HTML, harness | 94 ms, 3 waits | 67 ms, 2 waits |
| JS on every owner page for the retired offline queue | 93 KB (Dexie) | none after the first visit |
| Saved Costings database read, 3,000 costings (proposed migration, not applied) | 224 ms (2.6 s if the account came from Free) | 7 ms |

Measured, no change: cold first requests (~0.8–1.0 s for Free/Lite pages; turning off Sentry's server wrappers would cut 18–24%, which is Raj's call), the estimator on a 4×-slowed phone (usable ~2.2 s; its unused panels are only ~10 KB gzip), and sidebar prefetching (it starts after the landing page is usable and makes clicks ~130 ms faster, so it stays).

Decisions settled (README Task K): Sentry server wrappers off (cold first requests 18–24% faster) and browser tracing off (−47.9 KB gzip on every page, `/login` 301 → 253 KB); `getUser()` kept; dictionary split deferred. Sentry still reports server and browser errors (checked).

Needs Raj: apply `20261028120000_rls_checks_once_per_query.sql` to production.
