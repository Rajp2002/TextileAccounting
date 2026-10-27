# Weavly application performance audit — 2026-09-11

## Executive summary

Two narrow changes are retained across three production files. Paid estimator edits no longer run two unused stress calculations; the 20+20-row synthetic computation path measured 9.14ms → 3.11ms median with identical reference outputs. Base Production's page-entry JavaScript dependency set shrank by 420,151 raw bytes / 133,458 gzip bytes by loading its existing PDF generator on request. These are **Measured improvements** in CPU work and emitted dependencies, not measured page-load/INP improvements.

The final production build and its type check passed. All 1,698 tests passed, with one existing opt-in live test skipped. Full lint retains exactly the baseline's 2 errors and 48 warnings. No production deployment or data/configuration change occurred during the audit. Authenticated local browser verification, first-click PDF timing/download behavior, mobile/installed-PWA checks and field performance remain **Not tested / Blocked** as detailed below. This is a locally verified patch with explicit remaining release checks, not a production-readiness certification.

## Scope, baseline and safety

Starting revision: `a92b371930060bfa227e1da4dc3f115efcd3fa58`; clean working tree on `main`. Audit branch: `codex/performance-audit-20260911`. No applicable repository/ancestor AGENTS.md instructions were found. The initial audit excluded deployments and pushes. No migrations, live database queries, payments, messages or production configuration changes were performed. The subsequent Git release authorization is recorded below.

Installed/locked versions: Next.js 16.2.12, React/React DOM 19.2.7, TypeScript 5.9.3, Vitest 4.1.8, Supabase JS 2.95.3/SSR 0.8.0, React Query 5.90.21, Decimal.js 10.6.0, jsPDF 4.2.1, next-pwa 10.2.9. Production builds use webpack. No React Compiler configuration is present. Existing package import optimization, lazy locale resources, request-scoped auth deduplication and deferred costing exports are already implemented.

`.env.local` and `.env.qa.local` target the same hosted Supabase project; `.env.production.local` targets another hosted project. None is accepted as an isolated benchmark backend. `scripts/performance/isolated-command.mjs` overrides environment-file keys in the child process, blanks credentials/telemetry, points Supabase to `127.0.0.1:9` with placeholder keys, and disables the existing opt-in live integration. It does not modify any environment file. Pure fixtures have no network operations. Standalone QA/seed scripts are not run. Build font downloads may still require the network; this is not a network sandbox.

## Discrepancies requiring a separate product decision

- The request describes Free as estimator-only with no saved costing history. Current `lib/subscription-access.ts` explicitly grants Free `saved_costings` and `export_document`; `lib/free-service.ts` calls `complete_free_saved_costing`, added by `20260908205605_free_saved_costings_shared_estimator.sql`. `/free/costings` is implemented. Meanwhile `FREE_COUNTING_CONTRACT.contentPersistence` still says `page_memory_only`. This audit preserves existing behavior and does not resolve that conflict.
- The foundation migration seeds two costings per week, Monday midnight Asia/Kolkata, no carryover. Runtime allowance is authoritative from the current usage row or the selected DB rollout policy. No live allowance or rollout state was queried. Same-request retries retain their existing debit identity; paid continuation and server enforcement are unchanged.
- June documentation and architecture outputs describe scenario results rendered in the estimator; current code uses only the break-even member. `TESTING_GUIDE.md` says there is no test script; package.json now has one and runs it before builds. Previous audit metrics do not establish this revision's performance.

## Ranked backlog before implementation

