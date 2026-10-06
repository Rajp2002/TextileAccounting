import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
/** The props passed to the guide card: callers size it, the card owns its look. */
const invitationProps = (source: string) => {
    const start = source.indexOf('<TourInvitation')
    return source.slice(start, source.indexOf('/>', start))
}

describe('Guided Tour Left Rail Placement Across All Sections', () => {
    const styles = read('app/globals.css')

    // 1. Cost Estimator
    it('verifies Cost Estimator renders TourInvitation in .estimator-left-rail', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const tutorial = read('components/estimator/CostEstimateTutorial.tsx')

        expect(estimator).toContain('<aside\n                    className="estimator-left-rail space-y-3"')
        expect(estimator).toContain('<CostEstimateTutorial')
        expect(tutorial).toContain('<TourInvitation')
        expect(tutorial).toContain('align="full"')
        expect(invitationProps(tutorial)).not.toContain('amber')
    })

    // 2. Saved Costings
    it('verifies Saved Costings renders TourInvitation in .saved-costings-left-rail', () => {
        const quotesClient = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const savedFree = read('app/free/costings/SavedFreeCostings.tsx')
        const savedTutorial = read('components/estimator/SavedCostingsTutorial.tsx')

        const guide = quotesClient.match(/<aside\b[^>]*className=\{cn\("saved-costings-left-rail space-y-3",\s*isLite && mobileStyles\.help\)\}[^>]*>[\s\S]*?<\/aside>/)?.[0]
        expect(guide).toBeDefined()
        expect(guide).toContain('<SavedCostingsTutorial')
        expect(guide).toContain('data-expanded={helpOpen || tourStep !== null}')
        expect(quotesClient.match(/<SavedCostingsTutorial\b/g)).toHaveLength(1)
        expect(quotesClient).toContain("useOwnerPlan() === 'lite'")
        expect(quotesClient).toContain('<SavedCostingsTutorial')
        expect(savedFree).toContain('<aside className="saved-costings-left-rail"')
        expect(savedTutorial).toContain('<TourInvitation')
        expect(savedTutorial).toContain('tourId="saved-costings"')
        expect(savedTutorial).toContain('align="full"')
        expect(invitationProps(savedTutorial)).not.toContain('amber')
    })

    // 3. Rate Book
    it('verifies Rate Book renders TourInvitation in .rates-left-rail-desktop', () => {
        const ratesClient = read('app/(dashboard)/owner/rates/RatesClient.tsx')
        const rateTutorial = read('components/rates/RateBookTutorial.tsx')

        const guide = ratesClient.match(/<aside\b[^>]*className=\{cn\("rates-left-rail-desktop space-y-3",\s*isLite && mobileStyles\.help\)\}[^>]*>[\s\S]*?<\/aside>/)?.[0]
        expect(guide).toBeDefined()
        expect(guide).toContain('<RateBookTutorial')
        expect(guide).toContain('data-expanded={helpOpen || tourStep !== null}')
        expect(ratesClient.match(/<RateBookTutorial\b/g)).toHaveLength(1)
        expect(ratesClient).toContain("useOwnerPlan() === 'lite'")
        const mobileStyles = read('components/estimator/lite-records.module.css')
        expect(mobileStyles.slice(0, mobileStyles.indexOf('@media'))).not.toMatch(/\.help[^{}]*\{/)
        expect(mobileStyles).toContain(".help:not([data-expanded='true']) { display: none; }")
        expect(ratesClient).toContain('<RateBookTutorial')
        expect(rateTutorial).toContain('<TourInvitation')
        expect(rateTutorial).toContain('tourId="rate-book"')
    })

    // 4. Machine Assignments
    it('verifies Machine Assignments renders TourInvitation in .configuration-guide-rail', () => {
        const assignments = read('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx')

        expect(assignments).toContain('<aside className="configuration-guide-rail"')
        expect(assignments).toContain('<TourInvitation')
        expect(assignments).toContain('tourId="configuration"')
        expect(assignments).toContain('align="full"')
        expect(invitationProps(assignments)).not.toContain('amber')
    })

    // 5. Production
    it('keeps the Production launcher and replica inside their shared rail/workspace contract', () => {
        const productionTour = read('components/production/ProductionGuidedTour.tsx')
        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(productionTour).toContain('<ReplicaGuidedTour')
        expect(productionTour).toContain('railClassName="production-left-rail"')
        expect(productionTour).toContain('workspaceClassName=""')
        expect(productionTour).toContain('tourId="production"')
        expect(shell).toContain('align="full"')
        expect(invitationProps(shell)).not.toContain('amber')
    })

    // 6. Workers Register
    it('verifies Workers Register renders TourInvitation in .workers-left-rail', () => {
        const workersRegister = read('app/(dashboard)/owner/production/registers/WorkersRegister.tsx')

        expect(workersRegister).toContain('<aside className="workers-left-rail guided-tour-left-rail space-y-3"')
        expect(workersRegister).toContain('data-workers-tour="launcher"')
        expect(workersRegister).toContain('<TourInvitation')
        expect(workersRegister).toContain('tourId="workers"')
        expect(workersRegister).toContain('align="full"')
        expect(invitationProps(workersRegister)).not.toContain('amber')
    })

    // 7. Machines Register
    it('verifies Machines Register renders TourInvitation in .machines-left-rail', () => {
        const machinesRegister = read('app/(dashboard)/owner/production/registers/MachinesRegister.tsx')

        expect(machinesRegister).toContain('<aside className="machines-left-rail guided-tour-left-rail space-y-3"')
        expect(machinesRegister).toContain('data-machines-tour="launcher"')
        expect(machinesRegister).toContain('<TourInvitation')
        expect(machinesRegister).toContain('tourId="machines"')
        expect(machinesRegister).toContain('align="full"')
        expect(invitationProps(machinesRegister)).not.toContain('amber')
    })

    // 8. Payroll
    it('verifies Payroll renders TourInvitation in .payroll-left-rail', () => {
        const payrollTour = read('components/payroll/PayrollGuidedTour.tsx')

        expect(payrollTour).toContain('<ReplicaGuidedTour')
        expect(payrollTour).toContain('railClassName="payroll-left-rail"')
        expect(read('components/tours/ReplicaGuidedTour.tsx')).toContain('<TourInvitation')
        expect(payrollTour).toContain('tourId="payroll"')
        expect(read('components/tours/ReplicaGuidedTour.tsx')).toContain('align="full"')
        expect(payrollTour).not.toContain('bg-saffron-soft/75')
    })

    // 9 & 10. Fabric Stock & Yarn Stock
    it('verifies Stock (Fabric & Yarn) renders TourInvitation in .stock-left-rail', () => {
        const stockTour = read('components/stock/StockGuidedTour.tsx')

        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(stockTour).toContain('<ReplicaGuidedTour')
        expect(stockTour).toContain('railClassName="stock-left-rail"')
        expect(stockTour).toContain('workspaceClassName="stock-workspace-shell')
        expect(stockTour).toContain('tourId={kind}')
        expect(shell).toContain('className={`${railClassName} guided-tour-left-rail space-y-2`}')
        expect(shell).toContain('<TourInvitation')
        expect(shell).toContain('align="full"')
        expect(invitationProps(shell)).not.toContain('amber')
    })

    // 11. Dispatches
    it('verifies Dispatches renders TourInvitation in .dispatch-left-rail', () => {
        const dispatchTour = read('components/dispatches/DispatchGuidedTour.tsx')

        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(dispatchTour).toContain('<ReplicaGuidedTour')
        expect(dispatchTour).toContain('railClassName="dispatch-left-rail"')
        expect(dispatchTour).toContain('workspaceClassName=""')
        expect(dispatchTour).toContain('tourId="dispatch"')
        expect(shell).toContain('className={`${railClassName} guided-tour-left-rail space-y-2`}')
        expect(shell).toContain('<TourInvitation')
        expect(shell).toContain('align="full"')
        expect(shell).not.toContain('guideCard=')
        expect(invitationProps(shell)).not.toContain('amber')
    })

    // 12. Daily Sheet
    it('verifies the Daily Sheet guide sits in the shared left rail with its controls in the right rail', () => {
        const dailyTour = read('components/production/DailySheetGuidedTour.tsx')
        const shell = read('components/tours/ReplicaGuidedTour.tsx')
        expect(dailyTour).toContain('<ReplicaGuidedTour')
        expect(dailyTour).toContain('railClassName={`production-left-rail ')
        expect(dailyTour).toContain('workspaceClassName=""')
        expect(dailyTour).toContain('tourId="daily-sheet"')
        expect(dailyTour).not.toContain('<TourInvitation')
        expect(shell).toContain('className={`${railClassName} guided-tour-left-rail space-y-2`}')
        // Same composition as Production: the workspace is centred between the rails from 1440px and clears the right rail from 1280px.
        const tier = styles.slice(styles.indexOf('@media (min-width: 1440px) {'))
        const centred = tier.slice(tier.indexOf('.estimator-workspace-shell,'), tier.indexOf('width: min(100%, var(--workspace-w));'))
        expect(centred).toContain('.production-daily-sheet-workspace')
        expect(tier.slice(0, tier.indexOf('.estimator-workspace-shell,'))).not.toContain('.production-daily-sheet-workspace')
        const clearance = styles.slice(styles.indexOf('Guides rendered outside their route'))
        expect(clearance.slice(0, clearance.indexOf(') :is('))).toContain('.production-daily-sheet-rail')
    })

    // CSS verification
    it('defines responsive positioning in globals.css for all left rail classes', () => {
        const rails = [
            'estimator-left-rail',
            'saved-costings-left-rail',
            'rates-left-rail-desktop',
            'configuration-guide-rail',
            'guided-tour-left-rail',
            'production-left-rail',
            'workers-left-rail',
            'machines-left-rail',
            'payroll-left-rail',
            'stock-left-rail',
            'dispatch-left-rail',
        ]

        // All classes exist in CSS
        for (const rail of rails) {
            expect(styles).toContain(`.${rail}`)
        }

        // Every left rail shares one fixed placement beside the workspace from 1440px.
        const tier = styles.slice(styles.indexOf('@media (min-width: 1440px) {'))
        const block = tier.slice(0, tier.indexOf('}', tier.indexOf('.dispatch-left-rail {')))
        for (const rail of rails) expect(block).toContain(`.${rail}`)
        expect(block).toContain('position: fixed;')
        expect(block).toContain('top: var(--rail-top);')
        expect(block).toContain('left: var(--rail-left);')
        expect(block).toContain('width: var(--rail-w);')

        // Rail width scales with the viewport through the shared token only.
        expect(styles).toMatch(/@media\s*\(min-width:\s*1680px\)\s*\{\s*:root\s*\{\s*--rail-w:\s*16rem;/)
        expect(styles).toMatch(/@media\s*\(min-width:\s*1920px\)\s*\{\s*:root\s*\{\s*--rail-w:\s*17rem;/)
    })
})
