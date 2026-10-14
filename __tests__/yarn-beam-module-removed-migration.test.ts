import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// The March/April yarn & beam inventory module (20260319030000, 20260428130001) was deleted on 2026-10-14, data included.
const read = () => readFileSync('supabase/migrations/20261014120100_remove_yarn_beam_module.sql', 'utf8').replace(/--.*$/gm, '')

const VIEWS = ['public.yarn_lot_stock_summary', 'public.order_yarn_variance_summary']
const TABLES = ['public.beam_card_lots', 'public.yarn_movements', 'public.order_yarn_requirements', 'public.beam_cards', 'public.yarn_lots', 'public.yarn_batches']
const FUNCTIONS = ['link_batch_to_machine', 'settle_batch_audit', 'get_yield_alert', 'get_batch_yield_report', 'get_daily_brief_stats', 'get_kpi_yesterday', 'start_party_order_from_estimator', 'start_party_order_from_estimator_v2']

describe('yarn & beam module removal migration', () => {
    it('drops every overload of the module functions first', () => {
        const sql = read()
        const block = sql.slice(sql.indexOf('DO $$'), sql.indexOf('END $$;'))
        expect(block).toMatch(/FROM pg_proc/)
        expect(block).toMatch(/pronamespace = 'public'::regnamespace/)
        expect(block).toMatch(/DROP FUNCTION/)
        for (const name of FUNCTIONS) expect(block, name).toContain(`'${name}'`)
    })

    it('drops the views, then the tables children first, with no CASCADE', () => {
        const sql = read()
        const order = [...VIEWS.map(view => `DROP VIEW IF EXISTS ${view};`), ...TABLES.map(table => `DROP TABLE IF EXISTS ${table};`)]
        const positions = order.map(statement => {
            const at = sql.indexOf(statement)
            expect(at, statement).toBeGreaterThan(-1)
            return at
        })
        expect([...positions].sort((a, b) => a - b)).toEqual(positions)
        expect(sql).not.toMatch(/CASCADE/i)
    })

    it('drops the yarn batch column on production logs before its table', () => {
        const sql = read()
        const column = sql.indexOf('ALTER TABLE public.production_logs DROP COLUMN IF EXISTS yarn_batch_id;')
        expect(column).toBeGreaterThan(-1)
        expect(column).toBeLessThan(sql.indexOf('DROP TABLE IF EXISTS public.yarn_batches;'))
    })

    it('is one transaction that reloads the PostgREST schema', () => {
        const sql = read()
        expect(sql).toMatch(/^BEGIN;$/m)
        expect(sql).toMatch(/NOTIFY pgrst, 'reload schema';\s*COMMIT;\s*$/)
    })

    it('ends by refusing to commit while any function still names a deleted object', () => {
        const sql = read()
        const guard = sql.slice(sql.lastIndexOf('DO $$'), sql.lastIndexOf('END $$;'))
        expect(sql.lastIndexOf('DO $$')).toBeGreaterThan(sql.indexOf('DROP TABLE IF EXISTS public.yarn_batches;'))
        expect(guard).toMatch(/FROM pg_proc/)
        expect(guard).toMatch(/prosrc/)
        expect(guard).toMatch(/RAISE EXCEPTION/)
        for (const name of ['yarn_stock', 'inventory_audits', 'production_stock_lots', 'delivery_challan_lot_allocations', 'yarn_lots', 'yarn_batches', 'beam_cards', 'yarn_recipe_snapshot', 'yarn_costing_recipe']) {
            expect(guard, name).toContain(name)
        }
    })
})
