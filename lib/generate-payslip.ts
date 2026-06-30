import { jsPDF } from 'jspdf'
import { formatINR } from './finance'
import { formatDateOnly } from './format'
import { formatToSurat } from './time'

export type PayslipAdvanceRecovery = {
    date?: string | null
    label?: string | null
    recovered: number
}

export type PayslipManualAdjustment = {
    type: string
    reason: string
    amount: number
    note?: string | null
}

export type PayslipItemization = {
    advances_recovered?: PayslipAdvanceRecovery[]
    manualAdjustments?: PayslipManualAdjustment[]
    inamTotal?: number
    kapaatTotal?: number
    manualAdjustmentTotal?: number
    advanceRecovery?: number
    pfEmployee?: number
    esicEmployee?: number
    remainingDebt?: number
    paymentMode?: string | null
}

export type PayslipSettlementRow = {
    label: string
    value: string
    kind: 'earning' | 'deduction' | 'net' | 'info'
}

type PayslipBaseData = {
    factoryName: string
    month: string
    workerName: string
    cycleStartDate: string
    cycleEndDate: string
    advanceDeducted: number
    remainingDebt: number
    netPay: number
    paymentMode?: string | null
    itemization?: PayslipItemization
}

/**
 * Generate a PDF payslip for a meter-based worker.
 * Downloads the file in the browser.
 */
export function generateMeterPayslip(data: PayslipBaseData & {
    machines: { machineName: string; orderLabel?: string; meters: number; rate: number; pay: number }[]
    totalMeters: number
    totalPay: number
}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = addPayslipHeader(doc, pageWidth, data, 'Meter Worker (Piece Rate)')

    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Machine', 20, y)
    doc.text('Meters', 90, y, { align: 'right' })
    doc.text('Rate/m', 120, y, { align: 'right' })
    doc.text('Amount', pageWidth - 20, y, { align: 'right' })
    y += 2
    doc.setDrawColor(220)
    doc.line(20, y, pageWidth - 20, y)
    y += 6

    doc.setFont('helvetica', 'normal')
    for (const machine of data.machines) {
        doc.text(safePdfText(machine.machineName), 20, y)
        doc.text(machine.meters.toFixed(1), 90, y, { align: 'right' })
        doc.text(`${formatINR(machine.rate)}/m`, 120, y, { align: 'right' })
        doc.text(formatINR(machine.pay), pageWidth - 20, y, { align: 'right' })
        y += 5

        if (machine.orderLabel) {
            doc.setFontSize(8)
            doc.setTextColor(100)
            doc.text(safePdfText(machine.orderLabel), 22, y)
            doc.setTextColor(0)
            doc.setFontSize(10)
            y += 4
        }
    }

    y = addSettlementRows(doc, pageWidth, y + 2, {
        grossPay: data.totalPay,
        totalMeters: data.totalMeters,
        advanceDeducted: data.advanceDeducted,
        remainingDebt: data.remainingDebt,
        netPay: data.netPay,
        paymentMode: data.paymentMode,
        itemization: data.itemization,
    })

    addFooter(doc)
    doc.save(buildPayslipFilename(data.workerName, data.month))
}

/**
 * Generate a PDF payslip for a fixed/salaried worker.
 * Downloads the file in the browser.
 */
export function generateFixedPayslip(data: PayslipBaseData & {
    role: string
    monthlySalary: number
    daysWorked?: number
    earnedPay: number
}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = addPayslipHeader(doc, pageWidth, data, titleCase(data.role))

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text('Monthly Salary', 20, y)
    doc.text(formatINR(data.monthlySalary), pageWidth - 20, y, { align: 'right' })
    y += 6

    if (data.daysWorked !== undefined) {
        doc.text('Days Worked', 20, y)
        doc.text(`${data.daysWorked} / 30`, pageWidth - 20, y, { align: 'right' })
        y += 6

        doc.setTextColor(120)
        doc.setFontSize(9)
        doc.text(`Formula: ${formatINR(data.monthlySalary)} / 30 x ${data.daysWorked} days`, 20, y)
        doc.setTextColor(0)
        doc.setFontSize(10)
        y += 6
    }

    y = addSettlementRows(doc, pageWidth, y + 2, {
        grossPay: data.earnedPay,
        advanceDeducted: data.advanceDeducted,
        remainingDebt: data.remainingDebt,
        netPay: data.netPay,
        paymentMode: data.paymentMode,
        itemization: data.itemization,
    })

    addFooter(doc)
    doc.save(buildPayslipFilename(data.workerName, data.month))
}

export function sanitizePayslipFilenamePart(value: string, fallback = 'Worker'): string {
    const cleaned = value
        .trim()
        .replace(/&/g, 'and')
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^[_-]+|[_-]+$/g, '')
        .slice(0, 64)

    return cleaned || fallback
}

export function buildPayslipFilename(workerName: string, month: string): string {
    const safeWorker = sanitizePayslipFilenamePart(workerName)
    const safeMonth = sanitizePayslipFilenamePart(month, 'Cycle')
    return `payslip-${safeWorker}-${safeMonth}.pdf`
}

