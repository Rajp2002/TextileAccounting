# Current Onboarding Implementation

Last updated from the active codebase on August 29, 2026.

## Executive Summary

Onboarding is a small blocking gate for owner users. The only factory setup choice collected before first use is the production mode:

1. Choose production mode.
2. Enter the owner workspace.

Looms, workers, and payroll are deliberately deferred. The owner is prompted to add them from the workflow that needs them—for example, the estimator asks for a loom before starting a Full Suite production order, and Base production opens worker setup when the owner first chooses to record metres.

When complete, the owner lands on `/owner/today`. Supervisors do not run onboarding; they join through `/join` and are routed to the supervisor production workspace.

The flow is organization-based and role-gated. The durable completion flag is `organizations.onboarding_complete`, and the current checklist state is inferred from production mode, optional operational setup, and subscription/trial state.

## Route Map

| Route Path | File Path | Access | Redirect Destination |
| --- | --- | --- | --- |
| `/onboarding` | `app/(auth)/onboarding/page.tsx` | Authenticated owners | `/owner/today` when complete |
| `/signup` | `app/(auth)/signup/page.tsx` | Public | `/onboarding` after owner/org creation |
| `/join` | `app/(auth)/join/page.tsx` | Public | Supervisor home |
| `/login` | `app/(auth)/login/page.tsx` | Public | Role-based home |
| `/auth/callback` | `app/auth/callback/route.ts` | Public | `/onboarding`, `/owner/today`, or supervisor home |

Middleware redirects complete owners to `/owner/today`, incomplete owners to `/onboarding`, and supervisors to `/supervisor/dashboard` or `/supervisor/production` depending on entry point.

## Onboarding Step

### 1. Choose Production Mode

Production mode is saved through `updateOrganizationProductionMode` and stored on `organizations.production_mode`.

Options:

- `market_run`: produce fabric first, store/sell/dispatch later.
- `order_based`: produce against confirmed party orders.
- `both`: show both workflows.

This setting controls owner navigation visibility through `lib/production-mode.ts`.

### Contextual operational setup

The onboarding page shows the operational setup categories as “set up when you need them” guidance; it does not render machine, worker, or payroll forms.

- **Looms:** `startPartyOrderFromEstimator` and `createMarketRunFromEstimator` verify that the organization has at least one loom. If none exists, the estimator opens `ContextualMachineDialog`, which creates one loom and resumes the requested production workflow.
- **Base workers:** The owner-only Base Production Core keeps its minimal name/rate form and opens it immediately when the owner chooses **Record metres** without an active worker.
- **Full Suite workers and payroll:** Existing management pages remain available for richer worker verification, assignments, payroll cycles, and statutory configuration when those workflows are needed.

## Completion Logic

`getOnboardingStatus` checks:

- `organizations.production_mode`, unless the org was already completed before production mode existed.
- Optional setup status for machines, workers, and `payroll_configs` for the deferred-setup guidance.
- A valid active/authenticated subscription or trial.

Production mode plus a valid subscription is enough to update `organizations.onboarding_complete = true` using the admin client so future JWT refreshes carry the completed state.

`markOnboardingComplete` is called before the final hard navigation to `/owner/today`, but the call is intentionally non-fatal because middleware has a DB fallback.

## Current Limitations

- Onboarding does not collect estimator qualities, yarn rates, worker rates, fixed workers, stock opening balances, or party masters.
- Full Suite production logging still requires active loom/order/worker setup after onboarding; those are intentionally workflow prerequisites rather than signup blockers.
- Production mode affects navigation, not data migration.
- Some comments in auth/onboarding source files still mention older `/owner/analytics` wording, but the live redirects now point owners to `/owner/today`.

## Related Files

- `app/(auth)/onboarding/page.tsx`
- `app/(auth)/onboarding/checklist.tsx`
- `app/(auth)/actions/auth.ts`
- `app/auth/callback/route.ts`
- `middleware.ts`
- `lib/production-mode.ts`
- `app/(dashboard)/owner/payroll/actions.ts`
- `lib/payroll-cycle.ts`
