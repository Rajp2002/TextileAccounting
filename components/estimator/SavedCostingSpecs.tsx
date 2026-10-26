'use client'

import { useTranslation } from '@/lib/i18n/context'
import { fillCopy } from '@/lib/i18n/fill'
import { savedCostingSpecsText } from '@/lib/i18n/saved-costing-specs'
import type { SavedCostingSpecs as Specs, SavedCostingSpecYarn } from '@/lib/saved-costing-specs'

type Copy = (typeof savedCostingSpecsText)[keyof typeof savedCostingSpecsText]
type Cell = { label: string; value: string; detail?: string | null }

const number = (value: number, digits = 2) => value.toLocaleString('en-IN', { maximumFractionDigits: digits })
const rupees = (value: number) => `₹${number(value)}`

function CellGrid({ cells }: { cells: Cell[] }) {
    return (
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
            {cells.map(cell => (
                <div key={cell.label} className="min-w-0">
                    <dt className="text-xs text-subtle">{cell.label}</dt>
                    <dd className="mt-0.5 text-sm font-semibold tabular-nums text-ink">{cell.value}</dd>
                    {cell.detail && <dd className="text-xs tabular-nums text-muted-foreground">{cell.detail}</dd>}
                </div>
            ))}
        </dl>
    )
}

function YarnList({ title, rows, rowName, amount, copy }: {
    title: string
    rows: SavedCostingSpecYarn[]
    rowName: string
    amount: string
    copy: Copy
}) {
    if (!rows.length) return null
    return (
        <div className="mt-4">
            <p className="text-xs font-semibold text-subtle">{title}</p>
            <ul className="mt-1 divide-y divide-hairline">
                {rows.map((row, index) => {
                    const details = [
                        row.ratePerKg != null ? fillCopy(copy.ratePerKg, { rate: number(row.ratePerKg) }) : null,
                        row.gstPct != null ? fillCopy(copy.gst, { pct: number(row.gstPct) }) : null,
                        row.wastePct != null ? fillCopy(copy.waste, { pct: number(row.wastePct) }) : null,
                        row.crimpPct ? fillCopy(copy.crimp, { pct: number(row.crimpPct) }) : null,
                    ].filter(Boolean)
                    const count = row.count ?? (row.manualKgPer100m != null ? fillCopy(copy.manualWeight, { kg: number(row.manualKgPer100m, 3) }) : null)
                    return (
                        <li key={index} className="py-2">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-sm">
                                <span className="min-w-0 text-body">
                                    {row.name ?? fillCopy(rowName, { n: index + 1 })}
                                    {count && <span className="ml-2 font-semibold text-ink">{count}</span>}
                                </span>
                                {row.amount != null && <span className="font-semibold tabular-nums text-ink">{fillCopy(amount, { n: number(row.amount, 1) })}</span>}
                            </div>
                            {details.length > 0 && <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">{details.join(' · ')}</p>}
                        </li>
                    )
                })}
            </ul>
        </div>
    )
}

/** The saved inputs behind a costing's breakdown: construction, yarns and rates, read-only. */
export function SavedCostingSpecs({ specs }: { specs: Specs }) {
    const { language } = useTranslation()
    const copy = savedCostingSpecsText[language]

    const fabric = ([
        specs.widthInches != null ? { label: copy.width, value: `${number(specs.widthInches, 1)}"`, detail: specs.widthCm != null ? `${number(specs.widthCm, 1)} cm` : null } : null,
        specs.totalEnds != null ? { label: copy.totalEnds, value: number(specs.totalEnds, 0) } : null,
        specs.endsPerInch != null ? { label: copy.endsPerInch, value: number(specs.endsPerInch, 1) } : null,
        specs.totalPicks != null ? { label: copy.totalPicks, value: number(specs.totalPicks, 1) } : null,
        specs.quantityM != null ? { label: copy.quantity, value: `${number(specs.quantityM, 0)} m` } : null,
    ] as Array<Cell | null>).filter((cell): cell is Cell => cell !== null)

    const perKg = (value: number | null) => value == null ? copy.inHouse : `${rupees(value)}/kg`
    const rates = ([
        {
            label: copy.weavingRate,
            value: specs.weavingRatePerM != null ? `${rupees(specs.weavingRatePerM)}/m` : '—',
            detail: specs.paisePerPick != null ? fillCopy(copy.paisePerPick, { p: number(specs.paisePerPick, 4) }) : null,
        },
        { label: copy.warping, value: perKg(specs.warpingRatePerKg) },
        { label: copy.sizing, value: perKg(specs.sizingRatePerKg) },
        specs.windingRatePerKg != null ? { label: copy.winding, value: `${rupees(specs.windingRatePerKg)}/kg` } : null,
        specs.processingRatePerM != null ? { label: copy.processing, value: `${rupees(specs.processingRatePerM)}/m` } : null,
        specs.finishingRatePerM != null ? { label: copy.finishing, value: `${rupees(specs.finishingRatePerM)}/m` } : null,
        {
            label: copy.factoryExpenses,
            value: `${rupees(specs.overheadPerM)}/m`,
            detail: specs.overheadMonthlyTotal != null && specs.overheadMonthlyOutputM != null
                ? fillCopy(copy.monthlyBasis, { total: number(specs.overheadMonthlyTotal, 0), m: number(specs.overheadMonthlyOutputM, 0) })
                : null,
        },
        specs.commissionPct != null ? { label: copy.commission, value: `${number(specs.commissionPct)}%` } : null,
        specs.transportPerM != null ? { label: copy.transport, value: `${rupees(specs.transportPerM)}/m` } : null,
    ] as Array<Cell | null>).filter((cell): cell is Cell => cell !== null)

    return (
        <div data-saved-costing-specs="true" data-i18n-skip="true" lang={language} className="mt-4 border-t border-hairline pt-4">
            <p className="text-sm font-semibold text-ink">{copy.title}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{copy.note}</p>
            {fabric.length > 0 && (
                <div className="mt-3">
                    <p className="text-xs font-semibold text-subtle">{copy.fabric}</p>
                    <CellGrid cells={fabric} />
                </div>
            )}
            <YarnList title={copy.warpYarns} rows={specs.warp} rowName={copy.warpRow} amount={copy.ends} copy={copy} />
            <YarnList title={copy.weftYarns} rows={specs.weft} rowName={copy.weftRow} amount={copy.picks} copy={copy} />
            <div className="mt-4">
                <p className="text-xs font-semibold text-subtle">{copy.rates}</p>
                <CellGrid cells={rates} />
            </div>
        </div>
    )
}
