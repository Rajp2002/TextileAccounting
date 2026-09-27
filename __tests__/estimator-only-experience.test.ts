import { visibleOwnerNavigation } from '../lib/owner-navigation'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('Estimator-only product presentation', () => {
    const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
    const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
    const settings = read('app/(dashboard)/owner/settings/page.tsx')
    const settingsLayout = read('app/(dashboard)/owner/settings/layout.tsx')
    const gate = read('components/billing/AccessGate.tsx')
    const rateBook = read('app/(dashboard)/owner/rates/RatesClient.tsx')
    const rateActions = read('app/(dashboard)/owner/rates/actions.ts')

    it('keeps Lite navigation complete and adds a Base production entry point', () => {
        const lite = visibleOwnerNavigation({ tier: 'lite', productionMode: 'market_run' }).flatMap(group => group.items)
        expect(lite.map(item => item.href)).toEqual(['/owner/estimator', '/owner/quotes', '/owner/rates', '/owner/settings', '/owner/billing'])
        const base = visibleOwnerNavigation({ tier: 'base', productionMode: 'market_run' }).flatMap(group => group.items)
        expect(base.map(item => item.href)).toEqual(expect.arrayContaining(['/owner/production', '/owner/assignments', '/owner/workers', '/owner/machines', '/owner/payroll']))
    })

    it('presents rates as a single-purpose yarn rate book', () => {
        expect(rateBook).toContain('Rate Book')
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

    it('keeps Lite and Base quality-first while retaining legacy quotation actions', () => {
        expect(estimator).toContain("const isStandaloneCostingSession = !canUseProduction || sourceRecordKind === 'costing'")
        expect(estimator).toContain('const resolvedPartyName = saveAsStandaloneCosting')
        expect(estimator).toContain('const showPartyField = canUseProduction && !isStandaloneCostingSession')
        expect(estimator).toContain('defaultCustomerName={showPartyField ? partyName : \'\'}')
        expect(estimator).toContain('Quick Costing')
        expect(estimator).toContain("'Save New Version' : 'Save Costing'")
        expect(estimator).toContain('{canUseProduction && !isStandaloneCostingSession && <Button')
        // Phase 3G removed the hidden party-order and market-run controls.
        expect(estimator).not.toContain('btn-start-party-order')
        expect(estimator).not.toContain('btn-start-market-run')
        expect(estimator).toContain("t('estimator.price_helpers.suggested_selling_price')")
        expect(estimator).toContain("t('estimator.order_basics.title')")
        expect(estimator).toContain("!canUseProduction ? t('estimator.simulation.base_title')")
        expect(estimator).toContain('placeholder="e.g. 5000"')
        expect(estimator).toContain('hasValidCostResult && costingResult.quoteIsValid')
    })

    it('keeps the costing backbone and terminology shared with Base', () => {
        const english = read('lib/i18n/locales/en.ts')

        expect(english).toContain('quote_per_m: "Suggested Selling Price / m"')
        expect(english).toContain('title: "Cost Estimate Details"')
        expect(english).toContain('simulation_qty: "Cost Estimate Quantity"')
        expect(estimator).toContain("t('estimator.price_helpers.suggested_selling_price')")
        expect(estimator).toContain("if (!saveAsStandaloneCosting && (!state.orderQuantityM || state.orderQuantityM <= 0))")
        expect(estimator).toContain("(requiresCommercialContext && !partyName.trim())")
        expect(estimator).not.toContain("canUseProduction ? t('estimator.order_basics.title')")
        expect(estimator).not.toContain("!canUseProduction ? 'Costing Quantity'")
    })

    it('presents persisted quote entities as saved costings without forking persistence', () => {
        expect(quotes).toContain("canUseQuotationWorkflow ? t('common.costings_quotations_title') : t('common.saved_costings_title')")
        expect(quotes).toContain("t('common.search_quality_costing')")
        expect(quotes).toContain('Compare Saved Costings')
        expect(quotes).toContain("t('common.open_and_save_new_version')")
        expect(quotes).toContain("tx('Duplicate')")
        expect(quotes).toContain('Costing loaded as a starting point')
        expect(estimator).toContain('saveEstimatorQuoteV3(saveRequest)')
    })

    it('uses current plan settings and keeps payroll configuration in Base', () => {
        expect(settingsLayout).toContain('requiredCapability="account_data"')
        expect(settings).toContain('<PlanAwareSettingsView')
        expect(read('components/settings/plan-aware/plan-aware-settings-view.tsx')).toContain("tier === 'base' && <PayrollCycleSettingsCard")
    })

    it('saves Base edits through the authoritative versioned quote path', () => {
        expect(estimator).toContain("handleSaveQuote(isStandaloneCostingSession ? 'draft' : 'accepted')")
        expect(estimator).toContain('Review overdue costing rates')
        expect(estimator).toContain('Save with These Rates')
        const actions = read('app/(dashboard)/owner/estimator/actions.ts')
        expect(actions).toContain('costing_group_id: source.costing_group_id ?? source.id')
        expect(actions).toContain('version_number: Number(source.version_number ?? 1) + 1')
    })

    it('uses an intentional deep-link explanation with a return path', () => {
        expect(gate).toContain('Take your costing into production')
        expect(gate).toContain('Back to Cost Estimates')
        expect(gate).toContain('routeName')
        expect(gate).toContain('ProductionUpgradeWall')
    })
})
