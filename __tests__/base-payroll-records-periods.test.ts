import { describe, expect, it } from 'vitest'

import { buildBasePayrollHistory, buildBasePayrollHistoryCsv } from '../lib/base-payroll-history'
import type { BasePayrollPeriod, BasePayrollSettlement } from '../lib/base-production-core'
import { DEFAULT_MONTHLY_CYCLE_RULE, formatPayrollPeriodLabel, type PayrollCycleRule } from '../lib/payroll-cycle-engine'

function payment(id: string, worker: string, start: string, end: string, paidAt = `${end}T12:00:00.000Z`, net = 1_000): BasePayrollSettlement {
    return {
        id, worker_id: `worker-${worker}`, worker_name_snapshot: worker, period_start: start, period_end: end,
        gross_pay: net, advance_balance_before: 0, advance_deducted: 0, remaining_advance_balance: 0,
        net_payout: net, payment_mode: 'cash', paid_at: paidAt,
    }
}

function completedPeriod(start: string, end: string): BasePayrollPeriod {
    return {
        id: `period-${start}`, period_start: start, period_end: end, status: 'settled', total_gross: 0, total_recovery: 0,
        total_net: 0, total_workers: 0, paid_workers: 0, settled_at: `${end}T18:00:00.000Z`, settled_by: 'owner', calculation_snapshot: null,
    }
}

describe('payroll records grouped by pay cycle', () => {
    it('files a mid-month cut-off and the month-end payment under one calendar month', () => {
        const periods = buildBasePayrollHistory([
            payment('early', 'Mahesh', '2026-09-15', '2026-09-19'),
            payment('late', 'Mahesh', '2026-09-20', '2026-09-30'),
            payment('full', 'Ramesh', '2026-09-01', '2026-09-30'),
        ], [], [], DEFAULT_MONTHLY_CYCLE_RULE)

        expect(periods.map(period => period.key)).toEqual(['2026-09-01:2026-09-30'])
        expect(periods[0]).toMatchObject({ start: '2026-09-01', end: '2026-09-30', totalNetPayout: 3_000 })
        expect(periods[0].workers.map(worker => worker.settlementId)).toEqual(['early', 'late', 'full'])
    })

    it('keeps each payment’s own covered dates, including carried-over work', () => {
        const [september] = buildBasePayrollHistory([payment('carried', 'Suresh', '2026-08-20', '2026-09-30')], [], [], DEFAULT_MONTHLY_CYCLE_RULE)

        expect(september.key).toBe('2026-09-01:2026-09-30')
        expect(september.workers[0]).toMatchObject({ coverStart: '2026-08-20', coverEnd: '2026-09-30' })
    })

    it('exports the pay period and each payment’s covered dates in the CSV', () => {
        const [september] = buildBasePayrollHistory([payment('carried', 'Suresh', '2026-08-20', '2026-09-30')], [], [], DEFAULT_MONTHLY_CYCLE_RULE)
        const [header, row] = buildBasePayrollHistoryCsv(september).split('\n')

        expect(header.split(',').slice(0, 2)).toEqual(['Period Start', 'Period End'])
        expect(header.split(',').slice(-2)).toEqual(['Work Covered From', 'Work Covered To'])
        expect(row.split(',').slice(0, 2)).toEqual(['2026-09-01', '2026-09-30'])
        expect(row.split(',').slice(-2)).toEqual(['2026-08-20', '2026-09-30'])
    })

    it('uses a completed period’s stored dates before the current cycle rule', () => {
        const periods = buildBasePayrollHistory(
            [payment('old-cycle', 'Ramesh', '2026-08-26', '2026-09-20')],
            [],
            [completedPeriod('2026-08-26', '2026-09-25')],
            DEFAULT_MONTHLY_CYCLE_RULE,
        )

        expect(periods.map(period => period.key)).toEqual(['2026-08-26:2026-09-25'])
        expect(periods[0].workers).toHaveLength(1)
        expect(periods[0].isSettled).toBe(true)
    })

    it('steps by week for a weekly cycle and lists the newest period first', () => {
        const weekly: PayrollCycleRule = { type: 'weekly', anchorWeekday: 'monday' }
        const periods = buildBasePayrollHistory([
            payment('wed', 'Mahesh', '2026-09-14', '2026-09-16'),
            payment('sun', 'Ramesh', '2026-09-14', '2026-09-20'),
            payment('next', 'Ramesh', '2026-09-21', '2026-09-22'),
        ], [], [], weekly)

        expect(periods.map(period => period.key)).toEqual(['2026-09-21:2026-09-27', '2026-09-14:2026-09-20'])
        expect(periods[1].workers.map(worker => worker.settlementId)).toEqual(['wed', 'sun'])
    })
})

describe('payroll period label', () => {
    it.each([
        ['2026-09-01', '2026-09-30', 'September 2026'],
        ['2026-02-01', '2026-02-28', 'February 2026'],
        ['2026-08-26', '2026-09-25', '26 Aug – 25 Sep 2026'],
        ['2026-09-14', '2026-09-20', '14 – 20 Sep 2026'],
        ['2026-09-01', '2026-09-15', '1 – 15 Sep 2026'],
        ['2025-12-29', '2026-01-04', '29 Dec 2025 – 4 Jan 2026'],
    ])('labels %s to %s as %s', (start, end, label) => {
        expect(formatPayrollPeriodLabel(start, end)).toBe(label)
    })
})
