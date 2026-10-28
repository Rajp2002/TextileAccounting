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
import { auditHistoricalCostingSnapshot, getEstimatorQuoteDetail, getEstimatorQuotes, saveEstimatorQuoteV3, updateSavedCostingLibraryState } from '../estimator/actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { formatTimestampDate } from '@/lib/format'
import { formatSuratDateTime } from '@/lib/time'
import {
    FileText,
    ArrowRight,
    Check,
    ClipboardCheck,
    Loader2,
    AlertTriangle,
    Copy,
    Search,
    Plus,
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
  buildSavedQualityRecipeState,
  filterAndSortSavedCostings,
  savedQualityIdsWithOnlyArchivedCostings,
  getSavedCostingIdentity,
  isSavedCostingArchived,
  getSavedCostingMetrics,
  buildDraftStateFromQuote,
  canPriceSavedRecipe,
  type SavedQualityFactoryProfile,
  type SavedQualityFixedWorker,
  type SavedQualityRecipe,
  type SavedCostingMarginFilter,
  type SavedCostingSort,
} from '@/lib/saved-costings'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { useArchivePolicyTopic } from '@/components/records/ArchivePolicyNotice'
import { createCostingExportModel } from '@/lib/costing-export-model'
import { isStandaloneCosting, type CostingRecordKind } from '@/lib/costing-workspace'
import { useTranslation } from '@/lib/i18n/context'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { useOwnerPlan } from '@/components/providers/owner-plan-provider'
import { liteRecordsCopy } from '@/lib/i18n/lite-records'
import { MOBILE_WORKSPACE_QUERY } from '@/lib/mobile-workflow-navigation'
import mobileStyles from '@/components/estimator/lite-records.module.css'
import { CompositionBar, Swatch } from '@/components/stock/stock-presentation'
import { averageMargin, costMix, marginAtSavedPrice, qualityYarns, type CostMixKey } from '@/lib/costing-catalogue'
import { getCostingsBehindRateBook } from '../rates/propagation-actions'
import { RateBookUpdateDialog } from '@/components/estimator/RateBookUpdateDialog'
import type { RateBookDriftItem } from '@/lib/yarn-rate-propagation'
import { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { fillCopy } from '@/lib/i18n/fill'
import { costingMarginText } from '@/lib/i18n/costing-margin'
import { offerCheckText } from '@/lib/i18n/offer-check'
import { CostingMarginScope, marginTone, type MarginReadOnlyReason } from '@/components/estimator/SavedCostingMargin'
import { SavedCostingFormula } from '@/components/estimator/SavedCostingFormula'
import { buildSavedCostingFormula } from '@/lib/saved-costing-formula'
import { savedCostingFormulaText } from '@/lib/i18n/saved-costing-formula'

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

function formatCostingPercent(value: number | null) {
    return value == null ? 'Not available' : `${value.toFixed(1)}%`
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
    updatingId,
    detailLoadingId,
    onOpenDetails,
    onCloseDetails,
    onOpen,
    onStartFrom,
    onSaveAsNewQuality,
    onExport,
    onAudit,
    auditingId,
    onToggleFavorite,
    onToggleArchived,
    onEnsureDetail,
    tourStep,
    selectedRecordIdByGroup,
    onSelectRecord,
    onSaveMargin,
    onDeleteSample,
}: {
    groups: SavedQualityGroup[]
    canUseProductionPipeline: boolean
    openKey: string | null
    updatingId: string | null
    detailLoadingId: string | null
    onOpenDetails: (key: string, singleSnapshot?: QuoteRow | null) => void
    onCloseDetails: () => void
    onOpen: (quote: QuoteRow) => void
    onStartFrom: (quote: QuoteRow) => void
    onSaveAsNewQuality: (quote: QuoteRow) => void
    onExport: (quote: QuoteRow) => void
    onAudit: (quote: QuoteRow) => void
    auditingId: string | null
    onToggleFavorite: (quote: QuoteRow) => void
    onToggleArchived: (quote: QuoteRow) => void
    onEnsureDetail?: (quote: QuoteRow) => Promise<QuoteRow | null>
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
    const formulaCopy = savedCostingFormulaText[language]

    return (
        <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,30rem),1fr))]">
            {groups.map((group, groupIndex) => {
                const isOpen = openKey === group.key
                const latest = group.records[0] ?? null
                const selectedRecordId = tourStep ? (tourStep === 'versions' ? null : group.records[0]?.id) : selectedRecordIdByGroup[group.key]
                // The breakdown always shows a version: the one picked in the history, else the latest.
                // The tour's version steps keep it empty so they can point at the history alone.
                const activeRecord = (selectedRecordId ? group.records.find(r => r.id === selectedRecordId) : null) ?? (tourStep && group.records.length > 1 ? null : latest)
                const targetRecord = activeRecord ?? latest
                const latestResult = activeRecord ? getHistoricalCostingResult(activeRecord) : null
                const activeResult = latestResult
                const activeDetailLoading = targetRecord != null && detailLoadingId === targetRecord.id
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
                // The worksheet is read from this version's own saved inputs. A record with no saved
                // rows would fall back to today's defaults, which were never its inputs, so it shows
                // the saved figures without the rates behind them.
                const hasSavedInputs = activeRecord != null && (activeRecord.snapshot_data != null || (activeRecord.warp_rows?.length ?? 0) > 0)
                const activeFormula = isOpen && activeRecord && activeResult
                    ? buildSavedCostingFormula(activeResult, hasSavedInputs ? marginBase ?? buildDraftStateFromQuote(activeRecord) : null)
                    : null
                const hasVersionList = group.records.length > 1
                const shownRecord = activeRecord ?? (hasVersionList ? null : latest)
                const dialogDescription = shownRecord
                    ? [
                        fillCopy(formulaCopy.version, { n: Number(shownRecord.version_number ?? 1) }),
                        fillCopy(formulaCopy.savedOn, { date: formatTimestampDate(shownRecord.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) }),
                        Number(shownRecord.meters) > 0 ? fillCopy(formulaCopy.costedFor, { m: Number(shownRecord.meters).toLocaleString('en-IN') }) : null,
                    ].filter(Boolean).join(' · ')
                    : group.records.length > 0
                        ? `${group.records.length} saved ${group.records.length === 1 ? 'version' : 'versions'} · updated ${formatTimestampDate(group.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'Saved recipe · no saved costing yet'
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
                            {latest && canReuseLatest && costNotSaved && (
                                <Button
                                    type="button"
                                    onClick={() => onOpen(latest)}
                                    disabled={updatingId === latest.id}
                                    aria-label={fillCopy(copy.recalculateLabel, { name: group.name })}
                                    className="h-10 rounded-lg font-semibold max-md:min-h-[44px]"
                                >
                                    <RefreshCw className="h-4 w-4" aria-hidden="true" /> {copy.recalculate}
                                </Button>
                            )}
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
                                    className="@container w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:left-[var(--costing-dialog-left)] sm:p-0 sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[1180px]"
                                >
                                    {/* The layout follows the dialog's own width, which a tour narrows to fit its card: from 840px the
                                        version list sits beside the breakdown and each scrolls on its own, and with several versions the
                                        dialog keeps one height so picking another never resizes it. Narrower, the versions are a row
                                        above the breakdown and the whole dialog scrolls. */}
                                    <div className={cn('max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto @min-[840px]:flex @min-[840px]:flex-col @min-[840px]:overflow-y-hidden', hasVersionList && '@min-[840px]:h-[min(880px,calc(100dvh-2rem))]')}>
                                        <DialogHeader className="relative sticky top-0 z-20 shrink-0 border-b border-hairline bg-surface px-5 py-4 pr-16 sm:px-6 sm:pr-16">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <DialogTitle data-i18n-skip="true" className="min-w-0 flex-1 truncate text-xl font-semibold tracking-[-0.01em]" title={group.name}>{group.name}</DialogTitle>
                                                {group.template?.is_active === false && <Badge variant="outline" className="border-hairline bg-surface-soft text-xs font-bold text-subtle">{tx('Archived · read-only')}</Badge>}
                                            </div>
                                            <DialogDescription data-i18n-skip={shownRecord ? 'true' : undefined} lang={shownRecord ? language : undefined} className="tabular-nums">{dialogDescription}</DialogDescription>
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

                                        <div className={cn('ui-disclosure-content min-w-0 @min-[840px]:grid @min-[840px]:min-h-0 @min-[840px]:flex-1 @min-[840px]:grid-rows-[minmax(0,1fr)_auto]', hasVersionList && '@min-[840px]:grid-cols-[264px_minmax(0,1fr)]')}>
                                            {hasVersionList && (
                                                <nav
                                                    data-costing-tour="versions"
                                                    data-i18n-skip="true"
                                                    lang={language}
                                                    aria-label={fillCopy(formulaCopy.versionsLabel, { name: group.name })}
                                                    className="min-w-0 border-b border-hairline bg-[var(--wv-bg-canvas)] @min-[840px]:min-h-0 @min-[840px]:overflow-y-auto @min-[840px]:overscroll-contain @min-[840px]:border-b-0 @min-[840px]:border-r"
                                                >
                                                    <p className="px-5 pt-3 text-[13px] font-semibold text-muted-foreground @min-[840px]:pt-4">{formulaCopy.versions}</p>
                                                    <ul className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2 @min-[840px]:flex-col @min-[840px]:gap-1 @min-[840px]:overflow-visible @min-[840px]:px-3 @min-[840px]:pb-4">
                                                        {group.records.map(record => {
                                                            const isInspected = activeRecord?.id === record.id
                                                            const versionNumber = Number(record.version_number ?? 1)
                                                            const cost = getProductionCostPerM(record)
                                                            const price = getSuggestedSellingPricePerM(record)
                                                            const margin = getActualMarginPct(record)
                                                            const costingStatus = getCostingStatus(record)
                                                            return (
                                                                <li key={record.id} className="w-[15.5rem] shrink-0 @min-[840px]:w-auto">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleInspectRecord(record)}
                                                                        aria-current={isInspected ? 'true' : undefined}
                                                                        className={cn(
                                                                            'w-full rounded-lg border px-3 py-2.5 text-left transition-colors duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50',
                                                                            isInspected ? 'border-[var(--wv-neel-200)] bg-[var(--wv-bg-selected)]' : 'border-transparent hover:border-hairline hover:bg-surface',
                                                                        )}
                                                                    >
                                                                        <span className="flex items-baseline justify-between gap-2">
                                                                            <span className="text-sm font-semibold text-ink">{fillCopy(formulaCopy.version, { n: versionNumber })}</span>
                                                                            {detailLoadingId === record.id
                                                                                ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden="true" />
                                                                                : versionNumber === latestVersionNumber && <span className="text-xs text-muted-foreground">{formulaCopy.latest}</span>}
                                                                        </span>
                                                                        <span className="mt-0.5 block text-[13px] tabular-nums text-muted-foreground">{fillCopy(formulaCopy.savedOn, { date: formatTimestampDate(record.created_at, { day: 'numeric', month: 'short', year: 'numeric' }) })}</span>
                                                                        <span className="mt-2 block text-sm font-semibold tabular-nums text-ink">{cost == null ? formulaCopy.noCost : `₹${cost.toFixed(2)}/m`}</span>
                                                                        {price != null && (
                                                                            <span className="block text-[13px] tabular-nums text-muted-foreground">
                                                                                {fillCopy(formulaCopy.sellsAt, { price: price.toFixed(2) })}
                                                                                {margin != null && <> · <span className={marginTone(margin)}>{fillCopy(formulaCopy.marginPct, { pct: margin.toFixed(1) })}</span></>}
                                                                            </span>
                                                                        )}
                                                                        {costingStatus !== 'verified' && <span className="mt-1 block text-[13px] font-medium text-[var(--wv-ochre-800)]">{tx(getCostingBadge(costingStatus))}</span>}
                                                                    </button>
                                                                </li>
                                                            )
                                                        })}
                                                    </ul>
                                                </nav>
                                            )}

                                            {!activeRecord || activeDetailLoading || !activeResult ? (
                                                <div className="min-w-0 p-4 sm:p-6 @min-[840px]:min-h-0 @min-[840px]:overflow-y-auto">
                                                    <div className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-hairline bg-surface px-6 py-10 text-center">
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
                                                                    ? 'Choose a version from the list to see how its cost was worked out.'
                                                                    : group.currentRecipeCostPerM != null
                                                                        ? 'This is a live estimate from the saved yarns and today’s factory costs, not a saved costing. Set a quantity and choose Save Costing to keep the full breakdown.'
                                                                        : 'Open Cost Estimate, choose this saved quality, set the costing quantity, and choose Save Costing. Its analysis will then appear here.'
                                                                : 'Its saved cost and price are kept as they were saved. Open this version in Cost Estimate to review its saved assumptions.')}</p>
                                                        {targetRecord && !activeDetailLoading && (
                                                            <div className="mt-4 flex flex-wrap justify-center gap-2">
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
                                                </div>
                                            ) : (
                                                <CostingMarginScope
                                                    key={activeRecord.id}
                                                    base={marginBase}
                                                    saved={latestResult}
                                                    readOnly={marginReadOnly}
                                                    versionNumber={activeVersionNumber}
                                                    latestVersionNumber={latestVersionNumber}
                                                    isSample={isSampleRecordId(activeRecord.id)}
                                                    priceLabel={t('common.suggested_selling_price_per_m')}
                                                    onSave={(marginPct, clientRequestId) => onSaveMargin(activeRecord, group.key, marginPct, clientRequestId)}
                                                >
                                                {({ paused, pausedTitle, economics }) => (
                                                // From 840px the section's two parts join the dialog grid, so the footer runs under the version list too.
                                                <section data-costing-tour="breakdown" className="flex min-w-0 flex-col @min-[840px]:contents">
                                                    <div className="min-w-0 flex-1 px-4 py-4 sm:px-6 sm:py-5 @min-[840px]:min-h-0 @min-[840px]:overflow-y-auto @min-[840px]:overscroll-contain">
                                                        {getCostingStatus(activeRecord) !== 'verified' && (
                                                            <div className="mb-4 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft px-3 py-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between">
                                                                <div><p className="font-bold">{tx('Saved costing needs a check')}</p><p className="mt-1">{tx(activeRecord.reconciliation_note || getCostingTrustCopy(getCostingStatus(activeRecord)))}</p></div>
                                                                <Button variant="outline" size="sm" onClick={() => onAudit(activeRecord)} disabled={auditingId === activeRecord.id} aria-busy={auditingId === activeRecord.id} className="shrink-0 border-warning/30 bg-surface text-warning hover:bg-warning-soft">
                                                                    {auditingId === activeRecord.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {tx(auditingId === activeRecord.id ? 'Checking…' : 'Check saved numbers')}
                                                                </Button>
                                                            </div>
                                                        )}
                                                        {activeFormula && <SavedCostingFormula formula={activeFormula} />}
                                                        <div data-costing-tour="economics" className="mt-3 sm:-mx-4">{economics}</div>
                                                    </div>
                                                    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-hairline bg-surface px-4 py-3 sm:px-6 @min-[840px]:col-span-full">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => onToggleFavorite(activeRecord)}
                                                            disabled={updatingId === activeRecord.id}
                                                            aria-pressed={Boolean(activeRecord.is_favorite)}
                                                            aria-label={fillCopy(activeRecord.is_favorite ? copy.removeFavourite : copy.addFavourite, { name: group.name })}
                                                            className="h-10 w-10 shrink-0 max-md:h-11 max-md:w-11"
                                                        >
                                                            <Star className={cn('h-[18px] w-[18px]', activeRecord.is_favorite ? 'fill-saffron text-saffron-deep' : 'text-muted-foreground')} aria-hidden="true" />
                                                        </Button>
                                                        <Button variant="ghost" onClick={() => onToggleArchived(activeRecord)} disabled={updatingId === activeRecord.id} aria-busy={updatingId === activeRecord.id} className={ghostAction}>
                                                            {updatingId === activeRecord.id ? <Loader2 className="h-4 w-4 animate-spin" /> : activeRecord.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                            {tx(updatingId === activeRecord.id ? activeRecord.is_archived ? `Restoring ${getSavedCostingIdentity(activeRecord).label}…` : `Archiving ${getSavedCostingIdentity(activeRecord).label}…` : (activeRecord.is_archived || latest.is_archived ? 'Restore costing' : 'Archive costing'))}
                                                        </Button>
                                                        <div data-costing-tour="reuse" className="flex flex-wrap items-center gap-2 sm:ml-auto">
                                                            {canUseProductionPipeline && isStandaloneCosting(activeRecord.record_kind) && !activeRecord.is_archived && (
                                                                <Link
                                                                    prefetch={tourStep ? false : undefined}
                                                                    data-costing-tour="production"
                                                                    href={`/owner/production?tab=jobs&costingId=${encodeURIComponent(activeRecord.id)}`}
                                                                    onClick={event => { if (paused) event.preventDefault(); else trackPlanEvent('production_cta_clicked', { source: 'saved_costing_breakdown' }) }}
                                                                    aria-disabled={paused || undefined}
                                                                    title={pausedTitle}
                                                                    className={cn('inline-flex h-10 items-center gap-1.5 rounded-lg border border-saffron/30 bg-saffron-soft px-3 text-sm font-semibold text-saffron-deep hover:bg-saffron-soft/80 max-md:min-h-[44px]', paused && 'pointer-events-none opacity-50')}
                                                                >
                                                                    <Factory className="h-4 w-4" /> {tx('Activate for Production')}
                                                                </Link>
                                                            )}
                                                            <Button variant="ghost" onClick={() => onSaveAsNewQuality(activeRecord)} disabled={paused} title={pausedTitle} className={ghostAction}><BookmarkPlus className="h-4 w-4" /> {tx('Save as separate quality')}</Button>
                                                            <Button variant="outline" onClick={() => onStartFrom(activeRecord)} disabled={paused} title={pausedTitle} className={secondaryAction}><Copy className="h-4 w-4" /> {tx('Duplicate')}</Button>
                                                            <Button variant="outline" onClick={() => onExport(activeRecord)} disabled={paused} title={pausedTitle} className={secondaryAction}><Download className="h-4 w-4" /> {tx('Export')}</Button>
                                                        </div>
                                                    </div>
                                                </section>
                                                )}
                                                </CostingMarginScope>
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
            // The default view never lists an archived costing, so a quality
            // whose costings are all archived is left out with them.
            const archivedOnlyQualityIds = showArchived ? new Set<string>() : savedQualityIdsWithOnlyArchivedCostings(quotes)
            for (const template of initialTemplates.filter(item => (item.is_active === false) === showArchived && !archivedOnlyQualityIds.has(item.id))) {
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
            // The default view lists favourites first, then the most recently updated.
            const favouriteOrder = Number(b.records[0]?.is_favorite === true) - Number(a.records[0]?.is_favorite === true)
            return favouriteOrder || Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        })
    }, [costingSort, initialProfile, initialTemplates, initialWorkers, marginFilter, quotes, searchQuery, showArchived, showFavoritesOnly])
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
    const libraryAverageMargin = averageMargin(libraryLatest.flatMap(entry => entry.metrics.actualMarginPct == null ? [] : [entry.metrics.actualMarginPct]))
    const savedCostingCount = libraryLatest.reduce((sum, entry) => sum + entry.count, 0)
    const lastSavedAt = libraryLatest.reduce<string | null>((latest, entry) => !latest || Date.parse(entry.record.created_at) > Date.parse(latest) ? entry.record.created_at : latest, null)
    const showLibraryBand = !tourSampleActive && !loadError && !showArchived && libraryLatest.length > 0
    // Costings behind today's Rate Book yarn rates. A secondary read: without it the band shows the saved count instead.
    const [rateBookDrift, setRateBookDrift] = useState<'loading' | 'unavailable' | { yarnCount: number; items: RateBookDriftItem[] }>('loading')
    const [rateBookReviewOpen, setRateBookReviewOpen] = useState(false)
    const refreshRateBookDrift = useCallback(() => {
        void getCostingsBehindRateBook()
            .then(result => setRateBookDrift(result.data ? { yarnCount: result.data.yarnCount, items: result.data.items } : 'unavailable'))
            .catch(() => setRateBookDrift('unavailable'))
    }, [])
    useEffect(() => { if (showLibraryBand) refreshRateBookDrift() }, [showLibraryBand, refreshRateBookDrift])
    const savedMarginById = useMemo(() => new Map(quotes.map(quote => [quote.id, getSavedCostingMetrics(quote).actualMarginPct])), [quotes])
    const bandStatusLine = (() => {
        if (rateBookDrift === 'loading') return null
        if (rateBookDrift === 'unavailable') return lastSavedAt ? fillCopy(catalogue.lastSaved, { date: formatTimestampDate(lastSavedAt, { day: 'numeric', month: 'short' }) }) : null
        const worst = rateBookDrift.items[0]
        if (!worst) return fillCopy(rateBookDrift.yarnCount === 1 ? catalogue.checkedYarnsOne : catalogue.checkedYarns, { n: rateBookDrift.yarnCount })
        const savedMargin = savedMarginById.get(worst.id) ?? null
        const marginToday = marginAtSavedPrice(savedMargin, worst.before.sellingPricePerM, worst.before.productionCostPerM, worst.after.productionCostPerM)
        return savedMargin == null || marginToday == null
            ? null
            : fillCopy(catalogue.behindLine, { name: worst.qualityLabel, from: `${savedMargin.toFixed(1)}%`, to: `${marginToday.toFixed(1)}%` })
    })()
    const reloadAfterRateBookUpdate = useCallback(() => {
        refreshRateBookDrift()
        void getEstimatorQuotes()
            .then(result => { if (result.data) setQuotes(result.data as QuoteRow[]) })
            .catch(() => router.refresh())
    }, [refreshRateBookDrift, router])
    const libraryView = showArchived ? 'archived' : showFavoritesOnly ? 'favourites' : 'all'
    const setLibraryView = (view: 'all' | 'favourites' | 'archived') => {
        setOpenQualityKey(null)
        setShowArchived(view === 'archived')
        setShowFavoritesOnly(view === 'favourites')
    }

    return (
        <>
            <div className={cn("saved-costings-workspace ui-route-enter w-full space-y-4 sm:space-y-6", isLite && mobileStyles.workspace)} data-lite-costings={isLite || undefined}>
            <RouteMilestones route="/owner/quotes" shellVisible primaryUsable secondaryReady />
            <PageHeader
                title={t('common.saved_costings_title')}
                actions={<>
                    <SavedCostingsTutorial step={tourStep} onStepChange={setTourStep} onComplete={() => setShowCostingDeleteNudge(true)} production={canUseProductionPipeline} ending={savedCostingTourEnding(quotes.filter(quote => isStandaloneCosting(quote.record_kind)).length, tourUnavailable)} topics={[archivePolicyTopic]} userId={userId} orgId={orgId} userMetadata={userMetadata} />
                    {quotes.length > 0 && !tourStep && (
                        <Button asChild variant="saffron" className="h-10 rounded-lg font-semibold max-md:min-h-[44px]">
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
            {/* The library at a glance, like the Rate Book's band: the counts, then whether any costing is behind today's yarn rates, which open in the review. */}
            {showLibraryBand && (
                <section
                    aria-labelledby="costing-library-status"
                    data-i18n-skip="true"
                    lang={language}
                    className="grid overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]"
                >
                    <dl className="grid grid-cols-3 divide-x divide-hairline">
                        {[
                            { label: catalogue.qualitiesStat, value: String(libraryLatest.length) },
                            { label: catalogue.costingsStat, value: String(savedCostingCount) },
                            { label: catalogue.marginStat, value: libraryAverageMargin == null ? '—' : `${libraryAverageMargin.toFixed(1)}%` },
                        ].map(stat => (
                            <div key={stat.label} className="flex min-w-0 flex-col items-center justify-center px-4 py-5 text-center sm:px-6">
                                <dt className="max-w-full truncate text-[13px] font-medium text-muted-foreground" title={stat.label}>{stat.label}</dt>
                                <dd className="mt-1 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink tabular-nums">{stat.value}</dd>
                            </div>
                        ))}
                    </dl>
                    <div className="flex flex-col gap-4 border-t border-hairline px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:border-l lg:border-t-0">
                        {/* Centred in the room beside Review, like the counts beside it. */}
                        <div className="flex min-w-0 flex-1 items-center justify-center gap-4">
                            {rateBookDrift !== 'unavailable' && (
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'flex size-11 shrink-0 items-center justify-center rounded-full',
                                        rateBookDrift === 'loading' ? 'bg-surface-soft text-muted-foreground'
                                            : rateBookDrift.items.length ? 'bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]' : 'bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]',
                                    )}
                                >
                                    {rateBookDrift === 'loading' ? <Loader2 className="size-5 animate-spin" />
                                        : rateBookDrift.items.length ? <ClipboardCheck className="size-5" /> : <Check className="size-5" strokeWidth={2.5} />}
                                </span>
                            )}
                            <div className="min-w-0">
                                <p id="costing-library-status" className="text-lg font-semibold leading-snug text-ink">
                                    {rateBookDrift === 'loading' ? catalogue.checking
                                        : rateBookDrift === 'unavailable' ? fillCopy(savedCostingCount === 1 ? catalogue.savedCostingsOne : catalogue.savedCostings, { n: savedCostingCount })
                                        : rateBookDrift.items.length ? fillCopy(rateBookDrift.items.length === 1 ? catalogue.behindOne : catalogue.behind, { n: rateBookDrift.items.length })
                                        : catalogue.current}
                                </p>
                                {bandStatusLine && <p className="mt-0.5 break-words text-[13px] text-body tabular-nums">{bandStatusLine}</p>}
                            </div>
                        </div>
                        {rateBookDrift !== 'loading' && rateBookDrift !== 'unavailable' && rateBookDrift.items.length > 0 && (
                            <Button
                                data-costing-field="rateBookReviewAction"
                                onClick={() => setRateBookReviewOpen(true)}
                                className={cn(railPrimaryAction, 'h-11 shrink-0 px-5 max-sm:w-full')}
                            >
                                {catalogue.review}
                                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                </section>
            )}
            <RateBookUpdateDialog
                open={rateBookReviewOpen}
                copy={catalogue}
                warpLabel={catalogue.warp}
                weftLabel={catalogue.weft}
                savedMarginById={savedMarginById}
                onOpenChange={setRateBookReviewOpen}
                onSaved={reloadAfterRateBookUpdate}
            />
            <div data-costing-tour="filters" className="space-y-3">
                {/* One wrapping row: search, the view, and filters. */}
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
                                    <SwitchField variant="pill" checked={showFavoritesOnly} onCheckedChange={() => { setOpenQualityKey(null); setShowFavoritesOnly(current => !current) }}>{mobileCopy.favourites}</SwitchField>
                                    <Button type="button" variant={showArchived ? 'secondary' : 'outline'} onClick={() => { setOpenQualityKey(null); setShowArchived(current => !current) }}>{showArchived ? mobileCopy.active : mobileCopy.archived}</Button>
                                </div>}
                            </div>
                        </details>
                    </div>
                </div>
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
                        tourStep={tourStep}
                        updatingId={null} detailLoadingId={null} auditingId={null}
                        onOpenDetails={() => {}} onCloseDetails={() => {}}
                        onOpen={() => {}} onStartFrom={() => {}} onSaveAsNewQuality={() => {}} onExport={() => {}}
                        onAudit={() => {}} onToggleFavorite={() => {}} onToggleArchived={() => {}}
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
                    <div data-costing-tour="sample" className="saved-costings-scroll space-y-3">
                        <p className="rounded-lg border border-hairline bg-surface-soft px-3 py-2 text-sm font-semibold text-ink" data-i18n-skip="true" lang={language}>{tourCommonCopy[language].sampleBanner}</p>
                        <SavedQualityLibraryView
                            selectedRecordIdByGroup={selectedRecordIdByGroup} onSelectRecord={selectRecord} onSaveMargin={saveCostingMargin}
                            groups={tourGroups}
                            canUseProductionPipeline={canUseProductionPipeline}
                            openKey={openQualityKey}
                            updatingId={updatingId}
                            detailLoadingId={detailLoadingId}
                            onOpenDetails={(key, singleSnapshot) => {
                                setOpenQualityKey(key)
                                if (singleSnapshot) void ensureQuoteDetail(singleSnapshot)
                            }}
                            onCloseDetails={() => setOpenQualityKey(null)}
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
                        />
                    </div>
                )
            ) : (
            <div className="saved-costings-scroll">
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
                    updatingId={updatingId}
                    detailLoadingId={detailLoadingId}
                    onOpenDetails={(key, singleSnapshot) => {
                        setOpenQualityKey(key)
                        if (singleSnapshot) void ensureQuoteDetail(singleSnapshot)
                    }}
                    onCloseDetails={() => setOpenQualityKey(null)}
                    onOpen={quote => { setOpenQualityKey(null); void handleRestore(quote, 'edit') }}
                    onStartFrom={quote => { setOpenQualityKey(null); void handleRestore(quote, 'duplicate') }}
                    onSaveAsNewQuality={quote => { setOpenQualityKey(null); void handleRestore(quote, 'duplicate') }}
                    onExport={quote => { setOpenQualityKey(null); void openQuoteExport(quote) }}
                    onAudit={quote => { void auditQuote(quote) }}
                    auditingId={updatingId}
                    onToggleFavorite={quote => { void handleLibraryState(quote, { isFavorite: !quote.is_favorite }) }}
                    onToggleArchived={requestArchiveState}
                    onEnsureDetail={ensureQuoteDetail}
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
