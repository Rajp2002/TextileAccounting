import { describe, expect, it } from 'vitest'
import { dispatchTourHelp, dispatchTourSteps, dispatchTourSection, dispatchTourSurface, dispatchTourExample as s } from '../lib/dispatch-tour'
import { dispatchTutorialCopy } from '../lib/i18n/dispatch-tutorial'
import { supportedTours, isTourEligible } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

describe('Dispatch tour', () => {
    it('covers the current challan workflow in eleven core steps with contextual help', () => {
        expect(dispatchTourSteps).toHaveLength(11)
        expect(new Set(dispatchTourSteps).size).toBe(11)
        const sections = dispatchTourSteps.map(dispatchTourSection)
        expect([...new Set(sections)]).toEqual([0, 1, 2, 3, 4, 5])
        expect(sections).toEqual([...sections].sort((a, b) => a - b))
        expect(dispatchTourSurface('lots')).toBe('draft')
        expect(dispatchTourSurface('confirm')).toBe('confirm')
        expect(dispatchTourSurface('receipt')).toBe('receipt')
        expect(dispatchTourSurface('finish')).toBe('page')
    })
    it('has complete localized explanations and invitation copy', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            expect(dispatchTutorialCopy[language].sections).toHaveLength(6)
            expect(tourInvitationCopy[language].benefits.dispatch).toBeTruthy()
            expect(tourInvitationCopy[language].tourNames.dispatch).toBeTruthy()
            for (const step of [...dispatchTourSteps, ...Object.values(dispatchTourHelp).flat()]) {
                const field = dispatchTutorialCopy[language].fields[step]
                expect(field.every(value => value.trim().length > 0)).toBe(true)
                if (language !== 'en') expect(field[1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('keeps stock and money boundaries core and exceptions discoverable', () => {
        expect(dispatchTourSteps).toEqual(['overview', 'quality', 'parties', 'lots', 'saveDraft', 'confirm', 'receipt', 'difference', 'payment', 'balance', 'finish'])
        const fields = dispatchTutorialCopy.en.fields
        expect(fields.quality[1]).toContain('Yarn Stock → Link costing')
        expect(fields.saveDraft[1]).toContain('GST/tax fields are references only')
        expect(fields.confirm[1]).toContain('linked costing weights')
        expect(fields.difference[1]).toContain('no metres return to stock')
        expect(fields.difference[1]).toContain('₹3,920')
        expect(fields.payment[1]).toContain('does not charge the customer or transfer money')
        expect(fields.finish[1]).toContain('open the existing challan')
        const topics = Object.values(dispatchTourHelp).flat()
        expect(topics).toEqual(expect.arrayContaining(['terms', 'changeTerms', 'refund', 'reverseEntry', 'reverseDispatch', 'adjustment']))
        expect(new Set([...dispatchTourSteps, ...topics]).size).toBe(33)
        expect(fields.reverseEntry[1]).toContain('unreversed payment, refund or adjustment')
        expect(fields.reverseDispatch[1]).toContain('all sent fabric is physically in stock')
        expect(fields.legacy[1]).toContain('may be unavailable for your plan')
    })
    it('reconciles dispatch, receipt settlement and yarn examples', () => {
        expect(s.sent * s.rate).toBe(s.value)
        expect(s.received * s.rate).toBe(s.acceptedValue)
        expect(s.acceptedValue - s.payment).toBe(s.balance)
        expect(s.value - s.acceptedValue).toBe(s.credit)
        expect(s.sent / 100 * s.yarnKgPer100).toBe(s.yarnDeduction)
    })
    it('registers a separate tour for eligible owners', () => {
        expect(supportedTours).toContain('dispatch')
        expect(isTourEligible('dispatch', 'base', 'owner')).toBe(true)
        expect(isTourEligible('dispatch', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('dispatch', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('dispatch', 'base', 'supervisor')).toBe(false)
    })
})
