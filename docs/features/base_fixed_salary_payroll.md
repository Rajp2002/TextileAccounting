# Base fixed-salary staff and monthly overhead

Implemented locally on 3 September 2026. Production migration/deployment has not been performed.

## Owner workflow

1. In Setup, choose **Add staff**, or choose **Fixed monthly salary** in Add worker.
2. Enter name, role, monthly salary and joining date. No machine assignment or production entry is required.
3. Payroll accrues salary through its selected period end. Review the dated salary breakdown, advance recovery and net payment; Mark paid uses the existing audited settlement workflow.
4. Settings → Monthly overhead automatically fills **Fixed Salary Factory Staff**, with a read-only amount and a person-by-person breakdown. Edit salaries in Setup, not in the calculator.

The linked row replaces the manual staff-salary preset; it is not added on top. Other custom expenses are preserved. Owners must remove any duplicate salaries they previously entered under custom expense names—those cannot be identified reliably by the application.

## Calculation and history rules

- Salary is prorated by actual calendar days in each month. Joining date and last working day are inclusive; there is no attendance deduction in this Base staff feature.
- Unpaid earnings carry across months. Each next settlement begins after the last non-reversed payment, or at joining date for a new staff member.
- A salary change requires an effective date from today onward, later than the previous salary rate and any paid period. Rate history is append-only and is managed by a database trigger.
- Paid earning lines preserve the salary rate, date segment and gross amount. Existing advances, 50% recovery cap, exact-value payment review, retry protection and audited reversal remain in use.
- Last working day is required when deactivating staff. Unpaid earnings through that date remain payable. A paid period cannot be shortened. Rehiring uses a separate employment record.
- Pay type and joining date cannot be changed after creation. Salaried production operators, mixed piece/salary pay, attendance, PF/ESI and additional payroll adjustments are outside this staff feature.
- Staff salaries do not contribute per-metre production wages or machine payroll totals. UI and database guards both prevent machine assignments and production entries for fixed staff.
- Overhead uses active staff's full monthly salary effective today, not net payout after advance recovery. Future hires/rates take effect when their dates arrive; leaving dates stop inclusion. Partial-period actual payroll is deliberately different from this normal-month budget.
- Salary changes refresh current factory defaults; reads also resolve date-effective rates. Monthly-expense mode re-derives cost per metre. A deliberate direct per-metre override is preserved. Saved costings/quotations are never rewritten.
- Staff edits use an optimistic timestamp check to reject stale forms. Payroll review and salary edits share the existing per-worker database lock.

## Release order

1. Review and apply `supabase/migrations/20260903162305_base_fixed_salary_payroll.sql` through the normal database release process.
2. Deploy the application changes. The updated loaders require the new columns, so application-first deployment is not supported.
3. Verify with an isolated QA owner: create staff, review a partial-month salary, record/reverse a payment, and inspect the overhead breakdown and salary PDF.

Existing workers default to piece rate. No existing payroll or production records are converted. Legacy Full Suite fixed-worker records are not copied into Base. The migration retains existing RLS and revoked direct settlement writes; helper functions are private and not callable through the Data API.

## Verification

- `npx tsc --noEmit --pretty false`
- `npx vitest run` (1,239 passed, one skipped at implementation verification)
- Targeted ESLint for changed code and `git diff --check`.
- `scripts/qa/base-fixed-salary-sql.mjs`: applies 15 real Base migrations to isolated PostgreSQL via PGlite 0.5.8, with minimal external schema fixtures. Tests reviewed settlement, retry, recovery/reversal, immutable salary lines, owner/supervisor/cross-tenant boundaries, overhead replacement/direct override, production rejection and leap-month proration. It does not contact a Supabase project.
- `scripts/qa/base-fixed-salary-preview.mjs`: local Vite preview of actual Setup, Payroll and MonthlyOverheadCalculator components with mocked actions/navigation. It is not a production route and never writes production data. Use `?view=operations`, `?view=payroll`, or `?view=overhead`.

The isolated checks supplement—not replace—a post-deployment authenticated smoke test against the target Supabase project.