| Priority/status | Journey → evidence → cause | Proposed change/expected benefit | Correctness risk / verification / rollback |
|---|---|---|---|
| 1 — code-inspected, measurement pending | Paid estimator input → `runScenarios` performs two additional full calculations (yarn/output stress cases), but `EstimatorClient` only reads its break-even result | Extract the existing break-even scenario unchanged and request only that member; remove unused scenario work on each edit | Preserve formula, guards, null behavior, precision and exact result. Differential fixtures and CPU benchmark; restore original import/memo and inline scenario block to roll back |
| 2 — code-inspected, bundle measurement pending | Base Production/Payroll → `BasePayrollRecords` eagerly imports `generate-base-payroll-pdf`, which imports jsPDF | Load the same generator inside the existing async export try/catch; reduce route's initial JS dependency set | First export cost/failure and selected-period identity. Verify emitted chunks, PDF behavioral tests and first/repeat-use measurement; restore static import to roll back |
| 3 — code-inspected only | Production/payroll history → complete paged loaders and worker-payable filters retain all required history | Profile realistic larger fixtures before changing scans; query plans require approved isolated DB | Monetary/period/reversal semantics; no schema or query changes in this pass |
| 4 — code-inspected only | Shared auth/data fetching/cache → existing request caches, query persistence and SW boundaries | Leave unchanged absent current request waterfalls or field evidence | Account isolation, freshness, offline recovery and Free persistence are high-risk boundaries |
| 5 — speculative until profiled | Tours, large client components, broad rendering, fonts and tables | No blanket memoization, virtualization, prewarming or caching | Need React profiler, browser timings and real workflow evidence first |

## Coverage and preserved boundaries

“Measured” below means the stated CPU or emitted-byte metric only; it never implies end-to-end browser verification. `bundle-before.json` and `bundle-after.json` enumerate every discovered page manifest.

| Application area | Coverage / decision | Evidence and boundary inspected |
|---|---|---|
| Paid estimator `/owner/estimator`, Quick/Detailed, live result | **Measured improvement** in synthetic computation; modified scenario selection | `EstimatorClient.tsx` reducer → validation → memoized `calcFullTotals` → `buildCostingResult`/readiness → rendering. Only scenario selection changes. Parsing, input dispatch, display/save gates, export model, rate updates and async secondary data are unchanged. 16 exact reference cases plus existing parity/truth tests. Full React render/paint cost **Not tested** |
| Free `/free`, account, billing, saved costings | **Code-inspected only**, page bytes measured, unchanged | `app/free`, Free service/policy/grant, owner redirect and API boundaries. Explicit calculation remains server-validated and debit-idempotent; Free still skips scenario execution. No browser or server content caching added. Product discrepancy above remains open |
| Saved qualities, Rate Book `/owner/rates`, saved costings/quotes `/owner/quotes` | **Code-inspected only**, page bytes measured, unchanged | Existing secondary estimator reads, summary template projection, archive/version selection, rate mutation revalidation. `saved-costings.ts`, estimator actions and `estimator-drafts.ts` keep record identity/history, 7-day scoped draft recovery, pending save payload and request UUID. No stale-rate or quota-prefetch changes |
| Costing/quotation exports | **Verified behavior preserved** within automated tests; UI **Not tested** | Existing lazy `CostingExportDialog`, export model and privacy tests; unchanged internal/customer separation and current validated result pair. No fonts, formatting or PDF rendering code modified |
| Base Production `/owner/production` and its payroll records | Page dependencies measured; PDF load boundary modified | Complete tenant-filtered history loader, job summary index, payroll readiness index, settlement history and actual PDF tests. Loader has 15 independent first-stage reads and stable paged ordering. No requests, row limits, rates, totals, settlements, reversals or advance recovery change |
| Full Suite payroll `/owner/payroll`, advances/fixed workers | **Code-inspected only**, page bytes measured, unchanged | Existing PDF lazy imports, org/period query keys, staleTime choices, realtime invalidation and mutation cancellation/rollback. Worker payable scans remain a follow-up; no monetary arithmetic optimized |
| Today/analytics dashboards | **Code-inspected only**, page bytes measured, unchanged | Existing server loaders, per-org production subscription, 2s refresh debounce, removeChannel/timer/listener cleanup. No current waterfall or profiler evidence sufficient for another change |
| Orders, market runs, stock, dispatch/receipt, commercials | **Code-inspected only** at route/read/mutation boundaries; page bytes measured; unchanged | Actual owner routes and server actions, commercial receipts and stock/dispatch identities. Live transaction, receipt variance, search/export completeness and operational timing **Not tested** |
| Supervisor production, attendance, machines, workers | **Code-inspected only**, page bytes measured, unchanged | Separate role layout, dashboard refresh timer cleanup and production entry paths. No account login, production submission or worker changes |
| Auth, onboarding, navigation, settings, plans/upgrades/billing | **Code-inspected only**, page bytes measured, existing tests run; unchanged | `proxy.ts`, authoritative `lib/auth.ts` profile/tenant lookups, request-scoped subscription cache, owner plan provider/guards, plan chooser, Razorpay APIs. No auth bypass, billing requests, plan or upgrade mutation |
| Localization/accessibility/responsive UI/tours | **Code-inspected only**, existing tests run; unchanged | English with on-demand Hindi/Gujarati resources, user-initiated tour requests, viewport locks, cleanup, existing accessible controls and reduced-motion classes. No blanket memoization or automatic tour preload. Real font/keyboard/mobile rendering **Not tested** |
| PWA/offline and account isolation | **Code-inspected only**, existing tests/build run; unchanged | `next.config.ts`, manifest, custom worker, update notice, query provider and auth cleanup: private no-store protected documents; network-only document/API/RSC; bounded static cache; explicit update activation; scoped query storage/drafts/IndexedDB cleanup. Offline mutations are currently rejected/discarded, not a general offline-write queue. Installed mode, mixed-version updates and offline first export **Not tested** |
| Database/indexes/infrastructure | **Blocked** for runtime profiling; schema text inspected, unchanged | No isolated database confirmed, so no EXPLAIN ANALYZE or live query. Migration history already has org/date, worker/date, job/date, settlement and version indexes. No blind index proposal or migration; actual plans/cardinality/storage/write cost and rollback review are prerequisites |
| Build/assets/observability | Production emitted bytes measured; build/test time recorded only, unchanged | Existing webpack/PWA/Sentry configuration, local fonts from Next build, static assets/video exclusions and content-free `web-vitals` endpoint. No field data retrieved, new telemetry, dependencies or services. Build duration is not a runtime improvement claim |

