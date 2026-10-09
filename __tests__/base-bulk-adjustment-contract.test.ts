import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BASE_PLAN_PHRASES } from '../lib/i18n/base-plan-phrases'
import { BULK_ADJUSTMENT_PHRASES } from '../lib/i18n/bulk-adjustment-phrases'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

const ACTIONS = 'app/(dashboard)/owner/production/actions.ts'
const CLIENT = 'app/(dashboard)/owner/production/BaseProductionClient.tsx'
const DIALOG = 'components/payroll/BulkAdjustmentDialog.tsx'

function functionBody(source: string, signature: string) {
    const start = source.indexOf(signature)
    expect(start, `${signature} exists`).toBeGreaterThan(-1)
    const next = source.indexOf('\nexport async function ', start + signature.length)
    return source.slice(start, next === -1 ? undefined : next)
}

function txPhrases(source: string) {
    return [...source.matchAll(/\btx\(\s*'((?:[^'\\]|\\.)*)'/g)].map(match => match[1].replace(/\\'/g, "'"))
}

describe('createBaseWorkerAdjustmentsBulk', () => {
    const actions = read(ACTIONS)
    const body = functionBody(actions, 'export async function createBaseWorkerAdjustmentsBulk')

    it('is owner gated like the single-worker actions', () => {
        expect(body).toContain('await requireBaseProductionOwner()')
    })

    it('validates the selection and the amount with zod before touching the database', () => {
        expect(actions).toContain('const BaseBulkAdjustmentSchema = z.object({')
        expect(actions).toMatch(/BaseBulkAdjustmentSchema = z\.object\(\{[\s\S]*?kind: z\.enum\(\['advance', 'deduction'\]\)/)
        expect(actions).toMatch(/BaseBulkAdjustmentSchema = z\.object\(\{[\s\S]*?workerIds: z\.array\(UuidSchema\)\.min\(1/)
        expect(body).toContain('safeParse(BaseBulkAdjustmentSchema, input)')
    })

    it('only accepts active workers of the signed-in org', () => {
        expect(body).toContain(".from('base_production_workers')")
        expect(body).toContain(".eq('org_id', profile.org_id)")
        expect(body).toContain('is_active')
    })

    it('writes every row in one insert so the bulk is all or nothing', () => {
        expect(body.match(/\.insert\(/g)).toHaveLength(1)
        expect(body).toContain(".from('base_worker_advances')")
        expect(body).not.toMatch(/for \(const[^)]*\)\s*\{[^}]*\.insert\(/)
        expect(body).not.toContain('Promise.all')
    })

    it('stores deductions in the format worker cards already read', () => {
        expect(body).toContain('buildDeductionDescription(')
        const single = functionBody(actions, 'export async function createBaseWorkerDeduction')
        expect(single).toContain('buildDeductionDescription(')
    })

    it('refreshes the payroll screens', () => {
        expect(body).toContain("revalidatePath('/owner/payroll')")
        expect(body).toContain("revalidatePath('/owner/production')")
    })
})

describe('Bulk advance / deduction pill', () => {
    const client = read(CLIENT)
    // The pay-period toolbar under the page header: period stepper, status, then the bulk pill.
    const toolbarStart = client.indexOf('data-payroll-tour="period" role="group" aria-label="Payroll period and settlement"')
    const toolbarEnd = client.indexOf("{view === 'payroll' && activeTab === 'history' && (", toolbarStart)
    const toolbar = client.slice(toolbarStart, toolbarEnd)

    it('sits in the pay-period toolbar under the header, after the period, hidden on the records tab', () => {
        expect(toolbarStart).toBeGreaterThan(-1)
        // The toolbar renders only on the pay tab with a period summary; Settle payroll is the header's primary action.
        expect(client.slice(client.lastIndexOf('{view === ', toolbarStart), toolbarStart)).toContain("activeTab !== 'history' && activePeriodSummary")
        const pill = toolbar.indexOf('data-payroll-bulk-pill')
        expect(pill).toBeGreaterThan(toolbar.indexOf('aria-label="Payroll period selector"'))
        expect(toolbar).toContain("tx('Bulk advance / deduction')")
        expect(toolbar).not.toContain('data-tour-anchor="payroll.settle"')
    })

    it('opens the dialog with the active workers and refreshes after saving', () => {
        expect(client).toContain("import { BulkAdjustmentDialog } from '@/components/payroll/BulkAdjustmentDialog'")
        expect(client).toContain('<BulkAdjustmentDialog')
        expect(client).toContain('workers={initialData.workers}')
        expect(client).toContain('router.refresh()')
    })

    it('does not leave the old reason list in the client', () => {
        expect(client).toContain("from '@/lib/base-bulk-adjustment'")
        expect(client).not.toContain('const DEDUCTION_REASONS = [')
    })
})

describe('BulkAdjustmentDialog', () => {
    const dialog = read(DIALOG)

    it('calls the bulk action once with the selected worker ids', () => {
        expect(dialog).toContain('createBaseWorkerAdjustmentsBulk')
        expect(dialog.match(/createBaseWorkerAdjustmentsBulk\(/g)).toHaveLength(1)
    })

    it('starts with every eligible worker selected', () => {
        expect(dialog).toContain('new Set(eligible.map(worker => worker.id))')
    })

    it('asks for confirmation with the total before writing', () => {
        expect(dialog).toContain('bulkAdjustmentTotal(')
        expect(dialog).toContain("step === 'confirm'")
    })

    it('offers the piece-rate and fixed-monthly group switches', () => {
        expect(dialog).toContain('toggleBulkGroup(')
        expect(dialog).toContain("'piece_rate'")
        expect(dialog).toContain("'fixed_monthly'")
    })

    it('keeps touch targets at 44px minimum on phones', () => {
        expect(dialog).toContain('min-h-[44px]')
        expect(dialog).not.toMatch(/min-h-11\b/)
    })
})

describe('Bulk adjustment Hindi and Gujarati', () => {
    // The pill label is the dialog title, so the dialog's phrases cover both.
    const used = [...new Set(txPhrases(read(DIALOG)))]

    it('finds the phrases the dialog uses', () => {
        expect(used).toContain('Bulk advance / deduction')
        expect(used.length).toBeGreaterThan(10)
    })

    for (const language of ['hi', 'gu'] as const) {
        it(`translates every phrase into ${language} and registers it for the Base surface`, () => {
            const own = BULK_ADJUSTMENT_PHRASES[language]
            for (const phrase of Object.keys(own)) {
                expect(own[phrase], `${language}: ${phrase}`).toBeTruthy()
                expect(BASE_PLAN_PHRASES[language][phrase], `${language} registered: ${phrase}`).toBe(own[phrase])
            }
            const missing = used.filter(phrase => !BASE_PLAN_PHRASES[language][phrase])
            expect(missing, `${language} missing`).toEqual([])
        })
    }
})
