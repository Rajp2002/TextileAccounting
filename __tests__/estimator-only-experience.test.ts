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
    const rateBook = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const rateActions = read('app/(dashboard)/owner/rates/actions.ts')

    it('limits Base navigation to estimator destinations and account billing', () => {
        expect(sidebar).toContain("new Set(['/owner/estimator', '/owner/quotes', '/owner/rates', '/owner/settings'])")
        expect(sidebar).toContain("? 'Saved Costings'")
        expect(sidebar).toContain('Yarn Rate Book')
        expect(sidebar).toContain('Subscription & Billing')
    })

    it('presents rates as a single-purpose yarn rate book', () => {
        expect(rateBook).toContain('Yarn Rate Book')
        expect(rateBook).toContain('Add Yarn Rate')
        expect(rateBook).toContain("const YARN_CATEGORIES: YarnRateCategory[] = ['yarn_warp', 'yarn_weft']")
        expect(rateBook).not.toContain("['processing', 'Processing']")
        expect(rateBook).not.toContain("['commercial', 'Commercial Defaults']")
        expect(rateBook).not.toContain('>Saved Qualities</button>')
        expect(rateBook).toContain('Save a quality or costing and its yarn rates will appear here automatically.')
        expect(rateActions).toContain(".from('estimator_quotes')")
        expect(rateActions).toContain(".eq('record_kind', 'costing')")
        expect(rateActions).toContain(".is('template_id', null)")
        expect(rateActions).not.toContain('defaultWarpName')
        expect(rateActions).not.toContain('defaultWeftName')
    })

    it('captures Base commercial context without enabling order workflow actions', () => {
        expect(estimator).toContain("const isStandaloneCostingSession = !canUseProduction || sourceRecordKind === 'costing'")
        expect(estimator).toContain("const resolvedPartyName = effectiveTargetMode === 'market'")
        expect(estimator).toContain('list="estimator-party-options"')
        expect(estimator).toContain('Select a recent customer or type a new one.')
        expect(estimator).toContain("'Save New Version' : 'Save Costing'")
        expect(estimator).toContain('{canUseProduction && !isStandaloneCostingSession && <Button')
        expect(estimator).toContain('id="btn-start-party-order"')
        expect(estimator).toContain('if (!state.orderQuantityM || state.orderQuantityM <= 0)')
        expect(estimator).toContain("t('estimator.hud.quote_per_m')")
        expect(estimator).toContain("t('estimator.order_basics.title')")
        expect(estimator).toContain("!canUseProduction ? t('estimator.simulation.base_title')")
        expect(estimator).toContain('placeholder="5000"')
        expect(estimator).toContain("(!canUseProduction || hasOrderQty) && orderQuote")
    })

    it('keeps the costing backbone and terminology shared with Full Suite', () => {
        const english = read('lib/i18n/locales/en.ts')

        expect(english).toContain('quote_per_m: "Quotation Price / m"')
        expect(english).toContain('title: "Cost Estimate Details"')
        expect(english).toContain('simulation_qty: "Cost Estimate Quantity"')
        expect(estimator).toContain("canUseProduction ? t('estimator.hud.quote_per_m') : 'Suggested selling price'")
        expect(estimator).toContain("if (!state.orderQuantityM || state.orderQuantityM <= 0)")
        expect(estimator).toContain("!hasOrderQty || !partyName.trim()")
        expect(estimator).not.toContain("canUseProduction ? t('estimator.order_basics.title')")
        expect(estimator).not.toContain("!canUseProduction ? 'Costing Quantity'")
    })

    it('presents persisted quote entities as saved costings without forking persistence', () => {
        expect(quotes).toContain("canUseQuotationWorkflow ? 'Costings & Quotations' : 'Saved Costings'")
        expect(quotes).toContain('Search quality or costing…')
        expect(quotes).toContain('Compare Saved Costings')
        expect(quotes).toContain("'Open & Update'")
        expect(quotes).toContain('Use as Starting Point')
        expect(quotes).toContain('Costing loaded as a starting point')
        expect(estimator).toContain('saveEstimatorQuoteV3({')
    })

    it('does not mount full-suite settings for the Estimator Plan', () => {
        expect(settingsLayout).toContain('requiredTier="base"')
        expect(settings).toContain('{hasPremium && <div')
        expect(settings).toContain('{hasPremium && <SettingsSection id="automations"')
        expect(settings).toContain("hasPremium ? 'Production Cost Estimates & Templates' : 'Estimator Defaults'")
        expect(settings).toContain('Weavly Estimator')
        expect(settings).toContain('<FactoryCostProfile standaloneEstimator={!hasPremium} />')
        expect(settings).toContain('Password & Security')
        expect(settings).toContain('</aside> : <aside className="sticky top-6 space-y-4">')
        expect(costProfile).toContain("standaloneEstimator ? 'Save Estimator Defaults' : 'Save Factory Profile'")
    })

    it('saves Base edits through the authoritative versioned quote path', () => {
        expect(estimator).toContain("handleSaveQuote('quote', isStandaloneCostingSession ? 'draft' : 'accepted')")
        expect(estimator).toContain('Review overdue costing rates')
        expect(estimator).toContain('Save with These Rates')
        const actions = read('app/(dashboard)/owner/estimator/actions.ts')
        expect(actions).toContain('costing_group_id: source.costing_group_id ?? source.id')
        expect(actions).toContain('version_number: Number(source.version_number ?? 1) + 1')
    })

    it('uses an intentional deep-link explanation with a return path', () => {
        expect(gate).toContain('Continue with Weavly Estimator')
        expect(gate).toContain('Return to Estimator')
        expect(gate).not.toContain('Lock className=')
    })
})
