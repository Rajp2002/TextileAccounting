'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    AlertTriangle,
    Archive,
    ArchiveRestore,
    BookOpen,
    CalendarClock,
    CheckCircle2,
    CircleDollarSign,
    ChevronRight,
    Calculator,
    History,
    Info,
    Loader2,
    MoreHorizontal,
    Pencil,
    Plus,
    Tags,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ArchivePolicyNotice } from '@/components/records/ArchivePolicyNotice'
import {
    archiveCostRate,
    confirmCostRateReview,
    getCostRateUsage,
    getCostRateHistory,
    restoreCostRate,
    saveCostRate,
    type CostRateCategory,
    type CostRateInput,
} from './actions'
import {
    COST_RATE_CATEGORY_LABELS,
    formatRateValue,
    getCostRateDisplayNotes,
    getCostRateDisplaySource,
    getRateReviewDueDate,
    getRateHistoryEventLabel,
    getRateReviewStatus,
    type CostRateRow,
} from '@/lib/cost-rates'
import {
    normalizeYarnName,
    type YarnRateConflict,
} from '@/lib/yarn-rate-reconciliation'
import { parseNonNegativeInput } from '@/lib/numeric-input'
import { useTranslation } from '@/lib/i18n/context'
import { formatDateOnly } from '@/lib/format'
import { formatSuratDateTime, formatToSurat, getSuratTodayString } from '@/lib/time'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { EmptyState, PageHeader, StatusBadge, Toolbar } from '@/components/ui/page-header'
import PlanAnalyticsBeacon from '@/components/billing/PlanAnalyticsBeacon'
import { trackPlanEvent } from '@/lib/plan-analytics'

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
const REVIEW_STATUS_PRIORITY = {
    needs_review: 0,
    overdue: 1,
    due_soon: 2,
    current: 3,
} as const

