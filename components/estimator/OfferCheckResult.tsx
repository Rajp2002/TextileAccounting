import type { CSSProperties, ReactNode } from 'react'
import { marginTone } from '@/components/estimator/SavedCostingMargin'
import styles from '@/components/estimator/offer-check.module.css'
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

/** The label over a headline figure: You keep, Whole order. These sit on the loom-navy panel. */
const FIGURE_LABEL = 'text-[13px] font-medium text-wv-text-inverse-secondary'

/** The semantic tones re-tuned for navy (the variables live on the panel, see offer-check.module.css). */
const LOOM_LOSS = 'text-[var(--loom-loss)]'
const LOOM_THIN = 'text-[var(--loom-thin)]'
const LOOM_GOOD = 'text-wv-text-inverse'

/** Margin on navy: ochre under 10%, red when the offer loses money, plain light otherwise (as marginTone does on white). */
function loomTone(margin: number) {
    return margin < 0 ? LOOM_LOSS : margin < 10 ? LOOM_THIN : LOOM_GOOD
}

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
    loss: 'bg-[var(--loom-loss)]',
    break_even: 'bg-[var(--loom-thin)]',
    below_price: 'bg-[var(--loom-thin)]',
    at_or_above_price: 'bg-[var(--loom-good)]',
}

/**
 * Tape-measure ticks for the track: about fifteen, on round prices (1, 2 or 5 times a
 * power of ten), every fifth one longer, like the marks on a measuring tape.
 */
function tapeTicks(min: number, max: number) {
    const span = max - min
    if (!(span > 0)) return []
    const raw = span / 16
    const magnitude = 10 ** Math.floor(Math.log10(raw))
    const step = [1, 2, 5, 10].map(factor => factor * magnitude).find(candidate => candidate >= raw) ?? raw
    const first = Math.ceil(min / step - 1e-9)
    const last = Math.floor(max / step + 1e-9)
    const ticks: { at: number; major: boolean }[] = []
    for (let k = first; k <= last; k++) ticks.push({ at: ((k * step - min) / span) * 100, major: k % 5 === 0 })
    return ticks
}

/**
 * The price axis of a check, laid on the navy panel like a length of cloth: a thread
 * striped in the zone below break-even, the zone between break-even and the costing's
 * own price, and the zone above it, with a tape measure's ticks beneath and the offer
 * as the saffron bead. It is the one slider on the page, so dragging it is the same as
 * typing a price. The scale is the slider's range, fixed for a costing, so the ticks
 * never move while the owner drags.
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
    const ticks = tapeTicks(range.min, range.max)
    // Zones, ticks and labels sit 11px in from each end (half the thumb), where the thumb's centre stops.
    // Each label slides along its own width as its tick moves, so it stays inside the track at either end.
    const label = (position: number): CSSProperties => ({ left: `${position}%`, transform: `translateX(-${position}%)` })

    return (
        <div data-offer-track>
            <div aria-hidden="true" className="relative mx-[11px] h-5">
                <span className="absolute bottom-0 whitespace-nowrap text-[13px] text-wv-text-inverse-secondary" style={label(price)}>
                    {copy.legendPrice} <span className="font-semibold text-wv-text-inverse tabular-nums">{rupees(base.sellingPricePerM)}</span>
                </span>
            </div>
            <div className="relative">
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[11px] top-1/2 h-2.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/10">
                    <span className="absolute inset-y-0 left-0 bg-[var(--wv-madder-600)]/85" style={{ width: `${breakEven}%` }} />
                    <span className="absolute inset-y-0 bg-[var(--wv-ochre-400)]/80" style={{ left: `${breakEven}%`, width: `${Math.max(price - breakEven, 0)}%` }} />
                    <span className="absolute inset-y-0 right-0 bg-[color-mix(in_oklab,var(--wv-moss-200)_45%,var(--wv-moss-700))]/90" style={{ left: `${price}%` }} />
                    <span className={cn('absolute inset-0', styles.stripe)} />
                </span>
                <span aria-hidden="true" className="pointer-events-none absolute inset-x-[11px] inset-y-0">
                    {ticks.map((tick, index) => (
                        <span key={index} className={cn('absolute top-[calc(50%+9px)] w-px -translate-x-1/2 bg-white/40', tick.major ? 'h-2' : 'h-1')} style={{ left: `${tick.at}%` }} />
                    ))}
                    {[breakEven, price].map((position, index) => (
                        <span key={index} className="absolute top-1/2 h-[18px] w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/85" style={{ left: `${position}%` }} />
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
                    style={{
                        '--range-track': 'transparent',
                        '--range-fill': 'transparent',
                        '--range-thumb-edge': 'var(--wv-bg-inverse)',
                        '--range-thumb-ring': 'var(--wv-saffron-500)',
                    } as CSSProperties}
                />
            </div>
            <div aria-hidden="true" className="relative mx-[11px] h-5">
                <span className="absolute top-0 whitespace-nowrap text-[13px] text-wv-text-inverse-secondary" style={label(breakEven)}>
                    {copy.legendBreakEven} <span className="font-semibold text-wv-text-inverse tabular-nums">{rupees(base.breakEvenPricePerM)}</span>
                </span>
            </div>
            <p className="sr-only">
                {copy.rulerLabel}: {copy.legendBreakEven} {rupees(base.breakEvenPricePerM)}, {copy.legendPrice} {rupees(base.sellingPricePerM)}.
            </p>
        </div>
    )
}

/**
 * The navy panel the answer sits on: Weavly's loom navy (the sidebar's own colour) with a faint
 * weave. `thread` adds the logo's thread and spool, for the moments before an answer exists.
 */
