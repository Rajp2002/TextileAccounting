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
        expect(estimator).toContain('showCloseButton')
        expect(estimator).toContain("entryMode === 'quick' && !showAdvancedOverhead")
        expect(estimator).toContain('onOpenOverheadDetails={() => setShowAdvancedOverhead(true)}')
        expect(estimator).not.toContain('setShowAdvancedOverhead(!showAdvancedOverhead)')
        expect(estimator).not.toContain('aria-expanded={showAdvancedOverhead}')
        expect(estimator).not.toContain('Factory Capacity Configuration')
        expect(estimator).not.toContain('Per Machine Helper')
        expect(estimator).not.toContain('Cost of Idle Capacity:')
        expect(estimator).not.toContain('Suggest from history')
    })

    it('preserves legacy machine-derived expenses as editable rupee amounts', () => {
        expect(estimator).toContain('function makeExpenseItemsManual')
        expect(estimator).toContain('monthlyAmount: resolveOverheadItemAmount(item, loomCount)')
        expect(estimator).toContain('isLocked: false')
        expect(estimator).toContain('meta: undefined')
    })
})
