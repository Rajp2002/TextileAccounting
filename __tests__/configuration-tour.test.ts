import { describe, expect, it } from 'vitest'
import { configurationTourSteps, configurationTourSelectors, configurationTourView, makeConfigurationTourExample, CONFIGURATION_SAMPLE_MACHINE, CONFIGURATION_SAMPLE_WORKER } from '../lib/configuration-tour'
import { configurationTutorialCopy } from '../lib/i18n/configuration-tutorial'
import { isTourEligible } from '../lib/tours/tour-registry'
import { UuidSchema } from '../lib/schemas'

describe('Configuration tour examples and navigation', () => {
    it('keeps examples isolated and invalid as persisted record IDs', () => {
        for (const step of configurationTourSteps) {
            const example = makeConfigurationTourExample('2026-09-11', step)
            for (const row of Object.values(example).flat()) {
                expect(row.id.startsWith('tour-configuration-')).toBe(true)
                expect(UuidSchema.safeParse(row.id).success).toBe(false)
            }
            expect(example.workers[0].shift_availability).toBe('both')
        }
        const first = makeConfigurationTourExample('2026-09-11', 'workers')
        first.workers[0].name = 'Changed by caller'
        expect(makeConfigurationTourExample('2026-09-11', 'workers').workers[0].name).toBe('Sample worker')
    })
    it('illustrates a valid connection with a matching machine, worker, shift, and active job', () => {
        const example = makeConfigurationTourExample('2026-09-11', 'connected')
        expect(example.assignments).toEqual([expect.objectContaining({ worker_id: CONFIGURATION_SAMPLE_WORKER, machine_id: CONFIGURATION_SAMPLE_MACHINE, shift: 'day', active: true, effective_from: '2026-09-11' })])
        expect(example.machineJobContexts[0].job_id).toBe(example.jobs[0].id)
        expect(example.jobs[0].status).toBe('active')
        expect(makeConfigurationTourExample('2026-09-11', 'jobRequired').machineJobContexts).toEqual([])
        expect(makeConfigurationTourExample('2026-09-11', 'nightShift').assignments).toEqual([])
    })
    it('reverses sample states deterministically for Back, including picker cleanup and inactive examples', () => {
        expect(configurationTourView('picker').pickerWorkerId).toBe(CONFIGURATION_SAMPLE_WORKER)
        expect(configurationTourView('assign').pickerWorkerId).toBeNull()
        expect(configurationTourView('connected').mobileView).toBe('machines')
        expect(configurationTourView('drag').mobileView).toBe('workers')
        expect(configurationTourView('nightShift').shift).toBe('night')
        expect(configurationTourView('workers').shift).toBe('day')
        expect(makeConfigurationTourExample('2026-09-11', 'inactive').machines.some(machine => !machine.is_active)).toBe(true)
        expect(makeConfigurationTourExample('2026-09-11', 'remove').machines.every(machine => machine.is_active)).toBe(true)
    })
    it('provides complete localized guidance and a target for every step', () => {
        for (const language of ['en', 'hi', 'gu'] as const) {
            expect(Object.keys(configurationTutorialCopy[language].fields).sort()).toEqual([...configurationTourSteps].sort())
            for (const step of configurationTourSteps) {
                expect(configurationTourSelectors[step]).toBeTruthy()
                expect(configurationTutorialCopy[language].fields[step].every(text => text.trim().length > 0)).toBe(true)
            }
        }
        expect(configurationTutorialCopy.en.fields.replace[1]).toContain('Confirm')
        expect(configurationTutorialCopy.en.fields.finish[1]).toContain('removes every sample')
    })
    it('limits invitation eligibility to owner plans with Configuration', () => {
        expect(isTourEligible('configuration', 'base', 'owner')).toBe(true)
        expect(isTourEligible('configuration', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('configuration', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('configuration', 'base', 'supervisor')).toBe(false)
    })
})

describe('Expanded assignment previews', () => {
    it('shows four distinct picker states and keeps unavailable machines unassignable', () => {
        for (const step of ['picker', 'pickerCurrent', 'pickerOccupied', 'pickerBlocked'] as const) {
            const sample = makeConfigurationTourExample('2026-09-16', step)
            expect(configurationTourView(step).pickerWorkerId).toBe(CONFIGURATION_SAMPLE_WORKER)
            expect(sample.workers).toHaveLength(2)
            expect(sample.machines).toHaveLength(4)
            const states = sample.machines.map(machine => {
                const job = sample.machineJobContexts.find(context => context.machine_id === machine.id)
                const link = sample.assignments.find(assignment => assignment.machine_id === machine.id)
                return !job ? 'blocked' : link?.worker_id === CONFIGURATION_SAMPLE_WORKER ? 'current' : link ? 'occupied' : 'available'
            })
            expect(states).toEqual(['available', 'current', 'occupied', 'blocked'])
            expect(sample.assignments.every(link => sample.workers.some(worker => worker.id === link.worker_id))).toBe(true)
        }
    })
    it('restores the simple board when going back or leaving the picker', () => {
        for (const step of ['assign', 'drag'] as const) {
            expect(configurationTourView(step).pickerWorkerId).toBeNull()
            expect(makeConfigurationTourExample('2026-09-16', step).machines).toHaveLength(1)
        }
    })
    it('previews replacement without changing the original link', () => {
        const sample = makeConfigurationTourExample('2026-09-16', 'replace')
        expect(sample.workers).toHaveLength(2)
        expect(sample.assignments[0].worker_id).toBe(CONFIGURATION_SAMPLE_WORKER)
        expect(configurationTourSelectors.replace).toContain('replace-preview')
    })
    it('shows Undo only after an illustrated saved link and provides localized mobile guidance', () => {
        expect(makeConfigurationTourExample('2026-09-16', 'undo').assignments).toHaveLength(1)
        expect(configurationTourSelectors.undo).toContain('undo')
        expect(configurationTourSteps).toHaveLength(23)
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = configurationTutorialCopy[language]
            expect(copy.sections).toHaveLength(6)
            expect(copy.mobileAssign.every(text => text.length > 0)).toBe(true)
            expect(copy.undoLabel).toBeTruthy()
            expect(copy.secondWorker).not.toBe(copy.worker)
        }
    })
})
