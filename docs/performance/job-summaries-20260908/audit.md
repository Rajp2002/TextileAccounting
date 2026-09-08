# Follow-up: Base production job summaries

## Scope and decision

This is the second isolated optimization after the [payroll-readiness audit](../payroll-readiness-20260908/audit.md). The working tree contained only that earlier work at the start of this pass; it was preserved. The framework, architecture, invariants, package scripts, operational restrictions and browser verification constraint established in that audit still apply. Starting HEAD remains `a41231b8e026f69ba938463ac6646c2cde33412b`.

Two remaining candidates were inspected: repeated worker-history scans in `calculateBaseWorkerPayables`, and repeated per-job history scans in `BaseProductionClient`'s `jobSummaries` memo. Job summaries were prioritized because grouping can preserve the exact existing calculation and avoid altering payroll period selection, historical payment overrides or advance recovery. Payroll scans remain an unprofiled candidate, not a promised improvement.

Before editing, the exact production call-site operation took a median 64.1ms for 200 jobs/12,400 entries and 503.6ms for 200 jobs/72,000 entries, plus 8,266/48,000 allocation rows. These are synthetic CPU measurements, not live tenant or page-load data. The data volume is supported by the complete-history loader but is not claimed to represent a measured customer's typical usage.

## Implementation and preserved behavior

`calculateBaseJobSummaries` groups matching entry and allocation references by job for the current invocation, then calls the unchanged `calculateBaseJobSummary` for each job. The client replaces its original map expression with this helper. Existing memo dependencies and the single-job render fallback remain intact. No new cache, asynchronous work, query, index, dependency or infrastructure change is involved.

- Source order, duplicate rows, duplicate job ID last-value/first-key-position Map semantics, unrelated history exclusion and empty results are preserved.
- Entries and allocations remain separate until the existing calculator adds their Decimal subtotals. This matters at precision boundaries; merging the two reductions could change results.
- Produced, remaining, excess, progress, planned cost and planned value still use the same Decimal operations, clamping and rounding. Invalid-number handling is unchanged.
- The costing engine, saved snapshots, Quick/Detailed parity, missing-input behavior, customer/internal document separation, tenant/role/plan boundaries, locales, draft recovery, exports, errors and persistence are untouched.
- No persistent Map survives the call. Corrections use fresh references on the next invocation. The tradeoff is O(matching entries + allocations + jobs) temporary references; peak heap and garbage-collection impact are not measured. Empty job lists avoid history scanning.

## Regression tests

Four new tests compare against the original call-site expression using the authoritative calculator, rather than a second formula implementation. They cover 20 interleaved histories, exact output and input immutability, duplicate keys/rows, unmatched and special IDs, empty/default arguments, corrections, invalid numbers and rounding boundaries. A precision-sensitive case explicitly expects 0.04m and detects accidentally combining the entry and allocation reductions.

`RUN_LIVE_SUPABASE_TESTS=0 npx --no-install vitest run __tests__/base-job-summaries.test.ts` passed all four characterization tests with the original map helper before optimization. After grouping, `RUN_LIVE_SUPABASE_TESTS=0 npx --no-install vitest run __tests__/base-job-summaries.test.ts __tests__/base-production-core.test.ts` passed 15 tests. The strengthened 0.04m assertion was added afterward and is covered by the final suite.

## Measurement method

Run `node scripts/performance/job-summaries-benchmark.mjs` from the repository root. It transpiles the actual pure TS modules with the installed TypeScript compiler, uses the real Decimal.js dependency and compares the old call-site expression to the new helper. Every case first asserts exact Map equality. Compilation and fixture generation are outside timing; grouping and calculation are inside every timed call.

Each case uses 10 warmup pairs and 30 measured pairs with alternating order in the same process and identical input. Two independent comparison runs follow the pre-edit baseline. No tests/builds ran concurrently with the second comparison. Raw samples, min/median/max, Node version and CPU model are retained in JSON. No tail percentiles are claimed.

This is warmed helper CPU time only. Browser cold/warm caches, React rendering, user-visible interaction latency, production JIT, network/DB time and mobile hardware remain unmeasured. A faster helper does not establish an equivalent page speedup. The one-job fixture may be slightly slower because grouping adds overhead; the absolute delta and variability are reported below.

## Remaining verification and rollback

Authenticated browser, visual, role/tenant/plan/locale, persistence and export checks are BLOCKED/NOT RUN for this local implementation. The [login skill](/Users/rajpatel/.codex/skills/weavly-browser-login/SKILL.md) says: “Do not use this helper to validate uncommitted, unpushed, unmerged, or undeployed implementation work.” It restricts QA to canonical production; deployment requires user approval. No production login would validate this local helper, and no login bypass or deployment was attempted.

No DB writes, notifications, payments, schema changes, commits or pushes were performed. Production timing/plans are still needed before database proposals. No claim of zero regressions or production safety extends beyond the automated and CPU evidence.

