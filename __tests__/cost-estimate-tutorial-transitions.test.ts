import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync('components/estimator/CostEstimateTutorial.tsx', 'utf8')
const runtime = readFileSync('components/estimator/CostEstimateTourRuntime.tsx', 'utf8')
const page = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
const prepare = page.slice(page.indexOf('const prepareTutorial = useCallback(() => {') + 'const prepareTutorial = useCallback(() => {'.length, page.indexOf('    const [mobileCostingShortcutVisible]')).replace(/\}, \[\]\)\s*$/, '')

describe('Estimator reversible tour state', () => {
    it('executes the real restore closure for every combination of captured UI flags', () => {
        for (let flags = 0; flags < 32; flags++) {
            const previous = { entryMode: flags & 1 ? 'detailed' : 'quick', showAdvancedOverhead: Boolean(flags & 2), liveEstimateOpen: Boolean(flags & 4), showQualityLibrary: Boolean(flags & 8), assumptionsExpanded: Boolean(flags & 16) }
            const view = { ...previous }
            const setters = ['entryMode', 'showAdvancedOverhead', 'liveEstimateOpen', 'showQualityLibrary', 'assumptionsExpanded'] as const
            const callbacks = setters.map(key => vi.fn(value => { Object.assign(view, { [key]: value }) }))
            const preparing = { current: false }, skip = { current: false }, current = { current: { ...previous } }
            const restore = new Function('tutorialViewRef', 'tutorialPreparingRef', 'skipRestoredAssumptionsEffect', ...setters.map(key => `set${key[0].toUpperCase()}${key.slice(1)}`), prepare)(current, preparing, skip, ...callbacks) as () => void
            expect(view).toEqual({ ...previous, entryMode: 'quick', showAdvancedOverhead: false, liveEstimateOpen: false, showQualityLibrary: false })
            expect(preparing.current).toBe(true)
            expect(callbacks[4]).not.toHaveBeenCalled()
            current.current = { ...view } // Renders during the tour cannot overwrite its snapshot.
            restore()
            expect(view).toEqual(previous)
            expect(preparing.current).toBe(false)
            expect(skip.current).toBe(previous.entryMode !== 'quick')
        }
        expect(prepare).not.toMatch(/dispatch|localStorage|fetch|save|freeMeter/)
    })
    it('captures once on explicit launch and restores on close and unmount', () => {
        expect(source).toContain('if (!enabled || restoreView.current) return')
        expect(source).toContain('restoreView.current = onPrepare()')
        expect(source.match(/restoreView.current\?\.\(\)/g)).toHaveLength(2)
        expect(source).toContain('useEffect(() => () => {')
        expect(source).toContain('if (next === null) {')
        expect(source).toContain('onActiveChange(false)')
        expect(source).toContain('onDone={() => { handoffPending.current = true }}')
        expect(source).toContain('if (step !== null || !handoffPending.current) return')
        expect(source).toContain("querySelectorAll<HTMLInputElement>('[data-estimator-field=\"qualityLabel\"]')")
    })
    it('uses shared scrolling, clipping, placement and cleanup with no bespoke timers or aura', () => {
        expect(runtime).toContain('<GuidedTour')
        expect(runtime).toContain('estimatorTourView(step)')
        expect(runtime).toContain('onOpenLiveCostModal(view.liveEstimateOpen)')
        for (const retired of ['setTimeout', "paddingBottom = '40vh'", 'tutorial-expand-row', 'isSectionTransition', 'shadow-2xl', 'duration-500', 'clip-path 500ms', 'panelPlacement']) expect(source + runtime).not.toContain(retired)
        expect(page).not.toContain('tutorial-expand-row')
        expect(page).not.toContain('tutorialExpanded')
        const shared = readFileSync('components/tours/GuidedTour.tsx', 'utf8')
        expect(shared).toContain('useTourStep(')
        expect(shared).toContain('useGuidedTourModal(')
        expect(shared).toContain('restoreScroll(record)')
        expect(shared).toContain('releaseTour(props.tourId)')
    })
})
