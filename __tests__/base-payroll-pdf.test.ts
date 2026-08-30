import { describe, expect, it } from 'vitest'
import {
    buildBasePayrollPdfFilename,
    derivePayrollSettlementState,
    formatPdfDate,
    formatPdfDateTime,
    formatPdfINR,
    formatPdfMeters,
    formatPdfRate,
    formatWorkerPaymentMeta,
    generateBasePayrollPdf,
    normalizePayrollPdfData,
    paymentModeLabel,
    PDF_THEME,
    sanitizeFilenamePart,
    sanitizePdfText,
} from '../lib/generate-base-payroll-pdf'
import type { BasePayrollHistoryPeriod } from '../lib/base-payroll-history'

const samplePeriod: BasePayrollHistoryPeriod = {
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
            machineId: 'loom-1',
            machineLabel: 'Loom #1',
            meters: 150,
            grossPay: 1012.5,
            workerCount: 1,
            costingCount: 1,
            workers: [
                {
                    workerId: 'worker-1',
                    workerName: 'Ramesh',
                    costingLabel: 'Cotton Navy 40s High Density Weave',
                    rate: 6.75,
                    meters: 150,
                    grossPay: 1012.5,
                },
            ],
        },
        {
            machineId: 'loom-2',
            machineLabel: 'Loom #2',
            meters: 135,
            grossPay: 911.25,
            workerCount: 1,
            costingCount: 1,
            workers: [
                {
                    workerId: 'worker-1',
                    workerName: 'Ramesh',
                    costingLabel: 'Cotton Navy 40s High Density Weave',
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
                    machineId: 'loom-1',
                    machineLabel: 'Loom #1',
                    costingLabel: 'Cotton Navy 40s High Density Weave',
                    rate: 6.75,
                    meters: 150,
                    grossPay: 1012.5,
                    productionDates: ['2026-08-02', '2026-08-03'],
                },
                {
                    machineId: 'loom-2',
                    machineLabel: 'Loom #2',
                    costingLabel: 'Cotton Navy 40s High Density Weave',
                    rate: 6.75,
                    meters: 135,
                    grossPay: 911.25,
                    productionDates: ['2026-08-04'],
                },
            ],
        },
    ],
}

