# Failure Data Impact Report

- Run: `PILOTQA-20260621-2058-8QIH`
- Source ledger: `results.json`
- Matrix: `TEST_MATRIX.md`
- Generated from completed pre-pilot matrix with `0 not_run`
- Current failure count: 3 total failures

## Current superseding checkpoint — 2026-07-14

The canonical ledger now contains only three `fail` rows: `WA-008`, `OFF-009`, and `OFF-010`. Current total counts are 287 pass, 3 fail, 86 blocked, and 1 not applicable. The 91-failure analysis below is retained as the original baseline impact record; its individual row labels are historical and do not supersede current `results.json` statuses.

Current impact remains No-Go: unsigned WhatsApp callback handling is still unsafe when the provider secret is absent, representative non-production mutations still lack complete unknown-timeout reconciliation, and slow/intermittent mobile operation remains only partially protected. B09 separately proved production-entry offline draft preservation, no false success on pre-request loss, and authoritative reconciliation of a delayed production response.

## Executive summary

The failures are not just UX or edge-case issues. Multiple failures can directly produce incorrect production, payroll, inventory, dispatch, or financial data.

Severity split:

| Severity group | Failure count | Business-data risk |
| --- | ---: | --- |
| Critical blockers | 10 | Directly breaks stock correctness or authorization boundaries; No-Go. |
| High severity | 31 | Can create duplicate/missing/corrupt production, dispatch, receivable, payroll, or ledger data; No-Go. |
| Medium severity | 49 | Can create wrong calculations, stale dashboards, audit gaps, user-driven bad data, or incomplete operational proof. |
| Low severity | 1 | Transient stale display after sale; still affects operator trust. |

## Data impact legend

- Production = production logs, order/run attribution, loom/worker assignment, production dates or quantities.
- Payroll = attendance, worker rates, advances/kharchi, payroll settlement/reversal, payslip/export values.
- Inventory = stock lots, stock availability, stock history, expected stock.
- Dispatch = dispatch batch, receipt, pending dispatch, shortage/excess, delivery state.
- Financial = costing, sales, receivables, payments, profit ledger, due dates, party balances.
- All = security/authorization issue can mutate or expose multiple business domains.

## Failures most likely to cause incorrect business data

| Domain | Highest-risk failures |
| --- | --- |
| Production | `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `ORDER-005`, `ORDER-009`, `PROD-002`, `PROD-011`, `PROD-016`, `PROD-028`, `MASTER-014`, `PROD-013`, `PROD-022`, `OFF-010`, `TIME-002`, `SIGNOFF-01`, `SIGNOFF-02` |
| Payroll | `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `PROD-011`, `ORDER-005`, `PAY-006`, `PAY-013`, `PAY-015`, `PAY-018`, `PAY-020`, `PAY-027`, `PAY-028`, `OFF-008`, `DASH-003`, `PROD-004`, `EST-003`, `ORDER-001`, `ORDER-002` |
| Inventory | `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `ORDER-005`, `ORDER-009`, `PROD-011`, `SALE-015`, `DASH-007`, `SIGNOFF-05`, `SIGNOFF-07`, `STOCK-017` |
| Dispatch | `DISP-003`, `DISP-007`, `DISP-010`, `DISP-019`, `GOLDEN-B-09`, `SALE-015`, `DASH-007`, `SIGNOFF-07`, `SIGNOFF-08`, `ORDER-008`, `COMM-002`, `STOCK-017` |
| Financial | `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, `EST-003`, `EST-017`, `EST-019`, `ORDER-001`, `ORDER-002`, `SALE-015`, `COMM-002`, `COMM-010`, `COMM-012`, `COMM-014`, `COMM-016`, `PAY-013`, `PAY-015`, `PAY-018`, `PAY-020`, `PAY-023`, `PAY-024`, `PAY-027`, `PAY-028`, `SIGNOFF-06`, `SIGNOFF-09` |

## Critical blockers

These are the immediate pilot blockers. They either proved incorrect stock/business totals in the QA run or proved that authorization can be bypassed.

