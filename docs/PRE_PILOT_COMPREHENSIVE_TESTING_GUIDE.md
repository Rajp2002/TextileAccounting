# Weavly Pre-Pilot Comprehensive Testing Guide

Last repository review: June 21, 2026  
Target pilot: a real grey-fabric manufacturer/trader operating in India  
Primary users: factory owner, supervisor, and owner-authorized back-office user

## 1. Purpose

This guide is the production-readiness test manual for Weavly. It is designed to determine whether a real fabric factory can safely rely on the product for:

- costing and quotation;
- party-backed, make-to-order production;
- market-led, make-to-stock production;
- loom and worker assignment;
- shift production logging;
- expected godown stock;
- sale, dispatch, receipt, and shortage reconciliation;
- receivables and collection;
- worker advances, attendance, payroll, and settlement;
- role isolation, tenant isolation, auditability, billing, and messaging.

This is not only a UI test. Every critical test must check the user-visible result and the underlying business invariant. A green toast is not proof that a workflow succeeded.

### 1.1 Release scope and pilot gating

The canonical ledger records both `release_scope` and `pilot_gating` for every row. The allowed scope values and the rule for `not_applicable` are defined in `results.json.scopeModel` and `docs/pilot-remediation/POST_PILOT_BACKLOG.md`. An unresolved `pilot_core` row with `pilot_gating=true` independently blocks the limited pilot. A post-pilot row receives no PASS credit; it is `not_applicable` only for the pilot and must link to a named backlog acceptance test.

The limited pilot is a closed, supervised browser workflow. PWA installation is optional; legal wording must be counsel-reviewed before public reliance; independent daily meter reconciliation is a mandatory pilot operating control. Data recovery, factory terminology, and real-fabric costing truth remain pre-pilot gates.

## 2. Domain Model Used for Testing

### 2.1 Order-centric production

Order-centric production is make-to-order. Customer specifications exist before production starts. In Weavly, the canonical flow is:

`Estimator -> Quote -> Accepted Quote -> Active Order -> Loom Assignment -> Production -> Order Stock -> Sale/Dispatch -> Receipt -> Commercial Collection -> Payroll`

The test must preserve the customer commitment throughout the flow:

- party;
- quality/specification;
- target meters;
- deadline;
- accepted costing snapshot;
- worker-rate snapshot;
- assigned looms;
- produced meters;
- dispatched and received meters;
- revenue, receivable, and payment.

### 2.2 Market-centric production

Market-centric production is make-to-stock. Fabric is produced without a committed buyer and is sold from godown later. In Weavly, the canonical flow is:

`Estimator Market Mode -> Market Run -> Backing Production Order -> Loom Assignment -> Production -> Expected Godown Stock -> Party-First Sale -> Dispatch -> Receipt -> Commercial Collection -> Payroll`

The market-run workflow must not require a fake customer order. The buyer and credit terms are captured when stock is sold.

### 2.3 Hybrid production

A mixed factory may run party orders and market fabric at the same time. Tests must prove that:

- one loom has one active work context at a time;
- production is attributed to the intended order or run;
- order-reserved stock is not accidentally shown as market-saleable stock;
- market stock is not accidentally consumed by a party order;
- completing or closing work unlinks the intended looms without affecting other work.

### 2.4 Traceability rule

For every material or financial movement, capture:

- who performed it;
- what quantity or value changed;
- where it occurred;
- when it occurred, including the correct factory date;
- why it occurred;
- which prior and subsequent records it connects to.

This follows the GS1 traceability model and is particularly important for production, stock, dispatch, receipt variance, payment, and payroll correction.

## 3. Current Repository Baseline

The following was verified against the repository on June 21, 2026:

| Check | Result |
| --- | --- |
| ESLint | Pass |
| Vitest | 28 files passed; 256 tests passed; 1 skipped |
| Next.js production build | Pass |
| Dedicated `npm test` script | Missing |
| Browser E2E suite in repository | Missing |
| CI workflow in repository | Missing |
| Authoritative database schema | `supabase/migrations/`; `supabase/schema.sql` is deprecated |
| Full `npm audit --audit-level=high` | Fails: 12 vulnerabilities, including 2 high |
| Production-only `npm audit --omit=dev --audit-level=high` | Fails: 8 vulnerabilities, including 1 high |

Automated coverage is useful but uneven. Several tests are static source assertions rather than runtime database/browser tests. Passing Vitest is necessary, but it is not sufficient for pilot approval.

The current high-severity audit findings include a production dependency path through `form-data`; the full audit also reports high-severity `hono` advisories. Confirm actual runtime exposure rather than relying only on package presence.

## 4. Pilot Release Decision

Use three decisions:

| Decision | Meaning |
| --- | --- |
| Go | Pilot may start with the agreed users, looms, and workflows. |
| Conditional Go | Pilot may start only with documented workarounds and daily owner review. |
| No-Go | A blocker can corrupt tenant data, stock, money, payroll, or prevent the factory from completing its normal operating loop. |

### 4.1 Automatic No-Go conditions

Do not start the pilot if any of these remain:

- a supervisor can access another factory or owner-only data;
- a join code resolves to the wrong organization;
- machines or workers save but disappear after refresh;
- the target factory cannot log production using its actual shift pattern;
- duplicate production can create duplicate meters or wages;
- production corrections can alter already-settled payroll;
- stock can become negative or be sold twice;
- sale, dispatch, receipt, or payment dates shift by one day;
- a stock sale fails to create the intended named receivable;
- payment can exceed the remaining balance without an intentional overpayment flow;
- payroll preview differs from the persisted settlement;
- a failed transaction leaves stock reduced without a recoverable sale/dispatch record;
- a high-severity dependency advisory is untriaged for the deployed runtime;
- production migrations, RLS, grants, and application code are not at the same version;
- backup and restore have not been demonstrated.

### 4.2 Conditional-Go risks

These may be accepted for a narrow pilot only if explicitly understood:

- public tracking is intentionally deferred;
- challan/invoice generation is handled outside Weavly;
- full accounting, supplier ledger, GST filing, and bank reconciliation are deferred;
- offline production logging is unavailable;
- inspection and per-taka detail remain optional/manual;
- one owner reviews all discrepancies and collections daily.

## 5. Repository-Specific Risk Register

These risks were identified from current code and documentation and must be directly tested.

