# Weavly Base Plan Production QA Report

Run ID: BASEQA-20260823-R01  
Execution date: 23 August 2026 (Asia/Kolkata)  
Scope: Existing supplied Base Plan owner account only

## 1. Executive verdict

Verdict: CONDITIONAL GO for the authorized existing Base owner scope; INSUFFICIENT EVIDENCE for an unrestricted launch decision.

Confidence: High for the executed production Base owner desktop/mobile scope; moderate for an unrestricted launch decision.

The merged P1 draft-recovery fix was verified at runtime on the canonical production URL. The mobile critical path was also executed at real 390 x 844 and 320 x 844 viewports with no horizontal overflow, and the full automated suite, lint, TypeScript, and production build passed. The main desktop costing, rate-history, versioning, document privacy, export, billing-display, logout-isolation, and plan-boundary checks remain passing.

There are no open P0 or P1 product defects in the authorized scope. A strict GO is still not supportable because the independently approved formula truth-sheet artifact was not supplied, exact current Vercel deployment-ID-to-commit proof was not exposed by the available tooling, and the account restriction leaves fresh-account, second-role, cross-tenant, referral-conversion, destructive-account, and live-payment boundaries untested.

## 2. Deployment and commit tested

- Canonical URL: https://textile-accounting.vercel.app
- Canonical alias: reachable and served the Weavly application over HTTPS.
- Supplied deployment ID from the handoff: dpl_GhgzwmYnBr4p4CLKMZw2nzERidLg.
- Supplied unique deployment URL: SSO-protected when opened directly; exact deployment ID could not be independently read from the public alias response.
- Current merged repository HEAD: 2f89ecc08f3cc15402c788650263c9896ea1122a.
- Commit message: fix(estimator): recover unsaved drafts safely.
- Canonical production behavior served the merged P1 recovery flow and the clarified P2 version-selection copy. Exact current Vercel deployment-ID-to-commit mapping remains unverified because the public alias exposes no commit identity and the Vercel CLI was unavailable in the workspace.

## 3. Account and authorization scope

Only the existing paid Base owner QA account was used. No account, organization, supervisor, access-code join, password reset, credential change, real payment, refund, notification, or cross-tenant attempt was made. All disposable names used the required prefix BASEQA-20260823-R01-.

Visible runtime identity was owner role, organization “Base pilot testing”, Base/Estimator experience, completed onboarding, and Base-only navigation. The organization identifier is kept only in restricted reconciliation evidence and is not repeated here.

## 4. Baseline captured before mutation

| Area | Baseline |
|---|---|
| Final authenticated route | /owner/estimator |
| Role and product | Owner; Weavly Estimator / Base Plan |
| Navigation | Cost Estimate, Yarn Rate Book, Saved Costings, Settings, Subscription & Billing |
| Subscription | One active Base entitlement; active through 3 Aug 2027 IST |
| Payment | One captured INR 8,260 netbanking payment |
| Rate Book | 5 active, 4 archived, 16 history rows |
| Costings | 12 total snapshots; 10 active, 2 archived; 5 costing groups |
| Factory settings | 54,000 m/month; INR 620,000 monthly expenses; 10% margin; optional sections off |
| Export history | 3 existing runs: 2 generated and 1 failed |
| Referral | Panel loaded; 0 used, 0 active, 0 ready rewards; existing code was not copied into this report |
| Browser | Codex In-app Browser; default viewport 1280 x 720; responsive overrides verified at 390 x 844 and 320 x 844 |
| Console baseline | No warnings or errors returned by the browser console collector |

The exact Chromium version, browser locale, and active service-worker state were not exposed by the available in-app Browser API. No password, token, cookie, or provider secret was recorded.

## 5. Golden-journey scorecard

