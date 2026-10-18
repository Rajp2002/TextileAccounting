# Costing and Quality Save Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Lite/Base estimator's save actions follow intent: Save Costing for a new fabric, Update Costing for the same fabric, Save as New Quality when the fabric changed. Reopening a quality uses current Rate Book rates.

**Architecture:** Three new pure modules decide everything and are unit-tested:
- `lib/quality-construction.ts`: is this the same fabric?
- `lib/costing-action-state.ts`: which buttons show?
- a reopen resolver in `lib/saved-costings.ts`: where each input comes from.

`EstimatorClient.tsx` renders from them, and `saveEstimatorQuoteV3` reuses the construction check as a server guard. The quality-update paths (Update Quality button, version dialog, `updateSavedQuality`, `updateFabricTemplate`) are deleted. No migration.

**Tech Stack:** Next.js 16 / React 19, TypeScript strict, Vitest (node env), `npm run test:db` (disposable local PostgreSQL), i18n dictionaries in en/hi/gu.

**Spec:** `docs/superpowers/specs/2026-10-18-costing-quality-action-clarity-design.md`

## Global Constraints

- Lite and Base only. Free's estimator branch (`freeCanCalculate !== undefined` in `EstimatorLiveCostActions`, `freeMode` elsewhere) must not change.
- Fabric = warp/weft layer counts; per warp layer: beam ends, denier or cotton count + unit, yarn name, calculation mode, manual kg/100m (manual mode only); per weft layer: picks, pick ratio, costing width (`effectiveCostingWidthCm ?? reedSpace`), denier or cotton count + unit, yarn name, calculation mode, manual kg/100m (manual mode only). Everything else is costing.
- Yarn names compare via `normalizeYarnName` (`lib/yarn-rate-reconciliation.ts`). Numbers compare via `Number()`.
- Change line shows at most three changes, then "+N more".
- Rate Book fields on reopen: `warpingRatePerKg` ← `warping_rate_per_kg`, `sizingRatePerKg` ← `sizing_rate_per_kg`, `windingRatePerKg` ← `winding_rate_per_kg`, `processingRatePerM` ← `default_processing_rate_per_m`, `finishingRatePerM` ← `default_finishing_rate_per_m`, `transportPerM` ← `default_transport_per_m`, `commissionPct` ← `default_commission_pct`.
- Every new user-facing string exists in `lib/i18n/locales/en.ts`, `hi.ts`, `gu.ts`. Buttons wrap, never truncate: `whitespace-normal`, `min-h-[44px]`.
- Primary action stays ink (`bg-loom` as today). No saffron primary.
- Don't run `npm run build`, `npm start`, `supabase db push`, or anything against QA/production. `npm run test:db` is local and allowed.
- `npm run lint` must stay at 0 warnings.

## Review Focus

1. **A legacy quality with no `warp_rows`** (single-row template with `beam_ends`/`ppi` columns). The baseline must be the rows the estimator builds for it, not an empty list, or every legacy quality reads as "fabric changed". Pinned in Task 1 (`templateConstructionRows`) and Task 3 (legacy reopen case).
2. **A baseline yarn name that is blank.** Older qualities often have no yarn names. Typing a name onto one must not count as a fabric change. Only a change from one non-blank name to a different one counts. Pinned in Task 1.
3. **A Rate Book default of 0 vs missing.** A profile value of `0` (e.g. commission 0%) is a real default and must win. Only `null`/`undefined` falls back to the latest costing. Pinned in Task 3.
4. **An opened costing with no baseline** (restored draft with `sourceQuoteId` but `sourceState` null). The panel must fall back to the same-fabric row, never crash or block saving. Pinned in Task 2.
5. **Save as New Quality from an unlinked costing.** The quality name must not equal the costing's label, or the adoption rule (`20261013150000`) folds the "new" quality back into the old costing lineage. The dialog prefills "<label> - New" and detaches the source costing. Pinned in Task 5.

---

### Task 1: Fabric construction module

**Files:**
- Create: `lib/quality-construction.ts`
- Test: `__tests__/quality-construction.test.ts`

