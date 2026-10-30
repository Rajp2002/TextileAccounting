# Founder console: activity tracking and Metrics page: design

Date: 2026-10-30. Status: spec approved; go-live addendum (section C2) approved
in chat, awaiting review of the updated spec.

## Purpose

The founder console at `/admin` is live in production, but it cannot answer the
owner's basic business questions: how many accounts are on each plan, how trials
convert, how much money has come in, how long people use Weavly, and who has gone
quiet. This work adds two things:

1. **Activity tracking:** active minutes and last-seen time for every factory
   owner, on every plan. This history cannot be backfilled, so it ships first.
2. **Paid-plan pilot controls.** Weavly takes no real money until the owner
   incorporates in India. Until then, the owner extends trials from the console,
   pay buttons become "Notify me", and a Go-live switch opens real payments once
   the company is set up.
3. **A Metrics page** plus a "Customers to contact" block on Today, built mostly
   from data the app already stores.

It keeps the console's existing foundations: founder sign-in with MFA, the
founder session checks, the support ticket system, the audit trail and the
canonical plan resolver (`lib/subscription-access.ts`).

This is pieces 1 and 2 of a four-piece programme. Pieces 3 and 4 get their own
specs later (see "Later pieces").

## Decisions (agreed)

- **Revenue is money collected, not ARR.** Payments are manual and annual, so
  MRR/ARR would mislead. Show revenue per financial year instead.
- **Revenue year is the Indian financial year,** 1 April to 31 March, in India
  time. FY 2026–27 runs 1 Apr 2026 to 31 Mar 2027.
- **Activity tracking covers all plans,** including Free.
- **Activity is stored in Weavly's own database.** No third-party analytics.
- **Every factory counts as a real customer by default.** The founder marks test,
  demo and internal accounts. Owner emails that are the founder's own address or a
  `+` version of it are treated as internal automatically.
- **Every payment so far is a test payment.** Revenue counts only payments
  recorded as live, which starts once the live/test label below ships.
- **No real payments until go-live.** The owner proves demand first and
  incorporates later. Until the owner clicks Go live, customers can't pay. Pay
  buttons become "Notify me", and each tap is counted as a sign of willingness to
  pay. Accounts marked test, demo or internal can still use test checkout.
- **The owner extends trials by hand before go-live.** Extending applies to every
  unpaid trial, including trials that already ended and dropped to Free; those
  get Lite back. Today warns when unpaid trials end within 14 days while paid
  plans aren't live.
- **Go live is one click, once the checklist is complete.** At go-live, any
  unpaid trial ending within 30 days moves to 30 days after go-live. Revenue,
  trial conversion and renewal numbers count from go-live; before it they show
  "Starts at go-live".
- **Charts are plain HTML bars with the value printed on each bar.** No chart
  library. Revisit (Recharts) only if long trend lines are added later.
- **Plain language throughout.** No coverage disclaimers. Where a number has only
  been recorded since a date, show a short "Since 6 Nov" note.

## Findings that shape the design

- **Every factory is currently excluded from totals.** Classification lives in
  `private.admin_org_reporting`, a missing row means `unclassified`, and
  unclassified factories are left out of every total. Nothing in the app writes
  that table. The default is coalesced to `'unclassified'` in
  `admin_factory_snapshot` (latest definition in
  `20261011120100_admin_snapshot_trial_flag.sql`) and twice in
  `admin_billing_report_input` (`20261004152000_admin_billing_reporting.sql`).
  Production counts were not checked (production reads are blocked for the
  agent).
- **The existing revenue report reads an empty source.** It reads
  `private.admin_billing_facts`, a reporting projection nothing populates. The
  Metrics page reads the real payment tables instead.
- **Payments don't record live versus test.** The mode is known only at runtime
  from the Razorpay key prefix (`lib/billing-readiness.ts`) and is not stored on
  any payment row.
- **Live checkout already has an environment barrier.** `evaluateBillingReadiness`
  returns `live` only with matching `rzp_live_` keys, complete GST supplier
  details, the GST invoice flag, and `BILLING_DOCUMENT_POLICY.state =
  'supported'` (a code constant, currently `'not_supported'`). With test keys it
  returns `test` and checkout works with test cards, in production too.
