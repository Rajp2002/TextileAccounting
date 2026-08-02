# Shared Costing Foundation

## Product invariant

Base and Full Suite use one estimator, calculation engine, rate library, snapshot format, comparison model, and export system. Full Suite adds commercial and production capabilities around that foundation; upgrading never changes the meaning of an existing saved estimate.

## Costing Trust Foundation (Sprint 8)

The canonical costing path is:

`EstimateState` → `calcFullTotals` → `buildCostingResult` → UI, export, and server persistence.

Quick and Detailed Costing must consume the same `CostingResultSnapshot`. The snapshot records the active pricing assumptions, including:

| Assumption | What is explicit | Price meaning |
|---|---|---|
| Overhead mode | Direct rate or monthly expenses ÷ output | Determines the active overhead ₹/m |
| Overhead source | Entered direct rate or saved monthly expenses | Explains where the active rate came from |
| Reference rate | Comparison value when available | Transparency only; never an implicit override |
| Commission | Percentage | Landed-cost impact per metre |
| Transport | ₹/m | Direct per-metre impact |
| Target margin | Percentage | Quote price above break-even |
| Quantity | Metres, or explicitly not set | Changes order totals, not per-metre price |

Direct overhead is invalid until an explicit positive rate is entered. Monthly mode is invalid until the saved expense basis and output can produce a valid rate. The UI shows source, active rate, reference rate, and price impact before a save or quote action.

Base standalone costings retain their `record_kind = 'costing'` semantics and may omit party and quantity. Full Suite quotation and party-order flows require their commercial context. All persisted scalar costing fields are derived from the same canonical snapshot stored in `costing_result_snapshot`.

Sprint 8 changes application behavior and snapshot persistence only; it adds no database migration.

## Saved Costing identity and historical snapshots

Every saved costing has two identities:

- `costing_group_id` identifies the reusable costing lineage.
- `version_number` identifies the immutable revision within that lineage.

**Open and save new version** intentionally creates the next revision in the same group. **Use as Starting Point** creates a separate editable record and does not mutate or extend the source costing lineage until the owner saves the new work. Archive, restore, and favourite flags are library metadata only; they do not alter the saved recipe or canonical result.

The canonical `costing_result_snapshot` is the comparison and historical source of truth. New snapshots carry a schema version and audit layers for yarn, waste, overhead, margin, and price. Older snapshots remain readable through a tolerant parser. Comparing two saved costings uses only the two persisted canonical snapshots and requires the same calculation and rounding contract; current factory defaults and the current Rate Book are deliberately excluded.

This is the historical-economics rule: changing a default, reviewing a rate, changing a current rate, or changing a factory profile affects future calculations only. It never rewrites a saved costing snapshot.

## Yarn Rate Book boundary

Each yarn rate exposes the current value, previous value, effective date, source, notes, review interval, last review date, and history. A rate discovered from a saved quality or costing is marked for owner review. **Confirm current rate** records that review without changing the value. Stale, due-soon, and overdue statuses are visible and use the same explicit review flow.

Rate discovery, review, save, archive, and restore are atomic server/database operations. The owner and organization are rechecked inside the mutation boundary, and optimistic timestamps prevent a stale browser tab from overwriting a newer Rate Book state. A discovered rate is not treated as trusted merely because it was found in a saved record.

## Durable record contexts

Every `estimator_quotes` snapshot has a `record_kind`:

- `costing`: a standalone decision record. It has immutable revisions and no quotation status or order conversion.
- `quotation`: a customer-facing commercial record. Draft, sent, rejected, accepted, and order-conversion rules apply.
- `market_run`: an estimator snapshot belonging to make-to-stock production. It is managed through the Market Runs workflow.

`record_kind` is assigned when the record is created and is not recalculated when the organization's subscription changes.

## Upgrade behavior

After Base upgrades to Full Suite:

1. Existing costings remain visible in **Costings & Quotations**.
2. **Open & Update** creates another immutable costing revision.
3. **Prepare Quotation** loads the costing assumptions into a new quotation draft and requests customer context.
4. Costings cannot be marked sent/accepted or converted directly into orders.
5. Rates, rate history, stale-rate warnings, comparisons, exports, favorites, and archives remain available.

## Shared versus contextual capabilities

| Capability | Base | Full Suite |
|---|---:|---:|
| Calculation and decision cockpit | Yes | Yes |
| Rates, sources, and review warnings | Yes | Yes |
| Immutable costing revisions | Yes | Yes |
| Search, sort, compare, favorite, archive | Yes | Yes |
| Internal and customer-ready exports | Yes | Yes |
| Party and quotation lifecycle | No | Yes |
| Order/market-run conversion | No | Yes, quotation or market context only |
| Production, stock, dispatch, and payroll | No | Yes |

## Integrity boundaries

- Server actions derive the kind of a new record from live entitlement; the browser cannot choose it directly.
- Editing a saved costing preserves `costing` even after an upgrade.
- Application and database conversion boundaries both reject non-quotation records.
- `(org_id, costing_group_id, version_number)` is unique so a revision number cannot be reused within one costing lineage.
- Saved snapshots are not retroactively changed when a default rate is reviewed.
- Saved Costings search/sort/filter and comparison operate on persisted records, not today's defaults.
- Rate Book updates affect only future calculations; a historical snapshot keeps its recorded yarn rates, waste, overhead, margin, and price.
