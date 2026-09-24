# Quality stock

**Yarn inventory:** Stock has a separate Yarn tab for unused yarn physically in stock. Recorded production deducts yarn using its saved costing; dispatch reduces fabric stock without a second yarn deduction. [Yarn inventory until dispatch](yarn_inventory.md) documents the superseded September 12 design. The current behavior is defined by `20260920000000_unified_inventory_audit_architecture.sql`.

Updated September 8, 2026. This replaces the old Full Suite stock feature; historical migrations and business records are retained.

## Workflow

Owners with production access (Base, trial, Full Suite) open **Stock**. Saving production automatically adds the saved metres to the fabric quality. Qualities share one balance when their production names match after trimming, collapsing spaces and ignoring case. Different names remain separate; changing a production job's quality reclassifies its production. Costing versions and jobs with the same quality name do not create separate inventory.

There are no taka inventory records, lot registration, piece counts, valuation, sales, party orders, or reusable customers in this feature. No customer details are collected.

The screen shows total metres, each quality balance, opening-stock status and paginated movement history, filterable by quality. It includes loading, empty, error and retry states and English, Hindi and Gujarati text. Stock appears in Base desktop/mobile navigation as well as Full Suite navigation. Production saves invalidate stock; returning to the browser tab or refreshing updates the board.

**Opening stock** adds verified fabric remaining from before cutover once per quality, including a zero opening. It does not replace production recorded since cutover. **Correct balance** records a verified current total, the difference from the reviewed balance, a mandatory reason, actor and timestamp. A correction also closes opening-stock entry for that quality. If the balance changed while the form was open, reload and review before correcting. Retrying an uncertain save uses the same immutable request and cannot double-add stock.

## Production and accounting

The authoritative sources are `base_daily_production_allocations`, older attributed `base_daily_production_entries` without allocations, `base_production_entries`, and Full Suite `production_logs`. Worker roll-ups with machine allocations are never counted twice. New positive production must have a quality/job. Existing unallocated historical output is disclosed separately at cutover and must be reconciled in opening stock.

A private, deferred PostgreSQL trigger reconciles the final production total by quality after the entire production transaction. Replacing a sheet (delete/reinsert), saving zero, correcting metres or changing a job quality records the net difference, without intermediate deductions. All stock-affecting production and adjustments take the same organization advisory lock. Concurrent writes cannot lose increments. A transaction that would make available metres negative rolls back with a correction message; quantities are never clamped. Existing reviewed-production idempotency and stale-version checks remain authoritative.

`quality_stock` stores balances and the last observed production total. `quality_stock_movements` is an append-only application ledger with deltas, resulting balances, reasons, actor, source record and production before/after. `quality_stock_cutover` records the baseline date, excluded historical production and legacy lot count. Owners can read their own data through RLS; only authorized RPCs/internal triggers can write. Supervisors contribute through existing production permissions but cannot view or adjust owner stock. Revoked owners, Lite plans and locked-tenant writes are rejected. Service-role SELECT supports the existing tenant-scoped account export.

## Explicit historical treatment

At migration time, source tables are locked and current production totals are snapshotted as **last observed production**, with **zero opening stock**. No production is recreated. No legacy available balance is imported. Historical production may already have been dispatched, so adding it automatically would inflate stock. The owner records only physically remaining pre-cutover stock.

Later corrections to historical production apply only their difference from the original baseline. Example: 100m existed before cutover; the new balance starts at 0m. An owner records 40m physically remaining as opening. Correcting historical production to 105m adds 5m, leaving 45m. Reversing more than the available stock fails until the owner records a justified stock correction. Job-quality reclassification likewise requires enough available stock in the old quality. Metadata-only privacy/payroll changes do not affect stock or reject old unallocated rows.

Legacy `fabric_stock_lots`, `fabric_stock_movements`, `fabric_stock_sales`, inward drafts, packages, receivables, payments and dispatch history are retained. They are not used as the new balance. Existing pending dispatches and receipt/payment history remain accessible through their existing routes; they operate exclusively on historical sales and do not debit the new balance. When recording opening balances, exclude legacy sold-but-not-yet-dispatched fabric already committed to those historical sales. This avoids counting fabric that those legacy dispatches will remove later.

## Legacy removal

Deleted the old stock-only live QA probes, Taka stock board, package stock board, old stock actions, stock lifecycle/pagination helpers, old stock validation schemas, new-sale/optional-dispatch dialog, its actions and types. The alternate grey-stock inventory tab links to the replacement. New legacy lot/inward/sale inserts and public old stock sale/adjustment RPCs are blocked; direct package entry is revoked. Internal package creation remains available solely for fulfilling historical dispatches. Old production inward reconciliation becomes an inert compatibility function so supervisor production remains usable and never creates legacy stock.

Historical applied migrations are unchanged. Dedicated tests for retired UI behavior are replaced; tests of retained dispatch/receipt history and historical migration contracts remain.

## Release and rollback

Implementation is local; do not apply to production or deploy without separate release authorization.

1. Run `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`, and the local database suite below. Review the migration with the release owner.
2. Back up the database and export legacy stock, pending sales/dispatches and production totals. Reconcile opening quantities, explicitly excluding fabric committed to legacy pending dispatches.
3. Use a short coordinated maintenance window: stop stock/production writes, apply `20260908171502_quality_metre_stock.sql` with the established Supabase migration mechanism, refresh PostgREST schema cache, and release this app version together. The migration is transactional and locks source tables while capturing the baseline. Do not run this through the obsolete `scripts/apply_migration.mjs` helper.
4. Verify an isolated owner and supervisor: save production, review stock, retry the save, correct/zero the sheet, and check the ledger. Verify a historical pending dispatch and payment still works. Record opening stock and review totals.
5. Roll back by restoring the pre-cutover snapshot **only if no post-cutover business writes exist**. Otherwise stop writes and forward-fix while retaining new stock movements. Do not drop these tables or silently switch back to old stock after new writes.

## Verification

`STOCK_TEST_DATABASE_URL=postgresql://…@127.0.0.1:5432/postgres npm run test:stock-db` creates and drops its own disposable database and refuses non-loopback hosts. It replays 277 historical migrations, with minimal local Supabase auth/storage shims. Four unrelated external WhatsApp scheduler migrations are skipped because standalone PostgreSQL lacks `pg_cron`/`pg_net`. Fixtures contain no real customer data. Its 16 scenarios exercise actual reviewed production saves, opening/corrections, reversal/rollback, baseline treatment, concurrent sessions, access isolation, Full Suite supervisor saves, historical pending dispatch fulfillment and >50-row history. A local PostgreSQL account with database/role creation rights is required.

Standalone dispatch uses `quality_stock.id` and the same `hashtextextended(org_id::text || ':quality-stock', 0)` transaction lock. Confirmation checks and deducts sent metres once, keyed by dispatch identity; drafts/printing do not. Customer details and lot IDs belong only to that dispatch/challan. Receipt differences affect chargeable metres, not stock. Selling-rate snapshots, receipt settlement, payment history and automatic archive are now implemented; see [standalone delivery challans](standalone_delivery_challans.md).

Browser component/SQL verification can be repeated using the loopback-only harness in `scripts/qa/stock-browser/server.mjs`; see [verification results](../../outputs/quality-stock-replacement/verification.md).
