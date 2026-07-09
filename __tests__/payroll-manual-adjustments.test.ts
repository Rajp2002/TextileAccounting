import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    calculatePayrollFinalizationPreview,
    calculatePayrollManualAdjustmentTotals,
    sanitizePayrollManualAdjustment,
    type PayrollManualAdjustment,
} from '../lib/payroll-manual-adjustments'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

const inam = (amount: number, note = 'Owner approved extra work'): PayrollManualAdjustment => ({
    adjustment_type: 'inam',
    reason: 'Extra work',
    amount,
    note,
})

const kapaat = (amount: number, note = 'Owner approved quality deduction'): PayrollManualAdjustment => ({
    adjustment_type: 'kapaat',
    reason: 'Quality issue',
    amount,
    note,
})

describe('Payroll manual adjustment calculations', () => {
    it('inam increases payout', () => {
        const preview = calculatePayrollFinalizationPreview({
            baseEarnings: 1000,
            adjustments: [inam(250)],
            advanceRecovery: 0,
            existingDebt: 0,
        })

        expect(preview.finalPayout).toBe(1250)
        expect(preview.inamTotal).toBe(250)
    })

    it('kapaat decreases payout', () => {
        const preview = calculatePayrollFinalizationPreview({
            baseEarnings: 1000,
            adjustments: [kapaat(150)],
            advanceRecovery: 0,
            existingDebt: 0,
        })

        expect(preview.finalPayout).toBe(850)
        expect(preview.kapaatTotal).toBe(150)
    })

    it('multiple adjustments calculate correctly', () => {
        expect(calculatePayrollManualAdjustmentTotals([
            inam(250),
            inam(50),
            kapaat(125),
        ])).toEqual({
            inamTotal: 300,
            kapaatTotal: 125,
            manualAdjustmentTotal: 175,
        })
    })

    it('kapaat cannot make payout negative', () => {
        const preview = calculatePayrollFinalizationPreview({
            baseEarnings: 500,
            adjustments: [kapaat(600)],
            advanceRecovery: 0,
            existingDebt: 0,
        })

        expect(preview.finalPayout).toBe(-100)
        expect(preview.canConfirm).toBe(false)
    })

    it('advance recovery remains separate from kapaat', () => {
        const preview = calculatePayrollFinalizationPreview({
            baseEarnings: 1000,
            adjustments: [kapaat(100)],
            advanceRecovery: 200,
            existingDebt: 500,
        })

        expect(preview.kapaatTotal).toBe(100)
        expect(preview.advanceRecovery).toBe(200)
        expect(preview.finalPayout).toBe(700)
    })

    it('manual adjustments do not affect remaining debt', () => {
        const withoutAdjustment = calculatePayrollFinalizationPreview({
            baseEarnings: 1000,
            adjustments: [],
            advanceRecovery: 200,
            existingDebt: 500,
        })
        const withAdjustment = calculatePayrollFinalizationPreview({
            baseEarnings: 1000,
            adjustments: [inam(300), kapaat(100)],
            advanceRecovery: 200,
            existingDebt: 500,
        })

        expect(withoutAdjustment.remainingDebt).toBe(300)
        expect(withAdjustment.remainingDebt).toBe(300)
    })

    it('final settlement can recover full debt when owner chooses full advance recovery', () => {
        const preview = calculatePayrollFinalizationPreview({
            baseEarnings: 1000,
            adjustments: [],
            advanceRecovery: 500,
            existingDebt: 500,
        })

        expect(preview.finalPayout).toBe(500)
        expect(preview.remainingDebt).toBe(0)
        expect(preview.canConfirm).toBe(true)
    })
})

describe('Payroll manual adjustment validation', () => {
    it('note is required', () => {
        expect(sanitizePayrollManualAdjustment({
            adjustment_type: 'inam',
            reason: 'Extra work',
            amount: 100,
            note: '   ',
        })).toEqual({ success: false, error: 'Note is required.' })
    })

    it('reason is required', () => {
        expect(sanitizePayrollManualAdjustment({
            adjustment_type: 'inam',
            reason: '',
            amount: 100,
            note: 'Helped with urgent market run',
        })).toEqual({ success: false, error: 'Reason is required.' })
    })

    it('amount must be positive', () => {
        expect(sanitizePayrollManualAdjustment({
            adjustment_type: 'kapaat',
            reason: 'Damage',
            amount: 0,
            note: 'Damaged beam noted by owner',
        })).toEqual({ success: false, error: 'Amount must be greater than 0.' })
    })
})

describe('Payroll manual adjustment persistence guards', () => {
    const actionSource = readProjectFile('app/(dashboard)/owner/payroll/actions.ts')
    const pageSource = readProjectFile('app/(dashboard)/owner/payroll/PayrollClient.tsx')
    const migrationSource = readProjectFile('supabase/migrations/20260516160000_payroll_manual_adjustments.sql')

    it('payroll confirmation saves adjustment snapshot and details', () => {
        expect(actionSource).toContain('p_manual_adjustments: parsedAdjustments.data')
        expect(migrationSource).toContain('manual_adjustments')
        expect(migrationSource).toContain('baseEarnings')
        expect(migrationSource).toContain('inamTotal')
        expect(migrationSource).toContain('kapaatTotal')
        expect(migrationSource).toContain('manualAdjustmentTotal')
        expect(migrationSource).toContain('finalPayout')
        expect(migrationSource).toContain('remainingDebt')
        expect(migrationSource).toContain('payroll.manual_adjustment')
    })

    it('payment method and verification checkbox are still required', () => {
        expect(actionSource).toContain('Payment mode is required.')
        expect(actionSource).toContain('Owner verification is required before confirming payroll.')
        expect(pageSource).toContain('I verify calculations are correct')
        expect(pageSource).toContain('disabled={!confirmed || isMutating || netPayout < 0 || !paymentMode}')
    })
})
