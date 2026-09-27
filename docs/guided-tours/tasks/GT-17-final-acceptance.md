# GT-17 — Cross-feature regression and final acceptance (gate G2)

## Task ID and purpose

GT-17. Prove the twelve tours work together and meet the plan, then pass gate G2 with independent review, the owner's QA run, native-language review and a production build in a credential-free copy.

## Dependencies and entry conditions

- GT-16 PASSED.

## Read first

Plan §10 (all), §4.8, §9; `REVIEW_PROMPT.md`; every ledger entry.

## Allowed change surface

- `docs/guided-tours/EXECUTION_STATUS.md`.
- Fixes found here go back to the owning task (reopened as IN_PROGRESS), then return here.

## Protected surface

Everything (verification only).

## Required implementation

1. Checks: tsc, lint, full Vitest, tour subset; production build in a credential-free copy (plan §10.2).
2. Harness: `./batch.sh` (all scenarios × four viewports) + reduced-motion run per tour; `summarize.py` must show no overlap, no off-screen target, only `recordTourEventAction` calls, no `/api/free/calculate`.
3. Consistency review across tours (record a table): eyebrow/footers identical; one guide per page; every handoff exists; copy limits (DR-27/DR-28) met in English and within DR-34 in gu/hi; every `{c:*}` resolves in all languages; glossary terms (§9.2) used consistently; no retired names ("Overview & Looms", "Full", "Earlier dispatch records", "Pending Dispatches") anywhere in tour copy.
4. Request G2: senior review (REVIEW_PROMPT, scope "G2 — whole program"), owner QA run below, native-language review of all tour copy and every new UI key added under LR-03.

## Owner QA run (QA project; creates no business data)

For each of the twelve tours on a Free, a Lite (if available) and a Base test org as applicable: start from the guide card, Next to Done, Back to step 1, Exit mid-tour; confirm outlines match text, no covered targets, page unchanged after Exit, compact launcher after reload; keyboard-only pass on desktop; one real phone pass; one screen-reader pass (any tour); Free allowance unchanged.

## Locked decisions

Plan §10.3 G2.

## Permitted local discretion

Format of the consistency table.

## Verification

All the above recorded with evidence references.

## Definition of done

- [ ] Checks and build green; harness clean.
- [ ] Consistency table complete with no open item.
- [ ] Reviewer verdict PASS (or conditions resolved), owner QA sign-off, native review done and applied.
- [ ] PLANNING vs IMPLEMENTATION status reconciled: every task PASSED except GT-B1 (BLOCKED).

## Failure and escalation conditions

Any regression found → reopen the owning task. A native-review change to a UI key that other pages share → owner decision.

## Checkpoint

GT-17 PASSED closes the program. GT-B1 remains BLOCKED until its conditions are met.
