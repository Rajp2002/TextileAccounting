# Yarn Rate Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a yarn rate is edited in the Rate Book, a **Propagate · N** pill lets the owner review and create new versions of the saved costings that use that yarn, at the new rate.

**Architecture:** A pure module (`lib/yarn-rate-propagation.ts`) decides which costings are affected and rewrites only the matching yarn rows. Three server actions in a new `rates/propagation-actions.ts` count, preview and apply; apply re-uses `saveEstimatorQuoteV3` so attestation, the fabric guard, version numbering, replay and org-lock checks stay in one place. The Rate Book card gets the pill and a review dialog that saves in batches of 10. No migration.

**Tech Stack:** Next.js 16 server actions, React 19, Supabase (RLS client, no admin client), `decimal.js` costing engine in `lib/estimator.ts`, Vitest, Radix Dialog.

**Spec:** `docs/superpowers/specs/2026-10-18-yarn-rate-propagation-design.md`

## Global Constraints

- Lite and Base only: every action calls `requireRole(['owner'])` and `requireBaseTier` (capability `rate_book`). Org comes from the verified profile, never the request.
- The new rate is read from `cost_rate_book.current_value` inside each action. It is never accepted from the client.
- Earlier costing versions are never edited. New versions are saved as `status: 'draft'`; party name, quality label and warp/weft instructions carry over.
- Only the **latest** version of each lineage (`costing_group_id`, fallback `id`; highest `version_number`, then `created_at`, then `id`) is propagated. Archived costings and costings whose quality is inactive are skipped (the revision RPC sets `is_archived := false` on every new version).
- `yarn_warp` and `yarn_weft` rates are independent even when they share a name.
- At most **10** costings per `applyYarnRatePropagation` call (`PROPAGATION_BATCH_SIZE`).
- No `snapshot_data` in any select: it is not a database column.
- No migration. Do not run `npm run build`, `npm start`, `supabase db push` or any QA/production script (CLAUDE.md). Env files: never print values.
- New user-facing strings need en, hi and gu; layouts must wrap for longer Gujarati/Hindi text. Hindi/Gujarati are drafted here and logged as unreviewed.
- UI: explicit button (no row click, no `...` menu), controls 40px (44px on phones, `min-h-[44px]`), ink primary, saffron only for selected state, no nested cards, loading/empty/error states.
- Do not commit, push or deploy unless the owner asks (CLAUDE.md). Each task ends with a verification checkpoint; commit only if asked.

## Review Focus

Failure modes the spec implies; each has a test in the task that owns the code.

