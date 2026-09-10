# Weavly Pricing Strategy and Billing Migration Guide

> Historical proposal — superseded by the Free, Lite, and Base catalog. Do not use the setup-fee or annual amounts below for current customer copy or billing. See [Current public plans and policies](public-plans-and-policies.md) and `lib/billing-constants.ts` for the implemented offer.


Last updated: 2026-06-11

This guide is for moving Weavly from the current monthly Base/Premium subscription model to a market-friendlier Indian textile SaaS model: a larger one-time implementation fee plus a smaller annual recurring subscription.

It covers the business strategy, the exact app surfaces that must change, the Razorpay/Supabase implementation path, test-mode readiness while business PAN/bank setup is pending, and the production-readiness checklist.

## Executive Recommendation

Move from "monthly SaaS plan" positioning to "factory digitisation setup plus yearly maintenance."

Recommended default offer:

| Package | Positioning | One-time fee | Annual subscription | Best for |
| --- | --- | ---: | ---: | --- |
| Estimator Desk | Costing, quote history, margin control | Rs 19,999 to Rs 29,999 + GST | Rs 9,999 to Rs 14,999/year + GST | Owners who only want costing first |
| Factory Loop | Full floor, payroll, dispatch, owner visibility | Rs 49,999 to Rs 74,999 + GST | Rs 19,999 to Rs 29,999/year + GST | Main Weavly package |
| Multi-unit / Enterprise | Multiple sites, custom onboarding, reporting | Custom | Custom | Groups, brokers, multi-factory owners |

Recommended first public price:

```text
Full Factory Setup
Rs 49,999 one-time + GST
then Rs 19,999/year + GST

Includes setup, data import, owner training, supervisor training,
and the first factory's Weavly operating system.
```

Why this fits the local market better:

- The customer sees the large upfront amount as implementation, setup, training, and migration work, not just "software rent."
- The smaller yearly fee reduces recurring-payment resistance.
- The first payment funds your onboarding time, travel/support load, and custom handholding.
- Annual renewal is easier to explain as maintenance, hosting, updates, support, and WhatsApp/Razorpay/Supabase infrastructure.
- Textile owners are more likely to accept a one-time business improvement cost than a high monthly SaaS bill.

Avoid calling the upfront fee a "license fee" unless your legal/tax advisor wants that wording. Use "implementation", "setup", "training", "digitisation", or "onboarding" because that is what the customer is actually buying.

## Current App State

The app currently uses Razorpay Subscriptions with two monthly plans.

Current pricing surfaces:

| Surface | Current state |
| --- | --- |
| `components/landing/pricing.tsx` | Public landing page shows Rs 2,000/month and Rs 5,000/month, GST exclusive, plus optional Rs 4,999 setup add-on. |
| `app/(dashboard)/owner/billing/page.tsx` | Authenticated billing page shows Rs 2,360/month and Rs 5,900/month including 18% GST. |
| `app/(auth)/onboarding/checklist.tsx` | Onboarding plan selection shows Rs 2,360/mo and Rs 5,900/mo including GST. |
| `components/billing/AccessGate.tsx` | Upgrade wall mentions Premium as Rs 5,000/mo + GST. |
| `app/terms/page.tsx` | Terms are stale: they mention Rs 600/month and Rs 1,700/month. This must be fixed before launch. |
| `app/refund-policy/page.tsx` | Refund policy references monthly subscription refunds and the Rs 4,999 setup add-on. |
| `app/api/subscriptions/create/route.ts` | Creates Razorpay subscriptions for `RAZORPAY_PLAN_ID_BASE` or `RAZORPAY_PLAN_ID_PREMIUM`, with `total_count: 12`. |
| `supabase/migrations/20260417000000_seed_subscription_plans.sql` | Seeds two monthly Razorpay plan IDs. |
| `lib/subscription.ts` | Access tiers are `none`, `trial`, `base`, and `premium`. |
| `components/billing/SubscribeButton.tsx` | UI assumes monthly auto-renewal. |

Current access model:

- `base`: Estimator/quotes.
- `premium`: full factory loop.
- `trial`: full premium access for 7 days.

Keep this access model. Change the commercial packaging first. Do not rebuild feature gates unless there is a strong reason.

