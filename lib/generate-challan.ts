import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { getBaseUrl } from './utils'

/**
 * Data required to generate a Delivery Challan PDF.
 * Provided by the createDispatch Server Action response.
 */
export interface ChallanData {
    org_name:         string      // Factory name — from organizations table
    party_name:       string      // Trader / party name
    quality_label?:   string | null
    dispatch_number:  number      // Batch number (1, 2, 3…)
    qty_meters_sent:  number      // Meters dispatched in this batch
    total_target_meters: number   // Total order target
    package_lines: Array<{
        package_no: string
        package_type: string
        units_count: number
        grade: string
        metres: number
    }>
    notes:            string | null
    dispatched_at:    string      // ISO timestamp
    tracking_token:   string      // 12-char token for the QR URL
}

const APP_URL = getBaseUrl()

/**
 * Generate and auto-download a Delivery Challan PDF with an embedded QR code.
 * Called client-side immediately after createDispatch() Server Action resolves.
 * Pattern mirrors lib/generate-payslip.ts (same jsPDF structure, same .save() trigger).
 *
 * @param data - Challan data returned from the createDispatch Server Action
 */
export async function generateChallan(data: ChallanData): Promise<void> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const pageWidth  = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const L = 14   // left margin
    const R = 14   // right margin
    const contentWidth = pageWidth - L - R   // usable width: 120mm
    let y = 16

    const trackingUrl = `${APP_URL}/track/${data.tracking_token}`

    // ── Header Bar ──────────────────────────────────────────────────────────────
    // Orange accent header stripe
    doc.setFillColor(255, 87, 34)     // Weavly brand orange
    doc.rect(0, 0, pageWidth, 10, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('GREY FABRIC CHALLAN', L, 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Powered by Weavly', pageWidth - R, 7, { align: 'right' })

    y = 18

    // ── Factory Name ─────────────────────────────────────────────────────────────
    doc.setTextColor(0)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(data.org_name, pageWidth / 2, y, { align: 'center' })
    y += 6

    // ── Dispatch Badge (Batch #N) ─────────────────────────────────────────────────
    doc.setFillColor(255, 245, 242)   // light orange tint
    doc.setDrawColor(255, 87, 34)
    doc.roundedRect(L, y, 44, 8, 2, 2, 'FD')
    doc.setFontSize(9)
    doc.setTextColor(255, 87, 34)
    doc.setFont('helvetica', 'bold')
    doc.text(`Dispatch Batch #${data.dispatch_number}`, L + 22, y + 5.5, { align: 'center' })

    // Date on the right
    doc.setFontSize(8)
    doc.setTextColor(100)
    doc.setFont('helvetica', 'normal')
    const dateStr = new Date(data.dispatched_at).toLocaleDateString('en-IN', {
        day: '2-digit', month: 'short', year: 'numeric',
    })
    doc.text(dateStr, pageWidth - R, y + 5.5, { align: 'right' })
    y += 13

    // ── Divider ──────────────────────────────────────────────────────────────────
    doc.setDrawColor(220)
    doc.setLineWidth(0.3)
    doc.line(L, y, pageWidth - R, y)
    y += 6

    // ── Order Info Grid ──────────────────────────────────────────────────────────
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.setFont('helvetica', 'normal')

    // Left column
    doc.text('Party Name', L, y)
    doc.text('Quality', L, y + 8)
    doc.text('Target (Order)', L, y + 16)
    doc.text('Dispatch Total', L, y + 24)

    // Right column values
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(data.party_name, L + 44, y)
    doc.text(data.quality_label || 'Grey Fabric', L + 44, y + 8)
    doc.text(`${Number(data.total_target_meters).toLocaleString('en-IN')} m`, L + 44, y + 16)

    // Dispatched meters — large, prominent
    doc.setFontSize(14)
    doc.setTextColor(255, 87, 34)
    doc.text(`${Number(data.qty_meters_sent).toFixed(2)} m`, L + 44, y + 26)
    y += 38

    // ── Package table ───────────────────────────────────────────────────────────
    doc.setDrawColor(225)
    doc.setFillColor(248, 250, 252)
    doc.roundedRect(L, y, contentWidth, 9, 2, 2, 'FD')
    doc.setFontSize(8)
    doc.setTextColor(90)
    doc.setFont('helvetica', 'bold')
    doc.text('Package No', L + 3, y + 5.8)
    doc.text('Type', L + 58, y + 5.8)
    doc.text('Grade', L + 92, y + 5.8)
    doc.text('Metres', pageWidth - R - 3, y + 5.8, { align: 'right' })
    y += 11

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(35)
    const packageLines = data.package_lines.length > 0
        ? data.package_lines
        : [{
            package_no: `Batch ${data.dispatch_number}`,
            package_type: 'dispatch',
            units_count: 1,
            grade: '-',
            metres: data.qty_meters_sent,
        }]

    packageLines.forEach((line) => {
        if (y > pageHeight - 78) {
            doc.addPage()
            y = 18
        }

        doc.setDrawColor(238)
        doc.line(L, y + 6.5, pageWidth - R, y + 6.5)
        doc.setFontSize(8)
        doc.text(line.package_no, L + 3, y + 4.5)
        doc.text(`${line.package_type}${line.units_count > 1 ? ` ×${line.units_count}` : ''}`, L + 58, y + 4.5)
        doc.text(line.grade, L + 92, y + 4.5)
        doc.text(`${Number(line.metres).toFixed(2)} m`, pageWidth - R - 3, y + 4.5, { align: 'right' })
        y += 8
    })

    // ── Notes (if any) ────────────────────────────────────────────────────────────
    if (data.notes) {
        doc.setFontSize(8)
        doc.setTextColor(120)
        doc.setFont('helvetica', 'normal')
        doc.text('Reference / Notes', L, y)
        doc.setTextColor(60)
        doc.setFont('helvetica', 'bold')
        const noteLines = doc.splitTextToSize(data.notes, contentWidth - 44)
        doc.text(noteLines, L + 44, y)
        y += (noteLines.length * 5) + 4
    }

    // ── Divider ──────────────────────────────────────────────────────────────────
    doc.setDrawColor(220)
    doc.line(L, y, pageWidth - R, y)
    y += 8

    // ── QR Code Section ───────────────────────────────────────────────────────────
    // Generate QR as base64 PNG — client-safe, no file I/O
    const qrDataUrl = await QRCode.toDataURL(trackingUrl, {
        width: 200,
        margin: 1,
        color: {
            dark: '#BF360C',    // Weavly brand dark orange dots
            light: '#FFFFFF',
        },
    })

    const qrSize = 42
    const qrX = pageWidth - R - qrSize   // right-aligned
    const qrY = y

    // QR section label
    doc.setFontSize(8)
    doc.setTextColor(60)
    doc.setFont('helvetica', 'bold')
    doc.text('Trader Tracking Portal', L, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(100)
    doc.setFontSize(7)

    const instructions = [
        'Scan the QR code or visit the URL below to:',
        '  · Track order progress',
        '  · Confirm receipt of this batch',
        '  · View dispatched package history',
    ]
    doc.text(instructions, L, y + 11)

    // Embed QR code image
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    y += qrSize + 5

    // ── Tracking URL (manual entry fallback) ──────────────────────────────────────
    doc.setFontSize(6.5)
    doc.setTextColor(255, 87, 34)
    doc.setFont('helvetica', 'normal')

    // Wrap URL if too long for single line
    const urlLines = doc.splitTextToSize(trackingUrl, contentWidth)
    doc.text(urlLines, pageWidth / 2, y, { align: 'center' })
    y += (urlLines.length * 4) + 6

    // ── Signature Block ───────────────────────────────────────────────────────────
    if (y < pageHeight - 30) {
        doc.setDrawColor(180)
        doc.line(L, pageHeight - 24, L + 50, pageHeight - 24)
        doc.line(pageWidth - R - 50, pageHeight - 24, pageWidth - R, pageHeight - 24)

        doc.setFontSize(7)
        doc.setTextColor(120)
        doc.text('Sender Signature', L, pageHeight - 19)
        doc.text('Receiver Signature', pageWidth - R - 50, pageHeight - 19)
    }

    // ── Footer ────────────────────────────────────────────────────────────────────
    doc.setDrawColor(200)
    doc.line(L, pageHeight - 13, pageWidth - R, pageHeight - 13)
    doc.setFontSize(6.5)
    doc.setTextColor(150)
    doc.setFont('helvetica', 'normal')
    doc.text(
        'Generated by Weavly · Computer-generated grey fabric challan.',
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
    )

    // ── Auto-Download ─────────────────────────────────────────────────────────────
    const safeName = data.party_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    doc.save(`Challan-${safeName}-Batch${data.dispatch_number}.pdf`)
}
