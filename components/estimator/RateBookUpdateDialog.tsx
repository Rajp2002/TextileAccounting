'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getCostingsBehindRateBook, updateCostingsToRateBook } from '@/app/(dashboard)/owner/rates/propagation-actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { marginAtSavedPrice } from '@/lib/costing-catalogue'
import { useTranslation } from '@/lib/i18n/context'
import { fillCopy } from '@/lib/i18n/fill'
import type { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { chunkIds, PROPAGATION_BATCH_SIZE, summarizeOutcomes, tickedAfterReload, type PropagationOutcome } from '@/lib/yarn-rate-propagation-batch'
import type { PropagationSkipped, RateBookDriftItem } from '@/lib/yarn-rate-propagation'
import { marginTone } from '@/components/estimator/SavedCostingMargin'
import { cn } from '@/lib/utils'

type Copy = (typeof costingCatalogueText)[keyof typeof costingCatalogueText]
type Review = { ratesKey: string; items: RateBookDriftItem[]; skipped: PropagationSkipped[] }

const RATES_CHANGED = /rates changed since you opened the review/
const dialogButton = 'min-h-[44px] whitespace-normal rounded-lg font-semibold'

const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const pct = (value: number) => `${value.toFixed(1)}%`

/**
 * Review before saving: every saved costing whose yarns cost something else in
 * the Rate Book today, with its cost and margin as saved and today. Confirming
 * saves a new version of each ticked costing at today's yarn rates, ten at a
 * time. Earlier versions are never edited.
 */
export function RateBookUpdateDialog({ open, costingId = null, copy, warpLabel, weftLabel, savedMarginById, onOpenChange, onSaved }: {
    open: boolean
    /** A card reviews only this costing; null reviews the whole library. */
    costingId?: string | null
    copy: Copy
    warpLabel: string
    weftLabel: string
    /** The margin each costing was saved with, by costing id. */
    savedMarginById: ReadonlyMap<string, number | null>
    onOpenChange: (open: boolean) => void
    /** Some costings got a new version; the page reloads its library. */
    onSaved: () => void
}) {
    // Server messages are English; the phrase map translates them.
    const { tx } = useTranslation()
    const [review, setReview] = useState<Review | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [ticked, setTicked] = useState<Set<string>>(new Set())
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [problems, setProblems] = useState<PropagationOutcome[]>([])
    const [saveError, setSaveError] = useState<string | null>(null)
    // Costings the owner unticked; a reload (Retry) keeps them out.
    const untickedRef = useRef<Set<string>>(new Set())
    const loadSequence = useRef(0)

    const load = useCallback(async () => {
        const sequence = ++loadSequence.current
        setLoading(true)
        setLoadError(null)
        setSaveError(null)
        setProblems([])
        try {
            const result = await getCostingsBehindRateBook()
            if (sequence !== loadSequence.current) return
            if (result.error || !result.data) {
                setLoadError(result.error ?? copy.loadFailed)
                setReview(null)
                return
            }
            const scoped = costingId ? {
                ...result.data,
                items: result.data.items.filter(item => item.id === costingId),
                skipped: result.data.skipped.filter(item => item.id === costingId),
            } : result.data
            setReview(scoped)
            setTicked(tickedAfterReload(scoped.items.map(item => item.id), untickedRef.current))
        } catch (error) {
            if (sequence !== loadSequence.current) return
            setLoadError(userFacingError(error, copy.loadFailed))
            setReview(null)
        } finally {
            if (sequence === loadSequence.current) setLoading(false)
        }
    }, [copy.loadFailed, costingId])

    useEffect(() => {
        if (!open) {
            setReview(null)
            setProgress(null)
            return
        }
        untickedRef.current = new Set()
        void load()
        return () => { loadSequence.current += 1 }
    }, [open, load])

    const tickedItems = useMemo(() => review?.items.filter(item => ticked.has(item.id)) ?? [], [review, ticked])
    const saving = progress !== null

    const toggle = (id: string) => setTicked(current => {
        const next = new Set(current)
        if (next.has(id)) {
            next.delete(id)
            untickedRef.current.add(id)
        } else {
            next.add(id)
            untickedRef.current.delete(id)
        }
        return next
    })

    const save = async () => {
        if (!review || tickedItems.length === 0 || saving) return
        const updatedAtById = new Map(review.items.map(item => [item.id, item.updatedAt]))
        const outcomes: PropagationOutcome[] = []
        let endedWith: string | null = null
        setSaveError(null)
        setProgress({ done: 0, total: tickedItems.length })
        try {
            for (const batch of chunkIds(tickedItems.map(item => item.id), PROPAGATION_BATCH_SIZE)) {
                const result = await updateCostingsToRateBook({
                    ratesKey: review.ratesKey,
                    costings: batch.map(id => ({ id, expectedUpdatedAt: updatedAtById.get(id) ?? '' })),
                })
                // A batch that ended early still reports what it saved first.
                outcomes.push(...(result.data?.outcomes ?? []))
                if (result.error) { endedWith = result.error; break }
                setProgress({ done: outcomes.length, total: tickedItems.length })
            }
        } catch (error) {
            endedWith = userFacingError(error, copy.couldNotSave)
        }
        setProgress(null)

        const summary = summarizeOutcomes(outcomes)
        if (summary.created + summary.unchanged > 0) {
            onSaved()
            // Saved costings leave the list, so a second press never offers them again.
            const resolvedIds = new Set(outcomes.filter(outcome => outcome.status === 'created' || outcome.status === 'unchanged').map(outcome => outcome.id))
            setReview(current => current && { ...current, items: current.items.filter(item => !resolvedIds.has(item.id)) })
            setTicked(current => new Set([...current].filter(id => !resolvedIds.has(id))))
        }
        if (summary.created > 0) {
            toast.success(fillCopy(summary.created === 1 ? copy.versionsCreatedOne : copy.versionsCreated, { n: summary.created }))
        }
        if (endedWith && RATES_CHANGED.test(endedWith)) {
            toast.error(copy.ratesChanged)
            void load()
            return
        }
        const unresolved = outcomes.filter(outcome => outcome.status === 'stale' || outcome.status === 'failed')
        if (endedWith) {
            setSaveError(endedWith)
            setProblems(unresolved)
            return
        }
        if (unresolved.length === 0) {
            onOpenChange(false)
            return
        }
        setProblems(unresolved)
    }

    const labelFor = (item: RateBookDriftItem) => item.partyName ? `${item.qualityLabel} · ${item.partyName}` : item.qualityLabel

    return (
        <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next) }}>
            <DialogContent data-costing-field="rateBookReview" className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader className="pr-9">
                    <DialogTitle>{costingId ? copy.reviewTitleOne : copy.reviewTitle}</DialogTitle>
                    <DialogDescription>{copy.reviewNote}</DialogDescription>
                </DialogHeader>

                {loading && (
                    <p className="flex items-center gap-2 text-sm text-subtle" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {copy.checking}
                    </p>
                )}

                {!loading && loadError && (
                    <div className="space-y-3" role="alert">
                        <p className="text-sm text-destructive">{tx(loadError)}</p>
                        <Button variant="outline" className={dialogButton} onClick={() => void load()}>{copy.retry}</Button>
                    </div>
                )}

                {!loading && !loadError && review && review.items.length === 0 && review.skipped.length === 0 && (
                    <p className="text-sm text-body">{costingId ? copy.noUpdatesForVersion : copy.current}</p>
                )}

                {!loading && !loadError && review && review.items.length > 0 && (
                    <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                        {review.items.map(item => {
                            const savedMargin = savedMarginById.get(item.id) ?? null
                            const marginToday = marginAtSavedPrice(savedMargin, item.before.sellingPricePerM, item.before.productionCostPerM, item.after.productionCostPerM)
                            return (
                                <li key={item.id}>
                                    <label className="flex min-h-[44px] cursor-pointer items-start gap-3 p-3 sm:px-4">
                                        <input
                                            type="checkbox"
                                            className="mt-1 h-5 w-5 shrink-0 accent-ink"
                                            checked={ticked.has(item.id)}
                                            disabled={saving}
                                            onChange={() => toggle(item.id)}
                                        />
                                        <span className="min-w-0 flex-1 space-y-1.5">
                                            <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                <span className="break-words text-sm font-semibold text-ink">{labelFor(item)}</span>
                                                <span className="text-xs font-semibold text-subtle tabular-nums">{`v${item.versionNumber} → v${item.versionNumber + 1}`}</span>
                                            </span>
                                            <span className="block text-xs text-muted-foreground tabular-nums">
                                                {item.changes.map(change => `${change.layer === 'warp' ? warpLabel : weftLabel} ${change.index + 1} ${change.name}: ${money(change.from)} → ${money(change.to)}`).join(' · ')}
                                            </span>
                                            <span className="grid gap-x-4 gap-y-0.5 text-xs text-body tabular-nums sm:grid-cols-2">
                                                <span>{copy.cost}: {money(item.before.productionCostPerM)} → <strong className="font-semibold text-ink">{money(item.after.productionCostPerM)}</strong>/m</span>
                                                {savedMargin != null && marginToday != null && (
                                                    <span>
                                                        {fillCopy(copy.marginAtPrice, { price: `${money(item.before.sellingPricePerM)}/m` })}: {pct(savedMargin)} → <strong className={cn('font-semibold', marginTone(marginToday))}>{pct(marginToday)}</strong>
                                                    </span>
                                                )}
                                            </span>
                                            {savedMargin != null && (
                                                <span className="block text-xs text-body tabular-nums">
                                                    {fillCopy(copy.keepMargin, { pct: pct(savedMargin), price: `${money(item.after.sellingPricePerM)}/m` })}
                                                </span>
                                            )}
                                        </span>
                                    </label>
                                </li>
                            )
                        })}
                    </ul>
                )}

                {!loading && review && review.skipped.length > 0 && (
                    <section className="space-y-2" aria-label={copy.skipped}>
                        <h3 className="text-sm font-semibold text-ink">{copy.skipped}</h3>
                        <ul className="space-y-1 text-xs text-body">
                            {review.skipped.map(entry => (
                                <li key={entry.id}><span className="font-semibold text-ink">{entry.qualityLabel}</span>: {copy.cantPrice}</li>
                            ))}
                        </ul>
                    </section>
                )}

                {problems.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-warning/25 p-3" role="alert">
                        <ul className="space-y-1 text-xs text-body">
                            {problems.map(problem => (
                                <li key={problem.id}>{review?.items.find(item => item.id === problem.id)?.qualityLabel ?? problem.id}: {problem.message ? tx(problem.message) : copy.couldNotSave}</li>
                            ))}
                        </ul>
                        <Button variant="outline" className={dialogButton} onClick={() => void load()}>{copy.retry}</Button>
                    </div>
                )}

                {saveError && problems.length === 0 && (
                    <div className="space-y-3" role="alert">
                        <p className="text-sm text-destructive">{tx(saveError)}</p>
                        <Button variant="outline" className={dialogButton} onClick={() => void load()}>{copy.retry}</Button>
                    </div>
                )}

                <DialogFooter className="gap-2 sm:gap-2">
                    <Button variant="outline" className={dialogButton} disabled={saving} onClick={() => onOpenChange(false)}>
                        {copy.cancel}
                    </Button>
                    {review && review.items.length > 0 && (
                        <Button className={dialogButton} disabled={saving || tickedItems.length === 0} onClick={() => void save()}>
                            {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                            {saving && progress
                                ? fillCopy(copy.savingProgress, { done: progress.done, total: progress.total })
                                : fillCopy(tickedItems.length === 1 ? copy.createVersionsOne : copy.createVersions, { n: tickedItems.length })}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
