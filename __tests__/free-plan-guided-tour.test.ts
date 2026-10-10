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
        expect(estimatorClientSource).toContain('enabled={(state.isConfigured || !factoryWizardOpen) && !saving}')
        expect(estimatorClientSource).not.toContain('enabled={!freeMode && state.isConfigured && !saving}')
        expect(estimatorClientSource).toContain('freePlan={freeMode}')
    })

    it('removes pb-[50dvh] from QuickCostingView and Detailed costing view to prevent excessive scroll overshoot', () => {
        expect(estimatorClientSource).not.toContain('pb-[50dvh]')
    })

    it('uses the same ten-step runtime on Free with no paid library target', () => {
        expect(tutorialSource).toContain('freePlan = false')
        expect(tutorialSource).toContain('freePlan={freePlan}')
        const steps = fs.readFileSync(path.resolve(__dirname, '../lib/estimator-tour.ts'), 'utf8')
        expect(steps.match(/id: 'est-/g)).toHaveLength(10)
        expect(steps).not.toContain('savedQualityPicker')
        expect(steps).not.toContain('savedQualities')
    })

    it('forwards modern account preferences and user/org identity on both routes', () => {
        const paidPage = fs.readFileSync(path.resolve(__dirname, '../app/(dashboard)/owner/estimator/page.tsx'), 'utf8')
        for (const source of [paidPage, freePageSource]) {
            expect(source).toContain('userMetadata={{ tour_preferences: user.user_metadata?.tour_preferences }}')
            expect(source).toContain('userId={user.id}')
            expect(source).toContain('orgId={profile.org_id}')
        }
        expect(freeClientSource).toContain('userMetadata={userMetadata}')
        expect(estimatorClientSource).toContain('userMetadata={userMetadata}')
        expect(tutorialSource).toContain('...userMetadata, cost_estimate_tutorial_dismissed: accountDismissed')
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
