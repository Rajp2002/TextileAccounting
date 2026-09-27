# GT-09 — Yarn Stock tour

## Task ID and purpose

GT-09. Rebuild the Yarn Stock tour (7 steps) on the GT-08 wrapper with the current deduction rule, replica order matching the live page, and a live handoff.

## Dependencies and entry conditions

- GT-08 PASSED.

## Read first

1. Page spec [`pages/yarn-stock.md`](../pages/yarn-stock.md).
2. Source: `YarnStockTourPreview.tsx`, `lib/stock-tour.ts` (yarn steps), `lib/i18n/stock-tutorial.ts` (yarn section), `lib/i18n/yarn-stock.ts`, `app/(dashboard)/owner/stock/YarnStockClient.tsx` (header 106-117, cards 120-150).
3. Tests: `stock-tour.test.tsx` (yarn parts).

## Allowed change surface

`YarnStockTourPreview.tsx`, `lib/stock-tour.ts` (yarn), `lib/i18n/stock-tutorial.ts` (yarn; remove `yarnStockTutorialHelp`), `YarnStockClient.tsx` (anchor `yarn.opening`), registry `yarn-stock` → `v2`, listed tests, contract test, harness.

## Protected surface

Yarn RPCs, pending-request storage, dated view and CSV, `yarnStockText` values.

## Required implementation

Per spec §D–§F (including D-19: `balance.detail` and `usage.detail` explain that yarn in unsold fabric still counts and is added back in the Stock audit): seven steps, numbers (100 → 120 kg; 6 + 4 = 10 kg/100 m; 200 m → −20 kg; 98 counted), replica order, copy, tokens resolved from `yarnStockText[language]`, handoff.

## Locked decisions

Page spec; SD-01 rule (production deducts yarn; dispatch does not).

## Permitted local discretion

Replica markup order details as long as it mirrors the live page's section order.

## Verification

- Tests: steps, numbers checked against the stock arithmetic used by the page, copy parity/limits/script, no "dispatch deduct" wording, tokens, replica pattern.
- Full suite, tsc, lint green.
- Harness `yarn-stock` at four viewports + reduced motion (YS-3 fixed: no overlap at 1024/1280; no rail paint at 1440; handoff on Opening weight).

## Definition of done

- [ ] YS-1..YS-5 fixed (YS-1 was fixed by GT-02's invitation copy; confirm).
- [ ] Tests/tsc/lint green; harness met; ledger updated.

## Failure and escalation conditions

Escalate if the live page's section order cannot be mirrored without inventing controls.

## Checkpoint

GT-09 PASSED. Next: **GT-10**.
