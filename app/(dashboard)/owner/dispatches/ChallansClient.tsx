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
import type { LegacyStock } from '@/lib/legacy-stock'
import { getChallan, listChallans, mutateChallan } from './challan-actions'
import { businessDate, challanDueStatus } from '@/lib/challan-payment-terms'
import { isSameChallanDraft } from '@/lib/challan-draft-entry'
import ChallanDraftEditor from './ChallanDraftEditor'
import DispatchDetailDialog, { ChallanNumber, DispatchDetailPanel } from './DispatchDetailDialog'
import { useMediaQuery } from '@/hooks/use-media-query'
import { cn } from '@/lib/utils'
import { GoLiveNotice } from '@/components/production/GoLiveNotice'
import { formatGoLiveDate, type BaseGoLivePhase } from '@/lib/base-go-live'
import { deliveryBadgeVariant, formatDocumentDate, formatMeters, paymentBadgeVariant } from '@/lib/dispatch-detail'

function NewDispatchButton({ onClick, disabled, label, tourAnchor }: { onClick: () => void; disabled: boolean; label: string; tourAnchor?: "dispatch.new" }) {
    return (
        <Button data-tour-anchor={tourAnchor} disabled={disabled} onClick={onClick} className={railPrimaryAction}>
            <Plus className="size-4" aria-hidden="true" />
            {label}
        </Button>
    )
}

/** Wide enough to keep the list and the open challan side by side; narrower screens open the challan as a dialog. */
const SPLIT_QUERY = '(min-width: 1280px)'
const DOT: Record<string, string> = { success: 'bg-success', info: 'bg-info', warning: 'bg-[var(--wv-ochre-400)]', risk: 'bg-risk' }

