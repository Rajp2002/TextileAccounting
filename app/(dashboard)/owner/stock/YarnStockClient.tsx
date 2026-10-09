'use client'
import { reportPwaWorkflowSuccess } from '@/lib/pwa-workflow-success'
import { RouteMilestones } from '@/components/performance/route-milestones'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ClipboardCheck, Download, History, Plus, RefreshCw, Spool } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { railPrimaryAction } from '@/components/ui/rail'
import { PageGuide } from '@/components/tours/TourInvitation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { COMPOSITION_SLOTS, CompositionBar, DayGroupList, OTHER_SWATCH, SignedQuantity, StockTrend, Swatch, formatIndiaDay, swatchFor } from '@/components/stock/stock-presentation'
import { useTranslation } from '@/lib/i18n/context'
import { useTourSample } from '@/lib/tours/sample-context'
import { tourSurfaceProps } from '@/lib/tours/sample-surface'
import { yarnStockSampleEntry } from '@/lib/tours/sample-data/stock'
import type { YarnStockTourStep } from '@/lib/stock-tour'
import { yarnStockText } from '@/lib/i18n/yarn-stock'
import { businessDate } from '@/lib/challan-payment-terms'
import { WEEK_DAYS, activitySince, balanceTrail, groupByIndiaDay, lastsFor, totalsSince, weekSince, type ActivityRow } from '@/lib/stock-activity'
import { YarnMutationSchema, totalYarnKg, yarnActivityBucket, yarnAuditCsv, yarnFeeds, yarnMovementUsage, type YarnActivity, type YarnBalance, type YarnBoard, type YarnMutation, type YarnQuality } from '@/lib/yarn-stock'
import { getYarnStockBoard, mutateYarnStock } from './yarn-actions'

type Entry = { kind: 'opening' | 'receipt' | 'correction'; yarn?: YarnBalance } | { kind: 'recipe'; quality: YarnQuality }

// Phones render rem at 14px, so the 44px touch target needs a pixel minimum.
const secondaryAction = 'h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs hover:bg-surface-soft max-md:min-h-[44px]'
const ghostAction = 'h-10 rounded-lg font-semibold text-body max-md:min-h-[44px]'

