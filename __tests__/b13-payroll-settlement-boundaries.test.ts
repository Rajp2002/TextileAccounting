import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (file: string) => readFileSync(join(root, file), 'utf8')
const migration = read('supabase/migrations/20260714043000_b13_harden_payroll_settlement_lifecycle.sql')
const actions = read('app/(dashboard)/owner/payroll/actions.ts')
const client = read('app/(dashboard)/owner/payroll/PayrollClient.tsx')
const todayActions = read('app/(dashboard)/owner/today/actions.ts')

describe('B13 payroll settlement lifecycle boundaries', () => {
    it('serializes one worker and cycle before checking for an existing settlement', () => {
        const lock = migration.indexOf('pg_advisory_xact_lock')
        const existing = migration.indexOf("RAISE EXCEPTION 'Payroll is already settled for this worker and cycle.'")
        const settle = migration.indexOf('RETURN public.settle_worker_payroll(')

        expect(lock).toBeGreaterThan(0)
        expect(existing).toBeGreaterThan(lock)
        expect(settle).toBeGreaterThan(existing)
        expect(migration).toContain("p_org_id::text || ':payroll:' || p_worker_type")
    })

    it('protects deducted and settlement-linked advances while permitting the authorized reversal transaction', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.protect_settled_worker_advance_delete')
        expect(migration).toContain("OLD.status = 'deducted'")
        expect(migration).toContain('OLD.settlement_id IS NOT NULL')
        expect(migration).toContain('OLD.origin_settlement_id IS NOT NULL')
        expect(migration).toContain("set_config('app.payroll_reversal', 'true', true)")
        expect(migration).toContain("current_setting('app.payroll_reversal', true)")
    })

    it('settles and deactivates an exiting worker in one database transaction', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.settle_exiting_worker_payroll_hardened')
        expect(migration).toContain('v_result := public.settle_worker_payroll_hardened(')
        expect(migration).toContain('UPDATE public.workers')
        expect(migration).toContain('UPDATE public.fixed_workers')
        expect(migration).toContain("'worker_deactivated', true")
        expect(actions).toContain("supabase.rpc('settle_exiting_worker_payroll_hardened'")
        expect(actions).toContain('deactivateAfterExit: boolean = false')
        expect(client).toContain('deactivateAfterExit: !!pendingSettleWorker.deactivateAfterExit')
        expect(client).not.toContain('await setWorkerActiveStatus(')
    })

    it('loads Factory Today market progress from the deployed summary column', () => {
        expect(todayActions).toContain(".select('market_run_id, fabric_label, quality_label, target_meters, total_meters_produced, status')")
        expect(todayActions).toContain('producedMeters: toNum(run.total_meters_produced)')
        expect(todayActions).not.toContain('producedMeters: toNum(run.meters_produced)')
    })
})