| Risk ID | Current implementation signal | Pilot concern | Required action |
| --- | --- | --- | --- |
| R-01 | Production screen exposes only active looms with an active order and both day and night standing workers. Save repeats the same guard. | A day-only factory, absent night worker, substitute worker, or setup lag can block valid production. | Run day-only, night-closed, substitute-worker, and incomplete-setup tests before pilot. Treat failure for the real factory pattern as No-Go. |
| R-02 | Visible production UI records shift meters and persists synthetic opening `0` and closing `meters`. | It is not a genuine loom-counter workflow despite some older copy referring to readings. | Confirm the pilot uses “shift total meters” as the operating rule. Check all UI, help, privacy, and training copy. |
| R-03 | Production drafts are stored in local storage, but production writes are not queued offline. | A supervisor may believe a draft is safely submitted while offline. | Test loss of network before and during submission. Ensure the UI never claims server success while only a local draft exists. |
| R-04 | Offline Kharchi queues a mutation for table `kharchi_offline`; no such database table exists, while sync writes generically to the queued table name. | Offline Kharchi is likely not syncable as implemented. | Treat offline Kharchi as unsupported until a runtime test proves reconciliation into `worker_advances` and `supervisor_float_transactions`. |
| R-05 | Privacy copy says offline production entries are stored in IndexedDB and automatically synced; landing FAQ says offline production logging is planned. | Product behavior and legal/user-facing disclosures conflict. | Reconcile copy before pilot and test the final promise. |
| R-06 | `ensureReceivableForCommercialEntry` implements fabric stock sales; market-run sale and party-invoice branches remain TODO. | A direct/legacy market-run sale path may not create the same receivable guarantees as the active stock-sale path. | Test every reachable sale entry point. Disable or remove any path that can create revenue without a receivable. |
| R-07 | Public `/track` is archived and active sale actions return `trackingUrl: null`, while tracking code and historical migrations remain. | Users may see stale expectations or assume the party can confirm receipt publicly. | Removed all active UI promises around public tracking; workflow consistently describes owner-recorded receipt confirmation. |
| R-08 | `market_run_summary` is query-heavy and cached in some UI paths. | Large factories may see stale or slow run/assignment data. | Run load and cache-invalidation tests after creating/closing/assigning runs. |
| R-09 | Factory Today `yieldAlert` has been completely removed. | Stale code could imply a yield control that is not active. | Verify no misleading yield alert appears in the UI. |
| R-10 | Historical June 3 QA blockers were fixed in a later commit, but must be regression-tested. | Fixes may regress during onboarding, caching, dates, stock units, or tracking changes. | Execute the regression pack in section 29. |
| R-11 | Full and production-only dependency audits currently fail. | Known vulnerable transitive packages may reach production. | Triage exploitability, upgrade safely, and record acceptance before Go. |
| R-12 | No committed browser E2E/CI workflow exists. | Critical workflows depend on manual execution and may regress unnoticed. | Use this guide for the pilot gate and prioritize automating the two golden journeys. |

## 6. Test Environment

### 6.1 Required environments

Use at least:

- local development;
- a production-like staging deployment;
- a separate staging Supabase project;
- the actual intended production deployment for read-only smoke tests after release.

Never perform destructive tests against real pilot data.

### 6.2 Required devices

Test:

- Android phone used by the supervisor;
- the owner’s normal phone;
- desktop Chrome;
- Safari or iPhone if the owner may use it;
- a low-cost phone with slow CPU and intermittent network;
- widths of approximately 390×844, 768×1024, and 1280×720.

### 6.3 Required accounts and organizations

Create:

| Test entity | Purpose |
| --- | --- |
| Org A: Market Factory | Market-run-only workflow |
| Org B: Order Factory | Order-based-only workflow |
| Org C: Mixed Factory | Simultaneous order and market work |
| Org D: Isolation Factory | Cross-tenant security tests |
| Owner A-D | Full owner workflows |
| Supervisor A-D | Floor and role-boundary tests |
| Admin QA account | Only if deferred admin routes are intentionally tested |
| Logged-out browser profile | Public/auth guard tests |

### 6.4 Core test data

Use recognizable prefixes such as `PILOTQA-20260621-`.

Create:

- four looms with two loom types;
- a day-only loom;
- a loom with day and night workers;
- a loom with a substitute worker;
- three piece-rate workers;
- one daily fixed worker;
- one salaried fixed worker;
- one worker with PF/ESI enabled;
- one worker with WhatsApp consent;
- one worker without consent;
- duplicate party names with different phone/GSTIN;
- one cash party and one 30-day credit party;
- one quality with real factory costing inputs;
- one 1,500m customer order;
- one 1,000m market run;
- one manual/opening stock lot;
- one lot below one taka;
- one receivable with partial payment;
- one dispatch with exact receipt;
- one dispatch with shortage;
- one dispatch with extra receipt.

### 6.5 Factory truth sheet

Before testing, prepare an independent spreadsheet or paper truth sheet with:

- expected estimator calculations;
- expected meter totals by loom, shift, worker, order, and run;
- expected stock after each movement;
- expected sale revenue, cost, and gross profit;
- expected receivable, due date, receipts, and balance;
- expected payroll gross, adjustments, deductions, advances, and net pay.

Do not use Weavly itself to calculate the expected result.

## 7. Evidence and Defect Protocol

For every failed or suspicious test, record:

- test ID;
- exact date/time and timezone;
- organization and role;
- browser/device;
- starting records;
- steps;
- expected result;
- actual result;
- screenshot/video;
- browser console;
- network request/response;
- sanitized database rows before and after;
- whether refresh, logout/login, or a second tab changes the result;
- severity and business impact.

### 7.1 Severity

| Severity | Definition |
| --- | --- |
| Blocker | Pilot cannot safely operate; tenant, stock, money, payroll, or production integrity is at risk. |
| High | Core workflow is wrong or unavailable, but a narrow manual workaround may exist. |
| Medium | Significant usability, traceability, reporting, or efficiency issue. |
| Low | Cosmetic or minor wording issue without workflow impact. |

## 8. Technical and Deployment Gate

Run the baseline from a clean checkout:

```bash
npm ci
npm run lint
npx vitest run
npm run build
npm audit --omit=dev --audit-level=high
npm audit --audit-level=high
```

| ID | Test | Expected result |
| --- | --- | --- |
| TECH-001 | Clean install with `npm ci`. | Install succeeds from lockfile. |
| TECH-002 | Run `npm run lint`. | Zero errors and zero warnings. |
| TECH-003 | Run `npx vitest run`. | All required tests pass; skipped test is explained. |
| TECH-004 | Run `npm run build`. | Production build succeeds without runtime/config warnings. |
| TECH-005 | Run `npm audit --omit=dev --audit-level=high`. | No unaccepted high/critical runtime advisories. |
| TECH-006 | Run full `npm audit --audit-level=high`. | All high/critical advisories fixed or documented with owner, exploitability, and deadline. |
| TECH-007 | Compare deployed migrations with repository migrations. | No pending, failed, or out-of-order migration. |
| TECH-008 | Verify PostgREST schema cache after RPC changes. | Current RPC signatures are callable from the app. |
| TECH-009 | Verify required environment variables without exposing values. | Missing variables produce an intentional safe failure. |
| TECH-010 | Verify production source maps, Sentry, and release version. | Errors are attributable to the deployed commit without leaking PII. |
| TECH-011 | Verify backup schedule and perform restore into a disposable project. | Restored org, users, production, stock, receivables, and payroll reconcile. |
| TECH-012 | Verify rollback procedure for application and database. | Team can restore the last known good application and has a forward-fix plan for non-reversible migrations. |
| TECH-013 | Add/use a `test` script in release automation. | The release command is repeatable and cannot accidentally omit Vitest. |
| TECH-014 | Record deployed commit, migration head, and test report. | Pilot build is uniquely identifiable. |

## 9. Authentication, Signup, and Tenant Isolation

