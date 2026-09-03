# Bulk production register

Implemented for the owner’s Base production screen. Input remains **metres produced during the selected shift**, not cumulative meter-counter readings.

## Daily workflow

1. Choose date and shift. Print the blank collection sheet for the supervisor if needed.
2. Copy readings in natural machine-number order (1, 2, 10). The screen and printout use the same order, including unassigned machines.
3. Enter, Shift+Enter, and arrow keys navigate readings. Mobile inputs request the decimal keypad and Next action.
4. Enter `0` or choose **Not running** for an individual machine. A blank remains pending; worker absence remains a separate worker-level control in the collapsed payroll section.
5. **Show pending** captures the current pending/invalid rows. Completed rows remain in that view until it is toggled, so typing never changes row order or removes the focused row.
6. The fixed save bar displays machine completion, total metres, and device-local draft status. Incomplete shifts require explicit confirmation; entered output still contributes to payroll.
7. Saved shifts are protected. Existing correction reasons, revision checks, request receipts, and paid-worker locks remain in force.

## Persistence and rollout

Apply `20260903155014_base_production_machine_register.sql` **before deploying the application**. The loader requires the new `base_production_batches.machine_records` column. No migration was applied to a live project as part of this implementation.

Machine records are snapshots separate from positive-metre financial allocations. A worker can have running, stopped, and pending machines in the same shift. Register states are validated and saved in the same transaction as production and included in correction snapshots. Idempotency includes the machine records; older clients cannot erase an existing register by omitting them. Legacy shifts without register metadata remain readable.

The migration extends the existing reviewed RPC; it does not grant direct writes or change rate calculation, job targets, payroll allocation tables, or settlement rules. Existing RLS and the reviewed-write cutover remain required prerequisites.

## Verification

- Pure regressions: `npx vitest run __tests__/base-machine-register.test.ts`.
- Existing production, correction-history and draft tests; full repository test suite.
- Isolated PostgreSQL harness exercises the **actual existing production writer** and the new reviewed RPC with fixture tables. It verifies mixed output/stops/pending, pay totals, corrections, retries, invalid and foreign machine rejection, paid-worker rollback and finalized-sheet protection. It is not a full production-schema/RLS integration test.
- Run the SQL harness by installing `@electric-sql/pglite` in a temporary directory, then setting `PGLITE_MODULE` to that installation’s `dist/index.js` and running `node scripts/qa/verify-base-machine-register.mjs`. It never connects to a Supabase project.
- Local browser fixture uses the real sheet and styles with synthetic workers/machines and a mocked save action. Live authenticated deployment testing is still required after rollout.

## Deliberately unchanged

- Worker/job reassignment is still handled in dated Setup, not by per-shift inline overrides.
- No mid-shift job/worker splitting, custom walking-route order, cumulative counter calculation, or photo/OCR import.
- No statistical high-output warnings; malformed, negative, over-limit, and over-precision readings are blocked.
- No production deployment or live tenant mutations.
