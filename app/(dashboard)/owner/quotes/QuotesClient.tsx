'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { calcFullTotals, makeDefaultEstimateState } from '@/lib/estimator'
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
import { convertAcceptedQuoteToOrder, deleteEstimatorQuote, updateQuoteStatus, updateSavedCostingLibraryState } from '../estimator/actions'
import { toast } from 'sonner'
import { addDays, format } from 'date-fns'
import { getCurrentTimestampMs } from '@/lib/time'
import {
    History,
    CheckCircle2,
    FileText,
    ArrowRight,
    Loader2,
    Package,
    AlertTriangle,
    Copy,
    Trash2,
    XCircle,
    Search,
    Download,
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
    compareSavedCostings,
    buildSavedQualityRecipeState,
    filterAndSortSavedCostings,
    getPreviousCostingVersion,
    normalizeSavedWarpRows,
    normalizeSavedWeftRows,
    type SavedQualityFactoryProfile,
    type SavedQualityFixedWorker,
    type SavedQualityRecipe,
    type SavedCostingMarginFilter,
    type SavedCostingSort,
} from '@/lib/saved-costings'
import { CostingExportDialog } from '@/components/estimator/CostingExportDialog'
import { createCostingExportModel } from '@/lib/estimator-export'
import { canUseQuotationLifecycle, isStandaloneCosting, type CostingRecordKind } from '@/lib/costing-workspace'

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
    party_name: string
    quality_label: string | null
    quote_price_per_meter: number
    landed_cost_per_meter: number
    intended_margin_percent: number
    created_at: string
    updated_at: string
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
    orders?: QuoteLinkedOrder | QuoteLinkedOrder[] | null
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
        overheadPct: numberOr(snapshot.overheadPct ?? quote.overhead_pct, base.overheadPct),
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

function getSavedCostingTotals(quote: QuoteRow) {
    try {
        return calcFullTotals(buildDraftStateFromQuote(quote))
    } catch (error) {
        console.error('Unable to calculate a saved costing snapshot', quote.id, error)
        return null
    }
}

function getProductionCostPerM(quote: QuoteRow) {
    return getSavedCostingTotals(quote)?.totalProductionCostPerM ?? Number(quote.landed_cost_per_meter)
}