**Interfaces:**
- Consumes: `WarpRow`, `WeftRow` from `lib/estimator.ts`; `normalizeYarnName` from `lib/yarn-rate-reconciliation.ts`.
- Produces:
  - `type ConstructionRows = { warpRows: WarpRow[]; weftRows: WeftRow[] }`
  - `constructionSignature(rows: ConstructionRows): string`
  - `sameConstruction(baseline: ConstructionRows, current: ConstructionRows): boolean`. Same as comparing signatures, except a blank baseline yarn name matches any current name.
  - `type ConstructionChange = { kind: 'warpLayers' | 'weftLayers' | 'beamEnds' | 'yarnCount' | 'yarnName' | 'picks' | 'pickRatio' | 'width' | 'calculation' | 'manualKg'; side: 'warp' | 'weft'; layer: number | null; from: string; to: string }` (`layer` is 1-based, null for layer counts)
  - `describeConstructionChanges(baseline: ConstructionRows, current: ConstructionRows): ConstructionChange[]`, in warp-then-weft, layer order. Empty when `sameConstruction` is true.
  - `templateConstructionRows(template: { warp_rows?: WarpRow[] | null; weft_rows?: WeftRow[] | null; calculated_yarn_denier?: unknown; yarn_denier?: unknown; beam_ends?: unknown; ppi?: unknown; reed_space?: unknown; weft_denier?: unknown }): ConstructionRows`. Uses the stored rows, else the legacy one-row fallback with the same defaults as `APPLY_TEMPLATE` today (denier 75, beam ends 3200, ppi 68, reed space 110, weft denier 75).

- [ ] **Step 1: Write the failing tests**

Build `warp(overrides)` / `weft(overrides)` helpers from a base row (`calcDenier: 75, beamEnds: 4800, yarnRate: 120, gstPct: 5, shortagePct: null` / `picks: 60, reedSpace: 120, calcDenier: 75, yarnRate: 110, gstPct: 5, shortagePct: null`), each with a yarn `label`.

```ts
it('ignores rates, GST, wastage and crimp', () => {
    const a = { warpRows: [warp({})], weftRows: [weft({})] }
    const b = { warpRows: [warp({ yarnRate: 135, gstPct: 12, shortagePct: 3, crimpPct: 8 })], weftRows: [weft({ yarnRate: 99, crimpPct: 2 })] }
    expect(sameConstruction(a, b)).toBe(true)
    expect(constructionSignature(a)).toBe(constructionSignature(b))
})
it.each([
    ['beam ends', { warpRows: [warp({ beamEnds: 5200 })] }],
    ['warp denier', { warpRows: [warp({ calcDenier: 80 })] }],
    ['count unit', { warpRows: [warp({ linearDensityUnit: 'cotton_count_ne', cottonCountNe: 40 })] }],
    ['picks', { weftRows: [weft({ picks: 64 })] }],
    ['pick ratio', { weftRows: [weft({ pickRatio: 2 })] }],
    ['width', { weftRows: [weft({ effectiveCostingWidthCm: 125 })] }],
    ['manual kg', { warpRows: [warp({ calculationMode: 'manual', manualKgPer100m: 4.2 })] }],
    ['extra weft layer', { weftRows: [weft({}), weft({ label: 'Zari' })] }],
])('treats a %s change as a different fabric', (_, patch) => {
    const base = { warpRows: [warp({})], weftRows: [weft({})] }
    expect(sameConstruction(base, { ...base, ...patch })).toBe(false)
})
it('ignores manual kg while the layer is in formula mode', ...)          // manualKgPer100m differs, calculationMode absent → same
it('normalises yarn names and numeric formatting', ...)                   // '75D Poly' vs ' 75d  poly', beamEnds 4800 vs '4800' as unknown as number → same
it('treats naming a previously blank yarn as the same fabric', ...)        // baseline label '' or undefined, current 'Viscose' → same
it('treats renaming a named yarn as a different fabric', ...)              // 'Poly' → 'Viscose' → false
it('describes changes in order', () => {
    expect(describeConstructionChanges(
        { warpRows: [warp({})], weftRows: [weft({})] },
        { warpRows: [warp({ beamEnds: 5200 })], weftRows: [weft({}), weft({ label: 'Zari' })] },
    )).toEqual([
        { kind: 'beamEnds', side: 'warp', layer: 1, from: '4800', to: '5200' },
        { kind: 'weftLayers', side: 'weft', layer: null, from: '1', to: '2' },
    ])
})
it('builds legacy one-row construction from template columns', ...)      // { beam_ends: 4000, ppi: 70 } → warpRows[0].beamEnds 4000, weftRows[0].picks 70
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/quality-construction.test.ts`
Expected: FAIL, cannot resolve `@/lib/quality-construction`.

