# GT-06 — Yarn Rate Book tour

## Task ID and purpose

GT-06. Replace the Rate Book's bespoke tour with the 6-step shared-runtime tour, one launcher at every width, shadowed filters, guarded demo row and correct persistence.

## Dependencies and entry conditions

- GT-05 PASSED.

## Read first

1. Page spec [`pages/rate-book.md`](../pages/rate-book.md).
2. Plan DS-02, DS-03, DR-24, LR-02/03, EC-19; GT-03 pattern.
3. Source: `components/rates/RateBookTutorial.tsx`; `lib/rate-book-tour.ts`; `lib/i18n/rate-book-tutorial.ts`; `app/(dashboard)/owner/rates/RatesClient.tsx` (demo row 92-113/907-919, handlers 1103-1147, 1164-1233, 1274-1346, 1361-1451, header 1533-1557, rail 1505-1522 and 2293-2314, filters 1646-1763, table/cards 1820-2124); `tutorial-actions.ts`; `page.tsx`; `app/globals.css` rules for `.rates-left-rail-desktop` (~646-648, ~734-738).
4. Tests: `rate-book-tutorial.test.ts`, `rate-book-tour-flow.test.tsx`, `guided-tour-fixes-and-demo-data.test.ts` (rate parts), `tour-no-autostart`, `tour-preferences-and-actions`, `rate-review-rail.test.ts`, `guided-tour-left-rails`.

## Allowed change surface

`RateBookTutorial.tsx` (launcher + lazy runtime), `lib/rate-book-tour.ts`, `lib/i18n/rate-book-tutorial.ts`, `RatesClient.tsx` (tour mount, header launcher removal, shadowed filters while touring, demo guards, `addRateAction` on the rail Add, `tx()` wrap for Needs Review), delete `rates/tutorial-actions.ts` + its test, `rates/page.tsx` (userMetadata), `app/globals.css` (rail slot visible inline below 1024px), locales (§F tokens), registry `rate-book` → `v2`, the listed tests (deliberate), contract test, harness.

## Protected surface

Rate save, review, confirm-all, archive, delete, history, conflicts behavior; the demo row's existence and delete nudge (D-18); `RateBookHelp` content except removed market wording; the right-rail principles card (product UI).

## Required implementation

1. Steps/anchors/variants per spec §D–§G; the shadowing rule (search empty, direction All, Needs Review off, active view) applied to the rendered rows only while `tourStep` is set.
2. Copy §F; tokens; the `rows.unavailable` text for steps 3–5.
3. Guards on `handleSave`, `openHistory`, `handleArchive` for `isSampleRecordId(rate.id)`.
4. One `TourInvitation` (remove the `lg:hidden` header launcher); rail slot visible at every width.
5. Remove dead tour code (sheet/popover step branches, unused copy fields, `accountDismissed`, `requestTrigger`).

## Locked decisions

Page spec; D-18; the bulk-confirm caveat stays in `review.detail` until PI-11 is fixed.

## Permitted local discretion

How shadowing is implemented (derived rows vs. a tour flag in the filter function).

## Verification

- Tests: step list; anchors in source; copy parity/limits/script; tokens; guards call the sample toast and not the actions; shadowing does not write filter state; one `TourInvitation` in the page; legacy `ratebook_tutorial_dismissed` still yields `replay`.
- Full suite, tsc, lint green.
- Harness: `rates` (empty → demo row) and a new `rates-populated` (two real-shaped rows, one due for review) at four viewports + reduced motion; `rates-populated` with `PRE_CLICK` typing a search that matches nothing. Required: steps 3–5 outline a row in every run; no overlap; handoff anchor = Add (empty) or search (populated); search text restored after Exit; the 390×844 Gujarati run completes (U-07).

## Definition of done

- [ ] RB-1..RB-7 fixed; RB-8 left as PI-11 with the caveat copy.
- [ ] Tests/tsc/lint green; harness requirements met; ledger updated.

## Failure and escalation conditions

- Escalate: shadowing requires changing the filter state or URL; making the rail slot visible below 1024px breaks the page layout at 390px.

## Checkpoint

GT-06 PASSED. Next: **GT-07**.
