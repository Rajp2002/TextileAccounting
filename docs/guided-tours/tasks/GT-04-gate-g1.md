# GT-04 — Gate G1: foundation and reference tour review

## Task ID and purpose

GT-04. Independent confirmation that the foundation (GT-01, GT-02) and the reference tour (GT-03) meet the plan before eleven more tours copy them. The executor prepares; a reviewer and the owner decide. The executor cannot pass this gate alone.

## Dependencies and entry conditions

- GT-03 in REVIEW_REQUIRED with its evidence bundle.

## Read first

`REVIEW_PROMPT.md`; plan §10.3; the GT-01, GT-02 and GT-03 ledger entries.

## Allowed change surface

- `docs/guided-tours/EXECUTION_STATUS.md` only, until a review requires fixes. Fixes are made under GT-03 (or GT-01/GT-02 if the finding is in the foundation), which go back to IN_PROGRESS and return here.

## Protected surface

Everything. Reviewing is read-only.

## Required implementation

1. Assemble the review request: revision/worktree, diff stat for GT-01..GT-03, the three ledger entries, harness summary before (GT-00) and after, screenshot list.
2. Ask the owner to route `REVIEW_PROMPT.md` (scope: "G1 — GT-01, GT-02, GT-03") to a senior reviewer. Do not review your own work as the reviewer.
3. Ask the owner for the QA run below and a native-speaker spot check of the Saved Costings Gujarati and Hindi copy (spec §F).
4. Record each outcome verbatim in the ledger. For each blocking finding, set the owning task to IN_PROGRESS, fix it there, re-run that task's verification, then return to GT-04.

## Owner QA run (on the shared QA project, per CLAUDE.md; creates no business data)

Use one Free test account and one Base test organization (a Lite one if available). For each:
1. Open Saved Costings. The guide card shows "Start guide" and "Not now".
2. Start the tour and go through every step with Next, then Back to the start, then forward to Done. Confirm each step's outline surrounds what the text describes and the panel never covers it.
3. Press Exit mid-tour: the page is exactly as before (search text, filters, open cards).
4. Reload: the guide shows as the compact launcher.
5. Base: the production step appears; Lite: it does not.
6. Free: the tour runs; after Done, reload: the compact launcher shows (persistence on Free).
7. Keyboard only (desktop): Tab stays in the panel, Escape exits, focus returns to the launcher.
8. Phone (any real phone): panel at the bottom, readable, buttons reachable; the outlined card is above the panel.
9. Screen reader (VoiceOver or TalkBack, if available): the dialog title is read on start; "Step n of N" is announced on Next.
10. Confirm no costing, draft or allowance changed (Free: allowance count unchanged).

## Locked decisions

Gate criteria in plan §10.3; the reviewer compares diff, behavior and spec independently (REVIEW_PROMPT).

## Permitted local discretion

How the evidence bundle is formatted.

## Verification

Reviewer verdict (PASS / PASS WITH CONDITIONS / FAIL) with findings; owner QA checklist results; native spot-check notes.

## Definition of done

- [ ] Reviewer verdict PASS, or PASS WITH CONDITIONS whose conditions are all resolved and re-verified.
- [ ] Owner QA checklist complete with no blocking issue.
- [ ] Native spot-check notes recorded; any wording changes applied in GT-03 and re-verified.
- [x] U-04 already answered by the owner (2026-09-27): yarn is deducted at production.

## Failure and escalation conditions

A finding that changes a locked decision (for example placement rules or the invitation lifecycle) goes to the owner as a decision request; the plan is updated by the owner/senior designer, not by the executor.

## Checkpoint

GT-04 PASSED only by the reviewer's verdict and the owner's QA sign-off, both recorded. Next eligible task: **GT-05**.
