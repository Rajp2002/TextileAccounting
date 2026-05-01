# Weavly Master Product Document

This document is the high-context developer guide for the product as implemented in this repository as of April 30, 2026. It is intended to help engineers understand what exists in the codebase. For current Phase 1 launch scope and prioritization, `docs/general/PHASE_1_SCOPE.md` is authoritative.

## 1. Executive Summary

Weavly is a multi-tenant operating system for Indian weaving factories. The repository includes commercial planning, floor execution, stock movement, dispatch, receivables, payroll, advances, subscriptions, and compliance. Phase 1 narrows that broad surface around estimator, production logging/tracking, and payroll/advances, with analytics, market runs, dispatches, WhatsApp, referrals, billing, quotes/orders, workers, machines, and attendance kept only where they support that core loop.

The product is built around one factory loop:

1. Estimate fabric cost.
2. Turn the estimate into a quote.
3. Convert an accepted quote into an order, or create a speculative market run.
4. Assign machines and workers on the floor.
5. Log production and optionally pack it into fabric packages.
6. Dispatch finished goods professionally where lightweight dispatch support adds value.
7. Settle worker payroll, recover advances, and send WhatsApp payslips.
8. Keep billing/referrals transparent without distracting from workflow readiness.

Ledger, deep inventory/stock, system health, compliance registry, DPA, grievances, language requests, supplier accounting, and admin dashboard surfaces are not Phase 1 polish priorities unless a specific slice directly supports the core loop.

This repo already contains several focused docs. This file is the synthesis layer that ties them together:

- `docs/general/PROJECT_OVERVIEW.md`
- `docs/general/README.md`
- `USER_WORKFLOWS.md`
- `TECHNICAL_ANALYSIS.md`
- `docs/features/*.md`

## 2. Product Thesis

The product solves a specific operational gap in weaving factories: business-critical information is usually split across mental math, paper registers, WhatsApp chats, and Excel. Weavly centralizes the full chain from costing to cash collection.

The system is not a generic ERP. Its logic is tailored to weaving-factory realities:

- piece-rate workers paid by meters produced
- loom-level production logging by shift
- fabric-cost estimation using denier, beam ends, picks, crimp, and shortages
- order pace tracking against deadlines
- stock represented as fabric packages, not abstract inventory only
- worker advances with legal deduction caps during settlement
- GST-aware dispatch and ledger flows
- WhatsApp as the worker-facing notification surface

## 3. User Roles and Their Worlds

### Owner

Owners live on the commercial, financial, and configuration side of the system.

Primary concerns:

- factory setup and onboarding
- estimator, quote creation, and order conversion
- machines, workers, fixed staff, and inventory setup
- order monitoring and analytics
- stock inspection and dispatch
- party ledger, receivables, and supplier tracking
- payroll, advances, and billing
- access codes, audit, exports, and settings

Primary route family: `app/(dashboard)/owner`

### Supervisor

Supervisors live on the floor operations side.

Primary concerns:

- machine-to-order assignment visibility
- worker assignment
- shift production entry
- opening and closing meter readings
- machine status updates
- fixed-worker attendance
- kharchi / float-backed cash activity

Primary route family: `app/(dashboard)/supervisor`

### Admin

Admins live in the governance and compliance surface.

Primary concerns:

- DPA template management
- notice registry
- grievance management
- breach and lockdown oversight
- export and audit visibility

Primary route family: `app/(dashboard)/admin`

## 4. Top-Level Product Surfaces

### Public

- `/` marketing / landing
- `/track/[token]` public dispatch tracking portal
- `/privacy`, `/terms`, `/refund-policy`

### Auth and onboarding

- `/login`
- `/signup`
- `/join`
- `/verify`
- `/onboarding`
- `/auth/callback`

### Owner

- `/owner/analytics`
- `/owner/orders`
- `/owner/quotes`
- `/owner/estimator`
- `/owner/market-runs`
- `/owner/dispatches`
- `/owner/ledger`
- `/owner/inventory`
- `/owner/stock` redirects to `/owner/inventory?tab=grey-stock`
- `/owner/payroll`
- `/owner/advances`
- `/owner/fixed-workers`
- `/owner/machines`
- `/owner/billing`
- `/owner/system-health`
- `/owner/settings`
- `/owner/settings/audit`
- `/owner/settings/dpa`