| ID | Impacted data | Failure summary | Business-data consequence |
| --- | --- | --- | --- |
| `PROD-016` | Production, Inventory, Dispatch, Financial | Editing production to downtime updated `production_logs` but left the generated 25.25m stock lot. | Production correction is not atomic; stock, saleable inventory, dispatch capacity, and financial stock value can be overstated. |
| `PROD-028` | Production, Inventory, Dispatch, Financial | Production logs reconciled, but order stock totaled 256.00m instead of 230.75m after correction. | Downstream totals do not change exactly once; inventory and financial reporting can diverge from real production. |
| `STOCK-015` | Inventory, Dispatch, Financial | Order stock summary was overstated because stale corrected-away stock remained. | Operators can sell/dispatch/report stock that should not exist. |
| `SEC-002` | All | Authenticated users can update `public.profiles.role` and `org_id`. | Any domain can be corrupted by unauthorized role/org mutation. |
| `SEC-003` | All | Profile RLS does not protect authorization fields. | The tenant/role boundary is not reliable. |
| `SEC-004` | All | Server authorization derives from mutable profile data. | Server-side writes can be authorized from user-mutated role/org values. |
| `SEC-005` | All | Supervisor can self-escalate to owner by mutating profile role and refreshing claims. | Owner-only production, payroll, inventory, dispatch, and finance actions are bypassable. |
| `GOLDEN-A-12` | Production, Inventory, Dispatch, Financial | Golden A correction updated production rows but not generated order stock. | Customer-order golden journey cannot be trusted after correction. |
| `GOLDEN-A-14` | Inventory, Dispatch, Financial | Order-linked stock exists but is wrong: 230.75m production produced 256.00m stock. | Order stock is invalid as a source for sale/dispatch/close-out. |
| `SIGNOFF-05` | Inventory, Dispatch, Financial | Expected stock could not be signed off because stale order stock remained. | Daily stock sign-off is not reliable. |

## High severity failures

