# Release 3: Founder Metrics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/admin/metrics` page (plans, revenue by financial year, trials, conversions, activation, time spent, ghost accounts, renewals) with drill-down account lists, plus a "Customers to contact" block on Today.

**Architecture:** One founder-only SQL function, `admin_growth_input`, returns raw per-factory facts as JSON. A zod schema parses it. Pure modules compute every definition from those facts and `asOf`. A server-only loader audits the read and feeds both the Metrics page and Today. Charts are server-rendered HTML bars with the value printed on each.

**Tech Stack:** Supabase Postgres (plpgsql), zod, Next.js 16 server components, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md`, sections D, E, F, G and H. Releases 1 and 2 must already be merged. This release reads `private.account_activity_days`, `private.resolve_reporting_cohort`, `provider_mode`, `private.paid_plans_state` and `private.paid_plan_interest`.

## Global Constraints

- **Population:** factories whose cohort resolves to `production`. Unit: one factory.
- **Rates:** `{ count, of, percent }`, shown as "3 of 5 · 60%". When `of === 0` the percent is `null` and the UI shows "None yet".
- **Time:** all bucketing uses India time (`Asia/Kolkata`). The financial year runs 1 April to 31 March and its label looks like `2026–27` (en dash).
- **Go-live gating:** revenue, trial outcome, Free → Lite and renewal only count events after `goLiveAt`. Before go-live each returns `null`, and the UI shows "Starts at go-live".
- **Windows:** trial "deciding" = ended less than 14 days ago. Conversion window = trial start to trial end + 14 days. Renewal window = term end ± 30 days. Won back = a later payment. Activation = first saved costing within 7 days of signup. Came back = a second India day within 30 days of signup. Ghost = last seen 60 or more days ago. Trials ending = within 14 days. Renewals due = within 30 days. Signals = last 14 days.
- **Revenue:**
  - Count live payments with status `captured` or `refunded`, bucketed by capture month.
  - Subtract `issued` refunds in their refund month.
  - A `refunded` payment with no issued refund is subtracted in full in its capture month.
- **Labels:** "Since <d Mon>" appears where tracking history is shorter than the window. Ghost counts show "estimated" until tracking is 60 days old.
- **Wording and styling:** plain wording with no coverage disclaimers. Ink, not saffron. Phones get one column, and lists render as cards.
- **Process:** migrations are files only, all commands go through `heavyq`, lint stays at zero warnings, and commits stay on this branch.

## Review Focus

- A month with refunds bigger than captures (a refund for last month's sale) must show a negative month total, not hide it. Pinned in Task 2's revenue test.
- A factory whose owner changed plans mid-month: time spent by plan uses the plan at month end. Pinned in Task 3's `timeSpentByMonth` test.
- The Metrics page before go-live must still be useful, not a wall of "Starts at go-live". Wanted-to-pay takes the first headline slot. Pinned in Task 5's page contract test.
- An owner with no phone number: contact rows must still render, without a broken `tel:` link. Pinned in Task 6's Today block test.
- A list query string carrying an unknown key or a garbage period: it must fall back to the defaults, not throw a 500. Pinned in Task 4's `parseMetricsQuery` test.

---

### Task 1: Growth input function and schema

**Files:**
- Create: `supabase/migrations/20261030140000_admin_growth_input.sql`, `lib/admin/growth-input.ts`
- Test: `__tests__/db/admin-growth-input.dbtest.ts`

**Interfaces:**
- Produces: `public.admin_growth_input(p_actor_id uuid, p_session_id uuid, p_as_of timestamptz) RETURNS jsonb`. It is `SECURITY DEFINER`, `SET search_path = ''`, service role only, and calls `private.admin_assert_founder_session`. It raises `ADMIN_GROWTH_BOUND` (54000) for more than 5,000 production factories.
- Produces (`lib/admin/growth-input.ts`, pure and safe for the client): `growthInputSchema` (zod) and these inferred types:

```ts
type GrowthFactory = {
  id: string; name: string; createdAt: string
  owner: { name: string | null; phone: string | null; email: string | null; lastSignInAt: string | null }
  subscriptions: SubscriptionInput[]          // from lib/admin/metrics, with is_trial
  hasFreeGrant: boolean
  costings: { count: number; first: string | null; latest: string | null; earlyDays: string[] }   // India dates within 30 days of signup
  activity: { months: { month: string; minutes: number; areas: Partial<Record<ActivityArea, number>>; phone: number; tablet: number; desktop: number; installed: number }[]
              earlyDays: string[]; minutesLast30: number; lastSeenAt: string | null }
  payments: { id: string; subscriptionId: string | null; amountPaise: number; status: 'captured' | 'refunded'; capturedAt: string
              planTier: 'lite' | 'base' | null; purchaseType: 'initial_purchase' | 'renewal' | null }[]   // provider_mode = 'live' only
  refunds: { paymentId: string; amountPaise: number; at: string }[]                                  // status 'issued' only; at = updated_at
  checkoutAttempts: { at: string; status: string }[]                                                 // last 14 days
  freeSignals: { event: 'quota_reached' | 'upgrade_started'; at: string }[]                          // last 14 days, via free_account_grants
  interest: { firstAt: string; lastAt: string; taps: number; lastSource: string } | null
}
type GrowthInput = { asOf: string; goLiveAt: string | null; trackingSince: string | null; factories: GrowthFactory[] }
```

`trackingSince` = `min(day)` in `private.account_activity_days`. Plan tier and purchase type come from `org_subscriptions.plan_tier` and `checkout_purchase_type` via `subscription_payments.subscription_id`. Saved costings = `estimator_quotes` ∪ `free_saved_costings` by `org_id`, using `created_at`.

- [ ] **Step 1: Write the failing DB tests.** Set up the founder as in `admin-factories.dbtest.ts`.

```ts
it('returns production factories only, with the documented shape', async () => {
    // plain org (production), org with 'test' row, org owned by founder alias → only the plain org
    const input = growthInputSchema.parse(await read())
    expect(input.factories.map(f => f.id)).toEqual([plain.orgId]); expect(input.goLiveAt).toBeNull()
})
it('includes only live payments and issued refunds', async () => { /* live 299900, test 299900, NULL-mode 299900; refund issued 50000 + pending 1000 → one payment, one refund */ })
it('aggregates activity by India month and early days', async () => { /* rows on 2 days in month → months[0].minutes = sum; earlyDays both */ })
it('maps Free funnel signals through shared grants to each factory', async () => { /* one subject, two orgs → signal on both */ })
it('refuses a non-founder session', async () => { /* random session → error */ })
```

- [ ] **Step 2: Run them and confirm they fail.** Run: `heavyq run --est 4m --label test-db-growth -- npm run test:db -- __tests__/db/admin-growth-input.dbtest.ts`. Expected: FAIL.

- [ ] **Step 3: Write the migration and the schema.** Use `MATERIALIZED` CTEs per source, keyed by `org_id`, and `jsonb_agg` with `ORDER BY`. All date bucketing uses `AT TIME ZONE 'Asia/Kolkata'`.

- [ ] **Step 4: Run them and confirm they pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261030140000_admin_growth_input.sql lib/admin/growth-input.ts __tests__/db/admin-growth-input.dbtest.ts
git commit -m "feat(admin): founder growth input with live payments, activity and signals"
```

