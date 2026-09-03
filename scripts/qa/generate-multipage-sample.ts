import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'
import type { BasePayrollHistoryPeriod } from '../../lib/base-payroll-history'

async function run() {
    const outDir = join(process.cwd(), 'output', 'payroll-pdf-redesign')
    mkdirSync(outDir, { recursive: true })

    // 12-worker multi-page stress test
    const manyWorkers = Array.from({ length: 8 }, (_, i) => ({
        settlementId: `w-${i + 1}`,
        workerId: `w-${i + 1}`,
        workerName: `Worker #${i + 1} - ${['Rameshwar Lal Sharma', 'Mukeshbhai Patel', 'Dineshbhai Prajapati', 'Sanjaykumar Varma'][i % 4]}`,
        grossPay: 14000 + i * 1200,
        advanceBalanceBefore: 3000,
        advanceRecovered: 1500,
        remainingAdvanceBalance: 1500,
        netPayout: 12500 + i * 1200,
        paymentMode: (['bank_transfer', 'upi', 'cash', 'cheque'] as const)[i % 4],
        paidAt: '2026-08-30T10:00:00.000Z',
        meters: 2200 + i * 150,
        earnings: [
            {
                machineId: `L-${(i % 6) + 1}`,
                machineLabel: `Loom #${(i % 6) + 1} (Airjet)`,
                costingLabel: 'Superfine Cotton 60s Count High-Density Weave Quality Fabric',
                rate: 6.80,
                meters: 1100 + i * 75,
                grossPay: (1100 + i * 75) * 6.80,
                productionDates: ['2026-08-01', '2026-08-15'],
            },
            {
                machineId: `L-${(i % 6) + 2}`,
                machineLabel: `Loom #${(i % 6) + 2} (Rapier)`,
                costingLabel: 'Micro Polyester Viscose 58 inch Width Export Fabric',
                rate: 6.20,
                meters: 1100 + i * 75,
                grossPay: (1100 + i * 75) * 6.20,
                productionDates: ['2026-08-16', '2026-08-30'],
            },
        ],
    }))

    const multiPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: manyWorkers.reduce((sum, w) => sum + w.meters, 0),
        totalGrossPay: manyWorkers.reduce((sum, w) => sum + w.grossPay, 0),
        totalAdvanceRecovered: manyWorkers.reduce((sum, w) => sum + w.advanceRecovered, 0),
        totalNetPayout: manyWorkers.reduce((sum, w) => sum + w.netPayout, 0),
        paymentModes: ['bank_transfer', 'upi', 'cash', 'cheque'],
        latestPaidAt: '2026-08-30T11:00:00.000Z',
        machines: [],
        workers: manyWorkers,
    }

    const { doc } = await generateBasePayrollPdf(multiPeriod, {
        factoryName: 'ASHOK WEAVING & TEXTILE MILLS',
    })
    const arrayBuffer = doc.output('arraybuffer')
    writeFileSync(join(outDir, 'multipage_sample.pdf'), Buffer.from(arrayBuffer))
    console.log(`Exported multipage sample with ${doc.getNumberOfPages()} pages.`)
}

run().catch(console.error)
