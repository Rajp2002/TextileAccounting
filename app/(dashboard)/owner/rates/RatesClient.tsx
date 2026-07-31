'use client'

import { useMemo, useState, useTransition } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
    AlertTriangle,
    Archive,
    CalendarClock,
    CheckCircle2,
    CircleDollarSign,
    Clock3,
    History,
    Info,
    Loader2,
    Pencil,
    Plus,
    Search,
    Tags,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import {
    archiveCostRate,
    getCostRateHistory,
    saveCostRate,
    type CostRateCategory,
    type CostRateInput,
} from './actions'
import {
    COST_RATE_CATEGORY_LABELS,
    filterCostRates,
    formatRateValue,
    getRateReviewDueDate,
    getRateReviewStatus,
    type CostRateRow,
    type RateReviewStatus,
} from '@/lib/cost-rates'
import {
    normalizeYarnName,
    type YarnRateConflict,
} from '@/lib/yarn-rate-reconciliation'

type YarnRateCategory = Extract<CostRateCategory, 'yarn_warp' | 'yarn_weft'>
type RateHistoryRow = {
    id: string
    value: number
    effective_date: string
    source: string | null
    notes: string | null
    created_at: string
}

const YARN_CATEGORIES: YarnRateCategory[] = ['yarn_warp', 'yarn_weft']

function today() {
    return new Date().toISOString().slice(0, 10)
}

function defaultDraft(reviewIntervalDays: number, category: YarnRateCategory = 'yarn_warp'): CostRateInput {
    return {
        name: '',
        category,
        unit: 'per_kg',
        currentValue: 0,
        effectiveDate: today(),
        lastReviewedAt: today(),
        reviewIntervalDays,
        source: '',
        notes: '',
        applyAsDefault: false,
    }
}

function rowToDraft(rate: CostRateRow): CostRateInput {
    return {
        id: rate.id,
        expectedUpdatedAt: rate.updated_at,
        name: rate.name,
        category: rate.category,
        unit: rate.unit,
        currentValue: Number(rate.current_value),
        effectiveDate: rate.effective_date,
        lastReviewedAt: rate.last_reviewed_at,
        reviewIntervalDays: Number(rate.review_interval_days),
        source: rate.source ?? '',
        notes: rate.notes ?? '',
        applyAsDefault: rate.apply_as_default,
    }
}

function ReviewBadge({ rate }: { rate: CostRateRow }) {
    const status = getRateReviewStatus(rate)
    const due = format(getRateReviewDueDate(rate), 'd MMM yyyy')
    if (status === 'overdue') return <div><span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-1 text-xs font-bold text-red-700"><Clock3 className="h-3 w-3" /> Review overdue</span><p className="mt-1 text-[11px] text-red-600">Due {due}</p></div>
    if (status === 'due_soon') return <div><span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700"><CalendarClock className="h-3 w-3" /> Review due</span><p className="mt-1 text-[11px] text-amber-700">Due {due}</p></div>
    return <div><span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Current</span><p className="mt-1 text-[11px] text-slate-500">Next review {due}</p></div>
}

