import { Calculator, ChevronDown, Layers, ReceiptText } from 'lucide-react'
import {
    calcFullTotals,
    makeDefaultEstimateState,
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
    intended_margin_percent?: number | string | null
    meters?: number | string | null
    worker_rate_per_m?: number | string | null
}

function num(value: unknown, fallback = 0) {
    const n = Number(value)
    return Number.isFinite(n) ? n : fallback
}

function money(value: number, digits = 2) {
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
        overheadPct: num(quote.overhead_pct, base.overheadPct),
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
        hoursPerShift: num(quote.hours_per_shift, base.hoursPerShift),
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
    value: number
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
                {targetMeters > 0 && (
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
    const totals = calcFullTotals(estimate)
    const meters = targetMeters > 0 ? targetMeters : num(quote.meters, 0)
    const quotePrice = num(quote.quote_price_per_meter, 0)
    const storedProductionCost = num(quote.landed_cost_per_meter, totals.totalProductionCostPerM)
    const weaveRate = num(quote.worker_rate_per_m, totals.weaveCostPerM)

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
                <CostLine label="Warp yarn" value={totals.warpCostPerM} targetMeters={meters} />
                <CostLine label="Weft yarn" value={totals.weftCostPerM} targetMeters={meters} />
                <CostLine label="Weave charge / karighar" value={totals.weaveCostPerM} targetMeters={meters} tone="strong" />
                <CostLine label="Warping + sizing" value={totals.warpingAndSizingPerM} targetMeters={meters} />
                {totals.windingPerM > 0 && <CostLine label="Winding" value={totals.windingPerM} targetMeters={meters} />}
                {totals.processingPerM > 0 && <CostLine label="Processing" value={totals.processingPerM} targetMeters={meters} />}
                {totals.finishingPerM > 0 && <CostLine label="Finishing" value={totals.finishingPerM} targetMeters={meters} />}
                <CostLine label="Factory overhead" value={totals.overheadPerM} targetMeters={meters} />
                <CostLine label="Total production cost" value={totals.totalProductionCostPerM} targetMeters={meters} tone="strong" />
                {(quotePrice > 0 || estimate.commissionPct > 0 || estimate.transportPerM > 0) && (
                    <>
                        {estimate.commissionPct > 0 && (
                            <CostLine
                                label={`Commission (${estimate.commissionPct.toFixed(1)}%)`}
                                value={(quotePrice > 0 ? quotePrice : (totals.orderQuote?.quotePricePerM || 0)) * (estimate.commissionPct / 100)}
                                targetMeters={meters}
                                tone="muted"
                            />
                        )}
                        {estimate.transportPerM > 0 && (
                            <CostLine label="Transport" value={estimate.transportPerM} targetMeters={meters} tone="muted" />
                        )}
                        {quotePrice > 0 && <CostLine label="Quoted price" value={quotePrice} targetMeters={meters} tone="strong" />}
                    </>
                )}
            </div>

            {totals.warpRows.length > 0 && (
                <details className="group rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5">
                        <span className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-600">
                            <Layers className="h-3.5 w-3.5" /> Warp Layer Cost
                        </span>
                        <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="space-y-2 border-t border-slate-200 p-3">
                        {totals.warpRows.map((row, index) => (
                            <div key={row.id ?? index} className="rounded-lg border border-slate-200 bg-white p-3">
                                <div className="mb-2 flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-black text-slate-900">
                                            {row.label || `Warp layer ${index + 1}`}
                                        </p>
                                        <p className="text-[11px] font-semibold text-slate-500">
                                            {row.beamEnds} ends · {row.calcDenier}D · {row.kgPer100m.toFixed(3)} kg/100m
                                        </p>
                                    </div>
                                    <div className="text-right font-mono">
                                        <p className="text-sm font-black text-primary">{money(row.costPer100m / 100)}</p>
                                        {meters > 0 && <p className="text-[11px] text-slate-400">{totalMoney((row.costPer100m / 100) * meters)}</p>}
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[11px]">
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Yarn</p>
                                        <p className="font-mono font-semibold text-slate-700">{money(row.yarnRate, 0)}/kg</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">GST</p>
                                        <p className="font-mono font-semibold text-slate-700">{num(row.gstPct).toFixed(1)}%</p>
                                    </div>
                                    <div>
                                        <p className="font-bold uppercase tracking-wider text-slate-400">Crimp + waste</p>
                                        <p className="font-mono font-semibold text-slate-700">
                                            {(num(row.shortagePctUsed) + estimate.warpCrimpPct).toFixed(1)}%
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
