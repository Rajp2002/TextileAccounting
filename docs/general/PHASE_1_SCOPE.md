# Weavly Phase 1 Scope

Last analyzed from the active codebase on May 31, 2026.

Phase 1 is a focused launch of Weavly as a weaving-factory operating loop, not a full ERP. The codebase contains ledger, deep inventory, compliance, DPA, admin, audit, and system health surfaces, but Phase 1 readiness should be judged by whether a factory can trust the daily loop from costing to production to worker settlement.

## Phase 1 Thesis

Weavly Phase 1 must help an owner answer seven daily questions:

1. What should I quote for this fabric?
2. Which client orders or market runs are my looms producing today?
3. Did the supervisor record the shift correctly?
4. Are orders or market runs on pace?
5. What stock should be available in godown according to production and commercial records?
6. What did I earn or expect to earn from this work?
7. What do I owe workers after production, advances, and deductions?

The product rule:

> A Phase 1 feature is in scope only if it improves estimating, quotes/orders, market runs, production logging/tracking, payroll/advances, dispatch professionalism, stock/commercial visibility, WhatsApp communication, billing/referrals, or setup required for those workflows.

## In-Scope Pillars

### 1. Factory Setup and Access

Phase 1 starts before the first estimate. An owner must be able to create an organization, choose the factory production mode, select or trial a plan, add loom types/machines, add workers, set payroll cycle/pay-date configuration, configure factory cost assumptions, and invite supervisors.

In scope:

- Owner signup, login, onboarding checklist, and route guarding.
- Factory Today as default owner action center and landing page.
- Production mode setup: market-run only, order-based only, or both.
- Supervisor join flow through organization join code.
- Role-aware redirects: owner to Factory Today, supervisor to production log, admin to admin.
- Machine creation and management with loom type where available.
- Meter worker and fixed worker setup.
- Payroll config baseline during onboarding: cycle start day, pay date day, and reminder window.
- Factory name, settings, join-code regeneration, and language switching.
- Access-code generation for protected supervisor or correction flows.
- Subscription/trial gating where it controls product access.

Why this matters:

The old workflow assumes the owner already has a paper list of machines and workers. The digital workflow needs that master data before production logs or payroll can be trusted.

### 2. Estimator and Quotes

The estimator is the commercial entry point and must feel more trustworthy than mental math, Excel, or a handwritten parchi.

In scope:

- Warp and weft row costing.
- Yarn rates, GST, shortage, warp crimp, tape length, picks, reed space, denier, and beam ends.
- Loom type, RPM, power, hours per shift, and output assumptions.
- Warping, sizing, winding, processing, finishing, transport, commission, overheads, and profit margin.
- Factory cost profile and factory cost wizard.
- Fixed-worker-derived overhead items.
- Monthly output suggestions from recent production.
- Scenario analysis.
- Template save/update/rename/delete.
- Quote save with full snapshot data.
- Quote status: draft, sent, accepted, rejected.
- Restoring a quote snapshot into the estimator for re-estimation.
- Accepted quote to active order conversion.
- Start Party Order as a fast path from Estimator (wrapper over accepted quote conversion).
- Market run creation from estimator mode.

Readiness bar:

- Estimator formulas should be tested against real factory examples.
- Quote snapshots must be stable enough that later factory cost edits do not rewrite historical quotes.
- First-time owner flow should keep the basic path clear while leaving advanced controls available.

### 3. Orders and Market Runs

Orders are client commitments. Market runs are speculative, stock-oriented production. Both are in Phase 1 because both represent real loom utilization.

In scope:

- Active order list with progress, deadline, pace, and status.
- Quote-linked order detail with cost stack and total order value.
- Target meters and deadline editing with protected access-code flows where needed.
- Machine assignment from owner order detail.
- Order completion/cancellation.
- Dispatch section inside orders.
- Public tracking token access.
- Market-run creation from estimator.
- Market-run summaries: target, produced, in godown, sold, revenue, cost, profit, status.
- Market-run detail and closing/sale workflow where implemented.

Readiness bar:

- Owners must know whether work is on track before the party calls.
- Supervisors must see the right order/run choices while logging production.
- Market-run output should flow into stock and profit visibility without pretending to be a confirmed client order.

### 4. Supervisor Production Log

The supervisor screen is Phase 1's floor source of truth.

In scope:

- Mobile-first `/supervisor/dashboard` production log.
- `/supervisor/production` redirect to the active production workspace.
- Day/night shift selection and current shift defaulting.
- Machine cards with worker selection and order selection.
- Shift-metre entry.
- Synthetic opening/closing fields are currently persisted for compatibility, but the visible UI records produced metres directly.
- Copy previous shift setup.
- Immediate assignment upsert.
- Bulk production log submission.
- Duplicate guard and protected overwrite/correction behavior.
- Self-correction window and audit rows for replacements.
- Owner access-code request and verification flow.
- Machine running/idle/maintenance status.
- Machine breakdown category and notes.
- Supervisor worker CRUD where allowed.
- Fixed worker attendance.
- Supervisor machine view.

Readiness bar:

- Logging should be fast on a phone.
- Missing worker/order assignments should be obvious before submission.
- Negative readings, reset/correction cases, duplicate logs, and past-date changes need clear handling.
- Production logs must remain the trusted source for owner analytics and payroll.

### 5. Payroll and Advances

Payroll and advances are a Phase 1 trust anchor. If workers cannot understand how pay and Upaad were settled, the system will not replace registers.

In scope:

- Meter-worker payroll from `production_logs`.
- Fixed-worker payroll from fixed worker setup and attendance.
- Worker rate snapshots from production time.
- Settlement preview and final record.
- Advance recovery with deduction caps.
- Final settlement mode.
- PF/ESI enrolled fields and employee deductions.
- Payment mode capture: cash, bank transfer, UPI, cheque.
- Pay-date/reminder gating for normal settlement, with final settlement still available when appropriate.
- Paid/unpaid state and unsettlement behavior where available.
- Payroll adjustments/categories where implemented.
- Payslip PDF generation.
- WhatsApp payslip send with itemized follow-up.
- Advances for meter and fixed workers.
- Pending/deducted advance states.
- Debt-to-typical-pay warnings.
- Advance receipt WhatsApp flow.
- Write-off/reversal auditability where implemented.

Readiness bar:

- Preview and final settlement must not drift.
- Itemized payout must be explainable to an owner and worker.
- Advance deduction caps and final settlement behavior require focused tests.

### 6. Expected Stock, Dispatches, and Commercials

This scope has been extended beyond the original three pillars because production value is incomplete if output cannot be seen, moved, or valued.

In scope:

- `/owner/stock` as the Phase 1 expected godown ledger for market-run factories.
- For market-run mode, production creates expected stock from production records. This is not daily physical inward confirmation.
- Physical stock is checked when fabric is sold or dispatch-ready.
- Dispatch reconciliation compares expected available meters, sale/dispatch quantity, and actual dispatched/received meters.
- Shortage or excess is tracked as a stock discrepancy with `needs_review` status for owner follow-up.
- Fabric stock lots from manual, opening, market-run, order, and adjustment sources.
- Pending inward drafts remain optional/legacy support and should not be a required market-run Phase 1 workflow.
- Unit count, meters per unit, godown, cost per meter, expected available meters, and ledger movements.
- Stock adjustment add/subtract.
- Party-first stock sale recording with named party, price, quantity, credit days, and Commercials receivable creation.
- Pending dispatch tracking for stock sales, including partial dispatch quantities.
- Configurable dispatch batches: dispatch date, meters, challan, vehicle, transporter, and notes (the system is meters-only throughout).
- Stock movements history.
- Dispatches for order-linked output.
- Dispatch package/batch rows, transport/GST/e-way metadata, and receipt confirmation.
- Shortage/extra received tracking.
- Public `/track/[token]` portal.
- `/owner/commercials` as the source of truth for realized revenue, gross profit, expected profit, receivables, and payment tracking.

Not in scope:

- Full accounting replacement / Tally replacement.
- Full supplier ledger readiness.
- Deep yarn/beam inventory polish.
- Complex logistics planning.
- GST filing and Bank reconciliation.
- Full CRM.
- Automatic collection reminders.

Readiness bar:

- Stock and commercials should support owner decision-making without dragging Phase 1 into a full ERP.
- Market-run stock accuracy should not depend on a new daily manual Stock Inward process.
- Dispatch should feel professional but lightweight.

### 7. WhatsApp, Billing, and Referrals

These are kept because they make the core loop usable and sellable in the target market.

