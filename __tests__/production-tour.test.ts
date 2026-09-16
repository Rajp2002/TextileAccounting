import { describe, expect, it } from 'vitest'
import { productionTourSteps, productionTourDetailSteps, productionTourAllSteps, productionTourSequence, productionTourSection, productionTourSurface, productionTourExample } from '../lib/production-tour'
import { productionTutorialCopy } from '../lib/i18n/production-tutorial'
import { isTourEligible, supportedTours } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'

describe('Production tour', () => {
    it('teaches preparation before recording and keeps consequential decisions in the core', () => {
        expect(productionTourSteps).toEqual(['overview', 'prerequisites', 'activate', 'allocate', 'operators', 'date', 'reading', 'pending', 'rollup', 'draft', 'save', 'finish'])
        expect(productionTourSteps.map(productionTourSection)).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1])
        expect(productionTourSurface('activate')).toBe('activate')
        expect(productionTourSurface('allocate')).toBe('allocate')
        expect(productionTourSurface('operators')).toBe('overview')
        expect(productionTourSurface('reading')).toBe('daily')
        expect(productionTourSurface('finish')).toBe('daily')
    })
    it('keeps maintenance replayable without interleaving it with first-shift entry', () => {
        expect(productionTourDetailSteps).toEqual(['board', 'loomStates', 'switchQuality', 'deactivate', 'print', 'workerStatus', 'incomplete', 'history', 'saved', 'correction', 'audit'])
        expect(new Set(productionTourAllSteps).size).toBe(productionTourAllSteps.length)
        for (const step of productionTourSteps) expect(productionTourSequence(step)).toBe(productionTourSteps)
        for (const step of productionTourDetailSteps) expect(productionTourSequence(step)).toBe(productionTourDetailSteps)
        expect([...new Set(productionTourDetailSteps.map(productionTourSection))]).toEqual([2, 3])
        for (const step of ['incomplete', 'correction', 'audit'] as const) expect(productionTourSurface(step)).toBe(step)
    })
    it('provides concise localized copy and invitations for both walkthroughs', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = productionTutorialCopy[language]
            expect(copy.sections).toHaveLength(4)
            expect(copy.details).toBeTruthy()
            expect(tourInvitationCopy[language].benefits.production).toBeTruthy()
            expect(tourInvitationCopy[language].tourNames.production).toBeTruthy()
            for (const step of productionTourAllSteps) {
                expect(copy.fields[step].every(value => value.trim().length > 0)).toBe(true)
                expect(copy.fields[step][1].split(/\s+/).length).toBeLessThanOrEqual(55)
                if (language !== 'en') expect(copy.fields[step][1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('names actionable setup destinations and teaches output, drafts and downstream effects', () => {
        const { fields } = productionTutorialCopy.en
        for (const destination of ['Cost Estimator', 'Saved Costings', 'Workers', 'Machines']) expect(fields.prerequisites[1]).toContain(destination)
        for (const action of ['Overview & Looms', 'Activate Quality', 'Activate', 'Weaver wage']) expect(fields.activate[1]).toContain(action)
        for (const action of ['Manage Workers', 'Day Shift', 'Night Shift', 'Assign', 'Machine Assignments']) expect(fields.operators[1]).toContain(action)
        expect(fields.reading[1]).toContain('not a cumulative meter reading')
        expect(fields.pending[1]).toContain('blank')
        expect(fields.pending[1]).toContain('Enter 0')
        expect(fields.draft[1]).toContain('not updated stock or payroll')
        expect(fields.save[1]).toContain('120 m to Fabric Stock')
        expect(fields.save[1]).toContain('₹240 to gross earnings')
        expect(fields.save[1]).toContain('Blank rows stay pending')
        expect(fields.finish[1]).toContain('Payroll')
        expect(fields.saved[1]).toContain('paid worker entries remain protected')
    })
    it('uses consistent original and corrected earnings', () => {
        const sample = productionTourExample
        expect(sample.metres * sample.rate).toBe(sample.earnings)
        expect(sample.correctedMetres * sample.rate).toBe(sample.correctedEarnings)
        expect((sample.correctedMetres - sample.metres) * sample.rate).toBe(sample.correctedEarnings - sample.earnings)
    })
    it('registers production for eligible owners', () => {
        expect(supportedTours).toContain('production')
        for (const plan of ['base', 'premium']) expect(isTourEligible('production', plan, 'owner')).toBe(true)
        expect(isTourEligible('production', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('production', 'base', 'supervisor')).toBe(false)
    })
})
