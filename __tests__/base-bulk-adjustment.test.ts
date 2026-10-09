import { describe, expect, it } from 'vitest'
import {
    DEDUCTION_REASONS,
    bulkAdjustmentTotal,
    bulkEligibleWorkers,
    bulkGroupCounts,
    bulkGroupState,
    buildDeductionDescription,
    toggleBulkGroup,
    toggleBulkWorker,
    type BulkAdjustmentWorker,
} from '../lib/base-bulk-adjustment'

const workers: BulkAdjustmentWorker[] = [
    { id: 'w-zed', name: 'Zed Weaver', is_active: true, pay_type: 'piece_rate' },
    { id: 'w-amit', name: 'amit', is_active: true },
    { id: 'w-ravi', name: 'Ravi Karighar', is_active: true, pay_type: 'fixed_monthly' },
    { id: 'w-old', name: 'Old Hand', is_active: false, pay_type: 'piece_rate' },
    { id: 'w-sup', name: 'Mahesh', is_active: true, pay_type: 'fixed_monthly' },
]

describe('bulkEligibleWorkers', () => {
    it('keeps active workers only, sorted by name without regard to case', () => {
        expect(bulkEligibleWorkers(workers).map(worker => worker.id)).toEqual(['w-amit', 'w-sup', 'w-ravi', 'w-zed'])
    })
})

describe('bulk worker groups', () => {
    const eligible = bulkEligibleWorkers(workers)

    it('counts a worker with no pay type as piece rate, like payroll does', () => {
        expect(bulkGroupCounts(eligible)).toEqual({ piece_rate: 2, fixed_monthly: 2 })
    })

    it('reports all, some or none of a group as selected', () => {
        expect(bulkGroupState(new Set(eligible.map(worker => worker.id)), eligible, 'fixed_monthly')).toBe('all')
        expect(bulkGroupState(new Set(['w-ravi']), eligible, 'fixed_monthly')).toBe('some')
        expect(bulkGroupState(new Set(['w-amit']), eligible, 'fixed_monthly')).toBe('none')
    })

    it('deselects a fully selected group and leaves the other group alone', () => {
        const all = new Set(eligible.map(worker => worker.id))
        const next = toggleBulkGroup(all, eligible, 'fixed_monthly')
        expect([...next].sort()).toEqual(['w-amit', 'w-zed'])
    })

    it('selects the whole group when it is partly or not selected', () => {
        const partly = toggleBulkGroup(new Set(['w-ravi', 'w-amit']), eligible, 'fixed_monthly')
        expect([...partly].sort()).toEqual(['w-amit', 'w-ravi', 'w-sup'])
        const none = toggleBulkGroup(new Set(), eligible, 'piece_rate')
        expect([...none].sort()).toEqual(['w-amit', 'w-zed'])
    })

    it('does not mutate the selection it was given', () => {
        const selected = new Set(['w-amit'])
        toggleBulkGroup(selected, eligible, 'fixed_monthly')
        toggleBulkWorker(selected, 'w-zed')
        expect([...selected]).toEqual(['w-amit'])
    })

    it('toggles one worker on and off', () => {
        const on = toggleBulkWorker(new Set(), 'w-zed')
        expect(on.has('w-zed')).toBe(true)
        expect(toggleBulkWorker(on, 'w-zed').has('w-zed')).toBe(false)
    })
})

describe('bulkAdjustmentTotal', () => {
    it('multiplies the per-worker amount without floating point drift', () => {
        expect(bulkAdjustmentTotal(0.1, 3)).toBe(0.3)
        expect(bulkAdjustmentTotal(100, 17)).toBe(1700)
        expect(bulkAdjustmentTotal(1234.56, 7)).toBe(8641.92)
    })

    it('is zero when nothing is selected or the amount is not usable', () => {
        expect(bulkAdjustmentTotal(100, 0)).toBe(0)
        expect(bulkAdjustmentTotal(Number.NaN, 5)).toBe(0)
        expect(bulkAdjustmentTotal(-50, 5)).toBe(0)
    })
})

describe('buildDeductionDescription', () => {
    it('matches the format worker cards already parse', () => {
        expect(buildDeductionDescription('Water access / Utilities', '')).toBe('[Deduction: Water access / Utilities]')
        expect(buildDeductionDescription('Water access / Utilities', ' October bill ')).toBe('[Deduction: Water access / Utilities] October bill')
        expect(buildDeductionDescription('', '')).toBe('[Deduction]')
        expect(buildDeductionDescription(undefined, 'late')).toBe('[Deduction] late')
    })

    it('stays inside the 240 character column limit', () => {
        expect(buildDeductionDescription('Other', 'x'.repeat(400))).toHaveLength(240)
    })
})

describe('DEDUCTION_REASONS', () => {
    it('keeps the factory reasons, water first among utilities', () => {
        expect(DEDUCTION_REASONS).toContain('Water access / Utilities')
        expect(DEDUCTION_REASONS[DEDUCTION_REASONS.length - 1]).toBe('Other')
    })
})