export default function RatesClient({
    initialRates,
    initialConflicts,
    defaultReviewIntervalDays,
}: {
    initialRates: CostRateRow[]
    initialConflicts: YarnRateConflict[]
    defaultReviewIntervalDays: number
}) {
    const [rates, setRates] = useState(initialRates)
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState<YarnRateCategory | 'all'>('all')
    const [reviewStatus, setReviewStatus] = useState<RateReviewStatus | 'all'>('all')
    const [draft, setDraft] = useState<CostRateInput | null>(null)
    const [historyRate, setHistoryRate] = useState<CostRateRow | null>(null)
    const [historyRows, setHistoryRows] = useState<RateHistoryRow[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [archiveRate, setArchiveRate] = useState<CostRateRow | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [conflicts, setConflicts] = useState(initialConflicts)
    const [showConflicts, setShowConflicts] = useState(initialConflicts.length > 0)
    const [isPending, startTransition] = useTransition()

    const yarnRates = useMemo(
        () => rates.filter(rate => YARN_CATEGORIES.includes(rate.category as YarnRateCategory)),
        [rates],
    )
    const visibleRates = useMemo(() => filterCostRates(yarnRates, { query, category, status: reviewStatus }), [category, query, reviewStatus, yarnRates])
    const hasActiveFilters = Boolean(query.trim()) || category !== 'all' || reviewStatus !== 'all'
    const dueCount = yarnRates.filter(rate => getRateReviewStatus(rate) !== 'current').length
    const mostRecentReview = yarnRates.length
        ? yarnRates.reduce((latest, rate) => rate.last_reviewed_at > latest ? rate.last_reviewed_at : latest, yarnRates[0].last_reviewed_at)
        : null

    const updateDraft = <K extends keyof CostRateInput>(key: K, value: CostRateInput[K]) => {
        if (saveError) setSaveError(null)
        setDraft(current => current ? { ...current, [key]: value } : current)
    }

    const changeCategory = (value: YarnRateCategory) => {
        setDraft(current => current ? { ...current, category: value, unit: 'per_kg' } : current)
    }

    const handleSave = () => {
        if (!draft) return
        startTransition(async () => {
            const result = await saveCostRate(draft)
            if (result.error || !result.data) {
                setSaveError(result.error ?? 'Rate could not be saved.')
                return
            }
            const savedRate = result.data as CostRateRow
            setRates(current => {
                const next = current.filter(rate => rate.id !== savedRate.id)
                return [...next, savedRate]
            })
            const savedYarnName = normalizeYarnName(draft.name)
            if (draft.category === 'yarn_warp' || draft.category === 'yarn_weft') {
                setConflicts(current => current.filter(conflict => conflict.normalizedName !== savedYarnName))
            }
            setSaveError(null)
            if (result.syncedQualityCount) {
                toast.success(`Rate saved and updated in ${result.syncedQualityCount} saved ${result.syncedQualityCount === 1 ? 'quality' : 'qualities'}. Saved costings were not changed.`)
            } else {
                toast.success(draft.id ? 'Rate updated. Saved costings were not changed.' : 'Rate added for new costings.')
            }
            setDraft(null)
        })
    }

    const editConflict = (conflict: YarnRateConflict) => {
        const rate = rates.find(candidate =>
            (candidate.category === 'yarn_warp' || candidate.category === 'yarn_weft')
            && normalizeYarnName(candidate.name) === conflict.normalizedName
        )
        if (!rate) {
            toast.error('The discovered yarn rate is still loading. Refresh and try again.')
            return
        }
        setDraft({
            ...rowToDraft(rate),
            source: 'Manually resolved in Yarn Rate Book',
            notes: `Unified ${conflict.yarnName} across ${new Set(conflict.usages.map(usage => usage.templateId)).size} saved qualities.`,
        })
        setShowConflicts(false)
    }

    const openHistory = async (rate: CostRateRow) => {
        setHistoryRate(rate)
        setHistoryRows([])
        setHistoryLoading(true)
        const result = await getCostRateHistory(rate.id)
        setHistoryLoading(false)
        if (result.error) {
            toast.error(result.error)
            return
        }
        setHistoryRows((result.data ?? []) as RateHistoryRow[])
    }

    const handleArchive = () => {
        if (!archiveRate) return
        startTransition(async () => {
            const result = await archiveCostRate(archiveRate.id)
            if (result.error) {
                toast.error(result.error)
                return
            }
            setRates(current => current.filter(rate => rate.id !== archiveRate.id))
            toast.success('Rate archived. Historical costings remain unchanged.')
            setArchiveRate(null)
        })
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950"><Tags className="h-6 w-6 text-orange-600" /> Yarn Rate Book</h1>
                    <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">Keep one current rate for every yarn used across your saved qualities and costings. Linked yarn names are immutable in place: add a replacement rate, then update saved qualities deliberately. Historical costing snapshots stay unchanged.</p>
                </div>
                <Button onClick={() => { setSaveError(null); setDraft(defaultDraft(defaultReviewIntervalDays)) }} className="h-11 bg-orange-600 text-white hover:bg-orange-700"><Plus className="h-4 w-4" /> Add Yarn Rate</Button>
            </div>

            {conflicts.length > 0 && (
                <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                            <p className="text-sm font-bold">Different rates found for {conflicts.length} {conflicts.length === 1 ? 'yarn' : 'yarns'}.</p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800">Choose one current rate for each yarn. Saving it will update every saved quality that uses that yarn.</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowConflicts(true)} className="shrink-0 border-amber-400 bg-white text-amber-900 hover:bg-amber-100">Review conflicts</Button>
                </div>
            )}

            <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
                    <div className="flex items-center gap-3 sm:px-3"><span className="rounded-full bg-blue-50 p-3 text-blue-700"><CircleDollarSign className="h-5 w-5" /></span><div><p className="text-2xl font-black text-blue-700">{yarnRates.length}</p><p className="text-sm text-slate-600">active yarn rates</p></div></div>
                    <div className="flex items-center gap-3 sm:px-6"><span className="rounded-full bg-amber-50 p-3 text-amber-700"><CalendarClock className="h-5 w-5" /></span><div><p className="text-2xl font-black text-orange-600">{dueCount}</p><p className="text-sm text-slate-600">due for review</p></div></div>
                    <div className="flex items-center gap-3 sm:px-6"><span className="rounded-full bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Last reviewed</p><p className="mt-1 text-base font-bold text-slate-950">{mostRecentReview ? format(new Date(`${mostRecentReview}T00:00:00`), 'd MMM yyyy') : 'Not reviewed'}</p></div></div>
                </CardContent>
            </Card>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4">
                    <p className="font-bold text-slate-950">Yarn rates</p>
                    <p className="mt-1 text-xs text-slate-500">Rates appear automatically after you save a quality or costing with warp and weft yarn layers.</p>
                </div>

                <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search yarn rates…" className="h-10 pl-9" /></div>
                    <select aria-label="Filter yarn rates by use" value={category} onChange={event => setCategory(event.target.value as YarnRateCategory | 'all')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="all">All yarns</option>{YARN_CATEGORIES.map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select>
                    <select aria-label="Filter rates by review status" value={reviewStatus} onChange={event => setReviewStatus(event.target.value as RateReviewStatus | 'all')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="all">Review status</option><option value="current">Current</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option></select>
                </div>

                {visibleRates.length === 0 ? (
                    <div className="px-6 py-14 text-center"><Tags className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-700">{yarnRates.length === 0 ? 'No yarn rates yet' : 'No matching yarn rates'}</p><p className="mt-1 text-sm text-slate-500">{yarnRates.length === 0 ? 'Save a quality or costing and its yarn rates will appear here automatically.' : hasActiveFilters ? 'Clear or adjust the filters to see more yarn rates.' : 'Add a yarn rate to continue.'}</p></div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Yarn / Use</th><th className="px-4 py-3">Current value</th><th className="px-4 py-3">Previous value</th><th className="px-4 py-3">Effective date</th><th className="px-4 py-3">Review status</th><th className="px-4 py-3">Source / Notes</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">{visibleRates.map(rate => { const reviewState = getRateReviewStatus(rate); return <tr key={rate.id} className={reviewState === 'overdue' ? 'bg-red-50/70 hover:bg-red-50' : reviewState === 'due_soon' ? 'bg-amber-50/70 hover:bg-amber-50' : 'hover:bg-slate-50/70'}><td className="px-4 py-4"><p className="font-bold text-slate-950">{rate.name}</p><p className="mt-1 text-xs text-slate-500">{COST_RATE_CATEGORY_LABELS[rate.category]}</p></td><td className="px-4 py-4"><p className="font-mono font-bold text-slate-900">{formatRateValue(rate.current_value, rate.unit)}</p>{rate.apply_as_default && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Default for new costings</p>}</td><td className="px-4 py-4 font-mono text-sm text-slate-600">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</td><td className="px-4 py-4 text-sm text-slate-600">{format(new Date(`${rate.effective_date}T00:00:00`), 'd MMM yyyy')}</td><td className="px-4 py-4"><ReviewBadge rate={rate} /></td><td className="max-w-[220px] px-4 py-4"><p className="truncate text-sm font-medium text-slate-800">{rate.source || 'No source'}</p><p className="mt-1 truncate text-xs text-slate-500">{rate.notes || 'No notes'}</p></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => { setSaveError(null); setDraft(rowToDraft(rate)) }}><Pencil className="h-3.5 w-3.5" /> Edit</Button><Button variant="ghost" size="sm" onClick={() => openHistory(rate)}><History className="h-3.5 w-3.5" /> History</Button><Button variant="ghost" size="icon" aria-label={`Archive ${rate.name}`} onClick={() => setArchiveRate(rate)} className="text-slate-500"><Archive className="h-4 w-4" /></Button></div></td></tr> })}</tbody>
                            </table>
                        </div>
                        <div className="space-y-3 p-3 md:hidden">{visibleRates.map(rate => { const reviewState = getRateReviewStatus(rate); return <Card key={rate.id} className={reviewState === 'overdue' ? 'border-red-300 bg-red-50/70' : reviewState === 'due_soon' ? 'border-amber-300 bg-amber-50/70' : 'border-slate-200'}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{rate.name}</p><p className="mt-1 text-xs text-slate-500">{COST_RATE_CATEGORY_LABELS[rate.category]}</p></div><ReviewBadge rate={rate} /></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-white/70 p-3"><div><p className="text-[10px] font-bold uppercase text-slate-500">Current</p><p className="mt-1 font-mono font-bold">{formatRateValue(rate.current_value, rate.unit)}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-500">Previous</p><p className="mt-1 font-mono font-semibold text-slate-600">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setDraft(rowToDraft(rate))}><Pencil className="h-4 w-4" /> Edit</Button><Button variant="outline" onClick={() => openHistory(rate)}><History className="h-4 w-4" /> History</Button><Button variant="outline" className="col-span-2" aria-label={`Archive ${rate.name}`} onClick={() => setArchiveRate(rate)}><Archive className="h-4 w-4" /> Archive rate</Button></div></CardContent></Card> })}</div>
                    </>
                )}
            </div>

            <Dialog open={showConflicts && conflicts.length > 0} onOpenChange={setShowConflicts}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Choose one rate for each yarn</DialogTitle>
                        <DialogDescription>We found the same yarn at different rates in your saved qualities. Edit each yarn once; the chosen rate will then pre-populate every matching warp or weft layer.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        {conflicts.map(conflict => {
                            const qualityCount = new Set(conflict.usages.map(usage => usage.templateId)).size
                            return (
                                <div key={conflict.normalizedName} className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-bold text-slate-950">{conflict.yarnName}</p>
                                            <p className="mt-1 text-xs text-slate-600">Used in {qualityCount} saved {qualityCount === 1 ? 'quality' : 'qualities'} · found {conflict.rates.map(rate => `₹${rate}/kg`).join(' and ')}</p>
                                        </div>
                                        <Button size="sm" onClick={() => editConflict(conflict)} className="shrink-0 bg-amber-700 text-white hover:bg-amber-800"><Pencil className="h-3.5 w-3.5" /> Edit rate</Button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {conflict.usages.slice(0, 6).map(usage => (
                                            <span key={`${usage.templateId}-${usage.layer}-${usage.layerNumber}`} className="rounded-full border border-amber-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                                                {usage.templateName} · {usage.layer} {usage.layerNumber} · ₹{usage.rate}
                                            </span>
                                        ))}
                                        {conflict.usages.length > 6 && <span className="px-2 py-1 text-[11px] text-slate-500">+{conflict.usages.length - 6} more</span>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                    <DialogFooter><Button variant="outline" onClick={() => setShowConflicts(false)}>Review later</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(draft)} onOpenChange={open => { if (!open) setDraft(null) }}>
                    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle className="text-xl font-black">{draft?.id ? `Update ${draft.name}` : 'Add Yarn Rate'}</SheetTitle><SheetDescription>Maintain the current rate used by matching saved quality layers.</SheetDescription></SheetHeader>
                    {draft && <div className="space-y-5 px-6 py-2">
                        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800"><Info className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Saved costings will not change.</p><p className="mt-1 text-xs leading-relaxed">This yarn rate will be pre-populated into every saved quality with the same yarn name. Historical costing snapshots stay unchanged.</p></div></div>
                        <div className="space-y-1.5"><Label htmlFor="cost-rate-name">Yarn name</Label><Input id="cost-rate-name" value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. 30/1000 MUALTI" maxLength={120} disabled={Boolean(draft.id)} aria-invalid={Boolean(saveError)} aria-describedby={saveError ? 'cost-rate-save-error' : undefined} />{Boolean(draft.id) && <p className="text-xs leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">Linked-yarn rename policy:</span> this name is locked in place. To rename it, add a new rate with the replacement name and update saved qualities intentionally. Historical costing snapshots stay unchanged.</p>}{saveError && <p id="cost-rate-save-error" role="alert" className="text-xs font-medium text-destructive">{saveError}</p>}</div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Used in</Label><select value={draft.category} onChange={event => changeCategory(event.target.value as YarnRateCategory)} disabled={Boolean(draft.id)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100">{YARN_CATEGORIES.map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select></div><div className="space-y-1.5"><Label>Unit</Label><Input value="₹ per kg" disabled className="bg-slate-100" /></div></div>
                        <div className="space-y-1.5"><Label>New rate</Label><Input type="number" min="0" step="0.01" value={draft.currentValue} onChange={event => updateDraft('currentValue', Number(event.target.value))} className="font-mono" /></div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Effective date</Label><Input type="date" value={draft.effectiveDate} onChange={event => updateDraft('effectiveDate', event.target.value)} /></div><div className="space-y-1.5"><Label>Reviewed on</Label><Input type="date" value={draft.lastReviewedAt} onChange={event => updateDraft('lastReviewedAt', event.target.value)} /></div></div>
                        <div className="space-y-1.5"><Label>Source</Label><Input value={draft.source} onChange={event => updateDraft('source', event.target.value)} placeholder="Supplier quote, email, internal rate card…" /></div>
                        <div className="space-y-1.5"><Label>Notes</Label><Textarea value={draft.notes} onChange={event => updateDraft('notes', event.target.value)} placeholder="Why this rate changed or how it should be used" maxLength={500} /><p className="text-right text-xs text-slate-400">{draft.notes?.length ?? 0}/500</p></div>
                        <div className="space-y-1.5"><Label>Review every</Label><select value={draft.reviewIntervalDays} onChange={event => updateDraft('reviewIntervalDays', Number(event.target.value))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="30">30 days</option><option value="60">60 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">12 months</option></select></div>
                    </div>}
                    <SheetFooter className="border-t border-slate-200 p-6 sm:flex-row"><Button variant="outline" onClick={() => setDraft(null)} className="flex-1">Cancel</Button><Button onClick={handleSave} disabled={isPending || !draft?.name.trim()} className="flex-1 bg-orange-600 text-white hover:bg-orange-700">{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Yarn Rate</Button></SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog open={Boolean(historyRate)} onOpenChange={open => { if (!open) setHistoryRate(null) }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /> {historyRate?.name} history</DialogTitle><DialogDescription>Every reviewed value is preserved for audit. Existing saved costings retain their own snapshots.</DialogDescription></DialogHeader>{historyLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-600" /></div> : historyRows.length ? <div className="max-h-[420px] space-y-3 overflow-y-auto">{historyRows.map(row => <div key={row.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between"><p className="font-mono text-base font-black text-slate-950">{historyRate ? formatRateValue(row.value, historyRate.unit) : row.value}</p><p className="text-xs text-slate-500">Effective {format(new Date(`${row.effective_date}T00:00:00`), 'd MMM yyyy')}</p></div><p className="mt-2 text-sm font-medium text-slate-700">{row.source || 'No source recorded'}</p>{row.notes && <p className="mt-1 text-xs text-slate-500">{row.notes}</p>}</div>)}</div> : <div className="py-10 text-center text-sm text-slate-500">No recorded changes yet.</div>}<DialogFooter><Button variant="outline" onClick={() => setHistoryRate(null)}>Close</Button></DialogFooter></DialogContent></Dialog>

            <Dialog open={Boolean(archiveRate)} onOpenChange={open => { if (!open) setArchiveRate(null) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Archive {archiveRate?.name}?</DialogTitle><DialogDescription>The yarn will stop appearing in the rate book. Saved quality and costing snapshots remain unchanged.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setArchiveRate(null)}>Cancel</Button><Button variant="destructive" onClick={handleArchive} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Archive Yarn Rate</Button></DialogFooter></DialogContent></Dialog>
        </div>
    )
}
