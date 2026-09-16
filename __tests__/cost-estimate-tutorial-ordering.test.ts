import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { costEstimateTutorialCopy } from '../lib/i18n/cost-estimate-tutorial'

describe('Cost Estimate Tutorial Section Ordering & Placement', () => {
    const estimatorClientPath = path.resolve(__dirname, '../app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const estimatorClientSource = fs.readFileSync(estimatorClientPath, 'utf8')
    const tutorialComponentPath = path.resolve(__dirname, '../components/estimator/CostEstimateTutorial.tsx')
    const tutorialComponentSource = fs.readFileSync(tutorialComponentPath, 'utf8')

    it('has 10 sections in i18n copy with Quick vs Detailed first, Live cost estimate at 9, and Saved qualities last', () => {
        for (const lang of ['en', 'hi', 'gu'] as const) {
            const sections = costEstimateTutorialCopy[lang].sections
            expect(sections).toHaveLength(10)
        }
        expect(costEstimateTutorialCopy.en.sections[0]).toBe('Quick vs Detailed')
        expect(costEstimateTutorialCopy.en.sections[8]).toBe('Live cost estimate')
        expect(costEstimateTutorialCopy.en.sections[9]).toBe('Saved qualities')
    })

    it('temporarily switches to Detailed and restores the captured view', () => {
        const preparation = estimatorClientSource.slice(estimatorClientSource.indexOf('const prepareTutorial = useCallback'), estimatorClientSource.indexOf('const [mobileCostingShortcutVisible]'))
        expect(preparation).toContain("setEntryMode('detailed')")
        expect(preparation).toContain('setEntryMode(previous.entryMode)')
        for (const field of ['showAdvancedOverhead', 'liveEstimateOpen', 'showQualityLibrary', 'assumptionsExpanded']) {
            expect(preparation).toContain(`previous.${field}`)
        }
        expect(tutorialComponentSource).toContain('restoreView.current?.()')
        expect(tutorialComponentSource).toContain('if (!active) return')
    })

    it('moves YarnComponentCountFields out of QuickCostingView so it only exists in Detailed view', () => {
        // Extract QuickCostingView body
        const quickCostingStart = estimatorClientSource.indexOf('function QuickCostingView(')
        const quickCostingEnd = estimatorClientSource.indexOf('const DETAILED_ESTIMATOR_ISSUE_FIELDS =', quickCostingStart)
        expect(quickCostingStart).toBeGreaterThan(0)
        expect(quickCostingEnd).toBeGreaterThan(quickCostingStart)
        const quickCostingSource = estimatorClientSource.slice(quickCostingStart, quickCostingEnd)

        // QuickCostingView must NOT have YarnComponentCountFields
        expect(quickCostingSource).not.toContain('<YarnComponentCountFields')

        // Detailed view (around Costing Basics) MUST contain YarnComponentCountFields
        const detailedCostingStart = estimatorClientSource.indexOf('{/* 1. Costing Basics */}')
        const detailedCostingEnd = estimatorClientSource.indexOf('{/* 2. Warp Yarn Rows */}')
        expect(detailedCostingStart).toBeGreaterThan(0)
        expect(detailedCostingEnd).toBeGreaterThan(detailedCostingStart)
        const detailedCostingSection1 = estimatorClientSource.slice(detailedCostingStart, detailedCostingEnd)

        expect(detailedCostingSection1).toContain('<YarnComponentCountFields')
        expect(detailedCostingSection1).toContain('{constructionFields}')
        expect(quickCostingSource).toContain('{constructionFields}')
        expect(estimatorClientSource).toContain('constructionFields={constructionFields}')
        const constructionStart = estimatorClientSource.indexOf('const constructionFields = (')
        expect(constructionStart).toBeGreaterThan(0)
        const constructionEnd = estimatorClientSource.indexOf('\n    return (', constructionStart)
        const constructionFields = estimatorClientSource.slice(constructionStart, constructionEnd)
        expect(constructionFields).toContain('data-estimator-field="warpConstruction"')
        expect(constructionFields).toContain('data-estimator-field="weftConstruction"')
        expect(detailedCostingSection1).toContain('fieldKey="warpCrimpPct"')
        expect(detailedCostingSection1).toContain('fieldKey="yarnShortagePct"')
    })

    it('places data-costing-tutorial-root on estimator-form-panel', () => {
        expect(estimatorClientSource).toContain('id="estimator-form-panel"')
        expect(estimatorClientSource).toMatch(/id="estimator-form-panel"[^>]*data-costing-tutorial-root="true"/)
    })

    it('tags Quick vs Detailed toggle with data-tutorial-section={1} and data-estimator-field="entryMode"', () => {
        expect(estimatorClientSource).toMatch(/data-tutorial-section=\{1\}[\s\S]*?data-estimator-field="entryMode"/)
    })

    it('tags Live cost estimate shortcut with data-tutorial-section={9} and data-estimator-field="liveCostShortcut"', () => {
        expect(estimatorClientSource).toMatch(/data-tutorial-section=\{9\}[\s\S]*?data-estimator-field="liveCostShortcut"/)
    })

    it('tags modal fields in MobileLiveEstimateShortcut for readiness, metrics, assumptions, and actions', () => {
        expect(estimatorClientSource).toContain('data-estimator-field="liveCostReadiness"')
        expect(estimatorClientSource).toContain('data-estimator-field="liveCostMetrics"')
        expect(estimatorClientSource).toContain('data-estimator-field="liveCostAssumptions"')
        expect(estimatorClientSource).toContain('data-estimator-field="liveCostActions"')
    })

    it('tags Saved qualities with data-tutorial-section={10} and data-estimator-field="savedQualities"', () => {
        expect(estimatorClientSource).toMatch(/data-tutorial-section=\{10\}[\s\S]*?data-estimator-field="savedQualities"/)
    })

    it('sorts tutorial section headers numerically in CostEstimateTutorial to guarantee Section 1 is first and Section 10 is last', () => {
        expect(tutorialComponentSource).toContain('Number(a.dataset.tutorialSection) - Number(b.dataset.tutorialSection)')
    })

    it('adapts explainer modal panel placement to prevent obscuring top-right controls', () => {
        expect(tutorialComponentSource).toContain("const [panelPlacement, setPanelPlacement] = useState<'top-right' | 'bottom-right'>('top-right')")
        expect(tutorialComponentSource).toContain('targetRect.top < 340')
        expect(tutorialComponentSource).toMatch(/setPanelPlacement\((?:targetIsTopRight \? 'bottom-right' : 'top-right'|nextPlacement)\)/)
    })

    it('defines copy for monthlyExpensesBreakdown and monthlyProductionM in en, hi, and gu', () => {
        for (const lang of ['en', 'hi', 'gu'] as const) {
            expect(costEstimateTutorialCopy[lang].fields.monthlyExpensesBreakdown).toBeDefined()
            expect(costEstimateTutorialCopy[lang].fields.monthlyExpensesBreakdown.title).toBeTruthy()
            expect(costEstimateTutorialCopy[lang].fields.monthlyExpensesBreakdown.description).toBeTruthy()

            expect(costEstimateTutorialCopy[lang].fields.monthlyProductionM).toBeDefined()
            expect(costEstimateTutorialCopy[lang].fields.monthlyProductionM.title).toBeTruthy()
            expect(costEstimateTutorialCopy[lang].fields.monthlyProductionM.description).toBeTruthy()
        }
    })

    it('defines copy for savedQualityPicker in en, hi, and gu', () => {
        for (const lang of ['en', 'hi', 'gu'] as const) {
            expect(costEstimateTutorialCopy[lang].fields.savedQualityPicker).toBeDefined()
            expect(costEstimateTutorialCopy[lang].fields.savedQualityPicker.title).toBeTruthy()
            expect(costEstimateTutorialCopy[lang].fields.savedQualityPicker.description).toBeTruthy()
        }
    })
})
