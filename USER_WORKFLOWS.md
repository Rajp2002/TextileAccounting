# Weavly User Workflows

Last updated June 1, 2026.

This document explains how users progress through Weavly in the active product. It is written from the user's workflow outward: what they are trying to do, what pain point it replaces, how they interact with the app, and what records are created.

## 1. Owner Setup Workflow

Entry points: `/signup`, `/onboarding`, `/owner/settings`, `/owner/billing`

### Goal

Get a factory into a usable digital state before production logging and payroll begin.

### Flow

1. Owner signs up and creates an organization.
2. Owner is routed to onboarding until required setup exists.
3. Owner chooses production mode: market-run, order-based, or both.
4. Owner adds loom types/machine counts.
5. Owner adds meter workers manually or in bulk, optionally saving WhatsApp numbers with consent.
6. Owner saves payroll cycle, pay date, and reminder-window settings.
7. Owner starts trial or subscribes where access requires it.
8. Owner lands on `/owner/today`.
9. Owner continues setup in `/owner/settings`: factory name, production mode, join code, WhatsApp, factory cost profile, templates, access codes, supervisor float, and security/data controls.
10. Supervisor joins with the current join code and is routed to production.

### Pain Point Replaced

Paper master lists and informal supervisor onboarding become structured organization setup.

### Outputs

- `organizations`
- `profiles`
- `machines`
- `workers`
- `fixed_workers`
- `payroll_configs`
- `org_subscriptions`
- WhatsApp/profile settings

## 2. Estimator to Quote Workflow

Entry points: `/owner/estimator`, `/owner/quotes`

### Goal

Turn fabric costing from mental math and Excel into repeatable, auditable quote snapshots.

### Flow

1. Owner opens the estimator.
2. Owner loads a template or starts from defaults.
3. Owner enters warp and weft details: denier, beam ends, picks, reed space, yarn rates, GST, shortage, crimp, and tape length.
4. Owner chooses loom type and production assumptions: RPM, power, hours per shift, sizing mode.
5. Owner adjusts factory costs: warping, sizing, winding, process costs, finishing, overheads, fixed-worker overhead, commission, transport, monthly output.
6. Owner reviews landed cost, quote price, margin, and scenarios.
7. Owner saves or updates a fabric template.
8. Owner saves the quote: chooses **Save Quote** (saves as Draft for negotiation) or **Save & Accept** (immediately locks the quote, freezing yarn rates and pricing, and opens the Start Party Order dialog to optionally create the order in the same step).
9. Owner manages status in quote history: draft, accepted, or rejected. The manual "Mark as Sent" step is removed from the UI. Accepting a draft quote silently transitions through "sent" in the database audit log and triggers a lightweight locking confirmation modal.
10. Owner can restore any quote snapshot to re-estimate. A warning banner prevents stale draft collisions when re-estimating from a snapshot.

### Pain Point Replaced

The handwritten parchi/calculator workflow becomes a structured fabric recipe and commercial offer.

### Outputs

- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`

## 3. Quote to Order Workflow

Entry points: `/owner/quotes`, `/owner/orders`, `/owner/estimator`

### Goal

Convert a confirmed party quote into a live production commitment.

### Flow

1. Owner accepts a quote in Quote History (or saves it as already accepted using **Save & Accept** directly from the estimator).
2. **Option A** — Start Party Order fast path: after saving an accepted quote from the estimator, the Start Party Order dialog opens immediately to set target meters, deadline, and notes in one step. The server action `startPartyOrderFromEstimator` calls `executeQuoteConversion` internally.
3. **Option B** — Owner clicks **Create Active Order** on an accepted quote card in Quote History. The dialog confirms target meters, deadline, and notes, then calls `convertAcceptedQuoteToOrder`, which also routes through `executeQuoteConversion`.
4. System creates an order via the `convert_accepted_quote_to_order` Supabase RPC with quote snapshot values, tracking token, worker rate snapshot, and yarn requirements. *(The `order_id` ambiguity bug in this RPC was fixed in migration `20260531040000`.)*
5. Owner opens `/owner/orders`.
6. Owner reviews progress, pace, deadline, margin, and total order value.
7. Owner opens `/owner/machines` and assigns the new order as the cost analysis / quality for one or more looms. The assignment picker (`getActiveProductionTargets`) is cached 30 s to avoid cold-start delays; the new order appears immediately after cache invalidation.
8. Supervisor sees/selects the order in the production log.
9. Production logs update progress.
10. Owner dispatches output when ready.

### Pain Point Replaced

The whiteboard order list becomes a tracked production commitment with machine assignment and pace.

### Outputs

- `orders`
- `order_yarn_requirements`
- `machine_assignments`
- `shift_assignments`
- `production_logs`
- `dispatches`

## 4. Market Run Workflow

Entry points: `/owner/estimator?mode=market`, `/owner/market-runs`, `/owner/market-runs/[id]`

### Goal

Keep looms productive when client orders are light while still knowing cost, stock, sales, and profit.

### Flow

1. Owner starts a market run from the estimator.
2. Owner sets the target meters and cost assumptions.
3. Supervisor logs production against the market-run production anchor.
4. Owner tracks produced meters, expected in-godown meters, sold meters, revenue, cost, and profit.
5. Production creates expected stock in the godown ledger; this is not physical inward confirmation.
6. Owner records a stock sale against a saved party or newly captured party details, creating a receivable.
7. Owner dispatches pending sold meters in one or more batches and reviews any shortage or excess at receipt.
8. Owner closes the run when done.

### Pain Point Replaced

Informal "market maal" becomes costed speculative production with measurable profit.

### Outputs

- `market_runs`
- `production_logs`
- `fabric_stock_inward_drafts`
- `fabric_stock_lots`
- `stock_discrepancies`
- `market_run_sales`

## 5. Supervisor Production Log Workflow

Entry points: `/supervisor/dashboard`, `/supervisor/production`

### Goal

Capture the shift's real production in the moment, with enough structure to power payroll and analytics.

### Flow

1. Supervisor opens the production log.
2. Supervisor chooses date and shift.
3. Supervisor copies previous shift setup when useful.
4. Supervisor assigns worker and order/run to each machine.
5. Supervisor sets machine status: running, idle, maintenance.
6. Supervisor adds breakdown notes if a loom is under service.
7. Supervisor enters total metres produced for each loom in the shift.
8. System validates each production entry has a worker and order/run.
9. Supervisor submits logs.
10. Duplicate/correction cases require protected handling and may use owner access codes.

### Pain Point Replaced

The production register becomes a mobile shift screen that feeds owner analytics and payroll.

### Outputs

- `shift_assignments`
- `production_logs`
- `machines.machine_status`
- `audit_log`

## 6. Owner Analytics Workflow

Entry point: `/owner/analytics`

### Goal

Give the owner an operational cockpit for today's production and historical review.

### Flow

1. Owner opens production overview.
2. Owner sees live/historical KPI strip.
3. Owner checks order health and machine utilization.
4. Owner reviews seven-day production trend.
5. Owner reviews worker breakdown.
6. Owner jumps to orders, market runs, or payroll from action cards.
7. Live dashboard updates when production logs are inserted.

### Pain Point Replaced

Owner no longer waits for register handoff to understand the day.

### Outputs Consumed

- `production_logs`
- dashboard RPCs
- `orders`
- `machines`
- worker aggregates

## 7. Stock and Godown Workflow

Entry point: `/owner/stock`

### Goal

Know what fabric should exist in godown, what is actually dispatched, and which differences need owner review.

### Flow

1. Owner opens Stock.
2. Owner reviews expected available takas/meters and stock value at cost.
3. Market-run production contributes expected stock automatically from production records.
4. Owner adds manual/opening/order stock lots where needed.
5. Owner records a party-first stock sale by selecting a saved party, auto-linking an unambiguous party name, or creating a new party with distinguishing contact details.
6. The sale creates a named Commercials receivable, a `party_id` link where available, and pending dispatch meters.
7. If the lot has no saleable meters left and its market run is closed or sold out, it moves from Active Stock to Archive / History.
8. Owner dispatches sold stock fully or partially.
9. Any receipt shortage or excess becomes a stock discrepancy with Needs Review status.
10. Owner adjustments remain traceable and owner-only.
11. Commercials reflects realized stock profit and collection state.

### Pain Point Replaced

Loose godown memory becomes an expected ledger reconciled against dispatch reality.
Pending dispatch is tracked separately from Active Stock so sold-out closed runs do not keep empty lots in the active godown list.

### Outputs

- `fabric_stock_lots`
- `fabric_stock_sales`
- `fabric_stock_movements`
- `fabric_stock_inward_drafts`

## 8. Dispatch and Tracking Workflow

Entry points: `/owner/dispatches`, `/owner/orders`, `/track/[token]`

### Goal

Create a professional handoff for fabric leaving the factory and capture received-meter variance.

### Flow

1. Owner sells stock to a saved/new party or selects an order-linked pending sale.
2. Owner confirms dispatch with sent meters/takas and transport/GST metadata.
3. System creates a dispatch batch and keeps package/batch lines.
4. Owner shares a public tracking link when the dispatch is order-linked.
5. Party or owner confirms received meters.
6. System records delivered, shortage, or extra received state, and keeps partially dispatched stock sales pending for the next batch.

### Pain Point Replaced

Challan-plus-phone-call handoff becomes tracked dispatch and receipt reconciliation.

### Outputs

- `dispatches`
- `dispatch_package_lines`
- `party_dispatch_claims`

## 9. Commercials Workflow

Entry point: `/owner/commercials`

### Goal

Show realized and expected gross profit without requiring full accounting readiness.

### Flow

1. Owner opens Commercials.
2. Owner reviews realized revenue, realized cost, realized profit, expected profit, receivables, collected amount, balance, and margin.
3. Owner filters by realized/expected and receivable status.
4. Owner filters by orders, stock, market runs, and expected quotes.
5. Owner searches by quality/reference/source/party.
6. Owner reviews row-level revenue, cost, gross profit, margin, dispatch status, and payment state.
7. Owner opens Top Parties/Parties views to compare revenue, booked gross profit, meters sold, open dues, overdue balance, and last-sale context by saved or legacy party.
8. Owner records payments and reviews payment history.

### Pain Point Replaced

Profit visibility no longer waits for a full ledger close.

### Outputs Consumed

- quotes/orders
- stock sales
- market-run sales
- invoice-like records where present
- `parties` for lightweight party identity and active Commercials grouping

## 10. Payroll and Advances Workflow

Entry points: `/owner/payroll`, `/owner/advances`

### Goal

Pay workers from actual production and recover advances transparently.

### Flow

1. Owner records advances in `/owner/advances`.
2. Owner opens `/owner/payroll`.
3. Owner lands on the current payroll month by default or selects another payroll cycle month.
4. Owner checks cycle status based on pay date and reminder window.
5. Owner checks the Pay Date Overview for owed, pending, paid, and quick settlement actions on the active due cycle.
6. Owner reviews meter-worker earnings from production logs.
7. Owner reviews fixed-worker earnings from salary/attendance.
8. Owner checks advances, PF/ESI, deductions, manual adjustments, net payout, and remaining debt.
9. Owner toggles final settlement where needed.
10. Owner selects payment mode and verifies the payout.
11. Owner settles worker.
12. Owner generates PDF or sends WhatsApp payslip.
13. Owner opens past settlements to search, filter, inspect, reopen historical cycles, or download settlement CSVs named by factory and pay-cycle/range.

### Pain Point Replaced

Production register plus Upaad notebook becomes itemized settlement, worker communication, and downloadable settlement audit history.

### Outputs

- `worker_advances`
- `payroll_settlements`
- `payroll_adjustments`
- WhatsApp delivery log

## 11. WhatsApp Workflow

Entry points: owner/supervisor actions, Supabase Edge Functions

### Goal

Use the communication channel factories already rely on without making messages block core writes.

### Flow

1. Core action triggers an edge function or message helper.
2. Meta WhatsApp Cloud API sends the template/freeform message.
3. Attempt is recorded in `whatsapp_delivery_log`.
4. Webhook updates delivery status when Meta calls back.
5. Retry function handles failed rows.

### Message Types

- access code
- daily brief
- deadline alert
- advance receipt
- payslip summary and itemized follow-up
- monthly brief
- lockdown alert

## 12. Archived Workflows

These exist in code but are not Phase 1 polish drivers:

- `/owner/inventory` deep yarn/beam inventory.
- `/owner/ledger` full party/supplier accounting. Lightweight `parties` identity is active only where Sell Stock and Commercials need it.
- `/owner/settings/audit` audit browsing.
- `/owner/system-health` delivery/system console.
- `/admin` compliance dashboard.
- DPA, grievance, language request, and broader governance workflows.
