# Weavly Project Overview

Last analyzed from the active codebase on May 6, 2026.

Weavly is a multi-tenant operating system for Indian weaving factories. It is designed around the way a small or mid-sized weaving unit actually works: an owner prices fabric from yarn and loom assumptions, converts confirmed work into orders or speculative market runs, assigns looms on the floor, captures shift production, turns output into stock or dispatches, and settles workers with transparent wage and advance recovery.

The repository contains a broader product surface than the Phase 1 launch needs. The current Phase 1 frame is therefore not "everything in the repo"; it is the production-ready path that creates daily value for owners and supervisors.

## Phase 1 Product Thesis

Phase 1 should make the factory's core operating loop trustworthy enough to replace paper registers, WhatsApp-only coordination, and Excel sheets.

The loop is:

1. Set up the factory basics: owner account, subscription/trial, machines, workers, payroll baseline, factory cost profile, language/WhatsApp preferences, and supervisor access.
2. Estimate fabric cost from real weaving inputs: warp/weft rows, yarn rates, GST, shortage, crimp, loom type, RPM, power, overheads, wage assumptions, commission, transport, and margin.
3. Save reusable templates and commercial quotes.
4. Move accepted quotes into active orders, or start a market run when the factory is producing for stock rather than a committed party.
5. Assign machines, workers, and order/run work on the supervisor production log screen.
6. Capture day/night shift production from loom readings, including opening/closing meter readings, correction windows, duplicate protection, rate snapshots, and machine status.
7. Convert production into analytics, order progress, market-run progress, stock inward drafts, payroll earnings, and dispatch readiness.
8. Settle payroll and advances with deduction caps, PF/ESI fields, final settlement behavior, payment modes, payslip generation, and WhatsApp communication.
9. Use dispatch, stock, commercials, billing, referrals, and settings as supporting surfaces where they make the core loop more professional and monetizable.

## Primary Users

### Owner

The owner is the commercial and control user. They care about price accuracy, loom utilization, worker payout accuracy, order pace, stock value, dispatch professionalism, billing status, and whether supervisors are recording the day correctly.

Primary owner routes:

- `/owner/today` (default landing page)
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

Secondary or archived owner routes:

- `/owner/inventory`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`
- `/owner/settings/dpa`

### Supervisor

The supervisor is the floor user. Their product world should be fast, mobile, and resilient. The main job is to make sure every shift has the right machine, worker, order/run, meter reading, and status.

Supervisor routes:

- `/supervisor/dashboard` - active production log workspace
- `/supervisor/production` - redirects into the production log workspace
- `/supervisor/workers`
- `/supervisor/attendance`
- `/supervisor/machines`

### Admin

The admin surface exists for platform governance, compliance, DPA, notices, grievances, breach reports, exports, and lockdown oversight. It is not part of Phase 1 polish unless a compliance need directly blocks launch.

## Current Feature Surface

### Estimator and Quotes

The estimator is the commercial entry point. It uses `lib/estimator.ts` and `lib/finance.ts` to compute yarn, weaving, process, overhead, commission, transport, landed cost, quote price, and margin. The owner can load/save templates, save quote snapshots, restore old quote snapshots into the estimator, and convert accepted quotes into orders.

Pain point translated: the owner's old calculator-plus-register costing process becomes a repeatable cost engine that can be reused and audited.

### Orders

Orders are live commitments. They carry party, quality, target meters, deadline, status, quote snapshot data, worker-rate snapshots, warp/weft instructions, machine assignments, dispatch state, and progress calculated from production logs.

Pain point translated: the whiteboard/order diary becomes a progress board with pace, deadline risk, machine assignment, dispatch history, and tracking token.

### Market Runs

Market runs are speculative production. They are created from the estimator when the factory wants to keep looms running for godown stock instead of a party-backed order. They track target meters, produced meters, godown meters, sold meters, realized profit, and status from production through stock and sale.

Pain point translated: speculative production stops being invisible "market maal" and becomes costed, tracked, and sellable stock.

### Supervisor Production Log

The supervisor dashboard is the active production log workspace. Supervisors select date and day/night shift, assign workers and orders to machines, update machine running/idle/maintenance status, enter loom closing readings, copy previous shift setup, submit logs, and request owner access codes for protected corrections.

Pain point translated: the production register becomes a mobile shift screen that feeds owner analytics and payroll directly.

### Stock

The active stock route focuses on physical taka/godown stock and inward drafts. It supports lots from manual, opening, order, and market-run sources; suggested inward drafts from completed production; unit counts; meters per unit; godown; cost per meter; adjustments; sales recording; and movements. The older deep yarn/beam inventory route remains outside Phase 1.

Pain point translated: the owner can answer "what is in godown, how many takas, and what did it cost?" Profit and receivables are tracked in Commercials.

### Dispatches

Dispatches turn ready output into professional handoff. The code supports order-linked dispatches, GST/e-way metadata, package lines, receipt confirmation, shortage/extra received variance, owner-confirmed receipt, and a public token-based tracking portal.

Pain point translated: informal transport handoff becomes a traceable dispatch with client-facing status and shortage reconciliation.

### Commercials

Commercials is the source of truth for revenue, profit, receivables, and payment tracking across realized and expected sources: order invoices, stock sales, market-run sales, and expected order quotes. It is not a full accounting ledger; it is an operational gross-profit and collection dashboard.

Pain point translated: the owner can answer "Paisa/profit kya hua?" and track receivables without waiting for a full accounting workflow.

### Payroll and Advances

Payroll reads production logs for meter workers and attendance/fixed salary data for fixed workers. It previews and records settlements, applies advance recovery caps, supports final settlement, PF/ESI deductions, payment mode capture, payslip PDF generation, WhatsApp sending, and paid/unpaid state.

Advances track Upaad for meter and fixed workers, pending and deducted balances, debt-to-typical-pay warnings, deletion rules, write-off support, and automatic recovery through settlement.

Pain point translated: wage disputes and advance confusion become an itemized worker-money ledger tied to actual production.

### Workers, Machines, Attendance, and Settings

Workers and machines are not support data only; they are required infrastructure for production logging and payroll. Settings contains organization identity, join codes, access-code generation, WhatsApp opt-in, template/cost profile management, supervisor float, and data/security controls.

Pain point translated: the factory gets a usable operating baseline before logs or payroll can become reliable.

### Billing, Referrals, and WhatsApp

Billing uses Razorpay subscription plans, trial state, renewal/cancel state, and payment history. Referrals are go-to-market infrastructure. WhatsApp is the market-native notification channel for access codes, daily briefs, deadline alerts, advance receipts, payslips, monthly briefs, lockdown alerts, and delivery-status logging.

> [!IMPORTANT]
> **WhatsApp status:** Required before pilot. Direct Meta WhatsApp Cloud API is the selected provider. Currently pending Meta Business setup / Indian payment method dependency for live credentials. This is a pilot-readiness blocker, not a scope-removal issue.
> Simulation mode is available for local/dev testing. Core workflows function without live WhatsApp credentials. WhatsApp failures will not block core writes.

Pain point translated: customer onboarding, monetization, and worker communication happen in the tools the market already trusts.

## Technical Shape

- Next.js App Router application with server actions and client-heavy workflow screens.
- Supabase Auth, Postgres, RLS, Realtime, RPCs, and Edge Functions.
- Role-based routing for owner, supervisor, and admin users.
- Org-scoped multi-tenancy through `org_id`, custom JWT claims, RLS policies, and server-side role checks.
- TanStack Query for interactive owner/supervisor data views.
- Tailwind CSS and local shadcn/ui primitives.
- Meta WhatsApp Cloud API edge functions with delivery logging and retry support.
- Razorpay subscriptions and webhook processing.
- Upstash-backed rate limits and session revocation checks where configured.
- Sentry config for client, server, and edge runtimes.

## Important Product Boundaries

- Phase 1 is estimator, production logging/tracking, payroll/advances, market runs, dispatch professionalism, stock/commercials support, WhatsApp communication, billing/referrals, and the setup/settings needed for those flows.
- Deep yarn/beam inventory, party ledger, supplier ledger, audit registry, system health, DPA, grievances, language requests, and admin governance are implemented or partially implemented but should not drive Phase 1 polish unless they unblock a core workflow.
- If documentation and code disagree, the active route tree, server actions, schema migrations, and `lib/phase1-scope.ts` should be treated as the current implementation.
