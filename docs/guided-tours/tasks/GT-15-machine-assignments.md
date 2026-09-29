# GT-15 — Machine Assignments tour

## Task ID and purpose

GT-15. Move the Machine Assignments tour to `GuidedTour` with corrected copy, keyed labels, no overlap on the board step, and a live handoff to the first worker's Assign (or Add worker).

## Dependencies and entry conditions

- GT-14 PASSED.

## Read first

1. Page spec [`pages/machine-assignments.md`](../pages/machine-assignments.md).
2. Source: `components/tours/ConfigurationTutorial.tsx`, `lib/configuration-tour.ts`, `lib/i18n/configuration-tutorial.ts`, `app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx`, `app/globals.css` (`[data-configuration-*]` rules ~1604-1647).
3. Tests: `configuration-tour.test.ts`, `configuration-tour-preview.test.tsx`, `management-navigation.test.ts`, `guided-tour-left-rails.test.ts`.

## Allowed change surface

`BaseAssignmentWorkspace.tsx` (tour mount, anchors, keys for Assign / No production job, focus banner hidden while touring), delete `components/tours/ConfigurationTutorial.tsx` when unused, `lib/configuration-tour.ts`, `lib/i18n/configuration-tutorial.ts` (remove the "Show inactive" topic), `app/globals.css` (remove the dead `[data-configuration-tour-preview]` rule), locales, registry `configuration` → `v2`, listed tests, contract test, harness.

Owner-approved clarification (2026-09-28): the owner answered “approve all three” to the coordinator’s decisions. Page spec §F now removes only the incorrect one-loom-per-worker sentence from `shift.body` in English/Gujarati/Hindi, retaining “Day and night are set separately.” and its already approved translations. Implement that corrected row. Multiple-loom assignment behavior remains protected. Use the default board anchor; the conditional overlap fallback still requires later browser evidence. These packet/page addenda are owner-approved documentation changes and must be preserved in the task patch.

## Protected surface

Assign/replace/undo/remove behavior and server validation, drag linking, picker, mobile toggle, legacy redirects.

## Required implementation

Per spec §D–§G; the step-1 overlap rule (fallback anchor `assignments.columns` only if overlap remains at 1024×768).

## Locked decisions

Page spec.

## Permitted local discretion

Whether the fallback anchor is needed (decided by the harness result, recorded).

## Verification

- Tests: steps, anchors, copy parity/limits/script, no "Overview & Looms", keyed labels, guards unchanged.
- Full suite, tsc, lint green.
- Harness `assignments` at four viewports + reduced motion (MA-1 fixed: no overlap at step 1 at 1024/1280/1440; handoff anchor chosen by data).

## Definition of done

- [ ] MA-1..MA-3 fixed. Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if no anchor on the board avoids overlap at 1024×768.

## Checkpoint

GT-15 PASSED. Next: **GT-16**.