## Target Model

Use two concepts:

1. `plan_tier`: what features the org can access.
2. `commercial_package`: what the customer bought and how billing works.

For example:

```text
plan_tier = premium
commercial_package = factory_loop_setup_annual
setup_fee_paise = 4999900
recurring_amount_paise = 1999900
recurring_interval = yearly
```

This lets the app keep `base` and `premium` gates while pricing evolves independently.

## Payment Architecture Options

### Option A: Razorpay subscription with upfront addon

This is the cleanest eventual implementation.

Razorpay Subscriptions support an upfront amount on a subscription by passing `addons` when creating the subscription. Razorpay documents this as suitable for setup fees or delivery/security-deposit style charges. Source: https://razorpay.com/docs/payments/subscriptions/create/?preferred-country=IN

Flow:

1. Customer picks the annual package.
2. App creates a Razorpay subscription using a yearly plan ID.
3. App passes a one-time setup fee in `addons`.
4. Razorpay Checkout collects the setup fee as part of the authorisation transaction.
5. Razorpay then renews the smaller annual subscription according to the plan.
6. Webhooks update `org_subscriptions` and `subscription_payments`.

This matches your proposed strategy.

Example Razorpay request shape:

```ts
await razorpay.subscriptions.create({
  plan_id: process.env.RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL!,
  total_count: 5,
  quantity: 1,
  customer_notify: true,
  addons: [
    {
      item: {
        name: 'Factory implementation and training',
        amount: 4999900,
        currency: 'INR',
      },
    },
  ],
  notes: {
    org_id: profile.org_id,
    package: 'factory_loop_setup_annual',
    setup_fee_paise: '4999900',
    recurring_amount_paise: '1999900',
  },
})
```

Use this if you are ready to collect both setup and subscription online.

### Option B: Setup fee now, subscription starts later

Razorpay supports a future `start_at` on subscriptions. That can create a trial-like gap before the recurring billing cycle starts. Source: https://razorpay.com/docs/payments/subscriptions/create/?preferred-country=IN

Flow:

1. Customer pays setup fee during authorisation.
2. Annual subscription starts after implementation, such as 14 or 30 days later.
3. Customer access starts immediately in Weavly.

Use this when you want the customer's yearly maintenance clock to begin after onboarding, not before.

Be explicit in checkout and policy copy:

```text
Pay setup today. Annual maintenance starts after onboarding or 30 days,
whichever comes first.
```

### Option C: Manual pilot while business KYC is pending

Use this until business PAN and business bank details are ready.

Razorpay Test mode is a sandbox. Razorpay says real payments cannot be accepted in Test mode and Test/Live use separate API keys. Source: https://razorpay.com/docs/payments/dashboard/test-live-modes/?preferred-country=IN

Flow:

1. Keep Razorpay in Test mode.
2. Let pilots start a free trial or manually granted pilot access.
3. Do not show test checkout as a real payment flow to customers.
4. Track commercial commitments outside the app until the live merchant account is active.
5. After KYC/live keys are ready, create the real subscription and move the org to the paid package.

This is the safest path before business PAN/bank setup.

## Razorpay Readiness Notes

Razorpay account setup and live mode:

- Razorpay requires KYC before live payments and settlement.
- Razorpay's setup guide says bank details are added during onboarding and bank verification may use a Rs 1 deposit; if verification fails, proof such as cancelled cheque video or branch confirmation may be required.
- Live mode is enabled after details are verified.
- Test mode API keys can be generated before live readiness, but live keys require website/business readiness.

Sources:

- Razorpay setup/KYC: https://razorpay.com/docs/payments/set-up/?preferred-country=IN
- Razorpay KYC documents by business type: https://razorpay.com/docs/payments/business-types-kyc-documents/?preferred-country=IN
- Razorpay API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/?preferred-country=IN

Razorpay subscription payment methods:

- Razorpay Subscriptions support cards, UPI Autopay, and eMandate/eNACH.
- Card subscriptions require tokenisation/consent as handled by Razorpay Checkout.
- UPI Autopay and eMandate can matter in India because many factory owners may prefer UPI or bank mandate over credit cards.