| ID | Impacted data | Failure summary | Business-data consequence |
| --- | --- | --- | --- |
| `TECH-001` | Release reliability | `npm ci` fails because lockfile and package manifest are out of sync. | Release builds are not repeatable; fixes can fail to install or deploy consistently. |
| `TECH-005` | Security, indirect All | Runtime dependency audit reported high-severity `form-data` advisory. | Supply-chain/runtime exposure could affect production trust; not a direct calculation bug. |
| `TECH-006` | Security, indirect All | Full audit reported high-severity advisory families. | Same release/security risk as above, broader scope. |
| `TECH-007` | All | Production migrations lag repository migrations. | Production database behavior can differ from reviewed code; any business calculation relying on later migrations may be wrong. |
| `TECH-009` | Notification/audit status | WhatsApp webhook does not fail closed when `META_APP_SECRET` is missing. | Delivery/callback state can be spoofed or processed unsigned; indirect financial/ops trust issue. |
| `TECH-010` | Observability | Sentry release/source maps not uploaded. | Production data defects become harder to trace and fix; not itself a data mutation bug. |
| `AUTH-016` | All | Locked-tenant write enforcement is inconsistent. | Locked organizations can still mutate production, stock, dispatch, payroll, and receivable tables. |
| `EST-017` | Production, Inventory, Financial | Estimator save and market-run creation are not idempotent/server-transactional. | Duplicate quotes, runs, and backing orders can create duplicate production anchors and financial plans. |
| `ORDER-005` | Production, Payroll, Inventory, Dispatch, Financial | Over-target production is not capped or explicitly handled at the database/RPC boundary. | Production can exceed target and feed inflated stock, payroll, pace, and financial numbers. |
| `ORDER-009` | Production, Payroll, Inventory, Dispatch, Financial | Cancelled orders can still receive production through the lower boundary. | Cancelled work can create false production, stock, wages, and downstream sales. |
| `PROD-002` | Production, Payroll, Inventory | Day-only factories are blocked unless both day/night workers are assigned. | Valid production may be missing from the system, causing understated production, stock, and wages. |
| `PROD-011` | Production, Payroll, Inventory, Dispatch, Financial | Negative meters are blocked in UI/server action but not authenticated RPC/database boundary. | Negative production can corrupt totals, wages, stock, dispatch availability, and financial reports. |
| `SALE-015` | Inventory, Dispatch, Financial | Sale RPC has no idempotency key. | Duplicate sales and receivables can be created while stock remains available. |
| `DISP-003` | Dispatch, Inventory, Financial | Second dispatch batch failed with package-number unique constraint. | Remaining sold quantity cannot be dispatched correctly; receivable/delivery state can stall. |
| `DISP-007` | Dispatch, Inventory, Financial | Exact receipt marked delivered but left receipt fields contradictory/null. | Delivered inventory and receipt status disagree; follow-up queue can hide real state. |
| `DISP-019` | Dispatch, Inventory, Financial | Completed dispatch disappeared from Dispatches and receipt columns contradicted status. | Dispatch audit trail and delivery state are unreliable. |
| `COMM-016` | Financial | Profit Ledger filters misclassify market/manual stock profit. | Revenue, cost, and profit reports by origin can be wrong. |
| `PAY-006` | Payroll | Future/past attendance protections are not enforced at RLS/database boundary. | Direct writes can create invalid attendance, affecting salary/attendance payroll. |
| `PAY-018` | Payroll, Financial | Legacy settlement RPCs remain executable without required payment mode/owner verification. | Payroll can be settled outside the intended approval/payment trail. |
| `PAY-020` | Payroll, Financial | Legacy payroll reversal RPCs bypass one-time access code. | Paid payroll can be reversed without the required authorization trail. |
| `PAY-027` | Payroll, Financial | Online kharchi inserts advance and float transaction separately; partial success returns success. | Worker advance and supervisor float balance can diverge. |
| `PAY-028` | Payroll, Financial | Offline kharchi queues to missing table and can show a misleading sync toast. | Offline worker advances may never reach payroll/float ledgers. |
| `DASH-007` | Inventory, Dispatch, Financial | Factory Today showed all sold stock dispatched while DB still had 30m pending. | Owner daily dashboard can falsely clear dispatch/receivable work. |
| `OFF-008` | Payroll, Financial | Offline kharchi sync targets nonexistent `kharchi_offline` table. | Same as `PAY-028`; offline money entries do not become real ledger rows. |
| `SEC-006` | All | Access-code brute-force/lockout is inconsistent and partially fail-open. | Protected production correction, payroll reversal, deletion, and owner-only workflows are easier to bypass. |
| `GOLDEN-A-11` | Production, Inventory, Dispatch, Financial | Re-submit/edit avoided duplicate production rows but left stale stock. | Duplicate protection does not preserve downstream stock invariants. |
| `GOLDEN-B-09` | Dispatch, Inventory, Financial | Second market dispatch failed due package-number uniqueness. | Market-run two-batch dispatch journey cannot complete reliably. |
| `SIGNOFF-01` | Production, Payroll, Inventory | Not all active looms can be confidently accounted for with production/downtime. | Daily production and wage basis can be incomplete. |
| `SIGNOFF-02` | Production, Payroll, Inventory, Dispatch, Financial | Order/run attribution cannot be signed off. | Production, sales, stock, receivables, and payroll may attach to wrong/cancelled work. |
| `SIGNOFF-07` | Inventory, Dispatch, Financial | Daily sign-off queue missed 30m pending dispatch. | Owner can close the day with unresolved dispatch/stock obligation. |
| `SIGNOFF-10` | All, Observability | Known server/runtime errors and missing Sentry release mapping remain. | Data defects may be hidden, repeated, or hard to diagnose in pilot. |

## Medium severity failures

