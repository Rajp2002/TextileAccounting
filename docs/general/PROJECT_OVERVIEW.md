# Weavly Project Overview

This document reflects the current implementation in the repository as of April 2026. For current launch scope, use `docs/general/PHASE_1_SCOPE.md` as the source of truth.

## What Weavly Is

Weavly is a production and back-office operating system for weaving factories. The codebase contains a broad product surface, but Phase 1 is organized around a practical factory loop:

1. Estimate a fabric and create a quote.
2. Convert an approved quote into a live order or start a speculative Market Run.
3. Assign workers and orders on the floor.
4. Log production against machines and shifts (with optional packing of fabric packages).
5. Settle wages, advances, and statutory deductions.
6. Track dispatches and client-facing handoff professionally.

For Phase 1, ledger, deep inventory/stock, system health, compliance registry, DPA, grievances, language requests, and admin dashboard work are out of scope unless a small part directly improves estimator, production logging/tracking, or payroll/advances.

## Roles

### Owner
Owners use the commercial and financial side of the product:
- analytics dashboard
- estimator and quotes
- order management and market runs
- payroll and advances
- machines, workers, attendance support, lightweight dispatches
- billing, referrals, WhatsApp, settings, access codes

### Supervisor
Supervisors use the floor operations side:
- unified dashboard for shift assignment and production entry
- worker management
- fixed-worker attendance
- machine view
- kharchi / supervisor float-backed cash workflows

### Admin
Admins use the compliance console:
- notice registry
- DPA (Data Processing Agreement) management and template versioning
- lockdown state and breach reporting
- grievance oversight
- export logs
- factory compliance signature tracking

## Comprehensive Feature Analysis

Detailed analysis of each module is available in the `docs/features/` directory:

1.  [**Estimator & Quotes**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/estimator_and_quotes.md): The commercial engine for fabric costing.
2.  [**Orders & Market Runs**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/orders_and_market_runs.md): Production lifecycle and speculative runs.
3.  [**Floor Operations**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/floor_operations_supervisor_dashboard.md): The unified supervisor dashboard.
4.  [**Production & Packing**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/production_and_packing.md): Converting logs into physical stock.
5.  [**Payroll & Settlements**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/payroll_and_settlements.md): Wage logic, PF/ESI, and WhatsApp payslips.
6.  [**Advances Management**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/advances_management.md): Worker loans and automatic recovery.
7.  [**Party Ledger**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/party_ledger.md): Financial tracking with Traders.
8.  [**Inventory & Stock**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/inventory_and_stock.md): Yarn, Beams, and Grey Fabric packages.
9.  [**Dispatches & Tracking**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/dispatches_and_tracking.md): Logistics and public tracking portals.
10. [**Compliance & Admin**](file:///Users/rajpatel/Projects/textile%20Saas/docs/features/compliance_and_admin.md): DPA, legal notices, and worker grievances.

## Technical Shape

- Multi-tenant SaaS with org-scoped data partitioning
- Supabase auth and PostgreSQL RLS for tenant isolation
- Next.js App Router with client/server split
- TanStack Query + Supabase client queries on interactive pages
- Supabase realtime for owner-facing live updates
- Dexie-backed offline support for floor workflows
- Razorpay subscriptions with base and premium plans
- Meta WhatsApp Cloud API for operational notifications

## Operational Realities In The Current Code

These are important so the docs stay honest:

- `lib/time.ts` exists and should be the source of truth for Surat time, but some client-side pages still derive "today" or the active shift from `new Date()` in the browser.
- Automated coverage is still thin. The maintained test suite is the finance math suite under `__tests__/finance.test.ts`; most workflow validation is still manual or script-based.
- Some older inline comments and legacy docs still mention Interakt. The implemented provider in the edge-function shared utility is Meta WhatsApp Cloud API.
- The migration history is large and active. If a doc and a migration disagree, treat the schema and runtime code as authoritative.