- **One pay button.** `components/billing/SubscribeButton.tsx` is the only
  checkout trigger (used by the owner billing page, `PlanCard`,
  `StartTrialButton` and `UpgradeBenefitsPreview`), and
  `app/api/billing/create-order/route.ts` is the only order creator.
  `/api/subscriptions/create` is retired.
- **An ended trial keeps its row.** The trial row stays `status = 'active'` with
  `current_end` in the past, and the resolver falls back to the dormant Free
  grant. Moving `current_end` forward restores Lite with no other change.
- **Nothing records visits.** The only activity signals are saved costings
  (`estimator_quotes`, `free_saved_costings`), production saves, and
  `auth.users.last_sign_in_at`, which is a poor proxy because installed-app
  sessions rarely sign in again.
- **Free pages send no browser usage events today.** `trackPlanEvent` returns
  early on `/free` paths. Free funnel events (`free_funnel_events`: `quota_reached`,
  `upgrade_started`, and others) are written server-side.
- **Owner mobile numbers exist.** Signup stores a normalized Indian mobile in
  `profiles.phone`. The console currently shows only the verified email.
- **First trial outcomes arrive soon.** Trials created before
  `20261018120000_lite_trial_three_months.sql` kept 30 days, so the first ones end
  around mid-November 2026. Most trials (90 days) end from January 2027.

## A. Activity tracking (release 1)

### Who and what

- Tracked: owners (`profiles.role = 'owner'`) in the Free workspace
  (`app/free/*`) and the owner app (`app/(dashboard)/owner/*`).
- Not tracked: supervisors, founder console routes, public pages, auth pages.
- **Active minute:** the document is visible and there was a `pointerdown`,
  `keydown`, `wheel`, `touchstart` or `scroll` in the last 60 seconds. Each
  qualifying minute counts once. A hidden tab, or a visible tab with no input, does
  not count.
- **Areas:** each minute is attributed to the area of the current path:
  `estimator`, `saved_costings`, `rate_book`, `plan_billing`, `settings`,
  `support`, `other`. Base routes (production, stock, payroll and so on) count as
  `other` until Base ships. The path-to-area map is one pure function.
- **Device:** `phone`, `tablet` or `desktop` from viewport width and pointer type,
  and `installed` (true when `display-mode: standalone` matches).
- Never sent: page content, form values, query strings, full URLs, user agent
  strings or device identifiers.

### Storage

New migration, `private.account_activity_days`:

| Column | Notes |
|---|---|
| `org_id` | `uuid`, references `organizations`, `ON DELETE CASCADE` |
| `user_id` | `uuid`, references `auth.users`, `ON DELETE CASCADE` |
| `day` | `date`, India date |
| `active_minutes` | `integer`, 0–1440 |
| `area_minutes` | `jsonb`, keys from the fixed area list, integer values |
| `phone_minutes`, `tablet_minutes`, `desktop_minutes`, `installed_minutes` | `integer` |
| `first_seen_at`, `last_seen_at` | `timestamptz` |
| `last_flush_at` | `timestamptz`, used to clamp the next flush |

Primary key `(org_id, user_id, day)`. Index on `(org_id, last_seen_at desc)`.
RLS enabled, all privileges revoked from `PUBLIC`, `anon` and `authenticated`.

A `SECURITY DEFINER` function `public.record_account_activity(p_user_id,
p_org_id, p_minutes, p_area_minutes, p_device, p_installed)` with
`SET search_path = ''`, executable by `service_role` only. It:

- rejects areas outside the fixed list, and negative or non-integer minutes;
- clamps `p_minutes` to `ceil(minutes since last_flush_at) + 1` (or 6 for the
  first flush of the day) and the daily total to 1440;
- scales `area_minutes` down proportionally if they exceed the clamped total;
- upserts the day row atomically and sets `last_seen_at = now()`.

The clamp is per user per day, so two visible windows open at once can't double
the count.

### Endpoint

`POST /api/analytics/activity`, next to `plan-events`:

- `getCachedSession()`; 401 if there's no session, 403 unless the role is owner
  with an `org_id`.
