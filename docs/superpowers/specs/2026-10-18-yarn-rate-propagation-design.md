# Yarn rate propagation: design

Date: 2026-10-18. Status: design agreed with the owner in conversation, awaiting spec review.
Applies to: Lite and Base Rate Book (`app/(dashboard)/owner/rates/`) and the saved-costing revision path in `app/(dashboard)/owner/estimator/actions.ts`. Free has no Rate Book and is unchanged.

## Problem

Editing a yarn rate in the Rate Book updates the matching layers of every Saved Quality (`save_cost_rate_atomic_versioned`) but never touches a saved costing. Costings are immutable versioned snapshots, so after a price change the only way to get a costing at the new rate is to open each quality in the estimator, wait for the Rate Book rate to load, and press Update Costing. The Rate Book's own toast says as much: "Costings you already saved did not change."

An owner who changes a yarn price wants to see which costings that price affects and re-cost them in one step.

## Decisions agreed with the owner

- After a yarn rate is edited, the yarn's card shows a **Propagate** pill.
- Clicking it creates **new versions** of the saved costings that use that yarn. The new versions use the **new yarn rate**. (The owner's request said "not with the updated new price"; the owner confirmed this was a typo for "now".)
- Costings are never edited in place. Every earlier version keeps its own numbers.

## Choices made in this spec that were not discussed

These follow from the agreed decisions, but the owner has not confirmed them:

1. **Latest version only.** Each costing lineage (`costing_group_id`) is propagated from its latest version. Older versions are never touched.
2. **Archived costings and archived qualities are skipped.** `save_estimator_costing_revision_v2` sets `is_archived := false` on every new version, so propagating an archived lineage would silently un-archive it.
3. **The pill is derived, not stored.** It shows whenever at least one eligible costing carries a different rate for that yarn than the Rate Book does. So it also appears for a costing whose rate was overridden by hand in the estimator, until that costing is propagated. There is no "dismiss".
4. **Review dialog before any write.** The click lists the costings and what changes; nothing is saved until the owner confirms.
5. **New versions are saved as `draft`**, the same status the estimator gives a normal Update Costing. Party name and warp/weft instructions carry over from the previous version.
6. **The pill is hidden on a due-for-review card** (the Due queue keeps to its two answers, per the Rate Book redesign) and on archived cards. It shows on every other yarn card.

## 1. What counts as an affected costing

A costing is affected by a yarn rate R (category `yarn_warp` or `yarn_weft`, name N) when all of these hold:

- `record_kind = 'costing'`, and it is the latest version of its lineage: highest `version_number` for its `costing_group_id` (falling back to its own `id`), tie-broken by `created_at` then `id`, the same order the revision RPC uses.
- It is active: `is_archived` is false, and its `template_id`, if any, points at an active quality (`isSavedCostingArchived`).
- At least one row of the costing's `warp_rows` (for `yarn_warp`) or `weft_rows` (for `yarn_weft`) has `normalizeYarnName(row.label) === normalizeYarnName(N)` and a `yarnRate` that differs from R's `current_value`.

Warp and weft rates are separate Rate Book entries even when they share a name, so a propagate for a warp rate only changes warp rows. Rows are read through `buildDraftStateFromQuote` so legacy costings with missing or flat-column rows are normalised the same way the Saved Costings page and the estimator normalise them.

## 2. Architecture

Pure matching and rewriting live in a new module so they can be unit-tested; the actions only fetch, call it and save.

### `lib/yarn-rate-propagation.ts` (new, pure)

- `findAffectedLayers(estimate, category, normalizedName, newRate)` returns the row indexes whose rate differs.
- `applyYarnRate(estimate, category, normalizedName, newRate)` returns a copy of the estimate with only those rows' `yarnRate` replaced. No other field is touched.
- `latestCostingPerLineage(rows)` returns the latest row of each `costing_group_id` (rules in section 1).
- `buildPropagationRequestId(sourceQuoteId, rateId, newRate)` returns a deterministic UUIDv5-shaped id (same construction as `getInitialQualitySnapshotRequestId`), so a repeated click or a retry replays the original save instead of creating a second version.
- Types: `PropagationCandidate` (costing id, quality label, party, version, `updated_at`, template id) and `PropagationPreviewItem` (candidate plus before/after production cost and selling price per metre, and the changed layers).

### `app/(dashboard)/owner/rates/propagation-actions.ts` (new `'use server'` file, three actions)

A separate file keeps `actions.ts` (474 lines) focused on rate CRUD.

All three call `requireRole(['owner'])` and `requireBaseTier` (the `rate_book` capability), and derive the org from the profile.

- **`getYarnRatePropagationCounts()`** returns `{ [rateId]: number }`. One light query reads the org's active costings (`id, costing_group_id, version_number, created_at, is_archived, template_id, warp_rows, weft_rows`, plus the active-template ids), reduces to latest-per-lineage, and counts affected costings for every active yarn rate. It runs in the same secondary effect as `getCostRateUsage`, so it never blocks the Rate Book's first paint. Pagination follows `readAllPages` / `createdAtDescendingAfter` (the estimator already pages `estimator_quotes` at 500).
- **`previewYarnRatePropagation(rateId)`** re-reads the rate (current value and `updated_at`), fetches the full rows of the affected costings, rebuilds each estimate, applies the rate, recomputes with the same Decimal engine the save uses (`calcFullTotals` + `buildCostingResult`), and returns the preview items plus the rate's `updated_at`. A costing that cannot be priced (fails `validateEstimatorSnapshot` before or after) is returned in a `skipped` list with a plain reason instead of failing the preview.
- **`applyYarnRatePropagation({ rateId, expectedRateUpdatedAt, costings: [{ id, expectedUpdatedAt }] })`** saves new versions for at most **10 costings per call** (the client batches; see section 4). It re-reads the rate and refuses with "This rate changed since you opened the review. Reopen Propagate." when its `updated_at` differs from `expectedRateUpdatedAt`. For each costing, sequentially:
  1. Reload the row with `id`, `org_id`, `record_kind = 'costing'` and confirm it is still the latest, active version and `updated_at` equals `expectedUpdatedAt`; otherwise record `stale`.
  2. Rebuild the estimate, apply the rate server-side from the database value (never from the request), compute authoritative totals.
  3. Save through `saveEstimatorQuoteV3` with `sourceQuoteId`, `expectedSourceUpdatedAt`, `templateId` (when the costing has one), `expectedTemplateUpdatedAt` read fresh, the deterministic `clientRequestId`, `status: 'draft'`, and the party and quality label of the source. This reuses everything the estimator relies on: replay by request id, the fabric guard (it passes, because only a rate changed), the attestation, the org-lock and tier checks in the RPC, the "newer version already exists" check, and version numbering.
  4. Record `created` (with the new version number and quote id), `unchanged` (RPC outcome `no_change`), `stale`, or `failed` with the message.
  It then calls `revalidatePath` for `/owner/quotes` and `/owner/rates` once and returns the per-costing results.

Calling `saveEstimatorQuoteV3` rather than the RPC directly is deliberate: it is the one place the attestation, totals check and fabric guard live, so propagation cannot drift from the estimator.

### `app/(dashboard)/owner/rates/RatesClient.tsx` and a new `PropagateYarnRateDialog.tsx`

- `RatesClient` stores `propagationCounts` beside the usage state, filled by `getYarnRatePropagationCounts()`.
- `renderYarnCard` adds the pill to the card's action row, next to **Edit rate**, when `propagationCounts[rate.id] > 0`, the card is not due, and the rate is active. Label "Propagate · N". It is an explicit button (the design rules forbid row-click and `...` menu actions), 40px high (44px on phones), neutral outline styling, with saffron reserved for the selected state only. It carries `data-ratebook-field="propagateAction"`.
- The dialog (`components/` sibling of `RatesClient`, a Radix `Dialog` per the existing Rate Book dialogs; on phones it uses the existing sheet pattern) shows:
  - Title: "Propagate {yarn} at ₹{rate}/kg".
  - A list of affected costings, one row each: quality or party name, "v3 → v4", production cost per metre before → after, selling price per metre before → after, and the changed layers ("Warp 1"). Rows are ticked by default; the owner can untick any.
  - A skipped section listing costings that cannot be re-costed, with the reason.
  - Primary button (ink): "Create N new versions". Secondary: Cancel.
  - Loading, empty ("Nothing to propagate: every costing already uses this rate"), and error states, as every data view needs.
- After confirming, the client sends the ticked costings in batches of 10, shows "Saving 10 of 23…", then closes and toasts "3 new versions created" or "3 created, 1 skipped" with a link to Saved Costings. Failed or stale rows stay in the dialog with their reason, and **Retry** re-runs only those. `propagationCounts` is decremented locally for each created or unchanged costing.
- The existing save toasts keep their copy ("Costings you already saved did not change." is still true, and `sprint5-rate-book-ui` and `rate-book-p1-features` pin it). The pill is the pointer to Propagate. The counts are refreshed with `getYarnRatePropagationCounts()` after each rate save so the pill appears at once.

## 3. Data flow

```
Edit rate (saveCostRate) -> Rate Book value changes; qualities already synced
   -> counts refreshed -> "Propagate · N" pill
Pill click -> previewYarnRatePropagation(rateId)   [read-only, recomputed server-side]
   -> owner reviews, unticks, confirms
   -> applyYarnRatePropagation (batches of 10)
        per costing: reload + guard -> rebuild estimate -> apply rate from DB
                     -> authoritative totals -> saveEstimatorQuoteV3
                     -> save_estimator_costing_revision_v2 (attested) -> v N+1
   -> toast + Saved Costings link; counts updated
```

## 4. Why batches of 10

The save path is several round trips per costing (replay lookup, template read, fingerprint, attestation RPC, revision RPC). Deployments run on Vercel in `bom1`; one action call over an owner's whole list could run long enough to time out and leave the owner unsure what was saved. Batching keeps each call short, gives real progress, and is safe to repeat because of the deterministic request ids.

## 5. Failure behaviour

- **Org locked, plan lapsed, or not an owner:** the first save fails closed; the batch stops and the dialog shows the message.
- **Costing edited in another tab, or a newer version already exists:** that row is `stale`. The owner reopens the pill, and the preview shows the current latest version.
- **Rate edited again while the dialog was open:** the whole apply is refused (rate `updated_at` mismatch) so versions are never created at a value the owner did not review.
- **Double click or lost response:** replays by request id return the original row; the result is `created` with `idempotentReplay`, not a duplicate version.
- **Partial success:** already-created versions stay. Nothing is rolled back. This matches how the estimator saves one costing at a time.

## 6. Copy and i18n

New strings in en, hi and gu (`lib/i18n/locales/*`, `lib/i18n/lite-phrases/rates.ts`, `lib/i18n/base-plan-phrases.ts` where it maps these): the pill, the dialog title and column headings, the create button, progress, the toast and skipped reasons, the empty state, and the changed save toast. Hindi and Gujarati run longer, so the pill, dialog rows and button wrap rather than truncate. Strings follow the Lite copy audit rules: no class-string constants that trip it.

## 7. Guided tour and guard tests

The Rate Book tour anchors to `data-ratebook-*` attributes. The new pill adds `propagateAction` but no step is added: tours are not shown on phones and the pill only exists after an edit. The Rate Book Guide gains one `GuideTopic` ("Propagate a new yarn rate") in the route's Guide modal, not a rail or inline disclosure. `__tests__/tour-real-page-guard.test.ts` and `phone-guidance-suppression.test.ts` must still pass.

## 8. Testing

- **Unit, `lib/yarn-rate-propagation.ts`.** `applyYarnRate` changes only matching rows of the right category and nothing else, ignores name case and spacing, leaves a row that already has the rate. `latestCostingPerLineage` picks the highest version, tie-breaks, and handles a missing `costing_group_id`. The request id is stable for the same inputs and differs when the source, rate or value differs.
- **Unit, eligibility.** Archived costing, archived quality, non-costing record kinds and older versions are excluded; a costing with no matching yarn is excluded; warp and weft entries of the same name are independent.
- **Server (action logic with a stubbed Supabase and stubbed `saveEstimatorQuoteV3`).** Preview recomputes totals from the database rate, not from the request. Apply refuses on rate `updated_at` mismatch, marks a changed source row `stale`, caps a call at 10, and maps `no_change` to `unchanged`.
- **Source-contract tests.** The Rate Book source renders `propagateAction` only for non-due, active cards with a positive count; the actions file checks the tier and owner role; no migration is added (assert none references propagation). Update `rate-book-costings-redesign.test.ts` and `sprint5-rate-book-ui.test.ts` deliberately if they assert the old toast copy.
- `npx tsc --noEmit`, `npm run lint` at zero warnings, and the touched test files. A signed-in visual check on QA is logged as pending, as usual. Do not run `npm run build` (it loads production env).

## Out of scope

- Propagating anything other than yarn rates (warping, sizing, overhead and similar Rate Book entries).
- Auto-propagation when a rate is saved.
- Re-costing older versions, or costings whose lineage is archived.
- Bulk propagation across several yarns at once; one yarn per pill.
- Changing Saved Quality syncing, which already happens on rate save.
- Fixing the Rate Book overhead mapping noted in the 2026-10-18 costing action spec.

## Open item for planning

Legacy costings with null `warp_rows` / `weft_rows` are rebuilt by `buildDraftStateFromQuote` from the flat columns (`yarn_rate_per_kg`, `beam_ends`, `ppi` and similar), which produces default row labels. They match only if that label equals the yarn name, so in practice they are excluded. The count query therefore selects those flat columns too, and the `snapshot_data` property in `SavedCostingStateRow` is not a database column (no migration creates it), so it is never selected.
