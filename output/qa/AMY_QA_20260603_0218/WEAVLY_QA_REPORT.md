# Weavly End-to-End QA Report — AMY_QA_20260603_0218

Evidence root: [output/qa/AMY_QA_20260603_0218](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218)
Screenshots captured: 156
Findings logged: 9 (4 Blocker, 5 High)

## 1. Metadata
| Field | Value |
|---|---|
| QA run date/time | 2026-06-03 03:06:06 IST (+0530, Asia/Kolkata); browser evidence timestamps are UTC in evidence.json |
| Environment | Local Next dev server, http://localhost:3000 |
| Browser/device | Codex in-app browser; desktop default viewport, mobile 390x844, tablet 768x1024 |
| Record prefix | AMY_QA_20260603_0218 |
| Owner account | amy.qa.20260603.0218.owner@example.com (fake QA account; password omitted) |
| Supervisor accounts | amy.qa.20260603.0218.supervisor.qa@example.com; also a misjoin test account amy.qa.20260603.0218.supervisor@example.com created under a redacted non-QA org because of BUG-003 |
| QA factory/org | AMY_QA_20260603_0218 Factory; QA org id b1f6e408-ca92-4e70-a82d-4db74b2b91b4 |
| Assumptions | QA only, no code changes. Read-only DB checks were scoped to QA org/data and saved as sanitized JSON. Non-QA org names are redacted. |
| Source of truth | [attached PDF guide](/Users/rajpatel/Downloads/Weavly_End_to_End_Intern_QA_Testing_Guide.pdf) plus user instructions in goal |
| Health artifacts | [console/network health](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/console-network-health.json), [findings JSON](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/findings.json), [evidence JSON](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/evidence.json) |

## 2. Executive Summary
| Verdict target | Verdict | Rationale |
|---|---|---|
| Internal demo | Conditional only | Quote/order, market-run creation, stock sale, owner dispatch receipt, archive, and commercials can be demoed with a scripted path. Avoid loom assignment, public tracking, sub-taka lots, worker UI, and supervisor production. |
| Controlled pilot | No | Blockers in loom setup, join-code isolation, sub-taka/taka math, and worker UI visibility prevent a real factory pilot. |
| Paid customer production | No | Data integrity and security/privacy risks remain open: cross-org join code, wrong date persistence, wrong taka math, missing public tracking token, and broken worker/loom operations. |

Final verdict: **Not ready / blocked pending fixes**.

