import { marginTone } from '@/components/estimator/SavedCostingMargin'
import { fillCopy } from '@/lib/i18n/fill'
import type { OfferCheckText } from '@/lib/i18n/offer-check'
import type { OfferBase, OfferEvaluation, OfferStressId, OfferVerdict } from '@/lib/offer-check'
import { cn } from '@/lib/utils'

export const LOSS_TEXT = 'text-[var(--wv-madder-600)]'
const THIN_TEXT = 'text-[var(--wv-ochre-800)]'

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

const MARKER_TONE: Record<OfferVerdict, string> = {
    loss: 'bg-[var(--wv-madder-600)]',
    break_even: 'bg-[var(--wv-ochre-400)]',
    below_price: 'bg-[var(--wv-ochre-400)]',
    at_or_above_price: 'bg-[var(--wv-moss-700)]',
}

/**
 * Where the offer sits between break-even and the costing's own price. The track
 * is decoration for the eye: the values it shows are also written out beneath it.
 */
function OfferRuler({ base, evaluation, copy }: { base: OfferBase; evaluation: OfferEvaluation; copy: OfferCheckText }) {
    const values = [base.breakEvenPricePerM, base.sellingPricePerM, evaluation.offerPerM]
    const low = Math.min(...values)
    const high = Math.max(...values)
    const pad = Math.max((high - low) * 0.18, 0.25)
    const start = low - pad
    const span = high + pad - start
    const at = (value: number) => `${Math.min(100, Math.max(0, ((value - start) / span) * 100))}%`

    return (
        <div>
            <div role="img" aria-label={`${copy.rulerLabel}: ${copy.legendBreakEven} ${rupees(base.breakEvenPricePerM)}, ${copy.legendPrice} ${rupees(base.sellingPricePerM)}, ${copy.legendOffer} ${rupees(evaluation.offerPerM)}`} className="relative mt-1 h-6">
                <span aria-hidden="true" className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-surface-soft">
                    <span className="absolute inset-y-0 left-0 bg-[var(--wv-madder-50)]" style={{ width: at(base.breakEvenPricePerM) }} />
                    <span className="absolute inset-y-0 bg-[var(--wv-ochre-50)]" style={{ left: at(base.breakEvenPricePerM), width: `calc(${at(base.sellingPricePerM)} - ${at(base.breakEvenPricePerM)})` }} />
                    <span className="absolute inset-y-0 right-0 bg-[var(--wv-moss-50)]" style={{ left: at(base.sellingPricePerM) }} />
                </span>
                {[base.breakEvenPricePerM, base.sellingPricePerM].map((value, index) => (
                    <span key={index} aria-hidden="true" className="absolute top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink/45" style={{ left: at(value) }} />
                ))}
                <span
                    aria-hidden="true"
                    className={cn('absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface shadow-sm transition-[left] duration-200 motion-reduce:transition-none', MARKER_TONE[evaluation.verdict])}
                    style={{ left: at(evaluation.offerPerM) }}
                />
            </div>
            <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px] tabular-nums">
                <div className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-ink/45" /><dt className="text-muted-foreground">{copy.legendBreakEven}</dt><dd className="font-medium text-ink">{rupees(base.breakEvenPricePerM)}</dd></div>
                <div className="flex items-center gap-1.5"><span aria-hidden="true" className="h-3 w-0.5 rounded-full bg-ink/45" /><dt className="text-muted-foreground">{copy.legendPrice}</dt><dd className="font-medium text-ink">{rupees(base.sellingPricePerM)}</dd></div>
                <div className="flex items-center gap-1.5"><span aria-hidden="true" className={cn('size-2.5 rounded-full', MARKER_TONE[evaluation.verdict])} /><dt className="text-muted-foreground">{copy.legendOffer}</dt><dd className="font-medium text-ink">{rupees(evaluation.offerPerM)}</dd></div>
            </dl>
        </div>
    )
}

export function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
    return (
        <div className={cn('flex items-baseline justify-between gap-4 py-1.5', strong && 'border-t border-hairline pt-2.5')}>
            <dt className={cn('text-sm', strong ? 'font-semibold text-ink' : 'text-body')}>{label}</dt>
            <dd className={cn('text-sm tabular-nums', strong ? 'font-semibold' : 'font-medium text-ink', tone)}>{value}</dd>
        </div>
    )
}

