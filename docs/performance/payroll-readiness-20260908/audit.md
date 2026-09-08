# Base payroll readiness performance audit

## Summary and scope

Starting commit: `a41231b8e026f69ba938463ac6646c2cde33412b`. Initial working tree was clean. No applicable AGENTS.md was found in the repository or ancestor directories. No dependencies, schema, policies, infrastructure, or public interfaces changed. No database writes, load tests, notifications, commits, pushes, or deployments were performed.

Retained one optimization: `buildBasePayrollReadiness` builds a per-call worker-to-entry index instead of scanning all entries for every payable. Source order, duplicates, date checks, validation, error text, totals and settlement eligibility remain the same. Only 10 production lines were added and 3 replaced/removed. This is reduced CPU work in a client-side helper, not demonstrated page-load improvement.

## Repository map and behavioral contract

Inspected package scripts/lockfile, existing tests, TESTING_GUIDE.md, TECHNICAL_ANALYSIS.md, USER_WORKFLOWS.md, existing performance reports/tooling, layouts, providers, auth, entitlements, data loaders, payroll/costing functions and offline storage.

- Locked and installed versions agree: Next.js 16.2.12, React/React DOM 19.2.7, TypeScript 5.9.3, Vitest 4.1.8, Supabase JS 2.95.3 / SSR 0.8.0, Decimal.js 10.6.0, TanStack React Query 5.90.21. Build uses webpack, not a presumed default bundler.
- Entry paths: public/auth pages, owner dashboard, supervisor production/attendance, archived/admin routes. Root layout installs localization/PWA providers; owner layout verifies owner role, organization lockdown and plan access. Client views use React state/memoization and selected TanStack query paths; server components/actions supply data.
- Base workflow: owner costing → saved quality → production job → worker/machine production → payroll readiness → settlement. `owner/production/page.tsx` derives org from `requireRole(['owner'])` and date from Surat time. `loaders.ts` reads tenant-scoped complete history through `readCompleteBaseRows` (500-row pages with completeness checks). It computes payables server-side. `BaseProductionClient.tsx:254` memoizes readiness from payables, entries and allocations; its output drives ready/review filters and settlement feedback.
- Full Suite workflows include orders, market runs, stock sales, dispatch/receipt variance, commercials and payroll. Their actions, SQL/RPC transaction boundaries, ordering, pagination and reconciliation are unchanged.
- Auth uses verified identity and request-scoped helpers; org ID comes from server profile. Lite/Base/premium/trial capability boundaries live in `subscription-access.ts` and route/action guards. This pure helper receives already-scoped data; its new Map is local to one invocation, never shared across requests, tenants or permissions.
- Costing remains one `calcFullTotals` engine with Quick/Detailed parity, Decimal precision 20 and HALF_UP rounding, immutable saved snapshots, missing-input/reconciliation handling, and separation of internal costing from customer quotations. No costing or monetary calculation code changed.
- Payroll keeps saved rate snapshots, fixed salary lines, advance caps, paid settlement overrides, historical periods and reversed-settlement behavior. The readiness helper retains its exact existing 0.01m comparison, positive finite checks, inclusive date boundaries, zero/absent exclusions, missing context/rate/allocation errors, issue order, and paid/gross-pay eligibility. The SQL settlement guard remains authoritative and unchanged.
- English/Hindi/Gujarati text/resources, accessibility, responsive layouts, exports/PDF identities, loading/error states, draft recovery, autosave and offline mutation queues are unchanged. Offline storage remains principal-scoped. Existing language resources are deferred; payroll PDF is already deferred. PWA caches static assets but protects documents/API/RSC with network-only rules. No new cache or async behavior was introduced.
- Razorpay subscription/webhook routes, Supabase messaging functions, scheduled work and Sentry telemetry were inspected as integration boundaries, not exercised. Tests were inspected for live calls and shell side effects: the opt-in finance integration was disabled; backup tests use temporary stub executables. No standalone database/QA scripts were run. Build Sentry credentials and DSNs were blanked to avoid uploads/telemetry.

Documentation contradictions/limits: TECHNICAL_ANALYSIS.md is explicitly June-era and describes older Full Suite routes/tables; current Base production code and Lite/Base capability definitions add workflows absent from that overview. The July performance campaign's counts, measurements and “performance-ready” statement do not establish this checkout's status. Its five-sample tail statistic is not reused. An older recommendation to always cache is not sufficient authorization or evidence for new caching. The finance integration test's title claims duplicate-entry validation, but its body only reads two rows and can return on error; it does not prove that behavior. It was skipped, not counted as runtime coverage. Live schema was not reconciled.