## 3. Results Table
| Area | Status | Notes | Evidence |
|---|---|---|---|
| Signup, onboarding, login/logout, sessions | Partial / Fail | Signup, onboarding, login/logout, and two-tab logout guard worked. Onboarding success claims for looms/workers did not surface correctly in owner UI. | [signup](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/022-signup-04-result-after-extended-wait.png) [trial](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/033-onboard-10-free-trial-result-after-extended-wait.png) [two-tab](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/152-session-03-second-tab-refresh-after-logout.png) |
| Factory setup/settings and production modes | Partial / Fail | Production mode both saved; Settings later showed correct join code EKVKDG7R. Fresh post-onboarding Settings initially showed wrong cross-org code. | [wrong code](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/035-settings-01-factory-settings-after-onboarding.png) [later settings](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/136-settings-02-settings-and-production-mode-after-regression.png) [DB code check](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-join-code-check-redacted.json) |
| Owner/direct/protected routes | Pass with caveat | Logged-out protected owner/supervisor routes redirected to login. Owner route smoke loaded except feature-archived system health. | [owner guard](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/016-sec-01r-owner-protected-route-logged-out-retest.png) [route smoke](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/owner-route-smoke-after-regression.json) |
| Supervisor join/login/routes/role boundaries | Partial / Fail | Invalid join code rejected; actual QA join code worked; direct owner URLs redirected. Supervisor dashboard copy says Viewing as Owner. | [invalid join](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/045-join-01-invalid-join-code.png) [supervisor](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/051-join-07-qa-supervisor-join-result.png) [routes](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/supervisor-boundary-results.json) |
| Estimator happy path / invalid / saved qualities | Pass / Partial | Estimator saved quality and quote after setup overlay; blank save did not progress. Costs calculated: production ₹34.84/m, quote ₹35.55/m. | [setup](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/074-est-04e-estimator-overhead-setup-finished.png) [quality](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/076-est-06-save-quality-confirm-result.png) [quote saved](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/079-quote-02a-save-quote-coordinate-after-setup-result.png) |
| Quotes history/accept/create active order | Pass | Draft quote appeared, accepted, and created active order cb67a9ce-ead8-4c7a-a07b-ba654d77120f. | [accepted](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/083-quote-06-quote-accepted-after-confirmation.png) [order](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/086-order-02-active-order-creation-result.png) |
| Orders detail/loom assignment/activation validation | Blocked / Fail | Order detail loaded with 0/1500m, but machine assignment says no active machines because loom creation/listing is broken. | [order detail](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/086-order-02-active-order-creation-result.png) [loom blocker](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/044-bug-002-manual-add-loom-invisible-after-refresh.png) |
| Supervisor production logs / duplicate submit | Blocked | Supervisor production screen loaded but 0/0 looms; no production log or duplicate-submit test possible. | [desktop blocked](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/053-sup-02-supervisor-production-route-qa.png) [mobile blocked](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/148-mobile-06-supervisor-production-390x844.png) |
| Factory Today / Analytics / Payroll | Partial | Pages loaded with no browser console warnings. Today/Analytics still show setup/0-production state; Payroll shows ₹0 because workers/looms are not visible in UI. | [today](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/132-today-02-after-stock-commercials-regression.png) [analytics](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/133-analytics-01-after-stock-commercials-regression.png) [payroll](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/122-payroll-01-owner-payroll-preview-after-blocked-production.png) |
| Workers / attendance / advances | Fail / Blocked | DB has workers, but Workers/Advances/Payroll UI shows zero. Manual fixed worker persists in DB but still invisible; entered salary changed from ₹18,000 to ₹30,000. | [workers zero](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/123-workers-02-owner-fixed-workers-route.png) [fixed zero](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/131-workers-08-fixed-salary-tab-after-manual-worker.png) [worker DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-workers-after-manual-add.json) |
| Market-run production | Partial / Blocked | 100m market run was created; produced meters remain 0 and production logging is blocked by no looms. | [market run detail](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/142-market-06-start-market-run-result.png) |
| Stock visibility/ledger/movements | Fail / Partial | Stock page and movement ledger updated, but manual lot treats 25m as 25 takas and movement ledger records wrong taka units. | [stock lot](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/091-stock-04-manual-25m-stock-lot-saved.png) [DB before sale](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-before-sale.json) |
| Sale-only / dispatch-now / pending dispatch | Partial | Sale-only flow worked; pending dispatch moved 10m to dispatch. Dispatch-now was not separately saved because public/stock regression used sale-only then confirm dispatch. | [after sale](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/103-sale-12-sale-only-saved-stock-after.png) [pending sale](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/105-dispatch-02-pending-dispatches-tab.png) [dispatch result](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/108-dispatch-05-confirm-dispatch-result.png) |
| Sub-taka/fractional sale regression | Fail | UI cannot create under-1-taka lot; sold 10m persisted as 10 takas instead of intended ~0.2 taka. | [oversell](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/096-sale-05-oversell-next-disabled.png) [stock regression](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/stock-regression.json) |
| Partial/full sale, oversell, invalid quantities | Partial | Oversell 30m from 25m disabled Next. Partial sale 10m from 25m worked; full dispatch/receipt of that sale worked. Taka math remains wrong. | [oversell blocked](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/096-sale-05-oversell-next-disabled.png) [full receipt](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/111-receipt-02-record-receipt-filled-before-submit.png) |
| Public tracking / invalid token / receipt | Fail / Blocked | Invalid token redirected to login; stock-sale dispatch generated no tracking_token. Owner-side receipt worked. | [invalid token](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/015-track-01r-invalid-token-logged-out-retest.png) [dispatch DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) [owner receipt](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/112-receipt-03-record-receipt-result-delivered.png) |
| Dispatch status sync back to owner app | Pass / Partial | DB: dispatch delivered, sale received; Archive shows completed dispatch. Active Dispatches hides delivered batch, which appears intentional archive behavior. | [archive](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/115-archive-01-after-delivered-stock-dispatch.png) [after receipt DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-receipt.json) |
| Commercial receivables / payment / due dates | Pass with date bug | Receivable ₹420 created, due 17 Jun 2026, payment ₹420 made, balance ₹0. Submitted payment date 2026-06-03 persisted 2026-06-02. | [receivable](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/116-commercials-01-after-sale-dispatch-receipt.png) [paid](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/119-commercials-04-payment-result-paid.png) [payment DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-commercials-after-payment.json) |
| Archive / Billing / Forgot / Reset / Join invalid | Pass / Partial | Archive, Billing, Forgot submit, Reset invalid, Join invalid all safe. Public tracking invalid state is covered as fail above. | [archive](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/115-archive-01-after-delivered-stock-dispatch.png) [billing](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/135-billing-01-billing-smoke-owner.png) [forgot](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/155-forgot-03-submit-result.png) [reset](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/156-reset-02-invalid-token-smoke-logged-out.png) |
| Mobile/tablet QA | Partial | Owner stock sale wizard and supervisor production screen usable. Mobile menu logout row overlaps bottom navigation enough to require coordinate click in automation. | [owner mobile](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/144-mobile-02-owner-stock-sale-wizard-390x844.png) [supervisor mobile](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/148-mobile-06-supervisor-production-390x844.png) [tablet](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/149-tablet-01-supervisor-production-768x1024.png) |
| Console/network health | Pass browser / Warn server | 0 captured browser warnings/errors; 0 hydration/Supabase getSession/Radix/unhandled React warnings. Server terminal repeatedly logged Sentry proxy ECONNRESET. npm run lint passed. | [health](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/console-network-health.json) |
| Security/privacy | Fail / Partial | Logged-out guards and supervisor direct owner-route restrictions passed. Join-code cross-org leak is a blocker. No raw DB/Postgres errors in client UI. | [supervisor owner guard](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/057-sec-04-supervisor-direct-owner-today.png) [join code DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-join-code-check-redacted.json) |

