# Weavly Phase 1 Refinement #1: Party-First Stock Sale / Sell & Dispatch

## Summary

This implementation refines Weavly Phase 1's Sell & Dispatch workflow so market-run factories can sell godown or expected stock directly to a named party without creating a fake order.

The previous flow was order-first. It required the owner to select an order before selling and dispatching stock. That worked for order-based factories, but it blocked the market-run operating model where fabric is produced first, stored in godown, and later sold directly to a party.

The new flow is party-first:

1. Select available source stock.
2. Enter party details.
3. Enter sold meters/takas and sale rate.
4. Enter credit days and auto-calculate due date.
5. Choose either `Save sale only` or `Dispatch now`.
6. Create a stock sale.
7. Optionally create a dispatch.
8. Create/update a named commercial receivable/profit entry.
9. Track pending dispatch quantity when sold meters exceed dispatched meters.
10. Preserve the existing order-based and both-mode workflows.

This is still a Phase 1 operating loop, not a full ERP or accounting module.

## Product Scope Confirmed

Implemented:

- Party-first stock sale flow.
- Market-run stock sales without orders.
- Named commercial receivables for stock sales.
- Gross profit snapshot at sale time.
- Simple credit terms and due date calculation.
- Optional immediate dispatch.
- Partial dispatch support.
- Pending dispatch quantity tracking.
- Stock discrepancy creation remains available through the existing lean discrepancy table for true reconciliation mismatches, but intentional party-first partial dispatch does not create a discrepancy.
- Existing order-based dispatch flow preserved.
- Both-mode organizations preserved.

Explicitly not implemented:

- No `/owner/ledger` reactivation.
- No full accounting module.
- No fake order creation for market-run sales.
- No anonymous receivables.
- No detailed packing list module.
- No broker commission calculation.
- No claim/deduction settlement.
- No GST invoice generation.
- No large new discrepancy module.

## Files Changed

The implementation changed or added the following files:

- `components/dispatches/SellAndDispatchDialog.tsx`
- `app/(dashboard)/owner/dispatches/actions.ts`
- `app/(dashboard)/owner/orders/actions.ts`
- `lib/dispatch/sell-and-dispatch-types.ts`
- `lib/commercials/receivables.ts`
- `supabase/migrations/20260517090000_party_first_stock_sale_dispatch.sql`
- `__tests__/p1-party-first-stock-sale-dispatch.test.ts`

## UI Implementation

Updated file:

```text
components/dispatches/SellAndDispatchDialog.tsx
```

The Sell & Dispatch dialog was refactored from an order-first wizard into a party-first wizard.

The new dialog has four steps:

1. Source Stock
2. Party and Sale Terms
3. Dispatch Now or Save Sale Only
4. Preview and Confirm

## Step 1: Source Stock

The owner selects available source stock from godown/expected stock.

The source stock selector uses data returned by:

```ts
getSellAndDispatchOptions()
```

Each stock option shows:

- quality label
- godown
- available meters
- available takas
- unit label

When a stock lot is selected, the summary shows:

- quality
- godown
- available meters
- available takas
- cost per meter snapshot
- linked order party, if the stock is order-linked

The flow does not require an order. If an order-linked stock lot is selected, the party can be prefilled from the linked order, but this is optional behavior and not a requirement.

## Step 2: Party and Sale Terms

The owner enters party and sale data.

Captured party fields:

- party name
- phone
- city
- GSTIN

Captured sale fields:

- sold meters
- sold takas
- sale rate per meter
- credit days
- sale date

The due date is automatically calculated in the UI as:

```ts
due_date = sale_date + credit_days
```

The due date is displayed read-only in the dialog.

Validation enforced by the UI:

- source stock must be selected
- party name is required
- sold meters must be greater than zero
- sale rate must be greater than zero
- credit days must be zero or positive
- sold meters cannot exceed available meters

Server-side validation repeats the important checks.

## Step 3: Dispatch Choice

The owner chooses one of two modes:

```text
Dispatch now
Save sale only
```

If `Save sale only` is selected:

- stock sale is created
- receivable/profit entry is created
- no dispatch row is created
- the sale remains pending dispatch

If `Dispatch now` is selected, the owner enters:

- actual dispatched meters
- dispatch date
- transport name
- vehicle number
- challan number
- notes

Dispatch can be partial.

