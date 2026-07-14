# Batch 2 Route Performance Baseline

Date: 2026-07-09

Scope: measurement only. No product behavior, caching strategy, route split, or large UI refactor was changed.

Environment: `npm run dev` on `http://localhost:3000`, authenticated owner QA session, Next.js dev server. Times are local dev timings and include network variance to Supabase. `auth_session_ms` inside `AccessGate` can include wait time for the shared `getCachedSession()` promise; `supabase_calls` is the better signal for duplicate-call proof.

## Batch 1 Comparison

Available Batch 1 before/after call-count proof is for `/owner/dispatches`.

| Route | Before Batch 1 | After Batch 1 | Current Batch 2 proof |
| --- | ---: | ---: | --- |
| `/owner/dispatches` auth/profile/org/tier shell | 8 Supabase round trips | 4 Supabase round trips | Layout logs `supabase_calls=3`; AccessGate logs `supabase_calls=1`; page action auth cache hits add no tracked auth/profile calls. |

Source: `__tests__/batch1-auth-waterfall-elimination.test.ts`.

## Current Warm Route Timings

| Route | Auth/session | Profile/org/tier | Business data | Total measured load | Calls tracked | Notes |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| `/owner/today` | 769.1ms | layout org 481.4ms | 1531.3ms | 2309.7ms page action, 1260.8ms layout | 25 page + 3 layout | Largest server fan-out: 24-query fanout plus payroll cycle query. |
| `/owner/dispatches` | shared cache wait 772.8ms | tier 530.3ms | 1295.3ms | 1303.3ms gate, 1295.4ms page action | 5 page + 1 gate + 3 layout | Business data remains comparable to commercials. |
| `/owner/payroll` | shared cache wait 726.8ms | tier 349.5ms | client bootstrap 850.0-1165.0ms for fixed payroll; meter query failed in QA data | 1076.4ms server gate | 6 per payroll client query + 1 gate + 3 layout | Current and pay-date cycle queries both run. |
| `/owner/machines` | shared cache wait 700.0ms | tier 381.7ms | 2238.7ms `machines.production_targets`; 332-417ms assignments | 1081.8ms server gate | 4 production target action + 2 assignments + 1 gate + 3 layout | Strongest single client bootstrap bottleneck observed. |
| `/owner/advances` | shared cache wait 711.5ms | tier 390.4ms | no fresh client query log emitted in this browser session | 1102.0ms server gate | 1 gate + 3 layout | React Query retained client query results during reloads; instrumentation is present for workers/pending/detail queries. |
| `/owner/commercials` | shared cache wait 758.9ms | tier 371.5ms | 1255.4ms | 1255.5ms page action, 1130.5ms gate | 7 page + 1 gate + 3 layout | Business count includes conditional receivables enrichment query. |

## Pasted Timing Logs

```text
[perf] route="/owner/* layout" surface="server" auth_session_ms=774.5 profile_org_tier_ms=481.4 business_data_ms=0 total_server_load_ms=1260.8 supabase_calls=3
[perf] route="/owner/today" surface="server" auth_session_ms=769.1 profile_org_tier_ms=0 business_data_ms=1531.3 total_server_load_ms=2309.7 supabase_calls=25 note="business includes 24-query fanout plus payroll cycle log query"

[perf] route="/owner/* layout" surface="server" auth_session_ms=777.6 profile_org_tier_ms=442.9 business_data_ms=0 total_server_load_ms=1237.5 supabase_calls=3
[perf] route="/owner/dispatches" surface="server" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=1295.3 total_server_load_ms=1295.4 supabase_calls=5 note="business call count includes conditional stock_discrepancies lookup"
[perf] route="/owner/dispatches" surface="server" auth_session_ms=772.8 profile_org_tier_ms=530.3 business_data_ms=0 total_server_load_ms=1303.3 supabase_calls=1 required_tier="premium"

[perf] route="/owner/payroll" surface="server" auth_session_ms=726.8 profile_org_tier_ms=349.5 business_data_ms=0 total_server_load_ms=1076.4 supabase_calls=1 required_tier="premium"
[perf] route="/owner/payroll" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=850 total_client_load_ms=850 supabase_calls=6 label="payroll.fixed.2026-07" failed=false
[perf] route="/owner/payroll" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=1164.9 total_client_load_ms=1165 supabase_calls=6 label="payroll.pay_date_fixed.2026-06" failed=false
[perf] route="/owner/payroll" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=574.3 total_client_load_ms=574.3 supabase_calls=6 label="payroll.meter.2026-07" failed=true
[perf] route="/owner/payroll" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=864.1 total_client_load_ms=864.1 supabase_calls=6 label="payroll.pay_date_meter.2026-06" failed=true

[perf] route="/owner/machines" surface="server" auth_session_ms=700 profile_org_tier_ms=381.7 business_data_ms=0 total_server_load_ms=1081.8 supabase_calls=1 required_tier="premium"
[perf] route="/owner/machines" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=2238.7 total_client_load_ms=2238.7 supabase_calls=4 label="machines.production_targets" failed=false
[perf] route="/owner/machines" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=367.3 total_client_load_ms=367.4 supabase_calls=2 label="machines.assignments" failed=false

[perf] route="/owner/* layout" surface="server" auth_session_ms=714.3 profile_org_tier_ms=339.6 business_data_ms=0 total_server_load_ms=1059.7 supabase_calls=3
[perf] route="/owner/advances" surface="server" auth_session_ms=711.5 profile_org_tier_ms=390.4 business_data_ms=0 total_server_load_ms=1102 supabase_calls=1 required_tier="premium"

[perf] route="/owner/commercials" surface="server" auth_session_ms=758.9 profile_org_tier_ms=371.5 business_data_ms=0 total_server_load_ms=1130.5 supabase_calls=1 required_tier="premium"
[perf] route="/owner/* layout" surface="server" auth_session_ms=761.7 profile_org_tier_ms=407.1 business_data_ms=0 total_server_load_ms=1185.8 supabase_calls=3
[perf] route="/owner/commercials" surface="server" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=1255.4 total_server_load_ms=1255.5 supabase_calls=7 note="business call count includes conditional receivables enrichment query"
```

