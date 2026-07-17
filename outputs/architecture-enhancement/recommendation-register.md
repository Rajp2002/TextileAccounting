# Prioritized recommendation register

Reviewed: 2026-07-15 IST

No recommendation in this register was implemented during this review. The user explicitly limited this pass to analysis. Priorities identify what should happen next, subject to a fresh clean-worktree checkpoint and the implementation gate.

## REC-000 - Contain repository-local recovery identity material

| Field | Decision |
|---|---|
| Recommendation ID | REC-000 |
| Priority | P0 - immediate security housekeeping |
| Problem statement | An untracked file named `weavly-backup-age-identity.txt` is present at repository root. Its contents were deliberately not printed or inspected. The backup runbook requires recovery identities to remain separate from repository data. |
| User impact | Accidental commit, sync or disclosure could compromise encrypted backup confidentiality. |
| Repository evidence | `git status --short`; `.gitignore` covers `*.agekey` and encrypted archives but not this filename; `docs/pilot-remediation/closure-packs/TECH-011_BACKUP_RESTORE_RUNBOOK.md` describes key separation. |
| Proposal reference | Backup/security/least privilege, pages 13-16. |
| Current implementation | Encryption/runbook exists; local operator material is not safely contained by repository state. |
| Proposed bounded change | Verify ownership without displaying the secret, move the identity to approved private storage outside the repository, remove only the repository-root copy after verification, and add a narrow ignore rule if this filename is part of a supported workflow. |
| Files likely affected | Operator filesystem; optionally `.gitignore` and backup runbook. Never commit the identity. |
| Tables likely affected | None. |
| Migration requirement | None. |
| Security implications | Reduces credential exposure; handling must avoid logs, shell history and document contents. |
| Estimated effort | Under one hour. |
| Regression risk | Low if recovery capability is verified before removal; high if the sole key is deleted. |
| Dependencies | Owner confirmation of approved recovery-key location and a second verified copy. |
| Test plan | `git status`, `git check-ignore`, non-secret file existence/permissions check, and a documented recovery-key inventory. |
| Runtime proof plan | Confirm a disposable restore can access the separately stored identity without the repository-root file. |
| Rollback method | Restore the root copy temporarily from approved private storage only if the documented tooling cannot locate it; never commit it. |
| Definition of done | No recovery private key is under repository scope, Git ignores the supported transient filename, and recovery access is independently verified. |

## REC-001 - Complete the existing scheduled-backup restore proof

| Field | Decision |
|---|---|
| Recommendation ID | REC-001 |
| Priority | P0 - required for safe pilot (`TECH-011`) |
| Problem statement | Backup creation is designed, but recovery from a retained scheduled artifact has not succeeded. |
| User impact | A database loss incident could exceed tolerable downtime or reveal an incomplete backup without prior proof. |
| Repository evidence | Backup/restore workflows, `scripts/backup/`, TECH-011 runbook; scheduled run 29368765626 produced no restorable artifact after its inventory parsing failure. |
| Proposal reference | Backup, restoration and incident readiness, pages 13-16. |
| Current implementation | Source and runbook implemented; operational acceptance BLOCKED. |
| Proposed bounded change | Run the documented scheduled workflow, restore that encrypted artifact into disposable infrastructure, execute tenant/domain reconciliation, measure RTO and clean up. No new backup architecture. |
| Files likely affected | Evidence/runbook Markdown and workflow only if another verified defect appears. |
| Tables likely affected | Disposable restore only; production read during backup, not mutated. |
| Migration requirement | None. |
| Security implications | Requires strict target identity and secret/key separation; evidence must not contain secrets or row payloads. |
| Estimated effort | Half to one day, excluding scheduled wait. |
| Regression risk | Low with disposable target; unacceptable if production/QA cannot be distinguished. |
| Dependencies | Successful scheduled artifact, approved recovery identity and disposable Supabase/Postgres target. |
| Test plan | Artifact hash, decrypt, restore order, schema inventory, tenant counts, critical business invariant queries and cleanup. |
| Runtime proof plan | Record workflow run IDs, artifact/hash, target ref, start/end/RTO, reconciliation result and deletion confirmation. |
| Rollback method | Delete disposable target/artifacts as runbook directs; production remains unchanged. |
| Definition of done | TECH-011 has one evidence-backed PASS from a retained scheduled artifact. |

## REC-002 - Independently validate the estimator against a real fabric sheet