export default function YarnStockClient({ initialData }: { initialData: YarnBoard }) {
    const { language, t } = useTranslation(), text = yarnStockText[language]
    const tourSample = useTourSample('yarn-stock')
    const tourStep = tourSample?.step as YarnStockTourStep | undefined
    const surface = tourSurfaceProps(Boolean(tourSample))
    const [data, setData] = useState(initialData)
    const [date, setDate] = useState(''), [filter, setFilter] = useState('')
    const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [entryState, setEntry] = useState<Entry | null>(null)
    const [nameState, setName] = useState(''), [weightState, setWeight] = useState(''), [reasonState, setReason] = useState(''), [costingState, setCosting] = useState('')
    const [saving, setSaving] = useState(false), [saveError, setSaveError] = useState(''), [request, setRequest] = useState<YarnMutation | null>(null)
    const loading = useRef(false), writing = useRef(false)
    const storageKey = `weavly-yarn-stock-request:${initialData.org_id}`
    // Weights keep their full precision for entry and export; the page reads them to two decimals.
    const kg = (n: number) => Number(n).toLocaleString(`${language}-IN`, { maximumFractionDigits: 9 })
    const kg2 = (n: number) => Number(n).toLocaleString(`${language}-IN`, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const dateTime = (value: string) => new Date(value).toLocaleString(`${language}-IN`, { timeZone: 'Asia/Kolkata' })
    const longDate = (value: string) => new Date(value).toLocaleDateString(`${language}-IN`, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    const fill = (template: string, values: Record<string, string | number>) => Object.entries(values).reduce((out, [key, value]) => out.replace(`{${key}}`, String(value)), template)

    // Scope recovery to the tenant. A retry retains the original immutable payload.
    useEffect(() => {
        if (tourSample) return // a tour sample never reads the real page's pending request
        try {
            const raw = sessionStorage.getItem(storageKey)
            if (!raw) return
            const parsed = YarnMutationSchema.safeParse(JSON.parse(raw))
            if (!parsed.success) { sessionStorage.removeItem(storageKey); return }
            const pending = parsed.data
            // Recover external session state after hydration; reading during render would mismatch SSR.
            setRequest(pending); setReason(pending.payload.reason)
            if (pending.action === 'recipe') {
                const quality = initialData.qualities.find(row => row.id === pending.payload.quality_id)
                if (quality) { setEntry({ kind: 'recipe', quality }); setCosting(pending.payload.costing_id) }
            } else {
                setEntry({ kind: pending.action, yarn: initialData.yarns.find(row => row.yarn_key === pending.payload.yarn_name.toLowerCase()) })
                setName(pending.payload.yarn_name); setWeight(String(pending.payload.weight_kg))
            }
        } catch { /* Session storage can be unavailable; in-memory retry still works. */ }
    }, [storageKey, initialData, tourSample])

    async function load(asOf = data.as_of ?? '', yarnId = filter, more = false) {
        if (loading.current) return
        loading.current = true; setBusy(true); setError('')
        try {
            const result = await getYarnStockBoard({ asOf: asOf || undefined, yarnId: yarnId || undefined, cursor: more ? data.nextCursor ?? undefined : undefined, activity: !asOf && !yarnId && !more })
            if ('error' in result) { setError(result.error); return }
            setFilter(yarnId)
            // Pace and trends describe today: a dated view drops them, a filtered or older page keeps the ones shown.
            setData(previous => ({
                ...result.data,
                activity: result.data.activity !== undefined ? result.data.activity : asOf ? undefined : previous.activity,
                movements: more ? [...previous.movements, ...result.data.movements.filter(row => !previous.movements.some(old => old.id === row.id))] : result.data.movements,
            }))
        } catch { setError(text.loadError) }
        finally { loading.current = false; setBusy(false) }
    }
    const refresh = useRef<() => void>(() => {})
    useEffect(() => { refresh.current = () => { if (!document.hidden && !writing.current) void load() } })
    useEffect(() => {
        const run = () => refresh.current()
        window.addEventListener('focus', run); document.addEventListener('visibilitychange', run)
        return () => { window.removeEventListener('focus', run); document.removeEventListener('visibilitychange', run) }
    }, [])
    function open(value: Entry) {
        setEntry(value); setName(value.kind !== 'recipe' ? value.yarn?.yarn_name ?? '' : '')
        setWeight(value.kind === 'correction' ? String(value.yarn?.weight_kg ?? '') : '')
        setCosting(value.kind === 'recipe' ? value.quality.costing_id ?? '' : '')
        setReason(''); setSaveError(''); setRequest(null)
    }
    function openHistory(yarnId: string) {
        setHistoryOpen(true)
        if (yarnId !== filter) void load(data.as_of ?? '', yarnId)
    }
    function clearRequest() { setRequest(null); try { sessionStorage.removeItem(storageKey) } catch {} }
    async function save() {
        if (!entry || writing.current) return
        const candidate = request ?? (entry.kind === 'recipe'
            ? { action: 'recipe' as const, requestId: crypto.randomUUID(), payload: { quality_id: entry.quality.id, costing_id: costing, expected_version: entry.quality.version, reason } }
            : { action: entry.kind, requestId: crypto.randomUUID(), payload: { yarn_name: name, weight_kg: weight.trim() ? Number(weight) : NaN, reason, expected_kg: entry.kind === 'correction' ? entry.yarn?.weight_kg : undefined } })
        const parsed = YarnMutationSchema.safeParse(candidate)
        if (!parsed.success) { setSaveError(text.validation); return }
        const input = parsed.data
        writing.current = true; setSaving(true); setRequest(input); setSaveError('')
        try { sessionStorage.setItem(storageKey, JSON.stringify(input)) } catch {}
        try {
            const result = await mutateYarnStock(input)
            if ('error' in result) { setSaveError(result.error); if (!result.uncertain) clearRequest(); return }
            clearRequest(); setEntry(null); setNotice(true); if (!tourSample) reportPwaWorkflowSuccess('stock'); await load('', '')
        } catch { setSaveError(text.retrySame) }
        finally { writing.current = false; setSaving(false) }
    }
    function download() {
        const url = URL.createObjectURL(new Blob([yarnAuditCsv(data)], { type: 'text/csv;charset=utf-8;' }))
        const link = document.createElement('a'); link.href = url; link.download = `yarn-stock-${data.as_of ?? 'current'}.csv`; link.click()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
    // While the Yarn Stock tour teaches a dialog, show the real one, filled with sample values.
    const tourEntry = tourStep ? yarnStockSampleEntry(language, tourStep) : null
    const tourYarn = data.yarns[0], tourQuality = data.qualities[0]
    const entry: Entry | null = tourEntry
        ? tourEntry.kind === 'recipe' ? (tourQuality ? { kind: 'recipe', quality: tourQuality } : null)
            : { kind: tourEntry.kind, yarn: tourEntry.kind === 'opening' ? undefined : tourYarn }
        : entryState
    const name = tourEntry ? tourEntry.name : nameState, weight = tourEntry ? tourEntry.weight : weightState
    const reason = tourEntry ? tourEntry.reason : reasonState
    const costing = tourEntry?.kind === 'recipe' ? data.costings[0]?.id ?? '' : costingState
    const current = !data.as_of
    const options = entry?.kind === 'recipe' ? data.costings.filter(row => row.quality_key === entry.quality.quality_key) : []
    const selected = options.find(row => row.id === costing)
    const names = [...new Set([...data.yarns.map(row => row.yarn_name), ...data.costings.flatMap(row => row.recipe.map(layer => layer.yarn_name))])].sort()

    // Heaviest first for the bar, its legend and each yarn's colour.
    const total = totalYarnKg(data.yarns)
    const ranked = useMemo(() => [...data.yarns].sort((a, b) => Number(b.weight_kg) - Number(a.weight_kg) || a.yarn_name.localeCompare(b.yarn_name)), [data.yarns])
    const colorOf = new Map(ranked.map((yarn, rank) => [yarn.id, swatchFor(rank)]))
    const nameOf = new Map(data.yarns.map(yarn => [yarn.id, yarn.yarn_name]))
    const share = (value: number) => total > 0 ? Math.round((Math.max(value, 0) / total) * 100) : 0
    const others = ranked.slice(COMPOSITION_SLOTS)
    const othersKg = others.reduce((sum, yarn) => sum + Number(yarn.weight_kg), 0)

    // Today's pace and trends come from the server's three-week window; a dated view and a tour sample have none.
    const activity = current ? data.activity : undefined
    const since = weekSince()
    const rows: ActivityRow[] = (activity ?? []).map(row => ({ id: row.id, itemId: row.yarn_id, kind: row.kind, delta: Number(row.kg_delta), balanceAfter: Number(row.balance_after), createdAt: row.created_at }))
    const week = activity ? totalsSince(rows, since, yarnActivityBucket) : null
    // Average daily use over this week: production (and, for older records, dispatch) draws yarn down.
    const perDayOf = new Map(activity ? data.yarns.map(yarn => [yarn.id, Math.max(-(totalsSince(rows.filter(row => row.itemId === yarn.id), since, yarnActivityBucket).used ?? 0), 0) / WEEK_DAYS]) : [])
    const perDay = (yarnId: string) => perDayOf.get(yarnId) ?? 0
    const lasts = (yarn: YarnBalance) => activity ? lastsFor(Number(yarn.weight_kg), perDay(yarn.id)) : null
    // The yarn that runs out first leads; yarns not in use follow, heaviest first.
    const daysLeft = (yarn: YarnBalance) => perDay(yarn.id) > 0 ? Number(yarn.weight_kg) / perDay(yarn.id) : Infinity
    const yarns = activity ? [...ranked].sort((a, b) => (daysLeft(a) - daysLeft(b)) || Number(b.weight_kg) - Number(a.weight_kg)) : ranked
    const recent: (YarnActivity & { yarn_name?: string })[] = activity ? activity.filter(row => Date.parse(row.created_at) >= Date.parse(since)) : data.movements.slice(0, 12)
    const usageRowId = recent.find(row => row.kind === 'production_consumption')?.id
    const today = businessDate()
    const weekFacts = (totals: Partial<Record<'received' | 'used' | 'adjusted', number>>) => (['received', 'used', 'adjusted'] as const)
        .filter(key => totals[key])
        .map(key => ({ key, label: text[key], value: totals[key]! }))
    const lastsText = (value: NonNullable<ReturnType<typeof lastsFor>>) => value.unit === 'underDay'
        ? text.lastsUnderDay
        : fill(value.unit === 'days' ? text.lastsDays : value.unit === 'weeks' ? text.lastsWeeks : text.lastsMonths, { n: value.count })
    const movementDetail = (row: YarnActivity) => {
        const usage = yarnMovementUsage(row, data.yarns)
        if (usage) return `${kg2(usage.meters)} m · ${kg2(usage.kgPer100m)} ${text.per100}`
        return row.reason
    }

    return <div className="stock-workspace-shell space-y-6" data-i18n-skip="true">
        <RouteMilestones route="/owner/stock/yarn" shellVisible primaryUsable />
        <PageHeader
            title={text.title}
            description={text.intro}
            actions={<>
                <PageGuide />
                <Button asChild variant="outline" className={secondaryAction}>
                    <Link href="/owner/stock/audit">
                        <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                        {t('qualityStock.audit')}
                    </Link>
                </Button>
                {current && <><Button data-tour-anchor="yarn.opening" variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'opening' })}>{text.opening}</Button><Button disabled={Boolean(request)} onClick={() => open({ kind: 'receipt' })} className={railPrimaryAction}><Plus className="h-4 w-4" aria-hidden="true" />{text.receipt}</Button></>}
            </>}
        />
        {notice && <p role="status" className="rounded-xl border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] p-3.5 text-sm font-medium text-[var(--wv-moss-700)]">{text.saved}</p>}
        {error && <p role="alert" className="rounded-xl border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-3.5 text-sm font-medium text-[var(--wv-madder-600)]">{error} <button className="ml-1 font-bold underline" onClick={() => void load()}>{text.retry}</button></p>}
        {!data.started_at && <p className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-4 text-sm text-[var(--wv-ochre-800)]">{text.startHelp}</p>}

        {/* On hand: the total, a dated view for audits, this week's flow and each yarn's share by weight. */}
        <section data-stock-tour="balance" aria-labelledby="yarn-on-hand" className="space-y-5 rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-10 gap-y-5">
                <div>
                    <p id="yarn-on-hand" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-saffron" />
                        {data.as_of ? fill(text.asOfLabel, { date: longDate(`${data.as_of}T12:00:00+05:30`) }) : text.onHand}
                    </p>
                    <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums">
                        {kg2(total)}
                        <span className="ml-1.5 text-2xl font-medium tracking-normal text-muted-foreground">kg</span>
                    </p>
                    <p className="mt-3 text-sm text-body">
                        {data.yarns.length === 1 ? text.yarnCountOne : fill(text.yarnCount, { n: data.yarns.length })}
                        {data.started_at && <span className="text-muted-foreground"> · {text.started} {longDate(data.started_at)}</span>}
                    </p>
                </div>
                <div className="flex flex-col items-start gap-4 sm:items-end">
                    <form className="flex flex-wrap items-end gap-2" onSubmit={event => { event.preventDefault(); void load(date) }}>
                        <div className="space-y-1.5">
                            <Label htmlFor="yarn-audit-date" className="text-[13px] font-medium text-muted-foreground">{text.audit}</Label>
                            <Input id="yarn-audit-date" type="date" value={date} max={today} onChange={e => setDate(e.target.value)} className="h-10 w-auto rounded-lg border-hairline shadow-xs max-md:min-h-[44px]" />
                        </div>
                        <Button type="submit" disabled={busy || !date} variant="outline" className={secondaryAction}>{text.apply}</Button>
                        {data.as_of && <Button type="button" disabled={busy} variant="ghost" className={ghostAction} onClick={() => { setDate(''); void load('', '') }}>{text.backToToday}</Button>}
                        <Button type="button" disabled={busy} variant="outline" className={secondaryAction} onClick={download}><Download className="h-4 w-4" aria-hidden="true" />{text.export}</Button>
                    </form>
                    {data.as_of && <p className="max-w-md text-[13px] leading-relaxed text-muted-foreground sm:text-right">{text.auditHelp}</p>}
                    {week ? (
                        <div className="sm:text-right">
                            <p className="text-sm font-medium text-muted-foreground">{text.lastWeek}</p>
                            <dl className="mt-2 flex flex-wrap gap-x-7 gap-y-3 sm:justify-end">
                                {[...weekFacts(week), { key: 'net', label: text.net, value: Object.values(week).reduce((sum, value) => sum + (value ?? 0), 0) }].map(fact => (
                                    <div key={fact.key}>
                                        <dt className="text-[13px] text-muted-foreground">{fact.label}</dt>
                                        <dd className="mt-0.5 text-lg"><SignedQuantity value={fact.value} unit="kg" format={kg2} className={fact.key === 'net' ? 'text-ink' : undefined} /></dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    ) : current && data.activity === null ? (
                        <p className="max-w-xs text-sm text-muted-foreground sm:text-right">{text.activityUnavailable}</p>
                    ) : null}
                </div>
            </div>
            {total > 0 && ranked.length > 1 && (
                <div className="space-y-3">
                    <CompositionBar
                        label={text.shareLabel}
                        segments={[
                            ...ranked.slice(0, COMPOSITION_SLOTS).map(yarn => ({ key: yarn.id, value: Number(yarn.weight_kg), color: colorOf.get(yarn.id)! })),
                            ...(others.length ? [{ key: 'others', value: othersKg, color: OTHER_SWATCH }] : []),
                        ]}
                    />
                    <ul className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                        {ranked.slice(0, COMPOSITION_SLOTS).map(yarn => (
                            <li key={yarn.id} className="flex min-w-0 items-center gap-2">
                                <Swatch color={colorOf.get(yarn.id)!} />
                                <span className="truncate font-semibold text-ink">{yarn.yarn_name}</span>
                                <span className="shrink-0 tabular-nums text-muted-foreground">{kg2(yarn.weight_kg)} kg · {share(Number(yarn.weight_kg))}%</span>
                            </li>
                        ))}
                        {others.length > 0 && (
                            <li className="flex items-center gap-2">
                                <Swatch color={OTHER_SWATCH} />
                                <span className="font-semibold text-ink">{others.length === 1 ? others[0].yarn_name : fill(text.others, { n: others.length })}</span>
                                <span className="tabular-nums text-muted-foreground">{kg2(othersKg)} kg · {share(othersKg)}%</span>
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </section>

        {/* One card per yarn: weight, trend, how long it lasts at this week's use, and its actions. */}
        <section className="space-y-4" aria-labelledby="yarn-cards">
            <div className="flex items-center justify-between gap-3">
                <h2 id="yarn-cards" className="text-base font-semibold text-ink">
                    {text.byYarn}
                    <span className="ml-2 font-medium tabular-nums text-muted-foreground">{data.yarns.length}</span>
                </h2>
                <Button variant="ghost" disabled={busy} onClick={() => void load()} className={ghostAction}>
                    <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} aria-hidden="true" />
                    <span className="max-sm:sr-only">{text.refresh}</span>
                </Button>
            </div>
            {data.yarns.length === 0 ? <EmptyState icon={Spool} title={text.empty} /> : (
                <div className={data.yarns.length <= 2 ? 'grid gap-4 md:grid-cols-2' : 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,26rem),1fr))]'}>
                    {yarns.map(yarn => {
                        const color = colorOf.get(yarn.id) ?? OTHER_SWATCH
                        const feeds = yarnFeeds(yarn.yarn_key, data.qualities)
                        const trail = activity ? balanceTrail(rows, yarn.id, Number(yarn.weight_kg), activitySince()) : null
                        const runway = lasts(yarn)
                        const short = runway && (runway.unit === 'underDay' || (runway.unit === 'days' && runway.count < WEEK_DAYS))
                        return (
                            <article key={yarn.id} className="flex flex-col gap-4 rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:px-6">
                                <div className="min-w-0">
                                    <h3 className="flex items-start gap-2.5 text-base font-semibold leading-snug text-ink">
                                        <Swatch color={color} className="mt-1.5" />
                                        <span className="break-words">{yarn.yarn_name}</span>
                                    </h3>
                                    <p className="mt-0.5 pl-5 text-[13px] leading-snug text-muted-foreground">
                                        {feeds.length ? feeds.map(feed => `${text[feed.role]} · ${feed.quality}`).join(', ') : text.notInRecipe}
                                    </p>
                                </div>
                                <div className="flex items-end justify-between gap-4">
                                    <p className="text-4xl font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                                        {kg2(yarn.weight_kg)}
                                        <span className="ml-1.5 text-lg font-medium tracking-normal text-muted-foreground">kg</span>
                                    </p>
                                    {trail && <StockTrend points={trail} color={color} label={text.trendLabel} className="w-1/2" />}
                                </div>
                                {activity && (
                                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-body">
                                        {runway ? <>
                                            {short && <span aria-hidden="true" className="size-1.5 rounded-full bg-[var(--wv-ochre-400)]" />}
                                            <span className={short ? 'font-semibold text-[var(--wv-ochre-800)]' : 'font-semibold text-ink'}>{lastsText(runway)}</span>
                                            <span className="tabular-nums text-muted-foreground">· {fill(text.perDay, { kg: kg2(perDay(yarn.id)) })}</span>
                                        </> : <span className="text-muted-foreground">{text.notUsed}</span>}
                                    </p>
                                )}
                                {current && !yarn.opening_recorded && <p className="text-[13px] text-muted-foreground">{text.missing}</p>}
                                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                                    {current && <>
                                        <Button disabled={Boolean(request)} onClick={() => open({ kind: 'receipt', yarn })} className={railPrimaryAction}>
                                            <Plus className="h-4 w-4" aria-hidden="true" />
                                            {text.receipt}
                                        </Button>
                                        <Button variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'correction', yarn })} className={secondaryAction}>{text.correction}</Button>
                                    </>}
                                    <Button variant="ghost" disabled={busy} aria-haspopup="dialog" onClick={() => openHistory(yarn.id)} className={`ml-auto ${ghostAction}`}>{text.history}</Button>
                                </div>
                            </article>
                        )
                    })}
                </div>
            )}
        </section>

        {/* Each fabric's linked costing, which sets the yarn production draws per 100 m. */}
        {current && data.qualities.length > 0 && <section aria-labelledby="yarn-recipes" className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
            <div className="border-b border-hairline px-5 py-4 sm:px-6">
                <h2 id="yarn-recipes" className="text-base font-semibold text-ink">{text.formulas}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{text.formulaHelp}</p>
            </div>
            <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-6 border-b border-hairline px-6 py-2.5 text-xs font-semibold text-muted-foreground lg:grid">
                <span>{text.fabricCol}</span><span>{text.warp}</span><span>{text.weft}</span><span>{text.costingCol}</span><span className="sr-only">{text.link}</span>
            </div>
            <ul className="divide-y divide-hairline">
                {data.qualities.map(quality => {
                    const linked = data.costings.find(row => row.id === quality.costing_id)
                    const layers = (role: 'warp' | 'weft') => (quality.recipe ?? []).filter(row => row.role === role)
                    return <li key={quality.id} className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_auto] lg:items-center lg:gap-6">
                        <p className="font-semibold text-ink">{quality.quality_label}</p>
                        {quality.recipe ? (['warp', 'weft'] as const).map(role => (
                            <div key={role} className="text-sm">
                                <span className="text-[13px] text-muted-foreground lg:hidden">{text[role]} · </span>
                                {layers(role).length ? layers(role).map((row, index) => (
                                    <span key={index} className="block">
                                        <span className="text-ink">{row.yarn_name}</span>
                                        <span className="tabular-nums text-muted-foreground"> · {kg2(row.kg_per_100m)} {text.per100}</span>
                                    </span>
                                )) : <span className="text-muted-foreground">—</span>}
                            </div>
                        )) : <p className="text-sm font-medium text-[var(--wv-ochre-800)] lg:col-span-2">{text.unlinked}</p>}
                        <p className="text-sm text-muted-foreground">
                            {linked ? <>{fill(text.version, { n: linked.version_number })} · {fill(text.savedOn, { date: longDate(linked.saved_at) })}</> : '—'}
                        </p>
                        <Button variant="outline" disabled={Boolean(request)} onClick={() => open({ kind: 'recipe', quality })} className={`${secondaryAction} justify-self-start lg:justify-self-end`}>{text.link}</Button>
                    </li>
                })}
            </ul>
        </section>}

        {/* The last seven days, day by day; the full ledger opens from Movement history. */}
        <section aria-labelledby="yarn-recent" className="overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                <div>
                    <h2 id="yarn-recent" className="text-base font-semibold text-ink">{text.recent}</h2>
                    {activity && <p className="mt-0.5 text-sm text-muted-foreground">{text.recentHelp}</p>}
                </div>
                <Button variant="outline" aria-haspopup="dialog" onClick={() => openHistory('')} className={secondaryAction}>
                    <History className="h-4 w-4" aria-hidden="true" />
                    {text.fullHistory}
                </Button>
            </div>
            {recent.length === 0 ? (
                <p className="border-t border-hairline px-5 py-5 text-sm text-muted-foreground sm:px-6">{activity ? text.recentEmpty : text.noHistory}</p>
            ) : (
                <DayGroupList
                    days={groupByIndiaDay(recent).map(day => ({
                        key: day.date,
                        label: day.date === today ? text.today : formatIndiaDay(day.date, language),
                        net: <SignedQuantity value={day.rows.reduce((sum, row) => sum + Number(row.kg_delta), 0)} unit="kg" format={kg2} className="font-medium" />,
                        rows: day.rows,
                    }))}
                    renderRow={row => (
                        <li key={row.id} data-stock-tour={row.id === usageRowId ? 'movement' : undefined} className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 py-0.5 text-sm sm:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.4fr)_auto]">
                            <span className="min-w-0">
                                <span className="block truncate font-semibold text-ink">{row.yarn_name ?? nameOf.get(row.yarn_id) ?? ''}</span>
                                <span className="block text-xs text-muted-foreground sm:hidden">{text[row.kind]}</span>
                            </span>
                            <span className="text-body max-sm:hidden">{text[row.kind]}</span>
                            <span className="truncate text-muted-foreground max-sm:hidden">
                                {row.challan_id ? <Link className="hover:text-ink hover:underline" href={`/owner/dispatches/${row.challan_id}/print`}>{text.viewDispatch}</Link> : movementDetail(row)}
                            </span>
                            <SignedQuantity value={Number(row.kg_delta)} unit="kg" format={kg2} className="text-right" />
                        </li>
                    )}
                />
            )}
        </section>

        {/* The full ledger: every movement for one yarn or all yarns, through the date being viewed. */}
        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
            <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl" data-i18n-skip="true">
                <DialogHeader className="border-b border-hairline px-6 py-5">
                    <DialogTitle className="text-lg font-bold text-ink">{text.history}</DialogTitle>
                    <DialogDescription className="sr-only">{text.help}</DialogDescription>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Label htmlFor="yarn-history-filter" className="sr-only">{text.name}</Label>
                        <select id="yarn-history-filter" value={filter} disabled={busy} className="h-10 max-w-full rounded-lg border border-hairline bg-surface px-3 text-sm font-medium text-ink shadow-xs" onChange={e => void load(data.as_of ?? '', e.target.value)}>
                            <option value="">{text.all}</option>
                            {data.yarns.map(row => <option key={row.id} value={row.id}>{row.yarn_name}</option>)}
                        </select>
                        {data.as_of && <span className="text-[13px] text-muted-foreground">{fill(text.asOfLabel, { date: longDate(`${data.as_of}T12:00:00+05:30`) })}</span>}
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto px-6 py-2" aria-busy={busy}>
                    {data.movements.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{text.noHistory}</p> : <ol className="divide-y divide-hairline">{data.movements.map(row => {
                        const usage = yarnMovementUsage(row, data.yarns)
                        return <li key={row.id} className="flex flex-wrap justify-between gap-3 py-3.5">
                            <div className="min-w-0 space-y-0.5">
                                <p className="break-words text-sm font-semibold text-ink">{row.yarn_name} <span className="font-normal text-muted-foreground">· {text[row.kind]}</span></p>
                                {row.reason && <p className="max-w-xl break-words text-sm text-body">{row.reason}</p>}
                                <p className="text-xs tabular-nums text-muted-foreground">{dateTime(row.created_at)}</p>
                                {usage && <p className="text-xs tabular-nums text-muted-foreground">{kg(usage.meters)} m · {kg(usage.kgPer100m)} {text.per100}</p>}
                                {row.challan_id && <Link className="text-xs font-semibold text-ink underline" href={`/owner/dispatches/${row.challan_id}/print`}>{text.viewDispatch}</Link>}
                            </div>
                            <div className="text-right">
                                <SignedQuantity value={Number(row.kg_delta)} unit="kg" format={kg2} />
                                <p className="text-xs tabular-nums text-muted-foreground">{text.balance}: {kg2(row.balance_after)} kg</p>
                            </div>
                        </li>
                    })}</ol>}
                    {data.nextCursor && <div className="py-3 text-center"><Button variant="outline" disabled={busy} onClick={() => void load(data.as_of ?? '', filter, true)} className={secondaryAction}>{text.more}</Button></div>}
                </div>
                <div className="flex justify-end border-t border-hairline px-6 py-3.5">
                    <Button variant="outline" onClick={() => setHistoryOpen(false)} className={secondaryAction}>{text.close}</Button>
                </div>
            </DialogContent>
        </Dialog>

        <Dialog open={Boolean(entry)} onOpenChange={value => { if (!value && !saving && !request) setEntry(null) }} {...surface.root}><DialogContent showCloseButton={false} data-i18n-skip="true" {...surface.content}><DialogHeader><DialogTitle>{entry?.kind === 'recipe' ? `${text.link} · ${entry.quality.quality_label}` : entry ? text[entry.kind] : ''}</DialogTitle><DialogDescription>{entry?.kind === 'recipe' ? text.formulaHelp : entry?.kind === 'opening' ? text.openingHelp : entry?.kind === 'correction' ? text.correctionHelp : text.receiptHelp}</DialogDescription></DialogHeader>
            <form data-stock-tour={entry?.kind === 'recipe' ? 'link' : entry?.kind} className="space-y-4" onSubmit={e => { e.preventDefault(); void save() }}>
                {entry?.kind === 'recipe' ? <><Label htmlFor="yarn-costing">{text.costing}</Label><select id="yarn-costing" className="w-full rounded-md border bg-background p-2" value={costing} disabled={Boolean(request)} onChange={e => setCosting(e.target.value)} required><option value="">{text.choose}</option>{options.map(row => <option key={row.id} value={row.id}>{row.quality_label} · v{row.version_number} · {dateTime(row.saved_at)}</option>)}</select>{options.length === 0 && <p className="text-sm text-[var(--wv-ochre-800)]">{text.noCostings} <Link className="underline" href="/owner/estimator">{text.costing}</Link></p>}{selected && <ul className="text-sm">{selected.recipe.map((row, index) => <li key={index}>{row.yarn_name} · {text[row.role]} · {kg(row.kg_per_100m)} {text.per100}</li>)}</ul>}</>
                    : <><div className="space-y-2"><Label htmlFor="yarn-name">{text.name}</Label><Input id="yarn-name" list="known-yarns" value={name} disabled={Boolean(request) || Boolean(entry && 'yarn' in entry && entry.yarn)} onChange={e => setName(e.target.value)} maxLength={160} required /><datalist id="known-yarns">{names.map(value => <option key={value} value={value} />)}</datalist></div><div className="space-y-2"><Label htmlFor="yarn-weight">{text.weight}</Label><Input id="yarn-weight" type="number" inputMode="decimal" min={entry?.kind === 'receipt' ? '0.001' : '0'} max="100000000" step="0.001" value={weight} disabled={Boolean(request)} onChange={e => setWeight(e.target.value)} required /></div></>}
                <div className="space-y-2"><Label htmlFor="yarn-reason">{entry?.kind === 'recipe' ? text.formulaReason : text.reason}</Label><textarea id="yarn-reason" className="min-h-20 w-full rounded-md border bg-background p-3 text-sm" value={reason} disabled={Boolean(request)} onChange={e => setReason(e.target.value)} minLength={3} maxLength={500} required /></div>
                {saveError && <p role="alert" className="text-sm text-[var(--wv-madder-600)]">{saveError}</p>}{request && !saving && <p className="text-xs text-muted-foreground">{text.retrySame}</p>}
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={saving || Boolean(request)} onClick={() => setEntry(null)}>{text.close}</Button><Button type="submit" disabled={saving || (entry?.kind === 'recipe' && !costing)}>{saving ? text.saving : request ? text.retry : text.save}</Button></div>
            </form>
        </DialogContent></Dialog>
    </div>
}