1. Same yarn name in warp and weft with separate Rate Book entries: editing the warp rate must not change weft rows (Task 1).
2. An archived costing, or one whose quality is inactive, must not be un-archived by a new version (Tasks 1 and 3).
3. Double click or lost response: the same save replays and creates no second version (Tasks 1 and 3).
4. A costing that cannot be priced (invalid snapshot, or rate `0` making it invalid) is reported as skipped and never fails the batch (Tasks 2 and 3).
5. The rate is edited again while the review dialog is open: nothing is saved at a value the owner did not see (Task 3).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/yarn-rate-propagation.ts` (create) | Pure: eligibility, latest-per-lineage, rewrite a yarn rate, price an estimate, deterministic request id, batching and result summary. No I/O. |
| `app/(dashboard)/owner/rates/propagation-actions.ts` (create) | `'use server'`: `getYarnRatePropagationCounts`, `previewYarnRatePropagation`, `applyYarnRatePropagation`. |
| `components/rates/PropagateYarnRateDialog.tsx` (create) | Review dialog: list with tick boxes, skipped section, batch driver, retry, empty/error states. |
| `app/(dashboard)/owner/rates/RatesClient.tsx` (modify) | `propagationCounts` state, pill on yarn cards, dialog mount. |
| `components/rates/RateBookTutorial.tsx` (modify) | One new Guide help topic. |
| `lib/i18n/lite-phrases/rates.ts` (modify) | hi/gu rows for the new strings. |
| `__tests__/yarn-rate-propagation.test.ts`, `__tests__/yarn-rate-propagation-actions.test.ts`, `__tests__/yarn-rate-propagation-ui.test.ts` (create) | Unit, action and source-contract tests. |

---

### Task 1: Pure propagation module

**Files:**
- Create: `lib/yarn-rate-propagation.ts`
- Test: `__tests__/yarn-rate-propagation.test.ts`

**Interfaces:**
- Consumes: `normalizeYarnName` (`lib/yarn-rate-reconciliation.ts`), `isSavedCostingArchived` (`lib/saved-costings.ts`), `buildCostingResult`, `calcFullTotals`, `type EstimateState` (`lib/estimator.ts`), `validateEstimatorSnapshot`, `requiresFactoryCapacity`, `getFirstEstimatorValidationMessage` (`lib/estimator-validation.ts`).
- Produces (all exported from `lib/yarn-rate-propagation.ts`):
  - `type YarnCategory = 'yarn_warp' | 'yarn_weft'`
  - `type CostingLineageKey = { id: string; costing_group_id: string | null; version_number: number | null; created_at: string; is_archived: boolean | null; template_id: string | null }`
  - `type PropagationLayerRef = { layer: 'warp' | 'weft'; index: number }`
  - `type PropagationCandidate = { id: string; qualityLabel: string; partyName: string | null; versionNumber: number; updatedAt: string; templateId: string | null; layers: PropagationLayerRef[] }`
  - `type PropagationPreviewItem = PropagationCandidate & { before: { productionCostPerM: number; sellingPricePerM: number }; after: { productionCostPerM: number; sellingPricePerM: number } }`
  - `type PropagationSkipped = { id: string; qualityLabel: string; reason: string }`
  - `type PropagationOutcome = { id: string; status: 'created' | 'unchanged' | 'stale' | 'failed'; versionNumber?: number; quoteId?: string; message?: string }`
  - `const PROPAGATION_BATCH_SIZE = 10`
  - `latestCostingPerLineage<T extends CostingLineageKey>(rows: readonly T[]): T[]`
  - `isCostingEligible(row: Pick<CostingLineageKey, 'is_archived' | 'template_id'>, activeTemplateIds: ReadonlySet<string>): boolean`
  - `findAffectedLayers(estimate: Pick<EstimateState, 'warpRows' | 'weftRows'>, category: YarnCategory, name: string, newRate: number): PropagationLayerRef[]`
  - `applyYarnRate(estimate: EstimateState, category: YarnCategory, name: string, newRate: number): EstimateState`
  - `priceEstimate(estimate: EstimateState): { productionCostPerM: number; sellingPricePerM: number } | null`
  - `buildPropagationRequestId(sourceQuoteId: string, rateId: string, newRate: number): string`
  - `chunkIds<T>(items: readonly T[], size?: number): T[][]`
  - `summarizeOutcomes(outcomes: readonly PropagationOutcome[]): { created: number; unchanged: number; stale: number; failed: number }`

- [ ] **Step 1: Write the failing tests** in `__tests__/yarn-rate-propagation.test.ts` (build rows with `makeDefaultEstimateState()`; copy the `warp()` / `weft()` helpers from `__tests__/yarn-rate-reconciliation.test.ts`):
  - `applyYarnRate changes only matching rows of the edited category`: estimate with warp `"75D Poly"` at 100 and weft `"75D Poly"` at 100; `applyYarnRate(est, 'yarn_warp', '75d  POLY', 120)` gives warp rate 120, weft rate still 100, and every other field deep-equals the input (Review Focus 1).
  - `applyYarnRate leaves the input untouched and returns it unchanged when no row matches` (`result.warpRows` equals input rows).
  - `findAffectedLayers skips a row that already has the new rate` (returns `[]`), and returns `[{layer:'warp',index:0}]` for a differing match.
  - `latestCostingPerLineage keeps the highest version per costing_group_id, tie-breaking by created_at then id, and treats a null group as its own id`.
  - `isCostingEligible is false for is_archived, for a template_id missing from the active set, and true for a costing with no template`.
  - `buildPropagationRequestId is a UUID, stable for equal inputs, and differs when the source, rate id or value differs` (assert with the UUID regex from `estimator/actions.ts`; Review Focus 3).
  - `priceEstimate returns null for an invalid snapshot and a positive production cost for the default priced estimate`; also `applyYarnRate(..., 0)` followed by `priceEstimate` returns either `null` or a number, never throws (Review Focus 4).
  - `chunkIds splits 23 ids into 10, 10, 3` and `summarizeOutcomes counts each status`.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/yarn-rate-propagation.test.ts`
