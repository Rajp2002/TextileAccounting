# Current Product Implementation Analysis

Last analyzed from the active codebase on May 10, 2026.

This document is intended to be the source of truth for the current implementation of the product. It describes what the app actually does today, how the features connect, what records are created, what outputs users get, and where current implementation realities differ from the ideal product narrative.

It is written from the product outward, but grounded in the codebase: Next.js App Router pages, Server Actions, Supabase tables, RPCs, migrations, Edge Functions, middleware, and client workflows.

## 1. Product Summary

Weavly is a multi-tenant textile operations SaaS for weaving factories. It is not implemented as a generic ERP. The current product is shaped around real factory workflows:

- fabric costing before production starts
- quotes and accepted party work
- speculative market production when looms need to stay busy
- day/night shift production logging by supervisors
- meter readings on looms
- machine and worker assignment
- piece-rate payroll
- fixed-worker attendance and salary payroll
- worker advances and kharchi
- takas and stock in godown
- dispatch batches, public tracking, and receipt reconciliation
- gross profit visibility
- WhatsApp-based operational messaging
- owner access codes for protected actions
- subscription, referral, and tenant controls

The product center is a production-to-money loop:

1. Owner sets up the factory.
2. Owner estimates fabric cost.
3. Owner saves a quote or starts a market run.
4. Accepted quotes become orders; market runs create speculative production anchors.
5. Supervisor logs shift production against machines, workers, and orders/runs.
6. Production feeds analytics, payroll, stock inward drafts, and progress tracking.
7. Stock is confirmed into godown, sold, dispatched, and reconciled.
8. Commercials and payroll turn operational events into money visibility.

## 2. Implementation Architecture

### Application Stack

The app is implemented as a Next.js App Router application with React client surfaces where interaction is heavy. Supabase is the main backend:

- Supabase Auth for sessions.
- Supabase Postgres for tenant data.
- Row Level Security and server-side role checks for access control.
- Supabase RPCs for atomic multi-table workflows.
- Supabase Realtime for live dashboard/order/production updates.
- Supabase Edge Functions for WhatsApp, scheduled briefs, alerts, and related operational messaging.

Supporting libraries and services include:

- TanStack Query for client-side data fetching and optimistic updates.
- Dexie/IndexedDB for offline-adjacent mutation queueing.
- Razorpay for subscriptions and payment webhooks.
- Meta WhatsApp Cloud API through Supabase Edge Functions.
- Upstash rate limiting for auth, access-code, and tracking surfaces.
- Sentry for application monitoring.
- jsPDF and qrcode for generated documents and tracking shares.

### Tenant Model

The product is organization-scoped. The core tenancy concepts are:

- `organizations`: factory tenant, plan/lockdown/join-code/settings owner.
- `profiles`: authenticated users with role and `org_id`.
- `owner` role: commercial, planning, payroll, stock, dispatch, settings.
- `supervisor` role: floor execution, production logging, workers/attendance support.
- `admin` role: governance and compliance, currently mostly outside active Phase 1 navigation.

Most operational tables carry `org_id`. Server Actions read the authenticated profile, verify role, and then query or mutate records for that organization. Security-sensitive operations also validate owner-only access or use owner access codes.

### Routing and Guarding

The middleware is a major product boundary. It handles:

- public routes such as landing, login, signup, legal pages, and tracking links
- authenticated route protection
- API protected-route JSON 401 responses
- auth/signup rate limiting
- Supabase session refresh
- session revocation checks
- one-hour inactivity enforcement through `last_activity`
- auth-page redirects by role
- owner onboarding enforcement
- archived Phase 1 route redirects
- tenant lockdown redirects to `/locked`
- role-based route access

Active owner routes include:

- `/owner/analytics`
- `/owner/estimator`
- `/owner/quotes`
- `/owner/orders`
- `/owner/market-runs`
- `/owner/market-runs/[id]`
- `/owner/stock`
- `/owner/dispatches`
- `/owner/commercials`
- `/owner/payroll`
- `/owner/advances`
- `/owner/fixed-workers`
- `/owner/machines`
- `/owner/billing`
- `/owner/settings`

Active supervisor routes include:

- `/supervisor/dashboard`
- `/supervisor/production`
- `/supervisor/workers`
- `/supervisor/attendance`
- `/supervisor/machines`

Archived or deferred routes are redirected by `lib/phase1-scope.ts`:

