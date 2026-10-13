# Fixed-salary attendance calendar and unpaid days off: design

Date: 2026-10-14. Status: design approved in chat, spec awaiting review.

## Purpose

A fixed-salary worker's payroll breakdown today is one line per calendar month
("₹30,000 × 14/31 days = ₹13,548.39"). The owner cannot see which days were paid
and cannot stop paying for a day the worker did not come. This change turns the
breakdown into an attendance calendar that fills itself in, and lets the owner
mark a past day off so it is not paid.

## Decisions (agreed)

- Every day from the worker's joining date up to and including today is present
  automatically. Each new day becomes ticked when it arrives. Future days are
  never ticked ahead.
- The owner only records exceptions: they untick a specific past day to mark it
  off. Leaving for good still uses the existing last working day or archive.
- A day marked off is unpaid. Paid leave is out of scope.
- Weekly offs (Sundays) stay ticked and paid, as today, unless the owner
  unticks them.
- Day rate = monthly salary ÷ days in that calendar month (30 for September, 31
  for October), so a full month with no days off pays exactly the salary.
- Days in a paid settlement are locked. Reversing that payment unlocks them.
  Days inside a completed payroll period are locked until it is reopened.
- Only the owner can mark days off. Supervisors cannot.

## A. Database (one new migration, file only)

### Table `public.base_staff_days_off`

| Column | Type |
| --- | --- |
| `id` | uuid primary key, default `gen_random_uuid()` (stable paging for the loader and export) |
| `org_id` | uuid, not null, references `organizations` on delete cascade |
| `worker_id` | uuid, not null; `(org_id, worker_id)` references `base_production_workers(org_id, id)` on delete restrict |
| `off_date` | date, not null |
| `created_by` | uuid, not null, references `auth.users` |
| `created_at` | timestamptz, not null, default `now()` |

Unique `(org_id, worker_id, off_date)`. RLS enabled; `REVOKE ALL` from
`PUBLIC, anon, authenticated, service_role`; `GRANT SELECT` to `authenticated`
with a read policy `public.base_production_core_access(org_id)`; `GRANT SELECT`
to `service_role` for the owner archive. No direct writes.

### RPC `public.set_base_staff_day_off(p_worker_id uuid, p_off_date date, p_off boolean)`

`SECURITY DEFINER`, `SET search_path = ''`, `REVOKE` from `PUBLIC, anon,
service_role`, `GRANT EXECUTE` to `authenticated`. Follows
`create_base_worker_incentive`:

1. Org from `profiles` where `id = auth.uid()` and role is owner; requires
   `base_production_core_access` and an organization that is not locked down.
2. Takes the per-worker payroll lock
   (`hashtextextended(org || ':base-payroll:' || worker, 0)`) so a day cannot
   change while that worker is being paid.
3. Refuses, each with a plain message:
   - worker not found in this org, or not `fixed_monthly`;
   - `p_off_date` after today (Asia/Kolkata);
   - before `start_date` or after `end_date`;
   - on or before the `period_end` of the worker's latest `paid` settlement;
   - inside a `settled` row of `base_payroll_periods` (reopen first).
4. `p_off = true` inserts the row with `ON CONFLICT DO NOTHING`. `p_off = false`
   deletes it. Both are idempotent. Returns `{ worker_id, off_date, off }`.

### Salary maths in Postgres

New `private.base_staff_salary_lines(p_org uuid, p_worker uuid, p_start date,
p_end date)` returns the same columns as `private.base_salary_lines` plus
`off_days integer`. For each salary-rate/calendar-month segment:
`paid_days = segment days − off days in the segment`,
`gross_pay = round(salary × paid_days / month_days, 2)`. It reads the worker's
`salary_history` and the days-off table itself, clamped to the worker's
employment dates as today's callers do.

The two callers switch to it, by asserted string replacement on
`pg_get_functiondef` (the existing pattern, failing loudly on drift):

- `public.settle_base_worker_payroll(uuid,date,text)`: the fixed-salary gross.
- `private.capture_base_payroll_settlement_lines()`: the snapshot lines. The
  line text gains the off count when non-zero, e.g.
  `2026-10-01 to 2026-10-14 (13/31 days, 1 off)`.

