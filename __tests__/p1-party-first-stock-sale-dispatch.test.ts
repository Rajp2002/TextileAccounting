import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 party-first stock sale dispatch refinement', () => {


    it('snapshots cost, gross profit inputs, credit terms, and named receivables', () => {
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        const receivables = readProjectFile('lib/commercials/receivables.ts')
        expect(migration).toContain('v_lot.cost_per_meter')
        expect(migration).toContain('v_due_date := p_sale_date + COALESCE(p_credit_days, 0)')
        expect(migration).toContain('credit_days')
        expect(migration).toContain('commercial_receivables')
        expect(receivables).toContain('sale.party_name || order?.party_name')
        expect(receivables).not.toContain("|| 'Anonymous'")
    })


    it('validates over-selling with guarded atomic stock decrement', () => {
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION create_party_stock_sale_dispatch_v1')
        expect(migration).toContain('UPDATE fabric_stock_lots')
        expect(migration).toContain('available_meters >= p_sold_meters')
        expect(migration).toContain('(p_sold_takas IS NULL OR available_taka_count >= p_sold_takas)')
        expect(migration).toContain("RAISE EXCEPTION 'Cannot sell more than available stock'")
    })



    it('keeps ledger archived and updates commercials through the existing lightweight view', () => {
        const phaseScope = readProjectFile('lib/phase1-scope.ts')
        const migration = readProjectFile('supabase/migrations/20260517090000_party_first_stock_sale_dispatch.sql')
        expect(phaseScope).toContain("'/owner/ledger'")
        expect(migration).toContain('CREATE OR REPLACE VIEW commercial_profit_entries')
        expect(migration).toContain('commercial_receivables_payment_status_check')
        expect(migration).toContain("'overdue'")
    })



    it('verifies direct receipt confirmation, deferring credit due date, and tracking removal', () => {
        const action = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const migration = readProjectFile('supabase/migrations/20260530210000_confirm_party_stock_sale_dispatch.sql')
        const receiptMigration = readProjectFile('supabase/migrations/20260530211000_confirm_stock_sale_dispatch_receipt.sql')
        const dispatchesClient = readProjectFile('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')
        const ordersClient = readProjectFile('app/(dashboard)/owner/orders/OrdersClient.tsx')

        // Check backend server actions and RPC definitions
        expect(action).toContain('confirmPendingSaleReceived')
        expect(action).toContain('confirmPendingSaleDispatch')
        expect(action).toContain('confirm_stock_sale_dispatch_receipt_v1')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION confirm_party_stock_sale_received_v1')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION confirm_party_stock_sale_dispatch_v1')
        expect(migration).toContain('v_due_date := p_dispatch_date + COALESCE(')
        expect(receiptMigration).toContain('CREATE OR REPLACE FUNCTION confirm_stock_sale_dispatch_receipt_v1')

        // Check client UI button presence and Track Portal removal
        expect(dispatchesClient).not.toContain('Confirmation Received')
        expect(dispatchesClient).not.toContain('confirmMode === \'received\'')
        expect(dispatchesClient).not.toContain('Track Portal')
        expect(ordersClient).not.toContain('Share Link')
        expect(ordersClient).not.toContain('Share Tracking Link')
    })

    it('verifies configurable batch dispatch quantities and dates support', () => {
        const action = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const migration = readProjectFile('supabase/migrations/20260531010000_configurable_batch_dispatch.sql')
        const modal = readProjectFile('components/dispatches/DispatchModals.tsx')

        // Check backend server action
        expect(action).toContain('dispatchMeters?: Record<string, number>')
        expect(action).toContain('dispatchTakas?: Record<string, number>')
        expect(action).toContain('dispatchDate?: string')
        expect(action).toContain('challanNumber?: string')
        expect(action).toContain("p_dispatch_meters: finalMeters")
        expect(action).toContain("p_dispatch_takas: finalTakas")
        expect(action).toContain("p_dispatch_date: finalDispatchDate")
        expect(action).toContain('.update({ challan_number: cleanedChallanNumber })')

        // Check SQL function signature
        expect(migration).toContain('CREATE OR REPLACE FUNCTION create_stock_sale_dispatch')
        expect(migration).toContain('p_dispatch_meters NUMERIC[]')
        expect(migration).toContain('p_dispatch_takas NUMERIC[]')
        expect(migration).toContain('p_dispatch_date DATE')

        // Check UI component features
        expect(modal).toContain('const [dispatchDate, setDispatchDate]')
        expect(modal).toContain('const [customMeters, setCustomMeters]')
        expect(modal).toContain('const [customTakas, setCustomTakas]')
        expect(modal).toContain('const [challanNumber, setChallanNumber]')
        expect(modal).toContain('dispatchMetersObj')
        expect(modal).toContain('dispatchTakasObj')
        expect(modal).not.toContain('Create & Download Invoice')
    })

    it('groups multiple batches for the same party stock sale and shows sale progress', () => {
        const action = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const dispatchesClient = readProjectFile('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')
        const receiptMigration = readProjectFile('supabase/migrations/20260531020000_keep_partial_stock_sale_receipt_pending.sql')

        expect(action).toContain('stock_sale_id')
        expect(action).toContain('stock_sale:fabric_stock_sales!dispatches_stock_sale_id_fkey')
        expect(action).toContain('id: stockSale?.id ?? row.stock_sale_id ?? row.id')
        expect(action).toContain('total_target_meters: stockSale?.meters_sold ?? row.qty_meters_sent')

        expect(dispatchesClient).toContain('const groupId = d.stock_sale?.id ?? d.stock_sale_id ?? d.orders.id')
        expect(dispatchesClient).toContain('remainingToDispatch')
        expect(dispatchesClient).toContain('Confirmed')
        expect(dispatchesClient).toContain('Remaining')

        expect(receiptMigration).toContain("WHEN pending_dispatch_meters > 0.01 THEN 'partially_dispatched'")
        expect(receiptMigration).toContain("AND d.stock_sale_id = v_sale.id")
    })

})
