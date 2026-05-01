# Weavly Phase 1 Scope

This document is the Phase 1 product frame for Weavly. The codebase contains a broader operating-system surface, but Phase 1 should be judged by whether it makes the core factory operating loop production-ready.

## Phase 1 Thesis

Phase 1 is not a full ERP launch. It is a focused launch around the workflows that create daily value for weaving factories:

1. Estimate fabric work accurately.
2. Keep looms productive through client orders or market runs.
3. Log production cleanly by shift, machine, worker, and order/run.
4. Settle payroll and advances with trust.
5. Communicate operationally through WhatsApp.
6. Present professionally to parties through quotes, dispatches, and tracking.

The product rule:

> A Phase 1 feature must materially improve estimating, production logging/tracking, payroll/advances, loom utilization, client professionalism, WhatsApp communication, billing transparency, or market penetration.

If a feature does not support one of those outcomes, it is out of scope for Phase 1 even if it exists in the repository.

## Core Pillars

### 1. Estimator

The estimator is the commercial entry point. It must be reliable enough for owners to trust it over paper, Excel, and mental math.

Phase 1 expectations:

- Accurate warp/weft costing with yarn rates, GST, shortage, crimp, and conversion charges.
- Clear landed cost, quote price, and margin visibility.
- Quote creation and quote history.
- Fabric templates for repeat qualities.
- Accepted quote to order conversion.
- Worker piece-rate snapshot that flows downstream into production and payroll.
- Factory cost profile only where it improves quote accuracy.

Polish priorities:

- Reduce first-time complexity with a clearer basic path.
- Add focused tests for estimator formulas and quote snapshots.
- Validate factory math assumptions with real sample calculations.
- Keep advanced costing controls available but secondary.

### 2. Production Logging And Tracking

Production logging is the floor source of truth. It feeds order progress, market-run progress, analytics, and payroll.

Phase 1 expectations:

- Supervisor shift workspace for day/night production entry.
- Machine, worker, and order/run assignment per shift.
- Opening and closing meter readings.
- Production logs with rate snapshots.
- Duplicate protection and controlled correction flow.
- Owner analytics for production tracking, order progress, and market-run visibility.
- Market runs as a first-class production mode, because factories often run looms speculatively when client orders are not constant.

Polish priorities:

- Position the supervisor landing screen as a production log workspace, not a generic dashboard.
- Keep production entry fast on mobile.
- Make order/run assignment state obvious before logging.
- Add validation around negative readings, duplicate overwrites, date bounds, and missing assignments.
- Treat packing/stock linkage as optional support, not the center of Phase 1 production logging.

### 3. Payroll And Advances

Payroll and advances turn production logs into worker trust. This is one of the most important production-readiness surfaces.

Phase 1 expectations:

- Piece-rate payroll from production logs.
- Fixed and daily worker payroll.
- Worker advances / Upaad.
- Automatic advance recovery with deduction caps.
- PF/ESI fields and deductions where enabled.
- Payment mode capture.
- Settlement records with itemized breakdowns.
- WhatsApp payslips and advance receipts.

Polish priorities:

- Ensure preview and final settlement calculations cannot drift.
- Add tests for settlement, deduction caps, final settlement, PF/ESI, and advance recovery.
- Make reversals/write-offs clearly auditable.
- Keep payroll screens calm, explicit, and owner-trustworthy.

## Kept In Phase 1 Because They Support The Core

### Owner Analytics

Keep owner analytics, but keep it operational. It should focus on:

- order progress
- market-run progress
- production by machine/worker/shift
- pace and delay visibility
- payroll-relevant production totals

Avoid broad executive-dashboard expansion unless it directly helps production or payroll decisions.

### Market Runs

Keep market runs. They are not a side feature; they reflect how factories actually keep looms productive when confirmed client orders are not always available.

Market runs should reuse estimator logic and feed production tracking cleanly.

### Dispatches

Keep dispatches as a lightweight professionalism layer:

- delivery/challan documentation
- dispatch history
- public tracking where useful
- client-facing polish

Avoid turning dispatches into a full stock, accounting, or logistics suite during Phase 1.

### Quotes And Orders

Keep quotes and orders because they connect the estimator to production logging.

Phase 1 should support:

- saved quotes
- accepted quote to order conversion
- active order progress
- worker rate propagation
- order instructions for the floor

### Workers, Machines, And Attendance

Keep these as required infrastructure for production logging and payroll.

### WhatsApp

Keep WhatsApp because it matches user behavior in the market and strengthens trust:

- payslips
- advance receipts
- access-code requests
- daily production summaries
- key operational notifications

WhatsApp should support the core workflows without making the core writes depend on message delivery.

### Billing And Subscription

Keep billing/subscription for transparency and monetization. Keep it simple:

- current plan
- trial state
- renewal/cancel state
- payment history where available

Avoid overbuilding billing analytics or plan complexity in Phase 1.

### Referrals

Keep referrals as go-to-market infrastructure. Network effects matter in this industry, but referral work should remain lightweight and should not compete with workflow readiness.

## Out Of Scope For Phase 1

These modules may exist in the repository, but they should not drive Phase 1 polish or navigation prominence unless a specific part directly supports the core loop.

- Ledger / party accounting
- Deep inventory, stock, yarn batch, beam, and supplier workflows
- System health console
- Compliance registry
- DPA management
- Grievances
- Language requests
- Admin dashboard
- Supplier ledger and payment allocations
- Full CRM/accounting workflows
- Heavy platform governance surfaces

## Navigation Implication

Phase 1 owner navigation should feel like:

- Analytics
- Estimator
- Quotes
- Orders
- Market Runs
- Dispatches
- Payroll
- Advances
- Workers
- Machines
- Billing
- Settings

Phase 1 supervisor navigation should feel like:

- Production Log
- Workers
- Attendance
- Machines

Out-of-scope modules should be hidden, feature-flagged, or moved away from the primary path until the three pillars are production-ready.

Archived Phase 1 routes are documented in `docs/general/PHASE_1_ARCHIVE.md` and gated by `lib/phase1-scope.ts`.

## Readiness Checklist

Before calling Phase 1 production-ready:

- Estimator formulas are tested against real factory examples.
- Quote to order to production to payroll flow has an end-to-end test plan.
- Production logging handles duplicate/correction/negative/missing-assignment cases cleanly.
- Payroll settlement preview matches final settlement behavior.
- Advances recovery and reversals are auditable.
- Market runs appear clearly in analytics and production tracking.
- Dispatch creation remains lightweight and does not require full inventory readiness.
- WhatsApp failures do not block core writes.
- Primary navigation reflects the Phase 1 focus.
- Lint/build/test gates are clean enough for release confidence.