- The org comes from the verified profile, never from the body.
- The body is validated with zod (minutes 0–10, area keys from the fixed list,
  device enum, installed boolean) and capped at 1 KB.
- It calls the RPC through the service-role client and returns 202. Failures
  return 5xx with no detail.
- It is rate limited per user through `lib/rate-limit.ts` (about 30 per 10
  minutes).
- It needs no proxy change: non-public `/api/*` routes already get the JSON 401.

### Client tracker

`components/analytics/ActivityTracker.tsx`, a client component that renders
nothing. It is mounted once in each of `app/free/layout.tsx`,
`app/(dashboard)/owner/layout.tsx`, `app/(support)/support/layout.tsx` and
`app/(plan-selection)/plans/page.tsx`, so the support and plan areas record time
too.

- A pure counting module (`lib/activity-tracking.ts`) holds the minute logic:
  the last input time, a 60-second tick, the current area and the pending buckets.
  The component only wires browser events to it.
- It flushes pending minutes every 5 minutes, on `visibilitychange` to hidden and
  on `pagehide`, but only when at least one minute is pending, so rapid tab
  switching sends nothing. Hidden and pagehide flushes use `navigator.sendBeacon`;
  the timer uses `fetch` with `keepalive`.
- On failure the minutes are dropped. There is no retry queue and nothing goes in
  local storage. Offline minutes are lost.
- It does nothing on the server or when there's no session.
- It never reports to Sentry.

### Privacy policy

Add one bullet to `app/privacy/page.tsx` section 2.6 (English only, like the rest
of the page): active time in the app, which area of the app, the device type, and
when the account was last seen, used to measure usage and retention.

## B. Who counts (release 2)

- New migration: replace `admin_factory_snapshot` and `admin_billing_report_input`
  so a missing classification row resolves to `production`, unless the owner's
  email is the founder email or a `+` alias of it (same local part plus
  `+anything`, same domain), which resolves to `internal`. The founder email is
  read in SQL from `login_email` on the enabled, unrevoked row in
  `private.platform_founder_grants`, not from a hard-coded string.
  Bodies otherwise unchanged: same signatures, grants, `search_path` and comments.
- The `unclassified` cohort stays valid in the CHECK constraint but is no longer
  produced by default.
- New service-role RPC `public.admin_set_org_cohort(p_actor_id, p_session_id,
  p_org_id, p_cohort, p_reason)` that asserts the founder session, upserts
  `private.admin_org_reporting` and appends the audit record in one transaction.
  "Count as customer" writes `production`.
- New route `POST /api/admin/factories/[orgId]/cohort` and a button on
  `/admin/factories/[orgId]`: "Mark as test account" (with a cohort choice of test,
  demo or internal and an optional reason, defaulting to "Marked by founder") and
  "Count as customer".

## C. Live/test label on payments (release 2)

- New migration: add a nullable `provider_mode text CHECK (provider_mode IN
  ('live','test'))` to `billing_checkout_attempts` and `subscription_payments`.
- `app/api/billing/create-order/route.ts` writes the mode from
  `getBillingReadiness().mode` onto the checkout attempt right after
  `claim_billing_checkout_attempt`. Payment rows are written in four places (the
  activation RPC and three webhook inserts), so a `BEFORE INSERT` trigger on
  `subscription_payments` fills `provider_mode` from the checkout attempt whose
  `provider_order_id` matches `razorpay_order_id`. The writers stay unchanged.
- Existing rows stay `NULL` and count as test, as agreed.

## C2. Paid plans: pilot and go-live (release 2)

### State

- New migration, `private.paid_plans_state`: a single row (`id boolean PRIMARY
  KEY DEFAULT true CHECK (id)`) with `go_live_at timestamptz NULL` and
  `go_live_by uuid NULL`. It is seeded with one row with `go_live_at = NULL`.
  RLS on, all privileges revoked from client roles.
- `public.paid_plans_state(p_org_id uuid)`: `SECURITY DEFINER`,
  `SET search_path = ''`, executable by `service_role` only, like
  `getOrgPlanAccess`'s reads. It returns `go_live_at` and `test_account` (true
  when that org resolves to the test, demo or internal cohort). The org ID always
  comes from the verified profile on the server. (`private.admin_org_reporting`
  is revoked even from `service_role`, so this lookup has to be a definer
  function.)