To roll back this follow-up alone, restore the previous `new Map(initialData.jobs.map(...))` expression and remove the `calculateBaseJobSummaries` import in `BaseProductionClient.tsx`, then remove the new helper, test, fixture, benchmark and this evidence directory. Keep the earlier payroll-readiness changes. No data, dependency or cache rollback is necessary.

## Changed files

- `lib/base-job-summaries.ts`: per-invocation grouping; invokes the existing calculator.
- `app/(dashboard)/owner/production/BaseProductionClient.tsx`: one import and one memo callback replacement.
- `__tests__/base-job-summaries.test.ts`: four behavioral/differential tests.
- `scripts/performance/job-summaries-fixture.ts`: synthetic, typed history.
- `scripts/performance/job-summaries-benchmark.mjs`: repeatable local CPU comparison, no live services.
- This directory: baseline, comparisons, check logs and bundle evidence.

## Paired performance results

Second independent comparison; 30 pairs/case, 10 warmup pairs. Node v24.11.1, Intel(R) Core(TM) i9-9880H CPU @ 2.30GHz. Both comparison runs show 61–62% and 74% reductions on the two larger cases.

| Jobs / entries / allocations | Before median ms (min–max) | After median ms (min–max) | Median saved ms | Reduction |
| --- | ---: | ---: | ---: | ---: |
| 1 / 62 / 41 | 0.124 (0.114–0.152) | 0.140 (0.123–0.190) | -0.016 | -12.7% |
| 20 / 1,240 / 826 | 2.999 (2.952–3.395) | 2.296 (2.180–2.754) | 0.703 | 23.4% |
| 200 / 12,400 / 8,266 | 64.063 (62.770–110.040) | 24.153 (22.930–29.513) | 39.910 | 62.3% |
| 200 / 72,000 / 48,000 | 506.850 (370.008–644.936) | 131.099 (124.933–158.594) | 375.751 | 74.1% |

Single-job overhead is about 0.016ms; small-case timing ranges overlap. The large-case benefit remains clear despite substantial original-path variability. Residual 131ms CPU cost at the largest fixture is still meaningful: all Decimal arithmetic remains required, and no claim is made that the entire screen now avoids long tasks.

## Final regression checks

- PASS: `RUN_LIVE_SUPABASE_TESTS=0 npm test` — 218 files, 1448 passed and one intentionally skipped live integration. The preceding pass baseline was 217 files/1444 passed/one skip.
- PASS: `npx --no-install tsc --noEmit`.
- PASS after correction: `npx --no-install eslint --max-warnings=0 lib/base-job-summaries.ts 'app/(dashboard)/owner/production/BaseProductionClient.tsx' __tests__/base-job-summaries.test.ts scripts/performance/job-summaries-fixture.ts scripts/performance/job-summaries-benchmark.mjs`. Initial targeted lint found a new benchmark-only `no-assign-module-variable` error; renaming its local holder to `compiledModule` fixed it. Both logs are retained. This lexical rename does not change the timed functions.
- FAIL, pre-existing: `npm run lint` — the same 2 errors and 9 warnings in unrelated estimator/rate-book files as the preceding baseline; no new findings remain.
- PASS: `git diff --check`.
- PASS production build: `SENTRY_AUTH_TOKEN='' SENTRY_ORG='' SENTRY_PROJECT='' SENTRY_DSN='' NEXT_PUBLIC_SENTRY_DSN='' RUN_LIVE_SUPABASE_TESTS=0 npm run build` (includes prebuild tests). Credentials/DSNs blanked to avoid Sentry upload/telemetry. Compile, type checking and static generation passed; this is not authenticated runtime evidence.

## Emitted bundle check

Used `scripts/performance/sprint21-bundle-report.mjs` from the preceding pass with one temporary additional route definition: `'/owner/production': { folder: 'production', label: 'Base Production', budgetGzipBytes: null }`. No application build settings changed. Both reports retain the chunk lists and counts. Reproduce by adding that entry to a temporary copy of the reporter and running `node <temporary-reporter.mjs> .next <output.json>`. This measures emitted deduplicated route chunks, not actual browser transfer or page latency. Existing budgets are unchanged; no new production-route budget is invented.

| Route | Before gzip bytes | After gzip bytes | Delta bytes | Budget status |
| --- | ---: | ---: | ---: | --- |
| /owner/production | 347,916 | 348,011 | +95 | informational |
| /owner/estimator | 391,934 | 391,934 | +0 | over_budget |
| /owner/rates | 167,098 | 167,098 | +0 | pass |
| /owner/quotes | 177,500 | 177,500 | +0 | pass |
| /owner/settings | 201,017 | 201,017 | +0 | over_budget |
| /owner/billing | 113,755 | 113,755 | +0 | informational |
