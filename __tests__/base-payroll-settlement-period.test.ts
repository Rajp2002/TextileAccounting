import { describe, expect, it } from 'vitest'

import {
    calculateBasePayrollPeriodSummary,
    getMonthPayrollBounds,
    getAdjacentMonthKey,
    type BasePayrollPeriod,
    type BaseWorkerPayable,
} from '../lib/base-production-core'
import { buildBasePayrollHistory } from '../lib/base-payroll-history'

describe('Base Payroll Settlement Period Workflow', () => {
    describe('Date Helpers: getMonthPayrollBounds & getAdjacentMonthKey', () => {
        it('calculates exact monthly payroll bounds for 30-day months', () => {
            const bounds = getMonthPayrollBounds('2026-09-15')
            expect(bounds.start).toBe('2026-09-01')
            expect(bounds.end).toBe('2026-09-30')
            expect(bounds.monthKey).toBe('2026-09')
        })

        it('calculates exact monthly payroll bounds for 31-day months', () => {
            const bounds = getMonthPayrollBounds('2026-08-01')
            expect(bounds.start).toBe('2026-08-01')
            expect(bounds.end).toBe('2026-08-31')
            expect(bounds.monthKey).toBe('2026-08')
        })

        it('calculates exact monthly payroll bounds for February in a non-leap year', () => {
            const bounds = getMonthPayrollBounds('2026-02-10')
            expect(bounds.start).toBe('2026-02-01')
            expect(bounds.end).toBe('2026-02-28')
            expect(bounds.monthKey).toBe('2026-02')
        })

        it('navigates forward and backward across calendar months, including year boundaries', () => {
            expect(getAdjacentMonthKey('2026-09', 1)).toBe('2026-10')
            expect(getAdjacentMonthKey('2026-09', -1)).toBe('2026-08')
            expect(getAdjacentMonthKey('2026-12', 1)).toBe('2027-01')
            expect(getAdjacentMonthKey('2026-01', -1)).toBe('2025-12')
        })
    })

    describe('calculateBasePayrollPeriodSummary State Machine', () => {
        const pieceRateWorker: BaseWorkerPayable = {
            worker_id: 'worker-weaver-1',
            worker_name: 'Mahesh Weaver',
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            meters: 1200,
            gross_pay: 8400,
            pending_advance: 2000,
            advance_recovery: 2000,
            max_advance_recovery: 4200,
            remaining_debt: 0,
            net_payout: 6400,
            status: 'unsettled',
            settlement_id: null,
            paid_at: null,
            pay_type: 'piece_rate',
        }

        const fixedSalaryWorker: BaseWorkerPayable = {
            worker_id: 'worker-master-1',
            worker_name: 'Suresh Jobber',
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            meters: 0,
            gross_pay: 25000,
            pending_advance: 0,
            advance_recovery: 0,
            max_advance_recovery: 12500,
            remaining_debt: 0,
            net_payout: 25000,
            status: 'unsettled',
            settlement_id: null,
            paid_at: null,
            pay_type: 'fixed_monthly',
        }

        const zeroEarningWorker: BaseWorkerPayable = {
            worker_id: 'worker-absent-1',
            worker_name: 'Dinesh Inactive',
            period_start: '2026-09-01',
            period_end: '2026-09-30',
            meters: 0,
            gross_pay: 0,
            pending_advance: 0,
            advance_recovery: 0,
            max_advance_recovery: 0,
            remaining_debt: 0,
            net_payout: 0,
            status: 'unsettled',
            settlement_id: null,
            paid_at: null,
            pay_type: 'piece_rate',
        }

        it('returns OPEN status when no workers have been paid yet', () => {
            const payables = [pieceRateWorker, fixedSalaryWorker, zeroEarningWorker]
            const summary = calculateBasePayrollPeriodSummary({
                payables,
            })

            expect(summary.status).toBe('open')
            expect(summary.totalGross).toBe(33400) // 8400 + 25000 + 0
            expect(summary.totalRecovery).toBe(2000)
            expect(summary.totalNet).toBe(31400) // 6400 + 25000
            expect(summary.totalPaid).toBe(0)
            expect(summary.totalRemaining).toBe(31400)
            expect(summary.totalWorkers).toBe(3)
            expect(summary.paidWorkers).toBe(0)
            expect(summary.outstandingWorkers).toBe(3)
            expect(summary.progressPercent).toBe(0)
        })

        it('transitions to IN_PROGRESS and updates live remaining when some workers are paid', () => {
            const paidPieceWorker: BaseWorkerPayable = {
                ...pieceRateWorker,
                status: 'paid',
                payment_mode: 'cash',
                paid_at: '2026-09-30T10:00:00.000Z',
            }

            const payables = [paidPieceWorker, fixedSalaryWorker, zeroEarningWorker]
            const summary = calculateBasePayrollPeriodSummary({
                payables,
            })

            expect(summary.status).toBe('in_progress')
            expect(summary.totalPaid).toBe(6400)
            expect(summary.totalRemaining).toBe(25000) // only Suresh remains
            expect(summary.paidWorkers).toBe(1)
            expect(summary.outstandingWorkers).toBe(2)
            expect(summary.progressPercent).toBe(33) // 1 of 3 resolved
        })

        it('counts resolved zero-pay workers so the period can reach READY_TO_COMPLETE', () => {
            const paidPieceWorker: BaseWorkerPayable = {
                ...pieceRateWorker,
                status: 'paid',
                payment_mode: 'bank_transfer',
            }
            const paidSalaryWorker: BaseWorkerPayable = {
                ...fixedSalaryWorker,
                status: 'paid',
                payment_mode: 'upi',
            }

            // Without zeroEarningWorker resolved: still has 1 outstanding worker
            const payablesUnresolved = [paidPieceWorker, paidSalaryWorker, zeroEarningWorker]
            const summaryUnresolved = calculateBasePayrollPeriodSummary({
                payables: payablesUnresolved,
            })
            expect(summaryUnresolved.status).toBe('in_progress')
            expect(summaryUnresolved.totalRemaining).toBe(0) // no money left, but worker unresolved
            expect(summaryUnresolved.outstandingWorkers).toBe(1)

            // With zeroEarningWorker explicitly resolved in periodRecord
            const periodRecord: BasePayrollPeriod = {
                id: 'period-sept-2026',
                org_id: 'org-test',
                period_start: '2026-09-01',
                period_end: '2026-09-30',
                status: 'in_progress',
                total_gross: 33400,
                total_recovery: 2000,
                total_net: 31400,
                total_workers: 3,
                paid_workers: 2,
                settled_at: null,
                settled_by: null,
                calculation_snapshot: null,
                resolved_worker_ids: ['worker-absent-1'],
                notes: null,
                created_at: '2026-09-01T00:00:00.000Z',
                updated_at: '2026-09-30T10:00:00.000Z',
            }

            const summaryResolved = calculateBasePayrollPeriodSummary({
                payables: payablesUnresolved,
                periodRecord,
            })

            expect(summaryResolved.status).toBe('ready_to_complete')
            expect(summaryResolved.paidWorkers).toBe(2)
            expect(summaryResolved.resolvedWorkers).toBe(1)
            expect(summaryResolved.outstandingWorkers).toBe(0)
            expect(summaryResolved.progressPercent).toBe(100)
        })

        it('preserves immutable snapshot numbers when period is SETTLED', () => {
            const historicalSnapshot = {
                total_gross: 40000,
                total_recovery: 3000,
                total_net: 37000,
                total_workers: 4,
                paid_workers: 4,
                payables: [
                    { worker_id: 'w1', worker_name: 'Past Worker 1', gross_pay: 20000, net_payout: 18500 },
                    { worker_id: 'w2', worker_name: 'Past Worker 2', gross_pay: 20000, net_payout: 18500 },
                ],
            }

            const settledPeriodRecord: BasePayrollPeriod = {
                id: 'period-aug-2026',
                org_id: 'org-test',
                period_start: '2026-08-01',
                period_end: '2026-08-31',
                status: 'settled',
                total_gross: 40000,
                total_recovery: 3000,
                total_net: 37000,
                total_workers: 4,
                paid_workers: 4,
                settled_at: '2026-08-31T18:00:00.000Z',
                settled_by: 'user-owner',
                calculation_snapshot: historicalSnapshot,
                resolved_worker_ids: [],
                notes: 'August completed run',
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-31T18:00:00.000Z',
            }

            // Even if live payables passed are completely different (or empty):
            const summary = calculateBasePayrollPeriodSummary({
                payables: [], // empty live payables
                periodRecord: settledPeriodRecord,
            })

            expect(summary.status).toBe('settled')
            expect(summary.totalGross).toBe(40000)
            expect(summary.totalRecovery).toBe(3000)
            expect(summary.totalNet).toBe(37000)
            expect(summary.totalPaid).toBe(37000)
            expect(summary.totalRemaining).toBe(0)
            expect(summary.totalWorkers).toBe(4)
            expect(summary.paidWorkers).toBe(4)
            expect(summary.outstandingWorkers).toBe(0)
            expect(summary.progressPercent).toBe(100)
            expect(summary.settledAt).toBe('2026-08-31T18:00:00.000Z')
        })

        it('correctly handles advance recovery capping at 50% of gross pay in period calculations', () => {
            const heavyDebtWorker: BaseWorkerPayable = {
                worker_id: 'worker-debtor',
                worker_name: 'Kishore Weaver',
                period_start: '2026-09-01',
                period_end: '2026-09-30',
                meters: 1000,
                gross_pay: 6000,
                pending_advance: 10000,
                advance_recovery: 3000, // strictly capped at 50% of 6000
                max_advance_recovery: 3000,
                remaining_debt: 7000, // 7000 carries forward
                net_payout: 3000,
                status: 'unsettled',
                settlement_id: null,
                paid_at: null,
                pay_type: 'piece_rate',
            }

            const summary = calculateBasePayrollPeriodSummary({
                payables: [heavyDebtWorker],
            })

            expect(summary.totalGross).toBe(6000)
            expect(summary.totalRecovery).toBe(3000)
            expect(summary.totalNet).toBe(3000)
            expect(summary.totalRemaining).toBe(3000)
        })
    })

    describe('buildBasePayrollHistory with Period Records Integration', () => {
        it('marks settled status and links periodRecord to historical period cards', () => {
            const settlements = [
                {
                    id: 'settlement-1',
                    worker_id: 'w1',
                    worker_name_snapshot: 'Ramesh',
                    period_start: '2026-08-01',
                    period_end: '2026-08-31',
                    gross_pay: 10000,
                    advance_balance_before: 0,
                    advance_deducted: 0,
                    remaining_advance_balance: 0,
                    net_payout: 10000,
                    payment_mode: 'cash' as const,
                    paid_at: '2026-08-31T12:00:00.000Z',
                },
            ]

            const periodRecord: BasePayrollPeriod = {
                id: 'period-aug-2026',
                org_id: 'org-test',
                period_start: '2026-08-01',
                period_end: '2026-08-31',
                status: 'settled',
                total_gross: 10000,
                total_recovery: 0,
                total_net: 10000,
                total_workers: 1,
                paid_workers: 1,
                settled_at: '2026-08-31T12:30:00.000Z',
                settled_by: 'user-owner',
                calculation_snapshot: { total_net: 10000 },
                resolved_worker_ids: [],
                notes: null,
                created_at: '2026-08-01T00:00:00.000Z',
                updated_at: '2026-08-31T12:30:00.000Z',
            }

            const periods = buildBasePayrollHistory(settlements, [], [periodRecord])
            expect(periods).toHaveLength(1)
            const period = periods[0]
            expect(period.isSettled).toBe(true)
            expect(period.status).toBe('settled')
            expect(period.settledAt).toBe('2026-08-31T12:30:00.000Z')
            expect(period.periodRecord?.id).toBe('period-aug-2026')
        })
    })
})
