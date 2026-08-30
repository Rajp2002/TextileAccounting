'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format } from 'date-fns'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  Printer,
  ReceiptText,
  Share2,
} from 'lucide-react'
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
  buildQuotationShareMessage,
  extractStyledCostingBody,
  getCostingExportFilename,
  validateCostingExportInput,
  type CostingExportMode,
  type CostingExportModel,
} from '@/lib/estimator-export'
import { toast, userFacingError } from '@/lib/app-notifications'
import { downloadBlob } from '@/lib/browser-download'
import { formatToSurat } from '@/lib/time'
import { updateQuotationDocumentMetadata } from '@/app/(dashboard)/owner/estimator/actions'
import { trackPlanEvent } from '@/lib/plan-analytics'

type ExportStatus = 'idle' | 'saving' | 'generating' | 'generated' | 'download-started' | 'print-opened' | 'share-opened' | 'failed'

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'

function getDefaultValidity(value?: string, locked = false) {
  return value || (locked ? '' : format(addDays(new Date(), 15), 'yyyy-MM-dd'))
}

function statusLabel(status: ExportStatus) {
  switch (status) {
    case 'saving': return 'Saving quotation details'
    case 'generating': return 'Generating PDF'
    case 'generated': return 'PDF generated'
    case 'download-started': return 'Download started'
    case 'print-opened': return 'Print window opened'
    case 'share-opened': return 'Share handoff opened'
    case 'failed': return 'Action failed'
    default: return 'Preview ready'
  }
}