- [ ] **Step 3: Implement `lib/quality-construction.ts`**

The signature serialises only the fabric fields from Global Constraints, per layer in order, with `Number()` on numbers and `normalizeYarnName` on labels. `manualKgPer100m` is included only when `calculationMode === 'manual'`. `sameConstruction` compares layer counts first, then each layer's fields. A blank (after normalising) baseline label matches anything. For a layer-count difference, `describeConstructionChanges` reports the count change and does not diff the extra layers.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run __tests__/quality-construction.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/quality-construction.ts __tests__/quality-construction.test.ts
git commit -m "Add fabric construction comparison for saved qualities"
```

---

### Task 2: Action panel state

**Files:**
- Create: `lib/costing-action-state.ts`
- Test: `__tests__/costing-action-state.test.ts`

**Interfaces:**
- Consumes: `ConstructionRows`, `sameConstruction`, `describeConstructionChanges`, `ConstructionChange` (Task 1).
- Produces:

```ts
export type CostingActionInput = {
    hasSavedQuality: boolean          // appliedTemplate != null
    hasOpenedCosting: boolean         // sourceQuoteId != null && sourceRecordKind === 'costing'
    baseline: ConstructionRows | null // quality rows if hasSavedQuality, else opened costing rows, else null
    current: ConstructionRows
    latestVersion: number | null      // highest saved version in this lineage, null if none
}
export type CostingActionState =
    | { kind: 'new' }                                                           // Save Costing + Save Quality & Costing
    | { kind: 'sameFabric'; nextVersion: number; firstCosting: boolean; canSaveQuality: boolean } // Update Costing; second button disabled unless canSaveQuality
    | { kind: 'fabricChanged'; changes: ConstructionChange[] }                  // Save as New Quality; Update Costing disabled
export function resolveCostingActionState(input: CostingActionInput): CostingActionState
```

Rules:
- Neither a saved quality nor an opened costing → `new`.
- `baseline === null` → `sameFabric` (Review Focus 4).
- `nextVersion = (latestVersion ?? 0) + 1` and `firstCosting = latestVersion === null`.
- `canSaveQuality = !hasSavedQuality`: an unlinked costing can still be saved as a quality.

- [ ] **Step 1: Write the failing tests.** Cover:
  - nothing loaded → `{ kind: 'new' }`
  - quality loaded, price-only edit, latestVersion 2 → `{ kind: 'sameFabric', nextVersion: 3, firstCosting: false, canSaveQuality: false }`
  - quality loaded with no costings → `nextVersion: 1, firstCosting: true`
  - unlinked opened costing, same fabric → `canSaveQuality: true`
  - quality loaded, beam ends changed → `kind: 'fabricChanged'`, and `changes[0].kind === 'beamEnds'`
  - undo (current equal to baseline again) → `sameFabric`
  - opened costing with `baseline: null` and edited rows → `sameFabric`

- [ ] **Step 2: Run** `npx vitest run __tests__/costing-action-state.test.ts`. Expected: FAIL, module missing.
- [ ] **Step 3: Implement** `resolveCostingActionState` in `lib/costing-action-state.ts`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit**

```bash
git add lib/costing-action-state.ts __tests__/costing-action-state.test.ts
git commit -m "Derive estimator save actions from loaded record and fabric changes"
```

---

### Task 3: Reopen rule for saved qualities

**Files:**
- Modify: `lib/saved-costings.ts`: `SavedQualityCostingReuse` (≈249), `restoreSavedQualityCostingAssumptions` (≈368), `resolveAppliedQualityBasis` (≈318)
- Modify: `app/(dashboard)/owner/estimator/actions.ts`: `getEstimatorTemplates` reuse columns (≈689–708)
- Modify: `app/(dashboard)/owner/estimator/EstimatorClient.tsx`: `Action` type (≈525), the `APPLY_TEMPLATE` case (≈601–662), and the four dispatch sites (≈3680, 4379, 4779, 4926)
- Test: `__tests__/saved-quality-reopen.test.ts`

**Interfaces:**
- Consumes: `templateConstructionRows`, `constructionSignature` (Task 1).
- Produces:

```ts
export type RateBookDefaults = Partial<Record<
    'warpingRatePerKg' | 'sizingRatePerKg' | 'windingRatePerKg' | 'processingRatePerM' | 'finishingRatePerM' | 'transportPerM' | 'commissionPct',
    number>>
