'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
  describeDocumentSource,
  extractStyledCostingBody,
  getCostingExportFilename,
  validateCostingExportInput,
  type CostingDocumentSource,
  type CostingExportMode,
  type CostingExportModel,
} from '@/lib/estimator-export'
import { toast, userFacingError } from '@/lib/app-notifications'
import { downloadBlob } from '@/lib/browser-download'
import { formatToSurat } from '@/lib/time'
import { updateQuotationDocumentMetadata } from '@/app/(dashboard)/owner/estimator/actions'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { createDocumentGenerationGuard } from '@/lib/document-generation'
import { useTranslation } from '@/lib/i18n/context'
import { canSharePreparedFile, sharePreparedDocument } from '@/lib/prepared-document-share'

const PDF_LAYOUT_WIDTH_PX = 700

type ExportStatus ='idle' | 'saving' | 'generating' | 'generated' | 'download-started' | 'print-opened' | 'share-opened' | 'failed'

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
  tutorialPreview = false,
  documentSource,
}: {
  open: boolean
  tutorialPreview?: boolean
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
  /** What the numbers come from; shown above the form when given. */
  documentSource?: CostingDocumentSource
}) {
  const { tx, t } = useTranslation()
  const generationGuard = useRef(createDocumentGenerationGuard())
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
  const [generatedDocumentKey, setGeneratedDocumentKey] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)
  const [latestQuoteUpdatedAt, setLatestQuoteUpdatedAt] = useState(sourceQuoteUpdatedAt)
  const [mobileActions, setMobileActions] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px), (max-height: 500px) and (pointer: coarse)')
    const update = () => setMobileActions(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  const savedQuotation = Boolean(sourceQuoteId && sourceRecordKind === 'quotation')
  const lockedQuotation = savedQuotation && sourceQuoteStatus === 'accepted'
  const displayedQuoteStatus: QuoteStatus | undefined = sourceQuoteStatus

  // Reset when the dialog opens for a document, never because a parent handed
  // us a new `model` object: parents that re-render (Free's clock ticks every
  // second) must not undo the owner's choice of document or typed details.
  const hasModel = Boolean(model)

  useEffect(() => {
    if (!open || !hasModel) return
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
    setGeneratedDocumentKey(null)
    setGeneratedFilename('')
    setSharing(false)
    setLatestQuoteUpdatedAt(sourceQuoteUpdatedAt)
    if (!tutorialPreview) void trackPlanEvent('export_preview_opened', { mode: defaultMode })
  }, [defaultBusinessName, defaultCustomerName, defaultCustomerTerms, defaultInternalNotes, defaultMode, defaultValidUntil, hasModel, open, sourceQuoteStatus, sourceQuoteUpdatedAt, sourceRecordKind, tutorialPreview])

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
  const documentKey = model ? JSON.stringify([previewHtml, getCostingExportFilename(model, options)]) : ''
  const generatedFileIsCurrent = Boolean(generatedBlob && generatedDocumentKey === documentKey)
  const documentChanged = Boolean(generatedBlob && !generatedFileIsCurrent)
  const shareFile = useMemo(() => generatedBlob && generatedFileIsCurrent
    ? new File([generatedBlob], generatedFilename, { type: 'application/pdf' })
    : null, [generatedBlob, generatedFileIsCurrent, generatedFilename])
  const nativeFileSharing = Boolean(shareFile && canSharePreparedFile(shareFile))
  const primaryIsShare = mobileActions && generatedFileIsCurrent && mode === 'customer' && nativeFileSharing
  const primaryIsPrepare = mobileActions && !generatedFileIsCurrent
  const showSecondaryDownload = mobileActions && (primaryIsShare || primaryIsPrepare)
  useLayoutEffect(() => {
    const guard = generationGuard.current
    guard.update(open ? documentKey : null)
    return () => guard.update(null)
  }, [documentKey, open])
  const validationErrors = useMemo(() => validateCostingExportInput(model, options), [model, options])
  const canGenerate = validationErrors.length === 0 && status !== 'saving' && status !== 'generating'
  const isBusy = status === 'saving' || status === 'generating' || sharing
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
    if (tutorialPreview) return
    if (!model || validationErrors.length > 0) {
      const message = validationErrors[0] ?? 'Complete the document details before printing.'
      setErrorMessage(message)
      toast.error(message)
      return
    }

    const isCurrentGeneration = generationGuard.current.begin(documentKey)
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
      if (!isCurrentGeneration()) {
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

  const startDownload = (blob: Blob, filename: string) => {
    downloadBlob(blob, filename)
    setStatus('download-started')
    setErrorMessage(null)
    toast.success(t('base_plan.export.pdf_ready'), { description: `${tx('Download started')}: ${filename}` })
  }

  const handlePdf = async (intent: 'prepare' | 'download' = 'download') => {
    if (tutorialPreview) return
    if (!model || validationErrors.length > 0) {
      const message = validationErrors[0] ?? 'Complete the document details before generating the PDF.'
      setErrorMessage(message)
      toast.error(message)
      return
    }

    // A prepared file belongs to this exact preview. Repeated downloads do not
    // render a second PDF or persist quotation metadata again.
    if (generatedFileIsCurrent && generatedBlob) {
      if (intent === 'download') startDownload(generatedBlob, generatedFilename)
      else setStatus('generated')
      return
    }

    const isCurrentGeneration = generationGuard.current.begin(documentKey)
    setStatus('generating')
    setErrorMessage(null)
    try {
      if (!(await persistCustomerMetadata())) return
      if (!isCurrentGeneration()) return
      setStatus('generating')

      const { jsPDF } = await import('jspdf')
      if (!isCurrentGeneration()) return
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const host = document.createElement('div')
      // The document is laid out 700px wide and scaled onto the 523pt A4 text
      // block (x0.747), so its 12px body text prints at about 9pt.
      host.style.width = `${PDF_LAYOUT_WIDTH_PX}px`
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
          windowWidth: PDF_LAYOUT_WIDTH_PX,
        })
      } finally {
        host.remove()
      }

      const filename = getCostingExportFilename(model, options)
      const blob = pdf.output('blob')
      if (!isCurrentGeneration()) return
      setGeneratedBlob(blob)
      setGeneratedFilename(filename)
      setGeneratedDocumentKey(documentKey)
      if (intent === 'download') startDownload(blob, filename)
      else {
        setStatus('generated')
        toast.success(t('base_plan.export.pdf_ready'))
      }
      void trackPlanEvent('export_completed', { mode })
    } catch (error) {
      if (!isCurrentGeneration()) return
      console.error(error)
      setStatus('failed')
      void trackPlanEvent('export_failed', { mode })
      const message = 'PDF generation failed. Retry or use Print as a fallback.'
      setErrorMessage(message)
      toast.error(message)
    }
  }

  const handleShare = async () => {
    if (tutorialPreview) return
    if (!shareFile || !model || !generatedFileIsCurrent) {
      const message = t('base_plan.export.prepare_first')
      setErrorMessage(message)
      toast.error(message)
      return
    }

    setSharing(true)
    setErrorMessage(null)
    const isCurrentGeneration = generationGuard.current.begin(documentKey)
    const message = buildQuotationShareMessage(model, options)
    try {
      const result = await sharePreparedDocument({
        files: [shareFile],
        title: `Quotation ${options.documentReference || model.qualityLabel}`,
        text: message,
      })
      if (!isCurrentGeneration()) return
      if (result === 'shared') {
        setStatus('share-opened')
        toast.info(t('base_plan.export.share_handoff'), { description: t('base_plan.export.delivery_unconfirmed') })
      } else if (result === 'unsupported') {
        toast.info(t('base_plan.export.share_unavailable'))
      }
    } catch (error) {
      if (!isCurrentGeneration()) return
      console.error(error)
      const message = t('base_plan.export.share_failed')
      setStatus('failed')
      setErrorMessage(message)
      toast.error(message)
    } finally {
      if (isCurrentGeneration()) setSharing(false)
    }
  }

  return (
    <Dialog modal={!tutorialPreview} open={open} onOpenChange={value => { if (!tutorialPreview) onOpenChange(value) }}>
      <DialogContent showCloseButton={!tutorialPreview} data-costing-tour-dialog={tutorialPreview ? "true" : undefined} data-tour-surface={tutorialPreview ? "true" : undefined} onOpenAutoFocus={event => {if (tutorialPreview) event.preventDefault()}} onCloseAutoFocus={event => {if (tutorialPreview) event.preventDefault()}} onInteractOutside={event => {if (tutorialPreview) event.preventDefault()}} onEscapeKeyDown={event => {if (tutorialPreview) event.preventDefault()}} className="max-h-[95vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-[var(--wv-action-primary)]" />
            {mode === 'customer' ? 'Preview Customer Quotation' : 'Preview Internal Cost Estimate'}
          </DialogTitle>
          <DialogDescription>
            Confirm exactly what will be shared before generating the document.
          </DialogDescription>
        </DialogHeader>

        {documentSource && (() => {
          const source = describeDocumentSource(documentSource, mode)
          return <p data-document-source className="break-words rounded-lg border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] px-3 py-2 text-sm font-semibold text-[var(--wv-text-primary)]">{tx(source.text, source.values)}</p>
        })()}

        {savedQuotation && displayedQuoteStatus && (
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between" role="status">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-xs font-semibold text-[var(--wv-text-secondary)]">Quotation status</span>
              <span className="rounded-full border border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] px-2.5 py-1 text-[11px] font-bold text-[var(--wv-text-primary)]">{displayedQuoteStatus[0].toUpperCase() + displayedQuoteStatus.slice(1)}</span>
            </div>
            <p className="text-xs text-[var(--wv-text-secondary)]">Updated {formatToSurat(latestQuoteUpdatedAt ?? new Date(), 'd MMM yyyy, h:mm a')}</p>
            <p className="text-[11px] text-[var(--wv-text-secondary)] sm:max-w-xs sm:text-right">PDF sharing does not confirm delivery.</p>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <section className="min-w-0 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] p-2">
            <div className="mb-2 flex items-center justify-between gap-3 px-2">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-[var(--wv-text-secondary)]">Live preview</p>
                <p className="mt-1 text-xs text-[var(--wv-text-secondary)]">The PDF uses this same document layout.</p>
              </div>
              {status !== 'idle' && !documentChanged && (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${status === 'failed' ? 'bg-[var(--wv-status-danger-bg)] text-[var(--wv-status-danger-fg)] border border-[var(--wv-status-danger-border)]' : status.includes('started') || status.includes('opened') || status === 'generated' ? 'bg-[var(--wv-status-success-bg)] text-[var(--wv-status-success-fg)] border border-[var(--wv-status-success-border)]' : 'bg-[var(--wv-status-info-bg)] text-[var(--wv-status-info-fg)] border border-[var(--wv-status-info-border)]'}`}>
                  {status === 'generated' ? t('base_plan.export.pdf_ready') : status === 'share-opened' ? t('base_plan.export.share_handoff') : tx(statusLabel(status))}
                </span>
              )}
            </div>
            <iframe
              title={mode === 'customer' ? 'Customer quotation preview' : 'Internal cost estimate preview'}
              srcDoc={previewHtml}
              sandbox=""
              className="h-[min(65vh,680px)] w-full rounded-lg border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-surface)] shadow-inner"
            />
          </section>

          <section className="space-y-4">
            <div data-costing-tour="export-modes" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <button
                type="button"
                onClick={() => switchMode('internal')}
                disabled={isBusy}
                className={`rounded-xl border p-4 text-left transition-colors ${mode === 'internal' ? 'border-[var(--wv-neel-700)] bg-[var(--wv-neel-50)] shadow-[inset_2px_0_0_var(--wv-brand-accent)]' : 'border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] hover:border-[var(--wv-border-strong)]'}`}
              >
                <FileText className="mb-3 h-5 w-5 text-[var(--wv-neel-700)]" />
                <p className="font-semibold text-[var(--wv-text-primary)]">{tx('Internal Cost Estimate')}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--wv-text-secondary)]">Detailed costs, assumptions, break-even, margin, and profit stay inside the factory.</p>
              </button>
              <button
                type="button"
                onClick={() => switchMode('customer')}
                disabled={isBusy}
                className={`rounded-xl border p-4 text-left transition-colors ${mode === 'customer' ? 'border-[var(--wv-moss-700)] bg-[var(--wv-moss-50)] shadow-[inset_2px_0_0_var(--wv-brand-accent)]' : 'border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] hover:border-[var(--wv-border-strong)]'}`}
              >
                <ReceiptText className="mb-3 h-5 w-5 text-[var(--wv-status-success-fg)]" />
                <p className="font-semibold text-[var(--wv-text-primary)]">{tx('Customer Quotation')}</p>
                <p className="mt-1 text-xs leading-relaxed text-[var(--wv-text-secondary)]">Final price and commercial details only. Internal costs and margin stay hidden.</p>
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <div className="space-y-1.5">
                <Label htmlFor="export-business-name">Business name</Label>
                <Input id="export-business-name" value={businessName} onChange={event => setBusinessName(event.target.value)} placeholder="Your weaving business" disabled={isBusy} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-customer-name">Party / customer {mode === 'customer' ? '' : '(optional)'}</Label>
                <Input id="export-customer-name" value={customerName} onChange={event => setCustomerName(event.target.value)} placeholder="Customer or party name" disabled={savedQuotation || isBusy} aria-describedby={savedQuotation ? 'export-customer-name-help' : undefined} />
                {savedQuotation && <p id="export-customer-name-help" className="text-xs text-[var(--wv-text-secondary)]">This customer name is locked because the quotation has already been saved.</p>}
              </div>
              {mode === 'customer' && (
                <div className="space-y-1.5">
                  <Label htmlFor="export-valid-until">Valid until</Label>
                  <Input id="export-valid-until" type="date" value={validUntil} onChange={event => setValidUntil(event.target.value)} disabled={lockedQuotation || isBusy} aria-describedby={lockedQuotation ? 'export-valid-until-help' : undefined} />
                  {lockedQuotation && <p id="export-valid-until-help" className="text-xs text-[var(--wv-text-secondary)]">Accepted quotations keep their original validity date.</p>}
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
                  disabled={isBusy || (lockedQuotation && mode === 'customer')}
                  aria-describedby={lockedQuotation && mode === 'customer' ? 'export-terms-help' : undefined}
                />
                {lockedQuotation && mode === 'customer' && <p id="export-terms-help" className="text-xs text-[var(--wv-text-secondary)]">Accepted quotations keep their original customer terms.</p>}
              </div>
              {mode === 'customer' && (
                <div className="flex items-center justify-between gap-4 rounded-lg border border-[var(--wv-border-subtle)] p-3">
                  <div>
                    <Label htmlFor="export-gst-note">Show GST detail note</Label>
                    <p className="text-xs text-[var(--wv-text-secondary)]">The quotation-only, not-a-tax-invoice disclaimer is always shown.</p>
                  </div>
                  <Switch id="export-gst-note" checked={showGstNote} onCheckedChange={setShowGstNote} disabled={isBusy} />
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--wv-text-secondary)]">Filename</p>
              <p className="mt-1 break-all font-mono text-xs font-semibold text-[var(--wv-text-primary)]">
                {(generatedFileIsCurrent && generatedFilename) || (model ? getCostingExportFilename(model, options) : 'Ready after preview')}
              </p>
              {documentReference && <p className="mt-1 text-xs text-[var(--wv-text-secondary)]">Reference: {documentReference}</p>}
            </div>

            {validationErrors.length > 0 && (
              <div className="rounded-xl border border-[var(--wv-status-warning-border)] bg-[var(--wv-status-warning-bg)] p-3 text-sm text-[var(--wv-status-warning-fg)]" role="alert">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wv-status-warning-fg)]" />
                  <div>
                    <p className="font-bold">Complete this before generating</p>
                    <ul className="mt-1 list-disc space-y-1 pl-4 text-xs">
                      {validationErrors.map(error => <li key={error}>{error}</li>)}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {documentChanged && <p role="status" data-i18n-skip="true" className="rounded-xl border border-[var(--wv-status-warning-border)] bg-[var(--wv-status-warning-bg)] p-3 text-sm text-[var(--wv-status-warning-fg)]">{t('base_plan.export.document_changed')}</p>}
            {status === 'generated' && generatedFileIsCurrent && <p role="status" data-i18n-skip="true" className="rounded-xl border border-hairline bg-surface-soft p-3 text-sm text-body">{t(mode === 'customer' && nativeFileSharing ? 'base_plan.export.ready_to_share' : 'base_plan.export.ready_to_download')}</p>}
            {generatedFileIsCurrent && mode === 'customer' && !nativeFileSharing && <p data-i18n-skip="true" className="text-sm leading-relaxed text-body">{t('base_plan.export.share_unavailable')}</p>}
            {status === 'download-started' && generatedFileIsCurrent && (
              <div className="rounded-xl border border-[var(--wv-status-success-border)] bg-[var(--wv-status-success-bg)] p-3 text-sm text-[var(--wv-status-success-fg)]">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wv-status-success-fg)]" />
                  <div>
                    <p className="font-bold">PDF generated and download started</p>
                    <p className="mt-1 text-xs">Check your browser Downloads folder. The system cannot verify the device save location.</p>
                  </div>
                </div>
              </div>
            )}
            {status === 'failed' && errorMessage && (
              <div className="rounded-xl border border-[var(--wv-status-danger-border)] bg-[var(--wv-status-danger-bg)] p-3 text-sm text-[var(--wv-status-danger-fg)]" role="alert">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wv-status-danger-fg)]" />
                  <div>
                    <p className="font-bold">Document action failed</p>
                    <p className="mt-1 text-xs">{errorMessage}</p>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <DialogFooter data-costing-tour="export-actions" className="flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {exportActionHint && <p id="export-action-help" className="text-xs font-medium leading-relaxed text-[var(--wv-status-warning-fg)] sm:max-w-sm">{exportActionHint}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void handlePrint()} disabled={!model || isBusy || validationErrors.length > 0} aria-describedby={exportActionHint ? 'export-action-help' : undefined}>
              <Printer className="h-4 w-4" /> <span data-i18n-skip="true">{t('base_plan.export.print')}</span>
            </Button>
            {showSecondaryDownload && <Button type="button" variant="outline" onClick={() => void handlePdf('download')} disabled={!model || !canGenerate || isBusy} aria-describedby={exportActionHint ? 'export-action-help' : undefined}>
              <Download className="h-4 w-4" /><span data-i18n-skip="true">{t('base_plan.export.download_pdf')}</span>
            </Button>}
            {!mobileActions && generatedFileIsCurrent && mode === 'customer' && nativeFileSharing && (
              <Button type="button" variant="outline" onClick={() => void handleShare()} disabled={isBusy}>
                {sharing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                <span data-i18n-skip="true">{t('base_plan.export.share_pdf')}</span>
              </Button>
            )}
            {status === 'share-opened' && generatedFileIsCurrent && <span data-i18n-skip="true" className="flex items-center gap-1 text-xs font-semibold text-[var(--wv-text-secondary)]"><ExternalLink className="h-3.5 w-3.5" /> {t('base_plan.export.delivery_unconfirmed')}</span>}
          </div>
          <div className="flex gap-2">
            {!tutorialPreview && <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>}
            <Button type="button" onClick={() => primaryIsShare ? void handleShare() : void handlePdf(primaryIsPrepare ? 'prepare' : 'download')} disabled={!model || !canGenerate || isBusy} aria-describedby={exportActionHint ? 'export-action-help' : undefined} className="bg-[var(--wv-action-primary)] text-[var(--wv-text-on-action)] hover:bg-[var(--wv-action-primary-hover)]">
              {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : primaryIsShare ? <Share2 className="h-4 w-4" /> : primaryIsPrepare ? <FileText className="h-4 w-4" /> : <Download className="h-4 w-4" />}
              <span data-i18n-skip="true">{primaryIsShare ? t('base_plan.export.share_pdf') : primaryIsPrepare ? t(documentChanged ? 'base_plan.export.prepare_updated_pdf' : 'base_plan.export.prepare_pdf') : documentChanged ? tx('Download updated PDF') : t(status === 'download-started' ? 'base_plan.export.download_again' : 'base_plan.export.download_pdf')}</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
