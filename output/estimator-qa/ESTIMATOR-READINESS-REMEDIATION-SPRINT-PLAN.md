# Estimator Readiness Remediation Sprint Plan

Prepared: 19 July 2026
Source run: `ESTIMATORQA-20260718-1936-2BM0`
Proposed sprint: Monday 20 July to Friday 31 July 2026
Working assumption: one implementation owner with Codex/QA support, using QA for all mutation-heavy validation and production only for the final disposable-account smoke test.

## Sprint goal

Remove every failure and close every blocked row from the Estimator manual-testing run so the complete checklist can be signed off without proxies, conditional assumptions, or residual test data.

## Current baseline

| Result | Count |
| --- | ---: |
| Continued steps passed | 14 |
| Continued steps failed | 3 |
| Continued steps blocked | 7 |
| Earlier-phase regressions | 1 |
| Targeted source tests passing | 42/42 |

The release remains **No-Go** until the four product findings are fixed and the seven blocked runtime checks are executed on suitable browser/device infrastructure.

## Planning observations from the codebase

- `lib/estimator-validation.ts` already rejects negative, non-finite, zero-required, and out-of-range estimator values at the shared/server boundary. The main gap is that `EstimatorClient.tsx` does not surface that validation before calculation/save, so impossible-looking totals and enabled actions remain visible.
- `QuotesClient.tsx` already writes the complete saved snapshot and source record identity into the estimator draft. `EstimatorClient.tsx` deliberately waits for the user to click `Load Specs`; the restore data itself is not missing.
- `app/(dashboard)/owner/today/layout.tsx` already wraps Factory Today in the Premium `AccessGate`. The production redirect therefore requires investigation across the deployed commit, route transition, auth redirect, and PWA/service-worker cache before changing the gate.
- `Start Party Order` is rendered for Base accounts and disabled with `!canUseProduction`. It should be conditionally absent, consistent with the standalone Estimator product boundary.
- Exact PWA/offline behavior cannot be certified from a development build because PWA registration is disabled in development. A production-mode HTTPS QA deployment is a prerequisite for closing Steps 23-26 reliably.

## Work backlog

| ID | Priority | Work item | Estimate | Depends on |
| --- | --- | --- | ---: | --- |
| EST-RDY-00 | P0 | Establish a production-parity QA release candidate | 3 points | None |
| EST-RDY-01 | P0 | Prevent misleading calculation and save states for invalid inputs | 5 points | EST-RDY-00 |
| EST-RDY-02 | P0 | Make `Open & Update` restore the saved costing immediately | 3 points | EST-RDY-00 |
| EST-RDY-03 | P1 | Make `/owner/today` show the same Base upgrade wall as other Premium routes | 3 points | EST-RDY-00 |
| EST-RDY-04 | P1 | Remove `Start Party Order` from the Base Estimator | 2 points | EST-RDY-00 |
| EST-RDY-05 | P1 | Close exact 125% and 150% desktop zoom coverage | 2 points | EST-RDY-01 to 04 |
| EST-RDY-06 | P1 | Close physical iPhone Safari coverage | 3 points | EST-RDY-01, 02, 04 |
| EST-RDY-07 | P1 | Close installed-PWA lifecycle coverage | 3 points | EST-RDY-00, 03, 04 |
| EST-RDY-08 | P0 | Close offline update, reconnect/retry, and offline new-save coverage | 5 points | EST-RDY-00, 01, 02, 07 |
| EST-RDY-09 | P0 | Full regression, data reconciliation, cleanup, and release decision | 3 points | All previous items |

Total: **32 points**. The schedule reserves the final two days for runtime closure and defect buffer rather than assuming every device/offline test passes first time.

## Detailed work items

### EST-RDY-00 — Production-parity QA release candidate

Purpose: remove environment uncertainty before mutation-heavy PWA, offline, and retry testing.

Implementation:

1. Record the intended release commit SHA and current production deployment SHA.
2. Compare local migrations with the migration history in production and QA.
3. Apply only verified missing migrations to QA; do not copy production business data.
4. Deploy the same candidate commit to an HTTPS QA/preview application configured exclusively for Supabase project `eutycrtzzxmlkcpipgod`.
5. Run `npm run qa:provisioning-smoke` and the Estimator disposable-account fixture.
6. Record the app commit, QA project reference, migration parity result, and cleanup reconciliation in the evidence pack.

Acceptance criteria:

- The QA app exposes the intended candidate commit/version.
- QA migration history matches the candidate application's required schema.
- Production project reference `vzhwahudircrpgtitwzd` is absent from QA environment files and the built client/server artifacts checked for the run.
- Disposable owner provisioning, sign-in, tenant reads, sign-out, and zero-residual cleanup pass.
- No production mutation is performed during remediation development.

### EST-RDY-01 — Invalid numeric input safety

Purpose: close failed Step 6 and eliminate the highest-risk misleading-cost behavior.

Primary surfaces:

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `lib/estimator-validation.ts`
- `app/(dashboard)/owner/estimator/actions.ts`
- `__tests__/estimator-production-readiness.test.ts`
- `__tests__/estimator.test.ts`

Implementation:

1. Run shared estimator validation on the live client state rather than waiting for a server action.
2. Map validation issues to the relevant `NumField` and yarn-row controls with `aria-invalid`, `aria-describedby`, and a nearby actionable message.
3. Prevent invalid state from appearing as a valid final result. Use a clear “correct highlighted inputs” state for totals affected by invalid data.
4. Disable Save/Update/Start actions while invalid **and show the reason next to the action**, satisfying the guide's requirement that disabled save is explained.
5. Retain server-side validation as defense in depth and confirm it returns the same first actionable issue.
6. Define and enforce a consistent precision policy based on stored/database precision. Recommended default: currency/rates and percentages up to two decimal places; physical yarn quantities up to three where the estimator already calculates at that precision.
7. Handle paste explicitly: whitespace and comma-formatted values must either normalize visibly to a valid number or remain rejected with a field-level message; they must never silently become blank/zero.

Required tests:

- Negative warp and weft yarn rate.
- Negative effective costing width.
- Cleared required value.
- Letters where the browser permits entry/paste.
- `999999999999` or another value over the supported maximum.
- Excessive decimal precision.
- Leading/trailing spaces.
- `1,000` comma-formatted paste.
- Recovery to a valid value without refresh.
- Save/Update stays unavailable until valid and becomes available immediately after correction.
- No negative, infinite, NaN, or huge valid-looking final total is shown.

Acceptance criteria:

- Every invalid case is rejected or explained next to the field.
- The user knows exactly what must be corrected.
- No misleading cost result is presented as valid.
- Save/Update is disabled with an explanation and restores without a page refresh.
- Server mutation rejects a manually tampered invalid payload.

### EST-RDY-02 — Immediate saved-costing restore

Purpose: close failed Step 8 without risking unsaved local work or record duplication.

Primary surfaces:

- `app/(dashboard)/owner/quotes/QuotesClient.tsx`
- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `lib/estimator-drafts.ts`

Implementation:

1. Keep the existing confirmation when opening a saved costing would overwrite a genuinely unrelated unsaved local draft.
2. After confirmation—or immediately when no conflicting draft exists—consume a `sourceQuoteId` restore payload automatically on Estimator entry.
3. Use one shared restore function for automatic and manual recovery paths so party/quality labels, instructions, snapshot state, source ID, and optimistic-concurrency timestamp cannot diverge.
4. Remove the extra `Load Specs` requirement for the normal `Open & Update` path. A recovery banner may remain only for an interrupted/failed restore.
5. Preserve duplicate behavior: `Duplicate Costing` must open a new draft with no source quote ID.

Acceptance criteria:

- `Open & Update` lands on a populated form on first usable render.
- All saved inputs, cotton-count conversion, sections, quantity, and totals match the saved snapshot.
- The primary action reads `Update Costing`.
- Updating changes the same record ID exactly once.
- Refresh, Back, and repeated open do not create a duplicate.
- A conflicting unsaved draft is never overwritten without confirmation.

