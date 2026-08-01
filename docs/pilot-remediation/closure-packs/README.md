# Remaining Pilot Gate Closure Packs

Prepared: 2026-07-14 IST

Repository baseline: documentation commit `bb0380f`; application commit `5a66eca`

The UX-012 pack now records the product-owner-approved amendment, implemented terminology baseline, production evidence, and the still-open actual-pilot-user operating control. The formal matrix is **368 PASS / 0 FAIL / 6 BLOCKED / 3 NOT APPLICABLE**.

The Sprint 7 closeout pack records the final Base UX polish release, merged main commit, production deployment, migration dry-run, mobile/language evidence, and the exact-pilot QA entitlement blocker. It does not alter formal matrix counts or readiness criteria.

| Scoped release | Result | Closeout pack |
| --- | --- | --- |
| Sprint 7 — Final UX Polish and Pilot Readiness | Production release verified; exact mutating pilot blocked by disposable QA plan entitlement | [Sprint 7 production closeout](SPRINT7_UX_POLISH_PRODUCTION_CLOSEOUT_2026-08-02.md) |

| Row | Canonical requirement | Current classification | Closure pack |
| --- | --- | --- | --- |
| `TECH-011` | Verify backup schedule and restore into a disposable project; restored organization, users, production, stock, receivables, and payroll reconcile. | `pilot_core`, gating | [Backup and restore pack](TECH-011_BACKUP_RESTORE_CLOSURE_PACK.md) · [Free-tier runbook](TECH-011_BACKUP_RESTORE_RUNBOOK.md) |
| `UX-012` | Amended: product-owner-approved baseline before pilot; dated contextual validation with the actual pilot user remains open during pilot. | `pilot_core`, gating; amended pre-pilot criterion `PASS` | [Amendment](UX-012_REQUIREMENT_AMENDMENT.md) · [Decision pack](UX-012_TERMINOLOGY_DECISION_PACK.md) · [Review register](UX-012_FACTORY_TERMINOLOGY_REVIEW_REGISTER.md) · [Feedback form](UX-012_PILOT_USER_FEEDBACK_FORM.md) |
| `GOLDEN-A-03` | Build one real fabric estimate and compare it with an independent truth sheet while preserving downstream invariants. | `pilot_core`, gating | [Independent truth-sheet pack](GOLDEN-A-03_TRUTH_SHEET.md) |
| `SIGNOFF-04` | Today meters reconcile with an independent supervisor register for the current run. | `pilot_operations`, non-gating before first use; mandatory first-shift control | [Pilot authorization and first-shift pack](SIGNOFF-04_PILOT_AUTHORIZATION.md) |

## Matrix integrity rule

Do not mark a row `PASS` because its template is complete, its code looks correct, a reviewer meeting was scheduled, a backup feature was purchased, or another row passed. Each pack names the exact closing artifact and acceptance test. Update only the row whose complete evidence has been checked; recalculate matrix counts from `results.json`; then regenerate or edit `TEST_MATRIX.md` without changing unrelated rows.

## Evidence handling

- Store signed forms and redacted evidence under a dated directory such as `output/qa/pilot-gate-closure/YYYY-MM-DD/<ROW>/`.
- Never commit database passwords, access tokens, service-role keys, raw production dumps, unredacted customer/worker data, or encryption private keys.
- Prefer counts, canonical digests, timestamps, provider artifact IDs, and redacted screenshots over raw production records.
- Record the reviewer/owner's full name, role, decision, date, time zone, and signature or traceable electronic approval.
- Preserve `BLOCKED` if any required artifact, reviewer identity, explanation, or verification is missing.

## Dependency order

1. Close `TECH-011` with a real retained/off-site scheduled artifact restored into disposable infrastructure and reconciled.
2. Operate the open `UX-012` pilot-user control: capture the actual user's name/role/date/context, correct every confusing or rejected term, and obtain dated post-change confirmation.
3. Close `GOLDEN-A-03` with an independently prepared real-fabric truth sheet and accepted variance review.
4. Sign the limited-pilot authorization only after the first three rows are formally `PASS`.
5. Keep `SIGNOFF-04` `BLOCKED` until the first pilot shift's app total reconciles with the independently maintained supervisor register; unexplained variance pauses the pilot.