## Batch 3 Recommendation

Start Batch 3 with loader/query work, not a large UI split.

1. Prioritize `/owner/machines` `machines.production_targets`: it is the largest single measured bottleneck at 2238.7ms for 4 tracked calls, plus an extra authenticated server-action POST. This looks contained and lower risk than splitting payroll/commercials UI.
2. Next address Factory Today fan-out: `/owner/today` has the largest server query count at 25 tracked calls and 1531.3ms business data time. Optimize only after deciding which signals must stay first paint.
3. Investigate payroll meter query failures before optimizing payroll shape. The fixed payroll queries succeed but duplicate current/pay-date cycle loads cost 850-1165ms each; meter queries failed during QA and should be diagnosed before any split.
4. Do not split payroll/commercials yet. Their measured bottlenecks are query/read-model costs, not proof that route splitting is the next best change.

## Batch 3A — `/owner/machines` Server Initial Load

Date: 2026-07-09

Scope: `/owner/machines` only. Payroll, commercials, and Factory Today fan-out were not split or refactored.

Implementation summary:

- `app/(dashboard)/owner/machines/page.tsx` is now a Server Component.
- The page uses `requireRole(['owner'])`, backed by Batch 1 `getCachedSession()`.
- Initial machine board data is loaded server-side through `loadOwnerMachinesInitialData(profile.org_id)`.
- The server payload includes machines, active meter workers, active fixed workers, active production targets, and current operator/legacy assignments.
- `MachineManagement` remains the client-side interactive board for create/edit/delete dialogs, assignment controls, realtime invalidation, and mutation flows.
- `MachineManagement` receives `initialData` and `userRole`; it no longer calls `useUserProfile()`.
- When server `initialData` is present, React Query uses it without refetching on mount. Later invalidations still refresh data.

Before Batch 3A:

```text
[perf] route="/owner/machines" surface="server" auth_session_ms=700 profile_org_tier_ms=381.7 business_data_ms=0 total_server_load_ms=1081.8 supabase_calls=1 required_tier="premium"
[perf] route="/owner/machines" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=2238.7 total_client_load_ms=2238.7 supabase_calls=4 label="machines.production_targets" failed=false
[perf] route="/owner/machines" surface="client" auth_session_ms=0 profile_org_tier_ms=0 business_data_ms=367.3 total_client_load_ms=367.4 supabase_calls=2 label="machines.assignments" failed=false
```

After Batch 3A, dev server clean reload on `http://localhost:3000/owner/machines`:

```text
[perf] route="/owner/machines" surface="server" auth_session_ms=722.6 profile_org_tier_ms=378.4 business_data_ms=0 total_server_load_ms=1101.1 supabase_calls=1 required_tier="premium"
[perf] route="/owner/* layout" surface="server" auth_session_ms=725.5 profile_org_tier_ms=439.7 business_data_ms=0 total_server_load_ms=1173.3 supabase_calls=3
[owner/machines] machine_operator_assignments unavailable; falling back to legacy assignments only.
[perf] route="/owner/machines" surface="server" auth_session_ms=721.3 profile_org_tier_ms=0 business_data_ms=556.3 total_server_load_ms=1280.3 supabase_calls=7 note="business includes machines, workers, fixed workers, production targets, and assignments"
GET /owner/machines 200 in 2.8s (next.js: 11ms, proxy.ts: 1319ms, application-code: 1434ms)
```

Follow-up polling for 5 seconds after the clean reload emitted no `machines.list`, `machines.meter_workers`, `machines.fixed_workers`, `machines.production_targets`, or `machines.assignments` client bootstrap logs. Earlier HMR state did emit client query logs before the `refetchOnMount` guard was added; the clean reload above is the post-fix measurement.

Production build/start:

```text
npx next build --webpack
✓ Compiled successfully in 32.7s
✓ Finished TypeScript in 29.3s
✓ Generating static pages using 15 workers (41/41) in 915ms
```

Production `next start` with `WEAVLY_PERF_LOGS=true`:

