# Performance before and after

## Identical bundle scenario

For both builds:

1. Run `npm run build` with webpack and the repository production environment.
2. Parse each selected route's `.next/server/app/**/page_client-reference-manifest.js`.
3. Deduplicate the referenced initial `.js` chunks.
4. Sum filesystem bytes and gzip each exact emitted chunk with Node zlib.

The before build came from the tree-identical upstream baseline; the after build came from `codex/performance-campaign-20260715-upstream`. Deferred chunks absent from the initial client graph are excluded.

## Route results

| Route | Before raw | After raw | Raw improvement | Before gzip | After gzip | Gzip improvement | Initial JS requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/login` | 1,173,014 | 602,445 | 570,569 (48.6%) | 349,344 | 198,867 | 150,477 (43.1%) | 22 → 22 |
| `/owner/today` | 1,269,682 | 699,123 | 570,559 (44.9%) | 375,185 | 224,770 | 150,415 (40.1%) | 27 → 27 |
| `/owner/estimator` | 1,407,777 | 837,223 | 570,554 (40.5%) | 413,526 | 263,119 | 150,407 (36.4%) | 30 → 30 |
| `/owner/payroll` | 2,026,912 | 1,049,114 | 977,798 (48.2%) | 604,925 | 324,625 | 280,300 (46.3%) | 34 → 32 |
| `/supervisor/dashboard` | 1,563,639 | 993,072 | 570,567 (36.5%) | 464,094 | 313,751 | 150,343 (32.4%) | 30 → 30 |

Across the five scenarios, 3,260,047 raw bytes and 881,942 gzip bytes were removed from the summed initial graphs. The median per-route gzip reduction is **40.1%**. Summed route graphs share chunks, so the summed number is a comparison aggregate, not a unique-deployment byte count.

## PERF-001 — global language resources

- Scenario: initial English render of each measured route.
- Baseline: non-English translation resources present in every initial graph.
- Final: language resources are absent until Hindi or Gujarati is selected.
- Absolute result: about 570.6 KB raw and 150.3–150.5 KB gzip removed per route.
- Percentage result: 32.4%–43.1% gzip reduction depending on route.
- Requests: unchanged in sampled initial graphs.
- Functional verification: English → Hindi → Gujarati → English passed in the live browser; `html[lang]` matched `en`, `hi`, and `gu`.
- Caveat: first Hindi/Gujarati selection intentionally downloads its language assets.

## PERF-002 — payroll PDF engine

- Scenario: first render of `/owner/payroll` before an export click.
- Baseline: 2,026,912 raw / 604,925 gzip bytes and 34 initial JS requests.
- Final: 1,049,114 raw / 324,625 gzip bytes and 32 requests.
- Absolute result: 977,798 raw and 280,300 gzip bytes removed.
- Percentage result: 48.2% raw and 46.3% gzip reduction.
- Functional verification: generator inputs and calculations are unchanged; payroll tests, TypeScript, build, and emitted deferred-chunk verification passed.
- Runtime limitation: the QA payroll cycle had zero paid settlements. A click test would have required a financial mutation, so it was not performed.

## Post-change runtime evidence

There was no clean authenticated pre-change runtime capture for these code-only bundle changes, so runtime numbers are reported as final guardrails rather than false before/after attribution:

- Owner login p50/p95 728/932 ms over 20 samples; maximum 1,163 ms.
- Factory Today p50/p95 437/554 ms over 20 samples.
- Estimator p50/p95 397/499 ms over 20 samples.
- Payroll p50/p95 405/615 ms over 20 samples; one 1,183 ms outlier remained visible.
- Owner route-transition median 56 ms; maximum 240 ms across six sections.
- Supervisor dashboard p50/p95 379/853 ms over 20 samples; the first post-restart sample was a 3,393 ms cold outlier.
- Mobile supervisor route commit 382 ms; ready data 1,216 ms at 390×844.
- Role boundary redirect 548 ms with no owner data exposed.

## Correctness evidence

- No estimator, quotation, payroll, stock, order, or financial arithmetic changed.
- The bundle optimization commit `8d4d767` changed no Supabase query, database plan, mutation, RLS policy, session validation, or invalidation behavior.
- No critical route exceeded the local final guardrails above; no runtime percentage is claimed without an identical authenticated pre-change trace.

## PERF-010 — supervisor loading completion

- Identical scenario: production supervisor sign-in followed by a hard reload of `/supervisor/dashboard`, with no production form submission.
- Before: loom data rendered, but the save helper remained `Loading shift data...` and the save control remained disabled after 15 seconds.
- Fix: wait for the tenant-scoped draft key before the setup fetch and settle only the current request in `finally`.
- Request change: two overlapping initial setup calls reduced to one by construction.
- After: five production hard reloads all reached ready state without the loading text in 5,024–6,543 ms; p50 5,450 ms and nearest-rank p95 6,543 ms.
- Improvement: because the baseline is right-censored at greater than 15,000 ms, exact percentage is unknowable; the measured p95 improvement is at least 56.4%, and the workflow changed from indefinitely blocked to usable.
- Functional verification: focused regression tests, full test suite, lint, TypeScript, production build, canonical deployment smoke, owner routes, and the supervisor-to-owner redirect boundary passed. No production shift mutation was performed.