Source: https://razorpay.com/docs/payments/subscriptions/supported-payment-methods/?preferred-country=IN

Test cards:

- Razorpay test cards only work in Test mode.
- No real money is deducted with test API keys.
- Use Razorpay's current test-card documentation rather than hardcoding assumptions into customer-facing docs.

Source: https://razorpay.com/docs/payments/payments/test-card-details/?preferred-country=IN

## Recommended Implementation Plan

### Phase 1: Centralise pricing config

Create a single server/client-safe pricing catalog so the landing page, onboarding, billing, and upgrade wall do not drift.

Recommended file:

```text
lib/billing/plans.ts
```

Suggested structure:

```ts
export type BillingPackageCode =
  | 'estimator_setup_annual'
  | 'factory_loop_setup_annual'

export const BILLING_PACKAGES = {
  estimator_setup_annual: {
    code: 'estimator_setup_annual',
    tier: 'base',
    publicName: 'Estimator Desk',
    setupFeePaise: 2499900,
    recurringAmountPaise: 999900,
    recurringInterval: 'yearly',
    razorpayPlanIdEnv: 'RAZORPAY_PLAN_ID_ESTIMATOR_ANNUAL',
    publicRazorpayPlanIdEnv: 'NEXT_PUBLIC_RAZORPAY_PLAN_ID_ESTIMATOR_ANNUAL',
  },
  factory_loop_setup_annual: {
    code: 'factory_loop_setup_annual',
    tier: 'premium',
    publicName: 'Full Factory Setup',
    setupFeePaise: 4999900,
    recurringAmountPaise: 1999900,
    recurringInterval: 'yearly',
    razorpayPlanIdEnv: 'RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL',
    publicRazorpayPlanIdEnv: 'NEXT_PUBLIC_RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL',
  },
} as const
```

Also add formatting helpers:

```ts
export function formatINRFromPaise(paise: number) {
  return `Rs ${(paise / 100).toLocaleString('en-IN')}`
}
```

Why:

- Today prices are duplicated across at least five files.
- The Terms page is already stale.
- A central catalog reduces launch mistakes.

### Phase 2: Add new Razorpay plans

In Razorpay Test mode:

1. Create a yearly plan for Estimator Desk annual subscription.
2. Create a yearly plan for Full Factory annual subscription.
3. Keep setup fee out of the plan amount; setup fee should be the `addons` upfront amount.
4. Save test plan IDs.

Environment variables to add locally and in Vercel:

```bash
RAZORPAY_PLAN_ID_ESTIMATOR_ANNUAL=plan_test_estimator_yearly
RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL=plan_test_factory_yearly
NEXT_PUBLIC_RAZORPAY_PLAN_ID_ESTIMATOR_ANNUAL=plan_test_estimator_yearly
NEXT_PUBLIC_RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL=plan_test_factory_yearly
```

Keep existing monthly env vars until the migration is complete:

```bash
RAZORPAY_PLAN_ID_BASE=...
RAZORPAY_PLAN_ID_PREMIUM=...
NEXT_PUBLIC_RAZORPAY_PLAN_ID_BASE=...
NEXT_PUBLIC_RAZORPAY_PLAN_ID_PREMIUM=...
```

### Phase 3: Add a migration for plan metadata

Add a Supabase migration that seeds the new plan IDs and optionally stores package metadata.

Minimum migration:

```sql
INSERT INTO public.subscription_plans (id, name, amount_paise, interval, tier)
VALUES
  ('plan_xxx_estimator_annual', 'Estimator Desk Annual', 999900, 'yearly', 'base'),
  ('plan_xxx_factory_loop_annual', 'Factory Loop Annual', 1999900, 'yearly', 'premium')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  amount_paise = EXCLUDED.amount_paise,
  interval = EXCLUDED.interval,
  tier = EXCLUDED.tier;
```

Better migration:

```sql
ALTER TABLE public.org_subscriptions
  ADD COLUMN IF NOT EXISTS commercial_package text,
  ADD COLUMN IF NOT EXISTS setup_fee_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurring_amount_paise integer,
  ADD COLUMN IF NOT EXISTS recurring_interval text,
  ADD COLUMN IF NOT EXISTS first_invoice_amount_paise integer;

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS payment_label text,
  ADD COLUMN IF NOT EXISTS invoice_breakdown jsonb NOT NULL DEFAULT '{}'::jsonb;
```

