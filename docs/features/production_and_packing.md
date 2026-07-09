# Production and Packing

Last analyzed from the active codebase on July 9, 2026.

## Phase 1 Status

Core production logging is Phase 1. Packing/package workflows and expected stock workflows are supporting Phase 1 surfaces where they connect production to sale and dispatch.

## What It Does

Production logging records how many metres were woven by machine, operator assignment, order/run, date, and shift. The current UI captures shift total metres directly rather than true loom opening/closing counter readings. For market-run factories, those metres create expected godown stock context. Physical reality is reconciled when stock is sold, dispatched, and received.

## User Workflow

1. Supervisor logs shift production.
2. Production logs update order/run progress, production analytics, and payroll earnings according to the operator assignment pay mode.
3. Market-run output contributes to expected stock without daily inward confirmation.
4. Optional/order-based output can still be represented as packages or inward drafts.
5. Stock can be adjusted, sold to a saved or newly captured party, dispatched, or received depending on workflow.

## Existing Workflow Translation

Old workflow:

- Supervisor writes meters in a production register.
- Physical rolls are counted separately.
- The owner later reconciles produced meters against godown stock.

Weavly workflow:

- Production logs are created at source.
- Expected stock is created from production.
- Dispatch readiness becomes visible earlier, and physical mismatch is captured at receipt/reconciliation.

## Pain Points Solved

- Produced meters not matching actual dispatch stock.
- Lost roll counts.
- Delayed dispatch readiness.
- Payroll disconnected from actual production.

## Key Concepts

- `production_logs`: the production progress and accountability source of truth. Payroll reads these logs through assignment snapshots so fixed operators do not accidentally receive meter wages.
- `machine_operator_assignments`: effective-dated operator setup for a machine and shift. It supports meter workers and fixed workers without merging the `workers` and `fixed_workers` tables.
- Machine operator pay modes: `per_meter`, `fixed_monthly`, `fixed_daily`, and `fixed_shift`.
- Fixed machine operator production metres remain visible in production history and analytics even when those metres do not affect gross pay.
- `fabric_packages`: package-style stock for rolls/bales/bulk output.
- `fabric_stock_inward_drafts`: optional/order-based suggested stock inward records.
- `fabric_stock_lots`: godown inventory with cost per meter.
- `fabric_stock_movements`: inward, sale, and adjustment history.
- `fabric_stock_sales`: party-linked named sale records with pending dispatch state.
- `stock_discrepancies`: shortage/excess records created during dispatch reconciliation.

## Data and Code

- `app/(dashboard)/supervisor/actions.ts`
- `lib/machine-operator-payroll.ts`
- `app/(dashboard)/owner/stock/actions.ts`
- `components/dispatches/DispatchModals.tsx`
- `production_logs`
- `machine_operator_assignments`
- `fabric_packages`
- `fabric_stock_inward_drafts`
- `fabric_stock_lots`
- `fabric_stock_sales`
- `fabric_stock_movements`
- `stock_discrepancies`

## Downstream Effects

- Owner analytics.
- Payroll.
- Orders and market-run progress.
- Stock valuation and sales.
- Dispatch creation and receipt reconciliation.

## Readiness Notes

- Production logging must remain the primary Phase 1 focus.
- Packing/stock should stay helpful and lightweight, not become a full warehouse system before the log-to-pay loop is stable.
- MVP limitation: a logged fixed-shift production shift is treated as proof of attendance for payroll. Non-production attendance cases for fixed machine operators need a later attendance/adjustment workflow.