## Changes and correctness model

Exact modified production paths/symbols:

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`: `breakEvenScenario` memo and engine import.
- `lib/estimator.ts`: extracted `getBreakEvenScenario`; the existing `runScenarios` delegates only its break-even member.
- `app/(dashboard)/owner/production/BasePayrollRecords.tsx`: `exportPdf` import boundary.

Regression changes are `__tests__/estimator-scenario-selection.test.ts` (new) and one added assertion group in `__tests__/performance-bundle-boundaries.test.ts`. Reproduction tooling consists of the new `scripts/performance/{isolated-command,load-typescript,estimator-benchmark,application-bundle-report,payroll-pdf-benchmark}.mjs` files and `scripts/performance/estimator-fixture.ts`. The fixture and baseline JSON protect the numerical contract; remaining files are audit tooling only.

Batch 1: `lib/estimator.ts#getBreakEvenScenario` contains the exact original break-even block, with the same authoritative commercial-input and Decimal helpers, guard, object fields, operations and rounding. `runScenarios` still produces its full result set, delegating that block. `EstimatorClient` requests the single consumed scenario with the same state/totals/Free dependencies. No new calculator, cache, debounce, worker, async result or engine version is introduced. Both unused scenario recalculations and their row copies disappear from the live path. The original stress scenario API remains available.

Before editing production code, `estimator-reference.json` captured the complete totals/result/validation/readiness/scenario hashes and explicit scenario objects for 16 deterministic fixtures. The characterization test passed against the old path first. Those expected values are retained unchanged afterward. The benchmark also compares the complete original `runScenarios` output for four custom-target choices per fixture against the immutable starting revision. Numerical tolerances are not widened.

