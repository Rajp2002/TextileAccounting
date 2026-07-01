import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migrationPath = 'supabase/migrations/20260701105404_batch_20_payroll_rpc_kharchi_atomicity.sql'

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}`)
    expect(start).toBeGreaterThanOrEqual(0)

    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? source.length : next)
}

describe('Batch 20 payroll RPC hardening', () => {
    const migration = readProjectFile(migrationPath)
    const payrollActions = readProjectFile('app/(dashboard)/owner/payroll/actions.ts')
    const toggleWorkerPaid = functionBody(payrollActions, 'toggleWorkerPaid')

    it('revokes legacy settlement and unsettlement overloads from callable API roles', () => {
        expect(migration).toContain('to_regprocedure(v_identity)')
        expect(migration).toContain('public.settle_worker_payroll(uuid,text,bigint,text,numeric)')
        expect(migration).toContain('public.settle_worker_payroll(uuid,text,bigint,text,numeric,boolean,uuid)')
        expect(migration).toContain('public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid)')
        expect(migration).toContain('public.settle_worker_payroll(uuid,text,bigint,date,numeric,boolean,numeric,uuid,text)')
        expect(migration).toContain('public.unsettle_worker_payroll(uuid,text,bigint,text)')
        expect(migration).toContain('public.unsettle_worker_payroll(uuid,text,bigint,text,uuid)')
        expect(migration).toContain('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated, service_role')
    })

    it('routes settlement through an owner-scoped hardened wrapper', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.assert_payroll_owner_actor')
        expect(migration).toContain('v_role IS DISTINCT FROM')
        expect(migration).toContain("p_payment_mode NOT IN ('cash', 'bank_transfer', 'upi', 'cheque')")
        expect(migration).toContain('p_verified_by_owner IS NOT TRUE')
        expect(migration).toContain('RETURN public.settle_worker_payroll(')
        expect(toggleWorkerPaid).toContain("supabase.rpc('settle_worker_payroll_hardened'")
    })

    it('validates and consumes the access code inside the reversal transaction', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.consume_payroll_reversal_access_code')
        expect(migration).toContain("v_code !~ '^[A-Z0-9]{6}$'")
        expect(migration).toContain("ENCODE(digest(v_code, 'sha256'), 'hex')")
        expect(migration).toContain('access_code_hash = NULL')
        expect(migration).toContain("set_config('app.access_code_used', 'true', true)")
        expect(migration).toContain("RAISE EXCEPTION '%', COALESCE(v_result ->> 'error'")
        expect(migration).toContain("is_access_code_used")
        expect(migration).toContain("'UPDATE',")
        expect(migration).not.toContain("'payroll.unsettle'")
        expect(toggleWorkerPaid).toContain("supabase.rpc('unsettle_worker_payroll_hardened'")
        expect(toggleWorkerPaid).toContain('p_access_code: reversalAccessCode')
    })
})

describe('Batch 20 Kharchi atomicity', () => {
    const migration = readProjectFile(migrationPath)
    const supervisorActions = readProjectFile('app/(dashboard)/supervisor/actions.ts')
    const recordKharchi = functionBody(supervisorActions, 'recordKharchi')

    it('records worker advance and float transaction in one RPC transaction', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.record_supervisor_kharchi')
        expect(migration).toContain('pg_advisory_xact_lock')
        expect(migration).toContain('IF v_balance < p_amount THEN')
        expect(migration).toContain('INSERT INTO public.worker_advances')
        expect(migration).toContain('RETURNING id INTO v_advance_id')
        expect(migration).toContain('INSERT INTO public.supervisor_float_transactions')
        expect(migration).toContain('worker_advance_id')
        expect(migration).toContain('RETURNING id INTO v_float_transaction_id')
    })

    it('routes the supervisor action through the atomic RPC and removes split inserts', () => {
        expect(recordKharchi).toContain("supabase.rpc('record_supervisor_kharchi'")
        expect(recordKharchi).not.toContain(".from('worker_advances')")
        expect(recordKharchi).not.toContain(".from('supervisor_float_transactions').insert")
        expect(recordKharchi).not.toContain('floatErr')
        expect(recordKharchi).toContain("Failed to record kharchi atomically")
    })
})