| ID | Scenario | Expected result |
| --- | --- | --- |
| AUTH-001 | Owner signup with valid name, email, 10-digit phone, strong password, and factory name. | Auth user, organization, owner profile, join code, and onboarding state are created once. |
| AUTH-002 | Blank/invalid signup fields, weak password, invalid phone. | Clear validation; no partial organization/profile. |
| AUTH-003 | Duplicate email and rapid double-submit. | One account; safe error; no duplicate org. |
| AUTH-004 | Login with valid/invalid credentials. | Correct role home; generic safe failure for invalid credentials. |
| AUTH-005 | Forgot-password and valid/expired/used reset links. | Only valid link changes password; old sessions behave as designed. |
| AUTH-006 | Owner with incomplete onboarding logs in. | Redirected to onboarding. |
| AUTH-007 | Supervisor joins using current valid code. | Joins the intended organization and only that organization. |
| AUTH-008 | Invalid, expired, old regenerated, lowercase, spaced, and brute-forced join codes. | Rejected or normalized as designed; rate limit works. |
| AUTH-009 | Immediately after onboarding, compare displayed join code with organization row. | Exact current-org match before and after refresh/logout/login. |
| AUTH-010 | Supervisor opens owner URLs and owner-only actions directly. | Redirect/deny without data leakage or mutation. |
| AUTH-011 | Owner opens supervisor routes. | Only intentionally allowed owner-as-supervisor behavior appears; wording is unambiguous. |
| AUTH-012 | Org A user guesses Org D record IDs. | RLS/server actions return no data and perform no mutation. |
| AUTH-013 | Logout in one tab; use second tab. | Second tab loses protected access on next request. |
| AUTH-014 | Leave session inactive for more than one hour. | Session expires and local sensitive state is not exposed. |
| AUTH-015 | Revoke user session. | Revocation is effective across tabs/devices. |
| AUTH-016 | Locked organization attempts writes. | Lockdown rule is consistently enforced where enabled. |
| AUTH-017 | Protected API call while logged out. | JSON 401, not an HTML redirect. |
| AUTH-018 | Auth rate limit behind proxy headers. | Correct client isolation; one user cannot trivially lock out all users. |
| AUTH-019 | Open archived top-level and nested routes directly. | `/admin`, `/owner/inventory`, `/owner/ledger`, `/owner/settings/audit`, `/owner/system-health`, and `/track/*` follow the documented archive behavior. |
| AUTH-020 | Inspect owner/supervisor navigation for archived modules. | Deferred modules do not appear as active product promises, while their historical data remains intact. |

## 10. Onboarding and Factory Setup

| ID | Scenario | Expected result |
| --- | --- | --- |
| SETUP-001 | Complete market-run onboarding. | Market Runs visible; Quotes/Orders hidden; core shared modules visible. |
| SETUP-002 | Complete order-based onboarding. | Quotes/Orders visible; Market Runs hidden. |
| SETUP-003 | Complete mixed-mode onboarding. | Both production workflows visible. |
| SETUP-004 | Save machines during onboarding, refresh, and reopen Machines. | Every machine persists and is assignable. |
| SETUP-005 | Save workers during onboarding, refresh Workers/Advances/Payroll/Supervisor. | Every worker is visible in all relevant modules. |
| SETUP-006 | Save payroll cycle, pay date, and reminder window. | Same values appear in Settings and payroll calculations. |
| SETUP-007 | Fail a setup network request midway. | Step remains incomplete and retryable; no false success. |
| SETUP-008 | Double-click setup save. | Idempotent result; no duplicate machines/workers. |
| SETUP-009 | Finish onboarding with stale persisted query cache. | Dashboard reads the new org data, not another org or an empty cached result. |
| SETUP-010 | Change production mode after data exists. | Navigation changes without deleting or cross-linking historical data. |
| SETUP-011 | Factory Today setup panel after creating estimates, machines, workers, and payroll config. | Completion state is accurate and refresh-stable. |
| SETUP-012 | Factory name and join-code regeneration. | New value persists; old join code stops working. |

## 11. Machines, Workers, and Assignments

| ID | Scenario | Expected result |
| --- | --- | --- |
| MASTER-001 | Add one loom manually and refresh. | Loom remains visible. |
| MASTER-002 | Bulk-add looms with duplicate names or types. | Intended duplicate rule is enforced; no silent overwrite. |
| MASTER-003 | Edit loom name/type and refresh. | Assignment and historical production links remain intact. |
| MASTER-004 | Activate loom without required assignments/order. | Behavior matches the documented activation rule with a clear message. |
| MASTER-005 | Deactivate/delete loom with active order or history. | Protected action; history preserved; downstream UI remains consistent. |
| MASTER-006 | Assign a piece-rate worker to a loom with a decimal per-meter rate. | Assignment rate persists exactly, is snapshotted on production logs, and drives payroll without changing historical logs. |
| MASTER-007 | Add fixed worker with manually entered salary after selecting role. | Entered salary is not replaced by role default. |
| MASTER-008 | Add daily worker and record attendance. | Daily payroll uses attendance and never exceeds configured monthly salary. |
| MASTER-009 | Deactivate worker assigned to a loom. | Loom/setup becomes visibly incomplete; old logs remain attributed. |
| MASTER-010 | Assign different day and night workers. | Correct worker pre-fills for each shift. |
| MASTER-011 | Substitute worker for one dated shift. | Shift-specific assignment is clear and payroll follows the actual logged worker. |
| MASTER-012 | Assign order/run to loom, then replace it. | New logs use the new context; historical logs retain old context. |
| MASTER-013 | Complete/cancel/delete order or close run. | Related looms unlink and become inactive as intended; unrelated looms remain unchanged. |
| MASTER-014 | Two users edit same loom assignment. | Last-write/concurrency behavior is visible and does not create mixed context. |
| MASTER-015 | Worker WhatsApp phone/consent changes. | Consent rows and sends reflect the latest valid state. |

## 12. Estimator and Costing

Use at least three real factory recipes and calculate the expected result independently.

| ID | Scenario | Expected result |
| --- | --- | --- |
| EST-001 | Single warp and single weft recipe. | Yarn kg, yarn cost, weave cost, processing, overhead, landed cost, and quote match truth sheet. |
| EST-002 | Multi-row blended warp and multi-row weft. | Each row contributes once; total is exact within agreed rounding. |
| EST-003 | Decimal denier, yarn rate, GST, shortage, and crimp. | Decimal precision is preserved; no floating-point drift. |
| EST-004 | Width entered in centimeters and equivalent inches. | Equivalent calculation and persisted value. |
| EST-005 | Weaving rate entered in paise/pick. | No rupee/paise 100× error. |
| EST-006 | Outsourced sizing versus in-house sizing. | Sizing cost toggles exactly once. |
| EST-007 | Optional winding, processing, finishing, commission, and transport. | Disabled sections contribute zero; enabled sections contribute correctly. |
| EST-008 | Overhead items and manual overhead override. | Override replaces, rather than double-counts, itemized overhead. |
| EST-009 | Capacity utilization and idle-capacity values. | Correct for loom count, output/day, working days, and monthly output. |
| EST-010 | Fixed workers added to overhead. | No duplicate fixed-worker cost after repeated merge/save. |
| EST-011 | Zero/negative/extreme inputs and no warp/weft rows. | Save blocked with field-specific validation. |
| EST-012 | Commission plus margin at or above invalid boundary. | Invalid quote state; no misleading positive quote. |
| EST-013 | Save, rename, update, rate-update, apply, and delete template. | Template lifecycle is isolated to the org and refresh-stable. |
| EST-014 | Autosaved draft after refresh/crash. | Latest intended draft restores without overwriting another quote. |
| EST-015 | Restore historical quote after factory profile/template rates change. | Historical snapshot remains unchanged. |
| EST-016 | Save Quote versus Save & Accept. | Draft remains editable; accepted quote is locked per product rule. |
| EST-017 | Rapid double-submit. | One quote/order/run only. |
| EST-018 | Market-mode party-name race. | Fabric label and market run are saved correctly without a fake party. |
| EST-019 | Compare cost/margin/profit on Estimator, Quote, Order, and Commercials. | Same snapshot economics are used at each stage. |