Batch 2: `BasePayrollRecords.tsx#exportPdf` imports the same PDF generator inside its existing try/catch after setting `exportingPdf`. The selected-period closure, reversed-worker filter, autoSave option, success/error messages, disabled button and finally reset remain intact. The new await does not initiate any server action. The generator itself is unchanged. This adds an asynchronous code-loading failure point; it is handled by the existing retryable error UI. First-use browser loading and automatic download still require verification.

The only added module reuse is standard JavaScript module loading for code. It contains no personalized result, entitlement, rate or payroll cache. Its identity is the build's hashed chunk URL, lifetime is the document/module runtime plus the existing bounded static/SW cache, and a new build supplies new URLs. Logout does not need to delete immutable code. No selected-period result is retained in a module. Existing PWA precaching may download the deferred chunk in the background: lower page-entry JS does **not** prove lower total transfer, offline storage or account-level cost.

Application-specific work budgets from this baseline: the live estimator's break-even selection must perform **zero additional full stress calculations**, remain synchronous, and match all frozen outputs; the Base payroll PDF must be absent from page-entry dependencies while the export retains its existing loading/error/selection behavior. Existing repository gzip budgets are reported, not relaxed. Browser latency budgets await browser data. Field targets remain mobile/desktop p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1; no field percentile is inferred from these lab samples and no TBT is labeled INP.

## Before/after evidence and reproduction

`environment.json` records the baseline revision, branch, host/runtime and SHA-256 of the changed production files, fixture, configuration and lockfile. Both builds use the same safe child environment, installed packages, webpack production mode and existing PWA settings. Existing local webpack/font caches are allowed; these are not five clean build-time trials. The build logs are verification, not evidence of faster builds.

### Estimator CPU — Measured improvement

Command: `node scripts/performance/estimator-benchmark.mjs`. This transpiles the actual current TS and the immutable revision's engine using the installed compiler and real Decimal.js. Compilation/fixture creation is outside timing. Each case performs 10 warmup batches then 30 alternating before/after pairs, each batch containing 20 changed inputs. Units below are milliseconds per input (batch time / 20), **not individual keystroke percentiles**. No React rendering, parsing of text fields, browser cache/network, account or database participates. Fixture error strings use English. The host is Node v24.11.1, macOS x64, Intel Core i9-9880H @ 2.30GHz; no CPU throttling.

| Rows per warp/weft | Path | Before median (min–max) ms | After median (min–max) ms |
|---:|---|---:|---:|
| 1 | Scenario selection | 0.557 (0.519–0.705) | 0.013 (0.011–0.034) |
| 5 | Scenario selection | 1.648 (1.513–2.023) | 0.012 (0.011–0.023) |
| 20 | Scenario selection | 5.771 (5.652–7.040) | 0.012 (0.011–0.017) |
| 1 | Validation + totals + result + readiness + scenario | 0.958 (0.911–1.041) | 0.439 (0.389–0.494) |
| 5 | Same computation path | 2.579 (2.494–2.875) | 0.962 (0.876–1.039) |
| 20 | Same computation path | 9.139 (8.706–10.264) | 3.106 (2.934–4.296) |

Table uses `estimator-comparison-2.json`, run after builds/lint/tests completed. `estimator-comparison-1.json` retains an independent paired run: full-path medians 2.215→0.972ms, 5.800→2.156ms and 19.477→6.590ms. Host timing varied substantially between runs; both reproduce reduced work, and neither proves field responsiveness. `estimator-baseline-idle.json` is the pre-edit run without concurrent repository build/test commands; the initial `estimator-baseline.json` overlapped baseline-build activity and is retained but not used for a latency comparison. No memory-growth or React profiler claim is made.

Exact reference reproduction: `node scripts/performance/estimator-benchmark.mjs --reference` should match `estimator-reference.json`; do not overwrite expectations to accommodate a change.