## Ranked candidates before implementation

| Priority | Candidate / evidence | Decision, risk and verification |
| --- | --- | --- |
| 1 | `lib/base-payroll-readiness.ts`, repeated full entry scan per payable; loader retains full history. Baseline medians 34.0ms at 200 workers/12,400 entries and 275.3ms at 72,000 entries. | Index by worker per call. Low implementation scope but readiness is important: prove exact outputs, worker separation, ordering, eligibility and freshness; benchmark same input before/after. Retained. |
| 2 | `calculateBaseWorkerPayables` in `base-production-core.ts` repeatedly filters entries/settlements/advances per worker. | Static candidate only, not independently profiled. Monetary/period-selection risk warrants separate characterization and measurement; left unchanged. |
| 3 | `BaseProductionClient` maps jobs through `calculateBaseJobSummary`, scanning entries/allocations per job. | Static candidate only; job counts and runtime cost unmeasured. No speculative rewrite. |
| 4 | Complete-history loader issues multiple paged tenant queries; July campaign reports cold quotations/dispatch delays. | Current deployed query times/plans and representative safe tenant data unavailable. No shortening history, speculative index, RPC, cache or concurrency changes. Schema/index work requires approval after evidence. |

## Reproducible performance comparison

Run `node scripts/performance/payroll-readiness-benchmark.mjs`. The script uses the existing TypeScript compiler to erase types from the production helper and frozen original, then runs plain JavaScript in Node. No Vitest instrumentation, network, authentication, database or React rendering participates. Index creation is included in every timed call; fixtures and compilation are outside timing. Synthetic two-shift entries are interleaved by worker and contain valid/invalid machine allocations, legacy totals, absent/zero records and paid/unsettled payables. Historical input older than the settlement period remains present, as in the loader.

Environment: Node v24.11.1, Intel Core i9-9880H @ 2.30GHz, same host/process/input for paired measurements. Each case has 10 warmup pairs then 30 pairs with alternating execution order. Two separate comparison runs reproduced the large-input gain. `baseline.json` records pre-edit behavior; `comparison-1.json` and `comparison-2.json` retain every sample. The second comparison ran without builds/tests in progress and is reported below. Do not compare build durations or unrelated runs as performance evidence.

| Workers / history days / entries | Before median ms (min–max) | After median ms (min–max) | Median saved ms | Reduction |
| --- | ---: | ---: | ---: | ---: |
| 1 / 31 / 62 | 0.052 (0.039–0.120) | 0.061 (0.049–0.103) | -0.010 | -18.6% |
| 20 / 31 / 1,240 | 0.925 (0.525–1.446) | 0.481 (0.347–1.093) | 0.445 | 48.1% |
| 200 / 31 / 12,400 | 28.945 (28.606–32.401) | 4.061 (3.962–7.187) | 24.884 | 86.0% |
| 200 / 180 / 72,000 | 289.949 (280.546–320.852) | 24.698 (23.844–34.062) | 265.250 | 91.5% |

The first paired comparison showed 85.4% and 91.8% reductions on the two 200-worker cases, consistent with the second. Small-input timings overlap and are noisy; one-worker indexing adds about 0.01ms. That absolute overhead is not a material interaction regression, but this is not an across-the-board speedup. The new index retains O(entries) temporary references in addition to the pre-existing allocation index; peak heap/GC impact was not measured. No cross-call retention exists.

This measures warmed CPU time only. Cold browser startup, production bundling/JIT, slower devices, page latency, React renders, request counts, DB latency and Core Web Vitals are unmeasured. No tail percentiles or arbitrary improvement target are claimed. Existing gzip budgets are checked separately with the repository bundle reporter, not used as a payroll CPU target.

## Regression evidence

