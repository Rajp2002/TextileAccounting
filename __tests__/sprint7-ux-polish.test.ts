import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

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

    it('keeps high-risk Base quality archiving inside the shared confirmation flow', () => {
        expect(read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')).toContain('<ConfirmActionDialog')
        expect(read('components/settings/template-manager.tsx')).toContain('<ConfirmActionDialog')
        expect(read('app/(dashboard)/owner/estimator/EstimatorClient.tsx')).not.toContain('window.confirm')
        expect(read('components/settings/template-manager.tsx')).not.toContain('confirm(`Archive quality')
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
    })

    it('keeps Base mobile entry surfaces padded and full-width', () => {
        expect(read('app/(dashboard)/owner/billing/page.tsx')).toContain('w-full max-w-6xl')
        expect(read('app/(dashboard)/owner/data-export/page.tsx')).toContain('w-full max-w-2xl px-4')
        expect(read('components/ConfirmActionDialog.tsx')).toContain('w-full sm:w-auto')
    })
})
