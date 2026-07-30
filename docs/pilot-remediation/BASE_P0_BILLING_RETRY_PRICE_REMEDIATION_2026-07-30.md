# Base P0 Billing Retry-Price Remediation

Date: 30 July 2026
Scope: Weavly Base / Estimator billing
Blocker: `BASE-BILL-RETRY-PRICE`

## Production defect

A failed first-year Base checkout created a `halted` subscription row and a
`failed` payment row. Access correctly remained inactive, but the checkout
lifecycle treated the `halted` row as paid history. The next Base purchase was
therefore labeled and priced as a ₹2,360 renewal instead of an ₹8,260 initial
purchase.

## Root cause

`resolveBillingPurchase` included `halted` and `cancelled` in its positive paid
lifecycle statuses. Those statuses are ambiguous: they can describe either a
previously paid subscription or a first checkout that never captured payment.

The original atomic activation migration used the same over-broad status list
when validating renewal history.

## Implemented correction

- `halted` and `cancelled` no longer prove paid history by themselves.
- Captured `subscription_payments` remain authoritative.
- A subscription-level Razorpay payment ID remains payment proof.
- A legacy Razorpay subscription ID counts only when a paid service period
  (`current_start` and `current_end`) also exists.
- Positive lifecycle states remain `active`, `authenticated`, `paused`,
  `completed`, and `expired`.
- A new database trigger rejects renewal-priced Base or Premium order rows
  unless another same-tier subscription has captured or otherwise proven paid
  history. The trigger runs both when the order is inserted and when it is later
  activated.

## Regression coverage

- Failed first purchase with a Razorpay payment ID stays `initial_purchase`.
- Halted/cancelled rows without proof stay `initial_purchase`.
- A captured payment restores renewal eligibility.
- A legacy subscription ID plus a completed service period restores renewal
  eligibility.
- The database backstop excludes bare `halted`/`cancelled` status and requires
  captured payment, positive paid state, payment ID, or a provider subscription
  with a paid period.

## Required deployed proof

After deployment:

1. Apply migration
   `20260730214000_reject_unearned_billing_renewal_pricing.sql`.
2. Reload the retained failed-checkout QA account.
3. Confirm Base again displays ₹8,260 first-year activation.
4. Complete Netbanking using Razorpay's mock Success window.
5. Confirm one captured ₹8,260 payment and one active Base entitlement.
6. Confirm direct Estimator access is granted only after capture.
