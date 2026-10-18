# Base Go-Live at the Next Pay-Cycle Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Base factory goes live on the start of its next pay cycle. Before then it can set up but not record. From go-live on, production, payroll, orange stock and challans are live, and everything earlier is paper and legacy stock.

**Architecture:**
- **Stored date:** one date, `organizations.base_go_live_date`, which is always a pay-cycle boundary from the factory's own rule. It is set by a service-role RPC, called from a server action that picks the date with the TypeScript cycle engine.
- **Database guards:** table triggers refuse records dated before go-live (production batches, assignments, loom qualities, days off, incentives, settlements). Fixed salary starts at go-live in both the TypeScript and SQL payroll paths.
- **Screens:** setup-phase pages keep rendering the real page so tours keep their anchors, with a banner and disabled actions.

**Tech Stack:** Next.js 16 server actions, Supabase Postgres (plpgsql triggers and RPCs), Vitest (unit, source-contract, `npm run test:db`), `lib/payroll-cycle-engine.ts`, `decimal.js`.

**Spec:** `docs/superpowers/specs/2026-10-15-base-go-live-design.md`

**Departures from the spec (deliberate):**
1. **Database guards are table triggers, not edits inside each RPC.** Section 2 of the spec lists functions. A trigger on the table covers every writer of that table, including those RPCs, with one function and no fragile anchor patches.
2. **Setup screens keep the real page with a banner and disabled actions,** instead of replacing the content with a "Starts on" notice. Tours anchor to real components (`fabric.opening`, the daily sheet), and a new factory is exactly who runs them. The daily sheet in setup shows a read-only preview of the go-live date. The spec's "Opening stock is hidden" becomes "Opening stock is disabled with a note".
3. **The backfill takes the earliest Base record of any kind,** not only the first production day. Fixed-salary-only factories and assignment Undo would otherwise break (Review Focus 4 and 5).

## Global Constraints

- Go-live is always a cycle boundary from the active `base_payroll_cycle_configs` rule. If today is a boundary, go-live is today.
- "Setup" means `base_go_live_date IS NULL OR base_go_live_date > IST today`. "Live" means `base_go_live_date <= IST today`.
- Rescheduling is allowed only while go-live is in the future, and only to a boundary from `goLiveOptions`. Go-live never moves earlier than the next boundary, and never into the past.
- Every new SQL function uses `SECURITY DEFINER` and `SET search_path = ''`, takes its org from `auth.uid()` or from a service-role caller, and has explicit `REVOKE`/`GRANT`.
- There is one migration file, `supabase/migrations/20261015140000_base_go_live.sql`, written as a file only. Never run `supabase db push` or any linked command.
- Business dates use `getSuratTodayString()` in TypeScript and `(now() AT TIME ZONE 'Asia/Kolkata')::date` in SQL.
- All new copy goes in English, Hindi and Gujarati (`lib/i18n/locales/{en,hi,gu}.ts`, namespace `goLive`). English copy is fixed in Task 7.
- UI follows `design.md`: ink primary actions, no nested cards, 44px controls on mobile. The setup state never replaces a page that a tour anchors. It adds a banner and disables actions.
- `npm run lint` stays at 0 warnings.

## Review Focus

1. **The owner changes the pay cycle during setup.** Go-live must move to the next boundary of the new rule, not keep the old date. Tested in Task 5.
2. **Today is a cycle boundary.** Scheduling must make the factory live today, with the daily sheet open and no banner. Tested in Tasks 1 and 3.
3. **Monthly anchor 31 in a 30-day month.** Go-live must follow the engine's month-end fallback, for example 30 Nov rather than 1 Dec. Tested in Task 1.
4. **An existing Base factory with only fixed-salary staff and no production.** The backfill must still give it a go-live (from its settlements or days off), so its settlement and days off keep working. Tested in Task 2.
5. **An existing factory's assignment Undo** re-inserts a row with an `effective_from` older than its first production. The backfill takes the earliest date across assignments and loom qualities, so the trigger does not refuse it. Tested in Task 2.

---

### Task 1: Pure go-live helpers

**Files:**
- Create: `lib/base-go-live.ts`
- Test: `__tests__/base-go-live.test.ts`

