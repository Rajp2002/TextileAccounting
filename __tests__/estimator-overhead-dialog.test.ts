import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const estimator = readFileSync(
    join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
    'utf8',
)

describe('monthly overhead expense editor', () => {
    it('opens a focused owner-entered expense model in a dialog', () => {
        expect(estimator).toContain('aria-haspopup="dialog"')
        expect(estimator).toContain('<Dialog open={showAdvancedOverhead} onOpenChange={setShowAdvancedOverhead}>')
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
})
