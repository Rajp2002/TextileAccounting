# Release 1: Activity Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record active minutes per owner per India day (by area and device) and the last-seen time, for every plan, in Weavly's own database.

**Architecture:** A client component counts active minutes on the device using a pure counter module and flushes them every 5 minutes, plus on hide or close, to `POST /api/analytics/activity`. The route verifies the owner session and calls a service-role-only `SECURITY DEFINER` function that clamps the minutes and upserts one row per org, user and day in a private table.

**Tech Stack:** Next.js 16 route handler, React 19 client component, zod, Supabase Postgres (plpgsql), Upstash rate limiting, Vitest (unit and `test:db`).

**Spec:** `docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md`, section A.

## Global Constraints

- Tracked: `profiles.role = 'owner'` only. Never supervisors, founder console routes, public pages or auth pages.
- An active minute = the document is visible and there was a `pointerdown`, `keydown`, `wheel`, `touchstart` or `scroll` within the last 60 seconds.
- Areas (fixed list): `estimator`, `saved_costings`, `rate_book`, `plan_billing`, `settings`, `support`, `other`.
- Devices: `phone`, `tablet`, `desktop`, plus `installed` (true when `display-mode: standalone` matches).
- Never send page content, form values, query strings, full URLs, user agents or device IDs. Never report to Sentry. Never use local storage.
- Flushes happen every 5 minutes and on `visibilitychange` to hidden or `pagehide`, only when at least 1 minute is pending. On failure, drop the minutes.
- Body: minutes 1–10, area values 0–10, at most 1 KB. Rate limit: 30 requests per 600 seconds per user.
- Day = `(now() AT TIME ZONE 'Asia/Kolkata')::date`. Daily cap 1440. Clamp per flush: `ceil(minutes since last_flush_at) + 1`, or 6 for the first flush of the day.
- Migrations are files only. Never run `supabase db push` or write to production.
- Run every test, type-check and lint command through `heavyq` (see `~/.claude/CLAUDE.md`). Lint must stay at zero warnings.
- Commits stay on this worktree branch. Don't push.

## Review Focus

- Two windows of the app open at once: minutes must not double. Covered by the per-user clamp DB test in Task 1.
- A tab left visible with no input (a factory office PC left on): it must record nothing. Covered by Task 2's idle test.
- A phone switching apps every few seconds: no request storm. Covered by Task 2's "no flush when nothing is pending" test.
- A session that ends mid-day (sign-out): `sendBeacon` gets 401 and minutes are dropped silently, with no console error loop. Covered by Task 3's 401 test plus the component's fire-and-forget calls.
- A supervisor or Free-plan owner: supervisors get 403; Free owners are recorded. Covered by Task 3's role tests and Task 4's mount test for the Free layout.

---

### Task 1: Activity table and recording function

**Files:**
- Create: `supabase/migrations/20261030120000_account_activity_days.sql`
- Test: `__tests__/db/account-activity.dbtest.ts`

**Interfaces:**
- Produces: table `private.account_activity_days(org_id uuid, user_id uuid, day date, active_minutes int, area_minutes jsonb, phone_minutes int, tablet_minutes int, desktop_minutes int, installed_minutes int, first_seen_at timestamptz, last_seen_at timestamptz, last_flush_at timestamptz)`, primary key `(org_id, user_id, day)`, both FKs `ON DELETE CASCADE`, and index `(org_id, last_seen_at DESC)`.
- Produces: `public.record_account_activity(p_user_id uuid, p_org_id uuid, p_minutes integer, p_area_minutes jsonb, p_device text, p_installed boolean) RETURNS integer`, which returns the accepted minutes. It is `SECURITY DEFINER`, `SET search_path = ''`, revoked from `PUBLIC, anon, authenticated`, and granted to `service_role`. It raises SQLSTATE `22023` for an unknown area key, a negative or non-integer area value, `p_minutes` outside 0–10, or `p_device` not in `('phone','tablet','desktop')`.

- [ ] **Step 1: Write the failing DB tests** in `__tests__/db/account-activity.dbtest.ts`, using `freshDatabase`, `seedOwnerOrg`, `asServiceRole`, `asSuperuser`, `asUser` and `pgError` from `./helpers`. The helper `record(minutes, areas, device = 'phone', installed = false)` runs `SELECT public.record_account_activity($1,$2,$3,$4::jsonb,$5,$6) AS accepted` as the service role.

