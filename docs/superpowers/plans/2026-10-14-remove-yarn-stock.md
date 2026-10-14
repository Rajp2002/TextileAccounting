# Remove Yarn Stock and Stock Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete two Base features completely, data included:
- **Yarn Stock.** Afterwards nothing tracks, adds, updates or shows yarn stock. That means no page, no navigation, no tour, no yarn deduction when production is recorded, and no yarn gate when a quality is activated.
- **Stock (Inventory) Audit.** It goes with all its draft and finalized audits.

**Architecture:**
- One new migration does all the database work:
  - It rewrites the three shared functions that touch yarn stock (production reconcile, quality activation, dispatch) as yarn-free versions.
  - It drops every yarn-stock and audit function, the five yarn tables, the two audit tables, and the two production-lot tables that existed only to estimate yarn inside fabric.
  - It drops the yarn column on `base_production_jobs`.
- App code then removes:
  - the two routes and their actions, libs, copy and tour
  - the activation gate
  - the "Audit Inventory" button on Fabric Stock
  - the export entries
- `/owner/stock/yarn` and `/owner/stock/audit` are added to the archived-route list, so old links land on `/feature-archived`.

**Tech Stack:** Next.js 16 App Router, Supabase Postgres (plpgsql RPCs), Vitest (source-contract tests + `npm run test:db` on disposable PostgreSQL), i18n en/hi/gu.

**Spec:** No separate spec. Owner's instructions on 2026-10-14:
- Delete the entire yarn stock feature, including its data; nothing about it is kept.
- The inventory audit is deleted too.

---

## What the features are today (analysis)

**Yarn Stock.** This is the September 2026 ledger (`20260912131633_yarn_stock_until_dispatch.sql`). `20260920000000_unified_inventory_audit_architecture.sql` later changed it from "deduct at dispatch" to "deduct at production" and added the audit. It is **not** the Yarn Rate Book, the estimator's yarn inputs, or `estimator-yarn-suggestions`. Those are costing and stay.

**Stock Audit.** This is `/owner/stock/audit`, opened from the "Audit Inventory" button on Fabric Stock. Built in 20260920, then repaired in `20260926132159`, `20260926132310` and `20260930150000`.

