# Weavly Estimator Manual QA Completion Report

Run ID: `ESTIMATORQA-20260718-1936-2BM0`

Date: 18 July 2026

Timezone: Asia/Kolkata

Environment: Production

Production URL: `https://textile-accounting.vercel.app`

Production deployment: `dpl_3wwHcCP78fN6oghWEsEQbbPMMbtr`

Account type: Disposable standalone Estimator owner

Disposable factory: `ESTIMATORQA-20260718-1936-2BM0-BASE`

Disposable email: `estimatorqa.20260718.1936.2bm0.owner@example.com`

## Decision

**No-Go against this manual guide until the invalid-input and Base-boundary regressions are fixed and retested.**

The core calculation, save, update, authentication persistence, saved-quality lifecycle, Base settings, most Premium upgrade walls, and final clean login worked. No cross-tenant or Premium business data was exposed. However:

1. Invalid numeric inputs can produce plausible-looking but impossible totals while the save action remains enabled.
2. A saved costing does not restore when `Open & Update` is used; the user must press a separate `Load Specs` button.
3. `/owner/today` silently redirects instead of showing the required Full Suite upgrade wall.
4. A disabled `Start Party Order` control is visible in the Base Estimator, regressing a phase the supplied guide recorded as complete.

## Scope and environment choice

The supplied PDF showed completed coverage through the Base product-entry, navigation, and form-presentation checks. This run continued from Step 5 through Step 28.

Production was selected because it was the only deployment proven current at run start. Local QA configuration points to a separate Supabase project (`eutycrtzzxmlkcpipgod`), but no current QA application deployment was established as the same production build. No speculative QA migration push was performed.

The disposable production tenant was activated with a one-day Base QA entitlement. No Razorpay transaction or real payment was performed.

## Summary

| Status | Count |
| --- | ---: |
| Pass | 14 |
| Fail | 3 |
| Blocked | 7 |
| Total continued steps | 24 |

An additional regression was found in the previously completed Base form-presentation phase.

## Step results

