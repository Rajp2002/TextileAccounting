# Founder console — local acceptance

Historical initial runtime candidate: `2e3d49749a77d2b14bd4f5b4136efed94df8da6f` on `codex/founder-admin`, isolated worktree `/tmp/weavly-founder-admin`. The three implementation slices culminate in `142fe7c54da9795362b3b4167b8398a4fac16a96`; the final runtime revision only simplifies one customer-facing support description. Starting main and the supplied pin both resolve to `36e6e4edac8de76052dc8247d99a74b90ef3772d`. The final delivery commit adds evidence only; it does not alter this verified runtime tree.

The latest follow-up is documented in [FOLLOWUP_ACCEPTANCE.md](FOLLOWUP_ACCEPTANCE.md), with per-ticket partial acceptance in [DELIVERY_LEDGER.md](DELIVERY_LEDGER.md). The results below describe the initial delivery; they do not establish complete AD00–AD09 acceptance. AD10 has local verification plus outstanding environment checks. AD11 has release and recovery preparation; no production rollout or full staging rollback was performed. The console remains disabled by default. This is not production acceptance.

## Checks against the immutable candidate

All commands run from the isolated worktree. `scripts/performance/isolated-command.mjs` removes inherited service targets and credentials, supplies loopback placeholders, and disables live integration tests. Database tests create and destroy a disposable loopback cluster and replay migrations. No remote database was reset or seeded. Build/prebuild, lint/typecheck, database, support and built-app boundary browser checks were repeated after the one-line description change. The 18 read-component tests are from the three-slice candidate; their components and dependencies are identical in the final runtime revision.

| Check | Result | Evidence and limitation |
| --- | --- | --- |
| Full unit/regression suite | Passed: 301 files, 2,709 tests; one skipped | The existing optional live Supabase finance integration is skipped deliberately. The skip is not a pass. |
| TypeScript `--noEmit --incremental false` | Passed | Repository-prescribed wrapper and command. |
| Full ESLint `--max-warnings=0` | Passed | Repository-prescribed wrapper and command. |
| Full migration/database suite | Passed assertions and exit 0: 21 files, 155 tests; runner warning remains | PostgreSQL 17.11, not CI's PostgreSQL 16. Includes founder/RLS/session/support/races/idempotency/audit, metrics, provenance and existing customer regressions. Final runs emitted a Vitest worker shutdown warning; see below. |
| Production Next webpack build and prebuild tests | Passed | Next 16.2.12 production build; prebuild repeats 2,709 passed/one optional live skip. Uses isolated service placeholders; does not verify an Auth/provider deployment. |
| Built-app desktop/mobile boundary browser suite | Passed: 14 tests; two skipped | Genuine anonymous/gated app behavior on the production build. One real provider/MFA lifecycle test per viewport remains skipped and blocked. |
| Real-component support browser fixtures | Passed: 12 tests | Synthetic loopback DTO/transport fixtures; complete lifecycle, private notes, XSS as text, drafts and stable uncertain-send retries. Not authenticated application acceptance. |
| Real-component factory/report browser fixtures | Passed: 18 tests | Six factory and 12 Today/Payments/System/Audit desktop/mobile tests. Synthetic loopback read adapters only, with visible fixture captions. |
| Public browser bundle/source-map pattern scan | Passed: 281 assets, zero findings | A bounded pattern check cannot prove the absence of every possible secret. |
| Independent final-commit review | Completed; no open P0/P1 or blocking P2 findings | Separate reviewer passed 186 unit/37 database tests. Scope and limitations are recorded in `INDEPENDENT_REVIEW.md`. |

```sh
node scripts/performance/isolated-command.mjs node node_modules/typescript/bin/tsc --noEmit --incremental false
node scripts/performance/isolated-command.mjs npx vitest run
node scripts/performance/isolated-command.mjs npm run lint
node scripts/performance/isolated-command.mjs npm run test:db
node scripts/performance/isolated-command.mjs npm run build
node scripts/performance/isolated-command.mjs npm run test:admin:browser
npm run test:browser:support-fixture
npm run test:admin:read-fixtures
node scripts/qa/admin-bundle-scan.mjs
```

