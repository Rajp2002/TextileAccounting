# Release 2: Paid-Plan Pilot Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Count every factory as a real customer unless the founder marks it test, label each payment live or test, keep real customers from paying before go-live (they see "Notify me" instead), and give the founder an "Extend trials" control and a one-time "Go live" switch.

**Architecture:** New `SECURITY DEFINER` SQL functions hold every rule: cohort resolution, the payment-mode trigger, paid-plans state, interest recording, trial extension and go-live. Founder functions assert the founder session and write audit in the same transaction. Customer-side code reads one server-only helper, `getPaidPlansState(orgId)`, and passes `checkoutOpen` down through a React context. `create-order` enforces the same rule on the server.

**Tech Stack:** Supabase Postgres (plpgsql), Next.js 16 route handlers and server components, React 19 client components, zod, Vitest (unit, static markup, `test:db`).

**Spec:** `docs/superpowers/specs/2026-10-30-founder-metrics-and-activity-design.md`, sections B, C and C2.

## Global Constraints

- **Deadline:** live before the first 30-day trials end, around mid-November 2026.
- **Cohort default:** a missing `private.admin_org_reporting` row resolves to `production`. If the owner's email equals the founder's `login_email`, or has the same domain and the same local part before `+`, it resolves to `internal`. The founder email comes from `private.platform_founder_grants` where `enabled` and `revoked_at IS NULL`, never a hard-coded string. `unclassified` stays valid in the CHECK constraint.
- **Checkout rule:** `checkoutOpen = (goLiveAt !== null && mode === 'live') || (testAccount && mode === 'test')`, where `testAccount` = cohort is test, demo or internal. This is stricter than the spec's wording, on purpose: it keeps real accounts out of test checkout even after go-live.
- **Unpaid trial:** an `org_subscriptions` row with `is_trial`, whose org has no row with `is_trial IS NOT TRUE AND razorpay_payment_id IS NOT NULL`.
- **Extend trials:** before go-live only. The new end must be after `now()` and at most `now() + interval '1 year'`. It targets unpaid trials with `current_end < p_new_end`, including ones that already ended.
- **Go live:** only when `getBillingReadiness().mode === 'live'`. It sets `go_live_at = now()` once and moves unpaid trials with `now() < current_end < now() + 30 days` to `now() + 30 days`. There is no undo in the console.
- **Customer copy** (EN, HI and GU rows in `lib/i18n/lite-phrases/account.ts`, rendered with `tx`):
  - "Notify me when paid plans open" / "पेड प्लान खुलने पर मुझे बताएँ" / "પેઇડ પ્લાન શરૂ થાય ત્યારે મને જણાવો"
  - "Thanks. We'll tell you when paid plans open." / "धन्यवाद। पेड प्लान खुलने पर हम आपको बताएँगे।" / "આભાર. પેઇડ પ્લાન શરૂ થશે ત્યારે અમે તમને જણાવીશું."
  - "Could not save your request. Try again." / "आपका अनुरोध सहेजा नहीं जा सका। फिर प्रयास करें।" / "તમારી વિનંતી સાચવી શકાઈ નથી. ફરી પ્રયાસ કરો."
- **Interest sources:** `billing`, `plan_card`, `upgrade_preview`.
- **Migrations:** files only, never applied by the agent. All commands go through `heavyq`. Lint stays at zero warnings. Commits stay on this branch.

## Review Focus

- A trial that already ended and fell to Free gets extended. Its owner must see Lite again on the next page load, with no other change. Covered by Task 6's DB test (A's `current_end` moves to the new date, and `status` stays `active`) together with the existing resolver tests that a trial row with a future end resolves to Lite. Task 6 adds one resolver unit case: `resolveOrgAccessFromRows` with that moved row gives `effectiveTier: 'lite'` and `trialEndsAt` equal to the new end.
- A real customer who opened the plans page before go-live and taps the old button after a deploy: the server still refuses with 409 `PAID_PLANS_NOT_OPEN`. Covered by Task 4's route test.
- The founder clicks Go live twice, or two browser tabs race: the second click is refused and trials move only once. Covered by Task 6's "refuses a second go-live" DB test.
- A test account owned by the founder's `+test` alias is internal, so test checkout still works before go-live. Covered by Task 1's alias test and Task 4's `computeCheckoutOpen` table.
- Gujarati and Hindi labels are longer than English and must not overflow the 40–44px button. Covered by Task 5's static markup test asserting the label and the button's `min-h-11` or `h-11` class. The visual check in Task 7 covers wrapping.

---

### Task 1: Cohort default, founder alias and owner contact in the snapshot