One deliberate update since: on 2026-10-27 the usual-range checks (`lib/input-plausibility.ts`) added a "higher than usual" warning to the already-blocked `invalidMargin` (99% margin) and `invalidCommission` (100% commission) fixtures. Their two `sha256` values were replaced only after confirming that removing those two warnings reproduces the original hashes exactly; totals, results, readiness and scenarios are unchanged, and the other 14 fixtures still match. The benchmark also checks all four custom-target choices for the complete stress scenario API. Existing calculation/parity/validation/save/export tests remain authoritative beyond these fixtures.

### Production bundles — Measured resource reduction

Command: `node scripts/performance/application-bundle-report.mjs > <report.json>` after each production build. The reporter enumerates **64 page manifests**, selects each webpack page entry's deduplicated JS dependency chunks and measures exact raw/gzip bytes. Separate layout-only chunks and async imports are excluded. It is not an HTTP transfer waterfall or total application storage measurement. Neither route dataset, browser nor account state affects this build metric. No route's measured dependency total increased.

| Route | Before gzip bytes | After gzip bytes | Delta |
|---|---:|---:|---:|
| `/owner/production` | 352,167 | 218,709 | −133,458 |
| `/owner/estimator` | 510,532 | 510,080 | −452 |
| `/free` | 562,184 | 561,732 | −452 |
| `/owner/quotes` | 231,053 | 230,621 | −432 |
| `/owner/rates` | 177,063 | 177,063 | 0 |
| `/owner/settings` | 211,758 | 211,758 | 0 |
| `/owner/billing` | 118,771 | 118,771 | 0 |

Base Production raw page dependencies fell from 1,172,928 to 752,777 bytes. The jsPDF marker is present in a baseline dependency chunk and absent from the final page dependency set; the generator remains emitted as an async chunk. Small estimator/quotes/Free reductions come from eliminating the unused scenario dependency from their shared engine import. Existing budget reporter output is retained in `existing-budgets-after.json`: estimator, quotes and settings remain above their previously configured budgets. No thresholds were raised. Other route results and exact chunk paths are in the two full JSON reports.

### PDF first/repeat use — Measured CPU proxy, browser interaction Not tested

Command: `node scripts/performance/isolated-command.mjs node scripts/performance/payroll-pdf-benchmark.mjs`. Five fresh Node processes per synthetic worker count; each dynamically imports the unchanged generator and generates a PDF, then repeats once with the module warm. TypeScript compilation is outside the child measurements, `autoSave` is false, and the script checks PDF signature and filename. There is no customer data, network or file-download side effect. Node uses jsPDF's Node entry point, so these numbers do not establish browser first-click timing or automatic-download behavior.

| Synthetic workers | First import + generate median (min–max) ms | Repeat generate median (min–max) ms |
|---:|---:|---:|
| 1 | 158.36 (155.85–203.96) | 13.03 (11.87–13.45) |
| 20 | 263.63 (260.45–278.39) | 79.84 (77.81–85.97) |
| 100 | 554.04 (551.67–555.78) | 380.32 (366.28–384.35) |

Raw import/generation times, document bytes/pages and samples are in `payroll-pdf-first-repeat.json`. This quantifies the first-use tradeoff without labeling it a UI speedup. The existing “Preparing PDF…” state remains; its paint, download reliability, slow-network failure and retry behavior need the browser checks below. The generator's rendering cost is unchanged.

## Verification ledger

