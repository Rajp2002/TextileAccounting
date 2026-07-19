'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
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
import { Checkbox } from '@/components/ui/checkbox'
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
    type CostRateUnit,
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

type RateTab = 'yarn' | 'processing' | 'commercial'
type RateHistoryRow = {
    id: string
    value: number
    effective_date: string
    source: string | null
    notes: string | null
    created_at: string
}

const TAB_CATEGORIES: Record<RateTab, CostRateCategory[]> = {
    yarn: ['yarn_warp', 'yarn_weft'],
    processing: ['warping', 'sizing', 'winding', 'processing', 'finishing'],
    commercial: ['transport', 'commission', 'overhead'],
}

function today() {
    return new Date().toISOString().slice(0, 10)
}

function defaultDraft(category: CostRateCategory = 'yarn_warp'): CostRateInput {
    return {
        name: '',
        category,
        unit: category === 'commission' || category === 'overhead' ? 'percent' : category === 'processing' || category === 'finishing' || category === 'transport' ? 'per_m' : 'per_kg',
        currentValue: 0,
        effectiveDate: today(),
        lastReviewedAt: today(),
        reviewIntervalDays: 90,
        source: '',
        notes: '',
        applyAsDefault: true,
    }
}

function rowToDraft(rate: CostRateRow): CostRateInput {
    return {
        id: rate.id,
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

export default function RatesClient({ initialRates }: { initialRates: CostRateRow[] }) {
    const router = useRouter()
    const [rates, setRates] = useState(initialRates)
    const [activeTab, setActiveTab] = useState<RateTab>('yarn')
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState<CostRateCategory | 'all'>('all')
    const [reviewStatus, setReviewStatus] = useState<RateReviewStatus | 'all'>('all')
    const [draft, setDraft] = useState<CostRateInput | null>(null)
    const [historyRate, setHistoryRate] = useState<CostRateRow | null>(null)
    const [historyRows, setHistoryRows] = useState<RateHistoryRow[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [archiveRate, setArchiveRate] = useState<CostRateRow | null>(null)
    const [isPending, startTransition] = useTransition()

    const tabRates = rates.filter(rate => TAB_CATEGORIES[activeTab].includes(rate.category))
    const visibleRates = useMemo(() => filterCostRates(tabRates, { query, category, status: reviewStatus }), [category, query, reviewStatus, tabRates])
    const dueCount = rates.filter(rate => getRateReviewStatus(rate) !== 'current').length
    const mostRecentReview = rates.length
        ? rates.reduce((latest, rate) => rate.last_reviewed_at > latest ? rate.last_reviewed_at : latest, rates[0].last_reviewed_at)
        : null

    const updateDraft = <K extends keyof CostRateInput>(key: K, value: CostRateInput[K]) => {
        setDraft(current => current ? { ...current, [key]: value } : current)
    }

    const changeCategory = (value: CostRateCategory) => {
        const unit: CostRateUnit = value === 'commission' || value === 'overhead'
            ? 'percent'
            : value === 'processing' || value === 'finishing' || value === 'transport'
                ? 'per_m'
                : 'per_kg'
        setDraft(current => current ? { ...current, category: value, unit } : current)
    }

    const handleSave = () => {
        if (!draft) return
        startTransition(async () => {
            const result = await saveCostRate(draft)
            if (result.error || !result.data) {
                toast.error(result.error ?? 'Rate could not be saved.')
                return
            }
            setRates(current => {
                const next = current.filter(rate => rate.id !== result.data.id)
                return [...next, result.data as CostRateRow]
            })
            toast.success(draft.id ? 'Rate updated. Saved costings were not changed.' : 'Rate added for new costings.')
            setDraft(null)
        })
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
                    <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950"><Tags className="h-6 w-6 text-orange-600" /> Rates &amp; Qualities</h1>
                    <p className="mt-1 text-sm font-medium text-slate-500">Keep costing assumptions current without changing saved snapshots.</p>
                </div>
                <Button onClick={() => setDraft(defaultDraft(TAB_CATEGORIES[activeTab][0]))} className="h-11 bg-orange-600 text-white hover:bg-orange-700"><Plus className="h-4 w-4" /> Add Rate</Button>
            </div>

            <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
                    <div className="flex items-center gap-3 sm:px-3"><span className="rounded-full bg-blue-50 p-3 text-blue-700"><CircleDollarSign className="h-5 w-5" /></span><div><p className="text-2xl font-black text-blue-700">{rates.length}</p><p className="text-sm text-slate-600">active rates</p></div></div>
                    <div className="flex items-center gap-3 sm:px-6"><span className="rounded-full bg-amber-50 p-3 text-amber-700"><CalendarClock className="h-5 w-5" /></span><div><p className="text-2xl font-black text-orange-600">{dueCount}</p><p className="text-sm text-slate-600">due for review</p></div></div>
                    <div className="flex items-center gap-3 sm:px-6"><span className="rounded-full bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Last reviewed</p><p className="mt-1 text-base font-bold text-slate-950">{mostRecentReview ? format(new Date(`${mostRecentReview}T00:00:00`), 'd MMM yyyy') : 'Not reviewed'}</p></div></div>
                </CardContent>
            </Card>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex overflow-x-auto border-b border-slate-200 px-3">
                    {([
                        ['yarn', 'Yarn Rates'],
                        ['processing', 'Processing'],
                        ['commercial', 'Commercial Defaults'],
                    ] as const).map(([value, label]) => (
                        <button key={value} onClick={() => { setActiveTab(value); setCategory('all') }} className={`min-h-14 whitespace-nowrap border-b-2 px-5 text-sm font-bold ${activeTab === value ? 'border-orange-600 text-orange-700' : 'border-transparent text-slate-600 hover:text-slate-950'}`}>{label}</button>
                    ))}
                    <button onClick={() => router.push('/owner/quotes')} className="min-h-14 whitespace-nowrap border-b-2 border-transparent px-5 text-sm font-bold text-slate-600 hover:text-slate-950">Saved Qualities</button>
                </div>

                <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_220px_180px]">
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search rates…" className="h-10 pl-9" /></div>
                    <select aria-label="Filter rates by category" value={category} onChange={event => setCategory(event.target.value as CostRateCategory | 'all')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="all">All categories</option>{TAB_CATEGORIES[activeTab].map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select>
                    <select aria-label="Filter rates by review status" value={reviewStatus} onChange={event => setReviewStatus(event.target.value as RateReviewStatus | 'all')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="all">Review status</option><option value="current">Current</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option></select>
                </div>

                {visibleRates.length === 0 ? (
                    <div className="px-6 py-14 text-center"><Tags className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-700">No matching rates</p><p className="mt-1 text-sm text-slate-500">Add a rate or clear the filters to continue.</p></div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Rate / Category</th><th className="px-4 py-3">Current value</th><th className="px-4 py-3">Previous value</th><th className="px-4 py-3">Effective date</th><th className="px-4 py-3">Review status</th><th className="px-4 py-3">Source / Notes</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">{visibleRates.map(rate => <tr key={rate.id} className="hover:bg-slate-50/70"><td className="px-4 py-4"><p className="font-bold text-slate-950">{rate.name}</p><p className="mt-1 text-xs text-slate-500">{COST_RATE_CATEGORY_LABELS[rate.category]}</p></td><td className="px-4 py-4"><p className="font-mono font-bold text-slate-900">{formatRateValue(rate.current_value, rate.unit)}</p>{rate.apply_as_default && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Default for new costings</p>}</td><td className="px-4 py-4 font-mono text-sm text-slate-600">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</td><td className="px-4 py-4 text-sm text-slate-600">{format(new Date(`${rate.effective_date}T00:00:00`), 'd MMM yyyy')}</td><td className="px-4 py-4"><ReviewBadge rate={rate} /></td><td className="max-w-[220px] px-4 py-4"><p className="truncate text-sm font-medium text-slate-800">{rate.source || 'No source'}</p><p className="mt-1 truncate text-xs text-slate-500">{rate.notes || 'No notes'}</p></td><td className="px-4 py-4"><div className="flex justify-end gap-1"><Button variant="outline" size="sm" onClick={() => setDraft(rowToDraft(rate))}><Pencil className="h-3.5 w-3.5" /> Edit</Button><Button variant="ghost" size="sm" onClick={() => openHistory(rate)}><History className="h-3.5 w-3.5" /> History</Button><Button variant="ghost" size="icon" aria-label={`Archive ${rate.name}`} onClick={() => setArchiveRate(rate)} className="text-slate-500"><Archive className="h-4 w-4" /></Button></div></td></tr>)}</tbody>
                            </table>
                        </div>
                        <div className="space-y-3 p-3 md:hidden">{visibleRates.map(rate => <Card key={rate.id} className="border-slate-200"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{rate.name}</p><p className="mt-1 text-xs text-slate-500">{COST_RATE_CATEGORY_LABELS[rate.category]}</p></div><ReviewBadge rate={rate} /></div><div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3"><div><p className="text-[10px] font-bold uppercase text-slate-500">Current</p><p className="mt-1 font-mono font-bold">{formatRateValue(rate.current_value, rate.unit)}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-500">Previous</p><p className="mt-1 font-mono font-semibold text-slate-600">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => setDraft(rowToDraft(rate))}><Pencil className="h-4 w-4" /> Edit</Button><Button variant="outline" onClick={() => openHistory(rate)}><History className="h-4 w-4" /> History</Button></div></CardContent></Card>)}</div>
                    </>
                )}
            </div>

            <Sheet open={Boolean(draft)} onOpenChange={open => { if (!open) setDraft(null) }}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle className="text-xl font-black">{draft?.id ? `Update ${draft.name}` : 'Add Cost Rate'}</SheetTitle><SheetDescription>Maintain reviewed defaults for future estimates.</SheetDescription></SheetHeader>
                    {draft && <div className="space-y-5 px-6 py-2">
                        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800"><Info className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Saved costings will not change.</p><p className="mt-1 text-xs leading-relaxed">This update applies only to new costings that use this rate as a default.</p></div></div>
                        <div className="space-y-1.5"><Label>Rate name</Label><Input value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. 75D Polyester" maxLength={120} /></div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Category</Label><select value={draft.category} onChange={event => changeCategory(event.target.value as CostRateCategory)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm">{Object.entries(COST_RATE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-1.5"><Label>Unit</Label><select value={draft.unit} onChange={event => updateDraft('unit', event.target.value as CostRateUnit)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="per_kg">₹ per kg</option><option value="per_m">₹ per metre</option><option value="percent">Percent</option></select></div></div>
                        <div className="space-y-1.5"><Label>New rate</Label><Input type="number" min="0" step="0.01" value={draft.currentValue} onChange={event => updateDraft('currentValue', Number(event.target.value))} className="font-mono" /></div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Effective date</Label><Input type="date" value={draft.effectiveDate} onChange={event => updateDraft('effectiveDate', event.target.value)} /></div><div className="space-y-1.5"><Label>Reviewed on</Label><Input type="date" value={draft.lastReviewedAt} onChange={event => updateDraft('lastReviewedAt', event.target.value)} /></div></div>
                        <div className="space-y-1.5"><Label>Source</Label><Input value={draft.source} onChange={event => updateDraft('source', event.target.value)} placeholder="Supplier quote, email, internal rate card…" /></div>
                        <div className="space-y-1.5"><Label>Notes</Label><Textarea value={draft.notes} onChange={event => updateDraft('notes', event.target.value)} placeholder="Why this rate changed or how it should be used" maxLength={500} /><p className="text-right text-xs text-slate-400">{draft.notes?.length ?? 0}/500</p></div>
                        <div className="space-y-1.5"><Label>Review every</Label><select value={draft.reviewIntervalDays} onChange={event => updateDraft('reviewIntervalDays', Number(event.target.value))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="30">30 days</option><option value="60">60 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">12 months</option></select></div>
                        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4"><Checkbox checked={draft.applyAsDefault} onCheckedChange={checked => updateDraft('applyAsDefault', checked === true)} /><span><span className="block text-sm font-bold text-slate-900">Apply as default for new costings</span><span className="mt-1 block text-xs text-slate-500">The estimator will use this value when a new costing starts.</span></span></label>
                    </div>}
                    <SheetFooter className="border-t border-slate-200 p-6 sm:flex-row"><Button variant="outline" onClick={() => setDraft(null)} className="flex-1">Cancel</Button><Button onClick={handleSave} disabled={isPending || !draft?.name.trim()} className="flex-1 bg-orange-600 text-white hover:bg-orange-700">{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save Rate</Button></SheetFooter>
                </SheetContent>
            </Sheet>

            <Dialog open={Boolean(historyRate)} onOpenChange={open => { if (!open) setHistoryRate(null) }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /> {historyRate?.name} history</DialogTitle><DialogDescription>Every reviewed value is preserved for audit. Existing saved costings retain their own snapshots.</DialogDescription></DialogHeader>{historyLoading ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-orange-600" /></div> : historyRows.length ? <div className="max-h-[420px] space-y-3 overflow-y-auto">{historyRows.map(row => <div key={row.id} className="rounded-lg border border-slate-200 p-4"><div className="flex items-start justify-between"><p className="font-mono text-base font-black text-slate-950">{historyRate ? formatRateValue(row.value, historyRate.unit) : row.value}</p><p className="text-xs text-slate-500">Effective {format(new Date(`${row.effective_date}T00:00:00`), 'd MMM yyyy')}</p></div><p className="mt-2 text-sm font-medium text-slate-700">{row.source || 'No source recorded'}</p>{row.notes && <p className="mt-1 text-xs text-slate-500">{row.notes}</p>}</div>)}</div> : <div className="py-10 text-center text-sm text-slate-500">No recorded changes yet.</div>}<DialogFooter><Button variant="outline" onClick={() => setHistoryRate(null)}>Close</Button></DialogFooter></DialogContent></Dialog>

            <Dialog open={Boolean(archiveRate)} onOpenChange={open => { if (!open) setArchiveRate(null) }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Archive {archiveRate?.name}?</DialogTitle><DialogDescription>The rate will stop appearing for new costings. Saved costing snapshots remain unchanged.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setArchiveRate(null)}>Cancel</Button><Button variant="destructive" onClick={handleArchive} disabled={isPending}>{isPending && <Loader2 className="h-4 w-4 animate-spin" />} Archive Rate</Button></DialogFooter></DialogContent></Dialog>
        </div>
    )
}
