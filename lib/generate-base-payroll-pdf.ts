import { jsPDF } from 'jspdf'
import type { BasePayrollHistoryPeriod, BasePayrollHistoryWorker } from './base-payroll-history'
import type { BasePayrollPaymentMode } from './base-production-core'

// =============================================================================
// WEAVLY PDF DESIGN SYSTEM & TOKENS
// =============================================================================

export const PDF_THEME = {
    colors: {
        // Loom Navy - Primary hierarchy, masthead elements, key totals
        navy: '#18252E',
        navyRgb: [24, 37, 46] as [number, number, number],
        navyDarkRgb: [15, 23, 42] as [number, number, number],

        // Saffron - Controlled brand accent (never overwhelming)
        saffron: '#E27025',
        saffronRgb: [226, 112, 37] as [number, number, number],
        saffronDark: '#A94713',
        saffronDarkRgb: [169, 71, 19] as [number, number, number], // High-contrast print/foreground text derivative
        saffronDeepRgb: [169, 71, 19] as [number, number, number], // Alias for backward compatibility
        saffronSoftRgb: [249, 223, 200] as [number, number, number],

        // Neutrals with Explicit Semantic Roles (80-90% light/white surfaces)
        whiteRgb: [255, 255, 255] as [number, number, number],
        surfaceLedgerRgb: [248, 250, 252] as [number, number, number], // #F8FAFC -> Ledger/structural neutral (subtotals, summary cards, headers)
        surfaceSoftRgb: [250, 241, 226] as [number, number, number],   // #FAF1E2 -> Warmer financial emphasis surface (Net Disbursed highlight)
        surfaceMutedRgb: [241, 245, 249] as [number, number, number],  // #F1F5F9 -> Subtle section banner fills
        surfaceRowAltRgb: [250, 252, 254] as [number, number, number], // #FAFCFE -> Extremely subtle alternating row fill

        // Borders & Dividers
        hairlineRgb: [226, 232, 240] as [number, number, number], // #E2E8F0
        borderWarmRgb: [222, 210, 189] as [number, number, number], // #DED2BD
        borderStrongRgb: [203, 184, 148] as [number, number, number],

        // Typography Tones
        textPrimaryRgb: [24, 37, 46] as [number, number, number], // #18252E
        textBodyRgb: [63, 69, 66] as [number, number, number], // #3F4542
        textMutedRgb: [100, 116, 139] as [number, number, number], // #64748B
        textLightRgb: [148, 163, 184] as [number, number, number], // #94A3B8

        // Status Tones (Truthful & Subtle)
        statusSettledTextRgb: [21, 128, 61] as [number, number, number], // #15803D
        statusSettledBgRgb: [240, 253, 244] as [number, number, number], // #F0FDF4
        statusSettledBorderRgb: [187, 247, 208] as [number, number, number], // #BBF7D0

        statusPartialTextRgb: [180, 83, 9] as [number, number, number], // #B45309
        statusPartialBgRgb: [254, 243, 199] as [number, number, number], // #FEF3C7
        statusPartialBorderRgb: [253, 230, 138] as [number, number, number], // #FDE68A

        statusDraftTextRgb: [71, 85, 105] as [number, number, number], // #475569
        statusDraftBgRgb: [241, 245, 249] as [number, number, number], // #F1F5F9
        statusDraftBorderRgb: [203, 213, 225] as [number, number, number], // #CBD5E1
    },
    fonts: {
        family: 'helvetica',
    },
    layout: {
        pageWidth: 595.28, // A4 width (pt)
        pageHeight: 841.89, // A4 height (pt)
        marginLeft: 36,
        marginRight: 36,
        marginTop: 36,
        marginBottom: 38,
        contentWidth: 523.28, // 595.28 - 72
    },
}

// =============================================================================
// CENTRALIZED FORMATTERS & HELPERS
// =============================================================================

export function formatPdfINR(amount: number): string {
    const safeAmount = Number.isFinite(amount) ? amount : 0
    return `Rs ${new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeAmount)}`
}

export function formatPdfRate(rate: number): string {
    const safeRate = Number.isFinite(rate) ? rate : 0
    return `Rs ${new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeRate)}/m`
}

export function formatPdfMeters(meters: number): string {
    const safeMeters = Number.isFinite(meters) ? meters : 0
    return `${new Intl.NumberFormat('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(safeMeters)} m`
}

export function formatPdfDate(value: string | null | undefined): string {
    if (!value) return '—'
    const cleanDate = value.slice(0, 10)
    const [year, month, day] = cleanDate.split('-').map(Number)
    if (![year, month, day].every(Number.isFinite)) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
    }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatPdfDateTime(date: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Asia/Kolkata',
    }).format(date)
}