```ts
it('records minutes, areas and device on the India day', async () => {
    expect(await record(5, { estimator: 3, rate_book: 2 }, 'phone', true)).toBe(5)
    const row = await today()   // superuser SELECT for owner org/user where day = (now() AT TIME ZONE 'Asia/Kolkata')::date
    expect(row).toMatchObject({ active_minutes: 5, phone_minutes: 5, installed_minutes: 5, area_minutes: { estimator: 3, rate_book: 2 } })
    expect(row.first_seen_at).toBeTruthy(); expect(row.last_seen_at).toBeTruthy()
})
// setRow(patch) is a superuser UPDATE of today's row, e.g. setRow({ last_flush_at: "now() - interval '30 seconds'" }),
// so every clamp below is computed from a known elapsed time.
it('clamps a second flush to the elapsed time, so two windows cannot double count', async () => {
    await setRow({ last_flush_at: "now() - interval '30 seconds'" })
    expect(await record(5, { estimator: 5 })).toBe(2)   // ceil(0.5) + 1
    expect(await today()).toMatchObject({ active_minutes: 7, area_minutes: { estimator: 5, rate_book: 2 } })
})
it('scales area minutes down to the accepted total', async () => {
    await setRow({ last_flush_at: "now() - interval '150 seconds'" })
    expect(await record(9, { estimator: 6, saved_costings: 3 })).toBe(4)   // ceil(2.5) + 1
    expect(await today()).toMatchObject({ active_minutes: 11, area_minutes: { estimator: 7, saved_costings: 1, rate_book: 2 } })
})
it('caps the day at 1440 minutes', async () => {
    await setRow({ active_minutes: '1438', last_flush_at: "now() - interval '1 hour'" })
    expect(await record(10, { other: 10 })).toBe(2)
    expect((await today()).active_minutes).toBe(1440)
})
it('rejects unknown areas, bad values and devices', async () => {
    expect((await pgError(record(1, { cart: 1 }))).code).toBe('22023')
    expect((await pgError(record(1, { estimator: -1 }))).code).toBe('22023')
    expect((await pgError(record(11, { estimator: 1 }))).code).toBe('22023')
    expect((await pgError(record(1, { estimator: 1 }, 'watch'))).code).toBe('22023')
})
it('is closed to signed-in clients', async () => {
    await asUser(db, owner.userId, owner.orgId)
    expect((await pgError(db.query('SELECT * FROM private.account_activity_days'))).code).toBe('42501')
    expect((await pgError(db.query("SELECT public.record_account_activity($1,$2,1,'{}'::jsonb,'phone',false)", [owner.userId, owner.orgId]))).code).toBe('42501')
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `heavyq run --est 3m --label test-db-activity -- npm run test:db -- __tests__/db/account-activity.dbtest.ts`
Expected: FAIL. The function `public.record_account_activity` does not exist.

- [ ] **Step 3: Write the migration** with the table, index, RLS enabled, `REVOKE ALL ON private.account_activity_days FROM PUBLIC, anon, authenticated, service_role`, and the function. Clamp: `allowed := least(p_minutes, CASE WHEN existing.last_flush_at IS NULL THEN 6 ELSE ceil(extract(epoch FROM now() - existing.last_flush_at) / 60)::int + 1 END, 1440 - coalesce(existing.active_minutes, 0))`, floored at 0. When the area sum exceeds `allowed`, multiply each value by `allowed / sum` and floor. Add `allowed` to `active_minutes`, the device column, and `installed_minutes` when `p_installed`. Always set `last_seen_at` and `last_flush_at` to `now()`. Lock the row with `SELECT … FOR UPDATE` before reading it. Add a `COMMENT ON TABLE` naming the spec.

- [ ] **Step 4: Run them and confirm they pass**

Run: `heavyq run --est 3m --label test-db-activity -- npm run test:db -- __tests__/db/account-activity.dbtest.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261030120000_account_activity_days.sql __tests__/db/account-activity.dbtest.ts
git commit -m "feat(activity): private daily activity table and clamped recorder"
```

### Task 2: Pure minute counter, area map and device detection

**Files:**
- Create: `lib/activity-tracking.ts`
- Test: `__tests__/activity-tracking.test.ts`

**Interfaces:**
- Produces:
  - `export const ACTIVITY_AREAS = ['estimator','saved_costings','rate_book','plan_billing','settings','support','other'] as const`
  - `export type ActivityArea = typeof ACTIVITY_AREAS[number]`
  - `export type ActivityDevice = 'phone' | 'tablet' | 'desktop'`
  - `export type ActivityFlush = { minutes: number; areas: Partial<Record<ActivityArea, number>>; device: ActivityDevice; installed: boolean }`
  - `export function activityAreaForPath(pathname: string): ActivityArea`
  - `export function activityDevice(width: number, coarsePointer: boolean): ActivityDevice`
  - `export class ActivityCounter { recordInput(at: number): void; tick(at: number, context: { visible: boolean; area: ActivityArea; device: ActivityDevice; installed: boolean }): void; takeFlush(): ActivityFlush | null }`
  - `export const ACTIVITY_TICK_MS = 60_000`, `export const ACTIVITY_FLUSH_MS = 300_000`

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
    ['/free', 'estimator'], ['/owner/estimator', 'estimator'], ['/owner/estimator/abc', 'estimator'],
    ['/free/costings', 'saved_costings'], ['/owner/quotes', 'saved_costings'],
    ['/owner/rates', 'rate_book'],
    ['/owner/billing', 'plan_billing'], ['/free/billing', 'plan_billing'], ['/plans', 'plan_billing'],
    ['/owner/settings', 'settings'], ['/owner/data-export', 'settings'], ['/free/settings', 'settings'], ['/free/account', 'settings'],
    ['/support', 'support'], ['/support/3f2a', 'support'],
    ['/owner/production', 'other'], ['/owner/payroll', 'other'], ['/freely', 'other'],
])('maps %s to %s', (path, area) => expect(activityAreaForPath(path)).toBe(area))

it('classifies devices', () => {
    expect(activityDevice(390, true)).toBe('phone')
    expect(activityDevice(820, true)).toBe('tablet')
    expect(activityDevice(1280, true)).toBe('desktop')
    expect(activityDevice(900, false)).toBe('desktop')
})

const ctx = { visible: true, area: 'estimator' as const, device: 'phone' as const, installed: true }
it('counts a visible minute only when there was input in the last 60 seconds', () => {
    const c = new ActivityCounter()
    c.recordInput(0); c.tick(60_000, ctx)          // input 60s ago: counts
    c.tick(120_001, ctx)                            // idle visible minute: does not count
    expect(c.takeFlush()).toEqual({ minutes: 1, areas: { estimator: 1 }, device: 'phone', installed: true })
})
it('does not count hidden minutes', () => {
    const c = new ActivityCounter(); c.recordInput(0); c.tick(30_000, { ...ctx, visible: false })
    expect(c.takeFlush()).toBeNull()
})
it('attributes each minute to the area at tick time and resets after a flush', () => {
    const c = new ActivityCounter()
    c.recordInput(0); c.tick(30_000, ctx)
    c.recordInput(40_000); c.tick(90_000, { ...ctx, area: 'rate_book', device: 'desktop', installed: false })
    expect(c.takeFlush()).toEqual({ minutes: 2, areas: { estimator: 1, rate_book: 1 }, device: 'desktop', installed: false })
    expect(c.takeFlush()).toBeNull()
})
it('never builds a flush above 10 minutes', () => {
    const c = new ActivityCounter()
    for (let i = 0; i < 15; i++) { c.recordInput(i * 60_000); c.tick(i * 60_000 + 1, ctx) }
    expect(c.takeFlush()!.minutes).toBe(10)
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `heavyq run --est 45s --label vitest-activity -- npx vitest run __tests__/activity-tracking.test.ts`
Expected: FAIL, because the module isn't found.

- [ ] **Step 3: Implement `lib/activity-tracking.ts`.**
  - **Path matching:** match by exact path or by `prefix + '/'`, so `/freely` is not `/free`.
  - **Devices:** under 640px is a phone. A coarse pointer under 1200px is a tablet. Everything else is a desktop.
  - **Flushes:** `device` and `installed` come from the last counted minute.
  - **Limits:** pending minutes stop accumulating at 10, which is the most the endpoint accepts.

- [ ] **Step 4: Run them and confirm they pass**

Run: `heavyq run --est 45s --label vitest-activity -- npx vitest run __tests__/activity-tracking.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/activity-tracking.ts __tests__/activity-tracking.test.ts
git commit -m "feat(activity): pure active-minute counter, area map and device detection"
```

### Task 3: Activity endpoint

**Files:**
- Create: `app/api/analytics/activity/route.ts`
- Modify: `lib/rate-limit.ts` (add `getActivityLimiter`, next to `getTrackingLimiter`)
- Test: `__tests__/activity-route.test.ts`

**Interfaces:**
- Consumes: `ACTIVITY_AREAS` and the `ActivityFlush` shape from Task 2. `public.record_account_activity` from Task 1. `getCachedSession` from `lib/auth.ts`. `createAdminClient` from `lib/supabase/admin.ts`.
- Produces: `POST /api/analytics/activity` with an `ActivityFlush` JSON body. It returns 202 `{ ok: true }`, or 401, 403, 400, 413, 429 or 500 with `{ error }`. It also produces `export function getActivityLimiter()`, which is `createLimiter(30, 600)`.

- [ ] **Step 1: Write the failing tests.** Mock `@/lib/auth`, `@/lib/supabase/admin` and `@/lib/rate-limit` with `vi.mock`, following the existing route tests in `__tests__/`.

```ts
it('401 without a session', async () => expect((await post(valid, null)).status).toBe(401))
it('403 for a supervisor or an owner without an org', async () => {
    expect((await post(valid, session({ role: 'supervisor' }))).status).toBe(403)
    expect((await post(valid, session({ org_id: null }))).status).toBe(403)
})
it('400 for unknown areas, zero minutes or extra keys', async () => {
    for (const body of [{ ...valid, areas: { cart: 1 } }, { ...valid, minutes: 0 }, { ...valid, url: '/owner/x' }]) expect((await post(body, owner)).status).toBe(400)
})
it('413 for bodies over 1 KB', async () => expect((await post({ ...valid, pad: 'x'.repeat(1100) }, owner)).status).toBe(413))
it('429 when the limiter refuses', async () => { limiter.mockResolvedValueOnce({ success: false, reset: Date.now() + 1000, remaining: 0 }); expect((await post(valid, owner)).status).toBe(429) })
it('records with the org from the profile, never the body', async () => {
    const res = await post({ ...valid, org_id: 'attacker' }, owner)   // extra key: 400
    expect(res.status).toBe(400)
    expect((await post(valid, owner)).status).toBe(202)
    expect(rpc).toHaveBeenCalledWith('record_account_activity', { p_user_id: owner.user.id, p_org_id: owner.profile.org_id, p_minutes: 3, p_area_minutes: { estimator: 3 }, p_device: 'phone', p_installed: false })
})
it('500 with no detail when the recorder fails', async () => { rpc.mockResolvedValueOnce({ error: { message: 'boom' } }); const res = await post(valid, owner); expect(res.status).toBe(500); expect(await res.text()).not.toContain('boom') })
```

Where `valid = { minutes: 3, areas: { estimator: 3 }, device: 'phone', installed: false }`.

- [ ] **Step 2: Run them and confirm they fail**

Run: `heavyq run --est 45s --label vitest-activity-route -- npx vitest run __tests__/activity-route.test.ts`
Expected: FAIL, because the route module isn't found.

- [ ] **Step 3: Implement the route.**
  - **Order of checks:** session, then role, then size (read `request.text()` and reject over 1024 bytes), then a strict zod schema (`.strict()`, minutes `int().min(1).max(10)`, areas a partial record over `ACTIVITY_AREAS` with `int().min(0).max(10)`), then rate limit keyed `activity:${user.id}`, then the RPC.
  - **Settings:** `export const dynamic = 'force-dynamic'`. Never log the body.

- [ ] **Step 4: Run them and confirm they pass**

Run: `heavyq run --est 45s --label vitest-activity-route -- npx vitest run __tests__/activity-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/analytics/activity/route.ts lib/rate-limit.ts __tests__/activity-route.test.ts
git commit -m "feat(activity): owner-only activity endpoint with strict body and rate limit"
```

### Task 4: Tracker component, mounts and privacy line

**Files:**
- Create: `components/analytics/ActivityTracker.tsx`
- Modify: `app/(dashboard)/owner/layout.tsx` (inside `<OwnerPlanProvider>`, next to `<AuthBoundaryCleanup>`), `app/free/layout.tsx` (in the returned fragment), `app/(support)/support/layout.tsx`, `app/(plan-selection)/plans/page.tsx` (in the returned tree)
- Modify: `app/privacy/page.tsx` (section 2.6 list)
- Test: `__tests__/activity-tracker-contract.test.ts`

**Interfaces:**
- Consumes: `ActivityCounter`, `activityAreaForPath`, `activityDevice`, `ACTIVITY_TICK_MS` and `ACTIVITY_FLUSH_MS` from Task 2, and `POST /api/analytics/activity` from Task 3.
- Produces: `export function ActivityTracker(): null`, a client component with no props.

- [ ] **Step 1: Write the failing source-contract tests**

```ts
const read = (p: string) => readFileSync(p, 'utf8')
it.each(['app/(dashboard)/owner/layout.tsx', 'app/free/layout.tsx', 'app/(support)/support/layout.tsx', 'app/(plan-selection)/plans/page.tsx'])('%s mounts the tracker', file => {
    expect(read(file)).toContain('<ActivityTracker')
})
it('the founder console never mounts it', () => {
    expect(read('app/(admin-console)/admin/layout.tsx')).not.toContain('ActivityTracker')
})
it('sends only the counter flush, never content, storage or Sentry', () => {
    const src = read('components/analytics/ActivityTracker.tsx')
    expect(src).toContain("'use client'")
    expect(src).toContain('/api/analytics/activity')
    expect(src).toContain('sendBeacon')
    expect(src).toContain('keepalive: true')
    for (const banned of ['localStorage', 'sessionStorage', '@sentry', 'location.href', 'location.search', 'navigator.userAgent', 'innerText', 'textContent', 'FormData', '.target']) expect(src).not.toContain(banned)
})
it('privacy policy discloses active time and last seen', () => {
    expect(read('app/privacy/page.tsx')).toContain('Active time in the app')
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `heavyq run --est 45s --label vitest-activity-contract -- npx vitest run __tests__/activity-tracker-contract.test.ts`
Expected: FAIL, because the component file is missing.

- [ ] **Step 3: Implement the component, mounts and privacy bullet.**
  - **Component:** one `useEffect` creates an `ActivityCounter`. It adds passive window listeners (`pointerdown`, `keydown`, `wheel`, `touchstart`, and `scroll` with `capture: true`) that call `recordInput(Date.now())`. A `ACTIVITY_TICK_MS` interval calls `tick` with `document.visibilityState === 'visible'`, the area from a ref holding `usePathname()`, `activityDevice(innerWidth, matchMedia('(pointer: coarse)').matches)` and `matchMedia('(display-mode: standalone)').matches`. A `ACTIVITY_FLUSH_MS` interval sends with `fetch(…, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' } })`. The `visibilitychange`-to-hidden and `pagehide` handlers send with `navigator.sendBeacon(url, new Blob([json], { type: 'application/json' }))`. Every send is fire-and-forget with `.catch(() => {})`. Clean up all of it on unmount. Render `null`.
  - **Privacy bullet:** add to the section 2.6 `<ul>`: `<li>Active time in the app: minutes of use per day, which area of the app was open, the device type and whether the installed app was used, and when the account was last seen. Page content and anything you type are not recorded.</li>`

- [ ] **Step 4: Run them and confirm they pass**

Run: `heavyq run --est 45s --label vitest-activity-contract -- npx vitest run __tests__/activity-tracker-contract.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/analytics/ActivityTracker.tsx "app/(dashboard)/owner/layout.tsx" app/free/layout.tsx "app/(support)/support/layout.tsx" "app/(plan-selection)/plans/page.tsx" app/privacy/page.tsx __tests__/activity-tracker-contract.test.ts
git commit -m "feat(activity): mount the active-time tracker for owners and disclose it"
```

### Task 5: Release verification

**Files:** none new. Fix whatever these commands surface.

- [ ] **Step 1: Type check, lint and the full unit suite**

Run: `heavyq run --est 2m --label tsc -- npx tsc --noEmit`, then `heavyq run --est 2m --label lint -- npm run lint`, then `heavyq run --est 5m --label vitest-all -- npx vitest run`
Expected: tsc clean. Lint 0 errors and 0 warnings. Vitest all pass except the 1 known skip. Search `__tests__/` for any contract that asserts the exact contents of the four modified layout or page files, and update it deliberately.

- [ ] **Step 2: Full DB suite**

Run: `heavyq run --est 8m --label test-db -- npm run test:db` (use the Bash tool's `run_in_background` if the queue is busy)
Expected: all pass, including `admin-test-factory-dependencies`, which discovers tables referencing organizations.

- [ ] **Step 3: Browser check against QA**

Start `npm run dev` from `.claude/launch.json` (`preview_start`) and sign in with a QA test owner. Then:
1. Interact for over a minute.
2. Switch tabs.
3. In the browser pane's network list, confirm one `POST /api/analytics/activity` returning 202, with a body of only `minutes`, `areas`, `device` and `installed`.
4. Confirm a `/admin` page sends none.

Stop the server afterwards.

- [ ] **Step 4: Hand-off note.** Tell the owner the migration file is `20261030120000_account_activity_days.sql`, and that it must be applied to production before this release is deployed. Tracking starts on deploy day.