**Files:**
- Create: `supabase/migrations/20261030130000_reporting_cohort_default.sql`
- Modify: `lib/admin/factories.ts` (the zod source schema at line 13 and `contact` at line 89), `lib/admin/metrics.ts` (`FactorySource`)
- Modify tests that assert the old default: `__tests__/db/admin-factories.dbtest.ts` ("missing classification is unclassified"), `__tests__/db/admin-data-rights.dbtest.ts`, `__tests__/db/admin-retention.dbtest.ts`, `__tests__/admin-factories-dal.test.ts`, `__tests__/admin-factory-metrics.test.ts`, `__tests__/admin-payments.test.ts`. Update each one only where it depends on a *missing* row being `unclassified`.
- Test: `__tests__/db/reporting-cohort.dbtest.ts`

**Interfaces:**
- Produces:
  - `private.is_founder_alias(p_email text) RETURNS boolean`, STABLE
  - `private.resolve_reporting_cohort(p_explicit text, p_owner_email text) RETURNS text`, STABLE. It returns `coalesce(p_explicit, CASE WHEN private.is_founder_alias(p_owner_email) THEN 'internal' ELSE 'production' END)`.
  - Both are revoked from client roles and from `service_role`, so only definer functions can call them.
  - `admin_factory_snapshot` rows gain `owner_name` (`profiles.full_name`) and `owner_phone` (`profiles.phone`).
  - `FactorySource` gains `owner_name: string | null; owner_phone: string | null`.
  - `FactoryDetail.contact` becomes `{ verifiedOwnerEmail: string | null; ownerName: string | null; ownerPhone: string | null }`.

- [ ] **Step 1: Write the failing DB tests.** Set up the founder exactly as `__tests__/db/admin-factories.dbtest.ts` `beforeAll` does, with `login_email` `founder-fixture@example.test`.

