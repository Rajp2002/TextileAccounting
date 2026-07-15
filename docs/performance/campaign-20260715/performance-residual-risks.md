# Performance residual risks

## Remaining slow or unverified workflows

### Authenticated journeys

The configured isolated QA owner sign-in did not leave `/login` on either the existing development server or the production-local server. This blocks current end-to-end traces for session restoration, Factory Today, estimator interaction, orders, quotations, payroll, stock, supervisor routes, mutations, and exports.

Recommended next action: diagnose the QA auth/account path separately without overwriting the pre-existing auth work, then repeat cold/warm traces using representative owner and supervisor organizations.

Evidence required for closure: successful isolated owner and supervisor sessions, network traces, console logs, route timings, and permission/tenant smoke checks.

### Factory Today and payroll data paths

Existing evidence still shows many Supabase reads in these high-value routes. Current production-scale query plans and p95 samples were unavailable, so no index, RPC, or caching change was made.

Recommended next action: enable `WEAVLY_PERF_LOGS` in QA, capture at least 20 representative samples, map each read to a query shape, run safe `EXPLAIN (ANALYZE, BUFFERS)` against QA-scale data, and reconcile payroll outputs before and after any database change.

### Deferred language payload

The initial English path is much smaller, but the first Hindi or Gujarati selection still downloads shared legacy dictionaries containing both target languages. Splitting generated and legacy resources by language could reduce that secondary payload, but it requires a large mechanical data-file split and broader localization regression coverage.

### Payroll export click

The first export now pays an on-demand module download. This is the intended tradeoff for removing jsPDF from every payroll visit, but the click should be timed under slow network conditions. If the delay is visible, prefetch the module on intentional hover/focus or when a settled-worker panel becomes visible, while retaining failure feedback.

### Remaining route bundles

`/supervisor/dashboard` still emits 989,888 raw / 312,583 gzip initial JavaScript, including a 203,639-byte shared chunk. `/owner/estimator` remains 836,380 raw / 262,709 gzip. Runtime profiling is needed to identify whether splitting those dependencies improves time-to-interaction without creating waterfalls.

### Cold request behavior

The first production-local `/login` request was 813 ms TTFB versus 42–89 ms after warm-up. This is not enough to distinguish Next.js initialization, hosting cold start, middleware, or external auth/service latency.

## Deliberately deferred high-risk work

- Authentication deduplication: pre-existing uncommitted auth work overlaps this surface; changing it without a clean baseline risks revocation and authorization behavior.
- Tenant/reference caching: no tenant data was cached because a correct tenant-key and invalidation proof was not available.
- Database indexes/RPCs: no current plans or QA-scale proof; blind indexes would add write/storage cost.
- Optimistic payroll, stock, quotation, or order updates: financial and operational correctness outweighs cosmetic latency.
- Partial estimator recomputation: blocked pending before/after mathematical output reconciliation and interaction profiling.

## Environment limitations

- No representative mobile CPU/network throttling in the available authenticated harness.
- No production-scale QA data or current Supabase query-plan access.
- No stable p95 from sufficient repeated samples.
- Production was limited to no contact; all tests were local and non-destructive.
- Existing unrelated dirty files prevented rebasing onto the latest remote branch without risking user work.

## Post-pilot monitoring recommendations

- Collect route TTFB and time-to-required-data by route, role, and deployment region without logging PII or financial bodies.
- Record Web Vitals for login, Factory Today, estimator, payroll, stock, orders, and supervisor production.
- Add sampled server timing around auth resolution, organization resolution, route read models, and export generation.
- Alert on duplicate read storms, mutation retries, export failures, and p95 regressions above 5%.
- Keep cache metrics tenant-aware; never emit tokens, row bodies, worker PII, or full financial records.