| Journey | Status | Runtime result |
|---|---|---|
| GJ-01 Existing owner login and baseline | PASS | Login reached /owner/estimator; owner/Base shell, refresh, and final re-login were correct |
| GJ-02 Yarn Rate Book lifecycle | PASS | Disposable warp/weft rates persisted, updated, archived/restored, and retained ordered history |
| GJ-03 Quality and first costing | PASS | Exactly one run quality lineage and v1 snapshot were created and reconciled in the database |
| GJ-04 Re-price after rate movement | PASS | v1 remained unchanged; v2 used the updated weft rate in the same lineage |
| GJ-05 Explain version movement | PASS | Comparison UI and database showed the expected rate, cost, and selling-price deltas for the executed inputs |
| GJ-06 Output/overhead version | PASS | v3 captured 60,000 m/month; only intended overhead/commercial values moved; settings were restored |
| GJ-07 Internal/customer documents | PASS | Internal PDF contained economics; customer PDF excluded internal economics and stated it was not a GST tax invoice |
| GJ-08 Draft recovery | PASS | Merged production fix surfaced Restore/Rename/Discard/Start fresh after refresh; restore returned the disposable input and did not create a saved costing |
| GJ-09 Archive/restore/favourite/retention | PASS | v2 favourite, archive, restore, lineage, and historical values behaved correctly |
| GJ-10 Settings persistence | PASS | Changed output persisted, affected a new version, did not rewrite old snapshots, and was restored |
| GJ-11 Organization data export | PASS | Physical JSON downloaded, redaction review passed, and a generated audit row was recorded |
| GJ-12 Billing and entitlement truth | PASS | Base access, paid-through date, one captured payment, manual renewal, and receipt wording reconciled |
| GJ-13 Referral panel | PASS | Existing panel loaded with cap/eligibility messaging; conversion requiring another account was BLOCKED |
| GJ-14 Logout/cache isolation | PASS | Logout in one tab invalidated the second protected tab; re-login restored the correct organization |
| GJ-15 Mobile critical path | PASS | At 390 x 844, Base routes, navigation, costing detail dialog, version breakdown, settings, billing, and export controls worked with no horizontal overflow; 320px boundary smoke also passed |

## 6. Detailed runtime results

### Rate lifecycle

Created the disposable warp rate at INR 230/kg and weft rate at INR 245/kg with source, review date, 90-day cadence, and run-prefixed notes. The weft rate was changed to INR 250/kg and then INR 260/kg; the rate book displayed the current value and previous value, while the history dialog retained the older values. Archive and restore were non-destructive and generated history events. The final database state has both disposable rates archived, with 8 run-prefixed history rows retained.

Persisted rate IDs:

- Warp: ac416631-dbb1-4e61-ae10-5ff43aafd1af
- Weft: 67e140d4-cb2d-4b90-bcce-10a9634b7e2f

### Costing versions and immutability

The run quality was BASEQA-20260823-R01-GREY-150D. The controlled v1 snapshot used the initial weft rate of INR 250/kg and recorded production cost INR 49.15/m and suggested price INR 54.61/m. After the weft rate moved to INR 260/kg, v1 stayed unchanged and v2 recorded INR 49.72/m and INR 55.25/m. After monthly output moved from 54,000 to 60,000 m, v3 recorded INR 48.58/m and INR 53.97/m. The comparison UI showed the weft-only delta for v1 to v2 and overhead/output-only movement for v2 to v3.

All three versions shared costing group 9fa872cc-1a32-4b15-bcf6-dc6aecd3e4fa. Snapshot IDs were:

- v1: c69306c6-e14d-4e8f-957e-5e9681e7d636
- v2: 8f14fd01-a050-410f-b2b8-449333b55637
- v3: b45cd2f7-41d7-4e76-b1ad-0a335020fca4

The database preserved each version’s calculation version estimator_v3_2026_08 and rounding policy INR_HALF_UP_2. v1 and v2 retained 54,000 m/month; v3 retained the 60,000 m/month test input even after the factory default was restored to 54,000 m/month.

### Documents

The internal Cost Estimate PDF contained the run quality, internal cost, break-even, overhead, yarn rates, margin, expected profit, and 60,000 m/month assumption. The customer quotation PDF contained the disposable customer label, quantity, quotation price, total value, validity, and GST wording. It did not contain internal cost, yarn rates, overhead, break-even, margin, or profit. The preview and saved-costing surfaces did not show an unsupported standalone “Mark as sent” action. No share recipient was selected and no notification was sent.

### Draft recovery retest and P1 closure

On the canonical production URL after the merged commit, the disposable quality name BASEQA-20260823-R01-DRAFT-FIX2 was entered and allowed to autosave locally. After refresh, the page showed an `Unsaved Cost Estimate recovery` region with Restore draft, Rename, Discard, and Start fresh actions. Restore returned the disposable quality into the estimator, cleared the recovery banner, and did not create a saved costing record. A subsequent refresh showed no residual recovery banner; logout and re-login also returned to the correct Base owner workspace without draft leakage. D-001 is closed after runtime verification.

