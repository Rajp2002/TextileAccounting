'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    AlertTriangle,
    Archive,
    ArchiveRestore,
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
import { ArchivePolicyNotice } from '@/components/records/ArchivePolicyNotice'
import {
    archiveCostRate,
    confirmCostRateReview,
    getCostRateHistory,
    restoreCostRate,
    saveCostRate,
    type CostRateCategory,
    type CostRateInput,
} from './actions'
import {
    COST_RATE_CATEGORY_LABELS,
    filterCostRates,
    formatRateValue,
    getRateReviewDueDate,
    getRateHistoryEventLabel,
    getRateReviewStatus,
    type CostRateRow,
    type RateReviewStatus,
} from '@/lib/cost-rates'
import {
    normalizeYarnName,
    type YarnRateConflict,
} from '@/lib/yarn-rate-reconciliation'
import { parseNonNegativeInput } from '@/lib/numeric-input'
import { useTranslation } from '@/lib/i18n/context'
import { formatDateOnly } from '@/lib/format'
import { formatSuratDateTime, formatToSurat } from '@/lib/time'

type YarnRateCategory = Extract<CostRateCategory, 'yarn_warp' | 'yarn_weft'>
type RateHistoryRow = {
    id: string
    value: number
    previous_value: number | null
    event_type: 'recorded' | 'reviewed' | 'changed' | 'archived' | 'restored'
    effective_date: string
    source: string | null
    notes: string | null
    created_at: string
    changed_by: string | null
    actor_name: string | null
    actor_role: string | null
}

type PendingRateAction = {
    id: string
    kind: 'save' | 'review' | 'archive' | 'restore'
}

const YARN_CATEGORIES: YarnRateCategory[] = ['yarn_warp', 'yarn_weft']

