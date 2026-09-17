import { describe, expect, it } from 'vitest'
import { makeWorkersTourExamples, workersHelpSteps, workersTourEditor, workersTourPaths, workersTourSteps, workersTourSelectors } from '../lib/workers-tour'
import { workersTutorialCopy } from '../lib/i18n/workers-tutorial'
import { getWorkerOperationalSummary } from '../lib/worker-operational'
import { isTourEligible } from '../lib/tours/tour-registry'
import { UuidSchema } from '../lib/schemas'
import { calculateBaseSalaryLines } from '../lib/base-salary'
import { calculateBaseEntryGrossPay } from '../lib/base-production-core'

describe('Workers guided tour', () => {
    it('provides independent, non-persistable examples of both pay types', () => {
        const examples = makeWorkersTourExamples('2026-09-16')
        expect(examples.map(worker => worker.pay_type)).toEqual(['piece_rate', 'fixed_monthly'])
        examples.forEach(worker => expect(UuidSchema.safeParse(worker.id).success).toBe(false))
        expect(examples[0]).toMatchObject({ assignedMachineCount: 2, rate_per_meter: 0 })
        expect(getWorkerOperationalSummary(examples[1])).toMatchObject({ hasSalaryConfigured: true, payrollStatusLabel: 'Ready' })
        examples[0].name = 'Modified'
        examples[1].salary_history![0].monthly_salary = 1
        expect(makeWorkersTourExamples('2026-09-16')[0].name).toBe('Sample worker')
        expect(makeWorkersTourExamples('2026-09-16')[1].salary_history![0].monthly_salary).toBe(18000)
    })
    it('opens previews for the selected pay path and closes them on register steps in both directions', () => {
        expect(workersTourPaths.piece).toHaveLength(7)
        expect(workersTourPaths.salary).toHaveLength(8)
        for (const path of ['piece', 'salary'] as const) {
            const steps = workersTourPaths[path]
            expect(steps[0]).toBe('purpose')
            expect(steps.at(-1)).toBe('finish')
            expect(workersTourEditor('payType', path)).toBe(path)
            for (const step of [...steps, ...[...steps].reverse()]) {
                const editor = workersTourEditor(step, path)
                if (step === 'payType') expect(editor).toBe(path)
                else if (step === 'availability') expect(editor).toBe('piece')
                else if (step === 'salary' || step === 'joining') expect(editor).toBe('salary')
                else if (step === 'effective' || step === 'lastDay') expect(editor).toBe('edit')
                else expect(editor).toBeNull()
            }
        }
    })
    it('keeps localized core consequences, maintenance help, path labels and targets complete', () => {
        for (const language of ['en', 'gu', 'hi'] as const) {
            const copy = workersTutorialCopy[language]
            expect(Object.keys(copy.fields).sort()).toEqual([...new Set([...workersTourSteps, ...workersHelpSteps])].sort())
            for (const step of workersTourSteps) expect(workersTourSelectors[step]).toBeTruthy()
            const strings = [...Object.values(copy.fields).flat(), ...Object.values(copy.paths), copy.helpTitle, copy.wageLabel, copy.wageSource, copy.qualityWage, copy.salaryBasis]
            for (const text of strings) {
                expect(text.trim().length).toBeGreaterThan(0)
                if (language !== 'en') expect(text).toMatch(language === 'gu' ? /[\u0a80-\u0aff]/ : /[\u0900-\u097f]/)
            }
            expect(copy.fields.earnings[1]).toContain('₹150')
            expect(copy.fields.joining[1]).toContain('₹9,000')
        }
        expect(workersTutorialCopy.en.fields.payType[1]).toContain('cannot be changed')
        expect(workersTutorialCopy.en.fields.pieceReadiness[1]).toContain('active quality')
        expect(workersTutorialCopy.en.fields.assignments[1]).toContain('Activate Quality → Assign Looms')
        expect(workersTourPaths.salary).toContain('lastDay')
        expect(workersHelpSteps).toEqual(expect.arrayContaining(['shiftFilter', 'statusFilter', 'salaryRole', 'active']))
    })
    it('uses worked amounts consistent with production snapshots and calendar-month salary rules', () => {
        expect(calculateBaseEntryGrossPay({ id: 'sample', meters: 100, worker_rate_snapshot: 1.5, allocation_mode: 'worker_total' })).toBe(150)
        const salary = makeWorkersTourExamples('2026-09-16')[1]
        expect(calculateBaseSalaryLines(salary, '2026-09-01', '2026-09-30')).toMatchObject([{ days: 15, monthDays: 30, grossPay: 9000 }])
    })
    it('offers the tour only to owners on production plans', () => {
        expect(isTourEligible('workers', 'base', 'owner')).toBe(true)
        expect(isTourEligible('workers', 'premium', 'owner')).toBe(true)
        expect(isTourEligible('workers', 'lite', 'owner')).toBe(false)
        expect(isTourEligible('workers', 'free', 'owner')).toBe(false)
        expect(isTourEligible('workers', 'base', 'supervisor')).toBe(false)
    })
})