The UI allows dispatch when:

```ts
actualDispatchedMeters > 0
actualDispatchedMeters <= soldMeters
```

If actual dispatched meters are less than sold meters, the UI shows how many meters will remain pending dispatch.

## Step 4: Preview and Confirm

The preview shows the key commercial and dispatch outcome before saving:

- party
- sold meters
- sale rate
- total sale value
- cost per meter
- gross cost
- gross profit
- gross margin
- due date
- dispatch status

The financial preview uses:

```ts
totalSaleValue = soldMeters * saleRatePerMeter
grossCost = soldMeters * costPerMeter
grossProfit = totalSaleValue - grossCost
grossMargin = totalSaleValue > 0
  ? grossProfit / totalSaleValue * 100
  : 0
```

## Server Action Implementation

Updated file:

```text
app/(dashboard)/owner/dispatches/actions.ts
```

Added the new party-first server action:

```ts
createPartyStockSaleAndOptionalDispatch(input)
```

This action validates request shape, then delegates the write sequence to the atomic database RPC:

```sql
create_party_stock_sale_dispatch_v1
```

The RPC owns the transactional creation of the stock sale, guarded stock decrement, stock movement, optional dispatch, and commercial receivable.

## Server Action Validation

The action validates:

- authenticated user is an owner
- organization context exists through `requireRole(['owner'])`
- source type and source ID are present
- party name is required
- sold meters are greater than zero
- sale rate per meter is greater than zero
- credit days are zero or positive
- sold takas are optional
- if sold takas are provided, sold takas are greater than zero
- when dispatching now, actual dispatched meters are greater than zero
- when dispatching now, actual dispatched meters do not exceed sold meters

The RPC also validates stock availability, cost snapshot, and organization ownership. Over-selling is blocked by the database update condition, not only by a pre-read in application code.

## RPC Stock Loading and Snapshot

The selected source stock is loaded and locked through a guarded `UPDATE ... RETURNING` inside the RPC.

The RPC snapshots:

- quality label
- cost per meter
- available meters
- available takas
- meters per taka

The cost per meter snapshot is written to the stock sale row as:

```ts
cost_per_meter = v_lot.cost_per_meter
```

The generated columns on `fabric_stock_sales` then calculate:

- `revenue_amount`
- `cost_amount`
- `gross_profit_amount`

## Atomic Sale Creation

The RPC inserts into:

```text
fabric_stock_sales
```

Inserted sale fields include:

- `org_id`
- `stock_lot_id`
- `sale_date`
- `taka_sold`
- `meters_sold`
- `price_per_meter`
- `cost_per_meter`
- `party_name`
- `party_phone`
- `party_city`
- `party_gstin`
- `credit_days`
- `due_date`
- `dispatch_status`
- `dispatched_meters`
- `pending_dispatch_meters`
- `dispatch_date`
- `transport_name`
- `vehicle_number`
- `challan_number`
- `notes`
- `created_by`

The sale is created in the same database transaction as the guarded stock decrement, stock movement, optional dispatch, and commercial receivable.

## Stock Balance Update

Before inserting the sale, the RPC reduces available-for-sale stock in:

```text
fabric_stock_lots
```

It updates:

```ts
available_meters = available_meters - p_sold_meters
available_taka_count = available_taka_count - p_sold_takas
```

The takas decrement only happens when `p_sold_takas` is provided. If takas are unknown, the meters are decremented and takas are left unchanged.

The decrement is guarded by:

```sql
available_meters >= p_sold_meters
AND (p_sold_takas IS NULL OR available_taka_count >= p_sold_takas)
```

If the row is not updated, the RPC raises `Cannot sell more than available stock`. This protects concurrent submissions from over-selling the same stock.

## Stock Movement Creation

The RPC inserts a sale movement into:

```text
fabric_stock_movements
```

The inserted movement uses:

```ts
movement_type: 'sale'
taka_delta: -saleTakaSnapshot
meters_delta: -soldMeters
reference: `Sale to ${partyName}`
```

This keeps the stock movement history aligned with the stock sale.

## Optional Dispatch Creation

If `dispatchNow` is true, the RPC creates a dispatch row in:

```text
dispatches
```

The dispatch is linked directly to the stock sale through:

```ts
stock_sale_id: saleId
```

No order is required.

The dispatch insert includes:

