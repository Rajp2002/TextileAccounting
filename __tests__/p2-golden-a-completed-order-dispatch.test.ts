import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('P2 Golden A completed order dispatch closure', () => {
    it('keeps order dispatch aligned after production auto-completes an order', () => {
        const completionGuard = readProjectFile('supabase/migrations/20260416140000_order_completion_guard.sql')
        const dispatchAction = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const orderAction = readProjectFile('app/(dashboard)/owner/orders/actions.ts')
        const migration = readProjectFile('supabase/migrations/20260628183500_batch_6_allow_completed_order_stock_dispatch.sql')
        const returningFix = readProjectFile('supabase/migrations/20260628185344_batch_6_qualify_completed_order_dispatch_returning.sql')

        expect(completionGuard).toContain('CREATE OR REPLACE FUNCTION auto_complete_order_on_log')
        expect(completionGuard).toContain("SET status = 'completed'")

        expect(dispatchAction).toContain("order.status !== 'active' && order.status !== 'completed'")
        expect(orderAction).toContain("create_stock_sale_dispatch")

        expect(migration).toContain("IF v_status NOT IN ('active', 'completed') THEN")
        expect(migration).toContain("RAISE EXCEPTION 'Can only dispatch against active or completed orders'")
        expect(migration).not.toContain('Cannot dispatch from a completed or cancelled order')

        expect(returningFix).toContain("IF v_status NOT IN (''active'', ''completed'') THEN")
        expect(returningFix).toContain('RETURNING dispatches.id, dispatches.dispatch_number INTO v_dispatch_id, v_dispatch_number;')
    })
})
