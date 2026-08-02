# Sprint 10 — Saved Costings, Rates, Versions, and Comparison

Date: 2026-08-02 IST
Status: Release-ready

## Objective

Make Base reusable for repeat customers and recurring fabric qualities without changing the economics of a saved costing when rates, defaults, or factory assumptions change.

## Delivered contract

- Saved Costings support search, sorting, active/archived filtering, favourites, archive, restore, and stable costing group/version identity.
- **Use as Starting Point** creates a separate editable copy. It is visibly distinct from the explicit **Open and save new version** action.
- Two saved costings can be compared only when they carry the same canonical calculation and rounding contract. The comparison reads persisted snapshots and identifies changes in yarn layers/rates/cost, waste, overhead, margin, production and break-even totals, landed/selling price, and expected profit.
- The Yarn Rate Book presents current and previous values, source, effective date, notes, review status, and history. Discovered rates remain unreviewed until the owner uses **Confirm current rate**; stale, due-soon, and overdue rates have an explicit review path.
- Rate discovery, review, save, archive, and restore use atomic mutation boundaries with optimistic concurrency. Archive/favourite metadata does not create a new economic version.
- New canonical snapshots carry schema version and audit data. Older snapshots remain readable, and historical snapshots never recalculate from current Rate Book or factory defaults.

## Database change

Migration `20260802121858_sprint10_saved_costing_library_state.sql` adds:

- A tenant-scoped index for Saved Costings library state.
- `update_saved_costing_library_state_atomic(...)` for archive/restore/favourite updates with owner, entitlement, lockdown, and stale-write checks.
- `discover_yarn_rate_atomic(...)` for atomic unreviewed rate discovery/promotion without creating a trusted review event.

The migration does not rewrite existing `estimator_quotes` snapshots or rate history.

## Verification

- `npx vitest run` — 133 test files passed; 859 tests passed; 1 skipped.
- `npx tsc --noEmit --pretty false` — passed.
- `npm run build` — passed; Next.js production build generated 45 static pages.
- Targeted ESLint checks — passed.
- `git diff --check` — passed.
- Added `__tests__/sprint10-saved-costings-rates-comparison.test.ts` covering library filters/identity, canonical comparison, no current-rate recalculation, and UI/action/migration boundaries.

## Release evidence

The migration dry-run identified only the Sprint 10 migration. The linked production migration, merged `main` commit, production deployment URL, and post-deploy verification are recorded below during release execution.

| Check | Evidence |
| --- | --- |
| Linked Supabase migration | Pending release execution |
| Merged `main` commit | Pending release execution |
| Production deployment | Pending release execution |
| Post-deploy smoke check | Pending release execution |

## Historical-economics acceptance test

1. Save costing A with its canonical snapshot.
2. Change or review the current Rate Book and factory defaults.
3. Reopen or compare costing A.
4. Confirm that costing A still displays its original yarn rates, waste, overhead, margin, and price.
5. Calculate a future costing and confirm that only the new calculation uses the updated current values.

This boundary is enforced in application comparison code and by the immutable snapshot/revision database contract.
