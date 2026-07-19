# Shared Costing Foundation

## Product invariant

Base and Full Suite use one estimator, calculation engine, rate library, snapshot format, comparison model, and export system. Full Suite adds commercial and production capabilities around that foundation; upgrading never changes the meaning of an existing saved estimate.

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
