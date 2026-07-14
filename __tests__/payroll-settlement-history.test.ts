import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function readProjectFile(path: string) {
    return readFileSync(join(root, path), 'utf8')
}

describe('payroll settlement history', () => {
    const payrollPage = readProjectFile('app/(dashboard)/owner/payroll/PayrollClient.tsx')

    it('adds a past settlement history dialog backed by payroll settlement snapshots', () => {
        expect(payrollPage).toContain('SettlementHistoryDialog')
        expect(payrollPage).toContain('Past settlements')
        expect(payrollPage).toContain("from('payroll_settlements')")
        expect(payrollPage).toContain("eq('status', 'paid')")
        expect(payrollPage).toContain('payroll_settlement_history')
    })

    it('resolves both meter and fixed worker names for audit history', () => {
        expect(payrollPage).toContain("from('workers').select('id, name')")
        expect(payrollPage).toContain("from('fixed_workers').select('id, name, role, monthly_salary')")
        expect(payrollPage).toContain('Open cycle')
    })

    it('supports date range CSV downloads for settlement audits', () => {
        expect(payrollPage).toContain('dateFrom')
        expect(payrollPage).toContain('dateTo')
        expect(payrollPage).toContain('buildSettlementCsv')
        expect(payrollPage).toContain('downloadCsv')
        expect(payrollPage).toContain('settlementExportFilename')
        expect(payrollPage).toContain('settlementExportCycleLabel')
        expect(payrollPage).toContain("`${filenamePart(factoryName, 'Factory')}_${cycleLabel}.csv`")
        expect(payrollPage).toContain('Hisaab Date')
    })

    it('shows detailed earning lines behind each settlement', () => {
        expect(payrollPage).toContain('Earnings overview')
        expect(payrollPage).toContain('Net revenue before deductions: meters produced x worker rate across machines.')
        expect(payrollPage).toContain('Net Revenue Before Deductions')
        expect(payrollPage).toContain('Total Metres')
        expect(payrollPage).toContain("from('production_logs')")
        expect(payrollPage).toContain('worker_rate_snapshot')
        expect(payrollPage).toContain('Earnings Lines')
    })
})
