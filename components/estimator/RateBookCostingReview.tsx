import { ArrowRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { marginTone } from '@/components/estimator/SavedCostingMargin'
import { marginAtSavedPrice } from '@/lib/costing-catalogue'
import type { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { fillCopy } from '@/lib/i18n/fill'
import type { RateBookDriftItem } from '@/lib/yarn-rate-propagation'
import { cn } from '@/lib/utils'

type Copy = (typeof costingCatalogueText)[keyof typeof costingCatalogueText]

const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const yarnMoney = (value: number) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
const pct = (value: number) => `${value.toFixed(1)}%`

/** The yarn changes and their combined cost impact, from the same reviewed snapshot. */
export function RateBookCostingReview({ item, copy, warpLabel, weftLabel, savedMargin, selectable, selected, disabled, onToggle }: {
    item: RateBookDriftItem
    copy: Copy
    warpLabel: string
    weftLabel: string
    savedMargin: number | null
    selectable: boolean
    selected: boolean
    disabled: boolean
    onToggle: () => void
}) {
    const marginToday = marginAtSavedPrice(savedMargin, item.before.sellingPricePerM, item.before.productionCostPerM, item.after.productionCostPerM)
    const difference = Math.round((item.after.productionCostPerM - item.before.productionCostPerM) * 100) / 100
    const title = (
        <span className="flex min-w-0 flex-col gap-1">
            <span className="break-words text-[18px] font-semibold leading-snug text-ink sm:text-[20px]">{item.qualityLabel}</span>
            {item.partyName && <span className="break-words text-[14px] text-body">{item.partyName}</span>}
        </span>
    )

    return (
        <article data-costing-field="rateReviewItem" data-costing-review-id={item.id} className={cn('grid min-w-0 grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-2 lg:gap-x-8', !selected && 'opacity-60')}>
            <header className="flex items-start justify-between gap-4 lg:col-span-2">
                {selectable ? (
                    <label className="flex min-h-[44px] min-w-0 cursor-pointer items-start gap-3">
                        <input
                            type="checkbox"
                            className="mt-0.5 size-5 shrink-0 accent-ink"
                            checked={selected}
                            disabled={disabled}
                            onChange={onToggle}
                        />
                        {title}
                    </label>
                ) : <h3 className="min-w-0">{title}</h3>}
                <Badge variant="secondary" aria-label={`v${item.versionNumber} → v${item.versionNumber + 1}`} className="gap-2 rounded-lg border-transparent px-3 py-2 text-[14px] font-medium tabular-nums">
                    <span>v{item.versionNumber}</span><ArrowRight aria-hidden="true" /><span className="font-semibold text-ink">v{item.versionNumber + 1}</span>
                </Badge>
            </header>

            <section aria-label={copy.yarnRates} className="min-w-0 lg:row-span-2">
                <div className="mb-3 flex items-center justify-between gap-4 text-[14px] text-body">
                    <h4 className="font-semibold">{copy.yarnRates} <span className="ml-1 font-normal">· ₹/kg</span></h4>
                    <div aria-hidden="true" className="hidden w-60 grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] gap-3 text-right sm:grid">
                        <span>{copy.savedRate}</span><span /><span>{copy.latestRate}</span>
                    </div>
                </div>
                <dl className="divide-y divide-hairline border-y border-hairline">
                    {item.changes.map(change => (
                        <div key={`${change.layer}-${change.index}`} data-costing-field="yarnRateChange" className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5 py-4 sm:gap-x-6">
                            <dt className="min-w-0 flex-1 basis-36">
                                <span className="block break-words text-[16px] font-semibold leading-snug text-ink">{change.name}</span>
                                <span className="mt-1 block text-[14px] text-body">{change.layer === 'warp' ? warpLabel : weftLabel} {change.index + 1}</span>
                            </dt>
                            <dd className="grid shrink-0 grid-cols-[auto_1rem_auto] items-center gap-2 tabular-nums sm:w-60 sm:grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)] sm:gap-3">
                                <span className="text-right text-[18px] text-body">
                                    <span className="sr-only">{copy.savedRate} </span>
                                    {yarnMoney(change.from)}
                                </span>
                                <ArrowRight className="size-4 text-subtle sm:size-5" aria-hidden="true" />
                                <span className="text-right text-[18px] font-semibold text-ink">
                                    <span className="sr-only">{copy.latestRate} </span>
                                    {yarnMoney(change.to)}
                                </span>
                            </dd>
                        </div>
                    ))}
                </dl>
            </section>

            <section data-costing-field="productionCostChange" aria-label={copy.productionCost} className="rounded-2xl bg-[var(--wv-neel-50)] p-4 sm:p-6">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <h4 className="text-[16px] font-semibold text-ink">{copy.productionCost} <span className="font-normal">/m</span></h4>
                    <span className={cn('text-[14px] font-semibold tabular-nums', difference > 0 ? 'text-[var(--wv-ochre-800)]' : difference < 0 ? 'text-[var(--wv-moss-700)]' : 'text-body')}>
                        {difference === 0 ? copy.noCostChange : `${difference > 0 ? '+' : '−'}${money(Math.abs(difference))}/m`}
                    </span>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-6">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[14px] text-body">{copy.savedRate}</span>
                        <span className="flex min-h-12 items-end break-words text-[28px] font-medium leading-tight tracking-tight tabular-nums text-body sm:text-[32px]">{money(item.before.productionCostPerM)}</span>
                    </div>
                    <ArrowRight className="mb-2 size-5 self-end text-subtle sm:size-6" aria-hidden="true" />
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <span className="text-[14px] text-body">{copy.updatedCost}</span>
                        <strong className="flex min-h-12 items-end break-words text-[32px] font-semibold leading-tight tracking-tight tabular-nums text-ink sm:text-[40px]">{money(item.after.productionCostPerM)}</strong>
                    </div>
                </div>
            </section>

            {savedMargin != null && marginToday != null && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:gap-x-8">
                    <div className="row-span-2 grid grid-rows-subgrid gap-1.5">
                        <dt className="text-[14px] leading-snug text-body">{fillCopy(copy.marginAtPrice, { price: `${money(item.before.sellingPricePerM)}/m` })}</dt>
                        <dd className="flex items-center gap-3 text-[18px] tabular-nums">
                            <span className="text-body">{pct(savedMargin)}</span><ArrowRight className="size-4 text-subtle" aria-hidden="true" /><strong className={cn('font-semibold', marginTone(marginToday))}>{pct(marginToday)}</strong>
                        </dd>
                    </div>
                    <div className="row-span-2 grid grid-rows-subgrid gap-1.5">
                        <dt className="text-[14px] leading-snug text-body">{fillCopy(copy.priceForMargin, { pct: pct(savedMargin) })}</dt>
                        <dd className="text-[18px] font-semibold tabular-nums text-ink">{money(item.after.sellingPricePerM)}<span className="ml-0.5 text-[14px] font-normal">/m</span></dd>
                    </div>
                </dl>
            )}
        </article>
    )
}
