# Weavly performance baseline — 2026-07-15

## Test environment

- Final branch: `codex/performance-campaign-20260715-upstream`
- Upstream baseline: `c88db01`; the before build was captured from tree-identical commit `68ac45f`
- Optimization commits: `ae65791` (code) and `f4b00da` plus the final evidence commit (documentation)
- Framework: Next.js 16.2.10 App Router with webpack; React 19.2.7
- Data platform: Supabase SSR 0.8.0 / supabase-js 2.95.3; PostgreSQL RLS scoped by `org_id`
- Runtime: Node 24.11.1, npm 11.6.2, macOS 26.5.1 x86_64
- Browser: Codex in-app browser against a local `next start` production build on port 3200
- Authentication: protected isolated owner and supervisor QA accounts
- Network: localhost, unthrottled. Emitted gzip chunk size is used as a deterministic transfer proxy.
- Mobile viewport: 390×844. Representative CPU and network throttling were unavailable.
- Production: not contacted or modified

The before and after production builds used the same route-manifest parser, chunk deduplication, gzip method, and build command. Authenticated timing samples use URL commit for navigation; streamed data readiness is called out separately where measured.

## Architecture and bottleneck map

- Next.js App Router provides dynamic server-rendered authenticated routes and client islands. Dashboard layouts preserve the application shell across child navigation.
- Server loaders and server actions use Supabase server clients; browser queries and mutations use the browser client. Authorization and tenant scoping remain server/RLS authoritative.
- TanStack Query is mounted globally with persisted offline support. Existing cache identity includes authenticated-user scope.
- Authentication is enforced in `proxy.ts`, route loaders, and server actions. The final branch includes the upstream auth work in `17d9ab5` and `c88db01`; the campaign did not weaken or bypass those checks.
- The global provider statically imported English, Hindi, Gujarati, legacy, and generated legacy dictionaries. This placed about 570 KB raw / 150 KB gzip avoidable JavaScript on every measured route.
- Payroll statically imported `jsPDF` through the payslip generator, placing the PDF engine in the initial payroll graph.
- Existing route evidence shows Supabase read fan-out remains important: Factory Today historically made 25 reads before earlier work reduced the blocking path to 11 reads with checklist data deferred; payroll historically made 24 ledger reads before its server read model was consolidated.
- Sentry, PWA/service-worker support, persisted query state, framer-motion, charts, export tooling, and route-specific document generation remain material bundle/runtime surfaces.
- Lightweight timing support exists in `lib/perf.ts` behind `WEAVLY_PERF_LOGS`.

## Critical journey inventory and priority

| Journey | Route / feature | Final evidence | Priority |
| --- | --- | --- | --- |
| Initial public load | `/login` | Emitted bundle before/after; production-local runtime | P1 |
| Login and session establishment | `/login` | Five owner cycles; one supervisor cycle; direct auth phase sample | P1 |
| First authenticated route / Factory Today | `/owner/today` | Five hard navigations and authenticated content verification | P1 |
| Major-section navigation | owner layout | Six URL-commit transitions | P1 |
| Estimator open | `/owner/estimator` | Three hard navigations; saved estimate opened read-only | P1 |
| Payroll | `/owner/payroll` | Three hard navigations; financial values left unchanged | P1 |
| Quotations and orders | `/owner/quotes`, `/owner/orders` | Cold/warm quotation samples; three order samples | P2 |
| Stock and inventory | `/owner/stock` | Three desktop samples; mobile content verification | P2 |
| Supervisor workflows | dashboard/workers/attendance/machines | Three hard samples per route; mobile dashboard | P2 |
| Role boundary | supervisor → owner route | Server-authoritative redirect verified | P1 |
| Analytics, settings, and administration | owner routes | Authenticated read-only route sweeps | P2 |
| Documents and exports | payroll PDF | Initial graph measured; runtime click safely blocked by no paid QA settlement | P2 |

## Authoritative emitted-bundle baseline

Initial client JavaScript is the unique set of `.js` chunks referenced by each route's production client-reference manifest.