### Task 2: Money and conversion definitions

**Files:**
- Create: `lib/admin/fiscal.ts`, `lib/admin/growth-money.ts`
- Test: `__tests__/admin-growth-money.test.ts`

**Interfaces:**
- Consumes: `GrowthFactory` and `GrowthInput` from Task 1, and `resolveFactoryAccess` from `lib/admin/metrics.ts`.
- Produces:
  - `fiscal.ts`:
    - `indiaDay(at: string): string` → 'YYYY-MM-DD'
    - `indiaMonth(at: string): string` → 'YYYY-MM'
    - `financialYear(at: string): { label: string; start: string; end: string }`. Start and end are UTC instants of 1 April 00:00 India time, and the end is exclusive.
    - `financialYearMonths(label: string): string[]` (Apr to Mar)
  - `growth-money.ts`:
    - `export type Rate = { count: number; of: number; percent: number | null }`
    - `export function rate(count: number, of: number): Rate`
    - `revenueReport(fs: GrowthFactory[], goLiveAt: string | null, asOf: string, fy: string): { fyPaise: number; lastFyPaise: number; allTimePaise: number; months: { month: string; newPaise: number; renewalPaise: number; refundPaise: number; litePaise: number; basePaise: number }[] } | null`
    - `trialOutcomes(fs, goLiveAt, asOf): { converted: string[]; backToFree: string[]; deciding: string[]; rate: Rate } | null`
    - `freeToLite(fs, goLiveAt, asOf): { converted: string[]; everFree: string[]; rate: Rate; medianDays: number | null } | null`. Here "ever Free" = `hasFreeGrant` and either the trial ended unpaid or there never was a trial. The first Free day is the trial end, or `createdAt`.
    - `liteRenewals(fs, goLiveAt, asOf): { terms: string[]; renewed: string[]; wonBack: string[]; rate: Rate } | null`. A term is a non-trial Lite subscription row with a linked live payment and `current_end` more than 30 days before `asOf`. Entries are org IDs, one per term, so they link to factories. An org with two qualifying terms appears twice in `terms`.

