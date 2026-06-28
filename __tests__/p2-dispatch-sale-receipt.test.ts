import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const batch3Migration = 'supabase/migrations/20260627195152_batch_3_dispatch_sale_receipt_correctness.sql'
const batch3ContractFixMigration = 'supabase/migrations/20260628071340_batch_3_dispatch_tracking_token_contract_fix.sql'
const batch3DispatchNumberFixMigration = 'supabase/migrations/20260628073917_batch_3_dispatch_number_returning_contract_fix.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P2 Batch 3 dispatch / sale / receipt correctness', () => {
    it('persists sale and dispatch idempotency keys and wires them from client to RPC', () => {
        const migration = readProjectFile(batch3Migration)
        const dispatchActions = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const orderActions = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const sellDialog = readProjectFile('components/dispatches/SellAndDispatchDialog.tsx')
        const dispatchModal = readProjectFile('components/dispatches/DispatchModals.tsx')
        const dispatchesClient = readProjectFile('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')
        const types = readProjectFile('lib/dispatch/sell-and-dispatch-types.ts')

        expect(migration).toContain('ADD COLUMN IF NOT EXISTS idempotency_key TEXT')
        expect(migration).toContain('idx_fabric_stock_sales_org_idempotency_key')
        expect(migration).toContain('idx_dispatches_org_idempotency_key')
        expect(migration).toContain('p_idempotency_key TEXT DEFAULT NULL')
        expect(migration).toContain('AND s.idempotency_key = v_idempotency_key')
        expect(migration).toContain('AND d.idempotency_key = v_idempotency_key')

        expect(types).toContain('idempotencyKey?: string | null')
        expect(dispatchActions).toContain('p_idempotency_key: cleanText(input.idempotencyKey)')
        expect(orderActions).toContain('p_idempotency_key: idempotencyKey?.trim() || null')
        expect(sellDialog).toContain("createClientIdempotencyKey('stock-sale')")
        expect(dispatchModal).toContain("createClientIdempotencyKey('order-dispatch')")
        expect(dispatchesClient).toContain("createClientIdempotencyKey('stock-dispatch')")
    })

    it('keeps stock-sale dispatch RPCs aligned with the current dispatches schema', () => {
        const fixMigration = readProjectFile(batch3ContractFixMigration)
        const dispatchNumberFixMigration = readProjectFile(batch3DispatchNumberFixMigration)

        expect(fixMigration).toContain('CREATE OR REPLACE FUNCTION create_party_stock_sale_dispatch_v1')
        expect(fixMigration).toContain('CREATE OR REPLACE FUNCTION confirm_party_stock_sale_dispatch_v1')
        expect(fixMigration).toContain('CREATE OR REPLACE FUNCTION confirm_party_stock_sale_received_v1')
        expect(fixMigration).not.toMatch(/ADD COLUMN IF NOT EXISTS tracking_token/i)
        expect(fixMigration).not.toMatch(/^\s*tracking_token\b/m)
        expect(fixMigration).not.toMatch(/challan_number\s*\n\s*idempotency_key/)
        expect(fixMigration).not.toContain('v_tracking_token')
        expect(fixMigration).not.toContain('gen_random_bytes(9)')

        expect(dispatchNumberFixMigration).toContain('CREATE OR REPLACE FUNCTION create_party_stock_sale_dispatch_v1')
        expect(dispatchNumberFixMigration).toContain('CREATE OR REPLACE FUNCTION confirm_party_stock_sale_dispatch_v1')
        expect(dispatchNumberFixMigration).toContain('CREATE OR REPLACE FUNCTION confirm_party_stock_sale_received_v1')
        expect(dispatchNumberFixMigration).toContain('RETURNING dispatches.id, dispatches.dispatch_number INTO')
        expect(dispatchNumberFixMigration).not.toMatch(/RETURNING id, dispatch_number INTO/)
    })

    it('computes pending dispatch by explicit subtraction and keeps partial batches actionable', () => {
        const migration = readProjectFile(batch3Migration)
        const archive = readProjectFile('lib/dispatch/archive.ts')

        expect(migration).toContain('v_pending_dispatch_meters := p_sold_meters - v_actual_dispatched_meters')
        expect(migration).toContain('v_new_pending := v_sale.pending_dispatch_meters - p_dispatch_meters')
        expect(migration).toContain('v_new_pending := v_sale_row.pending_dispatch_meters - p_dispatch_meters[i]')
        expect(migration).toContain("WHEN v_pending_dispatch_meters > 0.01 THEN 'partially_dispatched'")
        expect(migration).not.toContain('GREATEST(')

        expect(archive).toContain('Math.abs(group.totalSaleMeters - group.totalDispatchedMeters)')
        expect(archive).not.toContain('Math.max(group.totalSaleMeters - group.totalDispatchedMeters, 0)')
    })

    it('gives every dispatch batch a package identity based on the persisted dispatch id', () => {
        const migration = readProjectFile(batch3Migration)

        expect(migration).toContain("upper(left(replace(v_dispatch_id::text, '-', ''), 8))")
        expect(migration).toContain("'stock-sale:' || v_sale.id::text || ':dispatch:' || v_dispatch_id::text")
        expect(migration).toContain("'stock-sale:' || v_sale_row.id::text || ':dispatch:' || v_dispatch_id::text")
        expect(migration).toContain('dispatch_package_lines')
        expect(migration).toContain('fabric_packages')
    })

    it('synchronizes receipt fields and writes at most one actionable receipt discrepancy', () => {
        const migration = readProjectFile(batch3Migration)
        const orderActions = readProjectFile('app/(dashboard)/owner/orders/actions.ts')

        expect(migration).toContain('qty_meters_received = v_received')
        expect(migration).toContain('received_meters = v_received')
        expect(migration).toContain('received_note = NULLIF')
        expect(migration).toContain('receipt_status = v_receipt_status')
        expect(migration).toContain('UPDATE party_dispatch_claims')
        expect(migration).toContain('AND package_line_id = rec.id')
        expect(migration).toContain('IF NOT FOUND THEN')
        expect(migration).toContain("ON CONFLICT (dispatch_id, source_reference)")
        expect(migration).toContain("WHERE source_reference = 'dispatch_receipt'")
        expect(migration).toContain('actual_received_meters')
        expect(migration).toContain("DO UPDATE SET\n      stock_sale_id = EXCLUDED.stock_sale_id")

        expect(orderActions).toContain('p_receipt_note: note?.trim() || null')
        expect(orderActions).toContain('received_meters: resultQty')
        expect(orderActions).toContain('receipt_status: Math.abs')
    })

    it('blocks negative and zero receipt quantities at owner entry points', () => {
        const migration = readProjectFile(batch3Migration)
        const orderActions = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const dispatchesClient = readProjectFile('app/(dashboard)/owner/dispatches/DispatchesClient.tsx')

        expect(migration).toContain('IF v_received <= 0 THEN')
        expect(migration).toContain('Enter a valid received quantity greater than 0')
        expect(orderActions).toContain('qtyReceived <= 0')
        expect(orderActions).toContain('receivedMeters <= 0')
        expect(dispatchesClient).toContain('qty <= 0')
        expect(dispatchesClient).toContain('min="0.01"')
    })

    it('uses Factory Today canonical pending dispatch and unresolved receipt queues', () => {
        const todayActions = readProjectFile('app/(dashboard)/owner/today/actions.ts')

        expect(todayActions).toContain('pending_dispatch_meters')
        expect(todayActions).toContain(".gt('pending_dispatch_meters', 0)")
        expect(todayActions).not.toContain(".is('dispatch_id', null)")
        expect(todayActions).toContain('receipt_status')
        expect(todayActions).toContain(".or('status.eq.in_transit,receipt_status.eq.difference_reported')")
        expect(todayActions).toContain('partyName: String(raw.party_name || orderTyped?.party_name ||')
        expect(todayActions).toContain('meters: toNum(raw.pending_dispatch_meters)')
    })
})
