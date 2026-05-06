# Weavly Master Feature Document

Last analyzed from the active codebase on May 6, 2026.

This document unifies the feature docs under `docs/features/`. It is organized around the user workflow rather than the file tree, because Weavly's value comes from how each feature hands off to the next.

## Unified Feature Loop

1. Owner sets up the factory, plan, machines, workers, payroll baseline, cost profile, join codes, WhatsApp, and access-code controls.
2. Owner estimates fabric cost and saves templates/quotes.
3. Owner converts accepted quotes to orders or starts market runs for speculative stock production.
4. Supervisor assigns workers and work to machines and logs shift production from meter readings.
5. Owner watches analytics for pace, production, machine utilization, and worker output.
6. Production becomes stock and dispatch-ready output.
7. Stock sales, market-run sales, quotes, and invoices feed commercial gross-profit visibility.
8. Owner settles payroll, recovers advances, records payment mode, and sends payslips/receipts over WhatsApp.
9. Billing, referrals, settings, access codes, audit, and compliance support the operating loop.

## Cross-Feature Dependencies

| Feature | Depends On | Feeds Into |
| --- | --- | --- |
| Onboarding and Settings | Auth, organizations, subscription, machines, workers | Estimator, production log, payroll, supervisor access |
| Estimator | Factory cost profile, fixed workers, loom assumptions | Templates, quotes, orders, market runs |
| Quotes | Estimator snapshots | Orders, re-estimation, expected commercials |
| Orders | Accepted quotes, machines, workers | Supervisor log, analytics, dispatches, commercials |
| Market Runs | Estimator snapshots | Supervisor log, stock inward drafts, stock sales, commercials |
| Supervisor Production Log | Machines, workers, orders/runs | Production logs, analytics, payroll, stock drafts |
| Analytics | Production logs, orders, machines | Owner decisions, order/run monitoring |
| Stock | Production output, market runs, orders | Dispatch, stock sales, commercials |
| Dispatches | Orders, packages/stock, parties | Tracking portal, receipt/shortage reconciliation |
| Commercials | Quotes, invoices, stock sales, market-run sales | Owner profit visibility |
| Payroll | Production logs, attendance, worker rates, advances | Settlements, payslips, debt recovery |
| Advances | Workers, settlements | Payroll deductions, WhatsApp receipts |
| WhatsApp | Worker/profile numbers, templates, edge functions | Operational communication logs |
| Billing and Referrals | Organizations, Razorpay, referral tables | Subscription access and growth |
| Compliance/Admin | Audit and legal records | Deferred governance workflows |

## 1. Onboarding, Settings, and Access

### What It Is

The setup layer that makes every operational workflow possible. Owners create the organization, establish a subscription/trial, add machines and workers, set payroll configuration, configure cost assumptions, generate join codes, and control protected actions with one-time access codes.

### User Workflow

1. Owner signs up.
2. Middleware routes incomplete owners to `/onboarding`.
3. Owner adds machines, workers, and payroll config.
4. Owner starts a trial or subscription where required.
5. Owner lands on `/owner/analytics`.
6. Owner manages ongoing factory settings in `/owner/settings`.
7. Supervisors join through `/join` using the current join code and land on the production log workspace.

### Pain Points Solved

- New digital systems fail when master data is incomplete.
- Supervisors need easy access without becoming owners.
- Protected changes need owner approval without sharing owner credentials.

### Digital Translation

- Register master lists become `machines`, `workers`, and `fixed_workers`.
- Owner verbal approvals become one-time access codes.
- WhatsApp opt-in and language choices become durable worker/profile settings.

## 2. Estimator and Quotes

### What It Is

The costing engine for fabric. It models yarn, loom, process, overhead, commission, transport, and margin assumptions, then saves repeatable templates and quote snapshots.

### User Workflow

1. Owner opens `/owner/estimator`.
2. Owner chooses a saved fabric template or starts from defaults.
3. Owner enters warp/weft rows and loom assumptions.
4. Owner reviews cost stack, landed cost, quote price, and margin.
5. Owner saves a template or quote.
6. Owner manages quote status in `/owner/quotes`.
7. Accepted quote becomes an order.
8. Estimator market mode creates a market run.

### Pain Points Solved

- Fabric pricing often relies on mental math, old Excel files, and memory.
- Yarn price, GST, crimp, shortage, and overhead omissions create hidden losses.
- Repeat qualities are re-entered too often.

### Digital Translation

- Parchi costing becomes a structured estimator state.
- Reusable qualities become estimator templates.
- Party offers become quote records with snapshots.

### Data and Code

