# GT-07 — Dispatches tour and the replica pattern

## Task ID and purpose

GT-07. Rebuild the Dispatches tour on the shared runtime, fix its factual error about yarn (SD-01, Blocker), remove retired help, and build `ReplicaGuidedTour` (EC-21): the replica laid out in the workspace, the live page kept mounted and hidden, and a live handoff step. GT-08..GT-12 reuse this component.

## Dependencies and entry conditions

- GT-06 PASSED.
- U-04 is resolved (owner, 2026-09-27): production deducts yarn; dispatch does not.

## Read first

1. Page spec [`pages/dispatches.md`](../pages/dispatches.md).
2. Plan EC-18, EC-21, PS-HANDOFF, SD-01, SD-08, DS-08.
3. Source: `components/dispatches/DispatchGuidedTour.tsx`, `DispatchTourPreview.tsx`, `components/tours/DispatchTutorial.tsx`, `lib/dispatch-tour.ts`, `lib/i18n/dispatch-tutorial.ts`, `app/(dashboard)/owner/dispatches/ChallansClient.tsx` (root ~280, New dispatch 288-294, toolbar 684-798), `ChallanDraftEditor.tsx`, `app/globals.css` preview-dialog rules (~1604-1637).
4. Tests: `dispatch-tour.test.ts`, `dispatch-tour-preview.test.tsx`, `dispatch-tutorial-panel.test.tsx`, `guided-tour-left-rails.test.ts`.

## Allowed change surface

New `components/tours/ReplicaGuidedTour.tsx`; `DispatchGuidedTour.tsx`, `DispatchTourPreview.tsx`; delete `components/tours/DispatchTutorial.tsx` when unused; `lib/dispatch-tour.ts`, `lib/i18n/dispatch-tutorial.ts`; `ChallansClient.tsx` (`data-tour-anchor="dispatch.new"` on both buttons; keys for any named control rendered as a literal); locales; registry `dispatch` → `v2`; listed tests (deliberate); contract test; harness.

## Protected surface

All challan behavior, RPCs, drafts, pending-retry handling (PI-10 is not fixed here), print page.

## Required implementation

1. `ReplicaGuidedTour` per EC-21 and EC-18; the dispatch replica rendered inside `dispatch-workspace-shell`; `hidden={step !== null && step !== handoffStepId}`; replica not rendered on the handoff step.
2. Steps per spec §E (10), copy §F, tokens; `dispatchTourExample` without yarn fields; replica receipt surface shows "Received as sent" as a separate button.
3. Remove `dispatchTourHelp`, the help UI and the `legacy` topic.
4. Replica labels from the same keys as the live page (LR-02).

## Locked decisions

Page spec; SD-01 wording (fabric only; yarn counted at production).

## Permitted local discretion

`ReplicaGuidedTour` internals within EC-21; how the replica selects its surface.

## Verification

- Tests: steps, anchors, copy parity/limits/script, tokens; no "yarn" deduction wording in any language (assert the old sentences are gone and `confirm.body` contains the fabric-only rule); replica: one target per step, all controls disabled, no `form`/`a`/handlers (existing test pattern); `ReplicaGuidedTour`: live children stay mounted during the tour (render test with a stateful child), hidden only on non-handoff steps.
- Full suite, tsc, lint green.
- Harness `dispatch` at four viewports + reduced motion. Required: no overlap; outline on screen; at 1440×900 the rail does not paint over the replica (screenshot of steps 1 and 8); step 10 shows the live page with the outline on New dispatch; Done focuses it; server calls only preferences.

## Definition of done

- [ ] DP-1..DP-5 fixed; `ReplicaGuidedTour` in place and documented in a short header comment.
- [ ] Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

- Escalate: the workspace class cannot contain the replica without layout changes to the live page; the code shows a dispatch path that deducts yarn, contradicting the owner's U-04 answer (then SD-01 wording needs a decision).

## Checkpoint

GT-07 PASSED. Next: **GT-08**.
