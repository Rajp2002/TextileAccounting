import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { basePayrollTourSteps, basePayrollHelpSteps, makePayrollTourExample, payrollTourSteps, payrollTourSpecs, payrollHelpSpecs, payrollTourSurface, formatPayrollTourDate } from '../lib/payroll-tour'
import { payrollPreviewLabels, payrollStepCopy, payrollTourControlLabels, payrollTutorialCopy } from '../lib/i18n/payroll-tutorial'
import { isTourEligible, TOUR_REGISTRY } from '../lib/tours/tour-registry'
import { calculateAdvanceRecovery } from '../lib/finance'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const locales = { en, gu, hi }
function translation(language: keyof typeof locales, key: string): string {
    let value: unknown = locales[language]
    for (const part of key.split('.')) value = (value as Record<string, unknown>)[part]
    expect(typeof value, key).toBe('string')
    return value as string
}

describe('Payroll core and optional walkthrough', () => {
    it('teaches the eight-step pay-day order and six-step optional path with separate handoffs', () => {
        expect(payrollTourSteps()).toEqual(['pr-period', 'pr-readiness', 'pr-earnings', 'pr-recovery', 'pr-settle', 'pr-paid', 'pr-complete', 'pr-handoff'])
        expect(payrollTourSteps('help')).toEqual(['pra-advance', 'pra-deduction', 'pra-records', 'pra-export', 'pra-correct', 'pra-handoff'])
        expect(payrollTourSpecs.at(-1)).toEqual({ id: 'pr-handoff', kind: 'handoff', anchor: '[data-tour-anchor="payroll.settle"]' })
        expect(payrollHelpSpecs.at(-1)).toEqual({ id: 'pra-handoff', kind: 'handoff', anchor: '[data-tour-anchor="payroll.records"]' })
        for (const spec of [...payrollTourSpecs, ...payrollHelpSpecs]) {
            expect(spec.kind).toBe(spec.id.endsWith('handoff') ? 'handoff' : 'sample')
            expect(spec.context).toBe(payrollTourSurface(spec.id) === 'page' ? undefined : '[data-payroll-tour-preview="true"]')
        }
    })
    it('removes only the retired variant/runtime and does not retain old payment-date or Review teaching', () => {
        for (const file of ['lib/payroll-tour.ts', 'lib/i18n/payroll-tutorial.ts', 'components/payroll/PayrollTourPreview.tsx', 'components/payroll/PayrollGuidedTour.tsx']) {
            const source = readFileSync(file, 'utf8')
            expect(source).not.toMatch(/fullPayroll|fullEarnings|fullSettlement|fullRecovery|finalSettlement|variant === 'full'|Full[’']|ફુલ|फुल|WhatsApp/)
        }
        expect(existsSync('components/tours/PayrollTutorial.tsx')).toBe(false)
        expect(payrollTutorialCopy.en.steps['pr-paid'].body).not.toMatch(/date|when/)
        expect(payrollTutorialCopy.en.steps['pr-readiness'].body).not.toContain('Review opens')
    })
    it('matches unchanged recovery, salary and carry-forward sample arithmetic', () => {
        const sample = makePayrollTourExample()
        const recovery = calculateAdvanceRecovery(sample.piece.gross, sample.piece.debt)
        expect(sample.piece.recovery).toBe(Number(recovery.recommendedRecovery))
        expect(sample.piece.carry).toBe(Number(recovery.remainingDebt))
        expect(sample.piece).toMatchObject({ gross: 2000, debt: 1000, recovery: 1000, net: 1000, carry: 0 })
        expect(sample.piece.metres * sample.piece.rate).toBe(sample.piece.gross)
        expect(sample.piece.gross - sample.piece.recovery).toBe(sample.piece.net)
        expect(sample.salary.monthly * sample.salary.days / sample.salary.monthDays).toBe(sample.salary.gross)
        expect(sample.gross - sample.recovery).toBe(sample.net)
        expect(sample.net - sample.paid).toBe(sample.remaining)
        expect(sample.zero).toMatchObject({ gross: 0, net: 0 })
        sample.piece.gross = 0
        expect(makePayrollTourExample().piece.gross).toBe(2000)
    })
    it('uses fixed trilingual spec copy, complete native labels and bounded English step text', () => {
        const page = readFileSync('docs/guided-tours/pages/payroll.md', 'utf8')
        const all = [...basePayrollTourSteps, ...basePayrollHelpSteps]
        for (const language of ['en', 'gu', 'hi'] as const) {
            expect(Object.keys(payrollTutorialCopy[language].steps)).toEqual(all)
            const labels = payrollTourControlLabels(key => translation(language, key))
            for (const step of all) {
                const raw = payrollTutorialCopy[language].steps[step]
                const rendered = payrollStepCopy(language, step, labels)
                for (const text of Object.values(raw)) expect(page).toContain(text)
                for (const text of Object.values(rendered)) {
                    expect(text).not.toMatch(/\{c:/)
                    if (language !== 'en') expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                }
                if (language === 'en') {
                    expect(rendered.title.length).toBeLessThanOrEqual(48)
                    expect(rendered.body.length).toBeLessThanOrEqual(190)
                    expect(rendered.detail?.length ?? 0).toBeLessThanOrEqual(260)
                }
            }
            for (const text of Object.values(payrollTutorialCopy[language].calculation)) expect(page).toContain(text)
            for (const label of Object.keys(payrollPreviewLabels.en)) {
                const text = payrollPreviewLabels[language][label]
                expect(text).toBeTruthy()
                if (language !== 'en') expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('resolves current settlement labels and preserves the dynamic completion period', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            for (const key of ['settlePayroll', 'continueSettlement', 'completePayrollRail', 'viewSettledPayroll']) {
                const current = translation(language, `payroll.${key}`)
                const controls = payrollTourControlLabels(key => translation(language, key), current)
                expect(payrollStepCopy(language, 'pr-settle', controls).body).toContain(current)
            }
            const title = translation(language, 'payroll.completePeriodTitle')
            expect(title).toContain('{periodLabel}')
            expect(title.replace('{periodLabel}', 'Sep 2026')).toContain('Sep 2026')
        }
    })
    it('formats sample dates with the page calendar/options and localized months', () => {
        expect(formatPayrollTourDate('2026-09-01', 'en')).toBe('1 Sept 2026')
        for (const language of ['gu', 'hi'] as const) {
            const date = formatPayrollTourDate('2026-09-30', language)
            expect(date).not.toMatch(/Sep/)
            expect(date).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            expect(date).toContain('2026')
        }
    })
    it('uses the same label keys on live controls and keeps both handoff anchors', () => {
        const client = readFileSync('app/(dashboard)/owner/production/BaseProductionClient.tsx', 'utf8')
        const workspace = readFileSync('app/(dashboard)/owner/production/BasePayrollSettlementWorkspace.tsx', 'utf8')
        const records = readFileSync('app/(dashboard)/owner/production/BasePayrollRecords.tsx', 'utf8')
        for (const key of ['settlePayroll', 'continueSettlement', 'viewSettledPayroll', 'completePayrollRail', 'reviewBeforePaying', 'markPaidCard', 'addAdvance', 'addDeduction', 'payrollRecords']) expect(client).toContain(`t('payroll.${key}')`)
        for (const key of ['resolve', 'markPaid', 'needsReview', 'completePayroll', 'confirmPayment', 'viewSettledRecords']) expect(workspace).toContain(`t('payroll.${key}')`)
        expect(workspace).toContain("t('payroll.completePeriodTitle', { periodLabel: period.label })")
        for (const key of ['exportCsv', 'exportPdf', 'preparingPdf', 'resolveMistaken']) expect(records).toContain(`t('payroll.${key}')`)
        expect(records).toContain("exportingPdf ? t('payroll.preparingPdf') : t('payroll.exportPdf')")
        expect(client.match(/data-tour-anchor="payroll.settle"/g)).toHaveLength(1)
        expect(client.match(/data-tour-anchor="payroll.records"/g)).toHaveLength(1)
    })
    it('keeps Base owner eligibility and advances only Payroll content version', () => {
        expect(isTourEligible('payroll', 'base', 'owner')).toBe(true)
        expect(isTourEligible('payroll', 'premium', 'owner')).toBe(false)
        expect(isTourEligible('payroll', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('payroll', 'base', 'supervisor')).toBe(false)
        expect(TOUR_REGISTRY.payroll.contentVersion).toBe('v2')
        expect(TOUR_REGISTRY.payroll.invitationPolicyVersion).toBe('v1')
    })
})