- `org_id`
- `order_id: null`
- `stock_sale_id`
- `dispatch_number`
- `qty_meters_sent`
- `status: 'in_transit'`
- `notes`
- `dispatched_at`
- `created_by`
- `taxable_value`
- `gst_percent`
- `cgst_amount`
- `sgst_amount`
- `igst_amount`
- `total_invoice_value`
- `eway_bill_required`
- `vehicle_number`
- `transporter_name`
- `party_name`
- `party_phone`
- `party_city`
- `challan_number`

This is only a dispatch/challan-style movement record. GST invoice generation is not added in this pass.

## Dispatch Number

For stock-sale dispatches without an order, the action calculates a simple organization-level dispatch number among stock-sale dispatches:

```ts
count(existing org dispatches where order_id is null) + 1
```

Existing order-linked dispatch numbering remains unchanged and still uses the existing order-specific RPC.

## Linking Sale to Dispatch

After creating the dispatch, the action updates the sale:

```ts
fabric_stock_sales.dispatch_id = dispatchId
```

This preserves the existing sale-to-dispatch relationship while also supporting the new direct dispatch link:

```ts
dispatches.stock_sale_id = saleId
```

## Dispatch Status Calculation

Dispatch status is derived atomically in `create_party_stock_sale_dispatch_v1`.

Statuses:

```ts
'not_dispatched'
'partially_dispatched'
'dispatched'
'received'
'discrepancy'
```

Current creation-time behavior:

### Save Sale Only

```ts
dispatch_status = 'not_dispatched'
dispatched_meters = 0
pending_dispatch_meters = soldMeters
```

### Full Dispatch

```ts
dispatch_status = 'dispatched'
dispatched_meters = soldMeters
pending_dispatch_meters = 0
```

### Partial Dispatch

```ts
dispatch_status = 'partially_dispatched'
dispatched_meters = actualDispatchedMeters
pending_dispatch_meters = soldMeters - actualDispatchedMeters
```

Intentional partial dispatch is not a discrepancy. In this party-first flow, `actualDispatchedMeters` means the quantity being dispatched now. It is not a separate reconciliation measurement.

## Pending Dispatch Calculation

Pending dispatch is calculated as:

```ts
pendingDispatchMeters = Math.max(soldMeters - actualDispatchedMeters, 0)
```

For save-only sales:

```ts
actualDispatchedMeters = 0
pendingDispatchMeters = soldMeters
```

For full dispatch:

```ts
actualDispatchedMeters = soldMeters
pendingDispatchMeters = 0
```

For partial dispatch:

```ts
actualDispatchedMeters < soldMeters
pendingDispatchMeters = soldMeters - actualDispatchedMeters
```

## Stock Discrepancy Creation

The party-first creation flow does not create `stock_discrepancies` for partial dispatch.

Correct semantics:

```ts
soldMeters = total quantity sold
actualDispatchedMeters = quantity intentionally dispatched now
pending_dispatch_meters = soldMeters - actualDispatchedMeters
```

A stock discrepancy should only be created when the system has a true mismatch between an expected dispatch/loading/received quantity and the actual reconciled quantity. This flow does not currently capture a separate expected-vs-loaded or expected-vs-received field, so it does not infer a discrepancy from partial dispatch.

The existing order-linked dispatch reconciliation path still uses `stock_discrepancies` where it already has the appropriate expected/actual comparison.

## Commercial Receivable Creation

After the stock sale is created, the action calls:

```ts
ensureReceivableForCommercialEntry('fabric_stock_sale', saleId)
```

This ensures Commercials gets a named receivable for the sale.

The action revalidates:

```ts
revalidatePath('/owner/stock')
revalidatePath('/owner/dispatches')
revalidatePath('/owner/market-runs')
revalidatePath('/owner/commercials')
```

## Existing Order-Based Dispatch Preserved

The existing order-based action remains:

```ts
sellAndDispatchTakas(input)
```

It now uses a separate legacy input type:

```ts
LegacyOrderSellAndDispatchInput
```

It still calls the existing RPC:

```ts
create_stock_sale_dispatch
```

It still passes:

```ts
p_order_id: input.orderId
```

This preserves:

- order-based dispatches
- both-mode dispatches
- active order validation
- same-quality unlinked lot handling
- order tracking token behavior
- `/track/[token]` links

The old RPC path was not replaced.