`settle_base_worker_payroll_reviewed` is untouched. It still compares the app's
reviewed amount with the server's, which now include days off on both sides.

A period whose every day is off has no earnings and is refused by the existing
"There are no earnings to settle for this period" rule.

### Owner archive

Add `base_staff_days_off` to `app/(dashboard)/owner/settings/data-export.ts`
(catalog, scoped query, schema-migration map pointing at the new migration) and
to the list in `__tests__/lite-archive-completeness.test.ts`.

## B. App maths (`lib/base-salary.ts`)

- `BaseProductionWorker` gains optional `days_off?: string[]` (ISO dates).
- `calculateBaseSalaryLines` subtracts days off within each segment and returns
  per line: `days` (now paid days), `offDays`, `offDates`, `monthDays`,
  `monthlySalary`, `dayRate` (display only, `monthlySalary / monthDays` rounded
  to 2 places), `grossPay` (`monthlySalary × days / monthDays`, rounded once,
  identical to Postgres).
- `calculateBaseWorkerPayables` needs no other change. It already sums
  `grossPay`.
- Loader (`app/(dashboard)/owner/production/loaders.ts`): when payroll is
  included, read `base_staff_days_off` (`worker_id, off_date`, org-scoped, paged
  through `readCompleteBaseRows`) and attach each worker's dates as `days_off`.

## C. Breakdown modal (fixed-salary workers)

In `BaseProductionClient.tsx` the fixed-salary branch of the breakdown dialog
becomes a new colocated component,
`app/(dashboard)/owner/production/BaseStaffAttendanceCalendar.tsx`:

- One block per calendar month the period touches, in order.
- Block heading: `October 2026 · ₹30,000 ÷ 31 days ≈ ₹967.74 a day`. The "≈" is
  there because the shown day rate is rounded while pay is exact, so day rate ×
  days can differ from the total by a few paise.
- A Monday-first 7-column grid of every date in that month:
  - in the period and up to today: a tick (present) or "Off" (muted);
  - outside the period (already paid, before joining, after leaving) or in the
    future: faded, no mark, not tappable.
- Tapping a present day marks it off; tapping an off day restores it. Each tap
  calls a server action, shows that cell as pending, and refreshes payroll data
  on success. On error the cell reverts and the error shows under the grid. No
  confirmation step.
- Block footer: `13 days worked · 1 off → ₹12,580.65`.
- Below the blocks: the period total, which equals the base pay on the worker
  card.
- A paid period shows the same calendar read-only with a `Paid · days locked`
  note.
- Cells are at least 44px tall on phones (`min-h-[44px]`; the phone root font is
  14px) and 7 columns fit a 360px screen.
- The worker card's existing inline salary line also shows the off count when
  it is non-zero.

Server action `setBaseStaffDayOff({ workerId, offDate, off })` in
`app/(dashboard)/owner/production/actions.ts` validates input with zod,
re-checks owner role and writable org like the incentive actions, and calls the
RPC.

New strings go in `lib/i18n/payroll-breakdown-phrases.ts` (English, Hindi,
Gujarati). Hindi and Gujarati need native review before release, as for the
other payroll phrases.

## D. Testing

- Unit (`__tests__/base-fixed-salary.test.ts`): off days in one month; across
  two months; with a mid-month salary change; off dates outside the period or
  employment are ignored; a full month with none off equals the salary; payable
  gross drops by the day rate per off day.
- DB (`__tests__/db/`, new `base-staff-days-off.dbtest.ts`): each refusal in A;
  idempotent set/unset; settlement gross and snapshot lines subtract days off;
  reversing a payment unlocks its days; another org cannot read or write.
- Source-contract: update `__tests__/base-worker-machine-breakdown.test.ts` for
  the new fixed-salary branch; the migration contract (`SET search_path = ''`,
  grants); archive completeness.
- `npx tsc --noEmit`, `npm run lint`, and the touched vitest files locally; the
  DB tests run in CI.

## Rollout

The migration is a file only. It must be applied to production before this
deploys, because the payroll page reads the new table and the settlement calls
the new function. No data backfill: no days off means pay is unchanged.

## Out of scope

Paid leave, half days, marking future days, supervisor-entered attendance, and
attendance for piece-rate workers.
