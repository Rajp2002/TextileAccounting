import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Base Settings cold-load regression', () => {
    const settings = read('app/(dashboard)/owner/settings/page.tsx')
    const actions = read('app/(dashboard)/owner/estimator/actions.ts')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')

    it('mounts the current plan settings on the Settings route', () => {
        expect(settings).toContain('<PlanAwareSettingsView')
        expect(settings).toContain('initialDefaults={costProfileData')
    })

    it('opens with the costing defaults and account email read on the server', () => {
        const layout = read('app/(dashboard)/owner/settings/layout.tsx')
        // Read alongside the organization row; a failed read leaves the page to request them.
        expect(layout).toContain('getFactoryCostProfile({ createIfMissing: false }).catch(() => null)')
        // Started ahead of the access gate, so it overlaps the identity check.
        expect(layout.indexOf('getFactoryCostProfile({')).toBeLessThan(layout.indexOf('<AccessGate'))
        expect(layout).toContain('emailVerified: Boolean(user.email_confirmed_at)')
        // The defaults card keeps its first values, so they must be there on the first render.
        expect(settings).toContain('initialData: settingsBootstrap?.costProfile')
        expect(settings).toContain('enabled: !bootstrapAccount')
    })

    it('persists the first baseline and hydrates it into the Estimator', () => {
        expect(actions).toContain('is_configured: data.is_configured ?? true')
        expect(estimator).toContain('monthlyOutputM: Number(profile.monthly_output_m ?? base.monthlyOutputM)')
        expect(estimator).toContain('monthlyOutputM:     Number(profile.monthly_output_m ?? 0)')
        expect(estimator).toContain('function profileHasSavedBaseline(profile?: FactoryCostProfile)')
        expect(estimator).toContain('isConfigured: profileHasSavedBaseline(profile)')
    })
})