export function CostingExportDialog({
  open,
  onOpenChange,
  model,
  defaultCustomerName = '',
  defaultBusinessName = '',
  defaultMode = 'internal',
  defaultValidUntil,
  defaultCustomerTerms = '',
  defaultInternalNotes = '',
  documentReference = '',
  sourceQuoteId,
  sourceQuoteUpdatedAt,
  sourceQuoteStatus,
  sourceRecordKind,
  onQuoteUpdated,
  onMarkAsSent,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: CostingExportModel | null
  defaultCustomerName?: string
  defaultBusinessName?: string
  defaultMode?: CostingExportMode
  defaultValidUntil?: string | null
  defaultCustomerTerms?: string | null
  defaultInternalNotes?: string | null
  documentReference?: string | null
  sourceQuoteId?: string
  sourceQuoteUpdatedAt?: string
  sourceQuoteStatus?: QuoteStatus
  sourceRecordKind?: 'costing' | 'quotation'
  onQuoteUpdated?: (data: { updated_at: string; quotation_reference?: string | null; quotation_valid_until?: string | null; customer_terms?: string | null }) => void
  onMarkAsSent?: () => Promise<boolean> | boolean
}) {
  const [mode, setMode] = useState<CostingExportMode>(defaultMode)
  const [businessName, setBusinessName] = useState(defaultBusinessName)
  const [customerName, setCustomerName] = useState(defaultCustomerName)
  const [validUntil, setValidUntil] = useState(getDefaultValidity(defaultValidUntil ?? undefined, sourceRecordKind === 'quotation' && sourceQuoteStatus === 'accepted'))
  const [customerTerms, setCustomerTerms] = useState(defaultCustomerTerms ?? '')
  const [internalNotes, setInternalNotes] = useState(defaultInternalNotes ?? '')
  const [showGstNote, setShowGstNote] = useState(true)
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [generatedBlob, setGeneratedBlob] = useState<Blob | null>(null)
  const [generatedFilename, setGeneratedFilename] = useState('')
  const [sharing, setSharing] = useState(false)
  const [markingSent, setMarkingSent] = useState(false)
  const [markedSent, setMarkedSent] = useState(false)
  const [latestQuoteUpdatedAt, setLatestQuoteUpdatedAt] = useState(sourceQuoteUpdatedAt)

  const savedQuotation = Boolean(sourceQuoteId && sourceRecordKind === 'quotation')
  const lockedQuotation = savedQuotation && sourceQuoteStatus === 'accepted'
  const displayedQuoteStatus: QuoteStatus | undefined = markedSent ? 'sent' : sourceQuoteStatus

  useEffect(() => {
    if (!open || !model) return
    setMode(defaultMode)
    setBusinessName(defaultBusinessName)
    setCustomerName(defaultCustomerName)
    setValidUntil(getDefaultValidity(defaultValidUntil ?? undefined, sourceRecordKind === 'quotation' && sourceQuoteStatus === 'accepted'))
    setCustomerTerms(defaultCustomerTerms ?? '')
    setInternalNotes(defaultInternalNotes ?? '')
    setShowGstNote(true)
    setStatus('idle')
    setErrorMessage(null)
    setGeneratedBlob(null)
    setGeneratedFilename('')
    setSharing(false)
    setMarkingSent(false)
    setMarkedSent(false)
    setLatestQuoteUpdatedAt(sourceQuoteUpdatedAt)
    void trackPlanEvent('export_preview_opened', { mode: defaultMode })
  }, [defaultBusinessName, defaultCustomerName, defaultCustomerTerms, defaultInternalNotes, defaultMode, defaultValidUntil, model, open, sourceQuoteStatus, sourceQuoteUpdatedAt, sourceRecordKind])

  const options = useMemo(() => ({
    mode,
    businessName,
    customerName,
    validUntil,
    notes: mode === 'customer' ? customerTerms : internalNotes,
    showGstNote,
    documentReference: documentReference ?? '',
    allowMissingValidUntil: lockedQuotation && !defaultValidUntil,
  }), [businessName, customerName, customerTerms, defaultValidUntil, documentReference, internalNotes, lockedQuotation, mode, showGstNote, validUntil])

  const previewHtml = useMemo(() => model ? buildCostingPrintHtml(model, options) : '', [model, options])
  const validationErrors = useMemo(() => validateCostingExportInput(model, options), [model, options])
  const canGenerate = validationErrors.length === 0 && status !== 'saving' && status !== 'generating'
  const isBusy = status === 'saving' || status === 'generating' || sharing || markingSent
  const canMarkSent = savedQuotation
    && mode === 'customer'
    && sourceQuoteId
    && sourceQuoteStatus === 'draft'
    && !markedSent
    && ['generated', 'download-started', 'print-opened', 'share-opened'].includes(status)
  const exportActionHint = !model
    ? 'Complete the Cost Estimate before creating a document.'
    : validationErrors.length > 0
      ? validationErrors[0]
      : null
  const switchMode = (nextMode: CostingExportMode) => {
    setMode(nextMode)
    setGeneratedBlob(null)
    setGeneratedFilename('')
    setStatus('idle')
    setErrorMessage(null)
  }

  const persistCustomerMetadata = async () => {
    if (!sourceQuoteId || sourceRecordKind !== 'quotation' || mode !== 'customer') return true
    if (!latestQuoteUpdatedAt) {
      const message = 'Quotation version is missing. Refresh Quotations before exporting again.'
      setErrorMessage(message)
      toast.error(message)
      setStatus('failed')
      return false
    }
    if (sourceQuoteStatus === 'accepted') return true

    setStatus('saving')
    const result = await updateQuotationDocumentMetadata({
      id: sourceQuoteId,
      expectedUpdatedAt: latestQuoteUpdatedAt,
      validUntil,
      customerTerms,
    })
    if (result.error || !result.data) {
      const message = userFacingError(result.error, 'Quotation details could not be saved. Try again.')
      setErrorMessage(message)
      toast.error(message)
      setStatus('failed')
      return false
    }

    setLatestQuoteUpdatedAt(result.data.updated_at)
    onQuoteUpdated?.(result.data)
    return true
  }

  const handlePrint = async () => {
    if (!model || validationErrors.length > 0) {
      const message = validationErrors[0] ?? 'Complete the document details before printing.'
      setErrorMessage(message)
      toast.error(message)
      return
    }

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      const message = 'Allow pop-ups to print the document.'
      setErrorMessage(message)
      toast.error(message)
      return
    }
    printWindow.opener = null

    try {
      if (!(await persistCustomerMetadata())) {
        printWindow.close()
        return
      }
      printWindow.document.open()
      printWindow.document.write(previewHtml)
      printWindow.document.close()
      printWindow.focus()
      printWindow.print()
      setStatus('print-opened')
      setErrorMessage(null)
      void trackPlanEvent('export_completed', { mode })
    } catch (error) {
      printWindow.close()
      console.error(error)
      setStatus('failed')
      void trackPlanEvent('export_failed', { mode })
      const message = 'Print could not be opened. Try Download PDF instead.'
      setErrorMessage(message)
      toast.error(message)
    }
  }

  const handlePdf = async () => {
    if (!model || validationErrors.length > 0) {
      const message = validationErrors[0] ?? 'Complete the document details before generating the PDF.'
      setErrorMessage(message)
      toast.error(message)
      return
    }

    setStatus('generating')
    setErrorMessage(null)
    try {
      if (!(await persistCustomerMetadata())) return
      setStatus('generating')

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
      host.innerHTML = extractStyledCostingBody(previewHtml)
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

      const filename = getCostingExportFilename(model, options)
      const blob = pdf.output('blob')
      downloadBlob(blob, filename)
      setGeneratedBlob(blob)
      setGeneratedFilename(filename)
      setStatus('download-started')
      void trackPlanEvent('export_completed', { mode })
      toast.success('PDF ready', { description: `Download started: ${filename}` })
    } catch (error) {
      console.error(error)
      setStatus('failed')
      void trackPlanEvent('export_failed', { mode })
      const message = 'PDF generation failed. Retry or use Print as a fallback.'
      setErrorMessage(message)
      toast.error(message)
    }
  }

  const handleShare = async () => {
    if (!generatedBlob || !model) {
      const message = 'Generate the PDF before sharing it.'
      setErrorMessage(message)
      toast.error(message)
      return
    }

    setSharing(true)
    const file = new File([generatedBlob], generatedFilename, { type: 'application/pdf' })
    const message = buildQuotationShareMessage(model, options)
    try {
      const canShareFile = typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] })
      if (typeof navigator.share === 'function' && canShareFile) {
        await navigator.share({
          files: [file],
          title: `Quotation ${options.documentReference || model.qualityLabel}`,
          text: message,
        })
        setStatus('share-opened')
        toast.success('Share sheet opened', { description: 'Choose WhatsApp or another app to send the PDF.' })
      } else {
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
        const shareWindow = window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
        if (!shareWindow) {
          const message = 'WhatsApp could not be opened. Attach the downloaded PDF manually.'
          setErrorMessage(message)
          toast.error(message)
          return
        }
        setStatus('share-opened')
        toast.success('WhatsApp opened', { description: 'Attach the downloaded PDF before sending.' })
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        toast.info('Sharing cancelled')
      } else {
        console.error(error)
        const message = 'Sharing could not be completed. The PDF is still available in Downloads.'
        setErrorMessage(message)
        toast.error(message)
      }
    } finally {
      setSharing(false)
    }
  }

  const handleMarkSent = async () => {
    if (!onMarkAsSent) return
    setMarkingSent(true)
    try {
      const success = await onMarkAsSent()
      if (success) {
        setMarkedSent(true)
        toast.success('Quotation marked as sent')
      }
    } finally {
      setMarkingSent(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-blue-600" />
            {mode === 'customer' ? 'Preview Customer Quotation' : 'Preview Internal Cost Estimate'}
          </DialogTitle>
          <DialogDescription>
            Confirm exactly what will be shared before generating the document.
          </DialogDescription>
        </DialogHeader>

        {savedQuotation && displayedQuoteStatus && (
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" role="status">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-semibold text-slate-600">Quotation status</span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700">{displayedQuoteStatus[0].toUpperCase() + displayedQuoteStatus.slice(1)}</span>
            </div>
            <p className="text-xs text-slate-500">Updated {formatToSurat(latestQuoteUpdatedAt ?? new Date(), 'd MMM yyyy, h:mm a')}</p>
            <p className="text-[11px] text-slate-500 sm:max-w-xs sm:text-right">Mark as sent records this status and time. PDF sharing does not confirm delivery.</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-100 p-2">
            <div className="mb-2 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">Live preview</p>
                <p className="mt-1 text-xs text-slate-500">The PDF uses this same document layout.</p>
              </div>
              {status !== 'idle' && (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status === 'failed' ? 'bg-red-100 text-red-700' : status.includes('started') || status.includes('opened') || status === 'generated' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                  {statusLabel(status)}
                </span>
              )}
            </div>
            <iframe
              title={mode === 'customer' ? 'Customer quotation preview' : 'Internal cost estimate preview'}
              srcDoc={previewHtml}
              sandbox=""
              className="h-[min(65vh,680px)] w-full rounded-lg border border-slate-200 bg-white shadow-inner"
            />
          </section>

          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => switchMode('internal')}
                className={`rounded-xl border p-4 text-left transition-colors ${mode === 'internal' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <FileText className="mb-3 h-5 w-5 text-blue-600" />
                <p className="font-semibold text-slate-950">Internal Cost Estimate</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Detailed costs, assumptions, break-even, margin, and profit stay inside the factory.</p>
              </button>
              <button
                type="button"
                onClick={() => switchMode('customer')}
                className={`rounded-xl border p-4 text-left transition-colors ${mode === 'customer' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <ReceiptText className="mb-3 h-5 w-5 text-emerald-600" />
                <p className="font-semibold text-slate-950">Customer Quotation</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">Final price and commercial details only. Internal costs and margin stay hidden.</p>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="export-business-name">Business name</Label>
                <Input id="export-business-name" value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Your weaving business" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-customer-name">Party / customer {mode === 'customer' ? '' : '(optional)'}</Label>
                <Input id="export-customer-name" value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Customer or party name" disabled={savedQuotation} aria-describedby={savedQuotation ? 'export-customer-name-help' : undefined} />
                {savedQuotation && <p id="export-customer-name-help" className="text-xs text-slate-500">This customer name is locked because the quotation has already been saved.</p>}
              </div>
              {mode === 'customer' && (
                <div className="space-y-1.5">
                  <Label htmlFor="export-valid-until">Valid until</Label>
                  <Input id="export-valid-until" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} disabled={lockedQuotation} aria-describedby={lockedQuotation ? 'export-valid-until-help' : undefined} />
                  {lockedQuotation && <p id="export-valid-until-help" className="text-xs text-slate-500">Accepted quotations keep their original validity date.</p>}
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="export-notes">{mode === 'customer' ? 'Customer terms (optional)' : 'Internal notes (optional)'}</Label>
                <Textarea
                  id="export-notes"
                  value={mode === 'customer' ? customerTerms : internalNotes}
                  onChange={event => mode === 'customer' ? setCustomerTerms(event.target.value) : setInternalNotes(event.target.value)}
                  placeholder={mode === 'customer' ? 'Payment, delivery, quality, or transport terms' : 'Internal review notes - never shown to the customer'}
                  className="min-h-24"
                  disabled={lockedQuotation && mode === 'customer'}
                  aria-describedby={lockedQuotation && mode === 'customer' ? 'export-terms-help' : undefined}
                />
                {lockedQuotation && mode === 'customer' && <p id="export-terms-help" className="text-xs text-slate-500">Accepted quotations keep their original customer terms.</p>}
              </div>
              {mode === 'customer' && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 p-3">
                  <div>
                    <Label htmlFor="export-gst-note">Show GST detail note</Label>
                    <p className="text-xs text-slate-500">The quotation-only, not-a-tax-invoice disclaimer is always shown.</p>
                  </div>
                  <Switch id="export-gst-note" checked={showGstNote} onCheckedChange={setShowGstNote} />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Filename</p>
              <p className="mt-1 break-all font-mono text-xs font-semibold text-slate-800">
                {generatedFilename || (model ? getCostingExportFilename(model, options) : 'Ready after preview')}
              </p>
              {documentReference && <p className="mt-1 text-xs text-slate-500">Reference: {documentReference}</p>}
            </div>

            {validationErrors.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950" role="alert">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-bold">Complete this before generating</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                      {validationErrors.map(error => <li key={error}>{error}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {status === 'download-started' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-bold">PDF generated and download started</p>
                    <p className="mt-1 text-xs">Check your browser Downloads folder. The system cannot verify the device save location.</p>
                  </div>
                </div>
              </div>
            )}
            {status === 'failed' && errorMessage && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900" role="alert">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  <div>
                    <p className="font-bold">Document action failed</p>
                    <p className="mt-1 text-xs">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter className="flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {exportActionHint && <p id="export-action-help" className="text-xs font-medium leading-relaxed text-amber-700 sm:max-w-sm">{exportActionHint}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handlePrint()} disabled={!model || isBusy || validationErrors.length > 0} aria-describedby={exportActionHint ? 'export-action-help' : undefined}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            {generatedBlob && mode === 'customer' && (
              <Button type="button" variant="outline" onClick={() => void handleShare()} disabled={isBusy}>
                {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                Share PDF
              </Button>
            )}
            {canMarkSent && (
              <Button type="button" variant="outline" onClick={() => void handleMarkSent()} disabled={isBusy} className="border-indigo-200 text-indigo-700 hover:bg-indigo-50">
                {markingSent ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark as sent
              </Button>
            )}
            {status === 'share-opened' && <span className="flex items-center gap-1 text-xs font-semibold text-slate-500"><ExternalLink className="h-3.5 w-3.5" /> Delivery is not confirmed</span>}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            <Button type="button" onClick={() => void handlePdf()} disabled={!model || !canGenerate || isBusy} aria-describedby={exportActionHint ? 'export-action-help' : undefined} className="bg-blue-600 text-white hover:bg-blue-700">
              {status === 'saving' || status === 'generating' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {status === 'download-started' ? 'Download PDF again' : 'Download PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
