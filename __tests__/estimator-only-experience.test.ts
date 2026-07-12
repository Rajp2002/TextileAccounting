import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Estimator-only product presentation', () => {
    const sidebar = read('components/navigation/owner-sidebar.tsx')
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const settings = read('app/(dashboard)/owner/settings/page.tsx')
    const settingsLayout = read('app/(dashboard)/owner/settings/layout.tsx')
    const gate = read('components/billing/AccessGate.tsx')
    const costProfile = read('components/settings/factory-cost-profile.tsx')

    it('limits Base navigation to estimator destinations and account billing', () => {
        expect(sidebar).toContain("new Set(['/owner/estimator', '/owner/quotes', '/owner/settings'])")
        expect(sidebar).toContain("? 'Saved Costings'")
        expect(sidebar).toContain('Subscription & Billing')
    })

    it('removes party requirements and quote workflow actions from Base costing', () => {
        expect(estimator).toContain('!canUseProduction || mode === \'market\'')
        expect(estimator).toContain("? qualityLabel.trim()")
        expect(estimator).toContain("'Update Costing' : 'Save Costing'")
        expect(estimator).toContain("canUseProduction ? t('estimator.hud.quote_per_m') : 'Final Price / m'")
        expect(estimator).toContain("canUseProduction ? t('estimator.order_basics.title') : 'Costing Details'")
        expect(estimator).toContain("!canUseProduction ? 'Costing Quantity'")
        expect(estimator).toContain('{canUseProduction && <Button')
    })

    it('presents persisted quote entities as saved costings without forking persistence', () => {
        expect(quotes).toContain("canUseProduction ? 'Quote History' : 'Saved Costings'")
        expect(quotes).toContain("'Open & Update'")
        expect(quotes).toContain("'Duplicate Costing'")
        expect(estimator).toContain('saveEstimatorQuoteV3({')
    })

    it('does not mount full-suite settings for the Estimator Plan', () => {
        expect(settingsLayout).toContain('requiredTier="base"')
        expect(settings).toContain('{hasPremium && <div')
        expect(settings).toContain('{hasPremium && <SettingsSection id="automations"')
        expect(settings).toContain("hasPremium ? 'Production Costing & Templates' : 'Estimator Defaults'")
        expect(settings).toContain('Weavly Estimator')
        expect(settings).toContain('<FactoryCostProfile standaloneEstimator={!hasPremium} />')
        expect(settings).toContain('Password & Security')
        expect(settings).toContain('</aside> : <aside className="sticky top-6 space-y-4">')
        expect(costProfile).toContain("standaloneEstimator ? 'Save Estimator Defaults' : 'Save Factory Profile'")
    })

    it('keeps Base updates on the same editable persistence record', () => {
        expect(estimator).toContain("handleSaveQuote('quote', canUseProduction ? 'accepted' : 'draft')")
    })

    it('uses an intentional deep-link explanation with a return path', () => {
        expect(gate).toContain('Continue with Weavly Estimator')
        expect(gate).toContain('Return to Estimator')
        expect(gate).not.toContain('Lock className=')
    })
})
