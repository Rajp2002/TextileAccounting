# Phase 1 Feature Archive

Last reviewed against the active documentation pass on May 31, 2026.

The repository contains modules that are valuable for a future fuller ERP-style release, but they are not part of the Phase 1 polish path. Archiving here means "do not make this a launch blocker," not "delete the code."

## Actively Archived Routes

The current active archive gate lives in `lib/phase1-scope.ts` and is enforced from `middleware.ts`.

Routes currently redirected to `/feature-archived`:

- `/admin`
- `/owner/inventory`
- `/owner/ledger`
- `/owner/settings/audit`
- `/owner/system-health`

## Not Archived in Current Code

`/owner/stock` is not in `PHASE_1_ARCHIVED_ROUTES` and is present in owner navigation. This reflects the Phase 1 extension around godown stock, inward drafts, stock sales, and commercials support. The older deep yarn/beam inventory route remains archived through `/owner/inventory`.

## Product Areas Deferred From Phase 1 Polish

- Admin dashboard and compliance command center.
- Deep yarn lots, beam cards, yarn movements, and order yarn requirements.
- Party ledger, supplier ledger, payment allocation, and full accounting replacement.
- Audit-table browsing and compliance registry UI.
- System-health dashboard and manual message retry UI.
- DPA template/version management.
- Grievance and language-request workflows.
- Full DPDP data export/delete polish beyond launch-critical security controls.

## Kept in Phase 1

- Factory Today as default owner action center.
- Estimator and quote snapshots.
- Start Party Order fast path.
- Quote to order conversion.
- Orders and market runs.
- Supervisor production log.
- Owner production analytics.
- Godown stock board (expected ledger and dispatch reconciliation focus).
- Dispatches and public tracking (Sell & Dispatch).
- Commercials receivables and payment tracking.
- Payroll and advances.
- Workers, machines, attendance, settings, access codes.
- Billing/subscription and referrals.
- Core WhatsApp notifications.

## Future Reactivation Checklist

When reactivating an archived module:

1. Remove the route from `PHASE_1_ARCHIVED_ROUTES`.
2. Restore or promote the navigation entry.
3. Verify role guards and RLS policies.
4. Run the module's main workflow manually end to end.
5. Check whether Phase 1 shortcuts or simplified flows should now point into the reactivated module.
6. Update `PHASE_1_SCOPE.md`, `PROJECT_OVERVIEW.md`, and the relevant feature document.
