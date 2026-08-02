# Sprint 10 — Saved Costings, Rates, Versions, and Comparison

Date: 2026-08-02 IST
Status: Production verified

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
- Vercel production build from merged `main` — passed; 133 test files and 860 tests passed, TypeScript passed, and the production artifact was generated successfully.
- Targeted ESLint checks — passed.
- `git diff --check` — passed.
- Added `__tests__/sprint10-saved-costings-rates-comparison.test.ts` covering library filters/identity, canonical comparison, no current-rate recalculation, and UI/action/migration boundaries.

## Release evidence

The migration dry-run identified only the Sprint 10 migration. The linked production migration, merged `main` commit, production deployment URL, and post-deploy verification are recorded below.

| Check | Evidence |
| --- | --- |
| Linked Supabase migration | `20260802121858_sprint10_saved_costing_library_state.sql` applied with `supabase db push --linked --yes`; migration ledger, index, and both RPC signatures verified remotely. |
| Merged `main` commit | Sprint 10 implementation PR [#61](https://github.com/Rajp2002/TextileAccounting/pull/61) merged at `92f13fd7a48938d82710d6fcf7b98d8051b4c9d9`; final evidence PR [#62](https://github.com/Rajp2002/TextileAccounting/pull/62) merged at `6a0ac680dc56ced627dea12e46746b941d645f69`. |
| Production deployment | Final clean-main Vercel deployment `dpl_7ZLSrhcNbqa7piVQmHFVx9AMAvPs` is Ready and aliased to [textile-accounting.vercel.app](https://textile-accounting.vercel.app). |
| Post-deploy smoke check | Production `/` and `/login` returned HTTP 200; deployment inspection reported Ready; no recent error logs were found. |

## Historical-economics acceptance test

1. Save costing A with its canonical snapshot.
2. Change or review the current Rate Book and factory defaults.
3. Reopen or compare costing A.
4. Confirm that costing A still displays its original yarn rates, waste, overhead, margin, and price.
5. Calculate a future costing and confirm that only the new calculation uses the updated current values.

This boundary is enforced in application comparison code and by the immutable snapshot/revision database contract.
