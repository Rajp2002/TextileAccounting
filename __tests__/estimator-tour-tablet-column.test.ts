import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// GT-05 at tablet portrait (768-1023px): the 248px sidebar leaves a 448px content column, so the 360px panel
// cannot sit beside the Quick cards. With cards 594-631px tall and centred by the tracker there is no room above or
// below either, and the placer fell back to a corner over the card (panel/outline overlap at est-warp, est-weft and
// est-handoff). The tour's own runtime reserves a reading column on the LEFT (over the sidebar) for these widths only:
// the cards narrow and right-align, and the Live cost sheet moves into the same right-hand column so the outline
// never travels across the panel while the tour moves between steps.
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

describe('Estimator tour, tablet reading column (GT-05 at 768-1023px)', () => {
    const tablet = () => mediaBlock('(min-width: 768px) and (max-width: 1023.98px)')

    it('narrows and right-aligns the Quick cards so a 360px panel fits to their left', () => {
        const block = tablet()
        expect(block).toMatch(/\[data-tour-anchor\^="estimator\.quick-"\]\s*\{[^}]*width:\s*calc\(100% - \(368px - var\(--shell-sidebar-w\)\)\)/)
        expect(block).toMatch(/\[data-tour-anchor\^="estimator\.quick-"\]\s*\{[^}]*margin-inline-start:\s*auto/)
        // Sidebar + 36px gutter + (368px - sidebar) reservation = the cards start at 404px beside the full menu (120px
        // reservation) and beside the icon rail (296px); the panel needs 16 + 360 + 16 + 6.
        for (const sidebar of [248, 72]) expect(sidebar + 36 + (368 - sidebar)).toBe(404)
        expect(368 - 248).toBe(120)
        expect(16 + 360 + 16 + 6).toBeLessThanOrEqual(404)
    })

    it('moves the Live cost sheet into the same right-hand column, 16px right of the cards', () => {
        const block = tablet()
        expect(block).toMatch(/#mobile-live-estimate-panel\s*\{[^}]*left:\s*420px\s*!important/)
        expect(block).toMatch(/#mobile-live-estimate-panel\s*\{[^}]*right:\s*20px\s*!important/)
        expect(block).toMatch(/#mobile-live-estimate-panel\s*\{[^}]*width:\s*auto\s*!important/)
        // Moving from the sheet to the quality-name input, the outline animates from the sheet's outline (sheet left - 5)
        // toward the input while the panel already sits at its final place, whose right edge is at most 407px (the input's
        // outline left, 423px, minus the 16px gap). A sheet at 404px let that first outline frame cross the panel by ~4px
        // at 768x600; at 420px the outline starts at 415px, clear of the panel with 8px to spare. Width stays 768 - 420 - 20 = 328.
        expect(420 - 5).toBeGreaterThan(423 - 16)
        expect(768 - 420 - 20).toBe(328)
    })

    it('comes after the general sheet rule so it overrides it, and leaves 1024px and wider untouched', () => {
        expect(runtime.indexOf('@media (min-width: 768px) and (max-width: 1023.98px) {')).toBeGreaterThan(runtime.indexOf('@media (min-width: 768px) {'))
        expect(runtime).toContain('@media (min-width: 1024px) and (max-width: 1279.98px) {')
        expect(runtime).toContain('[data-tour-anchor^="estimator.quick-"] { width: calc(100% - 384px); }')
        expect(runtime).toContain('@media (min-width: 1280px) {')
        expect(runtime).toContain('[data-tour-anchor^="estimator.quick-"] { width: calc(100% - 192px); }')
        // The phone rule from BV-01 is unchanged.
        expect(runtime).toContain('@media (max-width: 767.98px) {')
        expect(runtime).toMatch(/#mobile-live-estimate-panel \{ padding-bottom: 100dvh; \}/)
    })

    it('stays tour-owned: nothing about the tablet column lives in the page or the global CSS', () => {
        expect(runtime).toMatch(/<style>\{`[\s\S]*1023\.98px[\s\S]*`\}<\/style>/)
        expect(readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')).not.toContain('calc(100% - 120px)')
        expect(readFileSync('app/globals.css', 'utf8')).not.toContain('estimator.quick-')
    })
})