| Field | Decision |
|---|---|
| Recommendation ID | REC-002 |
| Priority | P0 - required for safe pilot (`GOLDEN-A-03`) |
| Problem statement | Deterministic formulas are tested internally, but approved factory truth has not been independently reconciled. |
| User impact | An undetected domain assumption error could create wrong sale rates and erode trust. |
| Repository evidence | `lib/estimator.ts`, `lib/estimator-validation.ts`, estimator tests, cost-analysis UI; remaining-gate ledger marks GOLDEN-A-03 BLOCKED. |
| Proposal reference | Client-supplied formula acceptance and worked examples, pages 3, 14 and 15. |
| Current implementation | Engine and explanation implemented; external correctness proof missing. |
| Proposed bounded change | Obtain one dated independent real-fabric calculation from an authorized factory expert and reconcile every input, intermediate cost and final rate within agreed tolerances. Do not change formulas before identifying an evidenced discrepancy. |
| Files likely affected | Evidence worksheet/Markdown; estimator files only in a later separately reviewed fix if reconciliation fails. |
| Tables likely affected | None for proof; fixture data only in isolated QA if saved. |
| Migration requirement | None. |
| Security implications | Redact customer/factory-sensitive rates if evidence is committed; retain enough normalized values to reproduce the result. |
| Estimated effort | Several hours after expert input is available. |
| Regression risk | Low for proof; high for speculative formula edits. |
| Dependencies | Factory-authorized worked sheet, terminology and tolerance agreement. |
| Test plan | Reproduce through the engine/UI, saved-quality restoration and quote snapshot; compare intermediate and final values. |
| Runtime proof plan | QA/browser screenshot plus signed/detailed reconciliation sheet and refresh/re-login persistence. |
| Rollback method | None for analysis evidence; any later formula fix requires old/new fixture comparison and reversible commit. |
| Definition of done | GOLDEN-A-03 is PASS with independent, reproducible evidence and no unexplained variance. |

## REC-003 - Complete factory terminology approval

| Field | Decision |
|---|---|
| Recommendation ID | REC-003 |
| Priority | P0 - required for safe pilot (`UX-012`) |
| Problem statement | English/Hindi/Gujarati resources exist, but actual Surat factory terminology has not received dated reviewer acceptance. |
| User impact | Supervisors and owners may misunderstand otherwise correct production/payroll/stock actions. |
| Repository evidence | `lib/i18n/`, glossary/runtime tests, role-specific UI, authenticated QA screenshots and explicit Founder approval; remaining-gate ledger marks UX-012 PASS with a pilot-run operator-review control. |
| Proposal reference | Mobile-first supervisor and language readiness, pages 5 and 18. |
| Current implementation | Localization architecture and labels implemented; domain approval missing. |
| Proposed bounded change | Conduct the existing reviewer script with one authorized owner/supervisor, record accepted/rejected terms and change only evidenced labels. |
| Files likely affected | Review evidence; later `lib/i18n/locales/*` for approved corrections. |
| Tables likely affected | None. |
| Migration requirement | None. |
| Security implications | None beyond anonymizing reviewer/customer information. |
| Estimated effort | Two to four hours plus reviewer scheduling. |
| Regression risk | Low if glossary keys remain stable. |
| Dependencies | Factory reviewer. |
| Test plan | i18n runtime/glossary tests, owner/supervisor mobile smoke and screenshot comparison. |
| Runtime proof plan | Dated sign-off with device, role and reviewed journey list. |
| Rollback method | Revert individual copy changes. |
| Definition of done | UX-012 is PASS and every disputed term has a documented decision. |

## REC-004 - Establish a lean CI and 15-journey release gate

