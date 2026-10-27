import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const client = readFileSync(join(process.cwd(), 'app/(dashboard)/owner/quotes/QuotesClient.tsx'), 'utf8')

describe('Saved Costings plan-specific panels', () => {
    it('shows the costing breakdown on every plan and no production-usage panel', () => {
        const breakdownPanel = '<section data-costing-tour="breakdown" className="flex min-w-0 flex-col @min-[840px]:contents">'

        expect(client).toContain('{activeFormula && <SavedCostingFormula formula={activeFormula} />}')
        expect(client).toContain(breakdownPanel)
        expect(client).not.toContain(`{canUseProduction && ${breakdownPanel}`)
        // Phase 3H removed the Full Suite "Applied production" panel.
        expect(client).not.toContain('Applied production')
        expect(client).not.toMatch(/\bcanUseProduction\b/)
    })
})