| Layer | Pieces |
| --- | --- |
| Yarn tables | `yarn_stock_settings`, `yarn_stock`, `yarn_stock_recipes`, `yarn_stock_requests`, `yarn_stock_movements` |
| Audit tables | `inventory_audits`, `inventory_audit_lines` |
| Yarn-embodiment tables and columns | `production_stock_lots` (only created alongside a yarn deduction; carries `yarn_consumption_snapshot`; read only by the audit), `delivery_challan_lot_allocations` (FIFO allocation of dispatches against those lots), `base_production_jobs.yarn_recipe_snapshot` |
| Functions to drop | Yarn: `public.mutate_yarn_stock`, `public.get_yarn_stock_board`, `public.validate_quality_activation_yarn`, `private.yarn_costing_recipe`, `private.move_dispatch_yarn_stock` (its trigger was already dropped in 20260920). Audit: `public.get_inventory_audit_data(date, uuid)`, `public.create_inventory_audit_draft(date, text, text)`, `public.record_inventory_audit_count(uuid, text, uuid, numeric, text)`, `public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text, numeric)`, `public.finalize_inventory_audit(uuid)` |
| Shared functions to rewrite | `private.reconcile_quality_stock` (latest: 20260920) takes yarn off stock for every production delta. It **raises "Insufficient yarn stock", so production entry fails**, when a recipe exists and stock is short, and it also creates lots. `public.activate_saved_costing_for_production` (latest: 20260920) **blocks activation** unless every recipe yarn has stock, and writes `yarn_stock_recipes` / `yarn_recipe_snapshot`. `public.mutate_delivery_challan` (latest: 20260926132412) allocates and restores lots |
| Yarn route + actions | `app/(dashboard)/owner/stock/yarn/page.tsx`, `YarnStockClient.tsx`, `yarn-actions.ts`; the yarn branch in `error.tsx`; `revalidatePath('/owner/stock/yarn')` in `dispatches/challan-actions.ts:114` |
| Audit route + lib | `app/(dashboard)/owner/stock/audit/{page.tsx,InventoryAuditClient.tsx,actions.ts}`, `lib/inventory-audit.ts`; the "Audit Inventory" link at `QualityStockClient.tsx:163-168` (`qualityStock.audit` key); `components/navigation/owner-route-loading.tsx:31,58-62`; `components/navigation/page-title-layout.ts:3`; `lib/route-milestones.ts:3` |
| Production UI | `BaseActiveQualities.tsx` yarn gate modal + inline "Add Yarn Stock" (imports `mutateYarnStock`); `production/actions.ts:633` `validateQualityActivationYarnAction` + `result.blocked` handling in `activateSavedCostingForProduction` |
| Export | `app/(dashboard)/owner/settings/data-export.ts:313-317, 322, 325-327` (five yarn tables, lots, allocations, two audit tables); `__tests__/lite-archive-completeness.test.ts:113,165,196` |
| Libs | `lib/yarn-stock.ts`, `lib/i18n/yarn-stock.ts`, `lib/stock-navigation.ts` (yarn destination), `lib/disclosure-navigation.ts` (Stock disclosure group), `lib/mobile-workflow-navigation.ts`, `lib/route-milestones.ts`, `lib/stock-activity.ts` (`lastsFor` is yarn-only) |
| Tour | `'yarn-stock'` in `lib/tours/tour-types.ts`, `tour-registry.ts`, `lib/i18n/tour-invitations.ts`; yarn steps in `lib/stock-tour.ts`; yarn copy in `lib/i18n/stock-tutorial.ts`; yarn sample in `lib/tours/sample-data/stock.ts`; `components/stock/StockGuidedTour.tsx` and `StockSampleWorkspace.tsx`; production tour copy in `lib/i18n/production-tutorial.ts` (prereq and activate steps). The audit has no tour |
| Copy | `navigation.yarn`, `navigation.yarnStock`, `qualityStock.audit`, and the whole `stockAudit` block in `lib/i18n/locales/{en,hi,gu}.ts`; `components/landing/plans.tsx:43` "Fabric and yarn stock" (+ `lib/i18n/public-pages/hi.json:140`); `AccountantCsvExports.tsx:82` + `lib/i18n/lite-phrases/account.ts:441` |
| Type-checked non-app code | `docs/guided-tours/harness/{main.tsx,showcase.ts,run-tour.mjs,batch.sh,labels.json}`, `scripts/qa/navigation-browser/main.tsx`, `scripts/qa/yarn-browser/*`, `scripts/qa/yarn-stock-db-scenarios.mjs`. tsconfig includes every `**/*.ts(x)` outside `supabase/`, so leaving these breaks `tsc` |
| Docs | `docs/features/yarn_inventory.md`, `docs/guided-tours/pages/yarn-stock.md`, `docs/guided-tours/pages/stock-audit.md`, `docs/guided-tours/tasks/GT-09-yarn-stock.md`, plus mentions in `docs/general/MASTER_PRODUCT_DOCUMENT.md`, `docs/guided-tours/*`, `docs/navigation-reorganization/stock-sidebar-implementation.md` |
| Tests to delete | `yarn-stock.test.ts`, `inventory-audit.test.ts`, `stock-audit-page.test.tsx`, `stock-audit-figures.test.ts`, `stock-audit-adjustment-rollout.test.ts`, `db/inventory-audit.dbtest.ts`, `db/inventory-audit-date-and-adjustment.dbtest.ts` |
| Tests to update | `stock-tour.test.tsx` (lines 101-114 assert the audit button and audit page), `stock-dispatch-redesign.test.tsx`, `stock-activity.test.ts`, `stock-navigation.test.ts`, `disclosure-navigation.test.ts`, `navigation-disclosure.test.tsx`, `mobile-workflow-navigation.test.ts`, `tour-program-consistency.test.ts`, `tour-data-safety-contract.test.ts`, `tour-real-page-guard.test.ts`, `tour-i18n-parity.test.ts`, `guided-tour-guide-placement.test.ts`, `lite-archive-completeness.test.ts`, `phase1-scope.test.ts`, `db/delivery-challans.dbtest.ts` (only if it asserts lot allocations) |

**Kept on purpose:**
- **Past audit adjustments in the fabric ledger.** These are `quality_stock_movements` rows of kind `audit_adjustment`. They are fabric stock history, and Fabric Stock sums them into today's balance. Deleting them would silently change every audited quality's metres. They stay, along with the `audit_adjustment` kind, its "Audit adjustment" label (`lib/i18n/locales/*:399`) and `lib/quality-stock.ts` handling, so old rows still read correctly in Fabric Stock history. No new ones can be created.