| Field | Decision |
|---|---|
| Recommendation ID | REC-004 |
| Priority | P1 - high-value pre-pilot control |
| Problem statement | Extensive tests/evidence exist, but the repository shows no general PR application workflow and no compact deployment-gate journey set. |
| User impact | A regression can reach a pilot deployment between manual campaigns. |
| Repository evidence | 96 Vitest files and extensive QA outputs; `.github/workflows/` contains backup/restore but no install/lint/type/test/build workflow; `golden-journeys.md`. |
| Proposal reference | QA, CI/CD and golden acceptance, pages 13-14. |
| Current implementation | Test assets strong; enforcement partial. |
| Proposed bounded change | Add a PR workflow for clean install, lint, type check, unit/source tests and build; maintain a QA deployment ledger for GJ-01..GJ-15 rather than automating every existing row. |
| Files likely affected | `.github/workflows/ci.yml`, package scripts only if missing, QA guide/evidence templates. |
| Tables likely affected | None in PR CI; isolated prefixed QA data in deployment journeys. |
| Migration requirement | None. |
| Security implications | CI must use no production credentials; browser QA must assert QA project ref and isolate tenants. |
| Estimated effort | One to two days. |
| Regression risk | Low; main risk is flaky/slow gating. |
| Dependencies | Clean baseline and current auth campaign reconciliation; QA credentials managed outside repo. |
| Test plan | Intentionally failing test/type/lint/build proves each gate; QA journey classifications require evidence. |
| Runtime proof plan | One green PR run and one QA deployment run with isolated owner/supervisor tenants. |
| Rollback method | Revert workflow; preserve tests/evidence. |
| Definition of done | Required green PR checks and a reproducible QA gate exist, with runtime claims never inferred from source tests. |

## REC-005 - Make manual stock-lot creation atomic and replay-safe

| Field | Decision |
|---|---|
| Recommendation ID | REC-005 |
| Priority | P1 - material integrity |
| Problem statement | Manual stock-lot creation inserts the lot and opening movement in separate requests. |
| User impact | A mid-request failure can leave stock quantity without the corresponding opening audit movement; a lost response can create a duplicate lot. |
| Repository evidence | `app/(dashboard)/owner/stock/actions.ts:624+`; existing transactional sale/production-stock patterns in `20260626064830_production_stock_atomicity.sql` and `20260627195152_batch_3_dispatch_sale_receipt_correctness.sql`. |
| Proposal reference | Atomic stock inward and idempotency, pages 13-15. |
| Current implementation | Validation and RLS exist; transaction/replay boundary missing for this path. |
| Proposed bounded change | One owner/tenant-checked RPC inserts lot + opening movement and accepts an org-scoped request key; action becomes a thin validated caller. |
| Files likely affected | One new migration, generated Supabase types if used, stock action and targeted tests. |
| Tables likely affected | `fabric_stock_lots`, `fabric_stock_movements`; optional request-key column/index. |
| Migration requirement | Yes, additive and backward compatible. |
| Security implications | RPC must derive/validate organization and owner role, respect lockdown/tier, and restrict grants. |
| Estimated effort | One to two days. |
| Regression risk | Medium. |
| Dependencies | Confirm all active manual-lot callers and current schema head. |
| Test plan | Forced movement failure rollback, same-key replay, mismatched-payload conflict, concurrent call, cross-tenant/wrong-role denial and existing stock reconciliation. |
| Runtime proof plan | Isolated QA manual lot, DB invariant, duplicate click, refresh/re-login and cleanup. |
| Rollback method | Revert caller to old path only before use; otherwise forward-fix RPC while preserving created rows. Additive migration remains compatible. |
| Definition of done | No committed lot can exist from this command without exactly one opening movement, and a retry creates one logical lot. |

## REC-006 - Make machine-operator assignment one database command

| Field | Decision |
|---|---|
| Recommendation ID | REC-006 |
| Priority | P1 - payroll/production history integrity |
| Problem statement | Operator history close/insert and legacy assignment mirror/clear are separate writes with an explicit partial-success response. |
| User impact | Operator display and payroll attribution can disagree after a middle failure. |
| Repository evidence | `app/(dashboard)/owner/actions.ts:531+`; atomic assignment-context precedent in `20260711134000_atomic_machine_assignment_context.sql`. |
| Proposal reference | Atomic transactions, historical rate snapshots and controlled state, pages 13-15. |
| Current implementation | Each write is authorized; the user operation is not all-or-nothing. |
| Proposed bounded change | Move close/insert/mirror behavior into one locked tenant/owner RPC with deterministic effective-date or request-key semantics. |
| Files likely affected | One migration, owner action, assignment/payroll tests. |
| Tables likely affected | Operator assignment history and `machine_assignments`. |
| Migration requirement | Yes, function/grants; schema column only if request key is selected. |
| Security implications | Preserve same-tenant machine/worker/operator checks and audit fields. |
| Estimated effort | One to two days. |
| Regression risk | Medium. |
| Dependencies | Inventory legacy readers/writers before changing ownership. |
| Test plan | Middle-step failure rollback, overlapping date race, reassignment/unassignment, wrong role/cross tenant and payroll rate attribution. |
| Runtime proof plan | QA assign/reassign/clear, refresh both roles, reconcile history/current mirror and downstream payroll preview. |
| Rollback method | Revert action/function before production use; after use, forward-fix while retaining history. |
| Definition of done | History and active mirror can no longer diverge through this command. |

