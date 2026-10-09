import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_CONTINUITY_PHRASES } from '../lib/i18n/base-continuity-phrases'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { applyTranslationGuards, translateStrictBasePlanText } from '../lib/i18n/runtime'

const actions = readFileSync('app/(dashboard)/owner/production/actions.ts', 'utf8')
const workerEditor = readFileSync('app/(dashboard)/owner/production/registers/WorkerEditor.tsx', 'utf8')
const machineEditor = readFileSync('app/(dashboard)/owner/production/registers/MachineEditor.tsx', 'utf8')

function functionBody(source: string, name: string) {
    const start = source.indexOf(`export async function ${name}(`)
    expect(start, `${name} is exported`).toBeGreaterThan(-1)
    const next = source.indexOf('\nexport async function ', start + 1)
    return source.slice(start, next === -1 ? undefined : next)
}

describe('bulk add server actions', () => {
    for (const name of ['createBaseProductionWorkersBulk', 'createBaseProductionMachinesBulk']) {
        const body = functionBody(actions, name)
        it(`${name} re-checks the owner and Base entitlement before reading input`, () => {
            expect(body.indexOf('await requireBaseProductionOwner()')).toBeGreaterThan(-1)
            expect(body.indexOf('await requireBaseProductionOwner()')).toBeLessThan(body.indexOf('safeParse('))
        })
        it(`${name} stays on the signed-in client and the caller's org`, () => {
            expect(body).toContain('createServerClient()')
            expect(body).not.toMatch(/createAdminClient|service_role/)
            expect(body).toContain('org_id: profile.org_id')
            expect(body).toContain('created_by: user.id')
        })
        it(`${name} writes the whole batch in one insert`, () => {
            expect(body.match(/\.insert\(/g)).toHaveLength(1)
            expect(body).toMatch(/\.insert\(\w+\.map\(|\.insert\(fresh\.map\(|\.insert\(names\.map\(/)
        })
    }

    it('caps a worker batch and requires a salary for every monthly row', () => {
        expect(actions).toContain('.max(MAX_BULK_WORKERS,')
        expect(actions).toContain("'Enter a joining date and a positive monthly salary for every worker.'")
        expect(actions).toContain('input.rows.some((row) => row.monthlySalary <= 0)')
    })
    it('leaves out names that already exist and reports how many it skipped', () => {
        const body = functionBody(actions, 'createBaseProductionWorkersBulk')
        expect(body).toContain('partitionBulkNames(')
        expect(body).toContain('.from(\'base_production_workers\')\n        .select(\'name\')')
        expect(body).toContain('skipped: skipped.length')
        expect(body).toContain("error?.code === '23505'")
    })
    it('numbers machines on the server from the stored names and retries a numbering race', () => {
        const body = functionBody(actions, 'createBaseProductionMachinesBulk')
        expect(actions).toContain('.max(MAX_BULK_MACHINES,')
        expect(body).toContain('buildBulkMachineNames(')
        expect(body).toContain('attempt < 3')
        expect(body).toContain("error.code !== '23505'")
    })
})

describe('bulk add dialogs', () => {
    it('start with bulk off, reset it when opened, and never offer it when editing or in a tour sample', () => {
        for (const source of [workerEditor, machineEditor]) {
            expect(source).toContain('const [bulk, setBulk] = useState(false)')
            expect(source).toContain('setBulk(false)')
            expect(source).toContain('bulk && !editing')
        }
        expect(workerEditor).toContain('{!editingWorkerId && !tourPreview && <div data-workers-bulk-toggle')
        expect(machineEditor).toContain('{!editingMachineId && !tourPreview && <div data-machines-bulk-toggle')
    })
    it('block submit until the batch is valid', () => {
        expect(workerEditor).toContain('const bulkReady = bulkResult !== null && bulkCount > 0 && bulkResult.problems.length === 0 && bulkOverLimit === 0')
        expect(workerEditor).toContain('(bulkActive && !bulkReady)')
        expect(machineEditor).toContain('const bulkReady = bulkNames.length > 0')
        expect(machineEditor).toContain('(bulkActive && !bulkReady)')
    })
    it('count unsaved bulk input as a change so closing asks first', () => {
        expect(workerEditor).toContain("bulkText.trim() !== ''")
        expect(machineEditor).toContain("bulkCountText.trim() !== ''")
    })
    it('keep every single-add tour anchor on the single form', () => {
        for (const anchor of ['name', 'payType', 'role', 'salary', 'joining', 'availability']) expect(workerEditor).toContain(`data-workers-tour-field="${anchor}"`)
        for (const anchor of ['name', 'type', 'label']) expect(machineEditor).toContain(`data-machines-tour-field="${anchor}"`)
    })
})

describe('bulk add translations', () => {
    const phraseRe = /tx\('((?:[^'\\]|\\.)*)'/g
    const bulkPhrases = [...new Set([workerEditor, machineEditor].flatMap(source => [...source.matchAll(phraseRe)].map(match => match[1])))]
        .filter(phrase => /\{\w+\}|bulk|Add workers|Add machines|Add 1 |worker names|How many machines|Name prefix|Line \{|ready|Skipping|added\.|Will add|several|numbered|Up to|whole number|Role, operator approval|One name per line|One worker per line|…and/i.test(phrase))
    const hi = BASE_CONTINUITY_PHRASES.hi as Record<string, string>
    const gu = BASE_CONTINUITY_PHRASES.gu as Record<string, string>
    const placeholders = (text: string) => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort()

    it('finds the bulk phrases the dialogs use', () => {
        expect(bulkPhrases.length).toBeGreaterThanOrEqual(25)
    })
    for (const [language, dictionary] of [['hi', hi], ['gu', gu]] as const) {
        it(`has a ${language} translation for each bulk phrase, with the same placeholders`, () => {
            for (const phrase of bulkPhrases) {
                const translated = dictionary[phrase]
                expect(translated, `${language}: ${phrase}`).toBeTruthy()
                expect(placeholders(translated), `${language} placeholders: ${phrase}`).toEqual(placeholders(phrase))
            }
        })
        it(`keeps placeholders and example names intact through the ${language} Base-plan text guards`, () => {
            for (const phrase of bulkPhrases) {
                const translated = dictionary[phrase]
                const strict = translateStrictBasePlanText(translated, language) ?? translated
                const legacy = applyTranslationGuards(phrase, translated, language)
                for (const guarded of [strict, legacy]) {
                    expect(placeholders(guarded), `${language} guarded placeholders: ${phrase}`).toEqual(placeholders(phrase))
                    for (const example of ['Ramesh, 12000', '₹1,00,00,000', 'Loom #1']) {
                        if (phrase.includes(example)) expect(guarded, `${language} keeps ${example}`).toContain(example)
                    }
                }
            }
        })
    }
    it('is reachable from the Base plan phrase maps the runtime reads', () => {
        for (const phrase of bulkPhrases) {
            expect((BASE_PLAN_PHRASES.hi as Record<string, string>)[phrase]).toBe(hi[phrase])
            expect((BASE_PLAN_PHRASES.gu as Record<string, string>)[phrase]).toBe(gu[phrase])
        }
    })
})
