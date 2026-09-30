'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import s from './landing.module.css'
import { formatCount, formatRupees, formatRupeesWhole, SAMPLE_QUALITY, SAMPLE_START, type SampleInputs } from './sample-format'
import { useSampleCosting } from './sample-costing-context'

type Control = {
    key: keyof SampleInputs
    label: string
    min: number
    max: number
    step: number
    display: (value: number) => string
    spoken: (value: number) => string
}

const CONTROLS: Control[] = [
    {
        key: 'weftRatePerKg', label: 'Weft yarn rate', min: 80, max: 180, step: 1,
        display: (v) => `₹${v}/kg`, spoken: (v) => `${v} rupees per kilogram`,
    },
    {
        key: 'picksPerInch', label: 'Picks per inch', min: 40, max: 100, step: 1,
        display: (v) => `${v} PPI`, spoken: (v) => `${v} picks per inch`,
    },
    {
        key: 'paisePerPick', label: 'Weaving rate', min: 8, max: 30, step: 0.5,
        display: (v) => `${v} p/pick`, spoken: (v) => `${v} paise per pick`,
    },
    {
        key: 'marginPct', label: 'Target margin', min: 0, max: 20, step: 0.5,
        display: (v) => `${v}%`, spoken: (v) => `${v} percent`,
    },
]

export const COST_SEGMENTS = [
    { key: 'warpYarnPerM', label: 'Warp yarn', color: '#A94713' },
    { key: 'weftYarnPerM', label: 'Weft yarn', color: '#D9A441' },
    { key: 'weavingPerM', label: 'Weaving', color: '#34487A' },
    { key: 'overheadPerM', label: 'Overheads', color: '#A39D8F' },
] as const

function round2(value: number) {
    return Math.round(value * 100) / 100
}

function deltaSentence(costDelta: number, marginChanged: boolean, price: string) {
    const quantity = `${formatCount(SAMPLE_QUALITY.orderQuantityM)} m`
    if (Math.abs(costDelta) < 0.005) {
        return marginChanged
            ? `Cost is unchanged. Margin moves the price, not the cost: quote ${price} a metre.`
            : 'Move a rate to see what it does to one metre, and to the whole order.'
    }
    const perMetre = formatRupees(Math.abs(costDelta))
    const order = formatRupeesWhole(Math.abs(costDelta) * SAMPLE_QUALITY.orderQuantityM)
    return costDelta > 0
        ? `Cost up ${perMetre} a metre. Quote the old price on ${quantity} and ${order} of margin is gone.`
        : `Cost down ${perMetre} a metre. That is ${order} of room across ${quantity}.`
}

