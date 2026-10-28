'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { RateBookTutorial, rateBookHelpCopy, useRateBookHelpTopic } from '@/components/rates/RateBookTutorial'
import { RateTrendDialog } from '@/components/rates/RateTrendDialog'
import type { RateBookStep } from '@/lib/rate-book-tour'
import { isSampleRecordId } from '@/lib/tours/sample-ids'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    AlertTriangle,
    Archive,
    ArchiveRestore,
    ArrowRight,
    BookOpen,
    Check,
    ChevronDown,
    ClipboardCheck,
    History,
    Info,
    Loader2,
    Minus,
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
import { railPrimaryAction } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { useArchivePolicyTopic } from '@/components/records/ArchivePolicyNotice'
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
import { getYarnRatePropagationCounts } from './propagation-actions'
import { PropagateYarnRateDialog } from '@/components/rates/PropagateYarnRateDialog'
import { RateReviewDialog } from '@/components/rates/RateReviewDialog'
import {
    COST_RATE_CATEGORY_LABELS,
    filterCostRates,
    formatRateValue,
    getCostRateDisplayNotes,
    getCostRateDisplaySource,
    getRatePriceDelta,
    getRateHistoryEventLabel,
    getRateReviewStatus,
    type CostRateRow,
} from '@/lib/cost-rates'
import {
    compareReviewUrgency,
    daysUntil,
    priceTrail,
    priceTrailPath,
    rateDateLabel,
    reviewDueDate,
    startRateReview,
    upcomingReviews,
    type PricePoint,
    type RateReviewSession,
} from '@/lib/rate-book-board'
import { rateBookBoardText, type RateBookBoardCopy } from '@/lib/i18n/rate-book-board'
import { fillCopy } from '@/lib/i18n/fill'
import {
    normalizeYarnName,
    type YarnRateConflict,
} from '@/lib/yarn-rate-reconciliation'
import { parseNonNegativeInput } from '@/lib/numeric-input'
import { useTranslation } from '@/lib/i18n/context'
import { formatDateOnly } from '@/lib/format'
import { formatSuratDateTime, getSuratTodayString } from '@/lib/time'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import PlanAnalyticsBeacon from '@/components/billing/PlanAnalyticsBeacon'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import { liteRecordsCopy } from '@/lib/i18n/lite-records'
import { MOBILE_WORKSPACE_QUERY } from '@/lib/mobile-workflow-navigation'
import mobileStyles from '@/components/estimator/lite-records.module.css'

type YarnRateCategory = Extract<CostRateCategory, 'yarn_warp' | 'yarn_weft'>
type YarnDirectionFilter = 'all' | YarnRateCategory

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

/** A saved rate's recorded prices: the ones already loaded plus the price just saved, so its trail stays current. */
function withSavedPrice(points: PricePoint[] | undefined, saved: CostRateRow): PricePoint[] {
    return [...(points ?? []), { date: saved.effective_date, value: Number(saved.current_value) }]
}

function getRateUsageNames(rate: Pick<CostRateRow, 'fabric_names'> | null) {
    return Array.from(new Set(
        (rate?.fabric_names ?? [])
            .map(name => name.normalize('NFKC').trim().replace(/\s+/g, ' '))
            .filter(Boolean),
    ))
}

/** Card actions: a quiet bordered button and a text-only one, 44px tall on phones. */
const secondaryAction = 'h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs hover:bg-surface-soft max-md:min-h-[44px]'
const ghostAction = 'h-10 rounded-lg font-semibold text-body max-md:min-h-[44px]'
// A yarn card's own actions are filled pills so they read as tappable; Propagate is saffron because it is waiting on the owner.
const cardAction = 'h-10 rounded-lg font-semibold max-md:min-h-[44px]'
/** Cards fill the width in columns of at least 22rem, one column on phones. */
const yarnCardGrid = 'grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,22rem),1fr))]'

/** "₹130.00" and "/kg", so the amount can read large and its unit quiet. */
function ratePriceParts(value: number, unit: CostRateUnit) {
    const [amount, suffix] = formatRateValue(value, unit).split(/(?=\/)/)
    return { amount, suffix: suffix ?? '' }
}

