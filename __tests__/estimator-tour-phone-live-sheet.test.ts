import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { estimatorTourSteps } from '@/lib/estimator-tour'

// BV-01 (GT-05): on a phone the Live cost sheet fits the screen without scrolling, so the shared mobile
// tracker found no scrollport to lift the Save controls above the docked tour panel and step 9 was
// unavailable. The tour's own runtime must therefore give the sheet room to scroll on phones only.
const runtime = readFileSync('components/estimator/CostEstimateTourRuntime.tsx', 'utf8')

function mediaBlock(query: string): string {
    const start = runtime.indexOf(`@media ${query} {`)
    expect(start, `runtime declares @media ${query}`).toBeGreaterThanOrEqual(0)
    let depth = 0
    for (let index = runtime.indexOf('{', start); index < runtime.length; index++) {
        if (runtime[index] === '{') depth++
        if (runtime[index] === '}' && --depth === 0) return runtime.slice(start, index + 1)
    }
    throw new Error('unbalanced media block')
}

describe('Estimator tour, Live cost sheet on phones (BV-01)', () => {
    it('keeps the approved Save and Live cost anchors and sheet context', () => {
        const live = estimatorTourSteps.find(step => step.id === 'est-live')
        const save = estimatorTourSteps.find(step => step.id === 'est-save')
        expect(live).toMatchObject({ anchor: '[data-estimator-field="liveCostMetrics"]', context: '#mobile-live-estimate-panel' })
        expect(save).toMatchObject({ anchor: '[data-estimator-field="liveCostActions"]', context: '#mobile-live-estimate-panel' })
    })

    it('reserves scroll room in the sheet on phones so the tracker can lift Save above the panel', () => {
        const phone = mediaBlock('(max-width: 767.98px)')
        expect(phone).toContain('#mobile-live-estimate-panel')
        expect(phone).toMatch(/padding-bottom:\s*100dvh/)
    })

    it('leaves the sheet untouched in the desktop column layout and never on the phone-only rule', () => {
        const desktop = mediaBlock('(min-width: 768px)')
        expect(desktop).toContain('#mobile-live-estimate-panel')
        expect(desktop).not.toMatch(/padding-bottom/)
        // The phone breakpoint is the exact complement of the desktop one: no width is left without a rule.
        expect(runtime).toContain('@media (max-width: 767.98px) {')
        expect(runtime).toContain('@media (min-width: 768px) {')
    })

    it('stays tour-owned: the rule lives in the runtime style block, not in the page or global CSS', () => {
        expect(runtime).toMatch(/<style>\{`[\s\S]*#mobile-live-estimate-panel[\s\S]*`\}<\/style>/)
        const page = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
        expect(page).not.toMatch(/padding-bottom:\s*100dvh/)
        expect(readFileSync('app/globals.css', 'utf8')).not.toMatch(/#mobile-live-estimate-panel/)
        expect(readFileSync('app/mobile.css', 'utf8')).not.toMatch(/#mobile-live-estimate-panel/)
    })
})