| Check/command | Actual result |
|---|---|
| Baseline `node scripts/performance/isolated-command.mjs npm run build` | **PASS**: 244 files, 1,681 tests passed, 1 live test skipped; compile, TypeScript and static generation passed |
| Before-edit scenario characterization | **PASS**: 16 tests against the old call path; `estimator-characterization.log` |
| Batch 1 focused Vitest run | **PASS**: 7 files / 79 tests; estimator math, exact output, Quick/Detailed parity, costing truth/save, Free estimator, export privacy; `batch1-tests.log` |
| Batch 2 focused Vitest run | **PASS**: 3 files / 26 tests; 19 actual PDF tests, 4 payroll-history tests, 3 source-boundary checks; `batch2-tests.log` |
| Final `node scripts/performance/isolated-command.mjs npm run build` | **PASS**: 245 files, 1,698 tests passed, 1 existing live test skipped; webpack compile, TypeScript and static generation passed; `final-build.log` |
| Baseline and final `node scripts/performance/isolated-command.mjs npm run lint` | **FAIL, pre-existing**: identical 2 errors / 48 warnings: existing-memoization preservation in `components/estimator/FreeUsageCard.tsx:50` and state-in-effect in `hooks/use-gutter-dock.ts:120`. Both logs are identical after removing the Babel informational line. No findings introduced |
| Targeted lint with `--max-warnings=0` | **FAIL, pre-existing**: only `EstimatorClient.tsx:1040` unused `accent` warning. New helpers, tests, scripts and other modified source add no diagnostics |
| `git diff --check` and focused diff review | **PASS**; no unrelated production edits, dependency/config/schema changes or test weakening |
| Two paired CPU comparisons and frozen reference outputs | **PASS**; timings above; complete scenario outputs compared against immutable baseline |
| PDF first/repeat CPU proxy | **PASS** for all 15 fresh-process runs (two generations each); not browser export coverage |

The first isolation-runner attempt used a hyphenated fake project ID that did not match the test suite's mocked auth-cookie regular expression. Eight proxy tests failed before any production edit. Changing only the fake identifier to alphanumeric fixed the runner; the complete baseline then passed. `initial-runner-invalid-project-id.log` preserves this setup failure. No assertion, auth implementation or production environment setting was changed to make those tests pass.

Retained command logs have only trailing whitespace, carriage returns and extra final blank lines normalized for Git; their diagnostic content and recorded results are unchanged.

### Actual browser execution and limits

A new Codex in-app Browser tab opened the public canonical production landing page, followed its **Install Weavly** link to `/install`, then successfully navigated Back to the landing page and Forward to `/install`. The installation guide visibly rendered; its captured tool screenshot was 1280×720. No warning/error console entries were returned by the bounded tab log read. No account login, form submission, installation, billing or data mutation was performed. These checks exercise the current deployed public build, whose revision was not verified; they do not validate this local patch.

Browser version, device/CPU/network emulation and underlying cache state were not controlled. The read-only timing inspection failed because this browser API's evaluation scope returned `navigator` as undefined; no navigation/performance metrics were obtained. No timing value was inferred from tool wall time. Therefore LCP/CLS/TTFB/transferred bytes/INP, five comparable navigation runs, first/repeat authenticated journeys and mobile/desktop field p75 remain **Not tested**. The public navigation smoke test is not PWA installation testing or a comprehensive accessibility audit.

Authenticated/local QA was **Blocked** during the audit under the installed [weavly-browser-login skill](/Users/rajpatel/.codex/skills/weavly-browser-login/SKILL.md), which says “Do not use this helper to validate uncommitted, unpushed, unmerged, or undeployed implementation work” and restricts application QA to canonical production. The initial request excluded deployment. An optional request for an isolated localhost synthetic browser fixture was made; absent an answer, no exception was assumed. This restriction did not block the completed source, test, build and pure-fixture work. Subsequent release authorization does not turn these unexecuted checks into passed checks.

## Remaining checks and ranked opportunities

