import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { marginTone } from '@/components/estimator/SavedCostingMargin'
import { RangeSlider } from '@/components/ui/range-slider'
import { fillCopy } from '@/lib/i18n/fill'
import type { OfferCheckText } from '@/lib/i18n/offer-check'
import type { OfferBase, OfferEvaluation, OfferStressId, offerSliderRange } from '@/lib/offer-check'
import { cn } from '@/lib/utils'

export const LOSS_TEXT = 'text-[var(--wv-madder-600)]'

/** The label over a figure or a block of lines, as on Saved Costings: sentence case, quiet. */
export const SECTION_LABEL = 'text-sm font-medium text-muted-foreground'

/** Rupees with the Indian grouping; a minus sign, not a bracket, for money lost. */
export function rupees(value: number, decimals = 2) {
    const text = Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    return `${value < 0 ? '−' : ''}₹${text}`
}

export function percent(value: number) {
    return `${value < 0 ? '−' : ''}${Math.abs(value).toFixed(1)}%`
}

export function metres(value: number) {
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

/** Order figures in whole rupees once they are large enough for the paise to be noise. */
function orderRupees(value: number) {
    return rupees(value, Math.abs(value) >= 1000 ? 0 : 2)
}

/** A rupee amount without its sign or symbol, for sentences that carry their own ₹. */
function amountText(value: number) {
    return Math.abs(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Where the offer stands against the costing's own price: the one comparison the figure does not already make. */
function versusPriceCopy(copy: OfferCheckText, difference: number) {
    if (difference === 0) return copy.deltaSame
    return fillCopy(difference > 0 ? copy.deltaAbove : copy.deltaBelow, { amount: amountText(difference) })
}

/**
 * The price axis of a check: the app's own slider, with break-even and the costing's
 * price marked on it and named beneath. Dragging it is the same as typing a price.
 * The scale is the slider's range, fixed for a costing, so the marks never move while
 * the owner drags. When the two marks sit too close for both names to fit side by
 * side, the costing's price is named above the slider instead.
 */
export function OfferPriceTrack({
    base,
    range,
    value,
    valueText,
    onValueChange,
    copy,
}: {
    base: Pick<OfferBase, 'breakEvenPricePerM' | 'sellingPricePerM'>
    range: ReturnType<typeof offerSliderRange>
    value: number
    valueText: string
    onValueChange: (value: number) => void
    copy: OfferCheckText
}) {
    const span = range.max - range.min
    const at = (price: number) => (span > 0 ? Math.min(100, Math.max(0, ((price - range.min) / span) * 100)) : 0)
    const breakEven = at(base.breakEvenPricePerM)
    const price = at(base.sellingPricePerM)
    const breakEvenRef = useRef<HTMLSpanElement>(null)
    const priceRef = useRef<HTMLSpanElement>(null)
    const [crowded, setCrowded] = useState(false)

    useLayoutEffect(() => {
        const low = breakEvenRef.current
        const high = priceRef.current
        if (!low || !high || typeof ResizeObserver === 'undefined') return
        const check = () => {
            const a = low.getBoundingClientRect()
            const b = high.getBoundingClientRect()
            setCrowded(a.left < b.right + 16 && b.left < a.right + 16)
        }
        check()
        const observer = new ResizeObserver(check)
        observer.observe(low)
        observer.observe(high)
        if (low.parentElement) observer.observe(low.parentElement)
        return () => observer.disconnect()
    }, [breakEven, price, copy])

    // Marks and names sit 11px in from each end (half the thumb), where the thumb's centre stops.
    // Each name slides along its own width as its mark moves, so it stays inside the track at either end.
    const label = (position: number): CSSProperties => ({ left: `${position}%`, transform: `translateX(-${position}%)` })
    const name = 'absolute whitespace-nowrap text-[13px] text-muted-foreground'

    return (
        <div data-offer-track className={cn(crowded && 'pt-4')}>
            <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[11px] inset-y-0">
                    {[breakEven, price].map((position, index) => (
                        <span key={index} className="absolute top-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground" style={{ left: `${position}%` }} />
                    ))}
                </span>
                <RangeSlider
                    min={range.min}
                    max={range.max}
                    step={range.step}
                    value={value}
                    aria-label={copy.priceSlider}
                    aria-valuetext={valueText}
                    onValueChange={onValueChange}
                    className="relative"
                />
            </div>
            <div aria-hidden="true" className="relative mx-[11px] h-5">
                <span ref={breakEvenRef} className={cn(name, 'top-0')} style={label(breakEven)}>
                    {copy.legendBreakEven} <span className="font-semibold text-ink tabular-nums">{rupees(base.breakEvenPricePerM)}</span>
                </span>
                <span ref={priceRef} className={cn(name, crowded ? 'bottom-[calc(100%+34px)]' : 'top-0')} style={label(price)}>
                    {copy.legendPrice} <span className="font-semibold text-ink tabular-nums">{rupees(base.sellingPricePerM)}</span>
                </span>
            </div>
            <p className="sr-only">
                {copy.rulerLabel}: {copy.legendBreakEven} {rupees(base.breakEvenPricePerM)}, {copy.legendPrice} {rupees(base.sellingPricePerM)}.
            </p>
        </div>
    )
}

export function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4 py-1.5', strong && 'mt-1 border-t border-hairline pt-3')}>
            <dt className={cn('text-sm', strong ? 'font-semibold text-ink' : 'text-body')}>{label}</dt>
            <dd className={cn('text-sm tabular-nums', strong ? 'text-base font-semibold' : 'font-medium', tone ?? 'text-ink')}>{value}</dd>
        </div>
    )
}

type AnswerProps = { base: OfferBase; evaluation: OfferEvaluation; copy: OfferCheckText }

/**
 * What the offer leaves on a metre, and on the whole order once there is a quantity.
 * The figures are ink, red only for a loss; the line beneath carries the margin's tone
 * and where the offer stands against the costing's price.
 */
function OfferHeadline({ evaluation, copy }: AnswerProps) {
    const losing = evaluation.profitPerM < 0
    const order = evaluation.order
    return (
        <div className="grid gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.62fr)] @2xl:gap-8">
            <div aria-live="polite">
                <p className={SECTION_LABEL}>{losing ? copy.lose : copy.keep}</p>
                <p className={cn('mt-2 text-5xl font-semibold leading-none tracking-[-0.035em] tabular-nums', losing ? LOSS_TEXT : 'text-ink')} data-offer-profit>
                    {rupees(Math.abs(evaluation.profitPerM))}<span className="ml-1.5 text-base font-medium tracking-normal text-muted-foreground">{copy.perMetre}</span>
                </p>
                <p className="mt-3 text-sm tabular-nums">
                    <span className={cn('font-semibold', marginTone(evaluation.marginPct))}>{fillCopy(copy.margin, { pct: percent(evaluation.marginPct) })}</span>
                    <span aria-hidden="true" className="text-muted-foreground"> · </span>
                    <span className="text-body">{versusPriceCopy(copy, evaluation.versusPrice.differencePerM)}</span>
                </p>
            </div>

            <section aria-labelledby="offer-order" className="border-t border-hairline pt-5 @2xl:border-l @2xl:border-t-0 @2xl:pl-8 @2xl:pt-0">
                <h2 id="offer-order" className={SECTION_LABEL}>{copy.orderTitle}</h2>
                {order ? (
                    <>
                        <p className={cn('mt-2 text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums', order.profit < 0 ? LOSS_TEXT : 'text-ink')} data-offer-order-profit>
                            {orderRupees(Math.abs(order.profit))}
                        </p>
                        <p className="mt-3 text-sm text-body tabular-nums">{fillCopy(order.profit < 0 ? copy.orderLoss : copy.orderProfit, { m: metres(order.quantityM) })}</p>
                        <dl className="mt-3 border-t border-hairline pt-1.5">
                            <Line label={copy.orderValue} value={orderRupees(order.value)} />
                            <Line label={copy.orderCost} value={orderRupees(order.cost)} />
                        </dl>
                    </>
                ) : (
                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{copy.orderPrompt}</p>
                )}
            </section>
        </div>
    )
}

/**
 * Where the answer comes from: the lines of a metre, and what moving costs would do.
 * A case that leaves the cost where it is (lower output on a fixed factory rate) says
 * nothing new, so it is left out.
 */
function OfferDetails({ base, evaluation, copy, hasQuantity }: AnswerProps & { hasQuantity: boolean }) {
    const losing = evaluation.profitPerM < 0
    const stressLabels: Record<OfferStressId, string> = { 'yarn-up-10': copy.caseYarn, 'output-down-15': copy.caseOutput }
    const cases = evaluation.stress.filter(stress => stress.costChangePerM !== 0)
    const showWhatIf = !base.stress.available || cases.length > 0

    return (
        <div className={cn('grid gap-8', showWhatIf && '@3xl:grid-cols-2 @3xl:gap-12')}>
            <section aria-labelledby="offer-lines">
                <h2 id="offer-lines" className={SECTION_LABEL}>{copy.linesTitle}</h2>
                <dl className="mt-2">
                    <Line label={copy.lineOffer} value={rupees(evaluation.offerPerM)} />
                    <Line label={copy.lineCost} value={`− ${rupees(evaluation.costPerM)}`} />
                    {evaluation.transportPerM > 0 && <Line label={copy.lineTransport} value={`− ${rupees(evaluation.transportPerM)}`} />}
                    {base.commissionPct > 0 && <Line label={fillCopy(copy.lineCommission, { pct: `${base.commissionPct}%` })} value={`− ${rupees(evaluation.commissionPerM)}`} />}
                    <Line label={losing ? copy.lineLoss : copy.lineProfit} value={rupees(evaluation.profitPerM)} strong tone={losing ? LOSS_TEXT : undefined} />
                </dl>
            </section>

            {showWhatIf && (
                <section aria-labelledby="offer-whatif" className="border-t border-hairline pt-6 @3xl:border-t-0 @3xl:pt-0">
                    <h2 id="offer-whatif" className={SECTION_LABEL}>{copy.whatIfTitle}</h2>
                    {base.stress.available ? (
                        <>
                            <p className="mt-1 text-[13px] text-muted-foreground">{copy.whatIfIntro}</p>
                            <ul className="mt-2 divide-y divide-hairline">
                                {cases.map(stress => (
                                    <li key={stress.id} className="py-2.5">
                                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
                                            <p className="text-sm text-body">{stressLabels[stress.id]}</p>
                                            <p className={cn('text-sm font-semibold tabular-nums', marginTone(stress.marginPct))}>
                                                {fillCopy(stress.profitPerM < 0 ? copy.caseLose : copy.caseKeep, { amount: Math.abs(stress.profitPerM).toFixed(2), pct: percent(stress.marginPct) })}
                                            </p>
                                        </div>
                                        <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                                            {fillCopy(copy.caseCost, { cost: stress.productionCostPerM.toFixed(2) })}
                                            {' '}({stress.costChangePerM >= 0 ? '+' : '−'}₹{Math.abs(stress.costChangePerM).toFixed(2)})
                                            {hasQuantity && stress.orderProfit != null && (
                                                <> · {fillCopy(stress.orderProfit < 0 ? copy.caseOrderLoss : copy.caseOrderProfit, { amount: orderRupees(Math.abs(stress.orderProfit)) })}</>
                                            )}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.whatIfUnavailable}</p>
                    )}
                </section>
            )}
        </div>
    )
}

/**
 * The answer for a costing: the figure (or, before a price, the prompt) and the price
 * track, then the working beneath once there is a price. Both moments share one tree,
 * so the track stays mounted (and keeps a drag or keyboard focus) when the first price
 * arrives.
 */
export function OfferCheckResult({
    base,
    evaluation,
    hasQuantity,
    copy,
    track,
}: {
    base: OfferBase
    /** Null until the buyer's price is a usable number. */
    evaluation: OfferEvaluation | null
    hasQuantity: boolean
    copy: OfferCheckText
    /** The price track, owned by the page so it can move the typed price. */
    track?: ReactNode
}) {
    return (
        <>
            <div className="space-y-6 p-5 sm:p-6 lg:p-8">
                {evaluation ? (
                    <OfferHeadline base={base} evaluation={evaluation} copy={copy} />
                ) : (
                    <p className="text-sm text-muted-foreground">{copy.prompt}</p>
                )}
                {track}
            </div>
            {evaluation ? (
                <div className="border-t border-hairline p-5 sm:p-6 lg:p-8">
                    <OfferDetails base={base} evaluation={evaluation} copy={copy} hasQuantity={hasQuantity} />
                </div>
            ) : null}
        </>
    )
}
