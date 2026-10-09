import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BASE_CONTINUITY_PHRASES } from '../lib/i18n/base-continuity-phrases'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { legacyPhraseTranslations } from '../lib/i18n/legacy'
import { generatedLegacyPhraseTranslations } from '../lib/i18n/legacy-generated'
import { applyTranslationGuards, translateStrictBasePlanText } from '../lib/i18n/runtime'

const read = (path: string) => readFileSync(path, 'utf8')
const actions = read('app/(dashboard)/owner/production/actions.ts')
const workerEditor = read('app/(dashboard)/owner/production/registers/WorkerEditor.tsx')
const machineEditor = read('app/(dashboard)/owner/production/registers/MachineEditor.tsx')
const workerEntry = read('components/workers/BulkWorkerEntry.tsx')
const machineEntry = read('components/machines/BulkMachineEntry.tsx')
const grid = read('components/onboarding/base/BulkEntryGrid.tsx')

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
            expect(body).toContain('.eq(\'org_id\', profile.org_id)')
        })
        it(`${name} writes the whole batch in one insert and rejects duplicate names`, () => {
            expect(body.match(/\.insert\(/g)).toHaveLength(1)
            expect(body).toContain('findBulkNameIssues(')
            expect(body).toContain("error?.code === '23505'")
        })
    }

    it('workers: piece rate and fixed staff are created with the right pay setup', () => {
        const body = functionBody(actions, 'createBaseProductionWorkersBulk')
        expect(body).toContain("pay_type: 'piece_rate'")
        expect(body).toContain("pay_type: 'fixed_monthly'")
        expect(body).toContain('operator_eligible: true')
        expect(body).toContain('operator_eligible: false')
        expect(body).toContain('monthly_salary: row.monthlySalary')
        expect(body).toContain('salary_effective_from: parsed.data.startDate')
    })
    it('workers: caps the batch and requires a salary and joining date for fixed staff', () => {
        expect(actions).toContain('total > MAX_BULK_WORKERS')
        expect(actions).toContain('!isValidMonthlySalary(row.monthlySalary)')
        expect(actions).toContain("'Enter a joining date for the fixed rate staff.'")
    })
    it('machines: groups by type, requires a name per machine and caps the batch', () => {
        const body = functionBody(actions, 'createBaseProductionMachinesBulk')
        expect(body).toContain('machine_type: row.machineType')
        expect(actions).toContain('total > MAX_BULK_MACHINES')
        expect(actions).toContain('BaseMachineTypeSchema')
    })
})

describe('bulk add dialogs', () => {
    it('start with bulk off, reset it on open and edit, and never offer it when editing or in a tour sample', () => {
        for (const source of [workerEditor, machineEditor]) {
            expect(source).toContain('const [bulk, setBulk] = useState(false)')
            expect(source).toContain('resetBulk()')
            expect(source).toContain('bulk && !editing')
        }
        expect(workerEditor).toContain('{!editingWorkerId && !tourPreview && <div data-workers-bulk-toggle>')
        expect(machineEditor).toContain('{!editingMachineId && !tourPreview && <div data-machines-bulk-toggle>')
    })
    it('replace the single form with the bulk entry while keeping its tour anchors', () => {
        expect(workerEditor).toContain('{bulkActive ? <BulkWorkerEntry')
        expect(machineEditor).toContain('{bulkActive ? <BulkMachineEntry')
        for (const anchor of ['name', 'payType', 'role', 'salary', 'joining', 'availability', 'active']) expect(workerEditor).toContain(`data-workers-tour-field="${anchor}"`)
        for (const anchor of ['name', 'type', 'label', 'availability']) expect(machineEditor).toContain(`data-machines-tour-field="${anchor}"`)
    })
    it('block submit until every row is valid', () => {
        expect(workerEditor).toContain('(bulkActive && !bulkEvaluation.valid)')
        expect(workerEditor).toContain('if (!bulkEvaluation.valid) return')
        expect(machineEditor).toContain('(bulkActive && !bulkEvaluation.valid)')
        expect(machineEditor).toContain('if (!bulkEvaluation.valid) return')
    })
    it('count typed rows as a change so closing asks first', () => {
        expect(workerEditor).toContain('!isBulkWorkersDraftEmpty(bulkDraft)')
        expect(machineEditor).toContain('!isBulkMachinesDraftEmpty(bulkDraft)')
    })
    it('use the shared onboarding grid in its dialog layout, with salary after role', () => {
        for (const source of [workerEntry, machineEntry]) {
            expect(source).toContain("from '@/components/onboarding/base/BulkEntryGrid'")
            expect(source).toContain('variant="dialog"')
            expect(source).toContain('onEnterOnEmptyRow=')
        }
        const staffColumns = workerEntry.slice(workerEntry.indexOf('STAFF_COLUMNS'), workerEntry.indexOf('const createPieceRow'))
        expect(staffColumns.indexOf("key: 'name'")).toBeLessThan(staffColumns.indexOf("key: 'role'"))
        expect(staffColumns.indexOf("key: 'role'")).toBeLessThan(staffColumns.indexOf("key: 'monthlySalary'"))
    })
})

