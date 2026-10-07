import { describe, expect, it } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { productionTourSteps, productionTourSpecs, productionTourSelector } from '../lib/production-tour'
import { productionSampleData } from '../lib/tours/sample-data/production'
import { productionTutorialCopy, productionStepCopy, productionTourControlLabels } from '../lib/i18n/production-tutorial'
import { isTourEligible, tourRegistry } from '../lib/tours/tour-registry'
import { tourInvitationCopy } from '../lib/i18n/tour-invitations'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const dictionaries = { en, gu, hi }
const languages = ['en', 'gu', 'hi'] as const
const page = readFileSync('docs/guided-tours/pages/production.md', 'utf8')

describe('Production Overview tour', () => {
    it('teaches four setup steps then hands off to live activation, opening two real dialogs', () => {
        expect(productionTourSteps).toEqual(['pd-overview', 'pd-prereq', 'pd-activate', 'pd-looms', 'pd-handoff'])
        expect(productionTourSpecs.map(step => step.id)).toEqual(productionTourSteps)
        expect(productionTourSpecs.map(step => step.kind)).toEqual(['sample', 'sample', 'sample', 'sample', 'handoff'])
        expect(productionTourSpecs.filter(step => step.context).map(step => step.id)).toEqual(['pd-activate', 'pd-looms'])
        expect(productionTourSpecs.filter(step => step.context).every(step => step.context === '[data-tour-surface="true"]')).toBe(true)
        expect(productionTourSpecs.filter(step => step.detail).map(step => step.id)).toEqual(['pd-prereq', 'pd-activate'])
        expect(productionTourSpecs.map(step => step.anchor)).toEqual(['overview', 'qualities', 'activate', 'allocate'].map(field => `[data-production-tour="${field}"]`).concat('[data-tour-anchor="production.activate"]'))
        expect(productionTourSelector('pd-prereq')).toBe('[data-production-tour="qualities"]')
    })
    it.each(languages)('%s transcribes every approved Overview copy row exactly and resolves live tokens', language => {
        const copy = productionTutorialCopy[language]
        const dictionary = dictionaries[language].production
        const controls = productionTourControlLabels(key => dictionary[key.slice('production.'.length) as keyof typeof dictionary])
        for (const row of page.split('\n')) {
            const match = row.match(/^\| `(\w+)\.(title|body|detail|benefit)` \| (.*?) \| (.*?) \| (.*?) \|$/)
            if (!match) continue
            const group = copy[match[1] as 'overview'] as unknown as Record<string, string>
            expect(group[match[2]]).toBe(match[3 + languages.indexOf(language)])
        }
        for (const step of productionTourSteps) {
            const rendered = productionStepCopy(language, step, controls)
            expect(rendered.title).toBeTruthy()
            expect(rendered.body).toBeTruthy()
            expect(JSON.stringify(rendered)).not.toMatch(/\{c:|Overview & Looms|Loom Board|Save machine production|Production cost/)
            if (language === 'en') {
                expect(rendered.body.split(/\s+/).length).toBeLessThanOrEqual(55)
                expect(rendered.title.split(/\s+/).length).toBeLessThanOrEqual(9)
            } else {
                expect(rendered.body).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                expect(Object.values(rendered).join(' ').replaceAll('Weavly', '')).not.toMatch(/[A-Za-z]{2,}/)
            }
        }
        expect(copy.prereq.body).toContain({ en: 'stock of every yarn', gu: 'દરેક યાર્નનો સ્ટોક', hi: 'हर धागे का स्टॉक' }[language])
        expect(copy.activate.detail).toBeTruthy()
        expect(productionStepCopy(language, 'pd-activate', controls).body).toContain(controls.activateQuality)
        expect(productionStepCopy(language, 'pd-looms', controls).body).toContain(controls.assignLooms)
        expect(productionStepCopy(language, 'pd-handoff', controls).body).toContain(controls.activateQuality)
        expect(copy.guide.benefit).toBe(tourInvitationCopy[language].benefits.production)
    })
    it.each(languages)('%s shares exact approved labels, including the owner-approved cost', language => {
        const dictionary = dictionaries[language].production
        for (const row of page.split('\n')) {
            const cells = row.split('|').map(cell => cell.trim())
            const key = cells[1]?.match(/^`(?:production\.)?(\w+)`$/)?.[1]
            if (!key || !(key in dictionary)) continue
            if (key === 'cost') expect(dictionary[key]).toBe(cells[2 + languages.indexOf(language)])
            else if (language !== 'en') expect(dictionary[key as keyof typeof dictionary]).toBe(cells[language === 'gu' ? 3 : 4])
        }
    })
    it('moves Daily Sheet ownership out of Overview', () => {
        const source = readFileSync('components/production/ProductionSampleWorkspace.tsx', 'utf8')
        expect(source).not.toMatch(/daily/i)
        for (const language of languages) expect(productionTutorialCopy[language]).not.toHaveProperty('fields')
        expect(readFileSync('lib/daily-sheet-tour.ts', 'utf8')).toContain("'ds-reading'")
        expect(readFileSync('lib/i18n/daily-sheet-tutorial.ts', 'utf8')).toContain('120 m')
    })
    it('shows the real page a running quality, a free loom and the ₹2/m wage the copy quotes, and keeps eligibility at v2', () => {
        const data = productionSampleData('en')
        expect(data.jobs).toHaveLength(1)
        expect(data.jobs[0]).toMatchObject({ status: 'active', worker_rate_per_meter: 2, costing_version: 2 })
        expect(data.machines).toHaveLength(3)
        expect(data.machineJobContexts).toHaveLength(2)
        expect(data.costings.filter(costing => !data.jobs.some(job => job.costing_id === costing.id))).toHaveLength(1) // one to choose in Activate Quality
        expect(tourRegistry.production.contentVersion).toBe('v2')
        expect(isTourEligible('production', 'base', 'owner')).toBe(true)
        expect(isTourEligible('production', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('production', 'free', 'owner')).toBe(false)
        expect(isTourEligible('production', 'base', 'supervisor')).toBe(false)
    })
    it('keys only the named live controls and preserves both responsive activation targets', () => {
        const root = 'app/(dashboard)/owner/production/'
        const client = readFileSync(root + 'BaseProductionClient.tsx', 'utf8')
        const qualities = readFileSync(root + 'BaseActiveQualities.tsx', 'utf8')
        for (const source of [client, qualities]) {
            expect(source.match(/data-tour-anchor="production.activate"/g)).toHaveLength(1)
            expect(source).toContain("t('production.activateQuality')")
        }
        for (const key of ['assignLooms', 'qualityActions', 'cost']) expect(qualities).toContain(`t('production.${key}')`)
        // Loom quality and operators moved to Machine Assignments; the Overview no longer carries a board.
        expect(existsSync(root + 'BaseMachineBoard.tsx')).toBe(false)
        expect(client).not.toContain('BaseMachineBoard')
        expect(qualities).toContain('onClick={onActivateQuality ?? (() => onOpenActivateModalChange?.(true))}')
        expect(client).toContain("view === 'production' && activeTab === 'jobs'")
    })
})
