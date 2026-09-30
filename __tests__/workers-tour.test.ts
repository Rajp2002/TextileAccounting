import { describe, expect, it } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { makeWorkersTourExamples, workersHelpSteps, workersTourEditor, workersTourPaths, workersTourSteps, workersTourSelectors, workersTourSpecs, workersTourCopyKey, workersTourControlLabels, workersTourExample } from '../lib/workers-tour'
import { workersTutorialCopy } from '../lib/i18n/workers-tutorial'
import { getWorkerOperationalSummary } from '../lib/worker-operational'
import { isTourEligible, tourRegistry } from '../lib/tours/tour-registry'
import { isSampleRecordId } from '../lib/tours/sample-ids'
import { formatTourText } from '../lib/tours/tour-text'
import { UuidSchema } from '../lib/schemas'
import { calculateBaseSalaryLines } from '../lib/base-salary'
import { calculateBaseEntryGrossPay } from '../lib/base-production-core'
import { en } from '../lib/i18n/locales/en'
import { gu } from '../lib/i18n/locales/gu'
import { hi } from '../lib/i18n/locales/hi'

const languages = ['en', 'gu', 'hi'] as const
const approved = readFileSync('docs/guided-tours/pages/workers.md', 'utf8')
const dictionaries = { en, gu, hi }

