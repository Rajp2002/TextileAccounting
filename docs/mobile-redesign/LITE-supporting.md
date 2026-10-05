# Lite mobile supporting surfaces

This slice uses the published onboarding/account/support and delivery research, reviewed against merged Free baseline `34f37ce223ecd321c1c046901384175ca118b04a`. Parent owns final integration hashes and aggregate verification. Only Lite redesign is approved; Base presentation is unchanged. No production writes, remote auth, checkout orders, migrations, deployment or publication were performed by this slice.

## Included routes

| Route | Lite mobile presentation |
| --- | --- |
| `/owner/settings` | Concise Personal, Factory, Costing defaults, Security and App display summaries; mounted editors preserve dirty inputs and reveal late errors; one mobile deletion review; export route in deletion review. Base payroll remains unchanged and absent from Lite. |
| `/owner/billing` | Existing payment attention precedes choices; current plan/expiry/renewal and latest receipt remain visible; optional benefits and comparison fold; receipt-only notice and totals remain beside existing checkout controls. Unknown history says unconfirmed and does not claim noncapture. |
| `/owner/data-export` | Compact owner export and history; actual scope and generated/browser-download/unverified-device-save distinctions preserved. Existing route availability after expiry remains unchanged. |
| `/owner/settings/audit` | Visible search label; advanced filters fold with active count; filters remain mounted and retain selection; actor, timestamp, action, status and record ID remain accessible. |
| `/support`, `/support/[id]` | Reuse verified Free customer compact presentation for verified Lite. Memory-only drafts, immutable retry keys/payloads, request guards and navigation protection unchanged. Founder presentation remains unchanged. |
| `/plans` from Lite | Extend existing compact optional features/demos to Lite origin; recovery, prices, taxes, renewal, payment methods and paid Back destination retained. Base origin unchanged. |
| `/signup?plan=lite` | Extend existing compact auth foundation to Lite, keeping required factory/owner fields, legal consent, invalid-input feedback, password rules and uncertain-result retention. Base signup unchanged. |

Earlier Free receipts, estimator, Saved Costings and Rate Book belong to the other Lite implementation slices. Base onboarding/production/stock/payroll, marketing and founder administration are deferred.

## Shared correctness and recovery changes

- Exact factory identity and `DELETE MY ACCOUNT` phrase now opt out of automatic DOM translation in the shared deletion review. Free/Lite/Base Hindi and Gujarati display and validation were checked. Layout, phrase, payload, irreversible consequences, monetary warning, handler and backend safeguards are unchanged.
- Lite Costing defaults exposes persistent generic save failure, keeps existing stale conflict behavior, and uses a synchronous request guard. Default paid/Base behavior remains unchanged.
- Lite historical unresolved payment attempts can invoke the existing status-reconciliation component only when `shouldCheck` and the original provider order permit it. The latest attempt returns to the one existing top recovery control. Missing orders have no fake action. No new pay-again path is introduced.
- The historical client recovery object contains only attempt ID, raw status and original provider order/payment identifiers. It does not add organization, client request, provider/failure details. Existing queries/top recovery behavior are retained.
- The extra historical recovery POST uses the existing `/api/billing/status` endpoint and its exact `{orderId,paymentId}` contract. It creates no checkout/payment. Response/reload semantics stay the same; Lite opts into a synchronous single-flight guard.
- Audit search icon and Clear target align with the input independently of its mobile label; the Clear target reserves native text space. Query semantics are unchanged.

## Evidence

Evidence root: `output/playwright/lite-mobile-supporting/`. `before/` and `entry-before/` are immutable actual-component screenshots captured before owned edits. `after/` and `entry-after/` contain representative final screenshots at 320×740, 430×932 and 1440×1000. Controls use the same synthetic inputs and actual components. `supporting-comparison.json` and `entry-comparison.json` report exact dimensions, changed pixel counts, bounds and maximum channel deltas, including small raster differences rather than hiding them.

All evidence is automated Chromium browser emulation with local synthetic server-action/auth/payment/support boundaries. These are not installed iOS/Android PWA or production-account tests. The supporting fixture is localhost4194; entry checks reuse localhost4188 Free fixture without rewriting Free evidence. Before settings images reveal existing overflow even where the old global page clip kept `scrollWidth` small.

## Verification

| Check | Result |
| --- | --- |
| Current-tree unit/contract tests | Passed: 11 files,62 tests, `unit-current-tree.log`. Raw initial Vitest substring selection accidentally included old `.claude` worktrees; superseded by exact current-tree include config. |
| Owned TSX lint | Passed: `lint.log`, `lint-final.log`, `lint-correction.log`. |
| Settings/billing/export/audit behavior | Passed:29 assertions, `behavior.json`. Dirty/collapse/reopen, range validation, repeated submit, stale/generic late feedback, Discard, confirmed summaries, deletion gates/Cancel focus/no mutation, receipt identity, history Escape, generated vs browser failure, active filters/search/identity. |
| Lite support | Passed:10 assertions, `support.json`. Close/reopen memory draft, same-task repeated create/reply, uncertain immutable retry IDs/payloads and confirmed draft clear. |
| Lite plans/signup | Passed:10 assertions, `entrybehavior.json`. Paid Back route, recovery visible, demo dismissal/focus, optional details, referral retention, invalid feedback and uncertain signup input retention. |
| Historical recovery/shared deletion | Passed:50 assertions, `recovery.json`. 403/503/uncertain500, original IDs, single-flight and safe check retry, return focus, Close/reopen identity, missing-order no fake recovery; literal identity/phrase, invalid/exact enablement and dismissal clear for Free/Lite/Base HI/GU. |
| 320px text-only200% | Final results: `text200.json`, `dialogs200.json`, `entry200.json`, `support200.json`. Every original computed element font-size and numeric line-height is doubled; fixed px included, viewport/root/layout scale unchanged. Checks direct text bounds including raw identities, clipped control text, native input lineboxes/number fit, and44px targets. Screen-reader-only text is excluded as hidden content; checkbox native linebox is excluded. |
| Desktop/Base/Free controls | Comparison JSON records exact pixel evidence. Desktop layout/text preserved; Base settings/billing/audit/export and Free account controls preserved. Any tiny antialias/shadow deltas are reported explicitly. |
| Repository type/build/full aggregate | Parent-owned final clean snapshot. A raw workspace type run is not final: old `.next` admin types, scratch copies and unrelated QA source initially contaminated it. |
| Installed device PWA, actual keyboard/safe areas/back gesture, real provider/auth/download | Unrun; requires installed iOS/Android device QA. No device verification claim. |

During fixture development, stale selectors, screen-reader hidden-node/checkbox false positives, modal/navigation interference between shared browser sessions and a server restart interrupted some preliminary runs. Their passing final reruns supersede them; those failures do not establish app behavior. Real 200% history/deletion reflow and icon placement findings were corrected and rechecked.

## Remaining concerns

- Existing audit date filters use device-local midnight whereas record timestamps display Asia/Kolkata. No incidental date-query change was made; a separate timezone contract decision/test is required.
- Native installed PWA keyboard, safe-area, gesture navigation, downloaded file save location and actual payment-provider/security behavior remain device/integration QA.
- Base's pre-existing small-screen settings overflow is preserved in control screenshots and deferred to the Base phase.
