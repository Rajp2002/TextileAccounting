---
name: session-docs-closeout
description: 'Reusable Weavly remediation documentation closeout workflow. Use when the user says "Run skill: session-docs-closeout" or asks Codex to close out, reconcile, or update Weavly remediation docs after a fix batch, runtime proof pass, blocked session, or before final commit/push.'
---

# Session Docs Closeout

Use this skill to keep Weavly remediation documentation aligned with actual evidence from a Codex session. Docs must describe what is proven, blocked, deferred, or still open, not what the implementation intended to prove.

## Safety Rules

- Do not switch branches, stash, reset, stage, commit, or push unless the user explicitly authorizes that action after reviewing the docs plan/diff.
- Do not run Supabase mutation commands during docs-only closeout. Do not run `npx supabase db push`, migration repair, `db pull`, direct SQL, or commands using `--include-all` unless the user explicitly changes the scope outside this skill.
- Do not touch production data.
- Do not rewrite unrelated docs.
- Do not invent proof, commands, statuses, pass-ready claims, commit hashes, deployment details, or runtime results.
- If a migration has already been applied remotely but the code is not committed, explicitly record the repo as mid-flight and do not branch-switch, stash, or reset.

## When To Run

- After a fix batch completes.
- After runtime proof passes.
- After a blocked session, to record the blocker and next action.
- Before final commit/push.
- Not during active partial implementation unless the user explicitly requests a closeout snapshot.

## First Pass

Inspect current state before relying on conversation memory:

```bash
git status --short --branch
git diff --name-status
```

Then inspect the relevant changed files and diffs, target failure IDs, exact test output supplied in the session, migration dry-run/apply/list evidence supplied in the session or docs, runtime/browser proof evidence, deployment evidence if relevant, and current repo docs.

Required documentation sources:

- `docs/pilot-remediation/FIX_LOG.md`
- `docs/pilot-remediation/LOOP_STATE.md`
- `docs/pilot-remediation/FAILURE_BACKLOG.md`
- `docs/pilot-remediation/DOMAIN_INVARIANTS.md`
- `docs/pilot-remediation/PILOT_READY_DEFINITION.md`
- `docs/pilot-remediation/RETEST_PLAN.md`
- `TEST_MATRIX.md` if present, otherwise the active QA output matrix such as `output/qa/*/TEST_MATRIX.md`
- Relevant QA final reports, results ledgers, and evidence logs

## Documentation Roles

- `FIX_LOG.md`: exact fixes, proof, commands, migrations, data safety, and commit references.
- `LOOP_STATE.md`: current batch state, blockers, next action, and pass-ready/open status.
- `TEST_MATRIX.md`: formal per-row status.
- `FAILURE_BACKLOG.md`: remaining failures, severity, root-cause grouping, and proof still required.
- `RETEST_PLAN.md`: what must be retested before promotion.
- `DOMAIN_INVARIANTS.md`: product/business rules changed or confirmed.
- `PILOT_READY_DEFINITION.md`: update only when readiness criteria themselves change.

## Status Vocabulary

Use only these closeout statuses unless the existing matrix already requires its own vocabulary:

- `fail`
- `blocked`
- `blocked_network`
- `fixed_pending_runtime_proof`
- `code_verified_but_not_runtime_verified`
- `pass_ready_pending_matrix_update`
- `pass`
- `not_applicable`
- `deferred`

Map these carefully to existing matrix terms. For example, a matrix may still use `code_verified`; do not silently rename formal matrix values unless the matrix schema supports the new value.

## Promotion Rules

- Security/code-only issues may be promoted only when required test/runtime evidence matches the original failure.
- Business-data issues require runtime proof.
- Migration-applied is not enough for pass-ready.
- Local tests are not enough for runtime-dependent failures.
- `blocked_network` never becomes `pass`.
- Every promotion must cite exact commands, probes, artifacts, and evidence.

## Matrix Rules

- Update only rows directly proven.
- Do not mark indirect or downstream rows `pass` because an upstream fix landed.
- If remote migration apply evidence exists but runtime proof is blocked, document migration application separately from unresolved pass status.
- For Batch 2 production/stock atomicity, keep these not pass-ready until runtime proof passes: `PROD-016`, `PROD-028`, `STOCK-015`, `GOLDEN-A-11`, `GOLDEN-A-12`, `GOLDEN-A-14`, `SIGNOFF-05`.

## Migration Documentation

Record all applicable migration evidence:

- Migration filename.
- Dry-run result.
- Apply result.
- Local/remote alignment status.
- Whether existing data is mutated.
- Rollback or recovery plan.
- Runtime proof after apply.
- Exact blocker and next safe proof step if remote access is unreliable.

## Evidence Requirements

For each proposed status change or closeout statement, cite:

- Exact test commands.
- Exact probe commands.
- Pass/fail counts.
- Branch name.
- Commit hash if available.
- Migration status.
- Runtime proof summary.
- Deployment info if relevant.
- QA tenant, disposable target, or rollback-only data-safety notes.
- Remaining gaps.

## Required Output Before Editing

Before editing documentation, produce a proposed docs update plan with:

1. Exact files to edit.
2. Exact rows or sections to update.
3. Current status and proposed status for each target failure.
4. Evidence citations for each proposed status.
5. Migration documentation updates needed.
6. Runtime proof gaps and blockers.
7. Safety checks to run after edits.

Ask for approval before editing docs unless the invocation explicitly authorized edits.

## Approved Edit Scope

After approval, keep edits tightly scoped to the planned files and sections. Preserve existing remediation vocabulary and table shapes. Update docs to reconcile stale statements against stronger current evidence, but do not promote failures without the required proof.

## Final Checks

After approved edits, run only local checks unless the user explicitly expands scope:

```bash
git status --short
git diff --name-status
git diff --check
```

Final closeout report must state:

- Docs updated.
- Matrix updated only where allowed.
- Blocked items clearly recorded.
- Next action recorded.
- Only expected files changed.
- Whether `git diff --check` passed.
- Whether docs avoid pass-ready claims without required proof.
