'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { COST_SEGMENTS } from './cost-sheet-demo'
import s from './landing.module.css'
import { formatCount, formatRupees, SAMPLE_QUALITY } from './sample-format'
import { useSampleCosting } from './sample-costing-context'

function Line({ index, title, working, value, swatch, muted }: {
    index: string
    title: string
    working: ReactNode
    value: string
    swatch?: string
    muted?: boolean
}) {
    return (
        <li className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] gap-x-3 border-t border-[color:var(--lp-line)] py-4 first:border-t-0 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto]">
            <span className={cn(s.figure, 'pt-[3px] text-[12px] text-[color:var(--lp-muted)]')} aria-hidden="true">{index}</span>
            <div className="min-w-0">
                <p className="flex items-center gap-2 text-[15px] font-semibold text-[color:var(--lp-ink)]">
                    {swatch && <span className="h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: swatch }} aria-hidden="true" />}
                    {title}
                </p>
                <p className="mt-1 text-[14px] leading-6 text-[color:var(--lp-muted)]">{working}</p>
            </div>
            <span className={cn(s.figure, 'pt-px text-right text-[16px] font-semibold', muted ? 'text-[color:var(--lp-muted)]' : 'text-[color:var(--lp-ink)]')}>
                {value}
            </span>
        </li>
    )
}

function Total({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
    return (
        <div className="flex items-baseline gap-3 py-3">
            <span className={cn('text-[15px] font-semibold', accent ? 'text-[color:var(--lp-saffron-ink)]' : 'text-[color:var(--lp-ink)]')}>{label}</span>
            <span className={s.leader} aria-hidden="true" />
            <span className={cn(s.figure, 'text-[20px] font-semibold', accent ? 'text-[color:var(--lp-saffron-ink)]' : 'text-[color:var(--lp-ink)]')}>{value}</span>
        </div>
    )
}

export function CostStackLedger() {
    const { inputs, result } = useSampleCosting()
    const q = SAMPLE_QUALITY
    const color = Object.fromEntries(COST_SEGMENTS.map((segment) => [segment.key, segment.color]))

    return (
        <div className={cn(s.sheet, 'rounded-[14px] px-5 py-2 sm:px-7')}>
            <ol className="list-none">
                <Line
                    index="01"
                    title="Warp yarn"
                    swatch={color.warpYarnPerM}
                    working={<>{formatCount(q.warp.ends)} ends × {q.warp.denier}D · +{q.crimpPct}% crimp, +{q.wastePct}% waste · ₹{q.warp.ratePerKg}/kg + {q.gstPct}% GST</>}
                    value={formatRupees(result.warpYarnPerM)}
                />
                <Line
                    index="02"
                    title="Weft yarn"
                    swatch={color.weftYarnPerM}
                    working={<>{inputs.picksPerInch} PPI × {q.weft.widthCm} cm × {q.weft.denier}D · +{q.wastePct}% waste · ₹{inputs.weftRatePerKg}/kg + {q.gstPct}% GST</>}
                    value={formatRupees(result.weftYarnPerM)}
                />
                <Line
                    index="03"
                    title="Weaving"
                    swatch={color.weavingPerM}
                    working={<>{inputs.picksPerInch} picks × {inputs.paisePerPick} paise</>}
                    value={formatRupees(result.weavingPerM)}
                />
                <Line
                    index="04"
                    title="Warping, sizing, winding, processing, finishing"
                    working="Only when your unit pays for them. None in this example."
                    value="—"
                    muted
                />
                <Line
                    index="05"
                    title="Overheads"
                    swatch={color.overheadPerM}
                    working="A direct ₹/m, or monthly expenses ÷ monthly output"
                    value={formatRupees(result.overheadPerM)}
                />
            </ol>
            <div className="border-t-2 border-[color:var(--lp-ink)]">
                <Total label="Production cost / m" value={formatRupees(result.productionCostPerM)} />
            </div>
            <div className="border-t border-[color:var(--lp-line)] py-1">
                <p className="pt-3 text-[14px] leading-6 text-[color:var(--lp-muted)]">
                    + ₹{q.transportPerM.toFixed(2)}/m transport, {q.commissionPct}% broker commission
                </p>
                <Total label="Break-even price / m" value={formatRupees(result.breakEvenPricePerM)} />
            </div>
            <div className="border-t border-[color:var(--lp-line)] py-1">
                <p className="pt-3 text-[14px] leading-6 text-[color:var(--lp-muted)]">+ {inputs.marginPct}% target margin</p>
                <Total label="Suggested price / m" value={formatRupees(result.suggestedPricePerM)} accent />
            </div>
        </div>
    )
}