**Not touched:**
- Old migration files. They are history; the new migration undoes them.
- `scripts/qa/challan-payment-terms-regression.mjs`. It reads the old 20260920 file, which stays.
- Tracked QA evidence in `output/`, `outputs/`, `qa-artifacts/`, `audits/`. Its manifests carry hashes; never edit it.
- Rendered videos `public/videos/features/production.*`. They need re-recording.
- `/owner/settings/audit`. That is the activity log, a different and already-archived feature.
- The older, already-hidden April "yarn & beam inventory" module: `yarn_lots`, `yarn_movements`, `yarn_batches`, `order_yarn_requirements`, beam cards, `lib/schemas.ts` `Yarn*Schema`, and the `inventory.*` locale keys. Removing it would be a separate change.

## Global Constraints

- **Irreversible once applied.** The migration permanently deletes every org's yarn stock records, lots, lot allocations, and all stock audits.
- Migrations are files only. Never run `supabase db push`, `db pull`, `migration repair`, `functions deploy`, or `db reset --linked`; the CLI is linked to production.
- Deploy order: the owner applies the migration first, then deploys promptly.
  - Between the two, the old client's Yarn Stock and Stock Audit pages error, because their RPCs are gone.
  - Its pre-activation yarn check also fails, but activation still works: `handleActivateCosting` falls through to activation when the check fails.
  - The reverse order would leave production entry blocked by the database yarn deduction until the migration lands.
- Never run `npm run build` / `npm start`; they load the production env.
- Every rewritten SECURITY DEFINER function keeps its current `SET search_path = pg_catalog, public, private` and its `auth.uid()`-derived org. It re-issues the same `REVOKE ALL ... FROM PUBLIC, anon, authenticated, service_role` / `GRANT EXECUTE ... TO authenticated` as its latest migration. Wrap the migration in `BEGIN; ... NOTIFY pgrst, 'reload schema'; COMMIT;`.
- A rewritten function body is its latest version minus the yarn and lot parts. No other behaviour change.
- New or changed user-facing strings need en, hi, gu.
- `npm run lint` stays at 0 warnings, and `npx tsc --noEmit` stays clean.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Don't push or open a PR unless asked.

## Review Focus

1. **Production entry for an owner who had linked a yarn recipe** (daily sheet, supervisor sheet, corrections) must save with no yarn error. Test: Task 1 `production for a quality that had a yarn recipe saves`.
2. **A downward production correction** reverses fabric with no error. Test: Task 1 `downward production correction succeeds`.
3. **Cancelling a dispatch issued before the migration**, which had lot allocations, restores fabric with no error. Test: Task 1 `cancelling an issued dispatch restores fabric`.
4. **Fabric balances don't move.** A quality that had an audit adjustment keeps the same `quality_stock.meters`, and its `audit_adjustment` movement is still in its history. Test: Task 1 `audited fabric keeps its balance and history`.
5. **Bookmarked or PWA-cached `/owner/stock/yarn` and `/owner/stock/audit`** land on `/feature-archived`, not on a 404/500. Test: Task 4 `phase1-scope` assertions.

---

### Task 1: Delete yarn stock and the stock audit from the database

**Files:**
- Create: `supabase/migrations/20261014120000_remove_yarn_stock_and_stock_audit.sql`
- Create: `__tests__/db/yarn-stock-and-audit-removed.dbtest.ts`
- Create: `__tests__/yarn-stock-and-audit-removed-migration.test.ts` (source contract)
- Delete: `__tests__/db/inventory-audit.dbtest.ts`, `__tests__/db/inventory-audit-date-and-adjustment.dbtest.ts`
- Modify: `__tests__/db/delivery-challans.dbtest.ts` (only if it asserts lots)

**Interfaces:**
- Produces: `activate_saved_costing_for_production` never returns `blocked`. `mutate_delivery_challan` keeps its signature. No yarn or audit RPC exists.

- [ ] **Step 1: Write the source-contract test.** It reads the migration file and asserts:
  - `DROP FUNCTION IF EXISTS` for the ten functions listed in the analysis table, with exact signatures. `private.yarn_costing_recipe(jsonb)` is dropped last.
  - `DROP TABLE IF EXISTS` for `public.inventory_audit_lines`, `public.inventory_audits`, `public.delivery_challan_lot_allocations`, `public.production_stock_lots`, `public.yarn_stock_movements`, `public.yarn_stock_requests`, `public.yarn_stock_recipes`, `public.yarn_stock`, `public.yarn_stock_settings`. None of them uses `CASCADE`, so a missed dependency fails loudly.
  - `ALTER TABLE public.base_production_jobs DROP COLUMN IF EXISTS yarn_recipe_snapshot`.
  - `CREATE OR REPLACE FUNCTION` for exactly three functions: `private.reconcile_quality_stock`, `public.activate_saved_costing_for_production`, `public.mutate_delivery_challan`.
  - With `--` comments and the DROP statements stripped, the text matches none of `/yarn_stock/`, `/production_stock_lots/`, `/lot_allocations/`, `/yarn_recipe_snapshot/`, `/yarn_costing_recipe/`, `/inventory_audit/`.
  - Each `CREATE OR REPLACE FUNCTION` block has a `SET search_path` and is followed by a `REVOKE ALL ON FUNCTION`.
