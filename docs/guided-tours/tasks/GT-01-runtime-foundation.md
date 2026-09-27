# GT-01 — Shared runtime and presentation foundation

## Task ID and purpose

GT-01. Build the shared pieces every tour will use: pure placement, target readiness, scrolling with restore, the step hook, the panel, the spotlight, the composing `GuidedTour` component, shared copy, token formatting, sample-id detection and the one-tour guard. **No tour is migrated in this task**; GT-03 proves the foundation on Saved Costings. Existing tours must behave exactly as before.

## Dependencies and entry conditions

- GT-00 PASSED; no unresolved drift.

## Read first

1. Plan §4 (DR-01..DR-23), §5 (TC-1..TC-9, presets, focus model, edge cases), §6 (DS-*), §8 (EC-03..EC-11, EC-15..EC-17, EC-20), §9.3.
2. Source: `hooks/use-guided-tour.ts` (whole file), `hooks/use-mobile-tour.ts`, `lib/mobile-tour-positioning.ts`, `lib/tutorial-target.ts`, `lib/tutorial-viewport-lock.ts`, `components/tours/ProductionTutorial.tsx` (a current panel, for what to replace later), `components/ui/button.tsx`, `app/globals.css` lines ~1433-1480 (tour block).
3. Tests that pin the code you touch: `__tests__/guided-tour-focus.test.ts`, `__tests__/mobile-tour-positioning.test.ts`, `__tests__/tutorial-target.test.ts`, `__tests__/tutorial-viewport-lock.test.ts`.

## Allowed change surface

New (all proposed names are fixed):
- `lib/tours/placement.ts`, `lib/tours/target-readiness.ts`, `lib/tours/tour-scroll.ts`, `lib/tours/tour-text.ts`, `lib/tours/active-tour.ts`, `lib/tours/sample-ids.ts`
- `lib/i18n/tour-common.ts`
- `components/tours/TourPanel.tsx`, `components/tours/TourSpotlight.tsx`, `components/tours/GuidedTour.tsx`
- Tests: `__tests__/tour-placement.test.ts`, `__tests__/tour-target-readiness.test.ts`, `__tests__/tour-scroll.test.ts`, `__tests__/tour-text.test.ts`, `__tests__/tour-active-guard.test.ts`, `__tests__/tour-sample-ids.test.ts`, `__tests__/tour-common-i18n.test.ts`, `__tests__/tour-panel-render.test.tsx`

Modified:
- `hooks/use-guided-tour.ts`: add `useTourStep`; the focus-to-Next rule in `useGuidedTourModal` (§5.4); deprecate `useGuidedTourPlacement` with a comment (do not delete).
- `lib/mobile-tour-positioning.ts`, `hooks/use-mobile-tour.ts`: EC-07 (replace settle timers with the stability check; report "unavailable" after the budget).
- `app/globals.css`: add the new panel/spotlight rules only if Tailwind classes cannot express them; do not change existing tour rules yet (unmigrated tours still use them).
- `lib/tours/tour-types.ts`: add `TourStepSpec` only (other type changes are GT-02).
- `__tests__/mobile-tour-positioning.test.ts`: update only the assertions about the removed timers, deliberately (note it in the ledger).
- `scratch/tour-harness/**` and `docs/guided-tours/harness/**`: `run-tour.mjs` reads `data-tour-step`/`data-tour-status`; add the `foundation` scenario below.

## Protected surface

- Every existing tour component, wrapper and copy file: unchanged behavior and markup. Their tests must pass unmodified (except the one noted above).
- `useGuidedTourModal` behavior pinned by `guided-tour-focus.test.ts`.
- `lib/tutorial-target.ts` exports and semantics.
- No new dependencies. No server code. No live page changes.

## Required implementation