- `lib/paid-plans.ts` (`server-only`): `getPaidPlansState(orgId)` wrapped in
  React `cache()`. It returns `{ live, goLiveAt, checkoutOpen }`, where
  `checkoutOpen = (live && readiness mode is 'live') || (test_account &&
  readiness mode is 'test')`. This keeps real accounts out of test checkout even
  after go-live.
- `components/billing/PaidPlansProvider.tsx`: a client context carrying
  `checkoutOpen`. If no provider is mounted, it defaults to closed. It is mounted
  by the owner layout, the Free layout and the plans page
  (`app/(plan-selection)/plans/page.tsx`), which are the only trees that render
  `SubscribeButton`.

### Before go-live: customers

- `SubscribeButton` renders **"Notify me when paid plans open"** instead of
  starting checkout when `checkoutOpen` is false. Tapping it calls `POST /api/billing/notify-me` and then
  shows "Thanks. We'll tell you when paid plans open." The strings are added in
  EN, HI and GU, and layouts must fit the longer Gujarati and Hindi text.
- `POST /api/billing/notify-me`: owner session, org from the profile, upserts
  `private.paid_plan_interest` (`org_id` primary key, `user_id`, `first_at`,
  `last_at`, `taps`, `last_source` from a fixed enum: `billing`, `plan_card`,
  `upgrade_preview`) through a service-role RPC,
  and returns 202. It is idempotent per org; repeat taps bump `taps` and `last_at`.
- `create-order` calls `getPaidPlansState(orgId)` and refuses with 409
  `PAID_PLANS_NOT_OPEN` when `checkoutOpen` is false. This is the server-side
  guarantee; the button change is convenience.
- Trial copy is otherwise unchanged. Customers still see their real trial end
  date, and it moves when the owner extends.

### Before go-live: Extend trials

- On `/admin/payments`, a **Paid plans** card at the top shows the state ("Not
  live yet" or "Live since 12 Mar 2027") and, before go-live, an **Extend trials**
  control: +1, +2 or +3 months from today, or a specific date (at most 1 year
  ahead). It previews "This moves 23 trials to end on 15 Feb 2027 (4 of them had
  already ended and get Lite back)", then asks for confirmation.
- `public.admin_extend_trials(p_actor_id, p_session_id, p_new_end, p_dry_run)`:
  asserts the founder session; refuses once live; refuses `p_new_end` in the past
  or more than 1 year ahead. It targets `org_subscriptions` rows with `is_trial`
  and `current_end < p_new_end` for orgs with no non-trial subscription row that
  has a `razorpay_payment_id`. It sets `current_end = p_new_end`. It returns
  counts (total and already ended). The dry run writes nothing. The real run
  writes the audit record in the same transaction.
- **Today warning (before go-live only):** an attention item "N unpaid trials end
  in the next 14 days. Paid plans aren't live yet." with a link to the Extend
  trials control. Severity is high.

### Go live

- The Paid plans card shows a checklist built from `getBillingReadiness()`: live
  Razorpay keys, GST supplier details, the GST invoice flag and the billing
  document policy. Each `missing` entry is shown in plain words. The **Go live**
  button is disabled until readiness mode is `live`.
- Confirmation states what happens: real payments open, and N unpaid trials
  ending before <go-live + 30 days> move to that date.
