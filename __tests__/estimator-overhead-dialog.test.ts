import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcFullTotals, calcOverheadCostPerMeter } from '../lib/estimator'
import { makeFreeEstimate } from '../lib/free-estimator-defaults'

const estimator = readFileSync(
    join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
    'utf8',
)

describe('monthly overhead expense editor', () => {
    it('opens a focused owner-entered expense model in a dialog', () => {
        expect(estimator).toContain('open={showAdvancedOverhead}')
        expect(estimator).toContain('setShowAdvancedOverhead(nextOpen)')
        expect(estimator).toContain('Enter your typical monthly expenses and a rough estimate of total monthly production.')
        expect(estimator).toContain('Typical monthly production (m)')
        expect(estimator).toContain('Edit monthly overhead details')
        expect(estimator).toContain('showCloseButton')
        expect(estimator).toContain("entryMode === 'quick' && !showAdvancedOverhead")
        expect(estimator).toContain('onOpenOverheadDetails={() => setShowAdvancedOverhead(true)}')
        expect(estimator).not.toContain('setShowAdvancedOverhead(!showAdvancedOverhead)')
        expect(estimator).not.toContain('aria-expanded={showAdvancedOverhead}')
        expect(estimator).not.toContain('Factory Capacity Configuration')
        expect(estimator).not.toContain('Per Machine Helper')
        expect(estimator).not.toContain('Cost of Idle Capacity:')
        expect(estimator).not.toContain('Suggest from history')
        expect(estimator).not.toContain('<NumField fieldKey="monthlyOutputM"')
    })

    it('preserves legacy machine-derived expenses as editable rupee amounts', () => {
        expect(estimator).toContain('function makeExpenseItemsManual')
        expect(estimator).toContain('monthlyAmount: resolveOverheadItemAmount(item, loomCount)')
        expect(estimator).toContain('isLocked: false')
        expect(estimator).toContain('meta: undefined')
    })

    it('does not require hidden capacity inputs when saving Lite expense defaults', () => {
        expect(estimator).toContain('requireCapacity:         false')
        expect(estimator).not.toContain('loom_count:              state.loomCount')
        expect(estimator).not.toContain('monthly_working_days:    state.monthlyWorkingDays')
        expect(estimator).not.toContain('avg_output_per_loom_per_day: state.avgOutputPerLoomPerDay')
    })

    it('lists and totals the expense items from live state, not the calculation snapshot', () => {
        // Free mode freezes `totals` to the last completed calculation (or to
        // an empty default estimate), so rows added with "New Item" never
        // appeared. The editor derives its own figures from state instead.
        expect(estimator).toContain('calcOverheadCostPerMeter(state.overheadItems, state.monthlyOutputM, state.loomCount)')
        expect(estimator).toContain('overheadEditor.resolvedItems.map')
        expect(estimator).not.toContain('totals.resolvedItems')
        expect(estimator).not.toMatch(/Total: ₹\{totals\.overheadTotalMonthly/)
        expect(estimator).toContain('overheadEditor.totalMonthly.toLocaleString')
    })

    it('warns about a zero expense total from the entered amounts, not only preset rows', () => {
        // Free starts with no preset rows, so a preset-only check warned even
        // after custom expenses had been priced.
        expect(estimator).toContain("const isZeroConfig = state.overheadMode === 'monthly_expenses' && overheadEditor.totalMonthly <= 0")
        expect(estimator).not.toContain('filter(i => i.isPreset).every')
    })

    it('counts a manually added expense in the live total even when the saved calculation has none', () => {
        const free = makeFreeEstimate()
        const frozen = calcFullTotals(free)
        expect(frozen.resolvedItems).toEqual([])

        const withNewItem = [
            ...free.overheadItems,
            { id: 'new-1', label: 'New Item', monthlyAmount: 25000, source: 'manual' as const, category: 'custom' as const, isPreset: false, isLocked: false },
        ]
        const live = calcOverheadCostPerMeter(withNewItem, 90000, free.loomCount)
        expect(live.resolvedItems).toHaveLength(1)
        expect(live.totalMonthly).toBe(25000)
        expect(live.overheadPerM).toBeCloseTo(25000 / 90000, 6)
    })

    it('shows a valid overhead without waiting for the entire costing to be complete', () => {
        expect(estimator).toContain('const overheadReady =')
        expect(estimator).toContain('totals.overheadTotalMonthly > 0')
        expect(estimator).toContain('valid={overheadReady}')
        expect(estimator).toContain('formatCalculatedMoney(activeOverheadPerM, overheadReady, \'/m\')')
        expect(estimator).toContain('Included in the production cost as the active factory-overhead rate.')
    })
})
