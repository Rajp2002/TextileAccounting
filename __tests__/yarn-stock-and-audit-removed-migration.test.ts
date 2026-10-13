import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// Yarn Stock and the Stock Audit were deleted on 2026-10-14, data included. The migration rewrites the three shared
// functions without their yarn and lot parts and drops everything else.
const MIGRATION = 'supabase/migrations/20261014120000_remove_yarn_stock_and_stock_audit.sql'
const read = () => readFileSync(MIGRATION, 'utf8')

const DROPPED_FUNCTIONS = [
    'public.mutate_yarn_stock(uuid, text, jsonb)',
    'public.get_yarn_stock_board(date, uuid, timestamptz, uuid)',
    'public.validate_quality_activation_yarn(uuid)',
    'private.move_dispatch_yarn_stock()',
    'public.get_inventory_audit_data(date, uuid)',
    'public.create_inventory_audit_draft(date, text, text)',
    'public.record_inventory_audit_count(uuid, text, uuid, numeric, text)',
    'public.apply_inventory_audit_adjustment(uuid, text, uuid, numeric, text, numeric)',
    'public.finalize_inventory_audit(uuid)',
    'private.yarn_costing_recipe(jsonb)',
]
const DROPPED_TABLES = [
    'public.inventory_audit_lines', 'public.inventory_audits', 'public.delivery_challan_lot_allocations', 'public.production_stock_lots',
    'public.yarn_stock_movements', 'public.yarn_stock_requests', 'public.yarn_stock_recipes', 'public.yarn_stock', 'public.yarn_stock_settings',
]
const REWRITTEN = ['private.reconcile_quality_stock', 'public.activate_saved_costing_for_production', 'public.mutate_delivery_challan']

describe('yarn stock and stock audit removal migration', () => {
    it('drops every yarn stock and stock audit function, yarn_costing_recipe last', () => {
        const sql = read()
        const positions = DROPPED_FUNCTIONS.map(signature => {
            const at = sql.indexOf(`DROP FUNCTION IF EXISTS ${signature};`)
            expect(at, signature).toBeGreaterThan(-1)
            return at
        })
        expect(Math.max(...positions)).toBe(positions.at(-1))
    })

    it('drops the nine tables in dependency order, without CASCADE', () => {
        const sql = read()
        const positions = DROPPED_TABLES.map(table => {
            const at = sql.indexOf(`DROP TABLE IF EXISTS ${table};`)
            expect(at, table).toBeGreaterThan(-1)
            return at
        })
        expect([...positions].sort((a, b) => a - b)).toEqual(positions)
        expect(sql.replace(/--.*$/gm, '')).not.toMatch(/CASCADE/i)
    })

    it('drops the yarn recipe column on production jobs', () => {
        expect(read()).toContain('ALTER TABLE public.base_production_jobs DROP COLUMN IF EXISTS yarn_recipe_snapshot;')
    })

    it('rewrites exactly the three shared functions', () => {
        const created = [...read().matchAll(/CREATE OR REPLACE FUNCTION ([\w.]+)\(/g)].map(match => match[1])
        expect(created).toEqual(REWRITTEN)
    })

    it('leaves nothing in the rewritten functions that touches yarn, lots or audits', () => {
        const body = read()
            .replace(/--.*$/gm, '')
            .replace(/^\s*DROP (FUNCTION|TABLE) IF EXISTS [^;]+;/gm, '')
            .replace(/^\s*ALTER TABLE public\.base_production_jobs DROP COLUMN IF EXISTS yarn_recipe_snapshot;/m, '')
        for (const pattern of [/yarn_stock/, /production_stock_lots/, /lot_allocations/, /yarn_recipe_snapshot/, /yarn_costing_recipe/, /inventory_audit/]) {
            expect(body).not.toMatch(pattern)
        }
    })

    it('pins search_path and re-issues grants for each rewritten function', () => {
        const sql = read()
        for (const name of REWRITTEN) {
            const start = sql.indexOf(`CREATE OR REPLACE FUNCTION ${name}(`)
            const end = sql.indexOf('$$;', sql.indexOf('AS $$', start))
            expect(sql.slice(start, end)).toMatch(/SET search_path = pg_catalog, public, private/)
            expect(sql.indexOf(`REVOKE ALL ON FUNCTION ${name}(`, end)).toBeGreaterThan(end)
        }
    })

    it('is one transaction that reloads the PostgREST schema', () => {
        const sql = read()
        expect(sql).toMatch(/^BEGIN;$/m)
        expect(sql).toMatch(/NOTIFY pgrst, 'reload schema';\s*COMMIT;\s*$/)
    })
})