### Follow-up version-selection check

The suspected v3 detail defect was retested in the browser. A new one-version diagnostic quality, BASEQA-20260823-R01-P2-SINGLE, automatically displayed its complete breakdown in Saved Costings. A retained two-version quality opened a history dialog with version-level View breakdown actions; explicitly opening v1 and v2 loaded the selected costing into the estimator with the full yarn, weaving, overhead, commercial, and saved-version details. The canonical production UI now explains that a version must be selected and no longer shows the misleading older-snapshot message. This confirms that version selection is engineered behavior and D-002 is closed as a P3 UX clarification.

## 7. Calculation-oracle reconciliation

Status: INSUFFICIENT EVIDENCE under the handoff rule.

The product owner confirmed that the formula/costing logic was tested across multiple qualities and remained within the stated ±0.15 tolerance. Runtime movement evidence was also captured: the INR 250 to INR 260 weft movement produced a recorded cost delta of INR 0.57/m and price delta of INR 0.64/m; the 54,000 to 60,000 m/month change reduced recorded overhead by INR 1.15/m and production cost by INR 1.14/m. However, the independently approved truth-sheet artifact and reviewer approval location were not supplied. The attestation is supporting evidence, not an independent oracle PASS.

## 8. Browser versus database reconciliation

- Login, role, organization, plan shell, and Base navigation matched the profile and organization records.
- Rate Book values and active/archive state matched cost_rate_book; history matched cost_rate_history.
- Saved costing cards, version numbers, lineage, immutable values, archive state, and favourite state matched estimator_quotes.
- Settings UI returned to 54,000 m/month, matching factory_cost_profile after cleanup.
- Export history UI showed the new generated export; organization_export_runs contained four total runs with the latest status generated.
- Billing UI showed the same one active subscription and one captured payment represented in the database.

## 9. Billing and entitlement reconciliation

The Billing page showed an active Base/Estimator workspace, annual Weavly Estimator subscription, expiry 3 Aug 2027 IST, renewal opening 4 Jul 2027 IST, and “No automatic charge will be made.” Database reconciliation remained one active subscription, one captured payment, and INR 826,000 paise captured. No new checkout, payment, refund, cancellation, duplicate, or subscription change was initiated. The existing receipt downloaded successfully, rendered as a one-page payment receipt, and explicitly stated that it was not a GST tax invoice.

## 10. Internal/customer PDF privacy comparison

| Artifact | Internal economics present | Customer-safe fields | GST tax-invoice wording |
|---|---|---|---|
| Internal Cost Estimate | Yes: cost, rates, overhead, break-even, margin, profit | Internal owner document | Not applicable |
| Customer Quotation | No internal cost, rate, overhead, break-even, margin, or profit | Customer label, quantity, price, value, validity, terms | Explicitly says not a GST tax invoice |

Artifacts are in the local `exports` folder of this report.

## 11. Organization-export inspection

The new physical file was `exports/weavly-org-export-20260822215739932.json`. It was valid JSON and included the expected organization-scoped costing, rate, billing, referral, audit, and export datasets. The export contained one organization and one profile. All 535 non-null organization-reference fields inspected matched the supplied organization; no second organization reference was found.

The export’s `sensitive_fields_review` declared 17 redacted fields, including password, join code, authorization, cookie, service-role key, tracking token, phone, and recipient phone fields. Exact sensitive-field inspection found no non-redacted password, token, secret, authorization, cookie, payment-token, or card value. The new export row was `generated`; browser console collection remained empty.

## 12. Mobile and PWA results

At 390 x 844, the estimator, Yarn Rate Book, Saved Costings, Settings, Billing, and organization-export surfaces all loaded with `document.body.scrollWidth` and `document.documentElement.scrollWidth` equal to 390. The mobile navigation menu exposed all supported Base routes. The Saved Costings detail dialog measured 360px wide with no internal overflow; version 1 View breakdown loaded the selected snapshot into Cost Estimate without overflow. Console warnings/errors collected during the mobile run were empty.

At 320 x 844, the Cost Estimate route and navigation menu loaded with document/body width equal to 320. The navigation dialog measured 271px with no internal overflow. No destructive action was completed at the boundary width. The viewport was reset to the default 1280 x 720 after testing.

