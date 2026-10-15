# Base go-live at the next pay-cycle start: design

Date: 2026-10-15. Status: design approved in chat, spec awaiting review.

## Purpose

A factory rarely joins Weavly on the first day of a pay cycle. Today the owner can
set everything up mid-cycle (say on 14 Oct), but the earlier days of that cycle
cannot be recorded: assignments, loom qualities and shift switches are all dated
from the day they were entered, so the daily sheet for 1 Oct finds no workers on
any loom. The earlier days were also never tagged orange, so they cannot be
orange stock.

Instead of backfilling, a factory goes live on the **start of its next pay
cycle**. Everything before that stays on paper: the current cycle is paid on
paper, and all fabric in the godown at go-live is legacy stock. From go-live on,
production, payroll, orange stock and challans are fully in Weavly.

## Decisions (agreed)

- Nothing is fixed to a calendar date. Go-live is always a pay-cycle start,
  worked out from the factory's own cycle rule (monthly on any anchor day, weekly,
  semi-monthly, interval cycles).
- Go-live is the next cycle start after setup finishes. If today is a cycle start,
  go-live is today.
- No backfill of production, assignments, dispatches or payroll before go-live.
- All fabric in the godown before go-live is legacy. Orange stock starts at 0 on
  go-live and only live production feeds it. This carries on past the first cycle;
  nothing switches off at month end.
- Factories already recording Base production are unaffected.

Considered and rejected: backfilling the current cycle from paper (a dated
assignment board, a catch-up view and keeping backfilled metres out of orange
stock). It solves the waiting period but costs far more, and it can be added
later on top of this design if factories ask for it.

The accepted cost is a setup wait of up to one cycle (0 to about 30 days for a
monthly cycle).

## 1. The go-live date

### Data

The migration adds to `public.organizations`:

- `base_go_live_date date`: null means not scheduled.
- `base_go_live_set_at timestamptz` and `base_go_live_set_by uuid`: audit.

Backfill: every org with saved Base production gets `base_go_live_date` = its
earliest production date (the minimum `production_date` across
`base_production_batches`, together with any legacy `base_production_entries`
date). Orgs with no production stay null.

### Scheduling

- Pure helper `lib/base-go-live.ts` (unit-tested), built on
  `lib/payroll-cycle-engine.ts`:
  - `nextGoLiveDate(today, rule)` returns `today` when today is a cycle boundary
    (`getBoundaryOnOrBefore(today) === today`), otherwise `getNextBoundary` of the
    period containing today.
  - `goLiveOptions(today, rule, count)` returns that date and the next few cycle
    starts, for "Change date".
  - `isBeforeGoLive(date, goLive)`.
- Server action `scheduleBaseGoLive(goLiveDate)`:
  - It checks `requireRole(['owner'])`, `requireWritableOrg`, and the Base
    `production_management` capability.
  - It reads the active `base_payroll_cycle_configs` rule and only accepts a date
    from `goLiveOptions`.
  - It then calls a `SECURITY DEFINER` RPC (`SET search_path = ''`) that is
    granted to `service_role` only, as with `start_lite_trial`.
- The RPC `public.schedule_base_go_live(p_org_id, p_go_live, p_actor)` (EXECUTE granted to `service_role` only)
  refuses when:
  - `p_go_live` is earlier than IST today
  - the org's current `base_go_live_date` is today or earlier (go-live has passed)
  - any Base production row exists for the org

  Otherwise it:
  - sets the three columns
  - sets the active pay-cycle config's `effective_from` to `p_go_live`, so
    payroll periods start cleanly at go-live
- Callers:
  - The Base setup wizard's completion (`app/(auth)/onboarding/base/actions.ts`,
    review step `components/onboarding/base/Step6Review.tsx`) schedules
    `nextGoLiveDate`. The review step shows "Daily recording starts <date>".
  - A Base org with `base_go_live_date` null (wizard done before this feature,
    no production) sees a "Schedule daily recording" card on the production
    overview that does the same.
  - "Change date" on the setup card picks a later option while go-live is in
    the future.
  - Saving a new pay cycle during setup reschedules go-live to
    `nextGoLiveDate` under the new rule.

## 2. Setup phase and date rules

"Setup" means `base_go_live_date` is null or later than IST today.

### Available during setup

Workers, machines, costings and qualities, the assignment board, Switch shifts,
payroll settings, advances, and the stock page for a legacy count.

### Not available until go-live

Each screen shows a short "Starts on <date>" state instead of its content:

- The owner daily sheet (`app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx`
  and its page) also shows the readiness list (below).
- The supervisor sheet (`app/supervisor/daily-sheet`). Joining through `/join`
  still works.
- Payroll settlement.
- Days off and incentives dated before go-live.
- Delivery challans.

### Effective dates for setup changes

Assignments, loom qualities (job contexts) and shift switches use
`max(today, go-live)` as their effective date instead of today. The places that
change are:

- `BaseAssignmentWorkspace.tsx` (`effectiveFrom: initialData.today`)
- `app/(dashboard)/owner/production/actions.ts` (rotate passes
  `getSuratTodayString()`)
- `MachineQualityDialog.tsx`
- `BaseActiveQualities.tsx`
- the assignments loader's evaluation date

After go-live this equals today, so live behaviour is unchanged. Changing an
assignment twice during setup replaces it under the existing rules (the old row
becomes inactive), so no history builds up before go-live.

### Database guards

Add a helper `private.base_go_live_date(org)`. Then:

- **Production.** The shared save core (`private.save_base_daily_production_reviewed_core`,
  reached by both the owner and supervisor paths) raises when
  `base_go_live_date` is null or `p_production_date < base_go_live_date`.
- **Assignments and loom qualities.** `upsert_base_worker_machine_assignment`,
  `rotate_base_worker_shifts` and the job-context setter raise when
  `p_effective_from < base_go_live_date`.
- **Days off.** `set_base_staff_day_off` raises for `p_off_date < base_go_live_date`.
- **Incentives.** `create_base_worker_incentive` raises for
  `service_start < base_go_live_date`.

The latest definition of each function is replaced in the new migration. Each
keeps `SECURITY DEFINER`, `SET search_path`, its org checks and its grants.

### Payroll

- **Fixed salary** accrues from `greatest(start_date, base_go_live_date)`. This
  goes in `calculateBaseSalaryLines` (`lib/base-salary.ts`) and in the SQL
  settlement and salary lines (`private.base_staff_salary_lines`, the fixed
  branch of `settle_base_worker_payroll`). Workers keep their real joining date.
  A worker who joins after go-live accrues from their joining date, as today.
- **Piece rate** needs no change: there is no production before go-live.
- **Advances** have no date. Money already advanced on paper is entered as
  outstanding advances, during setup or later. The first Weavly settlement
  recovers it under the existing 50% cap.
- **The first payslip** covers go-live to the end of that cycle.

## 3. Stock, screens, testing, rollout

### Stock

- All fabric before go-live is legacy. Production cannot be dated before
  go-live, so `private.reconcile_quality_stock` needs no change and orange stock
  starts at 0.
- The legacy count uses the existing legacy stock flow
  (`supabase/migrations/20261015120000_legacy_fabric_stock.sql`). The readiness
  list asks for a count close to go-live (the evening before or that morning).
  An earlier count is accepted but flagged "Counted <date>, recount near
  go-live". A count is not required: legacy may stay unknown, and legacy
  dispatches are never refused.
- The orange "Opening stock" tool is hidden during setup.
- Challans are closed until go-live. From go-live a line can come from orange or
  legacy stock, as now.

### Screens

- **Setup card** on the production overview while in setup. It shows:
  - the go-live date
  - "Change date" (later cycle starts only)
  - the readiness list:
    - looms with a quality
    - looms with a worker on each running shift
    - the legacy count status
- **Wizard review step:** the "Daily recording starts <date>" line.
- **"Starts on <date>" states** on the screens listed in section 2.
- **Copy:** all new copy in `lib/i18n` for English, Hindi and Gujarati, in
  layouts that tolerate longer Gujarati and Hindi text. Follow `design.md`: ink
  primary actions, no nested cards.
- **Guided tours:** they render sample data when an account is empty, and the
  setup state must not block that. `__tests__/tour-real-page-guard.test.ts` and
  the other tour guards must still pass.

### Testing

- **Unit tests:**
  - `lib/base-go-live.ts`:
    - next cycle start for monthly (anchor 1 and a mid-month anchor), weekly
      and semi-monthly
    - today being a boundary
    - the options list
  - The salary start rule in `lib/base-salary.ts`.
- **Database tests** (`__tests__/db`, `npm run test:db`):
  - Production is refused before go-live and with no go-live.
  - Assignment, rotation and job-context changes are refused before go-live.
  - Days off and incentives are refused before go-live.
  - `schedule_base_go_live` is refused for a past date, after go-live, and
    when production exists.
  - It moves the cycle config's `effective_from`.
  - The migration backfill sets go-live for orgs with production.
  - Salary starts at go-live.
- **Source-contract tests:**
  - the setup and "Starts on" states
  - search `__tests__/` for any strings and paths these changes touch, and
    update those contracts deliberately

### Rollout

- One migration (`supabase/migrations/20261015140000_base_go_live.sql`, renumbered if it collides at merge time), written as a
  file only. The owner applies it before the app deploys, and the app fails
  closed without it.
- Run `npm run lint`, `npx tsc --noEmit`, `npx vitest run` and `npm run test:db`
  before the PR.
- Signed-in check against QA and a Hindi/Gujarati review are owner follow-ups.

## Out of scope

- Backfilling any day before go-live (see the rejected approach above).
- Bringing go-live earlier than the next cycle start.
- Billing changes during the setup wait.
- Fixing the issue where ended assignment rows are marked inactive, so the
  arrangement before a replacement disappears from past-date sheets. Nothing in
  this design reads assignments before go-live, so it is unaffected.
