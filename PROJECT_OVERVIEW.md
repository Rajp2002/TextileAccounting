# Weavly Project Overview

This document reflects the current implementation in the repository as of April 2026.

## What Weavly Is

Weavly is a production and back-office operating system for weaving factories. The app is organized around a practical factory loop:

1. Estimate a fabric and create a quote.
2. Convert an approved quote into a live order.
3. Assign workers and orders on the floor.
4. Log production against machines and shifts.
5. Settle wages, advances, and statutory deductions.
6. Track dispatches, stock, ledger balances, and compliance activity.

## Roles

### Owner
Owners use the commercial and financial side of the product:
- analytics dashboard
- estimator and quotes
- order management
- party ledger
- payroll and advances
- machines, workers, inventory, stock, dispatches
- billing, audit, settings, exports, access codes

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
- DPA and lockdown state
- grievance oversight
- export logs
- breach reporting

## Current Module Map

### Estimator, Quotes, and Orders
- Estimator lives at `/owner/estimator`.
- Quotes are persisted and browsable at `/owner/quotes`.
- Orders live at `/owner/orders`.
- The product still follows an estimator-first design, but the authoritative implementation is the code and migrations, not the older narrative docs.

### Floor Operations
- The main supervisor workspace is `/supervisor/dashboard`.
- `/supervisor/production` now redirects into that unified dashboard.
- Supervisors can assign workers and orders to machines, update machine status, copy previous shift state, and bulk-log production.

### Payroll and Advances
- Payroll lives at `/owner/payroll`.
- Advances live at `/owner/advances`.
- Current implementation supports:
  - piece-rate settlements from `production_logs`
  - fixed-worker settlements from attendance
  - bonus and fine adjustments
  - 50% deduction cap logic for advances
  - PF/ESI calculations for eligible workers
  - itemized settlement payloads used for PDF and WhatsApp messaging

### Commercial and Inventory Operations
- Party ledger: `/owner/ledger`
- Grey fabric stock: `/owner/stock`
- Yarn and beam inventory: `/owner/inventory`
- Dispatches and tracking: `/owner/dispatches`

### Settings and Compliance
- Settings: `/owner/settings`
- Audit: `/owner/settings/audit`
- Admin compliance console: `/admin`
- Public tracking: `/track/[token]`

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
