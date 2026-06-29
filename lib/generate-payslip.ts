import { jsPDF } from 'jspdf'
import { formatINR } from './finance'
import { formatDateOnly } from './format'
import { formatToSurat } from './time'

export type PayslipAdvanceRecovery = {
    date?: string | null
    label?: string | null
    recovered: number
}

export type PayslipItemization = {
    advances_recovered?: PayslipAdvanceRecovery[]
}

/**
 * Generate a PDF payslip for a meter-based worker.
 * Downloads the file in the browser.
 */
export function generateMeterPayslip(data: {
    factoryName: string
    month: string
    workerName: string
    machines: { machineName: string; meters: number; rate: number; pay: number }[]
    totalMeters: number
    totalPay: number
    totalAdvances: number
    netPay: number
    itemization?: PayslipItemization
}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20

    // ── Header ──
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(data.factoryName, pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text('Monthly Payslip', pageWidth / 2, y, { align: 'center' })
    y += 12

    // ── Worker Info ──
    doc.setTextColor(0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Worker:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(data.workerName, 50, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Month:', pageWidth - 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMonthLabel(data.month), pageWidth - 55, y)
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.text('Type:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text('Meter Worker (Piece Rate)', 50, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Date:', pageWidth - 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatToSurat(new Date(), 'dd MMMM yyyy'), pageWidth - 55, y)
    y += 10

    // ── Divider ──
    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    y += 8

    // ── Machine Breakdown Table ──
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
        doc.text(machine.machineName, 20, y)
        doc.text(machine.meters.toFixed(1), 90, y, { align: 'right' })
        doc.text(`₹${machine.rate}`, 120, y, { align: 'right' })
        doc.text(formatINR(machine.pay), pageWidth - 20, y, { align: 'right' })
        y += 6
    }

    // ── Totals ──
    y += 2
    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Total Meters', 20, y)
    doc.text(data.totalMeters.toFixed(1), 90, y, { align: 'right' })
    doc.text('Gross Pay', 120, y)
    doc.text(formatINR(data.totalPay), pageWidth - 20, y, { align: 'right' })
    y += 8

    if (data.totalAdvances > 0) {
        doc.setTextColor(180, 100, 0)
        doc.setFont('helvetica', 'bold')
        doc.text('Advance Deduction', 20, y)
        doc.text(`-${formatINR(Math.min(data.totalAdvances, data.totalPay))}`, pageWidth - 20, y, { align: 'right' })
        y += 6

        const advances = data.itemization?.advances_recovered || []
        if (advances.length > 0) {
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            advances.forEach((a) => {
                const date = a.date ? formatDateOnly(a.date, { day: '2-digit', month: 'short' }) : ''
                doc.text(`• ${date ? date + ': ' : ''}${a.label || 'Upaad'}`, 25, y)
                doc.text(`- ${formatINR(a.recovered)}`, pageWidth - 25, y, { align: 'right' })
                y += 4
            })
            doc.setFontSize(10)
        }
        doc.setTextColor(0)
    }

    // ── Net Pay ──
    y += 2
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(20, y, pageWidth - 20, y)
    y += 7

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Net Pay', 20, y)
    doc.text(formatINR(data.netPay), pageWidth - 20, y, { align: 'right' })
    y += 15

    // ── Footer ──
    addFooter(doc)

    // Download
    const filename = `payslip-${data.workerName.replace(/\s+/g, '_')}-${data.month}.pdf`
    doc.save(filename)
}

/**
 * Generate a PDF payslip for a fixed/salaried worker.
 * Downloads the file in the browser.
 */
export function generateFixedPayslip(data: {
    factoryName: string
    month: string
    workerName: string
    role: string
    monthlySalary: number
    daysWorked?: number
    earnedPay: number
    totalAdvances: number
    netPay: number
    itemization?: PayslipItemization
}) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20

    // ── Header ──
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    doc.text(data.factoryName, pageWidth / 2, y, { align: 'center' })
    y += 8

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.text('Monthly Payslip', pageWidth / 2, y, { align: 'center' })
    y += 12

    // ── Worker Info ──
    doc.setTextColor(0)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Worker:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(data.workerName, 50, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Month:', pageWidth - 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatMonthLabel(data.month), pageWidth - 55, y)
    y += 4

    doc.setFont('helvetica', 'bold')
    doc.text('Role:', 20, y)
    doc.setFont('helvetica', 'normal')
    doc.text(data.role.charAt(0).toUpperCase() + data.role.slice(1), 50, y)

    doc.setFont('helvetica', 'bold')
    doc.text('Date:', pageWidth - 80, y)
    doc.setFont('helvetica', 'normal')
    doc.text(formatToSurat(new Date(), 'dd MMMM yyyy'), pageWidth - 55, y)
    y += 10

    // ── Divider ──
    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    y += 8

    // ── Salary Breakdown ──
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
        doc.text(`Formula: ₹${data.monthlySalary.toLocaleString()} ÷ 30 × ${data.daysWorked} days`, 20, y)
        doc.setTextColor(0)
        doc.setFontSize(10)
        y += 6
    }

    y += 2
    doc.setDrawColor(200)
    doc.line(20, y, pageWidth - 20, y)
    y += 6

    doc.setFont('helvetica', 'bold')
    doc.text('Gross Pay', 20, y)
    doc.text(formatINR(data.earnedPay), pageWidth - 20, y, { align: 'right' })
    y += 8

    if (data.totalAdvances > 0) {
        doc.setTextColor(180, 100, 0)
        doc.setFont('helvetica', 'bold')
        doc.text('Advance Deduction', 20, y)
        doc.text(`-${formatINR(Math.min(data.totalAdvances, data.earnedPay))}`, pageWidth - 20, y, { align: 'right' })
        y += 6

        const advances = data.itemization?.advances_recovered || []
        if (advances.length > 0) {
            doc.setFontSize(8)
            doc.setFont('helvetica', 'normal')
            advances.forEach((a) => {
                const date = a.date ? formatDateOnly(a.date, { day: '2-digit', month: 'short' }) : ''
                doc.text(`• ${date ? date + ': ' : ''}${a.label || 'Upaad'}`, 25, y)
                doc.text(`- ${formatINR(a.recovered)}`, pageWidth - 25, y, { align: 'right' })
                y += 4
            })
            doc.setFontSize(10)
        }
        doc.setTextColor(0)
    }

    // ── Net Pay ──
    y += 2
    doc.setDrawColor(0)
    doc.setLineWidth(0.5)
    doc.line(20, y, pageWidth - 20, y)
    y += 7

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Net Pay', 20, y)
    doc.text(formatINR(data.netPay), pageWidth - 20, y, { align: 'right' })
    y += 15

    // ── Footer ──
    addFooter(doc)

    // Download
    const filename = `payslip-${data.workerName.replace(/\s+/g, '_')}-${data.month}.pdf`
    doc.save(filename)
}

// ── Helpers ──

function addFooter(doc: jsPDF) {
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setDrawColor(220)
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20)

    doc.setFontSize(8)
    doc.setTextColor(150)
    doc.setFont('helvetica', 'normal')
    doc.text(
        'Generated by Weavly — This is a computer-generated document and does not require a signature.',
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
