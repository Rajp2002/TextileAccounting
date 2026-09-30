import { describe, expect, it } from 'vitest'
import { calculateBasePayrollPeriodSummary, calculateBaseWorkerPayables, type BaseProductionWorker, type BaseWorkerIncentive, type BasePayrollSettlement, type BasePayrollSettlementLine } from '../lib/base-production-core'
import { basePayrollReview } from '../lib/base-payroll-review'
import { buildBasePayrollReadiness } from '../lib/base-payroll-readiness'
import { buildBasePayrollHistory, buildBasePayrollHistoryCsv } from '../lib/base-payroll-history'
import { normalizePayrollPdfData } from '../lib/generate-base-payroll-pdf'

const worker: BaseProductionWorker = { id: 'worker', name: 'Ramesh', pay_type: 'fixed_monthly', rate_per_meter: 0,
    monthly_salary: 18000, salary_history: [{ effective_from: '2026-09-01', monthly_salary: 18000 }],
    start_date: '2026-09-01', is_active: true, shift_availability: 'both' }
const incentive: BaseWorkerIncentive = { id: 'incentive', worker_id: worker.id, service_start: '2026-09-01', service_end: '2026-09-30',
    amount: 250.25, evidence_reference: 'Accountant worksheet 7', status: 'approved', approved_by: 'owner',
    approved_at: '2026-09-30T10:00:00Z', updated_at: '2026-09-30T10:00:00Z' }
function preview(incentives: BaseWorkerIncentive[], options: { worker?: BaseProductionWorker; end?: string; settlements?: BasePayrollSettlement[] } = {}) {
    return calculateBaseWorkerPayables({ workers: [options.worker ?? worker], entries: [], incentives,
        advances: [{ id: 'advance', worker_id: worker.id, amount: 20000, recovered_amount: 0, description: null, status: 'pending', created_at: '' }],
        settlements: options.settlements ?? [], periodEnd: options.end ?? '2026-09-30' })[0]
}
describe('Manual incentive preview', () => {
    it('adds approved positive earnings once, before existing advance recovery', () => {
        expect(preview([incentive])).toMatchObject({ base_pay: 18000, incentive_pay: 250.25, gross_pay: 18250.25, advance_recovery: 9125.13, net_payout: 9125.12, incentive_review_ids: [] })
        expect(basePayrollReview(preview([incentive]), 'request')).toMatchObject({
            incentive_pay: 250.25, incentives: [{ id: incentive.id, amount: 250.25, updated_at: incentive.updated_at }],
        })
    })
    it('blocks drafts, invalid approvals and incomplete service windows rather than paying an approximation', () => {
        for (const item of [{ ...incentive, status: 'draft' as const }, { ...incentive, approved_by: null }]) {
            const payable = preview([item])
            expect(payable.incentive_pay).toBe(0)
            expect(buildBasePayrollReadiness({ payables: [payable], entries: [], allocations: [] })).toMatchObject({ readyWorkerCount: 0, issueCount: 1 })
        }
        expect(preview([incentive], { end: '2026-09-15' })).toMatchObject({ incentive_pay: 0, incentive_review_ids: [incentive.id] })
        expect(preview([{ ...incentive, status: 'voided' }])).toMatchObject({ incentive_pay: 0, incentive_review_ids: [] })
        const zeroPiece = preview([{ ...incentive, status: 'draft' }], { worker: { ...worker, pay_type: 'piece_rate' } })
        expect(calculateBasePayrollPeriodSummary({ payables: [zeroPiece], resolvedWorkerIds: [worker.id] })).toMatchObject({ status: 'open', outstandingWorkers: 1, resolvedWorkers: 0 })
    })
    it('includes old unpaid piece incentives and keeps paid components out of later periods', () => {
        const piece = { ...worker, pay_type: 'piece_rate' as const, start_date: undefined }
        const old = { ...incentive, service_start: '2026-08-01', service_end: '2026-08-31' }
        expect(preview([old], { worker: piece })).toMatchObject({ period_start: '2026-08-01', base_pay: 0, gross_pay: 250.25 })
        expect(preview([{ ...incentive, settlement_id: 'paid' }])).toMatchObject({ incentive_pay: 0 })
    })
    it('uses frozen paid totals and restores a reversed entitlement for fresh review', () => {
        const settlement: BasePayrollSettlement = { id: 'paid', worker_id: worker.id, period_start: '2026-09-01', period_end: '2026-09-30',
            gross_pay: 18250.25, incentive_pay: 250.25, advance_deducted: 9125.13, net_payout: 9125.12, payment_mode: 'cash', paid_at: '', status: 'paid' }
        expect(preview([{ ...incentive, settlement_id: settlement.id }], { settlements: [settlement] })).toMatchObject({ status: 'paid', base_pay: 18000, incentive_pay: 250.25, gross_pay: 18250.25 })
        expect(preview([incentive], { settlements: [{ ...settlement, status: 'reversed' }] })).toMatchObject({ status: 'unsettled', incentive_pay: 250.25 })
    })
})
describe('Incentive receipts and exports', () => {
    it('preserves evidence and approval while excluding incentive amounts from machine quantities and rates', () => {
        const settlement: BasePayrollSettlement = { id: 'paid', worker_id: worker.id, period_start: '2026-09-01', period_end: '2026-09-30',
            gross_pay: 250.25, incentive_pay: 250.25, advance_deducted: 0, net_payout: 250.25, payment_mode: 'cash', paid_at: '' }
        const snapshot = { ...incentive, approved_by: 'owner', approved_at: incentive.approved_at!, calculation_version: 'manual-incentive-v1' as const, currency: 'INR' as const, unit: 'amount' as const }
        const line: BasePayrollSettlementLine = { id: 'line', settlement_id: settlement.id, worker_id: worker.id, production_date: incentive.service_end,
            shift: null, machine_id: null, machine_label: 'Production incentive', job_id: null, costing_label: 'Accountant worksheet 7',
            meters: 0, worker_rate_snapshot: 0, gross_pay: 250.25, source_kind: 'manual_incentive', source_id: incentive.id, earning_snapshot: snapshot }
        const period = buildBasePayrollHistory([settlement], [line])[0]
        expect(period).toMatchObject({ totalGrossPay: 250.25, totalMeters: 0, machines: [] })
        expect(period.workers[0].earnings[0]).toMatchObject({ kind: 'manual_incentive', incentiveSnapshot: snapshot })
        const csv = buildBasePayrollHistoryCsv(period)
        expect(csv).toContain('Evidence Reference')
        expect(csv).toContain('manual-incentive-v1')
        expect(csv).toContain('amount,2026-09-01,2026-09-30,Accountant worksheet 7,owner')
        expect(normalizePayrollPdfData(period).totalMachines).toBe(0)
        expect(buildBasePayrollHistory([{ ...settlement, status: 'reversed' }], [line])[0]).toMatchObject({ totalGrossPay: 0, totalMeters: 0 })
    })
})
