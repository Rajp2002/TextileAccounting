import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
    calculatePayrollStatutoryDeductions,
    extractPayrollStatutoryDeductionsFromItemization,
} from '../lib/payroll-statutory'
import {
    buildPayslipFilename,
    buildPayslipSettlementRows,
} from '../lib/generate-payslip'
import { calculatePieceRateGrossWages } from '../lib/payroll-read-models'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('Batch 15 payroll statutory consistency', () => {
    it('matches the settlement PF/ESI formula including the ESIC wage ceiling', () => {
        expect(calculatePayrollStatutoryDeductions(20_000, true)).toMatchObject({
            pfEmployee: 1800,
            esicEmployee: 150,
            pfBasis: 15_000,
            esicBasis: 20_000,
        })

        expect(calculatePayrollStatutoryDeductions(25_000, true)).toMatchObject({
            pfEmployee: 1800,
            esicEmployee: 0,
            pfBasis: 15_000,
            esicBasis: 0,
        })

        expect(calculatePayrollStatutoryDeductions(20_000, false)).toMatchObject({
            pfEmployee: 0,
            esicEmployee: 0,
        })
    })

    it('extracts statutory deductions from nested persisted and legacy optimistic itemization', () => {
        expect(extractPayrollStatutoryDeductionsFromItemization({
            pf: { employee: 1800 },
            esic: { employee: 150 },
        })).toEqual({ pfEmployee: 1800, esicEmployee: 150 })

        expect(extractPayrollStatutoryDeductionsFromItemization({
            employee_pf: 1200,
            employee_esic: 75,
        })).toEqual({ pfEmployee: 1200, esicEmployee: 75 })

        expect(extractPayrollStatutoryDeductionsFromItemization({
            employee_pf: 0,
            employee_esic: 0,
            pf: { employee: 1500 },
            esic: { employee: 112.5 },
        })).toEqual({ pfEmployee: 1500, esicEmployee: 112.5 })
    })
})

describe('Batch 15 payroll document/export consistency', () => {
    it('builds payslip rows with adjustments, statutory deductions, debt, and payment mode', () => {
        const rows = buildPayslipSettlementRows({
            grossPay: 20_000,
            advanceDeducted: 2000,
            remainingDebt: 500,
            netPay: 16_050,
            paymentMode: 'UPI',
            itemization: {
                inamTotal: 500,
                kapaatTotal: 250,
                advanceRecovery: 2000,
                pfEmployee: 1800,
                esicEmployee: 150,
                remainingDebt: 500,
                paymentMode: 'UPI',
            },
        })

        expect(rows.map((row) => row.label)).toEqual([
            'Gross Pay',
            'Inam Bonus',
            'Kapaat Deduction',
            'Advance Recovered',
            'PF Employee',
            'ESI Employee',
            'Net Pay',
            'Carry-Forward Debt',
            'Payment Mode',
        ])
        expect(rows.find((row) => row.label === 'PF Employee')?.value).toContain('1,800')
        expect(rows.find((row) => row.label === 'ESI Employee')?.value).toContain('150')
    })

    it('sanitizes payslip filenames without path or shell-hostile characters', () => {
        const filename = buildPayslipFilename('../Asha / Worker:*? <bad>|', '2026-06')

        expect(filename).toBe('payslip-Asha_Worker_bad-2026-06.pdf')
        expect(filename).toMatch(/^[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+-[a-zA-Z0-9_-]+\.pdf$/)
        expect(filename).not.toContain('/')
        expect(filename).not.toContain('..')
    })

    it('wires payroll page PDF and CSV paths through paid settlements and nested statutory reads', () => {
        const payrollPage = readProjectFile('app/(dashboard)/owner/payroll/PayrollClient.tsx')

        expect(payrollPage).toContain('disabled={!isPaid}')
        expect(payrollPage).toContain('Settle payroll first to download a payslip')
        expect(payrollPage).toContain('cycleStartDate: cycleBounds.cycle_start')
        expect(payrollPage).toContain('cycleEndDate: cycleBounds.cycle_end')
        expect(payrollPage).toContain('getItemizationStatutoryDeductions(settlement.itemization_payload)')
        expect(payrollPage).toContain('getItemizationStatutoryDeductions(selectedSettlement.itemization_payload)')
    })
})

describe('Batch 15 Factory Today payroll wage signal', () => {
    it('calculates gross wages from existing positive production log snapshots', () => {
        expect(calculatePieceRateGrossWages([
            { meters: 120.5, worker_rate_snapshot: 2.5 },
            { meters: '110.25', worker_rate_snapshot: '3' },
            { meters: -50, worker_rate_snapshot: 10 },
            { meters: 20, worker_rate_snapshot: null },
        ])).toBe(632)
    })

    it('uses the wage helper in the Factory Today read model', () => {
        const todayActions = readProjectFile('app/(dashboard)/owner/today/actions.ts')

        expect(todayActions).toContain("select('worker_id, meters, worker_rate_snapshot')")
        expect(todayActions).toContain('grossWagesSoFar: calculatePieceRateGrossWages(payrollWorkerLogsRes.data ?? [])')
    })
})