## Type Changes

Updated file:

```text
lib/dispatch/sell-and-dispatch-types.ts
```

Added source type:

```ts
export type StockSaleSourceType =
  | 'stock_lot'
  | 'market_run'
  | 'order'
  | 'expected_stock'
```

Added dispatch status:

```ts
export type DispatchStatus =
  | 'not_dispatched'
  | 'partially_dispatched'
  | 'dispatched'
  | 'received'
  | 'discrepancy'
```

Added payment status:

```ts
export type PaymentStatus =
  | 'unpaid'
  | 'partial'
  | 'paid'
  | 'overdue'
```

Added unified party-first input:

```ts
export type SellAndDispatchInput = {
  sourceType: StockSaleSourceType
  sourceId: string
  partyName: string
  partyPhone?: string | null
  partyCity?: string | null
  partyGstin?: string | null
  soldMeters: number
  soldTakas?: number | null
  saleRatePerMeter: number
  creditDays: number
  saleDate: string
  dispatchNow: boolean
  actualDispatchedMeters?: number | null
  dispatchDate?: string | null
  transportName?: string | null
  vehicleNumber?: string | null
  challanNumber?: string | null
  notes?: string | null
}
```

Added legacy order input:

```ts
export type LegacyOrderSellAndDispatchInput = {
  orderId: string
  selectedLots: Array<{
    stockLotId: string
    unitsToSell: number
  }>
  sale: {
    saleRatePerMeter: number
    saleDate: string
    notes?: string | null
  }
  dispatch: {
    actualDispatchedMeters?: number | null
    dispatchDate: string
    transporterName?: string | null
    vehicleNumber?: string | null
    ewayBillNumber?: string | null
    ewayBillDate?: string | null
    approximateDistanceKm?: number | null
    notes?: string | null
  }
}
```

Updated result type:

```ts
export type SellAndDispatchResult =
  | {
      success: true
      saleIds: string[]
      dispatchId: string | null
      dispatchNumber: number | null
      trackingUrl: string | null
      dispatchStatus: DispatchStatus
      pendingDispatchMeters: number
      receivableId?: string | null
    }
  | {
      success: false
      stage: 'validation' | 'sale' | 'dispatch' | 'commercials'
      message: string
      saleIds?: string[]
      recoverable?: boolean
    }
```

## Commercials Implementation

Updated file:

```text
lib/commercials/receivables.ts
```

Previously, fabric stock sale receivables could fall back to:

```ts
'Anonymous'
```

This was removed for stock sales.

The receivable party name is now derived from:

```ts
sale.party_name || order?.party_name
```

If no party name exists, receivable creation fails with:

```ts
Party name is required for stock sale receivables
```

This prevents anonymous receivables.

The receivable upsert now includes:

- `source_type`
- `source_id`
- `source_date`
- `order_id`
- `dispatch_id`
- `party_name`
- `quality_label`
- `total_amount`
- `payment_status`
- `credit_days`
- `due_date`
- `created_by`
- `updated_by`

The commercial receivable remains lightweight and does not become a full ledger.

## Dispatches Page Compatibility

Updated file:

```text
app/(dashboard)/owner/orders/actions.ts
```

The dispatch list previously required an inner join to orders:

```sql
orders!inner
```

That would exclude stock-sale dispatches because those dispatches do not have an order.

The query was changed to a nullable relation:

```sql
orders
```

For dispatches without an order, the action creates fallback display data:

```ts
orders: {
  id: row.stock_sale_id ?? row.id,
  party_name: row.party_name ?? 'Stock Sale Party',
  quality_label: null,
  tracking_token: '',
  total_target_meters: row.qty_meters_sent,
  status: 'stock_sale',
}
```

This allows the Dispatches page to display stock-sale dispatches without forcing an order.

Dispatch overview stats were also updated.

Previously, pending dispatch meters assumed every undispatched sale was fully pending:

```ts
meters_sold
```

Now it uses:

```ts
pending_dispatch_meters
```

Fallback behavior remains:

```ts
pending_dispatch_meters ?? meters_sold
```

## Database Migration

Added migration:

```text
supabase/migrations/20260517090000_party_first_stock_sale_dispatch.sql
```

## `fabric_stock_sales` Changes

Added party fields:

```sql
party_name TEXT
party_phone TEXT
party_city TEXT
party_gstin TEXT
```

