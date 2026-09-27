# GT-08 — Fabric Stock tour; remove the tour from the audit page

## Task ID and purpose

GT-08. Rebuild the Fabric Stock tour (6 steps) on `ReplicaGuidedTour`, remove the misassigned tour from `/owner/stock/audit`, and key the "Audit Inventory" and "Pending" labels. The shared `StockGuidedTour` wrapper moves to `ReplicaGuidedTour` for both kinds; the Yarn tour keeps its current steps and copy until GT-09.

## Dependencies and entry conditions

- GT-07 PASSED.

## Read first

1. Page specs [`pages/fabric-stock.md`](../pages/fabric-stock.md), [`pages/stock-audit.md`](../pages/stock-audit.md) §C.
2. Plan EC-18, EC-21, D-11.
3. Source: `components/stock/StockGuidedTour.tsx`, `FabricStockTourPreview.tsx`, `StockTourPreview.tsx`, `components/tours/StockTutorial.tsx`, `lib/stock-tour.ts`, `lib/i18n/stock-tutorial.ts` (fabric parts), `app/(dashboard)/owner/stock/QualityStockClient.tsx` (header 123-141, cards 199-258), `YarnStockClient.tsx` (Audit Inventory ~107), `app/(dashboard)/owner/stock/audit/page.tsx`.
4. Tests: `stock-tour.test.tsx`, `guided-tour-left-rails.test.ts`.

## Allowed change surface

`StockGuidedTour.tsx` (→ `ReplicaGuidedTour` for both kinds), `FabricStockTourPreview.tsx`, `StockTourPreview.tsx`; delete `components/tours/StockTutorial.tsx` when unused; `lib/stock-tour.ts` (fabric steps; yarn steps unchanged), `lib/i18n/stock-tutorial.ts` (fabric section; remove `fabricStockTutorialHelp`), `QualityStockClient.tsx` (anchor `fabric.opening`, `qualityStock.audit` and pending-badge keys), `YarnStockClient.tsx` (use `qualityStock.audit` only), `audit/page.tsx` (render `InventoryAuditClient` directly), locales, registry `fabric-stock` → `v2`, listed tests, contract test, harness.

## Protected surface

Stock RPCs and forms, history dialog, refresh behavior, the audit page's own behavior (only its wrapper is removed), the Yarn tour's current content.

## Required implementation

Per spec §D–§F: steps, sample numbers, replica balance by step, `tracking` removed, copy, tokens, handoff. Audit page without tour. Yarn tour runs unchanged on the new wrapper (verify in harness).

## Locked decisions

Page specs; D-11.

## Permitted local discretion

How the yarn kind passes its old steps through the new wrapper until GT-09.

## Verification

- Tests: fabric steps, numbers (100 → 600 → 590), copy parity/limits/script (no "Pending Dispatches"/"Earlier dispatch records" in any language), tokens, replica disabled-controls pattern, audit page source has no `StockGuidedTour`.
- Full suite, tsc, lint green.
- Harness `fabric-stock` at four viewports + reduced motion (no overlap incl. FS-5 at 1024; no rail paint at 1440; handoff on Opening stock); `yarn-stock` still completes with its old steps.

## Definition of done

- [ ] FS-1..FS-5 fixed; audit page tour removed; keys added.
- [ ] Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if removing the wrapper changes the audit page's layout beyond the missing rail, or if the yarn tour cannot run unchanged on the new wrapper.

## Checkpoint

GT-08 PASSED. Next: **GT-09**.
