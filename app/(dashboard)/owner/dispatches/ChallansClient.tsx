'use client'
import { reportPwaWorkflowSuccess } from '@/lib/pwa-workflow-success'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
    Plus,
    Search,
    Truck,
    RefreshCw,
    AlertTriangle,
    History,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { railPrimaryAction } from '@/components/ui/rail'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { PageGuide } from '@/components/tours/TourInvitation'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { useTranslation } from '@/lib/i18n/context'
import { useTourSample } from '@/lib/tours/sample-context'
import { tourSurfaceProps } from '@/lib/tours/sample-surface'
import { dispatchSampleDraft, dispatchSampleFields, dispatchSampleSelectedId } from '@/lib/tours/sample-data/dispatch'
import type { DispatchTourStep } from '@/lib/dispatch-tour'
import {
    paymentStatus,
    type Challan,
    type ChallanDraft,
    type ChallanEvent,
    type ChallanMutation,
} from '@/lib/delivery-challans'
import type { StockQuality } from '@/lib/quality-stock'
import { getChallan, listChallans, mutateChallan } from './challan-actions'
import { businessDate, challanDueStatus } from '@/lib/challan-payment-terms'
import { isSameChallanDraft } from '@/lib/challan-draft-entry'
import ChallanDraftEditor from './ChallanDraftEditor'
import DispatchDetailDialog from './DispatchDetailDialog'
import { deliveryBadgeVariant, formatDocumentDate, formatMeters, paymentBadgeVariant } from '@/lib/dispatch-detail'

function NewDispatchButton({ onClick, disabled, label, tourAnchor }: { onClick: () => void; disabled: boolean; label: string; tourAnchor?: "dispatch.new" }) {
    return (
        <Button data-tour-anchor={tourAnchor} disabled={disabled} onClick={onClick} className={railPrimaryAction}>
            <Plus className="size-4" aria-hidden="true" />
            {label}
        </Button>
    )
}