export function rateBookDefaultsFromProfile(profile: Record<string, unknown> | null | undefined): RateBookDefaults // mapping in Global Constraints; null/undefined/non-finite omitted, 0 kept
export function resolveReopenedQualityState(
    state: EstimateState,
    template: SavedQualityTemplateInput,   // the EstimatorTemplate fields APPLY_TEMPLATE reads today
    rateBookDefaults: RateBookDefaults,
): EstimateState
```

- `SavedQualityCostingReuse` gains: `version_number`, `warp_rows`, `weft_rows`, `per_pick_cost_paise`, `yarn_shortage_pct`, `warp_crimp_pct`, `tape_length_m`, `loom_type`, `estimator_rpm`, `estimator_power_kw`, `hours_per_shift`, `sizing_mode`. Costings store RPM/power as `estimator_rpm`/`estimator_power_kw` (`lib/estimator-quote-payload.ts`).
- The `Action` becomes `{ type: 'APPLY_TEMPLATE'; template: EstimatorTemplate; rateBookDefaults: RateBookDefaults }`. Every dispatch passes `rateBookDefaultsFromProfile(currentProfileRef.current)`.

Precedence (spec section 4):
- **Fabric:** from `templateConstructionRows(template)`.
- **Yarn rate per layer:** from the template rows (already kept current by the Rate Book).
- **The seven Rate Book fields:** `rateBookDefaults` → latest costing → current state.
- **Global per-pick, wastage, crimp, tape, loom type/RPM/power, hours, warping/sizing mode, overhead mode/items/direct rate, margin, quantity, sections, loom count, working days, output per loom:** latest costing → template value → current state.
- **Per-layer `gstPct`, `shortagePct`, `crimpPct`:** copied from the latest costing's rows by index, only when `constructionSignature` of the costing rows equals the template's. Otherwise from the template rows.
- **Overhead:** `resolveAppliedQualityBasis` stops preferring the template's `overhead_override_per_m` over the latest costing's. Template value only when there is no costing.

- [ ] **Step 1: Write the failing tests.** Fixture: a template with one warp and one weft row, `per_pick_cost_paise: 18`, and `latest_costing_reuse` with matching rows (`gstPct: 12`), `per_pick_cost_paise: 22`, `sizing_rate_per_kg: 9`, `commission_pct: 2`. Assert:
  - `rateBookDefaults { sizingRatePerKg: 11 }` → `sizingRatePerKg === 11`; `commissionPct === 2` (falls back to costing)
  - `rateBookDefaults { commissionPct: 0 }` → `commissionPct === 0` (Review Focus 3)
  - `rateBookDefaultsFromProfile({ default_commission_pct: 0, sizing_rate_per_kg: null })` → `{ commissionPct: 0 }`
  - `perPickCostPaisa === 22` (latest costing beats the template's 18)
  - `warpRows[0].gstPct === 12` when the constructions match; equals the template row's value when the costing has an extra weft layer
  - no `latest_costing_reuse` → `perPickCostPaisa === 18`, and Rate Book defaults still apply
  - template `overhead_override_per_m: 3` with costing `overhead_override_per_m: 5, overhead_mode: 'direct'` → `overheadOverridePerM === 5`
  - legacy template without `warp_rows` → `warpRows[0].beamEnds === template.beam_ends`
- [ ] **Step 2: Run** `npx vitest run __tests__/saved-quality-reopen.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.** Add `rateBookDefaultsFromProfile` and `resolveReopenedQualityState` to `lib/saved-costings.ts`. Move the body of the `APPLY_TEMPLATE` case into `resolveReopenedQualityState`, so the reducer case becomes a one-line call. Add the reuse columns to `getEstimatorTemplates`, keeping the existing fallback read for missing columns. Update the four dispatch sites.
- [ ] **Step 4: Run** `npx vitest run __tests__/saved-quality-reopen.test.ts __tests__/lite-quality-recall.test.ts`, then `npx vitest run -t "saved quality"`. Expected: PASS. Fix any source-contract test that asserted the old reducer text, deliberately.
- [ ] **Step 5: Commit**

