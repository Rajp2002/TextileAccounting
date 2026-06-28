# Pilot Ready Definition

Pilot-ready means the product can be used by a Surat grey-fabric factory without known critical or high risk to tenant security, production quantities, stock, dispatch/receipt, receivables, payroll, or release recoverability.

## Non-Negotiable Gates

1. No critical `fail` rows remain in active pilot scope.
2. No high `fail` rows remain in active pilot scope unless the feature is hidden, disabled, or explicitly unsupported for pilot.
3. No critical/high `blocked` rows remain without either evidence or de-scope.
4. `code_verified` is not counted as pass. Critical/high pilot paths require runtime or test evidence.
5. Every resolved cluster has regression tests or a documented runtime-only proof reason.
6. No destructive production mutation is used as proof outside an isolated QA tenant, rollback-only transaction, or disposable environment.

## Domain Gates

Security:

- Profile role/org mutation is impossible for authenticated users.
- Owner/supervisor/server authorization survives direct API attempts and token refresh.
- Access-code, join-code, locked-tenant, and webhook paths fail closed.

Production and stock:

- Production logs reconcile with generated stock after create, edit, downtime correction, duplicate submit, and refresh.
- Negative, cancelled-order, over-target, wrong-assignment, and unsupported day-only/substitute-worker cases are blocked or explicitly unsupported.

Dispatch and receipt:

- Multi-batch dispatch works for the same sale.
- Receipt state is coherent across dispatch row, package lines, sale summary, discrepancy queue, and dashboard.
- Pending dispatch and difference sign-off cannot falsely clear.

Commercials:

- Sale creates exactly one receivable where required.
- Duplicate sale submission is idempotent.
- Profit filters, due dates, payment metadata, and balances reconcile.

Payroll and kharchi:

- Preview and settlement formulas match.
- Legacy payroll RPC bypasses are removed or hardened.
- Kharchi online is atomic.
- Offline kharchi is fixed or disabled for pilot.

Offline/cache:

- Account switch and logout clear persisted tenant data and mutation queues.
- Offline production/kharchi claims match implementation.
- Unsupported offline flows are removed from public copy and UI affordances.

Release:

- `npm ci`, lint, Vitest, build, runtime audit, and full audit gates pass or have signed risk acceptance for non-runtime advisories.
- Production migration head equals the approved repository head for pilot.
- Sentry release/source maps exist for the deployed commit.
- Backup restore and rollback/forward-fix are exercised in disposable infrastructure.

## Required De-Scopes Before Pilot If Not Fixed

The following must be hidden, disabled, or documented as unsupported before pilot if they are not fixed and retested:

| Feature/surface | Current finding | Required pilot action if unfixed |
| --- | --- | --- |
| Offline production logging | Not queued; public copy implies planned/available behavior. | Mark online-only; remove auto-sync claims. |
| Offline kharchi | Queues to missing `kharchi_offline` table. | Disable offline kharchi submit/sync; mark online-only. |
| Direct market-run sale path | Batch 4 disables the direct path so it cannot bypass commercial receivables. | Keep disabled for pilot unless it is routed through the normal receivable-creating sale path and retested. |
| Day-only factories | Production logging requires both day/night assignments. | Limit pilot to factories with both shifts configured or fix support. |
| Substitute worker logging | Actual substitute cannot be logged without remapping assignment. | Document unsupported or add intentional substitute flow. |
| Owner data export | Not wired/audited/redaction-reviewed. | Keep hidden until audited and runtime-tested. |
| Public DPDP/legal claims | Requires qualified counsel review. | Do not rely on public legal readiness until review exists. |
| Backup restore/rollback | Not exercised. | No pilot until exercise is completed. |
| Archived modules | Historical archived routes exist. | Keep hidden/archived and do not market as pilot features. |

## Pilot Sign-Off Evidence Package

Final sign-off must include:

- Updated `TEST_MATRIX.md` with no unresolved critical/high pilot blockers.
- Updated `results.json`.
- A final report replacing the No-Go verdict.
- Evidence logs for each closed cluster.
- Release metadata: deployed URL, commit, migration head, Sentry release, CI run, backup restore, rollback/forward-fix exercise.
- A list of de-scoped features shown to the pilot customer.