**Interfaces:**
- Produces:
  - `nextGoLiveDate(today: string, rule: PayrollCycleRule): string`
  - `goLiveOptions(today: string, rule: PayrollCycleRule, count = 4): string[]`, where the first item is `nextGoLiveDate`
  - `goLivePhase(today: string, goLive: string | null): 'unscheduled' | 'setup' | 'live'`
  - `effectiveDateFor(today: string, goLive: string | null): string`, the later of the two (`today` when `goLive` is null)
  - `type GoLiveReadiness = { loomsTotal: number; loomsWithQuality: number; staffed: { day: number; night: number }; legacy: { state: 'none' | 'stale' | 'fresh'; countedOn: string | null } }`
  - `goLiveReadiness(input: { goLive: string; machines: { id: string }[]; jobContexts: { machine_id: string; active: boolean; effective_from: string; effective_to: string | null }[]; assignments: { machine_id: string; shift: 'day' | 'night'; active: boolean; effective_from: string; effective_to: string | null }[]; legacyCounts: { basis: 'unknown' | 'estimated' | 'counted'; basis_at: string | null }[] }): GoLiveReadiness`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { nextGoLiveDate, goLiveOptions, goLivePhase, effectiveDateFor, goLiveReadiness } from '../lib/base-go-live'

const monthly1 = { type: 'monthly', anchorDay: 1 } as const
describe('nextGoLiveDate', () => {
    it('is the next monthly boundary mid-cycle', () => expect(nextGoLiveDate('2026-10-24', monthly1)).toBe('2026-11-01'))
    it('is today on a boundary', () => expect(nextGoLiveDate('2026-11-01', monthly1)).toBe('2026-11-01'))
    it('follows a mid-month anchor', () => expect(nextGoLiveDate('2026-10-03', { type: 'monthly', anchorDay: 16 })).toBe('2026-10-16'))
    it('falls back at month end for anchor 31', () => expect(nextGoLiveDate('2026-11-05', { type: 'monthly', anchorDay: 31 })).toBe('2026-11-30'))
    it('handles weekly', () => expect(nextGoLiveDate('2026-10-15', { type: 'weekly', anchorWeekday: 'monday' })).toBe('2026-10-19'))
})
it('lists the next boundaries', () => expect(goLiveOptions('2026-10-24', monthly1, 3)).toEqual(['2026-11-01', '2026-12-01', '2027-01-01']))
it('classifies phases', () => {
    expect(goLivePhase('2026-10-24', null)).toBe('unscheduled')
    expect(goLivePhase('2026-10-24', '2026-11-01')).toBe('setup')
    expect(goLivePhase('2026-11-01', '2026-11-01')).toBe('live')
})
it('dates setup changes from go-live', () => {
    expect(effectiveDateFor('2026-10-24', '2026-11-01')).toBe('2026-11-01')
    expect(effectiveDateFor('2026-11-05', '2026-11-01')).toBe('2026-11-05')
    expect(effectiveDateFor('2026-10-24', null)).toBe('2026-10-24')
})
```

Add a `goLiveReadiness` test with 3 machines:

- **Qualities:** 2 have an active job context valid on go-live. Expect `loomsWithQuality: 2`.
- **Staffing:** 2 have day assignments and 1 has a night assignment valid on go-live; the night row has `active: false`. Expect `staffed: { day: 2, night: 0 }`.
- **Legacy count:**
  - `basis_at` 2026-10-20 with go-live 2026-11-01 gives `legacy: { state: 'stale', countedOn: '2026-10-20' }`.
  - `basis_at` 2026-10-31 gives `'fresh'`.
  - No `counted`/`estimated` rows gives `'none'`.
  - Fresh means `countedOn >= goLive - 1 day`. When there are several qualities, use the oldest count date.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run __tests__/base-go-live.test.ts`
Expected: FAIL. Cannot resolve `../lib/base-go-live`.

- [ ] **Step 3: Implement `lib/base-go-live.ts`**

