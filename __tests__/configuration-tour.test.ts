import { describe, expect, it } from 'vitest'
import { configurationTourSteps, configurationTourSelectors, configurationTourSpecs, configurationTourControlLabels, configurationHandoffWorker, configurationTourView, makeConfigurationTourExample, CONFIGURATION_SAMPLE_MACHINE, CONFIGURATION_SAMPLE_WORKER } from '../lib/configuration-tour'
import { configurationHelpTopics, configurationTutorialCopy } from '../lib/i18n/configuration-tutorial'
import { isTourEligible, tourRegistry } from '../lib/tours/tour-registry'
import { formatTourText } from '../lib/tours/tour-text'
import { isSampleRecordId } from '../lib/tours/sample-ids'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { UuidSchema } from '../lib/schemas'
import { readBaseProductionNavigation } from '../lib/base-production-navigation'
import { readFileSync, existsSync } from 'node:fs'

const workspace = readFileSync('app/(dashboard)/owner/production/BaseAssignmentWorkspace.tsx', 'utf8')
const controller = readFileSync('components/tours/GuidedTour.tsx', 'utf8')
const approved = readFileSync('docs/guided-tours/pages/machine-assignments.md', 'utf8')

describe('Assignment tour workflow', () => {
    it('teaches prerequisites before selection and saving before a data-dependent live handoff', () => {
        expect(configurationTourSteps).toEqual(['ma-purpose', 'ma-shift', 'ma-job', 'ma-assign', 'ma-choose', 'ma-linked', 'ma-handoff'])
        expect(configurationTourSelectors['ma-linked']).toContain('saved-preview')
        expect(configurationTourSelectors['ma-handoff']).toContain('assignments.first-assign')
    })

    it('marks the columns anchor on the desktop Workers/Machines grid (content-height on sample steps) and on the mobile board', () => {
        // Round 2 (owner-requested): the control-row anchor put the panel over the Workers column at <=1280. The anchor is
        // now the columns themselves, and that grid is content-height only while a sample step runs, so the panel lands
        // in the board's empty lower area instead of on the rows.
        const anchor = 'data-tour-anchor="assignments.columns"'
        const lines = workspace.split('\n')
        const marked = lines.map((line, index) => ({ line, index })).filter(({ line }) => line.includes(anchor))
        expect(marked).toHaveLength(2)
        // Desktop: the drag-linked columns grid (ref, connections marker and its class list are its neighbours).
        const desktop = lines.slice(marked[0].index - 3, marked[0].index + 6).join('\n')
        expect(desktop).toContain('ref={boardRef}')
        expect(desktop).toContain('data-configuration-tour-connections')
        expect(desktop).toContain("${tourSampleActive ? 'flex-none' : 'flex-1'}")
        expect(desktop).toContain('grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')
        // The height change is limited to sample steps: the live handoff keeps the scrolling flex-1 board.
        expect(workspace.match(/tourSampleActive \? 'flex-none' : 'flex-1'/g)).toHaveLength(1)
        // The former control-row anchor is gone: the search/filter row is unmarked again.
        const controlRow = lines.find(line => line.includes('mb-5 grid grid-cols-2 gap-4'))!
        expect(controlRow).not.toContain('data-tour-anchor')
        // Phone: the mobile board card keeps the geometry the tour already had there.
        expect(marked[1].line).toContain('data-configuration-tour="board"')
        expect(marked[1].line).toContain('md:hidden')
        // Board markers used by the CSS, the harness and other tests stay on both boards.
        expect(workspace.match(/data-configuration-tour="board"/g)).toHaveLength(2)
    })

    it('isolates examples from persisted records and regenerates them on replay', () => {
        for (const step of configurationTourSteps) {
            const sample = makeConfigurationTourExample('2026-09-17', step)
            for (const row of Object.values(sample).flat()) {
                expect(row.id.startsWith('tour-configuration-')).toBe(true)
                expect(isSampleRecordId(row.id)).toBe(true)
                expect(UuidSchema.safeParse(row.id).success).toBe(false)
            }
            expect(sample.workers).toHaveLength(1)
            expect(sample.machines).toHaveLength(1)
            expect(sample.workers[0].shift_availability).toBe('both')
        }
        const first = makeConfigurationTourExample('2026-09-17', 'ma-assign')
        first.workers[0].name = 'Changed by caller'
        first.assignments.push({ id: 'mutated', worker_id: 'live-worker', machine_id: 'live-machine', shift: 'night', active: true, effective_from: '2026-09-17', effective_to: null })
        expect(makeConfigurationTourExample('2026-09-17', 'ma-assign').workers[0].name).toBe('Sample worker')
        expect(makeConfigurationTourExample('2026-09-17', 'ma-assign').assignments).toEqual([])
    })

    it('moves from a blocked loom to an eligible picker to a valid saved day link', () => {
        expect(makeConfigurationTourExample('2026-09-17', 'ma-job').machineJobContexts).toEqual([])
        const picker = makeConfigurationTourExample('2026-09-17', 'ma-choose')
        expect(picker.assignments).toEqual([])
        expect(picker.machineJobContexts[0]).toMatchObject({ machine_id: CONFIGURATION_SAMPLE_MACHINE, job_id: picker.jobs[0].id, active: true })
        expect(picker.jobs[0].status).toBe('active')
        for (const step of ['ma-linked'] as const) {
            expect(makeConfigurationTourExample('2026-09-17', step).assignments).toEqual([expect.objectContaining({ worker_id: CONFIGURATION_SAMPLE_WORKER, machine_id: CONFIGURATION_SAMPLE_MACHINE, shift: 'day', active: true, effective_from: '2026-09-17' })])
        }
    })

    it('reverses preview states on Back without leaving the picker or saved link behind', () => {
        expect(configurationTourView('ma-choose')?.pickerWorkerId).toBe(CONFIGURATION_SAMPLE_WORKER)
        for (const step of ['ma-assign', 'ma-linked'] as const) expect(configurationTourView(step)?.pickerWorkerId).toBeNull()
        expect(configurationTourView('ma-handoff')).toBeNull()
        expect(configurationTourView('ma-job')?.mobileView).toBe('machines')
        expect(configurationTourView('ma-assign')?.mobileView).toBe('workers')
        expect(configurationTourView('ma-linked')?.mobileView).toBe('machines')
        expect(makeConfigurationTourExample('2026-09-17', 'ma-choose').assignments).toEqual([])
    })

    it('preserves opt-in launch, live state, interaction guards and completion only at Finish', () => {
        expect(workspace).toContain('useState<ConfigurationTourStep | null>(null)')
        expect(workspace).toContain('tourId="configuration"')
        expect(workspace).toContain("if (!tourStep || tourStep === 'ma-handoff') return liveData")
        expect(workspace).toContain("const workerSearch = tourStep ? '' : search")
        expect(workspace).toContain('tourView?.shift ?? selectedShift')
        expect(workspace).toContain('tourView?.mobileView ?? selectedMobileView')
        expect(workspace).toContain('tourView?.showInactive ?? includeInactive')
        expect(workspace).toContain('tourStep ? tourView?.pickerWorkerId ?? null : selectedPickerWorkerId')
        expect(workspace).toContain('inert={tourStep !== null}')
        for (const handler of ['handleAssign', 'handleUndoAssignment', 'handleRemove']) {
            const functionBody = workspace.slice(workspace.indexOf(`async function ${handler}`))
            expect(functionBody.slice(0, functionBody.indexOf('try {'))).toMatch(/if \(tourStep(?: \|\| pendingKey)?\) return/)
        }
        expect(workspace).toContain("import('@/components/tours/GuidedTour')")
        expect(workspace).toContain('<GuidedTour tourId="configuration"')
        expect(controller).toContain('if (recordCompletion) void persistTourCompleted(tourId, userId)')
        expect(controller).toContain("spec.kind === 'handoff'")
        expect(controller).toContain('useGuidedTourModal(')
        expect(existsSync('components/tours/ConfigurationTutorial.tsx')).toBe(false)
        const tourHook = readFileSync('hooks/use-guided-tour.ts', 'utf8')
        expect(tourHook).toContain('trigger?.focus({ preventScroll: true })')
        expect(tourHook).toContain('window.scrollTo({ left: scroll.x, top: scroll.y')
    })

    it('transcribes the approved core copy with token parity, native scripts and limits', () => {
        const dictionaries = { en, gu, hi }
        for (const [index, language] of (['en', 'gu', 'hi'] as const).entries()) {
            const copy = configurationTutorialCopy[language]
            expect(Object.keys(copy.steps)).toEqual([...configurationTourSteps])
            expect(Object.keys(copy.help)).toEqual([...configurationHelpTopics])
            const t = (key: string) => {
                const [group, name] = key.split('.')
                const locale = dictionaries[language]
                return group === 'assignments' ? locale.assignments[name as keyof typeof en.assignments] : locale.production.assignLooms
            }
            const labels = configurationTourControlLabels(t, text => text)
            expect(labels.assign).toBe(dictionaries[language].assignments.assign)
            expect(labels.noJob).toBe(dictionaries[language].assignments.noJob)
            expect(labels.assignLooms).toBe(dictionaries[language].production.assignLooms)
            for (const [step, content] of [...Object.entries(copy.steps), ['handoff.empty', copy.emptyHandoff]] as const) {
                for (const [part, text] of Object.entries(content)) {
                    const key = step.replace('ma-', '') + '.' + part
                    const row = approved.split('\n').find(line => line.startsWith(`| \`${key}\` |`))!
                    expect(text).toBe(row.split('|').slice(2, 5).map(cell => cell.trim())[index])
                    const rendered = formatTourText(text, labels)
                    expect(rendered).not.toContain('{c:')
                    expect(text.trim().length).toBeGreaterThan(0)
                    if (language === 'en') expect(text.length).toBeLessThanOrEqual(part === 'title' ? 48 : part === 'body' ? 190 : 320)
                    else expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                }
            }
            for (const topic of configurationHelpTopics) expect(copy.help[topic].every(text => text.trim().length > 0)).toBe(true)
            expect(JSON.stringify(copy)).not.toContain('Overview & Looms')
            expect(configurationHelpTopics).not.toContain('inactive')
            expect(copy.helpLabel).toBeTruthy()
            expect(copy.dailySheetLabel).toBeTruthy()
            const benefit = approved.split('\n').find(line => line.startsWith('| `guide.benefit` |'))!
            expect(tourInvitationCopy[language].benefits.configuration).toBe(benefit.split('|').slice(2, 5).map(cell => cell.trim())[index])
        }
        expect(configurationTutorialCopy.en.steps['ma-shift'].body).toBe('Day and night are set separately.')
        expect(configurationTutorialCopy.en.steps['ma-choose'].body).toContain('before replacing')
        expect(configurationTutorialCopy.en.steps['ma-choose'].detail).toContain('{c:undo}')
        expect(configurationTutorialCopy.en.steps['ma-linked'].body).toContain('Daily Sheet')
        expect(workspace).toContain('configurationHelpTopics.map')
        expect(workspace).toContain("t('assignments.assign')")
        expect(workspace).toContain("t('assignments.noJob')")
    })

    it('anchors ma-purpose to the columns row (MA-1 fallback) and keeps every other anchor, the picker context and the handoffs', () => {
        // Browser evidence (BV-02): the whole-board anchor overlapped the panel at 1024x768 and 1280x800, so the
        // spec §E fallback applies. Phones resolve the same selector to the mobile board card, as before.
        expect(configurationTourSelectors['ma-purpose']).toBe('[data-tour-anchor="assignments.columns"]')
        expect(configurationTourSelectors['ma-shift']).toBe('[data-configuration-tour="shift"]')
        expect(configurationTourSelectors['ma-job']).toBe('[data-configuration-tour="job"]')
        expect(configurationTourSelectors['ma-assign']).toBe('[data-configuration-tour="assign"]')
        expect(configurationTourSelectors['ma-choose']).toBe('[data-configuration-picker-state="available"]')
        for (const hasWorker of [true, false]) {
            const specs = configurationTourSpecs(hasWorker)
            expect(specs.map(step => step.id)).toEqual([...configurationTourSteps])
            expect(specs.map(step => step.kind)).toEqual(['sample', 'sample', 'sample', 'sample', 'sample', 'sample', 'handoff'])
            expect(specs[4]).toMatchObject({ context: '[data-configuration-picker-preview="true"]', detail: true })
            expect(specs.at(-1)?.anchor).toContain(hasWorker ? 'assignments.first-assign' : 'assignments.add-worker')
        }
        const sample = makeConfigurationTourExample('2026-09-17', 'ma-purpose').workers[0]
        const real = { ...sample, id: 'real-worker', shift_availability: 'night' as const }
        const rows = [sample, { ...real, id: 'inactive', is_active: false }, { ...real, id: 'salary', pay_type: 'fixed_monthly' as const }, real]
        expect(configurationHandoffWorker(rows)?.id).toBe('real-worker')
        expect(configurationHandoffWorker(rows.slice(0, -1))).toBeUndefined()
        expect(configurationHandoffWorker([])).toBeUndefined()
        expect(workspace).toContain('!tourStep && (focusWorkerId || focusMachineId)')
        expect(workspace).toContain('findTourTarget(completedHandoff.current)')
        expect(workspace).toContain("target && !target.matches(':disabled, [aria-disabled=\"true\"]') ? target : fallback")
        const css = readFileSync('app/globals.css', 'utf8')
        expect(css).not.toContain('[data-configuration-tour-preview="true"]')
        expect(css).toContain('[data-configuration-picker-preview="true"]')
    })

    it('opens Daily Sheet with the selected shift and a safe return to assignments', () => {
        const params = new URLSearchParams({ tab: 'production', shift: 'night', returnTo: '/owner/assignments?shift=night' })
        expect(readBaseProductionNavigation(params)).toMatchObject({ tab: 'production', shift: 'night', returnTo: '/owner/assignments?shift=night' })
        expect(readBaseProductionNavigation(new URLSearchParams('tab=jobs')).tab).toBe('jobs')
        expect(readBaseProductionNavigation(new URLSearchParams('tab=unknown')).tab).toBeUndefined()
        expect(readBaseProductionNavigation(new URLSearchParams()).tab).toBeUndefined()
        expect(workspace).toContain("tab: 'production', shift, returnTo: configurationReturnTo")
    })

    it('limits v2 eligibility to Base owners without changing invitation policy', () => {
        expect(tourRegistry.configuration).toMatchObject({ contentVersion: 'v2', invitationPolicyVersion: 'v1' })
        expect(isTourEligible('configuration', 'base', 'owner')).toBe(true)
        expect(isTourEligible('configuration', 'premium', 'owner')).toBe(false)
        expect(isTourEligible('configuration', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('configuration', 'base', 'supervisor')).toBe(false)
    })
})
