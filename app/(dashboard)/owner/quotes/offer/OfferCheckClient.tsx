'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Calculator, FileText, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RangeSlider } from '@/components/ui/range-slider'
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { LOSS_TEXT, Line, OfferCheckResult, metres, percent, rupees } from '@/components/estimator/OfferCheckResult'
import { useTranslation } from '@/lib/i18n/context'
import { fillCopy } from '@/lib/i18n/fill'
import { offerCheckText } from '@/lib/i18n/offer-check'
import { formatTimestampDate } from '@/lib/format'
import { cn } from '@/lib/utils'
import {
    OFFER_PRICE_MAX,
    OFFER_QUANTITY_MAX,
    evaluateOffer,
    offerSliderRange,
    parseOfferNumber,
    snapOfferToSlider,
    type OfferBaseResult,
    type OfferCandidate,
} from '@/lib/offer-check'
import { getOfferBase } from './actions'

type LoadState = 'idle' | 'loading' | 'failed'

export default function OfferCheckClient({
    candidates,
    loadError,
    initialKey,
    initialBase,
}: {
    candidates: OfferCandidate[]
    loadError: boolean
    initialKey: string | null
    initialBase: OfferBaseResult | null
}) {
    const { language } = useTranslation()
    const copy = offerCheckText[language]
    const router = useRouter()
    const priceId = useId()
    const quantityId = useId()
    const qualityId = useId()
    const priceRef = useRef<HTMLInputElement>(null)
    const [key, setKey] = useState<string | null>(initialKey)
    const [result, setResult] = useState<OfferBaseResult | null>(initialBase)
    const [load, setLoad] = useState<LoadState>('idle')
    const [priceText, setPriceText] = useState('')
    const [quantityText, setQuantityText] = useState('')
    // A costing opened for a check is not read twice; the latest request wins when the owner switches fast.
    const cache = useRef(new Map<string, OfferBaseResult>(initialKey && initialBase ? [[initialKey, initialBase]] : []))
    const latestRequest = useRef(0)

    const candidate = candidates.find(item => item.key === key) ?? null
    const base = result?.ok ? result.base : null

    const openCandidate = async (item: OfferCandidate) => {
        const request = ++latestRequest.current
        setKey(item.key)
        try { window.history.replaceState(null, '', `?costing=${item.latestId}`) } catch { /* The address is a convenience. */ }
        if (!item.checkable) { setResult(null); setLoad('idle'); return }
        const cached = cache.current.get(item.key)
        if (cached) { setResult(cached); setLoad('idle'); return }
        setResult(null)
        setLoad('loading')
        try {
            const response = await getOfferBase(item.latestId)
            if (request !== latestRequest.current) return
            if ('error' in response) { setLoad('failed'); return }
            cache.current.set(item.key, response.data)
            setResult(response.data)
            setLoad('idle')
        } catch {
            if (request === latestRequest.current) setLoad('failed')
        }
    }

    // Arriving from a card, the price is the one thing left to type.
    useEffect(() => {
        if (initialBase?.ok) priceRef.current?.focus({ preventScroll: true })
    }, [initialBase])

    const price = parseOfferNumber(priceText, OFFER_PRICE_MAX)
    const quantity = parseOfferNumber(quantityText, OFFER_QUANTITY_MAX)
    const evaluation = useMemo(
        () => (base && price.status === 'ok' ? evaluateOffer(base, price.value, quantity.status === 'ok' ? quantity.value : null) : null),
        [base, price, quantity],
    )
    const range = useMemo(() => (base ? offerSliderRange(base) : null), [base])

    if (loadError) {
        return (
            <div className="ui-route-enter w-full space-y-4 sm:space-y-6" data-offer-check data-i18n-skip="true" lang={language}>
                <PageHeader title={copy.title} description={copy.intro} />
                <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] p-4 text-sm text-[var(--wv-madder-600)]">
                    <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                    <p className="min-w-0 flex-1">{copy.listFailed}</p>
                    <Button type="button" variant="outline" onClick={() => router.refresh()} className="min-h-10 max-md:min-h-[44px]">{copy.retry}</Button>
                </div>
            </div>
        )
    }

    const backAction = (
        <Button asChild variant="outline" className="min-h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs max-md:min-h-[44px]">
            <Link href="/owner/quotes"><ArrowLeft className="size-4" aria-hidden="true" />{copy.back}</Link>
        </Button>
    )

    if (candidates.length === 0) {
        return (
            <div className="ui-route-enter w-full space-y-4 sm:space-y-6" data-offer-check data-i18n-skip="true" lang={language}>
                <PageHeader title={copy.title} description={copy.intro} actions={backAction} />
                <EmptyState
                    icon={FileText}
                    title={copy.emptyTitle}
                    description={copy.emptyBody}
                    action={<Button asChild className="min-h-10 max-md:min-h-[44px]"><Link href="/owner/estimator"><Calculator className="size-4" aria-hidden="true" />{copy.emptyAction}</Link></Button>}
                />
            </div>
        )
    }

    const priceInvalid = price.status === 'invalid'
    const quantityInvalid = quantity.status === 'invalid'
    const fieldClass = 'h-11 rounded-lg border-hairline bg-surface text-base tabular-nums max-md:min-h-[44px]'
    const usableQuantity = base?.quantityM != null && base.quantityM > 0 ? base.quantityM : null

    return (
        <div className="ui-route-enter w-full space-y-4 sm:space-y-6" data-offer-check data-i18n-skip="true" lang={language}>
            <RouteMilestones route="/owner/quotes" shellVisible primaryUsable secondaryReady />
            <PageHeader title={copy.title} description={copy.intro} actions={backAction} />

            <section className="grid overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs lg:grid-cols-[minmax(0,23rem)_minmax(0,1fr)]">
                <div className="space-y-5 p-5 sm:p-6">
                    <div>
                        <Label htmlFor={qualityId} className="text-[13px] font-medium text-muted-foreground">{copy.qualityLabel}</Label>
                        <select
                            id={qualityId}
                            value={key ?? ''}
                            onChange={event => {
                                const next = candidates.find(item => item.key === event.target.value)
                                if (next) void openCandidate(next)
                            }}
                            className="mt-1.5 h-11 w-full min-w-0 rounded-lg border border-hairline bg-surface px-3 text-base font-medium text-ink shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/25 max-md:min-h-[44px]"
                        >
                            <option value="" disabled>{copy.qualityPlaceholder}</option>
                            {candidates.map(item => {
                                const name = item.name || copy.untitled
                                return (
                                    <option key={item.key} value={item.key}>
                                        {item.checkable && item.sellingPricePerM != null
                                            ? fillCopy(copy.optionLabel, { name, n: item.versionNumber, price: item.sellingPricePerM.toFixed(2) })
                                            : fillCopy(copy.optionRecalc, { name, n: item.versionNumber })}
                                    </option>
                                )
                            })}
                        </select>
                        {base && candidate && (
                            <p className="mt-2 text-[13px] leading-5 text-muted-foreground tabular-nums">
                                {fillCopy(copy.basedOn, {
                                    n: base.versionNumber,
                                    date: formatTimestampDate(base.savedAt, { day: 'numeric', month: 'short' }),
                                    cost: base.productionCostPerM.toFixed(2),
                                    price: base.sellingPricePerM.toFixed(2),
                                    margin: percent(base.targetMarginPct),
                                })}
                            </p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 gap-x-3 gap-y-5 max-lg:grid-cols-2 max-lg:gap-y-1 lg:gap-y-5">
                        <div className="min-w-0 lg:row-start-1">
                            <Label htmlFor={priceId} className="text-[13px] font-medium text-muted-foreground">{copy.priceLabel}</Label>
                            <div className="relative mt-1.5">
                                <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted-foreground">₹</span>
                                <Input
                                    ref={priceRef}
                                    id={priceId}
                                    type="text"
                                    inputMode="decimal"
                                    autoComplete="off"
                                    value={priceText}
                                    onChange={event => setPriceText(event.target.value)}
                                    disabled={!base}
                                    aria-invalid={priceInvalid || undefined}
                                    aria-describedby={`${priceId}-hint`}
                                    placeholder={base ? base.sellingPricePerM.toFixed(2) : undefined}
                                    className={cn(fieldClass, 'pl-7')}
                                />
                            </div>
                            <p id={`${priceId}-hint`} className={cn('mt-1.5 text-[13px] leading-5', priceInvalid ? LOSS_TEXT : 'text-muted-foreground')}>{priceInvalid ? copy.priceError : copy.priceHint}</p>
                        </div>
                        <div className="min-w-0 max-lg:col-start-2 max-lg:row-start-1 lg:row-start-3">
                            <Label htmlFor={quantityId} className="text-[13px] font-medium text-muted-foreground">{copy.quantityLabel}</Label>
                            <Input
                                id={quantityId}
                                type="text"
                                inputMode="decimal"
                                autoComplete="off"
                                value={quantityText}
                                onChange={event => setQuantityText(event.target.value)}
                                disabled={!base}
                                aria-invalid={quantityInvalid || undefined}
                                aria-describedby={`${quantityId}-hint`}
                                className={cn(fieldClass, 'mt-1.5')}
                            />
                            <div className="mt-1.5">
                                <p id={`${quantityId}-hint`} className={cn('text-[13px] leading-5', quantityInvalid ? LOSS_TEXT : 'text-muted-foreground')}>{quantityInvalid ? copy.quantityError : copy.quantityHint}</p>
                                {usableQuantity != null && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => setQuantityText(String(usableQuantity))}
                                        className="-ml-2 h-auto min-h-9 justify-start whitespace-normal px-2 py-1 text-left text-[13px] font-semibold leading-snug underline decoration-hairline-strong underline-offset-4 max-md:min-h-[44px]"
                                    >
                                        {fillCopy(copy.useQuantity, { m: metres(usableQuantity) })}
                                    </Button>
                                )}
                            </div>
                        </div>
                        {base && range && (
                            <div className="mt-1 max-lg:col-span-2 max-lg:row-start-2 lg:row-start-2">
                                <RangeSlider
                                    min={range.min}
                                    max={range.max}
                                    step={range.step}
                                    value={snapOfferToSlider(price.status === 'ok' ? price.value : base.sellingPricePerM, range)}
                                    aria-label={copy.priceSlider}
                                    aria-valuetext={price.status === 'ok' ? rupees(price.value) : rupees(base.sellingPricePerM)}
                                    onValueChange={value => setPriceText(value.toFixed(2))}
                                />
                                <div className="mt-0.5 flex justify-between text-xs text-muted-foreground tabular-nums" aria-hidden="true">
                                    <span>{rupees(range.min)}</span>
                                    <span>{rupees(range.max)}</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="border-t border-hairline p-5 sm:p-6 lg:border-l lg:border-t-0" aria-live="polite" aria-busy={load === 'loading'}>
                    {load === 'loading' ? (
                        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{copy.loading}</p>
                    ) : load === 'failed' ? (
                        <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-[var(--wv-madder-600)]">
                            <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                            <p className="min-w-0 flex-1">{copy.loadFailed}</p>
                            {candidate && <Button type="button" variant="outline" onClick={() => void openCandidate(candidate)} className="min-h-10 max-md:min-h-[44px]">{copy.retry}</Button>}
                        </div>
                    ) : !candidate ? (
                        <p className="text-sm text-muted-foreground">{copy.qualityPlaceholder}</p>
                    ) : result && !result.ok ? (
                        <div className="max-w-md">
                            <p className="text-sm leading-relaxed text-body">{copy.notChecked}</p>
                            <Button asChild variant="outline" className="mt-4 min-h-10 max-md:min-h-[44px]"><Link href="/owner/quotes">{copy.notCheckedAction}</Link></Button>
                        </div>
                    ) : !candidate.checkable ? (
                        <div className="max-w-md">
                            <p className="text-sm leading-relaxed text-body">{copy.notChecked}</p>
                            <Button asChild variant="outline" className="mt-4 min-h-10 max-md:min-h-[44px]"><Link href="/owner/quotes">{copy.notCheckedAction}</Link></Button>
                        </div>
                    ) : base && evaluation ? (
                        <OfferCheckResult base={base} evaluation={evaluation} hasQuantity={quantity.status === 'ok'} copy={copy} />
                    ) : base ? (
                        <div>
                            <p className="text-sm text-muted-foreground">{copy.prompt}</p>
                            <dl className="mt-5 max-w-sm border-t border-hairline pt-3">
                                <Line label={copy.comparePrice} value={rupees(base.sellingPricePerM)} />
                                <Line label={copy.compareBreakEven} value={rupees(base.breakEvenPricePerM)} />
                            </dl>
                        </div>
                    ) : null}
                </div>
            </section>

            <p className="max-w-3xl text-[13px] leading-5 text-muted-foreground">{copy.basis}</p>
        </div>
    )
}
