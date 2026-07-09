# Batch 3C — `/owner/payroll` Server Initial Ledger

Date: 2026-07-10

Scope: move only the initial payroll ledger load to the server. Settlement creation, payroll authorization, billing gates, calculations, exports, and post-settlement behavior remain unchanged.

## Implementation

- The route is now a Server Component that preserves owner `requireRole(['owner'])` enforcement and supplies the interactive payroll UI with a server-loaded initial cycle.
- The first load no longer waits for `useUserProfile()`, a browser `payroll_configs` query, or a browser organization-name query.
- One server loader shares current-cycle production logs, settlements, and pending advances between the meter and fixed ledgers. It performs 11 planned reads: config, organization, production logs, workers, fixed workers, machines, settlements, advances, orders, attendance, and operator assignments.
- The pay-date overview remains accurate but begins only after hydration and after the primary ledger is available. It no longer competes with the current-cycle ledger for the first render.
- Payroll calculations were moved unchanged into a shared read model used by both the server initial loader and later client-side month changes.
- Missing machine-operator schema fields use a legacy-compatible read only for legacy rows. The UI shows a red payroll-data warning instead of silently presenting the result as complete; non-schema database errors still fail the route.

## Before / after evidence

| Measure | Before Batch 3C | After Batch 3C |
| --- | ---: | ---: |
| Initial business query shape | Four independent browser ledger queries at 6 calls each (current + pay-date meter/fixed), plus client profile/config/org bootstrap | 11 planned server reads for the current ledger; pay-date reads deferred until after hydration |
| Initial tracked ledger calls | 24 ledger calls | 11 planned calls (12 physical calls in the QA schema because the unavailable operator projection retries once with the verified legacy projection) |
| Current primary content | Waited for browser hydration/profile bootstrap and React Query | Server payload is passed into React Query `initialData`; no initial ledger mount refetch |
| Warm production server business load | No equivalent server ledger measurement; client fixed runs were 850.0ms and 1164.9ms, while meter runs failed in the QA schema | 756.9ms business data, 1136.7ms page server total on the clean warm production sample |
| Slowest remaining query | Meter query failed in the QA schema | `machine_operator_assignments` and the advanced `production_logs` projection each returned the known schema error in 328ms; the fallback legacy log query completed in 168ms. Slowest successful normal query was `attendance` at 319ms. |

Warm production timing log (`WEAVLY_PERF_LOGS=true`, `next start`, authenticated QA owner):

```text
[perf] route="/owner/payroll" surface="server" auth_session_ms=377.5 profile_org_tier_ms=0 business_data_ms=756.9 total_server_load_ms=1136.7 supabase_calls=11 note="server initial payroll shares cycle logs, settlements, and advances across meter and fixed ledgers; pay-date overview is deferred"
```

## First meaningful content before hydration

The route serializes the current meter and fixed ledger into the server render and seeds the matching React Query keys with `initialData`; the old profile/bootstrap skeleton is not on the critical path.

Direct visual proof of the payroll content is blocked in the current production QA environment: the authenticated owner is redirected to `/owner/billing` with `ACCESS SUSPENDED / Plan expired`. The loader still executed and emitted the timing above before the gate redirected. No billing action or production database write was performed.

## Remaining risk

The active QA schema still lacks the machine-operator payroll relation/projection. The compatibility path is deliberately visible and should be removed only after the already-versioned migration is present in the target environment and payroll operator results are verified there.

## Final verification recheck

After the final production build, an authenticated QA request completed the server loader in 1279.6ms business time (1634.2ms route total). The advanced operator query failed in the known QA schema after 737ms, then the verified legacy production-log query completed in 165ms. The UI continues to show the schema warning, and the settlement action now fails closed if that production-log projection cannot be read, preventing a zero-value meter-worker settlement.