## 4. Critical Findings
### BUG-001 — Blocker — Onboarding / Machines
**Onboarding machine creation reports success but owner Looms page shows no looms**

Steps:
- Create fresh owner
- Complete onboarding machine step with 4 loom groups
- Open /owner/machines
- Refresh once

Expected: Four created looms persist and are visible for assignment/production

Actual: Owner /owner/machines says No looms found after onboarding success

Business impact: Fresh factory cannot proceed to loom assignment or supervisor production without recreating looms manually.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/039-bug-001-reproduce-onboarding-machines-missing-after-refresh.png)

Next action: Retest after fix.

### BUG-002 — Blocker — Machines / Production setup
**Manual Add Loom reports success but no loom appears after refresh**

Steps:
- Open /owner/machines
- Click Add Loom
- Enter prefixed loom name and Jacquard type
- Click Add Loom
- Refresh

Expected: New loom appears in Loom Assignments

Actual: Success toast appears but page still says No looms found after refresh

Business impact: Fresh owner cannot create assignable looms, blocking order/market-run production and supervisor logging.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/044-bug-002-manual-add-loom-invisible-after-refresh.png)

Next action: Retest after fix.

### BUG-003 — Blocker — Security / Join code / Data isolation
**Fresh owner Settings displayed another organization's join code, causing supervisor to join non-QA factory**

Steps:
- Fresh owner completed onboarding
- Open /owner/settings
- Read Factory join code displayed as 32HYKD9A
- Log out and enter that code on /join
- Supervisor form shows non-QA factory and created supervisor in that org

Expected: Settings join code belongs to the current owner's QA organization and supervisor joins the same QA org

Actual: Read-only DB check shows QA org real join_code is EKVKDG7R; displayed code 32HYKD9A maps to a non-QA org. Supervisor profile was created under the non-QA org.

Business impact: A factory owner can invite a supervisor into another factory, exposing private production/party/order data and polluting that factory with the wrong user.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/035-settings-01-factory-settings-after-onboarding.png) | [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-join-code-check-redacted.json)

Next action: Retest after fix.

### BUG-004 — High — Supervisor / Role boundaries
**Supervisor dashboard shows owner-view copy**

Steps:
- Join QA factory as supervisor
- Land on /supervisor/dashboard

Expected: Supervisor dashboard shows supervisor role/scope only, with no owner impersonation language unless intentionally authorized

Actual: Dashboard displays "Viewing as Owner" and "Switch to Owner View" for supervisor account

Business impact: Supervisors may believe they have owner privileges; this undermines role-boundary confidence and could mask unauthorized access.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/051-join-07-qa-supervisor-join-result.png)

Next action: Retest after fix.

