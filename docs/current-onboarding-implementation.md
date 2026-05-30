# Current Onboarding Implementation

Last analyzed from the active codebase on May 31, 2026.

## Executive Summary

Onboarding is a blocking gate for owner users. It now uses a five-step checklist:

1. Choose production mode.
2. Add loom types and machine counts.
3. Add piece-rate workers.
4. Configure payroll cycle, pay date, and reminder window.
5. Start a trial or subscribe.

When complete, the owner lands on `/owner/today`. Supervisors do not run onboarding; they join through `/join` and are routed to the supervisor production workspace.

The flow is organization-based and role-gated. The durable completion flag is `organizations.onboarding_complete`, and the current checklist state is inferred from production mode, machines, workers, payroll config, and subscription/trial state.

## Route Map

| Route Path | File Path | Access | Redirect Destination |
| --- | --- | --- | --- |
| `/onboarding` | `app/(auth)/onboarding/page.tsx` | Authenticated owners | `/owner/today` when complete |
| `/signup` | `app/(auth)/signup/page.tsx` | Public | `/onboarding` after owner/org creation |
| `/join` | `app/(auth)/join/page.tsx` | Public | Supervisor home |
| `/login` | `app/(auth)/login/page.tsx` | Public | Role-based home |
| `/auth/callback` | `app/auth/callback/route.ts` | Public | `/onboarding`, `/owner/today`, or supervisor home |

Middleware redirects complete owners to `/owner/today`, incomplete owners to `/onboarding`, and supervisors to `/supervisor/dashboard` or `/supervisor/production` depending on entry point.

## Onboarding Steps

### 1. Choose Production Mode

Production mode is saved through `updateOrganizationProductionMode` and stored on `organizations.production_mode`.

Options:

- `market_run`: produce fabric first, store/sell/dispatch later.
- `order_based`: produce against confirmed party orders.
- `both`: show both workflows.

This setting controls owner navigation visibility through `lib/production-mode.ts`.

### 2. Add Machines

The machine form collects loom type and quantity, then creates named machines such as `Jacquard 1` or a custom type label. It writes through `addMachine` and requires at least one configured loom type/count.

### 3. Add Workers

The worker form creates piece-rate meter workers through `addMeterWorker`. It supports manual rows and bulk import. Phone numbers are optional; if any phone is saved, the owner must confirm consent. Worker phone and language are saved through `saveWorkerWhatsApp`.

Fixed workers, PF/ESI details, rates, and deeper worker setup remain post-onboarding workflows.

### 4. Configure Payroll

The payroll form writes `payroll_configs` through `savePayrollConfig`.

Fields:

- `cycle_start_day`: day 1-28 that starts the wage cycle.
- `pay_date_day`: first selected day after cycle close when wages are scheduled.
- `pay_reminder_days`: 0-14 day reminder/opening window before pay date.

Common presets include Surat-style and month-end-plus-10th setups.

### 5. Choose Plan

The plan step uses the trial/subscription components. A valid `org_subscriptions` row with active/authenticated status and non-expired `current_end` satisfies the gate.

## Completion Logic

`getOnboardingStatus` checks:

- `organizations.production_mode`, unless the org was already completed before production mode existed.
- At least one `machines` row.
- At least one `workers` row.
- A `payroll_configs` row.
- A valid active/authenticated subscription or trial.

If all checks pass, it updates `organizations.onboarding_complete = true` using the admin client so future JWT refreshes carry the completed state.

`markOnboardingComplete` is called before the final hard navigation to `/owner/today`, but the call is intentionally non-fatal because middleware has a DB fallback.

## Current Limitations

- Onboarding does not collect estimator qualities, yarn rates, worker rates, fixed workers, stock opening balances, or party masters.
- Production logging still requires active loom/order/worker setup after onboarding.
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