export function CostSheetDemo() {
    const { inputs, result, start, prepare, setInput, reset } = useSampleCosting()
    const costDelta = round2(result.productionCostPerM - start.productionCostPerM)
    const marginChanged = inputs.marginPct !== SAMPLE_START.marginPct
    const changed = CONTROLS.some((c) => inputs[c.key] !== SAMPLE_START[c.key])
    const sentence = deltaSentence(costDelta, marginChanged, formatRupees(result.suggestedPricePerM))

    // Announce the outcome once the visitor pauses, not on every slider step.
    const [announcement, setAnnouncement] = useState('')
    useEffect(() => {
        if (!changed) return
        const timer = window.setTimeout(() => {
            setAnnouncement(`Production cost ${formatRupees(result.productionCostPerM)} per metre. ${sentence}`)
        }, 700)
        return () => window.clearTimeout(timer)
    }, [changed, result.productionCostPerM, sentence])

    return (
        <section
            aria-labelledby="sample-sheet-title"
            onPointerEnter={prepare}
            onFocus={prepare}
            onTouchStart={prepare}
            className={cn(s.sheet, 'relative rounded-[14px] text-[color:var(--lp-ink)]')}
        >
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-[color:var(--lp-line)] px-5 py-4 sm:px-6">
                <div className="min-w-0">
                    <p className={cn(s.label, 'text-[color:var(--lp-saffron-ink)]')}>Cost sheet · example</p>
                    <h2 id="sample-sheet-title" className={cn(s.display, 'mt-1 text-[19px] font-semibold leading-tight text-[color:var(--lp-ink)]')}>
                        {SAMPLE_QUALITY.name}
                    </h2>
                </div>
                <p className={cn(s.figure, 'text-[12px] text-[color:var(--lp-muted)]')}>
                    {SAMPLE_QUALITY.warp.denier}D × {formatCount(SAMPLE_QUALITY.warp.ends)} ends · {SAMPLE_QUALITY.weft.denier}D weft · {SAMPLE_QUALITY.weft.widthCm} cm
                </p>
            </header>

            <div className="px-5 pt-5 sm:px-6">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-[1.35fr_1fr_1fr]">
                    <div className="col-span-2 sm:col-span-1">
                        <dt className="text-[13px] font-medium text-[color:var(--lp-muted)]">Production cost / m</dt>
                        <dd className={cn(s.figure, 'mt-1 text-[44px] font-semibold leading-none text-[color:var(--lp-ink)] sm:text-[52px]')}>
                            {formatRupees(result.productionCostPerM)}
                        </dd>
                    </div>
                    <div className="sm:self-end">
                        <dt className="text-[13px] font-medium text-[color:var(--lp-muted)]">Break-even price / m</dt>
                        <dd className={cn(s.figure, 'mt-1 text-[22px] font-semibold leading-none')}>{formatRupees(result.breakEvenPricePerM)}</dd>
                    </div>
                    <div className="sm:self-end">
                        <dt className="text-[13px] font-medium text-[color:var(--lp-muted)]">Suggested price / m</dt>
                        <dd className={cn(s.figure, 'mt-1 text-[22px] font-semibold leading-none text-[color:var(--lp-saffron-ink)]')}>
                            {formatRupees(result.suggestedPricePerM)}
                        </dd>
                    </div>
                </dl>

                <div className={cn(s.bar, 'mt-5 flex h-2.5 gap-[2px] overflow-hidden rounded-full')} aria-hidden="true">
                    {COST_SEGMENTS.map((segment) => (
                        <span key={segment.key} style={{ flexGrow: result[segment.key], flexBasis: 0, background: segment.color }} />
                    ))}
                </div>
                <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] sm:gap-x-10" aria-label="Cost per metre by layer">
                    {COST_SEGMENTS.map((segment) => (
                        <li key={segment.key} className="flex items-center gap-2 whitespace-nowrap">
                            <span className="h-2.5 w-2.5 flex-none rounded-[2px]" style={{ background: segment.color }} aria-hidden="true" />
                            <span className="text-[color:var(--lp-muted)]">{segment.label}</span>
                            <span className={cn(s.figure, 'ml-auto font-medium text-[color:var(--lp-ink)]')}>{formatRupees(result[segment.key])}</span>
                        </li>
                    ))}
                </ul>
            </div>

            <fieldset className="mt-5 border-t border-[color:var(--lp-line)] px-5 pb-1 pt-4 sm:px-6">
                <legend className="sr-only">Change the example rates</legend>
                <div className="flex items-center justify-between gap-4">
                    <p className={cn(s.label, 'text-[color:var(--lp-muted)]')} aria-hidden="true">Change a rate</p>
                    <button
                        type="button"
                        onClick={reset}
                        disabled={!changed}
                        className="-mr-2 min-h-[44px] rounded-md px-2 text-[13px] font-semibold text-[color:var(--lp-ink)] underline decoration-[color:var(--lp-line-strong)] underline-offset-4 disabled:cursor-default disabled:text-[color:var(--lp-muted)] disabled:no-underline"
                    >
                        Reset example
                    </button>
                </div>
                <div className="grid gap-x-8 sm:grid-cols-2">
                    {CONTROLS.map((control) => {
                        const value = inputs[control.key]
                        const fill = ((value - control.min) / (control.max - control.min)) * 100
                        const id = `sample-${control.key}`
                        return (
                            <div key={control.key} className="pt-1">
                                <div className="flex items-baseline justify-between gap-3">
                                    <label htmlFor={id} className="text-[14px] font-medium text-[color:var(--lp-body)]">{control.label}</label>
                                    <output htmlFor={id} className={cn(s.figure, 'text-[14px] font-semibold text-[color:var(--lp-ink)]')}>
                                        {control.display(value)}
                                    </output>
                                </div>
                                <input
                                    id={id}
                                    type="range"
                                    className={s.range}
                                    min={control.min}
                                    max={control.max}
                                    step={control.step}
                                    value={value}
                                    aria-valuetext={control.spoken(value)}
                                    onChange={(event) => setInput(control.key, Number(event.target.value))}
                                    style={{ '--fill': `${fill}%` } as CSSProperties}
                                />
                            </div>
                        )
                    })}
                </div>
            </fieldset>

            <div className="border-t border-[color:var(--lp-line)] px-5 py-4 sm:px-6">
                <p className={cn('text-[14px] leading-6', costDelta > 0.004 ? 'font-semibold text-[color:var(--lp-saffron-ink)]' : 'text-[color:var(--lp-body)]')}>
                    {sentence}
                </p>
                <p className="mt-2 text-[12px] leading-5 text-[color:var(--lp-muted)]">
                    Example inputs, not market rates. Calculated with Weavly&rsquo;s own costing engine; profit at this price on {formatCount(SAMPLE_QUALITY.orderQuantityM)} m is{' '}
                    <span className={s.figure}>{result.orderProfit === null ? '—' : formatRupeesWhole(result.orderProfit)}</span>.
                </p>
                <p className="sr-only" aria-live="polite">{announcement}</p>
            </div>
        </section>
    )
}
