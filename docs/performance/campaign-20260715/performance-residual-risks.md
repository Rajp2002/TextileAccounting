# Performance residual risks

## Remaining slow or insufficiently measured workflows

### Cold quotations and dispatches

The first observed production-local quotation and dispatch route commits were 2,380 ms and 2,007 ms. Warm samples were 365–502 ms and 406–426 ms respectively, and both routes streamed their correct final content.

User impact: a cold visit may feel materially slower than other owner routes.

Recommended next action: collect at least 20 cold/warm QA samples with request waterfalls and server timing, separate code-chunk fetch from Supabase reads, then optimize the confirmed component. Evidence required: repeatable p50/p95, request count/bytes, and unchanged quotation/dispatch reconciliation.

### Factory Today and payroll data paths

Current 20-sample local distributions are acceptable (Factory Today p50/p95 437/554 ms; payroll 405/615 ms), but historical evidence shows meaningful Supabase read fan-out. Production-scale query plans were unavailable, so no index, RPC, or caching change was made.

Recommended next action: enable sampled `WEAVLY_PERF_LOGS` in QA, capture at least 20 representative samples, map reads to query shapes, and run safe plan analysis only for confirmed slow queries. Payroll results must be financially reconciled before and after any database change.

### Payroll export click

The QA cycle contained no paid settlement, so the PDF Slip action was unavailable. Marking payroll paid solely to enable a performance test would create a financial mutation and was intentionally rejected.

Recommended next action: use a disposable, explicitly approved paid-settlement fixture or a pure browser test fixture. Measure first-click module load, generation, and download under slow network conditions. If delay is visible, consider hover/focus prefetch while retaining the current failure feedback.

### Deferred language payload

The initial English path is much smaller, but first Hindi or Gujarati selection still downloads shared legacy dictionaries. Splitting generated and legacy resources by language could reduce that secondary payload, but requires a large data-file split and broader localization regression coverage.

### Remaining route bundles

`/supervisor/dashboard` still emits 993,072 raw / 313,751 gzip initial JavaScript; `/owner/estimator` emits 837,223 raw / 263,119 gzip. Runtime profiling is needed before splitting remaining shared dependencies because extra boundaries can create new waterfalls.

### Statistical and production observability gap

Twenty-sample local p95s now cover auth, Factory Today, estimator, payroll, and the four supervisor routes. Localhost still excludes deployed cold starts, regional Supabase latency, production-scale data, and user hardware. Core Web Vitals, network request counts, and main-thread long tasks remain unmeasured in a representative deployed environment.

### Legacy stored-function lint findings

The linked schema lint still reports six pre-existing stored-function errors in `lockdown_tenant`, `link_batch_to_machine`, `get_daily_brief_stats`, `replace_shift_production_logs`, `settle_worker_payroll`, and `get_yield_alert`. They predate this campaign and require the already-documented isolated formal audit because payroll, production, and tenant behavior can be affected. This release did not suppress or casually rewrite them.

## Deliberately deferred high-risk work

- Tenant/reference caching: no tenant data was cached without a proven tenant key and invalidation design.
- Database indexes/RPCs: no confirmed slow plan; blind indexes would add write and storage cost.
- Optimistic payroll, stock, quotation, or order updates: financial and operational correctness outweigh cosmetic latency.
- Partial estimator recomputation: no observed blocking calculation and no before/after mathematical reconciliation fixture justified the risk.
- Auth/session shortcuts: authoritative server checks and RLS were retained.

## Environment limitations

- No representative CPU/network throttling in the browser harness.
- No production-scale QA data or current SQL-plan access for slow shapes.
- No deployed production p95 or production Core Web Vitals; smaller secondary-route samples remain directional.
- Production was contacted only for approved migration metadata/view hardening, authenticated read-only smoke, and tenant-negative reads; no production business mutation was performed.
- The original worktree contained unrelated user changes. A clean linked worktree based on current upstream was used so those files remained untouched.

## Post-pilot monitoring recommendations

- Collect route TTFB and time-to-required-data by route, role, and deployment region without logging PII or financial bodies.
- Record LCP, INP, CLS, and long tasks for login, Factory Today, estimator, payroll, stock, orders, quotations, dispatches, and supervisor routes.
- Add sampled server timing around auth resolution, organization resolution, route read models, and export generation.
- Alert on duplicate read storms, mutation retries, export failures, and p95 regressions above 5%.
- Keep cache and telemetry dimensions tenant-safe; never emit tokens, row bodies, worker PII, or full financial records.
