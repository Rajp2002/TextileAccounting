# Batch 3E — `/owner/dispatches` Shared Discrepancy Snapshot

Date: 2026-07-10

Scope: remove only the duplicated first-render `stock_discrepancies` read. Dispatch creation, receipts, archive rules, sale data, billing gating, and authorization remain unchanged.

## Implementation

- A route-only server loader starts one owner-authorized open-discrepancy query alongside dispatches, overview sales, and pending-sale reads.
- The same promise feeds active/archive classification and overview discrepancy totals, reducing initial business reads from five to four.
- The existing missing-`stock_discrepancies` table fallback remains centralized; unavailable schema data is treated as an empty discrepancy snapshot, while ordinary query errors still surface.

## Before / after evidence

| Measure | Before Batch 3E | After Batch 3E |
| --- | ---: | ---: |
| Initial business reads | 5 | 4 |
| Discrepancy reads | One dispatch-ID lookup after dispatches, plus a second organization-wide overview lookup | One organization-wide snapshot shared by both consumers |
| Dispatch archive semantics | Open discrepancy keeps a group active | Unchanged; same IDs feed `shouldArchiveDispatchGroup` |
| Missing-table behavior | Soft fallback | Unchanged soft fallback |
| Warm server business load | 1295.3ms baseline sample | 551.6ms sample |

Warm production sample (`WEAVLY_PERF_LOGS=true`, authenticated QA owner):

```text
[perf] route="/owner/dispatches" surface="server" auth_session_ms=364.4 profile_org_tier_ms=0 business_data_ms=551.6 total_server_load_ms=917.1 supabase_calls=4 note="server initial payload shares one open stock_discrepancies read across active dispatches and overview totals"
```

The before/after time samples are not a controlled cold-cache benchmark, but the business-call reduction is structural and removes the old page-internal serial discrepancy lookup.

## First meaningful content before hydration

Dispatches already supplied its primary content from the server; this change reduces its server fan-out without changing the client surface. As with the other owner routes, direct visual proof in the current QA tenant is blocked after the loader runs because the owner is redirected to `/owner/billing` for an expired plan. No billing action or production write was performed.
