# Costing and quality save actions: design

Date: 2026-10-18. Status: agreed with the owner in conversation, awaiting spec review.
Applies to: Lite and Base estimator (`app/(dashboard)/owner/estimator/`). Free's single Calculate & Save button is unchanged.

## Problem

The estimator's action panel shows three save actions: **Save Costing** (or **Save New Version**), **Quality changed · Update Quality**, and **Save Quality & Create Costing**. Owners cannot tell which one to press, because:

1. **A price edit counts as a quality change.** `hasSavedQualityRecipeChanges` (`EstimatorClient.tsx`, `recipeSignature`) compares the whole recipe, including yarn rate, GST, wastage, per-pick rate, overhead, loom RPM and power, hours, and warping/sizing mode. Editing one yarn rate lights up "Quality changed · Update Quality".
2. **The same check opens a dialog on Save Costing** (`pendingQualityVersionSave`) asking "save version only, or also update the quality?", so a price edit also gets a quality question.
3. **Save Quality & Create Costing is always enabled.** With a saved quality loaded it silently becomes a copy named "<name> - New".
4. **The top label only changes for an opened saved costing.** It reads "Save New Version" then, but not when a saved quality with costings is loaded, even though that save also lands as the next version.
5. **The help line is wrong.** "Save Costing saves the quality for reuse…" is false: a costing saved with no quality loaded saves no quality.

## Decisions agreed with the owner

- **A different fabric is always a new quality.** A saved quality's recipe is never edited in place from the estimator. "Update Quality" goes away.
- **Same fabric with different prices is a new costing version** of that quality ("Update Costing").
- **Save Quality & Costing** is only for a fabric that is not already a saved quality.
- **Reopening a saved quality** takes the fabric from the quality, every rate the Rate Book holds from the Rate Book, and everything else from the quality's latest costing.

## 1. Fabric edits vs costing edits

A pure module, `lib/quality-construction.ts`, decides this so it can be unit-tested and reused by the server.

**Fabric (construction): changing any of these makes it a different quality**

| Input | Compared as |
|---|---|
| Number of warp layers, number of weft layers | count |
| Per warp layer: beam ends, denier or cotton count (with its unit), yarn name, calculation mode, manual kg per 100m (manual mode only) | per layer, in order |
| Per weft layer: picks, pick ratio, costing width (effective width, else reed space), denier or cotton count (with its unit), yarn name, calculation mode, manual kg per 100m (manual mode only) | per layer, in order |

Yarn names are compared after `normalizeYarnName` (trim, case, spacing), so retyping the same name is not a change. Numbers are compared as numbers, so "4800" and "4800.0" match.

**Costing: everything else.** That includes yarn rate, GST %, wastage % (global and per layer), crimp % (global and per layer), per-pick rate, tape length, loom type, RPM, power and hours, warping/sizing mode and rates, winding, processing, finishing, overhead, commission, transport, margin, quantity and enabled sections.

The module exports:

- `constructionSignature(warpRows, weftRows)`: a stable string built from the fabric inputs only.
- `describeConstructionChanges(before, after)`: a short list of what changed, for the panel line. Examples: "weft layers 1 → 2", "beam ends 4800 → 5200", "warp yarn 75D poly → 75D viscose". It shows at most three items, then "+N more".

`recipeSignature` and `hasSavedQualityRecipeChanges` are deleted.

## 2. Action panel states

The baseline for "fabric changed" is the loaded saved quality's construction. With no quality loaded but a saved costing open, the baseline is that costing's construction.

| Where the user started | Fabric changed? | Main button (ink) | Second button |
|---|---|---|---|
| Nothing loaded (new fabric) | n/a | **Save Costing**: saves a costing only, no quality | **Save Quality & Costing**: new quality + costing v1 (existing name dialog) |
| Saved quality loaded, or a saved costing opened | No | **Update Costing**: saves v N+1 in the same lineage | **Save as New Quality**, disabled. Line beneath: "Quality unchanged. Update Costing saves v{N+1}." |
| Saved quality loaded, or a saved costing opened | Yes | **Save as New Quality**: new quality + costing v1. The name dialog opens prefilled "<name> - New" | **Update Costing**, disabled. Line beneath: "Fabric changed: {changes}. A different fabric is saved as a new quality." |

