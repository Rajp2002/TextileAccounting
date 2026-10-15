'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { reportPwaWorkflowSuccess } from '@/lib/pwa-workflow-success'
import { RouteMilestones } from '@/components/performance/route-milestones'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    RefreshCw,
    Warehouse,
    History,
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
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { railPrimaryAction } from '@/components/ui/rail'
import { PageGuide } from '@/components/tours/TourInvitation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { COMPOSITION_SLOTS, CompositionBar, DayGroupList, OTHER_SWATCH, RecentMovementsSection, SignedQuantity, StockTrend, Swatch, formatIndiaDay, swatchFor } from '@/components/stock/stock-presentation'
import { useTranslation } from '@/lib/i18n/context'
import { GoLiveNotice } from '@/components/production/GoLiveNotice'
import { useTourSample } from '@/lib/tours/sample-context'
import { tourSurfaceProps } from '@/lib/tours/sample-surface'
import { fabricStockSampleForm } from '@/lib/tours/sample-data/stock'
import type { FabricStockTourStep } from '@/lib/stock-tour'
import { businessDate } from '@/lib/challan-payment-terms'
import { activitySince, balanceTrail, groupByIndiaDay, totalsSince, weekSince, type ActivityRow } from '@/lib/stock-activity'
import { StockAdjustmentSchema, fabricActivityBucket, type QualityStockBoard, type StockAdjustmentInput, type StockQuality } from '@/lib/quality-stock'
import { stockTotals } from '@/lib/legacy-stock'
import { getQualityStockBoard, recordQualityStockAdjustment } from './actions'
import LegacyStockDialog from './LegacyStockDialog'
import { LegacyStatusLine } from './LegacyStatusLine'

// Phones render rem at 14px, so the 44px touch target needs a pixel minimum.
const secondaryAction = 'h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs hover:bg-surface-soft max-md:min-h-[44px]'