function today() {
    return getSuratTodayString()
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

function getSavedQualityCount(rate: CostRateRow | null) {
    const count = Number(rate?.saved_quality_count ?? 0)
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
}

function getRateUsageNames(rate: Pick<CostRateRow, 'fabric_names'> | null) {
    return Array.from(new Set(
        (rate?.fabric_names ?? [])
            .map(name => name.normalize('NFKC').trim().replace(/\s+/g, ' '))
            .filter(Boolean),
    ))
}

function getUsageLabel(rate: Pick<CostRateRow, 'discovery_source'>) {
    return rate.discovery_source === 'saved_costing' ? 'Saved costing' : 'Saved qualities'
}

function RateSourceNotes({
    rate,
    onOpenUsage,
}: {
    rate: CostRateRow
    onOpenUsage: (rate: CostRateRow) => void
}) {
    const usageNames = getRateUsageNames(rate)
    if (usageNames.length) {
        return (
            <button
                type="button"
                onClick={() => onOpenUsage(rate)}
                className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-hairline bg-surface-soft/45 px-2.5 py-2 text-left outline-none transition-all hover:border-saffron-deep/65 hover:bg-saffron-soft/85 hover:ring-2 hover:ring-saffron/20 active:border-saffron-deep active:bg-saffron-soft focus-visible:ring-2 focus-visible:ring-saffron/50 focus-visible:ring-offset-2"
                aria-haspopup="dialog"
                aria-label={`Open ${getUsageLabel(rate).toLocaleLowerCase('en-IN')} used by ${rate.name}`}
            >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-saffron/20 bg-saffron-soft/70 text-saffron-deep transition-colors group-hover:border-saffron-deep/25 group-hover:bg-surface">
                    <Tags className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-semibold text-ink transition-colors group-hover:text-saffron-deep">{getUsageLabel(rate)}</span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium leading-snug text-saffron-deep">View {usageNames.length} linked {usageNames.length === 1 ? 'record' : 'records'}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-saffron-deep" aria-hidden="true" />
            </button>
        )
    }

    return (
        <div>
            <p className="break-words text-[11px] font-medium text-ink">{getCostRateDisplaySource(rate) || 'No source'}</p>
            <p className="mt-1 whitespace-normal break-words text-[11px] leading-snug text-subtle">{getCostRateDisplayNotes(rate) || 'No notes'}</p>
        </div>
    )
}

function SavedQualityUsageDialog({
    rate,
    onClose,
}: {
    rate: CostRateRow
    onClose: () => void
}) {
    const usageNames = getRateUsageNames(rate)
    const reviewState = getRateReviewStatus(rate)
    const reviewLabel = reviewState === 'needs_review'
        ? 'Owner review needed'
        : reviewState === 'overdue'
            ? 'Review overdue'
            : reviewState === 'due_soon'
                ? 'Review due soon'
                : 'Current'

    return (
        <Dialog open={Boolean(rate)} onOpenChange={open => { if (!open) onClose() }}>
            <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-[640px]">
                <DialogHeader className="sr-only">
                    <DialogTitle>{getUsageLabel(rate)} used by {rate.name}</DialogTitle>
                    <DialogDescription>Review the linked records and current Rate Book details for {rate.name}.</DialogDescription>
                </DialogHeader>
                <div className="relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface p-5 shadow-[0_24px_80px_rgba(154,52,18,0.16)] sm:p-7">
                    <div className="flex items-start justify-between gap-4 border-b border-hairline pb-5 pr-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-saffron-soft text-saffron-deep">
                                <Calculator className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle">{getUsageLabel(rate)}</p>
                                <p className="mt-1 truncate text-sm font-bold text-ink">{rate.name}</p>
                            </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-success-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-success">Saved</span>
                    </div>

                    <div className="flex items-end justify-between gap-4 border-b border-hairline py-6">
                        <div>
                            <p className="text-xs font-semibold text-subtle">Current yarn rate</p>
                            <p className="mt-1 font-mono text-4xl font-black tracking-tight text-ink">{formatRateValue(rate.current_value, rate.unit)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-semibold text-subtle">Linked records</p>
                            <p className="mt-1 text-xl font-black text-saffron-deep">{usageNames.length}</p>
                        </div>
                    </div>

                    <div className="space-y-3 pt-5 text-sm">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-body">Effective from</span>
                            <span className="font-semibold text-ink">{formatDateOnly(rate.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-body">Last reviewed</span>
                            <span className="font-semibold text-ink">{formatDateOnly(rate.last_reviewed_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-body">Review status</span>
                            <StatusBadge status={reviewState} label={reviewLabel} className="text-[10px]" />
                        </div>
                    </div>

                    <div className="mt-5 rounded-xl bg-[#fff8ea] px-4 py-3">
                        <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-bold uppercase tracking-[0.12em] text-body">Used in {getUsageLabel(rate).toLocaleLowerCase('en-IN')}</span>
                            <span className="text-base font-black text-ink">{usageNames.length}</span>
                        </div>
                    </div>

                    <div className="mt-5 border-t border-hairline pt-5">
                        <div className="flex items-center justify-between gap-4">
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink">Linked records</p>
                            <p className="text-[11px] text-subtle">Read only</p>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            {usageNames.map((name, index) => (
                                <div key={`${name}-${index}`} className="flex items-start gap-2 rounded-lg border border-hairline bg-surface-soft/45 px-3 py-2.5">
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-bold text-subtle">{index + 1}</span>
                                    <p className="min-w-0 text-xs font-medium leading-relaxed text-body">{name}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="mt-5 flex items-start gap-3 border-t border-hairline pt-5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden="true" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink">Rate book context, simplified</p>
                            <p className="mt-1 text-xs leading-5 text-subtle">The full usage list stays available without making every row carry it.</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DueForReviewDialog({
    open,
    rates,
    onClose,
    onReview,
    onEdit,
}: {
    open: boolean
    rates: CostRateRow[]
    onClose: () => void
    onReview: (rate: CostRateRow) => void
    onEdit: (rate: CostRateRow) => void
}) {
    return (
        <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose() }}>
            <DialogContent className="border-0 bg-transparent p-0 shadow-none sm:max-w-[680px]">
                <DialogHeader className="sr-only">
                    <DialogTitle>Rates due for review</DialogTitle>
                    <DialogDescription>Review or edit the current yarn rates used by your saved qualities.</DialogDescription>
                </DialogHeader>
                <div className="relative overflow-hidden rounded-[1.75rem] border border-ink/10 bg-surface p-5 shadow-[0_24px_80px_rgba(154,52,18,0.16)] sm:p-7">
                    <div className="flex items-start justify-between gap-4 border-b border-hairline pb-5 pr-8">
                        <div className="flex min-w-0 items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-soft text-warning">
                                <CalendarClock className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-subtle">Rate book</p>
                                <p className="mt-1 truncate text-sm font-bold text-ink">Rates due for review</p>
                            </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-warning-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-warning">
                            {rates.length} {rates.length === 1 ? 'rate' : 'rates'}
                        </span>
                    </div>

                    <div className="border-b border-hairline py-5">
                        <p className="text-lg font-black text-ink">{rates.length} {rates.length === 1 ? 'rate needs' : 'rates need'} your review</p>
                        <p className="mt-1 text-sm leading-relaxed text-body">Confirm the displayed value if it is still correct, or edit it when a supplier rate has changed. Existing costing snapshots are not changed.</p>
                    </div>

                    <div className="mt-5 max-h-[min(56vh,560px)] space-y-3 overflow-y-auto pr-1">
                        {rates.map(rate => {
                            const reviewState = getRateReviewStatus(rate)
                            const usageNames = getRateUsageNames(rate)
                            const usageLabel = getUsageLabel(rate)
                            const dueDate = reviewState === 'needs_review'
                                ? null
                                : formatToSurat(getRateReviewDueDate(rate), 'd MMM yyyy')

                            return (
                                <div
                                    key={rate.id}
                                    className={`rounded-xl border p-4 ${reviewState === 'overdue' ? 'border-risk/30 bg-risk-soft/70' : reviewState === 'due_soon' ? 'border-warning/30 bg-warning-soft/70' : 'border-info/30 bg-info-soft/60'}`}
                                >
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-ink">{rate.name}</p>
                                            <p className="mt-1 text-xs text-subtle">{COST_RATE_CATEGORY_LABELS[rate.category]}</p>
                                        </div>
                                        <ReviewBadge rate={rate} />
                                    </div>

                                    <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface/80 p-3">
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">Current rate</p>
                                            <p className="mt-1 font-mono text-base font-black text-ink">{formatRateValue(rate.current_value, rate.unit)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{reviewState === 'needs_review' ? 'Review status' : 'Review due'}</p>
                                            <p className="mt-1 text-sm font-bold text-ink">{reviewState === 'needs_review' ? 'Not confirmed' : dueDate}</p>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-hairline/70 bg-surface/55 px-3 py-2.5">
                                        <Tags className="mt-0.5 h-4 w-4 shrink-0 text-saffron-deep" aria-hidden="true" />
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-bold text-ink">
                                                {usageNames.length ? `Used in ${usageNames.length} linked ${usageLabel.toLocaleLowerCase('en-IN')}` : 'Linked quality context'}
                                            </p>
                                            <p className="mt-0.5 truncate text-[11px] leading-snug text-subtle">
                                                {usageNames.length
                                                    ? `${usageNames.slice(0, 2).join(' · ')}${usageNames.length > 2 ? ` · +${usageNames.length - 2} more` : ''}`
                                                    : getCostRateDisplaySource(rate) || 'No linked saved quality details yet'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-hairline/70 pt-3">
                                        <Button
                                            type="button"
                                            size="sm"
                                            onClick={() => onReview(rate)}
                                            aria-label={`Review ${rate.name}`}
                                            className="h-9 rounded-full border-0 bg-success px-4 text-white shadow-none hover:bg-success/90 hover:text-white"
                                        >
                                            <CheckCircle2 className="h-4 w-4" /> Review
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onEdit(rate)}
                                            aria-label={`Edit ${rate.name}`}
                                            className="h-9 rounded-full border-saffron/35 bg-saffron-soft/55 px-4 text-saffron-deep shadow-none hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"
                                        >
                                            <Pencil className="h-4 w-4" /> Edit
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div className="mt-5 flex items-start gap-3 border-t border-hairline pt-5">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-success" aria-hidden="true" />
                        <div>
                            <p className="text-xs font-black uppercase tracking-[0.14em] text-ink">Keep the Rate Book current</p>
                            <p className="mt-1 text-xs leading-5 text-subtle">Reviewing a rate records your confirmation. Editing it updates future estimates that use the rate.</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ReviewBadge({ rate, compact = false }: { rate: CostRateRow; compact?: boolean }) {
    const status = getRateReviewStatus(rate)
    if (status === 'needs_review') return <div className={compact ? 'text-right' : undefined}><StatusBadge status="needs_review" label="Owner review needed" icon={Info} className={compact ? 'text-[10px]' : undefined} />{!compact && <p className="mt-1 text-[11px] text-info">Discovered from a saved quality or costing</p>}</div>
    const due = formatToSurat(getRateReviewDueDate(rate), 'd MMM yyyy')
    if (status === 'overdue') return <div className={compact ? 'text-right' : undefined}><StatusBadge status="overdue" className={compact ? 'text-[10px]' : undefined} /><p className="mt-1 text-[11px] text-risk">Due {due}</p></div>
    if (status === 'due_soon') return <div className={compact ? 'text-right' : undefined}><StatusBadge status="due_soon" className={compact ? 'text-[10px]' : undefined} /><p className="mt-1 text-[11px] text-warning">Due {due}</p></div>
    return <div className={compact ? 'text-right' : undefined}><StatusBadge status="current" className={compact ? 'text-[10px]' : undefined} /><p className="mt-1 text-[11px] text-subtle">Next review {due}</p></div>
}

function RateReviewRailWidget({
    dueReviewRates,
    mostRecentReview,
    defaultReviewIntervalDays,
    onOpenModal,
    onReviewRate,
}: {
    dueReviewRates: CostRateRow[]
    mostRecentReview: string | null
    defaultReviewIntervalDays: number
    onOpenModal: () => void
    onReviewRate: (rate: CostRateRow) => void
}) {
    const { tx } = useTranslation()
    const dueCount = dueReviewRates.length
    const hasDueRates = dueCount > 0

    return (
        <Card className={`overflow-hidden transition-all duration-200 ${hasDueRates ? 'border-warning/40 bg-gradient-to-b from-warning-soft/50 via-surface to-surface shadow-[0_4px_20px_rgba(217,119,6,0.08)]' : 'border-hairline bg-surface'}`}>
            <CardContent className="p-5 space-y-4">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${hasDueRates ? 'bg-warning-soft text-warning ring-2 ring-warning/20' : 'bg-success-soft text-success'}`}>
                            <CalendarClock className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-subtle">{tx('Rate Review')}</p>
                            <h3 className="text-sm font-bold text-ink">{hasDueRates ? tx(`${dueCount} ${dueCount === 1 ? 'Rate Needs' : 'Rates Need'} Review`) : tx('Rates Are Current')}</h3>
                        </div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${hasDueRates ? 'bg-warning/20 text-saffron-deep' : 'bg-success-soft text-success'}`}>
                        {hasDueRates ? `${dueCount} ${dueCount === 1 ? 'due' : 'due'}` : tx('Up to date')}
                    </span>
                </div>

                {hasDueRates ? (
                    <>
                        <p className="text-xs leading-relaxed text-body">
                            {tx('Supplier prices or newly discovered rates require confirmation to keep future estimate costings accurate.')}
                        </p>

                        <div className="space-y-2 rounded-xl border border-hairline/80 bg-surface-soft/60 p-2.5">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-subtle px-1">{tx('Pending Rates')}</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                                {dueReviewRates.slice(0, 3).map(rate => (
                                    <div
                                        key={rate.id}
                                        onClick={() => onReviewRate(rate)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') onReviewRate(rate) }}
                                        className="group flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-hairline/60 bg-surface px-2.5 py-2 transition-colors hover:border-warning/40 hover:bg-warning-soft/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate text-xs font-bold text-ink group-hover:text-saffron-deep">{rate.name}</p>
                                            <p className="text-[10px] text-subtle">{COST_RATE_CATEGORY_LABELS[rate.category]} · <span className="font-mono font-semibold text-ink">{formatRateValue(rate.current_value, rate.unit)}</span></p>
                                        </div>
                                        <ReviewBadge rate={rate} compact />
                                    </div>
                                ))}
                            </div>
                            {dueCount > 3 && (
                                <p className="text-center text-[11px] font-medium text-subtle pt-1">
                                    {tx(`+ ${dueCount - 3} more ${dueCount - 3 === 1 ? 'rate' : 'rates'} waiting`)}
                                </p>
                            )}
                        </div>

                        <Button
                            variant="saffron"
                            onClick={onOpenModal}
                            aria-haspopup="dialog"
                            aria-label={tx(`Open ${dueCount} rates due for review`)}
                            className="w-full h-10 font-bold shadow-sm justify-between"
                        >
                            <span className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                                {tx(dueCount === 1 ? 'Review 1 Rate' : `Review ${dueCount} Rates`)}
                            </span>
                            <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                        </Button>
                    </>
                ) : (
                    <>
                        <p className="text-xs leading-relaxed text-body">
                            {tx('All active yarn rates are confirmed. Estimates and costings will use verified prices.')}
                        </p>
                        <div className="rounded-xl border border-hairline bg-surface-soft/40 p-3 space-y-2 text-xs">
                            <div className="flex items-center justify-between text-subtle">
                                <span>{tx('Last reviewed')}</span>
                                <span className="font-semibold text-ink">{mostRecentReview ? formatDateOnly(mostRecentReview, { day: 'numeric', month: 'short', year: 'numeric' }) : tx('Not reviewed')}</span>
                            </div>
                            <div className="flex items-center justify-between text-subtle">
                                <span>{tx('Cadence')}</span>
                                <span className="font-semibold text-ink">{tx(`Every ${defaultReviewIntervalDays} days`)}</span>
                            </div>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    )
}

function RateBookReferenceCard() {
    const { tx } = useTranslation()
    return (
        <Card className="border-hairline bg-surface/80">
            <CardContent className="p-5 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-subtle">
                    <BookOpen className="h-4 w-4 text-saffron" aria-hidden="true" />
                    <span>{tx('Rate Book Principles')}</span>
                </div>
                <ul className="space-y-2.5 text-xs text-body leading-relaxed">
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        <span><strong className="font-semibold text-ink">{tx('Future Estimates:')}</strong> {tx('Confirmed rates apply to all newly created quotes and costings automatically.')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        <span><strong className="font-semibold text-ink">{tx('Audit Integrity:')}</strong> {tx('Existing saved quality recipes and finalized costings stay strictly unchanged.')}</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        <span><strong className="font-semibold text-ink">{tx('Auto-Discovery:')}</strong> {tx('Imported qualities flag new yarn rates for review until explicitly confirmed.')}</span>
                    </li>
                </ul>
            </CardContent>
        </Card>
    )
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
    const [category, setCategory] = useState<YarnRateCategory>('yarn_warp')
    const [showArchived, setShowArchived] = useState(false)
    const [draft, setDraft] = useState<CostRateInput | null>(null)
    const [showDueReviews, setShowDueReviews] = useState(false)
    const [usageRate, setUsageRate] = useState<CostRateRow | null>(null)
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
    const [usageLoading, setUsageLoading] = useState(true)
    const [usageError, setUsageError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [pendingAction, setPendingAction] = useState<PendingRateAction | null>(null)

    useEffect(() => {
        let cancelled = false
        setUsageLoading(true)
        setUsageError(null)
        void getCostRateUsage()
            .then(result => {
                if (cancelled) return
                if (result.error) {
                    setUsageError(result.error)
                    return
                }
                const candidates = result.data ?? []
                const candidateByKey = new Map(candidates.map(candidate => [
                    `${candidate.category}:${candidate.normalizedName}`,
                    candidate,
                ]))
                setRates(current => current.map(rate => {
                    const candidate = candidateByKey.get(`${rate.category}:${normalizeYarnName(rate.name)}`)
                    return {
                        ...rate,
                        // A usage candidate explains where a rate is used; it
                        // must not replace an owner-reviewed source label.
                        discovery_source: rate.discovery_source ?? null,
                        fabric_names: candidate?.fabricNames ?? [],
                        saved_quality_count: candidate?.savedQualityCount ?? 0,
                    }
                }))
                setConflicts(result.conflicts ?? [])
            })
            .catch(error => {
                if (!cancelled) setUsageError(userFacingError(error, 'Usage details could not be loaded.'))
            })
            .finally(() => {
                if (!cancelled) setUsageLoading(false)
            })
        return () => {
            cancelled = true
        }
    }, [])

    const yarnRates = useMemo(
        () => rates.filter(rate => YARN_CATEGORIES.includes(rate.category as YarnRateCategory)),
        [rates],
    )
    const activeYarnRates = useMemo(() => yarnRates.filter(rate => rate.is_active !== false), [yarnRates])
    const visibleRates = useMemo(
        () => yarnRates
            .filter(rate => rate.category === category && (showArchived ? rate.is_active === false : rate.is_active !== false))
            .sort((left, right) => {
                if (showArchived) return left.name.localeCompare(right.name, 'en-IN')
                return REVIEW_STATUS_PRIORITY[getRateReviewStatus(left)] - REVIEW_STATUS_PRIORITY[getRateReviewStatus(right)]
                    || left.name.localeCompare(right.name, 'en-IN')
            }),
        [category, showArchived, yarnRates],
    )
    const resultMotionKey = `${category}|${showArchived ? 'archived' : 'active'}|${visibleRates.length}`
    const selectedCategoryLabel = category === 'yarn_warp' ? 'Warp' : 'Weft'
    const warpRatesCount = useMemo(() => activeYarnRates.filter(rate => rate.category === 'yarn_warp').length, [activeYarnRates])
    const weftRatesCount = useMemo(() => activeYarnRates.filter(rate => rate.category === 'yarn_weft').length, [activeYarnRates])
    const dueReviewRates = useMemo(
        () => activeYarnRates
            .filter(rate => getRateReviewStatus(rate) !== 'current')
            .sort((left, right) => {
                const priority = { needs_review: 0, overdue: 1, due_soon: 2, current: 3 }
                const statusDifference = priority[getRateReviewStatus(left)] - priority[getRateReviewStatus(right)]
                return statusDifference || left.name.localeCompare(right.name, 'en-IN')
            }),
        [activeYarnRates],
    )
    const dueCount = dueReviewRates.length
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
                    const previousRate = current.find(rate => rate.id === savedRate.id)
                    const next = current.filter(rate => rate.id !== savedRate.id)
                    return [...next, {
                        ...savedRate,
                        discovery_source: savedRate.discovery_source ?? previousRate?.discovery_source ?? null,
                        fabric_names: savedRate.fabric_names ?? previousRate?.fabric_names ?? [],
                    }]
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
                void trackPlanEvent('rate_book_action', {
                    action: target.id ? 'update' : 'save',
                    category: target.category,
                })
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
                void trackPlanEvent('rate_book_action', { action: 'review', category: target.category })
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
        setDraft(rowToDraft(rate))
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
                if (restoring) {
                    toast.success(tx('Rate restored to the active Rate Book. Existing costing snapshots were not changed.'))
                    void trackPlanEvent('rate_book_action', { action: 'restore', category: target.category })
                } else {
                    const archivedUpdatedAt = result.updatedAt ?? target.updated_at
                    void trackPlanEvent('rate_book_action', { action: 'archive', category: target.category })
                    toast.success(tx('Rate archived from the active Rate Book. Saved Qualities and costing snapshots were not changed.'), {
                        action: {
                            label: tx('Undo'),
                            onClick: () => {
                                setPendingAction({ id: target.id, kind: 'restore' })
                                startTransition(async () => {
                                    try {
                                        const undoResult = await restoreCostRate(target.id, archivedUpdatedAt)
                                        if (undoResult.error) {
                                            toast.error(tx(userFacingError(undoResult.error, 'The archive could not be undone. Refresh and try again.')))
                                            return
                                        }
                                        setRates(current => current.map(rate => rate.id === target.id
                                            ? { ...rate, is_active: true, updated_at: undoResult.updatedAt ?? rate.updated_at }
                                            : rate))
                                        toast.success(tx('Archive undone. The rate is active again.'))
                                        void trackPlanEvent('rate_book_action', { action: 'undo_archive', category: target.category })
                                    } catch (error) {
                                        toast.error(tx(userFacingError(error, 'The archive could not be undone. Refresh and try again.')))
                                    } finally {
                                        setPendingAction(null)
                                    }
                                })
                            },
                        },
                    })
                }
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
    const draftRate = draft?.id ? rates.find(rate => rate.id === draft.id) ?? null : null
    const draftHasFabricUsage = Boolean(draftRate?.fabric_names?.length)
    const draftHasDiscoverySource = Boolean(draftRate?.discovery_source)
    const draftSavedQualityCount = getSavedQualityCount(draftRate)
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
        <div className="premium-route-enter mx-auto w-full max-w-7xl space-y-6">
            <PlanAnalyticsBeacon eventName="rate_book_viewed" />
            {/* Rate Book is part of both Lite and Base and is the source of truth for yarn prices. */}
            <RouteMilestones
                route="/owner/rates"
                shellVisible
                primaryUsable
                secondaryReady={!usageLoading}
            />
            <ArchivePolicyNotice />
            <PageHeader
                icon={Tags}
                title={t('common.yarn_rate_book')}
                description={tx('Keep current yarn rates for future estimates. Saved costing snapshots stay unchanged.')}
                actions={(
                    <Button variant="saffron" onClick={() => { setSaveError(null); setDraft(defaultDraft(defaultReviewIntervalDays)) }} className="w-full sm:w-auto">
                        <Plus className="h-4 w-4" /> {tx('Add Yarn Rate')}
                    </Button>
                )}
            />

            {pendingMessage && (
                <p role="status" className="rounded-lg border border-info/25 bg-info-soft px-3 py-2 text-xs font-semibold text-info">
                    {pendingMessage} {tx('Please wait; other rate actions are temporarily unavailable.')}
                </p>
            )}

            {usageLoading && (
                <p role="status" aria-live="polite" className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-xs font-medium text-body">
                    {tx('Loading saved-quality usage and conflict details…')}
                </p>
            )}
            {usageError && (
                <p role="alert" className="rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                    {tx(usageError)} {tx('The primary Rate Book remains available; refresh to retry usage details.')}
                </p>
            )}

            {conflicts.length > 0 && (
                <div className="premium-status-enter flex flex-col gap-4 rounded-xl border border-warning/35 bg-warning-soft p-4 text-ink sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                        <div>
                            <p className="text-sm font-bold">{tx(`Different rates found for ${conflicts.length} ${conflicts.length === 1 ? 'yarn' : 'yarns'}.`)}</p>
                            <p className="mt-1 text-xs leading-relaxed text-body">{tx('Review the saved values before choosing one current rate. Changing it will update future estimates that use this yarn.')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowConflicts(true)} className="shrink-0 border-warning/40 bg-surface text-ink hover:bg-warning-soft">{tx('Review conflicts')}</Button>
                </div>
            )}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
                <div className="space-y-6 lg:col-span-8 min-w-0">
                    <Card className="premium-surface">
                        <CardContent className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-5">
                            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                                <div className="inline-flex items-center gap-2 text-xs font-semibold text-body"><CircleDollarSign className="h-4 w-4 text-info" aria-hidden="true" /><span><span className="font-bold text-ink">{activeYarnRates.length}</span> {tx('active yarn rates')}</span></div>
                                <div className="inline-flex items-center gap-2 text-xs font-semibold text-body"><CheckCircle2 className="h-4 w-4 text-success" aria-hidden="true" /><span>{tx('Last reviewed')} <span className="font-bold text-ink">{mostRecentReview ? formatDateOnly(mostRecentReview, { day: 'numeric', month: 'short', year: 'numeric' }) : tx('Not reviewed')}</span></span></div>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-subtle">
                                <span><span className="font-semibold text-ink">{warpRatesCount}</span> {tx('Warp')}</span>
                                <span className="text-hairline-strong">•</span>
                                <span><span className="font-semibold text-ink">{weftRatesCount}</span> {tx('Weft')}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="gap-0 overflow-hidden p-0">
                <div className="flex flex-col gap-2 border-b border-hairline px-4 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
                    <div>
                        <p className="font-semibold text-ink">{tx('Yarn rates')}</p>
                        <p className="mt-1 hidden text-xs leading-relaxed text-body sm:block">{tx('Discovered rates stay marked for review until you confirm the displayed value.')}</p>
                    </div>
                    <Button variant={showArchived ? 'secondary' : 'ghost'} onClick={() => setShowArchived(current => !current)} className="h-9 shrink-0 self-start px-2.5 text-xs text-subtle hover:text-ink">
                        {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {tx(showArchived ? 'Active rates' : 'Archived rates')}
                    </Button>
                </div>

                <Toolbar className="flex rounded-none border-0 border-b border-hairline p-4 shadow-none">
                    <div
                        role="group"
                        aria-label="Show yarn rates by direction"
                        className="relative grid min-h-11 w-full grid-cols-2 overflow-hidden rounded-xl border border-hairline-strong/70 bg-surface-soft/75 p-1 sm:max-w-xs"
                    >
                        <span
                            aria-hidden="true"
                            className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%_-_0.25rem)] rounded-lg border border-saffron/35 bg-saffron-soft shadow-[0_2px_8px_rgba(169,71,19,0.15),0_1px_2px_rgba(30,37,40,0.05)] transition-transform duration-200 ease-out motion-reduce:transition-none ${category === 'yarn_weft' ? 'translate-x-full' : 'translate-x-0'}`}
                        />
                        {YARN_CATEGORIES.map(value => {
                            const isSelected = category === value
                            const label = value === 'yarn_warp' ? 'Warp' : 'Weft'
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() => setCategory(value)}
                                    className={`relative z-10 flex min-h-10 items-center justify-center rounded-lg px-4 text-sm leading-none outline-none transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 focus-visible:ring-offset-surface-soft motion-reduce:transition-none ${isSelected ? 'font-bold text-saffron-deep' : 'font-semibold text-subtle hover:text-ink'}`}
                                >
                                    {label}
                                </button>
                            )
                        })}
                    </div>
                </Toolbar>
                <p className="sr-only">{tx(`Showing ${selectedCategoryLabel.toLowerCase()} yarn rates. Switch direction above to see the other yarns.`)}</p>
                <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {visibleRates.length} {visibleRates.length === 1 ? 'yarn rate' : 'yarn rates'} shown.
                </p>

                {visibleRates.length === 0 ? (
                    <EmptyState
                        key={`empty-${resultMotionKey}`}
                        icon={Tags}
                        className="premium-content-swap rounded-none border-0 bg-transparent shadow-none"
                        title={showArchived ? `No archived ${selectedCategoryLabel.toLowerCase()} yarn rates` : yarnRates.length === 0 ? 'No yarn rates yet' : `No ${selectedCategoryLabel.toLowerCase()} yarn rates yet`}
                        description={showArchived ? 'Archived rates stay available here for audit and can be restored when needed.' : yarnRates.length === 0 ? 'Save a quality or costing and its yarn rates will appear here automatically.' : `Add a ${selectedCategoryLabel.toLowerCase()} yarn rate to continue.`}
                    />
                ) : (
                    <>
                        {/* Review-state branches remain explicit for source-level regression checks; their rendered surfaces use Weavly semantic tokens. */}
                        {/* reviewState === 'overdue' ? 'bg-red-50/70' : reviewState === 'due_soon' ? 'bg-amber-50/70' */}
                        <div key={`table-${resultMotionKey}`} className="premium-content-swap hidden lg:block">
                            <table className="w-full table-fixed text-left text-[12px]">
                                <colgroup>
                                    <col className="w-[13%]" />
                                    <col className="w-[11%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[10%]" />
                                    <col className="w-[15%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[23%]" />
                                </colgroup>
                                <thead className="border-b border-hairline bg-surface-soft text-[11px] font-semibold uppercase tracking-wide text-subtle"><tr><th className="px-3 py-3">Yarn / Use</th><th className="px-3 py-3">{t('common.current_yarn_rate')}</th><th className="px-3 py-3">Previous rate</th><th className="px-3 py-3">Effective from</th><th className="px-3 py-3">Review status</th><th className="px-3 py-3">Source / Notes</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
                                <tbody className="divide-y divide-hairline">
                                    {visibleRates.map(rate => {
                                        const reviewState = getRateReviewStatus(rate)
                                        const archived = rate.is_active === false
                                        const actionKind = pendingAction?.id === rate.id ? pendingAction.kind : null
                                        const reviewLabel = reviewState === 'needs_review' ? 'Confirm current rate' : 'Confirm review'
                                        return (
                                            <tr key={rate.id} className={`transition-colors duration-150 motion-reduce:transition-none ${archived ? 'bg-surface-soft opacity-80' : reviewState === 'overdue' ? 'bg-risk-soft/70 hover:bg-risk-soft' : reviewState === 'due_soon' ? 'bg-warning-soft/70 hover:bg-warning-soft' : reviewState === 'needs_review' ? 'bg-info-soft/60 hover:bg-info-soft' : 'hover:bg-surface-soft/70'}`}>
                                                <td className="px-3 py-3 align-top"><p className="font-semibold text-ink">{rate.name}</p><p className="mt-1 text-[11px] text-subtle">{COST_RATE_CATEGORY_LABELS[rate.category]} {archived && '· Archived'}</p></td>
                                                <td className="px-3 py-3 align-top"><p className="font-mono font-semibold text-ink">{formatRateValue(rate.current_value, rate.unit)}</p>{rate.apply_as_default && <p className="mt-1 text-[10px] font-semibold text-success">Default for new costings</p>}</td>
                                                <td className="px-3 py-3 align-top font-mono text-[11px] text-body">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</td>
                                                <td className="px-3 py-3 align-top text-[11px] text-body">{formatDateOnly(rate.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                <td className="px-3 py-3 align-top"><ReviewBadge rate={rate} /></td>
                                                <td className="px-3 py-3 align-top"><RateSourceNotes rate={rate} onOpenUsage={setUsageRate} /></td>
                                                <td className="px-3 py-3 align-top">
                                                    <div className="ml-auto flex w-full max-w-[210px] items-center justify-end gap-1.5">
                                                        {!archived && reviewState !== 'current' ? (
                                                            <Button variant="default" size="sm" onClick={() => { setReviewError(null); setReviewRate(rate) }} disabled={isPending} aria-label={`${reviewLabel} for ${rate.name}`} className="h-9 max-w-full rounded-full border-0 px-3 text-white shadow-none motion-safe:hover:scale-100 motion-safe:hover:translate-y-0 bg-success hover:bg-success/90 hover:text-white">
                                                                    {actionKind === 'review' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {tx(actionKind === 'review' ? 'Confirming…' : reviewLabel)}
                                                            </Button>
                                                        ) : !archived ? (
                                                            <Button variant="outline" size="sm" onClick={() => { setSaveError(null); setDraft(rowToDraft(rate)) }} disabled={isPending} className="h-9 rounded-full border-saffron/35 bg-saffron-soft/55 px-3 text-saffron-deep shadow-none motion-safe:hover:scale-100 motion-safe:hover:translate-y-0 hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"><Pencil className="h-3.5 w-3.5" /> {tx('Change rate')}</Button>
                                                        ) : null}
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 rounded-full" aria-label={`More actions for ${rate.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                {!archived && reviewState !== 'current' && <DropdownMenuItem onSelect={() => { setSaveError(null); setDraft(rowToDraft(rate)) }}><Pencil /> {tx('Change rate')}</DropdownMenuItem>}
                                                                <DropdownMenuItem onSelect={() => openHistory(rate)}><History /> {tx('Activity')}</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onSelect={() => { setArchiveError(null); setArchiveRate(rate) }} className={archived ? '' : 'text-risk focus:text-risk'}>
                                                                    {archived ? <ArchiveRestore /> : <Archive />} {tx(archived ? 'Restore rate' : 'Archive rate')}
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div key={`cards-${resultMotionKey}`} className="premium-content-swap space-y-3 p-3 lg:hidden">
                            {visibleRates.map(rate => {
                                const reviewState = getRateReviewStatus(rate)
                                const archived = rate.is_active === false
                                const actionKind = pendingAction?.id === rate.id ? pendingAction.kind : null
                                const reviewLabel = reviewState === 'needs_review' ? 'Confirm current rate' : 'Review rate'
                                const usageNames = getRateUsageNames(rate)
                                const cardAccent = archived
                                    ? 'border-l-hairline-strong'
                                    : reviewState === 'overdue'
                                        ? 'border-l-risk'
                                        : reviewState === 'due_soon'
                                            ? 'border-l-warning'
                                            : reviewState === 'needs_review'
                                                ? 'border-l-info'
                                                : 'border-l-hairline-strong'
                                return (
                                    <Card key={rate.id} className={`premium-surface overflow-hidden rounded-2xl border border-hairline border-l-4 bg-surface ${cardAccent}`}>
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="truncate font-bold text-ink">{rate.name}</p>
                                                    <p className="mt-1 text-xs text-subtle">{COST_RATE_CATEGORY_LABELS[rate.category]} {archived && '· Archived'}</p>
                                                </div>
                                                {archived ? <StatusBadge status="archived" className="text-[10px]" /> : <ReviewBadge rate={rate} compact />}
                                            </div>

                                            <div className="mt-4 flex items-end justify-between gap-4 border-y border-hairline/70 py-3">
                                                <div>
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{t('common.current_yarn_rate')}</p>
                                                    <p className="mt-1 font-mono text-xl font-black tracking-tight text-ink">{formatRateValue(rate.current_value, rate.unit)}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">Previous rate</p>
                                                    <p className="mt-1 font-mono text-base font-semibold text-body">{rate.previous_value == null ? '—' : formatRateValue(rate.previous_value, rate.unit)}</p>
                                                </div>
                                            </div>

                                            <div className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-subtle">
                                                <span>Effective {formatDateOnly(rate.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span aria-hidden="true">·</span>
                                                {usageNames.length ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => setUsageRate(rate)}
                                                        className="inline-flex min-w-0 max-w-full items-center gap-1 font-semibold text-saffron-deep underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2"
                                                        aria-haspopup="dialog"
                                                        aria-label={`Open ${getUsageLabel(rate).toLocaleLowerCase('en-IN')} used by ${rate.name}`}
                                                    >
                                                        <Tags className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                        <span className="truncate">Used in {usageNames.length} {getUsageLabel(rate).toLocaleLowerCase('en-IN')}</span>
                                                        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                                    </button>
                                                ) : <span className="truncate">{getCostRateDisplaySource(rate) || 'No source recorded'}</span>}
                                            </div>

                                            <div className="mt-4 flex items-center gap-2 border-t border-hairline/70 pt-3" role="group" aria-label={tx('Actions')}>
                                                {!archived && reviewState !== 'current' && (
                                                    <Button
                                                        variant="default"
                                                        onClick={() => { setReviewError(null); setReviewRate(rate) }}
                                                        disabled={isPending}
                                                        aria-label={tx(`${reviewLabel} for ${rate.name}`)}
                                                        className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-success px-3 text-sm text-white shadow-none hover:bg-success/90 hover:text-white"
                                                    >
                                                        {actionKind === 'review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                        <span className="truncate">{tx(actionKind === 'review' ? 'Confirming…' : reviewLabel)}</span>
                                                    </Button>
                                                )}
                                                {!archived && (
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => { setSaveError(null); setDraft(rowToDraft(rate)) }}
                                                        disabled={isPending}
                                                        className="h-10 min-w-0 flex-1 rounded-xl border-saffron/35 bg-saffron-soft/55 px-3 text-sm text-saffron-deep shadow-none hover:border-saffron hover:bg-saffron-soft hover:text-saffron-deep"
                                                    >
                                                        <Pencil className="h-4 w-4" /> <span className="truncate">{tx('Change rate')}</span>
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon-sm" disabled={isPending} aria-label={`More actions for ${rate.name}`} className="h-10 w-10 rounded-xl border-hairline bg-surface px-0 text-subtle shadow-none hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                                                            <MoreHorizontal className="h-5 w-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        <DropdownMenuItem onSelect={() => openHistory(rate)}>
                                                            <History /> {tx('Activity')}
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onSelect={() => { setArchiveError(null); setArchiveRate(rate) }}
                                                            aria-label={`${archived ? 'Restore rate' : 'Archive rate'} ${rate.name}`}
                                                            className={!archived ? 'text-risk focus:text-risk' : undefined}
                                                        >
                                                            {actionKind === 'archive' || actionKind === 'restore' ? <Loader2 className="animate-spin" /> : archived ? <ArchiveRestore /> : <Archive />}
                                                            {tx(actionKind === 'archive' ? `Archiving ${rate.name}…` : actionKind === 'restore' ? `Restoring ${rate.name}…` : archived ? 'Restore rate' : 'Archive rate')}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            })}
                        </div>
                    </>
                )}
                    </Card>
                </div>

                <aside className="space-y-4 lg:col-span-4 sticky top-6" aria-label={tx('Rate review and reference')}>
                    <RateReviewRailWidget
                        dueReviewRates={dueReviewRates}
                        mostRecentReview={mostRecentReview}
                        defaultReviewIntervalDays={defaultReviewIntervalDays}
                        onOpenModal={() => { if (dueReviewRates.length > 0) setShowDueReviews(true) }}
                        onReviewRate={rate => {
                            setReviewError(null)
                            setReviewRate(rate)
                        }}
                    />
                    <RateBookReferenceCard />
                </aside>
            </div>

            <DueForReviewDialog
                open={showDueReviews}
                rates={dueReviewRates}
                onClose={() => setShowDueReviews(false)}
                onReview={rate => {
                    setShowDueReviews(false)
                    setReviewError(null)
                    setReviewRate(rate)
                }}
                onEdit={rate => {
                    setShowDueReviews(false)
                    setSaveError(null)
                    setDraft(rowToDraft(rate))
                }}
            />

            {usageRate && <SavedQualityUsageDialog rate={usageRate} onClose={() => setUsageRate(null)} />}

            <Dialog open={showConflicts && conflicts.length > 0} onOpenChange={setShowConflicts}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Review different saved rates</DialogTitle>
                        <DialogDescription>We found the same yarn at different rates in your Saved Qualities. Review the usages before changing the current Rate Book value. Existing costing snapshots remain unchanged.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        {conflicts.map(conflict => {
                            const qualityCount = new Set(conflict.usages.map(usage => usage.templateId)).size
                            return (
                                <div key={conflict.normalizedName} className="rounded-xl border border-warning/25 bg-warning-soft/70 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-bold text-ink">{conflict.yarnName}</p>
                                            <p className="mt-1 text-xs text-body">Used in {qualityCount} saved {qualityCount === 1 ? 'quality' : 'qualities'} · found {conflict.rates.map(rate => `₹${rate}/kg`).join(' and ')}</p>
                                        </div>
                                        <Button size="sm" onClick={() => editConflict(conflict)} className="shrink-0 bg-saffron text-white hover:bg-saffron-deep"><Pencil className="h-3.5 w-3.5" /> {tx('Change current rate')}</Button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {conflict.usages.slice(0, 6).map(usage => (
                                            <span key={`${usage.templateId}-${usage.layer}-${usage.layerNumber}`} className="rounded-full border border-warning/25 bg-surface px-2 py-1 text-[11px] font-medium text-body">
                                                {usage.templateName} · {usage.layer} {usage.layerNumber} · ₹{usage.rate}
                                            </span>
                                        ))}
                                        {conflict.usages.length > 6 && <span className="px-2 py-1 text-[11px] text-subtle">+{conflict.usages.length - 6} more</span>}
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
                    <SheetHeader className="border-b border-hairline px-6 py-5"><SheetTitle className="text-xl font-black">{tx(draft?.id ? `Change ${draft.name}` : 'Add Yarn Rate')}</SheetTitle><SheetDescription>{tx('Set the current rate used by matching Saved Quality layers.')}</SheetDescription></SheetHeader>
                    {draft && <div className="space-y-5 px-6 py-2">
                        <div role="status" aria-live="polite" className="flex gap-3 rounded-lg border border-info/25 bg-info-soft p-4 text-info"><Info className="mt-0.5 h-5 w-5 shrink-0" /><div><p className="text-sm font-bold">{draft.id
                            ? draftSavedQualityCount === 0
                                ? t('common.rate_update_no_saved_quality_summary')
                                : draftSavedQualityCount === 1
                                    ? t('common.rate_update_saved_quality_summary_one')
                                    : t('common.rate_update_saved_quality_summary_many', { count: draftSavedQualityCount })
                            : t('common.rate_add_future_estimate_summary')}</p><p className="mt-1 text-xs leading-relaxed">{t('common.rate_update_snapshot_summary')}</p></div></div>
                        <div className="space-y-1.5"><Label htmlFor="cost-rate-name">Yarn name</Label><Input id="cost-rate-name" value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. 30/1000 MUALTI" maxLength={120} disabled={Boolean(draft.id)} aria-invalid={Boolean(saveError)} aria-describedby={saveError ? 'cost-rate-save-error' : undefined} />{Boolean(draft.id) && <p className="text-xs leading-relaxed text-subtle"><span className="font-semibold text-body">Linked-yarn rename policy:</span> this name is locked in place. To rename it, add a new rate with the replacement name and update saved qualities intentionally. Historical costing snapshots stay unchanged.</p>}{saveError && <p id="cost-rate-save-error" role="alert" className="text-xs font-medium text-destructive">{tx(saveError)}</p>}</div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Used in</Label><select value={draft.category} onChange={event => changeCategory(event.target.value as YarnRateCategory)} disabled={Boolean(draft.id)} className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm disabled:bg-surface-soft">{YARN_CATEGORIES.map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select></div><div className="space-y-1.5"><Label>Unit</Label><Input value="₹ per kg" disabled className="bg-surface-soft" /></div></div>
                        {draft.id && <p className="-mt-3 text-xs leading-relaxed text-subtle">Category and unit stay fixed for a linked yarn so saved qualities and historical costings keep the same meaning.</p>}
                        <div className="space-y-1.5"><Label>{t('common.current_yarn_rate')}</Label><Input type="number" min="0" step="0.01" value={draft.currentValue} onChange={event => updateDraft('currentValue', parseNonNegativeInput(event.target.value) ?? 0)} className="font-mono" /></div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Effective from</Label><Input type="date" value={draft.effectiveDate} onChange={event => updateDraft('effectiveDate', event.target.value)} /></div><div className="space-y-1.5"><Label>Review date</Label><Input type="date" value={draft.lastReviewedAt} onChange={event => updateDraft('lastReviewedAt', event.target.value)} /></div></div>
                        <div className="space-y-1.5"><Label>Source</Label><Input value={draft.source} onChange={event => updateDraft('source', event.target.value)} placeholder="Supplier quote, email, internal rate card…" disabled={draftHasDiscoverySource} />{draftHasDiscoverySource && <p className="text-xs leading-relaxed text-subtle">This is the source where the yarn was first discovered. It stays tied to the initial saved quality or costing.</p>}</div>
                        <div className="space-y-1.5"><Label>Notes</Label><Textarea value={draftHasFabricUsage ? getCostRateDisplayNotes(draftRate ?? { notes: draft.notes ?? null, fabric_names: [] }) ?? draft.notes : draft.notes} onChange={event => updateDraft('notes', event.target.value)} placeholder="Why this rate changed or how it should be used" maxLength={500} disabled={draftHasFabricUsage} />{draftHasFabricUsage ? <p className="text-xs leading-relaxed text-subtle">Automatically lists every saved fabric that currently uses this yarn.</p> : <p className="text-right text-xs text-subtle">{draft.notes?.length ?? 0}/500</p>}</div>
                        <div className="space-y-1.5"><Label>Review every</Label><select value={draft.reviewIntervalDays} onChange={event => updateDraft('reviewIntervalDays', Number(event.target.value))} className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm"><option value="30">30 days</option><option value="60">60 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">12 months</option></select></div>
                    </div>}
                    <SheetFooter className="border-t border-hairline p-6 sm:flex-row"><Button variant="outline" onClick={() => setDraft(null)} className="flex-1" disabled={isPending}>{tx('Cancel')}</Button><Button variant="saffron" onClick={handleSave} disabled={isPending || !draft?.name.trim()} aria-describedby={!draft?.name.trim() ? 'cost-rate-save-hint' : undefined} className="flex-1">{isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isPending ? tx('Saving…') : tx('Save current rate')}</Button></SheetFooter>
                    {draft && !draft.name.trim() && <p id="cost-rate-save-hint" className="px-6 pb-5 text-xs font-medium text-warning">{tx('Enter a yarn name before saving this rate.')}</p>}
                </SheetContent>
            </Sheet>

            <Dialog open={Boolean(reviewRate)} onOpenChange={open => { if (!open && !isPending) { setReviewRate(null); setReviewError(null) } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm current rate?</DialogTitle>
                        <DialogDescription>Confirm that this displayed rate is correct. This records your review without changing the rate or existing costing snapshots.</DialogDescription>
                    </DialogHeader>
                    {reviewRate && <div className="space-y-3 rounded-lg border border-info/25 bg-info-soft p-4 text-info">
                        <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{reviewRate.name}</p><p className="mt-1 text-xs text-info">{COST_RATE_CATEGORY_LABELS[reviewRate.category]}</p></div><p className="font-mono text-lg font-black">{formatRateValue(Number(reviewRate.current_value), reviewRate.unit)}</p></div>
                        <p className="text-xs leading-relaxed text-info">Source: {getCostRateDisplaySource(reviewRate) || 'Not recorded'}</p>
                        {getCostRateDisplayNotes(reviewRate) && <p className="text-xs leading-relaxed text-info">{getCostRateDisplayNotes(reviewRate)}</p>}
                    </div>}
                    {reviewError && <p role="alert" className="text-sm font-medium text-destructive">{reviewError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setReviewRate(null); setReviewError(null) }} disabled={isPending}>{tx('Review later')}</Button>
                        <Button onClick={handleConfirmReview} disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {isPending ? tx('Confirming…') : tx('Confirm current rate')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Sheet open={Boolean(historyRate)} onOpenChange={open => { if (!open) { setHistoryRate(null); setHistoryError(null) } }}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                    <SheetHeader className="border-b border-hairline px-6 py-5">
                        <SheetTitle className="flex items-center gap-2"><History className="h-5 w-5 text-info" /> {historyRate?.name} activity</SheetTitle>
                        <SheetDescription>Reviews and saved values are shown here for audit. Existing costing snapshots retain their own numbers.</SheetDescription>
                    </SheetHeader>
                    <div className="px-6 py-2">
                        {historyLoading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-subtle" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-saffron" /> {tx('Loading rate activity…')}</div>
                            : historyError ? <div className="py-10 text-center text-sm font-medium text-destructive" role="alert">{historyError}</div>
                            : historyRows.length ? <div className="space-y-3">{historyRows.map((row, index) => {
                                const previous = row.previous_value ?? historyRows[index + 1]?.value
                                const eventLabel = historyRate ? getRateHistoryEventLabel(row.value, previous, historyRate.unit, row.event_type) : 'Value recorded'
                                return <div key={row.id} className="rounded-lg border border-hairline bg-surface p-4">
                                    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-base font-black text-ink">{historyRate ? formatRateValue(row.value, historyRate.unit) : row.value}</p><p className="mt-1 text-xs font-semibold text-body">{eventLabel}</p></div><p className="text-right text-xs text-subtle">Effective {formatDateOnly(row.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}<br />Recorded {formatSuratDateTime(row.created_at)}</p></div>
                                    <p className="mt-2 text-sm font-medium text-body">{row.source || 'No source recorded'}</p>{row.notes && <p className="mt-1 text-xs text-subtle">{row.notes}</p>}<p className="mt-2 text-[11px] text-subtle">Recorded by {row.actor_name || (row.changed_by ? 'owner' : 'system')}</p>
                                </div>
                            })}</div>
                            : <div className="py-10 text-center text-sm text-subtle">No activity recorded yet. Confirm or change this rate to create the first entry.</div>}
                    </div>
                    <SheetFooter className="border-t border-hairline p-6">
                        <Button variant="outline" onClick={() => { setHistoryRate(null); setHistoryError(null) }}>{tx('Close')}</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

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