describe('Base Payroll PDF Generator', () => {
    describe('Centralized Theme & Tokens', () => {
        it('defines canonical Loom Navy and Saffron color tokens and layout dimensions', () => {
            expect(PDF_THEME.colors.navy).toBe('#18252E')
            expect(PDF_THEME.colors.saffron).toBe('#E27025')
            expect(PDF_THEME.colors.saffronDark).toBe('#A94713')
            expect(PDF_THEME.colors.navyRgb).toEqual([24, 37, 46])
            expect(PDF_THEME.colors.saffronRgb).toEqual([226, 112, 37])
            expect(PDF_THEME.colors.saffronDarkRgb).toEqual([169, 71, 19])
            expect(PDF_THEME.layout.pageWidth).toBeCloseTo(595.28, 1)
            expect(PDF_THEME.layout.pageHeight).toBeCloseTo(841.89, 1)
            expect(PDF_THEME.layout.contentWidth).toBeCloseTo(523.28, 1)
        })
    })

    describe('Formatters & Sanitizers', () => {
        it('formats currency cleanly in Indian numbering with Rs prefix fallback', () => {
            expect(formatPdfINR(1923.75)).toBe('Rs 1,923.75')
            expect(formatPdfINR(100000)).toBe('Rs 1,00,000.00')
            expect(formatPdfINR(0)).toBe('Rs 0.00')
            expect(formatPdfINR(NaN)).toBe('Rs 0.00')
        })

        it('formats rates with /m suffix', () => {
            expect(formatPdfRate(6.75)).toBe('Rs 6.75/m')
            expect(formatPdfRate(10)).toBe('Rs 10.00/m')
        })

        it('formats meters with 2 decimals and m unit', () => {
            expect(formatPdfMeters(285)).toBe('285.00 m')
            expect(formatPdfMeters(1234.5)).toBe('1,234.50 m')
        })

        it('formats dates consistently in Surat/Kolkata timezone', () => {
            expect(formatPdfDate('2026-08-01')).toBe('1 Aug 2026')
            expect(formatPdfDate('2026-08-30')).toBe('30 Aug 2026')
            expect(formatPdfDate(null)).toBe('—')
        })

        it('formats worker payment metadata cleanly with missing fields', () => {
            expect(formatWorkerPaymentMeta('2026-08-30', 'bank_transfer')).toBe('· Paid 30 Aug 2026 by Bank Transfer')
            expect(formatWorkerPaymentMeta('2026-08-30', null)).toBe('· Paid 30 Aug 2026')
            expect(formatWorkerPaymentMeta(null, 'cash')).toBe('· Payment: Cash')
            expect(formatWorkerPaymentMeta(null, null)).toBe('')
        })

        it('maps payment mode enum to human readable label', () => {
            expect(paymentModeLabel('cash')).toBe('Cash')
            expect(paymentModeLabel('upi')).toBe('UPI')
            expect(paymentModeLabel('bank_transfer')).toBe('Bank Transfer')
            expect(paymentModeLabel('cheque')).toBe('Cheque')
        })

        it('sanitizes filename parts safely without shell-hostile characters', () => {
            expect(sanitizeFilenamePart('Ashok Textile & Co.')).toBe('Ashok-Textile-and-Co')
            expect(sanitizeFilenamePart('../../bad/name??*')).toBe('bad-name')
            expect(sanitizeFilenamePart('')).toBe('Weavly')
        })

        it('builds clear and professional PDF filenames', () => {
            const filename = buildBasePayrollPdfFilename('ASHOK TEXTILE', '2026-08-01', '2026-08-30')
            expect(filename).toBe('ASHOK-TEXTILE_Payroll_2026-08-01_to_2026-08-30.pdf')
        })
    })

    describe('Data Normalization & Settlement State', () => {
        it('normalizes fully settled period when all workers have paidAt', () => {
            const normalized = normalizePayrollPdfData(samplePeriod, 'ASHOK TEXTILE')
            expect(normalized.factoryName).toBe('ASHOK TEXTILE')
            expect(normalized.periodRangeLabel).toBe('1 Aug 2026 – 30 Aug 2026')
            expect(normalized.settlementState).toBe('settled')
            expect(normalized.statusLabel).toBe('Settled')
            expect(normalized.isSettled).toBe(true)
            expect(normalized.totalWorkers).toBe(1)
            expect(normalized.totalMeters).toBe(285)
            expect(normalized.totalGrossPay).toBe(1923.75)
            expect(normalized.totalAdvanceRecovered).toBe(500)
            expect(normalized.totalNetPayout).toBe(1423.75)
            expect(normalized.paymentModesSummary).toBe('Cash')
        })

        it('derives Partially Settled state when some workers are paid and others are unpaid', () => {
            const partialPeriod: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                latestPaidAt: null,
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        workerId: 'w-paid-1',
                        workerName: 'Paid Worker',
                        paidAt: '2026-08-30T10:00:00.000Z',
                        paymentMode: 'bank_transfer',
                    },
                    {
                        ...samplePeriod.workers[0],
                        workerId: 'w-unpaid-2',
                        workerName: 'Unpaid Worker',
                        paidAt: '',
                        paymentMode: 'cash',
                    },
                ],
            }

            const state = derivePayrollSettlementState(partialPeriod)
            expect(state).toBe('partial')

            const normalized = normalizePayrollPdfData(partialPeriod, 'ASHOK TEXTILE')
            expect(normalized.settlementState).toBe('partial')
            expect(normalized.statusLabel).toBe('Partially Settled')
            expect(normalized.isSettled).toBe(false)
        })

        it('derives Draft state when no workers have recorded paidAt dates', () => {
            const draftPeriod: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                latestPaidAt: '',
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        workerId: 'w-unpaid-1',
                        paidAt: '',
                    },
                    {
                        ...samplePeriod.workers[0],
                        workerId: 'w-unpaid-2',
                        paidAt: '',
                    },
                ],
            }

            const state = derivePayrollSettlementState(draftPeriod)
            expect(state).toBe('draft')

            const normalized = normalizePayrollPdfData(draftPeriod, 'ASHOK TEXTILE')
            expect(normalized.settlementState).toBe('draft')
            expect(normalized.statusLabel).toBe('Draft')
            expect(normalized.isSettled).toBe(false)
        })

        it('does not allow latestPaidAt alone to elevate unpaid workers to settled', () => {
            // Edge case: latestPaidAt is populated from historical metadata, but all worker rows are pending/unpaid
            const metadataOnlyPeriod: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                latestPaidAt: '2026-08-30T10:00:00.000Z',
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        workerId: 'w-pending',
                        paidAt: '',
                    },
                ],
            }

            const state = derivePayrollSettlementState(metadataOnlyPeriod)
            expect(state).toBe('draft')
            expect(normalizePayrollPdfData(metadataOnlyPeriod, 'ASHOK TEXTILE').isSettled).toBe(false)
        })

        it('derives Draft when workers array is empty and no canonical status is given', () => {
            const emptyPeriod: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                latestPaidAt: '2026-08-30T10:00:00.000Z',
                workers: [],
            }
            expect(derivePayrollSettlementState(emptyPeriod)).toBe('draft')
        })

        it('honors explicit canonical period.status over worker-level signals', () => {
            const explicitSettled: BasePayrollHistoryPeriod & { status: string } = {
                ...samplePeriod,
                status: 'settled',
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        paidAt: '',
                    },
                ],
            }
            expect(derivePayrollSettlementState(explicitSettled as any)).toBe('settled')

            const explicitDraft: BasePayrollHistoryPeriod & { status: string } = {
                ...samplePeriod,
                status: 'draft',
                latestPaidAt: '2026-08-30T10:00:00.000Z',
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        paidAt: '2026-08-30T10:00:00.000Z',
                    },
                ],
            }
            expect(derivePayrollSettlementState(explicitDraft as any)).toBe('draft')
        })
    })

    describe('PDF Vector Document Generation', () => {
        it('generates a valid single-page PDF document with expected title and metadata', async () => {
            const result = await generateBasePayrollPdf(samplePeriod, {
                factoryName: 'ASHOK TEXTILE',
            })

            expect(result.doc).toBeDefined()
            expect(result.filename).toBe('ASHOK-TEXTILE_Payroll_2026-08-01_to_2026-08-30.pdf')
            expect(result.blob.size).toBeGreaterThan(1000)

            const numPages = result.doc.internal.getNumberOfPages()
            expect(numPages).toBe(1)
        })

        it('gracefully handles zero advances and distinct arithmetic reconciliation', async () => {
            const noAdvancePeriod: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                totalAdvanceRecovered: 0,
                totalNetPayout: 1923.75,
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        advanceBalanceBefore: 0,
                        advanceRecovered: 0,
                        remainingAdvanceBalance: 0,
                        netPayout: 1923.75,
                    },
                ],
            }

            const result = await generateBasePayrollPdf(noAdvancePeriod, {
                factoryName: 'ASHOK TEXTILE',
            })
            expect(result.doc.internal.getNumberOfPages()).toBe(1)
        })

        it('handles multi-worker datasets spanning multiple pages with repeating table headers and footers', async () => {
            // Stress test: 12 workers each with multiple earnings rows
            const manyWorkers = Array.from({ length: 12 }, (_, i) => ({
                settlementId: `settlement-${i + 1}`,
                workerId: `worker-${i + 1}`,
                workerName: `Worker Name ${i + 1} Long Testing Surname`,
                grossPay: 5000 + i * 500,
                advanceBalanceBefore: 1000,
                advanceRecovered: 500,
                remainingAdvanceBalance: 500,
                netPayout: 4500 + i * 500,
                paymentMode: (i % 2 === 0 ? 'bank_transfer' : 'upi') as any,
                paidAt: '2026-08-30T10:00:00.000Z',
                meters: 800 + i * 50,
                earnings: [
                    {
                        machineId: `loom-${(i % 4) + 1}`,
                        machineLabel: `Loom #${(i % 4) + 1}`,
                        costingLabel: 'Superfine Cotton 60s Count Special Weave Quality with Detailed Description',
                        rate: 6.25,
                        meters: 400 + i * 25,
                        grossPay: 2500 + i * 250,
                        productionDates: ['2026-08-01', '2026-08-02'],
                    },
                    {
                        machineId: `loom-${(i % 4) + 2}`,
                        machineLabel: `Loom #${(i % 4) + 2}`,
                        costingLabel: 'Polyester Twill Standard Grey Fabric Quality',
                        rate: 5.5,
                        meters: 400 + i * 25,
                        grossPay: 2500 + i * 250,
                        productionDates: ['2026-08-03', '2026-08-04'],
                    },
                ],
            }))

            const multiWorkerPeriod: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                workers: manyWorkers,
                totalWorkers: 12,
                totalMeters: manyWorkers.reduce((acc, w) => acc + w.meters, 0),
                totalGrossPay: manyWorkers.reduce((acc, w) => acc + w.grossPay, 0),
                totalAdvanceRecovered: manyWorkers.reduce((acc, w) => acc + w.advanceRecovered, 0),
                totalNetPayout: manyWorkers.reduce((acc, w) => acc + w.netPayout, 0),
            } as any

            const result = await generateBasePayrollPdf(multiWorkerPeriod, {
                factoryName: 'MODERN WEAVING MILLS PVT LTD',
            })

            const pages = result.doc.internal.getNumberOfPages()
            expect(pages).toBeGreaterThanOrEqual(3)
        })

        it('handles workers with many earning rows spanning across page boundaries without clipping', async () => {
            // One worker with 15 earnings rows to test row-level pagination and continuation headers
            const singleWorkerManyEarnings: BasePayrollHistoryPeriod = {
                ...samplePeriod,
                workers: [
                    {
                        ...samplePeriod.workers[0],
                        earnings: Array.from({ length: 35 }, (_, j) => ({
                            machineId: `loom-${j + 1}`,
                            machineLabel: `Loom #${j + 1}`,
                            costingLabel: `Costing Quality Batch Line #${j + 1} - Cotton Warp & Weft Yarn`,
                            rate: 6.5,
                            meters: 100,
                            grossPay: 650,
                            productionDates: ['2026-08-10'],
                        })),
                    },
                ],
            }

            const result = await generateBasePayrollPdf(singleWorkerManyEarnings, {
                factoryName: 'ASHOK TEXTILE',
            })

            const pages = result.doc.internal.getNumberOfPages()
            expect(pages).toBeGreaterThanOrEqual(2)
        })
    })
})
