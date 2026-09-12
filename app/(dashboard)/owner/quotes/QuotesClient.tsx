'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { SavedCostingsTutorial } from '@/components/estimator/SavedCostingsTutorial'
import { costingTourSurface, makeSavedCostingTourExamples, makeSavedCostingTourExport, type SavedCostingStep } from '@/lib/saved-costings-tour'
import { savedCostingsTutorialCopy } from '@/lib/i18n/saved-costings-tutorial'
import { useRouter } from 'next/navigation'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState, parseCostingResultSnapshot, type CostingResultSnapshot } from '@/lib/estimator'
import {
    createEstimatorDraft,
    getEstimatorDraftStorageKey,
    parseEstimatorDraft,
    shouldWarnBeforeQuoteRestore,
    type EstimatorAutosaveData,
} from '@/lib/estimator-drafts'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { auditHistoricalCostingSnapshot, convertAcceptedQuoteToOrder, getEstimatorQuoteDetail, getQuoteStatusHistory, updateQuoteStatus, updateSavedCostingLibraryState } from '../estimator/actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { addDays, format } from 'date-fns'
import { formatDateOnly, formatTimestampDate } from '@/lib/format'
import { formatSuratDateTime } from '@/lib/time'
import {
    History,
    CheckCircle2,
    FileText,
    ArrowRight,
    Loader2,
    Package,
    AlertTriangle,
    Copy,
    XCircle,
    Search,
    Eye,
    Plus,
    GitCompareArrows,
    Star,
    Archive,
    ArchiveRestore,
    BookmarkPlus,
    ChevronDown,
    ChevronRight,
    Download,
    Factory,
    Layers3,
    Sparkles,
    Trash2,
    ExternalLink,
    X,
} from 'lucide-react'
import {
  compareSavedCostingSnapshots,
  orderSavedCostingsForComparison,
  buildSavedQualityRecipeState,
  filterAndSortSavedCostings,
  getSavedCostingIdentity,
  isSavedCostingArchived,
  getPreviousCostingVersion,
  normalizeSavedWarpRows,
  normalizeSavedWeftRows,
  getSavedCostingMetrics,
  type SavedQualityFactoryProfile,
  type SavedQualityFixedWorker,
  type SavedQualityRecipe,
  type SavedCostingMarginFilter,
  type SavedCostingSort,
  type SavedCostingDelta,
} from '@/lib/saved-costings'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { ArchivePolicyNotice } from '@/components/records/ArchivePolicyNotice'
import { createCostingExportModel } from '@/lib/estimator-export'
import { canUseQuotationLifecycle, isStandaloneCosting, type CostingRecordKind } from '@/lib/costing-workspace'
import { useTranslation } from '@/lib/i18n/context'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { EmptyState, PageHeader, StatusBadge, Toolbar } from '@/components/ui/page-header'

const CostingExportDialog = dynamic(
    () => import('@/components/estimator/CostingExportDialog').then(module => module.CostingExportDialog),
    { ssr: false, loading: () => null },
)

/* Source-regression fixture: historical tests reference the pre-tokenized costing/production panel markup. */
/* Historical copy reference retained for source-regression coverage: expand a quality to review its costing history. */
/* <section className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
<p className="text-sm font-black text-slate-950">{tx('Latest Saved Costing breakdown')}</p> */
/* {canUseProduction && <section className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-center justify-between gap-3"> */

const STATUS_CONFIG = {
    draft:    { label: 'Draft',    color: 'bg-surface-soft text-body border-hairline' },
    sent:     { label: 'Sent',     color: 'bg-info-soft text-info border-info/25' },
    accepted: { label: 'Accepted', color: 'bg-success-soft text-success border-success/25' },
    rejected: { label: 'Rejected', color: 'bg-risk-soft text-risk border-risk/25' },
}

type QuoteStatus = keyof typeof STATUS_CONFIG
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
    costing_input_fingerprint?: string | null
    factory_profile_updated_at?: string | null
    reconciliation_status?: string | null
    reconciliation_note?: string | null
    orders?: QuoteLinkedOrder | QuoteLinkedOrder[] | null
}

type QuoteStatusHistoryRow = {
    changedAt: string
    changedBy: string | null
    from: QuoteStatus | null
    to: QuoteStatus | null
}

function getLinkedOrder(quote: QuoteRow) {
    return Array.isArray(quote.orders) ? quote.orders[0] : quote.orders
}

