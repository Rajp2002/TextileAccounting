import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildBasePayrollReadiness } from '../lib/base-payroll-readiness'
import type {
    BaseProductionAllocation,
    BaseProductionEntry,
    BaseWorkerPayable,
} from '../lib/base-production-core'

const payable: BaseWorkerPayable = {
    worker_id: 'worker-1', worker_name: 'Ramesh', period_start: '2026-08-01', period_end: '2026-08-31',
    meters: 120, gross_pay: 900, pending_advance: 0, advance_recovery: 0, max_advance_recovery: 450,
    remaining_debt: 0, net_payout: 900, status: 'unsettled', settlement_id: null, paid_at: null,
}

function entry(overrides: Partial<BaseProductionEntry> = {}): BaseProductionEntry {
    return {
        id: 'entry-1', worker_id: 'worker-1', job_id: 'job-1', production_date: '2026-08-15',
        meters: 120, worker_rate_snapshot: 0, notes: null, created_at: '2026-08-15T12:00:00Z',
        entry_status: 'entered', allocation_mode: 'machine_breakdown', shift: 'day',
        ...overrides,
    }
}

function allocation(overrides: Partial<BaseProductionAllocation> = {}): BaseProductionAllocation {
    return {
        id: 'allocation-1', entry_id: 'entry-1', worker_id: 'worker-1', assignment_id: 'assignment-1',
        machine_id: 'machine-1', job_id: 'job-1', meters: 120, worker_rate_snapshot: 7.5,
        machine_label: 'Rapier #1', job_label: 'Grey Twill', assignment_snapshot: {},
        created_at: '2026-08-15T12:00:00Z',
        ...overrides,
    }
}

describe('Base payroll readiness', () => {
    it('verifies machine allocation lines exactly once', () => {
        const result = buildBasePayrollReadiness({ payables: [payable], entries: [entry()], allocations: [allocation()] })

        expect(result).toEqual(expect.objectContaining({
            verifiedLineCount: 1, machineLineCount: 1, legacyLineCount: 0, issueCount: 0, readyWorkerCount: 1,
        }))
        expect(result.workers[0].readyToSettle).toBe(true)
    })

    it('keeps a valid legacy worker total visible and payable', () => {
        const legacy = entry({ allocation_mode: 'worker_total', worker_rate_snapshot: 7.5, machine_id: null, job_id: '' })
        const result = buildBasePayrollReadiness({ payables: [payable], entries: [legacy], allocations: [] })

        expect(result).toEqual(expect.objectContaining({ legacyLineCount: 1, issueCount: 0, readyWorkerCount: 1 }))
    })

    it('blocks readiness when allocations are missing, mismatched, or have no rate', () => {
        const missing = buildBasePayrollReadiness({ payables: [payable], entries: [entry()], allocations: [] })
        const mismatched = buildBasePayrollReadiness({ payables: [payable], entries: [entry()], allocations: [allocation({ meters: 100 })] })
        const noRate = buildBasePayrollReadiness({ payables: [payable], entries: [entry()], allocations: [allocation({ worker_rate_snapshot: 0 })] })

        expect(missing.workers[0].issues[0].code).toBe('missing_allocation')
        expect(mismatched.workers[0].issues[0].code).toBe('allocation_mismatch')
        expect(noRate.workers[0].issues[0].code).toBe('missing_rate')
        expect([missing, mismatched, noRate].every((result) => result.readyWorkerCount === 0)).toBe(true)
    })

    it('ignores production outside the worker settlement window', () => {
        const result = buildBasePayrollReadiness({
            payables: [payable],
            entries: [entry({ production_date: '2026-07-31' })],
            allocations: [allocation()],
        })

        expect(result.verifiedLineCount).toBe(0)
        expect(result.issueCount).toBe(0)
    })

    it('enforces the same readiness boundary inside the settlement transaction', () => {
        const migration = readFileSync(join(process.cwd(), 'supabase/migrations/20260901000000_base_payroll_readiness_guard.sql'), 'utf8')

        expect(migration).toContain('guard_base_payroll_settlement_readiness')
        expect(migration).toContain("daily.allocation_mode = 'machine_breakdown'")
        expect(migration).toContain('allocation.worker_rate_snapshot <= 0')
        expect(migration).toContain('ABS(COALESCE')
        expect(migration).toContain('REVOKE ALL ON FUNCTION private.guard_base_payroll_settlement_readiness()')
    })
})
