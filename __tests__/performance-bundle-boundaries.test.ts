import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function source(path: string) {
    return readFileSync(path, 'utf8')
}

describe('performance-sensitive bundle boundaries', () => {
    it('keeps non-English dictionaries out of the initial provider bundle', () => {
        const context = source('lib/i18n/context.tsx')

        expect(context).not.toContain('from "./locales/hi"')
        expect(context).not.toContain('from "./locales/gu"')
        expect(context).not.toContain('from "./legacy"')
        expect(context).not.toContain('from "./legacy-generated"')
        expect(context).toContain('import("./locales/hi")')
        expect(context).toContain('import("./locales/gu")')
        expect(context).toContain('import("./legacy")')
        expect(context).toContain('import("./legacy-generated")')
        expect(context).toContain('const activeLang = isMounted && resources[language] ? language : "en"')
    })

    it('loads the payroll PDF engine only when a download is requested', () => {
        const payroll = source('app/(dashboard)/owner/payroll/PayrollClient.tsx')

        expect(payroll).not.toContain("import { generateMeterPayslip")
        expect(payroll).not.toContain("import { generateFixedPayslip")
        expect(payroll).toContain("import type { PayslipItemization } from '@/lib/generate-payslip'")
        expect(payroll).toContain("await import('@/lib/generate-payslip')")
        expect(payroll).toContain("toast.error('Failed to generate payslip PDF.')")
    })
})
