import { describe, expect, it } from 'vitest'
import { makePayrollTourExample, payrollTourSteps, payrollTourSurface, payrollTourSection } from '../lib/payroll-tour'
import { payrollPreviewLabels, payrollTutorialCopy } from '../lib/i18n/payroll-tutorial'
import { isTourEligible } from '../lib/tours/tour-registry'
import { calculateAdvanceRecovery } from '../lib/finance'

describe('Payroll tour content and variants', () => {
    it('teaches the Base obligation-to-completion flow and keeps Full worker exit distinct', () => {
        const base = payrollTourSteps('base'), full = payrollTourSteps('full')
        expect(base).toHaveLength(10)
        expect(full).toHaveLength(9)
        expect(base.indexOf('obligations')).toBeLessThan(base.indexOf('paymentDetails'))
        expect(base.indexOf('paid')).toBeLessThan(base.indexOf('complete'))
        expect(base).not.toContain('finalSettlement')
        expect(full.indexOf('finalSettlement')).toBeLessThan(full.indexOf('confirm'))
        for (const step of ['complete', 'paymentDetails', 'obligations', 'advance', 'deduction']) expect(full).not.toContain(step)
        for (const step of ['rules', 'adjustment', 'whatsapp', 'csv']) expect(base).not.toContain(step)
    })
    it('keeps maintenance and reporting discoverable through optional variant-specific help', () => {
        expect(payrollTourSteps('base', 'help')).toEqual(['advance', 'deduction', 'records', 'machineRecord', 'export', 'correction', 'finish'])
        expect(payrollTourSteps('full', 'help')).toEqual(['rules', 'adjustment', 'history', 'receipt', 'csv', 'slip', 'whatsapp', 'finish'])
    })
    it('matches the actual default recovery rule, including the carried balance', () => {
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
    it('has localized text and ordered sections for both main and optional tours', () => {
        for (const variant of ['base', 'full'] as const) for (const track of ['core', 'help'] as const) {
            const steps = payrollTourSteps(variant, track)
            expect(new Set(steps).size).toBe(steps.length)
            const sections = steps.map(payrollTourSection)
            expect(sections).toEqual([...sections].sort((a, b) => a - b))
            for (const language of ['en', 'gu', 'hi'] as const) {
                const copy = payrollTutorialCopy[language]
                const texts = [...steps.flatMap(step => [...copy.fields[step]]), copy.help, copy.helpDescription[variant], ...Object.values(copy.people)]
                for (const text of texts) {
                    expect(text.trim().length).toBeGreaterThan(0)
                    if (language !== 'en') expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                }
                expect(copy.fields.recovery[1]).toContain('50%')
                expect(copy.fields.recovery[1]).toContain('₹1,000')
                expect(copy.fields.recovery[1]).toContain('₹0')
            }
        }
        for (const language of ['gu', 'hi'] as const) for (const label of Object.keys(payrollPreviewLabels.en)) {
            expect(payrollPreviewLabels[language][label]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
        }
    })
    it('returns from previews deterministically when navigating back', () => {
        expect(payrollTourSurface('advance')).toBe('advance')
        expect(payrollTourSurface('recovery')).toBe('page')
        expect(payrollTourSurface('obligations')).toBe('settlement')
        expect(payrollTourSurface('paymentDetails')).toBe('settlement')
        expect(payrollTourSurface('records')).toBe('records')
        expect(payrollTourSurface('correction')).toBe('correction')
        expect(payrollTourSurface('finish')).toBe('page')
    })
    it('limits eligibility to production-plan owners', () => {
        expect(isTourEligible('payroll', 'base', 'owner')).toBe(true)
        expect(isTourEligible('payroll', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('payroll', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('payroll', 'base', 'supervisor')).toBe(false)
    })
})