> [!IMPORTANT]
> **WhatsApp status:** Required before pilot. Direct Meta WhatsApp Cloud API is the selected provider. Currently pending Meta Business setup / Indian payment method dependency for live credentials. This is a pilot-readiness blocker, not a scope-removal issue.
> Simulation mode is available for local/dev testing. Core workflows function without live WhatsApp credentials. WhatsApp failures will not block core writes.

> [!IMPORTANT]
> **WhatsApp Consent (Phase 1):** Automated WhatsApp messages require explicit opt-in.
> - Owners and supervisors use `profiles.whatsapp_opted_in`.
> - Workers use the `notification_consents` table.
> - Parties/customers are not wired yet unless an active Phase 1 flow needs them.
> - Missing consent means the message is skipped (logged as `skipped_*`), not sent.
> - Opt-out records are retained to respect user choice.
> - WhatsApp failures or skips never block core business workflows (like payroll or advances).

In scope:

- Meta WhatsApp Cloud API send path.
- Delivery logging and retry support.
- Access code notifications.
- Daily production briefs.
- Deadline alerts.
- Advance receipts (with manual fallback).
- Payslips and itemized follow-up (with manual fallback).
- Monthly briefs.
- Lockdown alerts where governance is active.
- Razorpay Base/Premium subscription plans, trial, payment history, renewal/cancel state, webhook processing.
- Referral codes, referral application, conversion/refund support, and billing-page referral card.

Readiness bar:

- WhatsApp failure should never block core writes.
- Manual fallback available for key notifications (payslips, advances).
- Billing should be transparent enough for launch without becoming a billing analytics project.
- Referrals should stay lightweight.

## Out of Scope for Phase 1 Polish

These modules may exist in code and may even be routable in some environments, but they are not Phase 1 readiness drivers:

- `/owner/inventory` yarn lots, beam cards, yarn movements, order yarn requirements.
- `/owner/ledger` party invoices, receipts, payment allocations, supplier ledger.
- `/owner/settings/audit` audit registry and compliance activity browsing.
- `/owner/system-health` operational message log console.
- `/admin` full compliance dashboard.
- DPA template/version management.
- Grievance and language request workflows.
- Deep DPDP export/delete polish beyond launch-critical controls.
- Full CRM/accounting workflows, Tally replacement, GST filing, Bank reconciliation.
- Returns and credit notes.
- Complex broker commission.
- Automatic collection reminders.

## Navigation Implication

Phase 1 owner navigation should prioritize the production-mode-appropriate subset of:

- Factory Today
- Analytics
- Estimator
- Quotes
- Orders
- Market Runs
- Stock
- Dispatches
- Commercials
- Payroll
- Advances
- Workers
- Machines
- Billing
- Settings

In `market_run` mode, Quotes and Orders are hidden. In `order_based` mode, Market Runs are hidden. In `both` mode, both sets are visible.

Phase 1 supervisor navigation should prioritize:

- Production Log
- Workers
- Attendance
- Machines

Archived routes are documented in `docs/general/PHASE_1_ARCHIVE.md`; the active gate is `lib/phase1-scope.ts` and middleware enforcement.

## Readiness Checklist

- Owner onboarding creates enough data for downstream screens.
- Estimator formulas are validated with real factory examples.
- Quote snapshots preserve historical assumptions.
- Accepted quote to order flow is tested.
- Market run creation, production, expected stock, sale, and profit flow are tested.
- Supervisor production logging covers happy path, duplicate path, missing assignment, past date, correction, and meter-reading edge cases.
- Owner analytics reflects live production and historical date selection.
- Payroll preview matches final settlement.
- Advance recovery, final settlement, PF/ESI, payment mode, and payslip send are tested.
- Expected stock, optional inward drafts, lot creation, adjustment, sale, and commercials aggregation are tested.
- Party-first stock sale, pending/partial dispatch, direct receipt confirmation, shortage/excess discrepancy, and public tracking are tested.
- WhatsApp failures are logged and retryable without blocking writes (failure fallback exists so app workflows do not crash).
- **WhatsApp Pre-Pilot Checklist:**
  - [ ] Meta Business account configured
  - [ ] WhatsApp Business API access approved/configured
  - [ ] Phone number connected
  - [ ] Templates created/approved if needed
  - [ ] Environment variables added
  - [ ] Test messages sent successfully
- Billing/trial/subscription states are clear.
- Archived routes do not distract from the core loop.
- Lint/build pass before release.