function getProductionCostMovement(current: QuoteRow, previous: QuoteRow | null) {
    return previous ? getProductionCostPerM(current) - getProductionCostPerM(previous) : null
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
    onOpenUsage,
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
    onOpenUsage: (quote: QuoteRow, order: QuoteLinkedOrder) => void
}) {
    return (
        <div className="space-y-3">
            {groups.map(group => {
                const isExpanded = expandedKey === group.key
                const latest = group.records[0] ?? null
                const latestTotals = latest ? getSavedCostingTotals(latest) : null
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
                                            {group.template && <Badge variant="outline" className="border-blue-200 bg-blue-50 text-[10px] font-bold text-blue-700">Saved quality</Badge>}
                                            {latest && <Badge variant="outline" className="text-[10px] font-bold">v{Number(latest.version_number ?? 1)}</Badge>}
                                        </span>
                                        <span className="mt-1 block text-xs text-slate-500">
                                            {group.records.length > 0
                                                ? `${group.records.length} costing ${group.records.length === 1 ? 'snapshot' : 'snapshots'} · updated ${format(new Date(group.updatedAt), 'MMM d, yyyy')}`
                                                : 'Saved recipe · no costing history yet'}
                                        </span>
                                    </span>
                                </button>

                                <div className={`grid gap-2 ${canUseProduction ? 'grid-cols-3 sm:min-w-[420px]' : 'grid-cols-2 sm:min-w-[300px]'}`}>
                                    <div className="rounded-lg bg-slate-50 px-3 py-2">
                                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{latest ? 'Latest cost' : 'Current recipe'}</p>
                                        <p className="mt-1 font-mono text-sm font-black text-slate-900">{latest
                                            ? `₹${getProductionCostPerM(latest).toFixed(2)}/m`
                                            : group.currentRecipeCostPerM != null
                                                ? `₹${group.currentRecipeCostPerM.toFixed(2)}/m`
                                                : '—'}</p>
                                    </div>
                                    {canUseProduction ? <>
                                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Used for</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">{usages.length} {usages.length === 1 ? 'run' : 'runs'}</p>
                                        </div>
                                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Produced</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">{totalProduced.toLocaleString('en-IN', { maximumFractionDigits: 1 })} m</p>
                                        </div>
                                    </> : (
                                        <div className="rounded-lg bg-slate-50 px-3 py-2">
                                            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">History</p>
                                            <p className="mt-1 text-sm font-black text-slate-900">{group.records.length} {group.records.length === 1 ? 'snapshot' : 'snapshots'}</p>
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
                                    {!latest || !latestTotals ? (
                                        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center">
                                            {latest ? <AlertTriangle className="h-6 w-6 text-amber-500" /> : <FileText className="h-6 w-6 text-slate-400" />}
                                            <p className="mt-3 text-sm font-bold text-slate-700">{latest
                                                ? 'Detailed breakdown unavailable for this legacy snapshot'
                                                : group.currentRecipeCostPerM != null
                                                    ? `Current recipe estimate: ₹${group.currentRecipeCostPerM.toFixed(2)}/m`
                                                    : 'No costing saved for this quality yet'}</p>
                                            <p className="mt-1 max-w-md text-xs text-slate-500">{latest
                                                ? 'The saved commercial totals remain available in costing history. Open and save this snapshot once to refresh its detailed analysis.'
                                                : group.currentRecipeCostPerM != null
                                                    ? 'This is a live estimate from the saved yarn recipe and current factory costs, not a historical snapshot. Set a costing quantity and choose Save Costing to preserve its full analysis.'
                                                    : canUseProduction
                                                        ? 'Open Cost Estimate, choose this saved quality, set the costing quantity, and save the result. Its analysis and production usage will then appear here.'
                                                        : 'Open Cost Estimate, choose this saved quality, set the costing quantity, and choose Save Costing. Its analysis will then appear here.'}</p>
                                        </div>
                                    ) : (
                                        <div className={`grid gap-4 ${canUseProduction ? 'xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]' : ''}`}>
                                            {canUseProduction && <section className="rounded-xl border border-slate-200 bg-white p-4">
                                                <div className="flex flex-wrap items-start justify-between gap-3">
                                                    <div>
                                                        <p className="text-sm font-black text-slate-950">Latest costing breakdown</p>
                                                        <p className="mt-1 text-xs text-slate-500">Snapshot v{Number(latest.version_number ?? 1)} · {format(new Date(latest.created_at), 'MMM d, yyyy')}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-2">
                                                        <Button variant="outline" size="sm" onClick={() => onOpen(latest)} disabled={updatingId === latest.id}>Open & Update</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onStartFrom(latest)}><Copy className="h-3.5 w-3.5" /> Start From</Button>
                                                        <Button variant="outline" size="sm" onClick={() => onExport(latest)}><Download className="h-3.5 w-3.5" /> Export</Button>
                                                    </div>
                                                </div>

                                                <div className="mt-4 divide-y divide-slate-100 text-sm">
                                                    {[
                                                        ['Warp yarn', latestTotals.warpCostPerM],
                                                        ['Weft yarn', latestTotals.weftCostPerM],
                                                        ['Weaving', latestTotals.weaveCostPerM],
                                                        ['Warping & sizing', latestTotals.warpingAndSizingPerM],
                                                        ['Processing & finishing', latestTotals.windingPerM + latestTotals.processingPerM + latestTotals.finishingPerM],
                                                        ['Factory overhead', latestTotals.overheadPerM],
                                                    ].map(([label, value]) => (
                                                        <div key={String(label)} className="flex items-center justify-between py-2">
                                                            <span className="text-slate-600">{label}</span>
                                                            <span className="font-mono font-semibold text-slate-800">₹{Number(value).toFixed(2)}/m</span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <div className="mt-2 grid grid-cols-3 gap-2 rounded-lg bg-slate-950 p-3 text-white">
                                                    <div><p className="text-[10px] uppercase text-slate-400">Production cost</p><p className="mt-1 font-mono text-sm font-black">₹{latestTotals.totalProductionCostPerM.toFixed(2)}/m</p></div>
                                                    <div><p className="text-[10px] uppercase text-slate-400">Suggested price</p><p className="mt-1 font-mono text-sm font-black text-orange-300">₹{Number(latest.quote_price_per_meter).toFixed(2)}/m</p></div>
                                                    <div><p className="text-[10px] uppercase text-slate-400">Margin</p><p className="mt-1 font-mono text-sm font-black text-emerald-300">{Number(latest.intended_margin_percent).toFixed(1)}%</p></div>
                                                </div>
                                            </section>}

                                            <section className="rounded-xl border border-slate-200 bg-white p-4">
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
                                            </section>
                                        </div>
                                    )}

                                    {group.records.length > 0 && (
                                        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                                            <p className="text-sm font-black text-slate-950">Costing history</p>
                                            <p className="mt-1 text-xs text-slate-500">Select any two snapshots to compare their commercial assumptions.</p>
                                            <div className="mt-3 overflow-x-auto">
                                                <table className="w-full min-w-[720px] text-left text-xs">
                                                    <thead className="border-b border-slate-200 text-[10px] font-bold uppercase tracking-wide text-slate-500"><tr><th className="w-10 py-2"><span className="sr-only">Compare</span></th><th className="py-2">Snapshot</th><th className="py-2">Context</th><th className="py-2">Cost</th><th className="py-2">Selling price</th><th className="py-2">Margin</th><th className="py-2">Costing qty.</th><th className="py-2 text-right">Actions</th></tr></thead>
                                                    <tbody className="divide-y divide-slate-100">
                                                        {group.records.map(record => (
                                                            <tr key={record.id}>
                                                                <td className="py-3"><input type="checkbox" checked={selectedCostingIds.includes(record.id)} onChange={() => onToggleComparison(record.id)} aria-label={`Select ${group.name} version ${Number(record.version_number ?? 1)} for comparison`} className="h-4 w-4 accent-blue-600" /></td>
                                                                <td className="py-3 font-bold text-slate-900">v{Number(record.version_number ?? 1)}<span className="ml-2 font-normal text-slate-500">{format(new Date(record.created_at), 'MMM d, yyyy')}</span></td>
                                                                <td className="py-3 capitalize text-slate-600">{record.record_kind === 'market_run' ? 'Market run' : record.record_kind === 'quotation' ? `Quotation · ${record.party_name}` : 'Internal costing'}</td>
                                                                <td className="py-3 font-mono text-slate-700">₹{getProductionCostPerM(record).toFixed(2)}/m</td>
                                                                <td className="py-3 font-mono font-bold text-orange-700">₹{Number(record.quote_price_per_meter).toFixed(2)}/m</td>
                                                                <td className="py-3 font-mono font-bold text-emerald-700">{Number(record.intended_margin_percent).toFixed(1)}%</td>
                                                                <td className="py-3 text-slate-600">{Number(record.meters ?? 0).toLocaleString('en-IN')} m</td>
                                                                <td className="py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onOpen(record)}>Open</Button></td>
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
    const router = useRouter()
    const [quotes, setQuotes] = useState<QuoteRow[]>(initialQuotes)
    const [updatingId, setUpdatingId] = useState<string | null>(null)
    const [filterStatus, setFilterStatus] = useState<string>(initialStatus || 'all')
    const [quoteToConvert, setQuoteToConvert] = useState<QuoteRow | null>(null)
    const [quoteToAccept, setQuoteToAccept] = useState<QuoteRow | null>(null)
    const [quoteToRestore, setQuoteToRestore] = useState<QuoteRow | null>(null)
    const [restoreMode, setRestoreMode] = useState<'edit' | 'duplicate'>('edit')
    const [quoteToDelete, setQuoteToDelete] = useState<QuoteRow | null>(null)
    const [existingDraftForRestore, setExistingDraftForRestore] = useState<EstimatorAutosaveData<QuoteDraftState> | null>(null)
    const [convertMeters, setConvertMeters] = useState('')
    const [convertDeadline, setConvertDeadline] = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
    const [convertNotes, setConvertNotes] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [costingSort, setCostingSort] = useState<SavedCostingSort>('recent')
    const [marginFilter, setMarginFilter] = useState<SavedCostingMarginFilter>('all')
    const [selectedCostingIds, setSelectedCostingIds] = useState<string[]>([])
    const [showComparison, setShowComparison] = useState(false)
    const [quoteToExport, setQuoteToExport] = useState<QuoteRow | null>(null)
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
        })
        if (!canUseProduction || !canUseQuotationWorkflow) return library.filter(quote => isStandaloneCosting(quote.record_kind))
        if (filterStatus === 'costings') return library.filter(quote => isStandaloneCosting(quote.record_kind))
        if (filterStatus === 'all') return library
        return library.filter(quote => canUseQuotationLifecycle(quote.record_kind, canUseProduction) && quote.status === filterStatus)
    },
    [canUseProduction, canUseQuotationWorkflow, costingSort, filterStatus, marginFilter, quotes, searchQuery, showArchived])
    const qualityGroups = useMemo(() => {
        const groups = new Map<string, SavedQualityGroup>()
        const labelIndex = new Map<string, string>()

        if (!showArchived) {
            for (const template of initialTemplates.filter(item => item.is_active !== false)) {
                const key = `template:${template.id}`
                groups.set(key, { key, name: template.name, template, records: [], updatedAt: template.updated_at, currentRecipeCostPerM: null })
                labelIndex.set(normalizeQualityKey(template.name), key)
            }
        }

        for (const record of quotes.filter(item => Boolean(item.is_archived) === showArchived)) {
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
                records: filterAndSortSavedCostings(group.records, { query: '', sort: 'recent', margin: 'all' }),
                currentRecipeCostPerM: group.template && group.records.length === 0
                    ? getCurrentRecipeCostPerM(group.template, initialProfile, initialWorkers)
                    : null,
            }))
            .filter(group => !query || normalizeQualityKey(`${group.name} ${group.records.map(record => record.party_name).join(' ')}`).includes(query))
            .filter(group => marginFilter === 'all' || filterAndSortSavedCostings(group.records, { query: '', sort: 'recent', margin: marginFilter }).length > 0)

        return visible.sort((a, b) => {
            if (costingSort === 'oldest') return Date.parse(a.updatedAt) - Date.parse(b.updatedAt)
            if (costingSort === 'margin_desc') return Number(b.records[0]?.intended_margin_percent ?? Number.NEGATIVE_INFINITY) - Number(a.records[0]?.intended_margin_percent ?? Number.NEGATIVE_INFINITY)
            if (costingSort === 'cost_asc') return (a.records[0] ? getProductionCostPerM(a.records[0]) : Number.POSITIVE_INFINITY) - (b.records[0] ? getProductionCostPerM(b.records[0]) : Number.POSITIVE_INFINITY)
            return Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
        })
    }, [costingSort, initialProfile, initialTemplates, initialWorkers, marginFilter, quotes, searchQuery, showArchived])
    const selectedCostings = useMemo(
        () => selectedCostingIds.map(id => quotes.find(quote => quote.id === id)).filter((quote): quote is QuoteRow => Boolean(quote)),
        [quotes, selectedCostingIds],
    )
    const selectedCostingStates = useMemo(
        () => selectedCostings.map(costing => {
            const state = buildDraftStateFromQuote(costing)
            return { state, totals: calcFullTotals(state) }
        }),
        [selectedCostings],
    )
    const comparison = selectedCostings.length === 2
        ? compareSavedCostings(selectedCostings[0], selectedCostings[1])
        : null
    const exportModel = useMemo(() => {
        if (!quoteToExport) return null
        const state = buildDraftStateFromQuote(quoteToExport)
        return createCostingExportModel({
            qualityLabel: quoteToExport.quality_label || quoteToExport.party_name,
            createdAt: quoteToExport.created_at,
            state,
            totals: calcFullTotals(state),
            suggestedSellingPricePerM: Number(quoteToExport.quote_price_per_meter),
        })
    }, [quoteToExport])

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
        if (!quote) return
        setUpdatingId(id)
        const res = await updateQuoteStatus(id, newStatus, quote.updated_at)
        setUpdatingId(null)
        if (res.error) {
            toast.error(res.error)
        } else {
            toast.success(`Quote marked as ${newStatus}`)
            setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...res.data, status: newStatus } : q))
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
            toast.error('Enter a valid order quantity before creating the active order')
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
            toast.error(res.error)
            return
        }

        toast.success('Accepted quote converted into an active order')
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
            const newDraft: EstimatorAutosaveData<QuoteDraftState> = {
                state: buildDraftStateFromQuote(quote),
                partyName: createsQuotationFromCosting ? '' : quote.party_name || '',
                qualityLabel: isDuplicate && canUseQuotationWorkflow && !isCosting ? `${quote.quality_label || 'Untitled'} Copy` : quote.quality_label || '',
                warpInstruction: quote.warp_instruction || linkedOrder?.warp_instruction || '',
                weftInstruction: quote.weft_instruction || linkedOrder?.weft_instruction || '',
                savedAt: getCurrentTimestampMs(),
                sourceQuoteId: isDuplicate ? undefined : quote.id,
                sourceQuoteUpdatedAt: isDuplicate ? undefined : quote.updated_at,
                sourceRecordKind: createsQuotationFromCosting
                    ? undefined
                    : quote.record_kind ?? (canUseQuotationWorkflow ? 'quotation' : 'costing'),
                templateId: quote.template_id ?? undefined,
                restoreOnEstimatorEntry: true,
            }
            localStorage.setItem(draftKey, JSON.stringify(newDraft))
            setQuoteToRestore(null)
            setExistingDraftForRestore(null)
            toast.success(createsQuotationFromCosting
                ? 'Costing loaded as a new customer quotation draft'
                : isDuplicate
                    ? (canUseQuotationWorkflow ? 'Quotation copied into a new Cost Estimate draft' : 'Costing loaded as a starting point')
                    : isCosting ? 'Costing snapshot restored' : 'Quotation snapshot restored')
            router.push('/owner/estimator')
        } catch (error) {
            toast.error('Browser storage is unavailable. The quote could not be opened in the estimator.')
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
            toast.error('Failed to restore snapshot')
            console.error(e)
        }
    }

    const handleDeleteQuote = async () => {
        if (!quoteToDelete) return
        setUpdatingId(quoteToDelete.id)
        const res = await deleteEstimatorQuote(quoteToDelete.id, quoteToDelete.updated_at)
        setUpdatingId(null)
        if (res.error) {
            toast.error(res.error)
            return
        }
        setQuotes(previous => previous.filter(quote => quote.id !== quoteToDelete.id))
        setQuoteToDelete(null)
        toast.success(isStandaloneCosting(quoteToDelete.record_kind) ? 'Costing deleted' : 'Quotation deleted')
    }

    const handleLibraryState = async (quote: QuoteRow, changes: { isArchived?: boolean; isFavorite?: boolean }) => {
        setUpdatingId(quote.id)
        const result = await updateSavedCostingLibraryState({
            id: quote.id,
            expectedUpdatedAt: quote.updated_at,
            ...changes,
        })
        setUpdatingId(null)
        if (result.error || !result.data) {
            toast.error(result.error ?? 'Saved costing could not be updated.')
            return
        }
        setQuotes(current => current.map(item => item.id === quote.id ? { ...item, ...result.data } : item))
        toast.success(changes.isArchived === true ? 'Costing archived' : changes.isArchived === false ? 'Costing restored' : changes.isFavorite ? 'Added to favourites' : 'Removed from favourites')
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <History className="h-6 w-6 text-indigo-500" />
                        {canUseQuotationWorkflow ? 'Costings & Quotations' : 'Saved Costings'}
                    </h1>
                    <p className="text-sm text-slate-500 font-medium">{canUseQuotationWorkflow ? 'Keep costing intelligence while adding customer quotation and production workflows.' : 'Saved qualities with costing history, breakdowns, and comparison in one place.'}</p>
                </div>
                <Button onClick={() => router.push('/owner/estimator')} className="h-11 bg-orange-600 text-white hover:bg-orange-700">
                    <Plus className="h-4 w-4" /> {canUseQuotationWorkflow ? 'New Estimate' : 'New Costing'}
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

            <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_170px_auto_auto]">
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                            <Input
                                value={searchQuery}
                                onChange={event => setSearchQuery(event.target.value)}
                                placeholder={canUseQuotationWorkflow ? 'Search party, quality or costing…' : 'Search quality or costing…'}
                                className="h-10 pl-9"
                            />
                        </div>
                        <select
                            aria-label="Sort saved costings"
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
                            onClick={() => setShowComparison(true)}
                            className="h-10"
                        >
                            <GitCompareArrows className="h-4 w-4" /> Compare {selectedCostings.length || ''}
                        </Button>
                        <Button variant={showArchived ? 'secondary' : 'outline'} onClick={() => { setShowArchived(current => !current); setSelectedCostingIds([]) }} className="h-10">
                            {showArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />} {showArchived ? 'Active' : 'Archived'}
                        </Button>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                        {showQualityLibrary
                            ? `${qualityGroups.length} ${showArchived ? 'archived ' : ''}${qualityGroups.length === 1 ? 'quality' : 'qualities'} shown · expand a quality to review its costing history.`
                            : `${filteredQuotes.length} ${showArchived ? 'archived ' : ''}${filteredQuotes.length === 1 ? 'record' : 'records'} shown · select any two to compare.`}
                    </p>
                </div>

            {(showQualityLibrary ? qualityGroups.length === 0 : filteredQuotes.length === 0) ? (
                <Card className="border-dashed border-2 border-slate-200 bg-slate-50/50">
                    <CardContent className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                        <div className="p-3 bg-white rounded-full shadow-sm shadow-slate-200/50">
                            <FileText className="h-6 w-6 text-slate-400" />
                        </div>
                        <p className="text-sm font-bold text-slate-600">{canUseQuotationWorkflow ? 'No costings or quotations found' : 'No saved qualities or costings found'}</p>
                        <p className="text-xs text-slate-500 max-w-xs">{
                            filterStatus === 'all'
                                ? (canUseQuotationWorkflow ? "You haven't saved any costings or quotations yet." : "Save a quality or Cost Estimate and it will appear here.")
                                : `No Quotations with status "${filterStatus}".`
                        }</p>
                        {(searchQuery || marginFilter !== 'all') && (
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => { setSearchQuery(''); setMarginFilter('all') }}
                                className="mt-2 font-bold text-indigo-600"
                            >
                                Clear search and filters
                            </Button>
                        )}
                        {canUseQuotationWorkflow && filterStatus !== 'all' && (
                            <Button variant="link" size="sm" onClick={() => setFilterStatus('all')} className="mt-2 text-indigo-600 font-bold">
                                Clear filters
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
                    onOpenUsage={openAppliedProduction}
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
                                    <th className="px-4 py-3">Production Cost</th>
                                    <th className="px-4 py-3">Suggested Selling Price</th>
                                    <th className="px-4 py-3">Margin</th>
                                    <th className="px-4 py-3">Quantity</th>
                                    <th className="px-4 py-3">Updated</th>
                                    <th className="px-4 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredQuotes.map(quote => {
                                    const selected = selectedCostingIds.includes(quote.id)
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
                                                <p className="truncate text-sm font-bold text-slate-950">{quote.quality_label || 'Untitled costing'} <span className="ml-1 text-xs font-semibold text-blue-600">v{Number(quote.version_number ?? 1)}</span></p>
                                                <p className="mt-1 text-xs text-slate-500">Saved {format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
                                            </td>
                                            <td className="px-4 py-4">
                                                <p className="font-mono text-sm font-semibold text-slate-700">₹{getProductionCostPerM(quote).toFixed(2)}/m</p>
                                                {costMovement !== null && (
                                                    <p className={`mt-1 text-[11px] font-semibold ${costMovement > 0 ? 'text-amber-700' : costMovement < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                        {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-4 font-mono text-sm font-bold text-orange-700">₹{Number(quote.quote_price_per_meter).toFixed(2)}/m</td>
                                            <td className={`px-4 py-4 font-mono text-sm font-bold ${Number(quote.intended_margin_percent) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>
                                                {Number(quote.intended_margin_percent).toFixed(1)}%
                                            </td>
                                            <td className="px-4 py-4 text-sm font-medium text-slate-600">{Number(quote.meters || 0).toLocaleString('en-IN')} m</td>
                                            <td className="px-4 py-4 text-xs font-medium text-slate-500">{format(new Date(quote.updated_at), 'MMM d, yyyy')}<br />{format(new Date(quote.updated_at), 'h:mm a')}</td>
                                            <td className="px-4 py-4">
                                                <div className="flex justify-end gap-1">
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestore(quote, 'edit')} className="h-9 text-xs font-semibold text-blue-700">Open</Button>
                                                    <Button variant="ghost" size="sm" onClick={() => handleRestore(quote, 'duplicate')} className="h-9 text-xs font-semibold">
                                                        <Copy className="h-3.5 w-3.5" /> Use as Starting Point
                                                    </Button>
                                                    <Button variant="ghost" size="sm" onClick={() => setQuoteToExport(quote)} className="h-9 text-xs font-semibold">
                                                        <Download className="h-3.5 w-3.5" /> Export
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className={quote.is_favorite ? 'h-9 w-9 text-amber-500' : 'h-9 w-9 text-slate-500'} aria-label={quote.is_favorite ? `Remove ${quote.quality_label || 'costing'} from favourites` : `Add ${quote.quality_label || 'costing'} to favourites`}>
                                                        <Star className="h-4 w-4" fill={quote.is_favorite ? 'currentColor' : 'none'} />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" onClick={() => handleLibraryState(quote, { isArchived: !quote.is_archived })} className="h-9 w-9 text-slate-500" aria-label={quote.is_archived ? `Restore ${quote.quality_label || 'costing'}` : `Archive ${quote.quality_label || 'costing'}`}>
                                                        {quote.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                    </Button>
                                                    {quote.status === 'draft' && (
                                                        <Button variant="ghost" size="icon" onClick={() => setQuoteToDelete(quote)} className="h-9 w-9 text-red-600" aria-label={`Delete ${quote.quality_label || 'costing'}`}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    )}
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
                                                <p className="truncate text-sm font-bold text-slate-950">{quality} <span className="ml-1 text-xs font-semibold text-blue-600">v{Number(quote.version_number ?? 1)}</span></p>
                                                <p className="mt-1 text-xs text-slate-500">Updated {format(new Date(quote.updated_at), 'MMM d, yyyy · h:mm a')}</p>
                                            </div>
                                        </div>
                                        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3">
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Production cost</p>
                                                <p className="mt-1 font-mono text-sm font-bold text-slate-800">₹{getProductionCostPerM(quote).toFixed(2)}/m</p>
                                                {costMovement !== null && (
                                                    <p className={`mt-1 text-[10px] font-semibold ${costMovement > 0 ? 'text-amber-700' : costMovement < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                        {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                    </p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Selling price</p>
                                                <p className="mt-1 font-mono text-sm font-bold text-orange-700">₹{Number(quote.quote_price_per_meter).toFixed(2)}/m</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Margin</p>
                                                <p className={`mt-1 font-mono text-sm font-bold ${Number(quote.intended_margin_percent) < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{Number(quote.intended_margin_percent).toFixed(1)}%</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Quantity</p>
                                                <p className="mt-1 text-sm font-semibold text-slate-700">{Number(quote.meters || 0).toLocaleString('en-IN')} m</p>
                                            </div>
                                        </div>
                                        <div className="mt-3 grid grid-cols-3 gap-2">
                                            <Button variant="outline" size="sm" onClick={() => handleRestore(quote, 'edit')} className="h-10 text-xs font-semibold text-blue-700">Open</Button>
                                            <Button variant="outline" size="sm" onClick={() => handleRestore(quote, 'duplicate')} aria-label="Use as Starting Point" className="h-10 text-xs font-semibold">
                                                <Copy className="h-3.5 w-3.5" /> Start From
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={() => setQuoteToExport(quote)} className="h-10 text-xs font-semibold">
                                                <Download className="h-3.5 w-3.5" /> Export
                                            </Button>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className={quote.is_favorite ? 'h-9 text-xs text-amber-600' : 'h-9 text-xs text-slate-600'}>
                                                <Star className="h-3.5 w-3.5" fill={quote.is_favorite ? 'currentColor' : 'none'} /> {quote.is_favorite ? 'Favourited' : 'Favourite'}
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleLibraryState(quote, { isArchived: !quote.is_archived })} className="h-9 text-xs text-slate-600">
                                                {quote.is_archived ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />} {quote.is_archived ? 'Restore' : 'Archive'}
                                            </Button>
                                        </div>
                                        {quote.status === 'draft' && (
                                            <Button variant="ghost" size="sm" onClick={() => setQuoteToDelete(quote)} className="mt-2 h-9 w-full text-xs text-red-600" aria-label={`Delete ${quality}`}>
                                                <Trash2 className="h-3.5 w-3.5" /> Delete costing
                                            </Button>
                                        )}
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
                                                {isCosting ? `Saved costing · v${Number(quote.version_number ?? 1)}` : quote.quality_label}
                                            </p>
                                        </div>
                                        <Badge variant="outline" className={`${isCosting ? 'border-orange-200 bg-orange-50 text-orange-700' : STATUS_CONFIG[quote.status as keyof typeof STATUS_CONFIG]?.color} capitalize font-bold`}>
                                            {isCosting ? (quote.id === updatingId ? 'Updating' : 'Costing') : quote.status}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">{isCosting ? 'Suggested Price' : 'Quotation Price'}</p>
                                            <p className="text-base font-black font-mono text-indigo-600">₹{Number(quote.quote_price_per_meter).toFixed(2)}/m</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Margin</p>
                                            <p className="text-base font-black font-mono text-emerald-600">
                                                {Number(quote.intended_margin_percent).toFixed(1)}%
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Production Cost</p>
                                            <p className="text-xs font-bold font-mono text-slate-600 mt-0.5">₹{getProductionCostPerM(quote).toFixed(2)}/m</p>
                                            {isCosting && costMovement != null && (
                                                <p className={`mt-1 text-[10px] font-bold ${costMovement > 0 ? 'text-red-600' : costMovement < 0 ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                    {costMovement === 0 ? 'No change' : `₹${Math.abs(costMovement).toFixed(2)}/m ${costMovement > 0 ? 'higher' : 'lower'}`} than v{Number(previousVersion?.version_number ?? 1)}
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase font-bold text-slate-400 tracking-wider">Date</p>
                                            <p className="text-xs font-bold text-slate-600 mt-0.5">{format(new Date(quote.created_at), 'MMM d, yyyy')}</p>
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
                                                >
                                                    {isCosting ? 'Open & Update' : ((quote.status === 'draft' || quote.status === 'sent') ? 'Edit' : 'Re-estimate')}
                                                    <ArrowRight className="h-4 w-4 lg:h-3 lg:w-3 ml-1" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    className="h-11 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:h-7 lg:px-2"
                                                    onClick={() => handleRestore(quote, 'duplicate')}
                                                >
                                                    <Copy className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
                                                    {isCosting ? (canUseQuotationWorkflow ? 'Prepare Quotation' : 'Use as Starting Point') : 'Duplicate'}
                                                </Button>
                                                <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-slate-600 lg:h-7 lg:px-2" onClick={() => setQuoteToExport(quote)}>
                                                    <Download className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> Export
                                                </Button>
                                                <Button variant="ghost" className="h-11 px-3 text-xs font-bold text-slate-600 lg:h-7 lg:px-2" onClick={() => toggleCostingSelection(quote.id)}>
                                                    <GitCompareArrows className="mr-1 h-4 w-4 lg:h-3 lg:w-3" /> {selectedCostingIds.includes(quote.id) ? 'Selected' : 'Compare'}
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={quote.is_favorite ? `Remove ${quote.quality_label || 'record'} from favourites` : `Add ${quote.quality_label || 'record'} to favourites`} onClick={() => void handleLibraryState(quote, { isFavorite: !quote.is_favorite })} className="h-9 w-9">
                                                    <Star className={`h-4 w-4 ${quote.is_favorite ? 'fill-amber-400 text-amber-500' : 'text-slate-500'}`} />
                                                </Button>
                                                <Button variant="ghost" size="icon" aria-label={`${quote.is_archived ? 'Restore' : 'Archive'} ${quote.quality_label || 'record'}`} onClick={() => void handleLibraryState(quote, { isArchived: !quote.is_archived })} className="h-9 w-9 text-slate-500">
                                                    {quote.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                                                </Button>
                                                {!linkedOrder && (isCosting || quote.status === 'draft' || quote.status === 'rejected') && (
                                                    <Button
                                                        variant="ghost"
                                                        className="h-11 px-3 text-xs font-bold text-red-600 hover:bg-red-50 hover:text-red-700 lg:h-7 lg:px-2"
                                                        onClick={() => setQuoteToDelete(quote)}
                                                        disabled={updatingId === quote.id}
                                                    >
                                                        <Trash2 className="mr-1 h-4 w-4 lg:h-3 lg:w-3" />
                                                        Delete
                                                    </Button>
                                                )}
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

             <CostingExportDialog
                open={Boolean(quoteToExport)}
                onOpenChange={open => { if (!open) setQuoteToExport(null) }}
                model={exportModel}
                 defaultCustomerName={quoteToExport && !isStandaloneCosting(quoteToExport.record_kind) ? quoteToExport.party_name : ''}
                 defaultBusinessName={organizationName}
             />

            <Dialog open={showComparison} onOpenChange={setShowComparison}>
                <DialogContent className="sm:max-w-4xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <GitCompareArrows className="h-5 w-5 text-blue-600" /> Compare Saved Costings
                        </DialogTitle>
                        <DialogDescription>Review the commercial difference between two immutable costing snapshots.</DialogDescription>
                    </DialogHeader>
                    {selectedCostings.length === 2 && comparison && (
                        <div className="max-h-[60vh] overflow-auto rounded-xl border border-slate-200">
                            <table className="w-full min-w-[680px] text-sm">
                                <thead className="bg-slate-50 text-left">
                                    <tr>
                                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Metric</th>
                                        {selectedCostings.map(costing => (
                                            <th key={costing.id} className="px-4 py-3 font-bold text-slate-950">{costing.quality_label || 'Untitled costing'} · v{Number(costing.version_number ?? 1)} · {format(new Date(costing.created_at), 'MMM d, yyyy')}</th>
                                        ))}
                                        <th className="px-4 py-3 text-xs uppercase tracking-wide text-slate-500">Change</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {[
                                        ['Production cost', `₹${Number(selectedCostingStates[0]?.totals.totalProductionCostPerM ?? selectedCostings[0].landed_cost_per_meter).toFixed(2)}/m`, `₹${Number(selectedCostingStates[1]?.totals.totalProductionCostPerM ?? selectedCostings[1].landed_cost_per_meter).toFixed(2)}/m`, Number(selectedCostingStates[1]?.totals.totalProductionCostPerM ?? selectedCostings[1].landed_cost_per_meter) - Number(selectedCostingStates[0]?.totals.totalProductionCostPerM ?? selectedCostings[0].landed_cost_per_meter), '₹', '/m'],
                                        ['Commercial break-even', `₹${Number(selectedCostings[0].landed_cost_per_meter).toFixed(2)}/m`, `₹${Number(selectedCostings[1].landed_cost_per_meter).toFixed(2)}/m`, comparison.productionCostDelta, '₹', '/m'],
                                        ['Suggested selling price', `₹${Number(selectedCostings[0].quote_price_per_meter).toFixed(2)}/m`, `₹${Number(selectedCostings[1].quote_price_per_meter).toFixed(2)}/m`, comparison.sellingPriceDelta, '₹', '/m'],
                                        ['Margin', `${Number(selectedCostings[0].intended_margin_percent).toFixed(1)}%`, `${Number(selectedCostings[1].intended_margin_percent).toFixed(1)}%`, comparison.marginDelta, '', ' pp'],
                                        ['Quantity', `${Number(selectedCostings[0].meters).toLocaleString('en-IN')} m`, `${Number(selectedCostings[1].meters).toLocaleString('en-IN')} m`, comparison.quantityDelta, '', ' m'],
                                        ['Warp yarn rate', `₹${Number(selectedCostingStates[0]?.state.warpRows[0]?.yarnRate ?? 0).toFixed(2)}/kg`, `₹${Number(selectedCostingStates[1]?.state.warpRows[0]?.yarnRate ?? 0).toFixed(2)}/kg`, Number(selectedCostingStates[1]?.state.warpRows[0]?.yarnRate ?? 0) - Number(selectedCostingStates[0]?.state.warpRows[0]?.yarnRate ?? 0), '₹', '/kg'],
                                        ['Warp consumption', `${Number(selectedCostingStates[0]?.totals.totalWarpKgPer100m ?? 0).toFixed(2)} kg/100m`, `${Number(selectedCostingStates[1]?.totals.totalWarpKgPer100m ?? 0).toFixed(2)} kg/100m`, Number(selectedCostingStates[1]?.totals.totalWarpKgPer100m ?? 0) - Number(selectedCostingStates[0]?.totals.totalWarpKgPer100m ?? 0), '', ' kg'],
                                        ['Weft yarn rate', `₹${Number(selectedCostingStates[0]?.state.weftRows[0]?.yarnRate ?? 0).toFixed(2)}/kg`, `₹${Number(selectedCostingStates[1]?.state.weftRows[0]?.yarnRate ?? 0).toFixed(2)}/kg`, Number(selectedCostingStates[1]?.state.weftRows[0]?.yarnRate ?? 0) - Number(selectedCostingStates[0]?.state.weftRows[0]?.yarnRate ?? 0), '₹', '/kg'],
                                        ['Processing', `₹${Number(selectedCostingStates[0]?.totals.processingPerM ?? 0).toFixed(2)}/m`, `₹${Number(selectedCostingStates[1]?.totals.processingPerM ?? 0).toFixed(2)}/m`, Number(selectedCostingStates[1]?.totals.processingPerM ?? 0) - Number(selectedCostingStates[0]?.totals.processingPerM ?? 0), '₹', '/m'],
                                        ['Overhead', `₹${Number(selectedCostingStates[0]?.totals.overheadPerM ?? 0).toFixed(2)}/m`, `₹${Number(selectedCostingStates[1]?.totals.overheadPerM ?? 0).toFixed(2)}/m`, Number(selectedCostingStates[1]?.totals.overheadPerM ?? 0) - Number(selectedCostingStates[0]?.totals.overheadPerM ?? 0), '₹', '/m'],
                                    ].map(([label, left, right, delta, prefix, suffix]) => {
                                        const numericDelta = Number(delta)
                                        return (
                                            <tr key={String(label)}>
                                                <td className="px-4 py-3 font-semibold text-slate-600">{label}</td>
                                                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{left}</td>
                                                <td className="px-4 py-3 font-mono font-semibold text-slate-900">{right}</td>
                                                <td className={`px-4 py-3 font-mono font-bold ${numericDelta > 0 ? 'text-emerald-700' : numericDelta < 0 ? 'text-red-600' : 'text-slate-500'}`}>
                                                    {numericDelta > 0 ? '+' : ''}{prefix}{numericDelta.toLocaleString('en-IN', { maximumFractionDigits: 2 })}{suffix}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
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
                                Saved {format(new Date(existingDraftForRestore.savedAt), 'MMM d, h:mm a')}
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

            <Dialog open={!!quoteToDelete} onOpenChange={(open) => !open && setQuoteToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-600" />
                            {quoteToDelete && isStandaloneCosting(quoteToDelete.record_kind) ? 'Delete this Costing?' : 'Delete this Quotation?'}
                        </DialogTitle>
                        <DialogDescription className="text-sm leading-relaxed text-slate-500">
                            {quoteToDelete && !isStandaloneCosting(quoteToDelete.record_kind)
                                ? 'This permanently removes the unconverted draft or rejected Quotation. Accepted, sent, and converted records remain protected.'
                                 : 'This permanently removes this saved costing. Saved qualities and other costing snapshots are not affected.'}
                        </DialogDescription>
                    </DialogHeader>
                    {quoteToDelete && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-3">
                            <p className="font-black text-red-950">{quoteToDelete.party_name}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-widest text-red-700">
                                {quoteToDelete.quality_label || 'No quality label'}
                            </p>
                        </div>
                    )}
                    <DialogFooter className="flex gap-2 justify-end pt-2">
                        <Button variant="ghost" onClick={() => setQuoteToDelete(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteQuote}
                            disabled={!quoteToDelete || updatingId === quoteToDelete.id}
                        >
                            {quoteToDelete && updatingId === quoteToDelete.id
                                ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                : <Trash2 className="mr-2 h-4 w-4" />}
                            {quoteToDelete && isStandaloneCosting(quoteToDelete.record_kind) ? 'Delete Costing' : 'Delete Quotation'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
