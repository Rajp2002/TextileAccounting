# LITEQA-20260903-1547-DCBU Pre-Pilot Test Matrix

- Base URL: https://textile-accounting.vercel.app
- Guide: /Users/rajpatel/Projects/textile Saas/docs/PRE_PILOT_COMPREHENSIVE_TESTING_GUIDE.md
- Initialized: 2026-09-03T10:18:59.122Z
- Total items: 377
- Status: pass=21, fail=5, blocked=0, not_applicable=1, code_verified=2, not_run=348

| ID | Section | Scenario | Expected | Status | Actual | Evidence | Severity |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TECH-001 | 8. Technical and Deployment Gate | Clean install with `npm ci`. | Install succeeds from lockfile. | not_run |  |  |  |
| TECH-002 | 8. Technical and Deployment Gate | Run `npm run lint`. | Zero errors and zero warnings. | fail | ESLint completed with 0 errors but 44 warnings; the guide requires zero warnings. | npm run lint exit 0; lint output: 44 warnings | medium |
| TECH-003 | 8. Technical and Deployment Gate | Run `npx vitest run`. | All required tests pass; skipped test is explained. | pass | 197 test files passed; 1,195 tests passed and 1 skipped. The skipped case is the live Supabase integration test, disabled because RUN_LIVE_SUPABASE_TESTS is unset. | npx vitest run exit 0; 197 passed / 1,195 passed / 1 skipped |  |
| TECH-004 | 8. Technical and Deployment Gate | Run `npm run build`. | Production build succeeds without runtime/config warnings. | pass | Next.js production build completed successfully; only a stale Browserslist data warning was emitted. | npm run build exit 0; Next.js 16.2.12 build output | low |
| TECH-005 | 8. Technical and Deployment Gate | Run `npm audit --omit=dev --audit-level=high`. | No unaccepted high/critical runtime advisories. | fail | Production dependency audit exits non-zero with high-severity browserslist and fast-uri findings; ajv appears as a transitive high-severity path in the JSON report. | npm audit --omit=dev --audit-level=high exit 1; browserslist / fast-uri / transitive ajv | high |
| TECH-006 | 8. Technical and Deployment Gate | Run full `npm audit --audit-level=high`. | All high/critical advisories fixed or documented with owner, exploitability, and deadline. | fail | Full dependency audit exits non-zero with 13 high-severity findings (17 total). | npm audit --audit-level=high exit 1; 13 high / 17 total | high |
| TECH-007 | 8. Technical and Deployment Gate | Compare deployed migrations with repository migrations. | No pending, failed, or out-of-order migration. | pass | Deployed migration list and repository each contain 273 migrations; the latest head is 20260902135923 monthly_overhead_analytics_events. | Supabase migration list; supabase/migrations head |  |
| TECH-008 | 8. Technical and Deployment Gate | Verify PostgREST schema cache after RPC changes. | Current RPC signatures are callable from the app. | pass | Estimator save, rate update, and historical snapshot RPC paths were callable from the deployed app. | saved-quality creation; Rate Book update; immutable snapshot query |  |
| TECH-009 | 8. Technical and Deployment Gate | Verify required environment variables without exposing values. | Missing variables produce an intentional safe failure. | not_run |  |  |  |
| TECH-010 | 8. Technical and Deployment Gate | Verify production source maps, Sentry, and release version. | Errors are attributable to the deployed commit without leaking PII. | not_run |  |  |  |
| TECH-011 | 8. Technical and Deployment Gate | Verify backup schedule and perform restore into a disposable project. | Restored org, users, production, stock, receivables, and payroll reconcile. | not_run |  |  |  |
| TECH-012 | 8. Technical and Deployment Gate | Verify rollback procedure for application and database. | Team can restore the last known good application and has a forward-fix plan for non-reversible migrations. | not_run |  |  |  |
| TECH-013 | 8. Technical and Deployment Gate | Add/use a `test` script in release automation. | The release command is repeatable and cannot accidentally omit Vitest. | not_run |  |  |  |
| TECH-014 | 8. Technical and Deployment Gate | Record deployed commit, migration head, and test report. | Pilot build is uniquely identifiable. | pass | Run identity, production URL, deployed commit, migration head, ledger, and report are recorded. | LITEQA-20260903-1547-DCBU; commit 191b80d; results.json |  |
| AUTH-001 | 9. Authentication, Signup, and Tenant Isolation | Owner signup with valid name, email, 10-digit phone, strong password, and factory name. | Auth user, organization, owner profile, join code, and onboarding state are created once. | not_run |  |  |  |
| AUTH-002 | 9. Authentication, Signup, and Tenant Isolation | Blank/invalid signup fields, weak password, invalid phone. | Clear validation; no partial organization/profile. | not_run |  |  |  |
| AUTH-003 | 9. Authentication, Signup, and Tenant Isolation | Duplicate email and rapid double-submit. | One account; safe error; no duplicate org. | not_run |  |  |  |
| AUTH-004 | 9. Authentication, Signup, and Tenant Isolation | Login with valid/invalid credentials. | Correct role home; generic safe failure for invalid credentials. | pass | Valid Lite owner login reached /owner/estimator and session persisted across refresh. | in-app Browser login; refresh remained /owner/settings |  |
| AUTH-005 | 9. Authentication, Signup, and Tenant Isolation | Forgot-password and valid/expired/used reset links. | Only valid link changes password; old sessions behave as designed. | not_run |  |  |  |
| AUTH-006 | 9. Authentication, Signup, and Tenant Isolation | Owner with incomplete onboarding logs in. | Redirected to onboarding. | not_applicable | The generic incomplete-onboarding expectation is intentionally overridden for Lite/Base: the Lite owner is allowed into the costing workspace and is not sent through the full-suite onboarding route. | onboarding_complete=false tenant query; Lite login landed /owner/estimator |  |
| AUTH-007 | 9. Authentication, Signup, and Tenant Isolation | Supervisor joins using current valid code. | Joins the intended organization and only that organization. | not_run |  |  |  |
| AUTH-008 | 9. Authentication, Signup, and Tenant Isolation | Invalid, expired, old regenerated, lowercase, spaced, and brute-forced join codes. | Rejected or normalized as designed; rate limit works. | not_run |  |  |  |
| AUTH-009 | 9. Authentication, Signup, and Tenant Isolation | Immediately after onboarding, compare displayed join code with organization row. | Exact current-org match before and after refresh/logout/login. | not_run |  |  |  |
| AUTH-010 | 9. Authentication, Signup, and Tenant Isolation | Supervisor opens owner URLs and owner-only actions directly. | Redirect/deny without data leakage or mutation. | not_run |  |  |  |
| AUTH-011 | 9. Authentication, Signup, and Tenant Isolation | Owner opens supervisor routes. | Only intentionally allowed owner-as-supervisor behavior appears; wording is unambiguous. | not_run |  |  |  |
| AUTH-012 | 9. Authentication, Signup, and Tenant Isolation | Org A user guesses Org D record IDs. | RLS/server actions return no data and perform no mutation. | not_run |  |  |  |
| AUTH-013 | 9. Authentication, Signup, and Tenant Isolation | Logout in one tab; use second tab. | Second tab loses protected access on next request. | not_run |  |  |  |
| AUTH-014 | 9. Authentication, Signup, and Tenant Isolation | Leave session inactive for more than one hour. | Session expires and local sensitive state is not exposed. | not_run |  |  |  |
| AUTH-015 | 9. Authentication, Signup, and Tenant Isolation | Revoke user session. | Revocation is effective across tabs/devices. | not_run |  |  |  |
| AUTH-016 | 9. Authentication, Signup, and Tenant Isolation | Locked organization attempts writes. | Lockdown rule is consistently enforced where enabled. | not_run |  |  |  |
| AUTH-017 | 9. Authentication, Signup, and Tenant Isolation | Protected API call while logged out. | JSON 401, not an HTML redirect. | not_run |  |  |  |
| AUTH-018 | 9. Authentication, Signup, and Tenant Isolation | Auth rate limit behind proxy headers. | Correct client isolation; one user cannot trivially lock out all users. | not_run |  |  |  |
| AUTH-019 | 9. Authentication, Signup, and Tenant Isolation | Open archived top-level and nested routes directly. | `/admin`, `/owner/inventory`, `/owner/ledger`, `/owner/settings/audit`, `/owner/system-health`, and `/track/*` follow the documented archive behavior. | pass | Archived/deferred owner routes followed the product boundary: operational paths redirected or showed a Base upgrade wall; public unknown tracking token showed a safe link-not-found notice. | owner-route sweep; /track/LITEQA-unknown |  |
| AUTH-020 | 9. Authentication, Signup, and Tenant Isolation | Inspect owner/supervisor navigation for archived modules. | Deferred modules do not appear as active product promises, while their historical data remains intact. | pass | Lite navigation contains only Cost Estimate, Yarn Rate Book, Saved Costings, Billing, and Settings; deferred operational modules are not active navigation promises. | authenticated Lite shell; all owner route sweep |  |
| SETUP-001 | 10. Onboarding and Factory Setup | Complete market-run onboarding. | Market Runs visible; Quotes/Orders hidden; core shared modules visible. | not_run |  |  |  |
| SETUP-002 | 10. Onboarding and Factory Setup | Complete order-based onboarding. | Quotes/Orders visible; Market Runs hidden. | not_run |  |  |  |
| SETUP-003 | 10. Onboarding and Factory Setup | Complete mixed-mode onboarding. | Both production workflows visible. | not_run |  |  |  |
| SETUP-004 | 10. Onboarding and Factory Setup | Save machines during onboarding, refresh, and reopen Machines. | Every machine persists and is assignable. | not_run |  |  |  |
| SETUP-005 | 10. Onboarding and Factory Setup | Save workers during onboarding, refresh Workers/Advances/Payroll/Supervisor. | Every worker is visible in all relevant modules. | not_run |  |  |  |
| SETUP-006 | 10. Onboarding and Factory Setup | Save payroll cycle, pay date, and reminder window. | Same values appear in Settings and payroll calculations. | not_run |  |  |  |
| SETUP-007 | 10. Onboarding and Factory Setup | Fail a setup network request midway. | Step remains incomplete and retryable; no false success. | not_run |  |  |  |
| SETUP-008 | 10. Onboarding and Factory Setup | Double-click setup save. | Idempotent result; no duplicate machines/workers. | not_run |  |  |  |
| SETUP-009 | 10. Onboarding and Factory Setup | Finish onboarding with stale persisted query cache. | Dashboard reads the new org data, not another org or an empty cached result. | not_run |  |  |  |
| SETUP-010 | 10. Onboarding and Factory Setup | Change production mode after data exists. | Navigation changes without deleting or cross-linking historical data. | not_run |  |  |  |
| SETUP-011 | 10. Onboarding and Factory Setup | Factory Today setup panel after creating estimates, machines, workers, and payroll config. | Completion state is accurate and refresh-stable. | not_run |  |  |  |
| SETUP-012 | 10. Onboarding and Factory Setup | Factory name and join-code regeneration. | New value persists; old join code stops working. | not_run |  |  |  |
| MASTER-001 | 11. Machines, Workers, and Assignments | Add one loom manually and refresh. | Loom remains visible. | not_run |  |  |  |
| MASTER-002 | 11. Machines, Workers, and Assignments | Bulk-add looms with duplicate names or types. | Intended duplicate rule is enforced; no silent overwrite. | not_run |  |  |  |
| MASTER-003 | 11. Machines, Workers, and Assignments | Edit loom name/type and refresh. | Assignment and historical production links remain intact. | not_run |  |  |  |
| MASTER-004 | 11. Machines, Workers, and Assignments | Activate loom without required assignments/order. | Behavior matches the documented activation rule with a clear message. | not_run |  |  |  |
| MASTER-005 | 11. Machines, Workers, and Assignments | Deactivate/delete loom with active order or history. | Protected action; history preserved; downstream UI remains consistent. | not_run |  |  |  |
| MASTER-006 | 11. Machines, Workers, and Assignments | Assign a piece-rate worker to a loom with a decimal per-meter rate. | Assignment rate persists exactly, is snapshotted on production logs, and drives payroll without changing historical logs. | not_run |  |  |  |
| MASTER-007 | 11. Machines, Workers, and Assignments | Add fixed worker with manually entered salary after selecting role. | Entered salary is not replaced by role default. | not_run |  |  |  |
| MASTER-008 | 11. Machines, Workers, and Assignments | Add daily worker and record attendance. | Daily payroll uses attendance and never exceeds configured monthly salary. | not_run |  |  |  |
| MASTER-009 | 11. Machines, Workers, and Assignments | Deactivate worker assigned to a loom. | Loom/setup becomes visibly incomplete; old logs remain attributed. | not_run |  |  |  |
| MASTER-010 | 11. Machines, Workers, and Assignments | Assign different day and night workers. | Correct worker pre-fills for each shift. | not_run |  |  |  |
| MASTER-011 | 11. Machines, Workers, and Assignments | Substitute worker for one dated shift. | Shift-specific assignment is clear and payroll follows the actual logged worker. | not_run |  |  |  |
| MASTER-012 | 11. Machines, Workers, and Assignments | Assign order/run to loom, then replace it. | New logs use the new context; historical logs retain old context. | not_run |  |  |  |
| MASTER-013 | 11. Machines, Workers, and Assignments | Complete/cancel/delete order or close run. | Related looms unlink and become inactive as intended; unrelated looms remain unchanged. | not_run |  |  |  |
| MASTER-014 | 11. Machines, Workers, and Assignments | Two users edit same loom assignment. | Last-write/concurrency behavior is visible and does not create mixed context. | not_run |  |  |  |
| MASTER-015 | 11. Machines, Workers, and Assignments | Worker WhatsApp phone/consent changes. | Consent rows and sends reflect the latest valid state. | not_run |  |  |  |
| EST-001 | 12. Estimator and Costing | Single warp and single weft recipe. | Yarn kg, yarn cost, weave cost, processing, overhead, landed cost, and quote match truth sheet. | pass | Representative grey-fabric costing matched the manual yarn math and included the required positive loom rate. | manual example inputs; saved snapshot production cost 34.31/m |  |
| EST-002 | 12. Estimator and Costing | Multi-row blended warp and multi-row weft. | Each row contributes once; total is exact within agreed rounding. | pass | Two warp layers plus one weft layer each contributed once; layer totals and combined subtotal were exact. | Quick breakdown; Detailed audit; snapshot audit.layers |  |
| EST-003 | 12. Estimator and Costing | Decimal denier, yarn rate, GST, shortage, and crimp. | Decimal precision is preserved; no floating-point drift. | pass | GST changed the affected yarn base cost with decimal-safe rounding; 5% on warp changed the representative production cost from 27.39/m to 27.68/m. | live GST test; INR_HALF_UP_2 snapshot policy |  |
| EST-004 | 12. Estimator and Costing | Width entered in centimeters and equivalent inches. | Equivalent calculation and persisted value. | pass | 60 inches and 152.4 centimetres produced the same 27.39/m result and the UI showed the converted equivalent. | live cm/inch parity test |  |
| EST-005 | 12. Estimator and Costing | Weaving rate entered in paise/pick. | No rupee/paise 100× error. | pass | Paise-per-pick mode converted 2 paise/pick across 60 picks to a 1.20/m loom cost without a 100x unit error. | live paise-per-pick test; 60 total picks display |  |
| EST-006 | 12. Estimator and Costing | Outsourced sizing versus in-house sizing. | Sizing cost toggles exactly once. | pass | Outsourced sizing at 1.50/kg added the expected charge on 5.50kg warp consumption; switching in-house removed the direct charge and kept it within overhead treatment. | live sizing mode test; Detailed factory section |  |
| EST-007 | 12. Estimator and Costing | Optional winding, processing, finishing, commission, and transport. | Disabled sections contribute zero; enabled sections contribute correctly. | pass | Winding, processing, and finishing inputs changed production cost only when enabled; commission/transport mismatch required acknowledgement before save. | live optional-section tests; save warning modal |  |
| EST-008 | 12. Estimator and Costing | Overhead items and manual overhead override. | Override replaces, rather than double-counts, itemized overhead. | pass | Direct overhead preserved a distinct source and monthly mode reconciled 1,150,000 monthly costs over 90,000m to 12.78/m after capacity inputs were complete. | direct source/reference display; monthly capacity audit |  |
| EST-009 | 12. Estimator and Costing | Capacity utilization and idle-capacity values. | Correct for loom count, output/day, working days, and monthly output. | pass | Capacity calculation showed 24 looms × 144.23m/day × 26 days = 89,999.52m and used the rated-capacity denominator. | monthly expenses & capacity panel |  |
| EST-010 | 12. Estimator and Costing | Fixed workers added to overhead. | No duplicate fixed-worker cost after repeated merge/save. | not_run |  |  |  |
| EST-011 | 12. Estimator and Costing | Zero/negative/extreme inputs and no warp/weft rows. | Save blocked with field-specific validation. | pass | Zero weaving rate blocked readiness with a field-specific message; no false cost result or save was allowed. | live zero-rate validation |  |
| EST-012 | 12. Estimator and Costing | Commission plus margin at or above invalid boundary. | Invalid quote state; no misleading positive quote. | code_verified | The calculation engine rejects commission plus target margin at or above 100% with an explicit invalid quote message; full browser mutation was not required for this code-path check. | lib/estimator.ts:888-900; estimator validation tests |  |
| EST-013 | 12. Estimator and Costing | Save, rename, update, rate-update, apply, and delete template. | Template lifecycle is isolated to the org and refresh-stable. | pass | Saved quality creation, Rate Book update, load/reprice, favourite, archive/restore, duplicate draft, search, sort, and compare flows were exercised. Deletion was not invoked. | Saved Costings UI; Rate Book UI; Supabase run records |  |
| EST-014 | 12. Estimator and Costing | Autosaved draft after refresh/crash. | Latest intended draft restores without overwriting another quote. | code_verified | Draft recovery and collision handling are covered by the estimator client and automated tests; no destructive crash simulation was performed in production. | draft recovery code/tests |  |
| EST-015 | 12. Estimator and Costing | Restore historical quote after factory profile/template rates change. | Historical snapshot remains unchanged. | pass | Changing the current Rate Book value from 191 to 192 updated the saved recipe but left the v1 quote snapshot at 191 and production cost 34.31/m. | Rate Book history; Supabase costing_result_snapshot; save toast |  |
| EST-016 | 12. Estimator and Costing | Save Quote versus Save & Accept. | Draft remains editable; accepted quote is locked per product rule. | not_run |  |  |  |
| EST-017 | 12. Estimator and Costing | Rapid double-submit. | One quote/order/run only. | not_run |  |  |  |
| EST-018 | 12. Estimator and Costing | Market-mode party-name race. | Fabric label and market run are saved correctly without a fake party. | not_run |  |  |  |
| EST-019 | 12. Estimator and Costing | Compare cost/margin/profit on Estimator, Quote, Order, and Commercials. | Same snapshot economics are used at each stage. | fail | Saved-costing comparison economics were loaded from immutable snapshots, but the calculation-detail UI rendered a non-applicable multi-layer warp rate as 0/kg instead of Not available/Multiple. | Compare Costings modal; lib/saved-costings.ts:717-819 | high |
| QUOTE-001 | 13. Quote Lifecycle | Save draft quote. | Draft visible in history with complete snapshot. | pass | The saved Lite quality has an immutable v1 costing history record with the complete snapshot, assumptions, and INR_HALF_UP_2 rounding policy. | Saved Costings detail; Supabase estimator_quotes |  |
| QUOTE-002 | 13. Quote Lifecycle | Accept draft with confirmation. | Status locks; audit transition is correct. | not_run |  |  |  |
| QUOTE-003 | 13. Quote Lifecycle | Reject draft/accepted quote according to allowed transitions. | Only valid transition succeeds. | not_run |  |  |  |
| QUOTE-004 | 13. Quote Lifecycle | Convert non-accepted quote to order. | Blocked. | not_run |  |  |  |
| QUOTE-005 | 13. Quote Lifecycle | Convert accepted quote once. | One active order linked back to quote. | not_run |  |  |  |
| QUOTE-006 | 13. Quote Lifecycle | Concurrent/double conversion. | Unique/atomic RPC returns the same or safe duplicate result; never two orders. | not_run |  |  |  |
| QUOTE-007 | 13. Quote Lifecycle | Start Party Order fast path. | Accepted quote and order form one consistent transaction. | not_run |  |  |  |
| QUOTE-008 | 13. Quote Lifecycle | Target, deadline, and notes validation. | Positive target; valid date; intended notes persist. | not_run |  |  |  |
| QUOTE-009 | 13. Quote Lifecycle | Quote/order conversion failure after partial work. | No orphaned active order or inconsistent quote link. | not_run |  |  |  |
| QUOTE-010 | 13. Quote Lifecycle | Restore quote into estimator while another local draft exists. | Clear collision warning; user chooses intentionally. | not_run |  |  |  |
| ORDER-001 | 14. Order-Centric End-to-End Tests | Create a 1,500m order from an accepted quote. | Party, quality, target, deadline, costs, rate, and instructions copy correctly. | not_run |  |  |  |
| ORDER-002 | 14. Order-Centric End-to-End Tests | Assign one or more looms. | Supervisor sees the order and correct worker rate. | not_run |  |  |  |
| ORDER-003 | 14. Order-Centric End-to-End Tests | Log production across multiple shifts/looms. | Order progress equals the exact sum of valid positive logs. | not_run |  |  |  |
| ORDER-004 | 14. Order-Centric End-to-End Tests | Log production before order creation/start date. | Blocked. | not_run |  |  |  |
| ORDER-005 | 14. Order-Centric End-to-End Tests | Produce beyond target. | Product behavior is explicit; progress, pace, stock, and payroll remain mathematically consistent. | not_run |  |  |  |
| ORDER-006 | 14. Order-Centric End-to-End Tests | Change target/deadline after production. | Protected edit; pace updates; history/audit retained. | not_run |  |  |  |
| ORDER-007 | 14. Order-Centric End-to-End Tests | Complete with target met. | Status changes, looms unlink, history and reserved stock remain correct. | not_run |  |  |  |
| ORDER-008 | 14. Order-Centric End-to-End Tests | Complete below target. | Confirmation warns about remaining quantity and pending dispatch. | not_run |  |  |  |
| ORDER-009 | 14. Order-Centric End-to-End Tests | Cancel after some production. | Produced stock/history retained; no new logs accepted; loom unlinks. | not_run |  |  |  |
| ORDER-010 | 14. Order-Centric End-to-End Tests | Attempt delete with production/dispatch/payment history. | Safe restriction or documented archival behavior; no orphan records. | not_run |  |  |  |
| ORDER-011 | 14. Order-Centric End-to-End Tests | Order stock appears as reserved, not freely saleable market stock. | Correct stock classification. | not_run |  |  |  |
| ORDER-012 | 14. Order-Centric End-to-End Tests | Sell/dispatch order-linked stock. | Party/order/source links remain available in dispatch and Commercials. | not_run |  |  |  |
| ORDER-013 | 14. Order-Centric End-to-End Tests | Partial dispatch against order. | Remaining order sale/dispatch quantity remains actionable. | not_run |  |  |  |
| ORDER-014 | 14. Order-Centric End-to-End Tests | Receipt shortage/excess. | Dispatch and discrepancy update without rewriting original production. | not_run |  |  |  |
| ORDER-015 | 14. Order-Centric End-to-End Tests | Close money and payroll. | Collection and worker settlement reconcile independently to the same production. | not_run |  |  |  |
| MARKET-001 | 15. Market-Centric End-to-End Tests | Create 1,000m market run from estimator. | Run, costing snapshot, and backing production anchor are linked. | not_run |  |  |  |
| MARKET-002 | 15. Market-Centric End-to-End Tests | Assign loom to market run. | Backing order is created/reactivated as intended and supervisor sees one clear run. | not_run |  |  |  |
| MARKET-003 | 15. Market-Centric End-to-End Tests | Log production. | Produced meters and expected godown meters update once. | not_run |  |  |  |
| MARKET-004 | 15. Market-Centric End-to-End Tests | Multiple shifts update same run. | Summary equals production logs; no duplicate expected stock. | not_run |  |  |  |
| MARKET-005 | 15. Market-Centric End-to-End Tests | Sell market stock to a new party. | No fake party order; party, sale, receivable, stock decrement, and pending dispatch are created. | not_run |  |  |  |
| MARKET-006 | 15. Market-Centric End-to-End Tests | Sell to an existing saved party. | Existing `party_id` is used and defaults prefill. | not_run |  |  |  |
| MARKET-007 | 15. Market-Centric End-to-End Tests | Sell portions to multiple parties. | Stock, revenue, receivables, and party insights are separated correctly. | not_run |  |  |  |
| MARKET-008 | 15. Market-Centric End-to-End Tests | Close run with unsold stock. | Unsold stock remains visible/saleable according to agreed business rule. | not_run |  |  |  |
| MARKET-009 | 15. Market-Centric End-to-End Tests | Close sold-out run with pending dispatch. | Lot leaves active stock if intended; pending dispatch remains visible in Dispatches/Commercials. | not_run |  |  |  |
| MARKET-010 | 15. Market-Centric End-to-End Tests | Sell out and receive all batches. | Run displays sold-out/closed correctly and archive is complete. | not_run |  |  |  |
| MARKET-011 | 15. Market-Centric End-to-End Tests | Direct/legacy market-run sale action, if reachable. | Must create the same named receivable or be disabled. | not_run |  |  |  |
| MARKET-012 | 15. Market-Centric End-to-End Tests | Reopen/reactivate closed run, if allowed. | No duplicate backing order or stock. | not_run |  |  |  |
| MARKET-013 | 15. Market-Centric End-to-End Tests | Market-run summary with many runs/sales. | Acceptable load time and fresh values after mutation. | not_run |  |  |  |
| PROD-001 | 16. Supervisor Production Logging | Current date and current shift defaults. | Correct Asia/Kolkata date and intended shift. | not_run |  |  |  |
| PROD-002 | 16. Supervisor Production Logging | Day-only factory with no night worker. | Must match the pilot’s operating decision; if valid production is blocked, pilot is No-Go unless night assignment is genuinely mandatory. | not_run |  |  |  |
| PROD-003 | 16. Supervisor Production Logging | Night shift closed temporarily. | Day production remains loggable. | not_run |  |  |  |
| PROD-004 | 16. Supervisor Production Logging | Substitute worker. | Supervisor can intentionally select/log the actual worker or receives a workable owner-remapping flow. | not_run |  |  |  |
| PROD-005 | 16. Supervisor Production Logging | Loom missing active order/run. | Clear blocked or review-queue behavior; entered draft is not silently lost. | not_run |  |  |  |
| PROD-006 | 16. Supervisor Production Logging | Loom missing worker. | Clear blocked or review-queue behavior. | not_run |  |  |  |
| PROD-007 | 16. Supervisor Production Logging | Worker rate missing/zero. | Positive meters blocked; no fallback ₹1.50 rate. | not_run |  |  |  |
| PROD-008 | 16. Supervisor Production Logging | Valid positive meters. | One production log with correct worker, work anchor, rate snapshot, date, shift, and submitted time. | not_run |  |  |  |
| PROD-009 | 16. Supervisor Production Logging | Zero meters with each canonical downtime reason. | Status log saved without wage/stock quantity. | not_run |  |  |  |
| PROD-010 | 16. Supervisor Production Logging | Zero meters with “Other” and no note. | Blocked. | not_run |  |  |  |
| PROD-011 | 16. Supervisor Production Logging | Negative meters. | Blocked on client and server. | not_run |  |  |  |
| PROD-012 | 16. Supervisor Production Logging | Decimal meters. | Stored and summed correctly. | not_run |  |  |  |
| PROD-013 | 16. Supervisor Production Logging | Very large but plausible meters. | Suspicious-value behavior is explicit. | not_run |  |  |  |
| PROD-014 | 16. Supervisor Production Logging | Copy previous shift. | Correct source shift, no duplicate, editable before submit. | not_run |  |  |  |
| PROD-015 | 16. Supervisor Production Logging | Double-click submit or retry after timeout. | One authoritative log per machine/date/shift. | not_run |  |  |  |
| PROD-016 | 16. Supervisor Production Logging | Correct within 30-minute window. | Replacement is atomic; totals update; audit retained. | not_run |  |  |  |
| PROD-017 | 16. Supervisor Production Logging | Correct after window without code. | Blocked. | not_run |  |  |  |
| PROD-018 | 16. Supervisor Production Logging | Correct after window with valid/invalid/used/expired code. | Only valid one-time code succeeds. | not_run |  |  |  |
| PROD-019 | 16. Supervisor Production Logging | Correct period after worker payroll is settled. | Blocked. | not_run |  |  |  |
| PROD-020 | 16. Supervisor Production Logging | Past-date production before order start. | Blocked. | not_run |  |  |  |
| PROD-021 | 16. Supervisor Production Logging | Future-date production. | Blocked or unavailable. | not_run |  |  |  |
| PROD-022 | 16. Supervisor Production Logging | Change date/shift while draft exists. | Draft stored under correct date/shift and never submitted to another shift. | not_run |  |  |  |
| PROD-023 | 16. Supervisor Production Logging | Refresh/browser crash with draft. | Draft restores, clearly marked unsaved. | not_run |  |  |  |
| PROD-024 | 16. Supervisor Production Logging | Network drops before submit. | No success claim; draft remains locally. | not_run |  |  |  |
| PROD-025 | 16. Supervisor Production Logging | Network drops after request reaches server but before response. | Retry is idempotent and resolves current server state. | not_run |  |  |  |
| PROD-026 | 16. Supervisor Production Logging | Two supervisors submit same shift. | Atomic duplicate protection. | not_run |  |  |  |
| PROD-027 | 16. Supervisor Production Logging | Machine status running/idle/maintenance and breakdown notes. | Status persists independently and aligns with downtime entry. | not_run |  |  |  |
| PROD-028 | 16. Supervisor Production Logging | Verify order progress, market run, expected stock, analytics, Today, and payroll after submit. | Every downstream total changes once. | not_run |  |  |  |
| PROD-029 | 16. Supervisor Production Logging | Compare visible “shift meters” terminology with stored synthetic readings. | No user-facing claim of real opening/closing counter proof. | not_run |  |  |  |
| PROD-030 | 16. Supervisor Production Logging | Mobile usability with 20+ looms. | Fast selection, readable cards, no accidental cross-row edits, submit reachable. | not_run |  |  |  |
| STOCK-001 | 17. Stock and Godown | Market production creates expected stock context. | Production appears once with correct source and cost. | not_run |  |  |  |
| STOCK-002 | 17. Stock and Godown | Create manual lot using total meters and meters/taka. | Taka count equals meters divided by meters/taka. | not_run |  |  |  |
| STOCK-003 | 17. Stock and Godown | Create 25m lot at 50m/taka. | Stores 25m and 0.5 taka, not 25 takas. | not_run |  |  |  |
| STOCK-004 | 17. Stock and Godown | Create opening, manual, market-run, order, and adjustment sources. | Source IDs match declared type and current org. | not_run |  |  |  |
| STOCK-005 | 17. Stock and Godown | Submit mismatched quote/order or another org’s source. | Blocked. | not_run |  |  |  |
| STOCK-006 | 17. Stock and Godown | Fractional meters and taka. | Precision consistent through lot, sale, dispatch, and movement. | not_run |  |  |  |
| STOCK-007 | 17. Stock and Godown | Adjust stock up/down with reason. | Movement ledger records signed quantities and actor. | not_run |  |  |  |
| STOCK-008 | 17. Stock and Godown | Subtract more than available. | Blocked atomically. | not_run |  |  |  |
| STOCK-009 | 17. Stock and Godown | Concurrent sale/adjustment against same lot. | Row locking prevents negative or double-used stock. | not_run |  |  |  |
| STOCK-010 | 17. Stock and Godown | Sample cutting, damage, measurement correction, return. | Reason is traceable; chosen stock effect is correct. | not_run |  |  |  |
| STOCK-011 | 17. Stock and Godown | Order lot while order active/completed/cancelled. | Reserved/actionable/archive behavior matches policy. | not_run |  |  |  |
| STOCK-012 | 17. Stock and Godown | Closed/sold-out market lot with zero available. | Moves to archive/history as intended. | not_run |  |  |  |
| STOCK-013 | 17. Stock and Godown | Sold-out lot with pending dispatch. | Pending quantity remains in Dispatches/Commercials even if lot is not in Active Stock. | not_run |  |  |  |
| STOCK-014 | 17. Stock and Godown | Unresolved discrepancy. | Lot or discrepancy remains actionable until reviewed. | not_run |  |  |  |
| STOCK-015 | 17. Stock and Godown | Summary totals. | Available meters, taka approximation, cost value, pending dispatch, revenue, and profit reconcile. | not_run |  |  |  |
| STOCK-016 | 17. Stock and Godown | Movement history pagination/limits with more than 500 rows. | Product behavior is explicit and older movements remain retrievable. | not_run |  |  |  |
| STOCK-017 | 17. Stock and Godown | Refresh and second user. | No stale stock after mutation. | not_run |  |  |  |
| SALE-001 | 18. Party-First Sale | New party with unique name. | Party, sale, receivable, and `party_id` created. | not_run |  |  |  |
| SALE-002 | 18. Party-First Sale | Existing party selected. | Existing identity used; no duplicate party. | not_run |  |  |  |
| SALE-003 | 18. Party-First Sale | Unique exact-name auto-link. | Correct party selected. | not_run |  |  |  |
| SALE-004 | 18. Party-First Sale | Two saved parties with same normalized name and no identifier. | Ambiguity blocks sale and asks for selection or phone/GSTIN. | not_run |  |  |  |
| SALE-005 | 18. Party-First Sale | Same name with distinguishing phone or GSTIN. | Correct/new party intentionally resolved. | not_run |  |  |  |
| SALE-006 | 18. Party-First Sale | Zero/negative meters or rate. | Blocked. | not_run |  |  |  |
| SALE-007 | 18. Party-First Sale | Oversell. | Blocked atomically. | not_run |  |  |  |
| SALE-008 | 18. Party-First Sale | Fractional sale below one taka. | Allowed and mathematically correct. | not_run |  |  |  |
| SALE-009 | 18. Party-First Sale | Sale-only. | Stock reduces; pending dispatch equals sold meters; receivable exists. | not_run |  |  |  |
| SALE-010 | 18. Party-First Sale | Sell and dispatch now. | Sale and dispatch are consistent; no double dispatch. | not_run |  |  |  |
| SALE-011 | 18. Party-First Sale | Credit days zero and positive. | Due date starts from first dispatch date per active product rule. | not_run |  |  |  |
| SALE-012 | 18. Party-First Sale | Sale recorded today, first dispatch later. | Receivable due date is deferred/rebased correctly. | not_run |  |  |  |
| SALE-013 | 18. Party-First Sale | Same stock split across parties/rates. | Cost basis and profit calculated per sale. | not_run |  |  |  |
| SALE-014 | 18. Party-First Sale | Injected dispatch-stage failure during Sell & Dispatch. | Atomic transaction rolls back sale, dispatch, receivable, and stock changes; operator message explicitly says nothing was saved. | not_run |  |  |  |
| SALE-015 | 18. Party-First Sale | Rapid duplicate submit. | One sale and one receivable. | not_run |  |  |  |
| SALE-016 | 18. Party-First Sale | Broker/commission, claim, or rate-difference information. | If unsupported, UI/docs do not imply it is included in net realization. | not_run |  |  |  |
| DISP-001 | 19. Dispatch, Receipt, and Difference Reconciliation | Dispatch all pending meters. | Pending becomes zero; batch is active/in transit. | not_run |  |  |  |
| DISP-002 | 19. Dispatch, Receipt, and Difference Reconciliation | Partial dispatch. | Only dispatched quantity leaves pending; no discrepancy is created. | not_run |  |  |  |
| DISP-003 | 19. Dispatch, Receipt, and Difference Reconciliation | Multiple batches for one sale. | Grouped under one sale; totals reconcile. | not_run |  |  |  |
| DISP-004 | 19. Dispatch, Receipt, and Difference Reconciliation | Dispatch more than pending. | Blocked atomically. | not_run |  |  |  |
| DISP-005 | 19. Dispatch, Receipt, and Difference Reconciliation | Challan, vehicle, transporter, notes, and date. | Persist exactly; vehicle normalization is intentional. | not_run |  |  |  |
| DISP-006 | 19. Dispatch, Receipt, and Difference Reconciliation | First dispatch starts credit clock. | Due date equals first dispatch date plus credit days. | not_run |  |  |  |
| DISP-007 | 19. Dispatch, Receipt, and Difference Reconciliation | Exact received meters. | Delivered/received status; no discrepancy. | not_run |  |  |  |
| DISP-008 | 19. Dispatch, Receipt, and Difference Reconciliation | Received less than sent. | Shortage discrepancy with correct signed difference and review status. | not_run |  |  |  |
| DISP-009 | 19. Dispatch, Receipt, and Difference Reconciliation | Received more than sent. | Excess discrepancy with correct signed difference and review status. | not_run |  |  |  |
| DISP-010 | 19. Dispatch, Receipt, and Difference Reconciliation | Zero/negative received meters. | Blocked. | not_run |  |  |  |
| DISP-011 | 19. Dispatch, Receipt, and Difference Reconciliation | Receipt recorded twice. | Idempotent or blocked; no duplicate discrepancy. | not_run |  |  |  |
| DISP-012 | 19. Dispatch, Receipt, and Difference Reconciliation | Receipt for one of several batches. | Only that batch closes; remaining batches stay actionable. | not_run |  |  |  |
| DISP-013 | 19. Dispatch, Receipt, and Difference Reconciliation | Delivered group with all quantities complete. | Moves to archive. | not_run |  |  |  |
| DISP-014 | 19. Dispatch, Receipt, and Difference Reconciliation | Pending, unconfirmed, disputed, discrepancy, or e-way gap. | Stays active. | not_run |  |  |  |
| DISP-015 | 19. Dispatch, Receipt, and Difference Reconciliation | Public tracking route. | Redirects to archived/404 behavior consistently; no promise of party confirmation. | not_run |  |  |  |
| DISP-016 | 19. Dispatch, Receipt, and Difference Reconciliation | Date-only values in India and a UTC-negative browser timezone. | Persist/display the selected calendar date unchanged. | not_run |  |  |  |
| DISP-017 | 19. Dispatch, Receipt, and Difference Reconciliation | Consignment above/below relevant e-way threshold and non-supply movement. | App behaves as a reminder/checklist only unless all required compliance data is collected. | not_run |  |  |  |
| DISP-018 | 19. Dispatch, Receipt, and Difference Reconciliation | Missing challan/e-way/transporter data. | Clear warning without falsely claiming compliance completion. | not_run |  |  |  |
| DISP-019 | 19. Dispatch, Receipt, and Difference Reconciliation | Stock, dispatch, receipt, archive, and Commercials refresh. | One coherent state across all modules. | not_run |  |  |  |
| COMM-001 | 20. Commercials, Receivables, and Collections | Stock sale creates receivable. | Named party, source, total, credit days, dispatch status, and balance are correct. | not_run |  |  |  |
| COMM-002 | 20. Commercials, Receivables, and Collections | Direct market-run sale path, if reachable. | Creates equivalent receivable or is disabled. | not_run |  |  |  |
| COMM-003 | 20. Commercials, Receivables, and Collections | Realized versus expected entries. | No double counting between quote, order, market run, stock sale, and invoice-like records. | not_run |  |  |  |
| COMM-004 | 20. Commercials, Receivables, and Collections | Revenue, cost, gross profit, and margin. | Match truth sheet and sale snapshot. | not_run |  |  |  |
| COMM-005 | 20. Commercials, Receivables, and Collections | Full payment. | Receipt created; balance zero; status paid. | not_run |  |  |  |
| COMM-006 | 20. Commercials, Receivables, and Collections | Partial payment. | Balance and status partial; history complete. | not_run |  |  |  |
| COMM-007 | 20. Commercials, Receivables, and Collections | Multiple partial payments. | Sum receipts equals received amount; no floating-point drift. | not_run |  |  |  |
| COMM-008 | 20. Commercials, Receivables, and Collections | Payment above balance, zero, or negative. | Blocked unless intentional overpayment support exists. | not_run |  |  |  |
| COMM-009 | 20. Commercials, Receivables, and Collections | Payment mode cash/bank/UPI/cheque/other. | DB enum and UI label normalize correctly. | not_run |  |  |  |
| COMM-010 | 20. Commercials, Receivables, and Collections | Cheque details and references. | Required fields and history display are correct. | not_run |  |  |  |
| COMM-011 | 20. Commercials, Receivables, and Collections | Payment date across timezones. | Calendar date remains unchanged. | not_run |  |  |  |
| COMM-012 | 20. Commercials, Receivables, and Collections | Due today, overdue buckets, and future due. | Correct Asia/Kolkata classification. | not_run |  |  |  |
| COMM-013 | 20. Commercials, Receivables, and Collections | Collected-this-month boundary at month start/end. | Correct India calendar month. | not_run |  |  |  |
| COMM-014 | 20. Commercials, Receivables, and Collections | Top Parties periods 7d/30d/year/all. | Revenue, profit, meters, dues, overdue, and last sale are correct. | not_run |  |  |  |
| COMM-015 | 20. Commercials, Receivables, and Collections | Duplicate names with different `party_id`. | Separate party rows; legacy name fallback only where ID is absent. | not_run |  |  |  |
| COMM-016 | 20. Commercials, Receivables, and Collections | Search and source/status filters. | Results and summary totals use the same filtered dataset or clearly state otherwise. | not_run |  |  |  |
| COMM-017 | 20. Commercials, Receivables, and Collections | Refresh/caching after payment. | Cards, row, history, and party insight update immediately. | not_run |  |  |  |
| COMM-018 | 20. Commercials, Receivables, and Collections | Claim, shortage deduction, discount, rate difference, broker commission. | Unsupported effects are not silently included. Record as product gap if factory needs them. | not_run |  |  |  |
| PAY-001 | 21. Payroll, Advances, Attendance, and Worker Money | Piece-rate gross across looms/rates. | Sum of each production log’s meters × rate snapshot. | not_run |  |  |  |
| PAY-002 | 21. Payroll, Advances, Attendance, and Worker Money | Change worker/current loom rate after old production. | Historical payroll keeps old snapshot. | not_run |  |  |  |
| PAY-003 | 21. Payroll, Advances, Attendance, and Worker Money | Zero-meter downtime log. | No wage created. | not_run |  |  |  |
| PAY-004 | 21. Payroll, Advances, Attendance, and Worker Money | Salaried fixed worker. | Configured salary used. | not_run |  |  |  |
| PAY-005 | 21. Payroll, Advances, Attendance, and Worker Money | Daily fixed worker with attendance. | Present days × daily rate, capped as intended. | not_run |  |  |  |
| PAY-006 | 21. Payroll, Advances, Attendance, and Worker Money | Past/future attendance. | Future blocked; protected past edit uses valid access code. | not_run |  |  |  |
| PAY-007 | 21. Payroll, Advances, Attendance, and Worker Money | Advance creation for meter/fixed worker. | Pending debt visible in Advances and Payroll. | not_run |  |  |  |
| PAY-008 | 21. Payroll, Advances, Attendance, and Worker Money | Multiple advances and fractional amounts. | Sum exact. | not_run |  |  |  |
| PAY-009 | 21. Payroll, Advances, Attendance, and Worker Money | Delete pending advance. | Allowed with correct audit expectation. | not_run |  |  |  |
| PAY-010 | 21. Payroll, Advances, Attendance, and Worker Money | Delete deducted advance. | Blocked. | not_run |  |  |  |
| PAY-011 | 21. Payroll, Advances, Attendance, and Worker Money | Standard recovery cap. | Total deductions do not exceed configured/legal cap; remaining debt carries forward. | not_run |  |  |  |
| PAY-012 | 21. Payroll, Advances, Attendance, and Worker Money | Final settlement. | Full allowed recovery and remaining debt behavior are explicit. | not_run |  |  |  |
| PAY-013 | 21. Payroll, Advances, Attendance, and Worker Money | PF/ESI enrolled and not enrolled. | Deductions apply only to intended workers using reviewed formulas. | not_run |  |  |  |
| PAY-014 | 21. Payroll, Advances, Attendance, and Worker Money | Inam and kapaat adjustments. | Itemized; note/reason required; final payout never negative. | not_run |  |  |  |
| PAY-015 | 21. Payroll, Advances, Attendance, and Worker Money | Preview versus settlement. | Persisted gross, each deduction, adjustment, debt, and net equal preview. | not_run |  |  |  |
| PAY-016 | 21. Payroll, Advances, Attendance, and Worker Money | Settle before payroll window. | Normal settlement blocked; final settlement behavior remains intentional. | not_run |  |  |  |
| PAY-017 | 21. Payroll, Advances, Attendance, and Worker Money | Settle in reminder window/on pay date/overdue. | Allowed with correct status. | not_run |  |  |  |
| PAY-018 | 21. Payroll, Advances, Attendance, and Worker Money | Payment mode and owner verification missing. | Settlement blocked. | not_run |  |  |  |
| PAY-019 | 21. Payroll, Advances, Attendance, and Worker Money | Double-settle/concurrent settle. | One settlement; advances deducted once. | not_run |  |  |  |
| PAY-020 | 21. Payroll, Advances, Attendance, and Worker Money | Unsettle without/with invalid/valid used code. | Only valid one-time code reverts settlement. | not_run |  |  |  |
| PAY-021 | 21. Payroll, Advances, Attendance, and Worker Money | Unsettle restores advances and state. | Exact prior debt and status restored. | not_run |  |  |  |
| PAY-022 | 21. Payroll, Advances, Attendance, and Worker Money | Correct production after settlement. | Blocked. | not_run |  |  |  |
| PAY-023 | 21. Payroll, Advances, Attendance, and Worker Money | Payslip PDF. | Name, cycle, earning lines, adjustments, deductions, net, and debt are correct. | not_run |  |  |  |
| PAY-024 | 21. Payroll, Advances, Attendance, and Worker Money | Past settlement history and CSV. | Search/filter, line reconstruction, totals, and filename are correct. | not_run |  |  |  |
| PAY-025 | 21. Payroll, Advances, Attendance, and Worker Money | Month/cycle boundaries including February and leap year. | Correct cycle start/end/pay date. | not_run |  |  |  |
| PAY-026 | 21. Payroll, Advances, Attendance, and Worker Money | Worker exits mid-cycle. | Final settlement and deactivation preserve history. | not_run |  |  |  |
| PAY-027 | 21. Payroll, Advances, Attendance, and Worker Money | Supervisor Kharchi online. | Float decreases and worker advance increases in one coherent operation. | not_run |  |  |  |
| PAY-028 | 21. Payroll, Advances, Attendance, and Worker Money | Supervisor Kharchi offline and reconnect. | Do not approve until proven to sync into real tables exactly once. | not_run |  |  |  |
| DASH-001 | 22. Factory Today and Analytics | Empty factory. | Helpful setup state; no false production/money. | not_run |  |  |  |
| DASH-002 | 22. Factory Today and Analytics | After onboarding data. | Setup completion accurate. | not_run |  |  |  |
| DASH-003 | 22. Factory Today and Analytics | After shift production. | Today meters, production status, work risk, order/run progress, and payroll signals update once. | not_run |  |  |  |
| DASH-004 | 22. Factory Today and Analytics | Historical date selection. | Shows selected date without mixing today’s values. | not_run |  |  |  |
| DASH-005 | 22. Factory Today and Analytics | Realtime insert. | Owner sees update without duplicate totals. | not_run |  |  |  |
| DASH-006 | 22. Factory Today and Analytics | Realtime disconnect/reconnect. | Status visible; refetch recovers truth. | not_run |  |  |  |
| DASH-007 | 22. Factory Today and Analytics | Sold-not-dispatched and pending receipts. | Counts and links match Dispatches. | not_run |  |  |  |
| DASH-008 | 22. Factory Today and Analytics | Work-at-risk and pace. | Correct deadline/remaining meter logic. | not_run |  |  |  |
| DASH-009 | 22. Factory Today and Analytics | Completed/closed work. | Leaves active risk cards. | not_run |  |  |  |
| DASH-010 | 22. Factory Today and Analytics | Large data range. | Acceptable load time and no client freeze. | not_run |  |  |  |
| DASH-011 | 22. Factory Today and Analytics | Yield alert. | Verify no yield alert placeholder or misleading feature is visible since it is removed. | not_run |  |  |  |
| WA-001 | 23. WhatsApp | Opted-in worker receives simulated advance receipt. | Business write succeeds; delivery log says simulated/sent. | not_run |  |  |  |
| WA-002 | 23. WhatsApp | Opted-out worker. | Message skipped and logged; business write succeeds. | not_run |  |  |  |
| WA-003 | 23. WhatsApp | Missing consent or phone. | Message skipped with correct reason. | not_run |  |  |  |
| WA-004 | 23. WhatsApp | Provider timeout/failure. | Core advance/payroll/access-code write is not rolled back. | not_run |  |  |  |
| WA-005 | 23. WhatsApp | Payslip summary and itemized follow-up. | Correct worker/settlement, no PII leak to wrong number. | not_run |  |  |  |
| WA-006 | 23. WhatsApp | Access code message. | Only intended opted-in owner/supervisor receives it. | not_run |  |  |  |
| WA-007 | 23. WhatsApp | Deadline/daily/monthly cooldown. | No duplicate spam. | not_run |  |  |  |
| WA-008 | 23. WhatsApp | Webhook valid/invalid signature and status callback. | Only valid callback updates intended delivery row. | not_run |  |  |  |
| WA-009 | 23. WhatsApp | Retry failed message. | Maximum retry and 24-hour rules enforced. | not_run |  |  |  |
| WA-010 | 23. WhatsApp | Live template rejection or expired token. | Clear operational log and manual fallback. | not_run |  |  |  |
| BILL-001 | 24. Billing, Trial, and Referrals | Trial start once. | Correct expiry and no duplicate trial. | not_run |  |  |  |
| BILL-002 | 24. Billing, Trial, and Referrals | Base versus Premium access gates. | Correct modules gated; Billing itself remains reachable. | not_run |  |  |  |
| BILL-003 | 24. Billing, Trial, and Referrals | Successful Razorpay checkout/webhook. | Subscription/payment recorded once. | not_run |  |  |  |
| BILL-004 | 24. Billing, Trial, and Referrals | Duplicate/replayed webhook. | Idempotent. | not_run |  |  |  |
| BILL-005 | 24. Billing, Trial, and Referrals | Invalid webhook signature. | Rejected without state change. | not_run |  |  |  |
| BILL-006 | 24. Billing, Trial, and Referrals | Payment failure, cancel, auto-renew toggle. | Accurate subscription state and access. | not_run |  |  |  |
| BILL-007 | 24. Billing, Trial, and Referrals | Webhook arrives out of order. | Final state is correct. | not_run |  |  |  |
| BILL-008 | 24. Billing, Trial, and Referrals | Referral code create/apply. | One valid relationship; no self-referral/duplicate use. | not_run |  |  |  |
| BILL-009 | 24. Billing, Trial, and Referrals | Referral conversion/refund replay. | Idempotent. | not_run |  |  |  |
| BILL-010 | 24. Billing, Trial, and Referrals | Subscription expires during active session. | Access changes safely without data loss. | not_run |  |  |  |
| OFF-001 | 25. Offline, PWA, Cache, and Network Resilience | Install PWA and reopen. | Correct icon, scope, start route, and update behavior. | not_run |  |  |  |
| OFF-002 | 25. Offline, PWA, Cache, and Network Resilience | Open cached app offline. | Offline page or safe cached read appears; no false live state. | not_run |  |  |  |
| OFF-003 | 25. Offline, PWA, Cache, and Network Resilience | Production draft while online, then offline. | Draft remains local and clearly unsent. | not_run |  |  |  |
| OFF-004 | 25. Offline, PWA, Cache, and Network Resilience | Submit production offline. | Must not claim success; no duplicate on reconnect. | not_run |  |  |  |
| OFF-005 | 25. Offline, PWA, Cache, and Network Resilience | Cached owner data after switching organizations/accounts on same device. | No prior-org data appears. | not_run |  |  |  |
| OFF-006 | 25. Offline, PWA, Cache, and Network Resilience | Logout with persisted query/local storage. | Sensitive cached data is cleared or inaccessible. | not_run |  |  |  |
| OFF-007 | 25. Offline, PWA, Cache, and Network Resilience | Service worker update during active draft. | Draft not lost; user receives safe refresh behavior. | not_run |  |  |  |
| OFF-008 | 25. Offline, PWA, Cache, and Network Resilience | Kharchi offline. | Expected to fail current review unless fixed; verify real table reconciliation. | not_run |  |  |  |
| OFF-009 | 25. Offline, PWA, Cache, and Network Resilience | Mutation request timeout. | UI distinguishes unknown outcome from definite failure. | not_run |  |  |  |
| OFF-010 | 25. Offline, PWA, Cache, and Network Resilience | Slow 2G/3G and intermittent connection. | Core mobile screens remain usable and prevent repeated submissions. | not_run |  |  |  |
| TIME-001 | 26. Timezone, Date, and Localization | Test near 00:00 Asia/Kolkata. | Today, shift, production, payments, and dashboards use factory date. | not_run |  |  |  |
| TIME-002 | 26. Timezone, Date, and Localization | Browser in UTC, US Pacific, and India. | Date-only fields persist unchanged. | not_run |  |  |  |
| TIME-003 | 26. Timezone, Date, and Localization | Month-end/year-end. | Commercial collection and payroll cycles classify correctly. | not_run |  |  |  |
| TIME-004 | 26. Timezone, Date, and Localization | Leap day. | Valid date and cycle behavior. | not_run |  |  |  |
| TIME-005 | 26. Timezone, Date, and Localization | Hindi/Gujarati/English switch. | Domain terms remain understandable; values and IDs unchanged. | not_run |  |  |  |
| TIME-006 | 26. Timezone, Date, and Localization | Refresh and new session. | Language preference persists as intended. | not_run |  |  |  |
| TIME-007 | 26. Timezone, Date, and Localization | Mixed translated/untranslated validation. | Critical errors remain actionable. | not_run |  |  |  |
| TIME-008 | 26. Timezone, Date, and Localization | Currency, decimals, meters, taka, dates. | Indian formatting without altering stored value. | not_run |  |  |  |
| SEC-001 | 27. Security, Privacy, and Audit | Query tenant tables as anonymous user. | No sensitive data. | not_run |  |  |  |
| SEC-002 | 27. Security, Privacy, and Audit | Review production DB grants. | No broad `anon` table/sequence grants. | not_run |  |  |  |
| SEC-003 | 27. Security, Privacy, and Audit | Verify RLS enabled on all public base tables. | Enabled with intended policies. | not_run |  |  |  |
| SEC-004 | 27. Security, Privacy, and Audit | Manipulate org ID/record ID in requests. | Server derives org from authenticated profile and rejects cross-org access. | not_run |  |  |  |
| SEC-005 | 27. Security, Privacy, and Audit | Supervisor invokes owner server action. | Rejected server-side. | not_run |  |  |  |
| SEC-006 | 27. Security, Privacy, and Audit | Access-code format, expiry, one-time use, brute force, lockout. | All enforced. | not_run |  |  |  |
| SEC-007 | 27. Security, Privacy, and Audit | Razorpay webhook HMAC and idempotency. | Invalid/replay safe. | not_run |  |  |  |
| SEC-008 | 27. Security, Privacy, and Audit | Tracking token code despite archived UI. | No active public data leak. | not_run |  |  |  |
| SEC-009 | 27. Security, Privacy, and Audit | Data export. | Only current org; export event audited; sensitive fields reviewed. | not_run |  |  |  |
| SEC-010 | 27. Security, Privacy, and Audit | Worker erasure/anonymization. | Intended PII removed while payroll/audit integrity remains. | not_run |  |  |  |
| SEC-011 | 27. Security, Privacy, and Audit | Secrets in client bundle, logs, repository, Sentry. | None exposed. | not_run |  |  |  |
| SEC-012 | 27. Security, Privacy, and Audit | Stored XSS in party, notes, quality, worker, challan, and template fields. | Rendered safely. | not_run |  |  |  |
| SEC-013 | 27. Security, Privacy, and Audit | CSRF/session/cookie behavior. | Protected actions require valid same-user session. | not_run |  |  |  |
| SEC-014 | 27. Security, Privacy, and Audit | File/PDF generation with malicious text. | Safe content and filenames. | not_run |  |  |  |
| SEC-015 | 27. Security, Privacy, and Audit | Audit protected corrections, settlement reversal, deletion, write-off, and settings. | Actor, org, action, record, before/after context, and timestamp are adequate. | not_run |  |  |  |
| SEC-016 | 27. Security, Privacy, and Audit | Privacy policy behavior versus actual offline storage and cookies. | Accurate, consistent, and reviewed. | not_run |  |  |  |
| SEC-017 | 27. Security, Privacy, and Audit | Worker age/consent flow. | Product does not accept unsupported claims as legal proof. | not_run |  |  |  |
| SEC-018 | 27. Security, Privacy, and Audit | DPDP, breach, grievance, and retention wording. | Reviewed against current law by qualified counsel before public reliance. | not_run |  |  |  |
| UX-001 | 28. UX, Accessibility, and Operational Fit | Supervisor logs 20 looms on a phone. | No excessive scrolling/error-prone row confusion. | not_run |  |  |  |
| UX-002 | 28. UX, Accessibility, and Operational Fit | Buttons during submission. | Disabled/progress state prevents double action. | not_run |  |  |  |
| UX-003 | 28. UX, Accessibility, and Operational Fit | Error recovery. | Entered values remain after validation/server error. | not_run |  |  |  |
| UX-004 | 28. UX, Accessibility, and Operational Fit | Mobile navigation and logout. | Controls do not overlap bottom navigation. | not_run |  |  |  |
| UX-005 | 28. UX, Accessibility, and Operational Fit | Dialogs and sheets. | Keyboard focus, labels, description, Escape/close behavior work. | not_run |  |  |  |
| UX-006 | 28. UX, Accessibility, and Operational Fit | Keyboard-only desktop. | All core workflows are operable. | not_run |  |  |  |
| UX-007 | 28. UX, Accessibility, and Operational Fit | Screen reader landmarks/names. | Critical form controls have useful names and errors. | not_run |  |  |  |
| UX-008 | 28. UX, Accessibility, and Operational Fit | Color contrast and status meaning. | Risk/success is not communicated by color alone. | not_run |  |  |  |
| UX-009 | 28. UX, Accessibility, and Operational Fit | 200% zoom and large text. | No clipped totals/buttons. | not_run |  |  |  |
| UX-010 | 28. UX, Accessibility, and Operational Fit | Empty/loading/error/offline states. | Distinct and actionable. | not_run |  |  |  |
| UX-011 | 28. UX, Accessibility, and Operational Fit | Owner and supervisor role copy. | No “Viewing as Owner” confusion for supervisors. | not_run |  |  |  |
| UX-012 | 28. UX, Accessibility, and Operational Fit | Amended 2026-07-14: product-owner-approved reconciled terminology baseline before the limited pilot; actual pilot factory-user comprehension validation remains an open operating control. | Pre-pilot: consistent approved wording across UI, validation, locales, PDFs, exports, messaging, and help; high-risk concepts remain distinct; production deployment/regression pass; no known error-causing ambiguity. Pilot: dated contextual feedback from the named actual user, every confusing/rejected term corrected, and post-change confirmation retained. See `UX-012_REQUIREMENT_AMENDMENT.md`. | fail | English works, but Hindi and Gujarati switch successfully into heavily mixed, grammatically awkward copy with untranslated high-risk terms such as margin, defaults, and account data. | live language switch tests; Hindi/Gujarati settings UI | high |
| GOLDEN-A-01 | 30. Golden Journey A: Customer Order | Create Order Factory owner and complete onboarding. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-02 | 30. Golden Journey A: Customer Order | Add two looms, day/night workers, fixed worker, and payroll config. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-03 | 30. Golden Journey A: Customer Order | Build a real fabric estimate and compare it with the truth sheet. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-04 | 30. Golden Journey A: Customer Order | Save draft quote. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-05 | 30. Golden Journey A: Customer Order | Accept quote. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-06 | 30. Golden Journey A: Customer Order | Convert once to 1,500m active order. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-07 | 30. Golden Journey A: Customer Order | Assign both looms. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-08 | 30. Golden Journey A: Customer Order | Join as supervisor. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-09 | 30. Golden Journey A: Customer Order | Log day production: Loom 1 = 120.5m, Loom 2 = 110.25m. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-10 | 30. Golden Journey A: Customer Order | Verify order progress = 230.75m and worker payroll basis is exact. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-11 | 30. Golden Journey A: Customer Order | Submit the same shift again and prove duplicate protection. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-12 | 30. Golden Journey A: Customer Order | Correct one loom within 30 minutes to 125.5m. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-13 | 30. Golden Journey A: Customer Order | Verify progress and payroll change by exactly 5m. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-14 | 30. Golden Journey A: Customer Order | Create/confirm order stock according to the active workflow. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-15 | 30. Golden Journey A: Customer Order | Sell/dispatch a partial quantity with challan and credit terms. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-16 | 30. Golden Journey A: Customer Order | Record exact receipt for batch 1. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-17 | 30. Golden Journey A: Customer Order | Dispatch batch 2 and record a shortage. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-18 | 30. Golden Journey A: Customer Order | Verify discrepancy remains actionable. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-19 | 30. Golden Journey A: Customer Order | Record partial and final payments. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-20 | 30. Golden Journey A: Customer Order | Verify receivable reaches zero and payment history is complete. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-21 | 30. Golden Journey A: Customer Order | Add worker advance and payroll adjustment. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-22 | 30. Golden Journey A: Customer Order | Preview payroll, settle in valid window/final mode, generate payslip. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-23 | 30. Golden Journey A: Customer Order | Try correcting settled production and verify it is blocked. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-A-24 | 30. Golden Journey A: Customer Order | Complete order and verify loom unlink/archive behavior. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-01 | 31. Golden Journey B: Market Run | Create Market Factory owner and complete onboarding. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-02 | 31. Golden Journey B: Market Run | Create 1,000m market run from a real estimate. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-03 | 31. Golden Journey B: Market Run | Assign one loom and confirm the backing production anchor. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-04 | 31. Golden Journey B: Market Run | Log 200m across two shifts. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-05 | 31. Golden Journey B: Market Run | Verify 200m produced and expected godown stock once. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-06 | 31. Golden Journey B: Market Run | Create a 25m/0.5-taka manual correction/opening lot if needed. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-07 | 31. Golden Journey B: Market Run | Sell 80m to saved Party A with 30 credit days, sale-only. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-08 | 31. Golden Journey B: Market Run | Verify 120m remaining and 80m pending dispatch. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-09 | 31. Golden Journey B: Market Run | Dispatch 50m on day 1 and 30m later. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-10 | 31. Golden Journey B: Market Run | Verify due date starts from the first dispatch. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-11 | 31. Golden Journey B: Market Run | Record 49m receipt for the first batch and create 1m shortage. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-12 | 31. Golden Journey B: Market Run | Record exact receipt for the second batch. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-13 | 31. Golden Journey B: Market Run | Sell another portion to a new Party B with a duplicate-name test. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-14 | 31. Golden Journey B: Market Run | Record partial collection from Party A. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-15 | 31. Golden Journey B: Market Run | Verify party insights, overdue buckets, profit, and balances. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-16 | 31. Golden Journey B: Market Run | Close the run with unsold stock and confirm the intended stock behavior. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-17 | 31. Golden Journey B: Market Run | Sell out remaining stock and verify run/stock/archive status. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| GOLDEN-B-18 | 31. Golden Journey B: Market Run | Settle worker payroll from the same production logs. | Complete the step and preserve all stated downstream invariants. | not_run |  |  |  |
| SIGNOFF-01 | Daily owner sign-off | All active looms accounted for with production or downtime reason. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-02 | Daily owner sign-off | Order/run attribution correct. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-03 | Daily owner sign-off | Worker attribution and rate snapshots correct. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-04 | Daily owner sign-off | Today meters reconcile with supervisor register. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-05 | Daily owner sign-off | New expected stock is reasonable. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-06 | Daily owner sign-off | New sales have named parties and receivables. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-07 | Daily owner sign-off | Pending dispatch and receipt queues are correct. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-08 | Daily owner sign-off | Differences have an owner and next action. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-09 | Daily owner sign-off | Payments and dates are correct. | Satisfied with current-run evidence. | not_run |  |  |  |
| SIGNOFF-10 | Daily owner sign-off | No unexplained console/server/Sentry error. | Satisfied with current-run evidence. | not_run |  |  |  |
