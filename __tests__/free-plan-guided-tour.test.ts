import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

describe('Free Plan Guided Tour & Viewport Scope', () => {
    const estimatorClientPath = path.resolve(__dirname, '../app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const estimatorClientSource = fs.readFileSync(estimatorClientPath, 'utf8')

    const tutorialPath = path.resolve(__dirname, '../components/estimator/CostEstimateTutorial.tsx')
    const tutorialSource = fs.readFileSync(tutorialPath, 'utf8')

    const freeClientPath = path.resolve(__dirname, '../app/free/FreeClient.tsx')
    const freeClientSource = fs.readFileSync(freeClientPath, 'utf8')

    const freePagePath = path.resolve(__dirname, '../app/free/page.tsx')
    const freePageSource = fs.readFileSync(freePagePath, 'utf8')

    it('enables CostEstimateTutorial regardless of freeMode, passing freePlan={freeMode}', () => {
        expect(estimatorClientSource).toContain('enabled={state.isConfigured && !saving}')
        expect(estimatorClientSource).not.toContain('enabled={!freeMode && state.isConfigured && !saving}')
        expect(estimatorClientSource).toContain('freePlan={freeMode}')
    })

    it('removes pb-[50dvh] from QuickCostingView and Detailed costing view to prevent excessive scroll overshoot', () => {
        expect(estimatorClientSource).not.toContain('pb-[50dvh]')
    })

    it('accepts freePlan prop in CostEstimateTutorial and excludes Section 10 (Saved qualities) when freePlan is true', () => {
        expect(tutorialSource).toContain('freePlan = false')
        expect(tutorialSource).toContain("if (freePlan && (header.dataset.estimatorField === 'savedQualities' || Number(header.dataset.tutorialSection) === 10)) return")
        expect(tutorialSource).toContain("if (header.dataset.estimatorField === 'savedQualities') {")
        expect(tutorialSource).toContain('if (freePlan) return')
    })

    it('passes tutorialDismissed from user metadata in app/free/page.tsx to FreeClient', () => {
        expect(freePageSource).toContain('tutorialDismissed={user.user_metadata?.cost_estimate_tutorial_dismissed === true}')
    })

    it('accepts tutorialDismissed in FreeClient and passes it dynamically to EstimatorClient', () => {
        expect(freeClientSource).toContain('tutorialDismissed = false')
        expect(freeClientSource).toContain('tutorialDismissed={tutorialDismissed}')
        expect(freeClientSource).not.toMatch(/tutorialDismissed\s+wizardDismissed/)
    })
})
