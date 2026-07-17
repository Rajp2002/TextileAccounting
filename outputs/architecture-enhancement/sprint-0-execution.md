# Sprint 0 execution record

Started: 2026-07-16 IST

## Safety checkpoint

- Working branch: `codex/repository-grounded-architecture-enhancement`
- Local starting commit: `8da715a8cb58f712f3fd88421d9f717e1e6ede07`
- Remote repository: `Rajp2002/TextileAccounting`
- Existing dirty work: authentication, production-mode, estimator and related test changes listed in `pre-change-checkpoint.md`; these are pre-existing and remain untouched by Sprint 0.
- Sprint scope: operational proof, external-review preparation and evidence reconciliation. No estimator formula, terminology, product code, schema, production configuration or production data change is authorized merely by starting Sprint 0.
- Supabase safety: local CLI linkage targets production. No local Supabase/database command may run without an explicit target assertion; restore proof must use the existing GitHub-hosted disposable local Supabase workflow.

## Recovery identity containment

- Repository-root candidate: `weavly-backup-age-identity.txt`.
- Observed metadata only: 189-byte ASCII file, permissions `0600`, modified 2026-07-14 17:46:49 local time.
- Contents were not printed or copied into evidence.
- Git status: untracked and not covered by the current ignore rules.
- The public recipient derived locally with `age-keygen -y` exactly matched the configured GitHub variable `BACKUP_AGE_RECIPIENT`.
- The GitHub `BACKUP_AGE_IDENTITY` secret initially contained invalid identity text. It was corrected from the local file through standard input on 2026-07-16; the secret value was never printed.
- State: **BLOCKED for movement/removal** until the owner verifies an approved second encrypted/offline copy. Deleting or relocating the only usable identity could destroy restore capability.

## TECH-011 retained backup

### Scheduled backup selected

- Workflow: `Supabase production logical backup`
- Scheduled run: `29451202680`
- Event: `schedule`
- Source commit: `e4d10a9958fefa1b9da40807360276f80b1ba43e`
- Started: `2026-07-15T21:14:09Z`
- Completed: `2026-07-15T21:19:01Z`
- Result: `success`
- Run URL: `https://github.com/Rajp2002/TextileAccounting/actions/runs/29451202680`
- Artifact ID: `8357639557`
- Artifact name: `supabase-production-backup-20260715T211440Z-29451202680-1`
- Encrypted artifact bundle size reported by GitHub: `765231` bytes
- Created: `2026-07-15T21:18:57Z`
- Expires: `2026-07-29T21:18:56Z`
- Expired: `false`

All backup job stages passed, including configuration validation, logical dump/encryption and private-artifact upload. Secret values and database payloads were not inspected.

### Disposable restore invocation

- Restore workflow: `Supabase production backup restore drill`
- Failed validation run `29493454888`: rejected the invalid GitHub recovery-identity secret before restore.
- Failed diagnostic run `29493576825`: proved decryption, payload hashes, disposable startup, restore order and zero Storage, then failed closed on an unexplained inventory mismatch.
- Diagnostic run `29494096671`: isolated the sole mismatch to `pg_net` version `0.19.5` in the artifact versus `0.20.3` in the disposable runtime; business, Auth, Storage, migration and extension-name inventories matched.
- Successful restore run: `29494683840`
- Triggered: `2026-07-16T11:30:40Z`
- Completed: `2026-07-16T11:33:42Z`
- Workflow commit: `d07a570edebae2349cd22b951de2ca84095e4e6d`
- Selected backup run/artifact: the scheduled run and exact artifact above
- Restore target by workflow design: new ephemeral local Supabase stack on a GitHub-hosted runner
- Production restore target: not accepted by the script/workflow
- Run URL: `https://github.com/Rajp2002/TextileAccounting/actions/runs/29494683840`
- Restore window: `2026-07-16T11:31:07Z` to `2026-07-16T11:33:15Z` (`128` seconds)
- Result: `PASS` technically; `pass_ready_pending_matrix_update` for governance
- Reconciliation: exact business, Auth, Storage, migration and extension-name inventories; exact pseudonymous identity digests; zero Storage; zero effect-capable jobs.
- Explained compatibility variance: `pg_net` `0.19.5` to `0.20.3`, with the required `net.http_post(text,jsonb,jsonb,jsonb,integer)` signature present.
- Cleanup: disposable Supabase stopped with `--no-backup` by the EXIT trap.
- Repository evidence: `output/qa/pilot-gate-closure/2026-07-16/TECH-011/`.

TECH-011 remains formally `BLOCKED` even though the technical proof is pass-ready. Commits `da272ea` and `d07a570` must reach `main`, and a named independent verifier must review and sign/date the evidence before matrix promotion.

## GOLDEN-A-03 estimator truth

The existing closure pack at `docs/pilot-remediation/closure-packs/GOLDEN-A-03_TRUTH_SHEET.md` is complete enough to execute. It correctly requires the independent factory method to be frozen before opening Weavly, with layer-by-layer inputs, intermediate yarn/cost values, tolerances, variance records and saved/downstream snapshot checks.

State: **BLOCKED on external input**. Required next human action is a factory estimator completing and freezing sections 1-6 independently. No formula change is justified before that artifact exists.

## UX-012 terminology

The existing decision pack, inventory and recommended glossary are execution-ready:

- `docs/pilot-remediation/closure-packs/UX-012_TERMINOLOGY_DECISION_PACK.md`
- `docs/pilot-remediation/closure-packs/UX-012_TERMINOLOGY_INVENTORY.md`
- `docs/pilot-remediation/closure-packs/UX-012_RECOMMENDED_GLOSSARY.md`

State: **BLOCKED on external input**. Required next human action is a named pilot owner/supervisor reviewing terms in context and signing/date-stamping the decision pack. No UI wording change is justified before that review.

## Sprint 0 remaining actions

1. Merge `da272ea` and `d07a570` to `main`; retain a main-ref restore rerun if required by the release process.
2. Name an independent factory-side TECH-011 verifier and obtain dated approval before promoting the matrix row.
3. Confirm that a second approved encrypted/offline recovery-identity copy exists before moving/removing the repository-root identity.
4. Have a factory estimator freeze the independent truth sheet before Weavly entry.
5. Have a named factory owner/supervisor complete the terminology decision pack.
6. Keep the two remaining gates independent: one PASS must not promote another. UX-012 is separately Founder-approved, with factory-operator review retained as a pilot-run control.
