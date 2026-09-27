# GT-16 — Retire tour code made unused by this program

## Task ID and purpose

GT-16. Delete tour code that GT-03..GT-15 left without callers, so one runtime remains. Deletion only; no behavior change.

## Dependencies and entry conditions

- GT-15 PASSED.

## Read first

Plan §8 (EC-06 deprecation, EC-17); the ledger entries GT-01..GT-15 (what each left behind).

## Allowed change surface

Deleting, after proving zero references (import graph, dynamic imports, string references in tests and CSS):
- `useGuidedTourPlacement` in `hooks/use-guided-tour.ts`
- remaining `components/tours/*Tutorial.tsx` files
- the `align="start"` path of `TourInvitation` and `getTourStatus`, if unused
- per-tour CSS in `app/globals.css` for selectors no element renders any more (e.g. old `[data-*-tour-preview]` variants replaced by a shared rule)
- `lib/i18n/cost-estimate-workflow.ts` and any other copy module no longer imported
- tests that only exercised deleted code (list each and why)

## Protected surface

Everything with a caller. Any file outside tours.

## Required implementation

1. For each candidate: `grep -rn` for the symbol/file across `app components hooks lib __tests__`, check dynamic `import(` strings and CSS selectors against rendered markup; record the evidence.
2. Delete; run tsc, lint, full suite.
3. Harness `./batch.sh`: `summarize.py` output identical to the GT-15 run.

## Locked decisions

No refactoring beyond deletion.

## Permitted local discretion

Order of deletions.

## Verification

Evidence of zero references per deletion; tsc, lint, full suite green; harness summary unchanged.

## Definition of done

- [ ] Every deletion listed with its zero-reference evidence.
- [ ] Checks green; harness unchanged; ledger updated.

## Failure and escalation conditions

A candidate still has a caller outside tours → keep it and record why.

## Checkpoint

GT-16 PASSED. Next: **GT-17**.