function getProducedMeters(order: QuoteLinkedOrder | null | undefined) {
    return (order?.production_logs ?? []).reduce((sum, log) => sum + Number(log.meters ?? 0), 0)
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

function buildDraftStateFromQuote(quote: QuoteRow): QuoteDraftState {
    const base = makeDefaultEstimateState()
    const snapshot = quote.snapshot_data ?? ({} as Partial<QuoteDraftState>)
    const warpRows = Array.isArray(snapshot.warpRows) && snapshot.warpRows.length > 0 ? snapshot.warpRows : quote.warp_rows
    const weftRows = Array.isArray(snapshot.weftRows) && snapshot.weftRows.length > 0 ? snapshot.weftRows : quote.weft_rows
    const numberOr = (value: unknown, fallback: number) => {
        const parsed = Number(value)
        return value !== null && value !== undefined && value !== '' && Number.isFinite(parsed) ? parsed : fallback
    }
    return {
        ...base,
        ...snapshot,
        warpRows: normalizeSavedWarpRows(warpRows, base.warpRows[0], {
            beamEnds: quote.beam_ends,
            warpDenier: quote.yarn_denier,
            yarnRate: quote.yarn_rate_per_kg,
        }),
        weftRows: normalizeSavedWeftRows(weftRows, base.weftRows[0], {
            picks: quote.ppi,
            reedSpace: quote.reed_space,
            weftDenier: quote.weft_denier ?? quote.yarn_denier,
            yarnRate: quote.yarn_rate_per_kg,
        }),
        tapeLengthM: numberOr(snapshot.tapeLengthM ?? quote.tape_length_m, base.tapeLengthM),
        perPickCostPaisa: numberOr(snapshot.perPickCostPaisa ?? quote.per_pick_cost_paise, base.perPickCostPaisa),
        warpingRatePerKg: numberOr(snapshot.warpingRatePerKg ?? quote.warping_rate_per_kg, base.warpingRatePerKg),
        sizingRatePerKg: numberOr(snapshot.sizingRatePerKg ?? quote.sizing_rate_per_kg, base.sizingRatePerKg),
        windingRatePerKg: numberOr(snapshot.windingRatePerKg ?? quote.winding_rate_per_kg, base.windingRatePerKg),
        processingRatePerM: numberOr(snapshot.processingRatePerM ?? quote.processing_rate_per_m, base.processingRatePerM),
        finishingRatePerM: numberOr(snapshot.finishingRatePerM ?? quote.finishing_rate_per_m, base.finishingRatePerM),
        yarnShortagePct: numberOr(snapshot.yarnShortagePct ?? quote.yarn_shortage_pct, base.yarnShortagePct),
        warpCrimpPct: numberOr(snapshot.warpCrimpPct ?? quote.warp_crimp_pct, base.warpCrimpPct),
        overheadItems: Array.isArray(snapshot.overheadItems) ? snapshot.overheadItems : Array.isArray(quote.overhead_items) ? quote.overhead_items : base.overheadItems,
        monthlyOutputM: numberOr(snapshot.monthlyOutputM ?? quote.monthly_output_m, base.monthlyOutputM),
        overheadOverridePerM: snapshot.overheadOverridePerM ?? (quote.overhead_override_per_m != null ? numberOr(quote.overhead_override_per_m, 0) : base.overheadOverridePerM),
        overheadMode: snapshot.overheadMode ?? (snapshot.overheadOverridePerM != null || quote.overhead_override_per_m != null ? 'direct' : 'monthly_expenses'),
        overheadPct: 0,
        commissionPct: numberOr(snapshot.commissionPct ?? quote.commission_pct, base.commissionPct),
        transportPerM: numberOr(snapshot.transportPerM ?? quote.transport_per_m, base.transportPerM),
        profitPct: numberOr(snapshot.profitPct ?? quote.profit_margin_pct ?? quote.intended_margin_percent, base.profitPct),
        orderQuantityM: numberOr(snapshot.orderQuantityM ?? quote.meters, 0) || null,
        enabledSections: { ...base.enabledSections, ...(quote.enabled_sections ?? {}), ...(snapshot.enabledSections ?? {}) },
        loomType: snapshot.loomType ?? quote.loom_type ?? base.loomType,
        loomRpm: snapshot.loomRpm ?? (quote.estimator_rpm != null ? numberOr(quote.estimator_rpm, 0) : base.loomRpm),
        loomPowerKw: snapshot.loomPowerKw ?? (quote.estimator_power_kw != null ? numberOr(quote.estimator_power_kw, 0) : base.loomPowerKw),
        loomRpmIsCustomised: snapshot.loomRpmIsCustomised ?? (quote.estimator_rpm != null),
        loomPowerKwIsCustomised: snapshot.loomPowerKwIsCustomised ?? (quote.estimator_power_kw != null),
        hoursPerShift: numberOr(snapshot.hoursPerShift ?? quote.hours_per_shift, base.hoursPerShift ?? 12),
        warpingMode: snapshot.warpingMode ?? quote.warping_mode ?? (numberOr(snapshot.warpingRatePerKg ?? quote.warping_rate_per_kg, 0) > 0 ? 'outsourced' : base.warpingMode),
        sizingMode: snapshot.sizingMode ?? quote.sizing_mode ?? base.sizingMode,
        loomCount: numberOr(snapshot.loomCount ?? quote.loom_count, base.loomCount),
        monthlyWorkingDays: numberOr(snapshot.monthlyWorkingDays ?? quote.monthly_working_days, base.monthlyWorkingDays),
        avgOutputPerLoomPerDay: numberOr(snapshot.avgOutputPerLoomPerDay ?? quote.avg_output_per_loom_per_day, base.avgOutputPerLoomPerDay),
        isConfigured: true,
    }
}

function getCostingStatus(quote: QuoteRow) {
    return getSavedCostingMetrics(quote).status
}

function getCostingTrustCopy(status: string | null | undefined) {
    if (status === 'verified') return 'Checked against the saved canonical costing result.'
    if (status === 'needs_review') return 'Saved values are preserved, but the stored numbers need owner review before quotation export.'
    if (status === 'unreconstructable') return 'Saved values are preserved, but older assumptions are incomplete. Save a new costing before using it as a quotation.'
    if (status === 'legacy') return 'This costing predates the canonical snapshot. Its saved values are preserved; no current rate or factory profile was used to rewrite it.'
    return 'This costing has not been checked against the canonical snapshot contract yet.'
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

function formatQuotationAmount(pricePerM: number | null, meters: number | null | undefined) {
    const quantity = Number(meters ?? 0)
    if (pricePerM == null || !Number.isFinite(quantity) || quantity <= 0) return 'Not available'
    return `₹${(pricePerM * quantity).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatCostingPercent(value: number | null) {
    return value == null ? 'Not available' : `${value.toFixed(1)}%`
}

function formatQuoteTimestamp(value: string | null | undefined) {
    return value ? formatSuratDateTime(value) : 'Not recorded'
}

function getQuotationNextAction(status: QuoteStatus) {
    if (status === 'draft') return 'Next allowed action: Mark as sent.'
    if (status === 'sent') return 'Next allowed action: Accept or reject.'
    return 'No further status changes; create a new quotation from this saved snapshot.'
}

function getLegacyVersionLabel(costing: Pick<QuoteRow, 'quality_label' | 'version_number'>) {
    return `${costing.quality_label || 'Untitled costing'} · v${Number(costing.version_number ?? 1)}`
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

function getProductionCostMovement(current: QuoteRow, previous: QuoteRow | null) {
    const currentCost = getProductionCostPerM(current)
    const previousCost = previous ? getProductionCostPerM(previous) : null
    return previousCost == null || currentCost == null ? null : currentCost - previousCost
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

function SavedQualityLibraryView({
    groups,
    canUseProduction,
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
    onOpenUsage,
    onEnsureDetail,
    factoryInputsCapturedLabel,
    tourStep,
}: {
    groups: SavedQualityGroup[]
    canUseProduction: boolean
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
    onOpenUsage: (quote: QuoteRow, order: QuoteLinkedOrder) => void
    onEnsureDetail?: (quote: QuoteRow) => Promise<QuoteRow | null>
    factoryInputsCapturedLabel: string
    tourStep?: SavedCostingStep | null
}) {
    const { t, tx } = useTranslation()
    const [selectedRecordIdByGroup, setSelectedRecordIdByGroup] = useState<Record<string, string>>({})

    return (
        <div className="space-y-3">
            {groups.map(group => {
                const isOpen = openKey === group.key
                const latest = group.records[0] ?? null
                const selectedRecordId = tourStep ? (tourStep === 'versions' ? null : group.records[0]?.id) : selectedRecordIdByGroup[group.key]
                const activeRecord = (selectedRecordId ? group.records.find(r => r.id === selectedRecordId) : null) ?? (group.records.length === 1 ? group.records[0] : null)
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
                const usages = group.records
                    .map(record => ({ record, order: getLinkedOrder(record) }))
                    .filter((item): item is { record: QuoteRow; order: QuoteLinkedOrder } => Boolean(item.order))
                    .filter((item, index, all) => all.findIndex(other => other.order.id === item.order.id) === index)
                const totalProduced = usages.reduce((sum, usage) => sum + getProducedMeters(usage.order), 0)
                const openGroupDetails = () => onOpenDetails(group.key, group.records.length === 1 ? group.records[0] : null)
                const handleInspectRecord = (record: QuoteRow) => {
                    setSelectedRecordIdByGroup(prev => ({ ...prev, [group.key]: record.id }))
                    if (onEnsureDetail) {
                        void onEnsureDetail(record)
                    }
                }

                return (
                    <Card
                        key={group.key}
                        onClick={event => {
                            const target = event.target
                            if (target instanceof Element && target.closest('button, [data-slot="dialog-content"], [data-slot="dialog-overlay"]')) return
                            openGroupDetails()
                        }}
                        className={`premium-disclosure-card cursor-pointer ${isOpen ? 'border-saffron/30 bg-surface shadow-[var(--shadow-panel)]' : 'border-hairline bg-surface shadow-[var(--shadow-card)]'}`}
                    >
                        <CardContent className="p-0">
                            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5 lg:flex-nowrap">
                                <button
                                    type="button"
                                    onClick={openGroupDetails}
                                    aria-haspopup="dialog"
                                    className="group flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-saffron/35"
                                >
                                    <span className="mt-0.5 rounded-lg bg-saffron-soft p-2 text-saffron-deep">
                                        <Layers3 className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-base font-black text-ink" title={group.name}>{group.name}</span>
                                            {group.template && <Badge variant="outline" className="border-info/25 bg-info-soft text-[10px] font-bold text-info">{tx('Fabric Quality')}</Badge>}
                                            {group.template?.is_active === false && <Badge variant="outline" className="border-hairline bg-surface-soft text-[10px] font-bold text-subtle">{tx('Archived · read-only')}</Badge>}
                                            {latest && <Badge variant="outline" className="text-[10px] font-bold">v{Number(latest.version_number ?? 1)}</Badge>}
                                            {latest && getCostingStatus(latest) !== 'verified' && <StatusBadge status="needs_review" label={getCostingBadge(getCostingStatus(latest))} />}
                                        </span>
                                        <span className="mt-1 block text-xs text-subtle">
                                            {group.records.length > 0
                                                ? `${group.records.length} saved costing ${group.records.length === 1 ? 'snapshot' : 'snapshots'} · updated ${formatTimestampDate(group.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                : tx('Saved recipe · no saved costing yet')}
                                        </span>
                                    </span>
                                </button>

                                <div className={`grid gap-2 ${canUseProduction ? 'grid-cols-1 sm:grid-cols-3 sm:min-w-[420px]' : 'grid-cols-1 sm:grid-cols-2 sm:min-w-[300px]'}`}>
                                    <div className="rounded-lg bg-surface-soft px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx(latest ? 'Latest cost' : 'Current recipe')}</p>
                                        <p className="mt-1 font-mono text-sm font-black text-ink">{latest
                                            ? formatCostingMoneyPerM(getProductionCostPerM(latest))
                                            : group.currentRecipeCostPerM != null
                                                ? `₹${group.currentRecipeCostPerM.toFixed(2)}/m`
                                                : '—'}</p>
                                    </div>
                                    {canUseProduction ? <>
                                        <div className="rounded-lg bg-surface-soft px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Used for')}</p>
                                            <p className="mt-1 text-sm font-black text-ink">{tx(`${usages.length} ${usages.length === 1 ? 'run' : 'runs'}`)}</p>
                                        </div>
                                        <div className="rounded-lg bg-surface-soft px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('Produced')}</p>
                                            <p className="mt-1 text-sm font-black text-ink">{totalProduced.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m</p>
                                        </div>
                                    </> : (
                                        <div className="rounded-lg bg-surface-soft px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{tx('History')}</p>
                                            <p className="mt-1 text-sm font-black text-ink">{tx(`${group.records.length} ${group.records.length === 1 ? 'snapshot' : 'snapshots'}`)}</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={openGroupDetails}
                                    aria-haspopup="dialog"
                                    aria-label={`Open ${group.name} details`}
                                    className="hidden rounded-md p-2 text-subtle hover:bg-surface-soft sm:block"
                                >
                                    <ChevronRight className="h-5 w-5" />
                                </button>
                            </div>

                            <Dialog modal={!tourStep} open={isOpen} onOpenChange={open => { if (!open && !tourStep) onCloseDetails() }}>
                                <DialogContent
                                    data-costing-tour-dialog={tourStep ? "true" : undefined}
                                    showCloseButton={false}
                                    onPointerDownOutside={event => { if (tourStep) event.preventDefault(); else onCloseDetails() }}
                                    onEscapeKeyDown={event => { if (tourStep) event.preventDefault(); else onCloseDetails() }}
                                    onOpenAutoFocus={event => { if (tourStep) event.preventDefault() }}
                                    onCloseAutoFocus={event => { if (tourStep) event.preventDefault() }}
                                    style={{ left: 'calc(50% + clamp(0px, calc((100vw - 1212px) / 2), 124px))' }}
                                    className="w-[calc(100vw-2rem)] max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:w-[calc(100vw-2rem)] sm:max-h-[calc(100dvh-2rem)] sm:max-w-[1180px]"
                                >
                                    <div className="max-h-[calc(100dvh-2rem)] min-w-0 overflow-x-hidden overflow-y-auto sm:max-h-[calc(100dvh-2rem)]">
                                        <DialogHeader className="relative sticky top-0 z-20 border-b border-hairline bg-surface px-5 py-4 pr-16 sm:px-6 sm:pr-16">
                                            <div className="flex min-w-0 items-center gap-2">
                                                <DialogTitle className="min-w-0 flex-1 truncate text-xl font-black" title={group.name}>{group.name}</DialogTitle>
                                                {group.template && <Badge variant="outline" className="border-info/25 bg-info-soft text-[10px] font-bold text-info">{tx('Fabric Quality')}</Badge>}
                                                {group.template?.is_active === false && <Badge variant="outline" className="border-hairline bg-surface-soft text-[10px] font-bold text-subtle">{tx('Archived · read-only')}</Badge>}
                                                {(activeRecord ?? latest) && <Badge variant="outline" className="text-[10px] font-bold">v{Number((activeRecord ?? latest)?.version_number ?? 1)}</Badge>}
                                            </div>
                                            <DialogDescription>
                                                {group.records.length > 0
                                                    ? `${group.records.length} saved costing ${group.records.length === 1 ? 'snapshot' : 'snapshots'} · updated ${formatTimestampDate(group.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                    : 'Saved recipe · no saved costing yet'}
                                            </DialogDescription>
                                            <DialogClose asChild>
                                                <button
                                                    type="button"
                                                    aria-label={`Close ${group.name} details`}
                                                    className="absolute right-3 top-3 z-30 inline-flex h-10 w-10 items-center justify-center rounded-lg text-subtle transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-saffron/50"
                                                >
                                                    <X className="h-5 w-5" aria-hidden="true" />
                                                </button>
                                            </DialogClose>
                                        </DialogHeader>

                                        <div className="premium-disclosure-content w-full min-w-0 bg-surface-soft/60 p-4 sm:p-5">
                                    {!activeRecord || activeDetailLoading || !activeResult ? (
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
                                                ? 'Loading the saved assumptions and financial breakdown for this snapshot.'
                                                : !activeRecord
                                                    ? group.records.length > 1
                                                        ? 'This quality has multiple saved versions. Select View breakdown on the version you want to inspect; saved commercial totals remain unchanged.'
                                                        : group.currentRecipeCostPerM != null
                                                            ? 'This is a live estimate from the saved yarn recipe and current factory costs, not a historical snapshot. Set a costing quantity and choose Save Costing to preserve its full analysis.'
                                                            : canUseProduction
                                                                ? 'Open Cost Estimate, choose this saved quality, set the costing quantity, and save the result. Its analysis and production usage will then appear here.'
                                                                : 'Open Cost Estimate, choose this saved quality, set the costing quantity, and choose Save Costing. Its analysis will then appear here.'
                                                    : 'The saved commercial totals remain available in Saved Costing history. Open this version in Cost Estimate to review its saved assumptions.')}</p>
                                            {targetRecord && !activeDetailLoading && (
                                                <div className="mt-4 flex flex-wrap justify-center gap-2">
                                                    {canUseProduction ? <>
                                                        {!targetRecord.is_archived && !latest.is_archived && group.template?.is_active !== false && <Button variant="outline" size="sm" onClick={() => onOpen(targetRecord)}>{tx('Open')}</Button>}
                                                        <Button variant="outline" size="sm" onClick={() => onStartFrom(targetRecord)}><Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onExport(targetRecord)}><Eye className="h-3.5 w-3.5" /> {tx('Preview')}</Button>
                                                        {canUseProductionPipeline && isStandaloneCosting(targetRecord.record_kind) && !targetRecord.is_archived && (
                                                            <Link
                                                                prefetch={tourStep ? false : undefined}
                                                                data-costing-tour="production"
                                                                href={`/owner/production?tab=jobs&costingId=${encodeURIComponent(targetRecord.id)}`}
                                                                onClick={() => trackPlanEvent('production_cta_clicked', { source: 'saved_costing_detail' })}
                                                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-saffron/30 bg-saffron-soft px-3 text-xs font-semibold text-saffron-deep hover:bg-saffron-soft/80"
                                                            >
                                                                <Factory className="h-3.5 w-3.5" /> Start Production
                                                            </Link>
                                                        )}
                                                    </> : <>
                                                        {!targetRecord.is_archived && !latest.is_archived && group.template?.is_active !== false && <Button size="sm" onClick={() => onOpen(targetRecord)} className="rounded-lg bg-loom font-medium text-white hover:bg-loom-elevated hover:text-white"><ArrowRight className="h-3.5 w-3.5" /> {tx('Use')}</Button>}
                                                        <Button variant="outline" size="sm" onClick={() => onStartFrom(targetRecord)}><Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onExport(targetRecord)}><Download className="h-3.5 w-3.5" /> {tx('Export')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onSaveAsNewQuality(targetRecord)}><BookmarkPlus className="h-3.5 w-3.5" /> {tx('Save as separate quality')}</Button>
                                                    </>}
                                                    {!canUseProduction && canUseProductionPipeline && isStandaloneCosting(targetRecord.record_kind) && !targetRecord.is_archived && (
                                                        <Link
                                                                prefetch={tourStep ? false : undefined}
                                                                data-costing-tour="production"
                                                            href={`/owner/production?tab=jobs&costingId=${encodeURIComponent(targetRecord.id)}`}
                                                            onClick={() => trackPlanEvent('production_cta_clicked', { source: 'saved_costing_detail' })}
                                                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-saffron/30 bg-saffron-soft px-3 text-xs font-semibold text-saffron-deep hover:bg-saffron-soft/80"
                                                        >
                                                            <Factory className="h-3.5 w-3.5" /> Start Production
                                                        </Link>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className={`grid gap-4 ${canUseProduction ? 'lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]' : ''}`}>
                                            <section data-costing-tour="breakdown" className="rounded-xl border border-hairline bg-surface p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black text-ink">{tx(group.records.length > 1 ? `Saved Costing v${Number(activeRecord.version_number ?? 1)} breakdown` : 'Latest Saved Costing breakdown')}</p>
                                                        <p className="mt-1 text-xs text-subtle">Snapshot v{Number(activeRecord.version_number ?? 1)} · {formatTimestampDate(activeRecord.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                    </div>
                                                    <div data-costing-tour="reuse" className="flex flex-wrap gap-2">
                                                        {canUseProduction ? <>
                                                            {!activeRecord.is_archived && group.template?.is_active !== false && <Button variant="outline" size="sm" onClick={() => onOpen(activeRecord)} disabled={updatingId === activeRecord.id} aria-busy={updatingId === activeRecord.id}>{tx('Open')}</Button>}
                                                            <Button variant="outline" size="sm" onClick={() => onStartFrom(activeRecord)}><Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}</Button>
                                                            <Button variant="outline" size="sm" onClick={() => onExport(activeRecord)}><Eye className="h-3.5 w-3.5" /> {tx('Preview')}</Button>
                                                        </> : <>
                                                            {!activeRecord.is_archived && group.template?.is_active !== false && <Button size="sm" onClick={() => onOpen(activeRecord)} disabled={updatingId === activeRecord.id} aria-busy={updatingId === activeRecord.id} className="rounded-lg bg-loom font-medium text-white hover:bg-loom-elevated hover:text-white"><ArrowRight className="h-3.5 w-3.5" /> {tx('Use')}</Button>}
                                                            <Button variant="outline" size="sm" onClick={() => onStartFrom(activeRecord)}><Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}</Button>
                                                            <Button variant="outline" size="sm" onClick={() => onExport(activeRecord)}><Download className="h-3.5 w-3.5" /> {tx('Export')}</Button>
                                                            <Button variant="outline" size="sm" onClick={() => onSaveAsNewQuality(activeRecord)}><BookmarkPlus className="h-3.5 w-3.5" /> {tx('Save as separate quality')}</Button>
                                                        </>}
                                                        {!canUseProduction && canUseProductionPipeline && isStandaloneCosting(activeRecord.record_kind) && !activeRecord.is_archived && (
                                                            <Link
                                                                prefetch={tourStep ? false : undefined}
                                                                data-costing-tour="production"
                                                                href={`/owner/production?tab=jobs&costingId=${encodeURIComponent(activeRecord.id)}`}
                                                                onClick={() => trackPlanEvent('production_cta_clicked', { source: 'saved_costing_breakdown' })}
                                                                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-saffron/30 bg-saffron-soft px-3 text-xs font-semibold text-saffron-deep hover:bg-saffron-soft/80"
                                                            >
                                                                <Factory className="h-3.5 w-3.5" /> Start Production
                                                            </Link>
                                                        )}
                                                        <Button variant="outline" size="sm" onClick={() => onToggleArchived(activeRecord)} disabled={updatingId === activeRecord.id} aria-busy={updatingId === activeRecord.id}>
                                                            {updatingId === activeRecord.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : activeRecord.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                                            {tx(updatingId === activeRecord.id ? activeRecord.is_archived ? `Restoring ${getSavedCostingIdentity(activeRecord).label}…` : `Archiving ${getSavedCostingIdentity(activeRecord).label}…` : (activeRecord.is_archived || latest.is_archived ? 'Restore snapshot' : 'Archive snapshot'))}
                                                        </Button>
                                                    </div>
                                                </div>

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
                                                <div data-costing-tour="economics" className="mt-2 grid grid-cols-1 gap-2 rounded-lg bg-loom p-3 text-white sm:grid-cols-3">
                                                    <div><p className="text-[10px] uppercase text-surface-muted">{t('common.production_cost_per_m')}</p><p className="mt-1 font-mono text-sm font-black">₹{latestResult.productionCostPerM.toFixed(2)}/m</p></div>
                                                    <div><p className="text-[10px] uppercase text-surface-muted">{t('common.suggested_selling_price_per_m')}</p><p className="mt-1 font-mono text-sm font-black text-saffron">₹{latestResult.suggestedSellingPricePerM.toFixed(2)}/m</p></div>
                                                    <div><p className="text-[10px] uppercase text-surface-muted">Actual Margin</p><p className="mt-1 font-mono text-sm font-black text-success">{latestResult.actualMarginPct.toFixed(1)}%</p></div>
                                                </div>
                                                {getCostingStatus(activeRecord) !== 'verified' && (
                                                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-warning/25 bg-warning-soft px-3 py-3 text-xs text-warning sm:flex-row sm:items-center sm:justify-between">
                                                        <div><p className="font-bold">{tx('Saved costing needs a check')}</p><p className="mt-1">{tx(activeRecord.reconciliation_note || getCostingTrustCopy(getCostingStatus(activeRecord)))}</p></div>
                                                        <Button variant="outline" size="sm" onClick={() => onAudit(activeRecord)} disabled={auditingId === activeRecord.id} aria-busy={auditingId === activeRecord.id} className="shrink-0 border-warning/30 bg-surface text-warning hover:bg-warning-soft">
                                                            {auditingId === activeRecord.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {tx(auditingId === activeRecord.id ? 'Checking…' : 'Check saved numbers')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </section>

                                            {canUseProduction && <section data-costing-tour="production" className="rounded-xl border border-hairline bg-surface p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black text-ink">Applied production</p>
                                                        <p className="mt-1 text-xs text-subtle">Orders and market runs created from this quality&apos;s costing snapshots.</p>
                                                    </div>
                                                    <Factory className="h-5 w-5 text-subtle" />
                                                </div>
                                                {usages.length === 0 ? (
                                                    <div className="mt-4 rounded-lg border border-dashed border-hairline px-4 py-8 text-center text-xs text-subtle">This costing has not been applied to an order or market run yet.</div>
                                                ) : (
                                                    <div className="mt-4 space-y-2">
                                                        {usages.map(({ record, order }) => {
                                                            const produced = getProducedMeters(order)
                                                            const target = Number(order.total_target_meters ?? record.meters ?? 0)
                                                            const isMarketRun = Boolean(record.market_run_id || order.market_run_id || record.record_kind === 'market_run')
                                                            return (
                                                                <button key={order.id} type="button" onClick={() => onOpenUsage(record, order)} className="w-full rounded-lg border border-hairline p-3 text-left hover:border-info/40 hover:bg-info-soft/40">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-xs font-bold text-ink">{isMarketRun ? 'Market run' : 'Party order'} · {record.party_name || order.party_name || group.name}</p>
                                                                            <p className="mt-1 text-[11px] text-subtle">{produced.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m produced of {target.toLocaleString('en-IN')} m · {order.status}</p>
                                                                        </div>
                                                                        <ExternalLink className="h-4 w-4 shrink-0 text-subtle" />
                                                                    </div>
                                                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-soft">
                                                                        <div className="h-full rounded-full bg-success" style={{ width: `${target > 0 ? Math.min(100, (produced / target) * 100) : 0}%` }} />
                                                                    </div>
                                                                </button>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </section>}
                                        </div>
                                    )}

                                    {group.records.length > 0 && (
                                        <section data-costing-tour="versions" className="mt-4 rounded-xl border border-hairline bg-surface p-4">
                                            <p className="text-sm font-black text-ink">Saved Costing history</p>
                                            <p className="mt-1 text-xs text-subtle">{comparisonMode ? 'Select two versions to compare their saved commercial assumptions.' : 'Open a version to inspect the exact assumptions and economics saved at that time.'}</p>
                                            <div className="mt-3 space-y-2">
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
                                                                    ? 'premium-selected-row border-info/30 bg-info-soft/60'
                                                                    : isInspected
                                                                        ? 'border-saffron/40 bg-saffron-soft/20 shadow-sm ring-1 ring-saffron/30'
                                                                        : 'border-hairline bg-surface hover:bg-surface-soft/70'
                                                            }`}
                                                        >
                                                            <div className="flex min-w-0 items-start gap-3">
                                                                {comparisonMode && <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
                                                                    <input type="checkbox" checked={selected} onChange={() => onToggleComparison(record.id)} aria-label={`Select ${group.name} version ${Number(record.version_number ?? 1)} for comparison`} className="h-4 w-4 accent-blue-600" />
                                                                    {preparing && <Loader2 className="h-3.5 w-3.5 animate-spin text-info" aria-hidden="true" />}
                                                                </span>}
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                                        <p className="truncate text-xs font-bold text-ink" title={identity.label}>{identity.label}</p>
                                                                        {isInspected && (
                                                                            <Badge variant="outline" className="border-saffron/30 bg-saffron-soft text-[10px] font-bold text-saffron-deep">
                                                                                {tx('Active breakdown')}
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                    <p className="mt-1 truncate text-[10px] text-subtle">{record.factory_profile_updated_at ? `${factoryInputsCapturedLabel} ${formatTimestampDate(record.factory_profile_updated_at, { day: 'numeric', month: 'short', year: 'numeric' })}` : `Saved ${formatTimestampDate(record.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}`}</p>
                                                                    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-2 text-[11px] text-body">
                                                                        <span className="min-w-0 max-w-full truncate rounded-full border border-hairline bg-surface-soft px-2 py-0.5" title={contextLabel}>{contextLabel}</span>
                                                                        {costingStatus !== 'verified' && <StatusBadge status="needs_review" label={getCostingBadge(costingStatus)} />}
                                                                    </div>
                                                                    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[9px] font-bold uppercase tracking-wide text-subtle">Cost</dt>
                                                                            <dd className="mt-0.5 truncate font-mono text-xs font-semibold text-body">{formatCostingMoneyPerM(getProductionCostPerM(record))}</dd>
                                                                        </div>
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[9px] font-bold uppercase tracking-wide text-subtle">Selling price</dt>
                                                                            <dd className="mt-0.5 truncate font-mono text-xs font-bold text-saffron-deep">{formatCostingMoneyPerM(getSuggestedSellingPricePerM(record))}</dd>
                                                                        </div>
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[9px] font-bold uppercase tracking-wide text-subtle">Margin</dt>
                                                                            <dd className="mt-0.5 truncate font-mono text-xs font-bold text-success">{formatCostingPercent(getActualMarginPct(record))}</dd>
                                                                        </div>
                                                                        <div className="min-w-0 rounded-md bg-surface-soft px-2 py-1.5">
                                                                            <dt className="truncate text-[9px] font-bold uppercase tracking-wide text-subtle">Costing qty.</dt>
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
                                                                        <Button variant="ghost" size="sm" onClick={() => onToggleArchived(record)} disabled={updatingId === record.id} aria-label={`${record.is_archived ? 'Restore costing snapshot' : 'Archive costing snapshot'} ${group.name}`} className="h-8 px-2 text-xs">
                                                                            {updatingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : record.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                                                            <span className="hidden sm:inline">{updatingId === record.id ? record.is_archived ? `Restoring ${group.name}…` : `Archiving ${group.name}…` : record.is_archived ? 'Restore snapshot' : 'Archive snapshot'}</span>
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
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

export default function QuotesClient({ initialQuotes, initialTemplates, initialProfile, initialWorkers, initialStatus, orgId, userId, canUseProduction, canUseProductionPipeline, canUseQuotationWorkflow, organizationName }: { initialQuotes: QuoteRow[], initialTemplates: SavedQuality[], initialProfile?: SavedQualityFactoryProfile, initialWorkers: SavedQualityFixedWorker[], initialStatus?: string, orgId: string, userId: string, canUseProduction: boolean, canUseProductionPipeline: boolean, canUseQuotationWorkflow: boolean, organizationName: string }) {
    const { t, tx } = useTranslation()
    const { language } = useTranslation()
    const [tourStep, setTourStep] = useState<SavedCostingStep | null>(null)
    const [openQualityKey, setOpenQualityKey] = useState<string | null>(null)
    const [demoCostingDeleted, setDemoCostingDeleted] = useState(false)
    const [showCostingDeleteNudge, setShowCostingDeleteNudge] = useState(false)
    const tourSurface = costingTourSurface(tourStep)
    const tourExamples = useMemo(makeSavedCostingTourExamples, [])
    const tourExport = useMemo(makeSavedCostingTourExport, [])
    const tourGroups = useMemo(() => [{key: 'tour-preview', name: 'Tour sample', template: null, records: tourExamples, updatedAt: tourExamples[0].updated_at, currentRecipeCostPerM: null}], [tourExamples])
    const DEMO_COSTING_STORAGE_KEY = 'weavly:owner-demo-costing-deleted'

    useEffect(() => {
        try {
            if (typeof window !== 'undefined' && localStorage.getItem(DEMO_COSTING_STORAGE_KEY) === 'true') {
                setDemoCostingDeleted(true)
            }
        } catch {}
    }, [])

    const handleTourStepChange = useCallback((nextStep: SavedCostingStep | null) => {
        if (nextStep === 'finish') {
            setShowCostingDeleteNudge(true)
        }
        setTourStep(prev => {
            if (prev !== null && nextStep === null) {
                setShowCostingDeleteNudge(true)
            }
            return nextStep
        })
    }, [])

    const handleDeleteDemoCosting = useCallback(() => {
        setDemoCostingDeleted(true)
        setShowCostingDeleteNudge(false)
        setOpenQualityKey(current => current === 'tour-preview' ? null : current)
        try {
            localStorage.setItem(DEMO_COSTING_STORAGE_KEY, 'true')
        } catch {}
    }, [])

    const router = useRouter()
    const [quotes, setQuotes] = useState<QuoteRow[]>(initialQuotes)
    const isDemoCostingActive = (!demoCostingDeleted && quotes.length === 0 && initialTemplates.length === 0) || tourStep !== null
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all')
    const [quoteToConvert, setQuoteToConvert] = useState<QuoteRow | null>(null)
    const [quoteToAccept, setQuoteToAccept] = useState<QuoteRow | null>(null)
    const [quoteToRestore, setQuoteToRestore] = useState<QuoteRow | null>(null)
    const [restoreMode, setRestoreMode] = useState<'edit' | 'duplicate'>('edit')
    const [existingDraftForRestore, setExistingDraftForRestore] = useState<EstimatorAutosaveData<QuoteDraftState> | null>(null)
    const [convertMeters, setConvertMeters] = useState('')
    const [convertDeadline, setConvertDeadline] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
    const [convertNotes, setConvertNotes] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [costingSort, setCostingSort] = useState<SavedCostingSort>('recent')
    const [marginFilter, setMarginFilter] = useState<SavedCostingMarginFilter>('all')
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
    const [comparisonMode, setComparisonMode] = useState(false)
    const [selectedCostingIds, setSelectedCostingIds] = useState<string[]>([])
    const [showComparison, setShowComparison] = useState(false)
    const [quoteToExport, setQuoteToExport] = useState<QuoteRow | null>(null)
    const [quoteHistoryFor, setQuoteHistoryFor] = useState<QuoteRow | null>(null)
    const [quoteHistoryRows, setQuoteHistoryRows] = useState<QuoteStatusHistoryRow[]>([])
    const [quoteHistoryLoading, setQuoteHistoryLoading] = useState(false)
    const [quoteHistoryError, setQuoteHistoryError] = useState<string | null>(null)
    const [quoteToArchive, setQuoteToArchive] = useState<QuoteRow | null>(null)
    const [archiveAction, setArchiveAction] = useState<'archive' | 'restore'>('archive')
    const [detailLoadingId, setDetailLoadingId] = useState<string | null>(null)
    const [showArchived, setShowArchived] = useState(false)
    const showQualityLibrary = !canUseQuotationWorkflow || filterStatus === 'costings'

    const filteredQuotes = useMemo(() => {
        const library = filterAndSortSavedCostings(quotes.filter(quote => (
            Boolean(quote.is_archived) === showArchived
        )), {
            query: searchQuery,
            sort: costingSort,
            margin: marginFilter,
            favorites: showFavoritesOnly,
        })
        if (!canUseProduction || !canUseQuotationWorkflow) return library.filter(quote => isStandaloneCosting(quote.record_kind))
        if (filterStatus === 'costings') return library.filter(quote => isStandaloneCosting(quote.record_kind))
        if (filterStatus === 'all') return library
        return library.filter(quote => canUseQuotationLifecycle(quote.record_kind, canUseProduction) && quote.status === filterStatus)
    },
    [canUseProduction, canUseQuotationWorkflow, costingSort, filterStatus, marginFilter, quotes, searchQuery, showArchived, showFavoritesOnly])
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
            if (canUseQuotationWorkflow && filterStatus === 'costings' && !isStandaloneCosting(item.record_kind)) return false
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
                currentRecipeCostPerM: group.template && group.records.length === 0
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
    }, [canUseQuotationWorkflow, filterStatus, costingSort, initialProfile, initialTemplates, initialWorkers, marginFilter, quotes, searchQuery, showArchived, showFavoritesOnly])
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
                { label: 'Actual margin', value: comparison.margin.actualPct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.margin.actualPct) },
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

    const openAppliedProduction = (quote: QuoteRow, order: QuoteLinkedOrder) => {
        const marketRunId = quote.market_run_id || order.market_run_id
        router.push(marketRunId ? `/owner/market-runs/${marketRunId}` : `/owner/orders?orderId=${order.id}`)
    }

    const handleStatusChange = async (id: string, newStatus: 'draft' | 'sent' | 'accepted' | 'rejected') => {
        const quote = quotes.find(item => item.id === id)
        if (!quote) return false
        setUpdatingId(id)
        const res = await updateQuoteStatus(id, newStatus, quote.updated_at)
        setUpdatingId(null)
        if (res.error) {
            toast.error(tx(userFacingError(res.error, 'The quotation status could not be updated. Try again.')))
            return false
        } else {
            toast.success(tx(`Quotation marked as ${STATUS_CONFIG[newStatus].label}`), {
                description: tx(`Status updated ${formatQuoteTimestamp(res.data?.updated_at)}.`),
            })
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...res.data, status: newStatus } : q))
            setQuoteToExport(current => current?.id === id ? { ...current, ...res.data, status: newStatus } : current)
            return true
        }
    }

    const openQuoteHistory = async (quote: QuoteRow) => {
        setQuoteHistoryFor(quote)
        setQuoteHistoryRows([])
        setQuoteHistoryError(null)
        setQuoteHistoryLoading(true)
        try {
            const result = await getQuoteStatusHistory(quote.id)
            if (result.error) {
                setQuoteHistoryError(userFacingError(result.error, 'Quotation history could not be loaded.'))
            } else {
                setQuoteHistoryRows(result.data as QuoteStatusHistoryRow[])
            }
        } catch (error) {
            setQuoteHistoryError(userFacingError(error, 'Quotation history could not be loaded.'))
        } finally {
            setQuoteHistoryLoading(false)
        }
    }

    const openConvertDialog = (quote: QuoteRow) => {
        setQuoteToConvert(quote)
        const suggestedMeters = Number(quote.meters ?? 0)
        setConvertMeters(suggestedMeters > 0 ? String(suggestedMeters) : '')
        setConvertDeadline(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
        setConvertNotes('')
    }

    const handleConvertAcceptedQuote = async () => {
        if (!quoteToConvert) return

        const meters = Number(convertMeters)
        if (!Number.isFinite(meters) || meters <= 0) {
            toast.error(tx('Enter a valid order quantity before creating the active order'))
            return
        }

        setUpdatingId(quoteToConvert.id)
        const res = await convertAcceptedQuoteToOrder({
            quoteId: quoteToConvert.id,
            total_target_meters: meters,
            deadline: convertDeadline,
            notes: convertNotes.trim() || undefined,
        })
        setUpdatingId(null)

        if ('error' in res) {
            toast.error(tx(userFacingError(res.error, 'The accepted quotation could not be converted into an order. Try again.')))
            return
        }

        toast.success(tx('Accepted quote converted into an active order'))
        setQuoteToConvert(null)
        router.push(`/owner/orders?orderId=${res.orderId}`)
    }

    const restoreQuoteToEstimator = (quote: QuoteRow, mode: 'edit' | 'duplicate' = 'edit') => {
        try {
            const draftKey = getEstimatorDraftStorageKey(orgId, userId)
            const linkedOrder = getLinkedOrder(quote)
            const isDuplicate = mode === 'duplicate'
            const isCosting = isStandaloneCosting(quote.record_kind)
            const createsQuotationFromCosting = canUseQuotationWorkflow && isDuplicate && isCosting
            const startsNewBaseQuality = isDuplicate && isCosting && !canUseQuotationWorkflow
            const restoredState = buildDraftStateFromQuote(quote)
            const newDraft = createEstimatorDraft<QuoteDraftState>({
                state: restoredState,
                partyName: createsQuotationFromCosting ? '' : quote.party_name || '',
                // A Base starting point is intentionally detached from both
                // the old snapshot and its Saved Quality. Requiring a fresh
                // quality name prevents Rajesh from accidentally saving a
                // different construction into the old quality's history.
                qualityLabel: startsNewBaseQuality
                    ? ''
                    : isDuplicate && canUseQuotationWorkflow && !isCosting
                        ? `${quote.quality_label || 'Untitled'} Copy`
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
                sourceRecordKind: createsQuotationFromCosting
                    ? undefined
                    : quote.record_kind ?? (canUseQuotationWorkflow ? 'quotation' : 'costing'),
                templateId: startsNewBaseQuality ? undefined : quote.template_id ?? undefined,
                restoreOnEstimatorEntry: true,
            }, {
                writerId: 'quotes-history',
            })
            localStorage.setItem(draftKey, JSON.stringify(newDraft))
            setQuoteToRestore(null)
            setExistingDraftForRestore(null)
            toast.success(tx(createsQuotationFromCosting
                ? 'Costing loaded as a new customer quotation draft'
                : isDuplicate
                    ? (startsNewBaseQuality ? 'Starting point loaded. Enter a new Saved Quality name before saving.' : canUseQuotationWorkflow ? 'Quotation copied into a new Cost Estimate draft' : 'Costing loaded as a starting point')
                    : isCosting ? 'Costing snapshot restored' : 'Quotation snapshot restored'))
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
            toast.error(tx('Failed to restore snapshot'))
            console.error(e)
        }
    }

    const openQuoteExport = async (quote: QuoteRow) => {
        const detailedQuote = await ensureQuoteDetail(quote)
        if (detailedQuote) setQuoteToExport(detailedQuote)
    }

    const handleLibraryState = async (quote: QuoteRow, changes: { isArchived?: boolean; isFavorite?: boolean }) => {
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
            const recordType = quote.record_kind === 'quotation' ? 'Quotation' : 'Costing snapshot'
            toast.success(tx(changes.isArchived === true
                ? `${recordType === 'Costing snapshot' ? 'Costing snapshot archived' : 'Quotation archived'} · “${recordLabel}”`
                : changes.isArchived === false
                    ? `${recordType === 'Costing snapshot' ? 'Costing snapshot restored' : 'Quotation restored'} · “${recordLabel}”`
                    : changes.isFavorite
                        ? 'Added to favourites'
                        : 'Removed from favourites'))
        } catch (error) {
            toast.error(tx(userFacingError(error, 'Saved costing could not be updated. Try again.')))
            console.error(error)
        } finally {
            setUpdatingId(null)
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
                toast.success(tx('Saved costing checked. Its canonical result is consistent.'))
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

    return (
        <>
            <SavedCostingsTutorial step={tourStep} onStepChange={handleTourStepChange} production={canUseProductionPipeline} quotations={canUseQuotationWorkflow} userId={userId} orgId={orgId} />
            <div className="premium-route-enter max-w-6xl mx-auto space-y-6">
            <RouteMilestones route="/owner/quotes" shellVisible primaryUsable secondaryReady />
            <div className="min-[1540px]:hidden">
                <ArchivePolicyNotice />
            </div>
            {detailLoadingId && <p role="status" aria-live="polite" className="premium-status-enter rounded-lg border border-info/25 bg-info-soft px-3 py-2 text-xs font-semibold text-info">{tx('Selection saved. Loading the complete snapshot for comparison…')}</p>}
            <PageHeader
                icon={History}
                title={canUseQuotationWorkflow ? t('common.costings_quotations_title') : t('common.saved_costings_title')}
                description={canUseQuotationWorkflow ? t('common.costings_quotations_description') : t('common.saved_costings_description')}
                actions={(
                    <Button
                        onClick={() => router.push('/owner/estimator')}
                        className="h-10 w-full sm:w-auto rounded-xl bg-loom px-4 font-medium text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] focus-visible:ring-saffron"
                    >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                        <span>{canUseQuotationWorkflow ? t('common.new_estimate') : t('common.new_costing')}</span>
                    </Button>
                )}
            />
            {showCostingDeleteNudge && !demoCostingDeleted && quotes.length === 0 && (
                <div
                    role="status"
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3.5 text-sm text-amber-950 shadow-xs animate-in fade-in-0 duration-200"
                >
                    <div className="flex items-center gap-2.5">
                        <Sparkles className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                        <div>
                            <p className="font-semibold text-amber-900">{tx('Guided tour completed!')}</p>
                            <p className="text-xs text-amber-800/90">{tx('Explore exports with this sample costing, or delete it whenever you are ready to create your own costings.')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-300 bg-white text-xs font-semibold text-amber-900 hover:bg-amber-100/70"
                            onClick={handleDeleteDemoCosting}
                        >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5 text-amber-700" aria-hidden="true" />
                            {tx('Delete sample costing')}
                        </Button>
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-xs text-amber-700 hover:text-amber-900"
                            onClick={() => setShowCostingDeleteNudge(false)}
                        >
                            {tx('Dismiss')}
                        </Button>
                    </div>
                </div>
            )}
            {canUseQuotationWorkflow && <Toolbar className="w-full overflow-x-auto rounded-2xl border border-hairline bg-surface p-1.5 shadow-xs">
                    {['all', 'costings', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                setFilterStatus(s)
                                router.replace(`/owner/quotes${s !== 'all' ? `?status=${s}` : ''}`)
                            }}
                            className={`min-h-10 px-4 flex items-center justify-center rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors ${
                                filterStatus === s
                                    ? 'bg-loom text-white shadow-xs'
                                    : 'text-body hover:bg-surface-soft hover:text-ink'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
            </Toolbar>}

            <Toolbar data-costing-tour="filters" className="overflow-visible rounded-2xl border border-hairline bg-surface shadow-xs p-4">
                    <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(260px,1fr)_auto_auto_auto_auto]">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle/60" />
                            <Label htmlFor="saved-costings-search" className="sr-only">{canUseQuotationWorkflow ? t('common.search_party_quality_costing') : t('common.search_quality_costing')}</Label>
                            <Input
                                id="saved-costings-search"
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder="Search saved records…"
                                aria-label={canUseQuotationWorkflow ? 'Search saved qualities, costings, quotations, and party names' : 'Search saved qualities and costings'}
                                className="h-10 sm:h-11 w-full min-w-0 rounded-xl border-hairline bg-surface pl-10 pr-4 text-sm text-ink placeholder:text-subtle/50 focus-visible:border-saffron focus-visible:ring-saffron"
                            />
                        </div>
                        <details className="group relative z-20">
                            <summary className="flex h-10 sm:h-11 cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-hairline bg-surface px-3.5 text-sm font-semibold text-ink hover:bg-surface-soft [&::-webkit-details-marker]:hidden">
                                Filters{marginFilter !== 'all' ? ' · 1' : ''}
                                <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 text-subtle/70" />
                            </summary>
                            <div className="absolute right-0 mt-2 grid w-64 gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-xs">
                                <Label htmlFor="saved-costings-sort" className="text-xs font-semibold text-body">Sort by</Label>
                                <select id="saved-costings-sort" value={costingSort} onChange={event => setCostingSort(event.target.value as SavedCostingSort)} className="h-10 rounded-xl border border-hairline bg-surface px-3 text-sm font-medium text-ink">
                                    <option value="recent">Recently updated</option><option value="oldest">Oldest updated</option><option value="margin_desc">Highest margin</option><option value="cost_asc">Lowest production cost</option>
                                </select>
                                <Label htmlFor="saved-costings-margin" className="text-xs font-semibold text-body">Margin</Label>
                                <select id="saved-costings-margin" value={marginFilter} onChange={event => setMarginFilter(event.target.value as SavedCostingMarginFilter)} className="h-10 rounded-xl border border-hairline bg-surface px-3 text-sm font-medium text-ink">
                                    <option value="all">All margins</option><option value="negative">Negative margin</option><option value="under_10">Under 10%</option><option value="10_to_20">10–20%</option><option value="over_20">Over 20%</option>
                                </select>
                            </div>
                        </details>
                        <Button
                            variant={comparisonMode ? 'secondary' : 'outline'}
                            onClick={() => { setComparisonMode(current => !current); setSelectedCostingIds([]) }}
                            className="h-10 sm:h-11 rounded-xl"
                            aria-pressed={comparisonMode}
                        >
                            <GitCompareArrows className="h-4 w-4" /> {comparisonMode ? 'Done' : 'Compare'}
                        </Button>
                        <Button
                            variant={showFavoritesOnly ? 'secondary' : 'outline'}
                            onClick={() => { setOpenQualityKey(null); setShowFavoritesOnly(current => !current); setSelectedCostingIds([]) }}
                            className="h-10 sm:h-11 rounded-xl"
                            aria-pressed={showFavoritesOnly}
                        >
                            <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} /> {showFavoritesOnly ? 'All costings' : 'Favourites'}
                        </Button>
                        <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => { setOpenQualityKey(null); setShowArchived(current => !current); setSelectedCostingIds([]) }} className="h-10 sm:h-11 rounded-xl">
                            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {showArchived ? t('common.active') : t('common.archived')}
                        </Button>
                    </div>
                    {comparisonMode && selectedCostings.length === 2 ? (
                        <div className="premium-status-enter mt-3 flex flex-col gap-3 rounded-lg border border-info/25 bg-info-soft/60 p-3 sm:flex-row sm:items-center sm:justify-between" role="status" aria-live="polite" aria-busy={Boolean(detailLoadingId)}>
                            <div>
                                <p className="text-xs font-bold text-info">Two costings selected</p>
                                <p className="mt-1 text-xs leading-relaxed text-body">{detailLoadingId ? 'Preparing the complete saved numbers…' : 'Compare them when you need to explain a change in cost, selling price, margin, or quantity.'}</p>
                            </div>
                            <div className="flex shrink-0 flex-wrap gap-2">
                                <Button variant="secondary" onClick={() => setShowComparison(true)} className="h-9" disabled={Boolean(detailLoadingId)}>
                                    {detailLoadingId ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitCompareArrows className="h-4 w-4" />} {detailLoadingId ? 'Preparing…' : t('common.compare_costings')}
                                </Button>
                                <Button variant="ghost" onClick={() => setSelectedCostingIds([])} className="h-9 text-body">Clear selection</Button>
                            </div>
                        </div>
                    ) : comparisonMode ? (
                        <p id="compare-costings-help" className="mt-2 text-xs font-medium text-body">
                            {selectedCostings.length === 1
                                ? 'One costing selected. Select one more if you want to compare.'
                                : 'Compare Costings is optional. Select two snapshots when you need to understand a change.'}
                        </p>
                    ) : null}
                    <p className="mt-3 text-xs font-medium text-body">
                        {isDemoCostingActive && quotes.length === 0
                            ? (searchQuery.trim() && !tourExamples[0]?.quality_label?.toLowerCase().includes(searchQuery.trim().toLowerCase()) && !'tour sample'.includes(searchQuery.trim().toLowerCase()) ? '0 qualities' : '1 sample quality')
                            : showQualityLibrary
                                ? `${qualityGroups.length} ${showArchived ? 'archived ' : ''}${qualityGroups.length === 1 ? 'quality' : 'qualities'}`
                                : `${filteredQuotes.length} ${showArchived ? 'archived ' : ''}${filteredQuotes.length === 1 ? 'record' : 'records'}`}
                    </p>
                </Toolbar>

            {tourStep ? (
                <div data-costing-tour="sample" className="space-y-3">
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold" data-i18n-skip="true" lang={language}>{savedCostingsTutorialCopy[language].sample}</p>
                    <SavedQualityLibraryView
                        groups={tourGroups} canUseProduction={canUseProduction} canUseProductionPipeline={canUseProductionPipeline}
                        openKey={tourSurface === 'library' ? 'tour-preview' : null}
                        tourStep={tourStep} comparisonMode={tourStep === 'compareSelect'}
                        selectedCostingIds={tourStep === 'compareSelect' ? tourExamples.map(row => row.id) : []}
                        updatingId={null} detailLoadingId={null} auditingId={null}
                        onOpenDetails={() => {}} onCloseDetails={() => {}} onToggleComparison={() => {}}
                        onOpen={() => {}} onStartFrom={() => {}} onSaveAsNewQuality={() => {}} onExport={() => {}}
                        onAudit={() => {}} onToggleFavorite={() => {}} onToggleArchived={() => {}} onOpenUsage={() => {}}
                        factoryInputsCapturedLabel={tx('Factory inputs captured')}
                    />
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
                        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold" data-i18n-skip="true" lang={language}>{savedCostingsTutorialCopy[language].sample}</p>
                        <SavedQualityLibraryView
                            groups={tourGroups}
                            canUseProduction={canUseProduction}
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
                            onAudit={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            auditingId={updatingId}
                            onToggleFavorite={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            onToggleArchived={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            onOpenUsage={() => { toast.info(tx('This is a sample costing for exploration.')) }}
                            onEnsureDetail={ensureQuoteDetail}
                            factoryInputsCapturedLabel={t('estimator.sprint1.baseline_captured')}
                        />
                    </div>
                )
            ) : (
            <div>
            {(showQualityLibrary ? qualityGroups.length === 0 : filteredQuotes.length === 0) ? (
                <EmptyState
                    icon={FileText}
                    title={searchQuery.trim()
                        ? `No saved records match “${searchQuery.trim()}”.`
                        : canUseQuotationWorkflow ? t('common.no_costings_quotations') : t('common.no_saved_qualities_costings')}
                    description={searchQuery.trim()
                        ? 'Try a quality name, party name, quotation reference, or clear the search.'
                        : showArchived
                            ? 'No archived records are showing. Switch to Active or save a costing first.'
                            : filterStatus === 'all'
                                ? (canUseQuotationWorkflow ? t('common.no_costings_quotations_yet') : t('common.save_quality_or_cost_estimate'))
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
                            {canUseQuotationWorkflow && filterStatus !== 'all' && (
                                <Button variant="ghost" onClick={() => setFilterStatus('all')}>
                                    {t('common.clear_filters')}
                                </Button>
                            )}
                        </div>
                    )}
                />
            ) : showQualityLibrary ? (
                <SavedQualityLibraryView
                    groups={qualityGroups}
                    canUseProduction={canUseProduction}
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
                    onOpenUsage={(quote, order) => { setOpenQualityKey(null); openAppliedProduction(quote, order) }}
                    onEnsureDetail={ensureQuoteDetail}
                    factoryInputsCapturedLabel={t('estimator.sprint1.baseline_captured')}
                />
            ) : !canUseProduction || !canUseQuotationWorkflow ? (
                <div>
                    <div className="hidden overflow-hidden rounded-xl border border-hairline bg-surface shadow-[var(--shadow-card)] md:block">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] border-collapse text-left">
                            <thead className="border-b border-hairline bg-surface-soft text-[11px] font-bold uppercase tracking-wide text-subtle">
                                <tr>
                                    <th className="w-12 px-4 py-3"><span className="sr-only">Compare</span></th>
                                    <th className="px-4 py-3">Quality</th>
                                    <th className="px-4 py-3">{t('common.production_cost_per_m')}</th>
                                    <th className="px-4 py-3">{t('common.suggested_selling_price')}</th>
                                    <th className="px-4 py-3">{t('common.margin')}</th>
                                    <th className="px-4 py-3">Quantity</th>
                                    <th className="px-4 py-3">Updated</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-hairline">
                                {filteredQuotes.map(quote => {
                                    const selected = selectedCostingIds.includes(quote.id)
                                    const metrics = getSavedCostingMetrics(quote)
                                    const previousVersion = getPreviousCostingVersion(quote, quotes)
                                    const costMovement = getProductionCostMovement(quote, previousVersion)
                                    return (
                                        <tr key={quote.id} className={selected ? 'bg-info-soft/60' : 'hover:bg-surface-soft/70'}>
                                            <td className="px-4 py-4 align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleCostingSelection(quote.id)}
                                                    aria-label={`Select ${quote.quality_label || 'Untitled costing'} for comparison`}
                                                    className="h-4 w-4 rounded border-hairline accent-saffron"
                                                />
                                            </td>
                                            <td className="max-w-[240px] px-4 py-4">
                                                <p className="truncate text-sm font-bold text-ink" aria-label={getLegacyVersionLabel(quote)} title={getSavedCostingIdentity(quote).label}>{getSavedCostingIdentity(quote).label}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                                                    <span>Saved {formatTimestampDate(quote.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    {getCostingStatus(quote) !== 'verified' && <StatusBadge status="needs_review" label={getCostingBadge(getCostingStatus(quote))} />}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-mono text-sm font-semibold text-body">{formatCostingMoneyPerM(getProductionCostPerM(quote))}</p>
                                                {costMovement !== null && (
                                                    <p className={`mt-1 text-[11px] font-semibold ${costMovement > 0 ? 'text-warning' : costMovement < 0 ? 'text-success' : 'text-subtle'}`}>
                                                        {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-sm font-bold text-saffron-deep">{formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)}</td>
                                            <td className={`px-4 py-4 font-mono text-sm font-bold ${(metrics.actualMarginPct ?? 0) < 0 ? 'text-risk' : 'text-success'}`}>
                                                {formatCostingPercent(metrics.actualMarginPct)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-body">{Number(quote.meters || 0).toLocaleString('en-IN')} m</td>
                                            <td className="px-4 py-4 text-xs font-medium text-subtle">{formatSuratDateTime(quote.updated_at)}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex justify-end gap-1">
                                                    {!quote.is_archived && <Button variant="ghost" size="sm" onClick={() => handleRestore(quote, 'edit')} className="h-9 text-xs font-semibold text-info">{tx('Open')}</Button>}
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestore(quote, 'duplicate')} className="h-9 text-xs font-semibold">
                                                        <Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => { void openQuoteExport(quote) }} className="h-9 text-xs font-semibold">
                                                        <Eye className="h-3.5 w-3.5" /> {tx('Preview')}
                                                    </Button>
                                                    {getCostingStatus(quote) !== 'verified' && <Button variant="ghost" size="sm" onClick={() => { void auditQuote(quote) }} disabled={updatingId === quote.id} className="h-9 text-xs font-semibold text-warning">
                                                        {updatingId === quote.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {tx(updatingId === quote.id ? 'Checking…' : 'Check saved numbers')}
                                                    </Button>}
                                                    <Button variant="ghost" size="icon" onClick={() => handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className={quote.is_favorite ? 'h-9 w-9 text-warning' : 'h-9 w-9 text-subtle'} aria-label={quote.is_favorite ? `Remove ${quote.quality_label || 'costing'} from favourites` : `Add ${quote.quality_label || 'costing'} to favourites`}>
                                                        <Star className="h-4 w-4" fill={quote.is_favorite ? 'currentColor' : 'none'} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => requestArchiveState(quote)} disabled={updatingId === quote.id} className="h-9 w-9 text-subtle" aria-label={quote.is_archived ? `Restore costing snapshot ${quote.quality_label || 'costing'}` : `Archive costing snapshot ${quote.quality_label || 'costing'}`}>
                                                        {updatingId === quote.id ? <Loader2 className="h-4 w-4 animate-spin" /> : quote.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                      </div>
                    </div>
                    <div className="space-y-3 md:hidden">
                        {filteredQuotes.map(quote => {
                            const selected = selectedCostingIds.includes(quote.id)
                            const metrics = getSavedCostingMetrics(quote)
                            const quality = quote.quality_label || 'Untitled costing'
                            const previousVersion = getPreviousCostingVersion(quote, quotes)
                            const costMovement = getProductionCostMovement(quote, previousVersion)
                            return (
                                <Card key={quote.id} className={selected ? 'border-info/30 bg-info-soft/40 shadow-[var(--shadow-card)]' : 'border-hairline bg-surface shadow-[var(--shadow-card)]'}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggleCostingSelection(quote.id)}
                                                aria-label={`Select ${quality} for comparison`}
                                                className="mt-1 h-4 w-4 shrink-0 rounded border-hairline accent-saffron"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-ink" aria-label={getLegacyVersionLabel(quote)} title={getSavedCostingIdentity(quote).label}>{getSavedCostingIdentity(quote).label}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-subtle">
                                                    <span>Updated {formatSuratDateTime(quote.updated_at)}</span>
                                                    {getCostingStatus(quote) !== 'verified' && <StatusBadge status="needs_review" label={getCostingBadge(getCostingStatus(quote))} />}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface-soft p-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{t('common.production_cost_per_m')}</p>
                                                <p className="mt-1 font-mono text-sm font-bold text-ink">{formatCostingMoneyPerM(getProductionCostPerM(quote))}</p>
                                                {costMovement !== null && (
                                                    <p className={`mt-1 text-[10px] font-semibold ${costMovement > 0 ? 'text-warning' : costMovement < 0 ? 'text-success' : 'text-subtle'}`}>
                                                        {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{t('common.suggested_selling_price_per_m')}</p>
                                                <p className="mt-1 font-mono text-sm font-bold text-saffron-deep">{formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{t('common.margin')}</p>
                                                <p className={`mt-1 font-mono text-sm font-bold ${(metrics.actualMarginPct ?? 0) < 0 ? 'text-risk' : 'text-success'}`}>{formatCostingPercent(metrics.actualMarginPct)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">Quantity</p>
                                                <p className="mt-1 text-sm font-semibold text-body">{Number(quote.meters || 0).toLocaleString('en-IN')} m</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                            {!quote.is_archived && <Button variant="outline" size="sm" onClick={() => handleRestore(quote, 'edit')} className="h-10 text-xs font-semibold text-info">Open</Button>}
                                            <Button variant="outline" size="sm" onClick={() => handleRestore(quote, 'duplicate')} aria-label="Duplicate costing" className="h-10 text-xs font-semibold">
                                                <Copy className="h-3.5 w-3.5" /> {tx('Duplicate')}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => { void openQuoteExport(quote) }} className="h-10 text-xs font-semibold">
                                                <Eye className="h-3.5 w-3.5" /> {tx('Preview')}
                                            </Button>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className={quote.is_favorite ? 'h-9 text-xs text-warning' : 'h-9 text-xs text-body'}>
                                                <Star className="h-3.5 w-3.5" fill={quote.is_favorite ? 'currentColor' : 'none'} /> {tx(quote.is_favorite ? 'Favourited' : 'Favourite')}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => requestArchiveState(quote)} disabled={updatingId === quote.id} className="h-9 text-xs text-body" aria-label={`${quote.is_archived ? 'Restore costing snapshot' : 'Archive costing snapshot'} ${quote.quality_label || 'costing'}`}>
                                                {updatingId === quote.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : quote.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} {tx(updatingId === quote.id ? quote.is_archived ? `Restoring ${quote.quality_label || 'costing'}…` : `Archiving ${quote.quality_label || 'costing'}…` : quote.is_archived ? 'Restore snapshot' : 'Archive snapshot')}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredQuotes.map(quote => {
                        const linkedOrder = getLinkedOrder(quote)
                        const metrics = getSavedCostingMetrics(quote)
                        const isCosting = isStandaloneCosting(quote.record_kind)
                        const hasQuotationLifecycle = canUseQuotationLifecycle(quote.record_kind, canUseQuotationWorkflow)
                        const canCreateOrder = hasQuotationLifecycle && quote.status === 'accepted' && !linkedOrder
                        const previousVersion = getPreviousCostingVersion(quote, quotes)
                        const costMovement = getProductionCostMovement(quote, previousVersion)

                        return (
                            <Card key={quote.id} className="group relative border-hairline shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-panel)]">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1 w-full min-w-0 pr-2">
                                            <h3 className="truncate text-lg font-black tracking-tight text-ink" title={isCosting ? (quote.quality_label || 'Untitled costing') : (quote.party_name || '')}>
                                                {isCosting ? (quote.quality_label || 'Untitled costing') : quote.party_name}
                                            </h3>
                                            <p className="truncate text-xs font-bold uppercase leading-none tracking-widest text-subtle">
                                                {isCosting ? `Saved Costing · v${Number(quote.version_number ?? 1)}` : quote.quality_label}
                                            </p>
                                            {hasQuotationLifecycle && <p className="text-[11px] font-medium text-subtle">Status updated {formatQuoteTimestamp(quote.updated_at)}</p>}
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-1">
                                            <Badge variant="outline" className={`${isCosting ? 'border-saffron/25 bg-saffron-soft text-saffron-deep' : STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG]?.color} capitalize font-bold`}>
                                                {isCosting ? (quote.id === updatingId ? 'Updating' : 'Saved Costing') : STATUS_CONFIG[quote.status]?.label ?? quote.status}
                                            </Badge>
                                            {getCostingStatus(quote) !== 'verified' && <StatusBadge status="needs_review" label={getCostingBadge(getCostingStatus(quote))} />}
                                        </div>
                                    </div>

                                    {hasQuotationLifecycle && (
                                        <div className="mb-4 rounded-xl border border-info/25 bg-info-soft/60 p-3 text-[11px] text-body">
                                            <p className="font-bold uppercase tracking-wide text-info">Quotation ledger</p>
                                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                                                <p><span className="font-semibold text-subtle">Identifier:</span> {quote.quotation_reference || `QT-${quote.id.slice(0, 8).toUpperCase()}`}</p>
                                                <p><span className="font-semibold text-subtle">Customer:</span> {quote.party_name || 'Not recorded'}</p>
                                                <p><span className="font-semibold text-subtle">Created:</span> {formatQuoteTimestamp(quote.created_at)}</p>
                                                <p><span className="font-semibold text-subtle">Valid until:</span> {quote.quotation_valid_until ? formatDateOnly(quote.quotation_valid_until, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
                                                <p><span className="font-semibold text-subtle">Price basis:</span> {formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)} · {Number(quote.meters || 0).toLocaleString('en-IN')} m</p>
                                                <p><span className="font-semibold text-subtle">Quoted amount:</span> {formatQuotationAmount(metrics.suggestedSellingPricePerM, quote.meters)}</p>
                                                <p><span className="font-semibold text-subtle">Sent:</span> {formatQuoteTimestamp(quote.sent_at)}</p>
                                            </div>
                                            <p className="mt-2 font-medium text-subtle">{getQuotationNextAction(quote.status)}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-subtle">{isCosting ? t('common.suggested_selling_price_per_m') : t('common.quotation_price')}</p>
                                            <p className="font-mono text-base font-black text-saffron-deep">{formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-subtle">{t('common.margin')}</p>
                                            <p className={`font-mono text-base font-black ${(metrics.actualMarginPct ?? 0) < 0 ? 'text-risk' : 'text-success'}`}>
                                                {formatCostingPercent(metrics.actualMarginPct)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-subtle">{t('common.production_cost_per_m')}</p>
                                            <p className="mt-0.5 font-mono text-xs font-bold text-body">{formatCostingMoneyPerM(getProductionCostPerM(quote))}</p>
                                            {isCosting && costMovement != null && (
                                                <p className={`mt-1 text-[10px] font-bold ${costMovement > 0 ? 'text-risk' : costMovement < 0 ? 'text-success' : 'text-subtle'}`}>
                                                    {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold uppercase tracking-wider text-subtle">{t('common.date')}</p>
                                            <p className="mt-0.5 text-xs font-bold text-body">{formatTimestampDate(quote.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto space-y-3 border-t border-hairline pt-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1">
                                                {linkedOrder && (
                                                    <Badge variant="outline" className="border-success/25 bg-success-soft font-bold text-success">
                                                        Order #{linkedOrder.id.split('-')[0]}
                                                        {linkedOrder.status === 'completed' && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="ml-auto flex flex-wrap justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    className="h-11 px-3 text-xs font-bold text-info hover:bg-info-soft hover:text-info lg:h-7 lg:px-2"
                                                    onClick={() => handleRestore(quote, 'edit')}
                                                    disabled={quote.is_archived}
                                                >
                                                    {quote.is_archived ? 'Archived · restore to edit' : isCosting ? t('common.open_and_save_new_version') : ((quote.status === 'draft' || quote.status === 'sent') ? 'Edit' : 'Re-estimate')}
                                                    <ArrowRight className="h-4 w-4 lg:h-3 lg:w-3 ml-1" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-11 px-3 text-xs font-bold text-body hover:bg-surface-soft hover:text-ink lg:h-7 lg:px-2"
                                                    onClick={() => handleRestore(quote, 'duplicate')}
                                                >
                                                    <Copy className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
                                                    {isCosting ? (canUseQuotationWorkflow ? t('common.prepare_quotation') : t('common.use_as_starting_point')) : t('common.duplicate')}
                                                </Button>
                                                <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-body lg:h-7 lg:px-2" onClick={() => { void openQuoteExport(quote) }}>
                                                    <Eye className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> {t('common.preview')}
                                                </Button>
                                                {hasQuotationLifecycle && <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-body hover:bg-surface-soft hover:text-ink lg:h-7 lg:px-2" onClick={() => { void openQuoteHistory(quote) }}>
                                                    <History className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> History
                                                </Button>}
                                                {getCostingStatus(quote) !== 'verified' && <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-warning lg:h-7 lg:px-2" onClick={() => { void auditQuote(quote) }} disabled={updatingId === quote.id}>
                                                    {updatingId === quote.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin lg:h-3 lg:w-3" /> : <CheckCircle2 className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />} {updatingId === quote.id ? 'Checking…' : 'Check saved numbers'}
                                                </Button>}
                                                <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-body lg:h-7 lg:px-2" onClick={() => toggleCostingSelection(quote.id)}>
                                                    <GitCompareArrows className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> {selectedCostingIds.includes(quote.id) ? 'Selected' : t('common.compare')}
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={quote.is_favorite ? `Remove ${quote.quality_label || 'record'} from favourites` : `Add ${quote.quality_label || 'record'} to favourites`} onClick={() => void handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className="h-9 w-9">
                                                    <Star className={`h-4 w-4 ${quote.is_favorite ? 'fill-warning text-warning' : 'text-subtle'}`} />
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={`${quote.is_archived ? 'Restore costing snapshot' : 'Archive costing snapshot'} ${quote.quality_label || 'record'}`} onClick={() => requestArchiveState(quote)} disabled={updatingId === quote.id} className="h-9 w-9 text-subtle">
                                                    {updatingId === quote.id ? <Loader2 className="h-4 w-4 animate-spin" /> : quote.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {hasQuotationLifecycle && quote.status === 'draft' && !linkedOrder && (
                                            <Button
                                                size="sm"
                                                className="w-full gap-2 bg-saffron font-bold text-white hover:bg-saffron-deep"
                                                onClick={() => handleStatusChange(quote.id, 'sent')}
                                                disabled={updatingId === quote.id}
                                            >
                                                {updatingId === quote.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <FileText className="h-4 w-4" />
                                                )}
                                                Mark Sent
                                            </Button>
                                        )}

                                        {hasQuotationLifecycle && quote.status === 'sent' && !linkedOrder && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Button
                                                    size="sm"
                                                    className="gap-2 bg-saffron font-bold text-white hover:bg-saffron-deep"
                                                    onClick={() => setQuoteToAccept(quote)}
                                                    disabled={updatingId === quote.id}
                                                >
                                                    {updatingId === quote.id ? (
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                    ) : (
                                                        <CheckCircle2 className="h-4 w-4" />
                                                    )}
                                                    Accept
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="gap-2 border-risk/30 font-bold text-risk hover:bg-risk-soft"
                                                    onClick={() => handleStatusChange(quote.id, 'rejected')}
                                                    disabled={updatingId === quote.id}
                                                >
                                                    <XCircle className="h-4 w-4" />
                                                    Reject
                                                </Button>
                                            </div>
                                        )}

                                        {canCreateOrder && (
                                            <Button
                                                size="sm"
                                                className="w-full gap-2 bg-success font-bold text-white hover:bg-success/90"
                                                onClick={() => openConvertDialog(quote)}
                                                disabled={updatingId === quote.id}
                                            >
                                                {updatingId === quote.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Package className="h-4 w-4" />
                                                )}
                                                Create Active Order
                                            </Button>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
            </div>
            )}
            </div>

            {/* Keep the archive policy in the unused right margin on wide screens. */}
            <aside className="saved-costings-archive-rail-desktop" aria-label={tx('Saved Costings archive policy')}>
                <ArchivePolicyNotice />
            </aside>

            <Dialog open={Boolean(quoteHistoryFor)} onOpenChange={open => {
                if (!open) {
                    setQuoteHistoryFor(null)
                    setQuoteHistoryRows([])
                    setQuoteHistoryError(null)
                }
            }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-info" /> Quotation history</DialogTitle>
                        <DialogDescription>
                            {quoteHistoryFor?.party_name || 'Quotation'} · {quoteHistoryFor?.quality_label || 'Unnamed quality'}. Status changes and their recorded times are shown here. Sent: {formatQuoteTimestamp(quoteHistoryFor?.sent_at)}.
                        </DialogDescription>
                    </DialogHeader>
                    {quoteHistoryLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-subtle" role="status" aria-live="polite"><Loader2 className="h-5 w-5 animate-spin text-info" /> Loading quotation history…</div>
                    ) : quoteHistoryError ? (
                        <p role="alert" className="py-8 text-center text-sm font-medium text-destructive">{quoteHistoryError}</p>
                    ) : quoteHistoryRows.length > 0 ? (
                        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                            {quoteHistoryRows.map((row, index) => {
                                const toConfig = row.to ? STATUS_CONFIG[row.to] : null
                                const fromLabel = row.from ? STATUS_CONFIG[row.from].label : 'Created'
                                return (
                                    <div key={`${row.changedAt}-${index}`} className="flex items-start gap-3 rounded-xl border border-hairline bg-surface-soft/70 p-3">
                                        <span className={`mt-0.5 inline-flex min-h-7 items-center rounded-full border px-2 text-[11px] font-bold ${toConfig?.color ?? 'border-hairline bg-surface text-body'}`}>
                                            {toConfig?.label ?? row.to ?? 'Recorded'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-ink">{fromLabel} <span className="font-normal text-subtle">→</span> {toConfig?.label ?? row.to ?? 'Recorded'}</p>
                                            <p className="mt-1 text-xs text-subtle">{formatQuoteTimestamp(row.changedAt)} · {row.changedBy ? 'Owner action' : 'System record'}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-hairline bg-surface-soft px-4 py-8 text-center text-sm text-body">
                            No status changes recorded yet. This quotation is currently <span className="font-bold">{quoteHistoryFor ? STATUS_CONFIG[quoteHistoryFor.status].label : 'Draft'}</span>.
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuoteHistoryFor(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {tourSurface === 'export' && <CostingExportDialog key={tourStep} open tutorialPreview onOpenChange={() => {}} model={tourExport} defaultMode={tourStep === 'internal' ? 'internal' : 'customer'} defaultBusinessName="Tour sample" defaultCustomerName="Sample customer" sourceRecordKind="costing" />}
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
                    onQuoteUpdated={data => {
                        setQuotes(current => current.map(item => item.id === quoteToExport.id ? { ...item, ...data } : item))
                        setQuoteToExport(current => current ? { ...current, ...data } : current)
                    }}
                    onMarkAsSent={quoteToExport.record_kind === 'quotation'
                        && canUseQuotationLifecycle(quoteToExport.record_kind, canUseQuotationWorkflow)
                        && quoteToExport.status === 'draft'
                        ? () => handleStatusChange(quoteToExport.id, 'sent')
                        : undefined}
                />
            )}

            <ConfirmActionDialog
                open={Boolean(quoteToArchive)}
                onOpenChange={open => { if (!open && updatingId !== quoteToArchive?.id) setQuoteToArchive(null) }}
                title={`${archiveAction === 'restore' ? 'Restore' : 'Archive'} ${quoteToArchive?.record_kind === 'quotation' ? 'quotation' : 'costing snapshot'} · ${quoteToArchive?.quality_label || quoteToArchive?.party_name || 'Untitled record'}?`}
                description={`${archiveAction === 'restore' ? 'This restores the named record to the active library.' : tx('This archives only this costing snapshot.')} ${t('base_plan.archive.description')} ${t('base_plan.archive.restore')} ${t('base_plan.archive.deletion')} ${t('base_plan.archive.privacy')} Existing saved values remain unchanged.`}
                confirmLabel={archiveAction === 'restore' ? 'Restore snapshot' : 'Archive snapshot'}
                cancelLabel={archiveAction === 'restore' ? 'Keep archived' : 'Keep snapshot'}
                onConfirm={confirmArchiveSnapshot}
                isDestructive={archiveAction === 'archive'}
                isLoading={updatingId === quoteToArchive?.id}
            />

            <Dialog modal={!tourStep} open={tourStep ? tourSurface === 'comparison' : showComparison} onOpenChange={open => {if (!tourStep) setShowComparison(open)}}>
                <DialogContent data-costing-tour-dialog={tourStep ? "true" : undefined} data-costing-tour="comparison" onOpenAutoFocus={event => {if (tourStep) event.preventDefault()}} onCloseAutoFocus={event => {if (tourStep) event.preventDefault()}} onInteractOutside={event => {if (tourStep) event.preventDefault()}} onEscapeKeyDown={event => {if (tourStep) event.preventDefault()}} className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitCompareArrows className="h-5 w-5 text-info" /> Compare Saved Costings
                        </DialogTitle>
                        <DialogDescription>Compare two immutable snapshots using the same saved calculation and rounding contract. The current Rate Book is not read.</DialogDescription>
                    </DialogHeader>
                    {comparisonCostings.length === 2 && comparison && (
                        <div className="space-y-3">
                            <div className={`rounded-xl border px-4 py-3 text-xs ${comparison.comparable ? 'border-success/25 bg-success-soft text-success' : 'border-warning/25 bg-warning-soft text-warning'}`}>
                                <p className="font-bold">{comparison.comparable ? 'Canonical comparison ready' : 'Canonical comparison needs review'}</p>
                                <p className="mt-1 leading-relaxed">{comparison.canonical.message || `Formula ${comparison.canonical.leftCalculationVersion || 'unknown'} · rounding ${comparison.canonical.leftSnapshotSchemaVersion ? `snapshot v${comparison.canonical.leftSnapshotSchemaVersion}` : 'legacy'} · detail source ${comparison.canonical.source.replace('_', ' ')}.`}</p>
                                <p className="mt-1 font-semibold">Change is calculated as New minus Old. Cost-driving changes are separated from reference/context changes.</p>
                                <p className="mt-1 font-semibold">{formatSuggestedPriceMovement(comparison.price.sellingPricePerM)}</p>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                {comparisonSummary.map(metric => (
                                    <div key={metric.label} className="rounded-xl border border-hairline bg-surface-soft p-3">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-subtle">{metric.label}</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <div>
                                                <p className="text-[10px] font-semibold text-subtle">Old</p>
                                                <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink" title={metric.oldValue}>{metric.oldValue}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-semibold text-subtle">New</p>
                                                <p className="mt-0.5 truncate font-mono text-sm font-bold text-ink" title={metric.newValue}>{metric.newValue}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <details data-costing-tour="comparison-details" open={tourStep ? tourStep === 'comparisonDetails' : undefined} className="group rounded-xl border border-hairline bg-surface">
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-body marker:content-none">
                                    <span>View calculation details (optional)</span>
                                    <ChevronDown className="h-4 w-4 text-subtle transition-transform group-open:rotate-180" />
                                </summary>
                                <div className="max-h-[60vh] overflow-auto border-t border-hairline">
                                    <table className="w-full min-w-[760px] text-sm">
                                    <thead className="bg-surface-soft text-left">
                                        <tr>
                                            <th className="px-4 py-3 text-xs uppercase tracking-wide text-subtle">Metric</th>
                                            {comparisonCostings.map((costing, index) => {
                                                const identity = getSavedCostingIdentity(costing)
                                                return <th key={costing.id} className="px-4 py-3 font-bold text-ink"><span className="block">{index === 0 ? 'Old snapshot' : 'New snapshot'}</span><span className="mt-1 block max-w-[220px] truncate text-xs font-semibold text-body" title={identity.label}>{identity.label}</span><span className="mt-1 block text-[10px] font-medium text-subtle">saved {formatTimestampDate(costing.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span></th>
                                            })}
                                            <th className="px-4 py-3 text-xs uppercase tracking-wide text-subtle">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-hairline">
                                        {comparisonGroups.map(group => (
                                            <Fragment key={group.key}>
                                                <tr className="bg-info-soft/70">
                                                    <th colSpan={4} className="px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider text-info">
                                                        {group.title}
                                                    </th>
                                                </tr>
                                                <tr className="bg-info-soft/30">
                                                    <td colSpan={4} className="px-4 py-2 text-xs leading-relaxed text-body">{group.description}</td>
                                                </tr>
                                                {group.sections.map(section => (
                                                    <Fragment key={`${group.key}-${section.title}`}>
                                                        <tr key={`${group.key}-${section.title}-heading`} className="bg-surface-soft/70">
                                                            <th colSpan={4} className="px-4 py-2 text-left text-[11px] font-black uppercase tracking-wider text-body">
                                                                <span>{section.title}</span>{section.changed && <Badge variant="outline" className="ml-2 border-info/25 bg-info-soft text-[10px] text-info">Changed</Badge>}
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
                                                                <tr key={`${group.key}-${section.title}-${row.label}`}>
                                                                    <td className="px-4 py-3 font-semibold text-body">{row.label}</td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-ink">
                                                                        <span>{left}{row.unit === 'rate' && left !== 'Not available' ? '/kg' : ''}</span>
                                                                        {row.context?.left && <span className="mt-1 block font-sans text-[10px] font-medium leading-4 text-subtle">{row.context.left}</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-ink">
                                                                        <span>{right}{row.unit === 'rate' && right !== 'Not available' ? '/kg' : ''}</span>
                                                                        {row.context?.right && <span className="mt-1 block font-sans text-[10px] font-medium leading-4 text-subtle">{row.context.right}</span>}
                                                                    </td>
                                                                    <td className={`px-4 py-3 font-mono font-bold ${row.changed ? numericDelta != null && numericDelta > 0 ? 'text-warning' : 'text-info' : 'text-subtle'}`}>{change}</td>
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
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowComparison(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!quoteToConvert} onOpenChange={(open) => !open && setQuoteToConvert(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5 text-success" />
                            Create active order from accepted quote
                        </DialogTitle>
                        <DialogDescription>
                            This is the only production entry point now. The quote stays accepted and becomes linked to the new live order.
                        </DialogDescription>
                    </DialogHeader>

                    {quoteToConvert && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border border-hairline bg-surface-soft p-3">
                                <p className="text-sm font-black text-ink">{quoteToConvert.party_name}</p>
                                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-subtle">{quoteToConvert.quality_label}</p>
                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-subtle">Quote Price</p>
                                        <p className="font-mono font-black text-saffron-deep">₹{Number(quoteToConvert.quote_price_per_meter).toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-subtle">Quoted Qty</p>
                                        <p className="font-mono font-black text-ink">{Number(quoteToConvert.meters ?? 0).toLocaleString('en-IN')} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black uppercase text-subtle">Total metres</Label>
                                    <Input
                                        type="number"
                                        min="1"
                                        step="1"
                                        value={convertMeters}
                                        onChange={event => setConvertMeters(event.target.value)}
                                        className="font-mono font-bold"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black uppercase text-subtle">Deadline</Label>
                                    <Input
                                        type="date"
                                        value={convertDeadline}
                                        onChange={event => setConvertDeadline(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-black uppercase text-subtle">Order notes</Label>
                                <Textarea
                                    value={convertNotes}
                                    onChange={event => setConvertNotes(event.target.value)}
                                    placeholder="Optional production instructions for the floor"
                                    className="resize-none h-20 text-xs"
                                />
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setQuoteToConvert(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-success text-white hover:bg-success/90"
                            onClick={handleConvertAcceptedQuote}
                            disabled={!quoteToConvert || updatingId === quoteToConvert.id}
                        >
                            {quoteToConvert && updatingId === quoteToConvert.id ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : (
                                <Package className="h-4 w-4 mr-2" />
                            )}
                            Create active order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!quoteToAccept} onOpenChange={(open) => !open && setQuoteToAccept(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-success" />
                            Accept this quote?
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed text-subtle">
                            Yarn rates and price will be locked. A later re-estimate creates a linked new quote without changing this record.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 justify-end pt-2">
                        <Button variant="ghost" onClick={() => setQuoteToAccept(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-saffron font-bold text-white hover:bg-saffron-deep"
                            onClick={async () => {
                                if (quoteToAccept) {
                                    const id = quoteToAccept.id
                                    setQuoteToAccept(null)
                                    await handleStatusChange(id, 'accepted')
                                }
                            }}
                        >
                            Yes, Accept
                        </Button>
                    </DialogFooter>
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
                            <p className="font-black">{existingDraftForRestore.partyName || 'Untitled draft'}</p>
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
