# GT-05 — Cost Estimator tour (Free, Lite, Base)

## Task ID and purpose

GT-05. Replace the Estimator's bespoke tour and field guide with a 10-step tour of **Quick** view on the shared runtime, covering Free, Lite and Base, with correct persistence and no possible effect on inputs, drafts or the Free allowance.

## Dependencies and entry conditions

- GT-04 PASSED (G1).

## Read first

1. Page spec [`pages/cost-estimator.md`](../pages/cost-estimator.md) (contract).
2. Plan PS-TOUR-STATE, DS-04, DS-06, D-08, D-09, D-12, LR-02/LR-03, EC-19; the GT-03 implementation as the pattern to copy.
3. Source: `components/estimator/CostEstimateTutorial.tsx`; `app/(dashboard)/owner/estimator/EstimatorClient.tsx` around `prepareTutorial` (3584-3598), the tutorial-expand-row listener (2343-2354), Quick view (2776-3260), Live cost shortcut and sheet (1476-1627), the launcher mount (5344-5363); `EstimatorCard` definition; `lib/estimator-tour.ts`; `lib/i18n/cost-estimate-tutorial.ts`; `lib/i18n/cost-estimate-workflow.ts`; `app/(dashboard)/owner/estimator/tutorial-actions.ts`; `app/(dashboard)/owner/estimator/page.tsx`; `app/free/page.tsx`; `app/free/FreeClient.tsx`.
4. Tests: `estimator-core-tour`, `cost-estimate-tutorial-{account,i18n,modal,ordering,transitions}`, `free-plan-guided-tour`, `estimator-left-rail`, `guided-tour-left-rails`, `tour-no-autostart`, `tour-quota-and-data-safety`, `tour-preferences-and-actions`, `desktop-dimensions-responsive`.

## Allowed change surface

- `components/estimator/CostEstimateTutorial.tsx` (launcher + lazy runtime), new runtime file beside it
- `lib/estimator-tour.ts`, `lib/i18n/cost-estimate-tutorial.ts`; delete `lib/i18n/cost-estimate-workflow.ts` when unused
- `EstimatorClient.tsx`: only the tour prepare/restore closure, the seven `data-tour-anchor` attributes, removal of the tour's row-expansion dispatch (and the listener if nothing else dispatches the event), launcher props, `tx()` wrapping for the named labels in §F.2
- `EstimatorCard` (forward `data-tour-anchor`)
- Delete `app/(dashboard)/owner/estimator/tutorial-actions.ts` and its test
- `estimator/page.tsx`, `app/free/page.tsx`, `app/free/FreeClient.tsx`: pass `userId`, `orgId`, `userMetadata={{ tour_preferences }}`
- `lib/i18n/locales/{en,gu,hi}.ts`: phrase/keys for §F.2 tokens
- `lib/tours/tour-registry.ts`: `cost-estimate` → `v2`
- Tests listed above (deliberate updates); contract test (append files); harness files

## Protected surface

Costing math and reducer; autosave and drafts; the Free meter (`use-free-meter`, `/api/free/*`); save paths; the factory wizard; `state.isConfigured && !saving` launch condition; Detailed view behavior; `data-testid="mobile-live-estimate-shortcut"`.

## Required implementation

1. Steps, anchors, states and variants exactly per spec §D–§G. Tour-owned state: `entryMode='quick'` throughout; Live cost sheet open only for `est-live` and `est-save`; everything captured at launch and restored at TC-9 (reuse the existing restore closure).
2. Copy per spec §F.1 (plan variants), tokens per §F.2.
3. Remove the field guide button and track, the halo usage (already removed in GT-02), the `paddingBottom = '40vh'` hack and the bespoke positioning, timers and inert code.
4. Persistence: §7; legacy flags read by GT-02 code; no calls to the deleted dismiss action.
5. Harness: add `PRE_CLICK` support to `run-tour.mjs` (clicks a selector before launching; used to start in Detailed view) and record every request to `/api/` (URL + method) in `record.json`.

## Locked decisions

Page spec; D-08, D-09, D-12; DS-04, DS-06.

## Permitted local discretion

Where the restore closure lives; how the anchors are forwarded through `EstimatorCard`; test layout.

## Verification

- Tests: step order per plan; every step's anchor exists in Quick view source; copy parity/limits/native script; tokens resolve in 3 languages; worked numbers (₹60,000 ÷ 30,000 = ₹2/m; ₹100/m at 20% → ₹125/m) computed with `lib/estimator.ts`/`lib/finance.ts`; restore closure restores `entryMode`, `liveEstimateOpen`, `showQualityLibrary`, `showAdvancedOverhead`, `assumptionsExpanded`; no reference to the deleted dismiss action; contract test covers the Estimator tour files and the Free tokens.
- Full suite, tsc, lint green.
- Harness: `estimator`, `'estimator?tier=lite'` (quoted; the part after `?` becomes URL parameters, see the harness README), `free-estimator` at the four viewports + reduced motion; `estimator` with `PRE_CLICK` on the Detailed tab. Required: no overlap; every outline on screen (CE-3 fixed: step 10 paid and steps 5/9 Free were off screen before); Detailed restored after Exit when launched from Detailed; server calls only `recordTourEventAction` (plus the page's own `getEstimatorSecondaryData` on mount, which must not increase during the tour); no request to `/api/free/calculate`.

## Definition of done

- [ ] Spec §E steps, §F copy, §G variants, §I notes implemented; CE-1..CE-8 fixed; CE-9 (PI-17) only for the named labels.
- [ ] Tests/tsc/lint green; harness requirements met; ledger updated.

## Failure and escalation conditions

- Escalate: any change would touch the reducer, autosave or Free meter; a Quick card cannot take an anchor without changing its layout; a named label is rendered by a shared component used elsewhere with different meaning (label change would affect another page).

## Checkpoint

GT-05 PASSED with evidence. Next: **GT-06**.