## 13. Quote Lifecycle

| ID | Scenario | Expected result |
| --- | --- | --- |
| QUOTE-001 | Save draft quote. | Draft visible in history with complete snapshot. |
| QUOTE-002 | Accept draft with confirmation. | Status locks; audit transition is correct. |
| QUOTE-003 | Reject draft/accepted quote according to allowed transitions. | Only valid transition succeeds. |
| QUOTE-004 | Convert non-accepted quote to order. | Blocked. |
| QUOTE-005 | Convert accepted quote once. | One active order linked back to quote. |
| QUOTE-006 | Concurrent/double conversion. | Unique/atomic RPC returns the same or safe duplicate result; never two orders. |
| QUOTE-007 | Start Party Order fast path. | Accepted quote and order form one consistent transaction. |
| QUOTE-008 | Target, deadline, and notes validation. | Positive target; valid date; intended notes persist. |
| QUOTE-009 | Quote/order conversion failure after partial work. | No orphaned active order or inconsistent quote link. |
| QUOTE-010 | Restore quote into estimator while another local draft exists. | Clear collision warning; user chooses intentionally. |

## 14. Order-Centric End-to-End Tests

| ID | Scenario | Expected result |
| --- | --- | --- |
| ORDER-001 | Create a 1,500m order from an accepted quote. | Party, quality, target, deadline, costs, rate, and instructions copy correctly. |
| ORDER-002 | Assign one or more looms. | Supervisor sees the order and correct worker rate. |
| ORDER-003 | Log production across multiple shifts/looms. | Order progress equals the exact sum of valid positive logs. |
| ORDER-004 | Log production before order creation/start date. | Blocked. |
| ORDER-005 | Produce beyond target. | Product behavior is explicit; progress, pace, stock, and payroll remain mathematically consistent. |
| ORDER-006 | Change target/deadline after production. | Protected edit; pace updates; history/audit retained. |
| ORDER-007 | Complete with target met. | Status changes, looms unlink, history and reserved stock remain correct. |
| ORDER-008 | Complete below target. | Confirmation warns about remaining quantity and pending dispatch. |
| ORDER-009 | Cancel after some production. | Produced stock/history retained; no new logs accepted; loom unlinks. |
| ORDER-010 | Attempt delete with production/dispatch/payment history. | Safe restriction or documented archival behavior; no orphan records. |
| ORDER-011 | Order stock appears as reserved, not freely saleable market stock. | Correct stock classification. |
| ORDER-012 | Sell/dispatch order-linked stock. | Party/order/source links remain available in dispatch and Commercials. |
| ORDER-013 | Partial dispatch against order. | Remaining order sale/dispatch quantity remains actionable. |
| ORDER-014 | Receipt shortage/excess. | Dispatch and discrepancy update without rewriting original production. |
| ORDER-015 | Close money and payroll. | Collection and worker settlement reconcile independently to the same production. |

## 15. Market-Centric End-to-End Tests

| ID | Scenario | Expected result |
| --- | --- | --- |
| MARKET-001 | Create 1,000m market run from estimator. | Run, costing snapshot, and backing production anchor are linked. |
| MARKET-002 | Assign loom to market run. | Backing order is created/reactivated as intended and supervisor sees one clear run. |
| MARKET-003 | Log production. | Produced meters and expected godown meters update once. |
| MARKET-004 | Multiple shifts update same run. | Summary equals production logs; no duplicate expected stock. |
| MARKET-005 | Sell market stock to a new party. | No fake party order; party, sale, receivable, stock decrement, and pending dispatch are created. |
| MARKET-006 | Sell to an existing saved party. | Existing `party_id` is used and defaults prefill. |
| MARKET-007 | Sell portions to multiple parties. | Stock, revenue, receivables, and party insights are separated correctly. |
| MARKET-008 | Close run with unsold stock. | Unsold stock remains visible/saleable according to agreed business rule. |
| MARKET-009 | Close sold-out run with pending dispatch. | Lot leaves active stock if intended; pending dispatch remains visible in Dispatches/Commercials. |
| MARKET-010 | Sell out and receive all batches. | Run displays sold-out/closed correctly and archive is complete. |
| MARKET-011 | Direct/legacy market-run sale action, if reachable. | Must create the same named receivable or be disabled. |
| MARKET-012 | Reopen/reactivate closed run, if allowed. | No duplicate backing order or stock. |
| MARKET-013 | Market-run summary with many runs/sales. | Acceptable load time and fresh values after mutation. |

## 16. Supervisor Production Logging

This is the most important floor suite.

| ID | Scenario | Expected result |
| --- | --- | --- |
| PROD-001 | Current date and current shift defaults. | Correct Asia/Kolkata date and intended shift. |
| PROD-002 | Day-only factory with no night worker. | Must match the pilot’s operating decision; if valid production is blocked, pilot is No-Go unless night assignment is genuinely mandatory. |
| PROD-003 | Night shift closed temporarily. | Day production remains loggable. |
| PROD-004 | Substitute worker. | Supervisor can intentionally select/log the actual worker or receives a workable owner-remapping flow. |
| PROD-005 | Loom missing active order/run. | Clear blocked or review-queue behavior; entered draft is not silently lost. |
| PROD-006 | Loom missing worker. | Clear blocked or review-queue behavior. |
| PROD-007 | Worker rate missing/zero. | Positive meters blocked; no fallback ₹1.50 rate. |
| PROD-008 | Valid positive meters. | One production log with correct worker, work anchor, rate snapshot, date, shift, and submitted time. |
| PROD-009 | Zero meters with each canonical downtime reason. | Status log saved without wage/stock quantity. |
| PROD-010 | Zero meters with “Other” and no note. | Blocked. |
| PROD-011 | Negative meters. | Blocked on client and server. |
| PROD-012 | Decimal meters. | Stored and summed correctly. |
| PROD-013 | Very large but plausible meters. | Suspicious-value behavior is explicit. |
| PROD-014 | Copy previous shift. | Correct source shift, no duplicate, editable before submit. |
| PROD-015 | Double-click submit or retry after timeout. | One authoritative log per machine/date/shift. |
| PROD-016 | Correct within 30-minute window. | Replacement is atomic; totals update; audit retained. |
| PROD-017 | Correct after window without code. | Blocked. |
| PROD-018 | Correct after window with valid/invalid/used/expired code. | Only valid one-time code succeeds. |
| PROD-019 | Correct period after worker payroll is settled. | Blocked. |
| PROD-020 | Past-date production before order start. | Blocked. |
| PROD-021 | Future-date production. | Blocked or unavailable. |
| PROD-022 | Change date/shift while draft exists. | Draft stored under correct date/shift and never submitted to another shift. |
| PROD-023 | Refresh/browser crash with draft. | Draft restores, clearly marked unsaved. |
| PROD-024 | Network drops before submit. | No success claim; draft remains locally. |
| PROD-025 | Network drops after request reaches server but before response. | Retry is idempotent and resolves current server state. |
| PROD-026 | Two supervisors submit same shift. | Atomic duplicate protection. |
| PROD-027 | Machine status running/idle/maintenance and breakdown notes. | Status persists independently and aligns with downtime entry. |
| PROD-028 | Verify order progress, market run, expected stock, analytics, Today, and payroll after submit. | Every downstream total changes once. |
| PROD-029 | Compare visible “shift meters” terminology with stored synthetic readings. | No user-facing claim of real opening/closing counter proof. |
| PROD-030 | Mobile usability with 20+ looms. | Fast selection, readable cards, no accidental cross-row edits, submit reachable. |