- [ ] **Step 1: Write the failing tests.** `factory(overrides)` builds a `GrowthFactory` with empty defaults, and `pay(at, paise, plan, type)` builds a captured payment.

```ts
it.each([['2026-03-31T18:29:59Z', '2025–26'], ['2026-03-31T18:30:00Z', '2026–27']])('financialYear(%s) is %s', (at, label) => expect(financialYear(at).label).toBe(label))
it('rate() never divides by zero', () => { expect(rate(0, 0)).toEqual({ count: 0, of: 0, percent: null }); expect(rate(1, 3).percent).toBeCloseTo(33.33, 1) })
const GO = '2026-12-01T00:00:00Z'
it('revenue nets refunds in their month, subtracts refunded payments without a refund row, and ignores pre-go-live payments', () => {
    const fs = [factory({ payments: [pay('2026-11-20T06:00:00Z', 299900, 'lite', 'initial_purchase'), { ...pay('2026-12-10T06:00:00Z', 299900, 'lite', 'initial_purchase'), id: 'p1' },
        { ...pay('2027-02-01T06:00:00Z', 299900, 'lite', 'initial_purchase'), status: 'refunded' }, pay('2027-04-02T06:00:00Z', 149900, 'lite', 'renewal')],
        refunds: [{ paymentId: 'p1', amountPaise: 50000, at: '2027-01-05T06:00:00Z' }] })]
    const r = revenueReport(fs, GO, '2027-05-01T00:00:00Z', '2026–27')!
    expect(r).toMatchObject({ fyPaise: 249900, allTimePaise: 399800 })
    expect(r.months.find(m => m.month === '2027-01')).toMatchObject({ refundPaise: 50000 })
    expect(r.months.find(m => m.month === '2027-02')).toMatchObject({ newPaise: 299900, refundPaise: 299900 })
    expect(revenueReport(fs, null, '2027-05-01T00:00:00Z', '2026–27')).toBeNull()
})
it('trial outcomes: converted within 14 days, back to Free, deciding, and pre-go-live trials excluded', () => {
    // A ends 2026-12-10, live Lite payment 2026-12-20 → converted; B ends 2026-12-05 no payment → backToFree;
    // C ends 2026-12-25 → deciding (asOf 2026-12-30); D ends 2026-11-20 → excluded
    expect(trialOutcomes([A, B, C, D], GO, '2026-12-30T00:00:00Z')).toMatchObject({ converted: [A.id], backToFree: [B.id], deciding: [C.id], rate: { count: 1, of: 2, percent: 50 } })
})
it('Free → Lite counts later live Lite payments and the median days', () => { /* E Free since createdAt 2026-12-02, paid 2026-12-12 → 10 days; F Free, unpaid → rate 1 of 2, medianDays 10 */ })
it('renewal: within ±30 days renews, later is won back, young terms are excluded', () => {
    // factory T1: term ends 2027-12-01, payment 2027-11-15 → renewed; T2: term ends 2027-12-01, payment 2028-01-15 → wonBack; T3: term ends 2028-01-20 → excluded (asOf 2028-02-01)
    expect(liteRenewals([T1, T2, T3], GO, '2028-02-01T00:00:00Z')).toMatchObject({ terms: [T1.id, T2.id], renewed: [T1.id], wonBack: [T2.id], rate: { count: 1, of: 2, percent: 50 } })
})
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 45s --label vitest-money -- npx vitest run __tests__/admin-growth-money.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `fiscal.ts` and `growth-money.ts`.** Use `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })` for India dates. Keep paise as integers.

- [ ] **Step 4: Run and confirm they pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/fiscal.ts lib/admin/growth-money.ts __tests__/admin-growth-money.test.ts
git commit -m "feat(admin): revenue by financial year, trial outcomes, Free to Lite and renewals"
```

