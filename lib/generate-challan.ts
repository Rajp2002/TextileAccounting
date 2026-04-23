import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

/**
 * Data required to generate a Delivery Challan PDF.
 * Provided by the createDispatch Server Action response.
 */
export interface ChallanData {
    org_name:         string      // Factory name — from organizations table
    party_name:       string      // Trader / party name
    dispatch_number:  number      // Batch number (1, 2, 3…)
    qty_meters_sent:  number      // Meters dispatched in this batch
    total_target_meters: number   // Total order target
    notes:            string | null
    dispatched_at:    string      // ISO timestamp
    tracking_token:   string      // 12-char token for the QR URL
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://loomi.app'

/**
 * Generate and auto-download a Delivery Challan PDF with an embedded QR code.
 * Called client-side immediately after createDispatch() Server Action resolves.
 * Pattern mirrors lib/generate-payslip.ts (same jsPDF structure, same .save() trigger).
 *
 * @param data - Challan data returned from the createDispatch Server Action
 */
export async function generateChallan(data: ChallanData): Promise<void> {
    const doc = new jsPDF({ unit: 'mm', format: 'a5' })  // A5 — standard challan size
    const pageWidth  = doc.internal.pageSize.getWidth()   // 148mm
    const pageHeight = doc.internal.pageSize.getHeight()  // 210mm
    const L = 14   // left margin
    const R = 14   // right margin
    const contentWidth = pageWidth - L - R   // usable width: 120mm
    let y = 16

    const trackingUrl = `${APP_URL}/track/${data.tracking_token}`

    // ── Header Bar ──────────────────────────────────────────────────────────────
    // Green accent header stripe
    doc.setFillColor(26, 92, 56)     // Loomi brand green
    doc.rect(0, 0, pageWidth, 10, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'bold')
    doc.text('DELIVERY CHALLAN', L, 7)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7)
    doc.text('Powered by Loomi', pageWidth - R, 7, { align: 'right' })

    y = 18

    // ── Factory Name ─────────────────────────────────────────────────────────────
    doc.setTextColor(0)
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text(data.org_name, pageWidth / 2, y, { align: 'center' })
    y += 6

    // ── Dispatch Badge (Batch #N) ─────────────────────────────────────────────────
    doc.setFillColor(237, 247, 242)   // light green tint
    doc.setDrawColor(26, 92, 56)
    doc.roundedRect(L, y, 44, 8, 2, 2, 'FD')
    doc.setFontSize(9)
    doc.setTextColor(26, 92, 56)
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
    doc.text('Target (Order)', L, y + 8)
    doc.text('Dispatched (Batch)', L, y + 16)

    // Right column values
    doc.setTextColor(0)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.text(data.party_name, L + 44, y)
    doc.text(`${Number(data.total_target_meters).toLocaleString('en-IN')} m`, L + 44, y + 8)

    // Dispatched meters — large, prominent
    doc.setFontSize(14)
    doc.setTextColor(26, 92, 56)
    doc.text(`${Number(data.qty_meters_sent).toFixed(2)} m`, L + 44, y + 18)
    y += 30

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
            dark: '#1A5C38',    // Loomi brand green dots
            light: '#FFFFFF',
        },
    })

    const qrSize = 40   // 40mm × 40mm on the PDF
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
        '  · Track production progress',
        '  · Confirm receipt of this batch',
        '  · View dispatch history',
    ]
    doc.text(instructions, L, y + 11)

    // Embed QR code image
    doc.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize)

    y += qrSize + 5

    // ── Tracking URL (manual entry fallback) ──────────────────────────────────────
    doc.setFontSize(6.5)
    doc.setTextColor(26, 92, 56)
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
        'Generated by Loomi · This is a computer-generated Delivery Challan.',
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
    )

    // ── Auto-Download ─────────────────────────────────────────────────────────────
    const safeName = data.party_name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_')
    doc.save(`Challan-${safeName}-Batch${data.dispatch_number}.pdf`)
}
