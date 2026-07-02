import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = 'supabase/migrations/20260702121238_batch_22_production_order_boundary_hardening.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`CREATE OR REPLACE FUNCTION ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nCREATE OR REPLACE FUNCTION ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('Batch 22 production/order boundary hardening migration', () => {
    const migration = readProjectFile(migrationPath)
    const replaceShiftProductionLogs = functionBody(migration, 'replace_shift_production_logs')

    it('adds a non-destructive table boundary for negative meters', () => {
        expect(migration).toContain('production_logs_meters_nonnegative')
        expect(migration).toContain('CHECK (meters >= 0)')
        expect(migration).toContain('NOT VALID')
        expect(migration).toContain('Production meters cannot be negative.')
    })

    it('keeps direct production log writes behind the same order boundary', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.enforce_production_log_order_boundary')
        expect(migration).toContain('CREATE TRIGGER trg_production_log_order_boundary')
        expect(migration).toContain("v_order.status IS DISTINCT FROM 'active'")
        expect(migration).toContain("v_machine.status IS DISTINCT FROM 'active'")
        expect(migration).toContain('v_machine.current_order_id IS DISTINCT FROM v_guard_order_id')
        expect(migration).toContain('Production would exceed order target.')
    })

    it('blocks cancelled/completed or stale-assignment RPC order-attributed logs before replacement', () => {
        expect(replaceShiftProductionLogs).toContain("WHERE meters < 0")
        expect(replaceShiftProductionLogs).toContain('WHERE l.order_id IS NOT NULL')
        expect(replaceShiftProductionLogs).toContain("o.status IS DISTINCT FROM 'active'")
        expect(replaceShiftProductionLogs).toContain("m.status IS DISTINCT FROM 'active'")
        expect(replaceShiftProductionLogs).toContain('m.current_order_id IS DISTINCT FROM l.order_id')
        expect(replaceShiftProductionLogs).toContain('Production logs for non-active orders cannot be replaced.')
    })

    it('checks over-target totals after replacing only the submitted machine/date/shift rows', () => {
        expect(replaceShiftProductionLogs).toContain('weavly_order_totals_after_replacement')
        expect(replaceShiftProductionLogs).toContain('submitted_order_totals')
        expect(replaceShiftProductionLogs).toContain('AND NOT EXISTS (')
        expect(replaceShiftProductionLogs).toContain('WHERE l.machine_id = pl.machine_id')
        expect(replaceShiftProductionLogs).toContain('totals.next_meters > COALESCE(o.total_target_meters, 0) + 0.01')
    })

    it('preserves Batch 2 generated-stock atomicity and valid status log behavior', () => {
        expect(replaceShiftProductionLogs).toContain('weavly_affected_production_grains')
        expect(replaceShiftProductionLogs).toContain('public.reconcile_generated_stock_for_production_grain')
        expect(replaceShiftProductionLogs).toContain("IF v_replaced_count > 0 AND NOT p_allow_overwrite THEN")
        expect(replaceShiftProductionLogs).toContain("WHERE meters = 0")
        expect(replaceShiftProductionLogs).toContain('Zero-meter logs require a reason.')
        expect(replaceShiftProductionLogs).toContain('CASE WHEN meters = 0 THEN zero_meter_reason ELSE NULL END')
    })

    it('keeps the supervisor server action on the hardened replacement RPC', () => {
        const supervisorActions = readProjectFile('app/(dashboard)/supervisor/actions.ts')

        expect(supervisorActions).toContain("supabase.rpc('replace_shift_production_logs'")
        expect(supervisorActions).toContain("activeOrder?.status !== 'active'")
        expect(supervisorActions).toContain('machine.current_order_id !== log.order_id')
        expect(supervisorActions).toContain('VALIDATION_MESSAGES.NEGATIVE_METERS')
        expect(supervisorActions).not.toContain(".from('production_logs').insert(logs)")
    })
})