Why:

- The first payment may include both setup and annual recurring amount.
- Without metadata, the billing page can show the total captured amount but cannot explain the breakdown cleanly.

### Phase 4: Change subscription creation

Current file:

```text
app/api/subscriptions/create/route.ts
```

Current behavior:

- Accepts `{ planId, autoRenew }`.
- Validates against Base/Premium plan IDs.
- Creates subscription with `total_count: 12`.
- Infers `plan_tier` from plan ID.

Recommended behavior:

- Accept `{ packageCode, autoRenew, startAfterDays? }`.
- Look up package in `BILLING_PACKAGES`.
- Resolve plan ID server-side from env.
- Add `addons` for setup fee.
- Use yearly `total_count`, such as `5` or `10`.
- Store package metadata in `org_subscriptions`.
- Keep `autoRenew` cancellation logic, but relabel it yearly.

Request body:

```ts
type CreateSubscriptionRequest = {
  packageCode: 'estimator_setup_annual' | 'factory_loop_setup_annual'
  autoRenew?: boolean
  startAfterDays?: number
}
```

Server-side validation:

```ts
const selectedPackage = BILLING_PACKAGES[body.packageCode]
if (!selectedPackage) {
  return NextResponse.json({ error: 'Invalid package selected.' }, { status: 400 })
}

const planId = process.env[selectedPackage.razorpayPlanIdEnv]
if (!planId) {
  return NextResponse.json({ error: 'Selected package is not configured.' }, { status: 500 })
}
```

Subscription create payload:

```ts
const subscriptionPayload = {
  plan_id: planId,
  total_count: 5,
  quantity: 1,
  customer_notify: true,
  addons: selectedPackage.setupFeePaise > 0 ? [
    {
      item: {
        name: `${selectedPackage.publicName} implementation and training`,
        amount: selectedPackage.setupFeePaise,
        currency: 'INR',
      },
    },
  ] : undefined,
  notes: {
    org_id: profile.org_id,
    org_name: org?.name ?? 'Unknown',
    owner_name: profile.full_name ?? '',
    package_code: selectedPackage.code,
  },
}
```

If using delayed annual subscription:

```ts
const startAfterDays = Math.min(Math.max(body.startAfterDays ?? 0, 0), 30)
const start_at = startAfterDays > 0
  ? Math.floor((Date.now() + startAfterDays * 24 * 60 * 60 * 1000) / 1000)
  : undefined
```

Do not trust client-sent amounts. Amounts must come from server-side config.

### Phase 5: Update checkout UI

Current file:

```text
components/billing/SubscribeButton.tsx
```

Change:

- Rename display text from monthly subscription to annual plan.
- Accept `packageCode` instead of `planId`, or accept both temporarily.
- Display first payment clearly:

```text
Pay Rs 49,999 setup + Rs 19,999 first year
Renews at Rs 19,999/year
```

- Relabel auto-renew:

```text
Auto-renew yearly
```

- Update Razorpay Checkout `description`:

```ts
description: `${tierName} - setup plus annual maintenance`
```

- Remove emoji from success toasts if you want a more business-like tone.

Important: if annual subscription starts later, the UI must say:

```text
Setup fee is collected today. Annual maintenance starts after onboarding.
```

### Phase 6: Update billing dashboard

Current file:

```text
app/(dashboard)/owner/billing/page.tsx
```

Change the plan cards:

- Show setup fee.
- Show yearly subscription.
- Show first payment total.
- Show renewal amount separately.
- Replace "Monthly Billing" with "Annual Maintenance".
- Replace "Months Paid" with "Renewals Paid" or remove the streak UI.
- Payment history label should be "Implementation + Subscription" for first captured payment and "Annual Renewal" for later payments.

Suggested billing card copy:

```text
Full Factory Setup
Rs 49,999 setup
Rs 19,999/year maintenance
First payment: Rs 69,998 + GST
Renews yearly after the current period
```

