import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { estimatorTourSteps, estimatorTourView } from '../lib/estimator-tour'
import { estimatorControlLabels, estimatorStepCopy } from '../lib/i18n/cost-estimate-tutorial'
import { calcOrderQuote, calcOverheadCostPerMeter } from '../lib/estimator'
import { en } from '../lib/i18n/locales/en'

const read = (file: string) => readFileSync(file, 'utf8')
const controls = estimatorControlLabels(key => key === 'estimator.quality.saveQualityAndCosting' ? en.estimator.quality.saveQualityAndCosting : en.tourControls.estimator[key.split('.').at(-1)! as keyof typeof en.tourControls.estimator], text => text, false)
const steps = ['est-purpose', 'est-warp', 'est-weft', 'est-weaving', 'est-warping', 'est-overhead', 'est-pricing', 'est-live', 'est-save', 'est-handoff']

describe('Estimator Quick tour', () => {
    it('keeps the exact ten-step sequence for Free, Lite and Base', () => {
        expect(estimatorTourSteps.map(step => step.id)).toEqual(steps)
        for (const [freePlan, productionPipeline] of [[true, false], [false, false], [false, true]]) {
            for (const { id } of estimatorTourSteps) {
                const copy = estimatorStepCopy('en', id, { freePlan, productionPipeline, controls })
                expect(copy.title).toBeTruthy()
                expect(copy.body).toBeTruthy()
            }
        }
    })
    it('anchors whole Quick cards, the two sheet sections, then the live quality input', () => {
        expect(estimatorTourSteps.map(step => step.anchor)).toEqual([
            ...['basics', 'warp', 'weft', 'weaving', 'warping', 'overhead', 'pricing'].map(name => `[data-tour-anchor="estimator.quick-${name}"]`),
            '[data-estimator-field="liveCostMetrics"]', '[data-estimator-field="liveCostActions"]', '[data-estimator-field="qualityLabel"]',
        ])
        expect(estimatorTourSteps.slice(0, 9).every(step => step.kind === 'live')).toBe(true)
        expect(estimatorTourSteps.at(-1)?.kind).toBe('handoff')
        expect(estimatorTourSteps.filter(step => step.context).map(step => [step.id, step.context])).toEqual([
            ['est-live', '#mobile-live-estimate-panel'], ['est-save', '#mobile-live-estimate-panel'],
        ])
    })
    it('derives only the specified view state and opens Live cost only on steps eight and nine', () => {
        for (const { id } of estimatorTourSteps) expect(estimatorTourView(id)).toEqual({
            entryMode: 'quick', liveEstimateOpen: ['est-live', 'est-save'].includes(id), showQualityLibrary: false, showAdvancedOverhead: false,
        })
    })
    it('keeps plan-specific save, production, recipe and Free-allowance guidance', () => {
        const options = { controls, freePlan: false, productionPipeline: false }
        const lite = estimatorStepCopy('en', 'est-save', options)
        expect(lite.body).toContain('Save Quality & Create Costing')
        expect(lite.detail).toContain('earlier one stays as it was')
        expect(lite.detail).not.toContain('Start Production')
        expect(estimatorStepCopy('en', 'est-save', { ...options, productionPipeline: true }).detail).toContain('Start Production')
        const free = estimatorStepCopy('en', 'est-save', { ...options, freePlan: true, productionPipeline: true })
        expect(free.body).toContain('Each time uses one of your monthly Free costings')
        expect(free.detail).toContain('guide itself never uses a costing')
        expect(free.detail).not.toContain('Start Production')
        expect(estimatorStepCopy('en', 'est-purpose', { ...options, freePlan: true }).detail).toBeUndefined()
        expect(estimatorStepCopy('en', 'est-warp', { ...options, freePlan: true }).detail).not.toContain('Yarn Rate Book')
        expect(estimatorStepCopy('en', 'est-live', { ...options, freePlan: true }).body).toContain('after you calculate and save')
    })
    it('names the existing-version button through the same approved resolver', () => {
        const existing = estimatorControlLabels(key => key === 'tourControls.estimator.saveNewVersion' ? 'Save New Version' : key, text => text, true)
        expect(estimatorStepCopy('en', 'est-save', { freePlan: false, productionPipeline: false, controls: existing }).body).toContain('“Save New Version”')
    })
    it('computes both approved worked examples with the real costing engine', () => {
        const overhead = calcOverheadCostPerMeter([{ id: 'example', label: 'Example', monthlyAmount: 60000, category: 'custom', isPreset: false, isLocked: false, source: 'manual' }], 30000, 1)
        expect(overhead.overheadPerM).toBe(2)
        const quote = calcOrderQuote({ totalProductionCostPerM: 100, orderQuantityM: 1, commissionPct: 0, transportPerM: 0, profitMarginPct: 20 })
        expect(quote.quotePricePerM).toBe(125)
        expect(quote.actualMarginPct).toBe(20)
    })
    it('loads runtime and step copy only on opt-in and retires the field track/action', () => {
        const launcher = read('components/estimator/CostEstimateTutorial.tsx')
        const runtime = read('components/estimator/CostEstimateTourRuntime.tsx')
        expect(launcher).toContain("dynamic(() => import('./CostEstimateTourRuntime'), { ssr: false })")
        expect(launcher).toContain('{step && <CostEstimateTourRuntime')
        expect(launcher).not.toMatch(/from ['"].*cost-estimate-tutorial|fieldGuide|setGuide|setTimeout|dispatchEvent|paddingBottom|createPortal/)
        expect(runtime).toContain('<GuidedTour tourId="cost-estimate"')
        expect(runtime).toContain('estimatorStepCopy')
        expect(runtime).not.toMatch(/\.click\(|saveEstimatorQuote|saveAsFabricTemplate|updateFabricTemplate/)
        expect(existsSync('lib/i18n/cost-estimate-workflow.ts')).toBe(false)
        expect(existsSync('app/(dashboard)/owner/estimator/tutorial-actions.ts')).toBe(false)
    })
})