| Route | Initial JS requests | Raw bytes | Gzip bytes | Largest avoidable contributor |
| --- | ---: | ---: | ---: | --- |
| `/login` | 22 | 1,173,014 | 349,344 | Global language dictionaries |
| `/owner/today` | 27 | 1,269,682 | 375,185 | Global language dictionaries |
| `/owner/estimator` | 30 | 1,407,777 | 413,526 | Global language dictionaries |
| `/owner/payroll` | 34 | 2,026,912 | 604,925 | Language dictionaries and jsPDF |
| `/supervisor/dashboard` | 30 | 1,563,639 | 464,094 | Global language dictionaries |

## Final authenticated runtime baseline

These are application-local production-build samples, not internet or production-region measurements. With only three to five repeats, “p95” below is the nearest-rank observed maximum, not a stable production percentile.

| Workflow | Samples (ms) | p50 (ms) | Observed max / p95 (ms) |
| --- | --- | ---: | ---: |
| Owner login | 1163, 684, 791, 644, 682 | 684 | 1163 |
| Owner logout | 949, 498, 441, 392, 464 | 464 | 949 |
| Factory Today | 517, 613, 349, 536, 437 | 517 | 613 |
| Estimator | 418, 351, 470 | 418 | 470 |
| Payroll | 300, 450, 413 | 413 | 450 |
| Orders | 378, 310, 377 | 377 | 378 |
| Stock | 426, 441, 386 | 426 | 441 |
| Analytics | 679, 441, 415 | 441 | 679 |
| Supervisor dashboard | 459, 330, 353 | 353 | 459 |
| Supervisor workers | 294, 279, 286 | 286 | 294 |
| Supervisor attendance | 281, 321, 299 | 299 | 321 |
| Supervisor machines | 288, 319, 234 | 288 | 319 |

Owner client-side URL-commit transitions were 65 ms (Today), 47 ms (Estimator), 240 ms (Payroll), 44 ms (Orders), 66 ms (Stock), and 45 ms (Analytics): median 56 ms, maximum 240 ms.

A direct QA auth decomposition sample measured password authentication 540.5 ms, authoritative `getUser` 36.1 ms, profile lookup 286.5 ms, subscription-tier lookup 114.3 ms, and organization lookup 69.6 ms. This is diagnostic evidence only; phases have dependencies and must not be summed as an alternative end-to-end number.

At 390×844, the integrated supervisor dashboard committed in 382 ms and reached ready shift data in 1,216 ms. A supervisor request for `/owner/today` redirected to `/supervisor/dashboard` in 548 ms with no owner content exposed.

## Additional read-only route sweep

First observed production-local route commits were: quotations 2,380 ms, dispatches 2,007 ms, party ledger 407 ms, settings 369 ms, Upaad 497 ms, workers 518 ms, looms 464 ms, market runs 343 ms, billing 391 ms, and archive 642 ms. Quotations then measured 502/418/365 ms; dispatches measured 406/426/416 ms. Both cold routes rendered their final data after streaming completed.

## Historical server evidence retained for comparison

- Factory Today: 25 Supabase reads and 2,309.7 ms before earlier route work; later architecture recorded 11 first-render reads with 13 checklist reads deferred.
- Payroll: 24 historical ledger reads; later server read model planned at 11 reads. A prior warm QA sample recorded 756.9 ms business time, with schema-fallback limitations.
- Advances: three parallel reads and approximately 455 ms historical business time.
- Dispatches: five-to-four-read historical change and 1,295.3 ms to 551.6 ms.

These historical numbers were produced by earlier campaigns and are not attributed to the two code changes in this campaign.

## Measurement limitations

- Localhost timing excludes internet latency, Supabase region distance, deployed cold starts, production-scale row counts, and lower-powered CPU scheduling.
- The browser harness did not expose reliable request-count waterfalls, Core Web Vitals, CPU throttling, or network throttling for authenticated runs.
- Three-to-five samples are insufficient for a statistically stable p95.
- No slow SQL shape was confirmed in this campaign, so no speculative index/RPC change or QA `EXPLAIN ANALYZE` was performed.
- Payroll PDF click could not be exercised without marking a real QA payroll settlement paid. The bundle boundary, emitted deferred chunk, types, build, and generator/read-model tests were verified instead.
- No production data, migration, mutation, account, or environment was changed.

## Finding ranking

- P0: 0
- P1: 4 (`PERF-001` through `PERF-004`)
- P2: 4 (`PERF-005`, `PERF-006`, `PERF-007`, `PERF-009`)
- P3: 1 (`PERF-008`)
