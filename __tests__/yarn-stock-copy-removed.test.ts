import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { dailySheetTutorialCopy } from '@/lib/i18n/daily-sheet-tutorial'
import { dispatchTutorialCopy } from '@/lib/i18n/dispatch-tutorial'

// Yarn Stock and the Stock Audit were deleted on 2026-10-14. No plan table or export note may still offer them.
const read = (path: string) => readFileSync(path, 'utf8')

describe('copy after removing yarn stock and the stock audit', () => {
    it('the landing plan table offers fabric stock only', () => {
        const plans = read('components/landing/plans.tsx')
        expect(plans).toContain("label: 'Fabric stock'")
        expect(plans).not.toMatch(/yarn stock/i)
        for (const language of ['hi', 'gu']) {
            const phrases = JSON.parse(read(`lib/i18n/public-pages/${language}.json`)) as Record<string, string>
            expect(phrases['Fabric stock'], language).toBeTruthy()
            expect(phrases).not.toHaveProperty('Fabric and yarn stock')
        }
    })

    it('the accountant export note mentions only the payroll CSVs', () => {
        for (const file of ['app/(dashboard)/owner/data-export/AccountantCsvExports.tsx', 'lib/i18n/lite-phrases/account.ts']) {
            const text = read(file)
            expect(text, file).toContain('Payroll CSVs stay on the Payroll page while Base is active.')
            expect(text, file).not.toMatch(/yarn stock|stock audit/i)
        }
    })

    it('the Daily Sheet and Dispatch tours no longer mention yarn being deducted or counted', () => {
        const yarn = { en: /yarn/i, hi: /धाग/, gu: /યાર્ન/ } as const
        for (const language of ['en', 'hi', 'gu'] as const) {
            expect(dailySheetTutorialCopy[language].save.body, language).not.toMatch(yarn[language])
            expect(dispatchTutorialCopy[language].confirm.body, language).not.toMatch(yarn[language])
        }
    })
})