Use `getBoundaryOnOrBefore` and `getNextBoundary` from `lib/payroll-cycle-engine.ts`: today if `getBoundaryOnOrBefore(today, rule) === today`, else `getNextBoundary(getBoundaryOnOrBefore(today, rule), rule)`. Options repeat `getNextBoundary`. Validity on a date uses the same rule as `isContextValidForDate` in `BaseDailyProductionSheet.tsx` (`effective_from <= d && (!effective_to || effective_to >= d)`), plus `active`. Date maths uses the engine's `addDays`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/base-go-live.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/base-go-live.ts __tests__/base-go-live.test.ts
git commit -m "Add Base go-live date helpers"
```

---

### Task 2: Go-live column, backfill and scheduling RPC

**Files:**
- Create: `supabase/migrations/20261015140000_base_go_live.sql` (section 1)
- Modify: `__tests__/db/helpers.ts:44` (`SeedOptions` and `seedOwnerOrg`)
- Test: `__tests__/db/base-go-live.dbtest.ts`

**Interfaces:**
- Produces (SQL):
  - Columns `organizations.base_go_live_date date`, `base_go_live_set_at timestamptz`, `base_go_live_set_by uuid REFERENCES auth.users(id) ON DELETE SET NULL`.
  - `private.base_go_live_date(p_org uuid) RETURNS date`, STABLE.
  - `private.backfill_base_go_live() RETURNS integer`, the number of orgs updated. The migration calls it once.
  - `public.schedule_base_go_live(p_org_id uuid, p_go_live date, p_actor uuid) RETURNS date`, EXECUTE granted to `service_role` only.
  - `public.get_supervisor_go_live() RETURNS date`, granted to `authenticated`, org from `private.active_supervisor_org()`.
- Produces (tests): `SeedOptions.goLive?: string | null`. The default is `'2000-01-01'`, so existing db tests are unaffected. Pass `null` for an unscheduled org.

- [ ] **Step 1: Add the `goLive` seed option**

After the org insert, run `UPDATE public.organizations SET base_go_live_date = $2 WHERE id = $1` when `options.goLive !== null` (default `'2000-01-01'`).

- [ ] **Step 2: Write failing db tests in `__tests__/db/base-go-live.dbtest.ts`**

Call `schedule_base_go_live` through `asServiceRole`.

- `it('schedules a future boundary and moves the cycle start')`:
  - Seed with `goLive: null` and insert an active `base_payroll_cycle_configs` row with `effective_from` = today.
  - Schedule today + 10.
  - Expect the returned date, `base_go_live_date`, `base_go_live_set_by` = the owner, and the config's `effective_from` = today + 10.
- `it('refuses a past date')`: code `22023`.
- `it('refuses once go-live has passed')`: set go-live to today, then reschedule. Code `55000`.
- `it('refuses when production exists')`: seed `goLive` = today + 10, insert a `base_production_batches` row as superuser with `production_date` = today + 10 (allowed by the Task 3 trigger), then reschedule to the next option. Code `55000`.
- `it('refuses authenticated callers')`: as owner, code `42501`.
- `it('backfills from the earliest Base record')`: seed four `goLive: null` orgs and check `private.backfill_base_go_live()` (Review Focus 4 and 5):
  1. Batch 2026-09-10 plus an assignment with `effective_from` 2026-09-02: go-live is 2026-09-02.
  2. Only a fixed-salary settlement with `period_start` 2026-08-01: go-live is 2026-08-01.
  3. Only a day off on 2026-09-05: go-live is 2026-09-05.
  4. No Base rows: go-live stays NULL.
- `it('tells an approved supervisor the go-live date')`: `seedSupervisor` then `asSupervisor`, and `get_supervisor_go_live()` equals the org's date.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:db -- __tests__/db/base-go-live.dbtest.ts`
Expected: FAIL. Function `schedule_base_go_live` does not exist.

- [ ] **Step 4: Write section 1 of the migration**

Backfill source dates, taking the `least()` per org:

- min `base_production_batches.production_date`
- min `base_production_entries.production_date`
- min `base_worker_machine_assignments.effective_from`
- min `base_machine_job_contexts.effective_from`
- min `base_payroll_settlements.period_start`
- min `base_staff_days_off.off_date`
- min `base_worker_incentives.service_start`