### Task 3: Accounts, activation, usage and contact definitions

**Files:**
- Create: `lib/admin/growth-usage.ts`
- Test: `__tests__/admin-growth-usage.test.ts`

**Interfaces:**
- Consumes: Task 1 types, and `rate` and `financialYearMonths` from Task 2, and `resolveFactoryAccess` from `lib/admin/metrics.ts`.
- Produces:
  - **Plans and signups:**
    - `plansNow(fs, asOf): Record<'free' | 'lite_trial' | 'lite_paid' | 'base' | 'none', string[]>`
    - `signupsByMonth(fs, months: string[]): { month: string; ids: string[] }[]`
  - **Activation:** `activation(fs, months: string[], asOf): { signedUp: string[]; activated: string[]; cameBack: string[]; activatedRate: Rate; cameBackRate: Rate }`. Eligible means signed up in `months` and at least 7 days old.
  - **Time spent:** `timeSpentByMonth(fs, months: string[], asOf): { month: string; accounts: number; averageMinutes: number | null; medianMinutes: number | null; byPlan: Partial<Record<'free' | 'lite_trial' | 'lite_paid' | 'base', { accounts: number; averageMinutes: number; medianMinutes: number }>> }[]`. The plan is resolved at the month's end, or at `asOf` for the current month.
  - **Usage share:** `usageShare(fs, months): { areas: Record<ActivityArea, number>; devices: { phone: number; tablet: number; desktop: number }; installedShare: number }`. Shares are 0–1 of minutes.
  - **Last seen and ghosts:**
    - `lastSeen(f: GrowthFactory): string | null`, the latest of activity, latest costing and the owner's last sign-in.
    - `ghosts(fs, asOf, trackingSince): { neverStarted: string[]; wentQuiet: string[]; estimated: boolean }`
  - **Contact lists:**
    - `export type ContactRow = { orgId: string; factory: string; ownerName: string | null; phone: string | null; detail: string; at: string | null; minutesLast30: number; costingsSaved: number }`
    - `trialsEndingSoon(fs, asOf): ContactRow[]`, sorted by `minutesLast30` descending. `detail` = "Ends in N days".
    - `renewalsDue(fs, asOf): ContactRow[]`, sorted by end date. `detail` = "Lite ends 12 Dec".
    - `upgradeSignals(fs, goLiveAt, asOf): ContactRow[]`, newest first. `detail` is one of "Tapped Notify me", "Hit the monthly limit", "Opened upgrade" or "Checkout not completed" (the last only after go-live).
    - `wantedToPay(fs): ContactRow[]`, by first tap.

- [ ] **Step 1: Write the failing tests**