Added credit terms:

```sql
credit_days INTEGER NOT NULL DEFAULT 0 CHECK (credit_days >= 0)
due_date DATE
```

Added dispatch tracking:

```sql
dispatch_status TEXT NOT NULL DEFAULT 'not_dispatched'
dispatched_meters NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (dispatched_meters >= 0)
pending_dispatch_meters NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (pending_dispatch_meters >= 0)
dispatch_date DATE
```

Added transport/challan fields:

```sql
transport_name TEXT
vehicle_number TEXT
challan_number TEXT
```

Allowed dispatch statuses:

```sql
'not_dispatched'
'partially_dispatched'
'dispatched'
'received'
'discrepancy'
```

Backfill behavior:

- existing order-linked sales use the linked order party name
- existing sales without party use `Legacy Stock Sale`
- due date is backfilled from `sale_date + credit_days`
- dispatched meters and pending dispatch meters are backfilled from existing dispatch links

## `commercial_receivables` Changes

The existing payment status constraint was replaced.

Supported statuses are now:

```sql
'unpaid'
'partial'
'paid'
'overdue'
```

This satisfies the Phase 1 status requirement without adding full accounting.

## `dispatches` Changes

The migration makes `order_id` nullable:

```sql
ALTER TABLE dispatches
  ALTER COLUMN order_id DROP NOT NULL;
```

This is required because stock-sale dispatches should not need fake orders.

Added:

```sql
stock_sale_id UUID REFERENCES fabric_stock_sales(id) ON DELETE SET NULL
party_name TEXT
party_phone TEXT
party_city TEXT
challan_number TEXT
```

Added index:

```sql
CREATE INDEX IF NOT EXISTS idx_dispatches_stock_sale
  ON dispatches(stock_sale_id)
  WHERE stock_sale_id IS NOT NULL;
```

## `commercial_profit_entries` View

The migration rebuilds:

```sql
commercial_profit_entries
```

The stock sale part now uses the named party as the source label:

```sql
COALESCE(NULLIF(s.party_name, ''), 'Named Stock Sale') AS source_label
```

The view still includes:

- realized stock sales
- realized market-run sales
- realized order invoices
- expected order quote profit

This preserves existing Commercials behavior while making stock sales named and party-visible.

## Market-Run Stock Sale Behavior

For a market-run-only organization, the owner can now:

1. Open Sell & Dispatch.
2. Select a market-run/godown stock lot.
3. Enter party name and optional party details.
4. Enter sold meters/takas.
5. Enter sale rate.
6. Enter credit days.
7. Choose save-only or dispatch-now.
8. Confirm from preview.

No order is required.

No fake order is created.

No ledger route is reactivated.

The stock sale creates:

- `fabric_stock_sales`
- `fabric_stock_movements`
- `commercial_receivables`
- visible row through `commercial_profit_entries`
- optional `dispatches`
- optional `stock_discrepancies`

## Save Sale Only Behavior

When `dispatchNow` is false:

The system creates:

- stock sale
- stock movement
- named commercial receivable/profit entry

The system does not create:

- dispatch row
- order
- ledger entry
- invoice

Sale state:

```ts
dispatch_status = 'not_dispatched'
dispatched_meters = 0
pending_dispatch_meters = soldMeters
dispatch_id = null
```

Commercials sees the sale as an unpaid named receivable.

## Full Dispatch Behavior

When `dispatchNow` is true and:

```ts
actualDispatchedMeters === soldMeters
```

The system creates:

- stock sale
- stock movement
- dispatch row
- named commercial receivable/profit entry

Sale state:

```ts
dispatch_status = 'dispatched'
dispatched_meters = soldMeters
pending_dispatch_meters = 0
dispatch_id = dispatchId
```

Dispatch state:

```ts
order_id = null
stock_sale_id = saleId
qty_meters_sent = soldMeters
status = 'in_transit'
```

## Partial Dispatch Behavior

When `dispatchNow` is true and:

```ts
actualDispatchedMeters < soldMeters
```

The system creates:

- stock sale
- stock movement
- dispatch row
- named commercial receivable/profit entry
- pending dispatch quantity on sale

The system does not create a stock discrepancy for this intentional partial dispatch.

Sale state:

```ts
dispatch_status = 'partially_dispatched'
dispatched_meters = actualDispatchedMeters
pending_dispatch_meters = soldMeters - actualDispatchedMeters
dispatch_id = dispatchId
```

The pending dispatch quantity is available to the stock/dispatch overview.

## Discrepancy Behavior

For party-first stock sales, discrepancy creation is deferred until a real reconciliation event exists. Partial dispatch is represented with `partially_dispatched` and `pending_dispatch_meters`.

The existing lean `stock_discrepancies` table remains the right destination for true mismatches, such as order-linked dispatch reconciliation where expected and actual received quantities are distinct values.

## Order-Based Dispatch Regression Behavior

The existing order-based dispatch flow remains through:

```ts
sellAndDispatchTakas()
```

It still:

- requires an order
- validates the order
- validates selected lots
- records stock sales through `record_fabric_stock_sale`
- creates dispatch through `create_stock_sale_dispatch`
- creates discrepancies for dispatch meter differences
- returns `/track/[token]` links

The order dispatch RPC still owns order-linked dispatch behavior.

This means order-based organizations and both-mode organizations continue to work.

## Both-Mode Organization Behavior

Both-mode organizations can use both paths:

1. Order-linked dispatch through the existing order flow.
2. Party-first market stock sale through the new flow.

The UI does not force the owner into an order, but if the selected stock lot is order-linked, party data can still be derived from the linked order.

## Commercials Behavior

Commercials now shows stock sales as named receivable/profit entries.

The Commercials view receives:

- party name
- quality
- sold meters
- sale value
- cost value
- gross profit
- due date
- balance through `commercial_receivables`
- dispatch status source data through `fabric_stock_sales`

Commercial profit continues to be based on gross commercial values, not full accounting.

## Payment Status Behavior

Supported payment statuses are now:

```ts
'unpaid'
'partial'
'paid'
'overdue'
```

The implementation adds support for `overdue` at the database/type level.

It does not add a full accounting aging engine in this pass.

## Ledger Behavior

The implementation does not create, reactivate, or depend on:

```text
/owner/ledger
```

The Phase 1 archive gate remains intact.

Tests assert that ledger remains archived/deferred.

## Tests Added

Added:

```text
__tests__/p1-party-first-stock-sale-dispatch.test.ts
```

The tests cover:

- market-run stock sale without fake order
- sale without dispatch
- full dispatch
- partial dispatch
- pending dispatch calculation
- commercial receivable/profit visibility
- validation for missing party
- validation for over-selling stock
- no fake order required for market-run stock
- order-based dispatch regression
- both-mode/order path preservation
- stock discrepancy creation when actual dispatched differs
- `/owner/ledger` remains archived/deferred
- Commercials view update

## Verification Commands Run

The following commands were run:

```bash
npm run build
npx tsc --noEmit
npx vitest run
```

## Verification Results

Build:

```text
npm run build: passed
```

TypeScript:

```text
npx tsc --noEmit: passed
```

Vitest:

```text
npx vitest run: passed
```

Vitest summary:

```text
19 test files passed
138 tests passed
1 skipped
```

The build emitted existing non-blocking warnings related to Sentry instrumentation and the deprecated Next.js middleware convention. These warnings did not fail the build and are unrelated to this implementation.

## Important Implementation Notes

The party-first flow uses `create_party_stock_sale_dispatch_v1` instead of the old `record_fabric_stock_sale` RPC because the old RPC is unit/order-era oriented and does not accept party-first fields such as party name, due date, dispatch status, pending dispatch meters, or optional dispatch creation.

The old RPC path is intentionally preserved for existing order-based dispatch behavior.

The new flow uses existing tables wherever possible:

- `fabric_stock_sales`
- `fabric_stock_lots`
- `fabric_stock_movements`
- `dispatches`
- `commercial_receivables`
- `commercial_profit_entries`
- `stock_discrepancies`

Only small schema refinements were added. No new full accounting module was introduced.

## Final Behavior Summary

Market-run-only organizations can now sell stock directly to a named party without creating an order.

Order-based organizations can continue using the existing order dispatch flow.

Both-mode organizations can use both workflows.

Commercials now receives named receivable/profit entries for stock sales.

Partial dispatch and pending dispatch quantities are tracked directly on the stock sale.

Stock discrepancies are created through the existing lean discrepancy table when actual dispatch quantity differs.

The ledger remains archived/deferred.
