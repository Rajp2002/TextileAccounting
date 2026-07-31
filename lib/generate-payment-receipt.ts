import 'server-only'

import { jsPDF } from 'jspdf'
import { getBillingPrice, getBillingPlan, type BillingPurchaseType, type PurchasablePlanTier } from './billing-constants'

export type PaymentReceiptInput = {
  organizationName: string
  planTier: PurchasablePlanTier
  purchaseType: BillingPurchaseType
  amountPaise: number
  paymentId: string
  orderId: string | null
  paidAt: string | null
  accessStart: string | null
  accessEnd: string | null
  method: string | null
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

function formatAmount(paise: number): string {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

/**
 * Generates a simple payment receipt. This is intentionally not labelled or
 * formatted as a GST tax invoice until Weavly has the required legal billing
 * identity and tax-document workflow.
 */
export function generatePaymentReceiptPdf(input: PaymentReceiptInput): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const plan = getBillingPlan(input.planTier)
  const expectedPrice = getBillingPrice(input.planTier, input.purchaseType)
  const hasCatalogBreakdown = expectedPrice.totalPaise === input.amountPaise
  const pageWidth = doc.internal.pageSize.getWidth()

  doc.setProperties({
    title: `Weavly Payment Receipt ${input.paymentId.slice(-8)}`,
    subject: 'Weavly subscription payment receipt',
    creator: 'Weavly',
  })

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, pageWidth, 38, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(22)
  doc.setFont('helvetica', 'bold')
  doc.text('Weavly', 18, 17)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Payment Receipt', 18, 27)

  doc.setTextColor(15, 23, 42)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.text('Receipt details', 18, 55)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)

  const details: Array<[string, string]> = [
    ['Customer', input.organizationName],
    ['Plan', plan.name],
    ['Payment type', input.purchaseType === 'renewal' ? 'Annual renewal' : 'First-year payment'],
    ['Paid on', formatDate(input.paidAt)],
    ['Payment method', input.method || 'Not provided'],
    ['Payment reference', input.paymentId],
    ['Order reference', input.orderId || '—'],
    ['Access period', `${formatDate(input.accessStart)} to ${formatDate(input.accessEnd)}`],
  ]

  let y = 65
  for (const [label, value] of details) {
    doc.setTextColor(100, 116, 139)
    doc.text(label, 18, y)
    doc.setTextColor(15, 23, 42)
    const valueLines = doc.splitTextToSize(value, pageWidth - 83)
    doc.text(valueLines, 65, y)
    y += Math.max(8, valueLines.length * 5)
  }

  doc.setDrawColor(226, 232, 240)
  doc.line(18, y + 2, pageWidth - 18, y + 2)
  y += 17

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text('Amount paid', 18, y)
  doc.setFontSize(18)
  doc.text(formatAmount(input.amountPaise), pageWidth - 18, y, { align: 'right' })
  y += 12

  if (hasCatalogBreakdown) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(71, 85, 105)
    doc.text(`Catalog base amount: ${formatAmount(expectedPrice.basePaise)}`, 18, y)
    y += 7
    doc.text(`GST included in payment total: ${formatAmount(expectedPrice.gstPaise)}`, 18, y)
    y += 7
  }

  doc.setFillColor(255, 247, 237)
  doc.roundedRect(18, y + 6, pageWidth - 36, 23, 3, 3, 'F')
  doc.setTextColor(154, 52, 18)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.text('Important', 24, y + 15)
  doc.setFont('helvetica', 'normal')
  doc.text(
    doc.splitTextToSize('This document confirms payment. Formal GST tax invoice support is not currently available.', pageWidth - 48),
    24,
    y + 22,
  )

  doc.setTextColor(100, 116, 139)
  doc.setFontSize(8)
  doc.text('Keep this receipt for your records. Contact support@weavly.app if the payment details look incorrect.', 18, 282)

  return Buffer.from(doc.output('arraybuffer'))
}