## REC-007 - Add request keys to remaining money-changing commands

| Field | Decision |
|---|---|
| Recommendation ID | REC-007 |
| Priority | P1 - financial replay safety |
| Problem statement | Owner advance, supervisor kharchi and supervisor float refill can be retried as a second valid money movement because they lack durable request identity. |
| User impact | Duplicate Upaad/kharchi/refill can distort payroll, cash and worker trust. |
| Repository evidence | `app/(dashboard)/owner/advances/actions.ts:17+`, `app/(dashboard)/supervisor/actions.ts:1698` and `:1726`; keyed commercial payment and quote patterns already exist. |
| Proposal reference | Idempotent financial operations, pages 13-15. |
| Current implementation | Kharchi + float deduction is atomic; payroll settlement is strong; replay identity is the missing layer. |
| Proposed bounded change | Extend/create transactional commands to accept one client UUID per user intent, store org-scoped unique keys and return the original result on replay. Keep WhatsApp after commit/non-blocking. |
| Files likely affected | Additive migrations, advance/supervisor actions and targeted tests/UI request-key generation. |
| Tables likely affected | Advances/kharchi records and supervisor float transactions, or a narrowly scoped command-result table. |
| Migration requirement | Yes, additive. |
| Security implications | Key scope must include org; server derives actor; no amount/reason in logs. |
| Estimated effort | Two to four days across the three commands. |
| Regression risk | Medium. |
| Dependencies | Confirm active callers and UX handling of unknown outcome. |
| Test plan | Same-key replay, different-amount conflict, consecutive new keys, concurrent calls, low balance, wrong role/cross tenant and notification failure. |
| Runtime proof plan | QA response-loss/duplicate-submit simulations followed by payroll/float/database reconciliation and re-login. |
| Rollback method | Feature-compatible additive migration; revert callers before use or forward-fix keys/results after data exists. |
| Definition of done | Each user intent changes financial state once under click duplication, request retry or response loss. |

## REC-008 - Add bounded operation correlation and safe support codes

| Field | Decision |
|---|---|
| Recommendation ID | REC-008 |
| Priority | P1 - incident diagnosis |
| Problem statement | Sentry and perf timing exist, but there is no consistent identifier joining browser intent, server/RPC/provider/audit outcomes. |
| User impact | Pilot support takes longer and users may send sensitive context to identify an error. |
| Repository evidence | `instrumentation*.ts`, `lib/sentry-redaction.ts`, `lib/perf.ts`; no request/correlation helper found; 229 direct console calls. |
| Proposal reference | Structured logging and diagnostics, pages 11 and 13. |
| Current implementation | Monitoring foundation present; correlation partial/missing. |
| Proposed bounded change | Add a UUID operation context/helper and safe structured event fields; adopt first on billing, production, stock, dispatch and payroll failures; show a short non-secret support code. |
| Files likely affected | New `lib/observability/*`, selected route/actions, Sentry tests and error UI. |
| Tables likely affected | None initially; audit/provider tables may store operation ID later only where bounded. |
| Migration requirement | None for first slice. |
| Security implications | Never log access codes, auth tokens, cookies, full financial payloads or personal data; hash/omit identifiers as appropriate. |
| Estimated effort | One to three days for first slice. |
| Regression risk | Low/medium. |
| Dependencies | Decide retention/cardinality and confirm Sentry plan behavior. |
| Test plan | Propagation, UUID validation, redaction, exception capture and no sensitive fields; unchanged user error behavior. |
| Runtime proof plan | Trigger a safe QA failure and locate the same code in client/server Sentry/log context. |
| Rollback method | Remove additive context helper/tags; core commands unchanged. |
| Definition of done | A pilot support report can be traced across the selected operation without exposing sensitive payloads. |

## REC-009 - Measure representative volume before optimizing