export function formatWorkerPaymentMeta(
    paidAt?: string | null,
    mode?: BasePayrollPaymentMode | null,
): string {
    const dateFormatted = formatPdfDate(paidAt)
    const hasDate = Boolean(paidAt && dateFormatted !== '—')
    const hasMode = Boolean(mode)
    const modeText = mode ? paymentModeLabel(mode) : ''

    if (hasDate && hasMode) {
        return `· Paid ${dateFormatted} by ${modeText}`
    }
    if (hasDate) {
        return `· Paid ${dateFormatted}`
    }
    if (hasMode) {
        return `· Payment: ${modeText}`
    }
    return ''
}

export function paymentModeLabel(mode: BasePayrollPaymentMode): string {
    if (mode === 'bank_transfer') return 'Bank Transfer'
    if (mode === 'upi') return 'UPI'
    if (mode === 'cheque') return 'Cheque'
    return 'Cash'
}

export function sanitizePdfText(value: unknown, fallback = ''): string {
    if (value === null || value === undefined) return fallback
    return String(value)
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || fallback
}

export function sanitizeFilenamePart(value: string, fallback = 'Weavly'): string {
    const cleaned = value
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-zA-Z0-9_.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^[._-]+|[._-]+$/g, '')
        .slice(0, 60)
    return cleaned || fallback
}

export function buildBasePayrollPdfFilename(
    factoryName: string | undefined,
    start: string,
    end: string,
): string {
    const safeFactory = sanitizeFilenamePart(factoryName || 'Weavly')
    const safeStart = sanitizeFilenamePart(start, 'start')
    const safeEnd = sanitizeFilenamePart(end, 'end')
    return `${safeFactory}_Payroll_${safeStart}_to_${safeEnd}.pdf`
}

// =============================================================================
// NORMALIZED DATA SHAPE & SETTLEMENT STATE
// =============================================================================

export type PayrollSettlementState = 'draft' | 'partial' | 'settled'

export type NormalizedPayrollPdfData = {
    factoryName: string
    periodKey: string
    periodStart: string
    periodEnd: string
    periodRangeLabel: string
    generatedAtLabel: string
    settlementState: PayrollSettlementState
    statusLabel: string
    isSettled: boolean
    totalWorkers: number
    totalMachines: number
    totalMeters: number
    totalGrossPay: number
    totalAdvanceRecovered: number
    totalNetPayout: number
    paymentModesSummary: string
    workers: BasePayrollHistoryWorker[]
}

/**
 * Derives document-level settlement state conservatively based on domain rules:
 * - 'settled': All workers in the register have recorded paidAt dates (or explicit period status)
 * - 'partial': At least 1 worker is settled, but other workers remain outstanding
 * - 'draft': No workers in the register have recorded paidAt dates
 */
export function derivePayrollSettlementState(
    period: BasePayrollHistoryPeriod & { status?: PayrollSettlementState | string },
): PayrollSettlementState {
    // 1. Explicit canonical period status takes direct precedence
    if (period.status === 'settled' || period.status === 'partial' || period.status === 'draft') {
        return period.status
    }

    const workers = period.workers || []
    if (workers.length === 0) {
        return 'draft'
    }

    const settledCount = workers.filter(w => Boolean(w.paidAt)).length

    // 2. All workers paid -> fully settled
    if (settledCount === workers.length) {
        return 'settled'
    }
    // 3. Some workers paid, some pending -> partially settled
    if (settledCount > 0) {
        return 'partial'
    }
    // 4. No workers paid -> draft
    return 'draft'
}

export function normalizePayrollPdfData(
    period: BasePayrollHistoryPeriod,
    factoryName?: string,
): NormalizedPayrollPdfData {
    const factory = sanitizePdfText(factoryName, 'Weavly Payroll')
    const startFormatted = formatPdfDate(period.start)
    const endFormatted = formatPdfDate(period.end)
    const periodRangeLabel = `${startFormatted} – ${endFormatted}`
    const modes = period.paymentModes.map(m => paymentModeLabel(m))
    const uniqueModes = [...new Set(modes)]
    const paymentModesSummary = uniqueModes.length > 0 ? uniqueModes.join(', ') : 'Settled'

    // Conservative canonical settlement state derivation
    const settlementState = derivePayrollSettlementState(period)
    const isSettled = settlementState === 'settled'
    const statusLabel = settlementState === 'settled'
        ? 'Settled'
        : settlementState === 'partial'
            ? 'Partially Settled'
            : 'Draft'

    return {
        factoryName: factory,
        periodKey: period.key,
        periodStart: period.start,
        periodEnd: period.end,
        periodRangeLabel,
        generatedAtLabel: formatPdfDateTime(new Date()),
        settlementState,
        statusLabel,
        isSettled,
        totalWorkers: period.workers.length,
        totalMachines: period.machines.length,
        totalMeters: period.totalMeters || 0,
        totalGrossPay: period.totalGrossPay || 0,
        totalAdvanceRecovered: period.totalAdvanceRecovered || 0,
        totalNetPayout: period.totalNetPayout || 0,
        paymentModesSummary,
        workers: period.workers,
    }
}