- [ ] **Step 2: Write the DB test.**
  - Setup: use `freshDatabase`, `seedOwnerOrg(db, { tier: 'base' })`, `asUser`, `asSuperuser` and `pgError` from `./helpers`. Recording production follows `production-parity.dbtest.ts`; dispatches follow `delivery-challans.dbtest.ts`; fabric opening uses `record_quality_stock_adjustment` (see the deleted `inventory-audit.dbtest.ts`).
  - `yarn and audit objects are gone`: `to_regclass` is null for all nine tables, `to_regprocedure` is null for all ten functions, and `information_schema.columns` has no `base_production_jobs.yarn_recipe_snapshot`.
  - `activation needs no yarn stock`: activating a saved costing whose yarns have positive weights returns `success: true` and has no `blocked` key.
  - `production for a quality that had a yarn recipe saves`: activate, then record 50 m of production. It succeeds, and `quality_stock.meters` goes up by 50.
  - `downward production correction succeeds`: then correct production down by 20 m. Fabric goes down by 20.
  - `cancelling an issued dispatch restores fabric`: confirm a dispatch, then run its reversal action. Fabric returns to its earlier balance.
  - `audited fabric keeps its balance and history`: as superuser, insert an `audit_adjustment` `quality_stock_movements` row and the matching `quality_stock.meters`. Run any production reconcile. Meters equal the opening plus the adjustment plus production, and the movement still exists.
- [ ] **Step 3: Run both and check they fail.** `npx vitest run __tests__/yarn-stock-and-audit-removed-migration.test.ts` fails because the file is missing. `npm run test:db -- yarn-stock-and-audit-removed` fails because the objects still exist.
- [ ] **Step 4: Write the migration.** Start with a header comment: removal ordered by the owner 2026-10-14, irreversible, apply before deploying the app; past fabric `audit_adjustment` movements are kept because they are part of fabric balances. Then, in this order:
  1. `private.reconcile_quality_stock(uuid, text, text)`: the 20260920 body without the recipe lookup, both yarn branches, and the lot creation and decrement. Keep unchanged: the advisory lock, the cutover insert, the `quality_stock` upsert from `private.quality_production_totals`, the negative-balance check, the `quality_stock` update, and the `quality_stock_movements` insert.
  2. `public.activate_saved_costing_for_production(uuid)`: the 20260920 body without the validation call, `v_recipe`, the `yarn_recipe_snapshot` update and insert column, and the `yarn_stock_recipes` sync.
  3. `public.mutate_delivery_challan(uuid, uuid, integer, text, jsonb)`: the 20260926132412 body without the FIFO allocation loop (~75–92), the "Restore allocated production lots" block (~143–149), and their now-unused `DECLARE` variables.
  4. Re-issue REVOKE/GRANT for 1–3 exactly as their latest migrations do.
  5. Drop the ten functions, with `yarn_costing_recipe` last.
  6. Drop the nine tables, in the order listed in Step 1.
  7. Drop the `yarn_recipe_snapshot` column.
  8. Leave the `quality_stock_movements` kind CHECK alone: `audit_adjustment` stays valid for existing rows.
- [ ] **Step 5: Delete the two audit DB test files.** Remove any lot-allocation assertions from `delivery-challans.dbtest.ts`.
- [ ] **Step 6: Run and check they pass.** `npx vitest run __tests__/yarn-stock-and-audit-removed-migration.test.ts` passes, and `npm run test:db` passes in full.
- [ ] **Step 7: Commit.** `git add supabase/migrations/20261014120000_remove_yarn_stock_and_stock_audit.sql __tests__/yarn-stock-and-audit-removed-migration.test.ts __tests__/db/`, with the message `Delete yarn stock and the stock audit from the database`.

### Task 2: Remove the yarn gate from quality activation

**Files:**
- Modify: `app/(dashboard)/owner/production/actions.ts`. Delete `validateQualityActivationYarnAction` (~633–660) and the `result.blocked` branch in `activateSavedCostingForProduction`.
- Modify: `app/(dashboard)/owner/production/BaseActiveQualities.tsx`. Delete `YarnRequirementItem`, `yarnGateModal`, `inlineAddYarn`, `handleSaveInlineYarn`, the two dialogs (~841–1005), and the `mutateYarnStock` and `validateQualityActivationYarnAction` imports. `handleActivateCosting` then calls `activateSavedCostingForProduction` directly.
- Modify: `lib/i18n/production-tutorial.ts`: the `prereq` title, body and detail, and `activate.detail`, in en, hi and gu.
- Test: `__tests__/production-activation-no-yarn.test.ts` (new source contract)

