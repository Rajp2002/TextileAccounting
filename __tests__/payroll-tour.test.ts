import { describe, expect, it } from 'vitest'
import { makePayrollTourExample, payrollTourSteps, payrollTourSurface, payrollTourSection } from '../lib/payroll-tour'
import { payrollTutorialCopy } from '../lib/i18n/payroll-tutorial'
import { isTourEligible } from '../lib/tours/tour-registry'

describe('Payroll tour content and variants', () => {
    it('keeps Base completion and Full Suite final settlement in separate sequences', () => {
        const base = payrollTourSteps('base'), full = payrollTourSteps('full')
        expect(base).toHaveLength(27)
        expect(full).toHaveLength(21)
        expect(base).toContain('complete')
        expect(base).not.toContain('finalSettlement')
        expect(full).toContain('finalSettlement')
        for (const step of ['complete', 'paymentDate', 'note', 'machineRecord', 'advance', 'deduction']) expect(full).not.toContain(step)
        for (const step of ['rules', 'adjustment', 'whatsapp', 'csv']) expect(base).not.toContain(step)
    })
    it('keeps every sample calculation internally consistent and isolated', () => {
        const sample = makePayrollTourExample()
        expect(sample.piece.metres * sample.piece.rate).toBe(sample.piece.gross)
        expect(sample.piece.gross - sample.piece.recovery).toBe(sample.piece.net)
        expect(sample.piece.debt - sample.piece.recovery).toBe(sample.piece.carry)
        expect(sample.salary.monthly * sample.salary.days / sample.salary.monthDays).toBe(sample.salary.gross)
        expect(sample.gross - sample.recovery).toBe(sample.net)
        expect(sample.net - sample.paid).toBe(sample.remaining)
        sample.piece.name = 'Changed'
        expect(makePayrollTourExample().piece.name).toBe('Sample weaver')
    })
    it('has complete localized text and ordered sections for both variants', () => {
        for (const variant of ['base', 'full'] as const) {
            const steps = payrollTourSteps(variant)
            expect(new Set(steps).size).toBe(steps.length)
            const sections = steps.map(payrollTourSection)
            expect(sections).toEqual([...sections].sort((a, b) => a - b))
            for (const language of ['en', 'gu', 'hi'] as const) for (const step of steps) {
                expect(payrollTutorialCopy[language].fields[step].every(text => text.trim().length > 0)).toBe(true)
                if (language !== 'en') expect(payrollTutorialCopy[language].fields[step][1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('returns from previews deterministically when navigating back', () => {
        expect(payrollTourSurface('advance')).toBe('advance')
        expect(payrollTourSurface('carry')).toBe('page')
        expect(payrollTourSurface('mode')).toBe('settlement')
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