// =============================================================================
// PDF RENDERER IMPLEMENTATION
// =============================================================================

export class BasePayrollPdfRenderer {
    private doc: jsPDF
    private data: NormalizedPayrollPdfData
    private currentY: number
    private readonly left: number
    private readonly right: number
    private readonly contentWidth: number
    private readonly bottomLimit: number

    constructor(data: NormalizedPayrollPdfData) {
        this.data = data
        this.doc = new jsPDF({
            unit: 'pt',
            format: 'a4',
            orientation: 'portrait',
            compress: true,
        })
        this.left = PDF_THEME.layout.marginLeft
        this.contentWidth = PDF_THEME.layout.contentWidth
        this.right = this.left + this.contentWidth
        this.bottomLimit = PDF_THEME.layout.pageHeight - PDF_THEME.layout.marginBottom
        this.currentY = PDF_THEME.layout.marginTop

        this.setDocumentProperties()
    }

    private setDocumentProperties() {
        this.doc.setProperties({
            title: `${this.data.factoryName} — Payroll Settlement Register (${this.data.periodRangeLabel})`,
            subject: 'Official earning snapshots and payroll settlement ledger',
            author: this.data.factoryName,
            creator: 'Weavly (Operational Factory OS)',
        })
    }

    /**
     * Checks if `heightNeeded` fits on current page.
     * If not, starts a new page and calls optional `onContinuation` callback.
     */
    private ensureSpace(heightNeeded: number, onContinuation?: () => void) {
        if (this.currentY + heightNeeded > this.bottomLimit) {
            this.startNewPage()
            if (onContinuation) {
                onContinuation()
            }
        }
    }

    private startNewPage() {
        this.doc.addPage()
        this.drawPageAccentBar()
        this.drawContinuationHeader()
        this.currentY = 48
    }

    /** Top 3pt accent rule: Saffron (72%) + Loom Navy (28%) */
    private drawPageAccentBar() {
        const saffronWidth = PDF_THEME.layout.pageWidth * 0.72
        const navyWidth = PDF_THEME.layout.pageWidth - saffronWidth

        this.doc.setFillColor(...PDF_THEME.colors.saffronRgb)
        this.doc.rect(0, 0, saffronWidth, 3.5, 'F')

        this.doc.setFillColor(...PDF_THEME.colors.navyRgb)
        this.doc.rect(saffronWidth, 0, navyWidth, 3.5, 'F')
    }

    /** First Page Branded Masthead */
    private drawMasthead() {
        this.drawPageAccentBar()
        let y = 34

        // 1. Factory Legal Identity (dominant, with multi-line wrapping for long names)
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(14)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        const factoryLines = this.doc.splitTextToSize(
            this.data.factoryName,
            this.contentWidth - 170,
        ) as string[]
        this.doc.text(factoryLines, this.left, y)

        // 2. Period Range & Status on Right
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(10)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        this.doc.text(this.data.periodRangeLabel, this.right, y, { align: 'right' })

        y += Math.max(14, factoryLines.length * 12 + 3)

        // 3. Document Title
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(10.5)
        this.doc.setTextColor(...PDF_THEME.colors.saffronDarkRgb)
        this.doc.text('PAYROLL SETTLEMENT REGISTER', this.left, y)

        // Status pill on right
        const statusText = this.data.statusLabel
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(7.5)
        const textWidth = this.doc.getTextWidth(statusText)
        const statusPillWidth = Math.max(50, textWidth + 14)
        const statusPillHeight = 14
        const statusPillX = this.right - statusPillWidth
        const statusPillY = y - 10

        let bgRgb = PDF_THEME.colors.statusSettledBgRgb
        let borderRgb = PDF_THEME.colors.statusSettledBorderRgb
        let textRgb = PDF_THEME.colors.statusSettledTextRgb

        if (this.data.settlementState === 'partial') {
            bgRgb = PDF_THEME.colors.statusPartialBgRgb
            borderRgb = PDF_THEME.colors.statusPartialBorderRgb
            textRgb = PDF_THEME.colors.statusPartialTextRgb
        } else if (this.data.settlementState === 'draft') {
            bgRgb = PDF_THEME.colors.statusDraftBgRgb
            borderRgb = PDF_THEME.colors.statusDraftBorderRgb
            textRgb = PDF_THEME.colors.statusDraftTextRgb
        }

        this.doc.setFillColor(...bgRgb)
        this.doc.setDrawColor(...borderRgb)
        this.doc.setLineWidth(0.6)
        this.doc.roundedRect(statusPillX, statusPillY, statusPillWidth, statusPillHeight, 3, 3, 'FD')

        this.doc.setTextColor(...textRgb)
        this.doc.text(statusText, statusPillX + statusPillWidth / 2, statusPillY + 9.5, { align: 'center' })

        y += 11

        // 4. Subtitle / Metadata
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(8)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('Earning snapshots & settlement ledger', this.left, y)

        // Generated timestamp
        this.doc.text(`Generated: ${this.data.generatedAtLabel}`, this.right, y, { align: 'right' })

        y += 10

        // 5. Divider Line
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.75)
        this.doc.line(this.left, y, this.right, y)