If you include GST in displayed totals, say "incl. GST". If not, say "+ GST". Do not mix styles across pages.

### Phase 7: Update public landing page

Current file:

```text
components/landing/pricing.tsx
```

Change the section framing:

Old:

```text
Start with costing, or run the whole factory loop.
Rs 2,000/month
Rs 5,000/month
Setup and training add-on Rs 4,999
```

New:

```text
Set up Weavly once. Keep it running yearly.

Full Factory Setup
Rs 49,999 one-time + GST
Rs 19,999/year + GST after setup

Includes machine setup, worker setup, owner training,
supervisor training, and first-factory configuration.
```

Keep Estimator Desk as a lower-friction entry offer:

```text
Estimator Desk
Rs 24,999 setup + GST
Rs 9,999/year + GST
For costing, quote history, templates, and margin control.
```

Add a note:

```text
Pilot pricing shown for one factory. GST extra where applicable.
Multi-factory pricing is quoted after a workflow review.
```

Do not bury the pricing change in FAQ only. The hero/pricing should make the one-time plus yearly model obvious.

### Phase 8: Update onboarding

Current file:

```text
app/(auth)/onboarding/checklist.tsx
```

Change plan selection copy:

```text
Start with a 7-day trial
or book setup and annual maintenance
```

Paid options:

```text
Estimator Desk
Rs 24,999 setup + Rs 9,999/year

Full Factory Setup
Rs 49,999 setup + Rs 19,999/year
```

If live Razorpay is not ready:

- Hide paid checkout from production users.
- Show "Request setup call" or "Pilot access".
- Keep trial available.
- Keep internal test mode checkout visible only when `NEXT_PUBLIC_RAZORPAY_KEY_ID` starts with `rzp_test_` and the environment is not customer-facing.

### Phase 9: Update access gates

Current file:

```text
components/billing/AccessGate.tsx
```

Change the upgrade wall price:

```text
Full Factory Setup
Rs 49,999 setup + Rs 19,999/year
```

Avoid saying "Cancel anytime" if the customer has paid a non-refundable setup/service fee. Better:

```text
Annual renewal can be cancelled before the next billing cycle.
```

### Phase 10: Update legal/policy pages

Files:

```text
app/terms/page.tsx
app/refund-policy/page.tsx
app/privacy/page.tsx
components/landing/footer.tsx
```

Required changes:

- Fix stale Terms pricing. It currently mentions Rs 600/month and Rs 1,700/month.
- Replace monthly subscription wording with annual maintenance where applicable.
- Add setup/implementation fee terms.
- Clarify refund rules for delivered services.
- Clarify what happens if setup has started but is incomplete.
- Confirm GST wording with a CA.
- Ensure the footer links to Terms, Privacy, and Refund Policy.

Suggested refund policy:

```text
Setup and implementation fee:
- Fully refundable before onboarding work starts.
- Partially refundable if only account configuration has started.
- Non-refundable after training/data setup has been delivered.

Annual subscription:
- First annual subscription payment refundable within 7 days if onboarding has not started.
- No pro-rata refund after active use, except billing error or legally required refund.
- Access continues until the paid period ends if renewal is cancelled.
```

Ask a lawyer/CA before relying on this in production.

### Phase 11: Update docs and tests

Docs to update:

```text
docs/current-onboarding-implementation.md
docs/general/PROJECT_OVERVIEW.md
docs/general/MASTER_PRODUCT_DOCUMENT.md
docs/general/PHASE_1_SCOPE.md
docs/general/MASTER_FEATURE_DOCUMENT.md
```

Tests likely needing updates:

```text
__tests__/p1-billing-gates.test.ts
__tests__/p1-razorpay-idempotency.test.ts
```

Add source-inspection tests for:

- Landing pricing does not contain old monthly values.
- Billing page uses central plan catalog.
- Terms do not contain stale Rs 600/Rs 1,700 values.
- Subscription create route accepts package codes, not arbitrary amounts.
- Subscription create route includes `addons`.
- Test mode notice is present and clear.

Example test idea:

```ts
it('subscription create uses server-side package catalog and Razorpay addons', () => {
  const route = readProjectFile('app/api/subscriptions/create/route.ts')
  expect(route).toContain('BILLING_PACKAGES')
  expect(route).toContain('addons')
  expect(route).not.toContain('setupFeePaise: body')
})
```

