# Weavly Documentation Index

The current subscription plans are **Free, Lite, and Base**. The active product routes and entitlement rules live in [`lib/subscription-access.ts`](../../lib/subscription-access.ts), [`lib/owner-navigation.ts`](../../lib/owner-navigation.ts), and the Next.js `app` directory. Older documents in this folder describe previous product scopes and are historical reference only.

## Current owner workspace

- Free: `/free`, `/free/costings`, `/free/account`, `/free/billing`.
- Lite: `/owner/estimator`, `/owner/quotes`, `/owner/rates`, `/owner/settings`, `/owner/billing`.
- Base: Lite features plus `/owner/production`, `/owner/assignments`, `/owner/stock`, `/owner/dispatches`, `/owner/machines`, `/owner/workers`, and `/owner/payroll`.
- Public plan comparison: `/plans`.

Plan prices and checkout eligibility are defined in [`lib/billing-constants.ts`](../../lib/billing-constants.ts) and [`lib/billing-lifecycle.ts`](../../lib/billing-lifecycle.ts). The retirement migration is [`20260924085030_retire_full_suite_tier.sql`](../../supabase/migrations/20260924085030_retire_full_suite_tier.sql).

## Removed features

Yarn Stock, the Stock (Inventory) Audit and the older March/April yarn & beam inventory module were deleted on 2026-10-14, data included: [plan](../superpowers/plans/2026-10-14-remove-yarn-stock.md), migrations `20261014120000_remove_yarn_stock_and_stock_audit.sql` and `20261014120100_remove_yarn_beam_module.sql`. `/owner/stock/yarn` and `/owner/stock/audit` redirect to `/feature-archived`. Stock tracks fabric metres only.

## Base visibility and Lite trial

New accounts see only Free and Lite while `BASE_PLAN_OPEN_TO_NEW_ACCOUNTS` is `false` in [`lib/base-plan-visibility.ts`](../../lib/base-plan-visibility.ts). New owners get a one-month Lite trial, stored as an `is_trial` row in `org_subscriptions`. Design: [spec](../superpowers/specs/2026-10-11-base-suppression-and-lite-trial-design.md). Migrations: `20261011120000_base_suppression_and_lite_trial.sql`, `20261011120100_admin_snapshot_trial_flag.sql`.

## Base supervisors

Base owners can let floor supervisors fill in the daily sheet (metres only, today and yesterday). Supervisors join at `/join` with the factory code from Settings, wait for owner approval, then use `/supervisor/daily-sheet`. Design: [spec](../superpowers/specs/2026-10-07-base-supervisor-daily-sheet-design.md), [plan](../superpowers/plans/2026-10-07-base-supervisor-daily-sheet.md). Migrations: `20261007120000_supervisor_membership.sql`, `20261007120100_supervisor_daily_sheet.sql`.

## Worker payroll refinement

The [first implementation increment](../worker-payroll-refinement.md) documents fixed operator approval, production applicability snapshots, prospective zero-rate resolution and the remaining incentive/costing scope.

## Historical reference

The June 2026 [`USER_WORKFLOWS.md`](../../USER_WORKFLOWS.md), [`TECHNICAL_ANALYSIS.md`](../../TECHNICAL_ANALYSIS.md), and [`TESTING_GUIDE.md`](../../TESTING_GUIDE.md) describe an earlier product. Previous scope and QA records in this directory remain for audit context; they do not define current routes or plan access.

- [Base manual production incentives](../base-manual-incentives.md) — approved positive earnings, receipts and reversal.