```text
[perf] route="/owner/machines" surface="server" auth_session_ms=512.4 profile_org_tier_ms=273.1 business_data_ms=0 total_server_load_ms=785.8 supabase_calls=1 required_tier="premium"
[perf] route="/owner/* layout" surface="server" auth_session_ms=515.8 profile_org_tier_ms=696.9 business_data_ms=0 total_server_load_ms=1214.6 supabase_calls=3
[owner/machines] machine_operator_assignments unavailable; falling back to legacy assignments only.
[perf] route="/owner/machines" surface="server" auth_session_ms=512.2 profile_org_tier_ms=0 business_data_ms=1178.1 total_server_load_ms=1690.8 supabase_calls=7 note="business includes machines, workers, fixed workers, production targets, and assignments"
```

Production-start visual verification was blocked by the production env subscription state: the QA owner was redirected to `/owner/billing` with "ACCESS SUSPENDED / Plan expired." No billing or production database operation was performed. The production server timing still confirms the route loader ran successfully under `next start`.

Meaningful content before hydration:

- Dev QA browser verification showed the route rendering `Machines`, `Loom Assignments`, `Rapier Looms`, `Rapier 1`, cost-analysis status, and day/night assignment controls from the server-provided payload.
- The old page-level hydration/profile skeleton is gone.
- The route no longer waits for `useUserProfile()` before displaying machine content.
- Local dev Supabase currently lacks `machine_operator_assignments` in the schema cache; the server loader degrades to legacy assignments instead of failing the route.

## Batch 3B — `/owner/today` First-render Query Fan-out

Date: 2026-07-10

Scope: `/owner/today` only. The operational action-center data remains server-rendered. The non-critical onboarding/setup checklist is loaded after hydration through an authenticated server action.

Implementation summary:

- First render now makes 10 concurrent dashboard calls, followed by the existing payroll-cycle wage query (11 tracked calls total).
- The 13 setup/activation checklist calls moved to `getFactoryTodayChecklist`, which verifies the owner role independently and runs after the action center is visible.
- The initial payload carries only four checklist values already available from dashboard queries: production mode, machine presence, linked loom target, and payroll configuration validity.
- The setup panel is intentionally absent until its deferred checklist data arrives; production, machine, risk, dispatch, commercial, payroll, KPI, and quick-action surfaces remain available immediately.

Before Batch 3B: 25 tracked server calls (24-query fan-out plus the payroll-cycle wage query).

After Batch 3B: 11 tracked initial-render calls, with 13 checklist calls deferred from the critical path.

## Batch 3B-Fix — `/owner/today` Authenticated Runtime Load Isolation

Date: 2026-07-10

Scope: diagnose and resolve the reported local authenticated Factory Today load hang. No payroll, commercial, machine, billing, subscription, or production-data behavior was changed.

### Finding

The reported `>10s` load was not caused by a Factory Today query, owner authentication, middleware/proxy redirect, or the deferred checklist action. The local Turbopack development process stalled while compiling `/instrumentation`; while it was in that state, even proxy-excluded `/sw.js` and public `/offline` timed out. A clean `next start` production-mode server returned `/sw.js`, `/offline`, and `/login` with `200`, and returned the expected unauthenticated `307` for `/owner/today`.

The Factory Today-specific issue found during the audit was narrower: React Strict Mode can invoke the deferred checklist effect twice before either action resolves. The client now marks the action as started before calling it, which makes the 13-query checklist request single-flight. This did not block the server render, but it removed redundant deferred fan-out.

### Diagnostics and Runtime Evidence

- `actions.ts` now emits gated, per-query start/end/duration/result-state logs whenever the normal performance flag is enabled. The 3-second safe timeout fallback is development-only; production behavior still surfaces normal errors and never substitutes fallback data.
- Production-mode authenticated browser reload: `http://localhost:3000/owner/today` rendered `Factory Today` meaningful content in **4861ms**, with no browser console errors.
- Initial route performance: **1393.4ms** total server load, including **351.2ms** owner auth and **375.9ms** business data on the warm measured reload.
- Deferred checklist action was observed independently after the route load: **857.3ms** total (**328.4ms** auth, **527.7ms** business data). It did not hold the initial action-center render.
- No initial dashboard query exceeded the 3-second diagnostic threshold. The slowest cold captured initial query was `active_order_progress` at **740ms**. The payroll-cycle worker-log query completed in **167ms**.
- The active QA schema returned ordinary error result states for `production_recent` and `active_market_runs`; both are already consumed as null/empty read-model data, so the dashboard rendered safely. They did not hang. All other initial table/view reads completed, while `payroll_config` correctly returned a null-data state for the QA tenant.

### Browser Before/After

| Check | Before | After |
| --- | --- | --- |
| Local dev process | No response from `/sw.js`, `/offline`, `/login`, or `/owner/today` within 5–12s while `/instrumentation` compiled. | Clean production server answered public routes and authenticated Factory Today normally. |
| Factory Today first meaningful content | Not measurable because the dev runtime never returned a document. | 4861ms with Factory Today heading, KPIs, production, dispatch, commercial, payroll, quick-action, and setup content present. |
| Deferred checklist | Could not be observed. | Completed independently after first render; no repeated action loop observed. |
