import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Each feature task appends its tour files to this explicit review surface.
const tourFiles = [
    'components/tours/GuidedTour.tsx',
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
    // Owner-authorized GT-02 cleanup of legacy Estimator persistence only.
    'components/estimator/CostEstimateTutorial.tsx',
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
        expect(source).toContain('userMetadata={{ cost_estimate_tutorial_dismissed: accountDismissed }}')
    })
})