- PASS baseline: `RUN_LIVE_SUPABASE_TESTS=0 npm test` — 217 files, 1439 passed, 1 intentional live integration skip.
- PASS characterization before production edit: `RUN_LIVE_SUPABASE_TESTS=0 npx --no-install vitest run __tests__/base-payroll-readiness.test.ts` — 9 tests at that stage.
- PASS targeted after edit: same command — 9 tests at that stage; one additional duplicate-entry assertion subsequently included in the full suite.
- PASS final: `RUN_LIVE_SUPABASE_TESTS=0 npm test` — 217 files, 1444 passed, 1 intentional live integration skip. Five new tests cover 20 synthetic histories, exact original-output equivalence, no input mutation, duplicate workers/entries, date boundaries, issue ordering, unknown/special worker IDs, invalid numbers, tolerance boundaries and corrected/paid input on subsequent calls.
- PASS baseline and final: `npx --no-install tsc --noEmit`.
- PASS changed-file lint: `npx --no-install eslint --max-warnings=0 lib/base-payroll-readiness.ts __tests__/base-payroll-readiness.test.ts __tests__/fixtures/payroll-readiness-original.ts scripts/performance/payroll-readiness-fixture.ts scripts/performance/payroll-readiness-benchmark.mjs`.
- FAIL, pre-existing and identical baseline/final: `npm run lint` — 2 unescaped-quote errors at EstimatorClient.tsx:2305; 9 warnings in EstimatorClient, RatesClient, CostEstimateTutorial, RateBookTutorial and estimator-yarn-suggestions. These unrelated files were not changed. Full diagnostics are retained in baseline-lint.log and final-lint.log.
- PASS baseline/final production build: `SENTRY_AUTH_TOKEN='' SENTRY_ORG='' SENTRY_PROJECT='' SENTRY_DSN='' NEXT_PUBLIC_SENTRY_DSN='' RUN_LIVE_SUPABASE_TESTS=0 npm run build`. This includes the prebuild test gate, webpack compile and Next type/static generation steps. No authenticated route runtime claim follows from this.
- PASS `git diff --check`.
- PASS report generation: `node scripts/performance/sprint21-bundle-report.mjs .next <output.json>` before and after. Existing route budgets/results below; this reporter does not include `/owner/production` and is only an adjacent bundle check.
- BLOCKED authenticated browser/E2E and visual verification of this checkout: the local login skill requires canonical production and says “Do not use this helper to validate uncommitted, unpushed, unmerged, or undeployed implementation work.” Deploying requires user approval. No production login could verify this local implementation, and no bypass was introduced. Skill: `/Users/rajpatel/.codex/skills/weavly-browser-login/SKILL.md`.
- NOT RUN: live DB integration, role/tenant/plan/locale browser matrix, persistence/settlement, exports, browser console/failed-request checks and production load measurements. Existing automated guards passed; these are not substitutes for the missing runtime checks.

## Changed files and rollback

- `lib/base-payroll-readiness.ts`: invocation-local entry index; all readiness checks remain intact.
- `__tests__/base-payroll-readiness.test.ts`: focused regression and differential coverage.
- `__tests__/fixtures/payroll-readiness-original.ts`: frozen original helper from the starting commit, with only its type import path adjusted. Test/benchmark oracle only; not a second runtime calculation engine. Do not synchronize it with future optimizations.
- `scripts/performance/payroll-readiness-fixture.ts`: reusable typed synthetic data with no live service access.
- `scripts/performance/payroll-readiness-benchmark.mjs`: reproducible alternating comparison with exact-output assertion and raw samples.
- This directory: audit, timings, baseline/final check outputs and emitted-bundle evidence.

Rollback only the worker-index block and restore the original `entries.filter` worker predicate in `lib/base-payroll-readiness.ts`; remove the five added tests/imports and new evidence/fixture/benchmark files if desired. No migration, cache flush, data repair or dependency rollback is needed. Avoid resetting the working tree if subsequent work has been added. Nothing was committed or deployed.

Remaining work: get approval for production deployment before the required authenticated workflow check; gather safe deployed traces before database/index proposals; profile the two static CPU candidates independently if larger tenants justify it. No claim of zero regressions or production safety extends beyond these measurements and automated checks.

## Adjacent emitted JavaScript check

The existing reporter measures deduplicated route client-reference chunks, not network bytes observed in a browser. No bundle optimization is claimed. Existing over-budget routes remain over budget.

| Route | Before gzip bytes | After gzip bytes | Existing budget status |
| --- | ---: | ---: | --- |
| /owner/estimator | 391,934 | 391,934 | over_budget |
| /owner/rates | 167,098 | 167,098 | pass |
| /owner/quotes | 177,500 | 177,500 | pass |
| /owner/settings | 201,017 | 201,017 | over_budget |
| /owner/billing | 113,755 | 113,755 | informational |
