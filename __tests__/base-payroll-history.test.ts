import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { en } from '../lib/i18n/locales/en'

import { buildBasePayrollHistory, buildBasePayrollHistoryCsv } from '../lib/base-payroll-history'
import type { BasePayrollSettlement, BasePayrollSettlementLine } from '../lib/base-production-core'

const settlements: BasePayrollSettlement[] = [
    {
        id: 'settlement-ramesh',
        worker_id: 'worker-ramesh',
        worker_name_snapshot: 'Ramesh',
        period_start: '2026-08-01',
        period_end: '2026-08-30',
        gross_pay: 1_350,
        advance_balance_before: 500,
        advance_deducted: 500,
        remaining_advance_balance: 0,
        net_payout: 850,
        payment_mode: 'cash',
        paid_at: '2026-08-30T09:00:00.000Z',
    },
    {
        id: 'settlement-ramu',
        worker_id: 'worker-ramu',
        worker_name_snapshot: 'Ramu',
        period_start: '2026-08-01',
        period_end: '2026-08-30',
        gross_pay: 500,
        advance_balance_before: 0,
        advance_deducted: 0,
        remaining_advance_balance: 0,
        net_payout: 500,
        payment_mode: 'upi',
        paid_at: '2026-08-30T10:00:00.000Z',
    },
]

const lines: BasePayrollSettlementLine[] = [
    {
        id: 'line-1', settlement_id: 'settlement-ramesh', worker_id: 'worker-ramesh',
        production_date: '2026-08-02', shift: 'day', machine_id: 'loom-1', machine_label: 'Loom #1',
        job_id: 'job-a', costing_label: 'Cotton Navy', meters: 100, worker_rate_snapshot: 6.75,
        gross_pay: 675, source_kind: 'machine_allocation',
    },
    {
        id: 'line-2', settlement_id: 'settlement-ramesh', worker_id: 'worker-ramesh',
        production_date: '2026-08-03', shift: 'day', machine_id: 'loom-1', machine_label: 'Loom #1',
        job_id: 'job-a', costing_label: 'Cotton Navy', meters: 100, worker_rate_snapshot: 6.75,
        gross_pay: 675, source_kind: 'machine_allocation',
    },
    {
        id: 'line-3', settlement_id: 'settlement-ramu', worker_id: 'worker-ramu',
        production_date: '2026-08-04', shift: 'night', machine_id: 'loom-1', machine_label: 'Loom #1',
        job_id: 'job-b', costing_label: 'Grey Twill', meters: 100, worker_rate_snapshot: 5,
        gross_pay: 500, source_kind: 'machine_allocation',
    },
]

describe('Base payroll records', () => {
    it('rolls worker earning lines up by machine, costing, and snapshotted weaver rate', () => {
        const [period] = buildBasePayrollHistory(settlements, lines)

        expect(period.totalMeters).toBe(300)
        expect(period.totalGrossPay).toBe(1_850)
        expect(period.totalAdvanceRecovered).toBe(500)
        expect(period.totalNetPayout).toBe(1_350)
        expect(period.workers[0].earnings).toEqual([expect.objectContaining({
            machineLabel: 'Loom #1', costingLabel: 'Cotton Navy', rate: 6.75, meters: 200, grossPay: 1_350,
        })])
        expect(period.machines[0]).toEqual(expect.objectContaining({
            machineLabel: 'Loom #1', meters: 300, grossPay: 1_850, workerCount: 2, costingCount: 2,
        }))
    })

    it('exports detailed machine and advance columns', () => {
        const csv = buildBasePayrollHistoryCsv(buildBasePayrollHistory(settlements, lines)[0])

        expect(csv).toContain('Rate Unit')
        expect(csv).toContain('per metre')
        expect(csv).toContain('Advance Balance Before')
        expect(csv).toContain('Ramesh,Loom #1,Cotton Navy,6.75,200,1350')
    })

    it('retains reversed receipts for audit without inflating active totals or machine pay', () => {
        const reversed = { ...settlements[0], status: 'reversed' as const, reversal_reason: '=unsafe spreadsheet formula' }
        const [period] = buildBasePayrollHistory([reversed, settlements[1]], lines)
        expect(period.workers).toHaveLength(2)
        expect(period.totalGrossPay).toBe(500)
        expect(period.totalNetPayout).toBe(500)
        expect(period.totalAdvanceRecovered).toBe(0)
        expect(period.machines[0].grossPay).toBe(500)
        expect(period.paymentModes).toEqual(['upi'])
        const csv = buildBasePayrollHistoryCsv(period)
        expect(csv).toContain('Record Status,Reversal Reason')
        expect(csv).toContain("reversed,'=unsafe spreadsheet formula")
        expect(period.workers.find(worker => worker.status === 'reversed')?.grossPay).toBe(1350)
    })

    it('places a comprehensive records control on Base payroll', () => {
        const root = process.cwd()
        const client = readFileSync(join(root, 'app/(dashboard)/owner/production/BaseProductionClient.tsx'), 'utf8')
        const records = readFileSync(join(root, 'app/(dashboard)/owner/production/BasePayrollRecords.tsx'), 'utf8')
        const migration = readFileSync(join(root, 'supabase/migrations/20260830130000_add_base_payroll_history_snapshots.sql'), 'utf8')

        expect(client).toContain("t('payroll.payrollRecords')")
        expect(en.payroll.payrollRecords).toBe('Payroll records')
        expect(records).toContain("t('payroll.exportCsv')")
        expect(en.payroll.exportCsv).toBe('Export CSV')
        expect(records).toContain("t('payroll.exportPdf')")
        expect(en.payroll.exportPdf).toBe('Export PDF')
        expect(records).toContain("t('payroll.recordDetails.cumulativeWorkerTotal')")
        expect(en.payroll.recordDetails.cumulativeWorkerTotal).toBe('Cumulative worker total')
        expect(records).toContain('Period production')
        expect(migration).toContain('base_payroll_settlement_lines')
        expect(migration).toContain('worker_rate_snapshot')
    })
})