### Supervisor

- `/supervisor/dashboard`
- `/supervisor/production` currently acts as the same production workspace entry
- `/supervisor/workers`
- `/supervisor/attendance`
- `/supervisor/machines`

### Admin

- `/admin`

## 5. Core Mental Model

The cleanest way to understand the product is to think in terms of domain anchors.

### Commercial anchors

- `estimator_templates`
- `estimator_quotes`
- `orders`
- `market_runs`

### Floor anchors

- `machines`
- `workers`
- `fixed_workers`
- `machine_assignments`
- `shift_assignments`
- `production_logs`

### Material anchors

- `yarn_lots`
- `beam_cards`
- `beam_card_lots`
- `yarn_movements`
- `order_yarn_requirements`
- `fabric_packages`

### Delivery and finance anchors

- `dispatches`
- `dispatch_package_lines`
- `parties`
- `party_invoices`
- `party_receipts`
- `party_adjustments`
- `payment_allocations`
- `supplier_ledger_entries`

### Worker money anchors

- `worker_advances`
- `payroll_adjustments`
- `payroll_settlements`
- `payroll_payments`
- `supervisor_float_transactions`

### Governance anchors

- `audit_log`
- `notice_registry`
- `grievances`
- `dpas`
- `organization_dpas`
- `platform_security`
- `breach_reports`
- `compliance_settings`

## 6. End-to-End Business Flow

### 6.1 Estimator first

The product assumes serious production starts from costing. The owner enters warp and weft rows, loom assumptions, overhead distribution, optional processing layers, commission, transport, and profit. The estimator computes production cost, landed cost, and quote price.

Why this matters: later order and worker-rate logic depend on estimator outputs. The estimator is not just a calculator UI; it is the upstream source for production instructions and commercial numbers.

### 6.2 Quote to order

Saved quotes become accepted commercial commitments. Once accepted, the owner converts them into live orders with target meters and deadlines. Orders then appear in the operational dashboards, where progress and pace are tracked.

Market runs are the speculative branch of the same workflow. They reuse estimator logic but do not require a party-backed sales commitment.

### 6.3 Floor assignment and logging

Supervisors work from the dashboard. They assign workers and orders to machines, set machine status, and submit production logs per shift. Those logs directly power owner analytics and meter-based payroll.

### 6.4 Submit and pack

Production can be logged as pure output or as output-plus-packaging. When packing is used, the system creates `fabric_packages`, which are then inspected, graded, and later dispatched.

### 6.5 Dispatch and receivables

Dispatch creation turns ready stock into in-transit stock, creates invoice/challan artifacts, and feeds the party ledger. Public tracking lets the buyer confirm receipt and declare shortages.

### 6.6 Payroll and worker debt recovery

Payroll settlements aggregate worker earnings, apply adjustments, recover advances, compute PF/ESI, and generate final payouts. WhatsApp payslips are sent from the backend after settlement succeeds.

### 6.7 Compliance and audit

Sensitive changes, access-code flows, DPA records, grievances, and security incidents are part of the product, not side concerns. The system is built to preserve who changed what and under which authorization context.

## 7. Architecture Overview

### Application stack

- Next.js 16 App Router
- React 19
- Tailwind CSS 4
- shadcn/ui primitives
- Supabase Auth + Postgres + RLS + Edge Functions + Realtime
- TanStack Query on interactive client surfaces
- Dexie for offline mutation queuing
- Razorpay for subscriptions
- Meta WhatsApp Cloud API for messaging
- Upstash Redis for rate limiting and revocation-related checks
- Sentry for browser, server, and edge monitoring

### Architectural style

The app uses a mixed server/client pattern:

- server pages load initial data and enforce auth
- client components provide highly interactive operational screens
- server actions back most privileged writes
- some mutation-heavy flows are moved into Postgres RPCs
- some message and scheduled flows live in Supabase edge functions