- `lib/estimator.ts`
- `lib/finance.ts`
- `/owner/estimator`
- `/owner/quotes`
- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`

## 3. Orders and Market Runs

### What It Is

Orders are party-backed production commitments. Market runs are costed speculative production used to keep looms running for future sale.

### User Workflow

1. Owner marks a quote accepted.
2. Owner converts it into an active order with target meters and deadline.
3. Owner assigns machines and monitors pace.
4. Alternatively, owner creates a market run from estimator mode.
5. Supervisor logs production against the order or run.
6. Owner sees produced meters, remaining meters, pace, godown state, sales, and profit.

### Pain Points Solved

- Owners often do not know whether an order is on pace until it is late.
- Market production is treated informally even though it consumes loom time and working capital.
- Machine assignment gets lost between owner and supervisor.

### Digital Translation

- Whiteboard order tracking becomes order cards and progress/pace indicators.
- Speculative stock production becomes market-run records.
- Loom allocation becomes machine assignment.

### Data and Code

- `/owner/orders`
- `/owner/market-runs`
- `/owner/market-runs/[id]`
- `/owner/estimator/actions.ts`
- `/owner/orders/actions.ts`
- `orders`
- `market_runs`
- `market_run_sales`

## 4. Floor Operations and Supervisor Dashboard

### What It Is

The supervisor's primary shift workspace for assignments, machine status, and meter-based production logging.

### User Workflow

1. Supervisor opens `/supervisor/dashboard` or `/supervisor/production`.
2. Supervisor selects date and day/night shift.
3. Supervisor copies previous shift setup if useful.
4. Supervisor assigns worker and order/run to each machine.
5. Supervisor updates running/idle/maintenance status and breakdown details.
6. Supervisor enters closing readings.
7. Supervisor submits shift logs.
8. If a protected correction is needed, supervisor requests or enters an owner access code.

### Pain Points Solved

- Floor registers are delayed and error-prone.
- Owners cannot see machine status until someone calls.
- Payroll disputes happen when meters are copied manually.

### Digital Translation

- Production register becomes a mobile shift grid.
- Machine condition notes become status and breakdown records.
- Meter readings become production logs with rate snapshots.

### Data and Code

- `/supervisor/dashboard`
- `/supervisor/workers`
- `/supervisor/attendance`
- `/supervisor/machines`
- `app/(dashboard)/supervisor/actions.ts`
- `shift_assignments`
- `production_logs`
- `machines`

## 5. Production, Packing, and Stock

### What It Is

The bridge between logged meters and physical goods. The codebase has both package-style stock (`fabric_packages`) and the newer Phase 1 taka/godown stock board (`fabric_stock_lots` and related tables).

### User Workflow

1. Production logs establish that meters were woven.
2. Output can become packages or inward draft suggestions.
3. Owner confirms stock inward into taka lots.
4. Owner records godown, unit count, meters per unit, cost per meter, and source.
5. Owner adjusts stock when physical counts differ.
6. Owner records stock sales and sees realized profit.

### Pain Points Solved

- Owners know meters were produced but not always what physically exists.
- Godown stock is often tracked as loose memory or paper lists.
- Stock profit is hard to compute once fabric leaves the original order context.

### Digital Translation

- Taka lists become stock lots.
- Physical corrections become stock movements.
- Godown sale notes become stock sale records with revenue, cost, and profit.

### Data and Code

- `/owner/stock`
- `app/(dashboard)/owner/stock/actions.ts`
- `fabric_packages`
- `fabric_stock_lots`
- `fabric_stock_sales`
- `fabric_stock_movements`
- `fabric_stock_inward_drafts`

## 6. Dispatches and Tracking

### What It Is

The professional handoff layer for order output. Dispatches group sent meters and transport metadata and expose tracking to parties.

### User Workflow

1. Owner opens `/owner/dispatches` or the dispatch section inside an order.
2. Owner selects an order and available output.
3. Owner creates a dispatch with quantities and transport/GST/e-way details.
4. Owner shares tracking token/link.
5. Party or owner records received meters.
6. Shortage or extra received meters are visible for reconciliation.

### Pain Points Solved

- Dispatch details are scattered across challans, calls, and WhatsApp.
- Shortages are remembered late and become payment disputes.
- Parties want confidence that goods are on the way.

### Digital Translation

- Delivery/challan handoff becomes dispatch records.
- Shortage notes become sent-versus-received variance.
- Customer calls become a public tracking portal.

### Data and Code

- `/owner/dispatches`
- `/track/[token]`
- `components/dispatches/DispatchModals.tsx`
- `dispatches`
- `dispatch_package_lines`
- `party_dispatch_claims`

## 7. Commercials and Ledger

### What It Is

Phase 1 keeps the active `/owner/commercials` route as a lightweight gross-profit view. The deeper `/owner/ledger` route exists but is archived for Phase 1.

### User Workflow

1. Owner opens `/owner/commercials`.
2. Owner reviews realized revenue/profit and expected profit.
3. Owner filters by source: orders, stock, market runs, expected quotes.
4. Owner searches quality/reference/source and reviews revenue, cost, profit, and margin.

### Pain Points Solved

- Owners need profit visibility before full accounting is ready.
- Market-run and stock sale profit should not disappear into informal notes.

### Digital Translation

- Rough margin memory becomes a source-tagged profit table.
- Full accounting remains deferred until ledger polish returns to scope.

### Data and Code

- `/owner/commercials`
- `/owner/ledger` archived
- `app/(dashboard)/owner/commercials/actions.ts`
- `party_*` and supplier tables are deferred

## 8. Payroll and Settlements

### What It Is

The worker money layer. It converts production logs and attendance into pay, applies advances and deductions, records settlements, and sends payslips.

### User Workflow

1. Owner opens `/owner/payroll`.
2. Owner chooses a month.
3. Owner reviews meter workers and fixed workers.
4. Owner expands worker details for machine/order breakdown, gross pay, advances, deductions, and net.
5. Owner toggles final settlement where applicable.
6. Owner records payment mode and settles.
7. Owner generates PDF or sends WhatsApp payslip.

### Pain Points Solved

- Workers dispute pay when meters and rates are not itemized.
- Advance recovery is easy to over-deduct or under-document.
- PF/ESI and payment mode need a record.

### Digital Translation

- Payroll notebook becomes settlement records with itemization.
- Oral payout explanation becomes a payslip.
- Production logs become the wage source of truth.

### Data and Code

- `/owner/payroll`
- `lib/finance.ts`
- `lib/generate-payslip.ts`
- `payroll_settlements`
- `payroll_adjustments`
- `payroll_payments`

## 9. Advances Management

### What It Is

The Upaad ledger for meter and fixed workers. It records pending/deducted advances, shows debt load, and feeds payroll recovery.

### User Workflow

1. Owner opens `/owner/advances`.
2. Owner searches and selects a worker.
3. Owner sees pending and deducted advances.
4. Owner records a new advance with amount and description.
5. Payroll later deducts pending advances within configured caps.
6. Owner can delete or write off according to rules.

### Pain Points Solved

- Advance balances live in memory and cause disputes.
- Deductions can exceed worker trust or legal comfort.
- Final settlements need special handling.

### Digital Translation

- Upaad register becomes `worker_advances`.
- Payroll recovery becomes itemized deductions.

## 10. WhatsApp

### What It Is

The operational notification channel built on Meta WhatsApp Cloud API through Supabase Edge Functions.

### User Workflow

- Owner/supervisor triggers access-code request.
- System sends daily and monthly briefs.
- Payroll sends payslips.
- Advances send receipts.
- Deadline/pace alerts notify risk.
- Delivery attempts are logged and retried when needed.

### Pain Points Solved

- Workers and owners already coordinate on WhatsApp.
- Notifications need delivery visibility.
- Messaging should support, not block, operational writes.

## 11. Billing and Referrals

### What It Is

The commercial SaaS layer for trial, subscription, payment history, auto-renew/cancel, and referral growth.

### User Workflow

1. Owner opens `/owner/billing`.
2. Owner starts trial or subscribes to Base/Premium.
3. Razorpay webhook updates subscription and payment state.
4. Owner sees payment history and renewal/cancel state.
5. Owner shares referral code and tracks referral stats.

## 12. Compliance and Admin

### What It Is

Governance and legal infrastructure: notices, grievances, DPA, breach reports, exports, lockdowns, audit logs, compliance settings.

### Phase 1 Status

Implemented or partially implemented, but not launch-polish scope except where security or access control directly protects the core loop.

### Data and Code

- `/admin` archived
- `/owner/settings/audit` archived
- `/owner/settings/dpa` secondary/deferred
- `lib/actions/compliance.ts`
- `audit_log`
- `notice_registry`
- `grievances`
- `dpas`
- `organization_dpas`
- `breach_reports`

## Feature Readiness Principle

If a feature helps the owner quote, run looms, log production, understand stock/profit, dispatch professionally, or settle workers, it belongs in Phase 1. If it mainly serves future ERP depth, accounting completeness, or compliance administration, it should stay present but quiet until the core loop is production-ready.
