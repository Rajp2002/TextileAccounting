import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Base Settings cold-load regression', () => {
    const settings = read('app/(dashboard)/owner/settings/page.tsx')
    const profile = read('components/settings/factory-cost-profile.tsx')
    const qualities = read('components/settings/template-manager.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    it('mounts the current plan settings on the Settings route', () => {
        expect(settings).toContain('<PlanAwareSettingsView')
        expect(settings).toContain('initialDefaults={costProfileData')
    })

    it('turns cold-load failures into visible retry states instead of empty panels', () => {
        for (const component of [profile, qualities]) {
            expect(component).toContain('const [loadError, setLoadError]')
            expect(component).toContain('userFacingError(res.error')
            expect(component).toContain('role="alert"')
            expect(component).toContain('Retry')
        }

        expect(profile).toContain('const loadedSections: FactorySections')
        expect(profile).toContain('DEFAULT_FACTORY_SECTIONS')
        expect(qualities).toContain('getEstimatorTemplates({ includeArchived: true })')
    })

    it('persists the first baseline and hydrates it into Settings and Estimator', () => {
        expect(actions).toContain('is_configured: data.is_configured ?? true')
        expect(profile).toContain('setMonthlyOutputM(Number(d.monthly_output_m ?? 0))')
        expect(estimator).toContain('monthlyOutputM: Number(profile.monthly_output_m ?? base.monthlyOutputM)')
        expect(estimator).toContain('monthlyOutputM:     Number(profile.monthly_output_m ?? 0)')
        expect(estimator).toContain('function profileHasSavedBaseline(profile?: FactoryCostProfile)')
        expect(estimator).toContain('isConfigured: profileHasSavedBaseline(profile)')
    })
})