```ts
it('activation: first costing within 7 days, came back on a second day within 30', () => {
    // S1 signup 2026-11-01, first costing 2026-11-05, earlyDays ['2026-11-05','2026-11-12'] → activated + cameBack
    // S2 signup 2026-11-02, first costing 2026-11-15 → not activated; S3 signup asOf-3d → not eligible
    expect(activation([S1, S2, S3], ['2026-11'], '2026-11-30T00:00:00Z')).toMatchObject({ signedUp: [S1.id, S2.id], activated: [S1.id], cameBack: [S1.id], activatedRate: { count: 1, of: 2 } })
})
it('time spent: average and median over active accounts only, plan at month end', () => {
    // minutes 10, 20, 300 and one factory with 0 → accounts 3, average 110, median 20
    // factory on lite_trial at 2026-12-31 even though Free on 2026-12-01 → byPlan.lite_trial
})
it('ghosts split never started and went quiet, estimated while tracking is young', () => {
    expect(ghosts([quiet, never, active], '2027-03-01T00:00:00Z', '2026-11-06')).toEqual({ neverStarted: [never.id], wentQuiet: [quiet.id], estimated: false })
    expect(ghosts([quiet], '2026-12-01T00:00:00Z', '2026-11-06').estimated).toBe(true)
})
it('trials ending soon are sorted by recent minutes and keep owners without phones', () => {
    const rows = trialsEndingSoon([busy, idle, noPhone], '2026-12-01T00:00:00Z')
    expect(rows.map(r => r.orgId)).toEqual([busy.id, noPhone.id, idle.id]); expect(rows[1].phone).toBeNull()
})
it('checkout-not-completed signals only appear after go-live', () => { /* same attempt; goLiveAt null → absent; set → present */ })
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 45s --label vitest-usage -- npx vitest run __tests__/admin-growth-usage.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `growth-usage.ts`.**

- [ ] **Step 4: Run and confirm they pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/growth-usage.ts __tests__/admin-growth-usage.test.ts
git commit -m "feat(admin): plans, activation, time spent, ghosts and contact lists"
```

### Task 4: Loader, query parsing and audit

**Files:**
- Create: `lib/admin/growth.ts` (`server-only`)
- Test: `__tests__/admin-growth.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–3, plus `requireFounder`, `adminRecordAudit`, `createAdminClient` and `AdminError`.
- Produces:
  - **Query types:**
    - `export const METRIC_LISTS = ['plan_free','plan_lite_trial','plan_lite_paid','plan_base','plan_none','signups','activated','not_activated','came_back','trial_converted','trial_back_to_free','trial_deciding','free_to_lite','renewed','won_back','ghost_never_started','ghost_went_quiet','trials_ending','renewals_due','upgrade_signals','wanted_to_pay'] as const`
    - `export type MetricsPeriod = { kind: 'fy'; fy: string } | { kind: 'month'; month: string }`
    - `export function parseMetricsQuery(query: Record<string, string | undefined>, asOf: string): { period: MetricsPeriod; list: MetricList | null }`. `period=fy-2026-27` or `period=2026-11`. Anything else falls back to the current financial year and a `null` list. It never throws.
  - **Loaders:**
    - `export async function loadGrowthInput(principal: FounderPrincipal, asOf: string): Promise<GrowthInput>`. It calls the RPC, parses with the schema, and throws `AdminError('SOURCE_UNAVAILABLE', 503, …)` on failure. No audit.
    - `export async function getMetricsReport(query: Record<string, string | undefined>)`. It returns `{ asOf, period, goLiveAt, trackingSince, plans, revenue, trials, freeToLite, renewals, signups, activation, timeSpent, usage, ghosts, wantedToPay }` and audits `metrics.read`.
    - `export async function getMetricAccounts(query)`. It returns `{ list, period, rows: { orgId, name, plan, joinedAt, lastSeen, minutesLast30 }[] }` and audits `metrics.accounts.read`.
    - `export function contactLists(input: GrowthInput): { trialsEnding: ContactRow[]; renewalsDue: ContactRow[]; upgradeSignals: ContactRow[] }`, each capped at 10 for Today.

- [ ] **Step 1: Write the failing tests** (mock the RPC, `requireFounder` and `adminRecordAudit`)

```ts
it.each([[{}, { kind: 'fy', fy: '2026–27' }], [{ period: 'fy-2025-26' }, { kind: 'fy', fy: '2025–26' }], [{ period: '2026-11' }, { kind: 'month', month: '2026-11' }],
    [{ period: '2026-13' }, { kind: 'fy', fy: '2026–27' }], [{ period: "'; drop" }, { kind: 'fy', fy: '2026–27' }]])('parseMetricsQuery(%j)', (q, period) =>
    expect(parseMetricsQuery(q, '2026-11-15T00:00:00Z').period).toEqual(period))
it('unknown list keys become null', () => expect(parseMetricsQuery({ list: 'everyone' }, '2026-11-15T00:00:00Z').list).toBeNull())
it('audits each read and fails closed when the audit fails', async () => { /* audit rejects → getMetricsReport rejects */ })
it('a source failure surfaces as 503, not a partial page', async () => { /* rpc error → AdminError status 503 */ })
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 45s --label vitest-growth -- npx vitest run __tests__/admin-growth.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `growth.ts`.**