/** Every saved fabric that uses a rate, in a popover, opened from the yarn card's usage line. */
function LinkedQualitiesPopover({
    rate,
    usageNames,
    label,
}: {
    rate: CostRateRow
    usageNames: string[]
    label: string
}) {
    const isCosting = rate.discovery_source === 'saved_costing'
    const count = usageNames.length
    const qualityWord = count === 1 ? 'quality' : 'qualities'
    const fullWord = count === 1 ? 'fabric quality' : 'fabric qualities'

    return (
        <Popover>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className="inline-flex cursor-pointer items-center gap-1 rounded-md font-semibold text-ink underline decoration-hairline-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50 max-md:min-h-[44px]"
                    aria-label={`View ${count} linked ${qualityWord} for ${rate.name}`}
                >
                    {label}
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                sideOffset={6}
                className="w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-panel)]"
            >
                <div>
                    <p className="text-[13px] font-medium text-muted-foreground">
                        {isCosting ? 'Saved Costings' : 'Linked Qualities'}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-ink">
                        Used in {count} active {fullWord}
                    </p>
                </div>

                <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto pr-1">
                    {usageNames.map((name, index) => (
                        <li key={`${name}-${index}`} className="truncate border-t border-hairline pt-1.5 text-sm text-body first:border-t-0 first:pt-0">
                            {name}
                        </li>
                    ))}
                </ul>

                {(rate.source || rate.notes) && (
                    <div className="mt-3 space-y-1 border-t border-hairline pt-2.5 text-[13px] text-muted-foreground">
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

                <p className="mt-2.5 border-t border-hairline pt-2 text-[13px] leading-relaxed text-muted-foreground">
                    Future estimates for these fabrics will use this rate.
                </p>
            </PopoverContent>
        </Popover>
    )
}

/**
 * Which saved qualities use a yarn: the first two by name, the rest behind a popover. A yarn no quality uses says so,
 * with the source its price came from when the owner recorded one.
 */
function YarnUsage({ rate, loading, copy }: { rate: CostRateRow; loading: boolean; copy: RateBookBoardCopy }) {
    const usageNames = getRateUsageNames(rate)
    if (usageNames.length) {
        const [before, after = ''] = copy.usedIn.split('{names}')
        const rest = usageNames.length - 2
        return (
            <p className="text-[13px] leading-snug text-body">
                {before}
                <span className="font-medium text-ink">{usageNames.slice(0, 2).join(', ')}</span>
                {rest > 0 && <> <LinkedQualitiesPopover rate={rate} usageNames={usageNames} label={fillCopy(copy.moreNames, { n: rest })} /></>}
                {after}
            </p>
        )
    }
    const ownSource = rate.discovery_source ? null : rate.source?.trim()
    return (
        <p className="text-[13px] leading-snug text-muted-foreground">
            {loading ? copy.usageLoading : copy.notUsed}
            {!loading && ownSource && ` · ${fillCopy(copy.from, { source: ownSource })}`}
        </p>
    )
}

/** A yarn's recorded prices as a small stepped line: saffron-ochre when the price ended higher, green when lower. */
function PriceTrailSpark({ trail, label }: { trail: PricePoint[]; label: string }) {
    const { line, area } = priceTrailPath(trail, 112, 40)
    const rose = trail.at(-1)!.value >= trail[0].value
    return (
        <svg role="img" aria-label={label} viewBox="0 0 112 40" preserveAspectRatio="none" className="block h-10 w-28 shrink-0" style={{ color: rose ? 'var(--wv-ochre-400)' : 'var(--wv-moss-700)' }}>
            <path d={area} fill="currentColor" fillOpacity={0.14} />
            <path d={line} fill="none" stroke="currentColor" strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        </svg>
    )
}

/** The change from the previous price, or how the price stands when it has not moved. */
function PriceChange({ rate, copy, language }: { rate: CostRateRow; copy: RateBookBoardCopy; language: string }) {
    const delta = getRatePriceDelta(rate.current_value, rate.previous_value, rate.unit)
    if (delta.direction === 'initial') return <span className="text-muted-foreground">{fillCopy(copy.firstPrice, { date: rateDateLabel(rate.effective_date, language) })}</span>
    if (delta.direction === 'unchanged') return <span className="text-muted-foreground">{fillCopy(copy.noChange, { date: rateDateLabel(rate.last_reviewed_at, language) })}</span>
    const rose = delta.direction === 'increased'
    const percent = delta.percentChange == null ? '' : ` · ${Math.abs(delta.percentChange).toFixed(1)}%`
    return (
        <>
            <span className={cn('font-semibold', rose ? 'text-[var(--wv-ochre-800)]' : 'text-[var(--wv-moss-700)]')}>
                {rose ? '↑' : '↓'} ₹{Math.abs(delta.difference).toFixed(2)}{percent}
            </span>
            <span className="text-muted-foreground"> {fillCopy(copy.changedOn, { date: rateDateLabel(rate.effective_date, language) })}</span>
        </>
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
                                    <span className="shrink-0 rounded-full bg-surface-soft px-2 py-0.5 text-xs font-semibold text-subtle">
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
                                        {tx(`Updates future estimates for ${savedQualityCount} saved ${savedQualityCount === 1 ? 'quality' : 'qualities'}. Past costings stay the same.`)}
                                    </p>
                                ) : (
                                    <p>
                                        {tx('Updates future estimates. Past costings stay the same.')}
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
                                {tx('Advanced edit')}
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
                className={`inline-flex items-center gap-1 rounded-md border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[var(--wv-ochre-800)] ${className}`}
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
                className={`inline-flex items-center gap-1 rounded-md border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] px-1.5 py-0.5 font-mono text-xs font-semibold text-[var(--wv-moss-700)] ${className}`}
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
                className={`inline-flex items-center gap-1 rounded-md border border-hairline bg-surface-soft/80 px-1.5 py-0.5 text-xs font-medium text-subtle ${className}`}
                title={delta.previousValueFormatted ? `Previous rate: ${delta.previousValueFormatted}` : undefined}
            >
                <Minus className="h-2.5 w-2.5 shrink-0 text-subtle" aria-hidden="true" />
                <span>Unchanged</span>
            </span>
        )
    }

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-md border border-hairline/60 bg-surface-soft/40 px-1.5 py-0.5 text-xs font-normal italic text-subtle ${className}`}
            title="Initial rate recorded"
        >
            <span>Initial rate</span>
        </span>
    )
}

function RateBookPrinciples() {
    const { language } = useTranslation()
    const copy = rateBookHelpCopy[language]
    return (
        <ul className="space-y-3 rounded-xl border border-hairline bg-surface-soft/60 p-3.5 text-sm leading-relaxed text-body">
            {copy.principles.map(principle => (
                <li key={principle} className="flex items-start gap-2.5">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" aria-hidden="true" />
                    <span>{principle}</span>
                </li>
            ))}
        </ul>
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
    const [filtersOpen, setFiltersOpen] = useState(false)
    const rateBookHelpTopic = useRateBookHelpTopic()
    const archivePolicyTopic = useArchivePolicyTopic()
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
    const [searchQuery, setSearchQuery] = useState('')
    const [showArchived, setShowArchived] = useState(false)
    const [tourStep, setTourStep] = useState<RateBookStep | null>(null)
    // Saved costings each yarn would re-cost; the Propagate pill shows while a yarn has any.
    const [propagationCounts, setPropagationCounts] = useState<Record<string, number>>({})
    const [propagateRate, setPropagateRate] = useState<CostRateRow | null>(null)
    const refreshPropagationCounts = useCallback(() => {
        // Secondary read: without it there is simply no pill.
        void getYarnRatePropagationCounts()
            .then(result => { if (result.data) setPropagationCounts(result.data) })
            .catch(() => {})
    }, [])
    useEffect(() => { refreshPropagationCounts() }, [refreshPropagationCounts])
    const searchRef = useRef<HTMLInputElement>(null)
    const boardRef = useRef<HTMLDivElement>(null)

    // On desktop the page itself stays put and only the yarn list scrolls: the
    // list is capped to whatever viewport height is left below the header, band
    // and filters (which vary with banners, conflicts and the tour).
    useEffect(() => {
        const board = boardRef.current
        if (!board) return
        const main = board.closest('main')
        const fit = () => {
            const room = window.innerHeight - board.getBoundingClientRect().top - (main ? Number.parseFloat(getComputedStyle(main).paddingBottom) || 0 : 0)
            const next = `${Math.max(0, Math.floor(room))}px`
            if (board.style.getPropertyValue('--rates-board-max') !== next) board.style.setProperty('--rates-board-max', next)
        }
        fit()
        window.addEventListener('resize', fit)
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fit)
        if (board.parentElement) observer?.observe(board.parentElement)
        if (main) observer?.observe(main)
        return () => {
            window.removeEventListener('resize', fit)
            observer?.disconnect()
        }
    }, [])
    const [draft, setDraft] = useState<CostRateInput | null>(null)
    const [historyRate, setHistoryRate] = useState<CostRateRow | null>(null)
    const [historyMode, setHistoryMode] = useState<'activity' | 'trend'>('activity')
    const [historyRows, setHistoryRows] = useState<RateHistoryRow[]>([])
    const [historyLoading, setHistoryLoading] = useState(false)
    const [historyError, setHistoryError] = useState<string | null>(null)
    const [reviewRate, setReviewRate] = useState<CostRateRow | null>(null)
    const [reviewError, setReviewError] = useState<string | null>(null)
    // Prices due for a check open in one modal from the summary band, not as cards on the page.
    const [reviewSession, setReviewSession] = useState<RateReviewSession | null>(null)
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
                draft || historyRate ||
                reviewRate || archiveRate || deleteRate || showConflicts || quickEditRate || reviewSession
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
    }, [draft, historyRate, reviewRate, archiveRate, deleteRate, showConflicts, quickEditRate, reviewSession, searchQuery, tourStep])

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
                    // The tour's sample yarn keeps its sample quality; no real quality will ever use it.
                    if (isSampleRecordId(rate.id)) return rate
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

    // The sample yarn only asks for a review while the tour is teaching it; outside the tour it never nags.
    const dueReviewRates = useMemo(
        () => activeYarnRates
            .filter(rate => getRateReviewStatus(rate) !== 'current' && (tourStep !== null || !isSampleRecordId(rate.id)))
            .sort((left, right) => compareReviewUrgency(left, right)),
        [activeYarnRates, tourStep],
    )

    const filteredRates = useMemo(
        () => filterCostRates(targetYarnRates, {
            query: tourStep !== null ? '' : searchQuery,
            category: tourStep !== null ? 'all' : categoryFilter,
            status: 'all',
        }),
        [targetYarnRates, searchQuery, categoryFilter, tourStep],
    )

    const visibleRates = useMemo(
        () => [...filteredRates].sort((left, right) => {
            if (tourStep === null && showArchived) return left.name.localeCompare(right.name, 'en-IN')
            return REVIEW_STATUS_PRIORITY[getRateReviewStatus(left)] - REVIEW_STATUS_PRIORITY[getRateReviewStatus(right)]
                || left.name.localeCompare(right.name, 'en-IN')
        }),
        [filteredRates, showArchived, tourStep],
    )

    const resultMotionKey = `${categoryFilter}|${showArchived ? 'archived' : 'active'}|${searchQuery.trim()}|${visibleRates.length}`
    const selectedCategoryLabel = categoryFilter === 'all' ? 'All' : categoryFilter === 'yarn_warp' ? 'Warp' : 'Weft'
    const hasActiveFilters = Boolean(searchQuery.trim()) || categoryFilter !== 'all'

    const resetFilters = () => {
        setSearchQuery('')
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
                        price_points: withSavedPrice(previousRate?.price_points, savedRate),
                    }]
                })
                const savedYarnName = normalizeYarnName(target.name)
                if (target.category === 'yarn_warp' || target.category === 'yarn_weft') {
                    setConflicts(current => current.filter(conflict => conflict.normalizedName !== savedYarnName))
                }
                setSaveError(null)
                if (result.syncedQualityCount) {
                    toast.success(tx(`Rate saved and updated in ${result.syncedQualityCount} Saved ${result.syncedQualityCount === 1 ? 'Quality' : 'Qualities'}. Costings you already saved did not change.`))
                } else {
                    toast.success(tx(target.id ? 'Rate updated. Costings you already saved did not change.' : 'Rate added for future estimates.'))
                }
                refreshPropagationCounts()
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
                        price_points: withSavedPrice(previousRate?.price_points, savedRate),
                    }]
                })
                const savedYarnName = normalizeYarnName(target.name)
                if (target.category === 'yarn_warp' || target.category === 'yarn_weft') {
                    setConflicts(current => current.filter(conflict => conflict.normalizedName !== savedYarnName))
                }
                setQuickEditError(null)
                setQuickEditRate(null)
                if (result.syncedQualityCount) {
                    toast.success(tx(`Rate saved and updated in ${result.syncedQualityCount} Saved ${result.syncedQualityCount === 1 ? 'Quality' : 'Qualities'}. Costings you already saved did not change.`))
                } else {
                    toast.success(tx('Rate updated. Costings you already saved did not change.'))
                }
                refreshPropagationCounts()
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
            toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Costings you already saved did not change.`))
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
                toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Costings you already saved did not change.`))
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
            toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Costings you already saved did not change.`))
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
                toast.success(tx(`${target.name} confirmed at ${formatRateValue(Number(target.current_value), target.unit)}. Costings you already saved did not change.`))
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
            toast.success(tx(`Confirmed 1 yarn rate as current. Costings you already saved did not change.`))
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
                toast.success(tx(`Confirmed ${count} yarn ${count === 1 ? 'rate' : 'rates'} as current. Costings you already saved did not change.`))
                void trackPlanEvent('rate_book_action', { action: 'confirm_all_reviews', count })
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
                    toast.success(tx('Rate restored to the active Rate Book. Costings you already saved did not change.'))
                    void trackPlanEvent('rate_book_action', { action: 'restore', category: target.category })
                } else {
                    const archivedUpdatedAt = result.updatedAt ?? target.updated_at
                    void trackPlanEvent('rate_book_action', { action: 'archive', category: target.category })
                    toast.success(tx('Rate archived from the Rate Book. Saved qualities and costings did not change.'), {
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

    const copy = rateBookBoardText[language]
    // Only an unused yarn can be deleted; one a saved quality uses is offered archive instead.
    const deleteRateInUse = Boolean(deleteRate && getRateUsageNames(deleteRate).length > 0)
    const todayDate = today()
    const isDue = (rate: CostRateRow) => rate.is_active !== false && getRateReviewStatus(rate) !== 'current' && (tourStep !== null || !isSampleRecordId(rate.id))
    /** How a due price stands: new, overdue by some days, or due in some days. */
    const dueStatus = (rate: CostRateRow) => {
        if (getRateReviewStatus(rate) === 'needs_review') return rate.discovery_source ? copy.discovered : copy.newYarn
        const dueIn = daysUntil(reviewDueDate(rate), todayDate)
        if (dueIn < 0) return dueIn === -1 ? copy.overdueOne : fillCopy(copy.overdueDays, { n: -dueIn })
        return dueIn === 0 ? copy.dueToday : dueIn === 1 ? copy.dueTomorrow : fillCopy(copy.dueInDays, { n: dueIn })
    }
    // Every yarn stays on the board, due ones first in each section; confirming them happens in the review modal.
    const boardSections = (categoryFilter === 'all' || tourStep !== null ? YARN_CATEGORIES : [categoryFilter])
        .map(category => ({ category, rates: visibleRates.filter(rate => rate.category === category) }))
        .filter(section => section.rates.length > 0)
    const dueCount = dueReviewRates.length
    // The yarns waiting, most urgent first, as the review modal lists them.
    const dueLine = dueCount
        ? `${dueReviewRates.slice(0, 3).map(rate => rate.name).join(', ')}${dueCount > 3 ? ` ${fillCopy(copy.moreNames, { n: dueCount - 3 })}` : ''}`
        : null
    const activeWarpCount = activeYarnRates.filter(rate => rate.category === 'yarn_warp').length
    const reviewDates = upcomingReviews(activeYarnRates)
    const nextReviewLine = reviewDates.length
        ? [
            fillCopy(reviewDates[0].count === 1 ? copy.nextReviewOne : copy.nextReview, { date: rateDateLabel(reviewDates[0].date, language), n: reviewDates[0].count }),
            reviewDates.length > 1 ? fillCopy(copy.then, { dates: reviewDates.slice(1, 4).map(entry => rateDateLabel(entry.date, language)).join(', ') }) : null,
        ].filter(Boolean).join(' · ')
        : copy.noneScheduled

    /** One yarn as a card: its price and how it moved, who uses it and its actions. A due card says so in its status. */
    const renderYarnCard = (rate: CostRateRow) => {
        const archived = rate.is_active === false
        const due = isDue(rate)
        const sample = isSampleRecordId(rate.id)
        // Outside the tour the sample card says what it is instead of a review status, and offers only its removal.
        const quietSample = sample && tourStep === null
        const actionKind = pendingAction?.id === rate.id ? pendingAction.kind : null
        // A price due for a check is confirmed before it re-costs saved costings.
        const propagateCount = !due && !archived ? propagationCounts[rate.id] ?? 0 : 0
        const { amount, suffix } = ratePriceParts(rate.current_value, rate.unit)
        const trail = archived ? null : priceTrail(rate.price_points ?? [], Number(rate.current_value), todayDate)
        const status = archived
            ? copy.archived
            : due ? dueStatus(rate) : fillCopy(copy.reviewOn, { date: rateDateLabel(reviewDueDate(rate), language) })
        return (
            <article
                key={rate.id}
                data-ratebook-field="yarnRow"
                data-ratebook-row-id={rate.id}
                className={cn(
                    'flex flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:px-6',
                    archived ? 'border-hairline bg-surface-soft' : 'border-hairline bg-surface',
                )}
            >
                <div className="flex items-baseline justify-between gap-3">
                    <h3 data-ratebook-field="yarnNameCell" className="min-w-0 break-words text-base font-semibold leading-snug text-ink">
                        {rate.name}
                        {sample && <span data-ratebook-field="sampleBadge" className="ml-2 inline-flex translate-y-[-1px] items-center rounded-md bg-[var(--wv-saffron-100)] px-2 py-0.5 align-middle text-xs font-semibold text-saffron-deep ring-1 ring-inset ring-[var(--wv-saffron-200)]">{copy.example}</span>}
                    </h3>
                    {!quietSample && <p data-ratebook-field="reviewStatusBadge" className={cn('shrink-0 text-[13px] tabular-nums', due ? 'font-semibold text-[var(--wv-ochre-800)]' : 'text-muted-foreground')}>{status}</p>}
                </div>
                <div data-ratebook-field="rateAndTrend" tabIndex={-1} className="flex items-end justify-between gap-4">
                    <button
                        type="button"
                        onClick={() => openHistory(rate, 'trend')}
                        title={tx('View price history')}
                        className="-m-2 min-w-0 rounded-lg p-2 text-left transition-colors hover:bg-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                    >
                        <span className="block text-[2rem] font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                            {amount}<span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">{suffix}</span>
                        </span>
                        <span className="mt-2 block text-[13px] tabular-nums">
                            <PriceChange rate={rate} copy={copy} language={language} />
                        </span>
                        <span className="sr-only">{`${tx('View price history')}: ${rate.name}`}</span>
                    </button>
                    {trail && <PriceTrailSpark trail={trail} label={fillCopy(copy.trendLabel, { from: formatRateValue(trail[0].value, rate.unit), to: formatRateValue(trail.at(-1)!.value, rate.unit) })} />}
                </div>
                {quietSample
                    ? <p className="text-[13px] leading-snug text-muted-foreground">{copy.sampleNote}</p>
                    : <div data-ratebook-field="linkedQualitiesPopover"><YarnUsage rate={rate} loading={usageLoading} copy={copy} /></div>}
                {rate.apply_as_default && <p className="-mt-2 text-[13px] font-medium text-success">{copy.defaultForNew}</p>}
                <div className="mt-auto border-t border-hairline pt-4">
                {/* Saved costings keep the old price until the owner propagates it, so the card says so above the pill. */}
                {propagateCount > 0 && (
                    <p
                        role="status"
                        data-ratebook-field="propagateNotice"
                        className="relative mb-3 flex items-start gap-2 rounded-lg border border-[var(--wv-saffron-200)] bg-[var(--wv-saffron-100)] px-3 py-2 text-[13px] font-medium leading-snug text-saffron-deep shadow-xs animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none"
                    >
                        <AlertTriangle className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                        {propagateCount === 1 ? copy.oldPriceOne : fillCopy(copy.oldPrice, { n: propagateCount })}
                        <span aria-hidden="true" className="absolute -bottom-[6px] left-12 h-2.5 w-2.5 rotate-45 border-b border-r border-[var(--wv-saffron-200)] bg-[var(--wv-saffron-100)]" />
                    </p>
                )}
                <div className="flex flex-wrap items-center gap-2" role="group" aria-label={tx('Actions')}>
                    {quietSample ? (
                        <Button variant="outline" onClick={handleDeleteDemoYarn} className={secondaryAction}>
                            <Trash2 className="h-4 w-4" aria-hidden="true" />{tx('Delete sample yarn')}
                        </Button>
                    ) : <>
                        {propagateCount > 0 && (
                            <Button
                                data-ratebook-field="propagateAction"
                                variant="saffron"
                                disabled={isPending}
                                onClick={() => setPropagateRate(rate)}
                                aria-label={`Propagate ${rate.name} to ${propagateCount} saved costings`}
                                className={cn(cardAction, 'whitespace-normal')}
                            >
                                {tx(`Propagate · ${propagateCount}`)}
                            </Button>
                        )}
                        {archived ? (
                            <Button
                                onClick={() => { setArchiveError(null); setArchiveRate(rate) }}
                                disabled={isPending}
                                aria-label={`Restore rate ${rate.name}`}
                                className={cardAction}
                            >
                                {actionKind === 'restore' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArchiveRestore className="h-4 w-4" aria-hidden="true" />}
                                {tx(actionKind === 'restore' ? `Restoring ${rate.name}…` : 'Restore rate')}
                            </Button>
                        ) : (
                            <Button
                                data-ratebook-field="quickEditAction"
                                disabled={isPending}
                                onClick={() => openQuickEdit(rate)}
                                aria-label={`Edit rate for ${rate.name}`}
                                className={cardAction}
                            >
                                <Pencil className="h-4 w-4" aria-hidden="true" />{tx('Edit rate')}
                            </Button>
                        )}
                        {/* Activity opens the price-history chart; its Full activity button switches to the audit list. */}
                        <Button onClick={() => openHistory(rate, 'trend')} className={cardAction}>
                            <History className="h-4 w-4" aria-hidden="true" />{tx('Activity')}
                        </Button>
                        {/* Delete declutters the board; a yarn still in use is offered archive instead. */}
                        {!sample && (
                            <Button
                                data-ratebook-field="deleteYarnAction"
                                variant="ghost"
                                size="icon"
                                disabled={isPending}
                                onClick={() => { setDeleteError(null); setDeleteRate(rate) }}
                                aria-label={fillCopy(copy.deleteYarnLabel, { name: rate.name })}
                                title={copy.deleteYarn}
                                className="ml-auto text-muted-foreground hover:bg-destructive/10 hover:text-destructive max-md:size-11"
                            >
                                {actionKind === 'delete' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />}
                            </Button>
                        )}
                    </>}
                </div>
                </div>
            </article>
        )
    }

    return (
        <>
            <div className={cn("rates-workspace ui-route-enter w-full space-y-6", isLite && mobileStyles.workspace)} data-lite-rates={isLite || undefined} data-ratebook-tutorial-root="true">
            <PlanAnalyticsBeacon eventName="rate_book_viewed" />
            {/* Rate Book is part of both Lite and Base and is the source of truth for yarn prices. */}
            <RouteMilestones
                route="/owner/rates"
                shellVisible
                primaryUsable
                secondaryReady={!usageLoading}
            />
            <div className="space-y-6" data-ratebook-field="overview">
                <PageHeader
                    className={isLite ? mobileStyles.header : undefined}
                    title={t('common.yarn_rate_book')}
                    actions={<>
                        <RateBookTutorial
                            enabled={!isPending}
                            orgId={orgId}
                            userId={userId}
                            userMetadata={userMetadata}
                            step={tourStep}
                            onStepChange={setTourStep}
                            sampleRow={isSampleRecordId(visibleRates[0]?.id)}
                            hasRealRates={activeYarnRates.some(rate => !isSampleRecordId(rate.id))}
                            topics={[
                                { id: 'rate-book-principles', icon: BookOpen, title: tx('Rate Book Principles'), lang: language, i18nSkip: true, content: <div data-ratebook-field="immutabilityNotice"><RateBookPrinciples /></div> },
                                rateBookHelpTopic,
                                archivePolicyTopic,
                            ]}
                            onTourFinish={() => {
                                if (!demoYarnDeleted && rates.some(r => r.id === DEMO_YARN_RATE.id)) {
                                    setShowDeleteNudge(true)
                                }
                            }}
                        />
                        <Button
                            data-ratebook-field="addRateAction"
                            onClick={() => { setSaveError(null); setDraft(defaultDraft(defaultReviewIntervalDays)) }}
                            className={railPrimaryAction}
                        >
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            <span>{t('tourControls.rateBook.addRate')}</span>
                        </Button>
                    </>}
                />

                {/* Where the book stands: how many yarns, and either all clear or the prices due for a check, which open in the review modal. */}
                {activeYarnRates.length > 0 && (
                    <section
                        data-ratebook-section={6}
                        data-ratebook-field="reviewRailWidget"
                        aria-labelledby="ratebook-status"
                        data-i18n-skip="true"
                        lang={language}
                        className="grid overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
                    >
                        <div className="flex flex-col justify-center gap-4 p-5 sm:p-6">
                            <p className="flex items-baseline gap-2">
                                <span className="text-4xl font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">{activeYarnRates.length}</span>
                                <span className="text-base font-medium text-body">{activeYarnRates.length === 1 ? copy.yarnUnit : copy.yarnsUnit}</span>
                            </p>
                            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                                <dl className="flex items-stretch gap-4">
                                    <div>
                                        <dt className="text-xs font-medium text-muted-foreground">{copy.warp}</dt>
                                        <dd className="mt-0.5 text-lg font-semibold leading-tight text-ink tabular-nums">{activeWarpCount}</dd>
                                    </div>
                                    <span aria-hidden="true" className="w-px bg-hairline" />
                                    <div>
                                        <dt className="text-xs font-medium text-muted-foreground">{copy.weft}</dt>
                                        <dd className="mt-0.5 text-lg font-semibold leading-tight text-ink tabular-nums">{activeYarnRates.length - activeWarpCount}</dd>
                                    </div>
                                </dl>
                                {mostRecentReview && (
                                    <p className="pb-0.5 text-xs text-muted-foreground tabular-nums">
                                        {fillCopy(copy.lastReviewed, { date: rateDateLabel(mostRecentReview, language) })}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-col gap-4 border-t border-hairline p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6 lg:border-l lg:border-t-0">
                            <div className="flex min-w-0 items-center gap-4">
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex size-11 shrink-0 items-center justify-center rounded-full',
                                        dueCount ? 'bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]' : 'bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]',
                                    )}
                                >
                                    {dueCount ? <ClipboardCheck className="size-5" /> : <Check className="size-5" strokeWidth={2.5} />}
                                </span>
                                <div className="min-w-0">
                                    <p id="ratebook-status" className="text-lg font-semibold leading-snug text-ink">
                                        {dueCount ? fillCopy(dueCount === 1 ? copy.toConfirmOne : copy.toConfirm, { n: dueCount }) : copy.allCurrent}
                                    </p>
                                    <p className="mt-0.5 break-words text-[13px] text-body tabular-nums">{dueLine ?? nextReviewLine}</p>
                                </div>
                            </div>
                            {dueCount > 0 && (
                                <Button
                                    data-ratebook-field="reviewPricesAction"
                                    onClick={() => setReviewSession(startRateReview(dueReviewRates))}
                                    className={cn(railPrimaryAction, 'h-11 shrink-0 px-5 max-sm:w-full')}
                                >
                                    {copy.review}
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                                </Button>
                            )}
                        </div>
                    </section>
                )}
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

            {usageError && (
                <p role="alert" className="rounded-lg border border-warning/25 bg-warning-soft px-3 py-2 text-xs font-medium text-warning">
                    {tx(usageError)} {tx('The primary Rate Book remains available; refresh to retry usage details.')}
                </p>
            )}

            {conflicts.length > 0 && (
                <div className="ui-status-enter flex flex-col gap-4 rounded-2xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-5 text-ink sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-3">
                        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--wv-ochre-800)]" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-semibold">{tx(`Different rates found for ${conflicts.length} ${conflicts.length === 1 ? 'yarn' : 'yarns'}.`)}</p>
                            <p className="mt-1 text-[13px] leading-relaxed text-body">{tx('Review the saved values before choosing one current rate. Changing it will update future estimates that use this yarn.')}</p>
                        </div>
                    </div>
                    <Button variant="outline" onClick={() => setShowConflicts(true)} className={cn('shrink-0', secondaryAction)}>{tx('Review conflicts')}</Button>
                </div>
            )}

            {/* Search and Warp / Weft narrow the review queue and the board alike. */}
            <div data-ratebook-section={1} data-ratebook-section-card="true" className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between">
                <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
                    <div data-ratebook-field="yarnSearch" tabIndex={-1} className="relative min-w-[min(100%,14rem)] flex-1 sm:max-w-sm">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                        <Label htmlFor="yarn-rates-search" className="sr-only">{tx('Search yarn rates')}</Label>
                        <Input
                            id="yarn-rates-search"
                            ref={searchRef}
                            type="search"
                            value={searchQuery}
                            onChange={event => setSearchQuery(event.target.value)}
                            placeholder={tx('Search yarn by name, count, source, or fabric…')}
                            aria-label={tx('Search yarn by name, count, source, or fabric')}
                            className="h-10 w-full min-w-0 rounded-lg border-hairline bg-surface pl-9 pr-12 text-sm shadow-xs max-md:min-h-[44px]"
                        />
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('')
                                    searchRef.current?.focus()
                                }}
                                aria-label={tx('Clear search')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron"
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        ) : (
                            <kbd
                                className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 select-none rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-xs font-semibold text-muted-foreground sm:inline-block"
                                aria-hidden="true"
                            >
                                /
                            </kbd>
                        )}
                    </div>

                    {isLite && <Button type="button" variant="outline" className={cn(mobileStyles.mobileOnly, mobileStyles.rateFilterToggle)} aria-expanded={filtersOpen} aria-controls="lite-ratebook-filters" onClick={() => setFiltersOpen(open => !open)} data-i18n-skip="true" lang={language}>{mobileCopy.filters}{categoryFilter !== 'all' ? ' · 1' : ''}<ChevronDown className="h-4 w-4 shrink-0" aria-hidden="true" /></Button>}
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
                                            <span className="rounded-full bg-surface px-1.5 py-0.5 text-xs font-bold text-subtle group-aria-checked/option:bg-white/20 group-aria-checked/option:text-white">{count}</span>
                                        </>
                                    ),
                                }
                            })}
                        />
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                onClick={resetFilters}
                                className={ghostAction}
                                aria-label={tx('Clear active search and filters')}
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                                {tx('Clear filters')}
                            </Button>
                        )}
                    </div>
                </div>
                <Button variant={showArchived ? 'secondary' : 'ghost'} onClick={() => setShowArchived(current => !current)} className={cn('shrink-0 self-start md:self-auto', ghostAction)}>
                    {showArchived ? <ArchiveRestore className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />} {tx(showArchived ? 'Active rates' : 'Archived rates')}
                </Button>
            </div>
            <p className="sr-only">
                {categoryFilter === 'all'
                    ? tx('Showing all yarn rates.')
                    : tx(`Showing ${selectedCategoryLabel.toLowerCase()} yarn rates. Switch direction above to see the other yarns.`)}
            </p>
            <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {visibleRates.length} {visibleRates.length === 1 ? 'yarn rate' : 'yarn rates'} found.
            </p>

            <div ref={boardRef} className="rates-board-scroll space-y-8" data-ratebook-section={2} data-ratebook-section-card="true" data-ratebook-field="rateTableCard" data-i18n-skip="true" lang={language}>
                {tourStep !== null && isSampleRecordId(visibleRates[0]?.id) && <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink">{tourCommonCopy[language].sampleBanner}</p>}

                {visibleRates.length === 0 ? (
                    <EmptyState
                        key={`empty-${resultMotionKey}`}
                        icon={Tags}
                        className="ui-content-swap"
                        title={
                            searchQuery.trim()
                                ? `No yarn rates match “${searchQuery.trim()}”`
                                : showArchived
                                    ? categoryFilter === 'all'
                                        ? tx('No archived yarn rates')
                                        : tx(`No archived ${selectedCategoryLabel.toLowerCase()} yarn rates`)
                                    : categoryFilter === 'all'
                                        ? tx('No yarn rates yet')
                                        : tx(`No ${selectedCategoryLabel.toLowerCase()} yarn rates yet`)
                        }
                        description={
                            searchQuery.trim()
                                ? tx('Check the spelling or clear active filters to view all yarns.')
                                : showArchived
                                    ? tx('Archived rates stay here for your records and can be restored any time.')
                                    : yarnRates.length === 0
                                        ? tx('Save a quality or costing and its yarn rates will appear here automatically.')
                                        : tx(`Add a ${selectedCategoryLabel.toLowerCase()} yarn rate to continue.`)
                        }
                        action={hasActiveFilters ? (
                            <Button
                                variant="outline"
                                onClick={resetFilters}
                                className={secondaryAction}
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                                {tx('Clear search & filters')}
                            </Button>
                        ) : undefined}
                    />
                ) : (
                    <div key={`board-${resultMotionKey}`} className="ui-content-swap space-y-8">
                        {boardSections.map(section => (
                            <section key={section.category} aria-labelledby={`ratebook-${section.category}`} className="space-y-4">
                                <h2 id={`ratebook-${section.category}`} className="text-base font-semibold text-ink">
                                    {section.category === 'yarn_warp' ? copy.warp : copy.weft}
                                    <span className="ml-2 font-medium tabular-nums text-muted-foreground">{section.rates.length}</span>
                                </h2>
                                <div className={yarnCardGrid}>{section.rates.map(rate => renderYarnCard(rate))}</div>
                            </section>
                        ))}
                    </div>
                )}
            </div>

            <Dialog open={showConflicts && conflicts.length > 0} onOpenChange={setShowConflicts}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Review different saved rates</DialogTitle>
                        <DialogDescription>We found the same yarn at different rates in your Saved Qualities. Review the usages before changing the current Rate Book value. Costings you already saved do not change.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
                        {conflicts.map(conflict => {
                            const qualityCount = new Set(conflict.usages.map(usage => usage.templateId)).size
                            return (
                                <div key={conflict.normalizedName} className="rounded-xl border border-warning/25 bg-warning-soft/70 p-4">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div>
                                            <p className="font-bold text-ink">{conflict.yarnName}</p>
                                            <p className="mt-1 text-xs text-body">{`Used in ${qualityCount} saved ${qualityCount === 1 ? 'quality' : 'qualities'} · found ${conflict.rates.map(rate => `₹${rate}/kg`).join(' and ')}`}</p>
                                        </div>
                                        <Button size="sm" onClick={() => editConflict(conflict)} className="shrink-0 bg-saffron text-white hover:bg-saffron-deep"><Pencil className="h-3.5 w-3.5" /> {tx('Change current rate')}</Button>
                                    </div>
                                    <div className="mt-3 flex flex-wrap gap-1.5">
                                        {conflict.usages.slice(0, 6).map(usage => (
                                            <span key={`${usage.templateId}-${usage.layer}-${usage.layerNumber}`} className="rounded-full border border-warning/25 bg-surface px-2 py-1 text-xs font-medium text-body">
                                                {usage.templateName} · {usage.layer} {usage.layerNumber} · ₹{usage.rate}
                                            </span>
                                        ))}
                                        {conflict.usages.length > 6 && <span className="px-2 py-1 text-xs text-subtle">+{conflict.usages.length - 6} more</span>}
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
                        <div className="space-y-1.5"><Label htmlFor="cost-rate-name">Yarn name</Label><Input id="cost-rate-name" value={draft.name} onChange={event => updateDraft('name', event.target.value)} placeholder="e.g. 30/1000 MUALTI" maxLength={120} disabled={Boolean(draft.id)} aria-invalid={Boolean(saveError)} aria-describedby={saveError ? 'cost-rate-save-error' : undefined} />{Boolean(draft.id) && <p className="text-xs leading-relaxed text-subtle"><span className="font-semibold text-body">Linked-yarn rename policy:</span> this name is locked in place. To rename it, add a new rate with the replacement name and update saved qualities intentionally. Costings you already saved do not change.</p>}{saveError && <p id="cost-rate-save-error" role="alert" className="text-xs font-medium text-destructive">{tx(saveError)}</p>}</div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Used in</Label><select value={draft.category} onChange={event => changeCategory(event.target.value as YarnRateCategory)} disabled={Boolean(draft.id)} className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm disabled:bg-surface-soft">{YARN_CATEGORIES.map(value => <option key={value} value={value}>{COST_RATE_CATEGORY_LABELS[value]}</option>)}</select></div><div className="space-y-1.5"><Label>Unit</Label><Input value="₹ per kg" disabled className="bg-surface-soft" /></div></div>
                        {draft.id && <p className="-mt-3 text-xs leading-relaxed text-subtle">Category and unit stay fixed for a linked yarn so saved qualities and historical costings keep the same meaning.</p>}
                        <div className="space-y-1.5"><Label>{t('common.current_yarn_rate')}</Label><Input type="number" min="0" step="0.01" value={draft.currentValue} onChange={event => updateDraft('currentValue', parseNonNegativeInput(event.target.value) ?? 0)} className="font-mono" /></div>
                        <div className="grid grid-cols-2 gap-3"><div className="space-y-1.5"><Label>Effective from</Label><Input type="date" value={draft.effectiveDate} onChange={event => updateDraft('effectiveDate', event.target.value)} /></div><div className="space-y-1.5"><Label>Review date</Label><Input type="date" value={draft.lastReviewedAt} onChange={event => updateDraft('lastReviewedAt', event.target.value)} /></div></div>
                        <div className="space-y-1.5"><Label>Source</Label><Input value={draft.source} onChange={event => updateDraft('source', event.target.value)} placeholder="Supplier quote, email, internal rate card…" disabled={draftHasDiscoverySource} />{draftHasDiscoverySource && <p className="text-xs leading-relaxed text-subtle">This is the source where the yarn was first discovered. It stays tied to the initial saved quality or costing.</p>}</div>
                        <div className="space-y-1.5"><Label>Notes</Label><Textarea value={draftHasFabricUsage ? getCostRateDisplayNotes(draftRate ?? { notes: draft.notes ?? null, fabric_names: [] }) ?? draft.notes : draft.notes} onChange={event => updateDraft('notes', event.target.value)} placeholder="Why this rate changed or how it should be used" maxLength={500} disabled={draftHasFabricUsage} />{draftHasFabricUsage ? <p className="text-xs leading-relaxed text-subtle">Automatically lists every saved fabric that currently uses this yarn.</p> : <p className="text-right text-xs text-subtle">{draft.notes?.length ?? 0}/500</p>}</div>
                        <div className="space-y-1.5"><Label>Review every</Label><select value={draft.reviewIntervalDays} onChange={event => updateDraft('reviewIntervalDays', Number(event.target.value))} className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm"><option value="30">30 days</option><option value="60">60 days</option><option value="90">3 months</option><option value="180">6 months</option><option value="365">12 months</option></select></div>
                    </div>}
                    {draft && !draft.name.trim() && <p id="cost-rate-save-hint" className="text-xs font-medium text-warning">{tx('Enter a yarn name before saving this rate.')}</p>}
                    <DialogFooter className="sm:justify-between">
                        {/* Retiring a yarn lives with its details: archive keeps its history, delete only when nothing uses it. */}
                        {draftRate && draftRate.is_active !== false ? (
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="ghost"
                                    onClick={() => { setDraft(null); setArchiveError(null); setArchiveRate(draftRate) }}
                                    disabled={isPending}
                                    aria-label={`Archive rate ${draftRate.name}`}
                                    className="text-risk hover:text-risk"
                                >
                                    <Archive className="h-4 w-4" aria-hidden="true" /> {tx('Archive rate')}
                                </Button>
                                {(!draftRate.fabric_names?.length && draftRate.saved_quality_count === 0 && !draftRate.apply_as_default) && (
                                    <Button
                                        variant="ghost"
                                        onClick={() => { setDraft(null); setDeleteError(null); setDeleteRate(draftRate) }}
                                        disabled={isPending}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" aria-hidden="true" /> {tx('Delete unused rate')}
                                    </Button>
                                )}
                            </div>
                        ) : <span />}
                        <div className="flex flex-col-reverse gap-2 sm:flex-row">
                            <Button variant="outline" onClick={() => setDraft(null)} disabled={isPending}>{tx('Cancel')}</Button>
                            <Button onClick={handleSave} disabled={isPending || !draft?.name.trim()} aria-describedby={!draft?.name.trim() ? 'cost-rate-save-hint' : undefined}>{isPending && <Loader2 className="h-4 w-4 animate-spin" />} {isPending ? tx('Saving…') : tx('Save current rate')}</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <PropagateYarnRateDialog
                rate={propagateRate}
                onOpenChange={open => { if (!open) setPropagateRate(null) }}
                onApplied={(rateId, resolvedCount) => setPropagationCounts(current => {
                    const remaining = Math.max(0, (current[rateId] ?? 0) - resolvedCount)
                    return { ...current, [rateId]: remaining }
                })}
            />

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

            {/* Each row confirms its price, or saves the new price typed in its field; the row then shows as done. */}
            <RateReviewDialog
                session={reviewSession}
                rates={rates}
                dueCount={dueCount}
                isDue={isDue}
                dueStatus={dueStatus}
                usage={rate => <YarnUsage rate={rate} loading={usageLoading} copy={copy} />}
                pendingId={pendingAction?.id ?? null}
                busy={isPending}
                onConfirm={handleQuickReview}
                onSavePrice={(rate, value) => handleQuickSave(rate, value, '')}
                onConfirmAll={handleConfirmAll}
                onClose={() => setReviewSession(null)}
            />

            <Dialog open={Boolean(reviewRate)} onOpenChange={open => { if (!open && !isPending) { setReviewRate(null); setReviewError(null) } }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Confirm current rate?</DialogTitle>
                        <DialogDescription>Confirm that this displayed rate is correct. This records that you checked it. The rate and your saved costings do not change.</DialogDescription>
                    </DialogHeader>
                    {reviewRate && <div className="space-y-3 rounded-lg border border-info/25 bg-info-soft p-4 text-info">
                        <div className="flex items-start justify-between gap-3"><div><p className="font-bold">{reviewRate.name}</p><p className="mt-1 text-xs text-info">{COST_RATE_CATEGORY_LABELS[reviewRate.category]}</p></div><p className="font-mono text-lg font-semibold">{formatRateValue(Number(reviewRate.current_value), reviewRate.unit)}</p></div>
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
                        <SheetDescription>Your checks and saved rates are listed here for your records. Saved costings keep their own numbers.</SheetDescription>
                    </SheetHeader>
                    <div className="px-6 py-2">
                        {historyLoading ? <div className="flex items-center justify-center gap-2 py-10 text-sm text-subtle" role="status" aria-live="polite"><Loader2 className="h-6 w-6 animate-spin text-saffron" /> {tx('Loading rate activity…')}</div>
                            : historyError ? <div className="py-10 text-center text-sm font-medium text-destructive" role="alert">{historyError}</div>
                            : historyRows.length ? <div className="space-y-3">{historyRows.map((row, index) => {
                                const previous = row.previous_value ?? historyRows[index + 1]?.value
                                const eventLabel = historyRate ? getRateHistoryEventLabel(row.value, previous, historyRate.unit, row.event_type) : 'Value recorded'
                                return <div key={row.id} className="rounded-lg border border-hairline bg-surface p-4">
                                    <div className="flex items-start justify-between gap-3"><div><p className="font-mono text-base font-semibold text-ink">{historyRate ? formatRateValue(row.value, historyRate.unit) : row.value}</p><p className="mt-1 text-xs font-semibold text-body">{eventLabel}</p></div><p className="text-right text-xs text-subtle">Effective {formatDateOnly(row.effective_date, { day: 'numeric', month: 'short', year: 'numeric' })}<br />Recorded {formatSuratDateTime(row.created_at)}</p></div>
                                    <p className="mt-2 text-sm font-medium text-body">{row.source || 'No source recorded'}</p>{row.notes && <p className="mt-1 text-xs text-subtle">{row.notes}</p>}<p className="mt-2 text-xs text-subtle">Recorded by {row.actor_name || (row.changed_by ? 'owner' : 'system')}</p>
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
                        <DialogDescription>{archiveRate?.is_active === false ? tx(`This makes the rate visible and editable in the active Rate Book again. ${t('base_plan.archive.restore')} ${t('base_plan.archive.deletion')} ${t('base_plan.archive.privacy')}`) : `${tx('This removes the rate from the active Rate Book. Saved qualities keep their yarn details, and saved costings do not change.')} ${t('base_plan.archive.description')} ${t('base_plan.archive.restore')} ${t('base_plan.archive.deletion')} ${t('base_plan.archive.privacy')}`}</DialogDescription>
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
                    {deleteRateInUse ? <>
                        <DialogHeader>
                            <DialogTitle>{fillCopy(copy.inUseTitle, { name: deleteRate?.name ?? '' })}</DialogTitle>
                            <DialogDescription>{copy.inUseBody}</DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteRate(null)}>{tx('Cancel')}</Button>
                            <Button onClick={() => { const target = deleteRate; setDeleteRate(null); setArchiveError(null); setArchiveRate(target) }}>
                                <Archive className="h-4 w-4" aria-hidden="true" />{copy.archiveInstead}
                            </Button>
                        </DialogFooter>
                    </> : <>
                        <DialogHeader>
                            <DialogTitle>{tx(`Delete ${deleteRate?.name ?? 'rate'} from Rate Book?`)}</DialogTitle>
                            <DialogDescription>{tx('This removes the unused yarn rate from your Rate Book. Since it is not used in any active quality or costing, it will not affect any calculations.')}</DialogDescription>
                        </DialogHeader>
                        {deleteError && <p role="alert" className="text-sm font-medium text-destructive">{deleteError}</p>}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => { setDeleteRate(null); setDeleteError(null) }} disabled={isPending}>{tx('Cancel')}</Button>
                            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {tx(isPending ? `Deleting ${deleteRate?.name ?? 'rate'}…` : 'Delete rate')}</Button>
                        </DialogFooter>
                    </>}
                </DialogContent>
            </Dialog>
            </div>

        </>
    )
}
