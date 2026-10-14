# Fixed-salary days off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fixed-salary staff get an automatic attendance calendar in the payroll breakdown; the owner unticks past days to make them unpaid, and both the app and the settlement pay salary × days worked ÷ days in month.

**Architecture:** Store exceptions only (`base_staff_days_off`). One owner RPC toggles a day. A new Postgres line function subtracts days off and replaces `private.base_salary_lines` in the settle function and the snapshot trigger by asserted string replacement. The TypeScript salary engine mirrors it; the loader attaches `days_off` to workers; a colocated calendar component renders the breakdown.

**Tech Stack:** Next.js 16 server actions, Supabase Postgres (plpgsql), decimal.js, Vitest, local disposable PostgreSQL for `__tests__/db`.

**Spec:** `docs/superpowers/specs/2026-10-14-fixed-salary-days-off-design.md`

## Global Constraints

- Migration is a file only: `supabase/migrations/20261014160000_base_staff_days_off.sql`. Never `supabase db push`.
- New RPC: `SECURITY DEFINER`, `SET search_path = ''`, fully qualified names, explicit `REVOKE`/`GRANT`.
- Pay per segment = `round(salary × paid_days / month_days, 2)`, rounded once, identical in TS and SQL.
- Snapshot line text: `<start> to <end> (<paid>/<month> days)` and `, <n> off` before `)` when n > 0.
- Copy (English): `Off`, `≈ {rate} a day`, `{n} days worked`, `{n} off`, `Paid · days locked`, `Tap a day to mark it off.`; Hindi + Gujarati in `lib/i18n/payroll-breakdown-phrases.ts`.
- Phone tap targets `min-h-[44px]`; grid fits 360px.
- `npm run lint` stays at 0 warnings.

## Review Focus

- A day off dated after the worker's last working day or before joining must not change pay (TS ignores it; SQL ignores it) — pinned in Task 1 and Task 2 tests.
- Toggling the same day twice in a row (double tap) must be idempotent — pinned in Task 2.
- Reversing a payment must let the owner edit those days again — pinned in Task 2.
- A period spanning a salary change and a month boundary with a day off in each segment — pinned in Task 1.
- The app-reviewed gross must equal the server gross with days off, or payment fails with "changed since review" — pinned in Task 2 (settle through the reviewed RPC using `calculateBaseWorkerPayables`).

---

### Task 1: Salary engine subtracts days off

**Files:**
- Modify: `lib/base-salary.ts`, `lib/base-production-core.ts` (`BaseProductionWorker` gains `days_off?: string[]`)
- Test: `__tests__/base-fixed-salary.test.ts`

**Interfaces:**
- Produces: `BaseSalaryLine = { start; end; days /* paid */; offDays: number; offDates: string[]; monthDays; monthlySalary; dayRate: number; grossPay }`; `calculateBaseSalaryLines(worker, start, end)` reads `worker.days_off`.

- [ ] Tests: `subtracts a day off at that month's day rate` (Oct 1–14, off Oct 5, ₹31,000 → days 13, offDays 1, grossPay 13000); `splits days off across months and salary changes` (Sep 23–Oct 14 at ₹30,000 with off Sep 25 and Oct 3 → [7000, 12580.65]); `ignores days off outside the period or employment`; `a full month with no days off equals the salary`; `payable gross drops by the day off`.
- [ ] Run, see FAIL. Implement. Run, see PASS. Commit.

### Task 2: Migration, RPC and DB tests

**Files:**
- Create: `supabase/migrations/20261014160000_base_staff_days_off.sql`, `__tests__/db/base-staff-days-off.dbtest.ts`
- Test: also a source-contract test `__tests__/base-staff-days-off-contract.test.ts` (search_path, grants, anchors asserted)

**Interfaces:**
- Produces: table `public.base_staff_days_off(org_id, worker_id, off_date, created_by, created_at)`; `public.set_base_staff_day_off(p_worker_id uuid, p_off_date date, p_off boolean) RETURNS jsonb`; `private.base_staff_salary_lines(p_org uuid, p_worker uuid, p_start date, p_end date)` returning `period_start, period_end, monthly_salary, paid_days, month_days, off_days, gross_pay`.

- [ ] DB tests: refuses future date, before joining, piece-rate worker, paid day, completed period, other org (22023/42501); idempotent set/unset; reviewed settlement with a day off pays `calculateBaseWorkerPayables` gross and the snapshot line text ends `, 1 off)`; reversal unlocks the day.
- [ ] Run `npx vitest run --config vitest.db.config.ts __tests__/db/base-staff-days-off.dbtest.ts`, see FAIL. Write migration. Run, PASS. Commit.

### Task 3: Loader, server action, archive

**Files:**
- Modify: `app/(dashboard)/owner/production/loaders.ts` (read `base_staff_days_off` when payroll is included; attach `days_off` per worker), `app/(dashboard)/owner/production/actions.ts` (`setBaseStaffDayOff({ workerId, offDate, off })`), `app/(dashboard)/owner/settings/data-export.ts`, `__tests__/lite-archive-completeness.test.ts`, `__tests__/production-scoped-loader.test.ts` if it enumerates payroll reads.
- [ ] Update contract tests first, see FAIL, implement, PASS, commit.

### Task 4: Attendance calendar in the breakdown modal

**Files:**
- Create: `app/(dashboard)/owner/production/BaseStaffAttendanceCalendar.tsx`
- Modify: `BaseProductionClient.tsx` (fixed-salary branch renders the calendar; card salary line shows off count), `lib/i18n/payroll-breakdown-phrases.ts`, `__tests__/base-worker-machine-breakdown.test.ts`
- Produces: `<BaseStaffAttendanceCalendar payable today paid onToggle pendingDates error />` — pure render of `payable.salary_lines` + period bounds; client owns the action call, pending set and `router.refresh()`.
- [ ] Static-markup test: renders a tick per present day, `Off` for off days, faded future days, footer `13 days worked`, and `Paid · days locked` when paid. FAIL, implement, PASS.
- [ ] `npx tsc --noEmit`, `npm run lint`, touched vitest files. Commit.

### Task 5: Ship

- [ ] Push branch, open PR noting the migration must be applied to production before merge/deploy, HI/GU review pending, no signed-in check.
