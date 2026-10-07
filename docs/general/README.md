# Weavly Documentation Index

The current subscription plans are **Free, Lite, and Base**. The active product routes and entitlement rules live in [`lib/subscription-access.ts`](../../lib/subscription-access.ts), [`lib/owner-navigation.ts`](../../lib/owner-navigation.ts), and the Next.js `app` directory. Older documents in this folder describe previous product scopes and are historical reference only.

## Current owner workspace

- Free: `/free`, `/free/costings`, `/free/account`, `/free/billing`.
- Lite: `/owner/estimator`, `/owner/quotes`, `/owner/rates`, `/owner/settings`, `/owner/billing`.
- Base: Lite features plus `/owner/production`, `/owner/assignments`, `/owner/stock`, `/owner/dispatches`, `/owner/machines`, `/owner/workers`, and `/owner/payroll`.
- Public plan comparison: `/plans`.

Plan prices and checkout eligibility are defined in [`lib/billing-constants.ts`](../../lib/billing-constants.ts) and [`lib/billing-lifecycle.ts`](../../lib/billing-lifecycle.ts). The retirement migration is [`20260924085030_retire_full_suite_tier.sql`](../../supabase/migrations/20260924085030_retire_full_suite_tier.sql).

## Base supervisors

Base owners can let floor supervisors fill in the daily sheet (metres only, today and yesterday). Supervisors join at `/join` with the factory code from Settings, wait for owner approval, then use `/supervisor/daily-sheet`. Design: [spec](../superpowers/specs/2026-10-07-base-supervisor-daily-sheet-design.md), [plan](../superpowers/plans/2026-10-07-base-supervisor-daily-sheet.md). Migrations: `20261007120000_supervisor_membership.sql`, `20261007120100_supervisor_daily_sheet.sql`.

## Worker payroll refinement

The [first implementation increment](../worker-payroll-refinement.md) documents fixed operator approval, production applicability snapshots, prospective zero-rate resolution and the remaining incentive/costing scope.

## Historical reference

The June 2026 [`USER_WORKFLOWS.md`](../../USER_WORKFLOWS.md), [`TECHNICAL_ANALYSIS.md`](../../TECHNICAL_ANALYSIS.md), and [`TESTING_GUIDE.md`](../../TESTING_GUIDE.md) describe an earlier product. Previous scope and QA records in this directory remain for audit context; they do not define current routes or plan access.

- [Base manual production incentives](../base-manual-incentives.md) — approved positive earnings, receipts and reversal.
