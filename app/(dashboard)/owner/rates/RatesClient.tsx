'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { RateBookTutorial, RateBookHelp, rateBookHelpCopy } from '@/components/rates/RateBookTutorial'
import { RateTrendDialog } from '@/components/rates/RateTrendDialog'
import type { RateBookStep } from '@/lib/rate-book-tour'
import { isSampleRecordId } from '@/lib/tours/sample-ids'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    AlertTriangle,
    Archive,
    ArchiveRestore,
    BookOpen,
    CalendarClock,
    ChartLine,
    CheckCircle2,
    ChevronDown,
    ChevronRight,
    History,
    Info,
    Loader2,
    Minus,
    MoreHorizontal,
    Pencil,
    Plus,
    Search,
    Sparkles,
    Tags,
    Trash2,
    TrendingDown,
    TrendingUp,
    X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SwitchField } from '@/components/ui/switch-field'
import { railPrimaryAction } from '@/components/ui/rail'
import { RailDialog } from '@/components/ui/rail-dialog'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { ArchivePolicyNotice } from '@/components/records/ArchivePolicyNotice'
import {
    archiveCostRate,
    confirmAllCostRateReviews,
    confirmCostRateReview,
    deleteCostRate,
    getCostRateUsage,
    getCostRateHistory,
    restoreCostRate,
    saveCostRate,
    type CostRateCategory,
    type CostRateInput,
    type CostRateUnit,
} from './actions'
import {
    COST_RATE_CATEGORY_LABELS,
    filterCostRates,
    formatRateValue,
    getCostRateDisplayNotes,
    getCostRateDisplaySource,
    getRatePriceDelta,
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
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import PlanAnalyticsBeacon from '@/components/billing/PlanAnalyticsBeacon'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import { liteRecordsCopy } from '@/lib/i18n/lite-records'
import { MOBILE_WORKSPACE_QUERY } from '@/lib/mobile-workflow-navigation'
import mobileStyles from '@/components/estimator/lite-records.module.css'

type YarnRateCategory = Extract<CostRateCategory, 'yarn_warp' | 'yarn_weft'>
type YarnDirectionFilter = 'all' | YarnRateCategory
type RateStatusFilter = 'all' | 'needs_review'

const DIRECTION_OPTIONS: { value: YarnDirectionFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'yarn_warp', label: 'Warp' },
    { value: 'yarn_weft', label: 'Weft' },
]

export const DEMO_YARN_STORAGE_KEY = 'weavly:demo-yarn-rate-deleted'

export const DEMO_YARN_RATE: CostRateRow = {
    id: 'demo-sample-yarn-rate',
    name: '30/1000 MUALTI Cotton',
    category: 'yarn_warp',
    unit: 'per_kg',
    current_value: 285,
    previous_value: 280,
    effective_date: '2026-08-01',
    last_reviewed_at: '2026-06-01',
    review_interval_days: 30,
    source: 'Surat Central Market',
    notes: 'Tour sample entry for learning the rate catalog',
    apply_as_default: false,
    updated_at: '2026-08-01T00:00:00.000Z',
    is_active: true,
    is_reviewed: false,
    discovery_source: 'saved_costing',
    fabric_names: ['Cotton Roto Sheeting'],
    saved_quality_count: 1,
}
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
    kind: 'save' | 'review' | 'archive' | 'restore' | 'delete'
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

function LinkedQualitiesPopover({
    rate,
    usageNames,
}: {
    rate: CostRateRow
    usageNames: string[]
}) {
    const isCosting = rate.discovery_source === 'saved_costing'
    const count = usageNames.length
    const qualityWord = count === 1 ? 'quality' : 'qualities'
    const fullWord = count === 1 ? 'fabric quality' : 'fabric qualities'
    const label = `${count} ${qualityWord}`

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="group inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-saffron/30 bg-saffron-soft/60 px-2.5 py-1 text-left text-xs font-semibold text-saffron-deep transition-colors hover:border-saffron/50 hover:bg-saffron-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50 focus-visible:ring-offset-1"
                    aria-label={`View ${count} linked ${qualityWord} for ${rate.name}`}
                >
                    <Tags className="h-3.5 w-3.5 shrink-0 text-saffron-deep/80 group-hover:text-saffron-deep" aria-hidden="true" />
                    <span>{label}</span>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-saffron-deep/70 transition-transform duration-200 group-data-[state=open]:rotate-180 group-hover:text-saffron-deep" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-panel)]"
            >
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-subtle">
                        {isCosting ? 'Saved Costings' : 'Linked Qualities'}
                    </p>
                    <p className="mt-1 text-xs font-bold text-ink">
                        Used in {count} active {fullWord}
                    </p>
                </div>

                <div className="mt-3 max-h-48 space-y-1.5 overflow-y-auto pr-1">
                    {usageNames.map((name, index) => (
                        <div
                            key={`${name}-${index}`}
                            className="flex items-center gap-2 rounded-md bg-surface-soft/60 px-2.5 py-1.5 text-xs font-medium text-body"
                        >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                            <span className="truncate">{name}</span>
                        </div>
                    ))}
                </div>

                {(rate.source || rate.notes) && (
                    <div className="mt-3 space-y-1 border-t border-hairline pt-2.5 text-[11px] text-subtle">
                        {rate.source && (
                            <p className="break-words">
                                <span className="font-semibold text-ink">Source:</span> {rate.source}
                            </p>
                        )}
                        {rate.notes && (
                            <p className="break-words">
                                <span className="font-semibold text-ink">Notes:</span> {rate.notes}
                            </p>
                        )}
                    </div>
                )}

                <p className="mt-2.5 border-t border-hairline/60 pt-2 text-[10px] leading-relaxed text-subtle">
                    Future estimates for these fabrics will use this rate.
                </p>
            </PopoverContent>
        </Popover>
    )
}

function LinkedQualitiesCell({ rate }: { rate: CostRateRow }) {
    const usageNames = getRateUsageNames(rate)
    if (usageNames.length) {
        return (
            <div className="space-y-1">
                <LinkedQualitiesPopover rate={rate} usageNames={usageNames} />
                {rate.source && (
                    <p className="truncate text-[11px] text-subtle" title={rate.source}>{rate.source}</p>
                )}
            </div>
        )
    }

    return (
        <div>
            <p className="break-words text-[11px] font-medium text-ink">{getCostRateDisplaySource(rate) || 'No source recorded'}</p>
            <p className="mt-1 whitespace-normal break-words text-[11px] leading-snug text-subtle">{getCostRateDisplayNotes(rate) || 'No notes'}</p>
        </div>
    )
}

