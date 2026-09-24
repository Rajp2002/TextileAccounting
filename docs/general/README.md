# Weavly Documentation Index

The current subscription plans are **Free, Lite, and Base**. The active product routes and entitlement rules live in [`lib/subscription-access.ts`](../../lib/subscription-access.ts), [`lib/owner-navigation.ts`](../../lib/owner-navigation.ts), and the Next.js `app` directory. Older documents in this folder describe previous product scopes and are historical reference only.

## Current owner workspace

- Free: `/free`, `/free/costings`, `/free/account`, `/free/billing`.
- Lite: `/owner/estimator`, `/owner/quotes`, `/owner/rates`, `/owner/settings`, `/owner/billing`.
- Base: Lite features plus `/owner/production`, `/owner/assignments`, `/owner/stock`, `/owner/dispatches`, `/owner/machines`, `/owner/workers`, and `/owner/payroll`.
- Public plan comparison: `/plans`.

Plan prices and checkout eligibility are defined in [`lib/billing-constants.ts`](../../lib/billing-constants.ts) and [`lib/billing-lifecycle.ts`](../../lib/billing-lifecycle.ts). The retirement migration is [`20260924085030_retire_full_suite_tier.sql`](../../supabase/migrations/20260924085030_retire_full_suite_tier.sql).

## Historical reference

The June 2026 [`USER_WORKFLOWS.md`](../../USER_WORKFLOWS.md), [`TECHNICAL_ANALYSIS.md`](../../TECHNICAL_ANALYSIS.md), and [`TESTING_GUIDE.md`](../../TESTING_GUIDE.md) describe an earlier product. Previous scope and QA records in this directory remain for audit context; they do not define current routes or plan access.
