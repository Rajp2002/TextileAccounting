# Performance before and after

## Identical scenario

For both builds:

1. Run `npm run build` using webpack and the repository production environment.
2. Parse each selected route's `.next/server/app/**/page_client-reference-manifest.js`.
3. Deduplicate the referenced initial `.js` chunks.
4. Sum filesystem bytes and gzip each exact emitted chunk with Node zlib.

This measurement excludes deferred chunks that are not referenced by the initial client graph.

## Route results

| Route | Before raw | After raw | Raw improvement | Before gzip | After gzip | Gzip improvement | Initial JS requests |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/login` | 1,168,350 | 598,136 | 570,214 (48.8%) | 347,831 | 197,270 | 150,561 (43.3%) | 22 → 22 |
| `/owner/today` | 1,266,554 | 696,340 | 570,214 (45.0%) | 374,306 | 223,742 | 150,564 (40.2%) | 27 → 27 |
| `/owner/estimator` | 1,406,594 | 836,380 | 570,214 (40.5%) | 413,271 | 262,709 | 150,562 (36.4%) | 30 → 30 |
| `/owner/payroll` | 2,023,626 | 1,046,208 | 977,418 (48.3%) | 604,319 | 323,496 | 280,823 (46.5%) | 34 → 32 |
| `/supervisor/dashboard` | 1,560,102 | 989,888 | 570,214 (36.6%) | 463,147 | 312,583 | 150,564 (32.5%) | 30 → 30 |

Median gzip reduction across the five routes: **40.2%**.

The language optimization reduces bytes rather than chunk count because the smaller provider runtime remains in the existing shared graph. Payroll also removes two initial JavaScript requests because both the PDF engine and its generated route boundary leave the initial graph.

## Material optimizations

### PERF-001

- Scenario: initial English render of each measured route.
- Baseline: non-English translation resources present in every initial graph.
- Final: resources absent until Hindi or Gujarati is selected.
- Absolute result: 570,214 raw bytes and approximately 150.6 KB gzip removed from each route.
- Percentage result: 32.5%–43.3% gzip reduction depending on route.
- Requests: unchanged in the sampled initial graphs.
- Functional verification: English, Hindi, Gujarati, and return to English passed in the live browser; `html[lang]` matched `en`, `hi`, and `gu`.
- Caveat: selecting Hindi or Gujarati now intentionally downloads the language assets on first use.

### PERF-002

- Scenario: first render of `/owner/payroll` before any export click.
- Baseline: 2,023,626 raw / 604,319 gzip bytes and 34 initial JS requests.
- Final: 1,046,208 raw / 323,496 gzip bytes and 32 requests.
- Absolute result: 977,418 raw and 280,823 gzip bytes removed.
- Percentage result: 48.3% raw and 46.5% gzip reduction.
- Functional verification: generator input/build code unchanged; TypeScript, payroll tests, and production chunk emission passed.
- Caveat: authenticated PDF-click verification is blocked by PERF-003.

## Latency and correctness evidence

- The changes affect transfer, parse, and evaluation work, but no p50/p95 latency percentage is claimed without a representative network/CPU trace.
- No calculation output changed. No estimator, quotation, payroll, stock, or order arithmetic was modified.
- No request, Supabase query, database plan, mutation, RLS policy, or invalidation behavior changed.
- No critical-journey regression over 5% was observed in available evidence; authenticated latency regression evidence remains unavailable.