1. **Browser release checks, Not tested:** in an approved isolated environment, use synthetic Lite/Base accounts and the reference input. Record browser/version, viewport (desktop and mobile), CPU/network settings, locale, data size, cache/SW state, and five comparable cold/warm runs. Type rapidly, switch Quick/Detailed, change yarn rates, clear required values and enter zero/invalid values. Expect immediate input retention, identical current totals, invalid-current-result gating, and save/export bound to the latest validated pair. Check English/Hindi/Gujarati, keyboard/focus and reduced motion.
2. **PDF first-use/failure release check, Not tested:** on Base Production → payroll records, verify the PDF chunk is not evaluated before export. Export the same synthetic period first and again, then search/filter the visible list and export: the full selected period must still be exported, reversed records excluded, filename/totals unchanged. Test fast repeated clicks and period switching while the chunk is pending. Block/delay the chunk request: expect Preparing PDF, then the existing error message and a re-enabled button; restore network and retry successfully. Measure click-to-download and UI responsiveness before accepting the loading tradeoff. Actual download behavior remains a material gap.
3. **Account, mutation and PWA release checks, Not tested:** save/reopen, draft recovery, rate freshness/historical immutability, logout/login and account switch, Free quota retry/upgrade/downgrade, direct route/API checks. Test refresh/back/forward, repeat installed launch, interrupted requests, offline behavior and old-client/new-worker update while a draft exists. Keep existing activation/storage rules; do not clear storage to manufacture a clean result.
4. **Estimator rendering/bundles, code-inspected opportunity:** current emitted dependencies still exceed existing budgets, especially `/free` and `/owner/estimator`. Obtain React profiler and browser waterfalls before splitting tours/forms or changing state placement. Measure first-use tour/modal latency and respect manual initiation. No blanket memoization or new caching is proposed.
5. **Payroll/history and database, code-inspected opportunity:** repeated per-worker history/settlement scans in `calculateBaseWorkerPayables` merit separate synthetic profiling and exact historical/reversal/salary characterization. Complete-history loads and dispatch/commercial queries need approved isolated query latency/cardinality/plans before RPC/index/pagination proposals. Existing indexes already cover several org/worker/job/date shapes. Any future index proposal must quantify reads versus write/storage cost, concurrent deployment risk and a DROP INDEX rollback; none is approved or applied here.
6. **Product contract, separate decision:** resolve Free saved history/export versus the requested restriction and stale policy documentation. Do not mix that decision into a performance release.

## Rollback and release status

- Batch 1: restore the `runScenarios` import and original two memo expressions in `EstimatorClient`, inline the break-even block back into `runScenarios`, and remove `getBreakEvenScenario`. The frozen reference fixtures remain useful; adjust only the test's selected call if reverting, not expected values. No schema/data/cache/version rollback is needed.
- Batch 2: restore `import { generateBasePayrollPdf } from '@/lib/generate-base-payroll-pdf'` and remove the identical import inside `exportPdf`; remove the corresponding added bundle-boundary assertion if reverting that behavior. No generator/data change is involved.
- Audit-only files are the new estimator regression test, benchmark/report/isolation scripts and this evidence directory. They do not become production entry points. Existing tests are preserved apart from the added boundary assertion.
- At the initial audit handoff, work was uncommitted and no pushes, deployments or live changes had occurred. The user subsequently instructed **“Push commit merge”**. Before release, a fresh fetch confirmed `origin/main` still at the audited baseline; Vercel metadata confirmed that `main` is the production branch. The authorized release uses the Git pull-request workflow and normal Vercel build. Its final commit, PR and deployment status are reported separately; outstanding browser checks remain **Not tested**.
- `.next` contains the isolated benchmark build with placeholder backend values. It must not be uploaded or deployed as a prebuilt live artifact. No environment, schema, billing, infrastructure or production-data changes are part of this release.

Framework reference checks: [Next.js lazy loading](https://nextjs.org/docs/app/guides/lazy-loading) and [webpack 5 dynamic imports](https://webpack.js.org/guides/code-splitting/#dynamic-imports), reconciled with the installed Next.js 16.2.12 webpack build and emitted manifests. [Supabase changelog](https://supabase.com/changelog) was consulted during stack review; no Supabase API, configuration, security policy or database behavior was changed.