| Step | Area | Status | Result |
| ---: | --- | --- | --- |
| 5 | Basic calculation | PASS | 40 Ne converted to 132.875 D. Tape length 1,000 m with 5% warp crimp displayed about 952 m cloth per beam. Water Jet at 700 RPM, 60 picks, 12 hours, and 85% efficiency displayed 181 m/loom/day. No NaN or Infinity appeared and totals were formatted to rupees/paisa. |
| 6 | Invalid input handling | FAIL | Negative warp rate and effective width were accepted without inline correction. A negative rate produced a negative yarn cost. `999999999999` produced a huge valid-looking total, and `250.123456789` was accepted. Save remained enabled. Letters and comma-formatted input were rejected by the browser. |
| 7 | Save costing | PASS | One costing was saved and persisted. Database count was exactly one, with one warp row, one weft row, 1,000 m, and a complete snapshot. |
| 8 | Refresh and reopen | FAIL | The costing remained exactly once after refresh, but `Open & Update` opened an empty Estimator. Values were restored only after a separate `Load Specs` action. |
| 9 | Update costing | PASS | Warp rate changed from 250 to 260. The same database row was updated, the timestamp changed, and the count remained one. |
| 10 | Repeated update clicking | PASS | A rapid double-click updated the rate once to 261. The button protected the in-flight action and database count remained one. |
| 11 | Logout and sign-in persistence | PASS | Logout returned to login. A fresh tab login landed on the Estimator. The single costing and latest rate survived authentication. |
| 12 | Create saved quality | PASS | One quality was created with one warp and one weft layer, cotton count 40, and rate snapshot 261. |
| 13 | Update saved quality | PASS | The original quality row was updated from rate 261 to 262 without creating a second active copy. |
| 14 | Normalized duplicate prevention | PASS | Leading spaces and different capitalization were rejected. The name field had `aria-invalid=true`, was linked to an inline error, and editing the name cleared the error. |
| 15 | Explicit quality duplication | PASS | An intentional copy was created. The original remained at rate 262 and the copy was independently updated to 263. |
| 16 | Delete intentional copy | PASS | Cancel preserved the recreated copy. Confirm soft-deleted only the copy; the original remained active. |
| 17 | Base Settings review | PASS | Business/profile, privacy export, Estimator defaults, saved qualities, billing, and password/security access were present. Premium factory-operation settings were absent. |
| 18 | Reversible setting | PASS | Default commission changed from 2% to 3%, persisted after refresh and in the database, then was restored to 2% and rechecked. |
| 19 | Premium route wall | FAIL | Machines, Payroll, and Analytics showed the upgrade wall with no Premium data and a working Return to Estimator action. `/owner/today` instead silently redirected to `/owner/estimator`. Browser Back could not be conclusively verified because the automation surface reset during the check. |
| 20 | 125% zoom | BLOCKED | Exact browser zoom was unavailable. A 1024 x 720 effective-width proxy had no page-level horizontal overflow and kept the main actions reachable. |
| 21 | 150% zoom | BLOCKED | Exact browser zoom was unavailable. An 853 x 720 effective-width proxy had no page-level horizontal overflow and kept the main actions reachable. |
| 22 | iPhone testing | BLOCKED | A 390 x 844 iPhone-sized viewport passed navigation, Billing/Logout reachability, zero page-level horizontal overflow, saved-costing reopen, cotton controls, breakdown readability, and quality actions. Real iOS Safari and keyboard occlusion could not be proven. |
| 23 | Installed PWA | BLOCKED | No installed standalone PWA surface was available. The normal browser showed the update-ready message once early in the run and did not repeat it during the final clean login. |
| 24 | Offline update | BLOCKED | Safe network emulation was unavailable in the in-app browser. No Wi-Fi or system-wide network change was made. |
| 25 | Reconnect and retry | BLOCKED | Depends on Step 24. Source coverage passed, but no hosted network-loss runtime proof was produced. |
| 26 | Offline new save | BLOCKED | Safe network emulation was unavailable. Source coverage passed, but this remains runtime-unverified. |
| 27 | Final clean login | PASS | Fresh login opened the Estimator, navigation was correct, the costing and quality existed, Settings loaded, no error banner appeared, no repeated update prompt appeared, and console warnings/errors were empty. |
| 28 | Cleanup | PASS | All prefixed database records and the disposable account were removed. Zero-count reconciliation passed. |

## Findings

### EST-QA-001 - High - Impossible numeric inputs produce saveable-looking totals

Step: 6

Role: Base owner

Route: `/owner/estimator`

Viewport: 1280 x 720

Reproduction:

1. Enter a valid costing.
2. Enter `-1` for warp yarn rate or effective costing width.
3. Enter `999999999999` for warp yarn rate.
4. Enter `250.123456789` for warp yarn rate.

Expected:

- Reject the value or show a nearby actionable error.
- Do not calculate a misleading result.
- Prevent saving until corrected.

Actual:

- Negative values were accepted.
- A `-1` rate produced a negative warp-yarn result.
- `999999999999` produced a displayed total around `Rs 106,964,375,007.10/m`.
- Excessive decimal precision was retained.
- Save remained enabled.

Impact:

An owner can be shown commercially impossible costing results and may attempt to persist them. Server validation may still reject a submit, but the current form violates the guide before submission and undermines trust.

Likely owner:

Estimator client validation and numeric input constraints, with server validation retained as defense in depth.

### EST-QA-002 - Medium - Open & Update initially restores an empty form

Step: 8

Role: Base owner

Routes: `/owner/quotes` to `/owner/estimator`

Reproduction:

1. Save a valid costing.
2. Refresh Saved Cost Estimates.
3. Press `Open & Update`.

Expected:

The saved inputs and totals are restored immediately.

Actual:

The Estimator opens empty and shows `Load Specs`. Only pressing that second action restores the snapshot and changes the primary action to `Update Cost Estimate`.

Impact:

Users may believe a saved costing is blank or lost. The recovery action works, so no data loss was demonstrated.

Likely owner:

Saved Cost Estimates restore/draft handoff in `QuotesClient` and `EstimatorClient`.

### EST-QA-003 - Medium - Factory Today skips the Base upgrade wall

Step: 19

Role: Base owner

Route: `/owner/today`

Expected:

A clean Full Suite explanation with Return to Estimator.

Actual:

The route briefly rendered an empty main area and then silently redirected to `/owner/estimator`.

Impact:

No data leak occurred, but the product gives inconsistent upgrade guidance. Machines, Payroll, and Analytics displayed the expected wall.

Likely owner:

Factory Today route guard or Base route normalization.

### EST-QA-004 - Medium - Premium order action is visible in the Base Estimator

Phase: Previously completed Base form-presentation phase

Role: Base owner

Route: `/owner/estimator`

Expected:

Full Suite order controls are absent.

Actual:

A disabled `Start Party Order` button is visible on desktop and mobile Base Estimator layouts.

Impact:

This breaks the standalone-product presentation and contradicts the supplied guide, although it does not grant Premium access.

Likely owner:

Base/Premium conditional rendering in `EstimatorClient`.

## Business and security reconciliation

- Costing save: exactly one `estimator_quotes` row after initial save.
- Costing updates: same row ID retained through normal and rapid updates.
- Quality create/update: one original active row retained.
- Explicit duplicate: separate ID and independent rate snapshot.
- Duplicate deletion: only the copy became inactive; original remained active.
- Premium route checks: no machine, worker, order, production, analytics, payroll, saved-quality, or saved-costing data from another tenant was visible.
- Console checks: no warnings or errors during the final clean regression.

## Source evidence

The following targeted suite passed:

```text
5 test files passed
42 tests passed
```

Files covered:

- `estimator-only-experience.test.ts`
- `estimator-production-readiness.test.ts`
- `estimator-boundary-migrations.test.ts`
- `batch10-estimator-quote-order-snapshots.test.ts`
- `batch9-offline-cache-truth.test.ts`

This is repository evidence only for blocked offline/PWA rows and is not counted as runtime pass.

## Cleanup proof

The disposable production account and tenant were deleted after testing.

| Resource | Remaining count |
| --- | ---: |
| Organizations | 0 |
| Profiles | 0 |
| Auth users | 0 |
| Subscriptions | 0 |
| Cost estimates | 0 |
| Quality rows, including inactive history | 0 |
| Factory cost profiles | 0 |
| Referral codes | 0 |
| Audit rows for the tenant | 0 |

Cleanup errors: none.

## Evidence files

- `ESTIMATORQA-20260718-1936-2BM0-step05-calculation.png`
- `ESTIMATORQA-20260718-1936-2BM0-step19-upgrade-wall.png`
- `ESTIMATORQA-20260718-1936-2BM0-step20-zoom-proxy-125.png`
- `ESTIMATORQA-20260718-1936-2BM0-step21-zoom-proxy-150.png`
- `ESTIMATORQA-20260718-1936-2BM0-step22-mobile-menu.png`
- `ESTIMATORQA-20260718-1936-2BM0-step22-mobile-estimator.png`

## Recommended retest order

1. Fix and retest Step 6 client-side validation for negative, huge, excessive-precision, blank, spaced, and comma-formatted values.
2. Make `Open & Update` restore the saved snapshot immediately, or change the user-facing action and guide so the two-step behavior is intentional and unmistakable.
3. Align `/owner/today` with the same upgrade wall used by Machines, Payroll, and Analytics.
4. Hide `Start Party Order` entirely for Base accounts.
5. Run exact 125% and 150% browser zoom, real iOS Safari keyboard, installed-PWA, and controlled hosted offline/retry checks.