Only update orgs where `base_go_live_date IS NULL`.

`schedule_base_go_live` does the following:

1. Takes `pg_advisory_xact_lock(hashtextextended(p_org_id::text || ':base-go-live', 0))`.
2. Raises `22023` 'Go-live cannot be in the past.' when `p_go_live` is before IST today.
3. Raises `55000` 'Daily recording has already started.' when the current date is `<=` today.
4. Raises `55000` 'Production is already recorded.' when any batch, entry or allocation exists.
5. Updates the three columns, then `UPDATE base_payroll_cycle_configs SET effective_from = p_go_live, updated_at = now() WHERE org_id = p_org_id AND effective_until IS NULL`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:db -- __tests__/db/base-go-live.dbtest.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261015140000_base_go_live.sql __tests__/db/helpers.ts __tests__/db/base-go-live.dbtest.ts
git commit -m "Add Base go-live date, backfill and scheduling RPC"
```

---

### Task 3: Database guards before go-live

**Files:**
- Modify: `supabase/migrations/20261015140000_base_go_live.sql` (section 2)
- Test: `__tests__/db/base-go-live.dbtest.ts`

**Interfaces:**
- Consumes: `private.base_go_live_date(uuid)` and the `goLive` seed option (Task 2).
- Produces:
  - `private.guard_base_go_live() RETURNS trigger`, one function that reads the date column per `TG_TABLE_NAME`.
  - Triggers named `guard_base_go_live`.

| Table | Event | Date checked | Null go-live |
| --- | --- | --- | --- |
| `base_production_batches` | BEFORE INSERT OR UPDATE OF production_date | `production_date` | refuse: `22023` 'Schedule daily recording before saving production.' |
| `base_worker_machine_assignments` | BEFORE INSERT | `effective_from` | allow |
| `base_machine_job_contexts` | BEFORE INSERT | `effective_from` | allow |
| `base_staff_days_off` | BEFORE INSERT | `off_date` | allow |
| `base_worker_incentives` | BEFORE INSERT | `service_start` | allow |
| `base_payroll_settlements` | BEFORE INSERT | `period_end` | allow |

A date before go-live raises `22023` 'Daily recording starts on YYYY-MM-DD.' (`to_char(go_live, 'YYYY-MM-DD')`).

- [ ] **Step 1: Write the failing db tests**

Seed with `goLive: today + 7` unless noted.

- `it('refuses production before go-live and without one')`:
  - Call `save_base_daily_production_reviewed` as owner for today: `22023`.
  - Do the same on a `goLive: null` org: `22023` with the 'Schedule daily recording' message.
- `it('accepts production on go-live day')`: seed `goLive` = today, with a worker, machine, job context and assignment. Save today and it succeeds.
- `it('refuses assignments, qualities and rotations before go-live')`:
  - `set_base_machine_job_context(machine, job, today)`: `22023`.
  - The same with today + 7: succeeds.
  - `upsert_base_worker_machine_assignment(..., today, ...)`: `22023`.
  - `rotate_base_worker_shifts(array[worker], today)`: `22023`.
- `it('refuses days off and incentives before go-live')`: on a fixed worker, `set_base_staff_day_off` for yesterday is `22023`, and `create_base_worker_incentive` with `service_start` yesterday is `22023`.
- `it('refuses a supervisor save before go-live')`: approved supervisor, `save_supervisor_daily_sheet` for today is `22023`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:db -- __tests__/db/base-go-live.dbtest.ts`
Expected: the new tests FAIL (saves succeed).

- [ ] **Step 3: Write section 2 (trigger function and six triggers)**

- [ ] **Step 4: Run the whole db suite**

