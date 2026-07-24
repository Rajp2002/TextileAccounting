'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import { Download, FileText, Loader2, Printer, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  buildCostingPrintHtml,
  extractStyledCostingBody,
  type CostingExportMode,
  type CostingExportModel,
} from '@/lib/estimator-export'
import { toast } from 'sonner'
import { downloadBlob } from '@/lib/browser-download'

export function CostingExportDialog({
  open,
  onOpenChange,
  model,
  defaultCustomerName = '',
  defaultBusinessName = '',
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: CostingExportModel | null
  defaultCustomerName?: string
  defaultBusinessName?: string
}) {
  const [mode, setMode] = useState<CostingExportMode>('internal')
  const [businessName, setBusinessName] = useState(defaultBusinessName)
  const [customerName, setCustomerName] = useState(defaultCustomerName)
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 15), 'yyyy-MM-dd'))
  const [notes, setNotes] = useState('')
  const [showGstNote, setShowGstNote] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (!open || !model) return
    setMode('internal')
    setBusinessName(defaultBusinessName)
    setCustomerName(defaultCustomerName)
    setValidUntil(format(addDays(new Date(), 15), 'yyyy-MM-dd'))
    setNotes('')
    setShowGstNote(true)
  }, [defaultBusinessName, defaultCustomerName, model, open])

  const options = useMemo(() => ({
    mode,
    businessName,
    customerName,
    validUntil,
    notes,
    showGstNote,
  }), [businessName, customerName, mode, notes, showGstNote, validUntil])

  const buildHtml = () => model ? buildCostingPrintHtml(model, options) : null

  const handlePrint = () => {
    const html = buildHtml()
    if (!html) return
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      toast.error('Allow pop-ups to print the costing sheet.')
      return
    }
    printWindow.opener = null
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  const handlePdf = async () => {
    const html = buildHtml()
    if (!html || !model) return
    setGenerating(true)
    try {
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const host = document.createElement('div')
      host.style.width = '760px'
      host.style.position = 'fixed'
      host.style.left = '0'
      host.style.top = '0'
      host.style.zIndex = '-1'
      host.style.pointerEvents = 'none'
      host.style.background = '#ffffff'
      host.innerHTML = extractStyledCostingBody(html)
      document.body.appendChild(host)
      try {
        await pdf.html(host, {
          margin: [36, 36, 36, 36],
          autoPaging: 'text',
          width: 523,
          windowWidth: 760,
        })
      } finally {
        host.remove()
      }
      const safeName = model.qualityLabel.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'costing'
      const filename = `${safeName}-${mode === 'internal' ? 'cost-sheet' : 'quotation'}.pdf`
      downloadBlob(pdf.output('blob'), filename)
      toast.success(mode === 'internal' ? 'Internal cost sheet downloaded' : 'Customer quotation downloaded', {
        description: filename,
      })
    } catch (error) {
      console.error(error)
      toast.error('PDF generation failed. Use Print as a fallback.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export Cost Sheet</DialogTitle>
          <DialogDescription>Choose what the recipient is allowed to see.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setMode('internal')}
            className={`rounded-xl border p-4 text-left transition-colors ${mode === 'internal' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <FileText className="mb-3 h-5 w-5 text-blue-600" />
            <p className="font-semibold text-slate-950">Internal Cost Sheet</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Includes assumptions, detailed costs, margin, break-even, and expected profit.</p>
          </button>
          <button
            type="button"
            onClick={() => setMode('customer')}
            className={`rounded-xl border p-4 text-left transition-colors ${mode === 'customer' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
          >
            <ReceiptText className="mb-3 h-5 w-5 text-emerald-600" />
            <p className="font-semibold text-slate-950">Customer Quotation</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">Shows final price and commercial details. Internal costs and margin stay hidden.</p>
          </button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="export-business-name">Business name</Label>
            <Input id="export-business-name" value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Your weaving business" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-customer-name">Customer (optional)</Label>
            <Input id="export-customer-name" value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Customer or party name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="export-valid-until">Valid until</Label>
            <Input id="export-valid-until" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} disabled={mode === 'internal'} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="export-notes">Notes (optional)</Label>
            <Textarea id="export-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="Payment, delivery, quality, or internal review notes" />
          </div>
          {mode === 'customer' && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3 sm:col-span-2">
              <div>
                <Label htmlFor="export-gst-note">Show GST note</Label>
                <p className="text-xs text-slate-500">States that GST is charged as applicable on the final tax invoice.</p>
              </div>
              <Switch id="export-gst-note" checked={showGstNote} onCheckedChange={setShowGstNote} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" onClick={handlePrint} disabled={!model}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={handlePdf} disabled={!model || generating} className="bg-blue-600 text-white hover:bg-blue-700">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Download PDF
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
