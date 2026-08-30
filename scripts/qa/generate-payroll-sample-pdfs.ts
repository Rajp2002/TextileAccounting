import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'
import type { BasePayrollHistoryPeriod } from '../../lib/base-payroll-history'

const sampleUserScreenshotPeriod: BasePayrollHistoryPeriod = {
    key: '2026-08-01:2026-08-30',
    start: '2026-08-01',
    end: '2026-08-30',
    totalMeters: 285,
    totalGrossPay: 1923.75,
    totalAdvanceRecovered: 500,
    totalNetPayout: 1423.75,
    paymentModes: ['cash'],
    latestPaidAt: '2026-08-30T10:00:00.000Z',
    machines: [
        {
            machineId: '1',
            machineLabel: 'Loom #1',
            meters: 150,
            grossPay: 1012.5,
            workerCount: 1,
            costingCount: 1,
            workers: [
                {
                    workerId: 'worker-1',
                    workerName: 'Ramesh',
                    costingLabel: 'test quality 3',
                    rate: 6.75,
                    meters: 150,
                    grossPay: 1012.5,
                },
            ],
        },
        {
            machineId: '2',
            machineLabel: 'Loom #2',
            meters: 135,
            grossPay: 911.25,
            workerCount: 1,
            costingCount: 1,
            workers: [
                {
                    workerId: 'worker-1',
                    workerName: 'Ramesh',
                    costingLabel: 'test quality 3',
                    rate: 6.75,
                    meters: 135,
                    grossPay: 911.25,
                },
            ],
        },
    ],
    workers: [
        {
            settlementId: 'settlement-ramesh',
            workerId: 'worker-ramesh',
            workerName: 'Ramesh',
            grossPay: 1923.75,
            advanceBalanceBefore: 500,
            advanceRecovered: 500,
            remainingAdvanceBalance: 0,
            netPayout: 1423.75,
            paymentMode: 'cash',
            paidAt: '2026-08-30T10:00:00.000Z',
            meters: 285,
            earnings: [
                {
                    machineId: '1',
                    machineLabel: '1',
                    costingLabel: 'test quality 3',
                    rate: 6.75,
                    meters: 150,
                    grossPay: 1012.5,
                    productionDates: ['2026-08-02', '2026-08-03'],
                },
                {
                    machineId: '2',
                    machineLabel: '2',
                    costingLabel: 'test quality 3',
                    rate: 6.75,
                    meters: 135,
                    grossPay: 911.25,
                    productionDates: ['2026-08-04'],
                },
            ],
        },
    ],
}

async function run() {
    const outDir = join(process.cwd(), 'output', 'payroll-pdf-redesign')
    mkdirSync(outDir, { recursive: true })

    // 1. User screenshot exact recreation
    const { doc: doc1, filename: file1 } = await generateBasePayrollPdf(sampleUserScreenshotPeriod, {
        factoryName: 'ASHOK TEXTILE',
    })
    const arrayBuffer1 = doc1.output('arraybuffer')
    writeFileSync(join(outDir, file1), Buffer.from(arrayBuffer1))
    console.log(`Exported single-worker sample: ${join(outDir, file1)}`)

    // 2. Multi-worker, multi-page stress test
    const multiWorkers = [
        {
            settlementId: 'w-1',
            workerId: 'w-1',
            workerName: 'Rameshwar Lalji Sharma',
            grossPay: 18450,
            advanceBalanceBefore: 5000,
            advanceRecovered: 3000,
            remainingAdvanceBalance: 2000,
            netPayout: 15450,
            paymentMode: 'bank_transfer' as const,
            paidAt: '2026-08-30T10:00:00.000Z',
            meters: 2750,
            earnings: [
                {
                    machineId: '1',
                    machineLabel: 'Loom #1 (Airjet)',
                    costingLabel: 'Premium Cotton Twill 60s Count High-Density Export Fabric',
                    rate: 7.20,
                    meters: 1450,
                    grossPay: 10440,
                    productionDates: ['2026-08-01', '2026-08-10'],
                },
                {
                    machineId: '2',
                    machineLabel: 'Loom #2 (Airjet)',
                    costingLabel: 'Micro Polyester Viscose Shirting 58 inch Width',
                    rate: 6.16,
                    meters: 1300,
                    grossPay: 8010,
                    productionDates: ['2026-08-11', '2026-08-20'],
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
            paymentMode: 'upi' as const,
            paidAt: '2026-08-30T10:30:00.000Z',
            meters: 2000,
            earnings: [
                {
                    machineId: '3',
                    machineLabel: 'Loom #3 (Rapier)',
                    costingLabel: 'Grey Jacquard Border Fabric Style #J-402',
                    rate: 6.15,
                    meters: 2000,
                    grossPay: 12300,
                    productionDates: ['2026-08-01', '2026-08-15'],
                },
            ],
        },
        {
            settlementId: 'w-3',
            workerId: 'w-3',
            workerName: 'Mukeshbhai Chhaganbhai Vaghela',
            grossPay: 14850,
            advanceBalanceBefore: 4000,
            advanceRecovered: 4000,
            remainingAdvanceBalance: 0,
            netPayout: 10850,
            paymentMode: 'cash' as const,
            paidAt: '2026-08-30T11:00:00.000Z',
            meters: 2250,
            earnings: [
                {
                    machineId: '4',
                    machineLabel: 'Loom #4 (Shuttleless)',
                    costingLabel: 'Slub Cotton Linen Weave 44 inch Width Standard Quality',
                    rate: 6.60,
                    meters: 2250,
                    grossPay: 14850,
                    productionDates: ['2026-08-05', '2026-08-22'],
                },
            ],
        },
    ]

    const multiPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: multiWorkers.reduce((sum, w) => sum + w.meters, 0),
        totalGrossPay: multiWorkers.reduce((sum, w) => sum + w.grossPay, 0),
        totalAdvanceRecovered: multiWorkers.reduce((sum, w) => sum + w.advanceRecovered, 0),
        totalNetPayout: multiWorkers.reduce((sum, w) => sum + w.netPayout, 0),
        paymentModes: ['bank_transfer', 'upi', 'cash'],
        latestPaidAt: '2026-08-30T11:00:00.000Z',
        machines: [],
        workers: multiWorkers,
    }

    const { doc: doc2, filename: file2 } = await generateBasePayrollPdf(multiPeriod, {
        factoryName: 'ASHOK WEAVING & TEXTILE MILLS',
    })
    const arrayBuffer2 = doc2.output('arraybuffer')
    writeFileSync(join(outDir, file2), Buffer.from(arrayBuffer2))
    console.log(`Exported multi-worker stress sample: ${join(outDir, file2)}`)
}

run().catch(console.error)