### BUG-005 — Blocker — Stock / Taka math
**Manual Add Stock stores total meters as taka count and cannot create sub-taka lot**

Steps:
- Open /owner/stock
- Add stock lot with quality AMY_QA_20260603_0218 QA Sub-Taka Quality
- Enter Total Meters = 25, cost = 28, save
- Check UI ledger and DB row

Expected: A 25m lot can represent under-1 taka/0.5 taka or at minimum does not treat 25m as 25 takas; sub-taka regression lot can be created

Actual: UI exposes no taka-count control; saved row has original_taka_count=25, available_taka_count=25, meters_per_taka=1, and ledger says Stock inward +25 taka 25m

Business impact: Sub-taka sale regression cannot be tested through the UI and stock/taka ledger math is materially wrong for manual lots.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/090-stock-03-manual-25m-stock-dialog-filled.png) | [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/091-stock-04-manual-25m-stock-lot-saved.png) | [E3](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-before-sale.json)

Next action: Retest after fix.

### BUG-006 — High — Dates / dispatches / commercials
**Date inputs submitted as 2026-06-03 persist/display as 2026-06-02**

Steps:
- From the QA stock sale dispatch dialog, fill Dispatch Date as 2026-06-03 and submit 10m dispatch.
- Verify Dispatches/Archive and DB dispatch row.
- From Commercials payment dialog, fill Payment Date as 2026-06-03 and submit full ₹420 payment.
- Verify DB payment receipt row.

Expected: Dates entered as 2026-06-03 should persist and display as 2026-06-03, and due-date calculations should be based on that date.

Actual: Dispatch persisted/displayed as 2026-06-02 with due date 2026-06-17; payment receipt persisted payment_date as 2026-06-02 despite 2026-06-03 input.

Business impact: Dispatch challans, receipt timelines, collection dates, aging buckets, and due-date calculations can be one day wrong for factories operating in Asia/Kolkata.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/107-dispatch-04-confirm-dispatch-filled-before-submit.png) | [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) | [E3](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/118-commercials-03-payment-filled-before-submit.png) | [E4](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-commercials-after-payment.json)

Next action: Normalize date-only fields without UTC conversion drift; retest dispatch date, payment date, and due-date aging in Asia/Kolkata and UTC-negative timezones.

### BUG-007 — High — Onboarding / workers / payroll
**Persisted onboarding workers are not visible in Workers, Advances, or Payroll UI**

Steps:
- During onboarding, add two prefixed meter-rate workers and save the worker step.
- Open sidebar Workers route /owner/fixed-workers after onboarding.
- Open Advances and Payroll.

Expected: Workers page should list the two persisted piece-rate workers; Advances and Payroll should use those workers for advance and wage workflows.

Actual: Read-only DB check shows two QA piece-rate worker rows, but Workers page shows Piece Rate Workers 0; Advances shows Select Worker 0 and No workers found; Payroll shows 0 piece-rate and 0 monthly/daily workers.

Business impact: Persisted workers cannot be operated on from the UI, blocking advances, payroll settlement, attendance-adjacent workflows, and production wage visibility.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/026-onboard-04-worker-form-parsed-two-workers.png) | [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/027-onboard-05-workers-saved.png) | [E3](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/121-advances-01-owner-advances-initial.png) | [E4](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/123-workers-02-owner-fixed-workers-route.png) | [E5](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-workers-after-manual-add.json)

Next action: Fix worker-list queries/cache invalidation and retest Workers, Advances, Payroll, and supervisor worker visibility against persisted rows.

### BUG-008 — High — Workers / attendance / payroll
**Manual fixed worker persists in DB but UI still shows zero fixed workers; salary also persisted as role default**

Steps:
- Open /owner/fixed-workers.
- Open Add Worker, choose Fixed Salary, fill prefixed worker name, role Master, monthly salary ₹18,000, phone, consent, and age confirmation.
- Submit Add Worker, then switch to Fixed Salary tab and open Advances/Payroll.

Expected: New fixed worker should be visible in Fixed Salary tab and selectable in Advances/Attendance/Payroll with the entered monthly salary ₹18,000.

Actual: DB contains AMY_QA_20260603_0218 Meena Fixed Salary as active, but Fixed Salary tab shows 0 active fixed workers. Entered salary ₹18,000 persisted as ₹30,000 (role default for Master).