Expected: FAIL, module `lib/yarn-rate-propagation` not found.

- [ ] **Step 3: Implement the module** with the signatures above. Approach notes: names compare through `normalizeYarnName`; `applyYarnRate` maps only the matching rows with `{ ...row, yarnRate: newRate }` and spreads the rest of the estimate; `latestCostingPerLineage` groups by `costing_group_id ?? id` and sorts by `(version_number ?? 1)` desc, `created_at` desc, `id` desc; `isCostingEligible` is `!isSavedCostingArchived(row, row.template_id ? { is_active: activeTemplateIds.has(row.template_id) } : null)`; `priceEstimate` validates with `validateEstimatorSnapshot(estimate, { requireTapeLength: false, requireCapacity: requiresFactoryCapacity(estimate, false) })` (as `saveEstimatorQuoteV3` does), returns `null` on any validation message or thrown error, else `buildCostingResult(estimate, calcFullTotals(estimate))` fields `productionCostPerM` and `suggestedSellingPricePerM`; `buildPropagationRequestId` uses `crypto.createHash('sha256').update(\`yarn-rate-propagation:${source}:${rateId}:${newRate.toFixed(6)}\`)` formatted exactly like `getInitialQualitySnapshotRequestId` (`xxxxxxxx-xxxx-5xxx-axxx-xxxxxxxxxxxx`).

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run __tests__/yarn-rate-propagation.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint:** `npx tsc --noEmit` clean for this file. Commit only if the owner asks.

---

### Task 2: Counts and preview actions (read-only)

**Files:**
- Create: `app/(dashboard)/owner/rates/propagation-actions.ts`
- Test: `__tests__/yarn-rate-propagation-actions.test.ts`

**Interfaces:**
- Consumes: everything produced by Task 1; `requireRole` (`lib/auth`), `createClient` (`lib/supabase/server`), `getCachedOrgTier` + `hasCapability(…, 'rate_book')`, `readAllPages` + `createdAtDescendingAfter` (`lib/paged-read`), `buildDraftStateFromQuote` (`lib/saved-costings`), `normalizeYarnName`.
- Produces:
  - `getYarnRatePropagationCounts(): Promise<{ data?: Record<string, number>; error?: string }>` (key = `cost_rate_book.id`)
  - `previewYarnRatePropagation(rateId: string): Promise<{ data?: { rateUpdatedAt: string; rateName: string; rateValue: number; category: YarnCategory; items: PropagationPreviewItem[]; skipped: PropagationSkipped[] }; error?: string }>`
  - internal (not exported, `'use server'` files export only async functions): `loadAffected(supabase, orgId, rate)` returns `{ candidates, skipped, rows }`, used by Task 3 through a second file-local call, so keep it in this file.

- [ ] **Step 1: Write the failing tests** in `__tests__/yarn-rate-propagation-actions.test.ts`. `vi.mock('@/lib/auth')` (owner profile with `org_id`), `vi.mock('@/lib/supabase/server')` returning a table-keyed fake whose `from(table)` returns a thenable builder supporting `select/eq/in/or/order/limit/maybeSingle` over arrays declared in the test, and `vi.mock('@/lib/subscription')` / `subscription-access` so the tier check passes or fails per test. Cases:
  - `counts only the latest active version that uses the yarn at a different rate`: costing group A has v1 (old rate) and v2 (rate 100 on `"75D Poly"`), group B archived, group C on an inactive quality, group D with no such yarn; Rate Book has `"75D Poly"` warp = 120. Expect `{ [rateId]: 1 }` and that group B/C are not counted (Review Focus 2).
  - `a yarn rate with no affected costing is absent from the counts or 0`.
  - `counts returns the tier error and reads nothing when the plan lacks rate_book`.
  - `preview recomputes before/after from the database rate`: the request has only `rateId`; `after.productionCostPerM` differs from `before` and uses 120; `rateUpdatedAt` equals the rate row's `updated_at`.
  - `preview lists an unpriceable costing in skipped with a plain reason and still returns the others` (Review Focus 4).
  - `preview rejects an invalid or other-org rate id` (UUID check; fake returns no row).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/yarn-rate-propagation-actions.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement** the two actions. Approach: reading the whole lineage list is two-step. (1) Page `estimator_quotes` for `id, costing_group_id, version_number, created_at, is_archived, template_id, updated_at` with `record_kind = 'costing'`, `org_id`, ordered `created_at desc, id desc`, via `readAllPages` (page size 500, same loop as `getEstimatorQuotes` in `estimator/actions.ts`), reduce with `latestCostingPerLineage`, drop non-eligible rows using the org's active `estimator_templates` ids. (2) For the remaining ids fetch in chunks of 100 `.in('id', chunk)` the columns `id, quality_label, party_name, warp_rows, weft_rows, beam_ends, reed_space, weft_denier, yarn_denier, yarn_rate_per_kg, ppi` for counts, and `*` for preview. Rebuild each with `buildDraftStateFromQuote`, then `findAffectedLayers` against the rate's `category`, `name`, `current_value`. Counts iterate every active `yarn_warp` / `yarn_weft` rate from `cost_rate_book` against the already-loaded estimates (one pass, no per-rate refetch). Preview fills `before` with `priceEstimate(estimate)` and `after` with `priceEstimate(applyYarnRate(...))`; either `null` moves the costing to `skipped` with reason "This costing can't be priced with the new rate." Archived Rate Book rows and non-yarn categories return an empty result.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run __tests__/yarn-rate-propagation-actions.test.ts __tests__/yarn-rate-propagation.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint:** `npx tsc --noEmit` clean. Commit only if asked.