The exact browser version and active service-worker state were not exposed by the available in-app Browser API. No stale PWA behavior was observed or manufactured for the report.

## 13. Defect register

### P1

- D-001 — Unsaved estimator draft is lost after refresh without a recovery choice. Status: CLOSED after the merged production fix showed an explicit recovery choice, restored the disposable input, cleared the recovery item, and preserved saved-costing history.

### P3

- D-002 — Multi-version Saved Costings require an explicit version-level View breakdown action before the detailed breakdown is shown. Follow-up testing confirmed this is intentional: single-version qualities auto-display details, and explicit version selection loads full details for v1 and v2 without archive/restore. Status: CLOSED; production copy now explains the selection requirement.

### Evidence/tool limitations, not product defects

- Browser screenshot capture was unavailable: every in-app Browser screenshot request returned an inability-to-capture error. DOM snapshots, database results, and rendered PDF artifacts were used instead.
- Browser network-failure enumeration and exact browser/service-worker metadata were not exposed by the available API.
- Exact current Vercel deployment-ID-to-commit mapping was not exposed by the public alias; live behavior and the merged repository HEAD were recorded separately.

## 14. Blocked and not-run tests

The following were BLOCKED or NOT RUN exactly because the run was restricted to one existing Base owner account: fresh owner signup, onboarding, email confirmation, new-account activation, supervisor/wrong-role testing, second tenant, cross-tenant isolation, access-code join, referral attribution/conversion, password reset, real failed/cancelled/duplicate/refunded payment flows, account deletion, post-deletion retention, and live WhatsApp/email delivery. No claims were made for those boundaries.

Additional input/failure cases not completed were negative values, non-numeric values, extreme precision, large/boundary values, duplicate quality/rate names, back navigation, slow-response simulation, unknown save outcome, two-tab stale edit, archive cancellation, and service-worker-update export. Explicit zero was exercised as the weft row waste value; duplicate-click save was exercised and did not create a duplicate.

## 15. Cleanup confirmation

- Restored monthly output to the original 54,000 m/month.
- Removed the disposable favourite state.
- Archived only the two run-prefixed rates and three run-prefixed costing snapshots through the product UI.
- Final database state: both run rates `is_active=false`; all three run snapshots `is_archived=true` and `is_favorite=false`.
- Retained 8 run-prefixed rate-history rows and the archived costing snapshots because the product explicitly states permanent deletion is unavailable and retains archive/history/export evidence. The follow-up diagnostic snapshot was also archived and the diagnostic quality was removed from active lists.
- The active Saved Costings view still shows a derived run-prefixed “saved recipe · no saved costing yet” tile, while the Archived view shows the retained three-snapshot run card. This is residual retention behavior, not an untracked active costing snapshot.
- Factory settings, active subscription count, captured payment count, and captured amount were reconciled unchanged.
- No new account or organization was created; no real payment, refund, subscription mutation, or notification was made.
- The disposable P1 draft was restored and cleared; no saved costing record was created for the draft-recovery retest.
- Final authenticated browser state returned to the supplied organization’s /owner/estimator route with Base navigation.

## 16. Automated and implementation verification

- Focused P1/P2 regressions: 3 files passed, 16 tests passed.
- Full Vitest suite: 160 files passed; 980 tests passed; 1 skipped.
- ESLint: 0 errors, 1 existing warning in `lib/i18n/runtime.ts`.
- Production build: Next.js optimized build, TypeScript, 46 static pages, and service-worker compilation passed. Browserslist emitted a stale-data warning only.
- Working tree remained free of tracked modifications after verification; unrelated untracked QA/report artifacts were not committed.

## 17. Final recommendation

CONDITIONAL GO for the authorized existing Base owner scope: no open P0/P1, P1 runtime recovery passed, P2 is confirmed engineered behavior with clarified UX, mobile critical paths passed, organization export/billing/customer-document checks passed, cleanup completed, and automated/build checks are green.

Conditions before an unrestricted GO are: attach and reconcile the independently approved formula truth sheet; independently verify the current canonical Vercel deployment ID maps to commit 2f89ecc; and obtain separately authorized fresh-account, second-role, cross-tenant, referral-conversion, destructive-account, and live-payment coverage. Under the one-existing-account restriction, those boundaries remain BLOCKED/NOT RUN and must not be presented as runtime passes.