Run: `npm run test:db`
Expected: PASS, including `production-parity`, `supervisor-daily-sheet`, `base-shift-rotation`, `payroll-settlement` and `base-staff-days-off`, which rely on the `'2000-01-01'` seed default.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261015140000_base_go_live.sql __tests__/db/base-go-live.dbtest.ts
git commit -m "Refuse Base records dated before go-live"
```

---

### Task 4: Fixed salary starts at go-live

**Files:**
- Modify: `supabase/migrations/20261015140000_base_go_live.sql` (section 3)
- Modify: `lib/base-production-core.ts:503-532` (`calculateBaseWorkerPayables`)
- Modify: `app/(dashboard)/owner/production/BaseProductionClient.tsx:179` (pass `goLiveDate`)
- Test: `__tests__/base-salary-go-live.test.ts`, `__tests__/db/base-go-live.dbtest.ts`

**Interfaces:**
- Consumes: `initialData.goLiveDate: string | null` (Task 6 adds it to the loader. Until then, pass `null`).
- Produces: `calculateBaseWorkerPayables({ ..., goLiveDate?: string | null })`. For a fixed worker with no prior settlement, the period start becomes the later of `worker.start_date` and `goLiveDate` (line 530 today uses `worker.start_date ?? periodEnd`). Piece-rate behaviour is unchanged.

- [ ] **Step 1: Write the failing unit test**

```ts
it('starts fixed salary at go-live for a long-serving worker', () => {
    const [payable] = calculateBaseWorkerPayables({ workers: [fixedWorker({ start_date: '2019-04-01', monthly_salary: 30000 })],
        entries: [], advances: [], settlements: [], periodEnd: '2026-11-30', goLiveDate: '2026-11-01' })
    expect(payable.period_start).toBe('2026-11-01')
    expect(payable.gross_pay).toBe(30000)
})
it('keeps a joining date after go-live', () => { /* start_date 2026-11-10 → period_start '2026-11-10' */ })
```

`fixedWorker` builds a minimal `BaseProductionWorker` with `pay_type: 'fixed_monthly'` and `salary_history: [{ effective_from: start_date, monthly_salary }]`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/base-salary-go-live.test.ts`
Expected: FAIL. `period_start` is `'2019-04-01'`.

- [ ] **Step 3: Implement the TypeScript change and pass `goLiveDate` from `BaseProductionClient`**

- [ ] **Step 4: Write the failing db parity test**

`it('settles fixed salary from go-live')`:

1. Seed with `goLive` = the first day of last month and a fixed worker with `start_date` '2019-04-01'.
2. Build `expected` with `calculateBaseWorkerPayables({ ..., goLiveDate })` and `basePayrollReview`, using the `preview` pattern from `base-staff-days-off.dbtest.ts`.
3. Call `settle_base_worker_payroll_reviewed`.

It should succeed, and the settlement's `period_start` should equal go-live.

- [ ] **Step 5: Write section 3 (patch the SQL period start)**

Follow the anchor-patch pattern in `20261014160000_base_staff_days_off.sql:115-123`, and raise if the anchor count is not 1.

- Function: `public.settle_base_worker_payroll(uuid,date,text)`.
- Replace `coalesce(max(period_end) + 1, v_salary_worker.start_date)` with `coalesce(max(period_end) + 1, greatest(v_salary_worker.start_date, coalesce(private.base_go_live_date(v_org_id), v_salary_worker.start_date)))`.
- If the anchor is not found in the live definition, read `pg_get_functiondef` in the test database. Then match the current text exactly. Do not loosen the assertion.

- [ ] **Step 6: Run both tests**

Run: `npx vitest run __tests__/base-salary-go-live.test.ts && npm run test:db -- __tests__/db/base-go-live.dbtest.ts __tests__/db/base-staff-days-off.dbtest.ts __tests__/db/payroll-settlement.dbtest.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/base-production-core.ts "app/(dashboard)/owner/production/BaseProductionClient.tsx" supabase/migrations/20261015140000_base_go_live.sql __tests__/base-salary-go-live.test.ts __tests__/db/base-go-live.dbtest.ts
git commit -m "Start fixed salary at go-live"
```

---

### Task 5: Scheduling server actions

**Files:**
- Create: `lib/base-go-live.server.ts`
- Modify: `app/(auth)/onboarding/base/actions.ts:632` (`completeBaseOnboardingAction`)
- Modify: `app/(dashboard)/owner/production/actions.ts:1442` (`saveBasePayrollCycleConfig`)
- Modify: `app/(dashboard)/owner/production/actions.ts`: add `scheduleBaseGoLiveAction`
- Test: `__tests__/base-go-live-scheduling.test.ts` (source contract)

