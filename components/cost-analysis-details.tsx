import { Calculator, ChevronDown, Layers, ReceiptText } from 'lucide-react'
import {
    calcFullTotals,
    makeDefaultEstimateState,
    parseCostingResultSnapshot,
    type EstimateState,
    type FactorySections,
    type OverheadItem,
    type WarpRow,
    type WeftRow,
} from '@/lib/estimator'
import { cn } from '@/lib/utils'

type QuoteSnapshot = Record<string, unknown> & {
    quote_price_per_meter?: number | string | null
    landed_cost_per_meter?: number | string | null
    production_cost_per_meter?: number | string | null
    intended_margin_percent?: number | string | null
    meters?: number | string | null
    worker_rate_per_m?: number | string | null
    transport_per_m?: number | string | null
    commission_pct?: number | string | null
    costing_result_snapshot?: unknown
    reconciliation_status?: string | null
}

function num(value: unknown, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

function money(value: number | null, digits = 2) {
    if (value == null) return 'Not available'
    return `₹${value.toLocaleString('en-IN', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`
}

function totalMoney(value: number) {
    return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function asArray<T>(value: unknown, fallback: T[]): T[] {
    return Array.isArray(value) && value.length > 0 ? value as T[] : fallback
}

function hydrateEstimateFromQuote(quote: QuoteSnapshot, targetMeters: number): EstimateState {
    const base = makeDefaultEstimateState()
    return {
        ...base,
        warpRows: asArray<WarpRow>(quote.warp_rows, base.warpRows),
        weftRows: asArray<WeftRow>(quote.weft_rows, base.weftRows),
        tapeLengthM: num(quote.tape_length_m, base.tapeLengthM),
        perPickCostPaisa: num(quote.per_pick_cost_paise, base.perPickCostPaisa),
        warpingRatePerKg: num(quote.warping_rate_per_kg, base.warpingRatePerKg),
        sizingRatePerKg: num(quote.sizing_rate_per_kg, base.sizingRatePerKg),
        windingRatePerKg: num(quote.winding_rate_per_kg, base.windingRatePerKg),
        processingRatePerM: num(quote.processing_rate_per_m, base.processingRatePerM),
        finishingRatePerM: num(quote.finishing_rate_per_m, base.finishingRatePerM),
        yarnShortagePct: num(quote.yarn_shortage_pct, base.yarnShortagePct),
        warpCrimpPct: num(quote.warp_crimp_pct, base.warpCrimpPct),
        overheadItems: asArray<OverheadItem>(quote.overhead_items, base.overheadItems),
        monthlyOutputM: num(quote.monthly_output_m, base.monthlyOutputM),
        overheadOverridePerM: quote.overhead_override_per_m == null
            ? base.overheadOverridePerM
            : num(quote.overhead_override_per_m),
        overheadMode: quote.overhead_override_per_m != null ? 'direct' : 'monthly_expenses',
        overheadPct: 0,
        commissionPct: num(quote.commission_pct, base.commissionPct),
        transportPerM: num(quote.transport_per_m, base.transportPerM),
        profitPct: num(quote.profit_margin_pct ?? quote.intended_margin_percent, base.profitPct),
        orderQuantityM: targetMeters > 0 ? targetMeters : num(quote.meters, 0) || null,
        enabledSections: (quote.enabled_sections as FactorySections | null) ?? base.enabledSections,
        loomType: (quote.loom_type as EstimateState['loomType']) ?? base.loomType,
        loomRpm: quote.estimator_rpm == null ? base.loomRpm : num(quote.estimator_rpm),
        loomPowerKw: quote.estimator_power_kw == null ? base.loomPowerKw : num(quote.estimator_power_kw),
        loomRpmIsCustomised: quote.estimator_rpm != null,
        loomPowerKwIsCustomised: quote.estimator_power_kw != null,
        hoursPerShift: quote.hours_per_shift == null ? base.hoursPerShift : num(quote.hours_per_shift),
        sizingMode: (quote.sizing_mode as EstimateState['sizingMode'] | null) ?? base.sizingMode,
        isConfigured: true,
    }
}

function CostLine({
    label,
    value,
    targetMeters,
    tone = 'default',
}: {
    label: string
    value: number | null
    targetMeters: number
    tone?: 'default' | 'strong' | 'muted'
}) {
    return (
        <div className={cn(
            'flex items-center justify-between gap-3 border-b border-slate-100 py-2 text-xs last:border-0',
            tone === 'muted' && 'text-slate-500',
        )}>
            <span className={cn('font-semibold text-slate-600', tone === 'strong' && 'text-slate-900')}>
                {label}
            </span>
            <span className="text-right font-mono">
                <span className={cn('font-black text-slate-900', tone === 'strong' && 'text-primary')}>
                    {money(value)}
                </span>
                <span className="ml-1 text-slate-500">/m</span>
                {value != null && targetMeters > 0 && (
                    <span className="block text-[11px] text-slate-400">
                        {totalMoney(value * targetMeters)} total
                    </span>
                )}
            </span>
        </div>
    )
}

export function CostAnalysisDetails({
    quote,
    targetMeters,
    title = 'Cost Analysis',
}: {
    quote: QuoteSnapshot
    targetMeters: number
    title?: string
}) {
    const estimate = hydrateEstimateFromQuote(quote, targetMeters)
    const historicalResult = parseCostingResultSnapshot(quote.costing_result_snapshot)
    const totals = (() => {
        try {
            return calcFullTotals(estimate)
        } catch {
            return null
        }
    })()
    const meters = targetMeters > 0 ? targetMeters : num(quote.meters, 0)
    const quotePrice = historicalResult?.suggestedSellingPricePerM ?? num(quote.quote_price_per_meter, 0)
    const storedProductionCost = historicalResult?.productionCostPerM
        ?? (num(quote.production_cost_per_meter, 0) > 0 ? num(quote.production_cost_per_meter) : null)
    const weaveRate = num(quote.worker_rate_per_m, totals?.weaveCostPerM ?? 0)
    const commissionPct = historicalResult?.commissionPct ?? num(quote.commission_pct, 0)
    const commissionPerM = historicalResult?.commissionPerM
        ?? (quotePrice > 0 ? quotePrice * commissionPct / 100 : 0)
    const transportPerM = historicalResult?.transportPerM ?? num(quote.transport_per_m, 0)
    const hasMatchingLayerDetails = Boolean(
        historicalResult
        && totals
        && Math.abs(totals.totalProductionCostPerM - historicalResult.productionCostPerM) <= 0.01,
    )
    const layerTotals = hasMatchingLayerDetails && totals ? totals : null
    const showLegacyWarning = !historicalResult

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <Calculator className="h-3 w-3" /> Production Cost
                    </p>
                    <p className="font-mono text-lg font-black text-slate-900">
                        {money(storedProductionCost)}<span className="text-xs font-normal text-slate-500">/m</span>
                    </p>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-amber-700">
                        Karighar Rate
                    </p>
                    <p className="font-mono text-lg font-black text-amber-700">
                        {money(weaveRate)}<span className="text-xs font-normal text-amber-700/70">/m</span>
                    </p>
                </div>
            </div>

            {showLegacyWarning && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    <ReceiptText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <p>
                        <strong>Legacy costing — review before relying on it.</strong>{' '}
                        Saved totals are shown, but the historical component breakdown is unavailable. Re-enter and save a new costing to verify every number.
                    </p>
                </div>
            )}

            <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
                        <ReceiptText className="h-3.5 w-3.5" /> {title}
                    </p>
                    {meters > 0 && (
                        <span className="text-[11px] font-semibold text-slate-500">
                        for {meters.toLocaleString('en-IN')}m
                    </span>
                    )}
                </div>
                {historicalResult ? (
                    <>
                        <CostLine label="Warp yarn" value={historicalResult.breakdown.warpCostPerM} targetMeters={meters} />
                        <CostLine label="Weft yarn" value={historicalResult.breakdown.weftCostPerM} targetMeters={meters} />
                        <CostLine label="Weave charge / karighar" value={historicalResult.breakdown.weaveCostPerM} targetMeters={meters} tone="strong" />
                        <CostLine label="Warping + sizing" value={historicalResult.breakdown.warpingAndSizingPerM} targetMeters={meters} />
                        {historicalResult.breakdown.windingPerM > 0 && <CostLine label="Winding" value={historicalResult.breakdown.windingPerM} targetMeters={meters} />}
                        {historicalResult.breakdown.processingPerM > 0 && <CostLine label="Processing" value={historicalResult.breakdown.processingPerM} targetMeters={meters} />}
                        {historicalResult.breakdown.finishingPerM > 0 && <CostLine label="Finishing" value={historicalResult.breakdown.finishingPerM} targetMeters={meters} />}
                        <CostLine label="Factory expenses" value={historicalResult.breakdown.overheadPerM} targetMeters={meters} />
                        <CostLine label="Total production cost" value={historicalResult.productionCostPerM} targetMeters={meters} tone="strong" />
                    </>
                ) : (
                    <CostLine label="Saved production cost" value={storedProductionCost} targetMeters={meters} tone="strong" />
                )}
                {(quotePrice > 0 || commissionPct > 0 || transportPerM > 0) && (
                    <>
                        {commissionPct > 0 && (
                            <CostLine
                                label={`Broker commission (${commissionPct.toFixed(1)}%)`}
                                value={commissionPerM}
                                targetMeters={meters}
                                tone="muted"
                            />
                        )}
                        {transportPerM > 0 && (
                            <CostLine label="Transport charge" value={transportPerM} targetMeters={meters} tone="muted" />
                        )}
                        {quotePrice > 0 && <CostLine label="Quoted price" value={quotePrice} targetMeters={meters} tone="strong" />}
                    </>
                )}
            </div>

            {layerTotals && layerTotals.warpRows.length > 0 && (
                <details className="group rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
                            <Layers className="h-3.5 w-3.5" /> Warp Layer Cost
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-slate-200 p-3">
                        {layerTotals.warpRows.map((row, index) => (
                            <div key={row.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">
                                            {row.label || `Warp layer ${index + 1}`}
                                        </p>
                                        <p className="text-[11px] font-semibold text-slate-500">
                                            {row.mode === 'manual'
                                                ? `Manual · base ${row.baseKgPer100mUsed.toFixed(3)} kg/100m · final ${row.finalKgPer100m.toFixed(3)} kg/100m`
                                                : `Formula · ${row.calcDenier}D × ${row.beamEnds} ends / 90000 = ${row.formulaKgPer100m.toFixed(3)} kg/100m · final ${row.finalKgPer100m.toFixed(3)} kg/100m`}
                                        </p>
                                    </div>
                                    <div className="text-right font-mono">
                                        <p className="text-sm font-black text-primary">{money(row.costPer100m / 100)}</p>
                                        {meters > 0 && <p className="text-[11px] text-slate-400">{totalMoney((row.costPer100m / 100) * meters)}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-[11px]">
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Yarn</p>
                                        <p className="font-mono font-semibold text-slate-700">{money(row.yarnRate, 0)}/kg</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Crimp</p>
                                        <p className="font-mono font-semibold text-slate-700">{row.crimpPct.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Waste</p>
                                        <p className="font-mono font-semibold text-slate-700">{row.wastePct.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Total adj.</p>
                                        <p className="font-mono font-semibold text-slate-700">
                                            {row.totalAdjustmentPct.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            )}
            {layerTotals && layerTotals.weftRows.length > 0 && (
                <details className="group rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
                            <Layers className="h-3.5 w-3.5" /> Weft Layer Cost
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-slate-200 p-3">
                        {layerTotals.weftRows.map((row, index) => (
                            <div key={row.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">
                                            {row.label || `Weft layer ${index + 1}`}
                                        </p>
                                        <p className="text-[11px] font-semibold text-slate-500">
                                            {row.mode === 'manual'
                                                ? `Manual · base ${row.baseKgPer100mUsed.toFixed(3)} kg/100m · final ${row.finalKgPer100m.toFixed(3)} kg/100m`
                                                : `Formula · ${row.calcDenier}D × ${row.picks} PPI × ${row.effectiveCostingWidthInches.toFixed(1)} in × ${row.formulaLengthM.toFixed(3)}m / 9000000 = ${row.formulaKgPer100m.toFixed(3)} kg/100m · final ${row.finalKgPer100m.toFixed(3)} kg/100m`}
                                        </p>
                                    </div>
                                    <div className="text-right font-mono">
                                        <p className="text-sm font-black text-primary">{money(row.costPer100m / 100)}</p>
                                        {meters > 0 && <p className="text-[11px] text-slate-400">{totalMoney((row.costPer100m / 100) * meters)}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-[11px]">
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Yarn</p>
                                        <p className="font-mono font-semibold text-slate-700">{money(row.yarnRate, 0)}/kg</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Crimp</p>
                                        <p className="font-mono font-semibold text-slate-700">{row.crimpPct.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Waste</p>
                                        <p className="font-mono font-semibold text-slate-700">{row.wastePct.toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Total adj.</p>
                                        <p className="font-mono font-semibold text-slate-700">
                                            {row.totalAdjustmentPct.toFixed(1)}%
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </details>
            )}
        </div>
    )
}