---

### Task 3: Apply action (writes)

**Files:**
- Modify: `app/(dashboard)/owner/rates/propagation-actions.ts`
- Test: `__tests__/yarn-rate-propagation-actions.test.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2 items; `saveEstimatorQuoteV3` from `@/app/(dashboard)/owner/estimator/actions` (params: `clientRequestId, partyName, qualityLabel, warpInstruction, weftInstruction, estimate, totalProductionCostPerM, quotePricePerM, status, recordKind, sourceQuoteId, expectedSourceUpdatedAt, templateId, expectedTemplateUpdatedAt`; returns `{ success, quoteId, versionNumber, noChange, idempotentReplay }` or `{ error }`), `setAuditActor` pattern from `rates/actions.ts` (copy the small helper; do not export it from a `'use server'` file).
- Produces: `applyYarnRatePropagation(input: { rateId: string; expectedRateUpdatedAt: string; costings: { id: string; expectedUpdatedAt: string }[] }): Promise<{ data?: { outcomes: PropagationOutcome[] }; error?: string }>`

- [ ] **Step 1: Write the failing tests** (same mocks, plus `vi.mock('@/app/(dashboard)/owner/estimator/actions')` exposing a `saveEstimatorQuoteV3` spy):
  - `refuses with "This rate changed since you opened the review. Reopen Propagate." when expectedRateUpdatedAt differs, and calls save zero times` (Review Focus 5).
  - `refuses more than 10 costings in one call` and `refuses an empty list`.
  - `saves each costing with sourceQuoteId, expectedSourceUpdatedAt, templateId, status draft, the deterministic request id, and the database rate in the estimate`: assert the spy's argument `estimate.warpRows[0].yarnRate === 120` and `clientRequestId === buildPropagationRequestId(id, rateId, 120)`; totals passed equal `priceEstimate(...)` values.
  - `marks a costing stale without saving when its updated_at no longer equals expectedUpdatedAt, when a newer version exists, or when it became archived` (Review Focus 2).
  - `maps noChange to unchanged, idempotentReplay to created, and a save error to failed with the message, and continues with the remaining costings`.
  - `stops the batch and returns the message when the save error is an org-lock or plan error` (messages containing "locked" or "subscription").

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/yarn-rate-propagation-actions.test.ts`
Expected: FAIL, `applyYarnRatePropagation` is not a function.

- [ ] **Step 3: Implement `applyYarnRatePropagation`.** Approach: validate UUIDs and the 1..10 size; re-read the rate and compare `updated_at` with `expectedRateUpdatedAt`; call `loadAffected` for just the requested ids so the same eligibility rules apply at write time (a requested id that is no longer in the result is `stale`); for each remaining costing, fetch the active template's `updated_at` when it has a `template_id`, rebuild with `buildDraftStateFromQuote`, `applyYarnRate`, `priceEstimate`, then `await saveEstimatorQuoteV3(...)` sequentially. Call `revalidatePath('/owner/quotes')` and `revalidatePath('/owner/rates')` once at the end. Do not accept a rate value from the caller.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run __tests__/yarn-rate-propagation-actions.test.ts`
Expected: PASS.

