import { describe, expect, it } from 'vitest'
import { hasBaseOperatorEligibility, isBaseOperatorAvailable, resolveBasePieceRate } from '../lib/base-operator'
import { calculateBaseEntryGrossPay, calculateBaseWorkerPayables, type BaseProductionWorker } from '../lib/base-production-core'
import { buildBasePayrollReadiness } from '../lib/base-payroll-readiness'
import { normalizeWorker } from '../app/(dashboard)/owner/production/registers/normalize'

const fixed: BaseProductionWorker = {
    id: 'fixed', name: 'Operator', role: 'Supervisor', pay_type: 'fixed_monthly',
    operator_eligible: true, operator_effective_from: '2026-09-01',
    monthly_salary: 18000, salary_history: [{ effective_from: '2026-09-01', monthly_salary: 18000 }],
    start_date: '2026-09-01', end_date: null, rate_per_meter: 0, is_active: true, shift_availability: 'day',
}

describe('Base operator eligibility', () => {
    it('keeps legacy piece workers eligible without approving monthly support staff by title', () => {
        expect(hasBaseOperatorEligibility({ ...fixed, pay_type: 'piece_rate', operator_eligible: undefined })).toBe(true)
        const unapprovedOperator = { ...fixed, operator_eligible: undefined, role: 'Loom operator' }
        expect(hasBaseOperatorEligibility(unapprovedOperator)).toBe(false)
        expect(hasBaseOperatorEligibility({ ...fixed, pay_type: 'piece_rate', operator_eligible: false })).toBe(false)
    })
    it('checks approval, shift, active state and employment bounds independently of pay', () => {
        expect(isBaseOperatorAvailable(fixed, 'day', '2026-09-01')).toBe(true)
        expect(isBaseOperatorAvailable(fixed, 'night', '2026-09-01')).toBe(false)
        expect(isBaseOperatorAvailable(fixed, 'day', '2026-08-31')).toBe(false)
        expect(isBaseOperatorAvailable({ ...fixed, operator_effective_from: '2026-09-10' }, 'day', '2026-09-09')).toBe(false)
        expect(isBaseOperatorAvailable({ ...fixed, end_date: '2026-09-10' }, 'day', '2026-09-11')).toBe(false)
        expect(isBaseOperatorAvailable({ ...fixed, is_active: false }, 'day', '2026-09-01')).toBe(false)
    })
    it('retains approval provenance when normalizing a database worker', () => {
        const worker = normalizeWorker({ ...fixed, operator_approved_by: 'owner', operator_approved_at: '2026-09-01T10:00:00Z' })
        expect(worker).toMatchObject({ operator_eligible: true, operator_effective_from: '2026-09-01', operator_approved_by: 'owner' })
        expect(normalizeWorker({ pay_type: 'fixed_monthly' }).operator_eligible).toBe(false)
    })
})

describe('Base prospective piece rate contract', () => {
    it('preserves positive, zero and fractional rates without treating zero as inheritance', () => {
        expect(resolveBasePieceRate('piece_rate', 0, 9)).toEqual({ state: 'applicable', rate: 0, source: 'job' })
        expect(resolveBasePieceRate('piece_rate', 0.025, 9)).toEqual({ state: 'applicable', rate: 0.025, source: 'job' })
        expect(resolveBasePieceRate('piece_rate', null, 9)).toEqual({ state: 'applicable', rate: 9, source: 'legacy_worker' })
        expect(resolveBasePieceRate('piece_rate', undefined)).toEqual({ state: 'unresolved', rate: null, source: null })
        expect(resolveBasePieceRate('piece_rate', NaN, 9).state).toBe('unresolved')
        expect(resolveBasePieceRate('piece_rate', -1, 9).state).toBe('unresolved')
    })
    it('does not invoke the piece component for fixed pay', () => {
        expect(resolveBasePieceRate('fixed_monthly', 10, 9)).toEqual({ state: 'inapplicable', rate: 0, source: 'fixed_monthly' })
        expect(resolveBasePieceRate('fixed_monthly', undefined).state).toBe('inapplicable')
    })
    it('honors stored inapplicability while preserving physical production and salary once', () => {
        const entries = [100, 200, 300].map((meters, index) => ({
            id: String(index), worker_id: fixed.id, job_id: 'job', production_date: '2026-09-02',
            meters, worker_rate_snapshot: 10, piece_earning_state: 'inapplicable' as const, notes: null, created_at: '',
        }))
        expect(calculateBaseEntryGrossPay(entries[0])).toBe(0)
        const payable = calculateBaseWorkerPayables({ workers: [fixed], entries, advances: [], settlements: [], periodEnd: '2026-09-30' })[0]
        expect(payable).toMatchObject({ meters: 600, gross_pay: 18000 })
        expect(calculateBaseWorkerPayables({ workers: [{ ...fixed, operator_eligible: false }], entries: [], advances: [], settlements: [], periodEnd: '2026-09-30' })[0].gross_pay).toBe(18000)
    })
})

describe('Fixed production payroll readiness', () => {
    const entry = { id: 'entry', worker_id: fixed.id, job_id: 'job', production_date: '2026-09-02', meters: 100,
        worker_rate_snapshot: 0, piece_earning_state: 'inapplicable' as const, allocation_mode: 'machine_breakdown' as const, notes: null, created_at: '' }
    const allocation = { id: 'allocation', entry_id: entry.id, worker_id: fixed.id, assignment_id: 'assignment', machine_id: 'machine',
        job_id: 'job', meters: 100, worker_rate_snapshot: 0, machine_label: 'Loom', job_label: 'Cotton',
        piece_earning_state: 'inapplicable' as const, assignment_snapshot: {}, created_at: '' }
    const payables = calculateBaseWorkerPayables({ workers: [fixed], entries: [entry], advances: [], settlements: [], periodEnd: '2026-09-30' })
    it('accepts inapplicable piece rates while checking machine attribution', () => {
        expect(buildBasePayrollReadiness({ payables, entries: [entry], allocations: [allocation] })).toMatchObject({ readyWorkerCount: 1, issueCount: 0 })
        expect(buildBasePayrollReadiness({ payables, entries: [entry], allocations: [] }).workers[0].issues[0].code).toBe('missing_allocation')
        expect(buildBasePayrollReadiness({ payables, entries: [entry], allocations: [{ ...allocation, meters: 90 }] }).workers[0].issues[0].code).toBe('allocation_mismatch')
    })
})
