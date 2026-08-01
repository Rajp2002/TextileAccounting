import jsPDF from 'jspdf'

type GstInvoiceInput = {
  invoiceNumber: string
  issuedAt: string
  supplierLegalName: string
  supplierGstin: string | null
  supplierAddress: string
  supplierState: string
  supplierStateCode: string
  supplierPostalCode: string
  customerLegalName: string
  customerGstin: string | null
  customerAddress: string
  customerCity: string
  customerState: string
  customerStateCode: string
  customerPostalCode: string
  customerEmail: string
  placeOfSupply: string
  sac: string
  taxableAmountPaise: number
  cgstAmountPaise: number
  sgstAmountPaise: number
  igstAmountPaise: number
  cessAmountPaise: number
  totalAmountPaise: number
  paymentReference: string
  orderReference: string | null
}
function amount(paise: number) {
  return `₹${(paise / 100).toLocaleString('en-IN')}`
}

function date(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
}

export function generateGstInvoicePdf(input: GstInvoiceInput): Buffer {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const width = doc.internal.pageSize.getWidth()
  doc.setProperties({ title: `Weavly GST Invoice ${input.invoiceNumber}`, subject: 'Weavly GST tax invoice', creator: 'Weavly' })

  doc.setFillColor(15, 23, 42)
  doc.rect(0, 0, width, 42, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(21)
  doc.text(input.supplierLegalName, 18, 17)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('GST Tax Invoice', 18, 27)
  doc.setFontSize(9)
  doc.text(`Invoice no. ${input.invoiceNumber} · Issued ${date(input.issuedAt)}`, width - 18, 22, { align: 'right' })

  let y = 57
  doc.setTextColor(15, 23, 42)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('Supplier', 18, y)
  doc.text('Bill to', width / 2 + 2, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const supplierLines = [input.supplierLegalName, input.supplierAddress, `${input.supplierState} (${input.supplierStateCode}) - ${input.supplierPostalCode}`, `GSTIN: ${input.supplierGstin || 'Not registered'}`]
  const customerLines = [input.customerLegalName, input.customerAddress, `${input.customerCity}, ${input.customerState} (${input.customerStateCode}) - ${input.customerPostalCode}`, `GSTIN: ${input.customerGstin || 'Not registered'}`, input.customerEmail]
  supplierLines.forEach(line => { doc.text(doc.splitTextToSize(line, width / 2 - 28), 18, y); y += 5 })
  let customerY = 64
  customerLines.forEach(line => { doc.text(doc.splitTextToSize(line, width / 2 - 28), width / 2 + 2, customerY); customerY += 5 })
  y = Math.max(y, customerY) + 11

  doc.setDrawColor(226, 232, 240)
  doc.line(18, y, width - 18, y)
  y += 10
  doc.setFont('helvetica', 'bold')
  doc.text('Description', 18, y)
  doc.text('SAC', width - 75, y)
  doc.text('Taxable value', width - 18, y, { align: 'right' })
  y += 8
  doc.setFont('helvetica', 'normal')
  doc.text('Weavly annual software plan access', 18, y)
  doc.text(input.sac, width - 75, y)
  doc.text(amount(input.taxableAmountPaise), width - 18, y, { align: 'right' })
  y += 12
  doc.line(18, y, width - 18, y)
  y += 9

  const rows: Array<[string, number]> = [
    ['Taxable value', input.taxableAmountPaise],
    ['CGST', input.cgstAmountPaise],
    ['SGST', input.sgstAmountPaise],
    ['IGST', input.igstAmountPaise],
    ['Cess', input.cessAmountPaise],
    ['Total', input.totalAmountPaise],
  ]
  rows.forEach(([label, value]) => {
    doc.setFont('helvetica', label === 'Total' ? 'bold' : 'normal')
    doc.setFontSize(label === 'Total' ? 12 : 9)
    doc.text(label, width - 78, y)
    doc.text(amount(value), width - 18, y, { align: 'right' })
    y += label === 'Total' ? 11 : 7
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(71, 85, 105)
  doc.text(`Place of supply: ${input.placeOfSupply}`, 18, y + 10)
  doc.text(`Payment reference: ${input.paymentReference}`, 18, y + 17)
  doc.text(`Order reference: ${input.orderReference || '—'}`, 18, y + 24)
  doc.text('This invoice is generated from the approved Weavly billing and tax configuration.', 18, 282)

  return Buffer.from(doc.output('arraybuffer'))
}