- [ ] **Step 5: Checkpoint:** read the `save_estimator_costing_revision_v2` branch in `supabase/migrations/20260801174038_sprint1_save_trust_v2.sql` (around the `p_expected_template_updated_at` check) and confirm the test passes the template timestamp that branch needs; `npx tsc --noEmit`. Commit only if asked.

---

### Task 4: Pill, review dialog and Rate Book wiring

**Files:**
- Create: `components/rates/PropagateYarnRateDialog.tsx`
- Modify: `app/(dashboard)/owner/rates/RatesClient.tsx` (imports near line 46; `renderYarnCard` action row near line 1405; the usage effect near line 754; rate-save success paths near lines 880 and 975)
- Test: `__tests__/yarn-rate-propagation-ui.test.ts`

**Interfaces:**
- Consumes: Tasks 1 to 3 (`getYarnRatePropagationCounts`, `previewYarnRatePropagation`, `applyYarnRatePropagation`, `chunkIds`, `summarizeOutcomes`, types via `import type`), `Dialog`/`Sheet` primitives, `Button`, `toast`, `useTranslation`.
- Produces: `PropagateYarnRateDialog(props: { rate: CostRateRow | null; onOpenChange: (open: boolean) => void; onApplied: (rateId: string, resolvedCount: number) => void }): JSX.Element`. Calls `previewYarnRatePropagation(rate.id)` when opened; `onApplied` receives how many costings became `created` or `unchanged`, so `RatesClient` lowers that card's count.