export function OfferCheckResult({ base, evaluation, hasQuantity, copy }: { base: OfferBase; evaluation: OfferEvaluation; hasQuantity: boolean; copy: OfferCheckText }) {
    const losing = evaluation.profitPerM < 0
    const tone = marginTone(evaluation.marginPct)
    const order = evaluation.order
    const stressLabels: Record<OfferStressId, string> = { 'yarn-up-10': copy.caseYarn, 'output-down-15': copy.caseOutput }

    return (
        <div className="space-y-6">
            <div>
                <p className="text-[13px] text-muted-foreground">{losing ? copy.lose : copy.keep}</p>
                <p className={cn('mt-1.5 text-5xl font-semibold leading-none tracking-[-0.03em] tabular-nums', tone)} data-offer-profit>
                    {rupees(Math.abs(evaluation.profitPerM))}<span className="ml-1 text-base font-medium tracking-normal text-muted-foreground">/m</span>
                </p>
                <p className={cn('mt-2 text-sm font-medium tabular-nums', tone)}>{fillCopy(copy.marginOfOffer, { pct: percent(evaluation.marginPct) })}</p>
                <p className="mt-3 max-w-xl text-sm leading-relaxed text-body">{verdictCopy(copy, evaluation)}</p>
            </div>

            <OfferRuler base={base} evaluation={evaluation} copy={copy} />

            <section aria-labelledby="offer-order" className="border-t border-hairline pt-5">
                <h2 id="offer-order" className="text-sm font-semibold text-ink">{copy.orderTitle}</h2>
                {order ? (
                    <>
                        <p className={cn('mt-2 text-2xl font-semibold tracking-[-0.02em] tabular-nums', order.profit < 0 ? LOSS_TEXT : order.profit === 0 ? THIN_TEXT : 'text-ink')} data-offer-order-profit>
                            {orderRupees(Math.abs(order.profit))}
                            <span className="ml-2 text-sm font-medium tracking-normal text-muted-foreground">{fillCopy(order.profit < 0 ? copy.orderLoss : copy.orderProfit, { m: metres(order.quantityM) })}</span>
                        </p>
                        <dl className="mt-2">
                            <Line label={copy.orderValue} value={orderRupees(order.value)} />
                            <Line label={copy.orderCost} value={orderRupees(order.cost)} />
                        </dl>
                    </>
                ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground">{copy.orderPrompt}</p>
                )}
            </section>

            <section aria-labelledby="offer-lines" className="border-t border-hairline pt-5">
                <h2 id="offer-lines" className="text-sm font-semibold text-ink">{copy.linesTitle}</h2>
                <dl className="mt-2">
                    <Line label={copy.lineOffer} value={rupees(evaluation.offerPerM)} />
                    <Line label={copy.lineCost} value={`− ${rupees(evaluation.costPerM)}`} />
                    {evaluation.transportPerM > 0 && <Line label={copy.lineTransport} value={`− ${rupees(evaluation.transportPerM)}`} />}
                    {base.commissionPct > 0 && <Line label={fillCopy(copy.lineCommission, { pct: `${base.commissionPct}%` })} value={`− ${rupees(evaluation.commissionPerM)}`} />}
                    <Line label={losing ? copy.lineLoss : copy.lineProfit} value={rupees(evaluation.profitPerM)} strong tone={tone} />
                </dl>
            </section>

            <section aria-labelledby="offer-compare" className="border-t border-hairline pt-5">
                <h2 id="offer-compare" className="text-sm font-semibold text-ink">{copy.compareTitle}</h2>
                <ul className="mt-2 divide-y divide-hairline">
                    <li className="py-2.5">
                        <div className="flex items-baseline justify-between gap-4">
                            <p className="text-sm text-body">{copy.comparePrice}</p>
                            <p className="text-sm font-medium tabular-nums text-ink">{rupees(base.sellingPricePerM)}</p>
                        </div>
                        <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">
                            {fillCopy(copy.compareMargin, { pct: percent(base.targetMarginPct) })} · {deltaCopy(copy, evaluation.versusPrice.differencePerM)}{evaluation.versusPrice.differencePerM !== 0 && ` (${percent(Math.abs(evaluation.versusPrice.differencePct))})`}
                        </p>
                    </li>
                    <li className="py-2.5">
                        <div className="flex items-baseline justify-between gap-4">
                            <p className="text-sm text-body">{copy.compareBreakEven}</p>
                            <p className="text-sm font-medium tabular-nums text-ink">{rupees(base.breakEvenPricePerM)}</p>
                        </div>
                        <p className="mt-0.5 text-[13px] text-muted-foreground tabular-nums">{deltaCopy(copy, evaluation.versusBreakEven.differencePerM)}</p>
                    </li>
                </ul>
            </section>

            <section aria-labelledby="offer-whatif" className="border-t border-hairline pt-5">
                <h2 id="offer-whatif" className="text-sm font-semibold text-ink">{copy.whatIfTitle}</h2>
                {base.stress.available ? (
                    <>
                        <p className="mt-1 text-[13px] text-muted-foreground">{copy.whatIfIntro}</p>
                        <ul className="mt-2 divide-y divide-hairline">
                            {evaluation.stress.map(stress => {
                                const fixed = stress.costChangePerM === 0 && base.stress.available && base.stress.fixedOverheadPerM != null && stress.id === 'output-down-15'
                                const stressLosing = stress.profitPerM < 0
                                return (
                                    <li key={stress.id} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-4">
                                        <p className="text-sm font-medium text-ink">{stressLabels[stress.id]}</p>
                                        {fixed ? (
                                            <p className="text-sm text-muted-foreground">{fillCopy(copy.caseFixed, { amount: (base.stress.available ? base.stress.fixedOverheadPerM ?? 0 : 0).toFixed(2) })}</p>
                                        ) : (
                                            <div className="text-sm tabular-nums">
                                                <p className="text-body">
                                                    {fillCopy(copy.caseCost, { cost: stress.productionCostPerM.toFixed(2) })}
                                                    <span className="text-muted-foreground"> ({stress.costChangePerM >= 0 ? '+' : '−'}₹{Math.abs(stress.costChangePerM).toFixed(2)})</span>
                                                </p>
                                                <p className={cn('font-semibold', marginTone(stress.marginPct))}>
                                                    {fillCopy(stressLosing ? copy.caseLose : copy.caseKeep, { amount: Math.abs(stress.profitPerM).toFixed(2), pct: percent(stress.marginPct) })}
                                                </p>
                                                {hasQuantity && stress.orderProfit != null && (
                                                    <p className="text-[13px] text-muted-foreground">
                                                        {fillCopy(stress.orderProfit < 0 ? copy.caseOrderLoss : copy.caseOrderProfit, { amount: orderRupees(Math.abs(stress.orderProfit)) })}
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                ) : (
                    <p className="mt-1.5 text-sm text-muted-foreground">{copy.whatIfUnavailable}</p>
                )}
            </section>
        </div>
    )
}