function StatusDot({ variant, label }: { variant: string; label: string }) {
    return (
        <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className={cn('size-1.5 shrink-0 rounded-full', DOT[variant] ?? 'bg-hairline-strong')} />
            {label}
        </span>
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
    legacy = [],
    businessName,
    goLive,
}: {
    initialData: Challan[]
    qualities: StockQuality[]
    /** Legacy (untagged) stock per quality, for the editor's Orange/Legacy hints. */
    legacy?: LegacyStock[]
    /** The factory's name from its account; the editor's preview falls back to the sender name without it. */
    businessName?: string
    /** Challans open on go-live; before it fabric leaves on paper from legacy stock. */
    goLive?: { phase: BaseGoLivePhase; date: string | null }
}) {
    const { t, language } = useTranslation()
    const tx = (s: string) => t(`challan.${s}`)
    const split = useMediaQuery(SPLIT_QUERY)
    const tourSample = useTourSample('dispatch')
    const tourStep = tourSample?.step as DispatchTourStep | undefined
    const surface = tourSurfaceProps(Boolean(tourSample))
    const closedUntilGoLive = !tourSample && Boolean(goLive) && goLive!.phase !== 'live'
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
        [draftState, setDraft] = useState<ChallanDraft | null>(null),
        // The narrow-screen dialog opens only when asked to; the wide panel always shows a challan.
        [detailOpen, setDetailOpen] = useState(false)
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
    async function view(id: string, reveal = true) {
        const request = ++viewRequest.current
        setBusy(true)
        try {
            const r = await getChallan(id)
            if (request !== viewRequest.current) return
            if (r.error) setError(r.error)
            else {
                setSelected(r.data!)
                setEvents(r.events!)
                // A load for the wide panel never touches an open draft; a save or a tap shows its challan.
                if (reveal) {
                    setDraft(null)
                    setDetailOpen(true)
                }
            }
        } catch {
            if (request === viewRequest.current) setError(tx('loadError'))
        } finally {
            setBusy(false)
            if (request === viewRequest.current) setEventsLoading(false)
        }
    }
    /** Opens the dispatch at once from its list row; only its history waits for the server. */
    function openDetail(d: Challan, reveal = true) {
        setSelected(d)
        setEvents([])
        setEventsLoading(true)
        setError('')
        if (reveal) setDetailOpen(true)
        void view(d.id, reveal)
    }
    // On a wide screen the panel always shows a challan from the list: the first one until another is picked.
    const showFirst = useRef(openDetail)
    useEffect(() => { showFirst.current = openDetail })
    useEffect(() => {
        if (!split || tourSample || draftState || pending) return
        if (rows.length > 0 && !rows.some((row) => row.id === selectedState?.id)) showFirst.current(rows[0], false)
    }, [split, tourSample, draftState, pending, rows, selectedState?.id])
    // A Fabric stock card's Dispatch opens here with its quality chosen.
    useEffect(() => {
        if (tourSample) return
        const qualityId = new URLSearchParams(window.location.search).get('quality')
        if (!qualityId) return
        window.history.replaceState(null, '', window.location.pathname)
        if (!qualities.some((quality) => quality.id === qualityId)) return
        viewRequest.current++
        setEventsLoading(false)
        setSelected(null)
        setDraft({ ...blank(), quality_id: qualityId })
        draftId.current = crypto.randomUUID()
    }, [tourSample, qualities])
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
    function editDraft() {
        if (!selected) return
        setDraft({
            quality_id: selected.quality_id,
            selling_rate: selected.selling_rate,
            document: selected.document,
            lines: selected.lines,
        })
    }
    function reverseEntry(eventId: string) {
        start('reverse_entry')
        setFields({ event_id: eventId })
    }
    function beginDraft() {
        // A new draft saves under its own id: no challan may still be loading into `selected` behind it.
        viewRequest.current++
        setEventsLoading(false)
        setSelected(null)
        setDraft(blank())
        draftId.current = crypto.randomUUID()
        setError('')
    }
    // The wide panel shows the chosen challan, or the first in the list while its history loads.
    const shown = selected ?? rows[0] ?? null
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
                    <NewDispatchButton tourAnchor="dispatch.new" onClick={beginDraft} disabled={busy || !!pending || closedUntilGoLive} label={tx('new')} />
                </>}
            />
            {closedUntilGoLive && (
                <GoLiveNotice>{goLive!.date
                    ? t('goLive.challansStart', { date: formatGoLiveDate(goLive!.date, language) })
                    : t('goLive.scheduleTitle')}</GoLiveNotice>
            )}
            <div className="xl:grid xl:h-[calc(100dvh-10.5rem)] xl:min-h-[34rem] xl:grid-cols-[minmax(21rem,25rem)_minmax(0,1fr)] xl:overflow-clip xl:rounded-2xl xl:border xl:border-hairline xl:bg-surface xl:shadow-xs">
            <div className="flex min-h-0 flex-col gap-4 xl:border-r xl:border-hairline xl:bg-surface-soft/40 xl:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:flex-col xl:items-stretch">
                <LiquidSegmented
                    className="w-full sm:w-fit xl:w-full"
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
                            className="h-10 w-full rounded-lg border-hairline bg-surface pl-10 pr-3 text-sm text-ink shadow-xs placeholder:text-[var(--color-placeholder)] focus-visible:border-saffron focus-visible:ring-saffron/30 max-md:min-h-[44px]"
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
                        className="h-10 shrink-0 rounded-lg border-hairline px-3 text-sm max-md:min-h-[44px]"
                    >
                        <Search className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline xl:hidden">{tx('searchButton')}</span>
                    </Button>
                </form>
            </div>
            {error && !(split && shown) && (
                <p
                    role="alert"
                    className="rounded-xl border border-risk/25 bg-risk-soft/55 p-3 text-sm font-medium text-risk"
                >
                    {error}
                </p>
            )}
            {pending && !busy && (
                <Button variant="secondary" onClick={() => save(pending.action, pending.payload)} className="h-10 rounded-lg text-sm">
                    {tx('retryButton')}
                </Button>
            )}
            <section data-dispatch-tour="overview" aria-labelledby="challan-list-heading" className="flex min-h-0 flex-1 flex-col gap-2">
                <div className="flex items-center justify-between gap-3 px-1">
                    <h2 id="challan-list-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                        {tx(history ? 'historyHeading' : 'activeHeading')}
                    </h2>
                    <span className="text-xs font-semibold tabular-nums text-subtle">{rows.length}</span>
                </div>
                <div className="min-h-0 flex-1 xl:-mx-1 xl:overflow-y-auto xl:px-1 xl:pb-1">
                {rows.length > 0 && (
                <div key={history ? 'history' : 'active'} className="ui-content-swap grid gap-1 rounded-2xl border border-hairline bg-surface p-1.5 shadow-xs xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0 xl:shadow-none">
                    {rows.map((d) => {
                        const isDisputed = ['review', 'disputed'].includes(d.difference_status)
                        const isSelected = shown?.id === d.id && (split || detailOpen)
                        const balanceLabel = Number(d.balance) < 0 ? tx('credit') : tx('balance')
                        const due = challanDueStatus(d, today)
                        const settled = Number(d.balance) <= 0
                        const payment = paymentStatus(d)
                        return (
                            <button
                                key={d.id}
                                type="button"
                                aria-pressed={isSelected}
                                className={cn(
                                    'w-full rounded-xl px-3.5 py-3 text-left transition-colors duration-150 disabled:opacity-60',
                                    isSelected ? 'bg-[var(--wv-bg-selected)] ring-1 ring-inset ring-[var(--wv-neel-200)]' : 'hover:bg-surface-soft/80',
                                )}
                                onClick={() => openDetail(d)}
                                disabled={!!pending || (busy && !eventsLoading)}
                            >
                                <span className="flex items-baseline justify-between gap-3">
                                    <span className="min-w-0 truncate text-[15px] font-semibold leading-tight text-ink">{d.document.customer_name}</span>
                                    <span className="shrink-0 text-[15px] font-semibold leading-tight tabular-nums text-ink">
                                        <span className="sr-only">{balanceLabel}: </span>
                                        ₹{money(Math.abs(d.balance))}
                                    </span>
                                </span>
                                <span className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px]">
                                    <span className="min-w-0 text-subtle">
                                        <ChallanNumber value={d.number} className="text-xs" />
                                        <span aria-hidden="true"> · </span>
                                        <time dateTime={d.document.date}>{formatDocumentDate(d.document.date)}</time>
                                    </span>
                                    <span className={cn(
                                        'shrink-0',
                                        settled ? 'text-success' : due?.kind === 'overdueDays' ? 'font-semibold text-risk' : due?.kind === 'dueToday' ? 'font-semibold text-[var(--wv-ochre-800)]' : 'text-subtle',
                                    )}>
                                        {settled ? (Number(d.balance) < 0 ? tx('credit') : tx('paidInFull')) : dueLabel(d)}
                                    </span>
                                </span>
                                <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-body">
                                    <span className="min-w-0 truncate">{d.quality_label} · <span className="tabular-nums">{formatMeters(d.sent_meters)} m</span></span>
                                    <StatusDot variant={deliveryBadgeVariant(d.delivery_status)} label={tx(d.delivery_status)} />
                                    {payment !== 'draft' && d.delivery_status !== 'reversed' && <StatusDot variant={paymentBadgeVariant(payment)} label={tx(payment)} />}
                                </span>
                                {isDisputed && (
                                    <span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-[var(--wv-ochre-800)]">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                        {tx(d.difference_status)}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
                )}
                {!rows.length && (
                    <EmptyState
                        icon={history ? History : Truck}
                        title={tx('empty')}
                        className="xl:min-h-64 xl:border-0 xl:bg-transparent"
                        action={!history && !search.trim() && (
                            <NewDispatchButton onClick={beginDraft} disabled={busy || !!pending || closedUntilGoLive} label={tx('new')} />
                        )}
                    />
                )}
                {rows.length > 0 && rows.length % 50 === 0 && (
                    <Button variant="outline" onClick={() => load(history, true)} disabled={busy} className="mt-2 h-10 w-full rounded-lg text-sm">
                        {tx('more')}
                    </Button>
                )}
                </div>
            </section>
            </div>
            <div className="hidden min-h-0 xl:block xl:overflow-y-auto">
                <DispatchDetailPanel
                    emptyLabel={tx('detailEmpty')}
                    challan={shown}
                    events={selected ? events : []}
                    eventsLoading={eventsLoading || (!selected && !tourSample && !!shown)}
                    busy={busy}
                    locked={busy || !!pending || eventsLoading || !selected}
                    error={error}
                    onRetry={pending && !busy ? () => save(pending.action, pending.payload) : undefined}
                    today={today}
                    onRefresh={() => selected && view(selected.id, false)}
                    onStart={start}
                    onReceivedAsSent={() => selected && save('receipt', { meters: selected.sent_meters })}
                    onEditDraft={editDraft}
                    onReverseEntry={reverseEntry}
                />
            </div>
            </div>
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
                            legacy={legacy}
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
                open={!split && !!selected && (detailOpen || !!tourSelectedId) && !draft && !(tourSample && operation)}
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
                    setDetailOpen(false)
                    setSelected(null)
                    setEvents([])
                    setEventsLoading(false)
                    setError('')
                }}
                onRefresh={() => selected && view(selected.id)}
                onStart={start}
                onReceivedAsSent={() => selected && save('receipt', { meters: selected.sent_meters })}
                onEditDraft={editDraft}
                onReverseEntry={reverseEntry}
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
