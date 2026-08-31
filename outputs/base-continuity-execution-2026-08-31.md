# Base operational continuity — implementation and verification

Implemented locally on 31 August 2026. No production database migrations or deployment were performed. This is a completed implementation pass, not a claim that Base has passed every release or owner-usability gate.

## Changes

| Blocker | Implemented behavior |
| --- | --- |
| Unpaid earnings disappear at month rollover | First settlement includes earlier unpaid production; subsequent periods continue from the latest active settlement. UI and transactional SQL use the same boundaries. |
| Payment preview can become stale | Reviewed amounts and period are checked inside the settlement transaction. Mismatches roll back payment, snapshots, advance recovery, and finalization. Request receipts protect retries and reject replay after reversal. |
| Recent production is a dead end | View log carries record, date, shift, and worker context. Job and payroll review links carry relevant context; Setup opens the selected worker with a return route. History is searchable and expandable. |
| Old logs depend on current Setup | Saved allocation snapshots supply the displayed historical worker, machine, job, and rate even when Setup assignments are retired. A correction still must satisfy the server's dated assignment checks. |
| Draft work disappears | Owner/organization/date/shift-scoped local drafts restore metres and correction reason after reload. Changed server revisions and unmatched assignment drafts are retained and blocked from silent overwrite. Storage failures produce a visible warning. |
| One payment locks every coworker | Paid worker entries, allocation IDs, notes, and rates remain protected. Unpaid coworkers on the same saved sheet can be corrected with a reason. Backdated new work behind an active payroll boundary is rejected in daily and legacy entry paths. |
| No controlled settlement recovery | Latest active mistaken payment can be reversed with a reason and explicit confirmation that money was not actually paid. Original amounts and earning lines remain; a separate actor/time/reason receipt records reversal. Exact advance balances and prior recovery metadata are restored from provenance. |
| Reversed history can inflate totals | Reversed receipts remain in history and CSV audit export, explicitly labeled. Active totals, machine totals, and payment PDF exclude them. CSV text is protected against spreadsheet formulas. |
| Correction history hides the actual change | History exposes changed worker/machine/job metres, saved rate, earnings, status, and actor, including changes whose total metres cancel out. |
| API row cap silently truncates totals | Org-scoped reads page through the API cap with a stable order and expected count; incomplete reads fail closed. Search no longer scans every allocation for every history entry. |
| Difficult navigation at scale | Worker search, payment-state filters, a clear no-results state, expandable production history, mobile pending counts, and touch-visible paid-row protection. |
| Runtime translation produces mixed instructions | Added Hindi/Gujarati phrases for production, draft recovery, correction, payroll records, and reversal. Native draft-discard confirmations use the translation function. Remaining language limits are below. |

## Verification

- Full repository Vitest suite: **192 files, 1,156 passing tests, 1 existing skipped test**.
- TypeScript: `tsc --noEmit` passes. Targeted ESLint passes without warnings; `git diff --check` passes.
- Isolated PostgreSQL-compatible PGlite: **10 regression scenarios pass**, using the actual Base operational, machine allocation, history, correction, readiness, and new migration SQL. They cover stale-preview rollback, month continuity, retry safety, reversal provenance, dependency restrictions, immutable lines, reviewed production correction, partial settlement, legacy backdated guards, and unauthenticated/anonymous rejection. Machine allocation rows are exercised, not just legacy worker totals.
- Browser uses actual Base React components with synthetic data, mocked Next navigation, and write-disabled server actions. Successful SQL transactions are verified separately; browser checks are **not** a live browser/API/database end-to-end test.
- Browser: draft reload, saved-log context and lock, restored correction reason, paid-row protection with an editable unpaid coworker, failed reversal retaining entered reason/confirmation, worker-to-Setup handoff, and runtime Hindi/Gujarati messages.
- Scale fixture: **120 workers, 240 machines, 3,600 daily entries, 7,200 allocation lines, 30 days**. At 390px width, document width remains 390px. The last worker is searchable; all 30 matching history links can be expanded. Payroll reconciles 7,200 lines and 120 ready workers; the selected worker shows 600m / ₹4,800 and the total ₹576,000. This is local UI behavior, not a network latency or low-end-device benchmark.

Repeatable commands:

```sh
npm test
./node_modules/.bin/tsc --noEmit
node scripts/qa/base-continuity-ui.mjs
```

The UI fixture serves localhost:4179 and disables server writes. Set `BASE_QA_PORT` if that port is occupied. Its controls select draft, partial-payment, retired-assignment, and scale scenarios. Fixtures contain synthetic names and IDs, no credentials.

```sh
BASE_PGLITE_MODULE=/path/to/installed/pglite/dist/index.js node scripts/qa/base-payroll-continuity-sql.mjs
```

The SQL script also supports a normally resolvable `@electric-sql/pglite` package. This machine used `/usr/local/lib/node_modules/firebase-tools/node_modules/pglite-2/dist/index.js`. External auth/organization scaffolding is stubbed; the script is not evidence for the complete deployed entitlement policy. Machine-readable results are in `outputs/base-continuity-sql-evidence-2026-08-31.json`.

## Rollout requirements

Apply the first three schema migrations after their existing prerequisites, then the fourth permission migration after the new app is READY:

1. `20260901110002_base_payroll_period_continuity.sql`
2. `20260901110003_base_production_reviewed_save.sql`
3. `20260901110004_base_payroll_audited_reversal.sql`
4. `20260901110005_base_reviewed_write_cutover.sql` — after deployment

Use the staged compatibility rollout: schema first, new application second, permission cutover last. The final migration revokes direct execution of the older unreviewed save/payment RPCs. Old clients must refresh; deploying only the new UI before the schema will fail its loader/RPC calls, and leaving old UI after the final migration will prevent writes. Validate this sequence on a disposable database/preview first and use an explicit maintenance window or a staged compatibility rollout. Do not roll back by deleting audit or reversal receipts.

## Remaining blockers before claiming complete premium reliability

1. **Actual money already paid:** reversal deliberately does not undo cash or a transfer. Under/overpayment requires a separately specified adjustment ledger and reconciliation journey. Do not use the recording-mistake checkbox for this case.
2. **Older settlement recovery:** records with advance deductions but no exact per-advance receipt cannot be safely reversed automatically. They remain visible with an explanation; an assisted reconciliation/migration policy is still needed. A later active settlement must be resolved before an earlier one.
3. **Deployed verification:** authenticated owner/tenant isolation, real PostgREST relationships and permissions, simultaneous correction/payment sessions, migration rollout, PDF download, and full mutation journeys still need preview/staging verification. PGlite executes the regression transactions serially; it does not prove contention behavior.
4. **Large-history architecture:** paging prevents silent truncation, but the shared loader still materializes the whole organization history. Cursor-based history endpoints and server-side summaries remain the next performance work for multi-year accounts. Cross-query reads are not one database snapshot; payment and save mutation guards are the final consistency checks.
5. **Multilingual completion:** runtime testing confirmed mixed fallback text in older dynamic labels and descriptions. Key operational and reversal instructions are improved, but complete Hindi/Gujarati copy and native-speaker task validation remain open. Date formatting is still English-style; a phrase dictionary alone is not acceptance evidence.
6. **Recovery usability and devices:** real-owner tasks, screen-reader/keyboard coverage, storage-denied SPA navigation, conflict comparison/merge, and low-memory Android/network interruption journeys remain unverified. Changed historical assignment corrections may require reviewing/restoring dated Setup; the UI does not silently reassign historical pay.

The next pass should concentrate on these release gates and adjustment semantics, rather than another visual redesign.