export function buildPayslipSettlementRows(data: {
    grossPay: number
    advanceDeducted: number
    remainingDebt: number
    netPay: number
    paymentMode?: string | null
    itemization?: PayslipItemization
}): PayslipSettlementRow[] {
    const itemization = data.itemization
    const inamTotal = toAmount(itemization?.inamTotal)
    const kapaatTotal = toAmount(itemization?.kapaatTotal)
    const pfEmployee = toAmount(itemization?.pfEmployee)
    const esicEmployee = toAmount(itemization?.esicEmployee)
    const advanceDeducted = toAmount(itemization?.advanceRecovery ?? data.advanceDeducted)
    const remainingDebt = toAmount(itemization?.remainingDebt ?? data.remainingDebt)
    const paymentMode = data.paymentMode ?? itemization?.paymentMode ?? null

    const rows: PayslipSettlementRow[] = [
        { label: 'Gross Pay', value: formatINR(data.grossPay), kind: 'earning' },
    ]

    if (inamTotal > 0) rows.push({ label: 'Inam Bonus', value: formatINR(inamTotal), kind: 'earning' })
    if (kapaatTotal > 0) rows.push({ label: 'Kapaat Deduction', value: `-${formatINR(kapaatTotal)}`, kind: 'deduction' })
    if (advanceDeducted > 0) rows.push({ label: 'Advance Recovered', value: `-${formatINR(advanceDeducted)}`, kind: 'deduction' })
    if (pfEmployee > 0) rows.push({ label: 'PF Employee', value: `-${formatINR(pfEmployee)}`, kind: 'deduction' })
    if (esicEmployee > 0) rows.push({ label: 'ESI Employee', value: `-${formatINR(esicEmployee)}`, kind: 'deduction' })

    rows.push({ label: 'Net Pay', value: formatINR(data.netPay), kind: 'net' })

    if (remainingDebt > 0) rows.push({ label: 'Carry-Forward Debt', value: formatINR(remainingDebt), kind: 'info' })
    if (paymentMode) rows.push({ label: 'Payment Mode', value: safePdfText(paymentMode), kind: 'info' })

    return rows
}

function addPayslipHeader(
    doc: jsPDF,
    pageWidth: number,
    data: PayslipBaseData,
    workerTypeLabel: string
) {
    let y = 20

    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(safePdfText(data.factoryName), pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text('Monthly Payslip', pageWidth / 2, y, { align: 'center' })
    y += 12

    doc.setTextColor(0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Worker:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(safePdfText(data.workerName), 50, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Month:', pageWidth - 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMonthLabel(data.month), pageWidth - 55, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.text('Type:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(safePdfText(workerTypeLabel), 50, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Date:', pageWidth - 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatToSurat(new Date(), 'dd MMMM yyyy'), pageWidth - 55, y)
    y += 5

    doc.setFont('helvetica', 'bold')
    doc.text('Cycle:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`${formatDateOnly(data.cycleStartDate)} to ${formatDateOnly(data.cycleEndDate)}`, 50, y)
    y += 10

    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    return y + 8
}

function addSettlementRows(
    doc: jsPDF,
    pageWidth: number,
    y: number,
    data: {
        grossPay: number
        totalMeters?: number
        advanceDeducted: number
        remainingDebt: number
        netPay: number
        paymentMode?: string | null
        itemization?: PayslipItemization
    }
) {
    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    y += 6

    if (typeof data.totalMeters === 'number') {
        doc.setFont('helvetica', 'bold')
        doc.text('Total Meters', 20, y)
        doc.text(data.totalMeters.toFixed(1), 90, y, { align: 'right' })
        y += 6
    }

    for (const row of buildPayslipSettlementRows(data)) {
        doc.setFontSize(row.kind === 'net' ? 12 : 10)
        doc.setFont('helvetica', row.kind === 'net' ? 'bold' : 'normal')
        doc.setTextColor(row.kind === 'deduction' ? 180 : 0, row.kind === 'deduction' ? 80 : 0, 0)
        doc.text(row.label, 20, y)
        doc.text(row.value, pageWidth - 20, y, { align: 'right' })
        y += row.kind === 'net' ? 8 : 6
    }

    const manualAdjustments = data.itemization?.manualAdjustments ?? []
    if (manualAdjustments.length > 0) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100)
        for (const adjustment of manualAdjustments) {
            const sign = adjustment.type === 'inam' ? '+' : '-'
            const note = adjustment.note ? ` (${safePdfText(adjustment.note)})` : ''
            doc.text(
                `- ${safePdfText(adjustment.reason)}: ${sign}${formatINR(adjustment.amount)}${note}`,
                25,
                y
            )
            y += 4
        }
    }

    const advances = data.itemization?.advances_recovered || []
    if (advances.length > 0) {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(100)
        for (const advance of advances) {
            const date = advance.date ? formatDateOnly(advance.date, { day: '2-digit', month: 'short' }) : ''
            doc.text(`- ${date ? date + ': ' : ''}${safePdfText(advance.label || 'Upaad')}`, 25, y)
            doc.text(`- ${formatINR(advance.recovered)}`, pageWidth - 25, y, { align: 'right' })
            y += 4
        }
    }

    doc.setTextColor(0)
    return y + 10
}

function addFooter(doc: jsPDF) {
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setDrawColor(220)
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20)

    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.setFont('helvetica', 'normal')
    doc.text(
        'Generated by Weavly - This is a computer-generated document and does not require a signature.',
        pageWidth / 2,
        pageHeight - 14,
        { align: 'center' }
    )
}

function formatMonthLabel(ym: string): string {
    const [y, m] = ym.split('-')
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-IN', {
        month: 'long',
        year: 'numeric',
    })
}

function safePdfText(value: unknown): string {
    return String(value ?? '')
        .replace(/[\u0000-\u001f\u007f]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

function titleCase(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
}

function toAmount(value: unknown): number {
    const parsed = Number(value ?? 0)
    return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0
}
