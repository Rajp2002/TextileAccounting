# Weavly performance campaign final summary

## Campaign status

**Partially complete.** The highest-confidence application-controlled bundle bottlenecks were fixed and verified on the current upstream code, and authenticated owner/supervisor desktop and mobile workflows now have production-build runtime evidence, including 20-sample local p50/p95 distributions for critical routes. Deployed production p95, Core Web Vitals, request waterfalls, SQL plans, and a non-mutating payroll-export fixture remain outside the available environment.

- Branch: `codex/performance-campaign-20260715-upstream`
- Code commit: `ae65791` (`perf: defer language and payroll export bundles`)
- Evidence commits: `f4b00da` and the final documentation commit
- Upstream auth commits included: `17d9ab5`, `c88db01`
- Pushed: no
- Environment: clean local production build/server, protected isolated owner/supervisor QA accounts, desktop and 390×844 browser viewports
- Production impact: none; no deployment, production request, data mutation, or migration

## Baseline and findings

- Five routes received identical before/after emitted-bundle measurements.
- Seventeen authenticated/public runtime scenarios were exercised, including login/logout, six owner core routes, four supervisor routes, role boundary, mobile readiness, localization, and anonymous redirect behavior.
- Ten additional owner routes received authenticated read-only smoke/timing coverage.
- Findings: 0 P0, 4 P1, 4 P2, and 1 P3.
- Main bottleneck categories: globally eager language data, eagerly loaded export tooling, cold route/data initialization, historical Supabase read fan-out, and missing deployed observability.

## Implemented optimizations

### PERF-001 — global language resources

- Root cause: static imports shipped all translations to every session.
- Fix: concurrent on-demand language loading with a two-key bounded module cache and safe English fallback.
- Before: 150.3–150.5 KB avoidable gzip in every measured initial route graph.
- After: absent from the English initial graph; loaded only when Hindi or Gujarati is selected.
- Improvement: 32.4%–43.1% initial gzip reduction depending on route.
- Functional verification: live English/Hindi/Gujarati switching and return to English; tests, types, lint, and production build.
- Commit: `ae65791`.

### PERF-002 — payroll PDF engine

- Root cause: static payslip generator import loaded jsPDF on every payroll visit.
- Fix: type-only initial import and on-demand generator import at PDF click.
- Before: 2,026,912 raw / 604,925 gzip bytes; 34 initial JS requests.
- After: 1,049,114 raw / 324,625 gzip bytes; 32 requests.
- Improvement: 48.2% raw, 46.3% gzip, and two initial requests.
- Functional verification: payroll calculation/generator code unchanged; focused tests, types, build, and emitted deferred chunk passed. Runtime click was safely deferred because QA had no paid settlement.
- Commit: `ae65791`.

## Aggregate results

- Median per-route initial gzip reduction: **40.1%**.
- Five-scenario aggregate: 3,260,047 raw and 881,942 gzip bytes removed from summed route graphs.
- Largest route result: payroll, 280,300 gzip bytes and two initial JavaScript requests removed.
- Owner login: p50 728 ms; p95 932 ms; maximum 1,163 ms over 20 samples.
- Factory Today: p50 437 ms; p95 554 ms over 20 samples.
- Estimator: p50 397 ms; p95 499 ms over 20 samples.
- Payroll: p50 405 ms; p95 615 ms; maximum 1,183 ms over 20 samples.
- Owner route transitions: median 56 ms; maximum 240 ms across six sections.
- Supervisor dashboard: p50 379 ms; p95 853 ms; 3,393 ms first post-restart cold outlier over 20 samples.
- Mobile supervisor: 382 ms route commit and 1,216 ms to ready data at 390×844.
- Database-query improvement: none claimed; campaign code changed no queries or schema.
- Core Web Vitals: unavailable in the local harness.
- Regressions: none in automated, build, localization, authenticated route, role-boundary, or mobile evidence.

## Verification

- Production build: passed; 42 static pages generated.
- Type check: passed through Next.js build.
- Lint: passed in the final clean worktree.
- Tests: 97 test files, 687 tests, no skips in the clean production build gate.
- Browser/runtime: owner and supervisor auth, gated routes, logout, role redirect, localization, streaming readiness, and read-only route sweeps passed.
- Database: no migration/query change; no plan was claimed without a confirmed slow query.
- Mobile: supervisor route and ready-data state passed at 390×844; representative CPU/network throttling unavailable.
- Financial safety: no payroll, stock, quotation, order, or production mutation was performed.

## Remaining issues

1. Cold quotations and dispatches: first observed commits were 2.38 s and 2.01 s, versus 0.36–0.50 s warm. Impact: noticeable first-visit delay. Next action: 20-sample cold/warm server/network trace. Closure evidence: p50/p95 plus request/query attribution and reconciliation.
2. Production-scale server/database behavior: historical read fan-out remains, though local Factory Today/payroll p95s were 554/615 ms. Impact: latency may rise with real region/data scale. Next action: sampled deployed server timing and safe plans for confirmed slow shapes. Closure evidence: production-scale samples, plans, and tenant/financial regression checks.
3. Payroll PDF first-click latency: no paid QA settlement existed. Impact: deferred chunk delay is unmeasured. Next action: disposable paid-settlement fixture. Closure evidence: first/warm download timings and identical document values.
4. Deployed mobile/Core Web Vitals: CPU/network throttling and production RUM were unavailable. Impact: low-powered-device long tasks may remain hidden. Next action: deployed mobile traces and privacy-safe RUM. Closure evidence: LCP, INP, CLS, requests, and long tasks.

## Pilot recommendation

**Performance-ready with documented limitations.** The application-controlled initial bundles improved materially, all sampled core authenticated routes rendered correctly, common route transitions were effectively immediate, the role boundary remained authoritative, and the production build/test gate passed. Pilot monitoring should specifically watch cold quotations/dispatches, deployed p95/Core Web Vitals, Supabase regional latency, and first payroll export. These limitations do not justify weakening tenant, financial, or authorization guarantees.