- `POST /api/admin/paid-plans/go-live` checks readiness is `live` (environment,
  so it's checked in TypeScript), then calls `public.admin_go_live(p_actor_id,
  p_session_id)`. That function asserts the founder session; refuses if already
  live; sets `go_live_at = now()` and `go_live_by`; sets `current_end = now() + 30
  days` on unpaid trial rows (same targeting as extend) whose `current_end` is in
  the future but earlier than that; and writes the audit record. All in one
  transaction.
- There is no undo in the console. Reversing go-live is a deliberate database
  change.
- After go-live, `SubscribeButton` and `create-order` behave as they do today.

### Release-day note

Turning on live payments still needs the incorporation work outside this spec:
live Razorpay keys, GST supplier environment variables, the GST invoice
implementation, and flipping `BILLING_DOCUMENT_POLICY.state`. The checklist only
reports them.

## D. Metrics definitions (release 3)

All definitions live in a pure module, `lib/admin/growth-metrics.ts`. Every rate is
shown as "count of denominator · percent". A zero denominator shows "None yet",
never 0%. Population: factories whose cohort resolves to `production`. Unit: one
factory (organization).

**Go-live dependence:** revenue, trial outcome, Free → Lite and Lite renewal rate
only count events after `go_live_at`. Before go-live, those tiles show "Starts at
go-live" instead of a number.

| Metric | Definition |
|---|---|
| Plans now | Effective plan from the canonical resolver: Free, Lite trial (effective Lite from an active `is_trial` row), Lite paid (effective Lite otherwise), plus Base and No access only when above zero. This counts access, whatever the payment mode; revenue is what counts money. |
| Trial outcome | For trials whose end has passed and falls after go-live: **converted** = a paid Lite payment (live) between trial start and 14 days after trial end. **Back to Free** = none in that window and at least 14 days have passed. **Deciding** = ended less than 14 days ago with no payment. Conversion rate = converted ÷ (converted + back to Free). |
| Free → Lite | Accounts that have been on effective Free at any point (after a lapsed trial, or Free from signup) and later made a live Lite payment, ÷ all accounts that have been on Free. Also the median days from first Free day to payment. |
| Revenue | Sum of `subscription_payments.amount_paise` with `provider_mode = 'live'` and status `captured` or `refunded`, by `captured_at` in India time, minus `billing_payment_refunds.amount_paise` with status `issued` by refund time. A payment with status `refunded` and no `issued` refund row (refunded in the Razorpay dashboard) is subtracted in full in its capture month. Split by plan (from the linked subscription or checkout attempt) and purchase type (`initial_purchase` or `renewal` from the checkout attempt). Periods: this FY, last FY, all time, and month bars for the selected FY. Amounts are what customers paid; no tax split. |
| Signups | Production factories by `organizations.created_at` month, India time. |
| Activation | Of factories that signed up in the period and are at least 7 days old: those with a first saved costing (earliest of `estimator_quotes.created_at` and `free_saved_costings.created_at` for that org) within 7 days of signup. **Came back:** of those, the ones with activity on a second India day within 30 days of signup (an activity day row or a saved costing on a different day). The came-back step only uses activity rows from the tracking start date onward and is labelled "Since <date>". |
| Time spent | For each month: per factory, the sum of `active_minutes`, over factories with at least one active minute that month. Average and median, overall and by plan at month end. Plus the area split and device split as shares of minutes. |
| Last seen | The latest of `account_activity_days.last_seen_at`, the latest saved costing, and `auth.users.last_sign_in_at` of the owner. Until tracking is 60 days old, ghost counts carry "estimated" next to them. |
| Ghost accounts | Last seen 60 or more days ago. **Never started** = no saved costing ever. **Went quiet** = has at least one. |
| Lite renewal rate | Paid Lite terms (not trials) whose end was more than 30 days ago. **Renewed** = a live Lite payment from 30 days before to 30 days after the end. **Won back** = a live Lite payment later than that. Rate = renewed ÷ terms. Won back is shown separately. |
| Trials ending soon | Active trials ending within 14 days, sorted by active minutes in the last 30 days, descending. |
| Renewals due | Paid terms ending within 30 days, sorted by end date. |
| Wanted to pay | Factories in `private.paid_plan_interest`, with first and latest tap. Shown before and after go-live; at go-live it is the list to contact first. |
| Upgrade signals | In the last 14 days: "Notify me" taps; Free accounts with a `quota_reached` or `upgrade_started` funnel event; and, after go-live only, accounts that started a checkout but have no `captured` or `activated` attempt in the same 14 days. Free funnel events are keyed by owner subject, so they are mapped to that owner's factories through `free_account_grants`. |

Period switch: FY so far (default) or a single month. Plans now, ghosts, trials
ending, renewals due and upgrade signals ignore the period switch.

## E. Screens (release 3)

### Navigation

Add **Metrics** (`/admin/metrics`) between Today and Factories in `FounderShell`,
and add its paths to `safeFounderReturnPath`. The mobile nav grid goes from 5 to 6
items (3 per row on narrow screens).

### `/admin/metrics`

One server-rendered page, no client chart code. Top to bottom:

1. Period switch (links, not client state): "FY 2026–27 so far" or a month.
2. Headline row: revenue this FY; accounts on each plan; trial conversion; Free →
   Lite. Before go-live, the revenue and conversion tiles read "Starts at
   go-live", and a "Wanted to pay" tile takes the first slot.
3. **Money:** month bars stacked new or renewal; Lite or Base split; last FY and
   all-time totals.
4. **Accounts:** signups per month bars; plan counts.
5. **Getting started:** three-step funnel (signed up → first costing within 7 days
   → came back).
6. **Usage:** average and median minutes by plan; area share; device and installed
   share.
7. **Keeping customers:** trial outcomes; Free → Lite; Lite renewal rate; ghost
   accounts (never started / went quiet).

Every count links to `/admin/metrics/accounts?list=<key>&period=<period>`, a
plain list of the factories behind it (name, plan, signup date, last seen, minutes
in the last 30 days), each linking to `/admin/factories/[orgId]`. List keys come
from a fixed enum.

On phones, tiles stack in one column and lists render as cards rather than tables.

### Today: "Customers to contact"

A new block on `/admin` above "Needs attention", with three short lists of up to
10 rows each and a "See all" link to the matching accounts list:

- **Trials ending in the next 14 days:** factory, owner name, mobile (a `tel:`
  link and a `https://wa.me/<number>` link), days left, active minutes in the last
  30 days, costings saved.