**Interfaces:**
- Consumes: Task 1.
- Produces: `activateSavedCostingForProduction(input: { costingId: string })` returns either `{ success: true, job_id, quality_label, already_active }` or the `databaseError` shape.

- [ ] **Step 1: Write the failing contract test.** It asserts:
  - `BaseActiveQualities.tsx` doesn't contain `yarn-actions`, `validateQualityActivationYarnAction`, `yarnGateModal` or `Yarn required before production`.
  - `production/actions.ts` doesn't contain `validate_quality_activation_yarn` or `result.blocked`. Match the exact tokens, because the file also has an unrelated `blockedWorkerIds`.
  - In each language, `prereq.body` doesn't mention yarn stock: en doesn't match `/yarn/i`; hi doesn't contain `धागे का स्टॉक` or `यार्न स्टॉक`; gu doesn't contain `યાર્ન સ્ટોક`.
- [ ] **Step 2: Run it.** `npx vitest run __tests__/production-activation-no-yarn.test.ts` fails.
- [ ] **Step 3: Make the code changes.** The new en copy:
  - prereq title: "Three things must exist first"
  - prereq body: "A saved costing, your machines, and your workers."
  - prereq detail: "Costings come from the Cost Estimator, and machines and workers from their own pages."
  - `activate.detail` is removed.
  - Translate hi and gu in the register of the entries around them.
- [ ] **Step 4: Run the tests.** The new test, `npx vitest run -t production` and `__tests__/tour-i18n-parity.test.ts` pass.
- [ ] **Step 5: Commit** with the message `Activate a quality without checking yarn stock`.

### Task 3: Delete the Stock Audit page

**Files:**
- Delete: `app/(dashboard)/owner/stock/audit/` (page, client, actions), `lib/inventory-audit.ts`, `__tests__/inventory-audit.test.ts`, `__tests__/stock-audit-page.test.tsx`, `__tests__/stock-audit-figures.test.ts`, `__tests__/stock-audit-adjustment-rollout.test.ts`
- Modify: `app/(dashboard)/owner/stock/QualityStockClient.tsx:163-168`: remove the "Audit Inventory" button, plus the `ClipboardCheck` and `Link` imports if they are now unused.
- Modify: `lib/i18n/locales/{en,hi,gu}.ts`: delete the `stockAudit` block and `qualityStock.audit`. Grep each first. Keep `audit_adjustment` at ~399.
- Modify: `components/navigation/owner-route-loading.tsx`: remove the `/owner/stock/audit` title entry and the `isStockAudit` branch (~31, 58–62).
- Modify: `components/navigation/page-title-layout.ts:3` and `lib/route-milestones.ts:3`: remove `/owner/stock/audit`.
- Modify: `lib/phase1-scope.ts`: add `'/owner/stock/audit'` to `PHASE_1_ARCHIVED_ROUTES`.
- Test: `__tests__/stock-tour.test.tsx:101-114`, `__tests__/phase1-scope.test.ts`, `__tests__/mobile-workflow-navigation.test.ts:50`

**Interfaces:**
- Produces: no `/owner/stock/audit` route, and no `lib/inventory-audit` module.

- [ ] **Step 1: Update the tests first.**
  - `stock-tour.test.tsx`: the live Fabric Stock client doesn't contain `/owner/stock/audit` or `tx('audit')`. Remove the audit-page and audit-label assertions. Drop `'audit'` from the live-control key list.
  - `phase1-scope.test.ts`: `isPhase1ArchivedRoute('/owner/stock/audit')` is `true`.
  - `mobile-workflow-navigation.test.ts`: drop the `/owner/stock/audit` row.
- [ ] **Step 2: Run them.** `npx vitest run __tests__/stock-tour.test.tsx __tests__/phase1-scope.test.ts` fails.
- [ ] **Step 3: Delete and modify the files listed above.**
- [ ] **Step 4: Check the result.** Those tests pass, and `grep -rnE "inventory-audit|InventoryAudit|stockAudit|stock/audit" app components lib __tests__` has no hits except the Task 1 tests and `lib/phase1-scope.ts`.
- [ ] **Step 5: Commit** with the message `Delete the Stock Audit page`.

### Task 4: Remove the Yarn Stock page, its navigation and its tour

