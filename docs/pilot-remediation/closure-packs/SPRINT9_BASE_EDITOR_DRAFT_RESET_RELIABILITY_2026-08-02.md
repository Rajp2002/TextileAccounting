# Sprint 9 — Base Editor, Draft, and Reset Reliability

Date: 2026-08-02 IST
Status: Release-ready

## Objective

Make editing and saving a costing safe and predictable for the Base estimator without changing optional party/quantity semantics or historical costing economics.

## Delivered contract

- One clean baseline is built for both first load and **New Quality / Reset**. Reset clears the active template and saved-quality lineage, transient warnings, pending dialogs, suggestions, instructions, party, draft state, and added component rows.
- Warp and weft editors expose explicit Add and Remove controls. Added rows start blank and required; a blank warp or weft row blocks save with an actionable message.
- Warning review is resumable. The warning dialog's primary action continues the pending save flow, so Rajesh does not repeat Save after reviewing a warning.
- **Save Costing** is the internal costing snapshot action. **Save New Version** creates a new immutable costing snapshot. **Save as New Quality** creates a separate reusable quality and does not mutate the current saved quality when cancelled.
- Base standalone costing keeps party and quantity optional. Quantity affects order totals when supplied, not the per-metre price.
- Autosave distinguishes real user edits from programmatic reset, restore, and clear operations. A stale draft therefore cannot silently reappear with old fields.

## Verification

- `npm test -- --reporter=dot` — 132 test files passed; 855 tests passed; 1 skipped.
- `npx tsc --noEmit` — passed.
- `npm run lint -- --max-warnings=0` — passed.
- `git diff --check` — passed.
- Added `__tests__/sprint9-editor-reliability.test.ts` covering blank-row validation, warning continuation, reset cleanup, immutable-version copy, cancelled new-quality rollback, and autosave suppression.
- Browser verification at 390×844 confirmed no horizontal overflow, visible Add/Remove controls, a one-row-per-side reset baseline, and no stale estimator draft key after reset.
- A high-denier warning opened with **Review and save**; choosing it advanced to the expected saved-quality version decision without requiring a second Save action. Cancelling that decision preserved the saved quality and left no dialog open.

## Database and migration note

- The linked production Supabase database matches the local migration history through `20260801174038_sprint1_save_trust_v2`.
- `supabase db push --linked --dry-run --yes` returned `Remote database is up to date.`
- Sprint 9 introduces no schema change. No migration was applied and no production data was mutated by the release verification.
- The existing immutable costing revision RPC, idempotency guards, stale-request checks, and database trigger protections remain the historical-economics boundary.

## Release safety notes

- Cancelled reset, warning, version, and Save as New Quality dialogs do not commit changes to saved quality or costing history.
- The implementation files are `app/(dashboard)/owner/estimator/EstimatorClient.tsx`, `hooks/useAutosave.ts`, and `lib/estimator-validation.ts`.
- Keep the Base pilot semantics explicit in future changes: party and quantity are optional for standalone costings, while quotation/order actions retain their commercial requirements.
