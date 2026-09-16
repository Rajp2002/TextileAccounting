import { describe, expect, it } from 'vitest'
import { configurationTourSteps, configurationTourSelectors, configurationTourSection, configurationTourView, makeConfigurationTourExample, CONFIGURATION_SAMPLE_MACHINE, CONFIGURATION_SAMPLE_WORKER } from '../lib/configuration-tour'
import { configurationHelpTopics, configurationTutorialCopy } from '../lib/i18n/configuration-tutorial'
import { isTourEligible } from '../lib/tours/tour-registry'
import { UuidSchema } from '../lib/schemas'
import { readBaseProductionNavigation } from '../lib/base-production-navigation'
import { readFileSync } from 'node:fs'

const workspace = readFileSync('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx', 'utf8')
const controller = readFileSync('components/tours/ConfigurationTutorial.tsx', 'utf8')

describe('Assignment tour workflow', () => {
    it('teaches prerequisites before selection and saving before the Daily Sheet handoff', () => {
        expect(configurationTourSteps).toEqual(['purpose', 'dayShift', 'jobRequired', 'assign', 'picker', 'connected', 'finish'])
        expect(configurationTourSelectors.connected).toContain('saved-preview')
        expect(configurationTourSelectors.finish).toContain('daily-sheet')
    })

    it('isolates examples from persisted records and regenerates them on replay', () => {
        for (const step of configurationTourSteps) {
            const sample = makeConfigurationTourExample('2026-09-17', step)
            for (const row of Object.values(sample).flat()) {
                expect(row.id.startsWith('tour-configuration-')).toBe(true)
                expect(UuidSchema.safeParse(row.id).success).toBe(false)
            }
            expect(sample.workers).toHaveLength(1)
            expect(sample.machines).toHaveLength(1)
            expect(sample.workers[0].shift_availability).toBe('both')
        }
        const first = makeConfigurationTourExample('2026-09-17', 'assign')
        first.workers[0].name = 'Changed by caller'
        first.assignments.push({ id: 'mutated', worker_id: 'live-worker', machine_id: 'live-machine', shift: 'night', active: true, effective_from: '2026-09-17', effective_to: null })
        expect(makeConfigurationTourExample('2026-09-17', 'assign').workers[0].name).toBe('Sample worker')
        expect(makeConfigurationTourExample('2026-09-17', 'assign').assignments).toEqual([])
    })

    it('moves from a blocked loom to an eligible picker to a valid saved day link', () => {
        expect(makeConfigurationTourExample('2026-09-17', 'jobRequired').machineJobContexts).toEqual([])
        const picker = makeConfigurationTourExample('2026-09-17', 'picker')
        expect(picker.assignments).toEqual([])
        expect(picker.machineJobContexts[0]).toMatchObject({ machine_id: CONFIGURATION_SAMPLE_MACHINE, job_id: picker.jobs[0].id, active: true })
        expect(picker.jobs[0].status).toBe('active')
        for (const step of ['connected', 'finish'] as const) {
            expect(makeConfigurationTourExample('2026-09-17', step).assignments).toEqual([expect.objectContaining({ worker_id: CONFIGURATION_SAMPLE_WORKER, machine_id: CONFIGURATION_SAMPLE_MACHINE, shift: 'day', active: true, effective_from: '2026-09-17' })])
        }
    })

    it('reverses preview states on Back without leaving the picker or saved link behind', () => {
        expect(configurationTourView('picker').pickerWorkerId).toBe(CONFIGURATION_SAMPLE_WORKER)
        for (const step of ['assign', 'connected', 'finish'] as const) expect(configurationTourView(step).pickerWorkerId).toBeNull()
        expect(configurationTourView('jobRequired').mobileView).toBe('machines')
        expect(configurationTourView('assign').mobileView).toBe('workers')
        expect(configurationTourView('connected').mobileView).toBe('machines')
        expect(makeConfigurationTourExample('2026-09-17', 'picker').assignments).toEqual([])
    })

    it('preserves opt-in launch, live state, interaction guards and completion only at Finish', () => {
        expect(workspace).toContain('useState<ConfigurationTourStep | null>(null)')
        expect(workspace).toContain('tourId="configuration"')
        expect(workspace).toContain('if (!tourStep) return liveData')
        expect(workspace).toContain("const workerSearch = tourStep ? '' : search")
        expect(workspace).toContain('tourView?.shift ?? selectedShift')
        expect(workspace).toContain('tourView?.mobileView ?? selectedMobileView')
        expect(workspace).toContain('tourView?.showInactive ?? includeInactive')
        expect(workspace).toContain('tourView ? tourView.pickerWorkerId : selectedPickerWorkerId')
        expect(workspace).toContain('inert={tourStep !== null}')
        for (const handler of ['handleAssign', 'handleUndoAssignment', 'handleRemove']) {
            const functionBody = workspace.slice(workspace.indexOf(`async function ${handler}`))
            expect(functionBody.slice(0, functionBody.indexOf('try {'))).toMatch(/if \(tourStep(?: \|\| pendingKey)?\) return/)
        }
        expect(controller).toContain("if (index === configurationTourSteps.length - 1) {\n            void persistTourCompleted('configuration', userId)")
        expect(controller).toContain('trigger?.focus({ preventScroll: true })')
        expect(controller).toContain('window.scrollTo({ left: scroll.x, top: scroll.y')
    })

    it('provides complete localized core and contextual help with current prerequisite labels', () => {
        for (const language of ['en', 'hi', 'gu'] as const) {
            const copy = configurationTutorialCopy[language]
            expect(Object.keys(copy.fields).sort()).toEqual([...configurationTourSteps].sort())
            expect(Object.keys(copy.help).sort()).toEqual([...configurationHelpTopics].sort())
            for (const step of configurationTourSteps) {
                expect(configurationTourSelectors[step]).toBeTruthy()
                expect(copy.fields[step].every(text => text.trim().length > 0)).toBe(true)
                expect(copy.sections[configurationTourSection(step)]).toBeTruthy()
            }
            for (const topic of configurationHelpTopics) expect(copy.help[topic].every(text => text.trim().length > 0)).toBe(true)
            for (const label of ['Overview & Looms', 'Activate Quality', 'Assign Looms']) expect(copy.fields.jobRequired[1]).toContain(label)
            expect(copy.fields.finish[1]).toContain('Daily Sheet')
            expect(copy.helpLabel).toBeTruthy()
            expect(copy.dailySheetLabel).toBeTruthy()
        }
        const copy = configurationTutorialCopy.en
        expect(copy.fields.picker[1]).toContain('saves the link immediately')
        expect(copy.fields.connected[1]).toContain('Undo')
        expect(copy.fields.connected[1]).toContain('no production, stock or earnings')
        expect(copy.fields.finish[1]).toContain('fabric stock and worker earnings for Payroll')
        expect(copy.fields.finish[1]).toContain('removes every sample')
        expect(JSON.stringify(copy)).not.toMatch(/Production → Jobs|Machine jobs/)
        expect(workspace).toContain('configurationHelpTopics.map')
        for (const step of configurationTourSteps) expect(copy.fields[step][1].split(/\s+/).length).toBeLessThanOrEqual(60)
    })

    it('opens Daily Sheet with the selected shift and a safe return to assignments', () => {
        const params = new URLSearchParams({ tab: 'production', shift: 'night', returnTo: '/owner/assignments?shift=night' })
        expect(readBaseProductionNavigation(params)).toMatchObject({ tab: 'production', shift: 'night', returnTo: '/owner/assignments?shift=night' })
        expect(readBaseProductionNavigation(new URLSearchParams('tab=jobs')).tab).toBe('jobs')
        expect(readBaseProductionNavigation(new URLSearchParams('tab=unknown')).tab).toBeUndefined()
        expect(readBaseProductionNavigation(new URLSearchParams()).tab).toBeUndefined()
        expect(workspace).toContain("tab: 'production', shift, returnTo: configurationReturnTo")
    })

    it('retains Base and Premium owner eligibility', () => {
        expect(isTourEligible('configuration', 'base', 'owner')).toBe(true)
        expect(isTourEligible('configuration', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('configuration', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('configuration', 'base', 'supervisor')).toBe(false)
    })
})