function today() {
    return formatToSurat(new Date(), 'yyyy-MM-dd')
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
    if (status === 'needs_review') return <div><span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700"><Info className="h-3 w-3" /> Owner review needed</span><p className="mt-1 text-[11px] text-blue-700">Discovered from a saved quality or costing</p></div>
    const due = formatToSurat(getRateReviewDueDate(rate), 'd MMM yyyy')
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
    const { t, tx } = useTranslation()
    const [rates, setRates] = useState(initialRates)
    const [query, setQuery] = useState('')
    const [category, setCategory] = useState<YarnRateCategory | 'all'>('all')
    const [reviewStatus, setReviewStatus] = useState<RateReviewStatus | 'all'>('all')
    const [showArchived, setShowArchived] = useState(false)
    const [draft, setDraft] = useState<CostRateInput | null>(null)
    const [historyRate, setHistoryRate] = useState<CostRateRow | null>(null)
    const [historyRows, setHistoryRows] = useState<RateHistoryRow[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [reviewRate, setReviewRate] = useState<CostRateRow | null>(null)
    const [reviewError, setReviewError] = useState<string | null>(null)
    const [archiveRate, setArchiveRate] = useState<CostRateRow | null>(null)
    const [archiveError, setArchiveError] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [conflicts, setConflicts] = useState(initialConflicts)
    const [showConflicts, setShowConflicts] = useState(initialConflicts.length > 0)
    const [isPending, startTransition] = useTransition()
    const [pendingAction, setPendingAction] = useState<PendingRateAction | null>(null)

    const yarnRates = useMemo(
        () => rates.filter(rate => YARN_CATEGORIES.includes(rate.category as YarnRateCategory)),
        [rates],
    )
    const activeYarnRates = useMemo(() => yarnRates.filter(rate => rate.is_active !== false), [yarnRates])
    const visibleRates = useMemo(() => filterCostRates(yarnRates.filter(rate => Boolean(rate.is_active) === !showArchived), { query, category, status: reviewStatus }), [category, query, reviewStatus, showArchived, yarnRates])
    const hasActiveFilters = Boolean(query.trim()) || category !== 'all' || reviewStatus !== 'all' || showArchived
    const dueCount = activeYarnRates.filter(rate => getRateReviewStatus(rate) !== 'current').length
    const mostRecentReview = activeYarnRates.length
        ? activeYarnRates.reduce((latest, rate) => rate.last_reviewed_at > latest ? rate.last_reviewed_at : latest, activeYarnRates[0].last_reviewed_at)
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
        const target = draft
        setPendingAction({ id: target.id ?? 'new-rate', kind: 'save' })
        startTransition(async () => {
            try {
                const result = await saveCostRate(target)
                if (result.error || !result.data) {
                    setSaveError(result.error ?? 'Rate could not be saved.')
                    return
                }
                const savedRate = result.data as CostRateRow
                setRates(current => {
                    const next = current.filter(rate => rate.id !== savedRate.id)
                    return [...next, savedRate]
                })
                const savedYarnName = normalizeYarnName(target.name)
                if (target.category === 'yarn_warp' || target.category === 'yarn_weft') {
                    setConflicts(current => current.filter(conflict => conflict.normalizedName !== savedYarnName))
                }
                setSaveError(null)
                if (result.syncedQualityCount) {
                    toast.success(tx(`Rate saved and updated in ${result.syncedQualityCount} Saved ${result.syncedQualityCount === 1 ? 'Quality' : 'Qualities'}. Existing costing snapshots were not changed.`))
                } else {
                    toast.success(tx(target.id ? 'Rate updated. Existing costing snapshots were not changed.' : 'Rate added for future estimates.'))
                }
                setDraft(null)
            } catch (error) {
                const message = userFacingError(error, 'Rate could not be saved. Try again.')
                setSaveError(message)
                toast.error(tx(message))
            } finally {
                setPendingAction(null)
            }
        })
    }

    const handleConfirmReview = () => {
        if (!reviewRate) return
        const target = reviewRate
        setReviewError(null)
        setPendingAction({ id: target.id, kind: 'review' })
        startTransition(async () => {
            try {
                const result = await confirmCostRateReview(target.id, target.updated_at)
                if (result.error || !result.data) {
                    const message = tx(userFacingError(result.error, 'The current rate could not be confirmed. Try again.'))
                    setReviewError(message)
                    toast.error(message)
                    return
                }
                const savedRate = result.data as CostRateRow
                setRates(current => current.map(rate => rate.id === target.id
                    ? { ...rate, ...savedRate, is_reviewed: true }
                    : rate))
                toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Existing costing snapshots were not changed.`))
                setReviewRate(null)
            } catch (error) {
                const message = tx(userFacingError(error, 'The current rate could not be confirmed. Try again.'))
                setReviewError(message)
                toast.error(message)
            } finally {
                setPendingAction(null)
            }
        })
    }

    const editConflict = (conflict: YarnRateConflict) => {
        const rate = rates.find(candidate =>
            (candidate.category === 'yarn_warp' || candidate.category === 'yarn_weft')
            && normalizeYarnName(candidate.name) === conflict.normalizedName
        )
        if (!rate) {
            toast.error(tx('The discovered yarn rate is still loading. Refresh and try again.'))
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
        setHistoryError(null)
        setHistoryLoading(true)
        try {
            const result = await getCostRateHistory(rate.id)
            if (result.error) {
                const message = tx(userFacingError(result.error, 'Rate activity could not be loaded. Try again.'))
                setHistoryError(message)
                toast.error(message)
                return
            }
            setHistoryRows((result.data ?? []) as RateHistoryRow[])
        } catch (error) {
            const message = tx(userFacingError(error, 'Rate activity could not be loaded. Try again.'))
            setHistoryError(message)
            toast.error(message)
        } finally {
            setHistoryLoading(false)
        }
    }

    const handleArchive = () => {
        if (!archiveRate) return
        const target = archiveRate
        const restoring = target.is_active === false
        setArchiveError(null)
        setPendingAction({ id: target.id, kind: restoring ? 'restore' : 'archive' })
        startTransition(async () => {
            try {
                const result = restoring
                    ? await restoreCostRate(target.id, target.updated_at)
                    : await archiveCostRate(target.id, target.updated_at)
                if (result.error) {
                    const message = tx(userFacingError(result.error, 'The yarn rate could not be archived or restored. Try again.'))
                    setArchiveError(message)
                    toast.error(message)
                    return
                }
                setRates(current => current.map(rate => rate.id === target.id
                    ? { ...rate, is_active: result.isActive ?? restoring, updated_at: result.updatedAt ?? rate.updated_at }
                    : rate))
                toast.success(tx(restoring
                    ? 'Rate restored to the active Rate Book. Existing costing snapshots were not changed.'
                    : 'Rate archived from the active Rate Book. Saved Qualities and costing snapshots were not changed.'))
                setArchiveRate(null)
            } catch (error) {
                const message = tx(userFacingError(error, `Rate could not be ${restoring ? 'restored' : 'archived'}. Try again.`))
                setArchiveError(message)
                toast.error(message)
            } finally {
                setPendingAction(null)
            }
        })
    }

    const pendingRateName = pendingAction
        ? rates.find(rate => rate.id === pendingAction.id)?.name
            ?? (archiveRate?.id === pendingAction.id ? archiveRate.name : null)
            ?? 'selected rate'
        : null
    const pendingMessage = pendingAction?.kind === 'save'
        ? tx('Saving this yarn rate…')
        : pendingAction?.kind === 'review'
            ? tx('Confirming the current yarn rate…')
            : pendingAction?.kind === 'archive'
                ? tx(`Archiving “${pendingRateName}”…`)
                : pendingAction?.kind === 'restore'
                    ? tx(`Restoring “${pendingRateName}”…`)
                    : historyLoading
                        ? tx('Loading rate activity…')
                        : null

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <ArchivePolicyNotice />
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                <div>
                    <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-950"><Tags className="h-6 w-6 text-orange-600" /> {t('common.yarn_rate_book')}</h1>
                    <p className="mt-1 max-w-3xl text-sm font-medium text-slate-500">{tx('Keep one current rate for every yarn used across your Saved Qualities. Confirm discovered rates here, or change a rate when your supplier price changes. Existing costing snapshots stay unchanged.')}</p>
                </div>
                <Button onClick={() => { setSaveError(null); setDraft(defaultDraft(defaultReviewIntervalDays)) }} className="h-11 bg-orange-600 text-white hover:bg-orange-700"><Plus className="h-4 w-4" /> {tx('Add Yarn Rate')}</Button>
            </div>

            {pendingMessage && (
                <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-800">
                    {pendingMessage} {tx('Please wait; other rate actions are temporarily unavailable.')}
                </p>
            )}

            {conflicts.length > 0 && (
                <div className="flex flex-col gap-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                        <div>
                            <p className="text-sm font-bold">{tx(`Different rates found for ${conflicts.length} ${conflicts.length === 1 ? 'yarn' : 'yarns'}.`)}</p>
                            <p className="mt-1 text-xs leading-relaxed text-amber-800">{tx('Review the saved values before choosing one current rate. Changing it will update future estimates that use this yarn.')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowConflicts(true)} className="shrink-0 border-amber-400 bg-white text-amber-900 hover:bg-amber-100">{tx('Review conflicts')}</Button>
                </div>
            )}

            <Card className="border-slate-200 bg-white shadow-sm">
                <CardContent className="grid gap-4 p-5 sm:grid-cols-3 sm:divide-x sm:divide-slate-200">
                    <div className="flex items-center gap-3 sm:px-3"><span className="rounded-full bg-blue-50 p-3 text-blue-700"><CircleDollarSign className="h-5 w-5" /></span><div><p className="text-2xl font-black text-blue-700">{activeYarnRates.length}</p><p className="text-sm text-slate-600">{tx('active yarn rates')}</p></div></div>
                    <div className="flex items-center gap-3 sm:px-6"><span className="rounded-full bg-amber-50 p-3 text-amber-700"><CalendarClock className="h-5 w-5" /></span><div><p className="text-2xl font-black text-orange-600">{dueCount}</p><p className="text-sm text-slate-600">{tx('due for review')}</p></div></div>
                    <div className="flex items-center gap-3 sm:px-6"><span className="rounded-full bg-emerald-50 p-3 text-emerald-700"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{tx('Last reviewed')}</p><p className="mt-1 text-base font-bold text-slate-950">{mostRecentReview ? formatDateOnly(mostRecentReview, { day: 'numeric', month: 'short', year: 'numeric' }) : tx('Not reviewed')}</p></div></div>
                </CardContent>
            </Card>

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4">
                    <p className="font-bold text-slate-950">{tx('Yarn rates')}</p>
                    <p className="mt-1 text-xs text-slate-500">{tx('Rates appear automatically after you save a quality or costing. A discovered rate stays marked for owner review until you confirm that the displayed value is correct.')}</p>
                </div>

                <div className="grid gap-3 border-b border-slate-200 p-4 lg:grid-cols-[minmax(0,1fr)_220px_180px_auto]">
                    <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search yarn rates…" className="h-10 pl-9" /></div>
                    <select aria-label="Filter yarn rates by use" value={category} onChange={event => setCategory(event.target.value as YarnRateCategory | 'all')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="all">All yarns</option>{YARN_CATEGORIES.map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select>
                    <select aria-label="Filter rates by review status" value={reviewStatus} onChange={event => setReviewStatus(event.target.value as RateReviewStatus | 'all')} className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"><option value="all">Review status</option><option value="needs_review">Owner review needed</option><option value="current">Current</option><option value="due_soon">Due soon</option><option value="overdue">Overdue</option></select>
                    <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => setShowArchived(current => !current)} className="h-10">{showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {tx(showArchived ? 'Active rates' : 'Archived rates')}</Button>
                </div>

                {visibleRates.length === 0 ? (
                    <div className="px-6 py-14 text-center"><Tags className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-bold text-slate-700">{showArchived ? 'No archived yarn rates' : yarnRates.filter(rate => rate.is_active !== false).length === 0 ? 'No yarn rates yet' : 'No matching yarn rates'}</p><p className="mt-1 text-sm text-slate-500">{showArchived ? 'Archived rates stay available here for audit and can be restored when needed.' : yarnRates.length === 0 ? 'Save a quality or costing and its yarn rates will appear here automatically.' : hasActiveFilters ? 'Clear or adjust the filters to see more yarn rates.' : 'Add a yarn rate to continue.'}</p></div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto md:block">
                            <table className="w-full min-w-[1000px] text-left">
                                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Yarn / Use</th><th className="px-4 py-3">{t('common.current_yarn_rate')}</th><th className="px-4 py-3">Previous rate</th><th className="px-4 py-3">Effective from</th><th className="px-4 py-3">Review status</th><th className="px-4 py-3">Source / Notes</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-slate-100">
                                    {visibleRates.map(rate => {
                                        const reviewState = getRateReviewStatus(rate)
                                        const archived = rate.is_active === false
                                        const actionKind = pendingAction?.id === rate.id ? pendingAction.kind : null
                                        const reviewLabel = reviewState === 'needs_review' ? 'Confirm current rate' : 'Confirm review'
                                        return (
                                            <tr key={rate.id} className={archived ? 'bg-slate-50 opacity-80' : reviewState === 'overdue' ? 'bg-red-50/70 hover:bg-red-50' : reviewState === 'due_soon' ? 'bg-amber-50/70 hover:bg-amber-50' : reviewState === 'needs_review' ? 'bg-blue-50/60 hover:bg-blue-50' : 'hover:bg-slate-50/70'}>
                                                <td className="px-4 py-4"><p className="font-bold text-slate-950">{rate.name}</p><p className="mt-1 text-xs text-slate-500">{COST_RATE_CATEGORY_LABELS[rate.category]} {archived && '· Archived'}</p></td>
                                                <td className="px-4 py-4"><p className="font-mono font-bold text-slate-900">{formatRateValue(rate.current_value, rate.unit)}</p>{rate.apply_as_default && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Default for new costings</p>}</td>
                                                <td className="px-4 py-4 font-mono text-sm text-slate-600">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</td>
                                                <td className="px-4 py-4 text-sm text-slate-600">{formatDateOnly(rate.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                <td className="px-4 py-4"><ReviewBadge rate={rate} /></td>
                                                <td className="max-w-[220px] px-4 py-4"><p className="truncate text-sm font-medium text-slate-800">{rate.source || 'No source'}</p><p className="mt-1 truncate text-xs text-slate-500">{rate.notes || 'No notes'}</p></td>
                                                <td className="px-4 py-4">
                                                    <div className="flex justify-end gap-1">
                                                        {!archived && reviewState !== 'current' && <Button variant="outline" size="sm" onClick={() => { setReviewError(null); setReviewRate(rate) }} disabled={isPending} aria-label={`${reviewLabel} for ${rate.name}`}>
                                                            {actionKind === 'review' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {tx(actionKind === 'review' ? 'Confirming…' : reviewLabel)}
                                                        </Button>}
                                                        {!archived && <Button variant="outline" size="sm" onClick={() => { setSaveError(null); setDraft(rowToDraft(rate)) }} disabled={isPending}><Pencil className="h-3.5 w-3.5" /> {tx('Change rate')}</Button>}
                                                        <Button variant="ghost" size="sm" onClick={() => openHistory(rate)} disabled={isPending}><History className="h-3.5 w-3.5" /> {tx('Activity')}</Button>
                                                        <Button variant="ghost" size="sm" onClick={() => { setArchiveError(null); setArchiveRate(rate) }} disabled={isPending} className="text-slate-500">
                                                            {actionKind === 'archive' || actionKind === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {tx(actionKind === 'archive' ? `Archiving ${rate.name}…` : actionKind === 'restore' ? `Restoring ${rate.name}…` : archived ? 'Restore rate' : 'Archive rate')}
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div className="space-y-3 p-3 md:hidden">
                            {visibleRates.map(rate => {
                                const reviewState = getRateReviewStatus(rate)
                                const archived = rate.is_active === false
                                const actionKind = pendingAction?.id === rate.id ? pendingAction.kind : null
                                const reviewLabel = reviewState === 'needs_review' ? 'Confirm current rate' : 'Confirm review'
                                return (
                                    <Card key={rate.id} className={archived ? 'border-slate-300 bg-slate-50' : reviewState === 'overdue' ? 'border-red-300 bg-red-50/70' : reviewState === 'due_soon' ? 'border-amber-300 bg-amber-50/70' : reviewState === 'needs_review' ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200'}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{rate.name}</p><p className="mt-1 text-xs text-slate-500">{COST_RATE_CATEGORY_LABELS[rate.category]} {archived && '· Archived'}</p></div><ReviewBadge rate={rate} /></div>
                                            <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-white/70 p-3"><div><p className="text-[10px] font-bold uppercase text-slate-500">{t('common.current_yarn_rate')}</p><p className="mt-1 font-mono font-bold">{formatRateValue(rate.current_value, rate.unit)}</p></div><div><p className="text-[10px] font-bold uppercase text-slate-500">Previous rate</p><p className="mt-1 font-mono font-semibold text-slate-600">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</p></div></div>
                                            <div className="mt-3 grid grid-cols-2 gap-2">
                                                {!archived && reviewState !== 'current' && <Button variant="outline" onClick={() => { setReviewError(null); setReviewRate(rate) }} disabled={isPending} aria-label={tx(`${reviewLabel} for ${rate.name}`)}>{actionKind === 'review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {tx(actionKind === 'review' ? 'Confirming…' : reviewLabel)}</Button>}
                                                {!archived && <Button variant="outline" onClick={() => { setSaveError(null); setDraft(rowToDraft(rate)) }} disabled={isPending}><Pencil className="h-4 w-4" /> {tx('Change rate')}</Button>}
                                                <Button variant="outline" onClick={() => openHistory(rate)} disabled={isPending}><History className="h-4 w-4" /> {tx('Activity')}</Button>
                                                <Button variant="outline" onClick={() => { setArchiveError(null); setArchiveRate(rate) }} disabled={isPending} aria-label={`${archived ? 'Restore rate' : 'Archive rate'} ${rate.name}`}>
                                                    {actionKind === 'archive' || actionKind === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {tx(actionKind === 'archive' ? `Archiving ${rate.name}…` : actionKind === 'restore' ? `Restoring ${rate.name}…` : archived ? 'Restore rate' : 'Archive rate')}
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            <Dialog open={showConflicts && conflicts.length > 0} onOpenChange={setShowConflicts}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-600" /> Review different saved rates</DialogTitle>
                        <DialogDescription>We found the same yarn at different rates in your Saved Qualities. Review the usages before changing the current Rate Book value. Existing costing snapshots remain unchanged.</DialogDescription>
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
                                        <Button size="sm" onClick={() => editConflict(conflict)} className="shrink-0 bg-amber-700 text-white hover:bg-amber-800"><Pencil className="h-3.5 w-3.5" /> {tx('Change current rate')}</Button>
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
                    <DialogFooter><Button variant="outline" onClick={() => setShowConflicts(false)}>{tx('Review later')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(draft)} onOpenChange={open => { if (!open && !isPending) { setDraft(null); setSaveError(null) } }}>
                    <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    <SheetHeader className="border-b border-slate-200 px-6 py-5"><SheetTitle className="text-xl font-black">{tx(draft?.id ? `Change ${draft.name}` : 'Add Yarn Rate')}</SheetTitle><SheetDescription>{tx('Set the current rate used by matching Saved Quality layers.')}</SheetDescription></SheetHeader>
                    {draft && <div className="space-y-5 px-6 py-2">
                        <div className="flex gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-800"><Info className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">Future estimates use this rate.</p><p className="mt-1 text-xs leading-relaxed">Matching Saved Quality layers may be updated. Existing costing snapshots keep the rate and cost stack recorded when they were saved.</p></div></div>
                        <div className="space-y-1.5"><Label htmlFor="cost-rate-name">Yarn name</Label><Input id="cost-rate-name" value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. 30/1000 MUALTI" maxLength={120} disabled={Boolean(draft.id)} aria-invalid={Boolean(saveError)} aria-describedby={saveError ? 'cost-rate-save-error' : undefined} />{Boolean(draft.id) && <p className="text-xs leading-relaxed text-slate-500"><span className="font-semibold text-slate-700">Linked-yarn rename policy:</span> this name is locked in place. To rename it, add a new rate with the replacement name and update saved qualities intentionally. Historical costing snapshots stay unchanged.</p>}{saveError && <p id="cost-rate-save-error" role="alert" className="text-xs font-medium text-destructive">{tx(saveError)}</p>}</div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Used in</Label><select value={draft.category} onChange={event => changeCategory(event.target.value as YarnRateCategory)} disabled={Boolean(draft.id)} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm disabled:bg-slate-100">{YARN_CATEGORIES.map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select></div><div className="space-y-1.5"><Label>Unit</Label><Input value="₹ per kg" disabled className="bg-slate-100" /></div></div>
                        {draft.id && <p className="-mt-3 text-xs leading-relaxed text-slate-500">Category and unit stay fixed for a linked yarn so saved qualities and historical costings keep the same meaning.</p>}
                        <div className="space-y-1.5"><Label>{t('common.current_yarn_rate')}</Label><Input type="number" min="0" step="0.01" value={draft.currentValue} onChange={event => updateDraft('currentValue', parseNonNegativeInput(event.target.value) ?? 0)} className="font-mono" /></div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Effective from</Label><Input type="date" value={draft.effectiveDate} onChange={event => updateDraft('effectiveDate', event.target.value)} /></div><div className="space-y-1.5"><Label>Review date</Label><Input type="date" value={draft.lastReviewedAt} onChange={event => updateDraft('lastReviewedAt', event.target.value)} /></div></div>
                        <div className="space-y-1.5"><Label>Source</Label><Input value={draft.source} onChange={event => updateDraft('source', event.target.value)} placeholder="Supplier quote, email, internal rate card…" /></div>
                        <div className="space-y-1.5"><Label>Notes</Label><Textarea value={draft.notes} onChange={event => updateDraft('notes', event.target.value)} placeholder="Why this rate changed or how it should be used" maxLength={500} /><p className="text-right text-xs text-slate-400">{draft.notes?.length ?? 0}/500</p></div>
                        <div className="space-y-1.5"><Label>Review every</Label><select value={draft.reviewIntervalDays} onChange={event => updateDraft('reviewIntervalDays', Number(event.target.value))} className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm"><option value="30">30 days</option><option value="60">60 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">12 months</option></select></div>
                    </div>}
                    <SheetFooter className="border-t border-slate-200 p-6 sm:flex-row"><Button variant="outline" onClick={() => setDraft(null)} className="flex-1" disabled={isPending}>{tx('Cancel')}</Button><Button onClick={handleSave} disabled={isPending || !draft?.name.trim()} aria-describedby={!draft?.name.trim() ? 'cost-rate-save-hint' : undefined} className="flex-1 bg-orange-600 text-white hover:bg-orange-700">{isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isPending ? tx('Saving…') : tx('Save current rate')}</Button></SheetFooter>
                    {draft && !draft.name.trim() && <p id="cost-rate-save-hint" className="px-6 pb-5 text-xs font-medium text-amber-700">{tx('Enter a yarn name before saving this rate.')}</p>}
                </SheetContent>
            </Sheet>

            <Dialog open={Boolean(reviewRate)} onOpenChange={open => { if (!open && !isPending) { setReviewRate(null); setReviewError(null) } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm current rate?</DialogTitle>
                        <DialogDescription>Confirm that this displayed rate is correct. This records your review without changing the rate or existing costing snapshots.</DialogDescription>
                    </DialogHeader>
                    {reviewRate && <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4 text-blue-950">
                        <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{reviewRate.name}</p><p className="mt-1 text-xs text-blue-800">{COST_RATE_CATEGORY_LABELS[reviewRate.category]}</p></div><p className="font-mono text-lg font-black">{formatRateValue(Number(reviewRate.current_value), reviewRate.unit)}</p></div>
                        <p className="text-xs leading-relaxed text-blue-800">Source: {reviewRate.source || 'Not recorded'}</p>
                        {reviewRate.notes && <p className="text-xs leading-relaxed text-blue-800">{reviewRate.notes}</p>}
                    </div>}
                    {reviewError && <p role="alert" className="text-sm font-medium text-destructive">{reviewError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setReviewRate(null); setReviewError(null) }} disabled={isPending}>{tx('Review later')}</Button>
                        <Button onClick={handleConfirmReview} disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isPending ? tx('Confirming…') : tx('Confirm current rate')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(historyRate)} onOpenChange={open => { if (!open) { setHistoryRate(null); setHistoryError(null) } }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /> {historyRate?.name} activity</DialogTitle>
                        <DialogDescription>Reviews and saved values are shown here for audit. Existing costing snapshots retain their own numbers.</DialogDescription>
                    </DialogHeader>
                    {historyLoading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-orange-600" /> {tx('Loading rate activity…')}</div>
                        : historyError ? <div className="py-10 text-center text-sm font-medium text-destructive" role="alert">{historyError}</div>
                        : historyRows.length ? <div className="max-h-[420px] space-y-3 overflow-y-auto">{historyRows.map((row, index) => {
                            const previous = row.previous_value ?? historyRows[index + 1]?.value
                            const eventLabel = historyRate ? getRateHistoryEventLabel(row.value, previous, historyRate.unit, row.event_type) : 'Value recorded'
                            return <div key={row.id} className="rounded-lg border border-slate-200 p-4">
                                                <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-base font-black text-slate-950">{historyRate ? formatRateValue(row.value, historyRate.unit) : row.value}</p><p className="mt-1 text-xs font-semibold text-slate-600">{eventLabel}</p></div><p className="text-right text-xs text-slate-500">Effective {formatDateOnly(row.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}<br />Recorded {formatSuratDateTime(row.created_at)}</p></div>
                                <p className="mt-2 text-sm font-medium text-slate-700">{row.source || 'No source recorded'}</p>{row.notes && <p className="mt-1 text-xs text-slate-500">{row.notes}</p>}<p className="mt-2 text-[11px] text-slate-400">Recorded by {row.actor_name || (row.changed_by ? 'owner' : 'system')}</p>
                            </div>
                        })}</div>
                        : <div className="py-10 text-center text-sm text-slate-500">No activity recorded yet. Confirm or change this rate to create the first entry.</div>}
                    <DialogFooter><Button variant="outline" onClick={() => { setHistoryRate(null); setHistoryError(null) }}>{tx('Close')}</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={Boolean(archiveRate)} onOpenChange={open => { if (!open && !isPending) { setArchiveRate(null); setArchiveError(null) } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{archiveRate?.is_active === false ? `Restore ${archiveRate?.name} to Rate Book?` : `Archive ${archiveRate?.name} from Rate Book?`}</DialogTitle>
                        <DialogDescription>{archiveRate?.is_active === false ? tx(`This makes the rate visible and editable in the active Rate Book again. ${t('base_plan.archive.restore')} ${t('base_plan.archive.deletion')} ${t('base_plan.archive.privacy')}`) : `${tx('This removes the rate from the active Rate Book. Saved Qualities keep their recipe values, and costing snapshots remain unchanged.')} ${t('base_plan.archive.description')} ${t('base_plan.archive.restore')} ${t('base_plan.archive.deletion')} ${t('base_plan.archive.privacy')}`}</DialogDescription>
                    </DialogHeader>
                    {archiveError && <p role="alert" className="text-sm font-medium text-destructive">{archiveError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setArchiveRate(null); setArchiveError(null) }} disabled={isPending}>{tx('Cancel')}</Button>
                        <Button variant={archiveRate?.is_active === false ? 'default' : 'destructive'} onClick={handleArchive} disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tx(isPending ? archiveRate?.is_active === false ? `Restoring ${archiveRate?.name ?? 'rate'}…` : `Archiving ${archiveRate?.name ?? 'rate'}…` : archiveRate?.is_active === false ? 'Restore rate' : 'Archive rate')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