/** inSetup: before go-live, old fabric is legacy stock, so the orange opening-stock tool stays closed. */
export default function QualityStockClient({ initialData, inSetup = false }: { initialData: QualityStockBoard; inSetup?: boolean }) {
    const { t, language } = useTranslation()
    const router = useRouter()
    const tourSample = useTourSample('fabric-stock')
    const tourStep = tourSample?.step as FabricStockTourStep | undefined
    const surface = tourSurfaceProps(Boolean(tourSample))
    const openingClosed = inSetup && !tourSample
    const [data, setData] = useState(initialData)
    const [search, setSearch] = useState('')
    const [qualityId, setQualityId] = useState('')
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [formState, setForm] = useState<{ kind: 'opening' | 'correction'; quality?: StockQuality } | null>(null)
    const [isHistoryOpen, setIsHistoryOpen] = useState(false)
    const [recentOpen, setRecentOpen] = useState(false)
    const [labelState, setLabel] = useState('')
    const [metersState, setMeters] = useState('')
    const [reasonState, setReason] = useState('')
    const [saving, setSaving] = useState(false)
    const [saveError, setSaveError] = useState('')
    const [request, setRequest] = useState<StockAdjustmentInput | null>(null)
    const [legacyFor, setLegacyFor] = useState<StockQuality | null>(null)
    const loading = useRef(false)
    const writing = useRef(false)
    const tx = (key: string) => t(`qualityStock.${key}`)
    const metres = (value: number) => Number(value).toLocaleString(language === 'en' ? 'en-IN' : `${language}-IN`, { maximumFractionDigits: 2 })

    useEffect(() => { setData(initialData); setQualityId('') }, [initialData])
    // While the Fabric Stock tour teaches opening or correction, show the real dialog for the first quality.
    const tourForm = tourStep ? fabricStockSampleForm(language, tourStep) : null
    const tourQuality = tourForm ? data.qualities[0] : undefined
    const form = tourForm && tourQuality ? { kind: tourForm.kind, quality: tourQuality } : formState
    const label = tourForm && tourQuality ? tourQuality.quality_label : labelState
    const meters = tourForm ? tourForm.meters : metersState
    const reason = tourForm ? tourForm.reason : reasonState
    // A tab returning from Production should show current stock. Explicit refresh
    // also works when the browser cannot deliver a focus event.
    useEffect(() => {
        if (tourSample) return // a tour sample has nothing to refresh
        const refresh = () => { if (!document.hidden) router.refresh() }
        document.addEventListener('visibilitychange', refresh)
        window.addEventListener('focus', refresh)
        return () => { document.removeEventListener('visibilitychange', refresh); window.removeEventListener('focus', refresh) }
    }, [router, tourSample])

    async function load(filter = qualityId, more = false) {
        if (loading.current) return
        loading.current = true; setBusy(true); setError('')
        try {
            const result = await getQualityStockBoard({ qualityId: filter || undefined, cursor: more ? data.nextCursor ?? undefined : undefined, activity: !filter && !more })
            if ('error' in result) { setError(tx('loadError')); return }
            setQualityId(filter)
            // A filtered or older page carries no activity; the page keeps the week it already shows.
            setData(previous => ({
                ...result.data,
                activity: result.data.activity === undefined ? previous.activity : result.data.activity,
                movements: more ? [...previous.movements, ...result.data.movements.filter(row => !previous.movements.some(old => old.id === row.id))] : result.data.movements,
            }))
        } catch { setError(tx('loadError')) }
        finally { loading.current = false; setBusy(false) }
    }

    function open(kind: 'opening' | 'correction', quality?: StockQuality) {
        setForm({ kind, quality }); setLabel(quality?.quality_label ?? ''); setMeters(kind === 'correction' ? String(quality?.meters ?? '') : '')
        setReason(''); setSaveError(''); setRequest(null)
    }

    function openHistory(filter: string) {
        setIsHistoryOpen(true)
        if (filter !== qualityId || data.movements.length === 0) void load(filter)
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
            setForm(null); setRequest(null); setNotice(tx('saved')); if (!tourSample) reportPwaWorkflowSuccess('stock'); await load('')
        } catch { setSaveError(tx('retrySame')) }
        finally { writing.current = false; setSaving(false) }
    }

    // Largest first: the composition bar, the legend and the cards share one order and one colour per quality.
    const ranked = useMemo(() => [...data.qualities].sort((a, b) => Number(b.meters) - Number(a.meters) || a.quality_label.localeCompare(b.quality_label)), [data.qualities])
    const colorOf = new Map(ranked.map((quality, rank) => [quality.id, swatchFor(rank)]))
    const labelOf = new Map(data.qualities.map(quality => [quality.id, quality.quality_label]))
    const qualities = ranked.filter(row => row.quality_label.toLocaleLowerCase().includes(search.toLocaleLowerCase()))
    const total = Number(data.total_meters)
    // Legacy (untagged) stock is kept apart: the headline stays orange stock, and the whole total is called exact only when it is.
    const legacyRows = data.legacy ?? []
    const legacyOf = new Map(legacyRows.map(row => [row.quality_id, row]))
    const totals = legacyRows.length > 0 ? stockTotals(data.qualities.map(quality => Number(quality.meters)), legacyRows) : null
    const share = (value: number) => total > 0 ? Math.round((Math.max(value, 0) / total) * 100) : 0
    const others = ranked.slice(COMPOSITION_SLOTS)
    const othersMeters = others.reduce((sum, quality) => sum + Number(quality.meters), 0)

    // Week totals, trends and the recent list come from the server's three-week window. A tour sample has none,
    // so the recent list falls back to the history page it was given.
    const activity = data.activity
    const since = weekSince()
    const rows: ActivityRow[] = (activity ?? []).map(row => ({ id: row.id, itemId: row.quality_id, kind: row.kind, delta: Number(row.meters_delta), balanceAfter: Number(row.balance_after), createdAt: row.created_at }))
    const week = activity ? totalsSince(rows, since, fabricActivityBucket) : null
    const recent = activity ? activity.filter(row => Date.parse(row.created_at) >= Date.parse(since)) : data.movements.slice(0, 12)
    const today = businessDate()
    const dayLabel = (date: string) => date === today ? tx('today') : formatIndiaDay(date, language)
    const shortDate = (iso: string) => new Date(iso).toLocaleDateString(`${language}-IN`, { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })
    const kindLabel = (kind: string) => tx(kind === 'production' ? 'productionEntry' : kind)
    const reasonLabel = (value: string) => value === 'Production updated' ? tx('productionUpdated') : value
    const weekFacts = (totals: Partial<Record<'woven' | 'dispatched' | 'onboarded' | 'adjusted', number>>) => (['woven', 'dispatched', 'onboarded', 'adjusted'] as const)
        .filter(key => totals[key])
        .map(key => ({ key, label: tx(key), value: totals[key]! }))

    return (
        <div className="stock-workspace-shell space-y-6" data-i18n-skip="true">
            <RouteMilestones route="/owner/stock" shellVisible primaryUsable />
            <PageHeader
                title={tx('title')}
                description={tx('intro')}
                actions={<>
                    <PageGuide />
                    <Button data-tour-anchor="fabric.opening" onClick={() => open('opening')} disabled={openingClosed} className={railPrimaryAction}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        {tx('opening')}
                    </Button>
                </>}
            />
            {openingClosed && <GoLiveNotice>{t('goLive.openingDisabled')}</GoLiveNotice>}

            {notice && <p role="status" className="rounded-xl border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] p-3.5 text-sm font-medium text-[var(--wv-moss-700)]">{notice}</p>}
            {error && <p role="alert" className="rounded-xl border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3.5 text-sm font-medium text-[var(--wv-madder-600)]">{error} <button className="ml-1 font-bold underline" onClick={() => void load('')}>{tx('retry')}</button></p>}

            {/* On hand: the total, this week's flow and each quality's share of the stock. */}
            <section data-stock-tour="balance" aria-labelledby="fabric-on-hand" className="space-y-5 rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
                    <div>
                        <p id="fabric-on-hand" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-saffron" />
                            {totals ? tx('orangeOnHand') : tx('onHand')}
                        </p>
                        <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums">
                            {metres(total)}
                            <span className="ml-1.5 text-2xl font-medium tracking-normal text-muted-foreground">{tx('metres')}</span>
                        </p>
                        <p className="mt-3 text-sm text-body">{data.qualities.length === 1 ? tx('qualityCountOne') : t('qualityStock.qualityCount', { count: data.qualities.length })}</p>
                        {totals && (
                            <p data-legacy-total={totals.exact ? 'exact' : totals.unknownQualities ? 'incomplete' : 'estimated'} className="mt-1 text-sm font-medium text-ink">
                                {totals.unknownQualities > 0
                                    ? (totals.unknownQualities === 1 ? tx('totalIncompleteOne') : t('qualityStock.totalIncomplete', { count: totals.unknownQualities }))
                                    : totals.exact
                                        ? t('qualityStock.totalExact', { meters: metres(totals.total) })
                                        : t('qualityStock.totalEstimated', { meters: metres(totals.total) })}
                            </p>
                        )}
                    </div>
                    {week ? (
                        <div className="min-w-0">
                            <p className="text-sm font-medium text-muted-foreground">{tx('lastWeek')}</p>
                            <dl className="mt-2 flex flex-wrap gap-x-7 gap-y-3">
                                {[...weekFacts(week), { key: 'net', label: tx('netChange'), value: Object.values(week).reduce((sum, value) => sum + (value ?? 0), 0) }].map(fact => (
                                    <div key={fact.key}>
                                        <dt className="text-[13px] text-muted-foreground">{fact.label}</dt>
                                        <dd className="mt-0.5 text-lg">
                                            <SignedQuantity value={fact.value} unit={tx('metres')} format={metres} className={fact.key === 'net' ? 'text-ink' : undefined} />
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ) : activity === null ? (
                        <p className="max-w-xs text-sm text-muted-foreground">{tx('activityUnavailable')}</p>
                    ) : null}
                </div>
                {total > 0 && ranked.length > 1 && (
                    <div className="space-y-3">
                        <CompositionBar
                            label={tx('shareLabel')}
                            segments={[
                                ...ranked.slice(0, COMPOSITION_SLOTS).map(quality => ({ key: quality.id, value: Number(quality.meters), color: colorOf.get(quality.id)! })),
                                ...(others.length ? [{ key: 'others', value: othersMeters, color: OTHER_SWATCH }] : []),
                            ]}
                        />
                        <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                            {ranked.slice(0, COMPOSITION_SLOTS).map(quality => (
                                <li key={quality.id} className="flex min-w-0 items-center gap-2">
                                    <Swatch color={colorOf.get(quality.id)!} />
                                    <span className="truncate font-semibold text-ink">{quality.quality_label}</span>
                                    <span className="shrink-0 tabular-nums text-muted-foreground">{metres(quality.meters)} {tx('metres')} · {share(Number(quality.meters))}%</span>
                                </li>
                            ))}
                            {others.length > 0 && (
                                <li className="flex items-center gap-2">
                                    <Swatch color={OTHER_SWATCH} />
                                    <span className="font-semibold text-ink">{others.length === 1 ? others[0].quality_label : t('qualityStock.others', { count: others.length })}</span>
                                    <span className="tabular-nums text-muted-foreground">{metres(othersMeters)} {tx('metres')} · {share(othersMeters)}%</span>
                                </li>
                            )}
                        </ul>
                    </div>
                )}
            </section>

            {/* One card per quality, in the same order and colour as the bar above. */}
            <section className="space-y-4" aria-labelledby="stock-qualities">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <h2 id="stock-qualities" className="text-base font-semibold text-ink">
                        {tx('byQuality')}
                        <span className="ml-2 font-medium tabular-nums text-muted-foreground">{qualities.length}</span>
                    </h2>
                    <div className="flex items-center gap-2">
                        <div className="relative w-full sm:w-72">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <Label htmlFor="stock-search" className="sr-only">{tx('search')}</Label>
                            <Input
                                id="stock-search"
                                type="search"
                                placeholder={tx('search')}
                                value={search}
                                onChange={event => setSearch(event.target.value)}
                                className="h-10 rounded-lg border-hairline bg-surface pl-9 shadow-xs max-md:min-h-[44px]"
                            />
                        </div>
                        <Button variant="ghost" disabled={busy} onClick={() => void load('')} className="h-10 shrink-0 rounded-lg font-semibold text-body max-md:min-h-[44px]">
                            <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
                            <span className="max-sm:sr-only">{tx('refresh')}</span>
                        </Button>
                    </div>
                </div>

                {qualities.length === 0 ? (
                    <EmptyState
                        icon={Warehouse}
                        title={search ? tx('noMatches') : tx('empty')}
                        action={!search && (
                            <Button asChild variant="outline" className={secondaryAction}>
                                <Link href="/owner/production">{tx('production')}</Link>
                            </Button>
                        )}
                    />
                ) : (
                    <div className={qualities.length <= 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]'}>
                        {qualities.map(quality => {
                            const color = colorOf.get(quality.id) ?? OTHER_SWATCH
                            const trail = activity ? balanceTrail(rows, quality.id, Number(quality.meters), activitySince()) : null
                            const own = activity ? weekFacts(totalsSince(rows.filter(row => row.itemId === quality.id), since, fabricActivityBucket)) : null
                            const lastAt = activity?.find(row => row.quality_id === quality.id)?.created_at
                            return (
                                <article
                                    key={quality.id}
                                    data-stock-tour={quality.id === qualities[0]?.id ? 'openingPending' : undefined}
                                    className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:px-6"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <h3 className="flex min-w-0 items-start gap-2.5 text-base font-semibold leading-snug text-ink">
                                            <Swatch color={color} className="mt-1.5" />
                                            <span className="break-words">{quality.quality_label}</span>
                                        </h3>
                                        {!quality.opening_recorded && !legacyOf.has(quality.id) ? (
                                            <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--wv-ochre-800)]" title={tx('openingPending')}>
                                                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                                                {tx('pending')}
                                            </span>
                                        ) : lastAt ? (
                                            <span className="shrink-0 text-[13px] tabular-nums text-muted-foreground">{t('qualityStock.updated', { date: shortDate(lastAt) })}</span>
                                        ) : null}
                                    </div>
                                    <div className="flex items-end justify-between gap-4">
                                        <p className="text-4xl font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                                            {metres(quality.meters)}
                                            <span className="ml-1.5 text-lg font-medium tracking-normal text-muted-foreground">{tx('metres')}</span>
                                        </p>
                                        {trail && <StockTrend points={trail} color={color} label={tx('trendLabel')} className="w-1/2" />}
                                    </div>
                                    {legacyOf.get(quality.id) && <LegacyStatusLine legacy={legacyOf.get(quality.id)!} />}
                                    {own && (
                                        <p className="text-[13px] text-body">
                                            <span className="text-muted-foreground">{tx('lastWeek')}: </span>
                                            {own.length === 0 ? tx('quietWeek') : own.map((fact, index) => (
                                                <span key={fact.key}>
                                                    {index > 0 && <span aria-hidden="true" className="text-muted-foreground"> · </span>}
                                                    {fact.label} <SignedQuantity value={fact.value} unit={tx('metres')} format={metres} />
                                                </span>
                                            ))}
                                        </p>
                                    )}
                                    <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                                        <Button asChild className={railPrimaryAction}>
                                            <Link href={`/owner/dispatches?quality=${quality.id}`}>
                                                <Truck className="h-4 w-4" aria-hidden="true" />
                                                {tx('dispatchAction')}
                                            </Link>
                                        </Button>
                                        <Button variant="outline" onClick={() => open(quality.opening_recorded ? 'correction' : 'opening', quality)} className={secondaryAction}>
                                            {quality.opening_recorded ? tx('correct') : tx('opening')}
                                        </Button>
                                        {!quality.opening_recorded && (
                                            <Button variant="outline" onClick={() => open('correction', quality)} className={secondaryAction}>
                                                {tx('correct')}
                                            </Button>
                                        )}
                                        {/* Hidden when legacy stock cannot be read, so no one acts on a balance they cannot see. */}
                                        {!tourSample && data.legacy && (
                                            <Button variant="outline" aria-haspopup="dialog" onClick={() => setLegacyFor(quality)} className={secondaryAction}>
                                                {tx('legacyAction')}
                                            </Button>
                                        )}
                                        <Button
                                            variant="ghost"
                                            disabled={busy}
                                            aria-haspopup="dialog"
                                            onClick={() => openHistory(quality.id)}
                                            className="ml-auto h-10 rounded-lg font-semibold text-body max-md:min-h-[44px]"
                                        >
                                            {tx('history')}
                                        </Button>
                                    </div>
                                </article>
                            )
                        })}
                    </div>
                )}
            </section>

            {/* The last seven days, day by day, folded until asked for; the full ledger opens from Movement history. */}
            <RecentMovementsSection
                id="stock-recent"
                title={tx('recent')}
                help={activity ? tx('recentHelp') : undefined}
                open={recentOpen}
                onToggle={() => setRecentOpen(value => !value)}
                action={(
                    <Button variant="outline" aria-haspopup="dialog" onClick={() => openHistory('')} className={secondaryAction}>
                        <History className="h-4 w-4" aria-hidden="true" />
                        {tx('fullHistory')}
                    </Button>
                )}
            >
                {recent.length === 0 ? (
                    <p className="border-t border-hairline px-5 py-5 text-sm text-muted-foreground sm:px-6">{tx('recentEmpty')}</p>
                ) : (
                    <DayGroupList
                        days={groupByIndiaDay(recent).map(day => ({
                            key: day.date,
                            label: dayLabel(day.date),
                            net: <SignedQuantity value={day.rows.reduce((sum, row) => sum + Number(row.meters_delta), 0)} unit={tx('metres')} format={metres} className="font-medium" />,
                            rows: day.rows,
                        }))}
                        renderRow={row => (
                            <li key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-0.5 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
                                <span className="min-w-0">
                                    <span className="block truncate font-semibold text-ink">{labelOf.get(row.quality_id) ?? ''}</span>
                                    <span className="block text-xs text-muted-foreground sm:hidden">{kindLabel(row.kind)}</span>
                                </span>
                                <span className="text-body max-sm:hidden">{kindLabel(row.kind)}</span>
                                <span className="truncate text-muted-foreground max-sm:hidden" title={reasonLabel(row.reason)}>
                                    {/* Production rows say only "Production updated"; the entry type already says it. */}
                                    {row.kind === 'production' || row.kind === 'production_reversal' ? null : reasonLabel(row.reason)}
                                </span>
                                <SignedQuantity value={Number(row.meters_delta)} unit={tx('metres')} format={metres} className="text-right" />
                            </li>
                        )}
                    />
                )}
            </RecentMovementsSection>

            {/* Movement History Modal */}
            <Dialog open={isHistoryOpen || tourStep === 'fs-history'} onOpenChange={setIsHistoryOpen} {...surface.root}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 overflow-hidden rounded-2xl border-hairline shadow-2xl" data-i18n-skip="true" {...surface.content}>
                    {/* Header */}
                    <div className="border-b border-hairline/80 px-6 py-5 bg-surface/50 backdrop-blur-sm">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-loom/10 text-loom">
                                    <History className="h-5 w-5" />
                                </div>
                                <div className="min-w-0">
                                    <DialogTitle className="text-lg font-bold text-ink">
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
                    <div data-stock-tour="history" className="flex-1 overflow-y-auto p-6 space-y-3" aria-busy={busy}>
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
                                                        ? 'bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]'
                                                        : row.kind === 'dispatch' || row.kind === 'dispatch_reversal'
                                                        ? 'bg-[var(--wv-lagoon-50)] text-[var(--wv-lagoon-700)]'
                                                        : row.kind === 'opening'
                                                        ? 'bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]'
                                                        : 'bg-[var(--wv-neel-50)] text-[var(--wv-neel-700)]'
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
                                                    isNegative ? 'text-[var(--wv-madder-600)]' : isPositive ? 'text-[var(--wv-moss-700)]' : 'text-body'
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

            <LegacyStockDialog
                quality={legacyFor}
                legacy={legacyFor ? legacyOf.get(legacyFor.id) : undefined}
                onClose={() => setLegacyFor(null)}
                onSaved={async message => { setNotice(message); if (!tourSample) reportPwaWorkflowSuccess('stock'); await load('') }}
            />

            {/* Opening / Correction Modal */}
            <Dialog open={Boolean(form)} onOpenChange={value => { if (!value && !saving) setForm(null) }} {...surface.root}>
                <DialogContent className="max-w-md rounded-2xl border-hairline shadow-2xl" data-i18n-skip="true" {...surface.content}>
                    <DialogHeader>
                        <DialogTitle className="text-lg font-bold text-ink">
                            {form?.kind === 'opening' ? tx('opening') : tx('correct')}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-body">
                            {form?.kind === 'opening' ? tx('openingHelp') : tx('correctHelp')}
                        </DialogDescription>
                    </DialogHeader>
                    <form data-stock-tour={form?.kind === 'opening' ? 'opening' : 'correction'} className="space-y-4" onSubmit={event => { event.preventDefault(); void save() }}>
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
                        {saveError && <p role="alert" className="text-xs text-[var(--wv-madder-600)] font-medium">{saveError}</p>}
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