## 17. Stock and Godown

The product’s active stock model is an expected ledger, not guaranteed physical truth. Tests must keep that distinction clear.

| ID | Scenario | Expected result |
| --- | --- | --- |
| STOCK-001 | Market production creates expected stock context. | Production appears once with correct source and cost. |
| STOCK-002 | Create manual lot using total meters and meters/taka. | Taka count equals meters divided by meters/taka. |
| STOCK-003 | Create 25m lot at 50m/taka. | Stores 25m and 0.5 taka, not 25 takas. |
| STOCK-004 | Create opening, manual, market-run, order, and adjustment sources. | Source IDs match declared type and current org. |
| STOCK-005 | Submit mismatched quote/order or another org’s source. | Blocked. |
| STOCK-006 | Fractional meters and taka. | Precision consistent through lot, sale, dispatch, and movement. |
| STOCK-007 | Adjust stock up/down with reason. | Movement ledger records signed quantities and actor. |
| STOCK-008 | Subtract more than available. | Blocked atomically. |
| STOCK-009 | Concurrent sale/adjustment against same lot. | Row locking prevents negative or double-used stock. |
| STOCK-010 | Sample cutting, damage, measurement correction, return. | Reason is traceable; chosen stock effect is correct. |
| STOCK-011 | Order lot while order active/completed/cancelled. | Reserved/actionable/archive behavior matches policy. |
| STOCK-012 | Closed/sold-out market lot with zero available. | Moves to archive/history as intended. |
| STOCK-013 | Sold-out lot with pending dispatch. | Pending quantity remains in Dispatches/Commercials even if lot is not in Active Stock. |
| STOCK-014 | Unresolved discrepancy. | Lot or discrepancy remains actionable until reviewed. |
| STOCK-015 | Summary totals. | Available meters, taka approximation, cost value, pending dispatch, revenue, and profit reconcile. |
| STOCK-016 | Movement history pagination/limits with more than 500 rows. | Product behavior is explicit and older movements remain retrievable. |
| STOCK-017 | Refresh and second user. | No stale stock after mutation. |

## 18. Party-First Sale

| ID | Scenario | Expected result |
| --- | --- | --- |
| SALE-001 | New party with unique name. | Party, sale, receivable, and `party_id` created. |
| SALE-002 | Existing party selected. | Existing identity used; no duplicate party. |
| SALE-003 | Unique exact-name auto-link. | Correct party selected. |
| SALE-004 | Two saved parties with same normalized name and no identifier. | Ambiguity blocks sale and asks for selection or phone/GSTIN. |
| SALE-005 | Same name with distinguishing phone or GSTIN. | Correct/new party intentionally resolved. |
| SALE-006 | Zero/negative meters or rate. | Blocked. |
| SALE-007 | Oversell. | Blocked atomically. |
| SALE-008 | Fractional sale below one taka. | Allowed and mathematically correct. |
| SALE-009 | Sale-only. | Stock reduces; pending dispatch equals sold meters; receivable exists. |
| SALE-010 | Sell and dispatch now. | Sale and dispatch are consistent; no double dispatch. |
| SALE-011 | Credit days zero and positive. | Due date starts from first dispatch date per active product rule. |
| SALE-012 | Sale recorded today, first dispatch later. | Receivable due date is deferred/rebased correctly. |
| SALE-013 | Same stock split across parties/rates. | Cost basis and profit calculated per sale. |
| SALE-014 | Injected dispatch-stage failure during Sell & Dispatch. | Atomic transaction rolls back sale, dispatch, receivable, and stock changes; operator message explicitly says nothing was saved. |
| SALE-015 | Rapid duplicate submit. | One sale and one receivable. |
| SALE-016 | Broker/commission, claim, or rate-difference information. | If unsupported, UI/docs do not imply it is included in net realization. |

## 19. Dispatch, Receipt, and Difference Reconciliation

| ID | Scenario | Expected result |
| --- | --- | --- |
| DISP-001 | Dispatch all pending meters. | Pending becomes zero; batch is active/in transit. |
| DISP-002 | Partial dispatch. | Only dispatched quantity leaves pending; no discrepancy is created. |
| DISP-003 | Multiple batches for one sale. | Grouped under one sale; totals reconcile. |
| DISP-004 | Dispatch more than pending. | Blocked atomically. |
| DISP-005 | Challan, vehicle, transporter, notes, and date. | Persist exactly; vehicle normalization is intentional. |
| DISP-006 | First dispatch starts credit clock. | Due date equals first dispatch date plus credit days. |
| DISP-007 | Exact received meters. | Delivered/received status; no discrepancy. |
| DISP-008 | Received less than sent. | Shortage discrepancy with correct signed difference and review status. |
| DISP-009 | Received more than sent. | Excess discrepancy with correct signed difference and review status. |
| DISP-010 | Zero/negative received meters. | Blocked. |
| DISP-011 | Receipt recorded twice. | Idempotent or blocked; no duplicate discrepancy. |
| DISP-012 | Receipt for one of several batches. | Only that batch closes; remaining batches stay actionable. |
| DISP-013 | Delivered group with all quantities complete. | Moves to archive. |
| DISP-014 | Pending, unconfirmed, disputed, discrepancy, or e-way gap. | Stays active. |
| DISP-015 | Public tracking route. | Redirects to archived/404 behavior consistently; no promise of party confirmation. |
| DISP-016 | Date-only values in India and a UTC-negative browser timezone. | Persist/display the selected calendar date unchanged. |
| DISP-017 | Consignment above/below relevant e-way threshold and non-supply movement. | App behaves as a reminder/checklist only unless all required compliance data is collected. |
| DISP-018 | Missing challan/e-way/transporter data. | Clear warning without falsely claiming compliance completion. |
| DISP-019 | Stock, dispatch, receipt, archive, and Commercials refresh. | One coherent state across all modules. |

## 20. Commercials, Receivables, and Collections

| ID | Scenario | Expected result |
| --- | --- | --- |
| COMM-001 | Stock sale creates receivable. | Named party, source, total, credit days, dispatch status, and balance are correct. |
| COMM-002 | Direct market-run sale path, if reachable. | Creates equivalent receivable or is disabled. |
| COMM-003 | Realized versus expected entries. | No double counting between quote, order, market run, stock sale, and invoice-like records. |
| COMM-004 | Revenue, cost, gross profit, and margin. | Match truth sheet and sale snapshot. |
| COMM-005 | Full payment. | Receipt created; balance zero; status paid. |
| COMM-006 | Partial payment. | Balance and status partial; history complete. |
| COMM-007 | Multiple partial payments. | Sum receipts equals received amount; no floating-point drift. |
| COMM-008 | Payment above balance, zero, or negative. | Blocked unless intentional overpayment support exists. |
| COMM-009 | Payment mode cash/bank/UPI/cheque/other. | DB enum and UI label normalize correctly. |
| COMM-010 | Cheque details and references. | Required fields and history display are correct. |
| COMM-011 | Payment date across timezones. | Calendar date remains unchanged. |
| COMM-012 | Due today, overdue buckets, and future due. | Correct Asia/Kolkata classification. |
| COMM-013 | Collected-this-month boundary at month start/end. | Correct India calendar month. |
| COMM-014 | Top Parties periods 7d/30d/year/all. | Revenue, profit, meters, dues, overdue, and last sale are correct. |
| COMM-015 | Duplicate names with different `party_id`. | Separate party rows; legacy name fallback only where ID is absent. |
| COMM-016 | Search and source/status filters. | Results and summary totals use the same filtered dataset or clearly state otherwise. |
| COMM-017 | Refresh/caching after payment. | Cards, row, history, and party insight update immediately. |
| COMM-018 | Claim, shortage deduction, discount, rate difference, broker commission. | Unsupported effects are not silently included. Record as product gap if factory needs them. |