### EST-RDY-03 — Consistent Base deep-link upgrade wall

Purpose: close failed Step 19 for `/owner/today`.

Primary surfaces:

- `app/(dashboard)/owner/today/layout.tsx`
- `components/billing/AccessGate.tsx`
- `proxy.ts`
- auth home-route helpers in `lib/auth.ts` and auth callback/actions
- PWA/service-worker cache behavior for route documents

Investigation order:

1. Reproduce twice on the parity QA build using direct URL entry, internal navigation, refresh, and browser Back.
2. Confirm the deployed commit contains the current `FactoryTodayLayout` gate.
3. Capture the redirect chain and determine whether it originates from middleware/auth-home routing, a client navigation, cached route content, or the page/layout itself.
4. Fix the earliest incorrect layer. Do not add a second redirect that bypasses the intended `AccessGate` explanation.
5. Add a regression test covering all Premium deep links used by the manual guide, including `/owner/today`.

Acceptance criteria:

- A Base owner visiting `/owner/today` sees the same clean Full Suite explanation used by Machines, Payroll, and Analytics.
- `Return to Cost Estimate` works.
- Browser Back returns to the previous page without a loop.
- Refresh remains on the upgrade wall.
- No Premium business data or transient empty Premium UI is exposed.

### EST-RDY-04 — Hide Premium order action from Base

Purpose: repair the earlier Base product-presentation regression.

Primary surfaces:

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `__tests__/estimator-only-experience.test.ts`

Implementation:

1. Render `Start Party Order` only when `canUseProduction` is true instead of rendering a disabled control for Base.
2. Verify the remaining Base actions are only Save/Update Costing and allowed costing workflows.
3. Strengthen the regression test so it asserts conditional absence, not merely a disabled predicate.

Acceptance criteria:

- Base desktop and mobile Estimator layouts contain no `Start Party Order` control, placeholder, tooltip, or inaccessible duplicate.
- Premium retains the control and its existing validation/atomicity behavior.
- The action cannot be revealed by viewport changes or navigation state.

### EST-RDY-05 — Exact desktop zoom certification

Purpose: replace the effective-width proxies for Steps 20 and 21 with the requested browser behavior.

Execution matrix:

| Browser state | Viewport | Required coverage |
| --- | --- | --- |
| Chrome 125% zoom | Normal desktop window | Sidebar, account menu, inputs, breakdown, Save/Update, saved-quality controls, Settings, dialogs |
| Chrome 150% zoom | Same window | Repeat full 125% matrix |
| Chrome reset | Command + 0 | Confirm layout returns to baseline |

Acceptance criteria:

- No core action is clipped or unreachable.
- Text and fields do not overlap.
- Dialogs fit or scroll internally.
- Horizontal scrolling does not block the workflow.
- Account, Billing, Logout, Save, and Update remain reachable.
- Evidence includes full-page screenshots at both browser zoom levels and any opened dialog state.

If a defect appears, fix the smallest responsive container/control involved and rerun both zoom levels before closure.

### EST-RDY-06 — Physical iPhone Safari certification

Purpose: replace the 390 x 844 emulation proxy for Step 22.

Execution:

1. Use a physical iPhone with current Safari against the HTTPS QA release candidate.
2. Sign in with a disposable Base account.
3. Open the mobile navigation and verify Cost Estimate, Saved Cost Estimates, Settings, Billing, and Logout.
4. Exercise cotton-count/denier controls and several numeric inputs with the iOS numeric keyboard.
5. Confirm the keyboard can be dismissed and never permanently covers Save/Update.
6. Reopen the desktop-created costing and inspect cost breakdown and quality actions.
7. Rotate once to landscape as a defensive check, then return to portrait.

Acceptance criteria:

- All eleven checks from Step 22 pass on the physical device.
- Safe-area insets and keyboard behavior do not hide critical actions.
- No blocking horizontal overflow exists.
- Screenshots or a short screen recording capture navigation, keyboard/action visibility, restored costing, and Settings.

### EST-RDY-07 — Installed-PWA lifecycle certification

