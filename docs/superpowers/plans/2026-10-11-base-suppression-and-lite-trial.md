# Base Suppression and Lite Trial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide and block Base for newly created accounts (existing accounts unchanged) and give new accounts a one-month Lite trial that falls back to Free when it ends unpaid.

**Architecture:** Two per-organization flags (`base_plan_visible`, `lite_trial_eligible`) set by migration. The trial is a normal `org_subscriptions` row with `is_trial = true`, created by a service-role RPC. Entitlement stays lazy: `getOrgPlanAccess` resolves the trial row like any Lite row, and once it lapses the dormant Free grant makes the org resolve to Free through the existing path. Base visibility is computed once into `OrgPlanAccess.baseVisible` and consumed by every upsell surface; `create-order` enforces it server-side.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase Postgres (migrations are files only), Vitest (`npm test`, `npm run test:db`), Tailwind/shadcn, `lib/i18n` dictionaries.

**Spec:** `docs/superpowers/specs/2026-10-11-base-suppression-and-lite-trial-design.md`

## Global Constraints

- Trial length is 30 days (`LITE_TRIAL_DAYS = 30`). Trial rows get no 24-hour grace.
- Converting from a trial is a first purchase at the first-year Lite price (₹2,999 incl. GST), never the ₹1,499 renewal price. Paying starts a fresh 365 days; unused trial days are not added.
- Existing organizations are backfilled `base_plan_visible = true` and `lite_trial_eligible = false`. New organizations default to `false` and `true`.
- Base is hidden from the public landing page for everyone while `BASE_PLAN_OPEN_TO_NEW_ACCOUNTS = false`. Flipping it is the Base launch.
- Lapsed *paid* Lite still resolves to `none` (existing rule). Only a never-paid trial falls back to Free.
- Trial-ending notice is in-app only. No email or WhatsApp.
- Migrations are written as files only. Never run `supabase db push`, `db pull`, `migration repair` or `functions deploy` (CLI is linked to production). Never run `npm run build` or `npm start` (they load production env).
- New user-facing strings need English, Hindi and Gujarati, with layouts that tolerate longer Gujarati/Hindi text. Phone touch targets use `min-h-[44px]` (root font is 14px, so `min-h-11` renders short).
- Security-sensitive SQL follows `SECURITY DEFINER` + `SET search_path = ''` + explicit `REVOKE`/`GRANT`.
- Many tests read source text. Before changing a file or string, search `__tests__/` for its path and update the contracts deliberately.
- `npm run lint` must stay at zero warnings; `npx tsc --noEmit` must pass.
- Commit steps: run them only if the user has asked for commits this session (`CLAUDE.md`: do not commit unless asked). Otherwise skip the commit step and continue.

## Review Focus

1. A trial org pays on day 3: must get first-year pricing, be allowed immediately (no "renewal opens 30 days before"), and the paid row must take over from the trial row. (Task 3)
2. Double-click or two tabs on "Start trial": exactly one trial row, no error page. (Task 1)
3. An org with an abandoned `created` checkout row (no payment) can still start a trial; an org with real paid history cannot. (Task 1)
4. Trial lapses while the Free grant is missing: the org resolves to `none` and lands on billing, with no redirect loop or crash. (Task 2)
5. A hidden-Base org that posts `{planTier:'base'}` to `create-order`, or opens `/owner/billing?plan=base`, never gets a Base order or Base card; an existing Base org that has expired still sees Base. (Tasks 2, 5, 6)

---

### Task 1: Migration and database tests

**Files:**
- Create: `supabase/migrations/20261011120000_base_suppression_and_lite_trial.sql`
- Create: `__tests__/db/lite-trial.dbtest.ts`
- Create: `__tests__/base-suppression-migration.test.ts` (source contract)