| ID | Impacted data | Failure summary | Business-data consequence |
| --- | --- | --- | --- |
| `TECH-013` | Release reliability | No `test` script/CI workflow gate. | Data fixes can be released without automated regression coverage. |
| `AUTH-008` | Security, indirect All | Join-code brute-force/rate-limit protections are incomplete. | Unauthorized org access risk; downstream data risk if exploited. |
| `SETUP-011` | Production setup, Dashboard | Factory Today setup checklist did not consistently recognize completed costing/setup. | Owner can see misleading setup state; may block or misdirect operational readiness. |
| `MASTER-002` | Production, Payroll, Inventory | Duplicate loom names are not prevented. | Production and assignment attribution can become ambiguous. |
| `MASTER-005` | Production, Inventory, Payroll | Machine deletion protection is inconsistent. | Historical machine-linked production/assignment data can be orphaned or protected inconsistently. |
| `MASTER-014` | Production, Payroll, Inventory | Assignment update path is not atomic. | Dated assignment, standing assignment, and current order can diverge, corrupting production attribution and wage basis. |
| `EST-003` | Payroll, Financial | ₹2.50/m rate persisted/displayed as floating drift. | Worker-rate snapshots and commercial math can carry precision error. |
| `EST-011` | Financial, Production planning | Estimator save lacks server-boundary validation. | Bad estimate inputs can persist and feed quotes/orders/runs. |
| `EST-019` | Payroll, Financial | Snapshot economics drift across quote/order/commercials. | Financial and wage basis may not equal entered economics. |
| `QUOTE-003` | Financial, Production planning | Quote transition model is inconsistent. | Quote/order lifecycle state can be misleading for financial commitment. |
| `QUOTE-007` | Financial, Production planning | Start Party Order fast path is not a single transaction. | Accepted quote can exist without consistent active order linkage. |
| `QUOTE-010` | Financial estimate drafts | Restoring quote overwrites local estimator draft without warning. | User can accidentally use wrong costing/quote snapshot. |
| `ORDER-001` | Payroll, Financial | Order copied rate as floating drift. | Payroll and order economics inherit incorrect precision. |
| `ORDER-002` | Payroll, Financial | Supervisor order worker rate displays/stores floating drift. | Worker wage basis can visibly mismatch intended rate. |
| `ORDER-006` | Production, Inventory, Financial | Target/deadline edits lack audit and do not enforce target >= produced. | Pace/progress and production planning can become mathematically inconsistent. |
| `ORDER-008` | Production, Inventory, Dispatch, Financial | Completing below target lacks confirmation/warning. | Owner can prematurely close orders with remaining production/dispatch obligations. |
| `PROD-004` | Production, Payroll | Substitute worker cannot be intentionally logged unless assignment is remapped. | Actual worker/wage attribution can be wrong or blocked. |
| `PROD-013` | Production, Payroll, Inventory, Financial | Very large meter values have no explicit suspicious-value behavior. | Typo can inflate production, stock, wages, and revenue/cost basis. |
| `PROD-022` | Production, Payroll, Inventory | Date-change draft isolation was unreliable in observed UI. | Production can be saved to the wrong date/shift. |
| `PROD-023` | Production, Payroll, Inventory | Restored drafts are not clearly marked unsaved. | Old draft values can be mistaken for current production. |
| `PROD-029` | Production | Landing copy says meter readings, but app records shift totals. | Operator misunderstanding can lead to wrong entry method. |
| `STOCK-016` | Inventory, Financial audit | Stock movement history is capped at 500 with no pagination. | Older inventory movements can be hidden from audit/reconciliation. |
| `DISP-010` | Dispatch, Inventory, Financial | Zero received meters can be accepted. | Receipt/difference logic can create misleading zero-receipt delivered/shortage states. |
| `COMM-002` | Inventory, Dispatch, Financial | Direct market-run sale path creates no commercial receivable. | Sale can exist without matching receivable/collection workflow. |
| `COMM-010` | Financial audit | Payment dialog cannot capture cheque number/date/bank fields. | Cheque collections lack required financial metadata. |
| `COMM-012` | Financial | Due/overdue classification is not consistently IST-safe. | Receivables can be bucketed as due/overdue on the wrong day. |
| `COMM-014` | Financial reporting | Top Parties card omits last-sale/overdue details. | Owner view lacks required party-risk signals. |
| `PAY-013` | Payroll, Financial | PF/ESI formulas diverge between UI preview and settlement RPC. | Preview net pay can differ from persisted settlement. |
| `PAY-015` | Payroll, Financial | High-gross ESIC preview/settlement can disagree. | Worker payout shown before settlement can be wrong. |
| `PAY-023` | Payroll, Financial reporting | Payslip PDF omits adjustments/statutory/debt/payment/cycle details. | Worker-facing payroll document can be incomplete or misleading. |
| `PAY-024` | Payroll, Financial reporting | Payroll CSV export can read PF/ESI from wrong fields. | Exported statutory deductions can appear as zero despite deductions. |
| `DASH-003` | Production, Payroll, Financial dashboard | Factory Today hard-codes gross wages to 0. | Owner dashboard payroll signal is wrong after production. |
| `DASH-004` | Production, Payroll, Financial analytics | Historical analytics date mixes historical KPI with current orders/machines/trend. | Historical reporting can show blended/current values. |
| `WA-008` | Notification status, audit | Unsigned WhatsApp callbacks accepted when secret missing. | Delivery status can be spoofed/misleading. |
| `OFF-002` | Offline operations | Offline fallback resolves to login. | Offline operator flow fails; not direct business data corruption. |
| `OFF-005` | All, stale display/privacy | Persisted cache and IndexedDB queue are not cleared on logout/account switch. | Prior org/user data can appear or replay after account switch. |
| `OFF-006` | All, stale display/privacy | Logout clears session but not persisted React Query/local drafts/IndexedDB queue. | Same stale data/replay risk as `OFF-005`. |
| `OFF-007` | Production, Financial drafts | Service worker update lacks draft-aware refresh UX. | Unsaved production/estimate/payment drafts can be lost or refreshed unexpectedly. |
| `OFF-009` | All | Unknown timeout outcomes are not distinguished from definite failure. | Users may retry and duplicate, or assume failure when mutation succeeded. |
| `OFF-010` | Production, Payroll, Inventory | Production logging is not offline-queued. | Patchy mobile network can drop/miss production and downstream wages/stock. |
| `TIME-002` | Production, Payroll, Dispatch, Financial | Date-only rendering is timezone unstable in reviewed paths. | Dates can shift by one day in reports, payslips, orders, due dates, or dispatch displays. |
| `SEC-009` | Privacy/audit | Owner data export lacks active UI wiring/audit event/redaction review. | Compliance/audit gap; not a direct business calculation bug. |
| `SEC-014` | Payroll document/security | Payslip PDF filename is not safely normalized. | Payroll document export can be unsafe/inconsistent. |
| `SEC-015` | All audit | Settings audit coverage is incomplete. | Changes affecting org/settings/compliance cannot be fully reconstructed. |
| `SEC-016` | Production/offline trust | Privacy policy says offline production syncs via IndexedDB; implementation does not. | Legal/product claim mismatch around production data persistence. |
| `SEC-017` | Compliance | Worker age gate is only checkbox attestation. | Compliance risk; not direct production/payroll math corruption. |
| `SIGNOFF-06` | Inventory, Dispatch, Financial | Normal sale path works, but direct market-run sale can bypass receivable. | Sales/receivables boundary is inconsistent. |
| `SIGNOFF-08` | Dispatch, Inventory, Financial | Difference queue cannot be signed off due receipt-state contradictions. | Owner cannot reliably resolve shortages/excesses. |
| `SIGNOFF-09` | Dispatch, Financial | Payments/dates cannot be globally signed off. | Collections and due dates can be incomplete or timezone-wrong. |