Purpose: close Step 23 on a real installed application surface.

Execution:

1. Build/deploy the production-mode QA candidate over HTTPS and install it to the Home Screen or desktop Chrome app surface.
2. Authenticate, close the PWA completely, and reopen it.
3. Confirm restoration to the correct authenticated Estimator route.
4. Verify current Base navigation and absence of legacy Estimator/Quotes/Billing labels or Premium controls.
5. Deploy one harmless version increment to the QA candidate and exercise the update prompt once.
6. Reopen/refresh repeatedly to prove there is no update or refresh loop.

Acceptance criteria:

- Cold reopen restores a valid authenticated Base route.
- No refresh loop occurs.
- Navigation matches the current product.
- The update message appears at most once for the new version and does not repeat after acceptance.
- Closing/reopening after the update loads the new version.

### EST-RDY-08 — Offline failure and recovery certification

Purpose: close Steps 24-26 without false success, record duplication, or lost user edits.

Primary surfaces:

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- estimator server actions and idempotency handling
- `lib/estimator-drafts.ts`
- `components/offline-sync-provider.tsx`
- PWA/service-worker configuration in `next.config.ts`

Implementation and test flow:

1. Use controlled DevTools network emulation on the HTTPS QA PWA/candidate, not a system-wide production outage.
2. Existing costing: change one harmless rate, go Offline, click Update.
3. Assert no success toast, no redirect to Saved Cost Estimates, no server mutation, no duplicate, and no silent reversion of the edited state.
4. Present an explicit offline/failure message with a retry action or clear instruction. Preserve the draft and source record identity.
5. Reconnect and retry from the same state. Confirm one update to the original ID and persistence after refresh/reopen.
6. New costing: create a temporary prefixed costing, go Offline, click Save, and assert the same truthful failure behavior.
7. Reconnect and retry once. Confirm exactly one new row. Delete it and reconcile cleanup.
8. Exercise delayed-response/double-click behavior during recovery so request idempotency remains intact.

Acceptance criteria:

- Offline Save/Update never produces a success message before server confirmation.
- Existing server data remains safe while offline.
- Edited values remain recoverable and are not silently replaced.
- Reconnect/retry succeeds without requiring a new record.
- Existing update keeps one original row; new-save retry creates exactly one row.
- Repeated retry/double-click cannot produce duplicates.
- The temporary offline-save record is deleted and all fixture counts reconcile to zero.

### EST-RDY-09 — Full release-candidate regression and cleanup

Purpose: turn the remediated candidate into an evidence-backed Go/No-Go decision.

Required checks:

1. Run the complete supplied manual guide from login through cleanup, not only the previously failed rows.
2. Run targeted estimator tests plus the full repository test suite.
3. Run the production build and verify no build failure or new warnings attributable to this work.
4. Check console warnings/errors during the clean final login.
5. Reconcile costing, quality, subscription fixture, organization, profile, auth user, referral, cost-profile, and audit records.
6. Perform a minimal production smoke with a new disposable Base account only after QA passes. Do not perform a real payment.
7. Delete the production account and prove zero residual records.

Release acceptance criteria:

- Steps 5-28: **24 Pass, 0 Fail, 0 Blocked**.
- The earlier Base form-presentation phase passes with no Premium CTA visible.
- All automated estimator tests, full tests, and production build pass.
- No cross-tenant or Premium data is exposed.
- No material console-visible or user-visible error remains.
- QA and production smoke evidence identifies the tested commit/deployment.
- Disposable QA and production data both reconcile to zero.

## Proposed ten-day schedule