## Test-Mode Readiness Checklist

Use this before PAN/business bank account is ready.

### Razorpay test setup

- Create or access Razorpay dashboard.
- Enable Test mode.
- Generate Test mode API keys.
- Create test yearly plans:
  - Estimator annual.
  - Factory Loop annual.
- Add local env vars in `.env.local`.
- Add Vercel preview/test env vars.
- Configure test webhook URL to `/api/webhooks/razorpay`.
- Set `RAZORPAY_WEBHOOK_SECRET`.

### App checks

Run:

```bash
npm run lint
npm run build
npx vitest __tests__/p1-billing-gates.test.ts __tests__/p1-razorpay-idempotency.test.ts
```

Manual test:

1. Create a fresh owner account.
2. Start a trial.
3. Confirm premium access is granted.
4. Let billing page show annual packages.
5. Click a test subscription.
6. Complete Razorpay test checkout.
7. Confirm `org_subscriptions` row is created with:
   - `plan_tier`
   - `commercial_package`
   - `setup_fee_paise`
   - `recurring_amount_paise`
   - `status`
   - `razorpay_subscription_id`
8. Replay or wait for webhook events.
9. Confirm `subscription_payments` row is inserted once.
10. Confirm refresh shows active subscription.
11. Confirm protected routes unlock.
12. Cancel auto-renew and confirm `cancel_at_cycle_end`.
13. Confirm failed payment webhook records a failed payment without unlocking incorrectly.

### Customer-facing safety

Before KYC/live mode:

- Do not tell users they can pay online.
- Do not show real payment promises on landing pages.
- Use "Request pilot access" or "Book setup call".
- Keep test mode notice visible in billing when using `rzp_test_` keys.
- Do not mix test and live plan IDs.

## Production-Readiness Checklist

Do this after PAN/business bank account/KYC are ready.

### Razorpay live setup

- Complete Razorpay KYC for the correct business entity.
- Add website/app details for verification.
- Add business bank account and complete bank verification.
- Wait for Live mode activation.
- Generate Live mode API keys.
- Create Live yearly plans with the same commercial amounts.
- Configure Live webhook URL:

```text
https://your-production-domain.com/api/webhooks/razorpay
```

- Set webhook events:
  - `subscription.authenticated`
  - `subscription.activated`
  - `subscription.charged`
  - `subscription.halted`
  - `subscription.cancelled`
  - `subscription.completed`
  - `subscription.expired`
  - `payment.failed`

### Vercel production env

Set production env vars:

```bash
RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_KEY_SECRET=...
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_...
RAZORPAY_WEBHOOK_SECRET=...
RAZORPAY_PLAN_ID_ESTIMATOR_ANNUAL=plan_live_...
RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL=plan_live_...
NEXT_PUBLIC_RAZORPAY_PLAN_ID_ESTIMATOR_ANNUAL=plan_live_...
NEXT_PUBLIC_RAZORPAY_PLAN_ID_FACTORY_LOOP_ANNUAL=plan_live_...
```

Make sure `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` are from the same mode.

### Database

- Apply migrations.
- Seed live plan IDs into `subscription_plans`.
- Keep test plan IDs out of production seed data unless the table is environment-specific.
- Confirm RLS still prevents client writes to subscription ledgers.
- Confirm service role is used only in route handlers/webhooks.

### Web

- Update landing page.
- Update billing page.
- Update onboarding.
- Update upgrade wall.
- Update Terms.
- Update Refund Policy.
- Update Privacy processor list if payment processor wording needs to mention Razorpay.
- Update footer/legal links.
- Update support/admin references.

### QA

Run:

```bash
npm run lint
npm run build
npx vitest
```

Manual live-smoke process:

1. Use a tiny internal live amount first if Razorpay plan configuration permits.
2. Create internal test org.
3. Complete a real checkout with an internal card/UPI/account.
4. Confirm payment captured in Razorpay.
5. Confirm webhook received and processed once.
6. Confirm app unlocks correct access.
7. Confirm payment history amount and labels are correct.
8. Confirm cancellation at cycle end works.
9. Refund the internal test payment from Razorpay if appropriate.
10. Confirm refund handling policy/process is documented, even if refund webhooks are not yet automated.

