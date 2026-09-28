import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { costSample } from '../components/landing/sample-costing'
import { SAMPLE_START } from '../components/landing/sample-format'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('landing page', () => {
    it('keeps a section for every anchor the protected navbar links to', () => {
        const header = read('components/landing/header.tsx')
        const sections = ['hero', 'product', 'workflow', 'plans', 'pricing', 'faq']
            .map((name) => read(`components/landing/${name}.tsx`))
            .join('\n')
        for (const anchor of ['product', 'workflow', 'plans', 'pricing', 'faq']) {
            expect(header).toContain(`href: '#${anchor}'`)
            expect(sections).toContain(`id="${anchor}"`)
        }
    })

    it('computes the example cost sheet with the estimator engine, loaded only on interaction', () => {
        const engine = read('components/landing/sample-costing.ts')
        expect(engine).toContain('calcFullTotals(state)')
        expect(engine).toContain('buildCostingResult(state, totals)')

        const context = read('components/landing/sample-costing-context.tsx')
        expect(context).toContain("import('./sample-costing')")
        expect(context).not.toMatch(/^import .* from '\.\/sample-costing'/m)
    })

    it('shows an example whose lines add up to the prices it quotes', () => {
        const result = costSample(SAMPLE_START)
        const layers = result.warpYarnPerM + result.weftYarnPerM + result.weavingPerM + result.overheadPerM
        expect(Math.abs(layers - result.productionCostPerM)).toBeLessThan(0.01)
        expect(result.breakEvenPricePerM).toBeGreaterThan(result.productionCostPerM)
        expect(result.suggestedPricePerM).toBeGreaterThan(result.breakEvenPricePerM)
        expect(result.quoteIsValid).toBe(true)
    })

    it('changes only the price, not the cost or break-even, when the margin changes', () => {
        const base = costSample(SAMPLE_START)
        const higherMargin = costSample({ ...SAMPLE_START, marginPct: SAMPLE_START.marginPct + 4 })
        expect(higherMargin.productionCostPerM).toBe(base.productionCostPerM)
        expect(higherMargin.breakEvenPricePerM).toBe(base.breakEvenPricePerM)
        expect(higherMargin.suggestedPricePerM).toBeGreaterThan(base.suggestedPricePerM)
    })

    it('renders every public policy page in the shared legal shell', () => {
        expect(read('components/policies/legal-page.tsx')).toContain('<LegalShell active={activePath}>')
        expect(read('app/privacy-request/page.tsx')).toContain('<LegalShell active="/privacy-request">')
        expect(read('app/security-incident/page.tsx')).toContain('<LegalShell active="/security-incident">')
    })
})