This is not a thin frontend over a pure API backend. Business logic is split across:

- TypeScript helpers in `lib/`
- Next.js server actions under route folders
- SQL migrations and RPCs in `supabase/migrations/`
- edge functions in `supabase/functions/`

## 8. Auth, Role Gates, and Tenant Isolation

### Source files

- `middleware.ts`
- `lib/auth.ts`
- `lib/supabase/server.ts`
- `lib/supabase/client.ts`
- `lib/supabase/admin.ts`

### Auth model

Supabase auth provides the session. The app reads role and `org_id` from JWT claims, with database fallback when the JWT is stale immediately after signup or onboarding.

The active roles in runtime code are:

- `owner`
- `supervisor`
- `admin`

### Middleware responsibilities

`middleware.ts` does more than route redirects:

- classifies public vs protected routes
- rate-limits auth routes
- protects non-public API routes with JSON 401 responses
- refreshes sessions
- enforces a one-hour inactivity timeout
- checks instant session revocation
- redirects authenticated users to their role home

### Tenant model

The tenant boundary is `org_id`.

Enforcement layers:

1. JWT claims include org context.
2. Server utilities derive org context server-side.
3. RLS policies scope rows to tenant membership.
4. Service-role operations are only used after explicit role checks.

Important developer rule: never trust client-provided `org_id` for writes. The codebase intentionally derives it from session context and, in offline sync, force-injects the authenticated user's org into queued mutations.

## 9. Authoritative Sources of Truth

New developers need to know which files win when docs and runtime differ.

### Highest authority by concern

- Database shape and business rules: `supabase/migrations/*.sql`
- Current auth and request protection: `middleware.ts` and `lib/auth.ts`
- Estimator math: `lib/estimator.ts`
- Payroll math helpers: `lib/finance.ts`
- Current route behavior: `app/**`
- WhatsApp send path: `supabase/functions/_shared/whatsapp.ts`

### Explicit non-authority

`supabase/schema.sql` is marked deprecated and is not the deployment source of truth.

## 10. Major Product Modules

### 10.1 Estimator and Quotes

Primary files:

- `app/(dashboard)/owner/estimator/*`
- `lib/estimator.ts`
- `lib/wage-config.ts`
- `lib/schemas.ts`

What it does:

- models warp and weft composition
- calculates yarn consumption and cost
- applies shortage, crimp, warping, sizing, winding, processing, finishing
- distributes monthly overhead per meter
- applies commission, transport, and profit
- creates reusable templates and quotes

Important logic nuances:

- The current estimator is denier-based, not generic GSM-first logic.
- Loom type presets are intentionally opinionated and editable.
- Overhead is modeled as itemized monthly cost lines, not a single arbitrary percentage.
- `overheadPct` is a derived display artifact in current code, not the core input.
- Capacity is part of the costing model; under-utilization has an explicit cost expression.
- `orderQuantityM` activates order-level commercial outputs like total order value and gross profit.

Why this matters downstream:

- quote acceptance creates the sales-side basis for orders
- worker-rate assumptions influence production economics
- fabric instructions flow into order context

### 10.2 Orders

Primary files:

- `app/(dashboard)/owner/orders/*`
- `app/(dashboard)/owner/actions/orders.ts`
- `lib/actions/order-assignment.ts`

What it does:

- stores live production commitments
- tracks target meters, deadline, progress, and status
- exposes active orders to owner and supervisor workflows
- links machine assignment and production output back to a commercial object

Important logic nuances:

- order progress is query-driven through summary/RPC-backed views, not hand-maintained counters
- completed orders release machine links
- sensitive edits can require owner access code validation
- increasing the target of a completed order can reactivate it

Key statuses:

- `active`
- `completed`
- `cancelled`

### 10.3 Market Runs

Primary files:

- `app/(dashboard)/owner/market-runs/*`
- related schema additions in `supabase/migrations/20260429000000_market_runs.sql`

What it does:

- represents speculative production not tied to a specific party sale
- keeps factory capacity in use even without confirmed buyer demand
- eventually bridges into sales and stock handling

Product nuance:

Market runs are not an afterthought; they are a first-class variation of the same production machinery, but without the normal customer-backed order assumption.

### 10.4 Supervisor Dashboard and Floor Operations

Primary files:

- `app/(dashboard)/supervisor/dashboard/page.tsx`
- `app/(dashboard)/supervisor/actions.ts`
- `components/navigation/supervisor-nav.tsx`

What it does:

- operational command center for the floor
- machine status updates
- worker and order assignments
- shift-based production entry
- attendance-adjacent floor workflows
- access-code-protected mutations
- kharchi-related actions and supervisor float adjacency

Important logic nuances:

- production logs now care about opening and closing meter readings
- logs carry a worker-rate snapshot to preserve historical settlement correctness
- previous closing readings are looked up server-side to support shift continuity
- self-correction behavior is audit-aware
- the code differentiates day and night shifts explicitly

### 10.5 Production Logging

Primary files:

- `app/(dashboard)/supervisor/actions.ts`
- `production_logs` related migrations

What it does:

- records meter output by machine, worker, date, and shift
- drives analytics
- drives meter-worker payroll
- can become the source event for fabric package creation

Important logic nuances:

- `production_logs` are not just a history table; they are a cross-module accounting source
- worker pay uses `worker_rate_snapshot`, not simply the current worker rate
- log corrections and overwrites are treated as sensitive events

### 10.6 Packing and Grey Stock

Primary files:

- `fabric_packages` schema migrations
- owner inventory and stock clients
- dispatch UI surfaces

What it does:

- turns produced meters into package-level stock objects
- preserves order linkage
- allows inspection, grading, readiness, and dispatch selection

Important logic nuances:

- stock is tracked as physical packages, not only aggregate meter balances
- package status matters operationally: production can exist before dispatch readiness
- package flows bridge factory floor, quality review, and delivery execution

### 10.7 Inventory

Primary files:

- `app/(dashboard)/owner/inventory/*`
- `app/(dashboard)/owner/stock/*`
- migrations for yarn, beam, and stock modules

What it does:

- tracks yarn lots and movements
- tracks beam cards and beam-card to lot relationships
- tracks grey stock via `fabric_packages`
- supports order-level material planning via `order_yarn_requirements`

Important logic nuances:

- inventory is layered: raw yarn, semi-processed beam state, finished grey stock
- beam tracking is feature-flagged at the organization level
- settings allow beam tracking enablement, so developers should not assume all orgs use the same material granularity

### 10.8 Dispatches and Public Tracking

Primary files:

- `app/(dashboard)/owner/dispatches/*`
- `app/(public)/track/[token]/*`
- `app/actions/track.ts`
- `lib/generate-challan.ts`

What it does:

- creates dispatch records from ready stock
- generates invoice / challan documents
- exposes public tracking by token
- allows shortage acknowledgment and later ledger follow-through

Important logic nuances:

- dispatch is both logistics and sales
- stock state changes are part of dispatch creation
- tracking is intentionally public-but-tokenized rather than authenticated
- dispatch data needs to preserve enough invoice detail for ledger reconciliation and GST-ready exports

### 10.9 Party Ledger

Primary files:

- `app/(dashboard)/owner/ledger/*`
- `party_*` tables and related migrations

What it does:

- tracks customer balances
- stores invoices, receipts, and adjustments
- supports payment allocation across invoices
- exposes aging and reconciliation views

Important logic nuances:

- ledger debits from dispatch should preserve tax breakdown, not just total amount
- shortage-related credits are linked adjustments, not random manual entries
- receipts and invoice allocations are separate concepts
- suppliers now have a parallel but distinct ledger track

### 10.10 Supplier Ledger

Primary files:

- `supabase/migrations/20260429203000_add_payment_allocations_and_suppliers.sql`
- ledger components under `app/(dashboard)/owner/ledger/components`

What it does:

- stores supplier master records
- tracks supplier purchases and payments

Why it matters:

This extends the ledger concept beyond outbound receivables into upstream procurement visibility.

### 10.11 Payroll

Primary files:

- `app/(dashboard)/owner/payroll/*`
- `lib/finance.ts`
- `lib/generate-payslip.ts`
- payroll-related migrations from March and April 2026

What it does:

- settles piece-rate and fixed workers
- supports cycle-based processing
- applies bonuses/fines through payroll adjustments
- computes employer-side statutory fields
- triggers WhatsApp payslip delivery

Important logic nuances:

- settlement is RPC-based for transactional integrity
- meter workers are paid from production logs
- fixed workers can be monthly or daily
- daily fixed-worker pay is capped so it does not exceed monthly salary
- payroll settlement records carry itemization and employer-side cost fields
- settlements can be reversed through `unsettle_worker_payroll`, which must also restore recovered advance state

### 10.12 Advances

Primary files:

- `app/(dashboard)/owner/advances/*`
- `worker_advances` migrations
- `supabase/functions/send-advance-receipt/index.ts`

What it does:

- records worker loans / kharchi / related advance types
- tracks outstanding balances
- integrates with payroll settlement for recovery
- sends worker-facing receipts

Important logic nuances:

- advance types now include `kharchi`, `upaad`, and `inam_advance`
- the system models recovery, not just issuance
- reversal safety matters because payroll can be unsettled after the fact

### 10.13 Fixed Workers and Attendance

Primary files:

- `app/(dashboard)/owner/fixed-workers/*`
- `app/(dashboard)/supervisor/attendance/*`

What it does:

- manages salaried or attendance-based non-meter staff
- records daily presence
- feeds fixed-worker payroll logic

Important logic nuance:

The product supports both meter workers and fixed workers as first-class payroll populations. Many other modules care which category a worker belongs to.

### 10.14 Machines

Primary files:

- `app/(dashboard)/owner/machines/*`
- `app/(dashboard)/supervisor/machines/*`
- machine-related migrations

What it does:

- defines the loom fleet
- tracks active status, current assignment, and operational visibility

Important logic nuance:

Machine state is not purely informational. It shapes what can be assigned, what appears in the supervisor workspace, and how production history is interpreted.

### 10.15 Analytics

Primary files:

- `app/(dashboard)/owner/analytics/*`
- dashboard RPC migrations around April 2026

What it does:

- daily KPI strips
- worker breakdown
- machine utilization
- order health and pace
- yield alerts

Important logic nuance:

The analytics layer leans heavily on SQL functions and summary views. When numbers look wrong, the fix is often in migrations or RPC logic rather than in TS rendering code.

### 10.16 Billing and Subscriptions

Primary files:

- `app/(dashboard)/owner/billing/page.tsx`
- `app/api/subscriptions/*`
- `app/api/webhooks/razorpay/route.ts`
- `lib/razorpay.ts`
- `lib/subscription.ts`

What it does:

- manages trial start
- creates subscriptions
- handles auto-renew settings
- processes Razorpay webhook events
- enforces base vs premium plan concepts

Important logic nuance:

Billing is product gating infrastructure, not a separate external admin tool. Changes here may affect access to premium features like compliance and enhanced workflows.

### 10.17 Compliance and Admin

Primary files:

- `app/(dashboard)/admin/*`
- `app/(dashboard)/owner/settings/audit/*`
- `app/owner/settings/dpa/page.tsx`
- `lib/actions/compliance.ts`

What it does:

- tracks DPA definitions and organization signatures
- manages legal notices and grievances
- surfaces audit logs
- supports security/lockdown workflows

Important logic nuances:

- compliance data is org-scoped but admin-visible by role
- DPA state is versioned and evidence-based
- sensitive changes are expected to be reviewable later

## 11. Key Data Model Groups

This is not a full schema dump; it is the shape a developer needs in their head.

### Tenant and identity

- `organizations`
- `profiles`

Notes:

- organization owns the tenant boundary
- profile carries `role` and `org_id`
- auth lives in Supabase `auth.users`, while app metadata is mirrored into profile-aware flows

### Workforce and machines

- `workers`
- `fixed_workers`
- `machines`
- `attendance`
- `machine_assignments`
- `shift_assignments`

### Production

- `production_logs`
- `daily_brief_logs`

### Estimator and commercial setup

