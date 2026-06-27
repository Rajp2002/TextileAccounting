import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = 'supabase/migrations/20260626064830_production_stock_atomicity.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('P1 production correction and generated stock atomicity', () => {
    const migration = readProjectFile(migrationPath)
    const supervisorAction = functionBody(
        readProjectFile('app/(dashboard)/supervisor/actions.ts'),
        'bulkLogProduction'
    )

    it('moves generated stock reconciliation into production replacement transaction', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION replace_shift_production_logs')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION reconcile_generated_stock_for_production_grain')
        expect(migration).toContain('weavly_affected_production_grains')
        expect(migration).toContain('FROM production_logs pl')
        expect(migration).toContain('JOIN weavly_shift_logs l ON l.machine_id = pl.machine_id')
        expect(migration).toContain('SELECT DISTINCT v_org_id, order_id, date, shift')
        expect(migration).toContain('FROM reconcile_generated_stock_for_production_grain(')

        expect(supervisorAction).toContain("supabase.rpc('replace_shift_production_logs'")
        expect(supervisorAction).not.toContain("supabase.rpc('create_or_refresh_stock_inward_draft'")
        expect(supervisorAction).not.toContain('producedOrderIds')
    })

    it('uses the order/date/shift source grain and reconciles old removed orders', () => {
        expect(migration).toContain('PRIMARY KEY (org_id, order_id, source_date, source_shift)')
        expect(migration).toContain('WHERE org_id = p_org_id')
        expect(migration).toContain('AND order_id = p_order_id')
        expect(migration).toContain('AND source_date = p_source_date')
        expect(migration).toContain('AND source_shift = p_source_shift')
        expect(migration).toContain('INSERT INTO weavly_affected_production_grains (org_id, order_id, source_date, source_shift)')
        expect(migration).toContain('AND pl.order_id IS NOT NULL')
    })

    it('aggregates multiple looms per order/date/shift and keeps shifts independent', () => {
        expect(migration).toContain('SUM(CASE WHEN pl.meters > 0 THEN pl.meters ELSE 0 END)')
        expect(migration).toContain('AND pl.order_id = p_order_id')
        expect(migration).toContain('AND pl.date = p_source_date')
        expect(migration).toContain('AND pl.shift = p_source_shift')
        expect(migration).toContain("IF p_source_shift NOT IN ('day','night') THEN")
    })

    it('reverses corrected-away production stock exactly once', () => {
        expect(migration).toContain("v_previous_meters := CASE WHEN v_draft.status = 'confirmed'")
        expect(migration).toContain("status = 'dismissed'")
        expect(migration).toContain('Expected production stock reversed because current valid production for this order/date/shift is zero.')
        expect(migration).toContain("WHEN v_delta_meters >= 0 THEN 'inward' ELSE 'adjustment_subtract'")
        expect(migration).toContain('Production correction reversed generated expected stock in the same transaction as production logs.')
        expect(migration).toContain('IF v_stock_lot_id IS NOT NULL AND ABS(v_delta_meters) > 0.01 THEN')
    })

    it('blocks sold or dispatched stock instead of clamping unsafe reductions', () => {
        expect(migration).toContain('v_has_dispatch')
        expect(migration).toContain('v_meters + 0.01 < v_sold_meters')
        expect(migration).toContain('already been sold/dispatched')
        expect(migration).toContain('already been dispatched or received')
        expect(migration).toContain('owner-authorized stock adjustment/manual resolution')
        expect(migration).not.toContain('GREATEST(0, available_meters + v_delta_meters)')
        expect(migration).not.toContain('GREATEST(0, original_meters + v_delta_meters)')
        expect(migration).not.toContain('GREATEST(0, available_taka_count + v_delta_units)')
    })

    it('keeps sale races serialized on the stock lot row', () => {
        expect(migration).toContain('FROM fabric_stock_lots')
        expect(migration).toContain('FOR UPDATE')
        expect(migration).toContain('FROM fabric_stock_sales s')
        expect(migration).toContain('WHERE s.stock_lot_id = v_lot.id')
        expect(migration).toContain('FROM dispatches d')
        expect(migration).toContain('WHERE d.stock_sale_id = s.id')
    })

    it('keeps dashboard and stock readers on reconciled source tables/views', () => {
        const stockActions = readProjectFile('app/(dashboard)/owner/stock/actions.ts')
        const dispatchActions = readProjectFile('app/(dashboard)/owner/dispatches/actions.ts')
        const todayActions = readProjectFile('app/(dashboard)/owner/today/actions.ts')

        expect(stockActions).toContain(".from('fabric_stock_lot_summary')")
        expect(dispatchActions).toContain(".from('fabric_stock_lot_summary')")
        expect(todayActions).toContain(".from('production_logs')")
        expect(todayActions).toContain(".from('order_progress_summary')")
        expect(todayActions).toContain('total_meters_produced')
        expect(todayActions).not.toContain('produced_meters')
        expect(todayActions).toContain(".from('market_run_summary')")
    })

    it('keeps the order progress read-model contract aligned with Factory Today', () => {
        const progressMigration = readProjectFile('supabase/migrations/20260416120000_update_order_progress_view_worker_rate.sql')
        const todayActions = readProjectFile('app/(dashboard)/owner/today/actions.ts')

        expect(progressMigration).toContain('AS total_meters_produced')
        expect(todayActions).toContain("select('order_id, party_name, quality_label, total_target_meters, total_meters_produced, deadline, status')")
        expect(todayActions).toContain('const producedMeters = toNum(order.total_meters_produced)')
    })
})