**Files:**
- Delete: `app/(dashboard)/owner/stock/yarn/page.tsx`, `app/(dashboard)/owner/stock/YarnStockClient.tsx`, `app/(dashboard)/owner/stock/yarn-actions.ts`, `app/(dashboard)/owner/stock/StockNavigation.tsx`, `lib/yarn-stock.ts`, `lib/i18n/yarn-stock.ts`, `__tests__/yarn-stock.test.ts`, `scripts/qa/yarn-browser/`, `scripts/qa/yarn-stock-db-scenarios.mjs`
- Modify: in `app/(dashboard)/owner/stock/`, drop `LegacyStockNavigation` from `layout.tsx`; make `error.tsx` and `loading.tsx` fabric-only; update `StockPageTitle.tsx`.
- Modify navigation:
  - `lib/stock-navigation.ts`: a single `fabric` destination, and `resolveStockKind` returns `'fabric' | null`.
  - `lib/disclosure-navigation.ts`: delete the `production_stock` branch so Stock is a plain link, and drop `'stock'` from `DisclosureId`.
  - `lib/mobile-workflow-navigation.ts`: still maps `stockDestinations`, which is now Fabric + Dispatches.
  - `lib/route-milestones.ts`: remove `/owner/stock/yarn`.
  - `lib/phase1-scope.ts`: add `'/owner/stock/yarn'`.
- Modify: `app/(dashboard)/owner/dispatches/challan-actions.ts:114`: remove the yarn revalidate.
- Modify: `lib/stock-activity.ts` (delete `lastsFor` and fix the header comment) and the header comment of `components/stock/stock-presentation.tsx`.
- Modify tour:
  - `lib/tours/tour-types.ts`: drop `'yarn-stock'` from `TourId`.
  - `lib/tours/tour-registry.ts`: remove the entry and drop it from `supportedTours`.
  - `lib/i18n/tour-invitations.ts`: remove the en/gu/hi `yarn-stock` entries and the `yarnStockBenefit`/`replayYarnStock` keys wherever they are defined.
  - `lib/stock-tour.ts`: fabric only, with `StockTourKind = 'fabric-stock'`.
  - `lib/i18n/stock-tutorial.ts`: delete `YarnCopyKey`, the yarn copy, `yarnStockStepCopy` and `yarnStockTourControlLabels`.
  - `lib/tours/sample-data/stock.ts`: delete the Yarn section.
  - `components/stock/StockGuidedTour.tsx` and `StockSampleWorkspace.tsx`: fabric only.
  - `lib/i18n/configuration-tutorial.ts:8`: fix the comment.
- Modify locales: `navigation.yarn` and `navigation.yarnStock` in en/hi/gu. Grep first; `inventory.tabs.yarn` belongs to the old module and stays.
- Modify type-checked QA code: in `docs/guided-tours/harness/{main.tsx,showcase.ts,run-tour.mjs,batch.sh,labels.json}`, remove the yarn-stock scenario and the `yarnBoard`/`getYarnStockBoard` stub. In `scripts/qa/navigation-browser/main.tsx:13`, drop the `/owner/stock/yarn` key.
- Test: update `stock-navigation`, `disclosure-navigation`, `navigation-disclosure`, `mobile-workflow-navigation`, `stock-tour`, `stock-dispatch-redesign`, `stock-activity`, `tour-program-consistency`, `tour-data-safety-contract`, `tour-real-page-guard`, `tour-i18n-parity`, `guided-tour-guide-placement` and `phase1-scope`.

**Interfaces:**
- Produces:
  - `stockDestinations = [{ id: 'fabric', href: '/owner/stock', labelKey: 'navigation.fabric', titleKey: 'qualityStock.title' }]`
  - `resolveStockKind(pathname): 'fabric' | null`
  - `TourId` without `'yarn-stock'`

