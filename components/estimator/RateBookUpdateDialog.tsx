'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RateBookCostingReview } from '@/components/estimator/RateBookCostingReview'
import { getCostingsBehindRateBook, updateCostingsToRateBook } from '@/app/(dashboard)/owner/rates/propagation-actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { fillCopy } from '@/lib/i18n/fill'
import type { costingCatalogueText } from '@/lib/i18n/costing-catalogue'
import { chunkIds, PROPAGATION_BATCH_SIZE, summarizeOutcomes, tickedAfterReload, type PropagationOutcome } from '@/lib/yarn-rate-propagation-batch'
import type { PropagationSkipped, RateBookDriftItem } from '@/lib/yarn-rate-propagation'

type Copy = (typeof costingCatalogueText)[keyof typeof costingCatalogueText]
type Review = { ratesKey: string; items: RateBookDriftItem[]; skipped: PropagationSkipped[] }

const RATES_CHANGED = /rates changed since you opened the review/
const dialogButton = 'h-auto min-h-[48px] whitespace-normal rounded-xl px-5 text-[16px] font-semibold'

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

    return (
        <Dialog open={open} onOpenChange={next => { if (!saving) onOpenChange(next) }}>
            <DialogContent data-costing-field="rateBookReview" className="flex max-h-[90dvh] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px] sm:p-0">
                <DialogHeader className="shrink-0 gap-2 border-b border-hairline px-5 py-5 pr-14 sm:px-8 sm:py-6 sm:pr-16">
                    <DialogTitle className="text-[20px] sm:text-[24px]">{costingId ? copy.reviewTitleOne : copy.reviewTitle}</DialogTitle>
                    <DialogDescription className="text-[15px] leading-relaxed">{costingId ? copy.reviewNoteOne : copy.reviewNote}</DialogDescription>
                </DialogHeader>

                <div className="flex min-h-0 flex-col gap-5 overflow-y-auto overscroll-contain px-5 py-5 sm:px-8 sm:py-6">
                {loading && (
                    <p className="flex items-center gap-2 text-[16px] text-subtle" role="status">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        {copy.checking}
                    </p>
                )}

                {!loading && loadError && (
                    <div className="space-y-3" role="alert">
                        <p className="text-[14px] text-destructive">{tx(loadError)}</p>
                        <Button variant="outline" className={dialogButton} onClick={() => void load()}>{copy.retry}</Button>
                    </div>
                )}

                {!loading && !loadError && review && review.items.length === 0 && review.skipped.length === 0 && (
                    <p className="text-[16px] text-body">{costingId ? copy.noUpdatesForVersion : copy.current}</p>
                )}

                {!loading && !loadError && review && review.items.length > 0 && (
                    <ul className="flex flex-col gap-6 divide-y divide-hairline sm:gap-8">
                        {review.items.map(item => (
                            <li key={item.id} className="min-w-0 pt-6 first:pt-0 sm:pt-8">
                                <RateBookCostingReview
                                    item={item}
                                    copy={copy}
                                    warpLabel={warpLabel}
                                    weftLabel={weftLabel}
                                    savedMargin={savedMarginById.get(item.id) ?? null}
                                    selectable={!costingId}
                                    selected={ticked.has(item.id)}
                                    disabled={saving}
                                    onToggle={() => toggle(item.id)}
                                />
                            </li>
                        ))}
                    </ul>
                )}

                {!loading && review && review.skipped.length > 0 && (
                    <section className="space-y-2" aria-label={copy.skipped}>
                        <h3 className="text-[14px] font-semibold text-ink">{copy.skipped}</h3>
                        <ul className="space-y-2 text-[14px] leading-relaxed text-body">
                            {review.skipped.map(entry => (
                                <li key={entry.id}><span className="font-semibold text-ink">{entry.qualityLabel}</span>: {copy.cantPrice}</li>
                            ))}
                        </ul>
                    </section>
                )}

                {problems.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-warning/25 p-3" role="alert">
                        <ul className="space-y-2 text-[14px] leading-relaxed text-body">
                            {problems.map(problem => (
                                <li key={problem.id}>{review?.items.find(item => item.id === problem.id)?.qualityLabel ?? problem.id}: {problem.message ? tx(problem.message) : copy.couldNotSave}</li>
                            ))}
                        </ul>
                        <Button variant="outline" className={dialogButton} onClick={() => void load()}>{copy.retry}</Button>
                    </div>
                )}

                {saveError && problems.length === 0 && (
                    <div className="space-y-3" role="alert">
                        <p className="text-[14px] text-destructive">{tx(saveError)}</p>
                        <Button variant="outline" className={dialogButton} onClick={() => void load()}>{copy.retry}</Button>
                    </div>
                )}

                </div>
                <DialogFooter className="shrink-0 gap-2 border-t border-hairline px-5 py-4 sm:gap-3 sm:px-8 sm:py-5">
                    <Button variant="outline" className={dialogButton} disabled={saving} onClick={() => onOpenChange(false)}>
                        {copy.cancel}
                    </Button>
                    {review && review.items.length > 0 && (
                        <Button className={dialogButton} disabled={loading || saving || tickedItems.length === 0} onClick={() => void save()}>
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
