# Base plan suppression and one-month Lite trial: design

Date: 2026-10-11. Status: design approved in chat, spec awaiting review.

## Purpose

Initial rollout offers only the Free and Lite plans. Base is unfinished, so new
customers must not see, buy or reach it. Existing accounts are untouched, which
keeps the owner's Base test accounts working. New customers also get a one-month
free trial of Lite. When it ends they pay to stay on Lite or fall back to Free.

## Decisions (agreed)

- Trial starts when a new owner picks Lite on the plan chooser. Choosing Free
  skips it; the trial can still be started later from the upgrade screen, once
  per account.
- "New customer" is stored per organization, not inferred from a date.
- Existing Free and Lite accounts get no trial.
- Paying during the trial starts a fresh 365 days from the payment date. Unused
  trial days are not added.
- Converting is a first purchase at the first-year price (₹2,999 incl. GST), never
  the ₹1,499 renewal price.
- Trial-ending notice is in-app only for v1. No email or WhatsApp.
- Records created during the trial are kept after demotion. Free's capability
  limits hide them and they return if the owner pays.
- Lapsed paid Lite still resolves to `none` (existing rule). Only a trial that
  was never paid demotes to Free.

## A. Base suppression

### Data
Migration adds `organizations.base_plan_visible boolean NOT NULL DEFAULT false`
and backfills `true` for every existing organization.

### Helper
`lib/base-plan-visibility.ts` (pure, unit-testable):
`canViewBase({ flag, effectiveTier, subscriptionRows })` is true when the flag is
set, the effective tier is `base`, or any `org_subscriptions` row has
`plan_tier = 'base'`. A code constant `BASE_PLAN_OPEN_TO_NEW_ACCOUNTS = false`
overrides to true when flipped; this is the Base launch switch.

### Enforcement (server first, UI second)
- `app/api/billing/create-order/route.ts`: if `planTier === 'base'` and the org
  cannot view Base, return 403 before pricing, lifecycle or claim creation.
- `app/(plan-selection)/plans/page.tsx` computes `baseVisible` and passes it to
  `PlanChooserClient`, which renders two cards (Free, Lite) when false.
- `app/(auth)/signup/page.tsx` and `createOrganizationAndRedirect`
  (`app/(auth)/actions/auth.ts`): `plan=base` / `selectedPlan: 'base'` falls back
  to Free.
- `components/landing/plans.tsx`: public page, no org context. Hidden for
  everyone while `BASE_PLAN_OPEN_TO_NEW_ACCOUNTS` is false.
- Upsell surfaces drop Base copy for hidden orgs: `AccessGate` production wall
  (shows the generic unavailable wall), `UpgradeBenefitsPreview`,
  `plan-aware-settings-view`, `app/free/billing/*`, `lib/upgrade-wall.ts`
  consumers, tours. Implementation starts with a grep audit of these.

## B. Lite trial

### Data
- `organizations.lite_trial_eligible boolean NOT NULL DEFAULT true`, backfilled
  `false` for existing organizations.
- `org_subscriptions.is_trial boolean NOT NULL DEFAULT false`.
- Partial unique index on `org_subscriptions (org_id) WHERE is_trial`.
- Trial row: `plan_tier='lite'`, `status='active'`, `current_start=now()`,
  `current_end=now()+30 days`, `is_trial=true`, no Razorpay ids.

### Start flow
`start_lite_trial(p_org_id uuid)`: `SECURITY DEFINER`, `SET search_path = ''`,
`REVOKE` from public/anon/authenticated, `GRANT` to `service_role`. It locks the
organization row, requires `lite_trial_eligible`, no existing trial and no paid
history, inserts the trial row and sets `lite_trial_eligible = false`. Owner and
org are re-derived from the verified profile by the calling server action.

`completePlanSelection('trial')` in `app/(auth)/onboarding/plans/actions.ts`:
1. `requireRole(['owner'], { allowFreeAccount: true })`, `assertOrgWritable`.
2. `finishFreeProvisioning` first. `provision_free_account` refuses orgs that
   already have subscription rows, so the Free grant must exist before the trial
   row. If Free enrollment is paused, refuse the trial with a clear message.
3. Call `start_lite_trial`, clear `plan_selection_pending`, refresh the session,
   return `/owner/estimator`.

### Entitlement
- `lib/subscription-access.ts`: add `is_trial` to the row type. `isSubscriptionRowCurrent`
  gives trial rows no 24-hour grace. `hasEstablishedPaidHistory` ignores trial rows.
- `lib/subscription.ts`: select `is_trial`. When the trial row has lapsed the tier
  is `none`; the existing branch finds the dormant Free grant, sees no paid history
  and returns Free. No cron job; resolution is lazy per request.
- `lib/billing-lifecycle.ts`: `rowHasPaidHistory` ignores trial rows, so a
  converting owner gets `initial_purchase` pricing and is not blocked by the
  "renewal opens 30 days before expiry" rule. A paid row coexists with the trial
  row; highest tier then newest `created_at` wins, so the paid row takes over.
- `completePlanSelection` paid-history check uses the trial-aware helper.

### UI
- Chooser: the Lite card's primary action is "Start 1-month free trial" when
  eligible, with "pay now" as a secondary link. After the trial is used it is the
  normal subscribe button. Copy in en, hi, gu with layouts tolerant of longer text.
- Owner shell banner: days left and a Subscribe action; emphasised in the last 7
  days.
- Billing page: "Free trial ends <date>" instead of a plan period.
- After expiry the owner lands on `/free` with a one-time "Your Lite trial ended,
  you're on Free" notice (dismissal stored client-side).

### Reporting
`lib/admin/metrics.ts`, `lib/admin/factories.ts`, `lib/referral.ts`, the
`plan-events` analytics route and the receipt/invoice code must treat trial rows
as a separate "trial" state, never as paid revenue, a paid activation or a
referral qualifier. The `paid_activation` trigger keys on captured payments, so
it needs no change; this is verified by test.

## Risks and first checks

1. **Free RLS boundary.** `weavly_private.free_business_restricted`
   (`20260908190537_free_tier_runtime.sql`) restricts any org with a Free grant
   that lacks Base. `docs/free-tier/EVIDENCE.md` records a working Free-to-Lite
   upgrade, but the plan's first task is a `test:db` case: org with a grant plus
   an active Lite row can read and write business tables through the normal
   authenticated path. If it fails, the design changes before anything is built.
2. **Trial abuse.** A new email gets a new trial. Accepted for v1.
3. **Free paused at expiry.** If the Free grant is suspended the org resolves to
   `none` and lands on billing. Accepted; same dependency as Free itself.
4. **Source-contract tests.** Many tests read file text. Search `__tests__/` for
   every file and string changed and update the contracts deliberately.

## Testing

- Unit: `subscription-access` (trial counted as access, no grace, excluded from
  paid history, expiry yields Free via the access resolver), `billing-lifecycle`
  (trial then pay is `initial_purchase` and allowed immediately),
  `base-plan-visibility`.
- Source-contract: new migration has `SET search_path = ''` and explicit
  grants; `create-order` rejects `base` for hidden orgs; chooser hides Base.
- `npm run test:db`: Risk 1 case, one-trial-per-org, ineligible org refused,
  backfill leaves existing orgs with Base visible and no trial.
- Gates: `npx tsc --noEmit`, `npm run lint` (zero warnings), `npx vitest run`.

## Out of scope

Email or WhatsApp trial reminders, admin UI to toggle the flags, trial abuse
controls beyond one per org, any change to Base features. The migration is
written as a file only and is not applied; the Supabase CLI is linked to
production.