export function OfferLoomPanel({ children, thread = false }: { children: ReactNode; thread?: boolean }) {
    return (
        <div data-offer-loom className={cn(styles.loom, 'p-5 sm:p-6 lg:p-8')}>
            {thread && <span aria-hidden="true" className={styles.thread} />}
            {children}
        </div>
    )
}

/** The answer before there is one: the figure's place, kept, so the page does not jump when it arrives. */
export function OfferFigurePlaceholder({ copy, children }: { copy: OfferCheckText; children?: ReactNode }) {
    return (
        <div>
            <p className={FIGURE_LABEL}>{copy.keep}</p>
            <p aria-hidden="true" className="mt-2 text-5xl font-semibold leading-none tracking-[-0.035em] text-white/25 tabular-nums">
                ₹ —<span className="ml-1.5 text-base font-medium tracking-normal">{copy.perMetre}</span>
            </p>
            {children}
        </div>
    )
}

export function Line({ label, value, strong, tone, inverse }: { label: string; value: string; strong?: boolean; tone?: string; inverse?: boolean }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4 py-1.5', strong && 'mt-1 border-t border-hairline pt-3')}>
            <dt className={cn('text-sm', inverse ? 'text-wv-text-inverse-secondary' : strong ? 'font-semibold text-ink' : 'text-body')}>{label}</dt>
            <dd className={cn('text-sm tabular-nums', strong ? 'text-base font-semibold' : inverse ? 'font-medium text-wv-text-inverse' : 'font-medium text-ink', tone)}>{value}</dd>
        </div>
    )
}

type AnswerProps = { base: OfferBase; evaluation: OfferEvaluation; copy: OfferCheckText }

function answerFigures(evaluation: OfferEvaluation) {
    const order = evaluation.order
    return {
        losing: evaluation.profitPerM < 0,
        tone: marginTone(evaluation.marginPct),
        loomTone: loomTone(evaluation.marginPct),
        order,
        orderTone: order ? (order.profit < 0 ? LOOM_LOSS : order.profit === 0 ? LOOM_THIN : LOOM_GOOD) : LOOM_GOOD,
    }
}

/** What the offer leaves on a metre, and on the whole order once there is a quantity. */
function OfferHeadline({ evaluation, copy }: AnswerProps) {
    const { losing, loomTone: tone, order, orderTone } = answerFigures(evaluation)
    return (
        <div className="grid gap-6 @2xl:grid-cols-[minmax(0,1fr)_minmax(15rem,0.62fr)] @2xl:gap-8">
            <div aria-live="polite">
                <p className={FIGURE_LABEL}>{losing ? copy.lose : copy.keep}</p>
                <p className={cn('mt-2 text-5xl font-semibold leading-none tracking-[-0.035em] tabular-nums', tone)} data-offer-profit>
                    {rupees(Math.abs(evaluation.profitPerM))}<span className="ml-1.5 text-base font-medium tracking-normal text-wv-text-inverse-secondary">{copy.perMetre}</span>
                </p>
                <p className={cn('mt-3 text-sm font-semibold tabular-nums', tone)}>{fillCopy(copy.marginOfOffer, { pct: percent(evaluation.marginPct) })}</p>
                <p className="mt-2 flex max-w-xl gap-2.5 text-sm leading-relaxed text-wv-text-inverse">
                    <span aria-hidden="true" className={cn('mt-[0.45rem] size-2 shrink-0 rounded-full', VERDICT_DOT[evaluation.verdict])} />
                    <span>{verdictCopy(copy, evaluation)}</span>
                </p>
            </div>

            <section aria-labelledby="offer-order" className="border-t border-white/10 pt-5 @2xl:border-l @2xl:border-t-0 @2xl:pl-8 @2xl:pt-0">
                <h2 id="offer-order" className={FIGURE_LABEL}>{copy.orderTitle}</h2>
                {order ? (
                    <>
                        <p className={cn('mt-2 text-4xl font-semibold leading-none tracking-[-0.03em] tabular-nums', orderTone)} data-offer-order-profit>
                            {orderRupees(Math.abs(order.profit))}
                        </p>
                        <p className={cn('mt-3 text-sm font-semibold tabular-nums', orderTone)}>{fillCopy(order.profit < 0 ? copy.orderLoss : copy.orderProfit, { m: metres(order.quantityM) })}</p>
                        <dl className="mt-3 border-t border-white/10 pt-1.5">
                            <Line inverse label={copy.orderValue} value={orderRupees(order.value)} />
                            <Line inverse label={copy.orderCost} value={orderRupees(order.cost)} />
                        </dl>
                    </>
                ) : (
                    <p className="mt-2 max-w-xs text-sm leading-relaxed text-wv-text-inverse-secondary">{copy.orderPrompt}</p>
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
            <div className="grid gap-8 @3xl:grid-cols-2 @3xl:gap-12">
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
 * The answer for a costing: the navy panel (the figure, or its place and the prompt, and
 * the price track) and, once there is a price, the working beneath it on white. Both
 * moments share one tree, so the track stays mounted (and keeps a drag or keyboard
 * focus) when the first price arrives.
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
            <OfferLoomPanel thread={!evaluation}>
                <div className="space-y-8">
                    {evaluation ? (
                        <OfferHeadline base={base} evaluation={evaluation} copy={copy} />
                    ) : (
                        <OfferFigurePlaceholder copy={copy}>
                            <p className="mt-3 text-sm text-wv-text-inverse">{copy.prompt}</p>
                        </OfferFigurePlaceholder>
                    )}
                    {track}
                </div>
            </OfferLoomPanel>
            {evaluation ? (
                <div className="p-5 sm:p-6 lg:p-8">
                    <OfferDetails base={base} evaluation={evaluation} copy={copy} hasQuantity={hasQuantity} />
                </div>
            ) : null}
        </>
    )
}