**Interfaces:**
- Consumes: `nextGoLiveDate` and `goLiveOptions` (Task 1), and `schedule_base_go_live` (Task 2).
- Produces (`lib/base-go-live.server.ts`, which imports `'server-only'`):
  - `getBaseGoLiveState(orgId: string): Promise<{ goLive: string | null; phase: 'unscheduled' | 'setup' | 'live'; options: string[] }>`. It reads the org column and the active cycle rule with the admin client. `options` is empty when live or when no cycle exists.
  - `scheduleBaseGoLiveForOrg(orgId: string, actorId: string, goLive: string): Promise<{ goLive: string } | { error: string }>`. It refuses any `goLive` not in `goLiveOptions(getSuratTodayString(), rule)` with 'Choose one of the listed start dates.', then calls the RPC with the admin client.
- Produces (actions): `scheduleBaseGoLiveAction(goLive: string): Promise<{ goLive: string } | { error: string }>`. It checks `requireWritableOrg(['owner'])` and the `production_management` capability, then `revalidatePath` for `/owner/production`, `/owner/production/daily-sheet`, `/owner/payroll`, `/owner/assignments`, `/owner/stock` and `/owner/dispatches`.

- [ ] **Step 1: Write the failing source-contract tests**

Read each file with `readFileSync` and assert:

- `completeBaseOnboardingAction` calls `scheduleBaseGoLiveForOrg(` with `nextGoLiveDate(`.
- `saveBasePayrollCycleConfig` calls `getBaseGoLiveState(`, and calls `scheduleBaseGoLiveForOrg(` with `nextGoLiveDate(` when the phase is not `'live'` (Review Focus 1).
- `scheduleBaseGoLiveAction` contains `requireWritableOrg` and `hasCapability(`.
- `lib/base-go-live.server.ts` starts with `import 'server-only'` and contains `rpc('schedule_base_go_live'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/base-go-live-scheduling.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the server module and the three call sites**

The wizard's cycle step keeps `p_effective_from: today`. Scheduling then moves it to go-live (Task 2 RPC). A scheduling failure in `completeBaseOnboardingAction` is logged and does not fail completion, because the production page's "Schedule daily recording" card recovers it.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run __tests__/base-go-live-scheduling.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/base-go-live.server.ts "app/(auth)/onboarding/base/actions.ts" "app/(dashboard)/owner/production/actions.ts" __tests__/base-go-live-scheduling.test.ts
git commit -m "Schedule Base go-live from setup and pay-cycle changes"
```

---

### Task 6: Load go-live and date setup changes from it

**Files:**
- Modify: `app/(dashboard)/owner/production/loaders.ts:39-45,184` (add `goLiveDate` and `goLivePhase` to `BaseProductionInitialData`; select `base_go_live_date`)
- Modify: `app/(dashboard)/owner/assignments/loaders.ts:46` (`effectiveDate = effectiveDateFor(today ?? getSuratTodayString(), goLive)`)
- Modify: `app/(dashboard)/owner/production/actions.ts:573` (rotate uses `effectiveDateFor(getSuratTodayString(), goLive)`, read with `getBaseGoLiveState`)
- Modify: `app/(dashboard)/owner/production/MachineQualityDialog.tsx:67-70`, `BaseActiveQualities.tsx:264,277` (use the effective date passed in, not `today`)
- Modify: `app/(dashboard)/owner/dispatches/challan-actions.ts:76` (`mutateChallan` refuses when the phase is not `'live'`)
- Test: `__tests__/base-go-live-dates.test.ts` (source contract)

**Interfaces:**
- Consumes: `effectiveDateFor` (Task 1) and `getBaseGoLiveState` (Task 5).
- Produces:
  - `BaseProductionInitialData.goLiveDate: string | null`
  - `BaseProductionInitialData.goLivePhase: 'unscheduled' | 'setup' | 'live'`
  - `BaseProductionInitialData.effectiveDate: string`. The quality and assignment surfaces use this where they used `initialData.today` as an effective or evaluation date.

  `BaseAssignmentWorkspace` already treats its `initialData.today` as the evaluation date, and the assignments loader passes `effectiveDate` into that field, so the workspace itself does not change.

