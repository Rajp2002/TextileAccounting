# Production and Packing

Last analyzed from the active codebase on May 6, 2026.

## Phase 1 Status

Core production logging is Phase 1. Packing/package workflows and expected stock workflows are supporting Phase 1 surfaces where they connect production to sale and dispatch.

## What It Does

Production logging records how many meters were woven by machine, worker, order/run, date, and shift. For market-run factories, those meters create expected godown stock. Physical reality is reconciled at sale/dispatch through shortage/excess differences.

## User Workflow

1. Supervisor logs shift production.
2. Production logs update order/run progress and payroll earnings.
3. Market-run output contributes to expected stock without daily inward confirmation.
4. Optional/order-based output can still be represented as packages or inward drafts.
5. Stock can be adjusted, dispatched, or sold depending on workflow.

## Existing Workflow Translation

Old workflow:

- Supervisor writes meters in a production register.
- Physical rolls or takas are counted separately.
- The owner later reconciles produced meters against godown stock.

Weavly workflow:

- Production logs are created at source.
- Expected stock is created from production.
- Dispatch readiness becomes visible earlier, and physical mismatch is captured at dispatch.

## Pain Points Solved

- Produced meters not matching actual dispatch stock.
- Lost roll/taka counts.
- Delayed dispatch readiness.
- Payroll disconnected from actual production.

## Key Concepts

- `production_logs`: the payroll and progress source of truth.
- `fabric_packages`: package-style stock for rolls/bales/bulk output.
- `fabric_stock_inward_drafts`: optional/order-based suggested stock inward records.
- `fabric_stock_lots`: taka/godown inventory with cost per meter.
- `fabric_stock_movements`: inward, sale, and adjustment history.
- `stock_discrepancies`: shortage/excess records created during dispatch reconciliation.

## Data and Code

- `app/(dashboard)/supervisor/actions.ts`
- `app/(dashboard)/owner/stock/actions.ts`
- `components/dispatches/DispatchModals.tsx`
- `production_logs`
- `fabric_packages`
- `fabric_stock_inward_drafts`
- `fabric_stock_lots`
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
