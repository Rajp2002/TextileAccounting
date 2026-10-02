import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { BasePayrollHistoryMachine, BasePayrollHistoryWorker } from '../lib/base-payroll-history'
import { en } from '../lib/i18n/locales/en'
import { hi } from '../lib/i18n/locales/hi'
import { gu } from '../lib/i18n/locales/gu'

const runtime = vi.hoisted(() => ({ language: 'en' as 'en' | 'hi' | 'gu' }))
const locales = { en, hi, gu }
vi.mock('@/lib/i18n/context', () => ({ useTranslation: () => ({
    t: (key: string) => locales[runtime.language].payroll.recordDetails[key.replace('payroll.recordDetails.', '') as keyof typeof en.payroll.recordDetails] ?? key,
    tx: (text: string) => text,
}) }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))
vi.mock('@/app/(dashboard)/owner/production/actions', () => ({ reverseBasePayrollSettlement: vi.fn() }))

import { PayrollMachineWorkers, PayrollWorkerEarnings, PayrollWorkerReceipt } from '../app/(dashboard)/owner/production/BasePayrollRecords'

const worker: BasePayrollHistoryWorker = {
    settlementId: 'paid-1', workerId: 'worker-1', workerName: 'Worker One', status: 'paid',
    grossPay: 1350.25, advanceBalanceBefore: 900, advanceRecovered: 500, remainingAdvanceBalance: 400,
    netPayout: 850.25, paymentMode: 'upi', paidAt: '2026-09-30T10:00:00Z', meters: 200,
    earnings: [{ machineId: 'machine-1', machineLabel: 'Loom 1', costingLabel: 'Cotton Navy', rate: 6.75, meters: 200, grossPay: 1350.25, productionDates: ['2026-09-10'], payType: 'piece_rate' }],
}

function textValues(html: string, tag: string) {
    return [...html.matchAll(new RegExp(`<${tag}[^>]*>(.*?)</${tag}>`, 'g'))].map(match => match[1])
}

function responsiveParts(html: string) {
    const boundary = html.indexOf('<div class="desktop-record-details')
    expect(boundary).toBeGreaterThan(0)
    return { mobile: html.slice(0, boundary), desktop: html.slice(boundary) }
}

describe('payroll record detail parity', () => {
    for (const language of ['en', 'hi', 'gu'] as const) {
        it(`${language}: retains every snapshotted machine earning and cumulative worker total in both layouts`, () => {
            runtime.language = language
            const { mobile, desktop } = responsiveParts(renderToStaticMarkup(<PayrollWorkerEarnings worker={worker} />))
            const labels = locales[language].payroll.recordDetails
            const expected = ['Loom 1', 'Cotton Navy', '₹6.75/m', '200 m', '₹1,350.25']
            expect(textValues(mobile, 'dt')).toEqual([labels.machine, labels.costing, labels.rate, labels.production, labels.earnings, labels.production, labels.earnings])
            expect(textValues(mobile, 'dd')).toEqual([...expected, '200 m', '₹1,350.25'])
            expect(textValues(desktop, 'td')).toEqual([...expected, labels.cumulativeWorkerTotal, '200 m', '₹1,350.25'])
            expect(mobile).not.toContain('<table')
        })

        it(`${language}: keeps salary and incentive amounts without implying a per-metre rate or production`, () => {
            runtime.language = language
            const salary: BasePayrollHistoryWorker = {
                ...worker, grossPay: 22000, meters: 0,
                earnings: [
                    { machineId: null, machineLabel: 'Fixed salary', costingLabel: 'September 2026', payType: 'fixed_monthly', rate: 20000, meters: 0, grossPay: 20000, productionDates: [] },
                    { machineId: null, machineLabel: 'Manual incentive', costingLabel: 'Attendance bonus', kind: 'manual_incentive', rate: 0, meters: 0, grossPay: 2000, productionDates: [] },
                ],
            }
            const { mobile, desktop } = responsiveParts(renderToStaticMarkup(<PayrollWorkerEarnings worker={salary} />))
            const labels = locales[language].payroll.recordDetails
            const expected = ['Fixed salary', 'September 2026', `₹20,000.00/${labels.month}`, '—', '₹20,000.00', 'Manual incentive', 'Attendance bonus', '—', '—', '₹2,000.00']
            expect(textValues(mobile, 'dd')).toEqual([...expected, '0 m', '₹22,000.00'])
            expect(textValues(desktop, 'td')).toEqual([...expected, labels.cumulativeWorkerTotal, '0 m', '₹22,000.00'])
            expect(textValues(mobile, 'dt').slice(0, 2)).toEqual([labels.payBasis, labels.salaryPeriod])
        })

        it(`${language}: retains each machine's worker, costing, rate, production, and cost`, () => {
            runtime.language = language
            const machine: BasePayrollHistoryMachine = {
                machineId: 'machine-1', machineLabel: 'Loom 1', meters: 200, grossPay: 1350.25, workerCount: 1, costingCount: 1,
                workers: [{ workerId: 'worker-1', workerName: 'Worker One', costingLabel: 'Cotton Navy', rate: 6.75, meters: 200, grossPay: 1350.25 }],
            }
            const { mobile, desktop } = responsiveParts(renderToStaticMarkup(<PayrollMachineWorkers machine={machine} />))
            const expected = ['Worker One', 'Cotton Navy', '₹6.75/m', '200 m', '₹1,350.25']
            const labels = locales[language].payroll.recordDetails
            expect(textValues(mobile, 'dt')).toEqual([labels.worker, labels.costing, labels.rate, labels.production, labels.workerCost])
            expect(textValues(mobile, 'dd')).toEqual(expected)
            expect(textValues(desktop, 'td')).toEqual(expected)
        })

        it(`${language}: preserves the advance carry-forward and original receipt values for reversed records`, () => {
            runtime.language = language
            const html = renderToStaticMarkup(<PayrollWorkerReceipt worker={{ ...worker, status: 'reversed', reversalReason: 'Payment was not made' }} />)
            const labels = locales[language].payroll.recordDetails
            expect(textValues(html, 'dt')).toEqual([labels.advanceBefore, labels.recovered, labels.balanceCarried, labels.payment, labels.cumulativeNetPay])
            expect(textValues(html, 'dd')).toEqual(['₹900.00', '₹500.00', '₹400.00', 'UPI', '₹850.25'])
        })
    }
})