Business impact: Owners cannot see or operate on newly-created salaried staff from the UI, and payroll can use an incorrect monthly salary.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/129-workers-05c-fixed-worker-role-selected-before-save.png) | [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/130-workers-07-fixed-worker-save-after-role-selected.png) | [E3](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/131-workers-08-fixed-salary-tab-after-manual-worker.png) | [E4](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-workers-after-manual-add.json)

Next action: Fix fixed-worker query/cache visibility and salary binding so submitted salary persists; retest worker listing, advances, attendance, and payroll preview.

### BUG-009 — High — Public tracking / receipt confirmation
**Stock-sale dispatch generated no public tracking token; public receipt flow is unavailable**

Steps:
- Create QA stock sale and confirm stock-sale dispatch.
- Inspect dispatch row and DB dispatch record for public tracking token/link.
- Open invalid public tracking token while logged out.

Expected: Dispatch should expose a public tracking URL/token for trader receipt confirmation, and invalid tokens should show a safe public invalid-token state.

Actual: DB dispatch row has tracking_token null; no public tracking URL was visible in dispatch UI. Invalid /track/not-a-real-token redirected to login instead of a public invalid-token page. Owner-side Record Receipt did work.

Business impact: Trader-facing receipt confirmation cannot be exercised, so factories must confirm receipt inside the owner app and cannot share a public receipt link.

Evidence: [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) | [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/109-dispatch-06-dispatched-batch-expanded.png) | [E3](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/015-track-01r-invalid-token-logged-out-retest.png) | [E4](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/112-receipt-03-record-receipt-result-delivered.png)

Next action: Decide whether public tracking is in Phase 1 scope. If yes, generate tokens/links for dispatches and make invalid-token handling public-safe; if no, remove public tracking expectations from UI/docs.

## 5. Workflow Results
- Signup/login/logout/session guard: **Partial**. Signup and trial activation worked; two-tab logout redirect passed. Onboarding setup outputs did not fully materialize in downstream pages.
- Onboarding to production readiness: **Fail**. Looms and workers appear saved during onboarding but owner operational pages cannot use them.
- Estimator to quote to active order: **Pass until production assignment**. Quote and accepted order were created; order production cannot start because looms are absent.
- Supervisor flow: **Partial / blocked**. QA supervisor can join with actual code and owner routes are blocked, but dashboard copy says owner and production logging cannot proceed.
- Stock sale to dispatch to receipt to commercials: **Pass for meters and receivable amounts; fail for taka math, public tracking, and dates**.
- Worker/attendance/advance/payroll: **Blocked**. Worker rows exist in DB but UI shows zero workers; attendance/advance/payroll downstream workflows cannot be completed.
- Market run: **Partial**. Market run created, but production stays at 0m because loom/supervisor logging path is blocked.
- Mobile/tablet: **Partial**. Core pages render, but supervisor production is blocked and mobile menu/logout ergonomics need cleanup.

## 6. Stock-to-Dispatch Regression
| Checkpoint | Meters | Takas | Receivable / status | Evidence |
|---|---:|---:|---|---|
| Lot created | 25m | Intended 0.5; actual DB/UI 25 | Stock cost ₹700 | [stock UI](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/091-stock-04-manual-25m-stock-lot-saved.png) [DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-before-sale.json) |
| Before sale | 25m available, 0m pending | 25 available | No receivable | [before sale](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/098-sale-07-stock-before-valid-sale-reopened.png) |
| Oversell test | Attempted 30m | N/A | Next disabled | [oversell](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/096-sale-05-oversell-next-disabled.png) |
| Sale-only saved | 10m sold; 15m available; 10m pending dispatch | Intended 0.2; actual sale.taka_sold 10 | Receivable ₹420, due null, dispatch_status not_dispatched | [after sale](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/103-sale-12-sale-only-saved-stock-after.png) [DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-sale.json) |
| Dispatch confirmed | 10m dispatched; 0m pending | 10 dispatched | Dispatch e9cedcfd-31a5-4da2-a138-3a5d05df6458; visible batch SS-D9A06B19-1; due date 2026-06-17; status in_transit | [dispatch UI](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/108-dispatch-05-confirm-dispatch-result.png) [DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) |
| Public tracking | N/A | N/A | tracking_token null; no public URL available | [DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) |
| Owner receipt | 10m received | N/A | Sale status received; dispatch status delivered | [receipt](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/112-receipt-03-record-receipt-result-delivered.png) [DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-receipt.json) |
| Commercial collection | N/A | N/A | Receivable paid: total ₹420, received ₹420, balance ₹0; payment date persisted 2026-06-02 after 2026-06-03 input | [paid](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/119-commercials-04-payment-result-paid.png) [DB](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-commercials-after-payment.json) |

