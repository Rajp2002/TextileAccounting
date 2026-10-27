'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, Calculator, FileText, Info, Loader2, RotateCcw, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, PageHeader } from '@/components/ui/page-header'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { LOSS_TEXT, OfferCheckResult, OfferPriceTrack, metres, rupees } from '@/components/estimator/OfferCheckResult'
import { useTranslation } from '@/lib/i18n/context'
import { fillCopy } from '@/lib/i18n/fill'
import { offerCheckText, type OfferCheckText } from '@/lib/i18n/offer-check'
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

const FIELD_LABEL = 'text-[13px] font-medium text-muted-foreground'
/** The three inputs share one height, 44px everywhere (the root font is 14px, so rem sizes would fall short). */
const FIELD_HEIGHT = 'h-[44px] min-h-[44px] max-md:min-h-[44px]'

function candidateMeta(copy: OfferCheckText, item: OfferCandidate) {
    return item.checkable && item.sellingPricePerM != null
        ? fillCopy(copy.optionLabel, { n: item.versionNumber, price: item.sellingPricePerM.toFixed(2) })
        : fillCopy(copy.optionRecalc, { n: item.versionNumber })
}

/** A quiet panel for the answers the check cannot give: an icon, what happened, and the way on. */
function OfferNotice({ icon: Icon, tone, title, body, action, role }: {
    icon: LucideIcon
    tone: 'risk' | 'thin'
    title: string
    body?: string
    action?: ReactNode
    role?: 'alert'
}) {
    return (
        <div role={role} className="flex max-w-xl items-start gap-4">
            <span
                aria-hidden="true"
                className={cn(
                    'flex size-10 shrink-0 items-center justify-center rounded-full',
                    tone === 'risk' ? 'bg-[var(--wv-madder-50)] text-[var(--wv-madder-600)]' : 'bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-800)]',
                )}
            >
                <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 pt-1.5">
                <p className="text-base font-semibold leading-snug text-ink">{title}</p>
                {body && <p className="mt-1.5 text-sm leading-relaxed text-body">{body}</p>}
                {action && <div className="mt-4">{action}</div>}
            </div>
        </div>
    )
}

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

    const backAction = (
        <Button asChild variant="outline" className="min-h-10 rounded-lg border-hairline bg-surface font-semibold text-ink shadow-xs max-md:min-h-[44px]">
            <Link href="/owner/quotes"><ArrowLeft className="size-4" aria-hidden="true" />{copy.back}</Link>
        </Button>
    )

    if (loadError) {
        return (
            <div className="ui-route-enter w-full space-y-4 sm:space-y-6" data-offer-check data-i18n-skip="true" lang={language}>
                <PageHeader title={copy.title} description={copy.intro} actions={backAction} />
                <div className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:p-8">
                    <OfferNotice
                        role="alert"
                        icon={TriangleAlert}
                        tone="risk"
                        title={copy.listFailed}
                        action={<Button type="button" variant="outline" onClick={() => router.refresh()} className="min-h-10 max-md:min-h-[44px]">{copy.retry}</Button>}
                    />
                </div>
            </div>
        )
    }

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
    const usableQuantity = base?.quantityM != null && base.quantityM > 0 ? base.quantityM : null
    const quantityIsUsable = usableQuantity != null && quantity.status === 'ok' && quantity.value === usableQuantity
    const fieldClass = cn(FIELD_HEIGHT, 'rounded-lg border-hairline bg-surface tabular-nums shadow-xs')

    const track = base && range ? (
        <OfferPriceTrack
            base={base}
            range={range}
            value={snapOfferToSlider(price.status === 'ok' ? price.value : base.sellingPricePerM, range)}
            valueText={price.status === 'ok' ? rupees(price.value) : rupees(base.sellingPricePerM)}
            onValueChange={value => setPriceText(value.toFixed(2))}
            copy={copy}
        />
    ) : null

    const meta = base
        ? fillCopy(copy.basedOn, { n: base.versionNumber, date: formatTimestampDate(base.savedAt, { day: 'numeric', month: 'short' }), cost: base.productionCostPerM.toFixed(2) })
        : candidate ? candidateMeta(copy, candidate) : null

    return (
        <div className="ui-route-enter w-full space-y-4 sm:space-y-6" data-offer-check data-i18n-skip="true" lang={language}>
            <RouteMilestones route="/owner/quotes" shellVisible primaryUsable secondaryReady />
            <PageHeader title={copy.title} description={copy.intro} actions={backAction} />

            {/* One white sheet, as on Saved Costings: the three inputs across the top, the answer below them. */}
            <section aria-label={copy.title} className="@container overflow-hidden rounded-2xl border border-hairline bg-surface shadow-xs">
                <div className="grid grid-cols-2 gap-x-3 gap-y-5 border-b border-hairline p-5 sm:gap-x-4 sm:p-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)_minmax(0,0.9fr)] lg:px-8">
                    <div className="col-span-2 min-w-0 lg:col-span-1">
                        <Label htmlFor={qualityId} className={FIELD_LABEL}>{copy.qualityLabel}</Label>
                        <Select
                            value={key ?? ''}
                            onValueChange={value => {
                                const next = candidates.find(item => item.key === value)
                                if (next) void openCandidate(next)
                            }}
                        >
                            <SelectTrigger
                                id={qualityId}
                                className={cn(FIELD_HEIGHT, 'mt-2 w-full min-w-0 rounded-lg border-hairline bg-surface px-3.5 text-base font-semibold text-ink shadow-xs data-[placeholder]:font-normal')}
                            >
                                <SelectValue placeholder={copy.qualityPlaceholder}>
                                    {candidate ? <span className="truncate">{candidate.name || copy.untitled}</span> : null}
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent position="popper" sideOffset={6} className="max-h-[min(22rem,var(--radix-select-content-available-height))] rounded-xl">
                                {candidates.map(item => {
                                    const name = item.name || copy.untitled
                                    return (
                                        <SelectItem key={item.key} value={item.key} textValue={name} className="rounded-lg py-2.5 pl-3 pr-9">
                                            <span className="flex min-w-0 flex-col items-start gap-0.5">
                                                <span className="max-w-full truncate text-sm font-semibold text-ink">{name}</span>
                                                <span className={cn('text-[13px] tabular-nums', item.checkable ? 'text-muted-foreground' : 'text-[var(--wv-ochre-800)]')}>{candidateMeta(copy, item)}</span>
                                            </span>
                                        </SelectItem>
                                    )
                                })}
                            </SelectContent>
                        </Select>
                        {meta && (
                            <p className={cn('mt-2 text-[13px] leading-5 tabular-nums', candidate && !candidate.checkable ? 'text-[var(--wv-ochre-800)]' : 'text-muted-foreground')}>{meta}</p>
                        )}
                    </div>

                    <div className="min-w-0">
                        <Label htmlFor={priceId} className={FIELD_LABEL}>{copy.priceLabel}</Label>
                        <div className="relative mt-2">
                            <span aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-base text-muted-foreground">₹</span>
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
                                className={cn(fieldClass, 'pl-8 pr-11 text-lg font-semibold placeholder:font-normal')}
                            />
                            <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{copy.perMetre}</span>
                        </div>
                        <p id={`${priceId}-hint`} className={priceInvalid ? cn('mt-2 text-[13px] leading-5', LOSS_TEXT) : 'sr-only'}>{priceInvalid ? copy.priceError : copy.priceHint}</p>
                    </div>

                    <div className="min-w-0">
                        <Label htmlFor={quantityId} className={cn(FIELD_LABEL, 'flex flex-wrap items-baseline gap-x-1.5')}>
                            {copy.quantityLabel} <span className="font-normal text-muted-foreground/80">· {copy.optional}</span>
                        </Label>
                        <div className="relative mt-2">
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
                                className={cn(fieldClass, 'pr-10 text-base font-medium')}
                            />
                            <span aria-hidden="true" className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{copy.metreUnit}</span>
                        </div>
                        <p id={`${quantityId}-hint`} className={quantityInvalid ? cn('mt-2 text-[13px] leading-5', LOSS_TEXT) : 'sr-only'}>{quantityInvalid ? copy.quantityError : copy.quantityHint}</p>
                        {usableQuantity != null && !quantityIsUsable && !quantityInvalid && (
                            <button
                                type="button"
                                onClick={() => setQuantityText(String(usableQuantity))}
                                className="-mx-1 mt-1 inline-flex min-h-9 items-center rounded-md px-1 text-left text-[13px] font-semibold leading-snug text-ink underline decoration-hairline-strong underline-offset-4 transition-colors hover:decoration-ink focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 max-md:min-h-[44px]"
                            >
                                {fillCopy(copy.useQuantity, { m: metres(usableQuantity) })}
                            </button>
                        )}
                    </div>
                </div>

                <div aria-busy={load === 'loading'}>
                    {load === 'loading' ? (
                        <div role="status" className="space-y-6 p-5 sm:p-6 lg:p-8">
                            <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden="true" />{copy.loading}</p>
                            <div aria-hidden="true" className="space-y-3">
                                <div className="ui-skeleton h-11 w-48 rounded-lg bg-surface-soft" />
                                <div className="ui-skeleton h-4 w-72 max-w-full rounded bg-surface-soft" />
                            </div>
                            <div aria-hidden="true" className="ui-skeleton h-1 w-full rounded-full bg-surface-soft" />
                        </div>
                    ) : load === 'failed' ? (
                        <div className="p-5 sm:p-6 lg:p-8">
                            <OfferNotice
                                role="alert"
                                icon={TriangleAlert}
                                tone="risk"
                                title={copy.loadFailed}
                                action={candidate && <Button type="button" variant="outline" onClick={() => void openCandidate(candidate)} className="min-h-10 max-md:min-h-[44px]">{copy.retry}</Button>}
                            />
                        </div>
                    ) : !candidate ? (
                        <p className="p-5 text-sm text-muted-foreground sm:p-6 lg:px-8">{copy.start}</p>
                    ) : (result && !result.ok) || !candidate.checkable ? (
                        <div className="p-5 sm:p-6 lg:p-8">
                            <OfferNotice
                                icon={RotateCcw}
                                tone="thin"
                                title={copy.notCheckedTitle}
                                body={copy.notChecked}
                                action={<Button asChild variant="outline" className="min-h-10 max-md:min-h-[44px]"><Link href="/owner/quotes">{copy.notCheckedAction}</Link></Button>}
                            />
                        </div>
                    ) : base ? (
                        <OfferCheckResult base={base} evaluation={evaluation} hasQuantity={quantity.status === 'ok'} copy={copy} track={track} />
                    ) : null}
                </div>

                <p className="flex items-start gap-2.5 border-t border-hairline px-5 py-3.5 text-[13px] leading-5 text-muted-foreground sm:px-6 lg:px-8">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    <span>{copy.basis}</span>
                </p>
            </section>
        </div>
    )
}