**Interfaces:**
- Produces (SQL):
  - `organizations.base_plan_visible boolean NOT NULL DEFAULT false`
  - `organizations.lite_trial_eligible boolean NOT NULL DEFAULT true`
  - `org_subscriptions.is_trial boolean NOT NULL DEFAULT false`
  - unique partial index `org_subscriptions_one_trial_per_org` on `(org_id) WHERE is_trial`
  - `public.start_lite_trial(p_org_id uuid) RETURNS uuid` (service_role only)
- Error codes from `start_lite_trial` (raised as `P0001` messages): `LITE_TRIAL_INELIGIBLE`, `LITE_TRIAL_FREE_GRANT_REQUIRED`.

- [ ] **Step 1: Write the failing db tests** in `__tests__/db/lite-trial.dbtest.ts`, using `freshDatabase`, `seedOwnerOrg(db, { tier: null })`, `asServiceRole`, `asUser`, `asSuperuser`, `pgError` from `__tests__/db/helpers.ts`. Seed a Free grant with `provision_free_account(userId, orgId, now() - interval '1 minute')` as service role. Tests (names exact):
  - `risk gate: an org with a Free grant and an active Lite row reads and writes business tables as its owner` — pick a business table already used in `__tests__/db/costing-save.dbtest.ts`; assert a normal authenticated read and insert succeed. **If this fails, stop and report to the user; the spec's design must change.**
  - `start_lite_trial inserts one 30-day Lite trial row and clears eligibility` — row has `plan_tier='lite'`, `status='active'`, `is_trial=true`, null Razorpay ids, `current_end - current_start = interval '30 days'`; `organizations.lite_trial_eligible` is false afterward.
  - `a second start_lite_trial raises LITE_TRIAL_INELIGIBLE`.
  - `two concurrent start_lite_trial calls create exactly one trial row` — use two separate `connect()` handles.
  - `start_lite_trial without a Free grant raises LITE_TRIAL_FREE_GRANT_REQUIRED`.
  - `an abandoned created checkout row does not block the trial` and `a row with a razorpay_payment_id or a status of active/authenticated/paused/halted/cancelled/completed/expired blocks it`.
  - `authenticated users cannot execute start_lite_trial or change the plan flags` — `42501` for both; service role can change the flags.
  - `a trial row does not create a paid_activation funnel event`.
  - `new organizations default to base_plan_visible false and lite_trial_eligible true`.
  - `is_trial rows must be Lite without Razorpay ids` — inserting `is_trial=true` with `plan_tier='base'` or a payment id fails the check constraint.
- [ ] **Step 2: Write the source-contract test** `__tests__/base-suppression-migration.test.ts`: reads the migration and asserts it contains `SET search_path = ''`, `REVOKE ALL ON FUNCTION public.start_lite_trial`, `GRANT EXECUTE ON FUNCTION public.start_lite_trial(uuid) TO service_role`, and the backfill (`base_plan_visible = true` and `lite_trial_eligible = false` applied to existing rows).
- [ ] **Step 3: Run to verify failure**

Run: `npx vitest run __tests__/base-suppression-migration.test.ts` and `npx vitest run --config vitest.db.config.ts __tests__/db/lite-trial.dbtest.ts`
Expected: contract test FAILS (file missing); db tests FAIL except the risk-gate test, which already passes.