function QuickRateEditDialog({
    rate,
    onOpenChange,
    value,
    onChangeValue,
    source,
    onChangeSource,
    error,
    isPending,
    onSave,
    onOpenAdvanced,
}: {
    rate: CostRateRow | null
    onOpenChange: (open: boolean) => void
    value: number | string
    onChangeValue: (val: number | string) => void
    source: string
    onChangeSource: (src: string) => void
    error: string | null
    isPending: boolean
    onSave: (rate: CostRateRow, val: number, src: string) => void
    onOpenAdvanced: (rate: CostRateRow) => void
}) {
    const { tx } = useTranslation()
    const inputRef = useRef<HTMLInputElement>(null)
    const savedQualityCount = rate ? getSavedQualityCount(rate) : 0

    const rawVal = Number(value)
    const isValueValid = value !== '' && Number.isFinite(rawVal) && rawVal >= 0 && rawVal <= 10_000_000
    const previewVal = isValueValid || !rate ? rawVal : Number(rate.current_value)

    const handleSubmit = () => {
        if (!rate || !isValueValid) return
        onSave(rate, rawVal, source)
    }

    return (
        <Dialog open={Boolean(rate)} onOpenChange={onOpenChange}>
            <DialogContent
                data-ratebook-field="quickEditDialog"
                className="sm:max-w-md"
                onOpenAutoFocus={(e) => {
                    e.preventDefault()
                    try {
                        inputRef.current?.focus()
                        inputRef.current?.select()
                    } catch {
                        inputRef.current?.focus()
                    }
                }}
            >
                {rate && (
                    <>
                        <DialogHeader className="pr-9">
                            <DialogTitle>{tx('Edit rate')}</DialogTitle>
                            <DialogDescription>
                                <span className="flex items-start justify-between gap-2">
                                    <span className="min-w-0 truncate font-semibold text-ink" title={rate.name}>
                                        {rate.name}
                                    </span>
                                    <span className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-[11px] font-semibold text-subtle">
                                        {rate.category === 'yarn_warp' ? 'Warp yarn' : 'Weft yarn'}
                                    </span>
                                </span>
                                <span className="mt-1 block text-xs text-subtle">
                                    Current: <span className="font-mono font-semibold text-ink">{formatRateValue(rate.current_value, rate.unit)}</span>
                                </span>
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label htmlFor={`quick-rate-${rate.id}`}>
                                    {tx('New Rate')}
                                </Label>
                                <div className="relative">
                                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm font-bold text-subtle">
                                        ₹
                                    </span>
                                    <Input
                                        ref={inputRef}
                                        id={`quick-rate-${rate.id}`}
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={value}
                                        onChange={e => onChangeValue(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault()
                                                handleSubmit()
                                            }
                                        }}
                                        className="pl-7 pr-14 font-mono text-base font-bold"
                                        disabled={isPending}
                                        placeholder="0.00"
                                    />
                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-xs text-subtle">
                                        /kg
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs text-subtle">{tx('Trend preview:')}</span>
                                    <PriceDeltaBadge
                                        currentValue={previewVal}
                                        previousValue={Number(rate.current_value)}
                                        unit={rate.unit}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor={`quick-source-${rate.id}`}>
                                    {tx('Source / Broker note (optional)')}
                                </Label>
                                <Input
                                    id={`quick-source-${rate.id}`}
                                    type="text"
                                    value={source}
                                    onChange={e => onChangeSource(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault()
                                            handleSubmit()
                                        }
                                    }}
                                    placeholder="Broker note, email..."
                                    disabled={isPending}
                                />
                            </div>

                            <div className="rounded-lg border border-hairline/60 bg-surface-soft/50 p-3 text-xs leading-relaxed text-subtle">
                                {savedQualityCount > 0 ? (
                                    <p>
                                        {tx(`Updates future estimates for ${savedQualityCount} saved ${savedQualityCount === 1 ? 'quality' : 'qualities'}. Past snapshots unchanged.`)}
                                    </p>
                                ) : (
                                    <p>
                                        {tx('Updates future estimates. Past snapshots unchanged.')}
                                    </p>
                                )}
                            </div>

                            {error && (
                                <p role="alert" className="text-xs font-semibold text-risk">{error}</p>
                            )}

                            <button
                                type="button"
                                onClick={() => onOpenAdvanced(rate)}
                                disabled={isPending}
                                className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline decoration-hairline-strong underline-offset-4 hover:decoration-ink focus-visible:outline-none focus-visible:decoration-ink disabled:opacity-60 sm:min-h-9"
                            >
                                {tx('Advanced settings (dates, review interval)...')}
                            </button>
                        </div>

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isPending}
                            >
                                {tx('Cancel')}
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isPending || !isValueValid}
                            >
                                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                {isPending ? tx('Saving…') : tx('Save Rate')}
                            </Button>
                        </DialogFooter>
                    </>
                )}
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
    onConfirmAll,
    isConfirmingAll = false,
    pendingActionId = null,
    hideOverlay = false,
}: {
    open: boolean
    rates: CostRateRow[]
    onClose: () => void
    onReview: (rate: CostRateRow) => void
    onEdit: (rate: CostRateRow) => void
    onConfirmAll?: () => void
    isConfirmingAll?: boolean
    pendingActionId?: string | null
    hideOverlay?: boolean
}) {
    return (
        <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose() }}>
            <DialogContent hideOverlay={hideOverlay} className="border-0 bg-transparent p-0 shadow-none sm:max-w-[680px]">
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
                        <div className="flex flex-wrap items-center gap-2">
                            {rates.length > 0 && onConfirmAll && (
                                <Button
                                    type="button"
                                    size="sm"
                                    onClick={onConfirmAll}
                                    disabled={isConfirmingAll}
                                    className="h-8 rounded-full border-0 bg-loom px-3.5 text-xs font-bold text-white shadow-none hover:bg-loom-elevated hover:text-white"
                                >
                                    {isConfirmingAll ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
                                    {isConfirmingAll ? 'Confirming all…' : `Confirm All (${rates.length}) as Current`}
                                </Button>
                            )}
                            <span className="shrink-0 rounded-full bg-warning-soft px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] text-warning">
                                {rates.length} {rates.length === 1 ? 'rate' : 'rates'}
                            </span>
                        </div>
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
                                    className={`rounded-xl border p-4 ${reviewState === 'overdue' ? 'border-risk/30 bg-risk-soft/70' : reviewState === 'due_soon' ? 'border-warning/30 bg-warning-soft/70' : 'border-wv-neel-900/25 bg-wv-neel-200/45'}`}
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
                                            disabled={pendingActionId === rate.id || isConfirmingAll}
                                            aria-label={`Review ${rate.name}`}
                                            className="h-9 rounded-full border-0 bg-loom px-4 text-white shadow-none hover:bg-loom-elevated hover:text-white"
                                        >
                                            {pendingActionId === rate.id ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />} Review
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

function PriceDeltaBadge({
    currentValue,
    previousValue,
    unit = 'per_kg',
    className = '',
}: {
    currentValue: number
    previousValue: number | null | undefined
    unit?: CostRateUnit
    className?: string
}) {
    const delta = getRatePriceDelta(currentValue, previousValue, unit)

    if (delta.direction === 'increased') {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded-md border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--wv-ochre-800)] ${className}`}
                title={delta.previousValueFormatted ? `Previous rate: ${delta.previousValueFormatted}` : undefined}
            >
                <TrendingUp className="h-3 w-3 shrink-0 text-[var(--wv-ochre-800)]" aria-hidden="true" />
                <span>{delta.formattedDifference}</span>
                {delta.formattedPercent && <span className="opacity-80">({delta.formattedPercent})</span>}
            </span>
        )
    }

    if (delta.direction === 'decreased') {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded-md border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--wv-moss-700)] ${className}`}
                title={delta.previousValueFormatted ? `Previous rate: ${delta.previousValueFormatted}` : undefined}
            >
                <TrendingDown className="h-3 w-3 shrink-0 text-[var(--wv-moss-700)]" aria-hidden="true" />
                <span>{delta.formattedDifference}</span>
                {delta.formattedPercent && <span className="opacity-80">({delta.formattedPercent})</span>}
            </span>
        )
    }

    if (delta.direction === 'unchanged') {
        return (
            <span
                className={`inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-soft/80 px-1.5 py-0.5 text-[10px] font-medium text-subtle ${className}`}
                title={delta.previousValueFormatted ? `Previous rate: ${delta.previousValueFormatted}` : undefined}
            >
                <Minus className="h-2.5 w-2.5 shrink-0 text-subtle/70" aria-hidden="true" />
                <span>Unchanged</span>
            </span>
        )
    }

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md border border-hairline/60 bg-surface-soft/40 px-1.5 py-0.5 text-[10px] font-normal italic text-subtle ${className}`}
            title="Initial rate recorded"
        >
            <span>Initial rate</span>
        </span>
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
}: {
    dueReviewRates: CostRateRow[]
    mostRecentReview: string | null
    defaultReviewIntervalDays: number
    onOpenModal: () => void
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

                        <div
                            className="flex items-center justify-between gap-3 rounded-xl border border-hairline/80 bg-surface-soft/60 px-3 py-2.5"
                            aria-label={tx(`${dueCount} pending ${dueCount === 1 ? 'rate' : 'rates'}`)}
                        >
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-subtle">{tx('Pending Rates')}</p>
                                <p className="mt-0.5 text-xs font-semibold text-ink">{tx('Awaiting review')}</p>
                            </div>
                            <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-warning/20 px-2.5 text-sm font-black text-saffron-deep">
                                {dueCount}
                            </span>
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
    const { tx, language } = useTranslation()
    const copy = rateBookHelpCopy[language]
    // A pill that opens a modal, like the help and archive pills it sits beside in the bottom stack of the right rail.
    return (
        <RailDialog icon={BookOpen} title={tx('Rate Book Principles')} lang={language} i18nSkip>
            <ul className="space-y-3 rounded-xl border border-hairline bg-surface-soft/60 p-3.5 text-sm leading-relaxed text-body">
                {copy.principles.map(principle => (
                    <li key={principle} className="flex items-start gap-2.5">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                        <span>{principle}</span>
                    </li>
                ))}
            </ul>
        </RailDialog>
    )
}

function RateReviewFloatingButton({
    dueReviewRates,
    onOpenModal,
    liteMobile = false,
}: {
    dueReviewRates: CostRateRow[]
    onOpenModal: () => void
    liteMobile?: boolean
}) {
    const { tx } = useTranslation()
    const dueCount = dueReviewRates.length

    if (dueCount === 0) return null

    return (
        <button
            type="button"
            onClick={onOpenModal}
            aria-haspopup="dialog"
            aria-label={tx(`Open ${dueCount} rates due for review`)}
            className={cn("rail-inline-actions fixed bottom-[calc(var(--mobile-nav-height)+0.75rem)] right-4 z-40 inline-flex min-h-11 items-center gap-2.5 rounded-full bg-saffron px-4 py-3 text-sm font-bold text-white shadow-[var(--shadow-panel)] transition-colors hover:bg-saffron-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron focus-visible:ring-offset-2 md:bottom-6 md:right-6", liteMobile && mobileStyles.floating)}
        >
            <CalendarClock className="h-5 w-5" aria-hidden="true" />
            <span>{tx(dueCount === 1 ? '1 Rate Needs Review' : `${dueCount} Rates Need Review`)}</span>
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-black text-saffron-deep">
                {dueCount}
            </span>
        </button>
    )
}

export default function RatesClient({
    initialRates,
    initialConflicts,
    defaultReviewIntervalDays,
    userMetadata,
    userId = 'owner',
    orgId = 'org',
}: {
    initialRates: CostRateRow[]
    initialConflicts: YarnRateConflict[]
    defaultReviewIntervalDays: number
    userMetadata?: Record<string, unknown> | null
    userId?: string
    orgId?: string
}) {
    const { t, tx, language } = useTranslation()
    const isLite = useOwnerPlan() === 'lite'
    const mobileCopy = liteRecordsCopy[language]
    const [helpOpen, setHelpOpen] = useState(false)
    const [filtersOpen, setFiltersOpen] = useState(false)
    useEffect(() => {
        if (!isLite || !helpOpen || !window.matchMedia(MOBILE_WORKSPACE_QUERY).matches) return
        const frame = requestAnimationFrame(() => document.getElementById('lite-ratebook-help')?.querySelector<HTMLButtonElement>('button')?.focus())
        return () => cancelAnimationFrame(frame)
    }, [helpOpen, isLite])
    const [demoYarnDeleted, setDemoYarnDeleted] = useState(false)
    const [showDeleteNudge, setShowDeleteNudge] = useState(false)

    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && localStorage.getItem(DEMO_YARN_STORAGE_KEY) === 'true') {
                setDemoYarnDeleted(true)
            }
        } catch {}
    }, [])

    const [rates, setRates] = useState<CostRateRow[]>(() => {
        if (initialRates.length === 0) {
            if (typeof window !== 'undefined') {
                try {
                    if (localStorage.getItem(DEMO_YARN_STORAGE_KEY) === 'true') {
                        return []
                    }
                } catch {}
            }
            return [DEMO_YARN_RATE]
        }
        return initialRates
    })

    const handleDeleteDemoYarn = useCallback(() => {
        setDemoYarnDeleted(true)
        setShowDeleteNudge(false)
        setRates(current => current.filter(r => r.id !== DEMO_YARN_RATE.id))
        try {
            localStorage.setItem(DEMO_YARN_STORAGE_KEY, 'true')
        } catch {}
    }, [])

    const [categoryFilter, setCategoryFilter] = useState<YarnDirectionFilter>('all')
    const [statusFilter, setStatusFilter] = useState<RateStatusFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [showArchived, setShowArchived] = useState(false)
    const [tourStep, setTourStep] = useState<RateBookStep | null>(null)
    const searchRef = useRef<HTMLInputElement>(null)
    const [draft, setDraft] = useState<CostRateInput | null>(null)
    const [showDueReviews, setShowDueReviews] = useState(false)
    const [historyRate, setHistoryRate] = useState<CostRateRow | null>(null)
    const [historyMode, setHistoryMode] = useState<'activity' | 'trend'>('activity')
    const [historyRows, setHistoryRows] = useState<RateHistoryRow[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [reviewRate, setReviewRate] = useState<CostRateRow | null>(null)
    const [reviewError, setReviewError] = useState<string | null>(null)
    const [archiveRate, setArchiveRate] = useState<CostRateRow | null>(null)
    const [archiveError, setArchiveError] = useState<string | null>(null)
    const [deleteRate, setDeleteRate] = useState<CostRateRow | null>(null)
    const [deleteError, setDeleteError] = useState<string | null>(null)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [conflicts, setConflicts] = useState(initialConflicts)
    const [showConflicts, setShowConflicts] = useState(initialConflicts.length > 0)
    const [usageLoading, setUsageLoading] = useState(true)
    const [usageError, setUsageError] = useState<string | null>(null)
    const [quickEditRate, setQuickEditRate] = useState<CostRateRow | null>(null)
    const [quickEditValue, setQuickEditValue] = useState<number | string>('')
    const [quickEditSource, setQuickEditSource] = useState('')
    const [quickEditError, setQuickEditError] = useState<string | null>(null)
    const [isPending, startTransition] = useTransition()
    const [pendingAction, setPendingAction] = useState<PendingRateAction | null>(null)
    const liteMutationInFlight = useRef(false)
    const beginLiteMutation = () => {
        if (!isLite || !window.matchMedia(MOBILE_WORKSPACE_QUERY).matches) return true
        if (liteMutationInFlight.current) return false
        liteMutationInFlight.current = true
        return true
    }

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (tourStep !== null || event.ctrlKey || event.metaKey || event.altKey) return

            const activeElement = document.activeElement
            const isInputFocused =
                activeElement instanceof HTMLInputElement ||
                activeElement instanceof HTMLTextAreaElement ||
                activeElement instanceof HTMLSelectElement ||
                Boolean(activeElement?.getAttribute('contenteditable'))

            const isModalOpen = Boolean(
                draft || showDueReviews || historyRate ||
                reviewRate || archiveRate || deleteRate || showConflicts || quickEditRate
            )

            if (event.key === '/' && !isInputFocused && !isModalOpen) {
                event.preventDefault()
                searchRef.current?.focus()
                searchRef.current?.select()
            }

            if (event.key === 'Escape' && document.activeElement === searchRef.current) {
                if (searchQuery) {
                    setSearchQuery('')
                }
                searchRef.current?.blur()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [draft, showDueReviews, historyRate, reviewRate, archiveRate, deleteRate, showConflicts, quickEditRate, searchQuery, tourStep])

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
    const archivedYarnRates = useMemo(() => yarnRates.filter(rate => rate.is_active === false), [yarnRates])
    const targetYarnRates = tourStep !== null ? activeYarnRates : showArchived ? archivedYarnRates : activeYarnRates

    const allRatesCount = targetYarnRates.length
    const warpRatesCount = useMemo(() => targetYarnRates.filter(rate => rate.category === 'yarn_warp').length, [targetYarnRates])
    const weftRatesCount = useMemo(() => targetYarnRates.filter(rate => rate.category === 'yarn_weft').length, [targetYarnRates])

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

    const filteredRates = useMemo(
        () => filterCostRates(targetYarnRates, {
            query: tourStep !== null ? '' : searchQuery,
            category: tourStep !== null ? 'all' : categoryFilter,
            status: tourStep !== null ? 'all' : statusFilter,
        }),
        [targetYarnRates, searchQuery, categoryFilter, statusFilter, tourStep],
    )

    const visibleRates = useMemo(
        () => [...filteredRates].sort((left, right) => {
            if (tourStep === null && showArchived) return left.name.localeCompare(right.name, 'en-IN')
            return REVIEW_STATUS_PRIORITY[getRateReviewStatus(left)] - REVIEW_STATUS_PRIORITY[getRateReviewStatus(right)]
                || left.name.localeCompare(right.name, 'en-IN')
        }),
        [filteredRates, showArchived, tourStep],
    )

    const resultMotionKey = `${categoryFilter}|${statusFilter}|${showArchived ? 'archived' : 'active'}|${searchQuery.trim()}|${visibleRates.length}`
    const selectedCategoryLabel = categoryFilter === 'all' ? 'All' : categoryFilter === 'yarn_warp' ? 'Warp' : 'Weft'
    const hasActiveFilters = Boolean(searchQuery.trim()) || statusFilter !== 'all' || categoryFilter !== 'all'

    const resetFilters = () => {
        setSearchQuery('')
        setStatusFilter('all')
        setCategoryFilter('all')
    }

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
        if (isSampleRecordId(target.id)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        if (!beginLiteMutation()) return
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
                liteMutationInFlight.current = false
            }
        })
    }

    const quickEditPending = Boolean(quickEditRate) && isPending && pendingAction?.id === quickEditRate?.id

    const openQuickEdit = (rate: CostRateRow) => {
        setQuickEditRate(rate)
        setQuickEditValue(rate.current_value)
        setQuickEditSource(rate.source ?? '')
        setQuickEditError(null)
    }

    const openAdvancedDraft = (rate: CostRateRow) => {
        setQuickEditRate(null)
        setSaveError(null)
        const nextDraft = rowToDraft(rate)
        const parsed = Number(quickEditValue)
        if (quickEditValue !== '' && Number.isFinite(parsed) && parsed >= 0) {
            nextDraft.currentValue = parsed
        }
        if (quickEditSource.trim()) {
            nextDraft.source = quickEditSource.trim()
        }
        setDraft(nextDraft)
    }

    const handleQuickSave = (rate: CostRateRow, newValue: number, newSource: string) => {
        if (rate.id === DEMO_YARN_RATE.id) {
            setRates(current => current.map(r => r.id === rate.id
                ? { ...r, current_value: newValue, previous_value: r.current_value, source: newSource.trim() || r.source, updated_at: new Date().toISOString() }
                : r))
            setQuickEditRate(null)
            toast.success(tx('Rate updated.'))
            return
        }
        const target: CostRateInput = {
            id: rate.id,
            expectedUpdatedAt: rate.updated_at,
            name: rate.name,
            category: rate.category,
            unit: rate.unit,
            currentValue: newValue,
            effectiveDate: today(),
            lastReviewedAt: today(),
            reviewIntervalDays: Number(rate.review_interval_days),
            source: newSource.trim() || (rate.source ?? ''),
            notes: rate.notes ?? '',
            applyAsDefault: rate.apply_as_default,
        }
        setQuickEditError(null)
        if (!beginLiteMutation()) return
        setPendingAction({ id: rate.id, kind: 'save' })
        startTransition(async () => {
            try {
                const result = await saveCostRate(target)
                if (result.error || !result.data) {
                    const message = userFacingError(result.error, 'Rate could not be saved.')
                    setQuickEditError(message)
                    toast.error(tx(message))
                    return
                }
                const savedRate = result.data as CostRateRow
                setRates(current => {
                    const previousRate = current.find(r => r.id === savedRate.id)
                    const next = current.filter(r => r.id !== savedRate.id)
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
                setQuickEditError(null)
                setQuickEditRate(null)
                if (result.syncedQualityCount) {
                    toast.success(tx(`Rate saved and updated in ${result.syncedQualityCount} Saved ${result.syncedQualityCount === 1 ? 'Quality' : 'Qualities'}. Existing costing snapshots were not changed.`))
                } else {
                    toast.success(tx('Rate updated. Existing costing snapshots were not changed.'))
                }
                void trackPlanEvent('rate_book_action', {
                    action: 'update',
                    category: target.category,
                })
            } catch (error) {
                const message = userFacingError(error, 'Rate could not be saved. Try again.')
                setQuickEditError(message)
                toast.error(tx(message))
            } finally {
                setPendingAction(null)
                liteMutationInFlight.current = false
            }
        })
    }

    const handleConfirmReview = () => {
        if (!reviewRate) return
        const target = reviewRate
        if (target.id === DEMO_YARN_RATE.id) {
            setRates(current => current.map(rate => rate.id === target.id
                ? { ...rate, is_reviewed: true, last_reviewed_at: getSuratTodayString() }
                : rate))
            toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Existing costing snapshots were not changed.`))
            setReviewRate(null)
            return
        }
        setReviewError(null)
        if (!beginLiteMutation()) return
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
                liteMutationInFlight.current = false
            }
        })
    }

    const handleQuickReview = (target: CostRateRow) => {
        if (target.id === DEMO_YARN_RATE.id) {
            setRates(current => current.map(rate => rate.id === target.id
                ? { ...rate, is_reviewed: true, last_reviewed_at: getSuratTodayString() }
                : rate))
            toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Existing costing snapshots were not changed.`))
            return
        }
        setReviewError(null)
        if (!beginLiteMutation()) return
        setPendingAction({ id: target.id, kind: 'review' })
        startTransition(async () => {
            try {
                const result = await confirmCostRateReview(target.id, target.updated_at)
                if (result.error || !result.data) {
                    const message = tx(userFacingError(result.error, 'The current rate could not be confirmed. Try again.'))
                    toast.error(message)
                    return
                }
                const savedRate = result.data as CostRateRow
                setRates(current => current.map(rate => rate.id === target.id
                    ? { ...rate, ...savedRate, is_reviewed: true }
                    : rate))
                toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Existing costing snapshots were not changed.`))
                void trackPlanEvent('rate_book_action', { action: 'review', category: target.category })
            } catch (error) {
                const message = tx(userFacingError(error, 'The current rate could not be confirmed. Try again.'))
                toast.error(message)
            } finally {
                setPendingAction(null)
                liteMutationInFlight.current = false
            }
        })
    }

    const handleConfirmAll = () => {
        if (dueReviewRates.length === 0) return
        const targetRates = [...dueReviewRates]
        const realRates = targetRates.filter(r => r.id !== DEMO_YARN_RATE.id)
        if (realRates.length === 0) {
            setRates(current => current.map(r => r.id === DEMO_YARN_RATE.id ? { ...r, is_reviewed: true, last_reviewed_at: getSuratTodayString() } : r))
            toast.success(tx(`Confirmed 1 yarn rate as current. Existing costing snapshots were not changed.`))
            setShowDueReviews(false)
            return
        }
        if (!beginLiteMutation()) return
        setPendingAction({ id: 'all-review', kind: 'review' })
        startTransition(async () => {
            try {
                const payload = realRates.map(r => ({ id: r.id, expectedUpdatedAt: r.updated_at }))
                const result = await confirmAllCostRateReviews(payload)
                if (result.error || !result.data) {
                    const message = tx(userFacingError(result.error, 'Could not confirm all rates. Refresh and try again.'))
                    toast.error(message)
                    return
                }
                const updatedMap = new Map((result.data as CostRateRow[]).map(r => [r.id, r]))
                setRates(current => current.map(rate => {
                    if (rate.id === DEMO_YARN_RATE.id) {
                        return { ...rate, is_reviewed: true, last_reviewed_at: getSuratTodayString() }
                    }
                    const updated = updatedMap.get(rate.id)
                    return updated ? { ...rate, ...updated, is_reviewed: true } : rate
                }))
                const count = (result.count ?? realRates.length) + (targetRates.length - realRates.length)
                toast.success(tx(`Confirmed ${count} yarn ${count === 1 ? 'rate' : 'rates'} as current. Existing costing snapshots were not changed.`))
                void trackPlanEvent('rate_book_action', { action: 'confirm_all_reviews', count })
                setShowDueReviews(false)
            } catch (error) {
                const message = tx(userFacingError(error, 'Could not confirm all rates. Refresh and try again.'))
                toast.error(message)
            } finally {
                setPendingAction(null)
                liteMutationInFlight.current = false
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

    const openHistory = async (rate: CostRateRow, mode: 'activity' | 'trend' = 'activity') => {
        if (isSampleRecordId(rate.id)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        setHistoryRate(rate)
        setHistoryMode(mode)
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
        if (isSampleRecordId(target.id)) {
            toast.info(tourCommonCopy[language].sampleBanner)
            return
        }
        const restoring = target.is_active === false
        setArchiveError(null)
        if (!beginLiteMutation()) return
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
                                if (!beginLiteMutation()) return
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
                                        liteMutationInFlight.current = false
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
                liteMutationInFlight.current = false
            }
        })
    }

    const handleDelete = () => {
        if (!deleteRate) return
        const target = deleteRate
        if (target.id === DEMO_YARN_RATE.id) {
            handleDeleteDemoYarn()
            setDeleteRate(null)
            toast.success(tx('Sample yarn rate removed from Rate Book.'))
            return
        }
        setDeleteError(null)
        if (!beginLiteMutation()) return
        setPendingAction({ id: target.id, kind: 'delete' })
        startTransition(async () => {
            try {
                const result = await deleteCostRate(target.id)
                if (result.error) {
                    const message = tx(userFacingError(result.error, 'The yarn rate could not be deleted. Try again.'))
                    setDeleteError(message)
                    toast.error(message)
                    return
                }
                setRates(current => current.filter(rate => rate.id !== target.id))
                toast.success(tx('Unused yarn rate removed from Rate Book.'))
                setDeleteRate(null)
            } catch (error) {
                const message = tx(userFacingError(error, 'Rate could not be deleted. Try again.'))
                setDeleteError(message)
                toast.error(message)
            } finally {
                setPendingAction(null)
                liteMutationInFlight.current = false
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
        <>
            {/* Rate Book Left Rail - pinned to top of left rail beside sidebar, matching the Cost Estimator left rail pattern */}
            <aside id={isLite ? 'lite-ratebook-help' : undefined} data-expanded={helpOpen || tourStep !== null} className={cn("phone-guidance rates-left-rail-desktop space-y-3", isLite && mobileStyles.help)} aria-label={tx('Rate Book guides and tools')}>
                <RateBookTutorial
                    enabled={!isPending}
                    orgId={orgId}
                    userId={userId}
                    userMetadata={userMetadata}
                    step={tourStep}
                    onStepChange={setTourStep}
                    sampleRow={isSampleRecordId(visibleRates[0]?.id)}
                    hasRealRates={activeYarnRates.some(rate => !isSampleRecordId(rate.id))}
                    onTourFinish={() => {
                        if (!demoYarnDeleted && rates.some(r => r.id === DEMO_YARN_RATE.id)) {
                            setShowDeleteNudge(true)
                        }
                    }}
                />
                {/* From 1280px the help pill lives in the right rail instead (`rail-inline-actions` hides this copy). */}
                <div className="left-rail-bottom rail-inline-actions mt-auto pt-3">
                    <RateBookHelp />
                </div>
            </aside>

            <div className={cn("rates-workspace ui-route-enter mx-auto w-full max-w-7xl space-y-6", isLite && mobileStyles.workspace)} data-lite-rates={isLite || undefined} data-ratebook-tutorial-root="true">
            <PlanAnalyticsBeacon eventName="rate_book_viewed" />
            {/* Rate Book is part of both Lite and Base and is the source of truth for yarn prices. */}
            <RouteMilestones
                route="/owner/rates"
                shellVisible
                primaryUsable
                secondaryReady={!usageLoading}
            />
            <div className="space-y-1" data-ratebook-field="overview">
                <PageHeader
                    className={isLite ? mobileStyles.header : undefined}
                    title={t('common.yarn_rate_book')}
                    actions={(
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            {isLite && <Button type="button" variant="outline" className={cn(mobileStyles.mobileOnly, "phone-guidance")} aria-controls="lite-ratebook-help" aria-expanded={helpOpen || tourStep !== null} onClick={() => setHelpOpen(open => !open)} data-i18n-skip="true" lang={language}>{mobileCopy.help}</Button>}
                            <Button
                                data-ratebook-field="addRateAction"
                                onClick={() => { setSaveError(null); setDraft(defaultDraft(defaultReviewIntervalDays)) }}
                                className="rail-inline-actions h-10 w-full sm:w-auto rounded-xl bg-loom px-4 font-medium text-white shadow-xs hover:bg-loom-elevated hover:text-white focus-visible:ring-saffron"
                            >
                                <Plus className="h-4 w-4" aria-hidden="true" />
                                <span>{t('tourControls.rateBook.addRate')}</span>
                            </Button>
                        </div>
                    )}
                />
            </div>

            {showDeleteNudge && !demoYarnDeleted && rates.some(r => r.id === DEMO_YARN_RATE.id) && (
                <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)]/90 p-3.5 text-sm text-[var(--wv-ochre-800)] shadow-xs animate-in fade-in-0 duration-200"
                >
                    <div className="flex items-center gap-2.5">
                        <Sparkles className="h-5 w-5 shrink-0 text-[var(--wv-ochre-800)]" aria-hidden="true" />
                        <div>
                            <p className="font-semibold text-ink">{tx('Tour completed')}</p>
                            <p className="text-xs text-[var(--wv-ochre-800)]/90">{tx('A sample yarn rate was added so you could explore Rate Book features. You can delete it anytime.')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-[var(--wv-ochre-200)] bg-surface text-xs font-semibold text-[var(--wv-ochre-800)] hover:bg-[var(--wv-ochre-50)]"
                            onClick={handleDeleteDemoYarn}
                        >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-[var(--wv-ochre-800)]" aria-hidden="true" />
                            {tx('Delete sample yarn')}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-[var(--wv-ochre-800)] hover:text-ink"
                            onClick={() => setShowDeleteNudge(false)}
                        >
                            {tx('Dismiss')}
                        </Button>
                    </div>
                </div>
            )}

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
                <div className="ui-status-enter flex flex-col gap-4 rounded-xl border border-warning/35 bg-warning-soft p-4 text-ink sm:flex-row sm:items-center sm:justify-between">
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

            {isLite && dueReviewRates.length > 0 && <button type="button" className={cn(mobileStyles.mobileOnly, mobileStyles.reviewDue)} onClick={() => setShowDueReviews(true)} aria-haspopup="dialog" aria-label={`${mobileCopy.reviewDue}: ${dueReviewRates.length}`} data-i18n-skip="true" lang={language}><span><CalendarClock className="h-4 w-4 shrink-0" aria-hidden="true" />{mobileCopy.reviewDue}</span><strong>{dueReviewRates.length}</strong><ChevronRight className="h-4 w-4 shrink-0" aria-hidden="true" /></button>}

            {/* Primary Register Surface (Principle 3: One Primary Surface Per Workflow) */}
            <div className="rounded-2xl border border-hairline bg-surface shadow-xs overflow-hidden" data-ratebook-section={2} data-ratebook-section-card="true" data-ratebook-field="rateTableCard">
                <div className={cn("flex flex-col gap-3 border-b border-hairline px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-4", isLite && mobileStyles.registerHeader)}>
                    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", isLite && mobileStyles.registerMeta)}>
                        <h2 className="text-sm sm:text-base font-semibold tracking-tight text-ink">
                            {tx('Yarn rates')} · <span className="font-bold text-ink">{activeYarnRates.length}</span> {tx('active yarn rates')}
                        </h2>
                        <span className="text-xs text-subtle">
                            ({warpRatesCount} {tx('Warp')} · {weftRatesCount} {tx('Weft')})
                        </span>
                        <span className="text-hairline-strong">•</span>
                        <span className="text-xs text-subtle">
                            {tx('Last reviewed')}{' '}
                            <span className="font-semibold text-ink">
                                {mostRecentReview ? formatDateOnly(mostRecentReview, { day: 'numeric', month: 'short', year: 'numeric' }) : tx('Not reviewed')}
                            </span>
                        </span>
                    </div>
                    <Button variant={showArchived ? 'secondary' : 'ghost'} onClick={() => setShowArchived(current => !current)} className="h-9 shrink-0 self-start sm:self-auto px-3 text-xs font-medium text-subtle hover:text-ink rounded-lg">
                        {showArchived ? <ArchiveRestore className="mr-1.5 h-3.5 w-3.5" /> : <Archive className="mr-1.5 h-3.5 w-3.5" />} {tx(showArchived ? 'Active rates' : 'Archived rates')}
                    </Button>
                </div>

                <Toolbar data-ratebook-section={1} data-ratebook-section-card="true" className="flex flex-col gap-3 rounded-none border-0 border-b border-hairline p-4 shadow-none md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-1 flex-wrap items-center gap-3">
                        <div data-ratebook-field="yarnSearch" tabIndex={-1} className="relative min-w-[min(100%,14rem)] flex-1 sm:max-w-xs md:max-w-sm">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden="true" />
                            <Label htmlFor="yarn-rates-search" className="sr-only">{tx('Search yarn rates')}</Label>
                            <Input
                                id="yarn-rates-search"
                                ref={searchRef}
                                type="search"
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder={tx('Search yarn by name, count, source, or fabric…')}
                                aria-label={tx('Search yarn by name, count, source, or fabric')}
                                className="h-11 w-full min-w-0 rounded-xl pl-9 pr-12 text-xs sm:text-sm border-hairline-strong/70 bg-surface-soft/40 focus:bg-surface"
                            />
                            {searchQuery ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery('')
                                        searchRef.current?.focus()
                                    }}
                                    aria-label={tx('Clear search')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            ) : (
                                <kbd
                                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden select-none rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-subtle shadow-sm sm:inline-block"
                                    aria-hidden="true"
                                >
                                    /
                                </kbd>
                            )}
                        </div>

                        {isLite && <Button type="button" variant="outline" className={cn(mobileStyles.mobileOnly, mobileStyles.rateFilterToggle)} aria-expanded={filtersOpen} aria-controls="lite-ratebook-filters" onClick={() => setFiltersOpen(open => !open)} data-i18n-skip="true" lang={language}>{mobileCopy.filters}{[categoryFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length > 0 ? ` · ${[categoryFilter !== 'all', statusFilter !== 'all'].filter(Boolean).length}` : ''}<ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /></Button>}
                        <div id={isLite ? 'lite-ratebook-filters' : undefined} className={cn('contents', isLite && mobileStyles.rateFilterControls)} data-expanded={filtersOpen}>
                        <LiquidSegmented
                            data-ratebook-field="directionFilter"
                            fullWidth
                            className="sm:w-80"
                            aria-label="Show yarn rates by direction"
                            value={categoryFilter}
                            onValueChange={setCategoryFilter}
                            options={DIRECTION_OPTIONS.map(({ value, label }) => {
                                const count = value === 'all' ? allRatesCount : value === 'yarn_warp' ? warpRatesCount : weftRatesCount
                                return {
                                    value,
                                    label: (
                                        <>
                                            <span>{label}</span>
                                            <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-bold text-subtle group-aria-checked/option:bg-white/20 group-aria-checked/option:text-white">{count}</span>
                                        </>
                                    ),
                                }
                            })}
                        />

                        <SwitchField
                            data-ratebook-field="needsReviewFilter"
                            variant="pill"
                            checked={statusFilter === 'needs_review'}
                            onCheckedChange={(on) => setStatusFilter(on ? 'needs_review' : 'all')}
                            checkedClassName="border-warning/60 bg-warning-soft ring-1 ring-warning/30"
                            icon={<CalendarClock className={`h-4 w-4 shrink-0 ${statusFilter === 'needs_review' ? 'text-warning' : 'text-subtle'}`} aria-hidden="true" />}
                            trailing={
                                <span
                                    className={`rounded-full px-1.5 py-0.5 text-[10px] font-black tracking-wide ${
                                        dueReviewRates.length > 0
                                            ? statusFilter === 'needs_review'
                                                ? 'bg-warning text-white'
                                                : 'bg-warning-soft text-warning border border-warning/30'
                                            : 'bg-surface text-subtle'
                                    }`}
                                >
                                    {dueReviewRates.length}
                                </span>
                            }
                        >
                            {tx('Needs Review')}
                        </SwitchField>

                        {dueReviewRates.length > 0 && (
                            <Button
                                data-ratebook-field="confirmAll"
                                type="button"
                                onClick={handleConfirmAll}
                                disabled={isPending}
                                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border-0 bg-loom px-3.5 text-xs sm:text-sm font-bold text-white shadow-none hover:bg-loom-elevated hover:text-white"
                            >
                                {pendingAction?.id === 'all-review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                <span>{pendingAction?.id === 'all-review' ? tx('Confirming…') : tx(`Confirm All (${dueReviewRates.length}) as Current`)}</span>
                            </Button>
                        )}

                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={resetFilters}
                                className="h-11 shrink-0 rounded-xl px-2.5 text-xs text-subtle hover:bg-surface-soft hover:text-ink"
                                aria-label={tx('Clear active search and filters')}
                            >
                                <X className="mr-1 h-3.5 w-3.5" aria-hidden="true" />
                                {tx('Clear filters')}
                            </Button>
                        )}
                        </div>
                    </div>
                </Toolbar>
                <p className="sr-only">
                    {categoryFilter === 'all'
                        ? tx('Showing all yarn rates.')
                        : tx(`Showing ${selectedCategoryLabel.toLowerCase()} yarn rates. Switch direction above to see the other yarns.`)}
                </p>
                <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                    {visibleRates.length} {visibleRates.length === 1 ? 'yarn rate' : 'yarn rates'} found.
                </p>

                {tourStep !== null && isSampleRecordId(visibleRates[0]?.id) && <p data-i18n-skip="true" lang={language} className="mx-4 my-3 rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>}

                {visibleRates.length === 0 ? (
                    <EmptyState
                        key={`empty-${resultMotionKey}`}
                        icon={Tags}
                        className="ui-content-swap rounded-none border-0 bg-transparent shadow-none"
                        title={
                            searchQuery.trim()
                                ? `No yarn rates match “${searchQuery.trim()}”`
                                : statusFilter === 'needs_review'
                                    ? tx('No yarn rates need review')
                                    : showArchived
                                        ? categoryFilter === 'all'
                                            ? tx('No archived yarn rates')
                                            : tx(`No archived ${selectedCategoryLabel.toLowerCase()} yarn rates`)
                                        : yarnRates.length === 0
                                            ? tx('No yarn rates yet')
                                            : categoryFilter === 'all'
                                                ? tx('No yarn rates yet')
                                                : tx(`No ${selectedCategoryLabel.toLowerCase()} yarn rates yet`)
                        }
                        description={
                            searchQuery.trim()
                                ? tx('Check the spelling or clear active filters to view all yarns.')
                                : statusFilter === 'needs_review'
                                    ? tx('All current yarn rates have been confirmed and are up to date.')
                                    : showArchived
                                        ? tx('Archived rates stay available here for audit and can be restored when needed.')
                                        : yarnRates.length === 0
                                            ? tx('Save a quality or costing and its yarn rates will appear here automatically.')
                                            : tx(`Add a ${selectedCategoryLabel.toLowerCase()} yarn rate to continue.`)
                        }
                        action={hasActiveFilters ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={resetFilters}
                                className="rounded-lg border-hairline bg-surface hover:bg-surface-soft"
                            >
                                <X className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                                {tx('Clear search & filters')}
                            </Button>
                        ) : undefined}
                    />
                ) : (
                    <>
                        <div key={`table-${resultMotionKey}`} className="ui-content-swap hidden lg:block">
                            <table className="w-full table-fixed text-left text-[12px]">
                                <colgroup>
                                    <col className="w-[24%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[22%]" />
                                </colgroup>
                                <thead className="border-b border-hairline bg-surface-soft text-[11px] font-semibold uppercase tracking-wide text-subtle">
                                    <tr>
                                        <th className="px-3 py-3">{tx('Yarn / Quality')}</th>
                                        <th className="px-3 py-3">{tx('Current Rate & Trend')}</th>
                                        <th className="px-3 py-3">{tx('Review Status')}</th>
                                        <th className="px-3 py-3">{tx('Source & Linked Qualities')}</th>
                                        <th className="px-3 py-3 text-right">{tx('Actions')}</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-hairline">
                                    {visibleRates.map((rate) => {
                                        const reviewState = getRateReviewStatus(rate)
                                        const archived = rate.is_active === false
                                        const actionKind = pendingAction?.id === rate.id ? pendingAction.kind : null
                                        const reviewLabel = reviewState === 'needs_review' ? 'Confirm current rate' : 'Confirm review'
                                        return (
                                            <tr
                                                key={rate.id}
                                                data-ratebook-field="yarnRow"
                                                data-ratebook-row-id={rate.id}
                                                className={`transition-colors duration-150 motion-reduce:transition-none ${archived ? 'bg-surface-soft opacity-80' : reviewState === 'overdue' ? 'bg-risk-soft/70 hover:bg-risk-soft' : reviewState === 'due_soon' ? 'bg-warning-soft/70 hover:bg-warning-soft' : reviewState === 'needs_review' ? 'bg-wv-neel-200/45 hover:bg-wv-neel-200/70' : 'hover:bg-surface-soft/70'}`}
                                            >
                                                <td data-ratebook-field="yarnNameCell" className={`px-3 py-3 align-top ${reviewState === 'needs_review' && !archived ? 'shadow-[inset_3px_0_0_0_var(--wv-neel-900)]' : ''}`}>
                                                    <p className="font-semibold text-ink">{rate.name}</p>
                                                    <p className="mt-1 text-[11px] text-subtle">{COST_RATE_CATEGORY_LABELS[rate.category]} {archived && '· Archived'}</p>
                                                    {rate.apply_as_default && <p className="mt-1 text-[10px] font-semibold text-success">Default for new costings</p>}
                                                </td>
                                                <td data-ratebook-field="rateAndTrend" tabIndex={-1} className="px-3 py-3 align-top">
                                                    <button
                                                        type="button"
                                                        onClick={() => openHistory(rate, 'trend')}
                                                        title={tx('View price history')}
                                                        className="group/trend -mx-2 -my-1.5 block rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                                                    >
                                                        <span className="flex items-center gap-1.5 font-mono text-sm font-bold text-ink">
                                                            {formatRateValue(rate.current_value, rate.unit)}
                                                            <ChartLine className="h-3.5 w-3.5 text-subtle/60 transition-colors group-hover/trend:text-saffron-deep" aria-hidden="true" />
                                                        </span>
                                                        <span className="mt-1.5 block">
                                                            <PriceDeltaBadge currentValue={rate.current_value} previousValue={rate.previous_value} unit={rate.unit} />
                                                        </span>
                                                        <span className="sr-only">{`${tx('View price history')}: ${rate.name}`}</span>
                                                    </button>
                                                </td>
                                                <td data-ratebook-field="reviewStatusBadge" className="px-3 py-3 align-top">
                                                    <ReviewBadge rate={rate} />
                                                    <p className="mt-1 text-[11px] text-subtle">Effective {formatDateOnly(rate.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                </td>
                                                <td data-ratebook-field="linkedQualitiesPopover" className="px-3 py-3 align-top"><LinkedQualitiesCell rate={rate} /></td>
                                                <td className="px-3 py-3 align-top">
                                                    <div className="ml-auto flex w-full max-w-[210px] items-start justify-end gap-1.5">
                                                        <div className="flex flex-col items-stretch gap-1.5 w-full max-w-[170px]">
                                                            {!archived && reviewState !== 'current' && (
                                                                <Button
                                                                    data-ratebook-field="quickReviewAction"
                                                                    variant="default"
                                                                    size="sm"
                                                                    onClick={() => handleQuickReview(rate)}
                                                                    disabled={isPending}
                                                                    aria-label={`${reviewLabel} for ${rate.name}`}
                                                                    className="h-8 w-full justify-center rounded-full border-0 bg-loom px-3 text-xs font-semibold text-white shadow-none hover:bg-loom-elevated hover:text-white"
                                                                >
                                                                    {actionKind === 'review' ? (
                                                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                                    ) : (
                                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                                    )}{' '}
                                                                    <span className="truncate">{tx(actionKind === 'review' ? 'Confirming…' : reviewLabel)}</span>
                                                                </Button>
                                                            )}
                                                            {!archived && (
                                                                <Button
                                                                    data-ratebook-field="quickEditAction"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={isPending}
                                                                    onClick={(e) => {
                                                                        e.stopPropagation()
                                                                        openQuickEdit(rate)
                                                                    }}
                                                                    aria-label={`Edit rate for ${rate.name}`}
                                                                    className="h-8 w-full cursor-pointer justify-center rounded-full border-hairline bg-surface px-3 text-xs font-semibold text-ink shadow-none hover:border-hairline-strong hover:bg-surface-soft hover:text-ink"
                                                                >
                                                                    <Pencil className="h-3.5 w-3.5" />
                                                                    <span>{tx('Edit rate')}</span>
                                                                </Button>
                                                            )}
                                                        </div>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-8 w-8 shrink-0 rounded-full"
                                                                    aria-label={`More actions for ${rate.name}`}
                                                                >
                                                                    <MoreHorizontal className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end" className="w-48">
                                                                {!archived && (
                                                                    <DropdownMenuItem onSelect={() => { setSaveError(null); setDraft(rowToDraft(rate)) }}>
                                                                        <Pencil /> {tx('Advanced edit')}
                                                                    </DropdownMenuItem>
                                                                )}
                                                                <DropdownMenuItem onSelect={() => openHistory(rate)}><History /> {tx('Activity')}</DropdownMenuItem>
                                                                <DropdownMenuSeparator />
                                                                <DropdownMenuItem onSelect={() => { setArchiveError(null); setArchiveRate(rate) }} className={archived ? '' : 'text-risk focus:text-risk'}>
                                                                    {archived ? <ArchiveRestore /> : <Archive />} {tx(archived ? 'Restore rate' : 'Archive rate')}
                                                                </DropdownMenuItem>
                                                                {(!rate.fabric_names?.length && rate.saved_quality_count === 0 && !rate.apply_as_default) && (
                                                                    <DropdownMenuItem onSelect={() => { setDeleteError(null); setDeleteRate(rate) }} className="text-destructive focus:text-destructive">
                                                                        <Trash2 /> {tx('Delete unused rate')}
                                                                    </DropdownMenuItem>
                                                                )}
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
                        <div key={`cards-${resultMotionKey}`} className="ui-content-swap space-y-3 p-3 lg:hidden">
                            {visibleRates.map((rate) => {
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
                                                ? 'border-l-wv-neel-900'
                                                : 'border-l-hairline-strong'
                                const cardBackground = !archived && reviewState === 'needs_review' ? 'bg-wv-neel-200/45' : 'bg-surface'
                                return (
                                    <Card
                                        key={rate.id}
                                        data-ratebook-field="yarnRow"
                                        data-ratebook-row-id={rate.id}
                                        className={`ui-surface overflow-hidden rounded-2xl border border-hairline border-l-4 ${cardBackground} ${cardAccent}`}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-start justify-between gap-3">
                                                <div data-ratebook-field="yarnNameCell" className="min-w-0">
                                                    <p className="truncate font-bold text-ink">{rate.name}</p>
                                                    <p className="mt-1 text-xs text-subtle">{COST_RATE_CATEGORY_LABELS[rate.category]} {archived && '· Archived'}</p>
                                                </div>
                                                <div data-ratebook-field="reviewStatusBadge">{archived ? <StatusBadge status="archived" className="text-[10px]" /> : <ReviewBadge rate={rate} compact />}</div>
                                            </div>

                                            <div className="mt-3.5 flex items-baseline justify-between gap-3 border-y border-hairline/70 py-2.5">
                                                <div data-ratebook-field="rateAndTrend" tabIndex={-1} className="min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => openHistory(rate, 'trend')}
                                                        title={tx('View price history')}
                                                        className="group/trend -mx-2 flex min-h-11 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg px-2 text-left transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                                                    >
                                                        <span className="font-mono text-xl font-black tracking-tight text-ink">
                                                            {formatRateValue(rate.current_value, rate.unit)}
                                                        </span>
                                                        <PriceDeltaBadge currentValue={rate.current_value} previousValue={rate.previous_value} unit={rate.unit} />
                                                        <ChartLine className="h-4 w-4 text-subtle/60 transition-colors group-hover/trend:text-saffron-deep" aria-hidden="true" />
                                                        <span className="sr-only">{`${tx('View price history')}: ${rate.name}`}</span>
                                                    </button>
                                                </div>
                                                {rate.apply_as_default && (
                                                    <span className="text-[10px] font-semibold text-success">Default</span>
                                                )}
                                            </div>

                                            <div data-ratebook-field="linkedQualitiesPopover" className="mt-3 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-subtle">
                                                <span>Effective {formatDateOnly(rate.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span aria-hidden="true">·</span>
                                                {usageNames.length ? (
                                                    <LinkedQualitiesPopover rate={rate} usageNames={usageNames} />
                                                ) : (
                                                    <span className="truncate">{getCostRateDisplaySource(rate) || 'No source recorded'}</span>
                                                )}
                                            </div>

                                            <div className="mt-4 flex items-center gap-2 border-t border-hairline/70 pt-3" role="group" aria-label={tx('Actions')}>
                                                {!archived && reviewState !== 'current' && (
                                                    <Button
                                                        data-ratebook-field="quickReviewAction"
                                                        variant="default"
                                                        onClick={() => handleQuickReview(rate)}
                                                        disabled={isPending}
                                                        aria-label={tx(`${reviewLabel} for ${rate.name}`)}
                                                        className="h-10 min-w-0 flex-1 rounded-xl border-0 bg-loom px-3 text-sm text-white shadow-none hover:bg-loom-elevated hover:text-white"
                                                    >
                                                        {actionKind === 'review' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                        <span className="truncate">{tx(actionKind === 'review' ? 'Confirming…' : reviewLabel)}</span>
                                                    </Button>
                                                )}
                                                {!archived && (
                                                    <Button
                                                        data-ratebook-field="quickEditAction"
                                                        variant="outline"
                                                        disabled={isPending}
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            openQuickEdit(rate)
                                                        }}
                                                        className="h-10 min-w-0 flex-1 cursor-pointer rounded-xl border-hairline bg-surface px-3 text-sm text-ink shadow-none hover:border-hairline-strong hover:bg-surface-soft hover:text-ink"
                                                    >
                                                        <Pencil className="h-4 w-4" /> <span className="truncate">{tx('Edit rate')}</span>
                                                    </Button>
                                                )}
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="outline" size="icon-sm" disabled={isPending} aria-label={`More actions for ${rate.name}`} className="h-10 w-10 rounded-xl border-hairline bg-surface px-0 text-subtle shadow-none hover:border-hairline-strong hover:bg-surface-soft hover:text-ink">
                                                            <MoreHorizontal className="h-5 w-5" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" className="w-48">
                                                        {!archived && (
                                                            <DropdownMenuItem onSelect={() => { setSaveError(null); setDraft(rowToDraft(rate)) }}>
                                                                <Pencil /> {tx('Advanced edit')}
                                                            </DropdownMenuItem>
                                                        )}
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
                                                        {(!rate.fabric_names?.length && rate.saved_quality_count === 0 && !rate.apply_as_default) && (
                                                            <DropdownMenuItem
                                                                onSelect={() => { setDeleteError(null); setDeleteRate(rate) }}
                                                                className="text-destructive focus:text-destructive"
                                                            >
                                                                <Trash2 /> {tx('Delete unused rate')}
                                                            </DropdownMenuItem>
                                                        )}
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
            </div>

            <DueForReviewDialog
                open={showDueReviews}
                rates={dueReviewRates}
                onClose={() => setShowDueReviews(false)}
                onReview={handleQuickReview}
                onEdit={rate => {
                    setShowDueReviews(false)
                    setSaveError(null)
                    setDraft(rowToDraft(rate))
                }}
                onConfirmAll={handleConfirmAll}
                isConfirmingAll={pendingAction?.id === 'all-review'}
                pendingActionId={pendingAction?.id}
            />

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

            <Dialog open={Boolean(draft)} onOpenChange={open => { if (!open && !isPending) { setDraft(null); setSaveError(null) } }}>
                <DialogContent data-ratebook-field="rateDrawerFields" className="sm:max-w-lg">
                    <DialogHeader className="pr-9">
                        <DialogTitle>{tx(draft?.id ? `Change ${draft.name}` : 'Add Yarn Rate')}</DialogTitle>
                        <DialogDescription>{tx('Set the current rate used by matching Saved Quality layers.')}</DialogDescription>
                    </DialogHeader>
                    {draft && <div className="space-y-5">
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
                    {draft && !draft.name.trim() && <p id="cost-rate-save-hint" className="text-xs font-medium text-warning">{tx('Enter a yarn name before saving this rate.')}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDraft(null)} disabled={isPending}>{tx('Cancel')}</Button>
                        <Button onClick={handleSave} disabled={isPending || !draft?.name.trim()} aria-describedby={!draft?.name.trim() ? 'cost-rate-save-hint' : undefined}>{isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isPending ? tx('Saving…') : tx('Save current rate')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <QuickRateEditDialog
                rate={quickEditRate}
                onOpenChange={open => {
                    if (!open && !quickEditPending) {
                        setQuickEditRate(null)
                        setQuickEditError(null)
                    }
                }}
                value={quickEditValue}
                onChangeValue={setQuickEditValue}
                source={quickEditSource}
                onChangeSource={setQuickEditSource}
                error={quickEditError}
                isPending={quickEditPending}
                onSave={handleQuickSave}
                onOpenAdvanced={openAdvancedDraft}
            />

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

            <RateTrendDialog
                rate={historyMode === 'trend' ? historyRate : null}
                rows={historyRows}
                loading={historyLoading}
                error={historyError}
                onClose={() => { setHistoryRate(null); setHistoryError(null) }}
                onOpenActivity={() => setHistoryMode('activity')}
            />

            <Sheet open={Boolean(historyRate) && historyMode === 'activity'} onOpenChange={open => { if (!open) { setHistoryRate(null); setHistoryError(null) } }}>
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

            <Dialog open={Boolean(deleteRate)} onOpenChange={open => { if (!open && !isPending) { setDeleteRate(null); setDeleteError(null) } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tx(`Delete ${deleteRate?.name ?? 'rate'} from Rate Book?`)}</DialogTitle>
                        <DialogDescription>{tx('This removes the unused yarn rate from your Rate Book. Since it is not used in any active quality or costing, it will not affect any calculations.')}</DialogDescription>
                    </DialogHeader>
                    {deleteError && <p role="alert" className="text-sm font-medium text-destructive">{deleteError}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setDeleteRate(null); setDeleteError(null) }} disabled={isPending}>{tx('Cancel')}</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tx(isPending ? `Deleting ${deleteRate?.name ?? 'rate'}…` : 'Delete rate')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <div className="phone-guidance rail-inline-actions">
                <ArchivePolicyNotice />
            </div>
            </div>

            {/* Keep viewport-positioned review controls outside the animated route wrapper. */}
            <aside className="rates-review-rail-desktop" aria-label={tx('Rate review and reference')}>
                <div>
                    <Button data-ratebook-field="addRateAction" onClick={() => { setSaveError(null); setDraft(defaultDraft(defaultReviewIntervalDays)) }} className={cn(railPrimaryAction, 'w-full')}>
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>{t('tourControls.rateBook.addRate')}</span>
                    </Button>
                </div>
                <div data-ratebook-section={6} data-ratebook-field="reviewRailWidget">
                    <RateReviewRailWidget
                        dueReviewRates={dueReviewRates}
                        mostRecentReview={mostRecentReview}
                        defaultReviewIntervalDays={defaultReviewIntervalDays}
                        onOpenModal={() => { if (dueReviewRates.length > 0) setShowDueReviews(true) }}
                    />
                </div>
                {/* Guidance pinned to the bottom edge of the rail: principles, help, then archive and restore. */}
                <div className="rates-review-rail-bottom">
                    <div data-ratebook-field="immutabilityNotice">
                        <RateBookReferenceCard />
                    </div>
                    <RateBookHelp />
                    <ArchivePolicyNotice />
                </div>
            </aside>

            {/* Floating Review Action on Narrower Screens (< 1540px) */}
            <RateReviewFloatingButton
                liteMobile={isLite}
                dueReviewRates={dueReviewRates}
                onOpenModal={() => { if (dueReviewRates.length > 0) setShowDueReviews(true) }}
            />
        </>
    )
}
