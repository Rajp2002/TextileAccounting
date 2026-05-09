import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('P0 quote-to-order atomicity guard', () => {
    const migration = readProjectFile('supabase/migrations/20260509140000_p0_atomic_quote_and_production.sql')
    const action = functionBody(
        readProjectFile('app/(dashboard)/owner/estimator/actions.ts'),
        'convertAcceptedQuoteToOrder'
    )

    it('uses a row-locked RPC plus unique quote/order guards for concurrent conversion', () => {
        expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_quote_id_unique')
        expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_estimator_quotes_order_id_unique')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION convert_accepted_quote_to_order')
        expect(migration).toContain('FOR UPDATE')
        expect(migration).toContain('GET DIAGNOSTICS v_updated_count = ROW_COUNT')
        expect(migration).toContain('WHEN unique_violation THEN')
    })

    it('delegates conversion to the RPC and returns a safe duplicate error', () => {
        expect(action).toContain("supabase.rpc(\n        'convert_accepted_quote_to_order'")
        expect(action).toContain('This quote has already been converted into an order.')
        expect(action).not.toContain(".from('orders')\n        .insert")
    })
})

describe('P0 production-log atomicity guard', () => {
    const migration = readProjectFile('supabase/migrations/20260509140000_p0_atomic_quote_and_production.sql')
    const action = functionBody(
        readProjectFile('app/(dashboard)/supervisor/actions.ts'),
        'bulkLogProduction'
    )

    it('enforces one authoritative production log per machine/date/shift', () => {
        expect(migration).toContain('CREATE UNIQUE INDEX IF NOT EXISTS idx_production_logs_one_machine_shift')
        expect(migration).toContain('ON production_logs(org_id, machine_id, date, shift)')
        expect(migration).toContain('CREATE OR REPLACE FUNCTION replace_shift_production_logs')
        expect(migration).toContain('pg_advisory_xact_lock')
        expect(migration).toContain("RAISE EXCEPTION 'DUPLICATE_LOG_DETECTED'")
    })

    it('keeps correction behavior intentional and audited inside the RPC', () => {
        expect(migration).toContain('p_allow_overwrite BOOLEAN DEFAULT FALSE')
        expect(migration).toContain("action,\n      old_data,\n      new_data")
        expect(migration).toContain("'shift_self_correction'")
        expect(migration).toContain('DELETE FROM production_logs pl')
        expect(migration).toContain('INSERT INTO production_logs')
    })

    it('uses the RPC instead of app-side delete-then-insert for duplicate submissions', () => {
        expect(action).toContain("supabase.rpc('replace_shift_production_logs'")
        expect(action).toContain("error: 'DUPLICATE_LOG_DETECTED'")
        expect(action).not.toContain(".from('production_logs').insert(logs)")
        expect(action).not.toContain(".from('production_logs')\n            .delete()")
    })
})
