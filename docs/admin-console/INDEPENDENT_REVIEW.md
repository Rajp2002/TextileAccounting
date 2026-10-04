# Independent candidate review

Review performed by the separate `independent_review` agent against immutable implementation commit **`142fe7c54da9795362b3b4167b8398a4fac16a96`**, with a separately inspected final display-string delta at **`2e3d49749a77d2b14bd4f5b4136efed94df8da6f`**. The final delivery commit changes documentation/browser evidence only. The reviewer edited no source and made no commits or production changes.

## Completed reviewer report

Independent review completed on **`142fe7c54da9795362b3b4167b8398a4fac16a96`**. Worktree was clean. No open P0/P1 or blocking P2 findings remain in the reviewed changes.

Verified founder guards, private SQL permissions, requester-only support access, transactional concurrency/idempotency, financial provenance/coverage, feature gates, and sensitive browser-state handling. Findings raised during review were fixed, including false logout confirmation, conflicting collections, duplicate-send retries, private escalation reasons, and backdated production milestones.

Independently passed:

- **186 unit tests across 18 admin suites**
- **37 database tests across four admin suites**
- Synthetic query profiling: factory p95 **41 ms** at 1,000 organizations; support p95 **16.5 ms** at 5,000 tickets. These are local database measurements.

Real Supabase MFA/session behavior, authenticated staging browser workflows, recovery/rollback rehearsal, production migration history, financial coverage, retention/deletion integration, and approved legacy operational replacements remain release gates. Browser fixtures do not establish those properties.

This supports a reviewable local candidate with production capabilities disabled. Full lint/typecheck/build/browser results belong to the integration owner's final evidence.

## Reproduction

The reviewer ran all 18 named `__tests__/admin-*.test.{ts,tsx}` suites through `scripts/performance/isolated-command.mjs` and these four suites through the disposable database configuration:

```sh
node scripts/performance/isolated-command.mjs npx vitest run --config vitest.db.config.ts __tests__/db/admin-founder.dbtest.ts __tests__/db/admin-support.dbtest.ts __tests__/db/admin-factories.dbtest.ts __tests__/db/admin-payments.dbtest.ts
```

Review is source and local fixture evidence, not a production audit or a guarantee of no future defects. The integration owner's complete check results, environment limitations and release blockers are in `ACCEPTANCE.md` and `RELEASE_RUNBOOK.md`.

## Final copy-only revision acknowledgment

Confirmed **`2e3d49749a77d2b14bd4f5b4136efed94df8da6f`** differs from the reviewed candidate by one display string: “Replies are delivered in-app.”

The prior independent review stands. No new findings; authentication, database, financial, privacy, and support behavior are unchanged. The **186 unit / 37 database test** results remain applicable to those unchanged paths; the reviewer did not rerun them for this copy-only change.

Production and real-provider acceptance gates remain unchanged. No source edits made.

## Follow-up review boundary (1d951fd9)

The earlier immutable console review remains historical evidence. A separate follow-up reviewer inspected email/QR setup, requester exports/deletion compatibility and bounded formal reads; incremental7-file90-unit and2-file21-DB checks passed. The reviewer found concrete restart and factor/verification concurrency issues. Root corrected restart intent lookup, current-intent fencing, verification generation and expired foreign-session recovery, then removed all automatic factor-unenrollment code to address a delayed-success removal race. Final root suites passed as recorded in FOLLOWUP_ACCEPTANCE.

The reviewer hit account usage limits before confirming the last correction and immutable follow-up commit. **Final follow-up independent review is incomplete**; no ready-for-production declaration is made. Prior review is not represented as review of the new code.
# Formal/data-rights exact-commit review — 4 October 2026

Independent reviewer confirmed runtime `2f0215e4054958513a79a6636285d37ee2b03194` from a separate archived checkout `/tmp/weavly-independent-2f0215e4-ap41ik21`. The final report found **no remaining P0/P1 or blocking P2 findings in the reviewed formal/data-rights/retention slice**. It does not certify the entire deployed product or establish real Auth/provider behavior.

Independent execution passed 12 targeted unit files / 91 tests, the three new disposable database suites / 51 tests, and all 24 desktop/mobile formal component browser cases with no skips/flaky cases. Browser result evidence is in that archived checkout's `output/playwright/admin-console/formal-fixtures/results.json`; the integration checkout also retains its own passed synthetic artifacts and [acceptance record](DATA_RIGHTS_ACCEPTANCE.md).

Review covered current founder/session authorization and service-only grants, requester export exclusions, private proof/identity verification history, revision-only actor deletion blocking, disabled-preview denial audit, immutable original-payload retries, dirty draft/version protection and delayed-refresh save gating. Initial closure-timestamp, lost-history, retry-key, stale-draft and adoption validation/timing findings were corrected and confirmed on the exact candidate. No source changes followed this reviewed runtime; final closeout is documentation and synthetic evidence only.

Real Supabase Auth/MFA, PostgreSQL 16/staging acceptance, numeric retention policy/actual retained-record actions, recovery evidence and production approvals remain separate gates. See the current runbook rather than treating the historical reviews below as production approval.