- `estimator_settings`
- `estimator_templates`
- `estimator_quotes`
- `qualities`
- `factory_cost_profile`

### Orders and speculative production

- `orders`
- `market_runs`
- `market_run_sales`

### Inventory and stock

- `yarn_lots`
- `yarn_movements`
- `beam_cards`
- `beam_card_lots`
- `order_yarn_requirements`
- `fabric_packages`

### Dispatch and customer finance

- `dispatches`
- `dispatch_package_lines`
- `parties`
- `party_invoices`
- `party_receipts`
- `party_adjustments`
- `party_dispatch_claims`
- `payment_allocations`

### Supplier finance

- `suppliers`
- `supplier_ledger_entries`

### Worker finance

- `worker_advances`
- `payroll_configs`
- `payroll_adjustment_categories`
- `payroll_adjustments`
- `payroll_settlements`
- `payroll_payments`
- `supervisor_float_transactions`

### Governance and compliance

- `audit_log`
- `platform_security`
- `notice_registry`
- `worker_consent_artifacts`
- `grievances`
- `compliance_settings`
- `language_requests`
- `dpas`
- `organization_dpas`
- `breach_reports`

### Messaging and notification support

- `whatsapp_delivery_log`
- `whatsapp_cooldowns`

## 12. RPC and Database-Heavy Logic

The app depends heavily on SQL-side logic. Do not assume TypeScript is the full business layer.

Examples surfaced directly in code or docs:

- payroll settlement RPCs such as `settle_worker_payroll` and `unsettle_worker_payroll`
- cycle-bound derivation RPC `get_cycle_bounds`
- analytics RPCs such as `get_kpi_today_live`, `get_kpi_yesterday`, `get_active_orders_with_pace`, `get_worker_breakdown_today`, and `get_yield_alert`
- helper RPCs for audit/session behavior such as `set_config`
- dispatch- and packing-related transactional database flows referenced by UI docs and actions

Developer implication:

When debugging incorrect totals, pace, payroll results, or stock transitions, inspect migrations first. A TS-only read will miss real business rules.

## 13. Edge Functions and Background-Like Behaviors

Supabase edge functions currently include:

- `check-pace-index`
- `monthly-brief`
- `retry-failed-messages`
- `send-access-code`
- `send-advance-receipt`
- `send-daily-brief`
- `send-deadline-alert`
- `send-lockdown-alert`
- `send-payslip`
- `whatsapp-summary`
- `whatsapp-webhook`

These functions handle the operational messaging layer, scheduled communications, retry behavior, and webhook entry points.

Important nuance:

Some older comments or docs may still mention Interakt, but the current implemented provider path is Meta WhatsApp Cloud API. The shared send utility is in `supabase/functions/_shared/whatsapp.ts`.

## 14. Offline Support

Primary files:

- `lib/db.ts`
- `hooks/use-offline-sync.ts`
- `components/offline-sync-provider.tsx`

What it does:

- queues mutations locally in Dexie when needed
- syncs them once connectivity returns
- force-injects `org_id` from the authenticated session before replay

Important logic nuance:

Offline support is not universal offline-first state replication. It is a bounded mutation queue for operational continuity, especially relevant to floor workflows.

## 15. Access Codes and Sensitive Actions

Primary files:

- `components/AccessCodeGenerator.tsx`
- `app/(dashboard)/owner/actions/orders.ts`
- `app/(dashboard)/supervisor/actions.ts`
- `lib/rate-limit.ts`

What it does:

- generates temporary owner-controlled one-time codes
- protects sensitive edits and overrides
- rate-limits attempts
- locks out abusers after repeated failures
- consumes the code after successful validation

Important nuance:

Access codes are part of the product's internal control model. They are not just cosmetic extra verification. Audit behavior and mutation authorization may depend on whether an access code was used.

## 16. Time and Shift Handling

Primary file:

- `lib/time.ts`

Intended behavior:

- centralize Surat / India timezone handling
- provide canonical "today" and "yesterday" helpers

Current caveat:

The codebase contains this helper, but some client-side surfaces still use browser-local `new Date()` semantics. That means date and shift behavior should be treated carefully during bug fixes, especially around midnight and cross-timezone testing.

## 17. Security and Operational Guardrails

Relevant files:

- `next.config.ts`
- `middleware.ts`
- `SECURITY.md`
- `lib/rate-limit.ts`

Implemented guardrails include:

- CSP and security headers
- strict frame denial
- auth-route rate limiting
- access-code attempt throttling and lockout
- API JSON 401 handling
- inactivity timeout
- instant session revocation checks

## 18. Environment and External Dependencies

The repo currently expects Supabase, Razorpay, Upstash Redis, and Sentry configuration. The existing docs already enumerate the main environment variables; refer to `docs/general/README.md` for the current list.

Broad dependency categories:

- Supabase public and service-role keys
- site URL and deployment URL
- Upstash Redis credentials
- Razorpay keys, plans, and webhook secret
- Sentry identifiers
- WhatsApp provider secrets for edge functions

## 19. Codebase Map for New Developers

### High-value directories

- `app/` route surfaces and route-local actions
- `components/` reusable UI and product-specific interaction components
- `lib/` business helpers, auth, formatting, calculators, integrations
- `hooks/` client-side product behavior
- `supabase/migrations/` authoritative database evolution and RPC logic
- `supabase/functions/` edge functions and messaging flows
- `docs/` human-oriented module explanations
- `scripts/` one-off diagnostics, data cleanup, and verification utilities

### Particularly important files to read early

1. `docs/general/PROJECT_OVERVIEW.md`
2. `USER_WORKFLOWS.md`
3. `TECHNICAL_ANALYSIS.md`
4. `middleware.ts`
5. `lib/auth.ts`
6. `lib/estimator.ts`
7. `lib/finance.ts`
8. `app/(dashboard)/supervisor/actions.ts`
9. `app/(dashboard)/owner/actions/orders.ts`
10. payroll, dispatch, and ledger migrations from March-April 2026

## 20. Known Caveats and Honest Reality Checks

These are important for onboarding because they explain where confusion is likely.

### Documentation drift exists

There are older notes across the repo. The current code and migrations should win when something conflicts.

### Test coverage is still thin

The most maintained automated suite in the repo is `__tests__/finance.test.ts`. Much workflow validation is still manual or script-assisted.

### Business logic is split

Developers will miss important behavior if they only read frontend code. Many critical guarantees live in SQL RPCs, policies, and migration-defined helpers.

### Product surface is broad

This is a large operational app with many interlocking modules. Narrow fixes often have cross-module consequences, especially around:

- production logs
- payroll settlement
- stock transitions
- order status and machine assignment
- access-code-protected edits
- ledger adjustment generation

## 21. Recommended Developer Approach

When working in this codebase:

1. Identify the business object first: order, package, settlement, advance, dispatch, etc.
2. Find the route-level page/client and the related server action.
3. Check `lib/` for helper math or integration code.
4. Check migrations for table shape, RPCs, triggers, and policy behavior.
5. Confirm whether the flow has WhatsApp, audit, or billing side effects.
6. Watch for tenant, role, and access-code implications.

## 22. Related Detailed Docs

For deeper module-specific reading, use these alongside this master guide:

- `docs/features/estimator_and_quotes.md`
- `docs/features/orders_and_market_runs.md`
- `docs/features/floor_operations_supervisor_dashboard.md`
- `docs/features/production_and_packing.md`
- `docs/features/inventory_and_stock.md`
- `docs/features/dispatches_and_tracking.md`
- `docs/features/party_ledger.md`
- `docs/features/payroll_and_settlements.md`
- `docs/features/advances_management.md`
- `docs/features/compliance_and_admin.md`

## 23. Bottom Line

Weavly is best understood as a textile-factory operating system with three tightly coupled engines:

1. a commercial engine for costing, quoting, and order planning
2. an operational engine for floor logging, packaging, inventory, and dispatch
3. a financial/governance engine for payroll, receivables, advances, billing, compliance, and audit

If a new developer internalizes those three engines and the tables that anchor them, the rest of the codebase becomes much easier to reason about.