## 21. Payroll, Advances, Attendance, and Worker Money

| ID | Scenario | Expected result |
| --- | --- | --- |
| PAY-001 | Piece-rate gross across looms/rates. | Sum of each production log’s meters × rate snapshot. |
| PAY-002 | Change worker/current loom rate after old production. | Historical payroll keeps old snapshot. |
| PAY-003 | Zero-meter downtime log. | No wage created. |
| PAY-004 | Salaried fixed worker. | Configured salary used. |
| PAY-005 | Daily fixed worker with attendance. | Present days × daily rate, capped as intended. |
| PAY-006 | Past/future attendance. | Future blocked; protected past edit uses valid access code. |
| PAY-007 | Advance creation for meter/fixed worker. | Pending debt visible in Advances and Payroll. |
| PAY-008 | Multiple advances and fractional amounts. | Sum exact. |
| PAY-009 | Delete pending advance. | Allowed with correct audit expectation. |
| PAY-010 | Delete deducted advance. | Blocked. |
| PAY-011 | Standard recovery cap. | Total deductions do not exceed configured/legal cap; remaining debt carries forward. |
| PAY-012 | Final settlement. | Full allowed recovery and remaining debt behavior are explicit. |
| PAY-013 | PF/ESI enrolled and not enrolled. | Deductions apply only to intended workers using reviewed formulas. |
| PAY-014 | Inam and kapaat adjustments. | Itemized; note/reason required; final payout never negative. |
| PAY-015 | Preview versus settlement. | Persisted gross, each deduction, adjustment, debt, and net equal preview. |
| PAY-016 | Settle before payroll window. | Normal settlement blocked; final settlement behavior remains intentional. |
| PAY-017 | Settle in reminder window/on pay date/overdue. | Allowed with correct status. |
| PAY-018 | Payment mode and owner verification missing. | Settlement blocked. |
| PAY-019 | Double-settle/concurrent settle. | One settlement; advances deducted once. |
| PAY-020 | Unsettle without/with invalid/valid used code. | Only valid one-time code reverts settlement. |
| PAY-021 | Unsettle restores advances and state. | Exact prior debt and status restored. |
| PAY-022 | Correct production after settlement. | Blocked. |
| PAY-023 | Payslip PDF. | Name, cycle, earning lines, adjustments, deductions, net, and debt are correct. |
| PAY-024 | Past settlement history and CSV. | Search/filter, line reconstruction, totals, and filename are correct. |
| PAY-025 | Month/cycle boundaries including February and leap year. | Correct cycle start/end/pay date. |
| PAY-026 | Worker exits mid-cycle. | Final settlement and deactivation preserve history. |
| PAY-027 | Supervisor Kharchi online. | Float decreases and worker advance increases in one coherent operation. |
| PAY-028 | Supervisor Kharchi offline and reconnect. | Do not approve until proven to sync into real tables exactly once. |

## 22. Factory Today and Analytics

| ID | Scenario | Expected result |
| --- | --- | --- |
| DASH-001 | Empty factory. | Helpful setup state; no false production/money. |
| DASH-002 | After onboarding data. | Setup completion accurate. |
| DASH-003 | After shift production. | Today meters, production status, work risk, order/run progress, and payroll signals update once. |
| DASH-004 | Historical date selection. | Shows selected date without mixing today’s values. |
| DASH-005 | Realtime insert. | Owner sees update without duplicate totals. |
| DASH-006 | Realtime disconnect/reconnect. | Status visible; refetch recovers truth. |
| DASH-007 | Sold-not-dispatched and pending receipts. | Counts and links match Dispatches. |
| DASH-008 | Work-at-risk and pace. | Correct deadline/remaining meter logic. |
| DASH-009 | Completed/closed work. | Leaves active risk cards. |
| DASH-010 | Large data range. | Acceptable load time and no client freeze. |
| DASH-011 | Yield alert. | Verify no yield alert placeholder or misleading feature is visible since it is removed. |

## 23. WhatsApp

Live WhatsApp delivery is post-pilot. During the pilot, `WHATSAPP_PROVIDER` is absent or `disabled`; missing or invalid configuration must remain disabled, must not call Meta, and must not break any core order, production, stock, commercial, payroll, or access-code workflow. Provider integration boundaries, consent, secrets, templates, signed callbacks, and live failure drills remain documented in `docs/pilot-remediation/POST_PILOT_BACKLOG.md`.

Rows `WA-001`–`WA-007` and `WA-009` retain infrastructure-readiness evidence. `WA-008` and `WA-010` retain their exact live-provider requirements but are non-gating `not_applicable` for the pilot under `PP-WA-002` and `PP-WA-003`; neither receives PASS credit. Deterministic simulation is permitted only in isolated non-production proof with explicit `WHATSAPP_PROVIDER=simulate`.

| ID | Scenario | Expected result |
| --- | --- | --- |
| WA-001 | Opted-in worker receives simulated advance receipt. | Business write succeeds; delivery log says simulated/sent. |
| WA-002 | Opted-out worker. | Message skipped and logged; business write succeeds. |
| WA-003 | Missing consent or phone. | Message skipped with correct reason. |
| WA-004 | Provider timeout/failure. | Core advance/payroll/access-code write is not rolled back. |
| WA-005 | Payslip summary and itemized follow-up. | Correct worker/settlement, no PII leak to wrong number. |
| WA-006 | Access code message. | Only intended opted-in owner/supervisor receives it. |
| WA-007 | Deadline/daily/monthly cooldown. | No duplicate spam. |
| WA-008 | Webhook valid/invalid signature and status callback. | Only valid callback updates intended delivery row. |
| WA-009 | Retry failed message. | Maximum retry and 24-hour rules enforced. |
| WA-010 | Live template rejection or expired token. | Clear operational log and manual fallback. |

## 24. Billing, Trial, and Referrals

| ID | Scenario | Expected result |
| --- | --- | --- |
| BILL-001 | Trial start once. | Correct expiry and no duplicate trial. |
| BILL-002 | Base versus Premium access gates. | Correct modules gated; Billing itself remains reachable. |
| BILL-003 | Successful Razorpay checkout/webhook. | Subscription/payment recorded once. |
| BILL-004 | Duplicate/replayed webhook. | Idempotent. |
| BILL-005 | Invalid webhook signature. | Rejected without state change. |
| BILL-006 | Payment failure, cancel, auto-renew toggle. | Accurate subscription state and access. |
| BILL-007 | Webhook arrives out of order. | Final state is correct. |
| BILL-008 | Referral code create/apply. | One valid relationship; no self-referral/duplicate use. |
| BILL-009 | Referral conversion/refund replay. | Idempotent. |
| BILL-010 | Subscription expires during active session. | Access changes safely without data loss. |

