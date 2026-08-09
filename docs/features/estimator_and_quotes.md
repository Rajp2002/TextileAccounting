# Estimator and Quotes

Last reviewed against the active codebase on August 2, 2026. Updated August 2, 2026.

## Phase 1 Status

Core Phase 1 pillar. The estimator is the commercial entry point for Weavly.

## What It Does

The estimator lets an owner calculate the cost and quote price of a fabric from weaving-specific inputs. It covers warp/weft yarn rows, denier, beam ends, picks, reed space, yarn rates, GST, shortage, warp crimp, loom type, RPM, power, hours per shift, warping, sizing, winding, processing, finishing, overheads, fixed-worker overhead, commission, transport, and profit.

Saved costings and quotations save both the final commercial values and the estimator state snapshot so repeat qualities can be reopened without recalculating historical assumptions.

## Sprint 8 — Costing Trust Foundation

Every price-changing assumption must be visible before Rajesh saves or quotes. Quick Costing and Detailed Costing use the same `calcFullTotals` → `buildCostingResult` pipeline; the resulting canonical costing snapshot drives the result cards, quote readiness, exports, and server-side persistence.

### Overhead modes

- **Direct overhead rate** uses only the explicit ₹/m rate entered for this costing. The UI does not auto-fill an example or silently copy a monthly reference into the direct rate.
- **Monthly expenses ÷ output** uses the saved monthly expense items and actual monthly output. The calculated ₹/m value is the active rate for that costing.
- The assumptions summary shows the selected source, active rate, reference rate, cost impact per metre, and quote-price impact versus the reference. A reference is explanatory only; it never overrides the selected mode.

### Commercial assumptions

The visible assumptions summary also shows commission, transport, target margin, and quantity. Commission, transport, and margin affect the canonical per-metre result. Quantity is explicit and affects order-level totals, not the per-metre price; it remains optional for Base standalone costings and is required for Full Suite quotations and party orders.

Full Suite Quick Costing includes Party / Customer in the same context as the quality name. Base standalone costing keeps its existing semantics: a costing can be saved without party or quantity, while quotation and order actions retain their commercial requirements.

The same canonical result snapshot is persisted alongside the recipe state, so scalar quote fields and the displayed result cannot silently diverge. Historical snapshots remain readable through the tolerant snapshot parser. Sprint 8 adds no schema migration.

## Sprint 9 — Base editor, draft, and reset reliability

Sprint 9 makes editing and saving a costing predictable for Rajesh:

- **New Quality / Reset** rebuilds one clean baseline from the current factory profile. It clears the active quality/template lineage, party and instructions, transient warnings, dialogs, suggestions, and recoverable draft state.
- Warp and weft rows have explicit **Add component** and **Remove** controls. A newly added blank row is visible and required, but blank component rows are hard-blocked from saving until they are removed or completed.
- A warning review is resumable. After Rajesh chooses **Review and save**, the original save action continues automatically; he does not need to press Save again.
- **Save Costing** creates an internal costing snapshot. **Save New Version** creates a new immutable costing snapshot while preserving earlier economics. **Save as New Quality** opens a separate reusable-quality dialog and cancelling it restores the prior quality lineage without mutation.
- Base standalone costing keeps quantity and party optional. Quantity changes order totals when provided; it does not change the per-metre price.
- Programmatic reset, draft restore, and successful save suppress autosave until a real user edit occurs, so stale fields cannot silently reappear as a fresh draft.

Sprint 9 adds no schema migration. It continues to use the existing immutable costing revision RPC and database trigger protections.

## Sprint 10 — Saved costings, rates, versions, and comparison

Sprint 10 makes Base reusable for repeat customers and recurring fabric qualities while keeping historical economics immutable:

- **Saved Costings** can be searched, sorted, filtered by active/archived state or favourites, archived, restored, and marked as a favourite. The list shows the stable costing group and version identity so Rajesh can distinguish a revision from a new starting point.
- **Use as Starting Point** always opens a separate editable copy. It never edits the source snapshot or silently creates a new version in the source costing group. **Open and save new version** remains the explicit revision action.
- Costing comparison is available for two saved costings from the same canonical snapshot contract. It reports meaningful changes in yarn layers/rates/cost, waste, overhead, margin, production and break-even totals, landed/selling price, and expected profit. Comparison reads the persisted snapshots only; it does not read today's Rate Book or factory defaults.
- The Yarn Rate Book shows current and previous values, effective date, source, notes, review status, and review history. A discovered rate remains visibly unreviewed until the owner chooses **Confirm current rate**. Stale, due-soon, and overdue rates have an explicit review path.
- Rate discovery and lifecycle writes use atomic server/database boundaries with tenant and owner checks. A rate update changes future calculations only; saved costing snapshots and saved quality recipe values remain unchanged.
- Historical snapshots are parsed tolerantly, including older snapshots without the Sprint 10 audit fields. New snapshots carry a schema version and the audit details needed to explain yarn, waste, overhead, margin, and price changes.

