import { describe, expect, it } from 'vitest'
import { makeWorkersTourExamples, workersTourEditor, workersTourSection, workersTourSteps, workersTourSelectors } from '../lib/workers-tour'
import { workersTutorialCopy } from '../lib/i18n/workers-tutorial'
import { getWorkerOperationalSummary } from '../lib/worker-operational'
import { isTourEligible } from '../lib/tours/tour-registry'
import { UuidSchema } from '../lib/schemas'

 describe('Workers guided tour', () => {
    it('provides independent, non-persistable examples of both pay types', () => {
        const examples = makeWorkersTourExamples('2026-09-16')
        expect(examples.map(worker => worker.pay_type)).toEqual(['piece_rate', 'fixed_monthly'])
        examples.forEach(worker => expect(UuidSchema.safeParse(worker.id).success).toBe(false))
        expect(getWorkerOperationalSummary(examples[0])).toMatchObject({ assignedMachineCount: 2, hasRateConfigured: true })
        expect(getWorkerOperationalSummary(examples[1])).toMatchObject({ hasSalaryConfigured: true, payrollStatusLabel: 'Ready' })
        examples[0].name = 'Modified'
        expect(makeWorkersTourExamples('2026-09-16')[0].name).toBe('Sample worker')
    })
    it('opens the right preview for add and edit fields and closes it when moving back to the register', () => {
        const forward = workersTourSteps.map(workersTourEditor)
        expect(forward).toEqual([null, null, null, null, null, null, null, null, 'piece', 'piece', 'piece', 'salary', 'salary', 'salary', null, 'edit', 'edit', 'edit', null, null, null])
        expect([...workersTourSteps].reverse().map(workersTourEditor)).toEqual([...forward].reverse())
    })
    it('covers seven ordered sections with complete localized descriptions and targets', () => {
        expect([...new Set(workersTourSteps.map(workersTourSection))]).toEqual([0, 1, 2, 3, 4, 5, 6])
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = workersTutorialCopy[language]
            expect(copy.sections).toHaveLength(7)
            expect(Object.keys(copy.fields).sort()).toEqual([...workersTourSteps].sort())
            for (const step of workersTourSteps) {
                expect(workersTourSelectors[step]).toBeTruthy()
                expect(copy.fields[step].every(value => value.trim().length > 0)).toBe(true)
                if (language !== 'en') expect(copy.fields[step][1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
        expect(workersTourSelectors.statusFilter).not.toEqual(workersTourSelectors.shiftFilter)
    })
    it('offers the tour only to owners on production plans', () => {
        expect(isTourEligible('workers', 'base', 'owner')).toBe(true)
        expect(isTourEligible('workers', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('workers', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('workers', 'free', 'owner')).toBe(false)
        expect(isTourEligible('workers', 'base', 'supervisor')).toBe(false)
    })
})
