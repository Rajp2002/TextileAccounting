import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { estimatorTourSteps } from '../lib/estimator-tour'

const estimatorClientSource = readFileSync('app/(dashboard)/owner/estimator/EstimatorClient.tsx', 'utf8')
describe('Estimator Quick-view ordering and protected Detailed view', () => {
    it('puts every whole-card anchor in the specified top-to-bottom Quick order', () => {
        const quick = estimatorClientSource.slice(estimatorClientSource.indexOf('function QuickCostingView('), estimatorClientSource.indexOf('const DETAILED_ESTIMATOR_ISSUE_FIELDS'))
        let last = -1
        for (const step of estimatorTourSteps.slice(0, 7)) {
            const anchor = step.anchor.slice(1, -1)
            const position = quick.indexOf(anchor)
            expect(position).toBeGreaterThan(last)
            expect(quick.slice(quick.lastIndexOf('<EstimatorCard', position), position)).toMatch(/^<EstimatorCard[^>]*$/)
            last = position
        }
        expect(estimatorClientSource).toContain('data-tour-anchor={tourAnchor}')
        expect(quick).toContain('data-estimator-field="qualityLabel"')
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
        // Construction text is derived from the yarn component names, never typed.
        expect(detailedCostingSection1).not.toContain('constructionFields')
        expect(quickCostingSource).not.toContain('constructionFields')
        expect(estimatorClientSource).not.toContain('data-estimator-field="warpConstruction"')
        expect(estimatorClientSource).not.toContain('data-estimator-field="weftConstruction"')
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

})
