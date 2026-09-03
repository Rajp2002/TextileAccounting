import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'
import type { BasePayrollHistoryPeriod } from '../../lib/base-payroll-history'

async function run() {
    const outDir = join(process.cwd(), 'output', 'payroll-pdf-redesign')
    mkdirSync(outDir, { recursive: true })

    // Large currency and long text stress test
    const largeValuePeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 185420.5,
        totalGrossPay: 12487693.5,
        totalAdvanceRecovered: 2450000.0,
        totalNetPayout: 10037693.5,
        paymentModes: ['bank_transfer', 'upi'],
        latestPaidAt: '2026-08-30T11:00:00.000Z',
        machines: [],
        workers: [
            {
                settlementId: 'w-large-1',
                workerId: 'w-large-1',
                workerName: 'Shri Vikramaditya Hariprasad Jhunjhunwala Master Weaver',
                grossPay: 1248923.5,
                advanceBalanceBefore: 450000,
                advanceRecovered: 250000,
                remainingAdvanceBalance: 200000,
                netPayout: 998923.5,
                paymentMode: 'bank_transfer',
                paidAt: '2026-08-30T10:00:00.000Z',
                meters: 18500.5,
                earnings: [
                    {
                        machineId: 'L-101',
                        machineLabel: 'Loom #101 (Airjet High Speed Electronic Dobby)',
                        costingLabel: 'Superfine Combed Compact Cotton 80s Count Warp and Weft Satin Stripe 60 inch Width Export Quality Fabric',
                        rate: 67.50,
                        meters: 10250.25,
                        grossPay: 691891.88,
                        productionDates: ['2026-08-01', '2026-08-15'],
                    },
                    {
                        machineId: 'L-102',
                        machineLabel: 'Loom #102 (Rapier Multi-Color Electronic Jacquard)',
                        costingLabel: 'Premium Micro Modal Silk Blend Jacquard Dress Material 44 inch Width Intricate Motif Weave',
                        rate: 67.50,
                        meters: 8250.25,
                        grossPay: 557031.62,
                        productionDates: ['2026-08-16', '2026-08-30'],
                    },
                ],
            },
            {
                settlementId: 'w-large-2',
                workerId: 'w-large-2',
                workerName: 'Mukeshbhai Chhaganbhai Vaghela',
                grossPay: 11238770.0,
                advanceBalanceBefore: 2200000,
                advanceRecovered: 2200000,
                remainingAdvanceBalance: 0,
                netPayout: 9038770.0,
                paymentMode: 'upi',
                paidAt: '2026-08-30T11:00:00.000Z',
                meters: 166920.0,
                earnings: [
                    {
                        machineId: 'L-201',
                        machineLabel: 'Loom #201 (Airjet)',
                        costingLabel: 'Heavy Twill Industrial Protective Fabric 58 inch Width',
                        rate: 67.33,
                        meters: 166920.0,
                        grossPay: 11238770.0,
                        productionDates: ['2026-08-01', '2026-08-30'],
                    },
                ],
            },
        ],
    }

    const { doc } = await generateBasePayrollPdf(largeValuePeriod, {
        factoryName: 'SRI BALAJI WEAVING & INDUSTRIAL TEXTILE MEGA-COMPLEX PVT LTD',
    })
    const arrayBuffer = doc.output('arraybuffer')
    writeFileSync(join(outDir, 'large_values_sample.pdf'), Buffer.from(arrayBuffer))
    console.log(`Exported large value sample with ${doc.getNumberOfPages()} pages.`)
}

run().catch(console.error)