- [ ] **Step 4: Run and confirm they pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/growth.ts __tests__/admin-growth.test.ts
git commit -m "feat(admin): audited metrics loader and query parsing"
```

### Task 5: Metrics page, account lists and navigation

**Files:**
- Create: `app/(admin-console)/admin/metrics/page.tsx`, `app/(admin-console)/admin/metrics/accounts/page.tsx`, `components/admin/metrics-ui.tsx`
- Modify:
  - `components/admin/founder-shell.tsx`: add `{ href: '/admin/metrics', label: 'Metrics', icon: BarChart3 }` after Today, and change the mobile grid to `grid-cols-3 min-[400px]:grid-cols-6`.
  - `lib/admin/routes.ts`: add `/admin/metrics` and `/admin/metrics/accounts` to `destinations`.
- Test: `__tests__/admin-metrics-page.test.ts`

**Interfaces:**
- Consumes: `getMetricsReport` and `getMetricAccounts` from Task 4.
- Produces (`metrics-ui.tsx`, server components):
  - `MetricTile({ label, value, sub?, href? })`
  - `RateText({ rate })`, which renders "3 of 5 · 60%" or "None yet"
  - `NotYet({ children = 'Starts at go-live' })`
  - `BarList({ rows: { label: string; value: number; display: string; segments?: { value: number; className: string }[]; href?: string }[] })`. Bar widths are percentages of the largest absolute value. A negative value renders as a hairline-bordered bar with a leading "−". `display` is always printed.

- [ ] **Step 1: Write the failing tests** (source contract and static markup)

```ts
it('nav and return paths include Metrics', () => {
    expect(readFileSync('components/admin/founder-shell.tsx', 'utf8')).toContain("'/admin/metrics'")
    expect(safeFounderReturnPath('/admin/metrics')).toBe('/admin/metrics'); expect(safeFounderReturnPath('/admin/metrics/accounts')).toBe('/admin/metrics/accounts')
})
it('page has the six sections in order and Starts at go-live before go-live', () => {
    const src = readFileSync('app/(admin-console)/admin/metrics/page.tsx', 'utf8')
    const order = ['Money', 'Accounts', 'Getting started', 'Usage', 'Keeping customers'].map(h => src.indexOf(`>${h}<`))
    expect(order.every((i, n) => i > 0 && (n === 0 || i > order[n - 1]))).toBe(true)
    expect(src).toContain('<NotYet'); expect(src).toContain('Wanted to pay')
})
it('RateText shows None yet for empty denominators and counts beside percents', () => {
    expect(renderToStaticMarkup(<RateText rate={{ count: 0, of: 0, percent: null }}/>)).toContain('None yet')
    expect(renderToStaticMarkup(<RateText rate={{ count: 3, of: 5, percent: 60 }}/>)).toContain('3 of 5 · 60%')
})
it('BarList prints every value and handles a negative month', () => {
    const html = renderToStaticMarkup(<BarList rows={[{ label: 'Jan', value: -50000, display: '−₹500' }, { label: 'Dec', value: 299900, display: '₹2,999' }]}/>)
    expect(html).toContain('−₹500'); expect(html).toContain('₹2,999')
})
it('every count links to the accounts list', () => expect(readFileSync('app/(admin-console)/admin/metrics/page.tsx', 'utf8')).toContain('/admin/metrics/accounts?list='))
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 45s --label vitest-metrics-page -- npx vitest run __tests__/admin-metrics-page.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the pages.**
  - **Both pages:** `export const dynamic = 'force-dynamic'`. A `try`/`catch` around the loader renders `SourceUnavailable` on failure, as the Today page does.
  - **Period switch:** plain links for this financial year, last financial year and each month of the selected year.
  - **Headline row before go-live:** Wanted to pay, Accounts on each plan, Revenue (`<NotYet/>`), Trial conversion (`<NotYet/>`). After go-live: Revenue this FY, Accounts on each plan, Trial conversion, Free → Lite.
  - **Sections:** follow spec E in order. Money uses BarList segments for new and renewal. Usage shows one row per month with average and median, plus the area and device shares as BarList.
  - **Labels:** "Since <date>" from `trackingSince`, and "estimated" on ghosts when flagged.
  - **Accounts page:** a header naming the list and period, then rows as cards below the `sm` breakpoint and a table above it, each linking to `/admin/factories/[orgId]`. Format money with `formatMinor` from `lib/admin/payments-domain.ts`.