```bash
git add lib/saved-costings.ts "app/(dashboard)/owner/estimator/actions.ts" "app/(dashboard)/owner/estimator/EstimatorClient.tsx" __tests__/saved-quality-reopen.test.ts
git commit -m "Reopen saved qualities with Rate Book rates and latest costing inputs"
```

---

### Task 4: Server guard for a different fabric

**Files:**
- Modify: `app/(dashboard)/owner/estimator/actions.ts`: `saveEstimatorQuoteV3` (≈1419), template lookup at ≈1461
- Modify: `__tests__/db/costing-lineage.dbtest.ts` (add one case)
- Modify: `__tests__/sprint1-costing-save-trust.test.ts` (add a guard assertion)

**Interfaces:**
- Consumes: `templateConstructionRows`, `sameConstruction` (Task 1).
- Produces: `saveEstimatorQuoteV3` returns `{ error: 'This is a different fabric from {name}. Save it as a new quality.' }` (with the template's name) when `templateId` is set and `!sameConstruction(templateConstructionRows(template), estimate)`. The quality-update removal happens in Task 5, together with its client caller, so every commit typechecks.

- [ ] **Step 1: Write the failing tests**
  - DB test, in `describe('costing lineage: a quality saved first')`: "refuses a costing whose fabric differs from its quality". Save the quality 'Linen', then call `saveEstimatorQuoteV3` with `templateId` and an estimate whose `warpRows[0].beamEnds` differs. Expect `{ error: expect.stringContaining('different fabric from Linen') }`. Expect `costingRows` length still 1.
  - Contract test in `sprint1-costing-save-trust.test.ts`: `functionBody(actions, 'saveEstimatorQuoteV3')` contains `sameConstruction(templateConstructionRows(`.
- [ ] **Step 2: Run** `npx vitest run __tests__/sprint1-costing-save-trust.test.ts`. Expected: FAIL. Then `npm run test:db`. Expected: the new case FAILS, the rest PASS.
- [ ] **Step 3: Implement.** The template lookup selects `id, name, warp_rows, weft_rows, calculated_yarn_denier, yarn_denier, beam_ends, ppi, reed_space, weft_denier`. Run the guard right after the lookup, before any write.
- [ ] **Step 4: Run** the same two commands. Expected: PASS. The existing lineage cases must still pass: their margin-only edits keep the construction.
- [ ] **Step 5: Commit**

```bash
git add "app/(dashboard)/owner/estimator/actions.ts" __tests__/db/costing-lineage.dbtest.ts __tests__/sprint1-costing-save-trust.test.ts
git commit -m "Refuse costings of a different fabric under a saved quality"
```

---

### Task 5: Estimator action panel, copy and i18n

**Files:**
- Modify: `app/(dashboard)/owner/estimator/EstimatorClient.tsx`:
  - `EstimatorLiveCostActions` (≈1955–2145), non-Free branch only
  - remove `recipeSignature`/`hasSavedQualityRecipeChanges` (≈425–486), `hasActiveQualityRecipeChanges` (≈4364), `topCostingActionLabel`'s non-Free branch (≈4367), `handleUpdateTemplate` (≈4645), and the `pendingQualityVersionSave` state, check (≈5023) and dialog (≈7449–7501)
  - remove the `qualityUpdateDecision` parameter of `handleSaveQuote`
  - hidden legacy cockpit buttons (≈5855–5925)
  - stale hint (≈5936–5938)
  - `fullReuse` note (≈1948)
  - `openSaveAsNewQualityDialog` (≈4417)
- Modify: `app/(dashboard)/owner/estimator/actions.ts`: remove the `updateSavedQuality` param and branch in `saveEstimatorQuoteV3` (≈1566), `buildSavedQualityUpdatePayload` (≈264) and `updateFabricTemplate` (≈1146)
- Modify: `__tests__/db/costing-lineage.dbtest.ts`: drop `updateSavedQuality: true` at ≈107 and ≈163 and keep their assertions
- Modify: `__tests__/batch10-estimator-quote-order-snapshots.test.ts:119`: drop the `updateFabricTemplate` body assertion
- Modify: `lib/i18n/locales/en.ts`, `hi.ts`, `gu.ts`; `lib/i18n/cost-estimate-tutorial.ts:109`
- Modify tests: `__tests__/cost-estimate-tutorial-i18n.test.ts`, `estimator-core-tour.test.ts`, `sprint1-costing-save-trust.test.ts`, `lite-quality-recall.test.ts:94`, `base-estimator-go-readiness.test.ts`, `estimator-only-experience.test.ts`, `sprint9-editor-reliability.test.ts`
- Test: `__tests__/costing-action-panel.test.tsx` (renderToStaticMarkup, like the existing `.tsx` tests)

**Interfaces:**
- Consumes: `resolveCostingActionState`, `CostingActionState` (Task 2); `templateConstructionRows` (Task 1); `latest_costing_reuse.version_number` (Task 3).
- Produces: `EstimatorLiveCostActions` props replace `hasActiveQualityRecipeChanges`, `qualitySaveLabel` inputs and `onUpdateQuality` with `actionState: CostingActionState`, `qualityName: string | null`, `onSaveAsNewQuality` (kept), `onSaveQualityAndCosting`. Export it for the render test.

Wiring in `EstimatorClient`:
- `baseline` = `appliedTemplate ? templateConstructionRows(appliedTemplate) : sourceState && hasOpenedCosting ? sourceState : null`
- `latestVersion` = `sourceQuoteVersionNumber ?? appliedTemplate?.latest_costing_reuse?.version_number ?? null`. Memoise `actionState`.
- `topCostingActionLabel` (non-Free) is `t('tourControls.estimator.updateCosting')` when `actionState.kind !== 'new'`, else `saveCosting`.

Panel per state (spec section 2). The main button keeps `id="btn-save-accept"` and `data-testid="save-costing-action"`; the second button keeps `id="save-quality-and-costing"` and `data-testid="save-as-new-quality"`:

| `kind` | Main button (label → handler) | Second button | Line (`role="status"`) |
|---|---|---|---|
| `new` | `saveCosting` → `onSaveCosting` | `saveQualityAndCosting` → `onSaveQualityAndCosting`, enabled | `hint.new` |
| `sameFabric` | `updateCosting` → `onSaveCosting` | `saveAsNewQuality`, `disabled={!canSaveQuality}`. Label `saveQualityAndCosting` when `canSaveQuality` | `firstCosting ? hint.firstCosting : hint.sameFabric` |
| `fabricChanged` | `saveAsNewQuality` → `onSaveAsNewQuality` | `updateCosting`, disabled | `hint.fabricChanged` |

i18n keys:

| Key | en | hi | gu |
|---|---|---|---|
| `tourControls.estimator.updateCosting` (renames `saveNewVersion`) | Update Costing | कॉस्टिंग अपडेट करें | કોસ્ટિંગ અપડેટ કરો |
| `estimator.quality.saveQualityAndCosting` | Save Quality & Costing | क्वालिटी और कॉस्टिंग सेव करें | ક્વોલિટી અને કોસ્ટિંગ સાચવો |
| `estimator.actions.saveAsNewQuality` | Save as New Quality | नई क्वालिटी के रूप में सेव करें | નવી ક્વોલિટી તરીકે સાચવો |
| `estimator.actions.hint.new` | Save Costing keeps this costing only. Save Quality & Costing also saves the fabric for reuse. | | |
| `estimator.actions.hint.sameFabric` | Quality unchanged. Update Costing saves v{version}. Earlier versions keep their own numbers. | | |
| `estimator.actions.hint.firstCosting` | Saves the first costing for {quality}. | | |
| `estimator.actions.hint.fabricChanged` | Fabric changed: {changes}. A different fabric is saved as a new quality. | | |
| `estimator.actions.change.{kind}` (one per `ConstructionChange.kind`) | e.g. beamEnds "beam ends {from} → {to}", weftLayers "weft layers {from} → {to}", yarnName "{side} yarn {from} → {to}" | | |
| `estimator.actions.change.more` | +{count} more | | |
| `estimator.actions.differentFabricError` | This is a different fabric from {quality}. Save it as a new quality. | | |

hi/gu for the hint, change and error rows are written in the same register as the neighbouring `estimator.quality.*` strings. They're flagged in the PR for the owner's HI/GU review.

`fullReuse` note (en): "Reopening this quality brings back its fabric, today's Rate Book rates, and the rest of its latest costing. Costings you already saved do not change."

- [ ] **Step 1: Write the failing render test** `__tests__/costing-action-panel.test.tsx`. Render `EstimatorLiveCostActions` inside the i18n provider with minimal props per state. Assert:
  - `new`: contains "Save Costing" and "Save Quality &amp; Costing"; does not contain "Update Quality"
  - `sameFabric` (nextVersion 3, canSaveQuality false): contains "Update Costing" and "saves v3"; the `save-as-new-quality` button has `disabled`
  - `fabricChanged` with a beam-ends change: main button text "Save as New Quality"; contains "beam ends 4800 → 5200"; the Update Costing button has `disabled`
  - `fabricChanged` with four changes: shows the first three and "+1 more"
  - no state renders a `truncate` class on these buttons
- [ ] **Step 2: Run** `npx vitest run __tests__/costing-action-panel.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the panel and wiring** as tabled above.
  - `onSaveQualityAndCosting` → `openSaveTemplateDialog`.
  - `openSaveAsNewQualityDialog` also handles `!appliedTemplate && sourceQuoteId`: it stores the same rollback, detaches the `sourceQuote*` state, and prefills `${qualityLabel} - New` (Review Focus 5).
  - Show the server's different-fabric error as a toast and keep the draft.
  - The hidden legacy cockpit: remove the Update Fabric Quality button; drive its save label from `topCostingActionLabel`.
  - Replace the stale hint with the state hint.
- [ ] **Step 4: Remove dead code and copy.**
  - Remove the server quality-update path listed under Files. First confirm `grep -rn "updateFabricTemplate\|updateSavedQuality" app components lib` shows no remaining callers.
  - Delete `estimator.sprint1.recipe_changed`, `save_version_only`, `save_version_update_quality` and `future_quality_explanation` in all three locales, after `grep -rn` shows no other users. Keep "Save as separate quality": Saved Costings uses it (`costing-margin-wiring.test.tsx`, `lite-translation-coverage.test.ts`).
- [ ] **Step 5: Update the contract tests deliberately**
  - `cost-estimate-tutorial-i18n.test.ts`: lines 47 and 60–63 → `updateCosting` with the hi/gu values above
  - `estimator-core-tour.test.ts:55`: key `tourControls.estimator.updateCosting` → 'Update Costing'
  - `sprint1-costing-save-trust.test.ts:16–24`: assert `resolveCostingActionState` is used, and that 'Update Fabric Quality' and `save_version_only` are gone
  - `lite-quality-recall.test.ts:94`: drop the `save_version_only` expectation
  - `sprint1-costing-save-trust.test.ts`: also assert `actions` does not contain `updateSavedQuality` or `export async function updateFabricTemplate`
  - Re-run `base-estimator-go-readiness`, `estimator-only-experience` and `sprint9-editor-reliability`, and fix only assertions about the removed code
- [ ] **Step 6: Run** `npx vitest run __tests__/costing-action-panel.test.tsx __tests__/cost-estimate-tutorial-i18n.test.ts __tests__/estimator-core-tour.test.ts __tests__/sprint1-costing-save-trust.test.ts __tests__/lite-quality-recall.test.ts __tests__/base-estimator-go-readiness.test.ts __tests__/estimator-only-experience.test.ts __tests__/sprint9-editor-reliability.test.ts __tests__/tour-real-page-guard.test.ts __tests__/lite-translation-coverage.test.ts __tests__/batch10-estimator-quote-order-snapshots.test.ts`, then `npm run test:db`. Expected: PASS.
- [ ] **Step 7: Commit**

```bash
git add -A "app/(dashboard)/owner/estimator" lib/i18n __tests__
git commit -m "Show Save, Update or Save as New Quality by intent; remove in-place quality updates"
```

---

### Task 6: Branch verification

- [ ] **Step 1:** `npx tsc --noEmit`. Expected: no errors.
- [ ] **Step 2:** `npm run lint`. Expected: 0 errors, 0 warnings.
- [ ] **Step 3:** `npx vitest run __tests__/quality-construction.test.ts __tests__/costing-action-state.test.ts __tests__/saved-quality-reopen.test.ts __tests__/costing-action-panel.test.tsx`, plus every test file Tasks 3–5 touched. Expected: PASS. The full suite runs in CI on the PR; note that in the PR body.
- [ ] **Step 4:** `npm run test:db`. Expected: PASS.
- [ ] **Step 5:** Record in the PR body as pending:
  - a signed-in check on QA for the three states and for reopening a quality after a Rate Book change
  - HI/GU review of the new strings
