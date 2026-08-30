import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'
import type { BasePayrollHistoryPeriod } from '../../lib/base-payroll-history'

async function run() {
    const outDir = join(process.cwd(), 'output', 'payroll-pdf-redesign')
    mkdirSync(outDir, { recursive: true })

    // 1. Fully Settled Sample (All workers paid)
    const settledPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 4750,
        totalGrossPay: 30750,
        totalAdvanceRecovered: 3000,
        totalNetPayout: 27750,
        paymentModes: ['bank_transfer', 'upi'],
        latestPaidAt: '2026-08-30T11:00:00.000Z',
        machines: [],
        workers: [
            {
                settlementId: 'w-1',
                workerId: 'w-1',
                workerName: 'Rameshwar Lalji Sharma',
                grossPay: 18450,
                advanceBalanceBefore: 5000,
                advanceRecovered: 3000,
                remainingAdvanceBalance: 2000,
                netPayout: 15450,
                paymentMode: 'bank_transfer',
                paidAt: '2026-08-30T10:00:00.000Z',
                meters: 2750,
                earnings: [
                    {
                        machineId: 'L-1',
                        machineLabel: 'Loom #1 (Airjet)',
                        costingLabel: 'Premium Cotton Twill 60s Count High-Density Export Fabric',
                        rate: 7.20,
                        meters: 1450,
                        grossPay: 10440,
                        productionDates: ['2026-08-01', '2026-08-15'],
                    },
                    {
                        machineId: 'L-2',
                        machineLabel: 'Loom #2 (Airjet)',
                        costingLabel: 'Micro Polyester Viscose Shirting 58 inch Width',
                        rate: 6.16,
                        meters: 1300,
                        grossPay: 8010,
                        productionDates: ['2026-08-16', '2026-08-30'],
                    },
                ],
            },
            {
                settlementId: 'w-2',
                workerId: 'w-2',
                workerName: 'Kishore Kumar Patel',
                grossPay: 12300,
                advanceBalanceBefore: 0,
                advanceRecovered: 0,
                remainingAdvanceBalance: 0,
                netPayout: 12300,
                paymentMode: 'upi',
                paidAt: '2026-08-30T10:30:00.000Z',
                meters: 2000,
                earnings: [
                    {
                        machineId: 'L-3',
                        machineLabel: 'Loom #3 (Rapier)',
                        costingLabel: 'Grey Jacquard Border Fabric Style #J-402',
                        rate: 6.15,
                        meters: 2000,
                        grossPay: 12300,
                        productionDates: ['2026-08-01', '2026-08-30'],
                    },
                ],
            },
        ],
    }

    // 2. Partially Settled Sample (1 worker paid, 1 worker unpaid)
    const partialPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 4750,
        totalGrossPay: 30750,
        totalAdvanceRecovered: 3000,
        totalNetPayout: 27750,
        paymentModes: ['bank_transfer'],
        latestPaidAt: null,
        machines: [],
        workers: [
            {
                ...settledPeriod.workers[0],
                paidAt: '2026-08-30T10:00:00.000Z',
                paymentMode: 'bank_transfer',
            },
            {
                ...settledPeriod.workers[1],
                paidAt: '',
                paymentMode: 'cash',
            },
        ],
    }

    // 3. Fully Unsettled / Draft Sample (No workers paid)
    const draftPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 4750,
        totalGrossPay: 30750,
        totalAdvanceRecovered: 0,
        totalNetPayout: 30750,
        paymentModes: ['cash'],
        latestPaidAt: null,
        machines: [],
        workers: [
            {
                ...settledPeriod.workers[0],
                paidAt: '',
                advanceRecovered: 0,
                netPayout: 18450,
            },
            {
                ...settledPeriod.workers[1],
                paidAt: '',
                advanceRecovered: 0,
                netPayout: 12300,
            },
        ],
    }

    // Generate PDFs
    const resSettled = await generateBasePayrollPdf(settledPeriod, { factoryName: 'ASHOK TEXTILE' })
    writeFileSync(join(outDir, 'state_settled.pdf'), Buffer.from(resSettled.doc.output('arraybuffer')))

    const resPartial = await generateBasePayrollPdf(partialPeriod, { factoryName: 'ASHOK TEXTILE' })
    writeFileSync(join(outDir, 'state_partial.pdf'), Buffer.from(resPartial.doc.output('arraybuffer')))

    const resDraft = await generateBasePayrollPdf(draftPeriod, { factoryName: 'ASHOK TEXTILE' })
    writeFileSync(join(outDir, 'state_draft.pdf'), Buffer.from(resDraft.doc.output('arraybuffer')))

    console.log('Successfully generated state_settled.pdf, state_partial.pdf, and state_draft.pdf')
}

run().catch(console.error)
