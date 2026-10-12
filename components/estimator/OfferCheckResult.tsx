import type { CSSProperties, ReactNode } from 'react'
import { marginTone } from '@/components/estimator/SavedCostingMargin'
import { RangeSlider } from '@/components/ui/range-slider'
import { fillCopy } from '@/lib/i18n/fill'
import type { OfferCheckText } from '@/lib/i18n/offer-check'
import type { OfferBase, OfferEvaluation, OfferStressId, OfferVerdict, offerSliderRange } from '@/lib/offer-check'
import { cn } from '@/lib/utils'

export const LOSS_TEXT = 'text-[var(--wv-madder-600)]'
const THIN_TEXT = 'text-[var(--wv-ochre-800)]'
const GOOD_TEXT = 'text-[var(--wv-moss-700)]'

/** The small section label used across the answer: Per metre, Against your costing, If your costs move. Letter-spacing suits Latin capitals only. */
export const SECTION_LABEL = 'text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground [&:not(:lang(en))]:tracking-normal'

/** The label over a headline figure: You keep, Whole order. */
const FIGURE_LABEL = 'text-[13px] font-medium text-muted-foreground'

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

function verdictCopy(copy: OfferCheckText, evaluation: OfferEvaluation) {
    const messages: Record<OfferVerdict, string> = {
        loss: fillCopy(copy.verdictLoss, { amount: amountText(evaluation.profitPerM) }),
        break_even: copy.verdictEven,
        below_price: fillCopy(copy.verdictBelow, { amount: amountText(evaluation.versusPrice.differencePerM) }),
        at_or_above_price: copy.verdictAbove,
    }
    return messages[evaluation.verdict]
}

function deltaCopy(copy: OfferCheckText, difference: number) {
    if (difference === 0) return copy.deltaSame
    return fillCopy(difference > 0 ? copy.deltaAbove : copy.deltaBelow, { amount: amountText(difference) })
}

const VERDICT_DOT: Record<OfferVerdict, string> = {
    loss: 'bg-[var(--wv-madder-600)]',
    break_even: 'bg-[var(--wv-ochre-400)]',
    below_price: 'bg-[var(--wv-ochre-400)]',
    at_or_above_price: 'bg-[var(--wv-moss-700)]',
}

/**
 * The price axis of a check: the zone below break-even, the zone between break-even
 * and the costing's own price, and the zone above it, with the offer as the thumb.
 * It is the one slider on the page, so dragging it is the same as typing a price.
 * The scale is the slider's range, fixed for a costing, so the ticks never move
 * while the owner drags.
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
    // Zones, ticks and labels sit 11px in from each end (half the thumb), where the thumb's centre stops.
    // Each label slides along its own width as its tick moves, so it stays inside the track at either end.
    const label = (position: number): CSSProperties => ({ left: `${position}%`, transform: `translateX(-${position}%)` })

    return (
        <div data-offer-track>
            <div aria-hidden="true" className="relative mx-[11px] h-5">
                <span className="absolute bottom-0 whitespace-nowrap text-[13px] text-muted-foreground" style={label(price)}>
                    {copy.legendPrice} <span className="font-semibold text-ink tabular-nums">{rupees(base.sellingPricePerM)}</span>
                </span>
            </div>
            <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[11px] top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-surface-soft">
                    <span className="absolute inset-y-0 left-0 bg-[var(--wv-madder-200)]/70" style={{ width: `${breakEven}%` }} />
                    <span className="absolute inset-y-0 bg-[var(--wv-ochre-200)]/70" style={{ left: `${breakEven}%`, width: `${Math.max(price - breakEven, 0)}%` }} />
                    <span className="absolute inset-y-0 right-0 bg-[var(--wv-moss-200)]/80" style={{ left: `${price}%` }} />
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[11px] inset-y-0">
                    {[breakEven, price].map((position, index) => (
                        <span key={index} className="absolute top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink/55" style={{ left: `${position}%` }} />
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
                    style={{ '--range-track': 'transparent', '--range-fill': 'transparent' } as CSSProperties}
                />
            </div>
            <div aria-hidden="true" className="relative mx-[11px] h-5">
                <span className="absolute top-0 whitespace-nowrap text-[13px] text-muted-foreground" style={label(breakEven)}>
                    {copy.legendBreakEven} <span className="font-semibold text-ink tabular-nums">{rupees(base.breakEvenPricePerM)}</span>
                </span>
            </div>
            <p className="sr-only">
                {copy.rulerLabel}: {copy.legendBreakEven} {rupees(base.breakEvenPricePerM)}, {copy.legendPrice} {rupees(base.sellingPricePerM)}.
            </p>
        </div>
    )
}

/** The answer before there is one: the figure's place, kept, so the page does not jump when it arrives. */
export function OfferFigurePlaceholder({ copy, children }: { copy: OfferCheckText; children?: ReactNode }) {
    return (
        <div>
            <p className={FIGURE_LABEL}>{copy.keep}</p>
            <p aria-hidden="true" className="mt-2 text-5xl font-semibold leading-none tracking-[-0.035em] text-hairline-strong tabular-nums">
                ₹ —<span className="ml-1.5 text-base font-medium tracking-normal">{copy.perMetre}</span>
            </p>
            {children}
        </div>
    )
}