## Low severity failures

| ID | Impacted data | Failure summary | Business-data consequence |
| --- | --- | --- | --- |
| `STOCK-017` | Inventory, Dispatch, Financial display | Immediately after sale, Godown Stock showed stale availability/pending dispatch until reload. | Transient stale display can cause operator confusion, but reload corrected it. |

## Critical blocked follow-on steps caused by these failures

These are not counted in the 91 failure rows, but they show the downstream blast radius. The guide could not complete the following critical golden steps because earlier defects invalidated the flow:

- Golden A: `GOLDEN-A-13`, `GOLDEN-A-15`, `GOLDEN-A-16`, `GOLDEN-A-17`, `GOLDEN-A-18`, `GOLDEN-A-19`, `GOLDEN-A-20`, `GOLDEN-A-21`, `GOLDEN-A-22`, `GOLDEN-A-23`, `GOLDEN-A-24`
- Golden B: `GOLDEN-B-12`, `GOLDEN-B-17`, `GOLDEN-B-18`

## Practical fix priority by business-data risk

1. Authorization boundary: `SEC-002`, `SEC-003`, `SEC-004`, `SEC-005`, then `SEC-006`.
2. Production correction and stock generation: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`.
3. Production RPC guards: `PROD-011`, `ORDER-005`, `ORDER-009`, `PROD-013`, `PROD-004`.
4. Dispatch/receipt correctness: `DISP-003`, `DISP-007`, `DISP-019`, `GOLDEN-B-09`, `DISP-010`.
5. Sales/receivables idempotency and boundary consistency: `SALE-015`, `COMM-002`, `COMM-016`, `SIGNOFF-06`.
6. Payroll/money integrity: `PAY-006`, `PAY-018`, `PAY-020`, `PAY-027`, `PAY-028`, `PAY-013`, `PAY-015`, `OFF-008`.
7. Offline/cache/time reliability: `OFF-005`, `OFF-006`, `OFF-009`, `OFF-010`, `TIME-002`.
