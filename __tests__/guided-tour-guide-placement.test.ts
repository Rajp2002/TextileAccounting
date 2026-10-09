import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')
/** The slice of a source from `<PageHeader` to the end of its actions. */
const header = (source: string, from = 0) => {
    const start = source.indexOf('<PageHeader', from)
    expect(start, 'route renders a PageHeader').toBeGreaterThanOrEqual(0)
    return source.slice(start, source.indexOf('/>\n', source.indexOf('</>}', start)))
}

/**
 * Every route's guided tour opens from one Guide button in its page header, beside the route's
 * primary action. There are no side rails: the Guide opens a modal holding the tour and the
 * route's help (see components/tours/TourInvitation.tsx).
 */
describe('Guided tour Guide placement across all sections', () => {
    const styles = read('app/globals.css')
    const shell = read('components/tours/ReplicaGuidedTour.tsx')

    it('has no side rail composition left in the global styles', () => {
        expect(styles).not.toMatch(/-left-rail|reference-rail|actions-rail|--rail-w|--rail-left|--rail-right/)
        expect(styles).toContain('There are no side rails.')
    })

    it('hands a wrapped page its tour through PageTourProvider instead of drawing a launcher', () => {
        expect(shell).not.toContain('<TourInvitation')
        expect(shell).not.toContain('<aside')
        expect(shell).toContain('<PageTourProvider value={tour}>')
        // The tour's sample page draws the same Guide button, inert.
        expect(shell).toContain('<PageTourProvider value={{ tourId, sample: true }}>')
    })

    it('Cost Estimator: the tutorial is the header Guide, with glossary and archive as its topics', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const tutorial = read('components/estimator/CostEstimateTutorial.tsx')
        const actions = header(estimator)
        expect(actions).toContain('<CostEstimateTutorial')
        expect(actions).toContain('topics={[factoryGlossaryTopic, archivePolicyTopic]}')
        expect(estimator).not.toContain('estimator-left-rail')
        expect(estimator).not.toContain('estimator-reference-rail')
        expect(tutorial).toContain('<TourInvitation')
        expect(tutorial).toContain('launchDisabled={!enabled}')
    })

    it('Saved Costings (paid and Free): the tutorial is the header Guide before New Costing', () => {
        const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const free = read('app/free/costings/SavedFreeCostings.tsx')
        const tutorial = read('components/estimator/SavedCostingsTutorial.tsx')
        const paidActions = header(quotes)
        expect(paidActions).toContain('<SavedCostingsTutorial')
        expect(paidActions).toContain('topics={[archivePolicyTopic]}')
        expect(paidActions.indexOf('<SavedCostingsTutorial')).toBeLessThan(paidActions.indexOf('data-tour-anchor="costings.new"'))
        expect(quotes.match(/<SavedCostingsTutorial\b/g)).toHaveLength(1)
        const freeActions = header(free)
        expect(freeActions).toContain('{!embedded && <SavedCostingsTutorial free')
        expect(freeActions).toContain('data-tour-anchor="free-costings.new"')
        expect(tutorial).toContain('<TourInvitation')
        expect(tutorial).toContain('tourId="saved-costings"')
        // Compare versions is a Guide action on paid plans, More help a Guide topic.
        expect(tutorial).toContain("control: 'compare-tour'")
        expect(tutorial).toContain('topics={[...(free ? [] : [compare]), help, ...topics]}')
    })

    it('Rate Book: the tutorial is the header Guide with principles, help and archive as topics', () => {
        const rates = read('app/(dashboard)/owner/rates/RatesClient.tsx')
        const tutorial = read('components/rates/RateBookTutorial.tsx')
        const actions = header(rates)
        expect(actions).toContain('<RateBookTutorial')
        expect(actions).toContain("id: 'rate-book-principles'")
        expect(actions).toContain('rateBookHelpTopic,')
        expect(actions).toContain('archivePolicyTopic,')
        expect(actions).toContain('data-ratebook-field="addRateAction"')
        expect(rates.match(/<RateBookTutorial\b/g)).toHaveLength(1)
        expect(tutorial).toContain('<TourInvitation')
        expect(tutorial).toContain('tourId="rate-book"')
    })

    it('Machine Assignments: the Guide and management actions sit in its own page header', () => {
        const assignments = read('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx')
        const actions = header(assignments)
        expect(actions).toContain('<TourInvitation')
        expect(actions).toContain('tourId="configuration"')
        expect(actions).toContain("id: 'configuration-help'")
        expect(actions).toContain('data-configuration-tour="add-worker"')
        expect(actions).toContain('data-configuration-tour="daily-sheet"')
        expect(assignments).not.toContain('configuration-guide-rail')
        expect(assignments).not.toContain('configuration-actions-rail')
    })

    it('Production and Payroll: the wrapped page header reads the tour through PageGuide', () => {
        const production = read('app/(dashboard)/owner/production/BaseProductionClient.tsx')
        const actions = header(production)
        expect(actions).toContain('<PageGuide />')
        expect(actions).toContain('data-tour-anchor="production.activate"')
        expect(actions).toContain('data-tour-anchor="payroll.settle"')
        expect(actions).toContain('data-tour-anchor="payroll.records"')
        expect(read('components/production/ProductionGuidedTour.tsx')).toContain('tourId="production"')
        expect(read('components/payroll/PayrollGuidedTour.tsx')).toContain('tourId="payroll"')
    })

    it('Workers and Machines: the Guide is passed into the page header before the add action', () => {
        for (const [register, pageHeader, tourId] of [
            ['app/(dashboard)/owner/production/registers/WorkersRegister.tsx', 'components/workers/WorkersPageHeader.tsx', 'workers'],
            ['app/(dashboard)/owner/production/registers/MachinesRegister.tsx', 'components/machines/MachinesPageHeader.tsx', 'machines'],
        ] as const) {
            const source = read(register)
            const guide = source.slice(source.indexOf('guide={'), source.indexOf('onAdd={tourStep'))
            expect(guide).toContain(`data-${tourId}-tour="launcher"`)
            expect(guide).toContain('<TourInvitation')
            expect(guide).toContain(`tourId="${tourId}"`)
            expect(guide).toContain(`id: '${tourId}-help'`)
            expect(source).not.toContain(`${tourId}-left-rail`)
            expect(source).not.toContain(`${tourId}-reference-rail`)
            expect(read(pageHeader)).toContain('actions={<>{guide}<')
        }
    })

    it('Stock, Dispatch and Daily Sheet: the wrapped page header renders PageGuide', () => {
        for (const page of [
            'app/(dashboard)/owner/stock/QualityStockClient.tsx',
            'app/(dashboard)/owner/stock/YarnStockClient.tsx',
            'app/(dashboard)/owner/dispatches/ChallansClient.tsx',
            'app/(dashboard)/owner/production/BaseDailyProductionSheet.tsx',
        ]) expect(header(read(page))).toContain('<PageGuide />')
        expect(read('components/stock/StockGuidedTour.tsx')).toContain('tourId={kind}')
        expect(read('components/dispatches/DispatchGuidedTour.tsx')).toContain('tourId="dispatch"')
        expect(read('components/production/DailySheetGuidedTour.tsx')).toContain('tourId="daily-sheet"')
    })
})
