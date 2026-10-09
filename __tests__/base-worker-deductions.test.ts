import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../lib/i18n/locales/en'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Base Worker Deductions', () => {
    it('defines BaseDeductionSchema and createBaseWorkerDeduction in actions.ts', () => {
        const actions = readProjectFile('app/(dashboard)/owner/production/actions.ts')

        expect(actions).toContain('const BaseDeductionSchema = z.object({')
        expect(actions).toContain("export async function createBaseWorkerDeduction(input: {")
        expect(actions).toContain(".from('base_worker_advances')")
        expect(actions).toContain('buildDeductionDescription(parsed.data.reason, parsed.data.description)')
        expect(actions).toContain("revalidatePath('/owner/payroll')")
    })

    it('renders Add deduction pill alongside Add advance on worker card in BaseProductionClient', () => {
        const client = readProjectFile('app/(dashboard)/owner/production/BaseProductionClient.tsx')

        // Both keyed controls keep the same English labels and action wiring.
        expect(client).toContain("t('payroll.addAdvance')")
        expect(en.payroll.addAdvance).toBe('Add advance')
        expect(client).toContain("t('payroll.addDeduction')")
        expect(en.payroll.addDeduction).toBe('Add deduction')
        expect(client).toContain('openDeduction(payable.worker_id)')
        expect(client).toContain('openAdvance(payable.worker_id)')

        // Preserves required baseline strings
        expect(client).toContain('No advance to recover. Full gross pay is due this period.')
    })

    it('includes Record worker deduction dialog with expected form controls and preset reasons', () => {
        const client = readProjectFile('app/(dashboard)/owner/production/BaseProductionClient.tsx')

        // Dialog elements
        expect(client).toContain('Record worker deduction')
        expect(client).toContain('base-deduction-worker')
        expect(client).toContain('base-deduction-reason')
        expect(client).toContain('base-deduction-amount')
        expect(client).toContain('base-deduction-description')

        // Factory-tailored reason options now live in lib/base-bulk-adjustment.ts, shared with the bulk dialog.
        const reasons = readProjectFile('lib/base-bulk-adjustment.ts')
        expect(client).toContain('DEDUCTION_REASONS')
        expect(reasons).toContain("'Mistake / Damage'")
        expect(reasons).toContain("'Water access / Utilities'")
        expect(reasons).toContain("'Penalty / Absence'")
        expect(reasons).toContain("'Mess / Canteen / Food'")
        expect(reasons).toContain("'Other'")

        // Form submit and server action wiring
        expect(client).toContain('handleDeductionSubmit')
        expect(client).toContain('createBaseWorkerDeduction')
    })

    it('displays pending deduction tags on worker cards when active', () => {
        const client = readProjectFile('app/(dashboard)/owner/production/BaseProductionClient.tsx')

        expect(client).toContain('pendingDeductions')
        expect(client).toContain('pendingAdvances')
        expect(client).toContain('[Deduction:')
    })

    it('includes createBaseWorkerDeduction in QA actions fixture', () => {
        const fixture = readProjectFile('scripts/qa/fixtures/base-continuity/actions.ts.txt')
        expect(fixture).toContain('export async function createBaseWorkerDeduction()')
    })
})
