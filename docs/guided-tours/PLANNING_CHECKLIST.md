# Guided tours refinement: planning checklist

Planning progress only. Implementation status lives in [EXECUTION_STATUS.md](./EXECUTION_STATUS.md) once it exists. Nothing here means code has changed.

Started 2026-09-27 in a cloud session that continued an earlier session interrupted by a usage limit. That session's checklist and audit notes were never pushed and are not available, so its audits were redone here.

## Baseline

- [x] Repository instructions read (`CLAUDE.md`, refactor `BRIEF.md`/`STATUS.md`)
- [x] Branch/revision recorded: `claude/gracious-sagan-dnwtsm` = `main` @ `f7cff98`, clean worktree
- [x] Dependencies installed with `npx npm@11.6.2 ci` (npm 10.9.7 in this container rejects the lockfile); lockfile unchanged
- [x] tsc / vitest / lint baseline recorded (tsc pass; 227 files / 1,949 passed / 1 skipped; lint exit 0; tour subset 41 files / 604)
- [x] Working-style article: BLOCKED (egress proxy denies `claude.dev`); applied the brief's own restatement
- [x] Browser feasibility decided: no `.env*`, so no real app; built the harness (`docs/guided-tours/harness/`) and ran every tour at 4 viewports × languages
- [x] Harness shell geometry bug found and fixed (missing `mobile.css`); earlier rail-overlap readings discarded and re-run

## Discovery

- [x] In-scope route inventory and exclusions (plan §2)
- [x] Shared runtime audit (plan §3.2)
- [x] Feature audits (five read-only subagents; key claims spot-checked; saved in `audit/`)
  - [x] Cost Estimator (owner + Free)
  - [x] Yarn Rate Book
  - [x] Saved Costings (owner + Free)
  - [x] Production (overview + daily sheet)
  - [x] Machine Assignments
  - [x] Machines
  - [x] Workers
  - [x] Fabric Stock, Yarn Stock, Stock audit
  - [x] Dispatches (+ print)
  - [x] Payroll
- [x] Label probe (how gu/hi display tour-named controls): `audit/label-probe.md`

## Deliverables

- [x] `docs/GUIDED_TOURS_REFINEMENT_PLAN.md` (§0–§13)
- [x] `docs/guided-tours/harness/` + README
- [x] `docs/guided-tours/pages/*.md` (13 specs: 12 pages + stock-audit decision)
- [x] `docs/guided-tours/tasks/*.md` (GT-00..GT-17, GT-B1)
- [x] `docs/guided-tours/EXECUTION_QUEUE.md`
- [x] `docs/guided-tours/EXECUTION_STATUS.md` (all tasks NOT_STARTED; GT-B1 BLOCKED)
- [x] `docs/guided-tours/EXECUTOR_PROMPT.md`
- [x] `docs/guided-tours/REVIEW_PROMPT.md`
- [x] Final handoff quality review (brief §16), below

## Final handoff quality review (2026-09-27)

Read as the implementing model meeting the package cold:

- [x] Scope complete; exclusions intact (plan §2).
- [x] Evidence labeled (OBSERVED harness / CODE-VERIFIED / INFERRED / UNKNOWN); a harness geometry bug was found and fixed, and the rail-overlap evidence was re-confirmed on the corrected run.
- [x] Every in-scope page has a decision; the only non-dedicated cases (print view, stock audit) are justified.
- [x] Essential requirements map to steps, More detail, a walkthrough, existing guidance or a justified omission (each spec §C).
- [x] Steps have copy (en/gu/hi), anchors (existing/proposed), state, preset mechanics, recovery and acceptance.
- [x] Shared vs page rules checked for conflicts; shared rules cited by ID only.
- [x] Design and architecture decisions resolved (plan §11); no option menus left to the executor.
- [x] Tasks cite real files and line ranges at `f7cff98`, or mark proposals.
- [x] Queue is linear and dependency-valid; cross-task artifacts produced before use.
- [x] Each task has a bounded change surface and a checkable Definition of Done.
- [x] Unknowns block only what depends on them (U-04 → GT-07 acceptance; U-06 → GT-12 start; PI-06/PI-07 → GT-B1). Update 2026-09-27: the owner answered U-04, U-06 and the GT-B1 count-path question (D-19, D-20); only PI-06/PI-07 still block GT-B1.
- [x] Escalation vs. discretion is explicit (EXECUTOR_PROMPT §1, §6).
- [x] Survives a fresh session: entry points in plan §0, EXECUTOR_PROMPT §2.
- [x] Nothing presented as implemented; all implementation tasks NOT_STARTED/BLOCKED.
- [x] Link check: no broken relative links; every shared ID referenced is defined in the plan; no vague placeholder phrases found by search.

## Known limits of this planning pass

- No real-app observation (no credentials in the container); harness only. Owner QA at G1/G2 covers it.
- Gujarati and Hindi copy written here is not native-reviewed.
- Screen-reader and real-device behavior not verified.
- The working-style article could not be fetched (egress blocked).
