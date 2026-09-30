import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Each feature task appends its tour files to this explicit review surface.
const tourFiles = [
    'components/machines/MachinesGuidedTour.tsx',
    'app/(dashboard)/owner/production/registers/MachinesRegister.tsx',
    'lib/machines-tour.ts',
    'lib/i18n/machines-tutorial.ts',
    'components/payroll/PayrollGuidedTour.tsx',
    'components/payroll/PayrollTourPreview.tsx',
    'lib/payroll-tour.ts',
    'lib/i18n/payroll-tutorial.ts',
    'components/production/DailySheetGuidedTour.tsx',
    'components/production/DailySheetTourPreview.tsx',
    'lib/daily-sheet-tour.ts',
    'lib/i18n/daily-sheet-tutorial.ts',
    'lib/configuration-tour.ts',
    'lib/i18n/configuration-tutorial.ts',
    'components/stock/StockGuidedTour.tsx',
    'components/stock/StockTourPreview.tsx',
    'components/stock/FabricStockTourPreview.tsx',
    'components/stock/YarnStockTourPreview.tsx',
    'lib/stock-tour.ts',
    'lib/i18n/stock-tutorial.ts',
    'components/production/ProductionGuidedTour.tsx',
    'components/production/ProductionTourPreview.tsx',
    'lib/production-tour.ts',
    'lib/i18n/production-tutorial.ts',
    'app/(dashboard)/owner/production/registers/WorkersRegister.tsx',
    'lib/workers-tour.ts',
    'lib/i18n/workers-tutorial.ts',
    'components/tours/GuidedTour.tsx',
    'components/tours/ReplicaGuidedTour.tsx',
    'components/dispatches/DispatchGuidedTour.tsx',
    'components/dispatches/DispatchTourPreview.tsx',
    'lib/dispatch-tour.ts',
    'lib/i18n/dispatch-tutorial.ts',
    'components/tours/TourPanel.tsx',
    'components/tours/TourSpotlight.tsx',
    'components/tours/TourInvitation.tsx',
    'hooks/use-guided-tour.ts',
    'hooks/use-tour-invitation.ts',
    'lib/tours/active-tour.ts',
    'lib/tours/placement.ts',
    'lib/tours/sample-ids.ts',
    'lib/tours/target-readiness.ts',
    'lib/tours/tour-preferences.ts',
    'lib/tours/tour-registry.ts',
    'lib/tours/tour-scroll.ts',
    'lib/tours/tour-text.ts',
    'lib/tours/tour-types.ts',
    // GT-05 launcher, lazy runtime, state specifications and copy.
    'components/estimator/CostEstimateTutorial.tsx',
    'components/estimator/CostEstimateTourRuntime.tsx',
    'lib/estimator-tour.ts',
    'lib/i18n/cost-estimate-tutorial.ts',
    'components/estimator/SavedCostingsTutorial.tsx',
    'components/estimator/SavedCostingsTourRuntime.tsx',
    'lib/saved-costings-tour.ts',
    'lib/i18n/saved-costings-tutorial.ts',
    'components/rates/RateBookTutorial.tsx',
    'components/rates/RateBookTourRuntime.tsx',
    'lib/rate-book-tour.ts',
    'lib/i18n/rate-book-tutorial.ts',
]
const forbidden = ['freeMeter', '/api/free/calculate', 'complete_free_saved_costing', 'saveEstimatorQuoteV3', 'saveBaseDailyProductionBatch', 'mutateYarnStock', 'mutate_delivery_challan', 'settleBaseWorkerPayroll']