const blank = (): ChallanDraft => ({
    quality_id: '',
    selling_rate: 0,
    document: { date: new Date().toLocaleDateString('en-CA') },
    lines: [{ lot: '', meters: 0 }],
})
export default function ChallansClient({
    initialData,
    qualities,
    businessName,
}: {
    initialData: Challan[]
    qualities: StockQuality[]
    /** The factory's name from its account; the editor's preview falls back to the sender name without it. */
    businessName?: string
}) {
    const { t, language } = useTranslation()
    const tx = (s: string) => t(`challan.${s}`)
    const tourSample = useTourSample('dispatch')
    const tourStep = tourSample?.step as DispatchTourStep | undefined
    const surface = tourSurfaceProps(Boolean(tourSample))
    const [today, setToday] = useState(businessDate)
    useEffect(() => {
        const refresh = () => setToday(businessDate())
        const timer = window.setInterval(refresh, 60000)
        window.addEventListener('focus', refresh)
        return () => {
            window.clearInterval(timer)
            window.removeEventListener('focus', refresh)
        }
    }, [])
    function dueLabel(d: Challan) {
        const status = challanDueStatus(d, today)
        return status ? t(`challan.${status.kind}`, { days: status.days }) : ''
    }
    const [rows, setRows] = useState(initialData),
        [history, setHistory] = useState(false),
        [search, setSearch] = useState(''),
        [busy, setBusy] = useState(false),
        [error, setError] = useState('')
    const [selectedState, setSelected] = useState<Challan | null>(null),
        [events, setEvents] = useState<ChallanEvent[]>([]),
        [eventsLoading, setEventsLoading] = useState(false),
        [draftState, setDraft] = useState<ChallanDraft | null>(null)
    const [operationState, setOperation] = useState<
            ChallanMutation['action'] | null
        >(null),
        [fieldsState, setFields] = useState<Record<string, string>>({}),
        [pending, setPending] = useState<ChallanMutation | null>(null)
    // While the Dispatch tour teaches a step, show the real editor, detail or dialog it is about, filled with sample data.
    const sampleDraft = useMemo(() => dispatchSampleDraft(language), [language])
    const tourSelectedId = tourStep ? dispatchSampleSelectedId(tourStep) : null
    const selected = (tourSelectedId ? rows.find((row) => row.id === tourSelectedId) : undefined) ?? selectedState
    const draft = tourStep && ['quality', 'parties', 'lots', 'saveDraft'].includes(tourStep) ? sampleDraft : draftState
    const operation: ChallanMutation['action'] | null = tourStep === 'confirm' || tourStep === 'receipt' || tourStep === 'payment' ? tourStep : operationState
    const fields = (tourStep && dispatchSampleFields(tourStep)) || fieldsState
    const lock = useRef(false),
        draftId = useRef(''),
        // Bumped when the detail closes, so a load still in flight cannot reopen it.
        viewRequest = useRef(0)
    useEffect(() => {
        if (tourSample) return // a tour sample never reads the real page's pending request
        try {
            const stored = sessionStorage.getItem('weavly-challan-pending')
            if (stored) setPending(JSON.parse(stored))
        } catch {
            /* Storage may be unavailable. */
        }
    }, [tourSample])
    function remember(req: ChallanMutation | null) {
        setPending(req)
        try {
            if (req)
                sessionStorage.setItem(
                    'weavly-challan-pending',
                    JSON.stringify(req),
                )
            else sessionStorage.removeItem('weavly-challan-pending')
        } catch {
            /* Keep in-memory retry protection. */
        }
    }
    const money = (n: number) =>
        Number(n).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    async function load(h = history, more = false) {
        setBusy(true)
        try {
            const result = await listChallans(h, search, more ? rows.length : 0)
            if (result.error) setError(result.error)
            else {
                setRows((old) =>
                    more ? [...old, ...result.data!] : result.data!,
                )
                setHistory(h)
            }
        } catch {
            setError(tx('loadError'))
        } finally {
            setBusy(false)
        }
    }
    async function view(id: string) {
        const request = ++viewRequest.current
        setBusy(true)
        try {
            const r = await getChallan(id)
            if (request !== viewRequest.current) return
            if (r.error) setError(r.error)
            else {
                setSelected(r.data!)
                setEvents(r.events!)
                setDraft(null)
            }
        } catch {
            if (request === viewRequest.current) setError(tx('loadError'))
        } finally {
            setBusy(false)
            if (request === viewRequest.current) setEventsLoading(false)
        }
    }
    /** Opens the dispatch at once from its list row; only its history waits for the server. */
    function openDetail(d: Challan) {
        setSelected(d)
        setEvents([])
        setEventsLoading(true)
        setError('')
        void view(d.id)
    }
    /** Resolves to the saved challan's id, or null when nothing was saved. `onSaved` runs the moment the server confirms, before the lists reload. */
    async function save(
        action: ChallanMutation['action'],
        payload: Record<string, unknown>,
        onSaved?: (id: string) => void,
    ): Promise<string | null> {
        if (lock.current) return null
        lock.current = true
        setBusy(true)
        setError('')
        const req = pending ?? {
            id: selected?.id ?? draftId.current,
            requestId: crypto.randomUUID(),
            version: selected?.version ?? 0,
            action,
            payload,
        }
        remember(req)
        try {
            const result = await mutateChallan(req)
            if ('error' in result) {
                setError(result.error!)
                if (!result.uncertain) remember(null)
                return null
            }
            remember(null)
            onSaved?.(result.id)
            setDraft(null)
            setOperation(null)
            if (!tourSample) reportPwaWorkflowSuccess('dispatch')
            await view(result.id)
            await load()
            return result.id
        } catch {
            setError(tx('retry'))
            return null
        } finally {
            lock.current = false
            setBusy(false)
        }
    }
    /**
     * Prints the draft. A challan prints with its number, which saving assigns,
     * so the draft is saved first, unless it is a saved draft left unchanged.
     * The tab opens inside the click, where popup blockers allow it, and goes
     * to the print page once the challan exists.
     */
    async function savePrint(value: ChallanDraft) {
        if (tourSample || lock.current || pending) return
        const tab = window.open('', '_blank')
        if (tab) tab.opener = null
        const openPrint = (id: string) => {
            if (tab) tab.location.href = `/owner/dispatches/${id}/print`
            else setError(tx('printBlocked'))
        }
        if (selected && isSameChallanDraft(value, selected)) {
            openPrint(selected.id)
            return
        }
        if (!(await save('save', value, openPrint))) tab?.close()
    }
    function start(action: ChallanMutation['action']) {
        setOperation(action)
        setFields(
            action === 'payment_terms'
                ? {
                      payment_due_date: selected?.payment_due_date ?? '',
                      payment_terms: selected?.payment_terms ?? '',
                  }
                : action === 'receipt'
                  ? { meters: String(selected?.sent_meters ?? '') }
                  : action === 'resolve'
                    ? { decision: 'accepted' }
                    : ['payment', 'refund'].includes(action)
                      ? {
                            date: new Date().toLocaleDateString('en-CA'),
                            method: 'bank',
                        }
                      : {},
        )
        setError('')
    }
    function beginDraft() {
        setSelected(null)
        setDraft(blank())
        draftId.current = crypto.randomUUID()
        setError('')
    }
    const field = (key: string, type = 'text', required = false) => (
        <label key={key} className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>{tx(key === 'evidence' ? 'evidenceLink' : key)}{required ? ' *' : ''}</span>
            <Input
                type={type}
                step={type === 'number' ? '0.01' : undefined}
                required={required}
                maxLength={1000}
                value={fields[key] ?? ''}
                onChange={(e) =>
                    setFields({ ...fields, [key]: e.target.value })
                }
                className="h-10 sm:h-11 rounded-xl border-hairline bg-surface text-ink text-sm font-normal normal-case shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
            />
        </label>
    )
    return (
        <div
            data-i18n-skip="true"
            className="dispatch-workspace-shell w-full space-y-5 pb-10 sm:space-y-6"
        >
            <RouteMilestones route="/owner/dispatches" shellVisible primaryUsable />
            <PageHeader
                title={tx('title')}
                description={<span className="sr-only">{tx('intro')}</span>}
                actions={<>
                    <PageGuide />
                    <NewDispatchButton tourAnchor="dispatch.new" onClick={beginDraft} disabled={busy || !!pending} label={tx('new')} />
                </>}
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <LiquidSegmented
                    className="w-full sm:w-fit"
                    fullWidth
                    aria-label={tx('dispatchViews')}
                    disabled={busy}
                    value={history ? 'history' : 'active'}
                    onValueChange={(value) => {
                        void load(value === 'history')
                    }}
                    options={[
                        { value: 'active', label: tx('active') },
                        { value: 'history', label: tx('history') },
                    ]}
                />
                <form
                    className="flex min-w-0 flex-1 gap-2"
                    onSubmit={(event) => {
                        event.preventDefault()
                        void load()
                    }}
                >
                    <div className="relative min-w-0 flex-1">
                        <Search
                            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60"
                            aria-hidden="true"
                        />
                        <Input
                            type="search"
                            className="h-11 w-full rounded-xl border-hairline/80 bg-surface/95 pl-10 pr-3 text-sm text-ink shadow-xs placeholder:text-subtle/60 focus-visible:border-saffron focus-visible:ring-saffron/30"
                            aria-label={tx('search')}
                            placeholder={tx('search')}
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Button
                        type="submit"
                        variant="outline"
                        disabled={busy}
                        aria-label={tx('searchButton')}
                        className="h-11 shrink-0 rounded-xl px-3 text-xs sm:text-sm"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{tx('searchButton')}</span>
                    </Button>
                </form>
            </div>
            {error && (
                <p
                    role="alert"
                    className="rounded-xl border border-risk/25 bg-risk-soft/55 p-3 text-sm font-medium text-risk"
                >
                    {error}
                </p>
            )}
            {pending && !busy && (
                <Button variant="secondary" onClick={() => save(pending.action, pending.payload)} className="h-9 rounded-xl text-xs">
                    {tx('retryButton')}
                </Button>
            )}
            <section data-dispatch-tour="overview" aria-labelledby="challan-list-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="challan-list-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                        {tx(history ? 'historyHeading' : 'activeHeading')}
                    </h2>
                    <span className="text-xs font-medium tabular-nums text-subtle">
                        {t('challan.recordCount', { count: rows.length })}
                    </span>
                </div>
                <div key={history ? 'history' : 'active'} className="ui-content-swap grid gap-2.5">
                    {rows.map((d) => {
                        const isDisputed = ['review', 'disputed'].includes(d.difference_status)
                        const isSelected = selected?.id === d.id
                        const balanceLabel = Number(d.balance) < 0 ? tx('credit') : tx('balance')
                        return (
                            <button
                                key={d.id}
                                type="button"
                                aria-pressed={isSelected}
                                className={isSelected
                                    ? 'grid w-full grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border border-saffron/60 bg-surface/95 p-4 text-left shadow-[var(--shadow-card)] ring-1 ring-saffron/20 transition-[border-color,box-shadow,transform] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'
                                    : 'grid w-full grid-cols-1 gap-x-6 gap-y-3 rounded-2xl border border-hairline/85 bg-surface/95 p-4 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] hover:border-saffron/35 hover:shadow-[var(--shadow-panel)] motion-safe:hover:-translate-y-0.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center'}
                                onClick={() => openDetail(d)}
                                disabled={busy || !!pending}
                            >
                                <div className="min-w-0">
                                    <p className="font-mono text-[11px] font-semibold tracking-[0.08em] text-subtle">
                                        {d.number}
                                    </p>
                                    <h3 className="mt-1 truncate text-[15px] font-bold leading-tight tracking-tight text-ink">
                                        {d.document.customer_name}
                                    </h3>
                                    <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-body">
                                        <span className="font-medium text-ink">{d.quality_label}</span>
                                        <span aria-hidden="true" className="text-subtle/60">·</span>
                                        <span className="tabular-nums">{formatMeters(d.sent_meters)} m</span>
                                        <span aria-hidden="true" className="text-subtle/60">·</span>
                                        <time dateTime={d.document.date}>{formatDocumentDate(d.document.date)}</time>
                                    </p>
                                </div>
                                <div className="flex min-w-0 flex-col gap-2 sm:items-end">
                                    <div className="flex flex-wrap items-center gap-1.5 sm:justify-end">
                                        <Badge variant={deliveryBadgeVariant(d.delivery_status)} className="border-current/10 text-[10px] font-semibold">
                                            {tx(d.delivery_status)}
                                        </Badge>
                                        <Badge variant={paymentBadgeVariant(paymentStatus(d))} className="border-current/10 text-[10px] font-semibold">
                                            {tx(paymentStatus(d))}
                                        </Badge>
                                    </div>
                                    <div className="sm:text-right">
                                        <p className="text-[15px] font-bold leading-tight tabular-nums text-ink">
                                            <span className="sr-only">{balanceLabel}: </span>
                                            ₹{money(Math.abs(d.balance))}
                                        </p>
                                        <p className="mt-1 text-[11px] font-medium leading-snug text-subtle">
                                            {Number(d.balance) <= 0
                                                ? Number(d.balance) < 0 ? tx('credit') : tx('paidInFull')
                                                : <>
                                                    {dueLabel(d)}
                                                    {d.payment_due_date && ' · ' + formatDocumentDate(d.payment_due_date)}
                                                </>}
                                        </p>
                                    </div>
                                </div>
                                {isDisputed && (
                                    <div className="col-span-full flex items-center gap-1.5 rounded-xl border border-warning/25 bg-warning-soft/55 px-3 py-1.5 text-xs font-semibold text-warning">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        <span>{tx(d.difference_status)}</span>
                                    </div>
                                )}
                            </button>
                        )
                    })}
                </div>
                {!rows.length && (
                    <EmptyState
                        icon={history ? History : Truck}
                        title={tx('empty')}
                        action={!history && !search.trim() && (
                            <NewDispatchButton onClick={beginDraft} disabled={busy || !!pending} label={tx('new')} />
                        )}
                    />
                )}
                {rows.length > 0 && rows.length % 50 === 0 && (
                    <Button variant="outline" onClick={() => load(history, true)} disabled={busy} className="h-10 rounded-xl text-xs">
                        {tx('more')}
                    </Button>
                )}
            </section>
            <Dialog
                open={!!draft}
                onOpenChange={(open) => {
                    if (!open && !busy && !pending) setDraft(null)
                }}
                {...surface.root}
            >
                <DialogContent
                    data-i18n-skip="true"
                    {...surface.content}
                    className="flex h-[92dvh] max-h-[92dvh] w-[calc(100%-1rem)] flex-col overflow-hidden sm:max-w-6xl"
                >
                    <DialogHeader>
                        <DialogTitle>{tx('draftTitle')}</DialogTitle>
                        <DialogDescription>{tx('draftHelp')}</DialogDescription>
                    </DialogHeader>
                    {draft && (
                        <ChallanDraftEditor
                            draft={draft}
                            onChange={setDraft}
                            onSave={(value) => save('save', value)}
                            onSavePrint={savePrint}
                            qualities={qualities}
                            number={selected?.number}
                            businessName={businessName}
                            disabled={busy || !!pending}
                            error={error}
                        />
                    )}
                    {pending && !busy && (
                        <Button
                            variant="outline"
                            className="mt-3 w-full h-10 rounded-xl border-hairline font-semibold shadow-xs"
                            onClick={() =>
                                save(pending.action, pending.payload)
                            }
                        >
                            {tx('retryButton')}
                        </Button>
                    )}
                </DialogContent>
            </Dialog>
            <DispatchDetailDialog
                challan={selected}
                // A tour step that teaches an operation shows only that dialog; one tour surface at a time.
                open={!!selected && !draft && !(tourSample && operation)}
                events={events}
                eventsLoading={eventsLoading}
                busy={busy}
                locked={busy || !!pending}
                error={error}
                onRetry={pending && !busy ? () => save(pending.action, pending.payload) : undefined}
                today={today}
                surface={surface}
                onClose={() => {
                    // A save in progress keeps the dispatch open; a history load does not.
                    if (lock.current || pending) return
                    viewRequest.current++
                    setSelected(null)
                    setEvents([])
                    setEventsLoading(false)
                    setError('')
                }}
                onRefresh={() => selected && view(selected.id)}
                onStart={start}
                onReceivedAsSent={() => selected && save('receipt', { meters: selected.sent_meters })}
                onEditDraft={() =>
                    selected &&
                    setDraft({
                        quality_id: selected.quality_id,
                        selling_rate: selected.selling_rate,
                        document: selected.document,
                        lines: selected.lines,
                    })
                }
                onReverseEntry={(eventId) => {
                    start('reverse_entry')
                    setFields({ event_id: eventId })
                }}
            />
            <Dialog
                open={!!operation}
                onOpenChange={(open) => {
                    if (!open && !busy && !pending) setOperation(null)
                }}
                {...surface.root}
            >
                <DialogContent data-i18n-skip="true" data-dispatch-tour={operation ?? undefined} {...surface.content} className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-lg font-extrabold tracking-tight text-ink">
                            {operation
                                ? tx(
                                      operation === 'payment_terms'
                                          ? 'changePaymentTerms'
                                          : operation,
                                  )
                                : ''}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">
                            {operation === 'confirm'
                                ? tx('confirmHelp')
                                : operation === 'reverse_dispatch'
                                  ? tx('reverseHelp')
                                  : operation === 'payment_terms'
                                    ? tx('paymentTermsChangeHelp')
                                    : tx('operationHelp')}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        className="space-y-4 pt-2"
                        onSubmit={(e) => {
                            e.preventDefault()
                            if (!operation) return
                            const payload: Record<string, unknown> = {
                                ...fields,
                            }
                            if (
                                ['payment', 'refund', 'adjustment'].includes(
                                    operation,
                                )
                            )
                                payload.amount = Number(fields.amount)
                            if (operation === 'receipt')
                                payload.meters = Number(fields.meters)
                            if (operation === 'reverse_dispatch')
                                payload.stock_present =
                                    fields.stock_present === 'true'
                            save(operation, payload)
                        }}
                    >
                        <fieldset
                            disabled={busy || !!pending}
                            className="space-y-4"
                        >
                            {operation === 'payment_terms' && (
                                <>
                                    {field('payment_due_date', 'date')}
                                    {field('payment_terms')}
                                </>
                            )}
                            {operation === 'receipt' && (
                                <>
                                    {field('meters', 'number', true)}
                                    {field('evidence', 'url')}
                                </>
                            )}
                            {operation === 'resolve' && (
                                <label className="grid gap-1.5">
                                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        {tx('decision')}
                                    </span>
                                    <select
                                        className="h-10 rounded-xl border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                                        value={fields.decision}
                                        onChange={(e) =>
                                            setFields({
                                                ...fields,
                                                decision: e.target.value,
                                            })
                                        }
                                    >
                                        <option value="accepted">
                                            {tx('accepted')}
                                        </option>
                                        <option value="disputed">
                                            {tx('disputed')}
                                        </option>
                                    </select>
                                </label>
                            )}
                            {operation &&
                                ['payment', 'refund', 'adjustment'].includes(
                                    operation,
                                ) &&
                                field('amount', 'number', true)}
                            {operation &&
                                ['payment', 'refund'].includes(operation) && (
                                    <>
                                        {field('date', 'date', true)}
                                        {field('method', 'text', true)}
                                    </>
                                )}
                            {operation !== 'confirm' &&
                                field(
                                    'reason',
                                    'text',
                                    operation !== 'receipt' ||
                                        selected?.delivery_status ===
                                            'received',
                                )}
                            {operation === 'reverse_dispatch' && (
                                <label className="flex items-center gap-2.5 p-3 rounded-xl border border-hairline bg-surface-soft/40 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        required
                                        className="h-4 w-4 rounded border-hairline text-loom focus:ring-loom"
                                        checked={
                                            fields.stock_present === 'true'
                                        }
                                        onChange={(e) =>
                                            setFields({
                                                ...fields,
                                                stock_present: String(
                                                    e.target.checked,
                                                ),
                                            })
                                        }
                                    />
                                    <span className="text-sm font-semibold text-ink">
                                        {tx('stockPresent')}
                                    </span>
                                </label>
                            )}
                            <Button
                                type="submit"
                                className="w-full h-11 rounded-xl bg-loom text-white font-bold hover:bg-loom-elevated shadow-xs"
                                disabled={busy || !!pending}
                            >
                                {busy ? (
                                    <span className="inline-flex items-center gap-2">
                                        <RefreshCw className="h-4 w-4 animate-spin" />
                                        {tx('save')}
                                    </span>
                                ) : (
                                    tx('save')
                                )}
                            </Button>
                        </fieldset>
                        {error && (
                            <p role="alert" className="text-xs font-semibold text-[var(--wv-madder-600)] bg-[var(--wv-madder-50)] p-3 rounded-xl border border-[var(--wv-madder-200)]">
                                {error}
                            </p>
                        )}
                        {pending && !busy && (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full h-10 rounded-xl border-hairline font-semibold shadow-xs"
                                onClick={() =>
                                    save(pending.action, pending.payload)
                                }
                            >
                                {tx('retryButton')}
                            </Button>
                        )}
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}