- **Renewals due in the next 30 days:** factory, owner, mobile, end date, plan.
- **Upgrade signals in the last 14 days:** factory, owner, mobile, signal (hit the
  monthly limit, opened upgrade, checkout not completed), when.

### Factory page

Add the cohort control (section B) and show owner name and mobile alongside the
existing verified email.

## F. Data flow and code layout (release 3)

- `public.admin_growth_input(p_actor_id, p_session_id, p_as_of)`: a
  `SECURITY DEFINER`, service-role-only RPC that asserts the founder session and
  returns raw per-factory facts as JSON: org id, name, created_at, resolved
  cohort, owner name, phone and email, owner `last_sign_in_at`, subscription rows
  (with `is_trial`), first and latest saved costing, and saved-costing dates
  within 30 days of signup. Activity data: per-month totals for the last 24
  months (minutes, area minutes, device minutes), active dates within 30 days of
  signup, minutes in the last 30 days, and the latest `last_seen_at`. Money: live
  payments (amount, status, captured_at, plan, purchase type) and their refunds.
  Signals: checkout attempts from the last 14 days, Free funnel signals from the
  last 14 days, and the factory's `paid_plan_interest` row. It also returns
  `go_live_at` once at the top level. It is bounded (refuses more than 5,000 factories rather than
  truncating).
- `lib/admin/growth.ts` (`server-only`): `requireFounder()`, calls the RPC, runs
  `growth-metrics.ts`, records `adminRecordAudit(principal, 'metrics.read',
  'metrics', period, requestId, …)`.
- `lib/admin/growth-metrics.ts`: pure functions, one per definition, taking facts
  and `asOf`. All date bucketing in India time using `lib/time.ts`.
- `lib/admin/overview.ts` gains a `contacts` source built from the same input, so
  Today and Metrics share one read path.
- Computed on every request; no snapshot tables. At the current scale (hundreds of
  factories) this is well under a second.

## G. Failure behaviour

- Founder session or audit failure: the page fails closed, as today.
- The Metrics RPC failing: all sections come from one read, so the page shows a
  single "Metrics couldn't be loaded" notice instead of a half-empty page. Today's existing sources are unaffected (the `contacts` source fails
  on its own, like the others).
- Activity endpoint failure: minutes are dropped silently. Customers never see an
  error from tracking.
- Cohort update failure: the button shows an inline error. No partial write,
  since the upsert and audit share one transaction.

## H. Testing

