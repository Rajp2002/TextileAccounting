'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
    Plus,
    Search,
    Truck,
    Printer,
    RefreshCw,
    AlertTriangle,
    CheckCircle2,
    Clock,
    ArrowUpRight,
    FileText,
    History,
    RotateCcw,
    Edit3,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/page-header'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useTranslation } from '@/lib/i18n/context'
import {
    paymentStatus,
    safeEvidenceUrl,
    type Challan,
    type ChallanDraft,
    type ChallanEvent,
    type ChallanMutation,
} from '@/lib/delivery-challans'
import type { StockQuality } from '@/lib/quality-stock'
import { getChallan, listChallans, mutateChallan } from './challan-actions'
import { businessDate, challanDueStatus } from '@/lib/challan-payment-terms'
import ChallanDraftEditor from './ChallanDraftEditor'

function NewDispatchButton({ onClick, disabled, label }: { onClick: () => void; disabled: boolean; label: string }) {
    return (
        <Button variant="saffron" disabled={disabled} onClick={onClick} className="min-h-11 rounded-xl px-4">
            <Plus className="h-4 w-4" aria-hidden="true" />
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
function formatDocumentDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
    const date = new Date(value + 'T00:00:00Z')
    if (Number.isNaN(date.getTime())) return value
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date)
}
function formatMeters(value: number) {
    return Number(value).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })
}
function deliveryBadgeVariant(status: Challan['delivery_status']) {
    switch (status) {
        case 'received':
            return 'success'
        case 'sent':
            return 'info'
        case 'reversed':
            return 'risk'
        default:
            return 'secondary'
    }
}
function paymentBadgeVariant(status: string) {
    switch (status) {
        case 'settled':
            return 'success'
        case 'partial':
        case 'unpaid':
            return 'warning'
        case 'credit':
            return 'info'
        default:
            return 'secondary'
    }
}
export default function ChallansClient({
    initialData,
    qualities,
}: {
    initialData: Challan[]
    qualities: StockQuality[]
}) {
    const { t } = useTranslation()
    const tx = (s: string) => t(`challan.${s}`)
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
    const [selected, setSelected] = useState<Challan | null>(null),
        [events, setEvents] = useState<ChallanEvent[]>([]),
        [draft, setDraft] = useState<ChallanDraft | null>(null)
    const [operation, setOperation] = useState<
            ChallanMutation['action'] | null
        >(null),
        [fields, setFields] = useState<Record<string, string>>({}),
        [pending, setPending] = useState<ChallanMutation | null>(null)
    const lock = useRef(false),
        draftId = useRef('')
    useEffect(() => {
        try {
            const stored = sessionStorage.getItem('weavly-challan-pending')
            if (stored) setPending(JSON.parse(stored))
        } catch {
            /* Storage may be unavailable. */
        }
    }, [])
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
        setBusy(true)
        try {
            const r = await getChallan(id)
            if (r.error) setError(r.error)
            else {
                setSelected(r.data!)
                setEvents(r.events!)
                setDraft(null)
            }
        } catch {
            setError(tx('loadError'))
        } finally {
            setBusy(false)
        }
    }
    async function save(
        action: ChallanMutation['action'],
        payload: Record<string, unknown>,
    ) {
        if (lock.current) return
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
                return
            }
            remember(null)
            setDraft(null)
            setOperation(null)
            await view(result.id)
            await load()
        } catch {
            setError(tx('retry'))
        } finally {
            lock.current = false
            setBusy(false)
        }
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
            className="dispatch-workspace-shell mx-auto w-full space-y-5 pb-10 sm:space-y-6"
        >
            <header className="relative border-b border-hairline/70 pb-5 text-center sm:pb-6">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:text-[2rem]">
                    {tx('title')}
                </h1>
                <p className="sr-only">{tx('intro')}</p>
                <div className="dispatch-inline-action mt-3 flex justify-end sm:absolute sm:right-0 sm:top-0 sm:mt-0">
                    <NewDispatchButton onClick={beginDraft} disabled={busy || !!pending} label={tx('new')} />
                </div>
            </header>
            <aside className="dispatch-action-rail" aria-label={tx('new')}>
                <NewDispatchButton onClick={beginDraft} disabled={busy || !!pending} label={tx('new')} />
            </aside>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Tabs
                    value={history ? 'history' : 'active'}
                    onValueChange={(value) => {
                        void load(value === 'history')
                    }}
                    className="w-full sm:w-auto"
                >
                    <TabsList aria-label={tx('dispatchViews')} className="h-11 w-full rounded-xl border-hairline/80 bg-surface/85 p-1 sm:w-fit">
                        <TabsTrigger value="active" disabled={busy} className="min-w-[5.5rem] rounded-lg px-4 text-xs data-[state=active]:border-loom data-[state=active]:bg-loom data-[state=active]:text-white sm:text-sm">
                            {tx('active')}
                        </TabsTrigger>
                        <TabsTrigger value="history" disabled={busy} className="min-w-[5.5rem] rounded-lg px-4 text-xs data-[state=active]:border-loom data-[state=active]:bg-loom data-[state=active]:text-white sm:text-sm">
                            {tx('history')}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
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
            <section aria-labelledby="challan-list-heading" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="challan-list-heading" className="text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
                        {tx(history ? 'historyHeading' : 'activeHeading')}
                    </h2>
                    <span className="text-xs font-medium tabular-nums text-subtle">
                        {t('challan.recordCount', { count: rows.length })}
                    </span>
                </div>
                <div className="grid gap-2.5">
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
                                onClick={() => view(d.id)}
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
            >
                <DialogContent
                    data-i18n-skip="true"
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
                            qualities={qualities}
                            number={selected?.number}
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
            {selected && !draft && (
                <section className="space-y-6 rounded-2xl border border-hairline bg-surface p-5 sm:p-7 shadow-xs">
                    {/* Header bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-hairline">
                        <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-mono text-xs font-black uppercase tracking-wider px-2.5 py-1 rounded-md bg-surface-soft border border-hairline text-ink">
                                    {selected.number}
                                </span>
                                <Badge
                                    variant={
                                        selected.delivery_status === 'received'
                                            ? 'success'
                                            : selected.delivery_status === 'sent'
                                              ? 'brand'
                                              : 'outline'
                                    }
                                    className="font-bold text-xs capitalize"
                                >
                                    {tx(selected.delivery_status)}
                                </Badge>
                                <Badge
                                    variant={
                                        selected.difference_status === 'accepted'
                                            ? 'success'
                                            : selected.difference_status === 'none'
                                              ? 'outline'
                                              : 'warning'
                                    }
                                    className="font-bold text-xs capitalize"
                                >
                                    {tx(selected.difference_status)}
                                </Badge>
                                <Badge
                                    variant={
                                        paymentStatus(selected) === 'settled'
                                            ? 'success'
                                            : paymentStatus(selected) === 'unpaid'
                                              ? 'warning'
                                              : 'brand'
                                    }
                                    className="font-bold text-xs capitalize"
                                >
                                    {tx(paymentStatus(selected))}
                                </Badge>
                                {selected.archived_at && (
                                    <Badge variant="outline" className="text-muted-foreground text-xs font-semibold">
                                        {tx('archived')}
                                    </Badge>
                                )}
                            </div>
                            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-ink">
                                {selected.document.customer_name}
                            </h2>
                            <p className="text-xs sm:text-sm font-medium text-body flex flex-wrap items-center gap-2">
                                <span className="font-bold text-ink">{selected.quality_label}</span>
                                {selected.document.date && (
                                    <>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span>{selected.document.date}</span>
                                    </>
                                )}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 px-3.5 rounded-xl border-hairline bg-surface hover:bg-surface-soft text-ink font-semibold gap-1.5 shadow-xs"
                                disabled={busy || !!pending}
                                onClick={() => view(selected.id)}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                                {tx('refresh')}
                            </Button>
                            <Link
                                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl border border-hairline bg-surface hover:bg-surface-soft text-ink font-semibold shadow-xs transition-colors hover:text-loom"
                                target="_blank"
                                href={`/owner/dispatches/${selected.id}/print`}
                            >
                                <Printer className="h-3.5 w-3.5 text-muted-foreground" />
                                {tx('print')}
                            </Link>
                        </div>
                    </div>

                    {/* Metrics Overview Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Metres Card */}
                        <div className="p-4 rounded-xl border border-hairline bg-surface-soft/30 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Metres Breakdown
                                </span>
                                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('sentMeters')}</span>
                                    <span className="font-bold text-ink tabular-nums">{selected.sent_meters} m</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('acknowledged')}</span>
                                    <span className="font-bold text-ink tabular-nums">{selected.acknowledged_meters ?? '—'} m</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('chargeable')}</span>
                                    <span className="font-bold text-ink tabular-nums">{selected.chargeable_meters} m</span>
                                </div>
                                {selected.acknowledged_meters !== null && (
                                    <div>
                                        <span className="text-xs text-muted-foreground block">{tx('differenceMeters')}</span>
                                        <span className="font-bold text-amber-600 dark:text-amber-400 tabular-nums">
                                            {(
                                                Number(selected.sent_meters) -
                                                Number(selected.acknowledged_meters)
                                            ).toFixed(2)}{' '}
                                            m
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Financial Card */}
                        <div className="p-4 rounded-xl border border-hairline bg-surface-soft/30 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Financial Summary
                                </span>
                                <span className="text-xs font-bold text-muted-foreground">₹</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('sellingRate')}</span>
                                    <span className="font-bold text-ink tabular-nums">Rs {money(selected.selling_rate)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('paid')}</span>
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">Rs {money(selected.paid_amount)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('adjustments')}</span>
                                    <span className="font-bold text-ink tabular-nums">Rs {money(selected.adjustment_amount)}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-muted-foreground block">
                                        {Number(selected.balance) < 0
                                            ? tx('credit')
                                            : tx('balance')}
                                    </span>
                                    <span
                                        className={`font-black tabular-nums ${
                                            Number(selected.balance) > 0
                                                ? 'text-rose-600 dark:text-rose-400'
                                                : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                    >
                                        Rs {money(Math.abs(selected.balance))}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Terms & Due Card */}
                        <div className="p-4 rounded-xl border border-hairline bg-surface-soft/30 space-y-3 sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                    Payment Terms
                                </span>
                                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            </div>
                            <div className="space-y-2 text-sm">
                                <div>
                                    <span className="text-xs text-muted-foreground block">{tx('payment_due_date')}</span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="font-bold text-ink">
                                            {selected.payment_due_date || tx('dueDateNotSet')}
                                        </span>
                                        {dueLabel(selected) && selected.payment_due_date && (
                                            <Badge variant="warning" className="text-2xs font-bold px-1.5 py-0">
                                                {dueLabel(selected)}
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                {selected.payment_terms && (
                                    <div>
                                        <span className="text-xs text-muted-foreground block">{tx('payment_terms')}</span>
                                        <p className="font-medium text-ink text-xs break-words line-clamp-2 mt-0.5">
                                            {selected.payment_terms}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Action Toolbar */}
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-hairline">
                        {selected.delivery_status === 'draft' ? (
                            <>
                                <Button
                                    variant="outline"
                                    className="h-10 px-4 rounded-xl border-hairline font-bold text-ink shadow-xs hover:bg-surface-soft gap-1.5"
                                    disabled={busy || !!pending}
                                    onClick={() =>
                                        setDraft({
                                            quality_id: selected.quality_id,
                                            selling_rate: selected.selling_rate,
                                            document: selected.document,
                                            lines: selected.lines,
                                        })
                                    }
                                >
                                    <Edit3 className="h-4 w-4" />
                                    {tx('edit')}
                                </Button>
                                <Button
                                    className="h-10 px-5 rounded-xl bg-loom text-white font-bold hover:bg-loom-elevated shadow-xs gap-1.5"
                                    disabled={busy || !!pending}
                                    onClick={() => start('confirm')}
                                >
                                    <CheckCircle2 className="h-4 w-4" />
                                    {tx('confirm')}
                                </Button>
                            </>
                        ) : (
                            selected.delivery_status !== 'reversed' && (
                                <>
                                    {selected.delivery_status === 'sent' && (
                                        <Button
                                            className="h-10 px-5 rounded-xl bg-loom text-white font-bold hover:bg-loom-elevated shadow-xs gap-1.5"
                                            disabled={busy || !!pending}
                                            onClick={() =>
                                                save('receipt', {
                                                    meters: selected.sent_meters,
                                                })
                                            }
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            {tx('receivedAsSent')}
                                        </Button>
                                    )}
                                    <Button
                                        variant="outline"
                                        className="h-10 px-4 rounded-xl border-hairline font-bold text-ink shadow-xs hover:bg-surface-soft gap-1.5"
                                        disabled={busy || !!pending}
                                        onClick={() => start('receipt')}
                                    >
                                        <Truck className="h-4 w-4" />
                                        {tx('receipt')}
                                    </Button>
                                    {selected.acknowledged_meters !== null &&
                                        Number(selected.acknowledged_meters) !==
                                            Number(selected.sent_meters) && (
                                            <Button
                                                variant="outline"
                                                className="h-10 px-4 rounded-xl border-hairline font-bold text-ink shadow-xs hover:bg-surface-soft gap-1.5"
                                                disabled={busy || !!pending}
                                                onClick={() => start('resolve')}
                                            >
                                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                                {tx('resolve')}
                                            </Button>
                                        )}
                                    {(
                                        [
                                            'payment',
                                            'adjustment',
                                            'payment_terms',
                                            ...(Number(selected.balance) < 0
                                                ? ['refund']
                                                : []),
                                        ] as ChallanMutation['action'][]
                                    ).map((a) => (
                                        <Button
                                            key={a}
                                            variant="outline"
                                            className="h-10 px-4 rounded-xl border-hairline font-bold text-ink shadow-xs hover:bg-surface-soft"
                                            disabled={busy || !!pending}
                                            onClick={() => start(a)}
                                        >
                                            {tx(
                                                a === 'payment_terms'
                                                    ? 'changePaymentTerms'
                                                    : a,
                                            )}
                                        </Button>
                                    ))}
                                    {selected.delivery_status === 'sent' &&
                                        !events.some((e) =>
                                            [
                                                'payment',
                                                'refund',
                                                'adjustment',
                                            ].includes(e.action),
                                        ) && (
                                            <Button
                                                variant="outline"
                                                className="h-10 px-4 rounded-xl border-hairline font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 shadow-xs gap-1.5"
                                                disabled={busy || !!pending}
                                                onClick={() =>
                                                    start('reverse_dispatch')
                                                }
                                            >
                                                <RotateCcw className="h-4 w-4" />
                                                {tx('reverse_dispatch')}
                                            </Button>
                                        )}
                                </>
                            )
                        )}
                    </div>

                    {/* Document Details Disclosure */}
                    <details className="group rounded-2xl border border-hairline bg-surface-soft/40 p-4 sm:p-5 transition-all">
                        <summary className="cursor-pointer font-bold text-ink flex items-center justify-between select-none">
                            <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-ink">
                                <FileText className="h-4 w-4 text-loom" />
                                {tx('details')}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground group-open:rotate-180 transition-transform">
                                ▼
                            </span>
                        </summary>
                        <dl className="grid gap-3 pt-4 sm:grid-cols-2 lg:grid-cols-3 border-t border-hairline mt-3">
                            {Object.entries(selected.document)
                                .filter(([, v]) => v)
                                .map(([k, v]) => (
                                    <div key={k} className="p-3 rounded-xl bg-surface border border-hairline/60">
                                        <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            {tx(k)}
                                        </dt>
                                        <dd className="mt-1 font-semibold text-ink break-words text-sm">
                                            {k === 'external_attachment' &&
                                            safeEvidenceUrl(v) ? (
                                                <a
                                                    className="text-loom font-bold underline inline-flex items-center gap-1"
                                                    href={safeEvidenceUrl(v)!}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    {tx('evidence')}
                                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                                </a>
                                            ) : (
                                                v
                                            )}
                                        </dd>
                                    </div>
                                ))}
                        </dl>
                        <div className="mt-4 pt-3 border-t border-hairline">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                                Lot Breakdown ({selected.lines.length} lots)
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {selected.lines.map((l, i) => (
                                    <span
                                        key={i}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-surface border border-hairline text-xs font-semibold text-ink"
                                    >
                                        <span className="font-mono font-bold text-muted-foreground">{l.lot || `Lot ${i + 1}`}</span>
                                        <span className="font-bold text-ink tabular-nums">{l.meters} m</span>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </details>

                    {/* Audit Trail Disclosure */}
                    <details open className="group rounded-2xl border border-hairline bg-surface-soft/40 p-4 sm:p-5 transition-all">
                        <summary className="cursor-pointer font-bold text-ink flex items-center justify-between select-none">
                            <span className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-ink">
                                <History className="h-4 w-4 text-loom" />
                                {tx('audit')}
                            </span>
                            <span className="text-xs font-semibold text-muted-foreground group-open:rotate-180 transition-transform">
                                ▼
                            </span>
                        </summary>
                        <ol className="mt-4 space-y-3 border-t border-hairline pt-3">
                            {events.map((e) => (
                                <li
                                    key={e.id}
                                    className="p-3.5 rounded-xl bg-surface border border-hairline text-sm space-y-2"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="font-bold text-xs uppercase tracking-wider">
                                                {tx(e.action)}
                                            </Badge>
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {new Date(e.created_at).toLocaleString()}
                                            </span>
                                            {e.amount !== null && (
                                                <span className="font-extrabold text-ink tabular-nums text-sm">
                                                    Rs {money(e.amount)}
                                                </span>
                                            )}
                                        </div>
                                        {[
                                            'payment',
                                            'refund',
                                            'adjustment',
                                        ].includes(e.action) &&
                                            !events.some(
                                                (r) => r.reverses_id === e.id,
                                            ) && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 px-2.5 rounded-lg border-hairline text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                                    disabled={busy || !!pending}
                                                    onClick={() => {
                                                        start('reverse_entry')
                                                        setFields({
                                                            event_id: e.id,
                                                        })
                                                    }}
                                                >
                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                    {tx('reverse_entry')}
                                                </Button>
                                            )}
                                    </div>
                                    {e.action === 'payment_terms' && (
                                        <div className="text-xs text-body bg-surface-soft p-2.5 rounded-lg space-y-1">
                                            <p>
                                                <span className="font-bold">{tx('previousTerms')}:</span>{' '}
                                                {e.previous_terms?.payment_due_date || tx('dueDateNotSet')}{' '}
                                                · {e.previous_terms?.payment_terms || '—'}
                                            </p>
                                            <p>
                                                <span className="font-bold">{tx('updatedTerms')}:</span>{' '}
                                                {String(e.payload.data.payment_due_date || tx('dueDateNotSet'))}{' '}
                                                · {String(e.payload.data.payment_terms || '—')}
                                            </p>
                                        </div>
                                    )}
                                    {e.action === 'receipt' && (
                                        <p className="text-xs font-semibold text-body">
                                            {tx('acknowledged')}: <span className="text-ink font-bold tabular-nums">{String(e.payload.data.meters)} m</span>
                                        </p>
                                    )}
                                    {e.action === 'resolve' && (
                                        <p className="text-xs font-semibold text-body">
                                            {tx(String(e.payload.data.decision))}
                                        </p>
                                    )}
                                    {Boolean(e.payload.data.reason || e.payload.data.date || e.payload.data.method) && (
                                        <p className="text-xs text-muted-foreground">
                                            {[e.payload.data.reason, e.payload.data.date, e.payload.data.method].filter(Boolean).map(String).join(' · ')}
                                        </p>
                                    )}
                                    {typeof e.payload.data.evidence === 'string' &&
                                        safeEvidenceUrl(e.payload.data.evidence) && (
                                            <a
                                                className="text-xs text-loom font-bold underline inline-flex items-center gap-1"
                                                href={safeEvidenceUrl(e.payload.data.evidence)!}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                            >
                                                {tx('evidence')}
                                                <ArrowUpRight className="h-3 w-3" />
                                            </a>
                                        )}
                                    {e.reverses_id && (
                                        <p className="text-xs text-muted-foreground font-mono">
                                            {tx('reverses')}: {e.reverses_id}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    </details>
                </section>
            )}
            <Dialog
                open={!!operation}
                onOpenChange={(open) => {
                    if (!open && !busy && !pending) setOperation(null)
                }}
            >
                <DialogContent data-i18n-skip="true" className="max-w-md rounded-2xl border border-hairline bg-surface p-6 shadow-2xl">
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
                            <p role="alert" className="text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-3 rounded-xl border border-rose-200 dark:border-rose-900/60">
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