- [ ] **Step 1: Update the tests first.**
  - `phase1-scope.test.ts`: `isPhase1ArchivedRoute('/owner/stock/yarn')` and `('/owner/stock/yarn/123')` are `true`, and `('/owner/stock')` stays `false`.
  - `stock-navigation.test.ts`: hrefs are `['/owner/stock']`. Remove the yarn rows from the resolver table.
  - `disclosure-navigation.test.ts`:
    - The groups become `costing`, `production` and `workforce`.
    - Stock is a `link` with href `/owner/stock`.
    - Drop the `/owner/stock/yarn` active case, and drop `'stock'` from the toggle `it.each`.
  - `navigation-disclosure.test.tsx`: remove the `/owner/stock/yarn` pathname cases and fix the group-index comment and its assertions.
  - `mobile-workflow-navigation.test.ts`: the stock workflow hrefs are `['/owner/stock', '/owner/dispatches']`. Drop the `/owner/stock/yarn/example` row.
  - `stock-tour.test.tsx`, `stock-dispatch-redesign.test.tsx` and `stock-activity.test.ts`: remove the yarn content and keep fabric.
    - In `stock-dispatch-redesign.test.tsx`, delete `describe('Yarn stock')` and take the yarn page out of the shared loops.
    - In `stock-activity.test.ts`, delete the yarn and `lastsFor` cases.
  - Tour program tests (`tour-program-consistency`, `tour-data-safety-contract`, `tour-real-page-guard`, `tour-i18n-parity`, `guided-tour-guide-placement`): remove `yarn-stock` from their expected tour lists. In `tour-program-consistency`, add `expect(supportedTours).not.toContain('yarn-stock')`.
  - Delete `__tests__/yarn-stock.test.ts`.
- [ ] **Step 2: Run them.** `npx vitest run __tests__/phase1-scope.test.ts __tests__/stock-navigation.test.ts __tests__/disclosure-navigation.test.ts __tests__/mobile-workflow-navigation.test.ts` fails.
- [ ] **Step 3: Delete and modify the files listed above.** Grep before deleting any shared export or locale key.
- [ ] **Step 4: Check the result.** `npx tsc --noEmit` is clean, `npx vitest run` passes in full, and `npm run lint` shows 0 warnings.
- [ ] **Step 5: Commit** with the message `Remove the Yarn Stock page, navigation and tour`.

### Task 5: Remove both features from the export, copy and docs

**Files:**
- Modify: `app/(dashboard)/owner/settings/data-export.ts`. Delete the rows for `yarn_stock_settings`, `yarn_stock`, `yarn_stock_movements`, `yarn_stock_recipes`, `yarn_stock_requests`, `production_stock_lots`, `delivery_challan_lot_allocations`, `inventory_audits` and `inventory_audit_lines`. If the `20261013120000_owner_archive_service_role_reads` migration names any of them, also drop or revoke them in the Task 1 migration file, amending it before it is applied.
- Modify: `__tests__/lite-archive-completeness.test.ts`. Remove the dropped tables from the dataset list (~196). The composite-key scoping case (~113/165) used `yarn_stock_recipes` (`org_id`, `quality_id`): move it to another table still exported with a two-column scope, or delete it if none exists.
- Modify: `components/landing/plans.tsx:43`, changing it to `'Fabric stock'`.
  - In `lib/i18n/public-pages/hi.json:140`, rename the key to match ("कपड़े का स्टॉक").
  - `gu.json` has no entry today, so add `"Fabric stock": "કાપડનો સ્ટોક"`.
- Modify: `app/(dashboard)/owner/data-export/AccountantCsvExports.tsx:82`. Change it to "Payroll CSVs stay on the Payroll page while Base is active. All of these records are also in the complete export above.", and change the same key in `lib/i18n/lite-phrases/account.ts:441`, with hi and gu.
- Delete: `docs/features/yarn_inventory.md`, `docs/guided-tours/pages/yarn-stock.md`, `docs/guided-tours/pages/stock-audit.md`, `docs/guided-tours/tasks/GT-09-yarn-stock.md`.
- Modify: remove yarn-stock and stock-audit mentions from `docs/general/MASTER_PRODUCT_DOCUMENT.md`, `docs/guided-tours/{EXECUTION_QUEUE,EXECUTION_STATUS,PLANNING_CHECKLIST}.md`, `docs/guided-tours/harness/README.md` and `docs/navigation-reorganization/stock-sidebar-implementation.md`. Leave dated logs as written history: `docs/pilot-remediation/*`, `docs/maintenance/*/EVIDENCE.md` and the evidence logs.
- Test: whatever asserts the old strings (`grep -rn "Fabric and yarn stock\|Payroll, yarn stock" __tests__`).

- [ ] **Step 1: Update tests.** Update `lite-archive-completeness.test.ts` and any test that asserts the old strings, then run them: they fail.
- [ ] **Step 2: Make the export, copy and doc changes.**
- [ ] **Step 3: Sweep.** Run `grep -rnE "yarn-stock|yarn_stock|YarnStock|stock/yarn|yarn-actions|production_stock_lots|lot_allocations|yarn_recipe_snapshot|ys-|lastsFor|[Yy]arn [Ss]tock|inventory_audit|inventory-audit|InventoryAudit|stockAudit|stock/audit" app components lib proxy.ts worker __tests__ scripts docs --exclude-dir=superpowers`. It returns no hits except:
  - the two Task 1 test files
  - `lib/phase1-scope.ts`
  - `scripts/qa/challan-payment-terms-regression.mjs`, which reads the old migration file name
  - the dated history logs left in Step 2