## 25. Offline, PWA, Cache, and Network Resilience

| ID | Scenario | Expected result |
| --- | --- | --- |
| OFF-001 | Install PWA and reopen. | Correct icon, scope, start route, and update behavior. |
| OFF-002 | Open cached app offline. | Offline page or safe cached read appears; no false live state. |
| OFF-003 | Production draft while online, then offline. | Draft remains local and clearly unsent. |
| OFF-004 | Submit production offline. | Must not claim success; no duplicate on reconnect. |
| OFF-005 | Cached owner data after switching organizations/accounts on same device. | No prior-org data appears. |
| OFF-006 | Logout with persisted query/local storage. | Sensitive cached data is cleared or inaccessible. |
| OFF-007 | Service worker update during active draft. | Draft not lost; user receives safe refresh behavior. |
| OFF-008 | Kharchi offline. | Expected to fail current review unless fixed; verify real table reconciliation. |
| OFF-009 | Mutation request timeout. | UI distinguishes unknown outcome from definite failure. |
| OFF-010 | Slow 2G/3G and intermittent connection. | Core mobile screens remain usable and prevent repeated submissions. |

## 26. Timezone, Date, and Localization

| ID | Scenario | Expected result |
| --- | --- | --- |
| TIME-001 | Test near 00:00 Asia/Kolkata. | Today, shift, production, payments, and dashboards use factory date. |
| TIME-002 | Browser in UTC, US Pacific, and India. | Date-only fields persist unchanged. |
| TIME-003 | Month-end/year-end. | Commercial collection and payroll cycles classify correctly. |
| TIME-004 | Leap day. | Valid date and cycle behavior. |
| TIME-005 | Hindi/Gujarati/English switch. | Domain terms remain understandable; values and IDs unchanged. |
| TIME-006 | Refresh and new session. | Language preference persists as intended. |
| TIME-007 | Mixed translated/untranslated validation. | Critical errors remain actionable. |
| TIME-008 | Currency, decimals, meters, taka, dates. | Indian formatting without altering stored value. |

## 27. Security, Privacy, and Audit

| ID | Scenario | Expected result |
| --- | --- | --- |
| SEC-001 | Query tenant tables as anonymous user. | No sensitive data. |
| SEC-002 | Review production DB grants. | No broad `anon` table/sequence grants. |
| SEC-003 | Verify RLS enabled on all public base tables. | Enabled with intended policies. |
| SEC-004 | Manipulate org ID/record ID in requests. | Server derives org from authenticated profile and rejects cross-org access. |
| SEC-005 | Supervisor invokes owner server action. | Rejected server-side. |
| SEC-006 | Access-code format, expiry, one-time use, brute force, lockout. | All enforced. |
| SEC-007 | Razorpay webhook HMAC and idempotency. | Invalid/replay safe. |
| SEC-008 | Tracking token code despite archived UI. | No active public data leak. |
| SEC-009 | Data export. | Only current org; export event audited; sensitive fields reviewed. |
| SEC-010 | Worker erasure/anonymization. | Intended PII removed while payroll/audit integrity remains. |
| SEC-011 | Secrets in client bundle, logs, repository, Sentry. | None exposed. |
| SEC-012 | Stored XSS in party, notes, quality, worker, challan, and template fields. | Rendered safely. |
| SEC-013 | CSRF/session/cookie behavior. | Protected actions require valid same-user session. |
| SEC-014 | File/PDF generation with malicious text. | Safe content and filenames. |
| SEC-015 | Audit protected corrections, settlement reversal, deletion, write-off, and settings. | Actor, org, action, record, before/after context, and timestamp are adequate. |
| SEC-016 | Privacy policy behavior versus actual offline storage and cookies. | Accurate, consistent, and reviewed. |
| SEC-017 | Worker age/consent flow. | Product does not accept unsupported claims as legal proof. |
| SEC-018 | DPDP, breach, grievance, and retention wording. | Reviewed against current law by qualified counsel before public reliance. |

## 28. UX, Accessibility, and Operational Fit

| ID | Scenario | Expected result |
| --- | --- | --- |
| UX-001 | Supervisor logs 20 looms on a phone. | No excessive scrolling/error-prone row confusion. |
| UX-002 | Buttons during submission. | Disabled/progress state prevents double action. |
| UX-003 | Error recovery. | Entered values remain after validation/server error. |
| UX-004 | Mobile navigation and logout. | Controls do not overlap bottom navigation. |
| UX-005 | Dialogs and sheets. | Keyboard focus, labels, description, Escape/close behavior work. |
| UX-006 | Keyboard-only desktop. | All core workflows are operable. |
| UX-007 | Screen reader landmarks/names. | Critical form controls have useful names and errors. |
| UX-008 | Color contrast and status meaning. | Risk/success is not communicated by color alone. |
| UX-009 | 200% zoom and large text. | No clipped totals/buttons. |
| UX-010 | Empty/loading/error/offline states. | Distinct and actionable. |
| UX-011 | Owner and supervisor role copy. | No “Viewing as Owner” confusion for supervisors. |
| UX-012 | Factory terminology review with brother/supervisor. | Labels match actual language: loom, shift meters, quality/run, godown, party, challan, Upaad/Kharchi, hisaab. |

## 29. Historical Defect Regression Pack

The June 3, 2026 QA report found these defects. Later commits claim to fix them. Retest each before pilot:

| Regression | Required proof |
| --- | --- |
| Onboarding machines disappeared. | Create during onboarding; verify after refresh and assignment. |
| Manual loom disappeared. | Add manually; verify after refresh and supervisor use. |
| Wrong organization join code displayed. | Compare UI and DB immediately after onboarding and after login. |
| Supervisor saw owner-view copy. | Review desktop/mobile role wording and owner-route denial. |
| Manual stock treated meters as taka. | Verify 25m at 50m/taka becomes 0.5 taka. |
| Date selected on June 3 persisted as June 2. | Retest dispatch, payment, due date, receipt, archive, and timezone variants. |
| Persisted workers invisible in operational pages. | Verify Workers, Advances, Payroll, Attendance, and supervisor views. |
| Fixed salary overwritten by role default. | Enter custom salary before/after role selection and verify DB/UI. |
| Stock-sale tracking token/public route mismatch. | Confirm current intended behavior is consistently deferred. |
| Sub-taka sale failed. | Sell a fraction below one taka and reconcile every downstream value. |

## 30. Golden Journey A: Customer Order

Run this uninterrupted in staging with browser/video and database checkpoints.

1. Create Order Factory owner and complete onboarding.
2. Add two looms, day/night workers, fixed worker, and payroll config.
3. Build a real fabric estimate and compare it with the truth sheet.
4. Save draft quote.
5. Accept quote.
6. Convert once to 1,500m active order.
7. Assign both looms.
8. Join as supervisor.
9. Log day production: Loom 1 = 120.5m, Loom 2 = 110.25m.
10. Verify order progress = 230.75m and worker payroll basis is exact.
11. Submit the same shift again and prove duplicate protection.
12. Correct one loom within 30 minutes to 125.5m.
13. Verify progress and payroll change by exactly 5m.
14. Create/confirm order stock according to the active workflow.
15. Sell/dispatch a partial quantity with challan and credit terms.
16. Record exact receipt for batch 1.
17. Dispatch batch 2 and record a shortage.
18. Verify discrepancy remains actionable.
19. Record partial and final payments.
20. Verify receivable reaches zero and payment history is complete.
21. Add worker advance and payroll adjustment.
22. Preview payroll, settle in valid window/final mode, generate payslip.
23. Try correcting settled production and verify it is blocked.
24. Complete order and verify loom unlink/archive behavior.