Key inconsistency: meters stay consistent through sale/dispatch/receipt/commercials, but taka quantities are wrong from lot creation onward and date-only fields shift one day earlier.

## 7. Data Consistency
- Quote to order: saved QA quote became accepted and created active order cb67a9ce-ead8-4c7a-a07b-ba654d77120f for 1,500m. Order showed 0/1,500m because no assignable looms exist.
- Order to production/payroll: no production logs could be created, so Analytics and Payroll correctly remained at 0 produced meters/wages, but this is due to setup blockers rather than completed workflow verification.
- Market run: created market run 8c6f3e3c-84ca-4938-87be-2f7d7058ecea for 100m; detail shows 0m produced, 0m stock remaining, unit cost ₹34.84/m.
- Stock lot to sale: lot 5485d113-55c6-4fa9-9edc-f98eb9cd3f0b moved from 25m/25 takas to 15m/15 takas after 10m sale; meters are consistent, takas are not domain-correct.
- Sale to dispatch/archive: sale d9a06b19-26d8-4157-8c52-a744688ffcff linked to dispatch e9cedcfd-31a5-4da2-a138-3a5d05df6458; archive shows 10m sale/dispatched/confirmed.
- Dispatch to receivable: receivable 8f2a2e70-517d-474b-947d-5c15cd04385f linked to dispatch, due 2026-06-17, total ₹420.
- Payment to receivable: payment receipt 2a64e304-32f6-4991-9a44-f71f9f94a8da recorded ₹420 and receivable status paid/balance ₹0.
- Workers/payroll: DB has workers, but UI worker lists show zero; payroll cannot be trusted until UI/query gap is fixed.

## 8. Console/Network Health
- Browser console warnings/errors captured by route/interactions: **0**.
- Hydration errors: **0**.
- Supabase getSession warnings: **0**.
- Radix warnings: **0**.
- Unhandled React errors: **0**.
- npm run lint: **passed**.
- Server terminal health: repeated sanitized Sentry ingest proxy failures with read ECONNRESET; one generic aborted ECONNRESET. These did not surface as client UI errors but should be addressed for clean monitoring.
- Evidence: [console/network health](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/console-network-health.json).

## 9. Mobile/Responsive Findings
- Owner stock page and Sell by Meters wizard fit at 390x844 and controls were reachable; no sale was saved during mobile capture.
- Supervisor production screen fits at 390x844 and tablet 768x1024, but no looms are available and owner-view copy is visible.
- Mobile menu opens from bottom-right Menu; Log out row overlaps the fixed bottom nav area enough that automation needed a coordinate click. Treat as UX risk, not a confirmed functional blocker.
- Evidence: [owner mobile](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/144-mobile-02-owner-stock-sale-wizard-390x844.png), [supervisor mobile](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/148-mobile-06-supervisor-production-390x844.png), [tablet](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/149-tablet-01-supervisor-production-768x1024.png).

## 10. Security/Permission Findings
- Pass: logged-out owner/supervisor protected routes redirected to /login.
- Pass: supervisor direct owner URLs (/owner/today, /owner/commercials, /owner/billing, /owner/settings) redirected to supervisor dashboard.
- Pass: two-tab session expiry redirected the second tab to /login after logout and refresh.
- Fail: Settings initially displayed another organization’s join code and allowed a supervisor to join that non-QA org. Non-QA details were redacted in evidence.
- Fail/blocked: public tracking token missing; invalid token route redirects to login rather than a safe public invalid-token page.
- Pass: no raw DB/Postgres errors were visible in captured client UI.

## 11. UX/Domain-Fit Observations
- Factory Today still prompted “Create first estimate” after quote/order/market-run work existed; readiness checklist appears stale or incomplete.
- Supervisor dashboard copy says “Viewing as Owner” and “Switch to Owner View,” which is confusing and risky for role confidence.
- Stock UI hides taka-count controls in manual Add Stock and Sell by Meters, making sub-taka/fractional taka operations impossible through normal UI.
- Date defaults and persistence appear timezone-shifted to 02 Jun 2026 during a 03 Jun 2026 IST run.
- Worker Add form role/salary UX is confusing: salary entered as ₹18,000 persisted as ₹30,000 for Master role.