        this.currentY = y + 10
    }

    /** Continuation Header on Page 2+ */
    private drawContinuationHeader() {
        const y = 28
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(8)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        const rightText = `PAYROLL SETTLEMENT REGISTER · ${this.data.periodRangeLabel}`
        const rightWidth = this.doc.getTextWidth(rightText)

        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(8.5)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)

        const maxFactoryWidth = this.contentWidth - rightWidth - 16
        const factoryText = this.doc.getTextWidth(this.data.factoryName) > maxFactoryWidth
            ? (this.doc.splitTextToSize(this.data.factoryName, maxFactoryWidth)[0] || this.data.factoryName)
            : this.data.factoryName
        this.doc.text(factoryText, this.left, y)

        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(8)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text(rightText, this.right, y, { align: 'right' })

        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.6)
        this.doc.line(this.left, y + 6, this.right, y + 6)
    }

    /** Executive Financial Summary Band */
    private drawRegisterSummary() {
        const cardHeight = 44
        const y = this.currentY
        const colWidth = this.contentWidth / 4

        // Outer rounded container
        this.doc.setFillColor(...PDF_THEME.colors.surfaceLedgerRgb)
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.75)
        this.doc.roundedRect(this.left, y, this.contentWidth, cardHeight, 4, 4, 'FD')

        // Internal vertical column divider lines
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.5)
        for (let i = 1; i < 4; i++) {
            const x = this.left + colWidth * i
            this.doc.line(x, y, x, y + cardHeight)
        }

        // Highlight Net Disbursed cell background (col 4)
        const col4X = this.left + colWidth * 3
        this.doc.setFillColor(...PDF_THEME.colors.surfaceSoftRgb)
        this.doc.roundedRect(col4X, y, colWidth, cardHeight, 0, 0, 'F')
        this.doc.roundedRect(this.left, y, this.contentWidth, cardHeight, 4, 4, 'S') // redraw clean border

        // Metric 1: Total Production
        let cx = this.left + 10
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('TOTAL PRODUCTION', cx, y + 12)
        this.doc.setFontSize(11)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        this.doc.text(formatPdfMeters(this.data.totalMeters), cx, y + 26)
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text(
            `${this.data.totalMachines} machine${this.data.totalMachines === 1 ? '' : 's'} recorded`,
            cx,
            y + 36,
        )

        // Metric 2: Gross Earnings
        cx = this.left + colWidth + 10
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('GROSS WAGES', cx, y + 12)
        this.doc.setFontSize(11)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        this.doc.text(formatPdfINR(this.data.totalGrossPay), cx, y + 26)
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text(
            `${this.data.totalWorkers} worker${this.data.totalWorkers === 1 ? '' : 's'} settled`,
            cx,
            y + 36,
        )

        // Metric 3: Advances Recovered
        cx = this.left + colWidth * 2 + 10
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('ADVANCE RECOVERED', cx, y + 12)
        this.doc.setFontSize(11)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        this.doc.text(formatPdfINR(this.data.totalAdvanceRecovered), cx, y + 26)
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('Deducted from upaad', cx, y + 36)

        // Metric 4: Net Disbursed (Dominant)
        cx = this.left + colWidth * 3 + 10
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.saffronDarkRgb)
        this.doc.text('NET DISBURSED', cx, y + 12)
        this.doc.setFontSize(12)
        this.doc.setTextColor(...PDF_THEME.colors.saffronDarkRgb)
        this.doc.text(formatPdfINR(this.data.totalNetPayout), cx, y + 26)
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text(`Disbursed via ${this.data.paymentModesSummary}`, cx, y + 36)

        this.currentY = y + cardHeight + 14
    }

    /** Earnings Table Column Header Row */
    private drawEarningsTableHeader(y: number, isSalary = false) {
        const h = 16
        this.doc.setFillColor(...PDF_THEME.colors.surfaceMutedRgb)
        this.doc.rect(this.left, y, this.contentWidth, h, 'F')

        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.6)
        this.doc.line(this.left, y, this.right, y)
        this.doc.line(this.left, y + h, this.right, y + h)

        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(7)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)

        // Column Coordinates:
        // Col 1: Machine (x: left + 8, left aligned)
        // Col 2: Costing (x: left + 105, left aligned, wraps at 155pt)
        // Col 3: Production (x: left + 320, right aligned)
        // Col 4: Rate (x: left + 410, right aligned)
        // Col 5: Gross (x: right - 8, right aligned)
        this.doc.text(isSalary ? 'PAY BASIS' : 'MACHINE / LOOM', this.left + 8, y + 11)
        this.doc.text(isSalary ? 'SALARY PERIOD' : 'FABRIC QUALITY / COSTING', this.left + 105, y + 11)
        this.doc.text('PRODUCTION', this.left + 320, y + 11, { align: 'right' })
        this.doc.text('PAY RATE', this.left + 410, y + 11, { align: 'right' })
        this.doc.text('GROSS EARNINGS', this.right - 8, y + 11, { align: 'right' })

        return y + h
    }

    /** Worker Settlement Block */
    private drawWorkerSection(worker: BasePayrollHistoryWorker, index: number) {
        const isSalary = worker.earnings.some(earning => earning.payType === 'fixed_monthly')
        const workerName = sanitizePdfText(worker.workerName, `Worker #${index + 1}`)

        // Worker Orphan Rule:
        // If a worker has <= 3 earnings rows, keep the whole block (header, table, rows, reconciliation) together.
        // If a worker has > 3 rows, ensure room for header + table header + 2 rows before starting.
        const earningsCount = Math.max(1, worker.earnings.length)
        const totalEstimatedWorkerHeight = 22 + 16 + earningsCount * 18 + 16 + 50 + 12
        const minWorkerHeight = earningsCount <= 3 ? Math.min(totalEstimatedWorkerHeight, 180) : 80
        this.ensureSpace(minWorkerHeight)

        let y = this.currentY

        // 1. Worker Header Bar
        const headerH = 22
        this.doc.setFillColor(...PDF_THEME.colors.surfaceLedgerRgb)
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.6)
        this.doc.roundedRect(this.left, y, this.contentWidth, headerH, 3, 3, 'FD')

        // Worker Name & Net Pay sizing
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(9.5)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        const nameWidth = this.doc.getTextWidth(workerName)

        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(8)
        this.doc.setTextColor(...PDF_THEME.colors.textBodyRgb)
        const summaryText = `Net Pay: `
        const netFormatted = formatPdfINR(worker.netPayout)
        const netW = this.doc.getTextWidth(netFormatted)
        const sumW = this.doc.getTextWidth(summaryText)

        // Draw worker name with boundary check
        const maxNameWidth = this.contentWidth - netW - sumW - 30
        const displayedName = nameWidth > maxNameWidth
            ? (this.doc.splitTextToSize(workerName, maxNameWidth)[0] || workerName)
            : workerName
        const displayedNameWidth = this.doc.getTextWidth(displayedName)
        this.doc.text(displayedName, this.left + 8, y + 14)

        // Secondary payment metadata without competing visual weight
        const metaText = formatWorkerPaymentMeta(worker.paidAt, worker.paymentMode)
        if (metaText) {
            const availableMetaWidth = this.contentWidth - displayedNameWidth - netW - sumW - 36
            if (availableMetaWidth > 40) {
                this.doc.setFont('helvetica', 'normal')
                this.doc.setFontSize(7.5)
                this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
                const displayedMeta = this.doc.getTextWidth(metaText) > availableMetaWidth
                    ? (this.doc.splitTextToSize(metaText, availableMetaWidth)[0] || '')
                    : metaText
                this.doc.text(displayedMeta, this.left + 12 + displayedNameWidth, y + 14)
            }
        }

        // Right side Net Pay
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(8)
        this.doc.setTextColor(...PDF_THEME.colors.textBodyRgb)
        this.doc.text(summaryText, this.right - 8 - netW, y + 14, { align: 'right' })
        this.doc.setFont('helvetica', 'bold')
        this.doc.setTextColor(...PDF_THEME.colors.saffronDarkRgb)
        this.doc.text(netFormatted, this.right - 8, y + 14, { align: 'right' })

        y += headerH + 2
        this.currentY = y

        // 2. Earnings Table Header
        y = this.drawEarningsTableHeader(y, isSalary)
        this.currentY = y

        // 3. Earning Rows (with continuation support)
        const earnings = worker.earnings.length > 0 ? worker.earnings : [
            {
                machineId: null,
                payType: 'piece_rate' as const,
                machineLabel: 'General',
                costingLabel: 'Weaving Wages',
                rate: 0,
                meters: worker.meters,
                grossPay: worker.grossPay,
                productionDates: [],
            },
        ]

        earnings.forEach((earning, rowIndex) => {
            const costingLines = this.doc.splitTextToSize(
                sanitizePdfText(earning.costingLabel, 'Standard Weaving'),
                155,
            ) as string[]
            const machineLabel = sanitizePdfText(earning.machineLabel, 'Loom')
            const machineLines = this.doc.splitTextToSize(machineLabel, 92) as string[]
            const maxLines = Math.max(costingLines.length, machineLines.length)
            const rowHeight = Math.max(16, maxLines * 9.5 + 6)

            // Check space for row; if page break occurs, draw worker continuation header & table header
            this.ensureSpace(rowHeight + 4, () => {
                this.doc.setFont('helvetica', 'bold')
                this.doc.setFontSize(8.5)
                this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
                this.doc.text(`${workerName} (Continued)`, this.left, this.currentY + 10)
                this.currentY += 16
                this.currentY = this.drawEarningsTableHeader(this.currentY, isSalary)
            })

            y = this.currentY

            // Alternating Row Background
            if (rowIndex % 2 === 1) {
                this.doc.setFillColor(...PDF_THEME.colors.surfaceRowAltRgb)
                this.doc.rect(this.left, y, this.contentWidth, rowHeight, 'F')
            }

            // Cell Dividers
            this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
            this.doc.setLineWidth(0.4)
            this.doc.line(this.left, y + rowHeight, this.right, y + rowHeight)

            // Row Data
            this.doc.setFont('helvetica', 'bold')
            this.doc.setFontSize(8)
            this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
            this.doc.text(machineLines, this.left + 8, y + 11)

            this.doc.setFont('helvetica', 'normal')
            this.doc.setTextColor(...PDF_THEME.colors.textBodyRgb)
            this.doc.text(costingLines, this.left + 105, y + 11)

            // Right-aligned numbers (tabular)
            this.doc.text(earning.payType === 'fixed_monthly' ? '-' : formatPdfMeters(earning.meters), this.left + 320, y + 11, { align: 'right' })
            this.doc.text(earning.payType === 'fixed_monthly' ? `${formatPdfINR(earning.rate)}/mo` : formatPdfRate(earning.rate), this.left + 410, y + 11, { align: 'right' })

            this.doc.setFont('helvetica', 'bold')
            this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
            this.doc.text(formatPdfINR(earning.grossPay), this.right - 8, y + 11, { align: 'right' })

            this.currentY = y + rowHeight
        })

        // Subtotal row for worker production & gross
        const subtotalHeight = 16
        this.ensureSpace(subtotalHeight + 4)
        y = this.currentY

        this.doc.setFillColor(...PDF_THEME.colors.surfaceLedgerRgb)
        this.doc.rect(this.left, y, this.contentWidth, subtotalHeight, 'F')
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.6)
        this.doc.line(this.left, y + subtotalHeight, this.right, y + subtotalHeight)

        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(7.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text(isSalary ? 'Total salary earnings' : 'Cumulative worker production', this.left + 8, y + 11)

        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        this.doc.text(isSalary ? '-' : formatPdfMeters(worker.meters), this.left + 320, y + 11, { align: 'right' })

        this.doc.setFontSize(7.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('Gross:', this.left + 410, y + 11, { align: 'right' })

        this.doc.setFontSize(8)
        this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
        this.doc.text(formatPdfINR(worker.grossPay), this.right - 8, y + 11, { align: 'right' })

        this.currentY = y + subtotalHeight + 6

        // 4. Financial Reconciliation Section
        this.drawWorkerReconciliation(worker)
    }

    /**
     * Financial Reconciliation with explicit mathematical hierarchy:
     * 1. Payroll calculation (Gross - Advance Deducted = NET DISBURSED)
     * 2. Advance reconciliation (Before - Deducted = Carried Forward)
     */
    private drawWorkerReconciliation(worker: BasePayrollHistoryWorker) {
        const boxHeight = 50
        this.ensureSpace(boxHeight + 6, () => {
            this.doc.setFont('helvetica', 'bold')
            this.doc.setFontSize(8)
            this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
            this.doc.text(`${worker.workerName} — Settlement Reconciliation`, this.left, this.currentY + 10)
            this.currentY += 16
        })

        const y = this.currentY
        const gap = 8
        const halfWidth = (this.contentWidth - gap) / 2

        // -------------------------------------------------------------
        // Box 1: Payroll Calculation (Arithmetic)
        // -------------------------------------------------------------
        const box1X = this.left
        this.doc.setFillColor(...PDF_THEME.colors.whiteRgb)
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.6)
        this.doc.roundedRect(box1X, y, halfWidth, boxHeight, 3, 3, 'FD')

        // Top banner for Box 1
        this.doc.setFillColor(...PDF_THEME.colors.surfaceMutedRgb)
        this.doc.rect(box1X, y, halfWidth, 13, 'F')
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('PAYROLL CALCULATION', box1X + 6, y + 9)

        // Arithmetic lines
        this.doc.setFont('helvetica', 'normal')
        this.doc.setFontSize(7.5)
        this.doc.setTextColor(...PDF_THEME.colors.textBodyRgb)
        this.doc.text('Gross Earnings', box1X + 8, y + 23)
        this.doc.text(formatPdfINR(worker.grossPay), box1X + halfWidth - 8, y + 23, { align: 'right' })

        this.doc.text('Less: Advance Recovered', box1X + 8, y + 33)
        const advanceDeductedText = worker.advanceRecovered > 0 ? `-${formatPdfINR(worker.advanceRecovered)}` : 'Rs 0.00'
        this.doc.text(advanceDeductedText, box1X + halfWidth - 8, y + 33, { align: 'right' })

        // Net Disbursed Highlighted Bar
        const netBarY = y + 37
        this.doc.setFillColor(...PDF_THEME.colors.surfaceSoftRgb)
        this.doc.rect(box1X, netBarY, halfWidth, 13, 'F')
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.4)
        this.doc.line(box1X, netBarY, box1X + halfWidth, netBarY)

        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(7.5)
        this.doc.setTextColor(...PDF_THEME.colors.saffronDeepRgb)
        this.doc.text('NET DISBURSED', box1X + 8, netBarY + 9)
        this.doc.setFontSize(8.5)
        this.doc.text(formatPdfINR(worker.netPayout), box1X + halfWidth - 8, netBarY + 9, { align: 'right' })

        // -------------------------------------------------------------
        // Box 2: Advance (Upaad) Reconciliation
        // -------------------------------------------------------------
        const box2X = this.left + halfWidth + gap
        this.doc.setFillColor(...PDF_THEME.colors.whiteRgb)
        this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
        this.doc.setLineWidth(0.6)
        this.doc.roundedRect(box2X, y, halfWidth, boxHeight, 3, 3, 'FD')

        // Top banner for Box 2
        this.doc.setFillColor(...PDF_THEME.colors.surfaceMutedRgb)
        this.doc.rect(box2X, y, halfWidth, 13, 'F')
        this.doc.setFont('helvetica', 'bold')
        this.doc.setFontSize(6.5)
        this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
        this.doc.text('ADVANCE (UPAAD) RECONCILIATION', box2X + 6, y + 9)

        const hasAdvanceActivity = worker.advanceBalanceBefore > 0 || worker.advanceRecovered > 0 || worker.remainingAdvanceBalance > 0

        if (hasAdvanceActivity) {
            this.doc.setFont('helvetica', 'normal')
            this.doc.setFontSize(7.5)
            this.doc.setTextColor(...PDF_THEME.colors.textBodyRgb)
            this.doc.text('Advance Balance Before', box2X + 8, y + 23)
            this.doc.text(formatPdfINR(worker.advanceBalanceBefore), box2X + halfWidth - 8, y + 23, { align: 'right' })

            this.doc.text('Advance Deducted in Period', box2X + 8, y + 33)
            this.doc.text(advanceDeductedText, box2X + halfWidth - 8, y + 33, { align: 'right' })

            // Advance Carried Forward
            const advBarY = y + 37
            this.doc.setFillColor(...PDF_THEME.colors.surfaceLedgerRgb)
            this.doc.rect(box2X, advBarY, halfWidth, 13, 'F')
            this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
            this.doc.setLineWidth(0.4)
            this.doc.line(box2X, advBarY, box2X + halfWidth, advBarY)

            this.doc.setFont('helvetica', 'bold')
            this.doc.setFontSize(7.5)
            this.doc.setTextColor(...PDF_THEME.colors.navyRgb)
            this.doc.text('Advance Carried Forward', box2X + 8, advBarY + 9)
            this.doc.text(formatPdfINR(worker.remainingAdvanceBalance), box2X + halfWidth - 8, advBarY + 9, { align: 'right' })
        } else {
            // Clean state when worker has no advance debt
            this.doc.setFont('helvetica', 'normal')
            this.doc.setFontSize(7.5)
            this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
            this.doc.text('No outstanding advance balance', box2X + 8, y + 28)
            this.doc.text('Rs 0.00', box2X + halfWidth - 8, y + 28, { align: 'right' })

            const advBarY = y + 37
            this.doc.setFillColor(...PDF_THEME.colors.surfaceLedgerRgb)
            this.doc.rect(box2X, advBarY, halfWidth, 13, 'F')
            this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
            this.doc.setLineWidth(0.4)
            this.doc.line(box2X, advBarY, box2X + halfWidth, advBarY)

            this.doc.setFont('helvetica', 'bold')
            this.doc.setFontSize(7.5)
            this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
            this.doc.text('Carried Balance', box2X + 8, advBarY + 9)
            this.doc.text('Rs 0.00', box2X + halfWidth - 8, advBarY + 9, { align: 'right' })
        }

        this.currentY = y + boxHeight + 14
    }

    /** Multi-page Footer & Pagination Pass */
    private drawFooters() {
        const totalPages = this.doc.getNumberOfPages()
        const footerY = PDF_THEME.layout.pageHeight - 16

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
            this.doc.setPage(pageNum)

            // Top footer hairline
            this.doc.setDrawColor(...PDF_THEME.colors.hairlineRgb)
            this.doc.setLineWidth(0.5)
            this.doc.line(this.left, footerY - 8, this.right, footerY - 8)

            // Left: Software provenance strictly conditioned on settlement state
            this.doc.setFont('helvetica', 'normal')
            this.doc.setFontSize(7)
            this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
            const provenanceText = this.data.isSettled
                ? 'Generated with Weavly · Settled record'
                : 'Generated with Weavly'
            this.doc.text(
                provenanceText,
                this.left,
                footerY,
            )

            // Right: Page X of Y
            this.doc.setFont('helvetica', 'bold')
            this.doc.setFontSize(7.5)
            this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
            this.doc.text(
                `Page ${pageNum} of ${totalPages}`,
                this.right,
                footerY,
                { align: 'right' },
            )
        }
    }

    /** Renders the complete PDF document */
    public render(): jsPDF {
        this.drawMasthead()
        this.drawRegisterSummary()

        if (this.data.workers.length === 0) {
            this.doc.setFont('helvetica', 'italic')
            this.doc.setFontSize(9)
            this.doc.setTextColor(...PDF_THEME.colors.textMutedRgb)
            this.doc.text('No worker settlements recorded in this pay period.', this.left, this.currentY + 20)
        } else {
            this.data.workers.forEach((worker, index) => {
                this.drawWorkerSection(worker, index)
            })
        }

        this.drawFooters()
        return this.doc
    }
}

// =============================================================================
// MAIN ENTRY POINT FUNCTION
// =============================================================================

export type GeneratePayrollPdfOptions = {
    factoryName?: string
    autoSave?: boolean
}

export async function generateBasePayrollPdf(
    period: BasePayrollHistoryPeriod,
    options: GeneratePayrollPdfOptions = {},
): Promise<{
    doc: jsPDF
    filename: string
    blob: Blob
}> {
    const activeWorkers = period.workers.filter(worker => worker.status !== 'reversed')
    if (activeWorkers.length === 0) throw new Error('This period has no active payment records to export.')
    const normalizedData = normalizePayrollPdfData({ ...period, workers: activeWorkers }, options.factoryName)
    const renderer = new BasePayrollPdfRenderer(normalizedData)
    const doc = renderer.render()
    const filename = buildBasePayrollPdfFilename(
        options.factoryName,
        period.start,
        period.end,
    )

    const blob = doc.output('blob')

    if (options.autoSave) {
        doc.save(filename)
    }

    return {
        doc,
        filename,
        blob,
    }
}