describe('shared onboarding grid', () => {
    it('keeps the page layout unless a dialog asks for the dialog layout', () => {
        expect(grid).toContain("variant = 'page'")
        expect(grid).toContain("'grid-cols-[3rem_1fr_3rem]'")
        expect(grid).toContain("!dialog && 'max-h-[380px] overflow-y-auto'")
    })
    it('treats Enter on a blank row as finishing the list, in any column', () => {
        expect(grid).toContain('if (onEnterOnEmptyRow && isRowEmpty(currentRow)) {')
    })
    it('does not remember a focus target for a cell that already exists, which would steal focus on a later render', () => {
        expect(grid).not.toContain('focusTargetRef.current = { rowId, colKey: nextColKey }')
        expect(grid).not.toContain('focusTargetRef.current = { rowId: nextRow.id, colKey: firstColKey }')
    })
    it('lets decimal salaries submit inside a form and never submits on Enter', () => {
        expect(grid).toContain("step={col.type === 'number' ? 'any' : undefined}")
        expect(grid).toContain("if (e.key === 'Enter') {\n            e.preventDefault()")
    })
})

describe('bulk add translations', () => {
    const literals = (source: string, pattern: RegExp) => [...source.matchAll(pattern)].map(match => match[1])
    const tx = /tx\('((?:[^'\\]|\\.)*)'/g
    const column = /(?:label|placeholder): '((?:[^'\\]|\\.)*)'/g
    const fromEntries = [
        ...literals(workerEntry, tx), ...literals(workerEntry, column),
        ...literals(machineEntry, tx), ...literals(machineEntry, column),
    ].filter(phrase => phrase !== '18000')
    const fromEditors = [...literals(workerEditor, tx), ...literals(machineEditor, tx)]
        .filter(phrase => /\{\w+\}|bulk|Add workers|Add machines|Add 1 |several|added\./i.test(phrase))
    const phrases = [...new Set([...fromEntries, ...fromEditors])]

    // The runtime phrase map is these dictionaries merged, Base plan phrases last.
    const merged = (language: 'hi' | 'gu'): Record<string, string> => ({
        ...generatedLegacyPhraseTranslations[language],
        ...legacyPhraseTranslations[language],
        ...(BASE_PLAN_PHRASES[language] as Record<string, string>),
    })
    const hi = merged('hi')
    const gu = merged('gu')
    const continuityHi = BASE_CONTINUITY_PHRASES.hi as Record<string, string>
    const placeholders = (text: string) => [...text.matchAll(/\{\w+\}/g)].map(match => match[0]).sort()

    it('finds the phrases the bulk dialogs use', () => {
        expect(phrases.length).toBeGreaterThanOrEqual(30)
        expect(phrases).toContain('Add in bulk')
        expect(phrases).toContain('Monthly salary (₹)')
        expect(phrases).toContain('Machine name or number')
    })
    for (const [language, dictionary] of [['hi', hi], ['gu', gu]] as const) {
        it(`has a ${language} translation for each phrase, with the same placeholders`, () => {
            for (const phrase of phrases) {
                const translated = dictionary[phrase]
                expect(translated, `${language}: ${phrase}`).toBeTruthy()
                expect(placeholders(translated), `${language} placeholders: ${phrase}`).toEqual(placeholders(phrase))
            }
        })
        it(`keeps placeholders and rupee amounts intact through the ${language} Base-plan text guards`, () => {
            for (const phrase of phrases) {
                const translated = dictionary[phrase]
                const strict = translateStrictBasePlanText(translated, language) ?? translated
                const legacy = applyTranslationGuards(phrase, translated, language)
                for (const guarded of [strict, legacy]) {
                    expect(placeholders(guarded), `${language} guarded placeholders: ${phrase}`).toEqual(placeholders(phrase))
                    if (phrase.includes('₹1,00,00,000')) expect(guarded, `${language} keeps the rupee limit`).toContain('₹1,00,00,000')
                }
            }
        })
    }
    it('reaches the Base plan phrase maps through the continuity phrases', () => {
        for (const phrase of fromEditors) expect(hi[phrase]).toBe(continuityHi[phrase])
    })
})