export function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4 py-1.5', strong && 'mt-1 border-t border-hairline pt-3')}>
            <dt className={cn('text-sm', strong ? 'font-semibold text-ink' : 'text-body')}>{label}</dt>
            <dd className={cn('text-sm tabular-nums', strong ? 'text-base font-semibold' : 'font-medium text-ink', tone)}>{value}</dd>
        </div>
    )
}

type AnswerProps = { base: OfferBase; evaluation: OfferEvaluation; copy: OfferCheckText }

function answerFigures(evaluation: OfferEvaluation) {
    const order = evaluation.order
    return {
        losing: evaluation.profitPerM < 0,
        tone: marginTone(evaluation.marginPct),
        order,
        orderTone: order ? (order.profit < 0 ? LOSS_TEXT : order.profit === 0 ? THIN_TEXT : 'text-ink') : 'text-ink',
    }
}

/** What the offer leaves on a metre, and on the whole order once there is a quantity. */
function OfferHeadline({ evaluation, copy }: AnswerProps) {
    const { losing, tone, order, orderTone } = answerFigures(evaluation)
    return (
        <div className="grid gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.62fr)] @2xl:gap-8">
            <div aria-live="polite">
                <p className={FIGURE_LABEL}>{losing ? copy.lose : copy.keep}</p>
                <p className={cn('mt-2 text-5xl font-semibold leading-none tracking-[-0.035em] tabular-nums', tone)} data-offer-profit>
                    {rupees(Math.abs(evaluation.profitPerM))}<span className="ml-1.5 text-base font-medium tracking-normal text-muted-foreground">{copy.perMetre}</span>
                </p>
                <p className={cn('mt-3 text-sm font-semibold tabular-nums', tone)}>{fillCopy(copy.marginOfOffer, { pct: percent(evaluation.marginPct) })}</p>
                <p className="mt-2 flex max-w-xl gap-2.5 text-sm leading-relaxed text-body">
                    <span aria-hidden="true" className={cn('mt-[0.45rem] size-2 shrink-0 rounded-full', VERDICT_DOT[evaluation.verdict])} />
                    <span>{verdictCopy(copy, evaluation)}</span>
                </p>
            </div>

            <section aria-labelledby="offer-order" className="border-t border-hairline pt-5 @2xl:border-l @2xl:border-t-0 @2xl:pl-8 @2xl:pt-0">
                <h2 id="offer-order" className={FIGURE_LABEL}>{copy.orderTitle}</h2>
                {order ? (
                    <>
                        <p className={cn('mt-2 text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums', orderTone)} data-offer-order-profit>
                            {orderRupees(Math.abs(order.profit))}
                        </p>
                        <p className={cn('mt-3 text-sm font-semibold tabular-nums', orderTone)}>{fillCopy(order.profit < 0 ? copy.orderLoss : copy.orderProfit, { m: metres(order.quantityM) })}</p>
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

/** Where the answer comes from: the lines of a metre, the costing it is held against, and what moving costs would do. */
function OfferDetails({ base, evaluation, copy, hasQuantity }: AnswerProps & { hasQuantity: boolean }) {
    const { losing, tone } = answerFigures(evaluation)
    const stressLabels: Record<OfferStressId, string> = { 'yarn-up-10': copy.caseYarn, 'output-down-15': copy.caseOutput }
    const versusPrice = evaluation.versusPrice.differencePerM
    const versusBreakEven = evaluation.versusBreakEven.differencePerM

    return (
        <div className="space-y-8">
            <div className="grid gap-8 border-t border-hairline pt-6 @3xl:grid-cols-2 @3xl:gap-12">
                <section aria-labelledby="offer-lines">
                    <h2 id="offer-lines" className={SECTION_LABEL}>{copy.linesTitle}</h2>
                    <dl className="mt-3">
                        <Line label={copy.lineOffer} value={rupees(evaluation.offerPerM)} />
                        <Line label={copy.lineCost} value={`− ${rupees(evaluation.costPerM)}`} />
                        {evaluation.transportPerM > 0 && <Line label={copy.lineTransport} value={`− ${rupees(evaluation.transportPerM)}`} />}
                        {base.commissionPct > 0 && <Line label={fillCopy(copy.lineCommission, { pct: `${base.commissionPct}%` })} value={`− ${rupees(evaluation.commissionPerM)}`} />}
                        <Line label={losing ? copy.lineLoss : copy.lineProfit} value={rupees(evaluation.profitPerM)} strong tone={tone} />
                    </dl>
                </section>

                <section aria-labelledby="offer-compare">
                    <h2 id="offer-compare" className={SECTION_LABEL}>{copy.compareTitle}</h2>
                    <ul className="mt-3 divide-y divide-hairline">
                        <li className="pb-2.5 pt-1.5">
                            <div className="flex items-baseline justify-between gap-4">
                                <p className="text-sm text-body">{copy.comparePrice}</p>
                                <p className="text-sm font-medium tabular-nums text-ink">{rupees(base.sellingPricePerM)}</p>
                            </div>
                            <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-[13px] tabular-nums">
                                <p className="text-muted-foreground">{fillCopy(copy.compareMargin, { pct: percent(base.targetMarginPct) })}</p>
                                <p className={cn('font-semibold', versusPrice > 0 ? GOOD_TEXT : versusPrice < 0 ? THIN_TEXT : 'text-ink')}>
                                    {deltaCopy(copy, versusPrice)}{versusPrice !== 0 && ` (${percent(Math.abs(evaluation.versusPrice.differencePct))})`}
                                </p>
                            </div>
                        </li>
                        <li className="py-2.5">
                            <div className="flex items-baseline justify-between gap-4">
                                <p className="text-sm text-body">{copy.compareBreakEven}</p>
                                <p className="text-sm font-medium tabular-nums text-ink">{rupees(base.breakEvenPricePerM)}</p>
                            </div>
                            <p className={cn('mt-1 text-right text-[13px] font-semibold tabular-nums', versusBreakEven > 0 ? GOOD_TEXT : versusBreakEven < 0 ? LOSS_TEXT : THIN_TEXT)}>
                                {deltaCopy(copy, versusBreakEven)}
                            </p>
                        </li>
                    </ul>
                </section>
            </div>

            <section aria-labelledby="offer-whatif" className="border-t border-hairline pt-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h2 id="offer-whatif" className={SECTION_LABEL}>{copy.whatIfTitle}</h2>
                    {base.stress.available && <p className="text-[13px] text-muted-foreground">{copy.whatIfIntro}</p>}
                </div>
                {base.stress.available ? (
                    <ul className="mt-3 grid divide-y divide-hairline @2xl:grid-cols-2 @2xl:divide-x @2xl:divide-y-0">
                        {evaluation.stress.map(stress => {
                            const fixed = stress.costChangePerM === 0 && base.stress.available && base.stress.fixedOverheadPerM != null && stress.id === 'output-down-15'
                            const stressLosing = stress.profitPerM < 0
                            return (
                                <li key={stress.id} className="py-4 @2xl:px-6 @2xl:py-1 @2xl:first:pl-0 @2xl:last:pr-0">
                                    <p className="text-sm font-semibold text-ink">{stressLabels[stress.id]}</p>
                                    <p className={cn('mt-2 text-lg font-semibold leading-snug tabular-nums', marginTone(stress.marginPct))}>
                                        {fillCopy(stressLosing ? copy.caseLose : copy.caseKeep, { amount: Math.abs(stress.profitPerM).toFixed(2), pct: percent(stress.marginPct) })}
                                    </p>
                                    {fixed ? (
                                        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{fillCopy(copy.caseFixed, { amount: (base.stress.available ? base.stress.fixedOverheadPerM ?? 0 : 0).toFixed(2) })}</p>
                                    ) : (
                                        <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
                                            {fillCopy(copy.caseCost, { cost: stress.productionCostPerM.toFixed(2) })}
                                            {' '}({stress.costChangePerM >= 0 ? '+' : '−'}₹{Math.abs(stress.costChangePerM).toFixed(2)})
                                        </p>
                                    )}
                                    {hasQuantity && stress.orderProfit != null && (
                                        <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                                            {fillCopy(stress.orderProfit < 0 ? copy.caseOrderLoss : copy.caseOrderProfit, { amount: orderRupees(Math.abs(stress.orderProfit)) })}
                                        </p>
                                    )}
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.whatIfUnavailable}</p>
                )}
            </section>
        </div>
    )
}

/**
 * The answer panel for a costing. Before a price it holds the figure's place and
 * the prompt; after, the answer. Both moments share one tree, so the track stays
 * mounted (and keeps a drag or keyboard focus) when the first price arrives.
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
        <div className="space-y-8">
            {evaluation ? (
                <OfferHeadline base={base} evaluation={evaluation} copy={copy} />
            ) : (
                <OfferFigurePlaceholder copy={copy}>
                    <p className="mt-3 text-sm text-body">{copy.prompt}</p>
                </OfferFigurePlaceholder>
            )}
            {track}
            {evaluation ? <OfferDetails base={base} evaluation={evaluation} copy={copy} hasQuantity={hasQuantity} /> : null}
        </div>
    )
}
