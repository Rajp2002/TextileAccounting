import { describe, expect, it } from 'vitest'
import { productionTourSteps, productionTourSection, productionTourSurface, productionTourExample } from '../lib/production-tour'
import { productionTutorialCopy } from '../lib/i18n/production-tutorial'
import { isTourEligible, supportedTours } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

describe('Production tour', () => {
    it('covers the production workflow in six ordered sections', () => {
        expect(productionTourSteps).toHaveLength(30)
        expect(new Set(productionTourSteps).size).toBe(30)
        const sections = productionTourSteps.map(productionTourSection)
        expect([...new Set(sections)]).toEqual([0, 1, 2, 3, 4, 5])
        expect(sections).toEqual([...sections].sort((a, b) => a - b))
        expect(productionTourSurface('wage')).toBe('activate')
        expect(productionTourSurface('loomStates')).toBe('allocate')
        expect(productionTourSurface('reading')).toBe('daily')
        expect(productionTourSurface('incomplete')).toBe('incomplete')
        expect(productionTourSurface('correction')).toBe('correction')
        expect(productionTourSurface('audit')).toBe('audit')
        expect(productionTourSurface('finish')).toBe('daily')
    })
    it('provides localized copy and invitations for every step', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = productionTutorialCopy[language]
            expect(copy.sections).toHaveLength(6)
            expect(tourInvitationCopy[language].benefits.production).toBeTruthy()
            expect(tourInvitationCopy[language].tourNames.production).toBeTruthy()
            for (const step of productionTourSteps) {
                expect(copy.fields[step].every(value => value.trim().length > 0)).toBe(true)
                if (language !== 'en') expect(copy.fields[step][1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('uses consistent original and corrected earnings', () => {
        const sample = productionTourExample
        expect(sample.metres * sample.rate).toBe(sample.earnings)
        expect(sample.correctedMetres * sample.rate).toBe(sample.correctedEarnings)
    })
    it('registers production for eligible owners', () => {
        expect(supportedTours).toContain('production')
        for (const plan of ['base', 'premium']) expect(isTourEligible('production', plan, 'owner')).toBe(true)
        expect(isTourEligible('production', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('production', 'base', 'supervisor')).toBe(false)
    })
})