- [ ] **Step 1: Write the failing source-contract tests**

Assert that:

- `assignments/loaders.ts` contains `effectiveDateFor(`.
- The rotate action no longer passes `p_effective_from: getSuratTodayString()`.
- `MachineQualityDialog.tsx` and `BaseActiveQualities.tsx` do not pass `effectiveFrom: today`.
- `mutateChallan` contains `getBaseGoLiveState(` and the refusal 'Challans open on'.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/base-go-live-dates.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

The challan refusal message is `Challans open on ${formatDateLabel(goLive)}.`, or `'Schedule daily recording first.'` when unscheduled.

- [ ] **Step 4: Run the touched tests**

Run: `npx vitest run __tests__/base-go-live-dates.test.ts && npx vitest run -t "assignment" && npx tsc --noEmit`
Expected: PASS. Update any source contract that asserted the old `effectiveFrom: today` text, deliberately.

- [ ] **Step 5: Commit**

```bash
git add -A "app/(dashboard)/owner" __tests__/base-go-live-dates.test.ts
git commit -m "Date setup changes from go-live and close challans until then"
```

---

### Task 7: Owner screens in setup

**Files:**
- Create: `app/(dashboard)/owner/production/BaseGoLiveSetupCard.tsx`
- Modify: `app/(dashboard)/owner/production/BaseProductionClient.tsx` (render the card on the overview, `view === 'production' && !isDailySheetView`, while the phase is not `'live'`, in place of `BaseProductionTodayBand`; add a payroll banner and disable settlement while not live)
- Modify: `app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx`. In setup:
  - `productionDate` starts at `goLiveDate` and the date control is disabled
  - all reading inputs and save are disabled
  - a banner shows `sheetPreview`
  - when unscheduled, show the banner only
- Modify: `app/(dashboard)/owner/stock/QualityStockClient.tsx:170`. The Opening stock button stays rendered with `data-tour-anchor="fabric.opening"`, is disabled in setup, and shows `openingDisabled` beneath it.
- Modify: `app/(dashboard)/owner/dispatches/ChallansClient.tsx`. Show the `challansStart` banner and disable the new-challan action in setup.
- Modify: `app/(dashboard)/owner/stock/page.tsx` and `app/(dashboard)/owner/dispatches/page.tsx` (load the phase with `getBaseGoLiveState`)
- Modify: `lib/i18n/locales/en.ts`, `hi.ts`, `gu.ts` (the `goLive` namespace)
- Test: `__tests__/base-go-live-surfaces.test.ts` (source contract), plus the existing tour guards

**Interfaces:**
- Consumes: `goLiveReadiness` (Task 1), `scheduleBaseGoLiveAction` (Task 5), `initialData.goLiveDate`/`goLivePhase` (Task 6), and the legacy stock rows already loaded on the stock page. Add a `legacy_stock` read (`basis`, `basis_at`) to the production loader for readiness.
- Produces: `BaseGoLiveSetupCard({ phase, goLive, options, readiness }: { phase: 'unscheduled' | 'setup'; goLive: string | null; options: string[]; readiness: GoLiveReadiness | null })`.
  - Unscheduled: it shows `scheduleTitle`/`scheduleBody` and an ink `scheduleAction` button for `options[0]`.
  - Setup: it shows `setupCardTitle`/`setupCardBody`, a "Change date" select over `options` with a save, and the three readiness lines.

English copy (`goLive` namespace; `{date}` uses `formatDateLabel`):