Rules:

- The state is live. Undoing the fabric edits returns the panel to the middle row.
- **Update Costing when the quality has no costings yet.** This happens when a saved quality is loaded but has never been costed. The label still reads **Update Costing**, and the line says "Saves the first costing for {quality}." Reason: a loaded quality means the user is working inside that quality, so one label covers it.
- **An opened saved costing with no quality (unlinked).** Same fabric: Update Costing (v N+1). Fabric changed: Save as New Quality. Save Quality & Costing stays available in the same-fabric case, because there is no saved quality yet. The adoption rule from `20261013150000` keeps that costing's lineage.
- The overflow menu (Export Cost Sheet, New Quality / Reset) is unchanged.
- The `pendingQualityVersionSave` dialog is removed. Save Costing no longer asks a quality question.
- The help line under the panel follows the state:
  - New fabric: "Save Costing keeps this costing only. Save Quality & Costing also saves the fabric for reuse."
  - Same fabric: "Update Costing saves v{N+1}. Earlier versions keep their own numbers."
  - Fabric changed: no extra line (the change line already explains it).

## 3. Server guard

`saveEstimatorQuoteV3` refuses a costing save that carries a `templateId` when the request's construction signature differs from that saved quality's. Error: "This is a different fabric from {quality}. Save it as a new quality." The guard keeps a quality's costings all the same fabric, even from an old tab or a crafted request. A legacy linked costing whose construction already differs is not touched. The guard only applies to new saves.

The `updateSavedQuality` / `version_and_quality` path in `saveEstimatorQuoteV3` and the estimator's `handleUpdateTemplate` → `updateFabricTemplate` call are removed. `updateFabricTemplate` is only called from the estimator, so it is deleted too, unless planning finds another caller. The RPC parameter `p_update_saved_quality` stays: it is always sent `false`, and no migration is needed.

## 4. Reopening a saved quality

`APPLY_TEMPLATE` currently mixes the quality's stored values, the latest costing's assumptions and the quality's own overhead override. The new order, per input:

| Input | Source, in order |
|---|---|
| Fabric (section 1) | The quality |
| Yarn rate per layer | Rate Book (already pushed into the quality's rows by the Rate Book, `applyYarnRateToTemplate`), else the quality's row |
| Warping, sizing, winding rate; processing, finishing; transport; commission | Factory default set by the Rate Book (`factory_cost_profile`: `warping_rate_per_kg`, `sizing_rate_per_kg`, `winding_rate_per_kg`, `default_processing_rate_per_m`, `default_finishing_rate_per_m`, `default_transport_per_m`, `default_commission_pct`), else the latest costing, else today's fallback |
| Per-pick rate, wastage % (global and per layer), crimp % (global and per layer), GST % per layer, tape length, loom type/RPM/power, hours, warping/sizing mode, overhead (mode, items, direct rate), margin, quantity, enabled sections, loom count, working days, output per loom | Latest costing, else the quality's stored value, else factory default |

Notes:

- **Per-layer values** (GST, wastage, crimp) are copied from the latest costing's rows by position, but only when that costing's construction signature equals the quality's. Otherwise, as with legacy costings saved under the old "version only" flow, the quality's own row values are used.
- **Rate Book "Overhead" entries** write the legacy `overhead_pct`, which the estimator does not use. Overhead therefore comes from the latest costing. Fixing the Rate Book overhead mapping is out of scope.
- **A one-off rate override** typed into a costing is kept in that version, but is replaced by the Rate Book rate the next time the quality is reopened. That is intended: v2 → Rate Book update → reopen → Update Costing gives v3 at current rates.
- `SavedQualityCostingReuse` and the reuse query in `actions.ts` gain the columns this needs: `warp_rows`, `weft_rows`, `per_pick_cost_paise`, `yarn_shortage_pct`, `warp_crimp_pct`, `tape_length_m`, `loom_type`, `hours_per_shift`, `sizing_mode`, and the loom RPM/power fields. Planning confirms where costings store RPM and power, which may be in the input snapshot rather than a column. No migration is expected.
- `resolveAppliedQualityBasis` no longer prefers the quality's own `overhead_override_per_m` over the latest costing's.
- Opening a **saved costing** from Saved Costings is unchanged. It shows that costing's own numbers, with the existing changed-since and stale-rate notices.

## 5. Copy and i18n

New or changed strings, in en, hi and gu (`lib/i18n/locales/*`, `lib/i18n/lite-phrases/estimator.ts`, and `lib/i18n/base-plan-phrases.ts` where it maps these):

- `tourControls.estimator.saveNewVersion` → "Update Costing". Renaming the key to `updateCosting` is a planning choice; tests reference it.
- `estimator.quality.saveQualityAndCosting` → "Save Quality & Costing".
- New: "Save as New Quality", the three panel lines in section 2, the server guard error, and the "first costing" line.
- Removed: "Quality changed · Update Quality", "Quality unchanged" (as a label), and the version dialog strings (`estimator.sprint1.recipe_changed`, `save_version_only`, `save_version_update_quality`, `future_quality_explanation`) where nothing else uses them.

Gujarati and Hindi labels run longer, so both buttons wrap rather than truncate (`whitespace-normal`, `min-h-[44px]`).

## 6. Testing

- **Unit, `lib/quality-construction.ts`.** Signature ignores rates, GST, wastage, crimp, loom and overhead. It changes on layer count, beam ends, denier/count, unit, picks, pick ratio, width, yarn name, mode and manual kg. Normalisation ignores yarn name case and spacing, and numeric formatting. `describeConstructionChanges` wording and the three-item cap.
- **Unit, reopen resolver.** Extract the `APPLY_TEMPLATE` merge into `lib/saved-costings.ts`. Rate Book default wins over the latest costing for the seven Rate Book fields. Latest costing wins for the rest. Per-layer values are copied only when signatures match. Falls back when there is no costing.
- **Unit, panel state.** Extract a pure `resolveCostingActionState(...)` returning the row from section 2. Cover new, same fabric, fabric changed, quality with no costings, and unlinked costing.
- **Server.** `saveEstimatorQuoteV3` refuses a mismatched construction with a `templateId`, and accepts a matching one.
- **Source-contract tests to update deliberately:** `__tests__/estimator-core-tour.test.ts`, `cost-estimate-tutorial-i18n.test.ts` (asserts the hi/gu "Save New Version" text), `base-estimator-go-readiness.test.ts` (`data-testid="save-as-new-quality"`, which is kept), `estimator-only-experience.test.ts`, and `sprint9-editor-reliability.test.ts`.
- `npx tsc --noEmit`, `npm run lint`, and the touched test files. A signed-in visual check on QA is logged as pending, as usual.

## Choices made in this spec that were not discussed

These follow from the agreed decisions, but the owner has not confirmed them:

1. A loaded quality with no costings yet still shows **Update Costing**, not Save Costing (section 2).
2. An opened costing with no saved quality follows the same fabric rule, and still offers Save Quality & Costing when the fabric is unchanged (section 2).
3. The server refuses a costing save whose fabric differs from its linked quality (section 3).
4. Save Costing loses its "also update the quality?" dialog entirely (section 2).

## Out of scope

- Free's estimator.
- Editing a saved quality's recipe anywhere else. There is no such screen today, and fixing a wrong saved recipe means saving a new quality and archiving the old one.
- The Rate Book overhead → `overhead_pct` mapping.
- Opening a saved costing (rather than a quality) with Rate Book rates.
