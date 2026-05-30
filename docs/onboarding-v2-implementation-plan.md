# Onboarding V2 Implementation Plan

Status as of May 31, 2026: implemented with differences. The current blocking flow is production mode -> loom type/count setup -> meter workers -> payroll cycle/pay date/reminder -> plan/trial, then `/owner/today`. This document is retained as implementation history; use `docs/current-onboarding-implementation.md` for the current source of truth.

## 1. Goal

The goal of the Onboarding V2 redesign is to:
- **Reduce churn** by ensuring new factory owners can successfully set up their account and understand the product's value.
- **Improve activation** by guiding users to a usable starting point quickly.
- **Help a factory owner reach first value** (e.g., creating a quote or logging production) without overwhelming them during the initial setup.
- **Avoid overwhelming users** by keeping the blocking onboarding flow lightweight and deferring advanced setup to an activation checklist.
- **Make Weavly feel factory-specific** from the first session by collecting relevant data like loom types.

## 2. Current Problems to Solve

Based on the pre-V2 implementation, the current implementation had the following issues:
- **Redirect inconsistency:** Different files redirected owners to different landing pages (`/owner/today` vs `/owner/analytics`). This is now resolved in live redirects; owner home is `/owner/today`.
- **Missing qualities:** Qualities are required for Estimator, Quotes, Production, and Stock workflows but are not collected during onboarding. *Decision: We will NOT add quality setup as a blocking onboarding step, as qualities are better created in context inside the Estimator flow.*
- **Missing rates/activation guidance:** Users can complete onboarding without setting up rates or understanding how to reach first value.
- **Incomplete setup before dashboard:** The current flow only collects names of machines and workers, which is not enough to use the core loop.
- **Owner-only flow:** Supervisors bypass onboarding, which is fine, but they might land on a dashboard with no data if the owner hasn't completed setup.
- **Race condition/JWT fallback areas:** The code handles JWT lag on signup with timeouts and DB fallbacks. These are fragile and must not be broken during the redesign.

## 3. Proposed V2 Flow

The implemented flow is a 5-step blocking onboarding flow for owners, then a redirect to `/owner/today`.

### Step 1: Choose production mode
- **Purpose:** Decide which workflows Weavly should show first.
- **Fields:** `market_run`, `order_based`, or `both`.
- **Database writes:** `organizations.production_mode`.
- **Completion condition:** Production mode exists, except already-completed legacy orgs are treated as complete and normalized to the default.

### Step 2: Machines/Looms
- **Purpose:** Add initial machines with loom type support.
- **Required fields:** Loom type and count.
- **Optional fields:** Custom label (required if Loom Type is 'Other').
- **Existing components/actions to reuse:** `addMachine` in `app/(dashboard)/owner/actions.ts` already supports `loomType` and `customLabel`.
- **New components/actions needed:** Update `MachineForm` in `checklist.tsx` to include a dropdown for `loomType` and a conditional input for `customLabel`.
- **Database writes:** Inserts into `machines` table.
- **Validation rules:** Name required. If `loomType === 'other'`, `customLabel` is required.
- **Completion condition:** At least one machine added.

### Step 3: Workers
- **Purpose:** Add initial workers.
- **Required fields:** Worker Name.
- **Optional fields:** Phone, Worker Type (Meter vs Fixed).
- **Existing components/actions to reuse:** `WorkerForm` in `checklist.tsx`.
- **New components/actions needed:** Minimal updates.
- **Database writes:** Inserts into `workers` table.
- **Completion condition:** At least one worker added.

### Step 4: Payroll Cycle
- **Purpose:** Set monthly pay cycle timing.
- **Required fields:** Cycle start day (1-28), pay date day (1-28), reminder window (0, 3, 5, or 7 days in the current UI).
- **Existing components/actions to reuse:** `PayrollCycleForm` in `checklist.tsx`.
- **Completion condition:** Value selected and saved.

### Step 5: Trial/Plan
- **Purpose:** Start trial or subscribe.
- **Existing components/actions to reuse:** `PlanSelectionForm` in `checklist.tsx`.
- **Completion condition:** Subscription created.

### Step 6: Redirect to /owner/today
- **Purpose:** Drop user into the dashboard with the activation checklist.
- **Destination:** `/owner/today`.

## 4. Machine/Loom Step Changes

The current `addMachine` action in `app/(dashboard)/owner/actions.ts` already supports:
```typescript
export async function addMachine(name: string, loomType?: string, customLabel?: string)
```
It handles the logic for `loomType === 'other'` requiring `customLabel`.

**Changes needed:**
1. Update `MachineForm` in `app/(auth)/onboarding/checklist.tsx` to include:
   - A select dropdown for `loomType` with values: `jacquard`, `rapier`, `water_jet`, `air_jet`, `power_loom`, `shuttle`, `other`.
   - A conditional text input for `customLabel` visible only when `other` is selected.
2. Ensure the UI enforces:
   - Clearing `customLabel` when switching away from `other`.
   - Requiring `customLabel` when `other` is selected.

**Files needing changes:**
- `app/(auth)/onboarding/checklist.tsx` (Component update).

## 5. Estimator-First Quality Creation

Instead of forcing users to create qualities during onboarding, we will implement an **Estimator-first quality creation** strategy. Qualities are better created in context when building an estimate or quote.