Final reconciliations:

- production logs = order progress;
- produced/reserved/sold/dispatched/received meters explain all quantity;
- revenue/cost/profit match snapshots;
- receipts sum to receivable total;
- payroll matches production rate snapshots and adjustments.

## 31. Golden Journey B: Market Run

1. Create Market Factory owner and complete onboarding.
2. Create 1,000m market run from a real estimate.
3. Assign one loom and confirm the backing production anchor.
4. Log 200m across two shifts.
5. Verify 200m produced and expected godown stock once.
6. Create a 25m/0.5-taka manual correction/opening lot if needed.
7. Sell 80m to saved Party A with 30 credit days, sale-only.
8. Verify 120m remaining and 80m pending dispatch.
9. Dispatch 50m on day 1 and 30m later.
10. Verify due date starts from the first dispatch.
11. Record 49m receipt for the first batch and create 1m shortage.
12. Record exact receipt for the second batch.
13. Sell another portion to a new Party B with a duplicate-name test.
14. Record partial collection from Party A.
15. Verify party insights, overdue buckets, profit, and balances.
16. Close the run with unsold stock and confirm the intended stock behavior.
17. Sell out remaining stock and verify run/stock/archive status.
18. Settle worker payroll from the same production logs.

Final reconciliations:

- market-run produced meters = valid positive production logs;
- available + sold quantity explains production/adjustments;
- pending dispatch equals sold minus dispatched;
- dispatch receipt differences create exactly one discrepancy;
- party receivables and payments are separate and correct;
- market-run profit uses the intended cost snapshot.

## 32. Data Reconciliation Checkpoints

### 32.1 Production

`Order/Run Produced Meters = SUM(valid production_logs.meters)`

Exclude zero-meter downtime rows from quantity and wages.

### 32.2 Worker earnings

`Piece-Rate Gross = SUM(log meters × log worker_rate_snapshot)`

Do not recalculate old work using the worker’s current rate.

### 32.3 Stock

For a simple lot:

`Opening/Produced + Positive Adjustments - Negative Adjustments - Sold = Available`

Pending dispatch is a state of sold quantity, not additional available stock.

### 32.4 Dispatch

`Pending Dispatch = Sold Meters - SUM(Dispatched Meters)`

`Receipt Variance = Received Meters - Sent Meters`

Partial dispatch by itself is not a shortage.

### 32.5 Commercials

`Revenue = Sold Meters × Sale Rate`

`Cost = Sold Meters × Cost Snapshot`

`Booked Gross Profit = Revenue - Cost`

`Balance = Receivable Total - SUM(valid payment receipts)`

### 32.6 Payroll

`Net Payout = Gross + Inam - Kapaat - Advance Recovery - PF/ESI`

Confirm the exact persisted formula and statutory treatment with professional review before production reliance.

## 33. Performance and Capacity Tests

Use a seeded org with:

- 100 looms;
- 500 workers;
- 100 active/historical orders and runs;
- 100,000 production logs;
- 10,000 stock movements;
- 5,000 sales/receivables/payments;
- 12 months of payroll.

Measure:

| Surface | Target to agree before pilot |
| --- | --- |
| Supervisor shift load | Usable on factory phone and network |
| Production submit | Clear result without duplicate retry |
| Factory Today | Fast enough for daily opening |
| Orders/Market Runs | No timeout; pagination/cache correct |
| Stock | No frozen UI; summaries accurate |
| Dispatches/Commercials | Search and filters responsive |
| Payroll | Cycle preview completes predictably |

Also test concurrent submissions, database locks, RPC timeouts, Realtime reconnects, and stale query invalidation.

## 34. Pilot Operating Procedure

For the first pilot week:

- limit the pilot to agreed looms, one owner, and one supervisor;
- keep the paper register as a parallel control, not as a second source to edit later;
- reconcile shift meters daily;
- reconcile expected godown stock at sale/dispatch;
- review sold-not-dispatched, pending receipts, discrepancies, and overdue receivables daily;
- compare payroll preview with the paper calculation before settlement;
- do not rely on offline production, public tracking, or automated compliance claims;
- create a defect immediately when a workaround is used;
- do not silently repair database rows without recording the reason and before/after values.

### Daily owner sign-off

- [ ] All active looms accounted for with production or downtime reason.
- [ ] Order/run attribution correct.
- [ ] Worker attribution and rate snapshots correct.
- [ ] Today meters reconcile with supervisor register.
- [ ] New expected stock is reasonable.
- [ ] New sales have named parties and receivables.
- [ ] Pending dispatch and receipt queues are correct.
- [ ] Differences have an owner and next action.
- [ ] Payments and dates are correct.
- [ ] No unexplained console/server/Sentry error.

## 35. Final Sign-Off Checklist

### Product

- [ ] Order golden journey passed.
- [ ] Market golden journey passed.
- [ ] Real factory shift structure can log production.
- [ ] Historical regression pack passed.
- [ ] Stock, dispatch, money, and payroll reconciliations passed.
- [ ] Archived/deferred features are consistently described.

### Security and reliability

- [ ] Tenant isolation passed with two organizations.
- [ ] Production RLS/grants verified.
- [ ] High/critical dependency advisories resolved or formally accepted.
- [ ] Backup restore demonstrated.
- [ ] Monitoring and release attribution work.
- [ ] No secrets or PII leak in client/logs.

### Operations

- [ ] Owner and supervisor completed training.
- [ ] Pilot scope and workarounds documented.
- [ ] Daily reconciliation owner assigned.
- [ ] Bug reporting process ready.
- [ ] Rollback/disable plan ready.
- [ ] Support contact and response expectation agreed.

## 36. External References

The workflow assumptions in this guide were checked against:

- [Oracle: Make-to-Order](https://docs.oracle.com/en/applications/jd-edwards/supply-chain-manufacturing/9.2/eoabc/make-to-order.html)
- [SAP: Strategies for Make-to-Stock Production](https://help.sap.com/docs/SAP_S4HANA_CLOUD/2bba750d1e124e1ea2a039bb1cd9b6c5/3323bf53d25ab64ce10000000a174cb4.html)
- [SAP: Strategies for Make-to-Order Production](https://help.sap.com/docs/SAP_S4HANA_CLOUD/2bba750d1e124e1ea2a039bb1cd9b6c5/3b24bf53d25ab64ce10000000a174cb4.html)
- [GS1 Global Traceability Standard](https://www.gs1.org/standards/gs1-global-traceability-standard/current-standard)
- [CBIC: Electronic Way Bill Rules](https://cbic-gst.gov.in/ewaybill-rules.html)
- [MSME Samadhaan: Delayed Payment Monitoring](https://samadhaan.msme.gov.in/)
- [Ministry of Labour: Code on Wages guidance](https://www.labour.gov.in/static/uploads/2026/01/75252c07c1fe3a2f5571ff1464e2375e.pdf)

These references inform workflow and test design. They do not replace legal, tax, payroll, or labour-law review for the actual factory.