- **Unit (`__tests__/`):**
  - `growth-metrics` fixtures for each definition: the 14-day deciding window,
    the FY boundary at 1 April 00:00 India time, a renewal at ±30 days and a
    won-back customer, a zero denominator, a trial paid early, refunds landing in
    a different month, test-mode and `NULL`-mode payments excluded, and
    internal/test cohorts excluded.
  - `activity-tracking` with fake timers: idle visible minutes don't count,
    hidden minutes don't count, area switches mid-minute, and flushing resets the
    buckets.
  - Path-to-area mapping.
- **Source-contract tests:** the tracker is mounted in both layouts; the Metrics
  nav item and return paths are present; the privacy policy contains the new
  bullet; the new SQL functions use `SET search_path = ''`, `SECURITY DEFINER`
  and service-role-only grants.
- **DB tests (`npm run test:db`):**
  - `record_account_activity` clamps inflated minutes and rejects unknown areas.
  - Direct table access is denied to `authenticated`.
  - The cohort default resolves to `production`, and to `internal` for founder
    `+` aliases.
  - `admin_set_org_cohort` writes the audit record atomically.
  - `admin_growth_input` refuses a non-founder session.
  - `admin_extend_trials`:
    - moves only unpaid trials, including already-ended ones;
    - the dry run writes nothing;
    - refuses after go-live;
    - refuses past dates and dates more than a year ahead.
  - `admin_go_live`:
    - moves only unpaid trials ending within 30 days;
    - refuses a second go-live;
    - writes the audit record atomically.
  - `paid_plans_state(p_org_id)` is executable by `service_role` only. The
    state and classification tables stay unreadable to client roles.
- **Paid-plans gate tests:**
  - `create-order` returns 409 `PAID_PLANS_NOT_OPEN` for a real account before
    go-live, and allows a test-cohort account in test mode.
  - `SubscribeButton` renders the "Notify me" label (static-markup test) before
    go-live.
  - The notify-me strings exist in EN, HI and GU.
  - `growth-metrics` shows "Starts at go-live" for revenue and conversion before
    go-live, and ignores test payments made before it.
- **Usual gates:** `npx tsc --noEmit`, `npm run lint` (zero warnings), and
  `npx vitest run`, all through `heavyq`.
- **Visual check:** `npm run dev` against QA for the tracker (watching network
  calls). The `/admin/metrics` visual check needs the owner's MFA sign-in, so the
  owner does it on the deployed site.

## I. Release order and owner steps

1. **Release 1 PR: activity tracking.** Activity table, RPC, endpoint, tracker
   and privacy line. The owner applies its migration to production, then it is
   deployed. Tracking starts on that day.
2. **Release 2 PR: paid-plan pilot controls.** Cohort default and button
   (section B), payment mode label (C), and paid-plans state, Notify me, the
   checkout gate, Extend trials, the Today warning and Go live (C2). **It must be
   live before the first 30-day trials end, around mid-November 2026,** or those
   accounts drop to Free with no way to pay. If it slips, the owner can extend
   those few trials with a one-off SQL update as a stopgap.
3. **Release 3 PR: Metrics.** Growth RPC, Metrics page and the Today "Customers
   to contact" block. The factory page's owner name and mobile ship in release 2,
   since that release already redefines the factory snapshot.

Implementation plans: `docs/superpowers/plans/2026-10-30-release-1-activity-tracking.md`,
`…-release-2-paid-plan-controls.md` and `…-release-3-founder-metrics.md`.

Each release: the owner applies its migrations, then it is deployed.

Migrations are written as files only. The agent does not run `supabase db push`
or any production write.

## Out of scope

MRR/ARR, churn scores, NPS, signing in as a customer, editing customer data from
the console, daily snapshot tables, chart libraries, notifications (including
telling customers their trial was extended, or that paid plans opened),
extending one account's trial, undoing go-live from the console, the GST invoice
implementation and incorporation setup, and plain-language rewrites of the
existing Today, Factories, Support, Payments and System pages (beyond the
additions above).

## Later pieces (separate specs)

3. **Support fixes:** alert the founder when a ticket arrives, alert the
   customer when the founder replies, and add a Support entry to the Free
   workspace.
4. **Plain-language screens:** rewrite the existing console pages, add a contact
   log and timeline to the factory page, and decide what to do with the
   `admin_billing_facts` projection now that Metrics reads payments directly.