describe('Tour data-safety contract', () => {
    it('lists every shared tour library file explicitly', () => {
        expect(tourFiles.filter(file => file.startsWith('lib/tours/')).sort()).toEqual(readdirSync('lib/tours').filter(file => file.endsWith('.ts')).map(file => `lib/tours/${file}`).sort())
    })
    it.each(tourFiles)('%s has no business action, fetch, quota or refresh path', file => {
        const source = readFileSync(file, 'utf8')
        for (const match of source.matchAll(/(?:from\s*|import\s*\(|require\s*\()['"]([^'"]+)['"]/g)) {
            const specifier = match[1]
            const imported = specifier.startsWith('@/') ? specifier.slice(2) : path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier))
            if (imported.startsWith('app/') && /\/(?:actions|[^/]+-actions)(?:\.ts)?$/.test(imported)) {
                expect(imported, `${file} imports ${specifier}`).toBe('app/actions/tour-preferences')
            }
        }
        expect(source).not.toMatch(/\bfetch\s*\(/)
        expect(source).not.toMatch(/\b(?:revalidatePath|invalidateQueries)\s*\(|\brouter\.refresh\s*\(/)
        for (const token of forbidden) expect(source, `${file}: ${token}`).not.toContain(token)
    })
    it('keeps Yarn previews isolated from drafts, submissions and live-state changes', () => {
        const preview = readFileSync('components/stock/YarnStockTourPreview.tsx', 'utf8')
        expect(preview).not.toMatch(/sessionStorage|localStorage|onSubmit=|onClick=|window\.(?:open|print|location)|<form|<a\s/)
        expect(preview).toContain("if (step === 'ys-handoff') return null")
        const wrapper = readFileSync('components/stock/StockGuidedTour.tsx', 'utf8')
        expect(wrapper).toContain("'fs-handoff' : 'ys-handoff'")
        expect(wrapper).toContain('<div className="stock-workspace-shell">{children}</div>')
    })
    it('keeps Workers samples inside guarded, disabled editors and inert card callbacks', () => {
        const editor = readFileSync('app/(dashboard)/owner/production/registers/WorkerEditor.tsx', 'utf8')
        expect(editor).toContain('if (tourPreview) return')
        expect(editor).toContain('const dirty = !tourPreview && open')
        expect(editor).toContain('disabled={Boolean(tourPreview)}')
        const register = readFileSync('app/(dashboard)/owner/production/registers/WorkersRegister.tsx', 'utf8')
        expect(register).toContain('onEdit={() => {}} tourPreview')
        const card = readFileSync('components/workers/WorkerCard.tsx', 'utf8')
        expect(card).toContain('if (tourPreview) event.preventDefault()')
        expect(card).toContain('if (!tourPreview) onEdit(worker)')
    })
    it('keeps Machines samples guarded and restores live rows only for the handoff', () => {
        const editor = readFileSync('app/(dashboard)/owner/production/registers/MachineEditor.tsx', 'utf8')
        expect(editor).toContain('if (tourPreview) return')
        expect(editor).toContain('const dirty = !tourPreview && open')
        expect(editor).toContain('disabled={Boolean(tourPreview)}')
        const register = readFileSync('app/(dashboard)/owner/production/registers/MachinesRegister.tsx', 'utf8')
        expect(register).toContain('onEdit={() => {}} tourPreview')
        expect(register).toContain("const tourSampleActive = tourStep !== null && tourStep !== 'mc-handoff'")
        expect(register).toContain('onAdd={tourStep ? () => {} : add}')
        expect(register).toContain('onEdit={tourStep ? () => {} : edit}')
        expect(register).toContain('inert={tourStep !== null}')
        const card = readFileSync('components/machines/MachineCard.tsx', 'utf8')
        expect(card).toContain('if (tourPreview) event.preventDefault()')
        expect(card).toContain('if (!tourPreview) onEdit(machine)')
    })
    it('keeps assignment mutations behind tour and sample-id guards while samples shadow live state', () => {
        const page = readFileSync('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx', 'utf8')
        for (const name of ['handleAssign', 'handleUndoAssignment', 'handleRemove']) {
            const body = page.slice(page.indexOf(`async function ${name}`))
            const guard = body.slice(0, body.indexOf('try {'))
            expect(guard).toMatch(/if \(tourStep(?: \|\| pendingKey)?\) return/)
            expect(guard).toContain('isSampleRecordId(')
            expect(guard).toContain('tourCommonCopy[language].sampleBanner')
        }
        expect(page).toContain('inert={tourStep !== null}')
        expect(page).toContain('disabled={Boolean(tourStep) || isOptionDisabled}')
        expect(page).toContain('inert={Boolean(tourStep)} showCloseButton={!tourStep} hideOverlay={Boolean(tourStep)}')
        expect(page).toContain("if (!tourStep || tourStep === 'ma-handoff') return liveData")
        const launch = page.slice(page.indexOf('onLaunch={() => {'), page.indexOf('onLaunch={() => {') + 550)
        expect(launch).not.toMatch(/router\.refresh|handleAssign|setPickerWorkerId|setShift/)
        expect(launch).toContain('if (pendingKey || selectedPickerWorkerId) return')
        expect(page).toContain('onClick={event => { if (tourStep) event.preventDefault() }}')
    })
    it('preference events never invalidate a route or write business rows', () => {
        const source = readFileSync('app/actions/tour-preferences.ts', 'utf8')
        expect(source).not.toContain('revalidatePath')
        expect(source).not.toContain('.from(')
        expect(source).toContain("requireRole(['owner'], { allowFreeAccount: true })")
        expect(source).toContain('supabase.auth.updateUser')
    })
    it('retires Estimator legacy writes and retries while forwarding its legacy account read', () => {
        const source = readFileSync('components/estimator/CostEstimateTutorial.tsx', 'utf8')
        expect(source).not.toMatch(/dismissCostEstimateTutorial|syncDismissal|syncFailed|localStorage\.(?:setItem|removeItem)/)
        expect(source).toContain('userMetadata={{ ...userMetadata, cost_estimate_tutorial_dismissed: accountDismissed }}')
    })
})