- [ ] **Step 4: Run and confirm they pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "app/(admin-console)/admin/metrics" components/admin/metrics-ui.tsx components/admin/founder-shell.tsx lib/admin/routes.ts __tests__/admin-metrics-page.test.ts
git commit -m "feat(admin): Metrics page with drill-down account lists"
```

### Task 6: Customers to contact on Today

**Files:**
- Modify: `lib/admin/overview.ts` (add a `contacts` source using `loadGrowthInput` and `contactLists`, isolated like the other sources), `app/(admin-console)/admin/page.tsx` (block above "Needs attention")
- Create: `components/admin/contact-list.tsx`
- Test: extend `__tests__/admin-overview.test.ts`, and add `__tests__/admin-contact-list.test.tsx`

**Interfaces:**
- Consumes: `loadGrowthInput`, `contactLists` and `ContactRow` from Tasks 3 and 4.
- Produces:
  - `getAdminOverview()` returns an added `contacts: Source<{ trialsEnding: ContactRow[]; renewalsDue: ContactRow[]; upgradeSignals: ContactRow[] }>`.
  - `ContactList({ title, rows, seeAllHref, empty })` renders, for each row: the factory name, owner, detail, minutes in the last 30 days and costings saved. When `phone` is set it adds `tel:` and `https://wa.me/<digits>` links; otherwise the text "No mobile on file".

- [ ] **Step 1: Write the failing tests**

```ts
it('contact rows link phone and WhatsApp, and degrade without a phone', () => {
    const html = renderToStaticMarkup(<ContactList title="Trials ending" seeAllHref="/admin/metrics/accounts?list=trials_ending" empty="No trials end in the next 14 days." rows={[row({ phone: '+919800000001' }), row({ phone: null })]}/>)
    expect(html).toContain('href="tel:+919800000001"'); expect(html).toContain('href="https://wa.me/919800000001"'); expect(html).toContain('No mobile on file')
})
it('a contacts source failure leaves the rest of Today intact', async () => { /* growth RPC rejects → overview.contacts.state 'unavailable', support/payments still available */ })
it('Today renders the block above Needs attention', () => {
    const src = readFileSync('app/(admin-console)/admin/page.tsx', 'utf8'); expect(src.indexOf('Customers to contact')).toBeLessThan(src.indexOf('Needs attention'))
})
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 45s --label vitest-today -- npx vitest run __tests__/admin-overview.test.ts __tests__/admin-contact-list.test.tsx`. Expected: FAIL.

- [ ] **Step 3: Implement** the overview source, the component and the page block. Each of the three lists shows up to 10 rows, plus "See all".

- [ ] **Step 4: Run and confirm they pass.** Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/overview.ts "app/(admin-console)/admin/page.tsx" components/admin/contact-list.tsx __tests__/admin-overview.test.ts __tests__/admin-contact-list.test.tsx
git commit -m "feat(admin): Customers to contact on Today"
```

### Task 7: Release verification

- [ ] **Step 1:** `heavyq run --est 2m --label tsc -- npx tsc --noEmit`, `heavyq run --est 2m --label lint -- npm run lint`, `heavyq run --est 5m --label vitest-all -- npx vitest run`. Expected: clean, 0 warnings, all pass except the 1 known skip.
- [ ] **Step 2:** `heavyq run --est 8m --label test-db -- npm run test:db`. Expected: all pass.
- [ ] **Step 3: Hand-off note.**
  - **Migration:** the owner applies `20261030140000_admin_growth_input.sql`, deploys, then signs in to `/admin` with MFA to check `/admin/metrics` and the Today block on phone and laptop.
  - **What to expect before go-live:** money and conversion tiles read "Starts at go-live", and the usage sections fill in from the tracking start date.