| Date | Focus | Exit condition |
| --- | --- | --- |
| Mon 20 Jul | EST-RDY-00 QA parity and baseline reproductions | Safe QA candidate and repeatable failures |
| Tue 21 Jul | EST-RDY-01 client validation | Invalid-input unit/component coverage passing |
| Wed 22 Jul | Finish EST-RDY-01; EST-RDY-02 restore | Step 6 and Step 8 pass on QA desktop |
| Thu 23 Jul | EST-RDY-03 route wall; EST-RDY-04 Base CTA | All known product failures fixed in code |
| Fri 24 Jul | Integration regression and candidate build | Steps 5-19 pass on parity QA candidate |
| Mon 27 Jul | EST-RDY-05 exact zoom; responsive fixes | Steps 20-21 closed |
| Tue 28 Jul | EST-RDY-06 physical iPhone | Step 22 closed |
| Wed 29 Jul | EST-RDY-07 installed PWA; begin offline | Step 23 closed; offline evidence underway |
| Thu 30 Jul | EST-RDY-08 offline/retry and defect buffer | Steps 24-26 closed |
| Fri 31 Jul | EST-RDY-09 full regression, production smoke, cleanup | Final evidence-backed Go/No-Go |

## Test evidence required per ticket

Each work item is complete only when its evidence pack contains:

- The tested commit and deployment URL.
- Account role/tier and a non-secret disposable run ID.
- Exact reproduction steps and expected/actual result.
- At least one screenshot for UI behavior; video is preferred for keyboard, PWA update, or retry flows.
- Console error/warning result.
- Database invariants for any save/update/delete work.
- Cleanup counts for all created records.
- A regression test that fails before the fix and passes afterward where practical.

## Release gate

The Estimator is ready for the controlled pilot only when all of the following are true:

- EST-RDY-00 through EST-RDY-09 are complete.
- The final manual matrix contains no Fail or Blocked status.
- Invalid inputs cannot produce a valid-looking commercial result.
- Saved costing restoration and update are one clear workflow.
- Base users see no Premium actions but receive consistent upgrade explanations on direct Premium links.
- Exact zoom, physical iPhone, installed PWA, offline update, reconnect/retry, and offline new-save are proven at runtime.
- No duplicate records, cross-tenant data, stale PWA loop, or residual disposable account data remains.

Anything short of those conditions remains a **No-Go**, with the incomplete ticket carried forward explicitly rather than converted to a proxy pass.

## Execution outcome — 19 July 2026

Run: `ESTSPRINTQA-20260719-0719-CE83`

| Ticket | Final state |
| --- | --- |
| EST-RDY-00 | Complete — QA migration parity is 213/213 and the final build contains only the QA project reference. |
| EST-RDY-01 | Complete — invalid values pause results, show accessible errors, and block actions until corrected. |
| EST-RDY-02 | Complete — saved costings restore immediately and update the same record. |
| EST-RDY-03 | Complete — all tested Base Premium deep links show the consistent upgrade wall. |
| EST-RDY-04 | Complete — Base has no `Start Party Order` control. |
| EST-RDY-05 | Complete — real Chrome reported exact 125% and 150% zoom; both layouts had zero horizontal overflow and retained critical-action reachability. |
| EST-RDY-06 | Complete — physical iPhone Safari passed navigation, no-overflow layout, keyboard visibility/dismissal, conversion, calculation, save/reopen, quality-action visibility, Settings reachability, and the final no-focus-zoom retest. |
| EST-RDY-07 | Complete — a real Chrome desktop PWA passed standalone initial open, authenticated cold relaunch, overflow, console, signout, and uninstall checks. |
| EST-RDY-08 | Complete — offline update, reconnect/retry, and offline new-save passed with database reconciliation. |
| EST-RDY-09 | Partial — regression, build, physical-device certification, QA cleanup, and evidence are complete; the exact merged candidate still needs a deployed-production smoke and cleanup proof. |

Final continued-step matrix after the Chrome/PWA follow-up and physical-iPhone Safari pass: **24 Pass, 0 Fail, 0 Blocked**. The earlier Base CTA regression also passes. All disposable QA tenants and Auth users were deleted. The automated fixture reconciled its organization, profile, subscription, and Auth user to zero; the physical-iPhone organization, profile, subscription, and Auth user also reconciled to zero. The blocker-closure tenant reconciled to zero across all 68 live tenant-scoped tables, with zero query errors, and its installed desktop app was removed.

Detailed evidence and the release decision are in `ESTSPRINTQA-20260719-0719-CE83/FINAL-REPORT.md`.
