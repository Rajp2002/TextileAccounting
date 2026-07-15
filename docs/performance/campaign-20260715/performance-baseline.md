# Weavly performance baseline — 2026-07-15

## Test environment

- Branch: `codex/performance-campaign-20260715`
- Baseline repository commit: `edaf926` plus pre-existing, unrelated working-tree changes
- Optimization commit: `3bc65d4`
- Framework: Next.js 16.2.10 production build with webpack; React 19.2.7
- Data platform: Supabase SSR 0.8.0 / supabase-js 2.95.3; PostgreSQL RLS scoped by `org_id`
- Runtime: Node 24.11.1, npm 11.6.2, macOS 26.5.1 x86_64
- Browser: Codex in-app browser against localhost
- Production-local server: `next start`, port 3100, `.env.production.local`
- Network: localhost, unthrottled. Gzip emitted-chunk size is recorded as a deterministic transfer proxy.
- Device: local development machine. A representative low-powered mobile CPU profile was not available.

The first production build was captured before campaign edits. The same manifest parser, routes, compression method, and build command were used after the edits.

## Architecture and bottleneck map

- Next.js App Router provides dynamic server-rendered authenticated routes and client islands. Dashboard layouts preserve the shell across child navigation.
- Server loaders and server actions use Supabase server clients; browser queries and mutations use the browser client. Authorization and tenant scoping remain server/RLS authoritative.
- TanStack Query is mounted globally with persisted offline support. Cache identity includes authenticated user scope under the existing implementation.
- Authentication is enforced in `proxy.ts`, route loaders, and server actions. Existing local auth changes were present before this campaign and were not modified or committed here.
- The global provider previously statically imported English, Hindi, Gujarati, legacy, and generated legacy dictionaries. This placed a 625,809-byte raw language chunk on every route, including English-only sessions.
- Payroll statically imported `jsPDF` through the payslip generator. The 330,613-byte raw PDF chunk was therefore part of the payroll initial client graph.
- Existing route baselines show server/Supabase round trips remain important: Factory Today previously reached 25 reads and was reduced to 11 first-render reads plus 13 deferred checklist reads; payroll planning reduced 24 ledger reads to 11 server reads.
- Sentry, PWA/service-worker support, persisted query state, framer-motion, charts, export tooling, and route-specific document generation are material bundle/runtime surfaces.
- Lightweight timing support already exists in `lib/perf.ts` behind `WEAVLY_PERF_LOGS`.

## Critical journey inventory and priority

| Journey | Route / feature | Current evidence | Priority |
| --- | --- | --- | --- |
| Initial public load | `/login` | Direct production build and local runtime | P1 |
| Login | `/login` server action | Attempted with isolated QA owner; flow did not complete | P1 |
| Session restoration | Authenticated layouts | Blocked by QA sign-in | P1 |
| First authenticated route | `/owner/today` | Direct bundle evidence; existing server baseline; current runtime blocked | P1 |
| Major-section navigation | Owner layout routes | Existing architecture review; current browser trace blocked | P1 |
| Factory Today | `/owner/today` | Direct bundle evidence plus existing query baseline | P1 |
| Estimator open/recalculation/save | `/owner/estimator` | Direct bundle evidence; calculation runtime blocked | P1 |
| Payroll and workers | `/owner/payroll`, worker routes | Direct bundle evidence plus existing query baseline | P1 |
| Quotations and orders | `/owner/quotes`, `/owner/orders` | Static architecture review | P2 |
| Stock and inventory | `/owner/stock`, `/owner/inventory` | Static architecture review | P2 |
| Supervisor dashboard | `/supervisor/dashboard` | Direct bundle evidence; authenticated runtime blocked | P2 |
| Analytics and reports | `/owner/analytics` | Static bundle/dependency review | P2 |
| Documents and exports | Payslips and route exports | Direct dependency graph; click-time runtime blocked | P2 |
| Settings and administration | `/owner/settings`, `/admin` | Static architecture review | P3 |

## Baseline metrics

Initial client JavaScript is the unique set of `.js` chunks referenced by each route's production client-reference manifest. Sizes are raw and gzip-compressed bytes.

| Route | Initial JS requests | Raw bytes | Gzip bytes | Largest avoidable contributor |
| --- | ---: | ---: | ---: | --- |
| `/login` | 22 | 1,168,350 | 347,831 | Global language dictionaries |
| `/owner/today` | 27 | 1,266,554 | 374,306 | Global language dictionaries |
| `/owner/estimator` | 30 | 1,406,594 | 413,271 | Global language dictionaries |
| `/owner/payroll` | 34 | 2,023,626 | 604,319 | Language dictionaries and jsPDF |
| `/supervisor/dashboard` | 30 | 1,560,102 | 463,147 | Global language dictionaries |

Existing server/Supabase evidence retained in `docs/performance`:

- Factory Today historical baseline: 25 Supabase reads and 2,309.7 ms; later first-render architecture: 11 reads with 13 checklist reads deferred.
- Payroll historical baseline: 24 ledger reads; server read model planned at 11 reads. A prior warm QA sample recorded 756.9 ms business time but also exposed QA schema fallback limitations.
- Advances historical server payload: three parallel reads, approximately 455 ms business time.
- Dispatches historical sample: five to four reads and 1,295.3 ms to 551.6 ms.

## Final anonymous runtime samples

These are post-change operational checks, not before/after claims. Five samples are too few for a stable p95.

- `/login`: cold-process TTFB 813.0 ms; subsequent TTFB samples 89.0, 55.5, 41.6, and 42.5 ms; response 22,052 bytes.
- Anonymous `/owner/today`: five 307 redirects to `/login`; TTFB 7.7–9.4 ms; six-byte response.
- Production-local server ready in 496 ms.

## Measurement limitations

- Configured QA owner credentials were loaded from the protected local secret store, but sign-in remained on `/login` on both dev and production-local servers. No credential values were stored in artifacts.
- Consequently, current authenticated network waterfalls, Core Web Vitals, database plans, mutation timing, PDF-click timing, organization switching, and real mobile workflow traces could not be collected.
- Production was not contacted or modified. No load was generated against external production services.
- Localhost timing does not model internet latency, Supabase regional latency, cold serverless starts, production-scale rows, or a lower-powered mobile CPU.
- Bundle byte deltas are deterministic and directly comparable; they do not alone prove p50/p95 interaction-latency change.

## Initial finding ranking

- P0: 0
- P1: 4 (`PERF-001`, `PERF-002`, `PERF-003`, `PERF-004`)
- P2: 3 (`PERF-005`, `PERF-006`, `PERF-007`)
- P3: 1 (`PERF-008`)
