'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from 'react'
import { SavedCostingsTutorial } from '@/components/estimator/SavedCostingsTutorial'
import { savedCostingTourEnding, isSavedCostingHandoff, costingTourSurface, makeSavedCostingTourExamples, makeSavedCostingTourExport, type SavedCostingStep } from '@/lib/saved-costings-tour'
import { tourCommonCopy } from '@/lib/i18n/tour-common'
import { isSampleRecordId } from '@/lib/tours/sample-ids'
import { useRouter } from 'next/navigation'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState, parseCostingResultSnapshot, type CostingResultSnapshot } from '@/lib/estimator'
import {
    createEstimatorDraft,
    getEstimatorDraftStorageKey,
    parseEstimatorDraft,
    shouldWarnBeforeQuoteRestore,
    type EstimatorAutosaveData,
} from '@/lib/estimator-drafts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SwitchField } from '@/components/ui/switch-field'
import { railPrimaryAction } from '@/components/ui/rail'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { auditHistoricalCostingSnapshot, getEstimatorQuoteDetail, saveEstimatorQuoteV3, updateSavedCostingLibraryState } from '../estimator/actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { formatTimestampDate } from '@/lib/format'
import { formatSuratDateTime } from '@/lib/time'
import {
    FileText,
    ArrowRight,
    Loader2,
    AlertTriangle,
    Copy,
    Search,
    Eye,
    Plus,
    GitCompareArrows,
    Star,
    Archive,
    ArchiveRestore,
    BookmarkPlus,
    ChevronDown,
    Download,
    Factory,
    Handshake,
    RefreshCw,
    Sparkles,
    Trash2,
    X,
} from 'lucide-react'
import {
  compareSavedCostingSnapshots,
  orderSavedCostingsForComparison,
  buildSavedQualityRecipeState,
  filterAndSortSavedCostings,
  getSavedCostingIdentity,
  isSavedCostingArchived,
  getSavedCostingMetrics,
  buildDraftStateFromQuote,
  canPriceSavedRecipe,
  formatRevisionLead,
  type SavedQualityFactoryProfile,
  type SavedQualityFixedWorker,
  type SavedQualityRecipe,
  type SavedCostingMarginFilter,
  type SavedCostingSort,
  type SavedCostingDelta,
} from '@/lib/saved-costings'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { useArchivePolicyTopic } from '@/components/records/ArchivePolicyNotice'
import { createCostingExportModel } from '@/lib/estimator-export'
import { isStandaloneCosting, type CostingRecordKind } from '@/lib/costing-workspace'
import { useTranslation } from '@/lib/i18n/context'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { EmptyState, PageHeader, StatusBadge } from '@/components/ui/page-header'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import { liteRecordsCopy } from '@/lib/i18n/lite-records'
import { MOBILE_WORKSPACE_QUERY } from '@/lib/mobile-workflow-navigation'
import mobileStyles from '@/components/estimator/lite-records.module.css'
import { CompositionBar, Swatch } from '@/components/stock/stock-presentation'
import { averageMargin, averageYarnShare, costMix, marginRanking, qualityYarns, type CostMixKey } from '@/lib/costing-catalogue'
import { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { fillCopy } from '@/lib/i18n/fill'
import { costingMarginText } from '@/lib/i18n/costing-margin'
import { offerCheckText } from '@/lib/i18n/offer-check'
import { CostingMarginScope, marginTone, type MarginReadOnlyReason } from '@/components/estimator/SavedCostingMargin'

const CostingExportDialog = dynamic(
    () => import('@/components/estimator/CostingExportDialog').then(module => module.CostingExportDialog),
    { ssr: false, loading: () => null },
)

/* Historical copy reference retained for source-regression coverage: expand a quality to review its costing history. */

/** Card actions: a quiet bordered button and a text-only one, 44px tall on phones. */
const secondaryAction = 'h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs hover:bg-surface-soft max-md:min-h-[44px]'
const ghostAction = 'h-10 rounded-lg font-semibold text-body max-md:min-h-[44px]'

/** Where a costing's money goes, in the chart colours the stock pages use: yarn leads in loom navy. */
const COST_MIX_COLORS: Record<CostMixKey, string> = {
    yarn: 'var(--wv-viz-1)',
    weaving: 'var(--wv-viz-2)',
    processing: 'var(--wv-neel-300)',
    factory: 'var(--wv-viz-4)',
}

type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'rejected'
type QuoteDraftState = ReturnType<typeof makeDefaultEstimateState>
type QuoteLinkedOrder = {
    id: string
    status: string
    party_name?: string | null
    quality_label?: string | null
    total_target_meters?: number | null
    market_run_id?: string | null
    production_logs?: { meters: number | string | null }[] | null
    warp_instruction?: string | null
    weft_instruction?: string | null
}

type SavedQuality = SavedQualityRecipe & {
    id: string
    name: string
    updated_at: string
    is_active?: boolean
}

type QuoteRow = {
    id: string
    status: QuoteStatus
    party_name: string | null
    quality_label: string | null
    quote_price_per_meter: number
    landed_cost_per_meter: number
    intended_margin_percent: number
    created_at: string
    updated_at: string
    sent_at?: string | null
    quotation_reference?: string | null
    quotation_valid_until?: string | null
    customer_terms?: string | null
    meters: number
    snapshot_data?: QuoteDraftState
    source_quote_id?: string | null
    costing_group_id?: string | null
    version_number?: number | null
    is_archived?: boolean
    is_favorite?: boolean
    record_kind?: CostingRecordKind | null
    template_id?: string | null
    market_run_id?: string | null
    warp_instruction?: string | null
    weft_instruction?: string | null
    warp_rows?: QuoteDraftState['warpRows']
    weft_rows?: QuoteDraftState['weftRows']
    beam_ends?: number | null
    reed_space?: number | null
    weft_denier?: number | null
    yarn_denier?: number | null
    yarn_rate_per_kg?: number | null
    ppi?: number | null
    tape_length_m?: number | null
    per_pick_cost_paise?: number | null
    warping_rate_per_kg?: number | null
    sizing_rate_per_kg?: number | null
    winding_rate_per_kg?: number | null
    processing_rate_per_m?: number | null
    finishing_rate_per_m?: number | null
    yarn_shortage_pct?: number | null
    warp_crimp_pct?: number | null
    overhead_items?: QuoteDraftState['overheadItems']
    monthly_output_m?: number | null
    overhead_override_per_m?: number | null
    overhead_mode?: QuoteDraftState['overheadMode'] | null
    overhead_pct?: number | null
    commission_pct?: number | null
    transport_per_m?: number | null
    profit_margin_pct?: number | null
    enabled_sections?: QuoteDraftState['enabledSections']
    loom_type?: QuoteDraftState['loomType']
    estimator_rpm?: number | null
    estimator_power_kw?: number | null
    hours_per_shift?: number | null
    warping_mode?: QuoteDraftState['warpingMode']
    sizing_mode?: QuoteDraftState['sizingMode']
    loom_count?: number | null
    monthly_working_days?: number | null
    avg_output_per_loom_per_day?: number | null
    calculation_version?: string | null
    rounding_policy?: string | null
    production_cost_per_meter?: number | null
    overhead_per_meter?: number | null
    commission_cost_per_meter?: number | null
    break_even_price_per_meter?: number | null
    expected_profit_per_meter?: number | null
    expected_profit_total?: number | null
    actual_margin_percent?: number | null
    costing_result_snapshot?: unknown
    /** The saved result's per-metre breakdown, read with the library summary for the card's cost mix. */
    cost_breakdown?: unknown
    costing_input_fingerprint?: string | null
    factory_profile_updated_at?: string | null
    reconciliation_status?: string | null
    reconciliation_note?: string | null
    orders?: QuoteLinkedOrder | QuoteLinkedOrder[] | null
}

function getLinkedOrder(quote: QuoteRow) {
    return Array.isArray(quote.orders) ? quote.orders[0] : quote.orders
}

function normalizeQualityKey(value: string | null | undefined) {
    return (value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-IN')
}

type SavedQualityGroup = {
    key: string
    name: string
    template: SavedQuality | null
    records: QuoteRow[]
    updatedAt: string
    currentRecipeCostPerM: number | null
}

function getCostingStatus(quote: QuoteRow) {
    return getSavedCostingMetrics(quote).status
}

function getCostingTrustCopy(status: string | null | undefined) {
    if (status === 'verified') return 'Saved numbers checked.'
    if (status === 'needs_review') return 'Saved values are preserved, but the stored numbers need owner review before quotation export.'
    if (status === 'unreconstructable') return 'Saved values are preserved, but older assumptions are incomplete. Save a new costing before using it as a quotation.'
    if (status === 'legacy') return 'This costing was saved before this check existed. Its numbers are kept exactly as saved; today’s rates were not applied.'
    return 'The saved numbers of this costing have not been checked yet.'
}

function getCostingBadge(status: string | null | undefined) {
    return status === 'legacy' || status === 'unreconstructable' ? 'Older saved costing' : 'Needs a check'
}

function getProductionCostPerM(quote: QuoteRow) {
    return getSavedCostingMetrics(quote).productionCostPerM
}

function getSuggestedSellingPricePerM(quote: QuoteRow) {
    return getSavedCostingMetrics(quote).suggestedSellingPricePerM
}

function getActualMarginPct(quote: QuoteRow) {
    return getSavedCostingMetrics(quote).actualMarginPct
}

function getHistoricalCostingResult(quote: QuoteRow): CostingResultSnapshot | null {
    return parseCostingResultSnapshot(quote.costing_result_snapshot)
}

function formatCostingMoneyPerM(value: number | null) {
    return value == null ? 'Not available' : `₹${value.toFixed(2)}/m`
}

function formatCostingPercent(value: number | null) {
    return value == null ? 'Not available' : `${value.toFixed(1)}%`
}

const comparisonPriceLabels = ['Break-even selling price'] as const

type ComparisonChangeGroup = 'cost-driving' | 'reference'

type ComparisonRowMeta = {
    group?: ComparisonChangeGroup
    context?: { left: string; right: string }
}

type ComparisonTableRow =
    | ({ label: string; unit: 'text'; text: { left: string | null; right: string | null }; changed: boolean } & ComparisonRowMeta)
    | ({ label: string; unit: 'money' | 'percent' | 'number' | 'rate'; value: SavedCostingDelta; changed: boolean } & ComparisonRowMeta)

type ComparisonSection = {
    title: string
    changed: boolean
    rows: ComparisonTableRow[]
}

type ComparisonGroup = {
    key: ComparisonChangeGroup
    title: string
    description: string
    sections: ComparisonSection[]
}

function formatComparisonValue(value: number | null, unit: 'money' | 'percent' | 'number') {
    if (value == null) return 'Not available'
    if (unit === 'money') return `₹${value.toFixed(2)}/m`
    if (unit === 'percent') return `${value.toFixed(1)}%`
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

function formatComparisonDelta(value: SavedCostingDelta, unit: 'money' | 'percent' | 'number') {
    if (value.delta == null) return 'Not available'
    if (Math.abs(value.delta) <= 0.0001) return 'No change'
    const direction = value.delta > 0 ? 'higher' : 'lower'
    if (unit === 'money') return `₹${Math.abs(value.delta).toFixed(2)}/m ${direction}`
    if (unit === 'percent') return `${Math.abs(value.delta).toFixed(1)} pp ${direction}`
    return `${Math.abs(value.delta).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${direction}`
}

function formatSuggestedPriceMovement(value: SavedCostingDelta) {
    if (value.delta == null) return 'New suggested selling price is not available for this comparison.'
    if (Math.abs(value.delta) <= 0.0001) return 'New suggested selling price is unchanged from Old.'
    return `New suggested selling price is ₹${Math.abs(value.delta).toFixed(2)}/m ${value.delta > 0 ? 'higher' : 'lower'} than Old.`
}

function deltaChangedForUi(value: SavedCostingDelta) {
    return value.delta != null && Math.abs(value.delta) > 0.0001
}

function getCurrentRecipeCostPerM(
    template: SavedQuality,
    profile?: SavedQualityFactoryProfile,
    fixedWorkers: SavedQualityFixedWorker[] = [],
) {
    try {
        return calcFullTotals(buildSavedQualityRecipeState(template, profile, fixedWorkers)).totalProductionCostPerM
    } catch (error) {
        console.error('Unable to calculate a saved quality recipe', template.id, error)
        return null
    }
}

// A tap anywhere on a saved costing card opens its breakdown. Taps on the card's own
// controls keep their action, taps inside the breakdown dialog (a portal, so outside the
// card's DOM) are ignored, and a drag that selects text does not count as a tap.
function openBreakdownFromCard(event: MouseEvent<HTMLElement>, openBreakdown: () => void) {
    const target = event.target as Element | null
    if (!target || !event.currentTarget.contains(target)) return
    if (target.closest('button, a, input, select, textarea, label, [role="button"], [role="dialog"]')) return
    if (window.getSelection()?.toString()) return
    openBreakdown()
}

function SavedQualityLibraryView({
    groups,
    canUseProductionPipeline,
    openKey,
    comparisonMode,
    selectedCostingIds,
    updatingId,
    detailLoadingId,
    onOpenDetails,
    onCloseDetails,
    onToggleComparison,
    onOpen,
    onStartFrom,
    onSaveAsNewQuality,
    onExport,
    onAudit,
    auditingId,
    onToggleFavorite,
    onToggleArchived,
    onEnsureDetail,
    factoryInputsCapturedLabel,
    tourStep,
    selectedRecordIdByGroup,
    onSelectRecord,
    onSaveMargin,
    onDeleteSample,
}: {
    groups: SavedQualityGroup[]
    canUseProductionPipeline: boolean
    openKey: string | null
    comparisonMode: boolean
    selectedCostingIds: string[]
    updatingId: string | null
    detailLoadingId: string | null
    onOpenDetails: (key: string, singleSnapshot?: QuoteRow | null) => void
    onCloseDetails: () => void
    onToggleComparison: (id: string) => void
    onOpen: (quote: QuoteRow) => void
    onStartFrom: (quote: QuoteRow) => void
    onSaveAsNewQuality: (quote: QuoteRow) => void
    onExport: (quote: QuoteRow) => void
    onAudit: (quote: QuoteRow) => void
    auditingId: string | null
    onToggleFavorite: (quote: QuoteRow) => void
    onToggleArchived: (quote: QuoteRow) => void
    onEnsureDetail?: (quote: QuoteRow) => Promise<QuoteRow | null>
    factoryInputsCapturedLabel: string
    selectedRecordIdByGroup: Record<string, string>
    onSelectRecord: (groupKey: string, recordId: string) => void
    /** Saves a what-if margin from the breakdown as the next version; true when it was saved. */
    onSaveMargin: (record: QuoteRow, groupKey: string, marginPct: number, clientRequestId: string) => Promise<boolean>
    tourStep?: SavedCostingStep | null
    /** Removes the sample costing; the sample card offers it outside the tour, as the sample yarn card does. */
    onDeleteSample?: () => void
}) {
    const { t, tx, language } = useTranslation()
    const copy = costingCatalogueText[language]
    const offerCopy = offerCheckText[language]

    return (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,30rem),1fr))]">
            {groups.map((group, groupIndex) => {
                const isOpen = openKey === group.key
                const latest = group.records[0] ?? null
                const selectedRecordId = tourStep ? (tourStep === 'versions' || tourStep === 'compareSelect' ? null : group.records[0]?.id) : selectedRecordIdByGroup[group.key]
                // The breakdown always shows a version: the one picked in the history, else the latest.
                // The tour's version steps keep it empty so they can point at the history alone.
                const activeRecord = (selectedRecordId ? group.records.find(r => r.id === selectedRecordId) : null) ?? (tourStep && group.records.length > 1 ? null : latest)
                const targetRecord = activeRecord ?? latest
                const latestResult = activeRecord ? getHistoricalCostingResult(activeRecord) : null
                const activeResult = latestResult
                const activeDetailLoading = targetRecord != null && detailLoadingId === targetRecord.id
                const activeYarnCostLines: Array<[string, number]> = activeResult?.audit
                    ? [
                        ['Base warp yarn', activeResult.audit.warp.layers.reduce((sum, row) => sum + row.baseCostPerMeter, 0)],
                        ['Base weft yarn', activeResult.audit.weft.layers.reduce((sum, row) => sum + row.baseCostPerMeter, 0)],
                        ['Yarn wastage / crimp', activeResult.audit.yarnAdjustmentCostPerMeter],
                    ]
                    : activeResult
                        ? [
                            ['Warp yarn (saved adjusted cost)', activeResult.breakdown.warpCostPerM],
                            ['Weft yarn (saved adjusted cost)', activeResult.breakdown.weftCostPerM],
                        ]
                        : []
                const activeMix = activeResult ? costMix(activeResult.breakdown) : null
                // The breakdown's margin slider: only the latest, checked, unarchived version can
                // be changed (a save adds the next version), and only while its dialog is open.
                const activeVersionNumber = Number(activeRecord?.version_number ?? 1)
                const latestVersionNumber = group.records.reduce((highest, record) => Math.max(highest, Number(record.version_number ?? 1)), 1)
                const marginReadOnly: MarginReadOnlyReason | null = !activeRecord
                    ? null
                    : activeRecord.is_archived || group.template?.is_active === false
                        ? 'archived'
                        : activeVersionNumber < latestVersionNumber
                            ? 'older'
                            : getCostingStatus(activeRecord) !== 'verified' ? 'checked' : null
                const marginBase = isOpen && activeRecord && !marginReadOnly ? buildDraftStateFromQuote(activeRecord) : null
                const openGroupDetails = () => onOpenDetails(group.key, latest)
                const handleInspectRecord = (record: QuoteRow) => {
                    onSelectRecord(group.key, record.id)
                    if (onEnsureDetail) {
                        void onEnsureDetail(record)
                    }
                }

                const latestMetrics = latest ? getSavedCostingMetrics(latest) : null
                // Costings saved before cost and margin were stored keep their
                // saved price but have no cost. The owner recalculates them
                // into a new version; the old one is never rewritten.
                const costNotSaved = latestMetrics != null && latestMetrics.productionCostPerM == null
                const canReuseLatest = latest != null && !latest.is_archived && group.template?.is_active !== false
                // The change line compares the costing shown with the version saved before it.
                const prior = latest
                    ? group.records
                        .filter(record => Number(record.version_number ?? 1) < Number(latest.version_number ?? 1))
                        .sort((left, right) => Number(right.version_number ?? 1) - Number(left.version_number ?? 1))[0] ?? null
                    : null
                const previousCost = prior ? getProductionCostPerM(prior) : null
                const costChange = latestMetrics?.productionCostPerM != null && previousCost != null && previousCost > 0
                    ? { difference: latestMetrics.productionCostPerM - previousCost, percent: ((latestMetrics.productionCostPerM - previousCost) / previousCost) * 100 }
                    : null
                const mix = latest ? costMix(latest.cost_breakdown ?? getHistoricalCostingResult(latest)?.breakdown) : null
                const yarns = qualityYarns(group.template)
                const savedMeta = latest
                    ? [
                        `v${Number(latest.version_number ?? 1)}`,
                        fillCopy(copy.savedOn, { date: formatTimestampDate(latest.created_at, { day: 'numeric', month: 'short' }) }),
                        Number(latest.meters) > 0 ? fillCopy(copy.costedFor, { m: Number(latest.meters).toLocaleString('en-IN') }) : null,
                    ].filter(Boolean).join(' · ')
                    : tx('Saved recipe · no saved costing yet')

                return (
                    <article
                        key={group.key}
                        data-costing-tour={tourStep && groupIndex === 0 ? "sample" : undefined}
                        data-tour-anchor={!tourStep && groupIndex === 0 && !isSampleRecordId(group.key) ? "costings.first-card" : undefined}
                        tabIndex={!tourStep && groupIndex === 0 ? -1 : undefined}
                        data-i18n-skip="true"
                        lang={language}
                        onClick={tourStep ? undefined : event => openBreakdownFromCard(event, openGroupDetails)}
                        className={cn(
                            'flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:px-6',
                            !tourStep && 'cursor-pointer transition-colors hover:border-hairline-strong',
                        )}
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="break-words text-[17px] font-semibold leading-snug text-ink" title={group.name}>{group.name}</h3>
                                <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">{savedMeta}</p>
                                {(group.template?.is_active === false || (latest && getCostingStatus(latest) !== 'verified')) && (
                                    <p className="mt-1.5 flex flex-wrap gap-x-3 text-[13px] font-medium">
                                        {group.template?.is_active === false && <span className="text-muted-foreground">{tx('Archived · read-only')}</span>}
                                        {latest && getCostingStatus(latest) !== 'verified' && <span className="text-[var(--wv-ochre-800)]">{tx(getCostingBadge(getCostingStatus(latest)))}</span>}
                                    </p>
                                )}
                            </div>
                            <div className="-mr-2 -mt-1.5 flex shrink-0 items-center gap-1">
                                {onDeleteSample && isSampleRecordId(group.key) && !tourStep && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={onDeleteSample}
                                        className="h-10 gap-1.5 px-3 text-xs font-semibold max-md:h-11"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                                        {tx('Delete sample costing')}
                                    </Button>
                                )}
                                {latest && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => onToggleFavorite(latest)}
                                        disabled={updatingId === latest.id}
                                        aria-pressed={Boolean(latest.is_favorite)}
                                        aria-label={fillCopy(latest.is_favorite ? copy.removeFavourite : copy.addFavourite, { name: group.name })}
                                        className="h-10 w-10 shrink-0 max-md:h-11 max-md:w-11"
                                    >
                                        <Star className={cn('h-[18px] w-[18px]', latest.is_favorite ? 'fill-saffron text-saffron-deep' : 'text-muted-foreground')} aria-hidden="true" />
                                    </Button>
                                )}
                            </div>
                        </div>

                        {latest && latestMetrics ? (
                            <div>
                                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
                                    <div>
                                        <p className="text-[13px] text-muted-foreground">{copy.cost}</p>
                                        {latestMetrics.productionCostPerM == null ? (
                                            <p className="mt-1.5 text-2xl font-semibold leading-none text-muted-foreground">{copy.notSaved}</p>
                                        ) : (
                                            <p className="mt-1.5 text-4xl font-semibold leading-none tracking-[-0.03em] text-ink tabular-nums">
                                                ₹{latestMetrics.productionCostPerM.toFixed(2)}<span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">/m</span>
                                            </p>
                                        )}
                                    </div>
                                    <dl className="flex gap-7 sm:text-right">
                                        <div>
                                            <dt className="text-[13px] text-muted-foreground">{copy.sellsAt}</dt>
                                            <dd className="mt-1.5 text-lg font-semibold text-ink tabular-nums">{latestMetrics.suggestedSellingPricePerM == null ? '—' : `₹${latestMetrics.suggestedSellingPricePerM.toFixed(2)}`}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-[13px] text-muted-foreground">{copy.margin}</dt>
                                            <dd className={cn('mt-1.5 text-lg font-semibold tabular-nums', marginTone(latestMetrics.actualMarginPct))}>{costNotSaved ? '—' : formatCostingPercent(latestMetrics.actualMarginPct)}</dd>
                                        </div>
                                    </dl>
                                </div>
                                {costNotSaved && (
                                    <p data-costing-recalculate-note="true" className="mt-3 text-[13px] leading-snug text-muted-foreground">
                                        {canReuseLatest
                                            ? fillCopy(copy.costNotSavedNote, { n: Number(latest.version_number ?? 1) + 1 })
                                            : copy.costNotSavedReadOnly}
                                    </p>
                                )}
                                {costChange && Math.abs(costChange.difference) >= 0.005 && prior && (
                                    <p className="mt-2 text-[13px] tabular-nums">
                                        <span className={cn('font-semibold', costChange.difference > 0 ? 'text-[var(--wv-ochre-800)]' : 'text-[var(--wv-moss-700)]')}>
                                            {costChange.difference > 0 ? '↑' : '↓'} ₹{Math.abs(costChange.difference).toFixed(2)} · {Math.abs(costChange.percent).toFixed(1)}%
                                        </span>
                                        <span className="text-muted-foreground"> {fillCopy(copy.fromVersion, { n: Number(prior.version_number ?? 1), date: formatTimestampDate(prior.created_at, { day: 'numeric', month: 'short' }) })}</span>
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div>
                                <p className="text-[13px] text-muted-foreground">{tx('Current recipe')}</p>
                                <p className="mt-1.5 text-2xl font-semibold text-ink tabular-nums">{group.currentRecipeCostPerM != null ? `₹${group.currentRecipeCostPerM.toFixed(2)}/m` : tx('Not calculated')}</p>
                                <p className="mt-2 text-[13px] text-muted-foreground">{copy.noCosting}</p>
                            </div>
                        )}

                        {mix && (
                            <div>
                                <CompositionBar
                                    label={fillCopy(copy.mixLabel, { parts: mix.parts.map(part => `${copy[part.key]} ${Math.round((part.value / mix.total) * 100)}%`).join(', ') })}
                                    segments={mix.parts.map(part => ({ key: part.key, value: part.value, color: COST_MIX_COLORS[part.key] }))}
                                />
                                <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                                    {mix.parts.filter(part => part.value > 0).map(part => (
                                        <li key={part.key} className="flex items-center gap-1.5 tabular-nums">
                                            <Swatch color={COST_MIX_COLORS[part.key]} className="size-2" />
                                            {copy[part.key]} <span className="text-body">₹{part.value.toFixed(2)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {(yarns.warp.length > 0 || yarns.weft.length > 0) && (
                            <p className="text-[13px] leading-snug">
                                {yarns.warp.length > 0 && <><span className="text-muted-foreground">{copy.warp} </span><span className="text-ink">{yarns.warp.join(', ')}</span></>}
                                {yarns.warp.length > 0 && yarns.weft.length > 0 && <span className="text-muted-foreground"> · </span>}
                                {yarns.weft.length > 0 && <><span className="text-muted-foreground">{copy.weft} </span><span className="text-ink">{yarns.weft.join(', ')}</span></>}
                            </p>
                        )}

                        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={openGroupDetails}
                                aria-haspopup="dialog"
                                aria-label={`${copy.breakdown}: ${group.name}`}
                                className={secondaryAction}
                            >
                                {copy.breakdown}
                            </Button>
                            {latest && canReuseLatest && (costNotSaved ? (
                                <Button
                                    type="button"
                                    onClick={() => onOpen(latest)}
                                    disabled={updatingId === latest.id}
                                    aria-label={fillCopy(copy.recalculateLabel, { name: group.name })}
                                    className="h-10 rounded-lg font-semibold max-md:min-h-[44px]"
                                >
                                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> {copy.recalculate}
                                </Button>
                            ) : (
                                <Button type="button" variant="outline" onClick={() => onOpen(latest)} disabled={updatingId === latest.id} className={secondaryAction}>
                                    <ArrowRight className="h-4 w-4" aria-hidden="true" /> {t('tourControls.savedCostings.use')}
                                </Button>
                            ))}
                            {latest && canReuseLatest && !costNotSaved && !tourStep && !isSampleRecordId(group.key) && getCostingStatus(latest) === 'verified' && (
                                <Button asChild variant="ghost" className={ghostAction}>
                                    <Link href={`/owner/quotes/offer?costing=${latest.id}`} aria-label={fillCopy(offerCopy.cardActionLabel, { name: group.name })}>
                                        <Handshake className="h-4 w-4" aria-hidden="true" /> {offerCopy.cardAction}
                                    </Link>
                                </Button>
                            )}
                            {latest && (
                                <Button type="button" variant="ghost" onClick={() => onExport(latest)} className={cn('ml-auto', ghostAction)}>
                                    <Download className="h-4 w-4" aria-hidden="true" /> {tx('Export')}
                                </Button>
                            )}
                        </div>

                            <Dialog modal={!tourStep} open={isOpen} onOpenChange={open => { if (!open && !tourStep) onCloseDetails() }}>
                                <DialogContent
                                    data-costing-tour-dialog={tourStep ? "true" : undefined} data-tour-surface={tourStep ? "true" : undefined}
                                    showCloseButton={false}
                                    onPointerDownOutside={event => { if (tourStep) event.preventDefault(); else onCloseDetails() }}
                                    onEscapeKeyDown={event => { if (tourStep) event.preventDefault(); else onCloseDetails() }}
                                    onOpenAutoFocus={event => { if (tourStep) event.preventDefault() }}
                                    onCloseAutoFocus={event => { if (tourStep) event.preventDefault() }}
                                    // Beside the nav the dialog centres in the content area. On a phone it is a bottom
                                    // sheet (app/mobile.css) and must keep its own `left: 0`, so the offset is for sm+ only.
                                    style={{ '--costing-dialog-left': 'calc(50% + clamp(0px, calc((100vw - 1212px) / 2), calc(var(--shell-sidebar-w) / 2)))' } as CSSProperties}
                                    className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:left-[var(--costing-dialog-left)] sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[1180px]"
                                >
                                    <div className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:flex sm:flex-col sm:overflow-y-hidden">
                                        <DialogHeader className="relative sticky top-0 z-20 shrink-0 border-b border-hairline bg-surface px-5 py-4 pr-16 sm:px-6 sm:pr-16">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <DialogTitle className="min-w-0 flex-1 truncate text-xl font-semibold tracking-[-0.01em]" title={group.name}>{group.name}</DialogTitle>
                                                {group.template?.is_active === false && <Badge variant="outline" className="border-hairline bg-surface-soft text-xs font-bold text-subtle">{tx('Archived · read-only')}</Badge>}
                                                {(activeRecord ?? latest) && <Badge variant="outline" className="text-xs font-bold">v{Number((activeRecord ?? latest)?.version_number ?? 1)}</Badge>}
                                            </div>
                                            <DialogDescription>
                                                {group.records.length > 0
                                                    ? `${group.records.length} saved ${group.records.length === 1 ? 'version' : 'versions'} · updated ${formatTimestampDate(group.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                    : 'Saved recipe · no saved costing yet'}
                                            </DialogDescription>
                                            {!tourStep && <DialogClose asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Close ${group.name} details`}
                                                    className="absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                                                >
                                                    <X className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                            </DialogClose>}
                                        </DialogHeader>

                                        {/* Beside the nav the breakdown stays put and only the version history scrolls; the history keeps a
                                            minimum height, so on a short window the whole body scrolls instead. */}
                                        <div className="ui-disclosure-content w-full min-w-0 bg-surface-soft/60 p-4 sm:flex sm:min-h-0 sm:flex-1 sm:flex-col sm:overflow-y-auto sm:p-5">
                                    {!activeRecord || activeDetailLoading || !activeResult ? (
                                        <div className="flex w-full shrink-0 flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-surface px-6 py-10 text-center">
                                            {activeDetailLoading ? <Loader2 className="h-6 w-6 animate-spin text-info" /> : (activeRecord ?? latest) ? <AlertTriangle className="h-6 w-6 text-warning" /> : <FileText className="h-6 w-6 text-subtle" />}
                                            <p className="mt-3 text-sm font-bold text-body">{tx(activeDetailLoading
                                                ? 'Loading saved costing details…'
                                                : !activeRecord
                                                    ? group.records.length > 1
                                                        ? 'Choose a costing version to view its breakdown'
                                                        : 'No costing saved for this quality yet'
                                                    : !activeResult
                                                        ? 'This saved costing does not have a detailed breakdown yet'
                                                        : group.currentRecipeCostPerM != null
                                                            ? `Current recipe estimate: ₹${group.currentRecipeCostPerM.toFixed(2)}/m`
                                                            : 'No costing saved for this quality yet')}</p>
                                            <p className="mt-1 max-w-md text-xs text-subtle">{tx(activeDetailLoading
                                                ? 'Loading the saved costs and price breakdown for this costing.'
                                                : !activeRecord
                                                    ? group.records.length > 1
                                                        ? 'This quality has multiple saved versions. Select View breakdown on the version you want to inspect; saved commercial totals remain unchanged.'
                                                        : group.currentRecipeCostPerM != null
                                                            ? 'This is a live estimate from the saved yarns and today’s factory costs, not a saved costing. Set a quantity and choose Save Costing to keep the full breakdown.'
                                                            : 'Open Cost Estimate, choose this saved quality, set the costing quantity, and choose Save Costing. Its analysis will then appear here.'
                                                    : 'The saved commercial totals remain available in Saved Costing history. Open this version in Cost Estimate to review its saved assumptions.')}</p>
                                            {targetRecord && !activeDetailLoading && (
                                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                                    {!targetRecord.is_archived && !latest.is_archived && group.template?.is_active !== false && <Button size="sm" onClick={() => onOpen(targetRecord)} className="rounded-lg bg-loom font-medium text-white hover:bg-loom-elevated hover:text-white"><ArrowRight className="h-3.5 w-3.5" /> {t('tourControls.savedCostings.use')}</Button>}
                                                    <Button variant="outline" size="sm" onClick={() => onStartFrom(targetRecord)}><Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}</Button>
                                                    <Button variant="outline" size="sm" onClick={() => onExport(targetRecord)}><Download className="h-3.5 w-3.5" /> {tx('Export')}</Button>
                                                    <Button variant="outline" size="sm" onClick={() => onSaveAsNewQuality(targetRecord)}><BookmarkPlus className="h-3.5 w-3.5" /> {tx('Save as separate quality')}</Button>
                                                    {canUseProductionPipeline && isStandaloneCosting(targetRecord.record_kind) && !targetRecord.is_archived && (
                                                        <Link
                                                                prefetch={tourStep ? false : undefined}
                                                                data-costing-tour="production"
                                                            href={`/owner/production?tab=jobs&costingId=${encodeURIComponent(targetRecord.id)}`}
                                                            onClick={() => trackPlanEvent('production_cta_clicked', { source: 'saved_costing_detail' })}
                                                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-saffron/30 bg-saffron-soft px-3 text-xs font-semibold text-saffron-deep hover:bg-saffron-soft/80"
                                                        >
                                                            <Factory className="h-3.5 w-3.5" /> {tx('Activate for Production')}
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 sm:shrink-0">
                                            <CostingMarginScope
                                                key={activeRecord.id}
                                                base={marginBase}
                                                saved={latestResult}
                                                readOnly={marginReadOnly}
                                                versionNumber={activeVersionNumber}
                                                latestVersionNumber={latestVersionNumber}
                                                isSample={isSampleRecordId(activeRecord.id)}
                                                costLabel={t('common.production_cost_per_m')}
                                                priceLabel={t('common.suggested_selling_price_per_m')}
                                                onSave={(marginPct, clientRequestId) => onSaveMargin(activeRecord, group.key, marginPct, clientRequestId)}
                                            >
                                            {({ paused, pausedTitle, economics }) => (
                                            <section data-costing-tour="breakdown" className="rounded-xl border border-hairline bg-surface p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-base font-semibold text-ink">{tx(group.records.length > 1 ? `Saved Costing v${Number(activeRecord.version_number ?? 1)} breakdown` : 'Latest Saved Costing breakdown')}</p>
                                                        <p className="mt-0.5 text-[13px] text-muted-foreground">{`Version ${Number(activeRecord.version_number ?? 1)} · ${formatTimestampDate(activeRecord.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
                                                    </div>
                                                    <div data-costing-tour="reuse" className="flex flex-wrap gap-2">
                                                        {!activeRecord.is_archived && group.template?.is_active !== false && <Button size="sm" onClick={() => onOpen(activeRecord)} disabled={paused || updatingId === activeRecord.id} title={pausedTitle} aria-busy={updatingId === activeRecord.id} className="rounded-lg bg-loom font-medium text-white hover:bg-loom-elevated hover:text-white"><ArrowRight className="h-3.5 w-3.5" /> {t('tourControls.savedCostings.use')}</Button>}
                                                        <Button variant="outline" size="sm" onClick={() => onStartFrom(activeRecord)} disabled={paused} title={pausedTitle}><Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onExport(activeRecord)} disabled={paused} title={pausedTitle}><Download className="h-3.5 w-3.5" /> {tx('Export')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onSaveAsNewQuality(activeRecord)} disabled={paused} title={pausedTitle}><BookmarkPlus className="h-3.5 w-3.5" /> {tx('Save as separate quality')}</Button>
                                                        {canUseProductionPipeline && isStandaloneCosting(activeRecord.record_kind) && !activeRecord.is_archived && (
                                                            <Link
                                                                prefetch={tourStep ? false : undefined}
                                                                data-costing-tour="production"
                                                                href={`/owner/production?tab=jobs&costingId=${encodeURIComponent(activeRecord.id)}`}
                                                                onClick={event => { if (paused) event.preventDefault(); else trackPlanEvent('production_cta_clicked', { source: 'saved_costing_breakdown' }) }}
                                                                aria-disabled={paused || undefined}
                                                                title={pausedTitle}
                                                                className={cn('inline-flex h-9 items-center gap-1.5 rounded-md border border-saffron/30 bg-saffron-soft px-3 text-xs font-semibold text-saffron-deep hover:bg-saffron-soft/80', paused && 'pointer-events-none opacity-50')}
                                                            >
                                                                <Factory className="h-3.5 w-3.5" /> {tx('Activate for Production')}
                                                            </Link>
                                                        )}
                                                        <Button variant="outline" size="sm" onClick={() => onToggleArchived(activeRecord)} disabled={updatingId === activeRecord.id} aria-busy={updatingId === activeRecord.id}>
                                                            {updatingId === activeRecord.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : activeRecord.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                                            {tx(updatingId === activeRecord.id ? activeRecord.is_archived ? `Restoring ${getSavedCostingIdentity(activeRecord).label}…` : `Archiving ${getSavedCostingIdentity(activeRecord).label}…` : (activeRecord.is_archived || latest.is_archived ? 'Restore costing' : 'Archive costing'))}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {activeMix && (
                                                    <div className="mt-4" data-i18n-skip="true" lang={language}>
                                                        <CompositionBar
                                                            label={fillCopy(copy.mixLabel, { parts: activeMix.parts.map(part => `${copy[part.key]} ${Math.round((part.value / activeMix.total) * 100)}%`).join(', ') })}
                                                            segments={activeMix.parts.map(part => ({ key: part.key, value: part.value, color: COST_MIX_COLORS[part.key] }))}
                                                        />
                                                        <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted-foreground">
                                                            {activeMix.parts.filter(part => part.value > 0).map(part => (
                                                                <li key={part.key} className="flex items-center gap-1.5 tabular-nums">
                                                                    <Swatch color={COST_MIX_COLORS[part.key]} className="size-2" />
                                                                    {copy[part.key]} <span className="text-body">{Math.round((part.value / activeMix.total) * 100)}%</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                                <div className="mt-4 divide-y divide-hairline text-sm">
                                                    {[
                                                        ...activeYarnCostLines,
                                                        ['Weaving', latestResult.breakdown.weaveCostPerM],
                                                        ['Warping & sizing', latestResult.breakdown.warpingAndSizingPerM],
                                                        ['Processing & finishing', latestResult.breakdown.windingPerM + latestResult.breakdown.processingPerM + latestResult.breakdown.finishingPerM],
                                                        ['Factory expenses', latestResult.breakdown.overheadPerM],
                                                    ].map(([label, value]) => (
                                                        <div key={String(label)} className="flex items-center justify-between py-2">
                                                            <span className="text-body">{label}</span>
                                                            <span className="font-mono font-semibold text-ink">₹{Number(value).toFixed(2)}/m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div data-costing-tour="economics" className="mt-3">{economics}</div>
                                                {getCostingStatus(activeRecord) !== 'verified' && (
                                                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft px-3 py-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between">
                                                        <div><p className="font-bold">{tx('Saved costing needs a check')}</p><p className="mt-1">{tx(activeRecord.reconciliation_note || getCostingTrustCopy(getCostingStatus(activeRecord)))}</p></div>
                                                        <Button variant="outline" size="sm" onClick={() => onAudit(activeRecord)} disabled={auditingId === activeRecord.id} aria-busy={auditingId === activeRecord.id} className="shrink-0 border-warning/30 bg-surface text-warning hover:bg-warning-soft">
                                                            {auditingId === activeRecord.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {tx(auditingId === activeRecord.id ? 'Checking…' : 'Check saved numbers')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </section>
                                            )}
                                            </CostingMarginScope>

                                        </div>
                                    )}

                                    {group.records.length > 0 && (
                                        <section data-costing-tour="versions" className="mt-4 flex flex-col rounded-xl border border-hairline bg-surface p-4 sm:min-h-[14rem] sm:flex-1">
                                            <p className="shrink-0 text-base font-semibold text-ink">Saved Costing history</p>
                                            <p className="mt-0.5 shrink-0 text-[13px] text-muted-foreground">{comparisonMode ? 'Select two versions to compare their saved commercial assumptions.' : 'Open a version to inspect the exact assumptions and economics saved at that time.'}</p>
                                            <div className="-mx-1 mt-2 space-y-2 px-1 py-1 sm:min-h-0 sm:flex-1 sm:overflow-y-auto sm:overscroll-contain">
                                                {group.records.map(record => {
                                                    const isInspected = activeRecord?.id === record.id
                                                    const selected = selectedCostingIds.includes(record.id)
                                                    const preparing = detailLoadingId === record.id
                                                    const identity = getSavedCostingIdentity(record)
                                                    const contextLabel = record.record_kind === 'market_run'
                                                        ? 'Market run'
                                                        : record.record_kind === 'quotation'
                                                            ? `Customer Quotation · ${record.party_name || 'Customer not set'}`
                                                            : 'Saved Costing'
                                                    const costingStatus = getCostingStatus(record)
                                                    return (
                                                        <article
                                                            key={record.id}
                                                            onClick={event => {
                                                                const target = event.target as HTMLElement
                                                                if (target.closest('a, button, input, [data-costing-card-control]')) return
                                                                if (comparisonMode) {
                                                                    onToggleComparison(record.id)
                                                                } else {
                                                                    handleInspectRecord(record)
                                                                }
                                                            }}
                                                            className={`rounded-lg border p-3 transition-colors duration-150 motion-reduce:transition-none cursor-pointer ${
                                                                selected
                                                                    ? 'ui-selected-row border-info/30 bg-info-soft/60'
                                                                    : isInspected
                                                                        ? 'border-saffron/40 bg-saffron-soft/20 shadow-sm ring-1 ring-saffron/30'
                                                                        : 'border-hairline bg-surface hover:bg-surface-soft/70'
                                                            }`}
                                                        >
                                                            <div className="flex min-w-0 items-start gap-3">
                                                                {comparisonMode && <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                                                                    <input type="checkbox" checked={selected} onChange={() => onToggleComparison(record.id)} aria-label={`Select ${group.name} version ${Number(record.version_number ?? 1)} for comparison`} className="h-4 w-4 accent-loom" />
                                                                    {preparing && <Loader2 className="h-3.5 w-3.5 animate-spin text-info" aria-hidden="true" />}
                                                                </span>}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <p className="truncate text-xs font-bold text-ink" title={identity.label}>{identity.label}</p>
                                                                        {isInspected && (
                                                                            <Badge variant="outline" className="border-saffron/30 bg-saffron-soft text-xs font-bold text-saffron-deep">
                                                                                {tx('Active breakdown')}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="mt-1 truncate text-xs text-subtle">{record.factory_profile_updated_at ? `${factoryInputsCapturedLabel} ${formatTimestampDate(record.factory_profile_updated_at, { day: 'numeric', month: 'short', year: 'numeric' })}` : `Saved ${formatTimestampDate(record.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
                                                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-xs text-body">
                                                                        <span className="min-w-0 max-w-full truncate rounded-full border border-hairline bg-surface-soft px-2 py-0.5" title={contextLabel}>{contextLabel}</span>
                                                                        {costingStatus !== 'verified' && <StatusBadge status="needs_review" label={getCostingBadge(costingStatus)} />}
                                                                    </div>
                                                                    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[12px] text-muted-foreground">Cost</dt>
                                                                            <dd className="mt-0.5 truncate font-mono text-xs font-semibold text-body">{formatCostingMoneyPerM(getProductionCostPerM(record))}</dd>
                                                                        </div>
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[12px] text-muted-foreground">Selling price</dt>
                                                                            <dd className="mt-0.5 truncate font-mono text-xs font-bold text-saffron-deep">{formatCostingMoneyPerM(getSuggestedSellingPricePerM(record))}</dd>
                                                                        </div>
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[12px] text-muted-foreground">Margin</dt>
                                                                            <dd className="mt-0.5 truncate font-mono text-xs font-bold text-success">{formatCostingPercent(getActualMarginPct(record))}</dd>
                                                                        </div>
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[12px] text-muted-foreground">Costing qty.</dt>
                                                                            <dd className="mt-0.5 truncate text-xs text-body">{Number(record.meters ?? 0).toLocaleString('en-IN')} m</dd>
                                                                        </div>
                                                                    </dl>
                                                                    <div data-costing-card-control className="mt-3 flex flex-wrap items-center justify-end gap-1 border-t border-hairline pt-2">
                                                                        {!record.is_archived && group.template?.is_active !== false && (
                                                                            <Button
                                                                                variant={isInspected ? "secondary" : "ghost"}
                                                                                size="sm"
                                                                                onClick={() => handleInspectRecord(record)}
                                                                                disabled={updatingId === record.id || detailLoadingId === record.id}
                                                                                aria-label={`View version ${Number(record.version_number ?? 1)} breakdown for ${group.name}`}
                                                                                className="h-8 px-2 text-xs"
                                                                            >
                                                                                {detailLoadingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                                                                <span>{tx('View breakdown')}</span>
                                                                            </Button>
                                                                        )}
                                                                        <Button variant="ghost" size="icon" onClick={() => onToggleFavorite(record)} disabled={updatingId === record.id} aria-label={record.is_favorite ? `Remove ${group.name} from favourites` : `Add ${group.name} to favourites`} className="h-8 w-8">
                                                                            <Star className="h-4 w-4" fill={record.is_favorite ? 'currentColor' : 'none'} />
                                                                        </Button>
                                                                        <Button variant="ghost" size="sm" onClick={() => onToggleArchived(record)} disabled={updatingId === record.id} aria-label={`${record.is_archived ? 'Restore this costing' : 'Archive this costing'} ${group.name}`} className="h-8 px-2 text-xs">
                                                                            {updatingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : record.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                                                            <span className="hidden sm:inline">{updatingId === record.id ? record.is_archived ? `Restoring ${group.name}…` : `Archiving ${group.name}…` : record.is_archived ? 'Restore costing' : 'Archive costing'}</span>
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </article>
                                                    )
                                                })}
                                            </div>
                                        </section>
                                    )}
                                        </div>
                                    </div>
                                </DialogContent>
                            </Dialog>
                    </article>
                )
            })}
        </div>
    )
}

export default function QuotesClient({ initialQuotes, initialTemplates, initialProfile, initialWorkers, initialStatus, orgId, userId, canUseProductionPipeline, organizationName, userMetadata, tourUnavailable = false, loadError = false }: { initialQuotes: QuoteRow[], initialTemplates: SavedQuality[], initialProfile?: SavedQualityFactoryProfile, initialWorkers: SavedQualityFixedWorker[], initialStatus?: string, orgId: string, userId: string, canUseProductionPipeline: boolean, organizationName: string; userMetadata?: Record<string, unknown>; tourUnavailable?: boolean; loadError?: boolean }) {
    const { t, tx } = useTranslation()
    const { language } = useTranslation()
    const isLite = useOwnerPlan() === 'lite'
    const mobileCopy = liteRecordsCopy[language]
    const archivePolicyTopic = useArchivePolicyTopic()
    const [tourStep, setTourStep] = useState<SavedCostingStep | null>(null)
    const [selectedRecordIdByGroup, setSelectedRecordIdByGroup] = useState<Record<string, string>>({})
    const selectRecord = (groupKey: string, recordId: string) => setSelectedRecordIdByGroup(prev => ({ ...prev, [groupKey]: recordId }))
    const [openQualityKey, setOpenQualityKey] = useState<string | null>(null)
    const [demoCostingDeleted, setDemoCostingDeleted] = useState(false)
    const [showCostingDeleteNudge, setShowCostingDeleteNudge] = useState(false)
    const tourSurface = costingTourSurface(tourStep)
    const tourSampleActive = tourStep !== null && !isSavedCostingHandoff(tourStep)
    const DEMO_COSTING_STORAGE_KEY = 'weavly:owner-demo-costing-deleted'

    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && localStorage.getItem(DEMO_COSTING_STORAGE_KEY) === 'true') {
                setDemoCostingDeleted(true)
            }
        } catch {}
    }, [])

    const handleDeleteDemoCosting = useCallback(() => {
        setDemoCostingDeleted(true)
        setShowCostingDeleteNudge(false)
        setOpenQualityKey(current => current === 'tour-preview' ? null : current)
        try {
            localStorage.setItem(DEMO_COSTING_STORAGE_KEY, 'true')
        } catch {}
    }, [])

    // The sample card's own delete: the same removal as the banner, with a confirmation toast like the sample yarn card.
    const handleDeleteSampleCosting = () => {
        handleDeleteDemoCosting()
        toast.success(tx('Sample costing removed from Saved costings.'))
    }

    const router = useRouter()
    const [quotes, setQuotes] = useState<QuoteRow[]>(initialQuotes)
    // A failed load is not an empty library: never offer the sample over it.
    const isDemoCostingActive = !loadError && (!demoCostingDeleted && quotes.length === 0 && initialTemplates.length === 0) || tourSampleActive
    const tourExamples = useMemo(() => isDemoCostingActive ? makeSavedCostingTourExamples() : [], [isDemoCostingActive])
    const tourExport = useMemo(() => tourSurface === 'export' ? makeSavedCostingTourExport() : null, [tourSurface])
    const tourGroups = useMemo(() => tourExamples.length ? [{key: 'tour-preview', name: 'Tour sample', template: null, records: tourExamples, updatedAt: tourExamples[0].updated_at, currentRecipeCostPerM: null}] : [], [tourExamples])
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const liteLibraryInFlight = useRef(false)
    const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all')
    const [quoteToRestore, setQuoteToRestore] = useState<QuoteRow | null>(null)
    const [restoreMode, setRestoreMode] = useState<'edit' | 'duplicate'>('edit')
    const [existingDraftForRestore, setExistingDraftForRestore] = useState<EstimatorAutosaveData<QuoteDraftState> | null>(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [costingSort, setCostingSort] = useState<SavedCostingSort>('recent')
    const [marginFilter, setMarginFilter] = useState<SavedCostingMarginFilter>('all')
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
    const [comparisonMode, setComparisonMode] = useState(false)
    const [selectedCostingIds, setSelectedCostingIds] = useState<string[]>([])
    const [showComparison, setShowComparison] = useState(false)
    const [quoteToExport, setQuoteToExport] = useState<QuoteRow | null>(null)
    const [quoteToArchive, setQuoteToArchive] = useState<QuoteRow | null>(null)
    const [archiveAction, setArchiveAction] = useState<'archive' | 'restore'>('archive')
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
    const [showArchived, setShowArchived] = useState(false)

    const qualityGroups = useMemo(() => {
        const groups = new Map<string, SavedQualityGroup>()
        const labelIndex = new Map<string, string>()
        const templateById = new Map(initialTemplates.map(template => [template.id, template]))

        if (!showFavoritesOnly) {
            for (const template of initialTemplates.filter(item => (item.is_active === false) === showArchived)) {
                const key = `template:${template.id}`
                groups.set(key, { key, name: template.name, template, records: [], updatedAt: template.updated_at, currentRecipeCostPerM: null })
                labelIndex.set(normalizeQualityKey(template.name), key)
            }
        }

        for (const record of quotes.filter(item => {
            if (showFavoritesOnly && item.is_favorite !== true) return false
            const template = item.template_id ? templateById.get(item.template_id) : null
            const belongsInArchive = isSavedCostingArchived(item, template)
            return belongsInArchive === showArchived
        })) {
            const normalizedLabel = normalizeQualityKey(record.quality_label)
            const explicitTemplateKey = record.template_id ? `template:${record.template_id}` : null
            const key = explicitTemplateKey && groups.has(explicitTemplateKey)
                ? explicitTemplateKey
                : labelIndex.get(normalizedLabel) ?? `label:${normalizedLabel || record.id}`
            const existing = groups.get(key)
            if (existing) {
                existing.records.push(record)
                if (Date.parse(record.updated_at) > Date.parse(existing.updatedAt)) existing.updatedAt = record.updated_at
            } else {
                groups.set(key, {
                    key,
                    name: record.quality_label || 'Untitled costing',
                    template: record.template_id ? templateById.get(record.template_id) ?? null : null,
                    records: [record],
                    updatedAt: record.updated_at,
                    currentRecipeCostPerM: null,
                })
                if (normalizedLabel) labelIndex.set(normalizedLabel, key)
            }
        }

        const query = normalizeQualityKey(searchQuery)
        const visible = [...groups.values()]
            .map(group => ({
                ...group,
                records: filterAndSortSavedCostings(group.records, { query: '', sort: 'recent', margin: 'all', favorites: showFavoritesOnly }),
                currentRecipeCostPerM: group.template && group.records.length === 0 && canPriceSavedRecipe(group.template, initialProfile)
                    ? getCurrentRecipeCostPerM(group.template, initialProfile, initialWorkers)
                    : null,
            }))
            .filter(group => !query || normalizeQualityKey(`${group.name} ${group.records.map(record => `${record.party_name ?? ''} ${record.quotation_reference ?? ''} ${record.record_kind === 'costing' ? 'costing' : 'quotation'} ${record.status ?? ''}`).join(' ')}`).includes(query))
            .filter(group => marginFilter === 'all' || filterAndSortSavedCostings(group.records, { query: '', sort: 'recent', margin: marginFilter, favorites: showFavoritesOnly }).length > 0)
            .filter(group => group.records.length > 0 || Boolean(group.template && !showFavoritesOnly))

        return visible.sort((a, b) => {
            if (costingSort === 'oldest') return Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
            if (costingSort === 'margin_desc') {
                const leftMargin = a.records[0] ? getSavedCostingMetrics(a.records[0]).actualMarginPct : null
                const rightMargin = b.records[0] ? getSavedCostingMetrics(b.records[0]).actualMarginPct : null
                return (rightMargin ?? Number.NEGATIVE_INFINITY) - (leftMargin ?? Number.NEGATIVE_INFINITY)
            }
            if (costingSort === 'cost_asc') return (a.records[0] ? getProductionCostPerM(a.records[0]) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY) - (b.records[0] ? getProductionCostPerM(b.records[0]) ?? Number.POSITIVE_INFINITY : Number.POSITIVE_INFINITY)
            return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        })
    }, [costingSort, initialProfile, initialTemplates, initialWorkers, marginFilter, quotes, searchQuery, showArchived, showFavoritesOnly])
    const selectedCostings = useMemo(
        () => selectedCostingIds.map(id => quotes.find(quote => quote.id === id) ?? tourExamples.find(e => e.id === id)).filter((quote): quote is QuoteRow => Boolean(quote)),
        [quotes, selectedCostingIds, tourExamples],
    )
    const comparisonCostings = useMemo(
        () => orderSavedCostingsForComparison<QuoteRow>(tourStep ? tourExamples : selectedCostings),
        [selectedCostings, tourStep, tourExamples],
    )
    const comparison = comparisonCostings.length === 2
        ? compareSavedCostingSnapshots(comparisonCostings[0], comparisonCostings[1])
        : null
    const exportModel = useMemo(() => {
        if (!quoteToExport) return null
        const state = buildDraftStateFromQuote(quoteToExport)
        const historicalResult = getHistoricalCostingResult(quoteToExport)
        const currentTotals = calcFullTotals(state)
        return createCostingExportModel({
            qualityLabel: quoteToExport.quality_label || 'Untitled costing',
            createdAt: quoteToExport.created_at,
            state,
            totals: currentTotals,
            result: historicalResult ?? buildCostingResult(state, currentTotals),
            reconciliationStatus: historicalResult ? getCostingStatus(quoteToExport) : 'unreconstructable',
        })
    }, [quoteToExport])

    const comparisonSections: ComparisonSection[] = comparison ? [
        {
            title: 'Base yarn calculation',
            changed: comparison.yarn.changed,
            rows: [
                { label: 'Warp base weight (kg/100m)', value: comparison.yarn.warp.baseKgPer100m, unit: 'number' as const, changed: deltaChangedForUi(comparison.yarn.warp.baseKgPer100m) },
                { label: 'Warp base yarn cost', value: comparison.yarn.warp.baseCostPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.yarn.warp.baseCostPerM) },
                { label: 'Warp yarn rate', value: comparison.yarn.warp.ratePerKg, unit: 'rate' as const, changed: comparison.yarn.warp.changed },
                { label: 'Weft base weight (kg/100m)', value: comparison.yarn.weft.baseKgPer100m, unit: 'number' as const, changed: deltaChangedForUi(comparison.yarn.weft.baseKgPer100m) },
                { label: 'Weft base yarn cost', value: comparison.yarn.weft.baseCostPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.yarn.weft.baseCostPerM) },
                { label: 'Weft yarn rate', value: comparison.yarn.weft.ratePerKg, unit: 'rate' as const, changed: comparison.yarn.weft.changed },
                { label: 'Weft costing width (in)', value: comparison.yarn.weft.widthInches, unit: 'number' as const, changed: deltaChangedForUi(comparison.yarn.weft.widthInches) },
            ],
        },
        {
            title: 'Waste',
            changed: comparison.waste.changed,
            rows: [
                { label: 'Yarn shortage / waste', value: comparison.waste.yarnShortagePct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.waste.yarnShortagePct) },
                { label: 'Warp crimp', value: comparison.waste.warpCrimpPct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.waste.warpCrimpPct) },
                { label: 'Warp applied waste', value: comparison.yarn.warp.wastePct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.yarn.warp.wastePct) },
                { label: 'Weft applied waste', value: comparison.yarn.weft.wastePct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.yarn.weft.wastePct) },
                { label: 'Yarn waste cost', value: comparison.waste.yarnAdjustmentCostPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.waste.yarnAdjustmentCostPerM) },
            ],
        },
        {
            title: 'Overhead',
            changed: comparison.overhead.changed,
            rows: [
                { label: 'Overhead method', text: comparison.overhead.mode, unit: 'text' as const, changed: comparison.overhead.modeChanged },
                { label: 'Overhead per metre', value: comparison.overhead.perM, unit: 'money' as const, changed: deltaChangedForUi(comparison.overhead.perM) },
                {
                    label: 'Monthly expenses',
                    value: comparison.overhead.monthlyExpenseTotal,
                    unit: 'number' as const,
                    changed: deltaChangedForUi(comparison.overhead.monthlyExpenseTotal),
                    group: comparison.overhead.monthlyExpenseTotalUsedForCosting.left || comparison.overhead.monthlyExpenseTotalUsedForCosting.right
                        ? 'cost-driving'
                        : 'reference',
                    context: {
                        left: comparison.overhead.monthlyExpenseTotalUsedForCosting.left
                            ? 'Used in monthly-expense overhead'
                            : 'Reference only; direct ₹/m overhead is used',
                        right: comparison.overhead.monthlyExpenseTotalUsedForCosting.right
                            ? 'Used in monthly-expense overhead'
                            : 'Reference only; direct ₹/m overhead is used',
                    },
                },
                {
                    label: 'Monthly output',
                    value: comparison.overhead.monthlyOutputM,
                    unit: 'number' as const,
                    changed: deltaChangedForUi(comparison.overhead.monthlyOutputM),
                    group: comparison.overhead.monthlyOutputUsedForCosting.left || comparison.overhead.monthlyOutputUsedForCosting.right
                        ? 'cost-driving'
                        : 'reference',
                    context: {
                        left: comparison.overhead.monthlyOutputUsedForCosting.left
                            ? 'Used as the monthly-expense denominator'
                            : 'Reference only; direct ₹/m overhead is used',
                        right: comparison.overhead.monthlyOutputUsedForCosting.right
                            ? 'Used as the monthly-expense denominator'
                            : 'Reference only; direct ₹/m overhead is used',
                    },
                },
            ],
        },
        {
            title: 'Margin',
            changed: comparison.margin.changed,
            rows: [
                { label: 'Target margin', value: comparison.margin.targetPct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.margin.targetPct) },
                { label: 'Estimated margin', value: comparison.margin.actualPct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.margin.actualPct) },
            ],
        },
        {
            title: 'Commercial',
            changed: comparison.commercial.changed,
            rows: [
                { label: 'Broker commission', value: comparison.commercial.commissionPct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.commercial.commissionPct) },
                { label: 'Transport', value: comparison.commercial.transportPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.commercial.transportPerM) },
            ],
        },
        {
            title: 'Price',
            changed: comparison.price.changed,
            rows: [
                { label: 'Production cost', value: comparison.price.productionCostPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.price.productionCostPerM) },
                { label: comparisonPriceLabels[0], value: comparison.price.breakEvenPricePerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.price.breakEvenPricePerM) },
                { label: 'Landed cost', value: comparison.price.landedCostPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.price.landedCostPerM) },
                { label: 'Suggested selling price', value: comparison.price.sellingPricePerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.price.sellingPricePerM) },
                { label: 'Expected profit per metre', value: comparison.price.expectedProfitPerM, unit: 'money' as const, changed: deltaChangedForUi(comparison.price.expectedProfitPerM) },
            ],
        },
    ] : []

    const comparisonGroups: ComparisonGroup[] = comparison
        ? (['cost-driving', 'reference'] as const).map(group => ({
            key: group,
            title: group === 'cost-driving' ? 'Cost-driving changes' : 'Reference/context changes',
            description: group === 'cost-driving'
                ? 'Cost-driving assumptions and their resulting price movement. These changes can explain the New minus Old result.'
                : 'Values retained for capacity and factory context. Direct overhead uses the saved ₹/m rate, so monthly expenses and output do not change that costing.',
            sections: comparisonSections
                .map(section => {
                    const rows = section.rows.filter(row => {
                        const rowGroup = row.group ?? 'cost-driving'
                        return rowGroup === group && (group === 'cost-driving' || row.changed)
                    })
                    return rows.length > 0
                        ? { ...section, rows, changed: rows.some(row => row.changed) }
                        : null
                })
                .filter((section): section is ComparisonSection => Boolean(section)),
        })).filter(group => group.sections.length > 0)
        : []

    const comparisonSummary = comparisonCostings.length === 2 ? [
        {
            label: 'Cost',
            oldValue: formatCostingMoneyPerM(getProductionCostPerM(comparisonCostings[0])),
            newValue: formatCostingMoneyPerM(getProductionCostPerM(comparisonCostings[1])),
        },
        {
            label: 'Selling price',
            oldValue: formatCostingMoneyPerM(getSuggestedSellingPricePerM(comparisonCostings[0])),
            newValue: formatCostingMoneyPerM(getSuggestedSellingPricePerM(comparisonCostings[1])),
        },
        {
            label: 'Margin',
            oldValue: formatCostingPercent(getActualMarginPct(comparisonCostings[0])),
            newValue: formatCostingPercent(getActualMarginPct(comparisonCostings[1])),
        },
        {
            label: 'Quantity',
            oldValue: `${Number(comparisonCostings[0].meters || 0).toLocaleString('en-IN')} m`,
            newValue: `${Number(comparisonCostings[1].meters || 0).toLocaleString('en-IN')} m`,
        },
    ] : []

    const ensureQuoteDetail = async (quote: QuoteRow) => {
        if (quote.costing_result_snapshot || quote.snapshot_data || quote.warp_rows || quote.weft_rows || quote.orders) return quote
        setDetailLoadingId(quote.id)
        try {
            const result = await getEstimatorQuoteDetail(quote.id)
            if (result.error || !result.data) {
                toast.error(tx(userFacingError(result.error, 'The complete saved costing could not be loaded. Try again.')))
                return null
            }
            const detailed = { ...quote, ...result.data } as QuoteRow
            setQuotes(current => current.map(item => item.id === quote.id ? detailed : item))
            return detailed
        } catch (error) {
            toast.error(tx(userFacingError(error, 'The complete saved costing could not be loaded. Try again.')))
            return null
        } finally {
            setDetailLoadingId(null)
        }
    }

    const toggleCostingSelection = async (id: string) => {
        const target = quotes.find(quote => quote.id === id) ?? tourExamples.find(e => e.id === id)
        if (!target) return

        // Paint the selection in the next frame before any lazy detail fetch.
        // If the detail request fails, roll the optimistic selection back.
        if (selectedCostingIds.includes(id)) {
            setSelectedCostingIds(current => current.filter(currentId => currentId !== id))
            return
        }
        setSelectedCostingIds(current => current.length >= 2 ? [current[1], id] : [...current, id])
        const detailed = await ensureQuoteDetail(target)
        if (!detailed) {
            setSelectedCostingIds(current => current.filter(currentId => currentId !== id))
        }
    }

    // The breakdown's margin slider saves through the same action as a Cost Estimate
    // edit, so a new margin is a new version (v+1) and every earlier version keeps its
    // numbers. Cost and price are recomputed by the server from the saved inputs.
    const saveCostingMargin = async (record: QuoteRow, groupKey: string, marginPct: number, clientRequestId: string) => {
        const copy = costingMarginText[language]
        if (isSampleRecordId(record.id)) {
            toast.info(tx('This is a sample costing for exploration.'))
            return false
        }
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
            toast.error(copy.offline)
            return false
        }
        try {
            const linkedOrder = getLinkedOrder(record)
            const estimate = { ...buildDraftStateFromQuote(record), profitPct: marginPct }
            const result = buildCostingResult(estimate, calcFullTotals(estimate))
            const response = await saveEstimatorQuoteV3({
                clientRequestId,
                partyName: record.party_name,
                qualityLabel: record.quality_label || '',
                warpInstruction: record.warp_instruction || linkedOrder?.warp_instruction || undefined,
                weftInstruction: record.weft_instruction || linkedOrder?.weft_instruction || undefined,
                estimate,
                totalProductionCostPerM: result.productionCostPerM,
                quotePricePerM: result.suggestedSellingPricePerM,
                status: record.status,
                recordKind: 'costing',
                sourceQuoteId: record.id,
                expectedSourceUpdatedAt: record.updated_at,
                templateId: record.template_id ?? undefined,
                // The inputs are unchanged, so the version keeps the factory baseline they came from.
                factoryProfileUpdatedAt: record.factory_profile_updated_at ?? undefined,
            })
            if (!('success' in response) || !response.success || !response.quoteId) {
                const message = userFacingError('error' in response ? response.error : null, '')
                toast.error(message ? tx(message) : copy.saveFailed)
                return false
            }
            const values = { n: response.versionNumber ?? Number(record.version_number ?? 1) + 1, pct: `${marginPct.toFixed(1)}%` }
            const detail = await getEstimatorQuoteDetail(response.quoteId)
            if (!detail.data) {
                toast.success(fillCopy(copy.savedReload, values))
                return true
            }
            const created = detail.data as unknown as QuoteRow
            setQuotes(current => [created, ...current.filter(item => item.id !== created.id)])
            selectRecord(groupKey, created.id)
            toast.success(fillCopy(copy.saved, values))
            return true
        } catch (error) {
            console.error('Failed to save the margin as a new costing version:', error)
            toast.error(tx(userFacingError(error, copy.saveFailed)))
            return false
        }
    }

    const restoreQuoteToEstimator = (quote: QuoteRow, mode: 'edit' | 'duplicate' = 'edit') => {
        try {
            const draftKey = getEstimatorDraftStorageKey(orgId, userId)
            const linkedOrder = getLinkedOrder(quote)
            const isDuplicate = mode === 'duplicate'
            const isCosting = isStandaloneCosting(quote.record_kind)
            const startsNewBaseQuality = isDuplicate && isCosting
            const restoredState = buildDraftStateFromQuote(quote)
            const newDraft = createEstimatorDraft<QuoteDraftState>({
                state: restoredState,
                partyName: quote.party_name || '',
                // A Base starting point is intentionally detached from both
                // the old snapshot and its Saved Quality. Requiring a fresh
                // quality name prevents Rajesh from accidentally saving a
                // different construction into the old quality's history.
                qualityLabel: startsNewBaseQuality
                    ? ''
                    : quote.quality_label || '',
                warpInstruction: quote.warp_instruction || linkedOrder?.warp_instruction || '',
                weftInstruction: quote.weft_instruction || linkedOrder?.weft_instruction || '',
                sourceQuoteId: isDuplicate ? undefined : quote.id,
                sourceQuoteUpdatedAt: isDuplicate ? undefined : quote.updated_at,
                sourceQuoteVersionNumber: isDuplicate ? undefined : Number(quote.version_number ?? 1),
                sourceQuoteCreatedAt: isDuplicate ? undefined : quote.created_at,
                sourceQuoteStatus: isDuplicate ? undefined : quote.status,
                sourceState: isDuplicate ? undefined : restoredState,
                sourceFactoryProfileUpdatedAt: isDuplicate ? undefined : quote.factory_profile_updated_at ?? undefined,
                sourceCostNotSaved: isDuplicate ? undefined : getProductionCostPerM(quote) == null || undefined,
                sourceRecordKind: quote.record_kind ?? 'costing',
                templateId: startsNewBaseQuality ? undefined : quote.template_id ?? undefined,
                restoreOnEstimatorEntry: true,
            }, {
                writerId: 'quotes-history',
            })
            localStorage.setItem(draftKey, JSON.stringify(newDraft))
            setQuoteToRestore(null)
            setExistingDraftForRestore(null)
            toast.success(tx(isDuplicate
                ? (startsNewBaseQuality ? 'Starting point loaded. Enter a new Saved Quality name before saving.' : 'Costing loaded as a starting point')
                : isCosting ? 'Costing restored' : 'Quotation restored'))
            router.push('/owner/estimator')
        } catch (error) {
            toast.error(tx('Browser storage is unavailable. The quote could not be opened in the estimator.'))
            console.error(error)
        }
    }

    const handleRestore = async (quote: QuoteRow, mode: 'edit' | 'duplicate') => {
        const detailedQuote = await ensureQuoteDetail(quote)
        if (!detailedQuote) return
        try {
            const draftKey = getEstimatorDraftStorageKey(orgId, userId)
            const existingDraft = parseEstimatorDraft<QuoteDraftState>(localStorage.getItem(draftKey))
            const restoreIdentity = mode === 'duplicate' ? `duplicate:${detailedQuote.id}` : detailedQuote.id
            if (shouldWarnBeforeQuoteRestore(existingDraft, restoreIdentity)) {
                setExistingDraftForRestore(existingDraft)
                setRestoreMode(mode)
                setQuoteToRestore(detailedQuote)
                return
            }
            restoreQuoteToEstimator(detailedQuote, mode)
        } catch (e) {
            toast.error(tx('The costing could not be restored. Try again.'))
            console.error(e)
        }
    }

    const openQuoteExport = async (quote: QuoteRow) => {
        const detailedQuote = await ensureQuoteDetail(quote)
        if (detailedQuote) setQuoteToExport(detailedQuote)
    }

    const handleLibraryState = async (quote: QuoteRow, changes: { isArchived?: boolean; isFavorite?: boolean }) => {
        if (isLite && window.matchMedia(MOBILE_WORKSPACE_QUERY).matches) {
            if (liteLibraryInFlight.current) return
            liteLibraryInFlight.current = true
        }
        setUpdatingId(quote.id)
        try {
            const result = await updateSavedCostingLibraryState({
                id: quote.id,
                expectedUpdatedAt: quote.updated_at,
                ...changes,
            })
            if (result.error || !result.data) {
                toast.error(tx(userFacingError(result.error, 'Saved costing could not be updated. Try again.')))
                return
            }
            setQuotes(current => current.map(item => item.id === quote.id ? { ...item, ...result.data } : item))
            const recordLabel = quote.quality_label?.trim() || quote.party_name?.trim() || 'Untitled costing'
            const recordType = quote.record_kind === 'quotation' ? 'Quotation' : 'Costing'
            toast.success(tx(changes.isArchived === true
                ? `${recordType === 'Costing' ? 'Costing archived' : 'Quotation archived'} · “${recordLabel}”`
                : changes.isArchived === false
                    ? `${recordType === 'Costing' ? 'Costing restored' : 'Quotation restored'} · “${recordLabel}”`
                    : changes.isFavorite
                        ? 'Added to favourites'
                        : 'Removed from favourites'))
        } catch (error) {
            toast.error(tx(userFacingError(error, 'Saved costing could not be updated. Try again.')))
            console.error(error)
        } finally {
            setUpdatingId(null)
            liteLibraryInFlight.current = false
        }
    }

    const auditQuote = async (quote: QuoteRow) => {
        setUpdatingId(quote.id)
        try {
            const result = await auditHistoricalCostingSnapshot(quote.id, quote.updated_at)
            if (result.error || !result.data || !result.audit) {
                toast.error(tx(userFacingError(result.error, 'Saved costing could not be checked. Try again.')))
                return
            }
            setQuotes(current => current.map(item => item.id === quote.id ? { ...item, ...result.data } : item))
            if (result.audit.status === 'verified') {
                toast.success(tx('Saved costing checked. Its numbers are correct.'))
            } else {
                toast.success(tx(`Saved values preserved. ${getCostingTrustCopy(result.audit.status)}`))
            }
        } catch (error) {
            toast.error(tx(userFacingError(error, 'Saved costing could not be checked. Try again.')))
            console.error(error)
        } finally {
            setUpdatingId(null)
        }
    }

    const requestArchiveState = (quote: QuoteRow) => {
        setArchiveAction(quote.is_archived ? 'restore' : 'archive')
        setQuoteToArchive(quote)
    }

    const confirmArchiveSnapshot = async () => {
        if (!quoteToArchive) return
        const target = quoteToArchive
        const action = archiveAction
        setQuoteToArchive(null)
        await handleLibraryState(target, { isArchived: action === 'restore' ? false : true })
    }

    const catalogue = costingCatalogueText[language]
    // The band reads the whole active library: each quality's latest saved costing, whatever the search or view below.
    const libraryLatest = useMemo(() => {
        const templateById = new Map(initialTemplates.map(template => [template.id, template]))
        const byQuality = new Map<string, { name: string; record: QuoteRow; count: number }>()
        for (const record of quotes) {
            const template = record.template_id ? templateById.get(record.template_id) ?? null : null
            if (isSavedCostingArchived(record, template)) continue
            const name = template?.name ?? record.quality_label ?? ''
            const key = normalizeQualityKey(name) || record.id
            const entry = byQuality.get(key)
            if (!entry) byQuality.set(key, { name: name || 'Untitled costing', record, count: 1 })
            else {
                entry.count += 1
                if (Date.parse(record.updated_at) > Date.parse(entry.record.updated_at)) entry.record = record
            }
        }
        return [...byQuality.entries()].map(([key, entry]) => ({ key, ...entry, metrics: getSavedCostingMetrics(entry.record) }))
    }, [initialTemplates, quotes])
    const bandMargins = libraryLatest.flatMap(entry => entry.metrics.actualMarginPct == null ? [] : [{ key: entry.key, name: entry.name, margin: entry.metrics.actualMarginPct }])
    const marginBars = marginRanking(bandMargins)
    const marginScale = Math.max(20, ...bandMargins.map(entry => entry.margin))
    const libraryAverageMargin = averageMargin(bandMargins.map(entry => entry.margin))
    const libraryYarnShare = averageYarnShare(libraryLatest.map(entry => costMix(entry.record.cost_breakdown ?? getHistoricalCostingResult(entry.record)?.breakdown)))
    const savedCostingCount = libraryLatest.reduce((sum, entry) => sum + entry.count, 0)
    const lastSavedAt = libraryLatest.reduce<string | null>((latest, entry) => !latest || Date.parse(entry.record.created_at) > Date.parse(latest) ? entry.record.created_at : latest, null)
    const showLibraryBand = !tourSampleActive && !loadError && !showArchived && libraryLatest.length > 0
    const libraryView = showArchived ? 'archived' : showFavoritesOnly ? 'favourites' : 'all'
    const setLibraryView = (view: 'all' | 'favourites' | 'archived') => {
        setOpenQualityKey(null)
        setShowArchived(view === 'archived')
        setShowFavoritesOnly(view === 'favourites')
        setSelectedCostingIds([])
    }

    return (
        <>
            <div className={cn("saved-costings-workspace ui-route-enter w-full space-y-4 sm:space-y-6", isLite && mobileStyles.workspace)} data-lite-costings={isLite || undefined}>
            <RouteMilestones route="/owner/quotes" shellVisible primaryUsable secondaryReady />
            {detailLoadingId && <p role="status" aria-live="polite" className="ui-status-enter rounded-lg border border-info/25 bg-info-soft px-3 py-2 text-xs font-semibold text-info">{tx('Loading the full costing to compare…')}</p>}
            <PageHeader
                title={t('common.saved_costings_title')}
                description={<span data-i18n-skip="true" lang={language}>{catalogue.intro}</span>}
                actions={<>
                    <SavedCostingsTutorial step={tourStep} onStepChange={setTourStep} onComplete={() => setShowCostingDeleteNudge(true)} production={canUseProductionPipeline} ending={savedCostingTourEnding(quotes.filter(quote => isStandaloneCosting(quote.record_kind)).length, tourUnavailable)} topics={[archivePolicyTopic]} userId={userId} orgId={orgId} userMetadata={userMetadata} />
                    {quotes.length > 0 && !tourStep && (
                        <Button asChild variant="outline" className={secondaryAction}>
                            <Link href="/owner/quotes/offer" data-i18n-skip="true" lang={language}>
                                <Handshake className="h-4 w-4" aria-hidden="true" /> {offerCheckText[language].cardAction}
                            </Link>
                        </Button>
                    )}
                    <Button
                        data-tour-anchor="costings.new" onClick={() => router.push('/owner/estimator')}
                        className={railPrimaryAction}
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>{t('common.new_costing')}</span>
                    </Button>
                </>}
            />
            {showCostingDeleteNudge && !tourStep && !demoCostingDeleted && quotes.length === 0 && initialTemplates.length === 0 && !searchQuery.trim() && !showArchived && ['all', 'costings', 'draft'].includes(filterStatus) && (
                <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)]/90 p-3.5 text-sm text-[var(--wv-ochre-800)] shadow-xs animate-in fade-in-0 duration-200"
                >
                    <div className="flex items-center gap-2.5">
                        <Sparkles className="h-5 w-5 shrink-0 text-[var(--wv-ochre-800)]" aria-hidden="true" />
                        <div>
                            <p className="font-semibold text-ink">{tx('Guided tour completed!')}</p>
                            <p className="text-xs text-[var(--wv-ochre-800)]/90">{tx('Explore exports with this sample costing, or delete it whenever you are ready to create your own costings.')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-[var(--wv-ochre-200)] bg-surface text-xs font-semibold text-[var(--wv-ochre-800)] hover:bg-[var(--wv-ochre-50)]"
                            onClick={handleDeleteDemoCosting}
                        >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-[var(--wv-ochre-800)]" aria-hidden="true" />
                            {tx('Delete sample costing')}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-[var(--wv-ochre-800)] hover:text-ink"
                            onClick={() => setShowCostingDeleteNudge(false)}
                        >
                            {tx('Dismiss')}
                        </Button>
                    </div>
                </div>
            )}
            {/* The library at a glance: how many qualities are costed, their average margin, and margin by quality. */}
            {showLibraryBand && (
                <section
                    aria-labelledby="costing-library-status"
                    data-i18n-skip="true"
                    lang={language}
                    className="grid overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
                >
                    <div className="flex flex-col justify-between gap-5 p-5 sm:p-6">
                        <div>
                            <p id="costing-library-status" className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                <span aria-hidden="true" className="size-1.5 rounded-full bg-saffron" />
                                {catalogue.costed}
                            </p>
                            <p className="mt-3 text-5xl font-semibold leading-none tracking-[-0.035em] text-ink tabular-nums">
                                {libraryLatest.length}
                                <span className="ml-2 text-2xl font-medium tracking-normal text-muted-foreground">{libraryLatest.length === 1 ? catalogue.qualityUnit : catalogue.qualitiesUnit}</span>
                            </p>
                            <p className="mt-3 text-sm text-body tabular-nums">
                                {fillCopy(savedCostingCount === 1 ? catalogue.savedCostingsOne : catalogue.savedCostings, { n: savedCostingCount })}
                                {lastSavedAt && <span className="text-muted-foreground"> · {fillCopy(catalogue.lastSaved, { date: formatTimestampDate(lastSavedAt, { day: 'numeric', month: 'short' }) })}</span>}
                            </p>
                        </div>
                        {libraryAverageMargin != null && (
                            <p className="border-t border-hairline pt-4 text-[13px] text-body tabular-nums">
                                {fillCopy(catalogue.avgMargin, { pct: `${libraryAverageMargin.toFixed(1)}%` })}
                                {libraryYarnShare != null && <span className="text-muted-foreground"> · {fillCopy(catalogue.yarnShare, { pct: `${libraryYarnShare}%` })}</span>}
                            </p>
                        )}
                    </div>
                    <div className="border-t border-hairline p-5 sm:p-6 lg:border-l lg:border-t-0">
                        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <p className="text-sm font-medium text-muted-foreground">{catalogue.marginTitle}</p>
                            <p className="text-[13px] text-muted-foreground">{marginBars.lowestOnly ? fillCopy(catalogue.lowestNote, { n: marginBars.entries.length }) : catalogue.marginNote}</p>
                        </div>
                        {marginBars.entries.length ? (
                            <ul className="space-y-3">
                                {marginBars.entries.map(entry => (
                                    <li key={entry.key} className="grid grid-cols-[minmax(0,1fr)_4.5rem] items-center gap-x-4 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_4.5rem]">
                                        <span className="truncate text-sm font-semibold text-ink" title={entry.name}>{entry.name}</span>
                                        <span aria-hidden="true" className="hidden h-2 rounded-full bg-surface-soft sm:block">
                                            <span
                                                className={cn('block h-full rounded-full', entry.margin < 10 ? 'bg-[var(--wv-ochre-400)]' : 'bg-[var(--wv-viz-1)]')}
                                                style={{ width: `${Math.max((Math.max(entry.margin, 0) / marginScale) * 100, 2)}%` }}
                                            />
                                        </span>
                                        <span className={cn('text-right text-sm font-semibold tabular-nums', marginTone(entry.margin))}>{entry.margin.toFixed(1)}%</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">{catalogue.noMargins}</p>
                        )}
                    </div>
                </section>
            )}
            <div data-costing-tour="filters" className="space-y-3">
                {/* One wrapping row: search, the view, filters and Compare; on a phone Filters and Compare share a line. */}
                <div className="flex flex-wrap items-center gap-3">
                    <div className="contents">
                        <div className="relative w-full min-w-0 sm:w-auto sm:min-w-[14rem] sm:max-w-sm sm:flex-1">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                            <Label htmlFor="saved-costings-search" className="sr-only">{t('common.search_quality_costing')}</Label>
                            <Input
                                id="saved-costings-search"
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder="Search saved records…"
                                aria-label="Search saved qualities and costings"
                                className="h-10 w-full min-w-0 rounded-lg border-hairline bg-surface pl-9 pr-4 text-sm text-ink shadow-xs max-md:min-h-[44px]"
                            />
                        </div>
                        <LiquidSegmented
                            className={cn('sm:w-auto', isLite && mobileStyles.desktopOnly)}
                            aria-label={catalogue.show}
                            value={libraryView}
                            onValueChange={setLibraryView}
                            options={[
                                { value: 'all', label: <span data-i18n-skip="true" lang={language}>{catalogue.all}</span> },
                                { value: 'favourites', label: <span data-i18n-skip="true" lang={language}>{catalogue.favourites}</span> },
                                { value: 'archived', label: t('tourControls.savedCostings.archived') },
                            ]}
                        />
                        <details className="group relative z-20 min-w-0">
                            <summary className="mobile-touch-target flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-lg border border-hairline bg-surface px-3.5 text-sm font-semibold text-ink shadow-xs hover:bg-surface-soft max-md:min-h-[44px] [&::-webkit-details-marker]:hidden">
                                {isLite ? <span data-i18n-skip="true" lang={language}>{mobileCopy.filters}{[marginFilter !== 'all', showFavoritesOnly, showArchived, costingSort !== 'recent'].filter(Boolean).length > 0 ? ` · ${[marginFilter !== 'all', showFavoritesOnly, showArchived, costingSort !== 'recent'].filter(Boolean).length}` : ''}</span> : <>Filters{marginFilter !== 'all' || costingSort !== 'recent' ? ` · ${[marginFilter !== 'all', costingSort !== 'recent'].filter(Boolean).length}` : ''}</>}
                                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                            </summary>
                            <div className={cn("absolute left-0 mt-2 grid w-64 max-w-[calc(100vw-3rem)] gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-[var(--shadow-panel)] sm:left-auto sm:right-0", isLite && mobileStyles.filterMenu)}>
                                <Label htmlFor="saved-costings-sort" className="text-[13px] font-medium text-body">Sort by</Label>
                                <select id="saved-costings-sort" value={costingSort} onChange={event => setCostingSort(event.target.value as SavedCostingSort)} className="h-10 rounded-lg border border-hairline bg-surface px-3 text-sm font-medium text-ink">
                                    <option value="recent">Recently updated</option><option value="oldest">Oldest updated</option><option value="margin_desc">Highest margin</option><option value="cost_asc">Lowest production cost</option>
                                </select>
                                <Label htmlFor="saved-costings-margin" className="text-[13px] font-medium text-body">Margin</Label>
                                <select id="saved-costings-margin" value={marginFilter} onChange={event => setMarginFilter(event.target.value as SavedCostingMarginFilter)} className="h-10 rounded-lg border border-hairline bg-surface px-3 text-sm font-medium text-ink">
                                    <option value="all">All margins</option><option value="negative">Negative margin</option><option value="under_10">Under 10%</option><option value="10_to_20">10–20%</option><option value="over_20">Over 20%</option>
                                </select>
                                {isLite && <div className={cn(mobileStyles.mobileOnly, mobileStyles.filterExtras)} data-i18n-skip="true" lang={language}>
                                    <SwitchField variant="pill" checked={showFavoritesOnly} onCheckedChange={() => { setOpenQualityKey(null); setShowFavoritesOnly(current => !current); setSelectedCostingIds([]) }}>{mobileCopy.favourites}</SwitchField>
                                    <Button type="button" variant={showArchived ? 'secondary' : 'outline'} onClick={() => { setOpenQualityKey(null); setShowArchived(current => !current); setSelectedCostingIds([]) }}>{showArchived ? mobileCopy.active : mobileCopy.archived}</Button>
                                </div>}
                            </div>
                        </details>
                    </div>
                    <Button
                        data-tour-anchor="costings.compare"
                        type="button"
                        variant={comparisonMode ? 'secondary' : 'outline'}
                        aria-pressed={comparisonMode}
                        onClick={() => { setComparisonMode(current => !current); setSelectedCostingIds([]) }}
                        className={cn('md:ml-auto', secondaryAction, isLite && mobileStyles.desktopOnly)}
                    >
                        <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
                        {tx('Compare')}
                    </Button>
                    {isLite && <Button type="button" variant={comparisonMode ? 'secondary' : 'outline'} aria-pressed={comparisonMode} className={mobileStyles.mobileOnly} onClick={() => { setComparisonMode(current => !current); setSelectedCostingIds([]) }} data-i18n-skip="true" lang={language}><GitCompareArrows className="h-4 w-4" aria-hidden="true" />{comparisonMode ? mobileCopy.exitCompare : mobileCopy.compare}</Button>}
                </div>
                {comparisonMode && selectedCostings.length === 2 ? (
                    <div className="ui-status-enter flex flex-col gap-3 rounded-xl border border-hairline bg-surface p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite" aria-busy={Boolean(detailLoadingId)}>
                        <div>
                            <p className="text-sm font-semibold text-ink">Two costings selected</p>
                            <p className="mt-0.5 text-[13px] leading-relaxed text-body">{detailLoadingId ? 'Preparing the complete saved numbers…' : 'Compare them when you need to explain a change in cost, selling price, margin, or quantity.'}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                            <Button onClick={() => setShowComparison(true)} className={railPrimaryAction} disabled={Boolean(detailLoadingId)}>
                                {detailLoadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />} {detailLoadingId ? 'Preparing…' : t('common.compare_costings')}
                            </Button>
                            <Button variant="ghost" onClick={() => setSelectedCostingIds([])} className={ghostAction}>Clear selection</Button>
                        </div>
                    </div>
                ) : comparisonMode ? (
                    <p id="compare-costings-help" className="text-[13px] text-body">
                        {selectedCostings.length === 1
                            ? 'One costing selected. Select one more if you want to compare.'
                            : 'Pick two saved costings to see what changed between them.'}
                    </p>
                ) : null}
                <p className="text-[13px] text-muted-foreground">
                    {tourSampleActive ? '1 sample quality' : loadError ? tx('Saved costings not loaded') : isDemoCostingActive && quotes.length === 0
                        ? (searchQuery.trim() && !tourExamples[0]?.quality_label?.toLowerCase().includes(searchQuery.trim().toLowerCase()) && !'tour sample'.includes(searchQuery.trim().toLowerCase()) ? '0 qualities' : '1 sample quality')
                        : `${qualityGroups.length} ${showArchived ? 'archived ' : ''}${qualityGroups.length === 1 ? 'quality' : 'qualities'}`}
                </p>
            </div>

            {tourSampleActive ? (
                <div className="space-y-3 xl:pr-[192px]">
                    <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink" data-i18n-skip="true" lang={language}>{tourCommonCopy[language].sampleBanner}</p>
                    <SavedQualityLibraryView
                    selectedRecordIdByGroup={{}} onSelectRecord={() => {}} onSaveMargin={async () => false}
                        groups={tourGroups} canUseProductionPipeline={canUseProductionPipeline}
                        openKey={tourSurface === 'library' ? 'tour-preview' : null}
                        tourStep={tourStep} comparisonMode={tourStep === 'compareSelect'}
                        selectedCostingIds={tourStep === 'compareSelect' ? tourExamples.map(row => row.id) : []}
                        updatingId={null} detailLoadingId={null} auditingId={null}
                        onOpenDetails={() => {}} onCloseDetails={() => {}} onToggleComparison={() => {}}
                        onOpen={() => {}} onStartFrom={() => {}} onSaveAsNewQuality={() => {}} onExport={() => {}}
                        onAudit={() => {}} onToggleFavorite={() => {}} onToggleArchived={() => {}}
                        factoryInputsCapturedLabel={tx('Factory inputs captured')}
                    />
                </div>
            ) : loadError ? (
                <div data-saved-costings-load-error role="alert" className="rounded-xl border border-hairline bg-surface p-6 text-center">
                    <AlertTriangle className="mx-auto h-6 w-6 text-warning" aria-hidden="true" />
                    <p className="mt-3 text-sm font-bold text-ink">{tx('Saved costings could not be loaded. Nothing was deleted. Try again.')}</p>
                    <Button type="button" variant="outline" className="mt-4 min-h-11" onClick={() => router.refresh()}>
                        {tx('Try again')}
                    </Button>
                </div>
            ) : isDemoCostingActive && quotes.length === 0 ? (
                (searchQuery.trim() && !tourExamples[0]?.quality_label?.toLowerCase().includes(searchQuery.trim().toLowerCase()) && !'tour sample'.includes(searchQuery.trim().toLowerCase())) || (filterStatus !== 'all' && filterStatus !== 'costings' && filterStatus !== 'draft') || showArchived ? (
                    <EmptyState
                        icon={FileText}
                        title={searchQuery.trim()
                            ? `No saved records match “${searchQuery.trim()}”.`
                            : showArchived
                                ? 'No archived records are showing. Switch to Active or save a costing first.'
                                : `No quotations with status “${filterStatus}”.`}
                        description={searchQuery.trim()
                            ? 'Try a quality name, party name, quotation reference, or clear the search.'
                            : showArchived
                                ? 'No archived records are showing. Switch to Active or save a costing first.'
                                : `No quotations with status “${filterStatus}”.`}
                        action={(
                            <div className="flex flex-wrap justify-center gap-2">
                                {(searchQuery || marginFilter !== 'all' || showFavoritesOnly) && (
                                    <Button
                                        variant="outline"
                                        onClick={() => { setSearchQuery(''); setMarginFilter('all'); setShowFavoritesOnly(false) }}
                                    >
                                        {t('common.clear_search_filters')}
                                    </Button>
                                )}
                                {filterStatus !== 'all' && (
                                    <Button variant="ghost" onClick={() => setFilterStatus('all')}>
                                        {t('common.clear_filters')}
                                    </Button>
                                )}
                            </div>
                        )}
                    />
                ) : (
                    <div data-costing-tour="sample" className="space-y-3">
                        <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink" data-i18n-skip="true" lang={language}>{tourCommonCopy[language].sampleBanner}</p>
                        <SavedQualityLibraryView
                            selectedRecordIdByGroup={selectedRecordIdByGroup} onSelectRecord={selectRecord} onSaveMargin={saveCostingMargin}
                            groups={tourGroups}
                            canUseProductionPipeline={canUseProductionPipeline}
                            openKey={openQualityKey}
                            comparisonMode={comparisonMode}
                            selectedCostingIds={selectedCostingIds}
                            updatingId={updatingId}
                            detailLoadingId={detailLoadingId}
                            onOpenDetails={(key, singleSnapshot) => {
                                setOpenQualityKey(key)
                                if (singleSnapshot) void ensureQuoteDetail(singleSnapshot)
                            }}
                            onCloseDetails={() => setOpenQualityKey(null)}
                            onToggleComparison={toggleCostingSelection}
                            onOpen={quote => { if (isSampleRecordId(quote.id)) toast.info(tx('This is a sample costing for exploration.')) }}
                            onStartFrom={quote => { if (isSampleRecordId(quote.id)) toast.info(tx('This is a sample costing for exploration.')) }}
                            onSaveAsNewQuality={quote => { if (isSampleRecordId(quote.id)) toast.info(tx('This is a sample costing for exploration.')) }}
                            onExport={quote => { setOpenQualityKey(null); void openQuoteExport(quote) }}
                            onAudit={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            auditingId={updatingId}
                            onToggleFavorite={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            onToggleArchived={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            onDeleteSample={handleDeleteSampleCosting}
                            onEnsureDetail={ensureQuoteDetail}
                            factoryInputsCapturedLabel={t('estimator.sprint1.baseline_captured')}
                        />
                    </div>
                )
            ) : (
            <div>
            {qualityGroups.length === 0 ? (
                <EmptyState
                    icon={FileText}
                    title={searchQuery.trim()
                        ? `No saved records match “${searchQuery.trim()}”.`
                        : t('common.no_saved_qualities_costings')}
                    description={searchQuery.trim()
                        ? 'Try a quality name, party name, quotation reference, or clear the search.'
                        : showArchived
                            ? 'No archived records are showing. Switch to Active or save a costing first.'
                            : filterStatus === 'all'
                                ? t('common.save_quality_or_cost_estimate')
                                : `No quotations with status “${filterStatus}”.`}
                    action={(
                        <div className="flex flex-wrap justify-center gap-2">
                            {(searchQuery || marginFilter !== 'all' || showFavoritesOnly) && (
                                <Button
                                    variant="outline"
                                    onClick={() => { setSearchQuery(''); setMarginFilter('all'); setShowFavoritesOnly(false) }}
                                >
                                    {t('common.clear_search_filters')}
                                </Button>
                            )}
                        </div>
                    )}
                />
            ) : (
                <SavedQualityLibraryView
                    selectedRecordIdByGroup={selectedRecordIdByGroup} onSelectRecord={selectRecord} onSaveMargin={saveCostingMargin}
                    groups={qualityGroups}
                    canUseProductionPipeline={canUseProductionPipeline}
                    openKey={openQualityKey}
                    comparisonMode={comparisonMode}
                    selectedCostingIds={selectedCostingIds}
                    updatingId={updatingId}
                    detailLoadingId={detailLoadingId}
                    onOpenDetails={(key, singleSnapshot) => {
                        setOpenQualityKey(key)
                        if (singleSnapshot) void ensureQuoteDetail(singleSnapshot)
                    }}
                    onCloseDetails={() => setOpenQualityKey(null)}
                    onToggleComparison={toggleCostingSelection}
                    onOpen={quote => { setOpenQualityKey(null); void handleRestore(quote, 'edit') }}
                    onStartFrom={quote => { setOpenQualityKey(null); void handleRestore(quote, 'duplicate') }}
                    onSaveAsNewQuality={quote => { setOpenQualityKey(null); void handleRestore(quote, 'duplicate') }}
                    onExport={quote => { setOpenQualityKey(null); void openQuoteExport(quote) }}
                    onAudit={quote => { void auditQuote(quote) }}
                    auditingId={updatingId}
                    onToggleFavorite={quote => { void handleLibraryState(quote, { isFavorite: !quote.is_favorite }) }}
                    onToggleArchived={requestArchiveState}
                    onEnsureDetail={ensureQuoteDetail}
                    factoryInputsCapturedLabel={t('estimator.sprint1.baseline_captured')}
                />
            )}
            </div>
            )}
            </div>

            {tourSurface === 'export' && tourExport && <CostingExportDialog key={tourStep} open tutorialPreview onOpenChange={() => {}} model={tourExport} defaultMode={tourStep === 'internal' ? 'internal' : 'customer'} defaultBusinessName="Tour sample" defaultCustomerName="Sample customer" sourceRecordKind="costing" />}
            {quoteToExport && !tourStep && (
                <CostingExportDialog
                    open
                    onOpenChange={open => { if (!open) setQuoteToExport(null) }}
                    model={exportModel}
                    defaultCustomerName={quoteToExport.party_name ?? ''}
                    defaultBusinessName={organizationName}
                    defaultMode={isStandaloneCosting(quoteToExport.record_kind) ? 'internal' : 'customer'}
                    defaultValidUntil={quoteToExport.quotation_valid_until}
                    defaultCustomerTerms={quoteToExport.customer_terms}
                    documentReference={quoteToExport.quotation_reference}
                    sourceQuoteId={quoteToExport.id}
                    sourceQuoteUpdatedAt={quoteToExport.updated_at}
                    sourceQuoteStatus={quoteToExport.status}
                    sourceRecordKind={quoteToExport.record_kind === 'quotation' ? 'quotation' : 'costing'}
                    documentSource={{ kind: 'saved', qualityLabel: quoteToExport.quality_label ?? exportModel?.qualityLabel ?? '', version: Number(quoteToExport.version_number ?? 1), savedAt: quoteToExport.created_at }}
                    onQuoteUpdated={data => {
                        setQuotes(current => current.map(item => item.id === quoteToExport.id ? { ...item, ...data } : item))
                        setQuoteToExport(current => current ? { ...current, ...data } : current)
                    }}
                />
            )}

            <ConfirmActionDialog
                open={Boolean(quoteToArchive)}
                onOpenChange={open => { if (!open && updatingId !== quoteToArchive?.id) setQuoteToArchive(null) }}
                title={`${archiveAction === 'restore' ? 'Restore' : 'Archive'} ${quoteToArchive?.record_kind === 'quotation' ? 'quotation' : 'costing'} · ${quoteToArchive?.quality_label || quoteToArchive?.party_name || 'Untitled record'}?`}
                description={`${archiveAction === 'restore' ? 'This restores the named record to the active library.' : tx('This archives only this costing.')} ${t('base_plan.archive.description')} ${t('base_plan.archive.restore')} ${t('base_plan.archive.deletion')} ${t('base_plan.archive.privacy')} Existing saved values remain unchanged.`}
                confirmLabel={archiveAction === 'restore' ? 'Restore costing' : 'Archive costing'}
                cancelLabel={archiveAction === 'restore' ? 'Keep archived' : 'Keep costing'}
                onConfirm={confirmArchiveSnapshot}
                isDestructive={archiveAction === 'archive'}
                isLoading={updatingId === quoteToArchive?.id}
            />

            <Dialog modal={!tourStep} open={tourStep ? tourSurface === 'comparison' : showComparison} onOpenChange={open => {if (!tourStep) setShowComparison(open)}}>
                <DialogContent showCloseButton={!tourStep} data-costing-tour-dialog={tourStep ? "true" : undefined} data-tour-surface={tourStep ? "true" : undefined} data-costing-tour="comparison" onOpenAutoFocus={event => {if (tourStep) event.preventDefault()}} onCloseAutoFocus={event => {if (tourStep) event.preventDefault()}} onInteractOutside={event => {if (tourStep) event.preventDefault()}} onEscapeKeyDown={event => {if (tourStep) event.preventDefault()}} className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitCompareArrows className="h-5 w-5 text-info" /> Compare Saved Costings
                        </DialogTitle>
                        <DialogDescription>See two saved costings side by side. Each keeps its own saved numbers; today’s Rate Book is not used.</DialogDescription>
                    </DialogHeader>
                    {comparisonCostings.length === 2 && comparison && (
                        <div className="space-y-3">
                            <p data-revision-lead className="text-sm font-bold text-ink">{formatRevisionLead(comparisonCostings[0], comparisonCostings[1], comparison.price.sellingPricePerM)}</p>
                            <div className={`rounded-xl border px-4 py-3 text-xs ${comparison.comparable ? 'border-success/25 bg-success-soft text-success' : 'border-warning/25 bg-warning-soft text-warning'}`}>
                                <p className="font-bold">{comparison.comparable ? 'Ready to compare' : 'This comparison needs a check'}</p>
                                <p className="mt-1 leading-relaxed">{comparison.canonical.message || 'Both costings were calculated the same way, so their numbers can be compared directly.'}</p>
                                <p className="mt-1 font-semibold">Change is calculated as New minus Old. Cost-driving changes are separated from reference/context changes.</p>
                                <p className="mt-1 font-semibold">{formatSuggestedPriceMovement(comparison.price.sellingPricePerM)}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {comparisonSummary.map(metric => (
                                    <div key={metric.label} className="rounded-xl border border-hairline bg-surface-soft p-3">
                                        <p className="text-xs font-bold text-subtle">{metric.label}</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-xs font-semibold text-subtle">Old</p>
                                                <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink" title={metric.oldValue}>{metric.oldValue}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-subtle">New</p>
                                                <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink" title={metric.newValue}>{metric.newValue}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <details data-costing-tour="comparison-details" open={tourStep ? tourStep === 'comparisonDetails' : undefined} className="ui-details group rounded-xl border border-hairline bg-surface">
                                <summary className="mobile-touch-target flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-body marker:content-none">
                                    <span>View calculation details (optional)</span>
                                    <ChevronDown className="h-4 w-4 text-subtle transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="mobile-comparison-scroll max-h-[60vh] overflow-auto border-t border-hairline">
                                    <table role="table" className="mobile-comparison-table w-full min-w-[760px] text-sm">
                                    <thead role="rowgroup" className="bg-surface-soft text-left">
                                        <tr role="row">
                                            <th scope="col" className="comparison-column-label px-4 py-3 text-xs uppercase tracking-wide text-subtle">Metric</th>
                                            {comparisonCostings.map((costing, index) => {
                                                const identity = getSavedCostingIdentity(costing)
                                                return <th role="columnheader" scope="col" key={costing.id} className="px-4 py-3 font-bold text-ink"><span className="block">{index === 0 ? 'Older costing' : 'Newer costing'}</span><span className="mt-1 block max-w-[220px] break-words text-xs font-semibold text-body" title={identity.label}>{identity.label}</span><span className="mt-1 block text-xs font-medium text-subtle">saved {formatTimestampDate(costing.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span></th>
                                            })}
                                            <th scope="col" className="comparison-column-label px-4 py-3 text-xs uppercase tracking-wide text-subtle">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody role="rowgroup" className="divide-y divide-hairline">
                                        {comparisonGroups.map(group => (
                                            <Fragment key={group.key}>
                                                <tr role="row" className="bg-info-soft/70">
                                                    <th colSpan={4} className="px-4 py-2.5 text-left text-xs font-semibold text-info">
                                                        {group.title}
                                                    </th>
                                                </tr>
                                                <tr role="row" className="bg-info-soft/30">
                                                    <td colSpan={4} className="px-4 py-2 text-xs leading-relaxed text-body">{group.description}</td>
                                                </tr>
                                                {group.sections.map(section => (
                                                    <Fragment key={`${group.key}-${section.title}`}>
                                                        <tr role="row" key={`${group.key}-${section.title}-heading`} className="bg-surface-soft/70">
                                                            <th colSpan={4} className="px-4 py-2 text-left text-xs font-semibold text-body">
                                                                <span>{section.title}</span>{section.changed && <Badge variant="outline" className="ml-2 border-info/25 bg-info-soft text-xs text-info">Changed</Badge>}
                                                            </th>
                                                        </tr>
                                                        {section.rows.map(row => {
                                                            const left = row.unit === 'text' ? row.text.left || 'Not available' : formatComparisonValue(row.value.left, row.unit === 'rate' ? 'number' : row.unit)
                                                            const right = row.unit === 'text' ? row.text.right || 'Not available' : formatComparisonValue(row.value.right, row.unit === 'rate' ? 'number' : row.unit)
                                                            const change = row.unit === 'text'
                                                                ? row.changed ? 'Changed' : 'No change'
                                                                : formatComparisonDelta(row.value, row.unit === 'rate' ? 'number' : row.unit)
                                                            const numericDelta = row.unit === 'text' ? null : row.value.delta
                                                            return (
                                                                <tr role="row" key={`${group.key}-${section.title}-${row.label}`}>
                                                                    <th scope="row" className="comparison-metric px-4 py-3 text-left font-semibold text-body">{row.label}</th>
                                                                    <td role="cell" className="px-4 py-3 font-mono font-semibold text-ink">
                                                                        <span aria-hidden="true" className="mobile-comparison-label">{tx('Old')}</span>
                                                                        <span>{left}{row.unit === 'rate' && left !== 'Not available' ? '/kg' : ''}</span>
                                                                        {row.context?.left && <span className="mt-1 block font-sans text-xs font-medium leading-4 text-subtle">{row.context.left}</span>}
                                                                    </td>
                                                                    <td role="cell" className="px-4 py-3 font-mono font-semibold text-ink">
                                                                        <span aria-hidden="true" className="mobile-comparison-label">{tx('New')}</span>
                                                                        <span>{right}{row.unit === 'rate' && right !== 'Not available' ? '/kg' : ''}</span>
                                                                        {row.context?.right && <span className="mt-1 block font-sans text-xs font-medium leading-4 text-subtle">{row.context.right}</span>}
                                                                    </td>
                                                                    <td role="cell" className={`comparison-change px-4 py-3 font-mono font-bold ${row.changed ? numericDelta != null && numericDelta > 0 ? 'text-warning' : 'text-info' : 'text-subtle'}`}><span aria-hidden="true" className="mobile-comparison-label">{tx('Change')}</span>{change}</td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </Fragment>
                                                ))}
                                            </Fragment>
                                        ))}
                                    </tbody>
                                    </table>
                                </div>
                            </details>
                        </div>
                    )}
                    {!tourStep && <DialogFooter>
                        <Button variant="outline" onClick={() => setShowComparison(false)}>Close</Button>
                    </DialogFooter>}
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!quoteToRestore}
                onOpenChange={(open) => {
                    if (!open) {
                        setQuoteToRestore(null)
                        setExistingDraftForRestore(null)
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-warning" />
                            Replace estimator draft?
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed text-subtle">
                            A local Cost Estimate draft already exists. Restoring this saved estimate will replace it.
                        </DialogDescription>
                    </DialogHeader>
                    {existingDraftForRestore && (
                        <div className="rounded-xl border border-warning/25 bg-warning-soft p-3 text-sm text-warning">
                            <p className="font-semibold">{existingDraftForRestore.partyName || 'Untitled draft'}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-warning">
                                {existingDraftForRestore.qualityLabel || 'No quality label'}
                            </p>
                            <p className="mt-2 text-xs font-medium text-warning">
                                Saved {formatSuratDateTime(existingDraftForRestore.savedAt)}
                            </p>
                        </div>
                    )}
                    <DialogFooter className="flex gap-2 justify-end pt-2">
                        <Button
                            variant="ghost"
                            onClick={() => {
                                setQuoteToRestore(null)
                                setExistingDraftForRestore(null)
                            }}
                        >
                            Keep draft
                        </Button>
                        <Button
                            className="bg-saffron font-bold text-white hover:bg-saffron-deep"
                            onClick={() => quoteToRestore && restoreQuoteToEstimator(quoteToRestore, restoreMode)}
                        >
                            Overwrite draft
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </>
    )
}