- [ ] **Step 4: Write the migration.** Add the three columns, then one `UPDATE public.organizations SET base_plan_visible = true, lite_trial_eligible = false` for existing rows (run after the columns exist, before defaults matter). Add the `is_trial` check constraint and the partial unique index. Add a trigger on `organizations` that rejects any change to the two flag columns unless the caller is `service_role` or a database superuser (`42501`). Write `start_lite_trial` as `SECURITY DEFINER`, `SET search_path = ''`: lock the org row `FOR UPDATE`, require `lite_trial_eligible`, require a row in `free_account_grants` for the org, refuse if any `org_subscriptions` row has a `razorpay_payment_id` or a status in (active, authenticated, paused, halted, cancelled, completed, expired), insert the trial row, set `lite_trial_eligible = false`, return the new id. `REVOKE ALL ... FROM PUBLIC, anon, authenticated; GRANT EXECUTE ... TO service_role`.
- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run __tests__/base-suppression-migration.test.ts` and `npm run test:db -- __tests__/db/lite-trial.dbtest.ts`
Expected: PASS. Then run `npm run test:db` fully; existing db tests still pass (they seed orgs after the migration, so defaults apply).

- [ ] **Step 6: Commit** (see Global Constraints) — `feat(billing): add Base visibility and Lite trial schema`.

---

### Task 2: Pure access logic (trial state and Base visibility)

**Files:**
- Create: `lib/base-plan-visibility.ts`
- Create: `lib/lite-trial.ts`
- Modify: `lib/subscription-access.ts`
- Test: `__tests__/subscription-access-trial.test.ts`, `__tests__/base-plan-visibility.test.ts`

**Interfaces:**
- Produces in `lib/base-plan-visibility.ts`:
  - `export const BASE_PLAN_OPEN_TO_NEW_ACCOUNTS = false`
  - `export function canViewBase(input: { flag: boolean | null | undefined; effectiveTier: SubscriptionTier; subscriptionRows: readonly { plan_tier: string | null }[]; openToAll?: boolean }): boolean` — true when `openToAll ?? BASE_PLAN_OPEN_TO_NEW_ACCOUNTS`, or `flag === true`, or `effectiveTier === 'base'`, or any row has `plan_tier === 'base'`.
  - `export function normalizeSignupPlan(plan: 'free' | 'lite' | 'base' | undefined, openToAll?: boolean): 'free' | 'lite' | 'base'` — `'base'` becomes `'free'` unless open; `undefined` becomes `'free'`.
- Produces in `lib/lite-trial.ts` (no `server-only`, importable by client): `export const LITE_TRIAL_DAYS = 30` and `export function trialDaysLeft(endsAt: string, nowMs?: number): number` (whole days, rounded up, never below 0).
- Produces in `lib/subscription-access.ts`:
  - row type gains `is_trial?: boolean | null`
  - `OrgPlanAccess` gains optional `trialEndsAt?: string | null`, `trialEndedAt?: string | null`, `baseVisible?: boolean`, `liteTrialEligible?: boolean`
  - `export function resolveOrgAccessFromRows(input: { rows: readonly SubscriptionAccessRow[]; baseFlag: boolean | null | undefined; trialFlag: boolean | null | undefined; nowMs?: number }): OrgPlanAccess` — effective tier from current rows (same rules as today incl. retained-Lite-after-Base-expiry), plus `trialEndsAt` (effective row is a trial), `trialEndedAt` (no current row, a lapsed trial row exists), `baseVisible` via `canViewBase`, `liteTrialEligible = trialFlag === true && no trial row && !hasEstablishedPaidHistory(rows)`.
  - `export function applyFreeGrantToAccess(access: OrgPlanAccess, rows: readonly SubscriptionAccessRow[], hasFreeGrant: boolean): OrgPlanAccess` — moves the existing grant fallback out of `getOrgPlanAccess`: if tier is `none` and a grant exists, return `{ ...access, freeAccount: true }` when `hasEstablishedPaidHistory(rows)` else `{ ...access, ...resolveOrgPlanAccess('free'), freeAccount: true }` (keep the trial/visibility fields).
  - `hasEstablishedPaidHistory` ignores `is_trial` rows; `isSubscriptionRowCurrent` gives trial rows no grace.

- [ ] **Step 1: Write failing tests.** `subscription-access-trial.test.ts` (names exact):
  - `an active trial row resolves to lite with trialEndsAt`
  - `a trial row gets no 24 hour grace` (one minute after `current_end` it is not current)
  - `a lapsed trial with a Free grant resolves to free and reports trialEndedAt`
  - `a lapsed trial without a Free grant resolves to none` (Review Focus 4)
  - `a lapsed paid lite row with a Free grant stays none and freeAccount` (unchanged rule)
  - `a trial row is not established paid history`
  - `a paid lite row created after the trial wins and trialEndsAt is null`
  - `liteTrialEligible is false when a trial row exists, when paid history exists, or when the flag is false`
  `base-plan-visibility.test.ts`: flag true, base tier, any Base row (even expired), openToAll override, and hidden for a fresh Lite/Free org; `normalizeSignupPlan('base')` is `'free'`, `('lite')` stays, `(undefined)` is `'free'`, `('base', true)` stays `'base'`; `trialDaysLeft` for 29.2 days (30), exactly 0, past (0).
- [ ] **Step 2: Run to verify failure** — `npx vitest run __tests__/subscription-access-trial.test.ts __tests__/base-plan-visibility.test.ts` — Expected: FAIL (missing exports).
- [ ] **Step 3: Implement** the signatures above. Reuse `resolveEffectiveSubscription` and `hasPaidBaseHistory`; do not duplicate their logic.
- [ ] **Step 4: Run to verify pass** — same command, plus `npx vitest run` for existing subscription tests. Expected: PASS.
- [ ] **Step 5: Commit** — `feat(billing): trial-aware access resolution and Base visibility helper`.

---

### Task 3: Billing lifecycle ignores trials

**Files:**
- Modify: `lib/billing-lifecycle.ts` (`BillingSubscriptionRow`, `rowHasPaidHistory`)
- Modify: `app/api/billing/create-order/route.ts` (the `org_subscriptions` select), `app/(dashboard)/owner/billing/page.tsx` (its subscription selects)
- Test: `__tests__/billing-lifecycle-trial.test.ts`

**Interfaces:**
- Consumes: nothing new. Produces: `BillingSubscriptionRow.is_trial?: boolean | null`; `rowHasPaidHistory` returns false for trial rows.

- [ ] **Step 1: Write failing tests.** `trial then pay is an initial_purchase and allowed immediately` — rows: an active trial lite row ending in 27 days; `resolveBillingPurchase(rows, [], 'lite', now)` returns `allowed: true`, `purchaseType: 'initial_purchase'`, `periodStart` equal to `now` (not the trial end). `a trial row is not renewal history for pricing`. `a real paid lite row still gives renewal pricing`. Contract test: `create-order/route.ts` and `owner/billing/page.tsx` select strings include `is_trial`.
- [ ] **Step 2: Run to verify failure** — `npx vitest run __tests__/billing-lifecycle-trial.test.ts` — FAIL.
- [ ] **Step 3: Implement** the type field and early `if (row.is_trial) return false` in `rowHasPaidHistory`; add `is_trial` to the selects. Check `grep -rn "checkout_purchase_type" app lib` for any other select that builds `BillingSubscriptionRow` and add it there too.
- [ ] **Step 4: Run to verify pass** — `npx vitest run __tests__/billing-lifecycle-trial.test.ts __tests__/p1-billing-orders.test.ts` — PASS.
- [ ] **Step 5: Commit** — `fix(billing): trial rows are not paid history`.

---

### Task 4: Wire `getOrgPlanAccess`

**Files:**
- Modify: `lib/subscription.ts` (`getOrgPlanAccess`)
- Test: `__tests__/subscription-plan-access-wiring.test.ts` (source contract)

**Interfaces:**
- Consumes: `resolveOrgAccessFromRows`, `applyFreeGrantToAccess` (Task 2). Produces: `getOrgPlanAccess(orgId)` now returns `trialEndsAt`, `trialEndedAt`, `baseVisible`, `liteTrialEligible` populated.

- [ ] **Step 1: Write the failing contract test:** `lib/subscription.ts` selects `base_plan_visible` and `lite_trial_eligible` from `organizations`, selects `is_trial` in the nested `org_subscriptions(...)`, calls `resolveOrgAccessFromRows` and `applyFreeGrantToAccess`, and still calls `getFreeGrant` only when the effective tier is `none`.
- [ ] **Step 2: Run to verify failure** — FAIL.
- [ ] **Step 3: Implement.** Replace the inline composition with the two pure functions. Keep the grant lookup lazy (only when `effectiveTier === 'none'`) so paid orgs pay no extra query. `getSubscriptionDetail` also selects `is_trial` so the billing page can tell a trial from a paid term.
- [ ] **Step 4: Run to verify pass** — `npx vitest run` (full suite; several tests read this file's text — fix contracts deliberately). Also `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(billing): expose trial and Base visibility on org plan access`.

---

### Task 5: Base suppression, server enforcement

**Files:**
- Modify: `app/api/billing/create-order/route.ts`, `app/(auth)/actions/auth.ts` (`createOrganization`), `app/(auth)/signup/page.tsx`
- Test: `__tests__/base-suppression-enforcement.test.ts`

**Interfaces:**
- Consumes: `normalizeSignupPlan` (Task 2), `getOrgPlanAccess(...).baseVisible` (Task 4).

- [ ] **Step 1: Write failing tests** (source-contract plus pure): `create-order` returns 403 with message `Weavly Base is not available for new accounts yet.` when `planTier === 'base'` and `baseVisible !== true`, and this check sits before `resolveBillingPurchase` and `claim_billing_checkout_attempt`; `createOrganization` runs `normalizeSignupPlan(input.selectedPlan)` before computing `freeSignup`; the signup page maps `plan=base` through `normalizeSignupPlan`.
- [ ] **Step 2: Run to verify failure** — FAIL.
- [ ] **Step 3: Implement.** In `create-order`, read access with `getOrgPlanAccess(orgId)` only when `planTier === 'base'` (no extra query for Lite). Fail closed: anything other than `baseVisible === true` is a 403. In signup, the page and the action both normalize the plan; the page keeps its existing `lite` handling.
- [ ] **Step 4: Run to verify pass** — `npx vitest run __tests__/base-suppression-enforcement.test.ts __tests__/free-default-signup.test.ts __tests__/signup-legal-acceptance.test.ts __tests__/p1-billing-orders.test.ts` — PASS.
- [ ] **Step 5: Commit** — `feat(billing): block Base purchase and signup for new accounts`.

---

### Task 6: Base suppression, UI surfaces

**Files:**
- Modify: `app/(plan-selection)/plans/page.tsx`, `components/plans/PlanChooserClient.tsx`, `components/landing/plans.tsx`, `components/billing/UpgradeWall.tsx`, `components/billing/AccessGate.tsx`, `components/estimator/UpgradeBenefitsPreview.tsx`, `app/free/billing/FreeBillingClient.tsx` (and its page), `app/(dashboard)/owner/billing/page.tsx`
- Test: `__tests__/base-suppression-ui.test.ts`

**Interfaces:**
- Consumes: `OrgPlanAccess.baseVisible`, `BASE_PLAN_OPEN_TO_NEW_ACCOUNTS`.
- Produces: `PlanChooserClient` prop `baseVisible: boolean`; `UpgradeWall` prop `baseVisible?: boolean` (defaults to `false`, fail closed); callers of `UpgradeWall` must pass it.

- [ ] **Step 1: Audit first.** Run `grep -rn "UpgradeWall\|'base'\|Upgrade to Base\|chooseBase\|upgradeToBase" app components lib --include='*.ts' --include='*.tsx'` and list every surface that offers or advertises Base. Anything not in the Files list above that shows Base to a user without a Base subscription is added to this task.
- [ ] **Step 2: Write failing tests.** Contract tests that each Files-list surface reads `baseVisible` (or the landing constant) and that: the plans page passes `baseVisible={access.baseVisible === true}`; `PlanChooserClient` renders the Base `PlanCard` only when `baseVisible` and uses a two-column grid (`lg:grid-cols-2`, `max-w-4xl`) otherwise; the landing plans list omits Base while the constant is false; the `AccessGate` production branch returns `UnavailableCapabilityWall` when `baseVisible !== true`; the billing page filters `BILLING_SELF_SERVE_PLAN_TIERS` by visibility so `?plan=base` shows nothing for a hidden org. Where a component renders to static markup without a provider, also add a `renderToStaticMarkup` assertion that "Base" copy is absent for `baseVisible={false}` (Review Focus 5).
- [ ] **Step 3: Run to verify failure** — FAIL.
- [ ] **Step 4: Implement** per surface. Existing Base orgs (tier base, or any Base row) must see no change: assert this in the tests by passing `baseVisible: true`. Update `landing-page.test.ts` and `standalone-plan-chooser.test.ts` contracts deliberately.
- [ ] **Step 5: Run to verify pass** — `npx vitest run` (full) and `npx tsc --noEmit`.
- [ ] **Step 6: Commit** — `feat(plans): hide Base from new accounts`.

---

### Task 7: Start-trial server path

**Files:**
- Create: `lib/lite-trial.server.ts`
- Modify: `app/(auth)/onboarding/plans/actions.ts` (`completePlanSelection`)
- Test: `__tests__/lite-trial-start.test.ts`

**Interfaces:**
- Consumes: `finishFreeProvisioning`, `getOrgPlanAccess` (`liteTrialEligible`), RPC `start_lite_trial` (Task 1).
- Produces: `startLiteTrialForOwner(user: { id: string; email?: string; email_confirmed_at?: string; app_metadata: Record<string, unknown> }, orgId: string): Promise<{ ok: true } | { ok: false; error: string }>` (server-only); `completePlanSelection(plan: 'free' | 'paid' | 'trial')`.

- [ ] **Step 1: Write failing tests**, following the mocking style of `__tests__/free-service.test.ts`:
  - `refuses when liteTrialEligible is false` with `Your free trial is not available for this account.`
  - `provisions the Free grant before calling start_lite_trial` (call order asserted)
  - `maps LITE_TRIAL_INELIGIBLE to the not-available message and LITE_TRIAL_FREE_GRANT_REQUIRED / provisioning failure to Free setup could not finish. Please try again.`
  - `a second call after success is not an error`: `completePlanSelection('trial')` for an org already on an active trial returns `{ href: '/owner/estimator' }` via the existing active-paid branch.
  - Contract: `completePlanSelection` accepts `'trial'`, validates the argument, handles `'trial'` after the paid-history check and before the "payment still being verified" error, clears `plan_selection_pending` and refreshes the session like the other branches, and returns `{ href: '/owner/estimator' }`.
- [ ] **Step 2: Run to verify failure** — FAIL.
- [ ] **Step 3: Implement.** `startLiteTrialForOwner` checks eligibility, calls `finishFreeProvisioning(user, orgId)` (false or throw means refuse), then `createAdminClient().rpc('start_lite_trial', { p_org_id: orgId })`. The org id always comes from the verified profile in `completePlanSelection`, never from client input.
- [ ] **Step 4: Run to verify pass** — `npx vitest run __tests__/lite-trial-start.test.ts __tests__/standalone-plan-chooser.test.ts __tests__/free-continuation-integration.test.ts` — PASS.
- [ ] **Step 5: Commit** — `feat(billing): start Lite trial from verified owner session`.

---

### Task 8: Trial entry points and copy

**Files:**
- Create: `components/plans/StartTrialButton.tsx`, `lib/i18n/lite-trial.ts`
- Modify: `components/plans/PlanCard.tsx`, `components/plans/PlanChooserClient.tsx`, `app/(plan-selection)/plans/page.tsx`, `components/estimator/UpgradeBenefitsPreview.tsx`, `app/free/billing/FreeBillingClient.tsx` (and its page)
- Test: `__tests__/lite-trial-entry.test.ts`, `__tests__/lite-trial-localization.test.ts`

**Interfaces:**
- Consumes: `completePlanSelection('trial')` (Task 7), `OrgPlanAccess.liteTrialEligible`.
- Produces: `StartTrialButton` props `{ className?: string; onStarted?: () => void }`, client component that calls `completePlanSelection('trial')`, shows the returned error, and navigates with `window.location.assign(result.href)`; `liteTrialText(language, key, vars?)` in `lib/i18n/lite-trial.ts`, mirroring the helper shape and language-tuple order of `lib/i18n/free-mobile-entry.ts`.

Copy keys and English text (Hindi and Gujarati written to the same meaning; flag them for the owner's review):
`startTrial` "Start 1-month free trial", `trialPayNow` "Or pay now: ₹2,999 for the first year", `trialDisclosure` "30 days of Lite free, no payment needed. After that, pay ₹2,999 for the first year (incl. GST) to stay on Lite, or continue on Free.", `trialNotAvailable` "Your free trial is not available for this account.", `trialBannerDays` "Lite trial: {days} days left", `trialBannerLastDay` "Lite trial ends today", `trialSubscribe` "Subscribe to keep Lite", `trialEndsOn` "Free trial ends {date}", `trialEndedTitle` "Your Lite trial has ended", `trialEndedBody` "You are now on Free. Subscribe to Lite to get your saved qualities and rate book back.", `trialDismiss` "Dismiss".

- [ ] **Step 1: Write failing tests.** Localization: every key has non-empty English, Hindi and Gujarati, and `{days}` / `{date}` placeholders survive in all three (pattern: `__tests__/base-plan-localization.test.ts`). Entry contract: `PlanCard` for `lite` renders `StartTrialButton` as the primary action when `liteTrialEligible` and the normal `SubscribeButton` otherwise, with the trial disclosure and `trialPayNow` link shown only when eligible; `UpgradeBenefitsPreview` and `FreeBillingClient` show the trial button for Lite when eligible; the plans page passes `liteTrialEligible={access.liteTrialEligible === true}`; `StartTrialButton` has `min-h-[44px]`.
- [ ] **Step 2: Run to verify failure** — FAIL.
- [ ] **Step 3: Implement.** After a successful start the Free upgrade surfaces also use the returned `href`. Keep `PlanCard`'s existing visual rules (ink primary button, saffron only for the Recommended badge).
- [ ] **Step 4: Run to verify pass** — `npx vitest run __tests__/lite-trial-entry.test.ts __tests__/lite-trial-localization.test.ts __tests__/standalone-plan-chooser.test.ts __tests__/lite-plan-copy-regression.test.ts` — PASS.
- [ ] **Step 5: Commit** — `feat(plans): Lite trial entry points`.

---

### Task 9: Trial banner, billing page and expiry notice

**Files:**
- Create: `components/billing/TrialBanner.tsx`, `components/billing/TrialEndedNotice.tsx`
- Modify: `app/(dashboard)/owner/layout.tsx`, `app/(dashboard)/owner/billing/page.tsx`, `app/free/page.tsx` / `app/free/FreeWorkspace.tsx`
- Test: `__tests__/lite-trial-surfaces.test.ts`

**Interfaces:**
- Consumes: `OrgPlanAccess.trialEndsAt` / `trialEndedAt`, `trialDaysLeft` (Task 2), `liteTrialText` (Task 8).
- Produces: `TrialBanner({ endsAt }: { endsAt: string })`, `TrialEndedNotice({ orgId, endedAt }: { orgId: string; endedAt: string })`.

- [ ] **Step 1: Write failing tests.** `renderToStaticMarkup(<TrialBanner endsAt=... />)`: shows the days-left text; at 0 days left shows the "ends today" text; has a link to `/owner/billing`. Contract: the owner layout renders `TrialBanner` only when `access.trialEndsAt` is set; the billing page shows `trialEndsOn` and the Lite subscribe button with first-year pricing for a trial org and does not render a paid-period or receipt block for the trial row; `FreeWorkspace` (or its page) renders `TrialEndedNotice` only when `access.trialEndedAt` is set; the notice stores dismissal under `weavly:lite-trial-ended:<orgId>` in `localStorage`, every read and write wrapped in try/catch and the notice still rendering when storage throws.
- [ ] **Step 2: Run to verify failure** — FAIL.
- [ ] **Step 3: Implement.** Banner is emphasised (not just text) when 7 or fewer days remain. Read the billing page fully first: it must present the trial row (no Razorpay ids) as a trial, not as a paid term with a renewal window. Keep touch targets at `min-h-[44px]`.
- [ ] **Step 4: Run to verify pass** — `npx vitest run __tests__/lite-trial-surfaces.test.ts __tests__/free-billing-workspace.test.tsx __tests__/free-plan-settings-billing.test.ts` — PASS. Then `npx tsc --noEmit`.
- [ ] **Step 5: Commit** — `feat(billing): trial banner, billing state and expiry notice`.

---

### Task 10: Founder console reporting

**Files:**
- Create: `supabase/migrations/20261011120100_admin_snapshot_trial_flag.sql`
- Modify: `lib/admin/metrics.ts` (`SubscriptionInput`), `lib/admin/factories.ts` (zod schema and `termHistory`)
- Test: `__tests__/admin-trial-reporting.test.ts`; add a case to `__tests__/db/admin-factories.dbtest.ts`

**Interfaces:**
- Produces: `SubscriptionInput.is_trial?: boolean`; the `admin_factory_snapshot` JSON rows gain `is_trial`; `termHistory` entries gain `isTrial: boolean`.

- [ ] **Step 1: Write failing tests.** Unit: `resolveFactoryAccess` with an active trial row (no payment) returns `effectivePlan: 'lite'` and `currentPaidTerm: null`; with a lapsed trial and `hasFreeGrant: true` returns `effectivePlan: 'free'` (without `is_trial` in the rows it would wrongly be `none`); a trial row never becomes a paid term. Db: the admin snapshot for an org with a trial row returns `is_trial: true`.
- [ ] **Step 2: Run to verify failure** — FAIL.
- [ ] **Step 3: Implement.** The admin SQL builds each subscription object with explicit keys, so write `CREATE OR REPLACE FUNCTION public.admin_factory_snapshot(...)` in the new migration. First find its **latest** definition (`grep -ln "admin_factory_snapshot" supabase/migrations/*.sql`) and copy that body exactly, adding only `'is_trial', s.is_trial` to the `jsonb_build_object`. Keep signature, grants and `SET search_path` identical. Add `is_trial: z.boolean()` to the subscriptions schema in `lib/admin/factories.ts`. Do not bump `ADMIN_METRIC_VERSION` unless existing metric tests require it.
- [ ] **Step 4: Run to verify pass** — `npx vitest run __tests__/admin-trial-reporting.test.ts` and `npm run test:db -- __tests__/db/admin-factories.dbtest.ts` plus the other `admin-*` db tests — PASS.
- [ ] **Step 5: Commit** — `fix(admin): treat trial rows as trials in founder reporting`.

---

### Task 11: Docs and final verification

**Files:**
- Modify: `CLAUDE.md` (Plan entitlement paragraph), `docs/general/README.md` only if it indexes plan docs

- [ ] **Step 1:** Add two sentences to the **Plan entitlement** paragraph of `CLAUDE.md`: Base is hidden for new accounts via `organizations.base_plan_visible` / `BASE_PLAN_OPEN_TO_NEW_ACCOUNTS`, and the Lite trial is an `is_trial` row in `org_subscriptions` whose expiry falls back to Free through the dormant Free grant. Link the spec instead of restating it.
- [ ] **Step 2: Run the full gates**

Run: `npx tsc --noEmit && npm run lint && npx vitest run && npm run test:db`
Expected: all pass, zero lint warnings. Fix any source-contract test broken by renamed copy or files deliberately.

- [ ] **Step 3: Report honestly.** State what was not verified: the migrations are file-only and not applied to QA or production, so trial start, expiry and the chooser were never exercised against a real database or in a browser; Hindi and Gujarati strings need the owner's review; the owner must apply both migrations (`20261011120000`, `20261011120100`) before deploying code that selects the new columns.
- [ ] **Step 4: Commit** — `docs: record Base suppression and Lite trial`.
