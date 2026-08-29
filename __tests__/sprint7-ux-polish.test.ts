import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { getSavedCostingMetrics } from '../lib/saved-costings'

const read = (path: string) => readFileSync(path, 'utf8')

describe('Sprint 7 Base UX polish contracts', () => {
    it('exposes language loading, fallback, and successful-persistence states', () => {
        const context = read('lib/i18n/context.tsx')
        const switcher = read('components/i18n/language-switcher.tsx')

        expect(context).toContain('LanguageLoadStatus')
        expect(context).toContain('setLanguageStatus("loading")')
        expect(context).toContain('setLanguageStatus("error")')
        expect(context).toContain('localStorage.setItem(LANGUAGE_STORAGE_KEY, lang)')
        expect(switcher).toContain('aria-live="polite"')
        expect(switcher).toContain('languageError')
        expect(switcher).toContain('data-i18n-skip="true"')
        expect(read('lib/i18n/locales/en.ts')).toContain('language_load_failed')
        expect(read('lib/i18n/locales/en.ts')).toContain('Your current language remains active')
        expect(read('components/i18n/language-switcher.tsx')).toContain('common.language_fallback')
    })

    it('routes Base feedback through the shared notification wrapper', () => {
        expect(read('lib/app-notifications.ts')).toContain('closeButton: true')
        for (const path of [
            'app/(dashboard)/owner/estimator/EstimatorClient.tsx',
            'app/(dashboard)/owner/quotes/QuotesClient.tsx',
            'app/(dashboard)/owner/rates/RatesClient.tsx',
            'app/(dashboard)/owner/settings/page.tsx',
            'components/settings/factory-cost-profile.tsx',
            'components/settings/template-manager.tsx',
            'components/estimator/CostingExportDialog.tsx',
            'components/settings/organization-data-export-button.tsx',
            'components/billing/SubscribeButton.tsx',
        ]) {
            expect(read(path)).toContain("from '@/lib/app-notifications'")
        }
    })

    it('keeps high-risk archive lifecycle controls in the owning surfaces', () => {
        expect(read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')).toContain('<ConfirmActionDialog')
        expect(read('components/settings/template-manager.tsx')).toContain('Manage saved qualities in Saved Costings')
        expect(read('components/settings/template-manager.tsx')).not.toContain('<ConfirmActionDialog')
        expect(read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')).not.toContain('window.confirm')
        expect(read('components/settings/template-manager.tsx')).not.toContain('confirm(`Archive quality')
        expect(read('components/settings/factory-cost-profile.tsx')).toContain('<ConfirmActionDialog')
        expect(read('components/settings/factory-cost-profile.tsx')).not.toContain('window.confirm')
    })

    it('keeps the three prices distinct and explains disabled comparison/export actions', () => {
        const estimator = read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')
        const quotes = read('app/(dashboard)/owner/quotes/QuotesClient.tsx')
        const exportDialog = read('components/estimator/CostingExportDialog.tsx')

        expect(estimator).toContain("estimator.price_helpers.production_cost")
        expect(estimator).toContain("estimator.price_helpers.break_even")
        expect(estimator).toContain("estimator.price_helpers.suggested_selling_price")
        expect(quotes).toContain('compare-costings-help')
        expect(exportDialog).toContain('export-action-help')
        expect(estimator).toContain('estimator-action-readiness')
        expect(estimator).toContain('aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}')
    })

    it('does not present legacy zero placeholders as trustworthy costing numbers', () => {
        const metrics = getSavedCostingMetrics({
            id: 'legacy-1',
            party_name: 'Mahavir Traders',
            quality_label: 'Grey 75D',
            quote_price_per_meter: 34,
            landed_cost_per_meter: 31,
            intended_margin_percent: 10,
            meters: 5000,
            production_cost_per_meter: 0,
            break_even_price_per_meter: 0,
            actual_margin_percent: 0,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        })

        expect(metrics.status).toBe('legacy')
        expect(metrics.productionCostPerM).toBeNull()
        expect(metrics.breakEvenPricePerM).toBeNull()
        expect(metrics.actualMarginPct).toBeNull()
        expect(metrics.suggestedSellingPricePerM).toBe(34)
        expect(metrics.expectedProfitPerM).toBe(3)
    })

    it('shows update feedback once per browser session and keeps notification errors user-facing', () => {
        const updateNotice = read('components/pwa-update-notice.tsx')
        const notifications = read('lib/app-notifications.ts')
        expect(updateNotice).toContain('UPDATE_TOAST_SHOWN_FLAG')
        expect(updateNotice).toContain('readSessionFlag(UPDATE_TOAST_SHOWN_FLAG)')
        expect(updateNotice).toContain("t('common.pwa_update_description')")
        expect(updateNotice).toContain("position: 'top-right'")
        expect(updateNotice).toContain("descriptionClassName: '!text-ink !opacity-100'")
        expect(updateNotice).toContain("document.addEventListener('visibilitychange'")
        expect(updateNotice).toContain('if (registration.waiting && navigator.serviceWorker.controller)')
        expect(updateNotice).toContain('void registration.update().catch(() => {')
        expect(updateNotice).not.toContain("position: 'top-center'")
        expect(notifications).toContain('userFacingError')
        expect(notifications).toContain('TECHNICAL_ERROR_PATTERN')
    })

    it('keeps Base mobile entry surfaces padded and full-width', () => {
        expect(read('app/(dashboard)/owner/billing/page.tsx')).toContain('w-full max-w-6xl')
        expect(read('app/(dashboard)/owner/data-export/page.tsx')).toContain('w-full max-w-2xl px-4')
        expect(read('components/ConfirmActionDialog.tsx')).toContain('w-full sm:w-auto')
    })
})