- [ ] **Step 4: Check the suite.** `npx vitest run` passes in full and `npm run lint` shows 0 warnings.
- [ ] **Step 5: Commit** with the message `Remove yarn stock and the stock audit from the export, copy and docs`.

### Task 7: Delete the March/April yarn & beam module

Added 2026-10-14 at the owner's request ("delete the april module too"). This replaces the "Not touched" line for the April module above.

**Scope:**
- **Tables:**
  - `yarn_batches` (20260319030000)
  - `yarn_lots`, `beam_cards`, `order_yarn_requirements`, `yarn_movements`, `beam_card_lots` (20260428130001)
- **Views:** `yarn_lot_stock_summary`, `order_yarn_variance_summary`
- **Column:** `production_logs.yarn_batch_id`
- **Functions** (every overload, all with no caller in app code, edge functions or scripts):
  - `link_batch_to_machine`
  - `settle_batch_audit`
  - `get_yield_alert`
  - `get_batch_yield_report`
  - `get_daily_brief_stats`
  - `get_kpi_yesterday`
  - `start_party_order_from_estimator` (party orders are retired; its last step inserts `order_yarn_requirements`)
- **Kept:**
  - The `qualities` table. The retired orders feature references it, and it is not yarn stock.
  - `production_logs`. The WhatsApp/monthly edge functions read it.

**Files:**
- Create: `supabase/migrations/20261014120100_remove_yarn_beam_module.sql`
- Create: `__tests__/yarn-beam-module-removed-migration.test.ts` (source contract)
- Extend: `__tests__/db/yarn-stock-and-audit-removed.dbtest.ts` (one more `it`)
- Modify:
  - `app/(dashboard)/owner/settings/data-export.ts`: remove the `yarn_batches`, `yarn_lots`, `yarn_movements`, `beam_cards`, `beam_card_lots`, `order_yarn_requirements` rows.
  - `app/(dashboard)/owner/settings/audit/{AuditActivityItem,AuditTable}.tsx` and `lib/audit-summaries.ts`: remove the module's table names and cases.
  - `lib/schemas.ts`: delete the `Yarn*Schema` exports and any beam schemas, after grepping for users.
  - `lib/i18n/locales/{en,hi,gu}.ts`: delete the `inventory` block if it has no users.
  - The tests that list these tables or views.

- [ ] **Step 1: Write the source contract.** It asserts the migration:
  - drops the two views before any table
  - drops the six tables in FK order (`beam_card_lots`, `yarn_movements`, `order_yarn_requirements`, `beam_cards`, `yarn_lots`, `yarn_batches`) without `CASCADE`
  - drops `production_logs.yarn_batch_id`
  - drops every overload of the seven functions, through a `DO` block over `pg_proc` in schema `public` that names all seven
- [ ] **Step 2: Add the DB test.** Add `it('April yarn & beam module is gone')`, asserting that `to_regclass` is null for all eight relations, that no `pg_proc` row in `public` has any of the seven names, and that the column is absent.
- [ ] **Step 3: Run both and see them fail.**
- [ ] **Step 4: Write the migration**, with `BEGIN; … NOTIFY pgrst, 'reload schema'; COMMIT;`.
- [ ] **Step 5: Run and see them pass.** `npm run test:db` passes in full.
- [ ] **Step 6: Remove the app references**, grepping each name, and update the tests that list them.
- [ ] **Step 7: Check the suite.** `npx tsc --noEmit`, `npx vitest run` and `npm run lint` all come back clean, then commit with the message `Delete the March/April yarn & beam module`.

### Task 6: Final verification

- [ ] **Step 1:** `npx tsc --noEmit` shows no errors.
- [ ] **Step 2:** `npm run lint` shows 0 errors and 0 warnings.
- [ ] **Step 3:** `npx vitest run` passes in full (the baseline has 1 skipped live test).
- [ ] **Step 4:** `npm run test:db` passes in full.
- [ ] **Step 5: Report to the owner:**
  - The migration is file-only. Applying it permanently deletes all yarn stock data and all stock audits, and it must be applied to production **before** this branch deploys.
  - Past fabric audit adjustments stay in the fabric ledger.
  - The HI/GU copy in Tasks 2 and 5 needs native review.
  - No signed-in check on QA (`npm run dev`) was done unless the owner signed in.
  - The production feature video still mentions yarn stock.
