# Weavly performance campaign final summary

## Campaign status

**Partially complete.** Two high-confidence, measured initial-bundle bottlenecks were fixed and verified. Authenticated end-to-end and mobile/production-scale database evidence remains blocked by the local QA login flow.

- Branch: `codex/performance-campaign-20260715`
- Code commit: `3bc65d4` (`perf: defer language and payroll export bundles`)
- Documentation commit: this artifact commit
- Pushed: no
- Environment: local production build/server and Codex in-app browser; protected isolated QA credentials for attempted sign-in
- Production impact: none; no deploy, production request, data mutation, or migration occurred

## Baseline and findings

- Five routes received identical before/after emitted-bundle measurements.
- Two anonymous production-local runtime paths were sampled after the change.
- Existing authenticated baselines for Factory Today, payroll, advances, and dispatches were reviewed.
- Findings: 0 P0, 4 P1, 3 P2, and 1 P3.
- Main bottleneck categories: global data bundled into every route, export tooling loaded before use, Supabase read fan-out, cold initialization, and missing authenticated performance evidence.

## Implemented optimizations

### PERF-001 — global language resources

- Root cause: static imports shipped all translations to all users.
- Fix: concurrent, on-demand language resource loading with a two-key bounded cache and safe English fallback.
- Before: route-dependent initial gzip 347,831–604,319 bytes, including the global dictionaries.
- After: 150.6 KB gzip removed from every measured route.
- Improvement: 32.5%–43.3% gzip depending on route.
- Functional verification: live English/Hindi/Gujarati switching and return to English; targeted tests, lint, type check, full suite, and build.
- Commit: `3bc65d4`.

### PERF-002 — payroll PDF engine

- Root cause: static payslip generator import loaded jsPDF on every payroll visit.
- Fix: type-only initial import and on-demand generator import at PDF click.
- Before: 2,023,626 raw / 604,319 gzip bytes; 34 initial JS requests.
- After: 1,046,208 raw / 323,496 gzip bytes; 32 requests.
- Improvement: 48.3% raw and 46.5% gzip.
- Functional verification: payroll calculation/generator code unchanged; focused payroll tests, type check, build, and emitted chunk verification passed. Authenticated click remains blocked.
- Commit: `3bc65d4`.

## Aggregate results

- Median initial gzip reduction across five routes: 40.2%.
- Largest route result: payroll, 280,823 gzip bytes and two initial JavaScript requests removed.
- Common route result: approximately 150.6 KB gzip removed from every measured route.
- Database-query improvement: none claimed; no database behavior changed.
- Core Web Vitals / p95: not claimed because authenticated representative traces were unavailable.
- Regressions: none in available automated, build, public runtime, or language-switch evidence.

## Verification

- Production build: passed.
- Type check: passed through `tsc --noEmit` and Next.js build.
- Focused lint: passed; full lint result recorded after final verification.
- Tests: full prebuild suite passed (95 files; 676 passed, one skipped).
- Browser/runtime: public login render and English/Hindi/Gujarati switching passed; anonymous protected-route redirect passed.
- Database: no migration/query change; query-plan testing not applicable to completed fixes.
- Mobile: blocked by authenticated QA and representative device/throttling limitations.

## Remaining issues

1. QA sign-in does not complete. User impact: no trustworthy current gated-route or role/tenant browser evidence. Next action: repair/diagnose the isolated QA auth path, then rerun owner and supervisor traces. Closure evidence: successful sessions plus route/network/permission captures.
2. Factory Today and payroll retain material server read fan-out in historical evidence. User impact: first usable data can remain sensitive to Supabase latency. Next action: collect current QA p50/p95 and query plans before changing SQL. Closure evidence: repeated timings, plans, reconciliation, and tenant tests.
3. Low-powered mobile behavior is unmeasured. User impact: hydration/main-thread regressions may remain hidden. Next action: cold/warm mobile CPU/network traces after auth is restored. Closure evidence: LCP, INP, CLS, long tasks, requests, and route timings.
4. Hindi/Gujarati first selection still has a sizable deferred legacy payload. User impact: first language switch may pause on a slow link. Next action: split translation data by language only after localization regression coverage exists.

## Pilot recommendation

**Not performance-ready for pilot based on current evidence.** The measured bundle reductions are large and safe, but pilot readiness requires successful authenticated owner/supervisor journeys, representative mobile traces, and current server/database timing for Factory Today and payroll. The absence of that evidence is a verification gap, not proof of failure; it must be closed before a performance-ready claim.