The final prescribed database run measured 10 local samples each: factory snapshot p95 **210 ms** at 1,000 synthetic organizations (proposed 2,000 ms aggregate budget), and support list p95 **69.9 ms** at 1,000 synthetic organizations/5,000 tickets (proposed 1,000 ms indexed-list budget). These are disposable local-fixture results, not agreed staging or production guarantees.

Initial integration failures were corrected and rerun: stale legacy-link/redaction assertions, host contention with unconstrained unit workers, a cold fixture navigation timeout, and missing browser revision. A sandboxed build could not fetch existing Google Fonts; the approved isolated network build is the acceptance run. None of these failed attempts is counted as a pass.

The final default-worker database runs reported all 155 tests passed and exited 0, but Vitest logged `Timeout terminating forks worker` for the existing costing-save suite. A diagnostic rerun with `--maxWorkers 4` again passed all 155 and exited 0, with the warning on the existing onboarding-payroll suite instead. The warning remains unresolved; no source/test assertion was changed or timeout suppressed to hide it. Earlier clean runs against the identical database code and the independent 37-test admin replay also passed. PostgreSQL16/CI verification must include confirming clean runner teardown.

## Reviewable deliveries

- `7995b983`: founder identity/session boundary, fresh login/shell, safe factory reporting, additive schema and baseline contracts.
- `97e6b400`: requester-private transactional support and complete customer/founder workflow.
- `142fe7c5`: financial provenance/coverage and exceptions, Today/System/Audit, cache/replay/privacy gates, executable browser harnesses and final review corrections.
- `2e3d4974`: one-line support description cleanup after visual QA, removing the implementation's pagination size from customer-facing copy.

The supplied specifications survive in `ADMIN_CONSOLE_PLAN.md` and `IMPLEMENTATION_SPRINT.md`. `DELIVERY_LEDGER.md` maps AD00–AD11 to files, evidence, gaps and rollback. Four additive migrations are ordered after the current Free migrations; all four are required before enabling the reporting reads.

Screenshots and browser result JSON are checked in under `output/playwright/admin-console`. Login screenshots come from the built dark application. Support, directory/detail, Today, Payments, System and Audit screenshots are explicitly synthetic component fixtures. Screenshots were visually inspected at desktop and narrow mobile sizes. No real customer records appear.

## Outstanding acceptance and release gates

1. **Real Auth/MFA environment:** an approved isolated Supabase environment, exact founder UUID/profile/grant, AAL1/AAL2 factors, recovery and provider-session fixtures are needed for full authenticated browser/network/storage/replay acceptance. No identity, credential, security grant or MFA setting was provisioned. Confirm the 15-minute interactive idle and eight-hour absolute policy before production setup.
2. **Database version and runner:** rerun the complete database suite on CI's PostgreSQL 16 and resolve/confirm the local worker shutdown warning. Local 17.11 assertion passes do not establish that gate.
3. **Retention and data rights:** approve retention/deletion/pseudonymization semantics and implement the remaining policy. The follow-up adds requester-only public support exports and preflight/locked deletion refusal; it deliberately does not purge retained records. Production support must remain disabled until a reviewed integration resolves this. No purge period or cascade was invented.
4. **Legacy operational ownership:** verify a usable owner/fallback or replacement for retained grievance, security, privacy, export/deletion, DPA/notice and lockdown obligations. `/admin/legacy` now has bounded read-only formal registers/details; operational mutation/export replacements remain incomplete. Preserved services and an unimported reference UI are not a complete operational replacement. New founder and separate legacy guards stay closed by default.
5. **Reporting evidence:** approve real organization classifications/mapping and any bounded provenance import or provider reconciliation. Unclassified organizations and unknown-mode/time/coverage facts remain visible outside confirmed totals. Mature cohorts, bank settlement, recognized revenue, MRR/ARR, complete review/export history and unconnected backup/restore/workflow monitoring remain unavailable.
6. **Production operations:** approve migration/deployment separately, verify a recovery point, stage rollback and founder recovery, then verify the deployed exact commit and customer regressions. No push, merge, deployment, production migration/backfill, live-payment enablement, entitlement/financial repair or external customer delivery occurred.

Safe code, fixture coverage, disabled gates and runbooks are delivered around these dependencies. See `RELEASE_RUNBOOK.md` for controlled enablement, critical escalation and rollback. Rollback closes server capabilities first, preserves additive tickets/audit/reporting and existing economic records, and never restores role-only global admin access.