## Copy Direction

Public positioning:

```text
Weavly is not another monthly software bill. We set up your factory workflow once:
machines, workers, costing, orders, production, dispatch, and payroll. After that,
you pay a smaller yearly maintenance fee for hosting, updates, support, and continued access.
```

Pricing block:

```text
Full Factory Setup
Rs 49,999 one-time + GST
Rs 19,999/year + GST after setup

Includes implementation, data setup, owner training, supervisor training,
and support during rollout.
```

Objection handling:

```text
Why setup fee?
Because Weavly is only useful when your real machines, workers, wage rules,
production modes, and costing assumptions are configured correctly. The setup fee
covers that implementation work.
```

Renewal explanation:

```text
The yearly fee keeps Weavly hosted, backed up, updated, and supported.
It also covers ongoing fixes and product improvements.
```

Test mode wording:

```text
Online payments are currently in test mode while business payment activation is completed.
Pilot access can be enabled manually after approval.
```

## Key Risks and Controls

| Risk | Control |
| --- | --- |
| Pricing appears inconsistent across pages | Centralize package config and add tests against stale values. |
| Customer thinks yearly fee includes setup again | Separate "first payment" and "renews yearly" in UI. |
| First Razorpay payment total is confusing | Store and show invoice breakdown. |
| Test mode is mistaken for live payments | Visible test-mode banner and no customer-facing paid checkout until live. |
| Existing monthly subscribers break | Keep old plan IDs supported during transition or migrate manually. |
| Terms/refund policy contradict product | Update legal pages in the same PR as pricing changes. |
| Webhook duplicate events double-count payment | Keep existing idempotency guards and DB unique constraints. |
| Annual plan creates high AFA/payment friction | Support UPI Autopay/eMandate/card options through Razorpay where enabled. |

## Migration Path for Existing Test/Old Customers

If this is still pre-launch:

1. Leave existing monthly test rows alone.
2. Create new annual plans.
3. New customers use new packages.
4. Test accounts can be manually expired or re-subscribed.

If customers already paid monthly:

1. Do not automatically force-migrate.
2. Keep their current plan active until period end.
3. Offer conversion:

```text
Pay setup fee now and move to annual maintenance at next renewal.
```

4. Store conversion notes in `org_subscriptions.notes` or a new audit table.

## Suggested Order of Work

1. Create `lib/billing/plans.ts`.
2. Update landing, billing, onboarding, and AccessGate to read from the catalog.
3. Add new Razorpay test plans and env vars.
4. Add Supabase migration for annual plans and package metadata.
5. Update `app/api/subscriptions/create/route.ts` to use package codes and upfront addons.
6. Update `SubscribeButton` copy and payload.
7. Update billing history labels and annual renewal UI.
8. Update Terms and Refund Policy.
9. Add/update tests.
10. Verify in Razorpay Test mode.
11. Keep paid checkout hidden from real users until live KYC/bank setup is done.
12. After KYC, repeat setup with Live plan IDs and live webhook secret.

## Source Links

- Razorpay Create Subscriptions and upfront amount: https://razorpay.com/docs/payments/subscriptions/create/?preferred-country=IN
- Razorpay Create Subscription API parameters: https://razorpay.com/docs/api/payments/subscriptions/create-subscription/?preferred-country=IN
- Razorpay Test and Live modes: https://razorpay.com/docs/payments/dashboard/test-live-modes/?preferred-country=IN
- Razorpay API keys: https://razorpay.com/docs/payments/dashboard/account-settings/api-keys/?preferred-country=IN
- Razorpay setup/KYC: https://razorpay.com/docs/payments/set-up/?preferred-country=IN
- Razorpay KYC documents: https://razorpay.com/docs/payments/business-types-kyc-documents/?preferred-country=IN
- Razorpay subscription payment methods: https://razorpay.com/docs/payments/subscriptions/supported-payment-methods/?preferred-country=IN
- Razorpay test card details: https://razorpay.com/docs/payments/payments/test-card-details/?preferred-country=IN