The Sprint 10 database migration adds the tenant-scoped Saved Costings state index, an optimistic-concurrency archive/favourite RPC, and an atomic yarn-rate discovery RPC. It does not rewrite existing costing rows.

## Sprint 20 — Saved-quality commercial reuse

Base Saved Quality reuse follows a full-costing contract. The current Saved Quality recipe and current Rate Book yarn rows are applied, while the latest linked costing snapshot restores the overhead method and inputs, commission, transport, target margin, quantity, capacity inputs, and optional-section on/off state. This lets an owner explain a repeat estimate as the prior costing with an intentional rate change.

The estimator’s save review lists the exact yarn-rate basis, overhead basis, commercial values, quantity, and enabled/disabled sections that will be included. If a legacy quality has no linked costing snapshot, the estimator says that current factory defaults are being used; it does not imply that historical commercial assumptions were restored. Existing costing snapshots remain immutable, and Full Suite quality-versus-quotation semantics are unchanged.

## Sprint 11 — Base documents, export, and billing trust

Sprint 11 makes Base outputs reliable and commercially understandable without turning a customer quotation into a tax document:

- Internal Cost Sheet and Customer Quotation outputs are built from the same normalized costing snapshot and calculation result. Internal output retains cost-stack, overhead, margin, and expected-profit detail; customer output contains only customer-facing commercial information.
- Customer quotations are document artifacts only. Every customer quotation carries an explicit notice that it is not a GST tax invoice; GST wording, when enabled, points to the separate final tax invoice.
- Organization, customer, quantity, validity date, and notes are normalized and validated at the export boundary. PDF, print, share, and download actions use deterministic filenames and surface browser save failures instead of reporting a false success.
- Owner exports now cover the complete organization-scoped dataset catalog, include export counts and history, redact nested sensitive fields, and record generated or failed export runs.
- Base billing language describes estimator activation, renewal, expiry, access, payment receipts, and GST tax invoices in Base terms. A payment receipt confirms money received; it is not a GST tax invoice.

Sprint 11 adds no database migration. It reuses the existing `organization_export_runs` history table and billing schema; the linked production migration history is expected to remain aligned through `20260802121858_sprint10_saved_costing_library_state.sql`.

### Sprint 11 data and code boundaries

- `lib/estimator-export.ts` — normalized export options, shared costing model, privacy boundary, validity validation, and deterministic filenames.
- `components/estimator/CostingExportDialog.tsx` — internal/customer document actions and visible browser success/failure feedback.
- `app/(dashboard)/owner/settings/data-export.ts` — complete organization export catalog, redaction, counts, history, and audit handling.
- `components/settings/organization-data-export-button.tsx` — generated/download-failed status handling.
- `app/(dashboard)/owner/billing/page.tsx` and `components/billing/AccessGate.tsx` — Base access, renewal, expiry, receipt, and invoice terminology.
- `app/api/billing/receipt/[paymentId]/route.ts` and `app/api/billing/invoice/[invoiceId]/route.ts` — deterministic attachment filenames and download response headers.

## User Workflow

1. Owner opens `/owner/estimator`.
2. Owner starts from defaults or applies a saved template.
3. Owner enters fabric quality details: warp rows, weft rows, tape length, picks, denier, yarn rate, GST, shortage, and crimp.
4. Owner configures loom assumptions: loom type, RPM, power, hours per shift, and sizing mode.
5. Owner reviews cost stack and scenarios.
6. Owner reviews warnings once, then chooses **Save Costing**, **Save New Version**, or **Save as New Quality** according to the intended record.
7. Owner saves a reusable fabric template or updates an existing one.
8. Owner enters party name, quality label, warp/weft instructions, meters, and margin.
9. Owner saves the quote: chooses **Save Quote** (saves as draft) or **Save & Accept** (immediately locks the costing).
10. Owner manages quote status in `/owner/quotes`: draft, accepted, or rejected (manual 'sent' step is collapsed from the UI but logged silently in database audit triggers). Accepting a draft quote prompts a locking confirmation dialog.
11. Owner re-estimates an old quote by restoring its snapshot into local estimator draft state. The UI displays a warning banner to prevent stale draft collisions.
12. Owner converts an accepted quote into an active order by clicking "Create Active Order" in Quote History.
13. Owner can create a market run from estimator market mode.
14. Owner reopens a saved costing, uses **Use as Starting Point** for a separate repeat-customer estimate, or saves an explicit new version in the same costing group.
15. Owner compares two saved costings from the same snapshot contract, then archives or restores library records without changing their economics.