## 12. Bug List
| Bug ID | Severity | Title | Area | Reproducible | Status | Evidence |
|---|---|---|---|---|---|---|
| BUG-001 | Blocker | Onboarding machine creation reports success but owner Looms page shows no looms | Onboarding / Machines | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/039-bug-001-reproduce-onboarding-machines-missing-after-refresh.png) |
| BUG-002 | Blocker | Manual Add Loom reports success but no loom appears after refresh | Machines / Production setup | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/044-bug-002-manual-add-loom-invisible-after-refresh.png) |
| BUG-003 | Blocker | Fresh owner Settings displayed another organization's join code, causing supervisor to join non-QA factory | Security / Join code / Data isolation | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/035-settings-01-factory-settings-after-onboarding.png) [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-join-code-check-redacted.json) |
| BUG-004 | High | Supervisor dashboard shows owner-view copy | Supervisor / Role boundaries | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/051-join-07-qa-supervisor-join-result.png) |
| BUG-005 | Blocker | Manual Add Stock stores total meters as taka count and cannot create sub-taka lot | Stock / Taka math | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/090-stock-03-manual-25m-stock-dialog-filled.png) [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/091-stock-04-manual-25m-stock-lot-saved.png) |
| BUG-006 | High | Date inputs submitted as 2026-06-03 persist/display as 2026-06-02 | Dates / dispatches / commercials | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/107-dispatch-04-confirm-dispatch-filled-before-submit.png) [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) |
| BUG-007 | High | Persisted onboarding workers are not visible in Workers, Advances, or Payroll UI | Onboarding / workers / payroll | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/026-onboard-04-worker-form-parsed-two-workers.png) [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/027-onboard-05-workers-saved.png) |
| BUG-008 | High | Manual fixed worker persists in DB but UI still shows zero fixed workers; salary also persisted as role default | Workers / attendance / payroll | Yes | Open | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/129-workers-05c-fixed-worker-role-selected-before-save.png) [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/130-workers-07-fixed-worker-save-after-role-selected.png) |
| BUG-009 | High | Stock-sale dispatch generated no public tracking token; public receipt flow is unavailable | Public tracking / receipt confirmation | Yes | Open / feature unavailable | [E1](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/logs/db-stock-after-dispatch.json) [E2](/Users/rajpatel/Projects/textile Saas/output/qa/AMY_QA_20260603_0218/screenshots/109-dispatch-06-dispatched-batch-expanded.png) |

## 13. Retest Checklist
- Create a fresh owner and verify Settings join code immediately after onboarding, after refresh, and after logout/login; confirm code maps to current org only.
- Complete onboarding machines and verify /owner/machines, order assignment, supervisor production, duplicate-submit prevention, Analytics, and Payroll wages.
- Manually add a loom and verify it appears after refresh and can be assigned to the active 1,500m order and 100m market run.
- Create manual stock lot with explicit sub-taka values: 25m / 0.5 taka, then sell about 10m / 0.2 taka; verify UI/DB/ledger takas.
- Retest sale-only, dispatch-now, pending dispatch, partial dispatch, full dispatch, oversell, invalid/zero/negative quantities.
- Retest public tracking: token generation, invalid-token page, public receipt confirmation, owner status sync.
- Retest date fields in Asia/Kolkata and UTC-negative timezone: dispatch date, payment date, due date, receipt date, archive display.
- Retest Workers page queries after onboarding and manual add; verify workers appear in Advances, Attendance, Payroll, supervisor Workers, and DB.
- Retest manual fixed worker salary binding and role selection; verify entered salary persists.
- Retest mobile stock sale wizard and mobile supervisor production after looms/workers are fixed.
- Verify browser console remains 0 warnings/errors and remove/handle Sentry proxy ECONNRESET noise.
- Run lint/build and relevant automated tests before pilot signoff.

## 14. Final Verdict
**Not ready / blocked pending fixes.**

The app has a usable scripted demo path for estimator → quote → order and stock sale → owner dispatch receipt → commercials, but the current build is not ready for a controlled pilot or paid production. The blocking issues are loom setup/listing, join-code isolation, sub-taka/taka math, worker UI visibility/payroll setup, public tracking unavailability, and one-day date drift.