| Field | Decision |
|---|---|
| Recommendation ID | REC-009 |
| Priority | P1 measurement; fixes depend on failures |
| Problem statement | Bundle improvements are measured, but authenticated route/query behavior at 150 looms/100 workers/history is not. |
| User impact | Larger pilot tenants may discover latency or mobile-startup issues during operations. |
| Repository evidence | `docs/performance/campaign-20260715/`, `lib/perf.ts`, pagination tests; authenticated QA campaign blocked by sign-in; no representative fixture/budget suite. |
| Proposal reference | Scale and performance acceptance, pages 2 and 14. |
| Current implementation | Bundle and some query instrumentation implemented; representative dataset absent. |
| Proposed bounded change | Fix/reconcile QA login work, generate deterministic non-production scale fixtures, set route/query budgets and measure Factory Today, Machines, production, stock, dispatch, payroll, advances and estimator. |
| Files likely affected | Performance scripts/fixtures/docs; product queries only if a measured budget fails. |
| Tables likely affected | QA-only seeded rows. |
| Migration requirement | None for measurement. |
| Security implications | Assert QA ref, prefix/cleanup tenant, no production credentials or destructive production load. |
| Estimated effort | Two to four days for baseline. |
| Regression risk | Low in QA; high if target checks are absent. |
| Dependencies | Reconciled uncommitted auth campaign and working QA login. |
| Test plan | Fixture determinism/cleanup, query counts, p50/p95, DB plans, low-powered mobile and threshold regression. |
| Runtime proof plan | Timestamped before/after artifact with environment ref and build/release. |
| Rollback method | Delete prefixed QA tenant/fixtures; revert only measured query changes independently. |
| Definition of done | Representative budgets are evidenced; only failing routes produce optimization recommendations. |

## REC-010 - Complete hosted Razorpay lifecycle proof before charging

| Field | Decision |
|---|---|
| Recommendation ID | REC-010 |
| Priority | P1 before paying release; N/A for explicitly non-paying limited pilot |
| Problem statement | Source protections are strong, but the hosted payment stopped before capture and webhook/replay proof. |
| User impact | A paying customer could be charged without verified entitlement/reconciliation behavior. |
| Repository evidence | Billing routes/migrations and `outputs/estimator-production-readiness/estimator-final-summary.md`. |
| Proposal reference | Payment/webhook diagnostics and golden acceptance, pages 11 and 14. |
| Current implementation | Canonical verification, atomic activation and webhook/refund idempotency implemented; external runtime proof BLOCKED. |
| Proposed bounded change | Complete one Razorpay Test Mode checkout using provider-valid test identity/contact, then verify capture, webhook, replay, entitlement refresh/re-login and refund path as applicable. |
| Files likely affected | Evidence only unless a defect appears. |
| Tables likely affected | Isolated Test Mode QA billing rows. |
| Migration requirement | None unless a proven defect requires it. |
| Security implications | Never record keys/signatures/card data; assert Test Mode and environment. |
| Estimated effort | Half to one day after provider/test identity access. |
| Regression risk | Low in Test Mode. |
| Dependencies | QA/Test Mode credentials and valid hosted checkout inputs. |
| Test plan | Amount/tier derivation, cancel/fail/success, duplicate callback, webhook replay, refresh/re-login, referral and refund idempotency. |
| Runtime proof plan | Redacted provider event IDs/status plus database entitlement/event reconciliation. |
| Rollback method | Clean up Test Mode records through documented safe means; no production state. |
| Definition of done | Paying-launch journey is PASS with one entitlement under retries/replays and reconciled provider/database state. |

## P2/P3 roadmap register

| Recommendation | Priority | Trigger | Decision now |
|---|---|---|---|
| General side-by-side estimator comparison | P2 | Repeated pilot request beyond current four sensitivities | Defer; reuse existing engine/snapshots if adopted |
| Minimal read-first platform support console | P2 | Support volume makes log/database lookup unsafe or slow | Defer; do not activate full archived admin portal |
| Public dispatch tracking | P2 | Buyers/owners explicitly request it and privacy/security acceptance is complete | Keep archived source inactive until revalidated |
| Provider-neutral database outbox | P2 | Live critical messaging, repeated unknown outcomes or multiple asynchronous callers | Defer; no external queue platform |
| Gradual domain action-file decomposition | P2 | A file is being changed for a proven behavior fix or ownership causes defects | Refactor alongside bounded commands only |
| Yarn inventory/accounting integration | P2/P3 | Validated pilot workflow and accounting rules | Keep archived; scope separately |
| Advanced analytics/cross-factory benchmarking | P3 | Sufficient consented history and privacy model | Defer |
| IoT/native mobile | P3 | Hardware/API or PWA capability evidence establishes a real gap | Defer/reject at current stage |