```ts
setupCardTitle: 'Daily recording starts {date}',
setupCardBody: 'Until then, set up looms and workers. Pay for days before {date} stays on paper, and fabric already in the godown is legacy stock.',
changeDate: 'Change date',
readinessQualities: '{count} of {total} looms have a quality',
readinessStaffed: 'Day: {day} of {total} looms staffed · Night: {night} of {total}',
readinessLegacyNone: 'Count untagged fabric as legacy stock the evening before or on {date}',
readinessLegacyStale: 'Counted {counted}. Recount near {date}',
readinessLegacyFresh: 'Legacy stock counted {counted}',
scheduleTitle: 'Schedule daily recording',
scheduleBody: 'Recording starts at the beginning of your next pay cycle: {date}.',
scheduleAction: 'Start on {date}',
sheetPreview: 'Preview of {date}. Readings open on that day.',
payrollStarts: 'The first pay cycle in Weavly starts {date}. Pay before that stays on paper.',
challansStart: 'Challans open on {date}. Until then, dispatch on paper from legacy stock.',
openingDisabled: 'Old fabric is legacy stock. Record it with a legacy count.',
supervisorStarts: 'Daily recording starts {date}.',
wizardStarts: 'Daily recording starts {date}.',
```

Hindi and Gujarati: write natural translations in the same keys. The owner reviews them later.

- [ ] **Step 1: Write the failing source-contract tests**

Assert that:

- `BaseProductionClient.tsx` renders `BaseGoLiveSetupCard`.
- `BaseDailyProductionSheet.tsx` references `goLivePhase` and `sheetPreview`.
- `QualityStockClient.tsx` still contains `data-tour-anchor="fabric.opening"` and contains `openingDisabled`.
- `ChallansClient.tsx` contains `challansStart`.
- All 17 keys exist in each of `en.ts`, `hi.ts` and `gu.ts`.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run __tests__/base-go-live-surfaces.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the card, banners, disabled states and copy**

- [ ] **Step 4: Run the surface and tour tests**

Run: `npx vitest run __tests__/base-go-live-surfaces.test.ts __tests__/tour-real-page-guard.test.ts __tests__/daily-sheet-tour.test.ts __tests__/dispatch-tour.test.ts __tests__/phone-guidance-suppression.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -A "app/(dashboard)/owner" lib/i18n/locales __tests__/base-go-live-surfaces.test.ts
git commit -m "Show the setup phase on owner production, payroll, stock and challans"
```

---

### Task 8: Supervisor sheet and wizard review

**Files:**
- Modify: `app/supervisor/daily-sheet/page.tsx` (call `rpc('get_supervisor_go_live')` and pass `goLiveDate` down)
- Modify: `components/supervisor/SupervisorDailySheet.tsx` (when `goLiveDate` is null or after today: show the `supervisorStarts` banner, or `scheduleTitle` copy when null, and disable save)
- Modify: `components/onboarding/base/Step6Review.tsx` (show `wizardStarts` with `nextGoLiveDate(today, rule)`, from the cycle the wizard holds in its draft)
- Test: `__tests__/base-go-live-surfaces.test.ts` (extend)

**Interfaces:**
- Consumes: `public.get_supervisor_go_live()` (Task 2) and `nextGoLiveDate` (Task 1).

- [ ] **Step 1: Extend the contract test**

Assert that the supervisor page contains `get_supervisor_go_live`, `SupervisorDailySheet.tsx` contains `supervisorStarts`, and `Step6Review.tsx` contains `nextGoLiveDate(`.

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run __tests__/base-go-live-surfaces.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run __tests__/base-go-live-surfaces.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add app/supervisor components/supervisor components/onboarding/base __tests__/base-go-live-surfaces.test.ts
git commit -m "Show go-live on the supervisor sheet and wizard review"
```

---

### Task 9: Full verification and docs

**Files:**
- Modify: `CLAUDE.md` (Architecture: add a 2–3 sentence "Base go-live" paragraph naming `organizations.base_go_live_date`, `lib/base-go-live.ts` and the triggers in `20261015140000_base_go_live.sql`)

- [ ] **Step 1: Run every check**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run test:db`
Expected: no type errors, lint with 0 errors and 0 warnings, and all Vitest and db tests passing (1 skipped live test).

- [ ] **Step 2: Fix any source contract that broke, deliberately, and re-run the failing file**

- [ ] **Step 3: Update `CLAUDE.md` and commit**

```bash
git add CLAUDE.md
git commit -m "Document Base go-live"
```

- [ ] **Step 4: Report what was not verified**

Report each of these:

- The migration is unapplied. The owner applies it to production before deploy, and the app fails closed without it.
- No signed-in check against QA.
- Hindi and Gujarati copy is unreviewed.
