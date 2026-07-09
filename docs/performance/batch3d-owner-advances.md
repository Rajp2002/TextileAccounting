# Batch 3D — `/owner/advances` Server Initial Overview

Date: 2026-07-10

Scope: move the initial active-worker roster and pending-advance overview to the server. Creating, deleting, recovery/settlement behavior, authorization, billing access, and selected-worker detail behavior are unchanged.

## Implementation

- The route now requires the owner role on the server and returns a typed initial payload for the active meter-worker roster, fixed-worker roster, and pending advances.
- The interactive client seeds `all_workers` and `all_pending_advances` with that payload and disables their mount refetch.
- The selected-worker ledger and typical-monthly-earnings queries remain deferred until a worker is selected.
- Server and future client refreshes use the same read-model transformation. Loader errors now surface rather than silently yielding an incomplete roster.

## Before / after evidence

| Measure | Before Batch 3D | After Batch 3D |
| --- | --- | --- |
| First visible roster path | Browser hydration followed by `useUserProfile()` and React Query | Server payload passed to the interactive client before hydration |
| Initial business reads | 3 client reads: meter workers, fixed workers, pending advances | 3 parallel server reads; no primary mount refetch |
| Selected-worker ledger / earning estimate | Deferred | Still deferred; unchanged interaction behavior |
| Primary client profile dependency | Required | Removed from the route client |

Warm production sample (`WEAVLY_PERF_LOGS=true`, authenticated QA owner):

```text
[advances/query] label=fixed_workers state=success duration_ms=366
[advances/query] label=meter_workers state=success duration_ms=382
[advances/query] label=pending_advances state=success duration_ms=452
[perf] route="/owner/advances" surface="server" auth_session_ms=387.3 profile_org_tier_ms=0 business_data_ms=455 total_server_load_ms=854.5 supabase_calls=3 note="server initial advances shares active worker roster and pending overview; selected-worker detail remains deferred"
```

The slowest primary query was the pending-advance overview at 452ms. The queries began concurrently, so the server business phase completed in 455ms rather than their sum.

## First meaningful content before hydration

The worker list and pending-recovery overview are serialized into the server render rather than waiting on a client profile bootstrap. Direct visual proof in the current production QA tenant is blocked after the loader runs: the owner is redirected to `/owner/billing` because the plan is expired. No billing action or production write was performed.
