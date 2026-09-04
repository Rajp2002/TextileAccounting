import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const estimator = readFileSync(
    join(process.cwd(), 'app/(dashboard)/owner/estimator/EstimatorClient.tsx'),
    'utf8',
)

describe('monthly overhead expense editor', () => {
    it('opens monthly expenses and capacity in a dialog instead of an inline accordion', () => {
        expect(estimator).toContain('aria-haspopup="dialog"')
        expect(estimator).toContain('<Dialog open={showAdvancedOverhead} onOpenChange={setShowAdvancedOverhead}>')
        expect(estimator).toContain('Monthly expenses &amp; capacity')
        expect(estimator).toContain('showCloseButton')
        expect(estimator).toContain("entryMode === 'quick' && !showAdvancedOverhead")
        expect(estimator).toContain('onOpenOverheadDetails={() => setShowAdvancedOverhead(true)}')
        expect(estimator).not.toContain('setShowAdvancedOverhead(!showAdvancedOverhead)')
        expect(estimator).not.toContain('aria-expanded={showAdvancedOverhead}')
    })
})