1. **`placeTourPanel` (EC-03).** Pure function exactly as DR-14: `outline` = target rect expanded by 6px; `U` = union of `outline` and `context` (when given); candidates beside `U` in the order right, left, below, above, 16px gap, 16px viewport margin; vertical alignment for right/left = `clamp(U.top, margin, vh − h − margin)`; horizontal alignment for below/above = `clamp(U.left, margin, vw − w − margin)`; valid = fully inside the margins and no intersection with `outline` or `context`; fallback corners TR, BR, TL, BL by least total intersection area, ties in that order. Return `{ left, top, side }`.
2. **`resolveTourTarget` and `watchTourTarget` (EC-04).** Resolve per TC-2 using `isTourTargetVisible`; development-only duplicate warning. `watchTourTarget` polls each animation frame; ready when connected, visible, non-zero, and the rect moved ≤1px across 2 consecutive frames; `onUnavailable` after `budgetMs` (1,500). Accept injected `raf`, `caf` and `now` for tests. Return a cancel function.
3. **`scrollIntoSafeView` / `restoreScroll` (EC-05).** TC-4: scroll only when the rect is not fully inside `safe`; container from `findTourScrollContainer`; centre the target (top-align if taller); `behavior` smooth unless reduced motion; record each container's first original position in a `ScrollRecord`; `restoreScroll` puts them back instantly.
4. **`useTourStep` (EC-06).** Implements TC-1..TC-8 for desktop using 1–3, and delegates to `useMobileTour` in the compact layout. Returns `{ status, rect, placement, statusText }`; `statusText` = `tourCommonCopy.preparing` after 400 ms of preparing, the step's unavailable text (or `tourCommonCopy.unavailable`) when unavailable. TC-7 tracking listeners are attached only while a step is ready and removed on change/unmount.
5. **`TourPanel` (EC-08, including the optional `extra` slot)** and **`TourSpotlight` (EC-09)** exactly per DR-01..DR-13 and DR-17..DR-19, keeping the classes `guided-tour-panel`, `guided-tour-controls`, `guided-tour-portal`, `guided-tour-backdrop`, `guided-tour-highlight`. Controls use `components/ui/button.tsx` variants (`ghost`, `outline`, default).
6. **`GuidedTour` (EC-10).** Portal to `document.body` with spotlight + panel; wires `useGuidedTourModal` (existing), `useTourStep`, focus rules (§5.4), the visually hidden live region, `acquireTour`/`releaseTour`, and completion: on Done of the last step, if `recordCompletion` is true, call `persistTourCompleted(tourId, userId)` (existing function; GT-02 adds the version) then `onDone?.()` then `onStepChange(null)`. Exit calls `onStepChange(null)` only. Scroll: capture window position at launch and pass it to `useGuidedTourModal`'s `returnScroll`; call `restoreScroll(record)` in cleanup.
7. **Shared copy (EC-11):** `tourCommonCopy` with exactly the keys and values of plan §9.3 for en/gu/hi.
8. **`formatTourText` (EC-20)**, **`acquireTour`/`releaseTour` (EC-15)**, **`isSampleRecordId` (EC-16:** true for ids starting `tour-` and for `demo-sample-yarn-rate`**)**.
9. **EC-07:** in `trackMobileTourTarget`, replace `[120, 350].map(setTimeout)` with a frame-based stability check (same 2-frame rule); after 1,500 ms without a visible target call a new `onUnavailable` callback once. Keep padding reservation, floating-element lift and restore unchanged.
10. **Harness `foundation` scenario** (in `scratch/tour-harness/main.tsx`, copied back to `docs/guided-tours/harness/`): a page with a launcher button and six target boxes: top-left, centre, right edge, bottom edge, inside a scrollable 300px-high container, and inside a fake open dialog (`role="dialog"` with id `sandbox-dialog`, used as `context`). A 6-step `GuidedTour` visits them (the dialog step with `kind: 'sample'`). Update `run-tour.mjs` to read `data-tour-step`, `data-tour-status` and the eyebrow text.

## Locked decisions

D-01, D-04, D-06, D-16; DR-01..DR-23; TC-1..TC-9; §5.4. Scrim `bg-ink/45` without blur; panel width 360px; outline 2px saffron at 6px; no progress bar; Back not rendered on step 1; Next and Done are one element.

## Permitted local discretion

Internal structure of hooks and helpers, naming of private functions, how frames are scheduled, test fixture shapes, splitting components into small private subcomponents inside the same files.

## Verification

- New unit tests:
  - placement: every candidate side chosen in a fixture where it is the first valid one; the corner fallback; a target inside a context box (panel beside the box, never over it); a 390px-wide viewport returns a corner (compact layouts do not call it, but it must not throw).
  - readiness: ready after 2 stable frames; restarts on movement; unavailable at the budget; cancel stops callbacks.
  - scroll: no scroll when inside `safe`; container vs window; restore puts positions back.
  - text: tokens and values replaced; unknown token throws in development.
  - active guard: second `acquireTour` fails until release.
  - sample ids.
  - `tourCommonCopy`: key parity, native script for gu/hi, no English words except the allowed list (LR-05).
  - `TourPanel` SSR: eyebrow text with and without "Sample", Back absent on step 1, Done on the last step, `data-tour-*` attributes, `aria-*` wiring, More detail collapsed.
- Existing tests: `node scripts/performance/isolated-command.mjs npx vitest run` (full suite) green except the deliberately updated mobile-positioning assertions.
- tsc and lint clean.
- Harness: `node run-tour.mjs foundation en 1440x900`, `… en 1024x768`, `… gu 390x844`, `REDUCED_MOTION=1 … en 1024x768`. Required results: no panel/outline overlap on any step; every outline fully on screen; the scroll-container step scrolls the container, not the window; after Exit the container and window scroll positions equal their values before launch; focus is inside the panel on every step and returns to the launcher on Exit; reduced motion has no smooth scroll. Screenshots listed in the ledger.
- Regression: rerun `./batch.sh` for the existing tours; `summarize.py` output must equal the GT-00 baseline summary (the existing tours are untouched).

## Definition of done

- [ ] All files in the allowed surface implemented as specified; nothing else changed.
- [ ] New tests pass; full suite, tsc and lint green.
- [ ] Harness `foundation` scenario meets every required result at all four runs.
- [ ] Existing-tour harness summary unchanged from GT-00.
- [ ] Ledger updated with commands, results, screenshot list and the one deliberate test update.

## Failure and escalation conditions

- Repair locally: bugs in your own new code; fixture mistakes; lint/type errors in touched files.
- Escalate: a DR/TC rule cannot be met without changing an existing tour's behavior; `useGuidedTourModal` cannot support the §5.4 focus rule without breaking `guided-tour-focus.test.ts`; the harness shows overlap that `placeTourPanel` cannot avoid under DR-14 (send the fixture and screenshot).

## Checkpoint

GT-01 PASSED with evidence. Next eligible task: **GT-02**.
