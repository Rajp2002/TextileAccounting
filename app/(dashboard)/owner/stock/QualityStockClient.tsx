'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    RefreshCw,
    Warehouse,
    History,
    ArrowUpRight,
    Search,
    Factory,
    Truck,
    SlidersHorizontal,
    Filter,
    AlertCircle,
    Plus,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useTranslation } from '@/lib/i18n/context'
import { StockAdjustmentSchema, type QualityStockBoard, type StockAdjustmentInput, type StockQuality } from '@/lib/quality-stock'
import { getQualityStockBoard, recordQualityStockAdjustment } from './actions'

export default function QualityStockClient({ initialData }: { initialData: QualityStockBoard }) {
    const { t, language } = useTranslation()
    const router = useRouter()
    const [data, setData] = useState(initialData)
    const [search, setSearch] = useState('')
    const [qualityId, setQualityId] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [form, setForm] = useState<{ kind: 'opening' | 'correction'; quality?: StockQuality } | null>(null)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [label, setLabel] = useState('')
    const [meters, setMeters] = useState('')
    const [reason, setReason] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [request, setRequest] = useState<StockAdjustmentInput | null>(null)
    const loading = useRef(false)
    const writing = useRef(false)
    const tx = (key: string) => t(`qualityStock.${key}`)
    const metres = (value: number) => Number(value).toLocaleString(language === 'en' ? 'en-IN' : `${language}-IN`, { maximumFractionDigits: 2 })

    useEffect(() => { setData(initialData); setQualityId('') }, [initialData])
    // A tab returning from Production should show current stock. Explicit refresh
    // also works when the browser cannot deliver a focus event.
    useEffect(() => {
        const refresh = () => { if (!document.hidden) router.refresh() }
        document.addEventListener('visibilitychange', refresh)
        window.addEventListener('focus', refresh)
        return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
    }, [router])

    async function load(filter = qualityId, more = false) {
        if (loading.current) return
        loading.current = true; setBusy(true); setError('')
        try {
            const result = await getQualityStockBoard({ qualityId: filter || undefined, cursor: more ? data.nextCursor ?? undefined : undefined })
            if ('error' in result) { setError(tx('loadError')); return }
            setQualityId(filter)
            setData(previous => ({ ...result.data, movements: more ? [...previous.movements, ...result.data.movements.filter(row => !previous.movements.some(old => old.id === row.id))] : result.data.movements }))
        } catch { setError(tx('loadError')) }
        finally { loading.current = false; setBusy(false) }
    }

    function open(kind: 'opening' | 'correction', quality?: StockQuality) {
        setForm({ kind, quality }); setLabel(quality?.quality_label ?? ''); setMeters(kind === 'correction' ? String(quality?.meters ?? '') : '')
        setReason(''); setSaveError(''); setRequest(null)
    }

    async function save() {
        if (!form || writing.current) return
        const input = request ?? { qualityLabel: label, meters: meters.trim() ? Number(meters) : NaN, kind: form.kind, reason, clientRequestId: crypto.randomUUID(), expectedMeters: form.kind === 'correction' ? Number(form.quality?.meters) : undefined }
        if (!StockAdjustmentSchema.safeParse(input).success) { setSaveError(tx('validation')); return }
        // Keep the exact reviewed request after a network failure, including its UUID.
        // The user can safely retry; editing uncertain requests is deliberately disabled.
        setRequest(input); writing.current = true; setSaving(true); setSaveError('')
        try {
            const result = await recordQualityStockAdjustment(input)
            if ('error' in result) { setSaveError(tx(result.errorKey)); return }
            setForm(null); setRequest(null); setNotice(tx('saved')); await load()
        } catch { setSaveError(tx('retrySame')) }
        finally { writing.current = false; setSaving(false) }
    }

    const qualities = data.qualities.filter(row => row.quality_label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

    const historyPill = (
        <button
            type="button"
            aria-expanded={isHistoryOpen}
            aria-controls="stock-history"
            onClick={() => setIsHistoryOpen(true)}
            className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-hairline/80 bg-surface/95 p-3.5 sm:p-4 text-left shadow-[var(--shadow-card)] backdrop-blur-sm transition-all hover:border-loom/40 hover:bg-surface-soft/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom"
        >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loom/10 text-loom group-hover:bg-loom group-hover:text-white transition-colors">
                <History className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-ink flex items-center gap-1.5">
                    {tx('history')}
                    {data.movements.length > 0 && (
                        <span className="inline-flex items-center rounded-full bg-saffron-soft px-1.5 py-0.5 text-[10px] font-bold text-saffron-deep">
                            {data.movements.length}
                        </span>
                    )}
                </span>
                <span className="block text-xs text-body truncate">
                    {data.movements.length === 0 ? tx('noHistory') : `${data.movements.length} logged ${data.movements.length === 1 ? 'entry' : 'entries'} · View ledger`}
                </span>
            </span>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </button>
    )

    return (
        <div className="stock-workspace-shell space-y-6" data-i18n-skip="true">
            {/* Header */}
            <header className="grid gap-4 border-b border-hairline/80 pb-5 text-center sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center sm:pb-6">
                <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-ink sm:col-start-2 sm:row-start-1 sm:text-[2rem]">{tx('title')}</h1>
                <div className="flex flex-wrap justify-center gap-2 sm:col-start-3 sm:row-start-1 sm:justify-self-end">
                    <Button asChild variant="outline" className="h-10 rounded-xl border-loom/30 text-loom hover:bg-loom/5 gap-1.5 font-semibold shadow-xs">
                        <Link href="/owner/stock/audit">
                            <Warehouse className="h-4 w-4" />
                            {tx('audit')}
                        </Link>
                    </Button>
                    <Button variant="outline" disabled={busy} onClick={() => void load()} className="h-10 rounded-xl border-hairline font-semibold shadow-xs hover:bg-surface-soft">
                        <RefreshCw className={`mr-2 h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                        {tx('refresh')}
                    </Button>
                    <Button data-tour-anchor="fabric.opening" onClick={() => open('opening')} className="h-10 rounded-xl bg-loom text-white font-semibold shadow-xs hover:bg-loom-hover">
                        <Plus className="mr-1.5 h-4 w-4" />
                        {tx('opening')}
                    </Button>
                </div>
            </header>

            {notice && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3.5 text-xs sm:text-sm font-medium text-emerald-800 shadow-xs">{notice}</p>}
            {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs sm:text-sm font-medium text-rose-800 shadow-xs">{error} <button className="underline font-bold ml-1 hover:text-rose-950" onClick={() => void load()}>{tx('retry')}</button></p>}

            {/* Available stock card */}
            <div className="rounded-2xl border border-hairline/80 bg-surface/95 p-6 shadow-[var(--shadow-card)] backdrop-blur-sm">
                <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-loom/10 text-loom shadow-xs">
                        <Warehouse className="h-7 w-7" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{tx('available')}</p>
                        <p className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums text-ink">
                            {metres(data.total_meters)} <span className="text-base sm:text-lg font-bold text-muted-foreground">{tx('metres')}</span>
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-body">
                            {data.qualities.length} {data.qualities.length === 1 ? 'quality' : tx('qualities')} tracked in stock
                        </p>
                    </div>
                </div>
            </div>

            {/* Stock by quality section */}
            <section className="space-y-4" aria-labelledby="stock-qualities">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <h2 id="stock-qualities" className="text-xl font-bold tracking-tight text-ink">{tx('byQuality')}</h2>
                        <span className="inline-flex items-center rounded-full bg-surface-soft px-2.5 py-0.5 text-xs font-bold text-muted-foreground">
                            {qualities.length}
                        </span>
                    </div>
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Label htmlFor="stock-search" className="sr-only">{tx('search')}</Label>
                        <Input
                            id="stock-search"
                            placeholder={tx('search')}
                            value={search}
                            onChange={event => setSearch(event.target.value)}
                            className="h-10 pl-9 rounded-xl border-hairline/80 bg-surface/95 text-xs shadow-xs focus:border-loom focus:ring-1 focus:ring-loom"
                        />
                    </div>
                </div>

                {qualities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline py-12 px-4 text-center bg-surface/40">
                        <p className="text-sm font-semibold text-ink">
                            {search ? tx('noMatches') : tx('empty')}
                        </p>
                        <Button asChild variant="link" className="mt-2 text-loom font-semibold">
                            <Link href="/owner/production">{tx('production')}</Link>
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-4">
                        {qualities.map(quality => (
                            <div
                                key={quality.id}
                                className="group relative flex flex-col justify-between rounded-2xl border border-hairline/80 bg-surface/95 p-5 shadow-[var(--shadow-card)] backdrop-blur-sm transition-all hover:border-loom/40 hover:shadow-md"
                            >
                                <div className="space-y-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="break-words text-base font-bold text-ink leading-snug">
                                            {quality.quality_label}
                                        </h3>
                                        {!quality.opening_recorded && (
                                            <span className="shrink-0 inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-amber-50/90 px-2 py-0.5 text-[10px] font-bold text-amber-800" title={tx('openingPending')}>
                                                <AlertCircle className="h-3 w-3" />
                                                <span>{tx('pending')}</span>
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-2xl sm:text-3xl font-black tracking-tight tabular-nums text-ink">
                                            {metres(quality.meters)} <span className="text-xs font-semibold text-muted-foreground">{tx('metres')}</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 pt-3 border-t border-hairline/60 flex flex-wrap items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => open(quality.opening_recorded ? 'correction' : 'opening', quality)}
                                        className="h-8 rounded-lg border-hairline text-xs font-semibold shadow-xs hover:bg-surface-soft"
                                    >
                                        {quality.opening_recorded ? tx('correct') : tx('opening')}
                                    </Button>
                                    {!quality.opening_recorded && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => open('correction', quality)}
                                            className="h-8 rounded-lg border-hairline text-xs font-semibold shadow-xs hover:bg-surface-soft"
                                        >
                                            {tx('correct')}
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={busy}
                                        onClick={() => {
                                            setQualityId(quality.id)
                                            setIsHistoryOpen(true)
                                            void load(quality.id)
                                        }}
                                        className="h-8 rounded-lg text-xs font-semibold text-muted-foreground hover:text-loom hover:bg-loom/5 ml-auto gap-1"
                                    >
                                        <History className="h-3.5 w-3.5" />
                                        <span>{tx('history')}</span>
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Mobile / Tablet fallback movement history pill */}
            <div className="stock-movement-rail-mobile">
                {historyPill}
            </div>

            {/* Desktop right rail Movement History pill (pinned to bottom right rail) */}
            <aside aria-label={tx('history')} className="stock-movement-rail-desktop">
                {historyPill}
            </aside>

            {/* Movement History Modal */}
            <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-hairline shadow-2xl" data-i18n-skip="true" showCloseButton={false}>
                    {/* Header */}
                    <div className="border-b border-hairline/80 px-6 py-5 bg-surface/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loom/10 text-loom">
                                    <History className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle id="stock-history" className="text-lg font-bold text-ink">
                                        {tx('history')}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-body truncate">
                                        Audit log of fabric production, dispatches, opening stock, and corrections
                                    </DialogDescription>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void load(qualityId)}
                                    className="h-8 gap-1.5 rounded-xl border-hairline text-xs font-semibold hover:bg-surface-soft"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${busy ? 'animate-spin' : ''}`} />
                                    <span className="hidden sm:inline">{tx('refresh')}</span>
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsHistoryOpen(false)}
                                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-ink"
                                >
                                    <X className="h-4 w-4" />
                                    <span className="sr-only">{tx('close')}</span>
                                </Button>
                            </div>
                        </div>

                        {/* Filter toolbar */}
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-hairline/50">
                            <div className="flex items-center gap-2">
                                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                                <Label htmlFor="history-quality" className="text-xs font-semibold text-body">
                                    {tx('quality')}:
                                </Label>
                                <select
                                    id="history-quality"
                                    className="h-8 rounded-lg border border-hairline bg-surface px-2.5 py-1 text-xs font-medium text-ink shadow-xs focus:border-loom focus:outline-none focus:ring-1 focus:ring-loom"
                                    value={qualityId}
                                    disabled={busy}
                                    onChange={event => void load(event.target.value)}
                                >
                                    <option value="">{tx('allQualities')}</option>
                                    {data.qualities.map(row => (
                                        <option value={row.id} key={row.id}>
                                            {row.quality_label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="text-xs text-muted-foreground font-medium">
                                {data.movements.length} {data.movements.length === 1 ? 'movement' : 'movements'}
                            </div>
                        </div>
                    </div>

                    {/* Movements list */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-3" aria-busy={busy}>
                        {data.movements.length === 0 ? (
                            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline py-12 px-4 text-center">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-soft text-muted-foreground mb-3">
                                    <History className="h-6 w-6" />
                                </div>
                                <p className="font-semibold text-ink text-sm">{tx('noHistory')}</p>
                                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                                    Movements are automatically logged when production is saved, orders are dispatched, or balances are corrected.
                                </p>
                            </div>
                        ) : (
                            <ol className="space-y-2.5">
                                {data.movements.map(row => {
                                    const isPositive = Number(row.meters_delta) > 0
                                    const isNegative = Number(row.meters_delta) < 0
                                    return (
                                        <li
                                            key={row.id}
                                            className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-hairline/70 bg-surface/80 p-3.5 transition-colors hover:border-hairline hover:bg-surface-soft/40"
                                        >
                                            <div className="flex items-start gap-3 min-w-0">
                                                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                                    row.kind === 'production'
                                                        ? 'bg-amber-500/10 text-amber-700'
                                                        : row.kind === 'dispatch' || row.kind === 'dispatch_reversal'
                                                        ? 'bg-sky-500/10 text-sky-700'
                                                        : row.kind === 'opening'
                                                        ? 'bg-emerald-500/10 text-emerald-700'
                                                        : 'bg-purple-500/10 text-purple-700'
                                                }`}>
                                                    {row.kind === 'production' ? (
                                                        <Factory className="h-4 w-4" />
                                                    ) : row.kind === 'dispatch' || row.kind === 'dispatch_reversal' ? (
                                                        <Truck className="h-4 w-4" />
                                                    ) : row.kind === 'opening' ? (
                                                        <Warehouse className="h-4 w-4" />
                                                    ) : (
                                                        <SlidersHorizontal className="h-4 w-4" />
                                                    )}
                                                </div>
                                                <div className="min-w-0 space-y-0.5">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <span className="font-bold text-sm text-ink break-words">
                                                            {row.quality_label}
                                                        </span>
                                                        <span className="text-muted-foreground/60 text-xs">·</span>
                                                        <span className="inline-flex items-center rounded-md bg-surface-soft px-1.5 py-0.5 text-[11px] font-semibold text-body">
                                                            {tx(row.kind === 'production' ? 'productionEntry' : row.kind)}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-body break-words">
                                                        {row.reason === 'Production updated' ? tx('productionUpdated') : row.reason}
                                                    </p>
                                                    <div className="flex items-center gap-2 pt-0.5 text-[11px] text-muted-foreground">
                                                        <span>
                                                            {new Date(row.created_at).toLocaleString(`${language}-IN`, { timeZone: 'Asia/Kolkata' })}
                                                        </span>
                                                        {row.kind === 'production' && (
                                                            <>
                                                                <span>·</span>
                                                                <Link href="/owner/production" className="font-semibold text-loom hover:underline inline-flex items-center gap-0.5">
                                                                    {tx('production')}
                                                                </Link>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="sm:text-right shrink-0 pl-11 sm:pl-0 tabular-nums">
                                                <div className={`text-base font-bold tracking-tight ${
                                                    isNegative ? 'text-rose-600' : isPositive ? 'text-emerald-600' : 'text-body'
                                                }`}>
                                                    {isPositive ? '+' : ''}{metres(row.meters_delta)} {tx('metres')}
                                                </div>
                                                <div className="text-[11px] text-muted-foreground">
                                                    {tx('balanceAfter')}: <span className="font-semibold text-ink">{metres(row.balance_after)} {tx('metres')}</span>
                                                </div>
                                            </div>
                                        </li>
                                    )
                                })}
                            </ol>
                        )}

                        {data.nextCursor && (
                            <div className="pt-2 text-center">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() => void load(qualityId, true)}
                                    className="rounded-xl border-hairline font-semibold text-xs"
                                >
                                    {busy ? tx('loading') : tx('more')}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Modal footer */}
                    <div className="border-t border-hairline/80 px-6 py-3.5 bg-surface/50 backdrop-blur-sm flex justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setIsHistoryOpen(false)}
                            className="rounded-xl border-hairline font-semibold text-xs h-9"
                        >
                            {tx('close')}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Opening / Correction Modal */}
            <Dialog open={Boolean(form)} onOpenChange={value => { if (!value && !saving) setForm(null) }}>
                <DialogContent className="max-w-md rounded-2xl border-hairline shadow-2xl" data-i18n-skip="true" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-ink">
                            {form?.kind === 'opening' ? tx('opening') : tx('correct')}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-body">
                            {form?.kind === 'opening' ? tx('openingHelp') : tx('correctHelp')}
                        </DialogDescription>
                    </DialogHeader>
                    <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save() }}>
                        <div className="space-y-1.5">
                            <Label htmlFor="stock-quality" className="text-xs font-semibold text-body">{tx('quality')}</Label>
                            <Input
                                id="stock-quality"
                                list="stock-known-qualities"
                                value={label}
                                disabled={Boolean(form?.quality) || Boolean(request)}
                                onChange={event => setLabel(event.target.value)}
                                maxLength={160}
                                required
                                className="rounded-xl border-hairline"
                            />
                            <datalist id="stock-known-qualities">
                                {data.qualities.map(row => <option key={row.id} value={row.quality_label} />)}
                            </datalist>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="stock-metres" className="text-xs font-semibold text-body">
                                {form?.kind === 'opening' ? tx('openingMetres') : tx('countedMetres')}
                            </Label>
                            <Input
                                id="stock-metres"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                max="100000000"
                                step="0.01"
                                value={meters}
                                disabled={Boolean(request)}
                                onChange={event => setMeters(event.target.value)}
                                required
                                className="rounded-xl border-hairline"
                            />
                            {form?.quality && (
                                <p className="text-xs text-muted-foreground">
                                    {tx('current')}: <span className="font-semibold text-ink">{metres(form.quality.meters)} {tx('metres')}</span>
                                </p>
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="stock-reason" className="text-xs font-semibold text-body">{tx('reason')}</Label>
                            <textarea
                                id="stock-reason"
                                className="min-h-20 w-full rounded-xl border border-hairline bg-surface p-3 text-xs shadow-xs focus:border-loom focus:outline-none focus:ring-1 focus:ring-loom"
                                value={reason}
                                disabled={Boolean(request)}
                                onChange={event => setReason(event.target.value)}
                                minLength={3}
                                maxLength={500}
                                required
                            />
                        </div>
                        {saveError && <p role="alert" className="text-xs text-rose-700 font-medium">{saveError}</p>}
                        {request && !saving && <p className="text-xs text-muted-foreground">{tx('retrySame')}</p>}
                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="outline" disabled={saving} onClick={() => { setForm(null); void load() }} className="rounded-xl border-hairline h-9 text-xs font-semibold">
                                {tx('close')}
                            </Button>
                            <Button type="submit" disabled={saving} className="rounded-xl bg-loom text-white h-9 text-xs font-semibold hover:bg-loom-hover">
                                {saving ? tx('saving') : request ? tx('retry') : tx('save')}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    )
}

