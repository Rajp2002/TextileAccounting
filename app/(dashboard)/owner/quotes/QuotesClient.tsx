'use client'

import dynamic from 'next/dynamic'
import { Fragment, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { buildCostingResult, calcFullTotals, makeDefaultEstimateState, parseCostingResultSnapshot, type CostingResultSnapshot } from '@/lib/estimator'
import {
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
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { auditHistoricalCostingSnapshot, convertAcceptedQuoteToOrder, getQuoteStatusHistory, updateQuoteStatus, updateSavedCostingLibraryState } from '../estimator/actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { addDays, format } from 'date-fns'
import { formatDateOnly } from '@/lib/format'
import { formatSuratDateTime, getCurrentTimestampMs } from '@/lib/time'
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
    ChevronDown,
    ChevronRight,
    Factory,
    Layers3,
    ExternalLink,
} from 'lucide-react'
import {
  compareSavedCostingSnapshots,
  orderSavedCostingsForComparison,
  buildSavedQualityRecipeState,
  filterAndSortSavedCostings,
  getSavedCostingIdentity,
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

const CostingExportDialog = dynamic(
    () => import('@/components/estimator/CostingExportDialog').then(module => module.CostingExportDialog),
    { ssr: false, loading: () => null },
)

const STATUS_CONFIG = {
    draft:    { label: 'Draft',    color: 'bg-slate-100 text-slate-700 border-slate-200' },
    sent:     { label: 'Sent',     color: 'bg-blue-50 text-blue-700 border-blue-200' },
    accepted: { label: 'Accepted', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    rejected: { label: 'Rejected', color: 'bg-red-50 text-red-700 border-red-200' },
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
    expandedKey,
    selectedCostingIds,
    updatingId,
    onToggleExpanded,
    onToggleComparison,
    onOpen,
    onStartFrom,
     onExport,
     onAudit,
     auditingId,
     onToggleFavorite,
     onToggleArchived,
    onOpenUsage,
    factoryInputsCapturedLabel,
}: {
    groups: SavedQualityGroup[]
    canUseProduction: boolean
    expandedKey: string | null
    selectedCostingIds: string[]
    updatingId: string | null
    onToggleExpanded: (key: string) => void
    onToggleComparison: (id: string) => void
    onOpen: (quote: QuoteRow) => void
    onStartFrom: (quote: QuoteRow) => void
     onExport: (quote: QuoteRow) => void
     onAudit: (quote: QuoteRow) => void
     auditingId: string | null
     onToggleFavorite: (quote: QuoteRow) => void
     onToggleArchived: (quote: QuoteRow) => void
    onOpenUsage: (quote: QuoteRow, order: QuoteLinkedOrder) => void
    factoryInputsCapturedLabel: string
}) {
    const { t, tx } = useTranslation()

    return (
        <div className="space-y-3">
            {groups.map(group => {
                const isExpanded = expandedKey === group.key
                const latest = group.records[0] ?? null
                const latestResult = latest ? getHistoricalCostingResult(latest) : null
                const usages = group.records
                    .map(record => ({ record, order: getLinkedOrder(record) }))
                    .filter((item): item is { record: QuoteRow; order: QuoteLinkedOrder } => Boolean(item.order))
                    .filter((item, index, all) => all.findIndex(other => other.order.id === item.order.id) === index)
                const totalProduced = usages.reduce((sum, usage) => sum + getProducedMeters(usage.order), 0)

                return (
                    <Card key={group.key} className={isExpanded ? 'border-orange-200 bg-white shadow-md' : 'border-slate-200 bg-white shadow-sm'}>
                        <CardContent className="p-0">
                            <div className="flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:p-5 lg:flex-nowrap">
                                <button
                                    type="button"
                                    onClick={() => onToggleExpanded(group.key)}
                                    aria-expanded={isExpanded}
                                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                >
                                    <span className="mt-0.5 rounded-lg bg-orange-50 p-2 text-orange-700">
                                        <Layers3 className="h-5 w-5" />
                                    </span>
                                    <span className="min-w-0">
                                        <span className="flex flex-wrap items-center gap-2">
                                            <span className="truncate text-base font-black text-slate-950">{group.name}</span>
                                            {group.template && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700">{tx('Fabric Quality')}</Badge>}
                                            {group.template?.is_active === false && <Badge variant="outline" className="border-slate-300 bg-slate-100 text-[10px] font-bold text-slate-600">{tx('Archived · read-only')}</Badge>}
                                            {latest && <Badge variant="outline" className="text-[10px] font-bold">v{Number(latest.version_number ?? 1)}</Badge>}
                                            {latest && getCostingStatus(latest) !== 'verified' && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800">{getCostingBadge(getCostingStatus(latest))}</Badge>}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500">
                                            {group.records.length > 0
                                                ? `${group.records.length} saved costing ${group.records.length === 1 ? 'snapshot' : 'snapshots'} · updated ${formatDateOnly(group.updatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                : tx('Saved recipe · no saved costing yet')}
                                        </span>
                                    </span>
                                </button>

                                <div className={`grid gap-2 ${canUseProduction ? 'grid-cols-1 sm:grid-cols-3 sm:min-w-[420px]' : 'grid-cols-1 sm:grid-cols-2 sm:min-w-[300px]'}`}>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tx(latest ? 'Latest cost' : 'Current recipe')}</p>
                                        <p className="mt-1 font-mono text-sm font-black text-slate-900">{latest
                                            ? formatCostingMoneyPerM(getProductionCostPerM(latest))
                                            : group.currentRecipeCostPerM != null
                                                ? `₹${group.currentRecipeCostPerM.toFixed(2)}/m`
                                                : '—'}</p>
                                    </div>
                                    {canUseProduction ? <>
                                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tx('Used for')}</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">{tx(`${usages.length} ${usages.length === 1 ? 'run' : 'runs'}`)}</p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tx('Produced')}</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">{totalProduced.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m</p>
                                        </div>
                                    </> : (
                                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{tx('History')}</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">{tx(`${group.records.length} ${group.records.length === 1 ? 'snapshot' : 'snapshots'}`)}</p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onToggleExpanded(group.key)}
                                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${group.name}`}
                                    className="hidden rounded-md p-2 text-slate-500 hover:bg-slate-100 sm:block"
                                >
                                    {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                                </button>
                            </div>

                            {isExpanded && (
                                <div className="border-t border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                                    {!latest || !latestResult ? (
                                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                                            {latest ? <AlertTriangle className="h-6 w-6 text-amber-500" /> : <FileText className="h-6 w-6 text-slate-400" />}
                                            <p className="mt-3 text-sm font-bold text-slate-700">{tx(latest
                                                ? 'Detailed breakdown unavailable for this older Saved Costing'
                                                : group.currentRecipeCostPerM != null
                                                    ? `Current recipe estimate: ₹${group.currentRecipeCostPerM.toFixed(2)}/m`
                                                    : 'No costing saved for this quality yet')}</p>
                                            <p className="mt-1 max-w-md text-xs text-slate-500">{tx(latest
                                                ? 'The saved commercial totals remain available in Saved Costing history. Open and save this snapshot once to refresh its detailed analysis.'
                                                : group.currentRecipeCostPerM != null
                                                    ? 'This is a live estimate from the saved yarn recipe and current factory costs, not a historical snapshot. Set a costing quantity and choose Save Costing to preserve its full analysis.'
                                                    : canUseProduction
                                                        ? 'Open Cost Estimate, choose this saved quality, set the costing quantity, and save the result. Its analysis and production usage will then appear here.'
                                                    : 'Open Cost Estimate, choose this saved quality, set the costing quantity, and choose Save Costing. Its analysis will then appear here.')}</p>
                                        </div>
                                    ) : (
                                        <div className={`grid gap-4 ${canUseProduction ? 'xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]' : ''}`}>
                                            <section className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-950">{tx('Latest Saved Costing breakdown')}</p>
                                                        <p className="mt-1 text-xs text-slate-500">Snapshot v{Number(latest.version_number ?? 1)} · {formatDateOnly(latest.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        {!latest.is_archived && group.template?.is_active !== false && <Button variant="outline" size="sm" onClick={() => onOpen(latest)} disabled={updatingId === latest.id} aria-busy={updatingId === latest.id}>{tx('Open and save new version')}</Button>}
                                                        <Button variant="outline" size="sm" onClick={() => onStartFrom(latest)}><Copy className="h-3.5 w-3.5" /> {tx('Use as Starting Point')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onExport(latest)}><Eye className="h-3.5 w-3.5" /> {tx('Preview')}</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onToggleArchived(latest)} disabled={updatingId === latest.id} aria-busy={updatingId === latest.id}>
                                                            {updatingId === latest.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : latest.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                                                        {tx(updatingId === latest.id ? latest.is_archived ? `Restoring ${getSavedCostingIdentity(latest).label}…` : `Archiving ${getSavedCostingIdentity(latest).label}…` : latest.is_archived ? 'Restore snapshot' : 'Archive snapshot')}
                                                        </Button>
                                                    </div>
                                                        </div>

                                                <div className="mt-4 divide-y divide-slate-100 text-sm">
                                                    {[
                                                        ['Warp yarn', latestResult.breakdown.warpCostPerM],
                                                        ['Weft yarn', latestResult.breakdown.weftCostPerM],
                                                        ['Weaving', latestResult.breakdown.weaveCostPerM],
                                                        ['Warping & sizing', latestResult.breakdown.warpingAndSizingPerM],
                                                        ['Processing & finishing', latestResult.breakdown.windingPerM + latestResult.breakdown.processingPerM + latestResult.breakdown.finishingPerM],
                                                        ['Factory expenses', latestResult.breakdown.overheadPerM],
                                                    ].map(([label, value]) => (
                                                        <div key={String(label)} className="flex items-center justify-between py-2">
                                                            <span className="text-slate-600">{label}</span>
                                                            <span className="font-mono font-semibold text-slate-800">₹{Number(value).toFixed(2)}/m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 grid grid-cols-1 gap-2 rounded-lg bg-slate-950 p-3 text-white sm:grid-cols-3">
                                                    <div><p className="text-[10px] uppercase text-slate-400">{t('common.production_cost_per_m')}</p><p className="mt-1 font-mono text-sm font-black">₹{latestResult.productionCostPerM.toFixed(2)}/m</p></div>
                                                    <div><p className="text-[10px] uppercase text-slate-400">{t('common.suggested_selling_price_per_m')}</p><p className="mt-1 font-mono text-sm font-black text-orange-300">₹{latestResult.suggestedSellingPricePerM.toFixed(2)}/m</p></div>
                                                    <div><p className="text-[10px] uppercase text-slate-400">Actual Margin</p><p className="mt-1 font-mono text-sm font-black text-emerald-300">{latestResult.actualMarginPct.toFixed(1)}%</p></div>
                                                </div>
                                                {getCostingStatus(latest) !== 'verified' && (
                                                    <div className="mt-3 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                                                        <div><p className="font-bold">{tx('Saved costing needs a check')}</p><p className="mt-1">{tx(latest.reconciliation_note || getCostingTrustCopy(getCostingStatus(latest)))}</p></div>
                                                        <Button variant="outline" size="sm" onClick={() => onAudit(latest)} disabled={auditingId === latest.id} aria-busy={auditingId === latest.id} className="shrink-0 border-amber-300 bg-white text-amber-900 hover:bg-amber-100">
                                                            {auditingId === latest.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {tx(auditingId === latest.id ? 'Checking…' : 'Check saved numbers')}
                                                        </Button>
                                                    </div>
                                                )}
                                            </section>

                                            {canUseProduction && <section className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-950">Applied production</p>
                                                        <p className="mt-1 text-xs text-slate-500">Orders and market runs created from this quality&apos;s costing snapshots.</p>
                                                    </div>
                                                    <Factory className="h-5 w-5 text-slate-400" />
                                                </div>
                                                {usages.length === 0 ? (
                                                    <div className="mt-4 rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">This costing has not been applied to an order or market run yet.</div>
                                                ) : (
                                                    <div className="mt-4 space-y-2">
                                                        {usages.map(({ record, order }) => {
                                                            const produced = getProducedMeters(order)
                                                            const target = Number(order.total_target_meters ?? record.meters ?? 0)
                                                            const isMarketRun = Boolean(record.market_run_id || order.market_run_id || record.record_kind === 'market_run')
                                                            return (
                                                                <button key={order.id} type="button" onClick={() => onOpenUsage(record, order)} className="w-full rounded-lg border border-slate-200 p-3 text-left hover:border-blue-300 hover:bg-blue-50/40">
                                                                    <div className="flex items-start justify-between gap-3">
                                                                        <div className="min-w-0">
                                                                            <p className="truncate text-xs font-bold text-slate-900">{isMarketRun ? 'Market run' : 'Party order'} · {record.party_name || order.party_name || group.name}</p>
                                                                            <p className="mt-1 text-[11px] text-slate-500">{produced.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m produced of {target.toLocaleString('en-IN')} m · {order.status}</p>
                                                                        </div>
                                                                        <ExternalLink className="h-4 w-4 shrink-0 text-slate-400" />
                                                                    </div>
                                                                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                                                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${target > 0 ? Math.min(100, (produced / target) * 100) : 0}%` }} />
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
                                        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                            <p className="text-sm font-black text-slate-950">Saved Costing history</p>
                                            <p className="mt-1 text-xs text-slate-500">Select any two snapshots to compare their commercial assumptions.</p>
                                            <div className="mt-3 overflow-x-auto">
                                                <table className="w-full min-w-[720px] text-left text-xs">
                                                    <thead className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="w-10 py-2"><span className="sr-only">Compare</span></th><th className="py-2">Snapshot</th><th className="py-2">Context</th><th className="py-2">Cost</th><th className="py-2">Selling price</th><th className="py-2">Margin</th><th className="py-2">Costing qty.</th><th className="py-2 text-right">Actions</th></tr></thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {group.records.map(record => (
                                                            <tr key={record.id}>
                                                                <td className="py-3"><input type="checkbox" checked={selectedCostingIds.includes(record.id)} onChange={() => onToggleComparison(record.id)} aria-label={`Select ${group.name} version ${Number(record.version_number ?? 1)} for comparison`} className="h-4 w-4 accent-blue-600" /></td>
                                                                <td className="py-3 font-bold text-slate-900">
                                                                    <div>{getSavedCostingIdentity(record).label}<span className="ml-2 font-normal text-slate-500">{formatDateOnly(record.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                                                                    {record.factory_profile_updated_at && <div className="mt-1 text-[10px] font-normal text-slate-500">{factoryInputsCapturedLabel} {formatDateOnly(record.factory_profile_updated_at, { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
                                                                </td>
                                                                <td className="py-3 capitalize text-slate-600">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <span>{record.record_kind === 'market_run' ? 'Market run' : record.record_kind === 'quotation' ? `Customer Quotation · ${record.party_name || 'Customer not set'}` : 'Saved Costing'}</span>
                                                                        {getCostingStatus(record) !== 'verified' && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800">{getCostingBadge(getCostingStatus(record))}</Badge>}
                                                                    </div>
                                                                </td>
                                                                <td className="py-3 font-mono text-slate-700">{formatCostingMoneyPerM(getProductionCostPerM(record))}</td>
                                                                <td className="py-3 font-mono font-bold text-orange-700">{formatCostingMoneyPerM(getSuggestedSellingPricePerM(record))}</td>
                                                                <td className="py-3 font-mono font-bold text-emerald-700">{formatCostingPercent(getActualMarginPct(record))}</td>
                                                                <td className="py-3 text-slate-600">{Number(record.meters ?? 0).toLocaleString('en-IN')} m</td>
                                    <td className="py-3 text-right"><div className="flex justify-end gap-1">{!record.is_archived && group.template?.is_active !== false && <Button variant="ghost" size="sm" onClick={() => onOpen(record)} disabled={updatingId === record.id}>Open</Button>}<Button variant="ghost" size="icon" onClick={() => onToggleFavorite(record)} disabled={updatingId === record.id} aria-label={record.is_favorite ? `Remove ${group.name} from favourites` : `Add ${group.name} to favourites`}><Star className="h-4 w-4" fill={record.is_favorite ? 'currentColor' : 'none'} /></Button><Button variant="ghost" size="sm" onClick={() => onToggleArchived(record)} disabled={updatingId === record.id} aria-label={`${record.is_archived ? 'Restore costing snapshot' : 'Archive costing snapshot'} ${group.name}`}>{updatingId === record.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : record.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} {updatingId === record.id ? record.is_archived ? `Restoring ${group.name}…` : `Archiving ${group.name}…` : record.is_archived ? 'Restore snapshot' : 'Archive snapshot'}</Button></div></td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </section>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            })}
        </div>
    )
}

export default function QuotesClient({ initialQuotes, initialTemplates, initialProfile, initialWorkers, initialStatus, orgId, userId, canUseProduction, canUseQuotationWorkflow, organizationName }: { initialQuotes: QuoteRow[], initialTemplates: SavedQuality[], initialProfile?: SavedQualityFactoryProfile, initialWorkers: SavedQualityFixedWorker[], initialStatus?: string, orgId: string, userId: string, canUseProduction: boolean, canUseQuotationWorkflow: boolean, organizationName: string }) {
    const { t, tx } = useTranslation()
    const router = useRouter()
    const [quotes, setQuotes] = useState<QuoteRow[]>(initialQuotes)
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
    const [selectedCostingIds, setSelectedCostingIds] = useState<string[]>([])
    const [showComparison, setShowComparison] = useState(false)
    const [quoteToExport, setQuoteToExport] = useState<QuoteRow | null>(null)
    const [quoteHistoryFor, setQuoteHistoryFor] = useState<QuoteRow | null>(null)
    const [quoteHistoryRows, setQuoteHistoryRows] = useState<QuoteStatusHistoryRow[]>([])
    const [quoteHistoryLoading, setQuoteHistoryLoading] = useState(false)
    const [quoteHistoryError, setQuoteHistoryError] = useState<string | null>(null)
    const [quoteToArchive, setQuoteToArchive] = useState<QuoteRow | null>(null)
    const [archiveAction, setArchiveAction] = useState<'archive' | 'restore'>('archive')
    const [showArchived, setShowArchived] = useState(false)
    const [expandedQualityKey, setExpandedQualityKey] = useState<string | null>(null)
    const showQualityLibrary = !canUseQuotationWorkflow

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

        if (!showArchived && !showFavoritesOnly) {
            for (const template of initialTemplates.filter(item => Boolean(item.is_active) === !showArchived)) {
                const key = `template:${template.id}`
                groups.set(key, { key, name: template.name, template, records: [], updatedAt: template.updated_at, currentRecipeCostPerM: null })
                labelIndex.set(normalizeQualityKey(template.name), key)
            }
        }

        for (const record of quotes.filter(item => Boolean(item.is_archived) === showArchived && (!showFavoritesOnly || item.is_favorite === true))) {
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
                    template: initialTemplates.find(template => template.id === record.template_id) ?? null,
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
    }, [costingSort, initialProfile, initialTemplates, initialWorkers, marginFilter, quotes, searchQuery, showArchived, showFavoritesOnly])
    const selectedCostings = useMemo(
        () => selectedCostingIds.map(id => quotes.find(quote => quote.id === id)).filter((quote): quote is QuoteRow => Boolean(quote)),
        [quotes, selectedCostingIds],
    )
    const comparisonCostings = useMemo(
        () => orderSavedCostingsForComparison(selectedCostings),
        [selectedCostings],
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
            title: 'Yarn',
            changed: comparison.yarn.changed,
            rows: [
                { label: 'Warp yarn cost', value: comparison.yarn.warp.costPerM, unit: 'money' as const, changed: comparison.yarn.warp.changed },
                { label: 'Warp yarn rate', value: comparison.yarn.warp.ratePerKg, unit: 'rate' as const, changed: comparison.yarn.warp.changed },
                { label: 'Warp applied waste', value: comparison.yarn.warp.wastePct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.yarn.warp.wastePct) },
                { label: 'Weft yarn cost', value: comparison.yarn.weft.costPerM, unit: 'money' as const, changed: comparison.yarn.weft.changed },
                { label: 'Weft yarn rate', value: comparison.yarn.weft.ratePerKg, unit: 'rate' as const, changed: comparison.yarn.weft.changed },
                { label: 'Weft applied waste', value: comparison.yarn.weft.wastePct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.yarn.weft.wastePct) },
                { label: 'Weft costing width (in)', value: comparison.yarn.weft.widthInches, unit: 'number' as const, changed: deltaChangedForUi(comparison.yarn.weft.widthInches) },
            ],
        },
        {
            title: 'Waste',
            changed: comparison.waste.changed,
            rows: [
                { label: 'Yarn shortage / waste', value: comparison.waste.yarnShortagePct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.waste.yarnShortagePct) },
                { label: 'Warp crimp', value: comparison.waste.warpCrimpPct, unit: 'percent' as const, changed: deltaChangedForUi(comparison.waste.warpCrimpPct) },
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

    const toggleCostingSelection = (id: string) => {
        setSelectedCostingIds(current => {
            if (current.includes(id)) return current.filter(currentId => currentId !== id)
            return current.length >= 2 ? [current[1], id] : [...current, id]
        })
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
            const newDraft: EstimatorAutosaveData<QuoteDraftState> = {
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
                savedAt: getCurrentTimestampMs(),
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
            }
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

    const handleRestore = (quote: QuoteRow, mode: 'edit' | 'duplicate') => {
        try {
            const draftKey = getEstimatorDraftStorageKey(orgId, userId)
            const existingDraft = parseEstimatorDraft<QuoteDraftState>(localStorage.getItem(draftKey))
            const restoreIdentity = mode === 'duplicate' ? `duplicate:${quote.id}` : quote.id
            if (shouldWarnBeforeQuoteRestore(existingDraft, restoreIdentity)) {
                setExistingDraftForRestore(existingDraft)
                setRestoreMode(mode)
                setQuoteToRestore(quote)
                return
            }
            restoreQuoteToEstimator(quote, mode)
        } catch (e) {
            toast.error(tx('Failed to restore snapshot'))
            console.error(e)
        }
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
        <div className="max-w-6xl mx-auto space-y-6">
            <ArchivePolicyNotice />
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6 text-indigo-500" />
                        {canUseQuotationWorkflow ? t('common.costings_quotations_title') : t('common.saved_costings_title')}
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">{canUseQuotationWorkflow ? t('common.costings_quotations_description') : t('common.saved_costings_description')}</p>
                </div>
                <Button onClick={() => router.push('/owner/estimator')} className="h-11 bg-orange-600 text-white hover:bg-orange-700">
                    <Plus className="h-4 w-4" /> {canUseQuotationWorkflow ? t('common.new_estimate') : t('common.new_costing')}
                </Button>
                {canUseQuotationWorkflow && <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-lg shadow-sm w-full sm:w-auto overflow-x-auto">
                    {['all', 'costings', 'draft', 'sent', 'accepted', 'rejected'].map(s => (
                        <button
                            key={s}
                            onClick={() => {
                                setFilterStatus(s)
                                router.replace(`/owner/quotes${s !== 'all' ? `?status=${s}` : ''}`)
                            }}
                            className={`px-4 lg:px-3 h-11 lg:h-8 flex items-center justify-center text-xs font-bold rounded-md capitalize whitespace-nowrap transition-all ${
                                filterStatus === s
                                    ? 'bg-slate-900 text-white shadow-md'
                                    : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>}
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid min-w-0 gap-3 lg:grid-cols-1 xl:grid-cols-[minmax(220px,1fr)_210px_170px_auto_auto_auto]">
                        <div className="relative min-w-0">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Label htmlFor="saved-costings-search" className="sr-only">{canUseQuotationWorkflow ? t('common.search_party_quality_costing') : t('common.search_quality_costing')}</Label>
                            <Input
                                id="saved-costings-search"
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder="Search saved records…"
                                aria-label={canUseQuotationWorkflow ? 'Search saved qualities, costings, quotations, and party names' : 'Search saved qualities and costings'}
                                aria-describedby="saved-costings-search-help"
                                className="h-10 w-full min-w-0 pl-9"
                            />
                        </div>
                        <select
                            aria-label={t('common.sort_saved_costings')}
                            value={costingSort}
                            onChange={event => setCostingSort(event.target.value as SavedCostingSort)}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                        >
                            <option value="recent">Recently updated</option>
                            <option value="oldest">Oldest updated</option>
                            <option value="margin_desc">Highest margin</option>
                            <option value="cost_asc">Lowest production cost</option>
                        </select>
                        <select
                            aria-label="Filter saved costings by margin"
                            value={marginFilter}
                            onChange={event => setMarginFilter(event.target.value as SavedCostingMarginFilter)}
                            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
                        >
                            <option value="all">All margins</option>
                            <option value="negative">Negative margin</option>
                            <option value="under_10">Under 10%</option>
                            <option value="10_to_20">10–20%</option>
                            <option value="over_20">Over 20%</option>
                        </select>
                        <Button
                            variant="outline"
                            disabled={selectedCostings.length !== 2}
                            aria-describedby={selectedCostings.length !== 2 ? 'compare-costings-help' : undefined}
                            onClick={() => setShowComparison(true)}
                            className="h-10"
                        >
                            <GitCompareArrows className="h-4 w-4" /> {t('common.compare_costings')} {selectedCostings.length || ''}
                        </Button>
                        <Button
                            variant={showFavoritesOnly ? 'secondary' : 'outline'}
                            onClick={() => { setShowFavoritesOnly(current => !current); setSelectedCostingIds([]) }}
                            className="h-10"
                            aria-pressed={showFavoritesOnly}
                        >
                            <Star className={`h-4 w-4 ${showFavoritesOnly ? 'fill-current' : ''}`} /> {showFavoritesOnly ? 'All costings' : 'Favourites'}
                        </Button>
                        <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => { setShowArchived(current => !current); setSelectedCostingIds([]) }} className="h-10">
                            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {showArchived ? t('common.active') : t('common.archived')}
                        </Button>
                    </div>
                    {selectedCostings.length !== 2 && (
                        <p id="compare-costings-help" className="mt-2 text-xs font-medium text-slate-600">
                            {t('common.compare_costings_hint')}
                        </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                        {showQualityLibrary
                            ? `${qualityGroups.length} ${showArchived ? 'archived ' : ''}${qualityGroups.length === 1 ? 'quality' : 'qualities'} shown · expand a quality to review its costing history.`
                            : `${filteredQuotes.length} ${showArchived ? 'archived ' : ''}${filteredQuotes.length === 1 ? 'record' : 'records'} shown · select any two to compare.`}
                    </p>
                    <p id="saved-costings-search-help" className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {canUseQuotationWorkflow
                            ? 'Searches saved quality names, costing snapshots, quotation references, statuses, and party names. Yarn rates are in the Rate Book.'
                            : 'Searches saved quality names, costing snapshots, and costing versions. Yarn rates are in the Rate Book.'}
                    </p>
                </div>

            {(showQualityLibrary ? qualityGroups.length === 0 : filteredQuotes.length === 0) ? (
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="p-3 bg-white rounded-full shadow-sm shadow-slate-200/50">
                            <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">{searchQuery.trim()
                            ? `No saved records match “${searchQuery.trim()}”.`
                            : canUseQuotationWorkflow ? t('common.no_costings_quotations') : t('common.no_saved_qualities_costings')}</p>
                        <p className="max-w-xs text-xs text-slate-500">{
                            searchQuery.trim()
                                ? 'Try a quality name, party name, quotation reference, or clear the search.'
                                : showArchived
                                    ? 'No archived records are showing. Switch to Active or save a costing first.'
                                    : filterStatus === 'all'
                                        ? (canUseQuotationWorkflow ? t('common.no_costings_quotations_yet') : t('common.save_quality_or_cost_estimate'))
                                        : `No Quotations with status "${filterStatus}".`
                        }</p>
                        {(searchQuery || marginFilter !== 'all' || showFavoritesOnly) && (
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => { setSearchQuery(''); setMarginFilter('all'); setShowFavoritesOnly(false) }}
                                className="mt-2 font-bold text-indigo-600"
                            >
                                {t('common.clear_search_filters')}
                            </Button>
                        )}
                        {canUseQuotationWorkflow && filterStatus !== 'all' && (
                            <Button variant="link" size="sm" onClick={() => setFilterStatus('all')} className="mt-2 text-indigo-600 font-bold">
                                {t('common.clear_filters')}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            ) : showQualityLibrary ? (
                <SavedQualityLibraryView
                    groups={qualityGroups}
                    canUseProduction={canUseProduction}
                    expandedKey={expandedQualityKey}
                    selectedCostingIds={selectedCostingIds}
                    updatingId={updatingId}
                    onToggleExpanded={key => setExpandedQualityKey(current => current === key ? null : key)}
                    onToggleComparison={toggleCostingSelection}
                    onOpen={quote => handleRestore(quote, 'edit')}
                    onStartFrom={quote => handleRestore(quote, 'duplicate')}
                    onExport={setQuoteToExport}
                    onAudit={quote => { void auditQuote(quote) }}
                    auditingId={updatingId}
                    onToggleFavorite={quote => { void handleLibraryState(quote, { isFavorite: !quote.is_favorite }) }}
                    onToggleArchived={requestArchiveState}
                    onOpenUsage={openAppliedProduction}
                    factoryInputsCapturedLabel={t('estimator.sprint1.baseline_captured')}
                />
            ) : !canUseProduction || !canUseQuotationWorkflow ? (
                <div>
                    <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[980px] border-collapse text-left">
                            <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
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
                            <tbody className="divide-y divide-slate-100">
                                {filteredQuotes.map(quote => {
                                    const selected = selectedCostingIds.includes(quote.id)
                                    const metrics = getSavedCostingMetrics(quote)
                                    const previousVersion = getPreviousCostingVersion(quote, quotes)
                                    const costMovement = getProductionCostMovement(quote, previousVersion)
                                    return (
                                        <tr key={quote.id} className={selected ? 'bg-blue-50/60' : 'hover:bg-slate-50/70'}>
                                            <td className="px-4 py-4 align-middle">
                                                <input
                                                    type="checkbox"
                                                    checked={selected}
                                                    onChange={() => toggleCostingSelection(quote.id)}
                                                    aria-label={`Select ${quote.quality_label || 'Untitled costing'} for comparison`}
                                                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                                                />
                                            </td>
                                            <td className="max-w-[240px] px-4 py-4">
                                                <p className="truncate text-sm font-bold text-slate-950" aria-label={getLegacyVersionLabel(quote)}>{getSavedCostingIdentity(quote).label}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                    <span>Saved {formatDateOnly(quote.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                    {getCostingStatus(quote) !== 'verified' && <Badge variant="outline" className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-bold text-amber-800">{getCostingBadge(getCostingStatus(quote))}</Badge>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-mono text-sm font-semibold text-slate-700">{formatCostingMoneyPerM(getProductionCostPerM(quote))}</p>
                                                {costMovement !== null && (
                                                    <p className={`mt-1 text-[11px] font-semibold ${costMovement > 0 ? 'text-amber-700' : costMovement < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                        {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-sm font-bold text-orange-700">{formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)}</td>
                                            <td className={`px-4 py-4 font-mono text-sm font-bold ${(metrics.actualMarginPct ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                                {formatCostingPercent(metrics.actualMarginPct)}
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-600">{Number(quote.meters || 0).toLocaleString('en-IN')} m</td>
                                            <td className="px-4 py-4 text-xs font-medium text-slate-500">{formatSuratDateTime(quote.updated_at)}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex justify-end gap-1">
                                                    {!quote.is_archived && <Button variant="ghost" size="sm" onClick={() => handleRestore(quote, 'edit')} className="h-9 text-xs font-semibold text-blue-700">{tx('Open')}</Button>}
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestore(quote, 'duplicate')} className="h-9 text-xs font-semibold">
                                                        <Copy className="h-3.5 w-3.5" /> {tx('Use as Starting Point')}
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setQuoteToExport(quote)} className="h-9 text-xs font-semibold">
                                                        <Eye className="h-3.5 w-3.5" /> {tx('Preview')}
                                                    </Button>
                                                    {getCostingStatus(quote) !== 'verified' && <Button variant="ghost" size="sm" onClick={() => { void auditQuote(quote) }} disabled={updatingId === quote.id} className="h-9 text-xs font-semibold text-amber-700">
                                                        {updatingId === quote.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} {tx(updatingId === quote.id ? 'Checking…' : 'Check saved numbers')}
                                                    </Button>}
                                                    <Button variant="ghost" size="icon" onClick={() => handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className={quote.is_favorite ? 'h-9 w-9 text-amber-500' : 'h-9 w-9 text-slate-500'} aria-label={quote.is_favorite ? `Remove ${quote.quality_label || 'costing'} from favourites` : `Add ${quote.quality_label || 'costing'} to favourites`}>
                                                        <Star className="h-4 w-4" fill={quote.is_favorite ? 'currentColor' : 'none'} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => requestArchiveState(quote)} disabled={updatingId === quote.id} className="h-9 w-9 text-slate-500" aria-label={quote.is_archived ? `Restore costing snapshot ${quote.quality_label || 'costing'}` : `Archive costing snapshot ${quote.quality_label || 'costing'}`}>
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
                                <Card key={quote.id} className={selected ? 'border-blue-300 bg-blue-50/40 shadow-sm' : 'border-slate-200 bg-white shadow-sm'}>
                                    <CardContent className="p-4">
                                        <div className="flex items-start gap-3">
                                            <input
                                                type="checkbox"
                                                checked={selected}
                                                onChange={() => toggleCostingSelection(quote.id)}
                                                aria-label={`Select ${quality} for comparison`}
                                                className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-bold text-slate-950" aria-label={getLegacyVersionLabel(quote)}>{getSavedCostingIdentity(quote).label}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                                    <span>Updated {formatSuratDateTime(quote.updated_at)}</span>
                                                    {getCostingStatus(quote) !== 'verified' && <Badge variant="outline" className="border-amber-200 bg-amber-50 px-1.5 py-0 text-[10px] font-bold text-amber-800">{getCostingBadge(getCostingStatus(quote))}</Badge>}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('common.production_cost_per_m')}</p>
                                                <p className="mt-1 font-mono text-sm font-bold text-slate-800">{formatCostingMoneyPerM(getProductionCostPerM(quote))}</p>
                                                {costMovement !== null && (
                                                    <p className={`mt-1 text-[10px] font-semibold ${costMovement > 0 ? 'text-amber-700' : costMovement < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                        {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('common.suggested_selling_price_per_m')}</p>
                                                <p className="mt-1 font-mono text-sm font-bold text-orange-700">{formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{t('common.margin')}</p>
                                                <p className={`mt-1 font-mono text-sm font-bold ${(metrics.actualMarginPct ?? 0) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{formatCostingPercent(metrics.actualMarginPct)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Quantity</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-700">{Number(quote.meters || 0).toLocaleString('en-IN')} m</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                                            {!quote.is_archived && <Button variant="outline" size="sm" onClick={() => handleRestore(quote, 'edit')} className="h-10 text-xs font-semibold text-blue-700">Open</Button>}
                                            <Button variant="outline" size="sm" onClick={() => handleRestore(quote, 'duplicate')} aria-label="Use as Starting Point" className="h-10 text-xs font-semibold">
                                                <Copy className="h-3.5 w-3.5" /> {tx('Use as Starting Point')}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => setQuoteToExport(quote)} className="h-10 text-xs font-semibold">
                                                <Eye className="h-3.5 w-3.5" /> {tx('Preview')}
                                            </Button>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className={quote.is_favorite ? 'h-9 text-xs text-amber-600' : 'h-9 text-xs text-slate-600'}>
                                                <Star className="h-3.5 w-3.5" fill={quote.is_favorite ? 'currentColor' : 'none'} /> {tx(quote.is_favorite ? 'Favourited' : 'Favourite')}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => requestArchiveState(quote)} disabled={updatingId === quote.id} className="h-9 text-xs text-slate-600" aria-label={`${quote.is_archived ? 'Restore costing snapshot' : 'Archive costing snapshot'} ${quote.quality_label || 'costing'}`}>
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
                            <Card key={quote.id} className="border-slate-200/60 shadow-sm hover:shadow-md transition-shadow relative group">
                                <CardContent className="p-5 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="space-y-1 w-full min-w-0 pr-2">
                                            <h3 className="text-lg font-black text-slate-900 truncate tracking-tight">
                                                {isCosting ? (quote.quality_label || 'Untitled costing') : quote.party_name}
                                            </h3>
                                            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-none truncate">
                                                {isCosting ? `Saved Costing · v${Number(quote.version_number ?? 1)}` : quote.quality_label}
                                            </p>
                                            {hasQuotationLifecycle && <p className="text-[11px] font-medium text-slate-500">Status updated {formatQuoteTimestamp(quote.updated_at)}</p>}
                                        </div>
                                        <div className="flex flex-wrap justify-end gap-1">
                                            <Badge variant="outline" className={`${isCosting ? 'border-orange-200 bg-orange-50 text-orange-700' : STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG]?.color} capitalize font-bold`}>
                                                {isCosting ? (quote.id === updatingId ? 'Updating' : 'Saved Costing') : STATUS_CONFIG[quote.status]?.label ?? quote.status}
                                            </Badge>
                                            {getCostingStatus(quote) !== 'verified' && <Badge variant="outline" className="border-amber-200 bg-amber-50 text-[10px] font-bold text-amber-800">{getCostingBadge(getCostingStatus(quote))}</Badge>}
                                        </div>
                                    </div>

                                    {hasQuotationLifecycle && (
                                        <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50/50 p-3 text-[11px] text-slate-600">
                                            <p className="font-bold uppercase tracking-wide text-blue-700">Quotation ledger</p>
                                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
                                                <p><span className="font-semibold text-slate-500">Identifier:</span> {quote.quotation_reference || `QT-${quote.id.slice(0, 8).toUpperCase()}`}</p>
                                                <p><span className="font-semibold text-slate-500">Customer:</span> {quote.party_name || 'Not recorded'}</p>
                                                <p><span className="font-semibold text-slate-500">Created:</span> {formatQuoteTimestamp(quote.created_at)}</p>
                                                <p><span className="font-semibold text-slate-500">Valid until:</span> {quote.quotation_valid_until ? formatDateOnly(quote.quotation_valid_until, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not set'}</p>
                                                <p><span className="font-semibold text-slate-500">Price basis:</span> {formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)} · {Number(quote.meters || 0).toLocaleString('en-IN')} m</p>
                                                <p><span className="font-semibold text-slate-500">Quoted amount:</span> {formatQuotationAmount(metrics.suggestedSellingPricePerM, quote.meters)}</p>
                                                <p><span className="font-semibold text-slate-500">Sent:</span> {formatQuoteTimestamp(quote.sent_at)}</p>
                                            </div>
                                            <p className="mt-2 font-medium text-slate-500">{getQuotationNextAction(quote.status)}</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">{isCosting ? t('common.suggested_selling_price_per_m') : t('common.quotation_price')}</p>
                                            <p className="text-base font-black font-mono text-indigo-600">{formatCostingMoneyPerM(metrics.suggestedSellingPricePerM)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">{t('common.margin')}</p>
                                            <p className={`text-base font-black font-mono ${(metrics.actualMarginPct ?? 0) < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                                {formatCostingPercent(metrics.actualMarginPct)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">{t('common.production_cost_per_m')}</p>
                                            <p className="text-xs font-bold font-mono text-slate-600 mt-0.5">{formatCostingMoneyPerM(getProductionCostPerM(quote))}</p>
                                            {isCosting && costMovement != null && (
                                                <p className={`mt-1 text-[10px] font-bold ${costMovement > 0 ? 'text-red-600' : costMovement < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                    {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">{t('common.date')}</p>
                                            <p className="text-xs font-bold text-slate-600 mt-0.5">{formatDateOnly(quote.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-4 border-t border-slate-100 space-y-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-1">
                                                {linkedOrder && (
                                                    <Badge variant="outline" className="bg-emerald-50 border-emerald-200 text-emerald-700 font-bold">
                                                        Order #{linkedOrder.id.split('-')[0]}
                                                        {linkedOrder.status === 'completed' && <CheckCircle2 className="h-3 w-3 ml-1" />}
                                                    </Badge>
                                                )}
                                            </div>
                                            <div className="ml-auto flex flex-wrap justify-end gap-1">
                                                <Button
                                                    variant="ghost"
                                                    className="h-11 px-3 text-xs font-bold text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 lg:h-7 lg:px-2"
                                                    onClick={() => handleRestore(quote, 'edit')}
                                                    disabled={quote.is_archived}
                                                >
                                                    {quote.is_archived ? 'Archived · restore to edit' : isCosting ? t('common.open_and_save_new_version') : ((quote.status === 'draft' || quote.status === 'sent') ? 'Edit' : 'Re-estimate')}
                                                    <ArrowRight className="h-4 w-4 lg:h-3 lg:w-3 ml-1" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-11 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:h-7 lg:px-2"
                                                    onClick={() => handleRestore(quote, 'duplicate')}
                                                >
                                                    <Copy className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
                                                    {isCosting ? (canUseQuotationWorkflow ? t('common.prepare_quotation') : t('common.use_as_starting_point')) : t('common.duplicate')}
                                                </Button>
                                                <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-slate-600 lg:h-7 lg:px-2" onClick={() => setQuoteToExport(quote)}>
                                                    <Eye className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> {t('common.preview')}
                                                </Button>
                                                {hasQuotationLifecycle && <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:h-7 lg:px-2" onClick={() => { void openQuoteHistory(quote) }}>
                                                    <History className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> History
                                                </Button>}
                                                {getCostingStatus(quote) !== 'verified' && <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-amber-700 lg:h-7 lg:px-2" onClick={() => { void auditQuote(quote) }} disabled={updatingId === quote.id}>
                                                    {updatingId === quote.id ? <Loader2 className="mr-1 h-4 w-4 animate-spin lg:h-3 lg:w-3" /> : <CheckCircle2 className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />} {updatingId === quote.id ? 'Checking…' : 'Check saved numbers'}
                                                </Button>}
                                                <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-slate-600 lg:h-7 lg:px-2" onClick={() => toggleCostingSelection(quote.id)}>
                                                    <GitCompareArrows className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> {selectedCostingIds.includes(quote.id) ? 'Selected' : t('common.compare')}
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={quote.is_favorite ? `Remove ${quote.quality_label || 'record'} from favourites` : `Add ${quote.quality_label || 'record'} to favourites`} onClick={() => void handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className="h-9 w-9">
                                                    <Star className={`h-4 w-4 ${quote.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-500'}`} />
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={`${quote.is_archived ? 'Restore costing snapshot' : 'Archive costing snapshot'} ${quote.quality_label || 'record'}`} onClick={() => requestArchiveState(quote)} disabled={updatingId === quote.id} className="h-9 w-9 text-slate-500">
                                                    {updatingId === quote.id ? <Loader2 className="h-4 w-4 animate-spin" /> : quote.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                </Button>
                                            </div>
                                        </div>

                                        {hasQuotationLifecycle && quote.status === 'draft' && !linkedOrder && (
                                            <Button
                                                size="sm"
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold gap-2"
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
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2"
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
                                                    className="border-red-200 text-red-700 hover:bg-red-50 font-bold gap-2"
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
                                                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
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

            <Dialog open={Boolean(quoteHistoryFor)} onOpenChange={open => {
                if (!open) {
                    setQuoteHistoryFor(null)
                    setQuoteHistoryRows([])
                    setQuoteHistoryError(null)
                }
            }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-blue-600" /> Quotation history</DialogTitle>
                        <DialogDescription>
                            {quoteHistoryFor?.party_name || 'Quotation'} · {quoteHistoryFor?.quality_label || 'Unnamed quality'}. Status changes and their recorded times are shown here. Sent: {formatQuoteTimestamp(quoteHistoryFor?.sent_at)}.
                        </DialogDescription>
                    </DialogHeader>
                    {quoteHistoryLoading ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500" role="status" aria-live="polite"><Loader2 className="h-5 w-5 animate-spin text-blue-600" /> Loading quotation history…</div>
                    ) : quoteHistoryError ? (
                        <p role="alert" className="py-8 text-center text-sm font-medium text-destructive">{quoteHistoryError}</p>
                    ) : quoteHistoryRows.length > 0 ? (
                        <div className="max-h-[55vh] space-y-2 overflow-y-auto pr-1">
                            {quoteHistoryRows.map((row, index) => {
                                const toConfig = row.to ? STATUS_CONFIG[row.to] : null
                                const fromLabel = row.from ? STATUS_CONFIG[row.from].label : 'Created'
                                return (
                                    <div key={`${row.changedAt}-${index}`} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                                        <span className={`mt-0.5 inline-flex min-h-7 items-center rounded-full border px-2 text-[11px] font-bold ${toConfig?.color ?? 'border-slate-200 bg-white text-slate-700'}`}>
                                            {toConfig?.label ?? row.to ?? 'Recorded'}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-semibold text-slate-900">{fromLabel} <span className="font-normal text-slate-500">→</span> {toConfig?.label ?? row.to ?? 'Recorded'}</p>
                                            <p className="mt-1 text-xs text-slate-500">{formatQuoteTimestamp(row.changedAt)} · {row.changedBy ? 'Owner action' : 'System record'}</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-600">
                            No status changes recorded yet. This quotation is currently <span className="font-bold">{quoteHistoryFor ? STATUS_CONFIG[quoteHistoryFor.status].label : 'Draft'}</span>.
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setQuoteHistoryFor(null)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {quoteToExport && (
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

            <Dialog open={showComparison} onOpenChange={setShowComparison}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitCompareArrows className="h-5 w-5 text-blue-600" /> Compare Saved Costings
                        </DialogTitle>
                        <DialogDescription>Compare two immutable snapshots using the same saved calculation and rounding contract. The current Rate Book is not read.</DialogDescription>
                    </DialogHeader>
                    {comparisonCostings.length === 2 && comparison && (
                        <div className="space-y-3">
                            <div className={`rounded-xl border px-4 py-3 text-xs ${comparison.comparable ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                                <p className="font-bold">{comparison.comparable ? 'Canonical comparison ready' : 'Canonical comparison needs review'}</p>
                                <p className="mt-1 leading-relaxed">{comparison.canonical.message || `Formula ${comparison.canonical.leftCalculationVersion || 'unknown'} · rounding ${comparison.canonical.leftSnapshotSchemaVersion ? `snapshot v${comparison.canonical.leftSnapshotSchemaVersion}` : 'legacy'} · detail source ${comparison.canonical.source.replace('_', ' ')}.`}</p>
                                <p className="mt-1 font-semibold">Change is calculated as New minus Old. Cost-driving changes are separated from reference/context changes.</p>
                                <p className="mt-1 font-semibold">{formatSuggestedPriceMovement(comparison.price.sellingPricePerM)}</p>
                            </div>
                            <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                                <table className="w-full min-w-[760px] text-sm">
                                    <thead className="bg-slate-50 text-left">
                                        <tr>
                                            <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Metric</th>
                                            {comparisonCostings.map((costing, index) => {
                                                const identity = getSavedCostingIdentity(costing)
                                                return <th key={costing.id} className="px-4 py-3 font-bold text-slate-950"><span className="block">{index === 0 ? 'Old snapshot' : 'New snapshot'}</span><span className="mt-1 block text-xs font-semibold text-slate-700">{identity.label}</span><span className="mt-1 block text-[10px] font-medium text-slate-500">saved {formatDateOnly(costing.created_at, { day: 'numeric', month: 'short', year: 'numeric' })}</span></th>
                                            })}
                                            <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {comparisonGroups.map(group => (
                                            <Fragment key={group.key}>
                                                <tr className="bg-blue-50/70">
                                                    <th colSpan={4} className="px-4 py-2.5 text-left text-[11px] font-black uppercase tracking-wider text-blue-900">
                                                        {group.title}
                                                    </th>
                                                </tr>
                                                <tr className="bg-blue-50/30">
                                                    <td colSpan={4} className="px-4 py-2 text-xs leading-relaxed text-slate-600">{group.description}</td>
                                                </tr>
                                                {group.sections.map(section => (
                                                    <Fragment key={`${group.key}-${section.title}`}>
                                                        <tr key={`${group.key}-${section.title}-heading`} className="bg-slate-50/70">
                                                            <th colSpan={4} className="px-4 py-2 text-left text-[11px] font-black uppercase tracking-wider text-slate-600">
                                                                <span>{section.title}</span>{section.changed && <Badge variant="outline" className="ml-2 border-blue-200 bg-blue-50 text-[10px] text-blue-700">Changed</Badge>}
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
                                                                    <td className="px-4 py-3 font-semibold text-slate-600">{row.label}</td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                                                                        <span>{left}{row.unit === 'rate' && left !== 'Not available' ? '/kg' : ''}</span>
                                                                        {row.context?.left && <span className="mt-1 block font-sans text-[10px] font-medium leading-4 text-slate-500">{row.context.left}</span>}
                                                                    </td>
                                                                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                                                                        <span>{right}{row.unit === 'rate' && right !== 'Not available' ? '/kg' : ''}</span>
                                                                        {row.context?.right && <span className="mt-1 block font-sans text-[10px] font-medium leading-4 text-slate-500">{row.context.right}</span>}
                                                                    </td>
                                                                    <td className={`px-4 py-3 font-mono font-bold ${row.changed ? numericDelta != null && numericDelta > 0 ? 'text-amber-700' : 'text-blue-700' : 'text-slate-500'}`}>{change}</td>
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
                            <Package className="h-5 w-5 text-emerald-600" />
                            Create active order from accepted quote
                        </DialogTitle>
                        <DialogDescription>
                            This is the only production entry point now. The quote stays accepted and becomes linked to the new live order.
                        </DialogDescription>
                    </DialogHeader>

                    {quoteToConvert && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                                <p className="text-sm font-black text-slate-900">{quoteToConvert.party_name}</p>
                                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mt-1">{quoteToConvert.quality_label}</p>
                                <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-bold">Quote Price</p>
                                        <p className="font-mono font-black text-indigo-600">₹{Number(quoteToConvert.quote_price_per_meter).toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="text-slate-400 uppercase tracking-wider font-bold">Quoted Qty</p>
                                        <p className="font-mono font-black text-slate-900">{Number(quoteToConvert.meters ?? 0).toLocaleString('en-IN')} m</p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs uppercase font-black text-slate-500">Total metres</Label>
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
                                    <Label className="text-xs uppercase font-black text-slate-500">Deadline</Label>
                                    <Input
                                        type="date"
                                        value={convertDeadline}
                                        onChange={event => setConvertDeadline(event.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs uppercase font-black text-slate-500">Order notes</Label>
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
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
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
                            <CheckCircle2 className="h-5 w-5 text-indigo-600" />
                            Accept this quote?
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm leading-relaxed">
                            Yarn rates and price will be locked. A later re-estimate creates a linked new quote without changing this record.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 justify-end pt-2">
                        <Button variant="ghost" onClick={() => setQuoteToAccept(null)}>
                            Cancel
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold"
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
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            Replace estimator draft?
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 text-sm leading-relaxed">
                            A local Cost Estimate draft already exists. Restoring this saved estimate will replace it.
                        </DialogDescription>
                    </DialogHeader>
                    {existingDraftForRestore && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
                            <p className="font-black">{existingDraftForRestore.partyName || 'Untitled draft'}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-amber-700">
                                {existingDraftForRestore.qualityLabel || 'No quality label'}
                            </p>
                            <p className="mt-2 text-xs font-medium text-amber-800">
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
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            onClick={() => quoteToRestore && restoreQuoteToEstimator(quoteToRestore, restoreMode)}
                        >
                            Overwrite draft
                            <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}
