import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const migration = readFileSync(
    join(root, 'supabase/migrations/20260709080948_machine_operator_payroll_v2.sql'),
    'utf8'
)

describe('machine operator payroll migration', () => {
    it('adds split-table-safe assignment constraints and production snapshots', () => {
        expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.machine_operator_assignments')
        expect(migration).toContain('worker_type TEXT NOT NULL CHECK')
        expect(migration).toContain('machine_operator_assignments_exactly_one_worker')
        expect(migration).toContain('machine_operator_assignments_pay_mode_matches_worker_type')
        expect(migration).toContain('operator_assignment_id UUID REFERENCES public.machine_operator_assignments')
        expect(migration).toContain('operator_pay_mode_snapshot')
        expect(migration).toContain('machine_type_snapshot')
    })

    it('recalculates settlement gross server-side and prevents fixed per-meter logs', () => {
        expect(migration).toContain('CREATE OR REPLACE FUNCTION public.calculate_operator_payroll_gross')
        expect(migration).toContain('server_calculated_gross')
        expect(migration).toContain('client_gross_ignored')
        expect(migration).toContain("Fixed machine operator logs cannot use per-meter pay mode.")
        expect(migration).toContain("pl.operator_pay_mode_snapshot = 'fixed_shift'")
        expect(migration).toContain('GROUP BY pl.operator_assignment_id, pl.date, pl.shift')
    })
})
