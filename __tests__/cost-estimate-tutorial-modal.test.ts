import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { estimatorTourSteps, estimatorTourView } from '../lib/estimator-tour'

const page = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
const sheet = readFileSync('components/ui/sheet.tsx', 'utf8')
const hooks = readFileSync('hooks/use-guided-tour.ts', 'utf8')

describe('Estimator tour sheet safety on the shared runtime', () => {
    it('opens only the Live cost metrics/actions steps in the actual sheet context', () => {
        expect(estimatorTourSteps.filter(step => estimatorTourView(step.id).liveEstimateOpen).map(step => [step.id, step.context])).toEqual([
            ['est-live', '#mobile-live-estimate-panel'], ['est-save', '#mobile-live-estimate-panel'],
        ])
        expect(page).toContain('id="mobile-live-estimate-panel"')
        expect(page).toContain('data-estimator-field="liveCostMetrics"')
        expect(page).toContain('data-estimator-field="liveCostActions"')
        expect(estimatorTourSteps.every(step => !step.context?.includes('monthly-expenses') && !step.context?.includes('saved-qualities'))).toBe(true)
    })
    it('retains nonmodal sheets, hidden overlays/close, blocked dismissal and prevented autofocus during the tour', () => {
        expect(sheet).toContain('hideOverlay = false')
        expect(sheet).toContain('{!hideOverlay && <SheetOverlay />}')
        expect(page).toContain('modal={!isTutorialActive}')
        expect(page).toContain('hideOverlay={isTutorialActive}')
        expect(page).toContain('showCloseButton={!isTutorialActive}')
        expect(page).toContain('if (isTutorialActive && !nextOpen)')
        expect(page).toContain('onOpenAutoFocus={(e) => {')
        expect(page).toContain('onPointerDownOutside={(e) => {')
        expect(page).toContain('onInteractOutside={(e) => {')
        expect(page).toContain("isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''")
    })
    it('makes newly portalled sheet controls inert and blocks business pointer/keyboard actions through the shared modal', () => {
        expect(hooks).toContain('element.inert = true')
        expect(hooks).toContain('observer.observe(document.body')
        expect(hooks).toContain("'pointerdown', 'pointerup', 'click'")
        expect(hooks).toContain('event.stopImmediatePropagation()')
        expect(hooks).toContain("event.key === 'Escape'")
        expect(hooks).toContain('navigation.current.next()')
        expect(hooks).toContain('previous.forEach((inert, element) => { element.inert = inert })')
    })
})
