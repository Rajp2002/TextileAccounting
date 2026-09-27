import { describe, expect, it } from 'vitest'
import { buildEstimatorCoreTour, type EstimatorTourContext } from '../lib/estimator-tour'
import { costEstimateWorkflowCopy } from '../lib/i18n/cost-estimate-workflow'
import { costEstimateTutorialCopy, isTutorialField } from '../lib/i18n/cost-estimate-tutorial'
import fs from 'node:fs'

const base: EstimatorTourContext = {
    freePlan: false, standalone: true, existingCosting: false,
    productionPipeline: true, overheadMode: 'direct',
}
const copies = (context: EstimatorTourContext) => buildEstimatorCoreTour(context).map(step => step.copy)

describe('estimator workflow tour', () => {
    it('teaches the pricing loop, with separate snapshot and recipe decisions', () => {
        expect(copies(base)).toEqual([
            'purpose', 'quality', 'warp', 'weft', 'manufacturing', 'overheadDirect',
            'review', 'saveCosting', 'recipe', 'nextProduction',
        ])
    })

    it('keeps Free within its metered snapshot workflow', () => {
        const context = { ...base, freePlan: true, productionPipeline: false }
        expect(copies(context)).toEqual([
            'purpose', 'qualityFree', 'warp', 'weft', 'manufacturing', 'overheadDirect',
            'reviewFree', 'saveFree', 'next',
        ])
        expect(buildEstimatorCoreTour(context).some(step => ['savedQualities', 'savedQualityPicker'].includes(step.field))).toBe(false)
        expect(costEstimateWorkflowCopy.en.steps.saveFree.description).toContain('one monthly costing')
        expect(copies({ ...base, freePlan: true }).at(-1)).toBe('next')
    })

    it('matches save instructions to the active workflow, including reused costing versions', () => {
        expect(copies({ ...base, existingCosting: true })).toContain('saveVersion')
        expect(copies({ ...base, standalone: false })).toContain('saveQuotation')
        // Loading a costing in a full workspace still uses snapshot actions.
        expect(copies({ ...base, existingCosting: true })).toContain('saveVersion')
        expect(copies({ ...base, productionPipeline: false }).at(-1)).toBe('next')
    })

    it('teaches only the selected overhead method without changing it', () => {
        const context = { ...base, overheadMode: 'monthly_expenses' as const }
        expect(buildEstimatorCoreTour(context)[5]).toEqual({ field: 'monthlyOverhead', copy: 'overheadMonthly' })
        expect(context.overheadMode).toBe('monthly_expenses')
        expect(copies(context)).not.toContain('overheadDirect')
    })

    it('provides localized copy and stable targets for every entitlement combination', () => {
        const visited = new Set<string>()
        for (const freePlan of [false, true]) for (const standalone of [false, true]) {
            for (const existingCosting of [false, true]) {
                for (const productionPipeline of [false, true]) for (const overheadMode of ['direct', 'monthly_expenses'] as const) {
                    for (const step of buildEstimatorCoreTour({ freePlan, standalone, existingCosting, productionPipeline, overheadMode })) {
                        expect(isTutorialField(step.field)).toBe(true)
                        visited.add(step.copy)
                        for (const language of ['en', 'gu', 'hi'] as const) {
                            const copy = costEstimateWorkflowCopy[language].steps[step.copy]
                            expect(copy.title.length).toBeGreaterThan(0)
                            expect(copy.description.length).toBeGreaterThan(0)
                            if (language === 'gu') expect(copy.description).toMatch(/\p{Script=Gujarati}/u)
                            if (language === 'hi') expect(copy.description).toMatch(/\p{Script=Devanagari}/u)
                        }
                    }
                }
            }
        }
        expect([...visited].sort()).toEqual(Object.keys(costEstimateWorkflowCopy.en.steps).sort())
    })

    it('retains financial consequences and small worked examples in all languages', () => {
        for (const { steps } of Object.values(costEstimateWorkflowCopy)) {
            for (const token of ['2 kg/100m', '₹200/kg', '₹4/m', '0']) expect(steps.warp.description).toContain(token)
            for (const token of ['₹60,000', '30,000 m', '₹2/m']) expect(steps.overheadMonthly.description).toContain(token)
            for (const token of ['₹100/m', '20%', '₹125/m']) expect(steps.review.description).toContain(token)
            expect(steps.recipe.description).toContain('Save Quality & Create Costing')
            expect(steps.recipe.description).toContain('Quality changed · Update Quality')
        }
        expect(costEstimateWorkflowCopy.en.steps.recipe.description).toContain('creates no snapshot')
        expect(costEstimateWorkflowCopy.en.steps.saveCosting.description).toContain('Earlier snapshots keep their original numbers')
    })

    it('keeps optional technical guidance discoverable and never invokes a business action', () => {
        const source = fs.readFileSync('components/estimator/CostEstimateTutorial.tsx', 'utf8')
        expect(source).toContain('workflowCopy.fieldGuide')
        expect(source).toContain("setGuide('fields'); setRequested(true)")
        expect(source).toContain("setSteps(guide === 'core' ? coreSteps : next)")
        expect(source).not.toMatch(/\.click\(|saveEstimatorQuote|saveAsFabricTemplate|updateFabricTemplate/)
        for (const copy of Object.values(costEstimateTutorialCopy)) {
            for (const field of ['shortagePct', 'manualKgPer100m', 'monthlyExpensesBreakdown', 'gstPct', 'commissionPct'] as const) {
                expect(copy.fields[field].description).toBeTruthy()
            }
        }
    })
})
