import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P1 party-first stock sale dispatch refinement', () => {
    it('supports market-run stock sale without a fake order', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        expect(action).toContain('createPartyStockSaleAndOptionalDispatch')
        expect(action).toContain("return { success: false, stage: 'validation', message: 'Party name is required' }")
        expect(migration).toContain('order_id,')
        expect(migration).toContain('NULL,')
        expect(migration).toContain('party_name')
        expect(migration).toContain("NULLIF(btrim(p_party_name), '')")
    })

    it('supports save-only, full dispatch, partial dispatch, and pending dispatch meters', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        expect(action).toContain("dispatchNow")
        expect(action).toContain("create_party_stock_sale_dispatch_v1")
        expect(action).toContain('pendingDispatchMeters')
        expect(migration).toContain("WHEN NOT p_dispatch_now THEN 'not_dispatched'")
        expect(migration).toContain("WHEN v_actual_dispatched_meters + 0.01 < p_sold_meters THEN 'partially_dispatched'")
        expect(migration).toContain("ELSE 'dispatched'")
        expect(migration).toContain('v_pending_dispatch_meters := GREATEST(p_sold_meters - v_actual_dispatched_meters, 0)')
    })

    it('snapshots cost, gross profit inputs, credit terms, and named receivables', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        const receivables = readProjectFile('lib/commercials/receivables.ts')
        expect(migration).toContain('v_lot.cost_per_meter')
        expect(migration).toContain('v_due_date := p_sale_date + COALESCE(p_credit_days, 0)')
        expect(migration).toContain('credit_days')
        expect(migration).toContain('commercial_receivables')
        expect(receivables).toContain('sale.party_name || order?.party_name')
        expect(receivables).not.toContain("|| 'Anonymous'")
    })

    it('keeps partial dispatch out of stock discrepancy creation', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const partyFirstAction = action
            .split('export async function createPartyStockSaleAndOptionalDispatch')[1]
            .split('export async function sellAndDispatchTakas')[0]
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        expect(partyFirstAction).not.toContain("stock_discrepancies")
        expect(migration).not.toContain('stock_discrepancies')
        expect(migration).not.toContain("'discrepancy'")
    })

    it('validates over-selling with guarded atomic stock decrement', () => {
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION create_party_stock_sale_dispatch_v1')
        expect(migration).toContain('UPDATE fabric_stock_lots')
        expect(migration).toContain('available_meters >= p_sold_meters')
        expect(migration).toContain('(p_sold_takas IS NULL OR available_taka_count >= p_sold_takas)')
        expect(migration).toContain("RAISE EXCEPTION 'Cannot sell more than available stock'")
    })

    it('allows sold takas to be optional when sold meters are provided', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const dialog = readProjectFile('components/dispatches/SellAndDispatchDialog.tsx')
        const migration = readProjectFile('supabase/migrations/20260517103000_harden_party_stock_sale_dispatch_rpc.sql')
        expect(action).toContain('p_sold_takas: soldTakas')
        expect(dialog).toContain('Sold takas <span')
        expect(dialog).toContain('Leave blank if unknown')
        expect(migration).toContain('p_sold_takas NUMERIC')
        expect(migration).toContain('COALESCE(p_sold_takas')
    })

    it('keeps the order-based dispatch RPC path for order and both-mode regressions', () => {
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        expect(action).toContain('export async function sellAndDispatchTakas')
        expect(action).toContain("supabase.rpc('create_stock_sale_dispatch'")
        expect(action).toContain('p_order_id: input.orderId')
    })

    it('keeps ledger archived and updates commercials through the existing lightweight view', () => {
        const phaseScope = readProjectFile('lib/phase1-scope.ts')
        const migration = readProjectFile('supabase/migrations/20260517090000_party_first_stock_sale_dispatch.sql')
        expect(phaseScope).toContain("'/owner/ledger'")
        expect(migration).toContain('CREATE OR REPLACE VIEW commercial_profit_entries')
        expect(migration).toContain('commercial_receivables_payment_status_check')
        expect(migration).toContain("'overdue'")
    })

    it('uses production wording for booked profit, due date basis, and available-for-sale stock', () => {
        const dialog = readProjectFile('components/dispatches/SellAndDispatchDialog.tsx')
        const stock = readProjectFile('app/(dashboard)/owner/stock/TakaStockClient.tsx')
        const commercials = readProjectFile('app/(dashboard)/owner/commercials/CommercialsClient.tsx')
        expect(dialog).toContain('Due date based on sale date')
        expect(stock).toContain('Available for sale')
        expect(stock).toContain('Sold Pending Dispatch')
        expect(commercials).toContain('Booked Gross Profit')
        expect(commercials).not.toMatch(/profit received/i)
    })

    it('keeps sales meter-first and treats takas as optional display metadata', () => {
        const dialog = readProjectFile('components/dispatches/SellAndDispatchDialog.tsx')
        const stock = readProjectFile('app/(dashboard)/owner/stock/TakaStockClient.tsx')
        const action = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        expect(dialog).toContain('optional display count')
        expect(dialog).toContain('Meters reserve stock. Taka count is only adjusted when entered.')
        expect(stock).toContain('Sell by Meters')
        expect(stock).toContain('approx ${stockUnits')
        expect(stock).not.toContain('positiveWholeInput')
        expect(action).toContain(".gt('available_meters', 0)")
    })
})