- [ ] **Step 1: Write the failing source-contract tests** in `__tests__/yarn-rate-propagation-ui.test.ts` (style of `rate-book-quick-edit.test.ts`: `readFileSync`, `toContain`):
  - `RatesClient renders data-ratebook-field="propagateAction" only inside the non-due, non-archived card branch, gated on propagationCounts[rate.id] > 0`.
  - `RatesClient calls getYarnRatePropagationCounts in the secondary usage effect and again after a successful saveCostRate`.
  - `the existing "Costings you already saved did not change." toast copy is unchanged`.
  - `PropagateYarnRateDialog uses Dialog, DialogFooter, never a row onClick or a menu`, `contains PROPAGATION_BATCH_SIZE-based chunking via chunkIds`, `has min-h-[44px] and whitespace-normal on its buttons`, and `has loading, empty, error and skipped states`.
  - `the actions file calls requireRole(['owner']) and requireBaseTier in all three actions` (count occurrences = 3).
  - `no migration mentions propagation` (list `supabase/migrations`, none matches `/propagat/i`).

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/yarn-rate-propagation-ui.test.ts`
Expected: FAIL.

- [ ] **Step 3: Build `PropagateYarnRateDialog.tsx`.** Behaviour (copy and layout fixed by the spec): title "Propagate {yarn} at ₹{rate}/kg"; one row per item showing quality or party name, "v{N} → v{N+1}" (`versionNumber` and `+ 1`), production cost per metre and selling price per metre as "before → after", and the changed layers ("Warp 1", "Weft 2"); every row ticked by default with a checkbox the owner can clear; a skipped section with reasons; primary button "Create {N} new versions" (disabled at 0, shows "Saving {done} of {N}…" while running); empty state "Nothing to propagate: every costing already uses this rate". Saving sends `chunkIds(ticked, PROPAGATION_BATCH_SIZE)` to `applyYarnRatePropagation` one batch at a time with `expectedRateUpdatedAt` from the preview. On finish, `summarizeOutcomes` drives the toast ("3 new versions created" or "3 created, 1 skipped") with a link to `/owner/quotes`; `stale` and `failed` rows stay listed with their message and a **Retry** that re-runs only those. A rate-changed error closes the review and asks the owner to reopen it. On phones use the existing `Sheet` pattern the Rate Book already uses for its dialogs. Format money with the helpers `RatesClient` already imports.

- [ ] **Step 4: Wire `RatesClient`.** Add `const [propagationCounts, setPropagationCounts] = useState<Record<string, number>>({})` and `const [propagateRate, setPropagateRate] = useState<CostRateRow | null>(null)`. Fill the counts inside the existing `getCostRateUsage` effect (sample ids are skipped like the usage mapping does) and refresh them after the two `saveCostRate` success paths. In `renderYarnCard`, inside the `!archived` branch and only when `!due` and `propagationCounts[rate.id] > 0`, add an outline `Button` next to **Edit rate**: label "Propagate · {N}", `data-ratebook-field="propagateAction"`, `onClick={() => setPropagateRate(rate)}`, `className={secondaryAction}`. Mount `<PropagateYarnRateDialog rate={propagateRate} onOpenChange={open => !open && setPropagateRate(null)} onApplied={...} />` once, beside the other dialogs. Do not use `tourSurfaceProps`/sample data for it: the pill never shows on sample yarns.

- [ ] **Step 5: Run to verify pass**

Run: `npx vitest run __tests__/yarn-rate-propagation-ui.test.ts __tests__/sprint5-rate-book-ui.test.ts __tests__/rate-book-p1-features.test.ts __tests__/rate-book-costings-redesign.test.ts __tests__/tour-real-page-guard.test.ts`
Expected: PASS (fix any contract test that asserts the card's action row exactly, deliberately).

- [ ] **Step 6: Checkpoint:** `npx tsc --noEmit`, `npm run lint` (zero warnings). Commit only if asked.

---

### Task 5: Copy, Guide topic and final verification

**Files:**
- Modify: `lib/i18n/lite-phrases/rates.ts`, `components/rates/RateBookTutorial.tsx`
- Test: `__tests__/yarn-rate-propagation-ui.test.ts`

**Interfaces:**
- Consumes: the English strings used in Task 4. Phrase rows are `[English as rendered, Hindi, Gujarati]` with `{0}`, `{1}` placeholders.
- Produces: phrase rows for each string below, and a Guide help topic `propagate` in `rateBookHelpCopy` for `en`, `hi`, `gu`.

- [ ] **Step 1: Write the failing tests** in `__tests__/yarn-rate-propagation-ui.test.ts`: every English string below appears in `RATE_BOOK_PHRASES` with non-empty, different Hindi and Gujarati; each of `rateBookHelpCopy.en/hi/gu.fields` has a `propagate` entry; and `__tests__/lite-translation-coverage.test.ts` and `lite-plan-copy-regression.test.ts` still pass.
  Strings: "Propagate · {0}", "Propagate {0} at ₹{1}/kg", "Create {0} new versions", "Saving {0} of {1}…", "{0} new versions created", "{0} created, {1} skipped", "Nothing to propagate: every costing already uses this rate", "This costing can't be priced with the new rate.", "This rate changed since you opened the review. Reopen Propagate.", "Retry", "Review before saving", "Skipped".

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run __tests__/yarn-rate-propagation-ui.test.ts __tests__/lite-translation-coverage.test.ts`
Expected: FAIL on the missing phrase rows and help topic.

- [ ] **Step 3: Add the phrase rows and the Guide topic.** Draft Hindi and Gujarati in the style of the neighbouring rows; add the topic "Propagate a new yarn rate" (what the pill does, that old versions stay, that the owner reviews before saving) to the Rate Book Guide as a help topic, not a rail or inline disclosure. The help topics list grows from six to seven, so update the assertions in `__tests__/rate-book-tutorial.test.ts` and any test that counts them.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run __tests__/yarn-rate-propagation.test.ts __tests__/yarn-rate-propagation-actions.test.ts __tests__/yarn-rate-propagation-ui.test.ts __tests__/rate-book-tutorial.test.ts __tests__/lite-translation-coverage.test.ts __tests__/lite-plan-copy-regression.test.ts __tests__/phone-guidance-suppression.test.ts __tests__/tour-real-page-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Final verification**

Run: `npx tsc --noEmit`, then `npm run lint`. Then `npx vitest run` for the whole suite once (about the baseline count plus the new files; the one skipped test is the live Supabase test).
Expected: tsc clean, lint 0 errors and 0 warnings, all tests pass. Do not run `npm run build`.

- [ ] **Step 6: Log what was not verified** in the final report: no signed-in check on QA with real data (QA database is unreliable here), Hindi/Gujarati copy unreviewed, and the revision RPC's template-timestamp branch confirmed only by reading the migration. Offer to commit when asked.