```ts
it('a factory with no classification row counts as production', async () => {
    const plain = await seedOwnerOrg(db, { tier: null })
    expect((await snapshot(plain.orgId)).rows[0].cohort).toBe('production')
})
it("the founder's email and its + aliases are internal; look-alikes are not", async () => {
    for (const [email, cohort] of [['founder-fixture@example.test', 'internal'], ['Founder-Fixture+trial2@example.test', 'internal'],
        ['founder-fixture2@example.test', 'production'], ['founder-fixture+x@example.org', 'production']] as const) {
        const org = await seedOwnerOrg(db, { tier: null }); await setOwnerEmail(org.userId, email)
        expect((await snapshot(org.orgId)).rows[0].cohort).toBe(cohort)
    }
})
it('an explicit classification still wins', async () => { /* insert 'test' row for an alias-free org → 'test' */ })
it('a revoked founder grant stops the alias rule', async () => { /* set revoked_at → alias org resolves to production */ })
it('exposes owner name and phone', async () => { /* profiles.full_name 'Ramesh', phone '+919800000001' → owner_name/owner_phone */ })
it('billing report treats unclassified factories as production', async () => { /* a live verified capture fact for an org with no row is inside summary.knownGrossMinor */ })
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `heavyq run --est 4m --label test-db-cohort -- npm run test:db -- __tests__/db/reporting-cohort.dbtest.ts`
Expected: FAIL. Cohort is `unclassified`, and `owner_name` is undefined.

- [ ] **Step 3: Write the migration.**
  - Create the two private functions.
  - `CREATE OR REPLACE` `public.admin_factory_snapshot` by copying its latest body from `20261011120100_admin_snapshot_trial_flag.sql` verbatim. Change only these:
    - `coalesce(r.cohort,'unclassified')` becomes `private.resolve_reporting_cohort(r.cohort, u.email)`.
    - Select `p.full_name AS owner_name, p.phone AS owner_phone` in `population` and emit both keys in the row object.
  - `CREATE OR REPLACE` `public.admin_billing_report_input` from `20261004152000_admin_billing_reporting.sql` the same way:
    - Join `public.organizations o ON o.id = f.org_id` and `auth.users u ON u.id = o.owner_id`.
    - Replace both `coalesce(r.cohort,'unclassified')` with the resolver.
    - Change `r.cohort = 'production'` to compare the resolved cohort.
  - Restate grants, `search_path` and comments as in the originals.

- [ ] **Step 4: Update the TypeScript source schema and contact mapping, then the listed tests.** Each expectation that a missing row is `unclassified` becomes `production`. Fixtures that insert explicit rows are unchanged.

- [ ] **Step 5: Run the new and touched tests and confirm they pass**

Run: `heavyq run --est 6m --label test-db-cohort -- npm run test:db -- __tests__/db/reporting-cohort.dbtest.ts __tests__/db/admin-factories.dbtest.ts __tests__/db/admin-data-rights.dbtest.ts __tests__/db/admin-retention.dbtest.ts __tests__/db/admin-payments.dbtest.ts`, then `heavyq run --est 60s --label vitest-admin -- npx vitest run __tests__/admin-factories-dal.test.ts __tests__/admin-factory-metrics.test.ts __tests__/admin-payments.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261030130000_reporting_cohort_default.sql lib/admin/factories.ts lib/admin/metrics.ts __tests__
git commit -m "feat(admin): count unclassified factories as customers; founder aliases are internal"
```

### Task 2: Mark as test account, and owner contact on the factory page

**Files:**
- Create: `supabase/migrations/20261030130100_admin_set_org_cohort.sql`, `lib/admin/cohort.ts`, `app/api/admin/factories/[orgId]/cohort/route.ts`, `components/admin/cohort-control.tsx`
- Modify: `app/(admin-console)/admin/factories/[orgId]/page.tsx` (the "Access and account" section)
- Test: `__tests__/db/admin-set-org-cohort.dbtest.ts`, `__tests__/admin-cohort.test.ts`

**Interfaces:**
- Consumes: `FactoryDetail.contact` and `cohort` from Task 1. `requireFounder`, `FounderPrincipal` and `AdminError` from `lib/admin/`. `reportResponse` from `lib/admin/report-http.ts`.
- Produces:
  - `public.admin_set_org_cohort(p_actor_id uuid, p_session_id uuid, p_org_id uuid, p_cohort text, p_reason text, p_request_id uuid) RETURNS jsonb` (`{ orgId, cohort }`). It calls `private.admin_assert_founder_session`, upserts `private.admin_org_reporting` (`classified_by = p_actor_id`, `classified_at = now()`), and calls `private.admin_append_audit(…, 'factory.cohort.set', 'organization', p_org_id::text, 'success', p_request_id, NULL, jsonb_build_object('cohort', before), jsonb_build_object('cohort', p_cohort))`, all in one transaction. `p_cohort` must be in `('production','test','demo','internal')`, otherwise 22023. A missing org raises `P0002`. Service role only.
  - `setFactoryCohort(orgId: string, input: unknown): Promise<{ orgId: string; cohort: 'production' | 'test' | 'demo' | 'internal' }>` in `lib/admin/cohort.ts` (`server-only`). Its zod schema: `{ cohort: enum, reason: string trimmed 3–500, optional, default 'Marked by founder' }`, strict. It throws `AdminError('INVALID_INPUT', 400, …)` on a bad org UUID or body.
  - `POST /api/admin/factories/[orgId]/cohort` returns `reportResponse(() => setFactoryCohort(orgId, await request.json()))`.
  - `CohortControl({ orgId, cohort })`, a client component:
    - Before marking: "Mark as test account" opens an inline choice (Test, Demo or Internal, plus an optional reason) and a confirm button.
    - When already test, demo or internal: a "Count as customer" button.
    - After a successful save it calls `router.refresh()`. Errors show inline.

- [ ] **Step 1: Write the failing tests**

```ts
// DB
it('upserts the cohort and audits in the same transaction', async () => { /* call → admin_org_reporting.cohort 'test'; audit row action 'factory.cohort.set' with after_safe {cohort:'test'} */ })
it('refuses a non-founder session and unknown cohorts', async () => { /* random session → error; 'unclassified' → 22023 */ })
it('rolls back the classification when the audit fails', async () => { /* follow admin-support.dbtest audit-failure pattern; cohort unchanged */ })
// Unit (mock createAdminClient + requireFounder)
it('defaults the reason and rejects extra keys', async () => {
    await setFactoryCohort(orgId, { cohort: 'test' }); expect(rpc).toHaveBeenCalledWith('admin_set_org_cohort', expect.objectContaining({ p_cohort: 'test', p_reason: 'Marked by founder' }))
    await expect(setFactoryCohort(orgId, { cohort: 'test', orgId: 'x' })).rejects.toMatchObject({ status: 400 })
    await expect(setFactoryCohort('not-a-uuid', { cohort: 'test' })).rejects.toMatchObject({ status: 400 })
})
it('factory page shows the control and tappable contact', () => {
    const src = readFileSync('app/(admin-console)/admin/factories/[orgId]/page.tsx', 'utf8')
    expect(src).toContain('<CohortControl'); expect(src).toContain('tel:'); expect(src).toContain('https://wa.me/')
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `heavyq run --est 3m --label test-db-setcohort -- npm run test:db -- __tests__/db/admin-set-org-cohort.dbtest.ts`, then `heavyq run --est 45s --label vitest-cohort -- npx vitest run __tests__/admin-cohort.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the migration, module, route and control.** On the page, render the owner name, then the phone as `tel:` and `https://wa.me/<digits without +>` links, then the email, then `<CohortControl orgId={factory.id} cohort={factory.cohort}/>`. Use ink buttons, `min-h-11`, and no saffron.

- [ ] **Step 4: Run them and confirm they pass** (same commands). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261030130100_admin_set_org_cohort.sql lib/admin/cohort.ts "app/api/admin/factories/[orgId]/cohort/route.ts" components/admin/cohort-control.tsx "app/(admin-console)/admin/factories/[orgId]/page.tsx" __tests__/db/admin-set-org-cohort.dbtest.ts __tests__/admin-cohort.test.ts
git commit -m "feat(admin): mark factories as test accounts and show owner contact"
```

### Task 3: Live/test label on payments

**Files:**
- Create: `supabase/migrations/20261030130200_payment_provider_mode.sql`
- Modify: `app/api/billing/create-order/route.ts`. After `claim_billing_checkout_attempt` succeeds (line ~181), add `await admin.from('billing_checkout_attempts').update({ provider_mode: billingReadiness.mode }).eq('id', attempt.id)`. Only `'live'` or `'test'` reach this point, because `blocked` returns 503 earlier.
- Test: `__tests__/db/payment-provider-mode.dbtest.ts`, `__tests__/payment-provider-mode-contract.test.ts`

**Interfaces:**
- Produces: `provider_mode text CHECK (provider_mode IN ('live','test'))`, nullable, on `public.billing_checkout_attempts` and `public.subscription_payments`. Also `private.fill_payment_provider_mode()` with a `BEFORE INSERT` trigger `subscription_payments_provider_mode` on `public.subscription_payments`. When `NEW.provider_mode IS NULL`, it copies `provider_mode` from the attempt where `provider_order_id = NEW.razorpay_order_id`.

- [ ] **Step 1: Write the failing tests**

```ts
it('copies the mode from the matching checkout attempt', async () => { /* attempt provider_order_id 'order_1', provider_mode 'live'; insert payment razorpay_order_id 'order_1' → 'live' */ })
it('leaves the mode empty when no attempt matches, and keeps an explicit value', async () => { /* 'order_x' → NULL; explicit 'test' stays 'test' */ })
it('rejects other values', async () => { /* 'sandbox' → 23514 */ })
// contract
it('create-order labels the attempt with the readiness mode', () => {
    expect(readFileSync('app/api/billing/create-order/route.ts', 'utf8')).toContain('provider_mode: billingReadiness.mode')
})
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 3m --label test-db-mode -- npm run test:db -- __tests__/db/payment-provider-mode.dbtest.ts`. Expected: FAIL, column missing.

- [ ] **Step 3: Implement the migration and the one-line route change.**

- [ ] **Step 4: Run and confirm they pass**, along with the existing create-order suites: `heavyq run --est 60s --label vitest-create-order -- npx vitest run __tests__/payment-provider-mode-contract.test.ts __tests__/p1-billing-orders.test.ts __tests__/base-suppression-create-order.test.ts __tests__/billing-lifecycle-trial.test.ts`. Expected: PASS. If a create-order test's admin stub lacks `.update().eq()`, extend that stub.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261030130200_payment_provider_mode.sql app/api/billing/create-order/route.ts __tests__/db/payment-provider-mode.dbtest.ts __tests__/payment-provider-mode-contract.test.ts __tests__/*create-order*.test.ts __tests__/p1-billing-orders.test.ts __tests__/billing-lifecycle-trial.test.ts
git commit -m "feat(billing): record live or test mode on checkout attempts and payments"
```

### Task 4: Paid-plans state, checkout gate and context

**Files:**
- Create: `supabase/migrations/20261030130300_paid_plans_state.sql`, `lib/paid-plans.ts`, `lib/paid-plans.server.ts`, `components/billing/PaidPlansProvider.tsx`
- Modify: `app/api/billing/create-order/route.ts` (gate placed before the readiness check), `app/(dashboard)/owner/layout.tsx`, `app/free/layout.tsx`, `app/(plan-selection)/plans/page.tsx` (wrap in `<PaidPlansProvider>`)
- Modify the existing create-order tests (`p1-billing-orders`, `base-suppression-create-order`, `billing-lifecycle-trial` and any other file importing the route) to add `vi.mock('@/lib/paid-plans.server', () => ({ getPaidPlansState: async () => ({ live: true, goLiveAt: '2027-01-01T00:00:00Z', checkoutOpen: true }) }))`
- Test: `__tests__/db/paid-plans.dbtest.ts`, `__tests__/paid-plans.test.ts`

**Interfaces:**
- Produces (SQL):
  - Table `private.paid_plans_state(id boolean PRIMARY KEY DEFAULT true CHECK (id), go_live_at timestamptz, go_live_by uuid REFERENCES auth.users(id) ON DELETE SET NULL)`, seeded with `(true, NULL, NULL)`.
  - `public.paid_plans_state(p_org_id uuid) RETURNS jsonb` → `{ goLiveAt: string | null, testAccount: boolean }`. It uses `private.resolve_reporting_cohort`. Service role only.
  - Table `private.paid_plan_interest(org_id uuid PRIMARY KEY REFERENCES organizations ON DELETE CASCADE, user_id uuid REFERENCES auth.users ON DELETE CASCADE, first_at timestamptz NOT NULL DEFAULT now(), last_at timestamptz NOT NULL DEFAULT now(), taps integer NOT NULL DEFAULT 1, last_source text NOT NULL CHECK (last_source IN ('billing','plan_card','upgrade_preview')))`.
  - `public.record_paid_plan_interest(p_org_id uuid, p_user_id uuid, p_source text) RETURNS integer` returns taps. Upsert: `taps + 1`, `last_at = now()`, `last_source`. Service role only.
- Produces (TS):
  - In `lib/paid-plans.ts`, which stays pure and safe for the client:
    - `export const PAID_PLAN_INTEREST_SOURCES = ['billing','plan_card','upgrade_preview'] as const`
    - `export type PaidPlanInterestSource = typeof PAID_PLAN_INTEREST_SOURCES[number]`
    - `export type PaidPlansState = { live: boolean; goLiveAt: string | null; checkoutOpen: boolean }`
    - `export function computeCheckoutOpen(goLiveAt: string | null, testAccount: boolean, mode: 'test' | 'live' | 'blocked'): boolean`
  - In `lib/paid-plans.server.ts` (`server-only`): `export const getPaidPlansState = cache(async (orgId: string): Promise<PaidPlansState>)`. On an RPC error it returns `{ live: false, goLiveAt: null, checkoutOpen: false }`, failing closed.
  - In `components/billing/PaidPlansProvider.tsx` (client): `PaidPlansProvider({ checkoutOpen, children })`, and `usePaidPlans(): { checkoutOpen: boolean }`, which defaults to `false` with no provider.
  - `create-order`: when `!checkoutOpen`, it returns 409 `{ error: 'Paid plans are not open yet.', code: 'PAID_PLANS_NOT_OPEN' }`.

- [ ] **Step 1: Write the failing tests**

```ts
it.each([
    [null, false, 'test', false], [null, true, 'test', true], [null, true, 'blocked', false], [null, false, 'live', false],
    ['2027-01-01T00:00:00Z', false, 'live', true], ['2027-01-01T00:00:00Z', false, 'test', false], ['2027-01-01T00:00:00Z', true, 'test', true],
])('computeCheckoutOpen(%s, %s, %s) = %s', (goLive, test, mode, open) => expect(computeCheckoutOpen(goLive, test, mode as never)).toBe(open))
it('create-order refuses a real account before go-live', async () => {
    paidPlans.mockResolvedValueOnce({ live: false, goLiveAt: null, checkoutOpen: false })
    const res = await createOrder(request({ planTier: 'lite', clientRequestId: randomUUID() }))
    expect(res.status).toBe(409); expect(await res.json()).toMatchObject({ code: 'PAID_PLANS_NOT_OPEN' })
    expect(mocks.getRazorpay).not.toHaveBeenCalled()
})
it.each(['app/(dashboard)/owner/layout.tsx', 'app/free/layout.tsx', 'app/(plan-selection)/plans/page.tsx'])('%s provides paid-plans state', f => expect(readFileSync(f, 'utf8')).toContain('<PaidPlansProvider'))
// DB
it('state starts closed and reports test accounts', async () => { /* goLiveAt null; org with 'test' row → testAccount true; plain org → false */ })
it('interest upserts once per org and counts taps', async () => { /* two calls → taps 2, first_at unchanged, last_source updated; bad source → 23514 */ })
it('both functions are service-role only', async () => { /* asUser → 42501 */ })
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 60s --label vitest-paid-plans -- npx vitest run __tests__/paid-plans.test.ts`, then `heavyq run --est 3m --label test-db-paid-plans -- npm run test:db -- __tests__/db/paid-plans.dbtest.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the migration, modules, provider, mounts, gate and existing-test mocks.** Each layout and page calls `getPaidPlansState(orgId)` with the org from its verified session, the same one it already uses.

- [ ] **Step 4: Run and confirm they pass**, along with the existing create-order suites, using the commands from Task 3 Step 4. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261030130300_paid_plans_state.sql lib/paid-plans.ts lib/paid-plans.server.ts components/billing/PaidPlansProvider.tsx app/api/billing/create-order/route.ts "app/(dashboard)/owner/layout.tsx" app/free/layout.tsx "app/(plan-selection)/plans/page.tsx" __tests__
git commit -m "feat(billing): paid-plans state; refuse real checkout before go-live"
```

### Task 5: Notify me instead of paying

**Files:**
- Create: `app/api/billing/notify-me/route.ts`
- Modify:
  - `components/billing/SubscribeButton.tsx`: add the prop `interestSource?: PaidPlanInterestSource` (default `'billing'`).
  - `components/plans/PlanCard.tsx`: pass `'plan_card'`.
  - `components/estimator/UpgradeBenefitsPreview.tsx`: pass `'upgrade_preview'`.
  - `lib/i18n/lite-phrases/account.ts`: three rows from Global Constraints.
- Test: `__tests__/notify-me.test.ts`

**Interfaces:**
- Consumes: `usePaidPlans` and `PaidPlanInterestSource` from Task 4. `public.record_paid_plan_interest` from Task 4. `getCachedSession`.
- Produces:
  - `POST /api/billing/notify-me` with body `{ source: PaidPlanInterestSource }`, strict. Owner with org only: 401 with no session, 403 otherwise. Returns 202 `{ taps }`, or 400 or 500.
  - `SubscribeButton`: when `checkoutOpen` is false, it renders one button labelled `tx('Notify me when paid plans open')` that posts `{ source: interestSource }`. On success it replaces itself with `tx("Thanks. We'll tell you when paid plans open.")`. On failure it shows `tx('Could not save your request. Try again.')`. It never loads Razorpay. It calls `trackPlanEvent('upgrade_initiated', …)` only when checkout is open, as today.

- [ ] **Step 1: Write the failing tests**

```ts
it('renders Notify me, not checkout, without an open provider', () => {
    const html = renderToStaticMarkup(<SubscribeButton planTier="lite"/>)
    expect(html).toContain('Notify me when paid plans open'); expect(html).not.toContain('base_plan.billing.checkout')   // checkout label key, unresolved without an i18n provider
    expect(html).toMatch(/min-h-11|h-11/)
})
it('renders checkout inside an open provider', () => {
    expect(renderToStaticMarkup(<PaidPlansProvider checkoutOpen><SubscribeButton planTier="lite"/></PaidPlansProvider>)).not.toContain('Notify me')
})
it('route records interest with the profile org and validates the source', async () => { /* 202 + rpc args { p_org_id: profile.org_id, p_user_id, p_source:'plan_card' }; {source:'x'} → 400; supervisor → 403 */ })
it('all three notify strings have Hindi and Gujarati rows', () => {
    for (const en of ['Notify me when paid plans open', "Thanks. We'll tell you when paid plans open.", 'Could not save your request. Try again.'])
        expect(ACCOUNT_PHRASES.find(row => row[0] === en)?.slice(1).every(Boolean)).toBe(true)
})
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 60s --label vitest-notify -- npx vitest run __tests__/notify-me.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the route, the button branch and the phrase rows.**

- [ ] **Step 4: Run and confirm they pass**, along with the existing SubscribeButton suites: `heavyq run --est 90s --label vitest-subscribe -- npx vitest run __tests__/notify-me.test.ts __tests__/free-upgrade-handoff.test.ts __tests__/lite-trial-entry.test.ts __tests__/base-suppression-ui.test.ts __tests__/base-p0-remediation.test.ts __tests__/base-estimator-go-readiness.test.ts`. Expected: PASS. If a static-markup suite expects the checkout label, wrap that render in `<PaidPlansProvider checkoutOpen>`.

- [ ] **Step 5: Commit**

```bash
git add app/api/billing/notify-me/route.ts components/billing/SubscribeButton.tsx components/plans/PlanCard.tsx components/estimator/UpgradeBenefitsPreview.tsx lib/i18n/lite-phrases/account.ts __tests__
git commit -m "feat(billing): Notify me replaces checkout until paid plans open"
```

### Task 6: Extend trials, Go live, and the Today warning

**Files:**
- Create: `supabase/migrations/20261030130400_paid_plans_controls.sql`, `lib/admin/paid-plans.ts`, `app/api/admin/paid-plans/extend/route.ts`, `app/api/admin/paid-plans/go-live/route.ts`, `components/admin/paid-plans-card.tsx`
- Modify:
  - `app/(admin-console)/admin/payments/page.tsx`: render the card at the top with id `paid-plans`, loaded independently of the payments report, so a report failure doesn't hide it.
  - `lib/admin/overview.ts`: add a `paidPlans` source and the attention item.
- Test: `__tests__/db/paid-plans-controls.dbtest.ts`, `__tests__/admin-paid-plans.test.ts`

**Interfaces:**
- Consumes: the `private.paid_plans_state` row from Task 4, `getBillingReadiness`, `requireFounder`, `AdminError`, `reportResponse`, and `AttentionItem` from `lib/admin/overview.ts`.
- Produces (SQL, all service role only, all calling `private.admin_assert_founder_session`):
  - `private.unpaid_trial_subscriptions()`, which returns `SETOF public.org_subscriptions` matching the Global Constraints definition.
  - `public.admin_paid_plans_summary(p_actor_id uuid, p_session_id uuid) RETURNS jsonb` → `{ goLiveAt, endingIn14Days, endingIn30Days, alreadyEnded }`. These are counts of unpaid trials with `now() <= current_end < now() + 14 days`, `now() < current_end < now() + 30 days`, and `current_end < now()`.
  - `public.admin_extend_trials(p_actor_id uuid, p_session_id uuid, p_new_end timestamptz, p_dry_run boolean, p_request_id uuid) RETURNS jsonb` → `{ total, alreadyEnded, newEnd }`. Errors: `PAID_PLANS_LIVE` (55000) and `INVALID_TRIAL_END` (22023). The audit action is `paid_plans.trials.extend` with `after_safe { total, alreadyEnded, newEnd }`, written only on the real run.
  - `public.admin_go_live(p_actor_id uuid, p_session_id uuid, p_request_id uuid) RETURNS jsonb` → `{ goLiveAt, movedTrials }`. It locks the state row `FOR UPDATE`. Error: `PAID_PLANS_LIVE` (55000). The audit action is `paid_plans.go_live`.
- Produces (TS, `lib/admin/paid-plans.ts`, `server-only`):
  - `getPaidPlansAdmin(): Promise<{ goLiveAt: string | null; endingIn14Days: number; endingIn30Days: number; alreadyEnded: number; readiness: { mode: 'test' | 'live' | 'blocked'; missing: string[] } }>`
  - `extendTrials(input: unknown): Promise<{ total: number; alreadyEnded: number; newEnd: string }>`, with a strict body `{ newEnd: ISO datetime string, dryRun: boolean }`. Errors map to `AdminError` 409 (`PAID_PLANS_LIVE`) or 400.
  - `goLive(): Promise<{ goLiveAt: string; movedTrials: number }>`. When readiness mode isn't `live`, it throws `AdminError('CHECKLIST_INCOMPLETE', 409, 'Live payments are not configured yet.')` before calling the database.
- Produces (UI): `PaidPlansCard({ summary })`, a client component.
  - **Header:** "Paid plans", with "Not live yet" or "Live since <date>".
  - **Before go-live, Extend trials:** buttons for +1, +2 and +3 months, plus a date input. A dry run shows "This moves N trials to end on <date> (M of them had already ended and get Lite back)", then a Confirm button.
  - **Go live:** a checklist built from `readiness.missing` (or "All set" when it's empty), and a Go live button disabled unless `readiness.mode === 'live'`. The confirm text says "Real payments open now. N unpaid trials ending in the next 30 days move to <date>", where N is `summary.endingIn30Days`.
  - Ink buttons, `min-h-11`.
- Overview: when `summary.goLiveAt === null && summary.endingIn14Days > 0`, add `{ id: 'paid_plans:trials_ending', group: 'payments', severity: 'high', owner: 'Founder', target: 'Lite trials', reason: `${n} unpaid trials end in the next 14 days. Paid plans aren't live yet.`, nextAction: 'Extend trials from the Paid plans card.', href: '/admin/payments#paid-plans', observedAt: asOf, ageSeconds: 0 }`.

- [ ] **Step 1: Write the failing tests**

```ts
// DB (founder set up as in admin-factories.dbtest)
it('extends only unpaid trials, including ones that already ended', async () => {
    // A: trial ended yesterday; B: trial ends in 10 days; C: trial + paid non-trial row; D: paid Lite only
    const dry = await extend(inDays(60), true); expect(dry).toMatchObject({ total: 2, alreadyEnded: 1 }); expect(await endOf(A)).toBeBefore(now)
    const real = await extend(inDays(60), false); expect(real.total).toBe(2); expect(await endOf(A)).toEqual(inDays(60)); expect(await endOf(C.trial)).not.toEqual(inDays(60))
    expect(await auditCount('paid_plans.trials.extend')).toBe(1)   // dry run wrote nothing
})
it('refuses past dates and dates more than a year ahead', async () => { /* 22023 both */ })
it('go-live moves only unpaid trials ending within 30 days and refuses a second go-live', async () => {
    // E ends in 10 days → now()+30d; F ends in 50 days → unchanged; G ended last week → unchanged
    expect((await goLive()).movedTrials).toBe(1); expect((await pgError(goLive())).code).toBe('55000')
    expect((await pgError(extend(inDays(90), false))).code).toBe('55000')
})
it('summary counts unpaid trials ending soon and already ended', async () => { /* endingIn14Days / endingIn30Days / alreadyEnded */ })
// Unit (lib/subscription-access)
it('a moved trial row resolves to Lite again', () => {
    const moved = { status: 'active', plan_tier: 'lite', is_trial: true, current_start: daysAgo(40), current_end: inDays(60), razorpay_payment_id: null, created_at: daysAgo(40) }
    expect(resolveOrgAccessFromRows({ rows: [moved], baseFlag: false, trialFlag: false })).toMatchObject({ effectiveTier: 'lite', trialEndsAt: moved.current_end })
})
// Unit
it('goLive refuses before the database when live payments are not configured', async () => { readiness.mockReturnValue({ mode: 'test', missing: ['matching Razorpay key ID and secret'] }); await expect(goLive()).rejects.toMatchObject({ status: 409 }); expect(rpc).not.toHaveBeenCalled() })
it('overview warns while not live and trials end within 14 days, and not after go-live', async () => { /* attention contains id 'paid_plans:trials_ending' only in the first case */ })
it('payments page renders the card outside the report try/catch', () => {
    const src = readFileSync('app/(admin-console)/admin/payments/page.tsx', 'utf8'); expect(src).toContain('<PaidPlansCard'); expect(src).toContain('id="paid-plans"')
})
```

- [ ] **Step 2: Run and confirm they fail.** Run: `heavyq run --est 4m --label test-db-controls -- npm run test:db -- __tests__/db/paid-plans-controls.dbtest.ts`, then `heavyq run --est 60s --label vitest-admin-paid -- npx vitest run __tests__/admin-paid-plans.test.ts __tests__/admin-overview.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the migration, module, routes, card, payments page change and overview source.** Routes are `POST` handlers returning `reportResponse(() => extendTrials(await request.json()))` and `reportResponse(() => goLive())`. Keep `/admin/payments` in `safeFounderReturnPath`; it's already there.

- [ ] **Step 4: Run and confirm they pass** (same commands). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261030130400_paid_plans_controls.sql lib/admin/paid-plans.ts app/api/admin/paid-plans components/admin/paid-plans-card.tsx "app/(admin-console)/admin/payments/page.tsx" lib/admin/overview.ts __tests__
git commit -m "feat(admin): extend trials before go-live and a one-time Go live switch"
```

### Task 7: Release verification

- [ ] **Step 1: Type check, lint and full unit suite.** Run: `heavyq run --est 2m --label tsc -- npx tsc --noEmit`, `heavyq run --est 2m --label lint -- npm run lint`, `heavyq run --est 5m --label vitest-all -- npx vitest run`. Expected: clean, 0 warnings, all pass except the 1 known skip.
- [ ] **Step 2: Full DB suite.** Run: `heavyq run --est 8m --label test-db -- npm run test:db`. Expected: all pass.
- [ ] **Step 3: Browser check against QA** (`npm run dev` via `preview_start`, QA test owner):
  - Plan cards and the owner billing page show "Notify me when paid plans open".
  - Tapping it shows the thanks text and posts 202.
  - Switch the language to Gujarati and Hindi, and confirm the button text wraps inside the button at 375px width.
  - Stop the server afterwards.
- [ ] **Step 4: Hand-off note.**
  - **Migrations:** list the five files `20261030130000` to `20261030130400`. The owner applies them to production in order before deploy.
  - **Early trials:** after deploy, the owner should open `/admin/payments` and extend the early 30-day trials before about 10 November.
  - **Translations:** Hindi and Gujarati wording still needs the owner's review.
