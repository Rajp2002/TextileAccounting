import { describe, expect, it } from 'vitest'
import { makeMachinesTourExamples, machinesTourSteps, machinesTourEditor, machinesTourSection, machinesTourSelectors } from '../lib/machines-tour'
import { machinesTutorialCopy } from '../lib/i18n/machines-tutorial'
import { getMachineReadiness } from '../lib/machine-readiness'
import { isTourEligible } from '../lib/tours/tour-registry'
import { UuidSchema } from '../lib/schemas'

describe('Machines tour', () => {
    it('illustrates ready and incomplete machines without persisted IDs', () => {
        const examples = makeMachinesTourExamples()
        expect(examples.map(machine => getMachineReadiness(machine).status)).toEqual(['active', 'needs_setup'])
        expect(examples.every(machine => machine.is_active)).toBe(true)
        examples.forEach(machine => expect(UuidSchema.safeParse(machine.id).success).toBe(false))
        examples[0].name = 'Changed'
        expect(makeMachinesTourExamples()[0].name).toBe('Sample loom 1')
    })
    it('keeps availability separate from readiness', () => {
        const machine = makeMachinesTourExamples()[0]
        expect(getMachineReadiness({ ...machine, is_active: false }).status).toBe('active')
        expect(getMachineReadiness({ ...machine, hasWorker: false }).status).toBe('needs_setup')
        expect(getMachineReadiness({ ...machine, hasCosting: false }).status).toBe('needs_setup')
    })
    it('opens and closes the appropriate preview in either navigation direction', () => {
        const expected = [null, 'add', null, null, null, null]
        expect(machinesTourSteps.map(machinesTourEditor)).toEqual(expected)
        expect([...machinesTourSteps].reverse().map(machinesTourEditor)).toEqual([...expected].reverse())
    })
    it('provides six sections and complete translated guidance and targets', () => {
        expect([...new Set(machinesTourSteps.map(machinesTourSection))]).toEqual([0, 1, 2, 3, 4, 5])
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = machinesTutorialCopy[language]
            expect(copy.sections).toHaveLength(6)
            expect(Object.keys(copy.fields).sort()).toEqual([...machinesTourSteps].sort())
            for (const step of machinesTourSteps) {
                expect(machinesTourSelectors[step]).toBeTruthy()
                expect(copy.fields[step].every(text => text.trim().length > 0)).toBe(true)
                if (language !== 'en') expect(copy.fields[step][1]).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('teaches quality setup before worker assignment with current action labels', () => {
        expect(machinesTourSteps.indexOf('production')).toBeLessThan(machinesTourSteps.indexOf('assignments'))
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = machinesTutorialCopy[language]
            for (const action of ['Overview & Looms', 'Activate Quality', 'Assign Looms', 'Cost Estimator']) {
                expect(copy.fields.production[1]).toContain(action)
            }
            expect(copy.fields.assignments[1]).toContain('Assign')
            const examples = makeMachinesTourExamples(copy.example)
            expect(copy.fields.details[1]).toContain(examples[0].name)
            expect(copy.fields.label[1]).toContain(examples[0].custom_label)
            expect(copy.fields.readiness[1]).toContain(examples[1].name)
            expect(examples[0].assignedWorkerName).toBe(copy.example.worker)
            expect(examples[0].assignedCostingLabel).toBe(copy.example.fabric)
            expect(copy.help).toHaveLength(4)
            for (const [title, description] of copy.help) {
                expect(title.trim()).not.toBe('')
                expect(description.trim()).not.toBe('')
                if (language !== 'en') expect(description).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
        }
    })
    it('limits eligibility to production-plan owners', () => {
        expect(isTourEligible('machines', 'base', 'owner')).toBe(true)
        expect(isTourEligible('machines', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('machines', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('machines', 'free', 'owner')).toBe(false)
        expect(isTourEligible('machines', 'base', 'supervisor')).toBe(false)
    })
})
