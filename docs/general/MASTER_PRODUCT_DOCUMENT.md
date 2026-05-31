# Weavly Master Product Document

Last analyzed from the active codebase on May 31, 2026.

This is the product source of truth for the current Weavly codebase. It describes what the app is, what Phase 1 now includes, how users move through the product, which pain points each feature translates from the existing physical workflow, and how the digital objects connect.

For launch prioritization, `docs/general/PHASE_1_SCOPE.md` remains the most authoritative scope document. This file is the fuller product narrative.

## 1. Executive Summary

Weavly is a multi-tenant textile operations SaaS for Indian weaving factories. It is not a generic ERP. The product is shaped around weaving-factory realities: yarn and loom math, piece-rate workers, day/night shift logging, shift-metre capture, speculative market production, stock in godown, worker advances, payroll settlement, party-first stock sale, dispatch shortages, and WhatsApp-based communication.

Phase 1 is a focused operating loop for Surat grey fabric manufacturers/traders. The active Phase 1 surface includes the supporting features needed to make that loop useful in a real factory:

- Factory Today as default owner action center
- production-mode-aware workflows for market-run, order-based, or both
- quotes and orders
- Start Party Order fast path
- market runs
- expected godown ledger for market-run stock
- party-first stock sale and pending/partial dispatch workflow
- dispatches, public tracking where order-linked, and owner receipt confirmation
- Commercials receivables and payment tracking
- gross profit visibility and money source of truth
- workers, machines, attendance, settings, access codes
- WhatsApp notifications
- billing/subscriptions and referrals

The broader codebase also includes deep inventory, party ledger, supplier ledger, audit registry, system health, DPA, grievances, compliance, language requests, and admin dashboards. Those are valuable future modules but should not drive Phase 1 polish unless a slice directly supports the core loop.

## 2. Product Thesis

Factories already have workflows. Weavly does not invent a new business process; it digitizes and tightens the process owners already run through registers, calculators, Excel, phone calls, and WhatsApp.

The product can be understood through a simple mental model:
- **Maal**: "Maal kya pada hai?" (Physical inventory and stock)
- **Paisa**: "Paisa/profit kya hua?" (Commercials, profit, receivables, and payments)
- **Delivery**: "Maal gaya ke nahi?" (Dispatch and tracking)
- **Worker hisaab**: "Worker hisaab kya hai?" (Payroll and advances)
- **Attention**: "Aaj kya attention chahiye?" (Daily action center)

The core translation is:

- handwritten costing becomes a reusable estimator
- quote memory becomes quote snapshots and status
- whiteboard orders become progress and pace dashboards
- speculative market production becomes market runs
- floor registers become supervisor shift logs
- production records become expected godown stock; dispatch checks reality and differences become owner-reviewed discrepancies
- dispatch handoffs become tracked batches and receipt reconciliation
- payroll notebooks become itemized settlements and payslips
- Upaad memory becomes pending/deducted advance records
- owner approvals become one-time access codes
- WhatsApp coordination becomes logged operational messaging

## 3. Users and Worlds

### Owner

The owner is responsible for pricing, production planning, money, and control.

They ask:

- **Maal**: "Maal kya pada hai?"
- **Paisa**: "Paisa/profit kya hua?"
- **Delivery**: "Maal gaya ke nahi?"
- **Worker hisaab**: "Worker hisaab kya hai?"
- **Attention**: "Aaj kya attention chahiye?"

Owner routes:

- `/owner/today` (default)
- `/owner/analytics`
- `/owner/estimator`
- `/owner/quotes`
- `/owner/orders`
- `/owner/market-runs`
- `/owner/stock`
- `/owner/dispatches`
- `/owner/commercials`
- `/owner/payroll`
- `/owner/advances`
- `/owner/fixed-workers`
- `/owner/machines`
- `/owner/billing`
- `/owner/settings`

Deferred owner routes:

- `/owner/inventory`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`
- `/owner/settings/dpa`

### Supervisor

The supervisor is the floor execution user. They need speed more than analysis.

They ask:

- Which shift am I recording?
- Which worker is on this machine?
- Which order or run is this loom producing?
- How many metres were produced this shift?
- Is the machine running, idle, or under service?
- Do I need an owner access code for this correction?

Supervisor routes:

- `/supervisor/dashboard`
- `/supervisor/production`
- `/supervisor/workers`
- `/supervisor/attendance`
- `/supervisor/machines`

### Admin

Admin is the governance user: compliance, notices, grievances, DPA, export logs, lockdowns, and breach reports. This is not Phase 1 polish scope.

## 4. Current Phase 1 End-to-End Flow

### 4.1 Setup

An owner signs up, creates or owns an organization, starts a trial or subscription, and completes onboarding. Onboarding requires enough operational data for the rest of the app to work: production mode, loom types/machines, workers, payroll cycle/pay-date/reminder configuration, and plan/trial state. Settings later lets the owner maintain factory name, production mode, join code, WhatsApp preferences, access codes, templates, cost profiles, supervisor float, and security controls.

The supervisor joins with a secure organization join code and lands on the production workspace.

### 4.2 Estimate

The owner enters fabric assumptions in `/owner/estimator`:

- warp rows and weft rows
- yarn rates, GST, denier, ends, picks, reed space
- tape length, shortage, crimp
- loom type, RPM, power, hours per shift
- warping/sizing/winding/processing/finishing
- overhead items and monthly output
- commission, transport, profit
- party, quality label, and instructions

The estimator calculates yarn cost, conversion cost, overhead, landed cost, quote price, margin, and scenario outputs. Templates make repeat qualities faster. Factory cost profiles keep baseline overhead assumptions consistent.

### 4.3 Quote

The owner saves a quote. The quote stores the commercial values and the estimator snapshot. In `/owner/quotes`, the owner can filter by status, mark draft/sent/accepted/rejected, restore a quote into the estimator for rework, or convert an accepted quote into an active order.

### 4.4 Order or Market Run

If a party commits, the accepted quote becomes an order with target meters, deadline, instructions, tracking token, and quote-derived worker-rate snapshots.

If the factory is producing for stock, the owner creates a market run from estimator mode. Market runs track produced meters, expected in-godown meters, sold meters, revenue, cost, profit, and status.

### 4.5 Assign and Log Production

The supervisor opens `/supervisor/dashboard`, chooses date and shift, assigns worker and order/run per machine, updates machine status, and enters shift production metres. The UI warns on missing assignments, negative metres, and missing downtime reasons. Copy Previous Shift reduces repeated setup.

Submitting logs writes `production_logs` with machine, worker, order, date, shift, metres, synthetic opening/closing reading fields, submitted timestamp, rate snapshots, and actor context. Duplicate and correction flows protect payroll and analytics from accidental rewrites.

### 4.6 Analyze

The owner dashboard reads the live and historical production state:

- KPI strip
- order health
- machine utilization
- production trend
- worker breakdown
- live updates from production log inserts
- date picker for historical production views

The dashboard is operational, not a broad executive BI suite.

### 4.7 Expected Stock and Dispatch

For market-run factories, production creates expected stock context in the godown ledger. This is a production/commercial expectation, not a daily physical inward confirmation. `/owner/stock` shows expected available or ledger available meters, stock lots, adjustments, sales, pending dispatch meters, movements, and cost visibility. Physical stock is reconciled when stock is sold, dispatched, and received; shortage or excess becomes a `needs_review` stock discrepancy for the owner.

Stock Inward is not a mandatory Phase 1 workflow for market-run mode. It may remain available for legacy/direct-access or order-based support, but the core market-run journey is production ledger -> dispatch check -> discrepancy review. The older `/owner/inventory` deep yarn/beam module is archived.

Dispatches turn sold stock into tracked shipment batches with transport/GST/e-way metadata, package rows, sent meters, received meters, shortage/extra variance, and public token tracking where the dispatch is order-linked. Market-run stock can now be sold and dispatched without creating a fake party order. The owner confirms dispatch for all or part of the pending quantity using a modernized CreateDispatchModal, and confirms receipt directly on `/owner/dispatches` (which records shortages/excesses and defers credit due dates relative to the receipt date). The system uses meters-only throughout.

### 4.8 Commercial View

`/owner/commercials` aggregates expected and realized gross profit from:

- order invoices
- expected order quotes
- market-run sales
- stock sales

Commercials also tracks receivables, payment receipts, collected amount, balance, and dispatch status context for stock-sale receivables. This is a Phase 1 profit and collection lens, not a full accounting ledger.

### 4.9 Payroll and Settlements

Payroll aggregates meter-worker production logs and fixed-worker attendance/salary data. It uses `payroll_configs` to derive cycle bounds, pay date, reminder window, and pay-window status. It previews gross/net revenue before deductions, advance deduction, statutory deductions, manual adjustments, net payout, remaining debt, compliance flags, and final-settlement behavior.

The dashboard defaults to the current payroll month for live wage tracking, enables navigation up to the current in-progress month, and highlights the active cycle with a dedicated `PayDateOverview` component. Normal settlement is gated and disabled if the payroll window is not open, displaying a validation reason near the configured pay date. The owner records settlement with payment mode and verification, then can send or generate payslips.

Past settlements are available from `/owner/payroll` as an audit archive. Owners can search, filter by month or settlement date range, inspect paid settlements, reopen the historical cycle, and download CSV exports. Historical meter-worker settlements show earning lines reconstructed from machine/order production logs as metres multiplied by `worker_rate_snapshot`; fixed-worker settlements show salary or attendance basis. Export filenames use the factory and pay-cycle/range, for example `AshokTextiles_Jan-01-2026-Jan-31-2026.csv`.

Advances tracks pending and deducted Upaad for both meter and fixed workers, estimates debt burden against typical pay, and feeds payroll recovery.

### 4.10 WhatsApp, Billing, and Referrals

WhatsApp supports the workflows with access-code messages, daily briefs, deadline alerts, advance receipts, payslips, monthly briefs, and delivery logging. Message delivery is logged and retryable, but core writes should not depend on messaging success.

> [!IMPORTANT]
> **WhatsApp status:** Required before pilot. Direct Meta WhatsApp Cloud API is the selected provider. Currently pending Meta Business setup / Indian payment method dependency for live credentials. This is a pilot-readiness blocker, not a scope-removal issue.
> Simulation mode is available for local/dev testing. Core workflows function without live WhatsApp credentials. WhatsApp failures will not block core writes.

Billing manages trial and Razorpay subscription state. Referrals support lightweight growth through referral codes and billing-page stats.

## 5. Feature Map

| Feature | Owner Value | Supervisor Value | Core Data |
| --- | --- | --- | --- |
| Estimator | Accurate pricing and margins | Production instructions downstream | `factory_cost_profile`, `estimator_templates`, `estimator_quotes` |
| Quotes | Commercial memory and conversion | Indirect | `estimator_quotes`, `orders` |
| Orders | Commitments, pace, dispatch readiness | Select work to log against | `orders`, `machine_assignments`, `shift_assignments`, `production_logs` |
| Market Runs | Loom utilization and stock production | Select speculative work to log | `market_runs`, `market_run_sales`, `production_logs`, `fabric_stock_lots` |
| Production Log | Live factory truth | Primary daily workspace | `shift_assignments`, `production_logs`, `machines` |
| Analytics | Progress, pace, worker and machine signals | Indirect | Dashboard RPCs, realtime production inserts |
| Stock | Expected godown quantity, cost, sale, dispatch difference review | Optional packaging support | `fabric_stock_lots`, `fabric_stock_sales`, `fabric_stock_movements`, `fabric_stock_inward_drafts`, `stock_discrepancies` |
| Dispatch | Professional handoff, pending/partial dispatch, shortage/excess control | Indirect | `dispatches`, `dispatch_package_lines`, `fabric_packages`, tracking token |
| Commercials | Realized/expected gross profit, receivables, payment tracking | None | `commercial_profit_entries`, `commercial_receivables`, `commercial_payment_receipts` |
| Payroll | Trustworthy settlement timing and payout | Production logs become wages | `payroll_configs`, `payroll_settlements`, `payroll_adjustments`, `production_logs`, `attendance` |
| Advances | Upaad visibility and recovery | Worker trust | `worker_advances`, payroll RPCs |
| Workers/Machines | Operating baseline | Floor selection lists | `workers`, `fixed_workers`, `machines` |
| Settings | Identity, access, WhatsApp, cost defaults | Indirect | `organizations`, `whatsapp_settings`, profile/settings tables |
| Billing/Referrals | Monetization and growth | None | `org_subscriptions`, `subscription_payments`, referral tables |

## 6. Route Map

### Public and Auth

- `/` - landing page
- `/login`, `/signup`, `/join`, `/verify`
- `/onboarding`
- `/auth/callback`, `/auth/confirm`, `/auth/auth-code-error`
- `/privacy`, `/terms`, `/refund-policy`
- `/track/[token]` - public dispatch tracking portal
- `/locked`, `/feature-archived`

### Owner

- `/owner/today`
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
- `/owner/inventory` archived
- `/owner/ledger` archived
- `/owner/settings/audit` archived
- `/owner/system-health` archived

Owner navigation is production-mode aware. `market_run` hides Quotes/Orders, `order_based` hides Market Runs, and `both` shows both workflow families.
- `/owner/settings/dpa` secondary/deferred

### Supervisor

- `/supervisor/dashboard`
- `/supervisor/production`
- `/supervisor/workers`
- `/supervisor/attendance`
- `/supervisor/machines`

### Admin

- `/admin` archived in Phase 1

## 7. Data Model Anchors

### Tenant and Identity

- `organizations`
- `profiles`
- `org_subscriptions`
- `subscription_payments`
- `referral_codes`, `referral_uses`, `referral_discount_windows`, `referral_refunds`

### Commercial and Production

- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`
- `orders`
- `market_runs`
- `market_run_sales`
- `machines`
- `workers`
- `fixed_workers`
- `shift_assignments`
- `machine_assignments`
- `production_logs`
- `attendance`