describe('Workers guided tour', () => {
    it('provides independent, localized, non-persistable examples of both pay types', () => {
        const expected = [['Sample worker', 'Sample staff', 'Supervisor'], ['નમૂના કારીગર', 'નમૂના સ્ટાફ', 'સુપરવાઇઝર'], ['नमूना कारीगर', 'नमूना स्टाफ', 'सुपरवाइज़र']]
        for (const [index, language] of languages.entries()) {
            const examples = makeWorkersTourExamples(language)
            expect(examples.map(worker => worker.pay_type)).toEqual(['piece_rate', 'fixed_monthly'])
            examples.forEach(worker => {
                expect(UuidSchema.safeParse(worker.id).success).toBe(false)
                expect(isSampleRecordId(worker.id)).toBe(true)
            })
            expect([examples[0].name, examples[1].name, examples[1].role]).toEqual(expected[index])
            expect(examples[0]).toMatchObject({ assignedMachineCount: 2, rate_per_meter: 0 })
            expect(getWorkerOperationalSummary(examples[1])).toMatchObject({ hasSalaryConfigured: true, payrollStatusLabel: 'Ready' })
            examples[0].name = 'Modified'
            examples[1].salary_history![0].monthly_salary = 1
            expect(makeWorkersTourExamples(language)[0].name).toBe(expected[index][0])
            expect(makeWorkersTourExamples(language)[1].salary_history![0].monthly_salary).toBe(18000)
        }
    })
    it('keeps the approved six-step order and merges effective/last-day into changes', () => {
        expect(workersTourPaths.piece).toEqual(['wk-paytype', 'wkp-availability', 'wkp-wage', 'wkp-loom', 'wkp-earnings', 'wk-handoff'])
        expect(workersTourPaths.salary).toEqual(['wk-paytype', 'wks-salary', 'wks-joining', 'wks-changes', 'wks-payroll', 'wk-handoff'])
        for (const path of ['piece', 'salary'] as const) {
            const specs = workersTourSpecs(path)
            expect(specs).toHaveLength(6)
            for (const step of [...specs, ...[...specs].reverse()]) {
                const editor = workersTourEditor(step.id, path)
                if (step.id === 'wk-paytype') expect(editor).toBe(path)
                else if (step.id === 'wkp-availability') expect(editor).toBe('piece')
                else if (step.id === 'wks-salary' || step.id === 'wks-joining') expect(editor).toBe('salary')
                else if (step.id === 'wks-changes') expect(editor).toBe('edit')
                else expect(editor).toBeNull()
                expect(step.kind).toBe(step.id === 'wk-handoff' ? 'handoff' : 'sample')
                expect(Boolean(step.context)).toBe(Boolean(editor))
                expect(step.anchor).toBe(workersTourSelectors[step.id])
            }
        }
        expect(workersTourSelectors['wkp-earnings']).toBe('[data-workers-tour="piece"] [data-workers-tour="readiness"]')
        expect(workersTourSelectors['wk-handoff']).toBe('[data-tour-anchor="workers.add"]')
        // Every pay-path toggle restarts target readiness despite retaining wk-paytype.
        expect(workersTourSpecs('piece')[0].context).not.toBe(workersTourSpecs('salary')[0].context)
    })
    it('transcribes every approved core string exactly with parity, script and English limits', () => {
        for (const [index, language] of languages.entries()) {
            const copy = workersTutorialCopy[language]
            expect(Object.keys(copy.fields).sort()).toEqual([...workersHelpSteps].sort())
            expect(Object.keys(copy.steps).sort()).toEqual(workersTourSteps.map(workersTourCopyKey).sort())
            for (const step of workersTourSteps) {
                const key = workersTourCopyKey(step)
                for (const part of ['title', 'body'] as const) {
                    const text = copy.steps[key][part]
                    const row = approved.split('\n').find(line => line.startsWith(`| \`${key}.${part}\` |`))!
                    expect(text).toBe(row.split('|').slice(2, 5).map(cell => cell.trim())[index])
                    if (language === 'en') expect(text.length).toBeLessThanOrEqual(part === 'title' ? 48 : 190)
                    else {
                        expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
                        expect(text.replace(/\{c:\w+\}/g, '')).not.toMatch(/[A-Za-z]/)
                    }
                }
            }
            for (const path of ['piece', 'salary'] as const) {
                const row = approved.split('\n').find(line => line.startsWith(`| \`paytype.${path}\` |`))!
                expect(copy.paths[path]).toBe(row.split('|').slice(2, 5).map(cell => cell.trim())[index])
            }
            expect(copy.steps.earnings.body).toContain('₹150')
            expect(copy.steps.joining.body).toContain('₹9,000')
        }
        expect(workersTutorialCopy.en.steps.paytype.body).toContain('cannot be changed after saving')
        expect(workersTutorialCopy.en.steps.changes.body).toContain('last working day before marking them inactive')
        expect(workersHelpSteps).toEqual(expect.arrayContaining(['shiftFilter', 'statusFilter', 'salaryRole', 'active']))
    })
    it('resolves both named controls through the same approved keys used by live controls', () => {
        const add = readFileSync('components/workers/WorkersPageHeader.tsx', 'utf8')
        const card = readFileSync('components/workers/WorkerCard.tsx', 'utf8')
        expect(add).toContain("t('workers.addWorker')")
        expect(add).toMatch(/<Button\s+data-tour-anchor="workers.add"/)
        expect(card).toContain("t('workers.viewPayroll')")
        for (const [index, language] of languages.entries()) {
            const t = (key: string) => dictionaries[language].workers[key.split('.')[1] as keyof typeof en.workers] as string
            const labels = workersTourControlLabels(t)
            expect(labels).toEqual({ addWorker: ['Add worker', 'કારીગર ઉમેરો', 'कारीगर जोड़ें'][index], viewPayroll: ['View payroll', 'પેરોલ જુઓ', 'पेरोल देखें'][index] })
            for (const step of Object.values(workersTutorialCopy[language].steps)) expect(formatTourText(step.body, labels)).not.toContain('{c:')
        }
    })
    it('uses worked amounts consistent with production snapshots and calendar-month salary rules', () => {
        const { meters, wage, periodStart, periodEnd } = workersTourExample
        expect(calculateBaseEntryGrossPay({ id: 'sample', meters, worker_rate_snapshot: wage, allocation_mode: 'worker_total' })).toBe(150)
        const salary = makeWorkersTourExamples()[1]
        expect(calculateBaseSalaryLines(salary, periodStart, periodEnd)).toMatchObject([{ days: 15, monthDays: 30, grossPay: 9000 }])
    })
    it('migrates to the shared lazy runtime with panel choices, a live handoff and per-launch reset', () => {
        const page = readFileSync('app/(dashboard)/owner/production/registers/WorkersRegister.tsx', 'utf8')
        expect(page).toContain("import('@/components/tours/GuidedTour')")
        expect(page).toContain('ssr: false')
        expect(page).toContain('extra={tourStep === \'wk-paytype\'')
        expect(page).toContain('aria-pressed={tourPath === path}')
        expect(page).toContain('data-tour-control={`path-${path}`}')
        expect(page).toMatch(/onLaunch=\{\(\) => \{[\s\S]*?setTourPath\('piece'\)\s+setTourStep\('wk-paytype'\)/)
        expect(page).toContain("const tourSampleActive = tourStep !== null && tourStep !== 'wk-handoff'")
        expect(page).toContain('tourSampleActive ? makeWorkersTourExamples(language) : []')
        expect(page).toContain('tourCommonCopy[language].sampleBanner')
        expect(page).toContain('launchScroll.current = { x: window.scrollX, y: window.scrollY }')
        expect(page).toContain("window.scrollTo({ left: launchScroll.current.x, top: launchScroll.current.y, behavior: 'instant' })")
        expect(page).toContain('[data-workers-tour-preview="true"] [data-slot="dialog-close"] { display: none; }')
        expect(existsSync('components/tours/WorkersTutorial.tsx')).toBe(false)
    })
    it('offers v2 only to owners on production plans without changing invitation policy', () => {
        expect(tourRegistry.workers).toMatchObject({ contentVersion: 'v2', invitationPolicyVersion: 'v1' })
        expect(isTourEligible('workers', 'base', 'owner')).toBe(true)
        for (const plan of ['premium', 'lite', 'free']) expect(isTourEligible('workers', plan, 'owner')).toBe(false)
        expect(isTourEligible('workers', 'base', 'supervisor')).toBe(false)
    })
})
