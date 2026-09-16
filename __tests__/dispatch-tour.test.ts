import { describe, expect, it } from 'vitest'
import { dispatchTourSteps, dispatchTourSection, dispatchTourSurface, dispatchTourExample as s } from '../lib/dispatch-tour'
import { dispatchTutorialCopy } from '../lib/i18n/dispatch-tutorial'
import { supportedTours, isTourEligible } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

describe('Dispatch tour', () => {
    it('covers the current challan workflow in seven ordered sections', () => {
        expect(dispatchTourSteps).toHaveLength(33)
        expect(new Set(dispatchTourSteps).size).toBe(33)
        const sections = dispatchTourSteps.map(dispatchTourSection)
        expect([...new Set(sections)]).toEqual([0, 1, 2, 3, 4, 5, 6])
        expect(sections).toEqual([...sections].sort((a, b) => a - b))
        expect(dispatchTourSurface('lots')).toBe('draft')
        expect(dispatchTourSurface('yarn')).toBe('confirm')
        expect(dispatchTourSurface('acknowledged')).toBe('receipt')
        expect(dispatchTourSurface('reverseDispatch')).toBe('reverseDispatch')
        expect(dispatchTourSurface('finish')).toBe('page')
    })
    it('has complete localized explanations and invitation copy', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            expect(dispatchTutorialCopy[language].sections).toHaveLength(7)
            expect(tourInvitationCopy[language].benefits.dispatch).toBeTruthy()
            expect(tourInvitationCopy[language].tourNames.dispatch).toBeTruthy()
            for (const step of dispatchTourSteps) {
                const field = dispatchTutorialCopy[language].fields[step]
                expect(field.every(value => value.trim().length > 0)).toBe(true)
                if (language !== 'en') expect(field[1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
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
