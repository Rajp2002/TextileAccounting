import { describe, expect, it } from 'vitest'
import { makeMachinesTourExamples, machinesTourSteps, machinesTourEditor, machinesTourSpecs, machinesTourSelectors } from '../lib/machines-tour'
import { machinesTutorialCopy, machinesStepCopy, machinesTourControlLabels } from '../lib/i18n/machines-tutorial'
import { getMachineReadiness } from '../lib/machine-readiness'
import { isTourEligible, tourRegistry } from '../lib/tours/tour-registry'
import { UuidSchema } from '../lib/schemas'
import { readFileSync } from 'node:fs'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { isSampleRecordId } from '../lib/tours/sample-ids'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const languages = ['en', 'gu', 'hi'] as const
const dictionaries = { en, gu, hi }
const spec = readFileSync('docs/guided-tours/pages/machines.md', 'utf8')

describe('Machines tour', () => {
    it('illustrates ready and incomplete machines without persisted IDs', () => {
        const examples = makeMachinesTourExamples()
        expect(examples.map(machine => getMachineReadiness(machine).status)).toEqual(['active', 'needs_setup'])
        expect(examples.every(machine => machine.is_active)).toBe(true)
        examples.forEach(machine => {
            expect(UuidSchema.safeParse(machine.id).success).toBe(false)
            expect(isSampleRecordId(machine.id)).toBe(true)
        })
        examples[0].name = 'Changed'
        expect(makeMachinesTourExamples()[0].name).toBe('Sample loom 1')
    })
    it('shows an unavailable machine as inactive and otherwise follows assignments', () => {
        const machine = makeMachinesTourExamples()[0]
        expect(getMachineReadiness({ ...machine, is_active: false }).status).toBe('inactive')
        expect(getMachineReadiness({ ...machine, hasWorker: false }).status).toBe('needs_setup')
        expect(getMachineReadiness({ ...machine, hasCosting: false }).status).toBe('needs_setup')
    })
    it('opens and closes the appropriate preview in either navigation direction', () => {
        const expected = [null, 'add', null, null, null, null]
        expect(machinesTourSteps.map(machinesTourEditor)).toEqual(expected)
        expect([...machinesTourSteps].reverse().map(machinesTourEditor)).toEqual([...expected].reverse())
    })
    it('uses the six approved steps, presets and anchors with a live Add machine handoff', () => {
        expect(machinesTourSteps).toEqual(['mc-purpose', 'mc-details', 'mc-readiness', 'mc-quality', 'mc-worker', 'mc-handoff'])
        expect(machinesTourSpecs.map(step => step.id)).toEqual(machinesTourSteps)
        expect(machinesTourSpecs.map(step => step.kind)).toEqual(['live', 'sample', 'sample', 'live', 'live', 'handoff'])
        expect(machinesTourSpecs.filter(step => step.context).map(step => step.id)).toEqual(['mc-details'])
        expect(machinesTourSpecs.filter(step => step.detail).map(step => step.id)).toEqual(['mc-details'])
        expect(machinesTourSpecs[1].context).toBe('[data-machines-tour-preview="true"][data-state="open"]')
        expect(machinesTourSpecs.map(step => step.anchor)).toEqual([
            '[data-machines-tour="header"]', '[data-machines-tour-field="details"]',
            '[data-machines-tour-id="tour-machines-incomplete"]', '[data-machines-tour="production-next"]',
            '[data-machines-tour="assignments-next"]', '[data-tour-anchor="machines.add"]',
        ])
        expect(Object.keys(machinesTourSelectors)).toEqual(machinesTourSteps)
    })
    it.each(languages)('%s preserves the exact approved copy and resolves the live control labels', language => {
        const copy = machinesTutorialCopy[language]
        const controls = machinesTourControlLabels(
            text => language === 'en' ? text : BASE_PLAN_PHRASES[language][text],
            key => { expect(key).toBe('production.assignLooms'); return dictionaries[language].production.assignLooms },
        )
        for (const row of spec.split('\n')) {
            const match = row.match(/^\| `(\w+)\.(title|body|detail|benefit|productionLink)` \| (.*?) \| (.*?) \| (.*?) \|$/)
            if (!match) continue
            const actual = match[1] === 'rail' ? copy.productionLink : (copy[match[1] as 'purpose'] as unknown as Record<string, string>)[match[2]]
            expect(actual).toBe(match[3 + languages.indexOf(language)])
        }
        for (const step of machinesTourSteps) {
            const rendered = machinesStepCopy(language, step, controls)
            expect(rendered.title).toBeTruthy()
            expect(rendered.body).toBeTruthy()
            expect(JSON.stringify(rendered)).not.toMatch(/\{c:|Overview & Looms|start date/)
            if (language === 'en') {
                expect(rendered.title.split(/\s+/).length).toBeLessThanOrEqual(9)
                expect(rendered.body.split(/\s+/).length).toBeLessThanOrEqual(55)
            } else {
                expect(rendered.body).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                expect(Object.values(rendered).join(' ').replaceAll('Weavly', '')).not.toMatch(/[A-Za-z]{2,}/)
            }
        }
        expect(copy.guide.benefit).toBe(tourInvitationCopy[language].benefits.machines)
        expect(copy).not.toHaveProperty('label')
        expect(copy).not.toHaveProperty('fields')
        expect(machinesStepCopy(language, 'mc-details', controls).detail).toContain(controls.edit)
        expect(machinesStepCopy(language, 'mc-readiness', controls).body).toContain(controls.needsSetup)
        expect(machinesStepCopy(language, 'mc-quality', controls).body).toContain(controls.assignLooms)
        expect(machinesStepCopy(language, 'mc-handoff', controls).body).toContain(controls.addMachine)
        expect(controls.edit).toBe({ en: 'Edit', gu: 'ફેરફાર કરો', hi: 'संपादित करें' }[language])
        expect(controls.needsSetup).toBe({ en: 'Needs setup', gu: 'સેટઅપ જરૂરી', hi: 'सेटअप आवश्यक' }[language])
        const examples = makeMachinesTourExamples(copy.example)
        expect(examples[0].name).toBe(copy.example.readyName)
        expect(examples[0].custom_label).toBe(copy.example.label)
        expect(examples[1].name).toBe(copy.example.incompleteName)
        expect(examples[0].assignedWorkerName).toBe(copy.example.worker)
        expect(examples[0].assignedCostingLabel).toBe(copy.example.fabric)
        expect(copy.help).toHaveLength(4)
        for (const [title, description] of copy.help) {
            expect(title.trim()).not.toBe('')
            expect(description.trim()).not.toBe('')
            if (language !== 'en') expect(description).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
        }
    })
    it('limits eligibility to production-plan owners at content v2', () => {
        expect(tourRegistry.machines.contentVersion).toBe('v2')
        expect(isTourEligible('machines', 'base', 'owner')).toBe(true)
        expect(isTourEligible('machines', 'premium', 'owner')).toBe(false)
        expect(isTourEligible('machines', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('machines', 'free', 'owner')).toBe(false)
        expect(isTourEligible('machines', 'base', 'supervisor')).toBe(false)
    })
})
