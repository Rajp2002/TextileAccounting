# Phase 1 Feature Archive

These modules are preserved in the repository for a future release, but they are not part of the Phase 1 runtime surface.

## Archived Routes

- `/admin`
- `/owner/inventory`
- `/owner/stock`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`

The active archive gate lives in `lib/phase1-scope.ts` and is enforced from `middleware.ts`. Archived routes redirect to `/feature-archived` so their pages, queries, and heavier workflows do not load during Phase 1.

## Archived Product Areas

- Ledger and supplier ledger
- Inventory, yarn stock, beam cards, and stock page
- System health dashboard
- Admin dashboard
- Audit/compliance registry screens
- DPDP data export/delete settings flow

## Kept In Phase 1

- Estimator
- Payroll and advances
- Production logging
- Owner production analytics
- Orders and market runs
- Dispatch challans
- Billing/subscription and referrals
- WhatsApp core integration

Future reactivation should start by removing the route from `PHASE_1_ARCHIVED_ROUTES`, then restoring its navigation entry and checking whether any Phase 1 shortcuts need to point back into that module.