- `/admin`
- `/owner/inventory`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`

Some code still exists for archived modules. The middleware prevents those modules from being treated as active Phase 1 product surface.

## 3. Core Data Model

The current implementation revolves around these records and relationships.

### Setup and Identity

- `organizations`: factory, join code, lockdown state, settings, subscription context.
- `profiles`: user role, org membership, identity metadata.
- `org_subscriptions`, `subscription_payments`: billing state.
- `payroll_configs`: cycle-start configuration for payroll.
- `factory_cost_profile`: reusable costing defaults for estimator and market runs.

### Factory Master Data

- `machines`: looms, machine status, loom type, current order, default rate.
- `workers`: meter workers used in production logs and piece-rate payroll.
- `fixed_workers`: fixed salary or daily workers used in attendance, overhead, and payroll.
- `machine_assignments`: standing worker/machine assignment.
- `shift_assignments`: date/shift-specific machine, worker, order, and rate assignment.

### Estimator and Commercial Intent

- `estimator_templates`: reusable fabric recipes and costing assumptions.
- `estimator_quotes`: quote snapshots with estimator state, cost result, party, quality, status, and conversion links.
- `order_yarn_requirements`: derived yarn requirement snapshot for converted orders and market-run backing orders.

### Production Work

- `orders`: party-backed production commitments and backing production anchors for market runs.
- `market_runs`: speculative costed production runs.
- `production_logs`: supervisor-submitted shift production by machine, worker, order, date, and shift.

### Stock, Dispatch, and Sales

- `fabric_stock_inward_drafts`: production-to-stock staging records generated from production logs.
- `fabric_stock_lots`: physical godown stock lots, usually takas.
- `fabric_stock_sales`: stock sale records with revenue, cost, profit, and optional dispatch link.
- `fabric_stock_movements`: inward, sale, adjustment, and audit movement trail.
- `dispatches`: dispatch batches for orders, including tracking token context and e-way fields.
- `dispatch_package_lines`: link between dispatches and physical/sold-stock package lines.
- `fabric_packages`: legacy and bridge package records, still used by dispatch creation.
- `market_run_sales`: direct market-run sales path at the database/action level.
- `party_invoices`: invoice records used by ledger/commercials flows.

### Payroll and Cash

- `worker_advances`: owner advances and supervisor kharchi, later deducted through payroll.
- `payroll_settlements`: closed payroll cycle records.
- `payroll_adjustments`: bonuses, deductions, and other cycle-level adjustments.
- `supervisor_float_transactions`: supervisor float disbursement/refill history.

### Communication, Compliance, and Audit

- `whatsapp_delivery_log`: message delivery attempts and retry state.
- audit/compliance tables: grievances, notices, DPA, breach reports, export logs, lockdown events.

### Primary Implementation Index

| Product Area | Main Routes and Components | Main Server/Data Logic |
| --- | --- | --- |
| Auth and onboarding | `app/(auth)`, `/login`, `/signup`, `/join`, `/onboarding` | `middleware.ts`, `app/(auth)/actions/auth.ts`, `lib/auth.ts` |
| Owner shell | `app/(dashboard)/owner/layout.tsx`, `components/navigation/owner-sidebar.tsx` | role guard through `requireRole(['owner'])` |
| Supervisor shell | `app/(dashboard)/supervisor/layout.tsx`, `components/navigation/supervisor-nav.tsx` | role guard through `requireRole(['supervisor', 'owner'])` |
| Estimator | `/owner/estimator`, `EstimatorClient.tsx` | `lib/estimator.ts`, `app/(dashboard)/owner/estimator/actions.ts` |
| Quotes | `/owner/quotes`, `QuotesClient.tsx` | `getEstimatorQuotes`, `updateQuoteStatus`, `convertAcceptedQuoteToOrder` |
| Orders | `/owner/orders`, `OrdersClient.tsx` | `app/(dashboard)/owner/orders/actions.ts`, `order_progress_summary`, `convert_accepted_quote_to_order` |
| Market runs | `/owner/market-runs`, `/owner/market-runs/[id]` | `market_runs`, `market_run_summary`, `createMarketRunFromEstimator`, `create_market_run_sale` |
| Supervisor production | `/supervisor/dashboard`, `/supervisor/production` | `getShiftSetupData`, `upsertShiftAssignment`, `bulkLogProduction`, `replace_shift_production_logs` |
| Stock and godown | `/owner/stock`, `TakaStockClient.tsx` | `fabric_stock_lot_summary`, `fabric_stock_inward_drafts`, `confirm_stock_inward_draft`, `record_fabric_stock_sale` |
| Dispatch and tracking | `/owner/dispatches`, order drawer dispatch UI, `/track/[token]` | `create_stock_sale_dispatch`, `get_order_tracking_data`, `confirm_fabric_dispatch_receipt` |
| Commercials | `/owner/commercials` | `commercial_profit_entries`, `app/(dashboard)/owner/commercials/actions.ts` |
| Payroll | `/owner/payroll` | `toggleWorkerPaid`, `settle_worker_payroll`, `unsettle_worker_payroll`, `lib/payroll-cycle.ts` |
| Advances and kharchi | `/owner/advances`, supervisor kharchi dialog | `worker_advances`, `recordKharchi`, supervisor float actions |
| Workers and machines | `/owner/machines`, `/owner/fixed-workers`, `/supervisor/workers`, `/supervisor/attendance` | owner/supervisor actions, `machines`, `workers`, `fixed_workers`, attendance tables |
| WhatsApp | settings UI, payslip/advance/access-code flows | `supabase/functions/*`, `supabase/functions/_shared/whatsapp.ts`, `whatsapp_delivery_log` |
| Billing and referrals | `/owner/billing` | Razorpay API routes, webhook route, `lib/subscription.ts`, `lib/referral.ts` |
| Deferred governance | archived admin/audit/system routes | `lib/actions/compliance.ts`, `lib/phase1-scope.ts` |

## 4. Feature Implementation Deep Dive

### 4.1 Setup, Onboarding, Settings, and Access Codes

#### User Interaction

Owners sign up, create or join an organization, and are routed through onboarding until the app has enough factory data to operate. Onboarding asks for machines, workers, payroll baseline, and plan/subscription context. Supervisors join through `/join` using the current organization join code.

Ongoing setup lives in `/owner/settings`. It includes organization name, join code controls, WhatsApp preferences, factory cost profile, message templates, supervisor float, access-code tools, security controls, and data export/delete controls.

#### Logic and Output

The middleware keeps incomplete owners inside onboarding. Owner settings update organization-level values, access-code hashes, join codes, WhatsApp preferences, and cost assumptions. Access-code generation stores a hashed code and expiry. Protected actions validate and consume a code rather than sharing owner credentials with supervisors.

#### Value Provided

Setup turns informal master data into the foundation for every downstream workflow. Machines power production logs. Workers power payroll. Fixed workers can feed overhead and salary payroll. Payroll config determines settlement cycles. Access codes let owners approve risky corrections without being present on the floor.

#### Connected Features

Setup feeds estimator, production logging, payroll, supervisor access, WhatsApp, billing, and tenant security. Without setup records, the rest of the loop either cannot calculate or cannot be safely assigned.

### 4.2 Estimator and Cost Analysis

#### User Interaction

The owner works in `/owner/estimator`. The estimator supports quote mode and market-run mode. The owner can:

- load a saved fabric template
- enter warp rows and weft rows
- set yarn rate, GST, denier, ends, picks, reed space, shortage, and crimp
- set tape length and production assumptions
- select loom type and edit RPM, power, hours, and efficiency assumptions
- configure warping, sizing, winding, processing, finishing, commission, transport, and margin
- include or exclude costing sections
- use a factory cost wizard/profile
- include fixed workers in overhead assumptions
- run scenarios such as yarn price increase, lower output, break-even, or custom target price
- save a template
- save a quote
- create a market run when in market mode

The UI also warns when critical inputs are missing, such as no warp/weft rows, missing order quantity, missing loom wage, or an unconfigured overhead profile.

#### Core Logic

`lib/estimator.ts` is the authoritative estimator engine. `calcFullTotals` is the central math path.

The estimator calculates yarn and conversion cost per meter from fabric structure:

- Warp kg per 100 meters = beam ends * denier * 100 / 9,000,000.
- Weft kg per 100 meters = picks * cloth width in cm * denier * 100 / 9,000,000.
- Yarn cost applies yarn rate, GST, shortage, and crimp assumptions.
- Warp includes warp crimp and shortage.
- Weft carries the configured loom-wide shortage burden.
- Weaving cost uses total picks multiplied by per-pick cost in paisa.
- Warping and sizing are per-kg process costs.
- In-house sizing makes effective sizing cost zero; outsourced sizing uses the configured sizing rate.
- Winding, processing, and finishing are optional layers.
- Overhead is resolved from monthly overhead items divided by monthly output unless a positive per-meter override is supplied.
- Electricity and depreciation overhead items can be auto-computed from loom count and machine assumptions.
- Commission and transport convert production cost into landed cost.
- Profit percentage converts landed cost into quote price.
- Order quantity converts per-meter margin into total value and gross profit.

The estimator also computes beam capacity from tape length and warp crimp. It stores enough snapshot data for later order/quote audit.

#### Outputs

The estimator can create or update:

- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`
- `market_runs`
- backing `orders` for market runs
- `order_yarn_requirements`

Estimator quote snapshots include the input state and result state, so later changes to yarn rates or overhead defaults do not rewrite historical quote economics.

#### Value Provided

The estimator replaces calculator, Excel, and memory-based costing with a reusable and auditable fabric cost model. It gives the owner visibility into yarn burden, loom conversion, overhead, commission, transport, margin, scenario risk, and total commercial value before production starts.

#### Connected Features

Estimator feeds quotes, quote re-estimation, order creation, market-run creation, yarn requirement snapshots, commercials expected profit, and order cost drawers.

### 4.3 Quote History and Quote Conversion

#### User Interaction

The owner manages quote status in `/owner/quotes`. Quotes can be filtered by status and moved through:

- `draft`
- `sent`
- `accepted`
- `rejected`

The implemented status path prevents arbitrary conversion. A quote can be converted only after it is accepted. Converted quotes show their linked order and cannot be status-changed again.

The owner can also re-estimate a quote. The client writes the quote snapshot into local storage and routes back to the estimator so the prior assumptions become the working draft.

#### Logic and Output

The direct estimator-to-order path is intentionally retired. `convertQuoteToOrder` returns an error telling the user to save, accept, and convert from Quote History.

`convertAcceptedQuoteToOrder` validates:

- owner role
- quote exists in the current organization
- quote status is `accepted`
- quote is not already converted
- target meters are positive

It then calls the atomic database RPC `convert_accepted_quote_to_order`. The RPC locks the quote, creates an order, writes the quote/order cross-links, and protects against double conversion.

After the order is created, the action rehydrates the estimator snapshot, recomputes yarn requirements, and upserts `order_yarn_requirements`.

#### Value Provided

Quote History creates commercial discipline. It separates costing, offer state, customer acceptance, and production commitment. This prevents accidental production from unaccepted drafts and preserves the economics that were agreed before production began.

#### Connected Features

Accepted and converted quotes feed active orders, expected commercials, order cost drawers, yarn requirement snapshots, and downstream dispatch/tracking.

### 4.4 Orders

#### User Interaction

Orders are managed from `/owner/orders`. The owner sees a production board organized around:

- pending setup
- in production
- completed

Order cards show party/quality, progress, produced meters, target meters, days remaining, pace indicators, and assigned machine count. A detail drawer shows editable target/deadline, machine assignment, cost snapshot, production status, dispatch section, and action buttons.

Editing sensitive order details requires an owner access code. If the target is increased on a completed order, the implementation can reactivate the order.

#### Logic and Output

Orders are created from accepted quotes or as backing anchors for market runs. The order stores production quantities, party/quality fields, worker rate snapshot, deadline, tracking token, and links to quote or market run.

`getOrdersWithProgress` reads `order_progress_summary` so the UI receives production totals and status in one operational shape.

`assignMachinesToOrder` validates ownership, validates the target order and machines, checks machine/yarn quality compatibility where available, unlinks previous selections, and writes `machines.current_order_id` for selected machines.

`updateOrderStatus` can complete or cancel an order. Completing an order unlinks machines currently assigned to it.

#### Value Provided

Orders turn accepted commercial work into a live production commitment. Owners can see whether an order is set up, whether looms are assigned, how much has been produced, whether the deadline is at risk, and what needs dispatch.

#### Connected Features

Orders connect quotes, supervisors, machines, production logs, analytics, stock inward drafts, dispatch, tracking, commercials, payroll, and worker rates.

### 4.5 Market Runs

#### User Interaction

Market runs are speculative production jobs created from the estimator in market mode through `/owner/estimator?mode=market`. They are listed in `/owner/market-runs` and inspected in `/owner/market-runs/[id]`.

The market-run list shows:

- fabric label and quality
- target meters
- cost per meter
- status
- produced progress
- in-godown meters
- sold meters
- revenue, profit, and margin
- sale count

The detail page shows production, stock, unit cost, total profit, and a run profit trail. It offers actions to manage stock and mark the run closed.

#### Logic and Output

`createMarketRunFromEstimator` creates a market run from costed estimator state. It writes:

- an accepted `estimator_quotes` snapshot
- a `market_runs` record with status `production`
- a backing `orders` record linked by `market_run_id`
- `order_yarn_requirements`

The backing order is important: supervisors log production against orders, so a market run becomes available to the floor because it has an active order anchor.

The summary view `market_run_summary` combines production logs, stock lots, stock sales, direct market-run sales, cost, revenue, and profit. Later migrations rebuilt the view so stock sales from `fabric_stock_sales` are included alongside direct `market_run_sales`.

#### Value Provided

Market runs let a factory produce for market stock without losing commercial visibility. The owner can cost the fabric before production, keep looms busy, track meters produced, confirm physical stock, sell from godown, and understand profit.

#### Connected Features

Market runs connect estimator, orders, supervisor production, stock inward drafts, godown stock, stock sales, market-run summary, commercials, and optional direct sale records.

### 4.6 Supervisor Production Logging

#### User Interaction

The supervisor's main workspace is `/supervisor/dashboard`. It is implemented as a mobile-first shift meter log.

The supervisor can:

- choose date
- choose day or night shift
- copy previous shift setup
- assign worker to each machine
- assign an order or market-run backing order to each machine
- set machine status as running, idle, or maintenance
- add breakdown category and notes
- see opening readings
- enter closing readings
- mark counter reset
- submit the shift

The UI persists draft closing readings and counter-reset flags in local storage per date and shift. It shows readiness issues before submission, such as missing worker, missing order, missing reading, counter below opening, or maintenance without note.

#### Logic and Output

`getShiftSetupData` builds the shift screen from:

- active machines
- active orders
- meter workers
- date/shift assignments
- standing machine assignments
- existing logs
- previous closing meter readings
- order production totals

It merges dated assignments, standing assignments, and current machine order to make the supervisor's screen pre-filled instead of blank.

`upsertShiftAssignment` writes date/shift assignment and also updates standing machine assignment and machine current order where appropriate.

`bulkLogProduction` is the main production write path. It validates:

- non-empty entries
- no production meters without an order
- no negative readings unless counter reset is used
- duplicate/correction handling
- 30-minute correction window
- owner access code requirement outside the correction window
- payroll settlement lock, so settled cycles cannot be modified
- production date cannot be before the order creation date

It calls `replace_shift_production_logs` to replace same machine/date/shift logs atomically. After successful production logging, it calls `create_or_refresh_stock_inward_draft` for each produced order.

#### Value Provided

The supervisor log replaces the shift register. It captures production in the format needed by owners, stock, and payroll: machine, worker, order/run, meters, date, shift, rate, and status context.

#### Connected Features

Production logs feed analytics, order progress, market-run progress, payroll, stock inward drafts, stock availability, and dispatch readiness.

### 4.7 Owner Analytics

#### User Interaction

The owner analytics dashboard lives at `/owner/analytics`. It shows live and historical operating metrics:

- today's and yesterday's production
- piece-rate wages
- active machines
- order health and pace
- worker breakdown
- machine list
- seven-day trend

The dashboard can fetch historical data by date. It subscribes to production changes so the current day view can refresh when supervisors submit logs.

#### Logic and Output

Dashboard actions call RPCs where available and fall back to table aggregation. The data is normalized into a dashboard shape that separates KPI strip, order list, worker breakdown, machine state, and trend.

The current dashboard data type includes a `yieldAlert`, but the action currently returns it as `null`. Yield alert UI points toward archived/deferred inventory behavior.

#### Value Provided

Analytics gives owners a live operating cockpit. It turns shift logs into same-day visibility instead of waiting for register handoff.

#### Connected Features

Analytics consumes production logs, orders, machines, workers, and dashboard RPCs. It is downstream of supervisor logging and upstream of owner decisions about orders, market runs, stock, and payroll.

### 4.8 Stock and Godown

#### User Interaction

The active stock module is `/owner/stock`. The UI is centered around taka/godown stock.

The owner can:

- review available takas
- review available meters
- review stock value at cost
- review realized revenue and profit
- confirm pending inward drafts from production
- add opening/manual/order/market-run stock lots
- choose source, quality, godown, unit count, meters per unit, unit label, cost, received date, and notes
- record sales from a stock lot
- adjust stock for physical differences
- inspect recent movements and recent sales

Pending inward drafts are generated by supervisor production logs. The owner confirms them into physical stock lots after checking actual takas/meters.

#### Logic and Output

`getTakaStockBoard` reads:

- `fabric_stock_lot_summary`
- recent `fabric_stock_sales`
- recent `fabric_stock_movements`
- pending `fabric_stock_inward_drafts`
- source options from market runs and orders

`confirmStockInwardDraft` calls `confirm_stock_inward_draft`, which locks a pending draft, creates a stock lot, writes an inward movement, and marks the draft confirmed.

`createTakaStockLot` can add opening/manual/order/market-run/adjustment stock after validating the source belongs to the organization.

`recordTakaStockSale` calls `record_fabric_stock_sale`, which requires whole unit count, calculates meters, revenue, cost, and profit, decrements available stock, and writes a sale movement.

`adjustTakaStockLot` calls `adjust_fabric_stock_lot`, which adds or subtracts physical units and records the movement.

#### Value Provided

Stock turns produced fabric into a physical, costed godown record. It lets the owner know what exists, where it is, what it cost, what has been sold, and what profit has been realized.

#### Connected Features

Stock connects production logs, orders, market runs, dispatch, commercials, and market-run profitability. It is the main bridge between "meters produced" and "sellable physical fabric."

### 4.9 Dispatches and Public Tracking

#### User Interaction

Dispatches appear both inside an order drawer and on `/owner/dispatches`.

The owner can:

- see pending dispatch meters and value
- group dispatches by order
- create a dispatch from sold stock entries
- enter e-way bill information where needed
- generate a challan
- copy/share a tracking link
- view QR code
- confirm receipt on behalf of the receiver
- record shortages or extra received quantity

The public tracking portal lives at `/track/[token]`. A party can open the link without login, see safe order/dispatch details, and confirm receipt for in-transit batches.

#### Logic and Output

The current dispatch path dispatches sold stock entries, not arbitrary unsold production. `getDispatchesForOrder` finds `fabric_stock_sales` without a `dispatch_id` that match the order by stock-lot order id or by quality when the lot is not order-specific.

`createDispatch` calls the RPC `create_stock_sale_dispatch` with selected stock sale ids. The RPC:

- validates owner/supervisor role and organization
- locks selected sales
- validates active order compatibility
- calculates sent meters and invoice value
- applies GST values
- requires e-way fields when invoice value crosses the configured threshold
- creates a dispatch
- creates bridge `fabric_packages`
- creates `dispatch_package_lines`
- links the stock sales to the dispatch

Tracking uses order tracking tokens. `get_order_tracking_data` returns safe public JSON. Public receipt confirmation is rate limited and calls `confirm_fabric_dispatch_receipt`.

#### Value Provided

Dispatches create a controlled bridge between sold stock and delivery. Tracking replaces WhatsApp-only follow-up with a public receipt workflow, while still preserving owner visibility into shortages and delivered state.

#### Connected Features

Dispatch connects orders, stock sales, packages, challans, tracking links, public receipt confirmation, shortages, and commercials.

### 4.10 Commercials

#### User Interaction

The commercials dashboard lives at `/owner/commercials`. It is a read-only gross profit view.

The owner can:

- see realized revenue, cost, and profit
- see expected profit from converted quotes/orders
- filter by realized or expected stage
- filter by source type
- search by quality, reference, or source
- inspect quantity, rate, revenue, and profit rows

#### Logic and Output

The main source is the database view `commercial_profit_entries`. It combines:

- realized stock sales from `fabric_stock_sales`
- realized market-run direct sales from `market_run_sales`
- realized order invoices from `party_invoices`
- expected order profit from converted quotes/orders that do not yet have a non-cancelled invoice

The action aggregates realized and expected values and returns summary metrics plus row-level entries.

#### Value Provided

Commercials gives the owner a gross-profit lens across multiple ways value is created: order work, stock sales, market-run sales, and expected quote/order value. It is not currently a full accounting ledger.

#### Connected Features

Commercials consumes estimator quote snapshots, invoices, stock sales, market-run sales, and orders. It is downstream of sales and production economics.

### 4.11 Payroll, Advances, and Supervisor Float

#### User Interaction

Payroll lives at `/owner/payroll`. The owner can review monthly/cycle payroll for:

- meter workers paid from production logs
- fixed workers paid from attendance or salary

The UI supports:

- cycle month navigation
- meter breakdown by worker, machine, and order
- fixed-worker attendance-based calculation
- pending advances and deductions
- statutory PF/ESIC deduction preview where configured
- settlement with payment mode
- final settlement
- secure reversal with access code
- payslip generation
- WhatsApp payslip sending

Advances live at `/owner/advances`. The owner can create advances for meter or fixed workers, view pending/deducted debt, inspect risk levels, and delete pending advances.

Supervisors can record kharchi from the floor. Supervisor float can be refilled by the owner.

#### Logic and Output

Meter payroll sums `production_logs.meters * worker_rate_snapshot` inside the configured payroll cycle.

Fixed payroll uses:

- monthly salary for salary workers
- attendance count multiplied by daily equivalent for daily workers, capped at monthly salary

Advance recovery uses deduction caps:

- normal settlement limits recovery to 50 percent of gross
- final settlement can recover 100 percent

`toggleWorkerPaid` settles through `settle_worker_payroll` and reverses through `unsettle_worker_payroll`. Reversal requires owner access code. The action can trigger WhatsApp payslip delivery after settlement.

`recordKharchi` creates a pending worker advance and logs a supervisor float disbursement. If the relevant payroll cycle is already settled, the advance is rolled to the next cycle.

#### Value Provided

Payroll turns production logs and attendance into clear payable amounts. Advances become explicit debt instead of memory. Deduction caps prevent accidental over-recovery. Payslips and receipts give workers a record.

#### Connected Features

Payroll consumes production logs, workers, fixed workers, attendance, advances, payroll config, and worker rates. It feeds settlements, WhatsApp payslips, debt history, and worker exit/final-settlement flows.

### 4.12 Workers, Machines, and Attendance

#### User Interaction

Owners manage machines through `/owner/machines` and workers through `/owner/fixed-workers` plus related worker actions. Supervisors also have worker and attendance surfaces.

Users can:

- add and edit machines
- update loom type
- activate/deactivate machines
- add meter workers
- add fixed workers
- assign workers to machines
- toggle workers active/inactive
- delete workers or machines with access-code protection
- record fixed-worker attendance
- inspect worker debt

#### Logic and Output

Machines are production anchors. Workers are labor anchors. Active/inactive flags keep historical records intact while removing people or machines from current selection lists.

Worker deletion is protected because it affects payroll and production history. Some delete flows support PII erasure while preserving operational totals.

Attendance feeds fixed-worker payroll. Machine status feeds supervisor logging and analytics.

#### Value Provided

Master data keeps floor logging fast and reliable. It also ensures payroll and production history are attributable.

#### Connected Features

Machines and workers feed supervisor dashboard, shift assignments, production logs, analytics, payroll, advances, and setup completeness.

### 4.13 WhatsApp Messaging

#### User Interaction

WhatsApp appears as a supporting layer rather than a standalone primary workflow. Owners configure preferences and worker WhatsApp details. Messaging is used for:

- access-code delivery or owner approval contexts
- payslip sending
- advance receipts
- daily production briefs
- deadline alerts
- webhook-driven inbound/summary behavior
- delivery retry/log review

#### Logic and Output

The implementation uses Supabase Edge Functions and shared WhatsApp helpers. Delivery attempts are logged in `whatsapp_delivery_log`. Failures are generally treated as non-blocking for the core database write: the operational action should still succeed even if WhatsApp delivery fails.

#### Value Provided

WhatsApp meets factories where communication already happens while preserving a delivery trail. It makes the product useful without requiring every participant to live inside the app.

#### Connected Features

WhatsApp connects settings, workers, payroll, advances, access codes, daily summaries, deadline alerts, and delivery logs.

### 4.14 Billing, Subscription, and Referrals

#### User Interaction

Billing lives at `/owner/billing`. Owners can inspect subscription status, start a trial, subscribe through Razorpay, toggle auto-renew behavior, and use referral features.

#### Logic and Output

Razorpay API routes create subscriptions/trials and webhooks verify payment events. Subscription state is stored in org subscription tables. Referral helpers generate codes, apply codes, and process conversion/refund behavior.

#### Value Provided

Billing gates and monetizes tenant access while referrals create a growth loop tied to existing factories.

#### Connected Features

Billing connects organization status, middleware access, Razorpay webhooks, referral stats, and plan UI.

### 4.15 Compliance, Admin, and Deferred Modules

The codebase contains compliance and admin capabilities:

- grievances
- notice registry
- export logs
- DPA templates and signatures
- tenant lockdown and unlock requests
- breach reports
- audit summaries

It also contains archived owner modules such as inventory, ledger, audit settings, system health, and admin. These modules remain valuable implementation assets, but the active Phase 1 middleware redirects them away from normal use.

## 5. Order Pipeline: From Estimator to Closing

This is the main party-backed pipeline. It begins with cost analysis and ends when the order is completed, dispatched, reconciled, paid through payroll where relevant, and reflected in commercials.

### Step 1: Factory Setup Enables Costing

Before the owner can estimate reliably, the factory needs:

- machines
- meter workers
- fixed workers where overhead/payroll needs them
- payroll cycle
- factory cost profile
- optional WhatsApp and access-code settings

These records create the baseline for loom assumptions, worker rates, fixed overhead, production assignment, and later payroll.

### Step 2: Owner Builds the Cost in Estimator

The owner enters fabric construction and commercial assumptions in `/owner/estimator`. The estimator computes:

- yarn requirement and yarn cost
- weaving cost
- warping/sizing/winding/process/finishing cost
- overhead per meter
- total production cost per meter
- landed cost after commission/transport
- quote price after profit
- gross profit and margin for the order quantity
- scenario sensitivity

The output is a commercial decision: whether the owner can quote the work profitably and at what price.

### Step 3: Owner Saves a Quote

Saving a quote writes `estimator_quotes` with:

- party name
- quality label
- quantity
- quote status
- cost and quote price values
- worker rate per meter
- estimator input snapshot
- estimator result snapshot
- instructions

The quote snapshot becomes the commercial memory of the offer. Later changes to factory profile, yarn prices, or templates do not mutate this quote.

### Step 4: Quote Moves Through Status

In `/owner/quotes`, the owner moves the quote from draft to sent, then accepted or rejected.

Only accepted quotes can become production orders. This is a product control: production commitment is not created from a casual estimator draft.

### Step 5: Accepted Quote Converts to Order

The owner clicks "Create Active Order" on an accepted quote and enters:

- target meters
- deadline
- notes

The server action calls the atomic RPC `convert_accepted_quote_to_order`. The conversion:

- locks the quote
- confirms it is accepted and unconverted
- creates an `orders` record
- writes quote/order back-links
- generates or preserves tracking token
- prevents duplicate conversion races

After the RPC, the action recomputes yarn requirements from the quote snapshot and writes `order_yarn_requirements`.

### Step 6: Owner Plans Production

In `/owner/orders`, the owner reviews the order board. A new order usually appears in pending setup until production or machine assignment exists.

The owner opens the order drawer and assigns machines. Assignment writes `machines.current_order_id`, after validation. The order drawer also shows:

- progress
- deadline/pace
- target and produced meters
- active machines
- linked quote/cost snapshot
- dispatch readiness
- action buttons to complete or cancel

Changing sensitive details requires an owner access code. Increasing target on a completed order can reactivate it.

### Step 7: Supervisor Logs Production

The supervisor sees active orders in the shift log. For each machine, they select or confirm:

- worker
- order
- rate snapshot
- opening reading
- closing reading
- counter reset if needed
- machine status

Submitting the shift writes `production_logs`. For order work, this immediately affects:

- order progress
- owner analytics
- worker piece-rate payroll
- stock inward draft generation

Correction rules protect production history. Duplicates inside the 30-minute correction window can be replaced. Corrections outside that window require an owner access code. If payroll for that cycle has already been settled, production edits are blocked.

### Step 8: Production Becomes Stock Drafts

After successful logs, `bulkLogProduction` calls `create_or_refresh_stock_inward_draft` for produced orders.

The draft represents produced fabric that may need physical confirmation before it becomes godown stock. It captures:

- order or market-run source
- date and shift
- produced meters
- quality/source label
- cost per meter
- default unit label and godown assumptions

### Step 9: Owner Confirms Physical Stock

In `/owner/stock`, the owner reviews pending inward drafts and confirms actual physical units:

- taka count
- meters per taka
- unit label
- godown
- notes

Confirmation creates `fabric_stock_lots` and `fabric_stock_movements`. This step separates "logged production" from "physically confirmed stock in godown."

### Step 10: Stock Is Sold

The owner records stock sales from available lots. A sale:

- consumes whole units
- calculates meters from units times meters per unit
- records price per meter
- calculates revenue, cost, and profit
- decrements available stock
- writes a sale movement

For order-reserved stock, this creates sold stock entries that can be dispatched against the order.

### Step 11: Dispatch Is Created From Sold Stock

Dispatches are created from sold stock entries, not directly from unsold stock.

From an order drawer or `/owner/dispatches`, the owner selects pending sold stock entries for that order. The dispatch RPC:

- validates the order and selected sale entries
- calculates sent meters
- calculates taxable value and GST
- requires e-way details above threshold
- creates a dispatch number
- creates dispatch-package bridge lines
- links stock sales to the dispatch

The UI can generate a challan and share a tracking link.

### Step 12: Party Tracks and Confirms Receipt

The public link `/track/[token]` shows safe order and dispatch details without exposing internal app data. The recipient can confirm received quantity for in-transit dispatches.

Receipt confirmation updates dispatch state. Shortages or extra quantities become visible for owner reconciliation.

### Step 13: Order Closes Operationally

The owner can mark an order completed when production and dispatch expectations are done. Completing an order unlinks assigned machines. Cancelling marks the order cancelled and also removes active machine links.

If the owner later increases the target on a completed order, the implementation can reactivate it.

### Step 14: Money and Labor Close

The order pipeline feeds two money surfaces:

- Commercials: quote/order expected profit, invoices, stock sale profit.
- Payroll: meter workers are paid from production logs using worker rate snapshots.

Worker advances can be deducted during payroll settlement. Payslips can be generated and sent over WhatsApp. Once payroll for a cycle is settled, production edits in that cycle are blocked to protect closed payroll.

### Order Pipeline Value

The order pipeline turns a customer-approved fabric price into controlled execution:

- costing is explicit
- accepted work is separated from draft estimates
- order progress is visible
- looms and workers are assigned
- floor production feeds stock and payroll
- stock sale and dispatch are traceable
- public receipt confirmation reduces follow-up friction
- gross profit and labor cost become visible

## 6. Market Run Pipeline: From Cost Analysis to Closing

Market runs are the speculative production pipeline. They exist for factories that produce "market maal" when there is no confirmed party order but loom time should still be productive.

### Step 1: Owner Starts Estimator in Market Mode

The owner opens `/owner/estimator?mode=market`. The same estimator engine is used, but the intent changes:

- the "party" is effectively the market/fabric label
- quote price is less important than cost clarity
- target meters define a speculative production run
- the output is a run plus a floor-production anchor

The owner still gets yarn cost, conversion cost, overhead, production cost, landed assumptions, and scenarios.

### Step 2: Market Run Creation Writes Three Anchors

`createMarketRunFromEstimator` creates:

1. An accepted `estimator_quotes` snapshot.
2. A `market_runs` record with target, cost per meter, worker rate, quality, notes, and status `production`.
3. A backing `orders` record linked to the market run.

It also writes `order_yarn_requirements`.

The backing order is not a normal customer order, but it is necessary because the supervisor production log is order-based. This is how market-run work appears on the floor.

### Step 3: Supervisor Produces Against the Backing Order

The supervisor assigns the backing order to a machine and logs shift production in the same flow as party orders.

Production logs feed:

- market-run produced meters through `orders.market_run_id`
- owner analytics
- piece-rate payroll
- stock inward draft generation

This lets market production reuse the same floor workflow rather than creating a second supervisor workflow.

### Step 4: Market Production Becomes Stock Inward Drafts

After production is logged, the stock inward draft RPC detects that the produced order is linked to a market run. The draft uses:

- source type `market_run`
- market run id
- backing order id
- fabric/quality label
- market-run cost per meter
- produced meters from logs

The owner later confirms the draft into physical godown stock.

### Step 5: Owner Confirms Market Stock

In `/owner/stock`, the owner confirms actual takas/meters. The confirmed lot is a `fabric_stock_lots` record tied to the market run.

The lot becomes available for stock sale. Its cost per meter comes from the market run cost, so later sale profit can be calculated.

### Step 6: Owner Sells Market Stock

The active UI path for market-run sales is through Stock:

- select a market-run stock lot
- record whole units sold
- enter price per meter
- create `fabric_stock_sales`
- reduce available takas/meters
- calculate realized revenue/cost/profit

`market_run_summary` includes these stock sales when calculating sold meters, revenue, cost, and profit.

There is also a direct market-run sale backend path:

- action: `createMarketRunSaleAction`
- RPC: `create_market_run_sale`
- table: `market_run_sales`

That path can create direct trader/party market-run sales and invoices, and the detail page can display those records. However, the current primary owner UI points the user to Stock for selling/adjusting physical takas rather than exposing a full direct-sale form on the market-run detail page.

### Step 7: Dispatch Depends on Sold Stock and Order Matching

Market-run stock sales are reflected in stock and commercials. Dispatch creation, however, is currently order-centered. The dispatch RPC expects selected sold stock entries to be compatible with an active order by stock-lot order id or by matching quality.

That means market-run stock sale and dispatch are not the same as automatic market-run dispatch. The product currently treats Stock as the main sale/profit path, while Dispatch is still organized around order delivery.

### Step 8: Owner Monitors and Closes the Run

The market-run list and detail page show:

- target meters
- produced meters
- in-godown meters
- sold meters
- revenue
- cost
- profit
- margin
- status

The owner can mark a run closed. Current stock-sale metrics update summaries, but run status is not fully auto-derived from every stock path. Status can be set manually through the market-run detail action.

### Market Run Pipeline Value

The market-run pipeline gives speculative production financial discipline:

- the owner knows cost before producing
- the floor uses the same production log
- produced meters become stock drafts
- godown lots carry cost basis
- stock sales calculate profit
- market-run summaries show produced, sold, stock, and margin
- closing gives the owner an end point for a speculative run

## 7. User Workflow Catalog

### Owner Setup Workflow

Entry points: `/signup`, `/onboarding`, `/owner/settings`, `/owner/billing`

Outcome: organization, profile, machines, workers, payroll config, subscription/trial, cost profile, join code, and settings are ready.

Primary value: the factory becomes usable inside the product.

### Supervisor Join Workflow

Entry points: `/join`, supervisor dashboard

Outcome: supervisor profile is attached to the factory and can access floor workflows.

Primary value: floor staff can log production without owner credentials.

### Estimator to Quote Workflow

Entry points: `/owner/estimator`, `/owner/quotes`

Outcome: reusable template and/or quote snapshot with cost, margin, and instructions.

Primary value: repeatable, auditable fabric costing.

### Quote to Order Workflow

Entry points: `/owner/quotes`, `/owner/orders`

Outcome: accepted quote becomes active order with target, deadline, tracking token, and yarn requirement snapshot.

Primary value: confirmed customer work becomes a tracked production commitment.

### Market Run Workflow

Entry points: `/owner/estimator?mode=market`, `/owner/market-runs`, `/owner/stock`

Outcome: costed speculative run, backing order, production logs, stock lots, sales, and profit summary.

Primary value: market production is no longer financially invisible.

### Supervisor Production Workflow

Entry points: `/supervisor/dashboard`, `/supervisor/production`

Outcome: production logs by date, shift, machine, worker, order/run, meters, and rate snapshot.

Primary value: register entries become live operational data.

### Owner Analytics Workflow

Entry point: `/owner/analytics`

Outcome: KPI strip, order health, machine state, worker breakdown, and production trend.

Primary value: owner sees production without waiting for manual reporting.

### Stock and Godown Workflow

Entry point: `/owner/stock`

Outcome: confirmed stock lots, movements, stock sales, available takas/meters, cost, revenue, and profit.

Primary value: physical godown is tied to production cost and sale economics.

### Dispatch and Tracking Workflow

Entry points: `/owner/orders`, `/owner/dispatches`, `/track/[token]`

Outcome: dispatches from sold stock, challan data, public tracking link, receipt confirmation, shortage reconciliation.

Primary value: delivery leaves a trace and receipt is confirmed outside the app login wall.

### Payroll Workflow

Entry point: `/owner/payroll`

Outcome: cycle settlement, deductions, net payout, payment mode, payslip, WhatsApp delivery.

Primary value: production and attendance convert into explainable worker pay.

### Advance and Kharchi Workflow

Entry points: `/owner/advances`, supervisor kharchi dialog

Outcome: pending or deducted worker advances, supervisor float movement, advance receipt.

Primary value: worker debt becomes explicit and recoverable through payroll.

### Worker, Machine, and Attendance Workflow

Entry points: `/owner/machines`, `/owner/fixed-workers`, `/supervisor/workers`, `/supervisor/attendance`

Outcome: maintained master data, active/inactive workers, machine assignments, attendance logs.

Primary value: floor and payroll data stay attributable.

### Billing and Referral Workflow

Entry point: `/owner/billing`

Outcome: trial/subscription state, Razorpay payment state, referral code and stats.

Primary value: tenant access and growth loop are managed in-product.

## 8. Cross-Feature Dependency Map

| Feature | Depends On | Produces | Feeds |
| --- | --- | --- | --- |
| Onboarding | Auth, organization | machines, workers, payroll config | all operations |
| Settings | owner role, organization | cost profile, join code, access code, preferences | estimator, supervisor, WhatsApp |
| Estimator | cost profile, templates, fixed workers | quote snapshots, templates, market-run inputs | quotes, orders, market runs |
| Quotes | estimator snapshots | accepted/rejected/sent quote state | orders, commercials |
| Orders | accepted quotes or market-run anchor | active production commitment | supervisor, analytics, stock, dispatch |
| Market Runs | estimator market mode | speculative run and backing order | supervisor, stock, commercials |
| Supervisor Log | machines, workers, active orders | production logs, stock drafts | analytics, payroll, stock |
| Analytics | production logs, orders, machines | KPI and pace visibility | owner decisions |
| Stock | production drafts, manual lots | stock lots, sales, movements | dispatch, commercials, market summaries |
| Dispatch | sold stock, active orders | dispatch batches, tracking | public receipt, shortages |
| Commercials | quotes, invoices, sales | gross profit view | owner money decisions |
| Payroll | production, attendance, advances | settlements, payslips | worker payment history |
| Advances | workers, supervisor float | pending/deducted debt | payroll |
| WhatsApp | worker/profile contact, templates | delivery logs | access, payroll, alerts |
| Billing | organization, Razorpay | subscription state | access and plan UX |

## 9. Current Implementation Realities and Gaps

These points matter when using this document as a source of truth.

1. Quote-to-order conversion is intentionally gated. Direct estimator-to-order conversion is retired. The implemented path is save quote, mark accepted, then convert from Quote History.

2. Market runs use backing orders. This is not accidental. It lets the supervisor log market production through the same order-based shift UI.

3. The market-run detail page has a "Floor Order" link that points to `/owner/orders/[id]`, but the active orders UI is a board/drawer at `/owner/orders`; there is no dedicated order detail route in the current implementation.

4. Direct market-run sale logic exists in actions/RPCs and `market_run_sales`, but the active owner UI primarily sends the user to Stock to sell/adjust physical takas.

5. Dispatch creation currently starts from sold stock entries. The owner records a stock sale first, then dispatches the sold stock. Dispatch is not a direct "send unsold production" workflow.

6. Market-run status is not fully auto-derived from every stock sale path. Summary metrics update through views, while closing/status remains a manual action in the current UI.

7. The app has both old package/inventory concepts and the newer taka stock model. The active Phase 1 stock surface is `/owner/stock`; `/owner/inventory` is archived by middleware.

8. The party ledger, supplier ledger, admin, audit settings, and system health modules have code, but are not active Phase 1 routes.

9. The owner dashboard has a `yieldAlert` field, but the current dashboard action returns it as `null`.

10. Offline support is partial. The app uses IndexedDB/local storage and some queueing patterns, especially around floor workflows, but the safest source of truth is still the server after sync.

11. Payroll settlement protects production history. Once a worker's relevant cycle is settled, production corrections for that period are blocked.

12. WhatsApp delivery is supportive and logged, but core operational writes should not depend on a WhatsApp send succeeding.

13. Cost snapshots matter. Later cost-profile edits should not be assumed to change historical quote/order economics.

14. Access codes are part of the product control model. They are used for protected changes such as destructive actions, sensitive corrections, and reversal flows.

## 10. Practical Source-of-Truth Notes

For product decisions, treat these as the current canonical flows:

- Customer work starts as estimator -> quote -> accepted quote -> order.
- Market work starts as estimator market mode -> market run -> backing order.
- Floor production is always logged through the supervisor shift log against an active order-like anchor.
- Physical fabric becomes trusted stock only after inward draft confirmation or manual stock-lot creation.
- Stock sale is the current active mechanism for realized stock profit.
- Dispatch is created from sold stock entries matched to an order.
- Payroll is calculated from production logs and attendance inside the configured cycle.
- Commercials is a gross-profit dashboard, not a full ledger.
- Archived routes should not be treated as active product promises.

## 11. Most Important Product Value

The current implementation creates one connected operating loop for a weaving factory:

- The owner knows what a fabric should cost before accepting work.
- The accepted quote becomes a controlled production order.
- Market production can be costed and tracked instead of treated informally.
- The supervisor captures actual production with low-friction meter readings.
- The owner sees progress, stock, dispatches, payroll, and profit from the same source data.
- Workers' pay and advances are tied back to logged work.
- Physical stock and dispatches are traceable.
- Public tracking gives outside parties visibility without giving them app access.

That connected loop is the product. Individual modules matter most when they strengthen that loop.
