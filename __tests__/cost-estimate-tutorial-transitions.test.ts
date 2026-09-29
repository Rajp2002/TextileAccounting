import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('CostEstimateTutorial Section Transitions', () => {
    const tutorialPath = path.resolve(__dirname, '../components/estimator/CostEstimateTutorial.tsx')
    const tutorialSource = fs.readFileSync(tutorialPath, 'utf8')

    it('does not unmount the card glow element on section changes (no section-keyed unmount)', () => {
        // Having key={`section-glow-${active.section}`} destroys the card spotlight on every section change.
        // It must be persistent so CSS can smoothly morph the box between sections.
        expect(tutorialSource).not.toContain('key={`section-glow-${')
        expect(tutorialSource).not.toContain('key={"section-glow-')
    })

    it('applies smooth 500ms transition to the card spotlight', () => {
        expect(tutorialSource).toContain('transition-all duration-500 ease-out')
    })

    it('applies smooth clip-path transition to the dark backdrop cutout', () => {
        expect(tutorialSource).toContain('transition: \'clip-path 500ms')
    })

    it('frames the top of the card cleanly when entering a new section', () => {
        expect(tutorialSource).toContain('isNewSection')
        expect(tutorialSource).toContain('targetCardTop')
        expect(tutorialSource).toContain('deltaY = cardRect.top - targetCardTop')
    })

    it('calculates target post-scroll viewport coordinates to prevent pre-scroll jump', () => {
        expect(tutorialSource).toContain('top: cardRect.top - deltaY')
        expect(tutorialSource).toContain('top: targetRect.top - deltaY')
    })

    it('enhances the visual aura and section progress badge during section transitions', () => {
        expect(tutorialSource).toContain('isSectionTransition')
        expect(tutorialSource).toContain('border-saffron/60 shadow-[0_0_0_1px_rgba(230,138,0,0.4),0_0_50px_rgba(230,138,0,0.32)]')
    })

    it('does not re-center the card when moving between fields in the same section (deltaY = 0 when field is in view)', () => {
        // Prevents jumping up a section and returning when navigating between fields within Section 7
        expect(tutorialSource).toContain('else if (active.card.offsetHeight <= viewportHeight)')
        expect(tutorialSource).toContain('never re-center the card; move directly from one field to the next without scrolling')
        expect(tutorialSource).toContain('deltaY = 0')
    })

    it('clamps deltaY to actual document scrollable bounds so phantom scroll offsets are never applied at page boundaries', () => {
        expect(tutorialSource).toContain('maxScrollY')
        expect(tutorialSource).toContain('maxDeltaDown')
        expect(tutorialSource).toContain('maxDeltaUp')
        expect(tutorialSource).toContain('deltaY = Math.max(maxDeltaUp, Math.min(deltaY, maxDeltaDown))')
    })

    it('provides temporary bottom scroll padding on data-costing-tutorial-root while tutorial is active', () => {
        expect(tutorialSource).toContain('data-costing-tutorial-root')
        expect(tutorialSource).toContain("root.style.paddingBottom = '40vh'")
    })
})