### Stock and Delivery

- `fabric_packages`
- `dispatch_package_lines`
- `dispatches`
- `party_dispatch_claims`
- `fabric_stock_lots`
- `fabric_stock_sales`
- `fabric_stock_movements`
- `fabric_stock_inward_drafts`

### Finance and Worker Money

- `payroll_settlements`
- `payroll_adjustments`
- `payroll_adjustment_categories`
- `payroll_payments`
- `payroll_configs`
- `worker_advances`
- `supervisor_float_transactions`

### Deferred ERP and Governance

- `parties`, `party_invoices`, `party_receipts`, `party_adjustments`, `payment_allocations`
- `suppliers`, `supplier_ledger_entries`
- `yarn_lots`, `beam_cards`, `beam_card_lots`, `yarn_movements`, `order_yarn_requirements`
- `audit_log`
- `notice_registry`, `worker_consent_artifacts`, `grievances`, `language_requests`
- `dpas`, `organization_dpas`
- `platform_security`, `breach_reports`, `compliance_settings`

## 8. Architecture

Weavly is a Next.js App Router app backed by Supabase.

Implementation characteristics:

- Server-side role checks through `requireRole`.
- Middleware route protection, auth redirects, inactivity timeout, rate limiting, and Phase 1 archive redirects.
- Supabase RLS and org-scoped `org_id` tenancy.
- Custom JWT claims for role, org, and onboarding.
- Server actions for core writes.
- Client components for dense operational screens.
- TanStack Query for interactive views.
- Supabase realtime for live owner analytics.
- Meta WhatsApp Cloud API through Supabase Edge Functions.
- Razorpay subscription APIs and webhook handling.
- Upstash Redis for auth/access-code limits and session revocation checks when configured.
- Sentry runtime configuration.

## 9. Phase 1 Product Risks

- Estimator trust depends on formula validation with real factory examples.
- Production logging must handle duplicate/correction/reading edge cases cleanly.
- Payroll preview and final settlement must stay aligned.
- Stock and commercials should not pull the product into full accounting before the core loop is stable.
- WhatsApp delivery must be observable but non-blocking.
- Archived routes and nav must remain consistent so Phase 1 does not feel scattered.

## 10. Product North Star

The first release wins if an owner can say:

"I can quote confidently, know what each loom did today, see what is in godown, dispatch professionally, and pay workers without fighting the register."
