import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { generateBasePayrollPdf } from '../../lib/generate-base-payroll-pdf'
import type { BasePayrollHistoryPeriod } from '../../lib/base-payroll-history'

async function run() {
    const outDir = join(process.cwd(), 'output', 'payroll-pdf-redesign')
    mkdirSync(outDir, { recursive: true })

    // Case 1: Standard Single Worker (Cases 1, 2, 7)
    const singleWorkerPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 285,
        totalGrossPay: 1923.75,
        totalAdvanceRecovered: 500,
        totalNetPayout: 1423.75,
        paymentModes: ['cash'],
        latestPaidAt: '2026-08-30T10:00:00.000Z',
        machines: [{ machineId: 'L-1', machineLabel: 'Loom #1', meters: 285, grossPay: 1923.75, workerCount: 1, costingCount: 1, workers: [] }],
        workers: [{
            settlementId: 'w-1',
            workerId: 'w-1',
            workerName: 'Rameshwar Lalji Sharma',
            grossPay: 1923.75,
            advanceBalanceBefore: 2500,
            advanceRecovered: 500,
            remainingAdvanceBalance: 2000,
            netPayout: 1423.75,
            paymentMode: 'cash',
            paidAt: '2026-08-30T10:00:00.000Z',
            meters: 285,
            earnings: [
                {
                    machineId: 'L-1',
                    machineLabel: 'Loom #1 (Airjet)',
                    costingLabel: 'Cotton Navy 40s High Density Weave',
                    rate: 6.75,
                    meters: 150,
                    grossPay: 1012.5,
                    productionDates: ['2026-08-02', '2026-08-03'],
                },
                {
                    machineId: 'L-2',
                    machineLabel: 'Loom #2 (Rapier)',
                    costingLabel: 'Micro Polyester Viscose Shirting 58 inch Width',
                    rate: 6.75,
                    meters: 135,
                    grossPay: 911.25,
                    productionDates: ['2026-08-04'],
                },
            ],
        }],
    }

    // Case 2: Multi-Worker with Zero Advance & Cleared Advance (Cases 1, 2, 6, 7, 13)
    const multiWorkerPeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 7000,
        totalGrossPay: 45600,
        totalAdvanceRecovered: 7000,
        totalNetPayout: 38600,
        paymentModes: ['bank_transfer', 'upi', 'cash'],
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
            {
                settlementId: 'w-3',
                workerId: 'w-3',
                workerName: 'Mukeshbhai Chhaganbhai Vaghela',
                grossPay: 14850,
                advanceBalanceBefore: 4000,
                advanceRecovered: 4000,
                remainingAdvanceBalance: 0,
                netPayout: 10850,
                paymentMode: 'cash',
                paidAt: '2026-08-30T11:00:00.000Z',
                meters: 2250,
                earnings: [
                    {
                        machineId: 'L-4',
                        machineLabel: 'Loom #4 (Shuttleless)',
                        costingLabel: 'Slub Cotton Linen Weave 44 inch Width Standard Quality',
                        rate: 6.60,
                        meters: 2250,
                        grossPay: 14850,
                        productionDates: ['2026-08-01', '2026-08-30'],
                    },
                ],
            },
        ],
    }

    // Case 3: Worker with 10 earnings rows spanning pages (Cases 3, 4, 5, 13)
    const longTablePeriod: BasePayrollHistoryPeriod = {
        key: '2026-08-01:2026-08-30',
        start: '2026-08-01',
        end: '2026-08-30',
        totalMeters: 14250,
        totalGrossPay: 96900,
        totalAdvanceRecovered: 15000,
        totalNetPayout: 81900,
        paymentModes: ['bank_transfer'],
        latestPaidAt: '2026-08-30T12:00:00.000Z',
        machines: [],
        workers: [
            {
                settlementId: 'w-master-1',
                workerId: 'w-master-1',
                workerName: 'Master Weaver Tribhovandas Ranchhoddas Patel',
                grossPay: 96900,
                advanceBalanceBefore: 25000,
                advanceRecovered: 15000,
                remainingAdvanceBalance: 10000,
                netPayout: 81900,
                paymentMode: 'bank_transfer',
                paidAt: '2026-08-30T12:00:00.000Z',
                meters: 14250,
                earnings: Array.from({ length: 22 }, (_, i) => ({
                    machineId: `Loom #${i + 101}`,
                    machineLabel: `Loom #${i + 101} (${i % 2 === 0 ? 'Airjet' : 'Rapier'})`,
                    costingLabel: `Quality Style #${i + 100} - ${['Combed Cotton 60s High Density Weave', 'Poly Viscose Suiting 58 inch Width', 'Jacquard Border Heavy Weave 44 inch Width', 'Satin Stripe Export Fabric'][i % 4]}`,
                    rate: 6.80,
                    meters: 1187.5,
                    grossPay: 8075,
                    productionDates: [`2026-08-${String((i % 28) + 1).padStart(2, '0')}`],
                })),
            },
        ],
    }

    // Case 4: Long Text & Large Currency Crores Stress Test (Cases 8, 9, 10, 11, 12)
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

    // Generate PDFs
    const res1 = await generateBasePayrollPdf(singleWorkerPeriod, { factoryName: 'ASHOK TEXTILE' })
    writeFileSync(join(outDir, 'case1_ashok_single.pdf'), Buffer.from(res1.doc.output('arraybuffer')))

    const res2 = await generateBasePayrollPdf(multiWorkerPeriod, { factoryName: 'ASHOK WEAVING & TEXTILE MILLS' })
    writeFileSync(join(outDir, 'case2_multi_workers.pdf'), Buffer.from(res2.doc.output('arraybuffer')))

    const res3 = await generateBasePayrollPdf(longTablePeriod, { factoryName: 'TRIBHOVANDAS WEAVING MILLS' })
    writeFileSync(join(outDir, 'case3_many_rows_multipage.pdf'), Buffer.from(res3.doc.output('arraybuffer')))

    const res4 = await generateBasePayrollPdf(largeValuePeriod, { factoryName: 'SRI BALAJI WEAVING & INDUSTRIAL TEXTILE MEGA-COMPLEX PVT LTD' })
    writeFileSync(join(outDir, 'case4_long_text_and_large_values.pdf'), Buffer.from(res4.doc.output('arraybuffer')))

    console.log('Successfully generated all 4 test PDFs for full visual inspection.')
}

run().catch(console.error)