**Strategy:**
1. Keep quality setup as part of the activation journey, not onboarding.
2. Support quality setup inside the estimator flow through either:
   - **Inline quality creation:** Allow users to type a new quality name directly in the estimator and save it on the fly.
   - **Clear CTA:** Provide a clear button/link to "Add New Quality" that opens a dialog or drawer without leaving the estimate flow.

This ensures the user only creates qualities when they have a concrete use case (building an estimate).

## 6. Worker Step Refinement

We recommend keeping the worker step lightweight:
- **Collect:** Name and Phone (optional).
- **Defer to Checklist:** Worker type, specific rates, and day/night assignments.

## 7. Payroll Step

Implemented payroll setup writes `cycle_start_day`, `pay_date_day`, and `pay_reminder_days` to `payroll_configs`. These values now drive payroll-cycle status and normal settlement gating.

## 8. Plan/Trial Step

The existing plan selection step is functional.
- **Table:** `org_subscriptions`.
- **Recommendation:** Keep it blocking.

## 9. /owner/today Activation Checklist

We propose adding a guided `ActivationChecklistCard` to `app/(dashboard)/owner/today/FactoryTodayClient.tsx`.

The top card should feel like guidance, not homework:
> **Your factory is ready. Start with your first estimate.**
> Create your first estimate to add a fabric quality, calculate pricing, and see expected profit.
> `[Create first estimate]`

### Checklist Items (Priority Order):

1. **Create First Estimate**
   - **Condition:** At least one quote/estimate exists.
   - **Table:** `estimator_quotes` or `quotes`.
   - **CTA:** `/owner/estimator`
   - **Priority:** High.

2. **Add/Select First Quality**
   - **Condition:** At least one quality exists.
   - **Table:** `qualities`.
   - **CTA:** Support this *inside* the estimator flow (see Section 5).
   - **Priority:** High.

3. **Convert Quote to Order**
   - **Condition:** At least one order exists.
   - **Table:** `orders`.
   - **CTA:** `/owner/quotes`
   - **Priority:** Medium.

4. **Log First Production**
   - **Condition:** At least one production log exists.
   - **Table:** `production_logs`.
   - **CTA:** `/supervisor/production`
   - **Priority:** High.

5. **Add Opening Stock**
   - **Condition:** At least one stock entry exists.
   - **Table:** `taka_stock_lots`.
   - **CTA:** `/owner/stock`
   - **Priority:** Low (Deferred).

## 10. Redirect Standardization

We will standardize the owner landing route to `/owner/today`.

**Files to update:**
- `middleware.ts`: Verify and harden redirects.
- `lib/auth.ts`: Update `getRoleHomePath` to return `/owner/today` for owners.
- `app/auth/callback/route.ts`: Update redirect on line 30 to `/owner/today`.
- `app/(auth)/onboarding/page.tsx`: Update redirect on line 31 to `/owner/today`.
- `app/(auth)/onboarding/checklist.tsx`: Update redirect on line 668 to `/owner/today`.

## 11. Database and State Model

We recommend keeping the current state model to avoid schema changes in Phase 1:
- Use `organizations.onboarding_complete` as the single boolean flag.

## 12. Error Handling and Race Conditions

To avoid breaking the JWT fallback logic:
- Do not remove the `parseJWT` fallback or the direct DB queries in `requireRole` and `middleware.ts`.

## 13. Testing Plan

### Tests to Create:
1. **Redirects:** Verify that logging in as a complete owner lands on `/owner/today`.
2. **Onboarding Gate:** Verify that an incomplete owner is forced to `/onboarding`.
3. **Machine Step:** Verify that `other` loom type requires a custom label.

## 14. Implementation Phases

### Phase 1: Redirect Standardization
- Update `middleware.ts`, `lib/auth.ts`, `app/auth/callback/route.ts`, `app/(auth)/onboarding/page.tsx`, `app/(auth)/onboarding/checklist.tsx` to use `/owner/today`.

### Phase 2: Loom Type Support in Onboarding
- Update `MachineForm` in `checklist.tsx` to support dropdown and custom label.

### Phase 3: /owner/today Activation Checklist
- Add the guided checklist component to `/owner/today` with the main CTA "Create your first estimate".

### Phase 4: Improve Estimator-First Quality Creation
- Add inline quality creation or a clear CTA inside the estimator flow.

## 15. Risks and Rollback Plan

- **Risk:** Breaking the auth flow or causing redirect loops.
- **Rollback:** Revert changes to `middleware.ts` and `auth/callback/route.ts`.

## 16. File-Level Change Plan

| File | Expected change | Risk | Notes |
|---|---|---|---|
| `lib/auth.ts` | Update `getRoleHomePath` | Low | Change return value |
| `app/auth/callback/route.ts` | Update redirect path | Medium | Ensure base URL is correct |
| `app/(auth)/onboarding/page.tsx` | Update redirect path | Low | - |
| `app/(auth)/onboarding/checklist.tsx` | Update final redirect | Medium | Complex client component |
| `app/(dashboard)/owner/today/FactoryTodayClient.tsx` | Add activation checklist UI | Low | Read-only checklist mostly |

## 17. Final Recommendation

- **Build First:** Phase 1 (Redirect standardization) and Phase 2 (Loom type support).
- **Canonical Route:** `/owner/today`.
- **Schema Changes:** Not necessary.
