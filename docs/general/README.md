# Weavly Documentation Index

Last analyzed from the active codebase on May 6, 2026.

Weavly is a multi-tenant operating system for Indian weaving factories. The current Phase 1 source of truth is the factory loop from estimating to quotes/orders/market runs, production logging, stock/dispatch/commercial visibility, and payroll/advances.

## Documentation Source of Truth

1. [CURRENT_PRODUCT_IMPLEMENTATION_ANALYSIS.md](./CURRENT_PRODUCT_IMPLEMENTATION_ANALYSIS.md) - **Read this first** for current implementation details.
2. [PHASE_1_SCOPE.md](./PHASE_1_SCOPE.md) - Authoritative scope boundary for active/deferred features.
3. [MASTER_PRODUCT_DOCUMENT.md](./MASTER_PRODUCT_DOCUMENT.md) - Product narrative and positioning.

> [!WARNING]
> Do not rely on archived or deprecated documents unless explicitly instructed.

Start here:

- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) - concise product and implementation overview.
- [MASTER_FEATURE_DOCUMENT.md](./MASTER_FEATURE_DOCUMENT.md) - unified feature map across all module docs.
- [PHASE_1_ARCHIVE.md](./PHASE_1_ARCHIVE.md) - routes and product areas deferred from Phase 1 polish.

Root-level companion docs:

- [USER_WORKFLOWS.md](../../USER_WORKFLOWS.md) - role-based user workflows and end-to-end flows.
- [TECHNICAL_ANALYSIS.md](../../TECHNICAL_ANALYSIS.md) - implementation architecture and technical boundaries.
- [WHATSAPP_INTEGRATION_GUIDE.md](../../WHATSAPP_INTEGRATION_GUIDE.md) - Meta WhatsApp Cloud API setup and operations.
- [TESTING_GUIDE.md](../../TESTING_GUIDE.md) - validation plan for Phase 1.
- [SECURITY.md](../../SECURITY.md) - security, access-code, RLS, and operational notes.

Feature docs:

- [Estimator and Quotes](../features/estimator_and_quotes.md)
- [Orders and Market Runs](../features/orders_and_market_runs.md)
- [Floor Operations and Supervisor Dashboard](../features/floor_operations_supervisor_dashboard.md)
- [Production and Packing](../features/production_and_packing.md)
- [Inventory and Stock](../features/inventory_and_stock.md)
- [Dispatches and Tracking](../features/dispatches_and_tracking.md)
- [Commercials and Party Ledger](../features/party_ledger.md)
- [Payroll and Settlements](../features/payroll_and_settlements.md)
- [Advances Management](../features/advances_management.md)
- [Compliance and Admin](../features/compliance_and_admin.md)

## Current Phase 1 Owner Surface

- `/owner/today` - **Default landing page** and daily action center.
- `/owner/analytics` - live production overview, historical date view, order health, machine utilization, trend, worker breakdown.
- `/owner/estimator` - costing engine, templates, quotes, market-run creation, Start Party Order.
- `/owner/quotes` - quote history, status changes, re-estimate, accepted quote conversion.
- `/owner/orders` - active order board, progress, pace, assignment, dispatch section.
- `/owner/market-runs` - speculative production tracking.
- `/owner/stock` - expected godown ledger, adjustments, dispatch stock differences, movements.
- `/owner/dispatches` - order-linked dispatches, Sell & Dispatch, receipt reconciliation, tracking links.
- `/owner/commercials` - source of truth for revenue, profit, receivables, and payment tracking.
- `/owner/payroll` - meter and fixed payroll, settlements, WhatsApp payslips.
- `/owner/advances` - worker Upaad tracking and recovery support.
- `/owner/fixed-workers` - workforce setup and fixed staff management.
- `/owner/machines` - loom setup and assignment infrastructure.
- `/owner/billing` - trial, Razorpay subscription, payment history, referrals.
- `/owner/settings` - org identity, join code, access codes, WhatsApp, templates, cost profile, float/security controls.

## Current Phase 1 Supervisor Surface

- `/supervisor/dashboard` - primary production log workspace.
- `/supervisor/production` - redirect into the production log workspace.
- `/supervisor/workers` - worker maintenance where allowed.
- `/supervisor/attendance` - fixed worker attendance.
- `/supervisor/machines` - machine status/view.

## Archived or Deferred Surfaces

The active archive gate is in `lib/phase1-scope.ts`.

- `/admin`
- `/owner/inventory`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`

These should not define Phase 1 readiness unless a specific slice directly supports the core loop.