## Existing Workflow Translation

Old workflow:

- Owner calculates yarn and weaving cost in a notebook, calculator, Excel file, or from memory.
- Old rates and fabric qualities are copied from previous parchi.
- Margin is decided quickly under trader pressure.
- A quote may be sent over phone or WhatsApp, but the assumptions are hard to reconstruct later.

Weavly workflow:

- The fabric recipe is structured.
- Inputs update totals immediately.
- Templates preserve repeat qualities.
- Quotes store a durable snapshot.
- Accepted quotes can become production orders without retyping.

## Pain Points Solved

- Guesswork pricing.
- Hidden overhead and process costs.
- Re-entering repeat qualities.
- Losing quote assumptions after yarn rates change.
- Poor handoff from commercial quote to production instruction.

## User Interaction Details

- Templates can be saved, renamed, updated, rate-updated, deleted, and applied.
- Factory cost profile can be saved from the estimator.
- Monthly output suggestions can use recent production.
- Fixed workers can be merged into overhead items.
- Scenario analysis helps the owner see sensitivity to margin/price assumptions.
- Quote history and Saved Costings let the owner search, sort, filter, compare, favourite, archive, restore, and reopen records without changing their economics.
- Reset and cancelled dialogs do not mutate saved quality or costing history.

## Data and Code

- `app/(dashboard)/owner/estimator/EstimatorClient.tsx`
- `app/(dashboard)/owner/estimator/actions.ts`
  - `saveEstimatorQuoteV3` — creates `estimator_quotes` rows with full snapshot.
  - `convertAcceptedQuoteToOrder` — server action that calls `executeQuoteConversion`; the underlying `convert_accepted_quote_to_order` RPC had an ambiguous `order_id` column reference (fixed migration `20260531040000`).
  - `startPartyOrderFromEstimator` — fast-path: creates accepted quote then immediately calls `executeQuoteConversion`.
  - `getActiveProductionTargets` — returns linkable orders/runs for the loom assignment picker.
- `app/(dashboard)/owner/quotes/QuotesClient.tsx`
- `hooks/useAutosave.ts`
- `lib/estimator-validation.ts`
- `lib/quotes/convert-accepted-quote-to-order.ts`
  - `executeQuoteConversion` — shared service: validates quote, calls the RPC, rehydrates estimate state, upserts `order_yarn_requirements`.
  - `hydrateEstimateStateFromQuote` — reconstructs a full `EstimateState` from a stored quote row for yarn requirement computation.
- `lib/estimator.ts`
- `lib/saved-costings.ts`
- `lib/finance.ts`
- `factory_cost_profile`
- `estimator_templates`
- `estimator_quotes`
- `orders`
- `order_yarn_requirements`
- `market_runs`
- `supabase/migrations/20260802121858_sprint10_saved_costing_library_state.sql`

## Downstream Effects

- Accepted quote conversion creates active orders.
- Market mode creates market runs.
- Worker-rate and cost snapshots flow into production and payroll.
- Quote data feeds expected commercial profit.

## Readiness Notes

- Formula tests are critical before launch.
- Quote and costing snapshots must remain stable after template, factory-profile, or Rate Book edits.
- Comparison must use the same persisted canonical snapshot contract on both sides; it must never recalculate history with current defaults.
- Archive, restore, and favourite state are lifecycle metadata only and must not create a new economic version.
- The first-time owner path should remain simple despite the advanced controls.
- The `convert_accepted_quote_to_order` Supabase RPC returns a table with a column named `order_id`. Any UPDATE inside the function must qualify `estimator_quotes.order_id` explicitly to avoid PostgreSQL ambiguity errors.
- A blank yarn component is an editor error, never a saveable economic assumption.
- Historical costing versions must remain immutable after a quality, rate book, or factory-profile change.
