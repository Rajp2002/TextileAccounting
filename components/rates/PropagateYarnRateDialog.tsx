'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { applyYarnRatePropagation, previewYarnRatePropagation } from '@/app/(dashboard)/owner/rates/propagation-actions'
import { toast, userFacingError } from '@/lib/app-notifications'
import { formatRateValue, type CostRateRow } from '@/lib/cost-rates'
import { useTranslation } from '@/lib/i18n/context'
import { chunkIds, PROPAGATION_BATCH_SIZE, summarizeOutcomes, tickedAfterReload, type PropagationOutcome } from '@/lib/yarn-rate-propagation-batch'
import type { PropagationLayerRef, PropagationPreviewItem, PropagationSkipped } from '@/lib/yarn-rate-propagation'
import { cn } from '@/lib/utils'

type Review = {
    rateUpdatedAt: string
    rateName: string
    rateValue: number
    items: PropagationPreviewItem[]
    skipped: PropagationSkipped[]
}

const RATE_CHANGED = /changed since you opened the review/
const dialogButton = 'min-h-[44px] whitespace-normal rounded-lg font-semibold'

const money = (value: number) => `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/m`

/**
 * Review before saving: every saved costing that uses this yarn at a different
 * rate, with its cost before and after. Confirming saves a new version of each
 * ticked costing, ten at a time. Earlier versions are never edited.
 */
export function PropagateYarnRateDialog({ rate, onOpenChange, onApplied }: {
    /** The yarn to propagate; null keeps the dialog closed. */
    rate: CostRateRow | null
    onOpenChange: (open: boolean) => void
    /** How many costings of this yarn are now up to date (created or already at the rate). */
    onApplied: (rateId: string, resolvedCount: number) => void
}) {
    const { tx } = useTranslation()
    const rateId = rate?.id ?? null
    const [review, setReview] = useState<Review | null>(null)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [ticked, setTicked] = useState<Set<string>>(new Set())
    const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
    const [problems, setProblems] = useState<PropagationOutcome[]>([])
    const [saveError, setSaveError] = useState<string | null>(null)
    // Costings the owner unticked; a reload (Retry) keeps them out.
    const untickedRef = useRef<Set<string>>(new Set())

    const load = useCallback(async (id: string) => {
        setLoading(true)
        setLoadError(null)
        setSaveError(null)
        setProblems([])
        try {
            const result = await previewYarnRatePropagation(id)
            if (result.error || !result.data) {
                setLoadError(result.error ?? 'The review could not be loaded.')
                setReview(null)
                return
            }
            setReview(result.data)
            setTicked(tickedAfterReload(result.data.items.map(item => item.id), untickedRef.current))
        } catch (error) {
            setLoadError(userFacingError(error, 'The review could not be loaded. Try again.'))
            setReview(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!rateId) {
            setReview(null)
            setProgress(null)
            return
        }
        untickedRef.current = new Set()
        void load(rateId)
    }, [rateId, load])

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
        if (!rate || !review || tickedItems.length === 0 || saving) return
        const updatedAtById = new Map(review.items.map(item => [item.id, item.updatedAt]))
        const outcomes: PropagationOutcome[] = []
        let endedWith: string | null = null
        setSaveError(null)
        setProgress({ done: 0, total: tickedItems.length })
        try {
            for (const batch of chunkIds(tickedItems.map(item => item.id), PROPAGATION_BATCH_SIZE)) {
                const result = await applyYarnRatePropagation({
                    rateId: rate.id,
                    expectedRateUpdatedAt: review.rateUpdatedAt,
                    costings: batch.map(id => ({ id, expectedUpdatedAt: updatedAtById.get(id) ?? '' })),
                })
                // A batch that ended early still reports what it saved first.
                outcomes.push(...(result.data?.outcomes ?? []))
                if (result.error) { endedWith = result.error; break }
                setProgress({ done: outcomes.length, total: tickedItems.length })
            }
        } catch (error) {
            endedWith = userFacingError(error, 'The new versions could not be saved. Try again.')
        }
        setProgress(null)

        const summary = summarizeOutcomes(outcomes)
        const resolved = summary.created + summary.unchanged
        if (resolved > 0) {
            onApplied(rate.id, resolved)
            // Saved costings leave the list, so a second press never offers them again.
            const resolvedIds = new Set(outcomes.filter(outcome => outcome.status === 'created' || outcome.status === 'unchanged').map(outcome => outcome.id))
            setReview(current => current && { ...current, items: current.items.filter(item => !resolvedIds.has(item.id)) })
            setTicked(current => new Set([...current].filter(id => !resolvedIds.has(id))))
        }
        if (endedWith && RATE_CHANGED.test(endedWith)) {
            toast.error(tx(endedWith))
            onOpenChange(false)
            return
        }
        const unresolved = outcomes.filter(outcome => outcome.status === 'stale' || outcome.status === 'failed')
        const skipped = unresolved.length + review.skipped.length
        if (summary.created > 0) {
            const created = summary.created
            toast.success(
                tx(skipped > 0
                    ? `${created} created, ${skipped} skipped`
                    : `${created} new ${created === 1 ? 'version' : 'versions'} created`),
                { action: { label: tx('View costings'), onClick: () => window.location.assign('/owner/quotes') } },
            )
        }
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

    const labelFor = (item: PropagationPreviewItem) => item.partyName ? `${item.qualityLabel} · ${item.partyName}` : item.qualityLabel
    const layerText = (layers: PropagationLayerRef[]) =>
        layers.map(layer => `${tx(layer.layer === 'warp' ? 'Warp' : 'Weft')} ${layer.index + 1}`).join(', ')

    return (
        <Dialog open={Boolean(rate)} onOpenChange={next => { if (!saving) onOpenChange(next) }}>
            <DialogContent data-ratebook-field="propagateDialog" className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
                {rate && (
                    <>
                        <DialogHeader className="pr-9">
                            <DialogTitle>
                                {tx(`Propagate ${review?.rateName ?? rate.name} at ${formatRateValue(review?.rateValue ?? Number(rate.current_value), rate.unit)}`)}
                            </DialogTitle>
                            <DialogDescription>
                                {tx('Review before saving')}. {tx('Each costing gets a new version at this rate. Earlier versions keep their own numbers.')}
                            </DialogDescription>
                        </DialogHeader>

                        {loading && (
                            <p className="flex items-center gap-2 text-sm text-subtle" role="status">
                                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                {tx('Checking your saved costings…')}
                            </p>
                        )}

                        {!loading && loadError && (
                            <div className="space-y-3" role="alert">
                                <p className="text-sm text-destructive">{tx(loadError)}</p>
                                <Button variant="outline" className={dialogButton} onClick={() => void load(rate.id)}>{tx('Retry')}</Button>
                            </div>
                        )}

                        {!loading && !loadError && review && review.items.length === 0 && review.skipped.length === 0 && (
                            <p className="text-sm text-body">{tx('Nothing to propagate: every costing already uses this rate')}</p>
                        )}

                        {!loading && !loadError && review && review.items.length > 0 && (
                            <ul className="divide-y divide-hairline rounded-xl border border-hairline">
                                {review.items.map(item => (
                                    <li key={item.id}>
                                        <label className="flex min-h-[44px] cursor-pointer items-start gap-3 p-3 sm:px-4">
                                            <input
                                                type="checkbox"
                                                className="mt-1 h-5 w-5 shrink-0 accent-ink"
                                                checked={ticked.has(item.id)}
                                                disabled={saving}
                                                onChange={() => toggle(item.id)}
                                            />
                                            <span className="min-w-0 flex-1 space-y-1">
                                                <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                                    <span className="break-words text-sm font-semibold text-ink">{labelFor(item)}</span>
                                                    <span className="text-xs font-semibold text-subtle">
                                                        {`v${item.versionNumber} → v${item.versionNumber + 1}`} · {layerText(item.layers)}
                                                    </span>
                                                </span>
                                                <span className="grid gap-x-4 gap-y-0.5 text-xs text-body sm:grid-cols-2">
                                                    <span>{tx('Cost')}: {money(item.before.productionCostPerM)} → <strong className="font-semibold text-ink">{money(item.after.productionCostPerM)}</strong></span>
                                                    <span>{tx('Selling price')}: {money(item.before.sellingPricePerM)} → <strong className="font-semibold text-ink">{money(item.after.sellingPricePerM)}</strong></span>
                                                </span>
                                            </span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        )}

                        {!loading && review && review.skipped.length > 0 && (
                            <section className="space-y-2" aria-label={tx('Skipped')}>
                                <h3 className="text-sm font-semibold text-ink">{tx('Skipped')}</h3>
                                <ul className="space-y-1 text-xs text-body">
                                    {review.skipped.map(entry => (
                                        <li key={entry.id}><span className="font-semibold text-ink">{entry.qualityLabel}</span>: {tx(entry.reason)}</li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {problems.length > 0 && (
                            <div className="space-y-2 rounded-xl border border-warning/25 p-3" role="alert">
                                <ul className="space-y-1 text-xs text-body">
                                    {problems.map(problem => (
                                        <li key={problem.id}>{review?.items.find(item => item.id === problem.id)?.qualityLabel ?? problem.id}: {tx(problem.message ?? 'Could not be saved.')}</li>
                                    ))}
                                </ul>
                                <Button variant="outline" className={dialogButton} onClick={() => void load(rate.id)}>{tx('Retry')}</Button>
                            </div>
                        )}

                        {saveError && problems.length === 0 && (
                            <div className="space-y-3" role="alert">
                                <p className="text-sm text-destructive">{tx(saveError)}</p>
                                <Button variant="outline" className={dialogButton} onClick={() => void load(rate.id)}>{tx('Retry')}</Button>
                            </div>
                        )}

                        <DialogFooter className="gap-2 sm:gap-2">
                            <Button variant="outline" className={dialogButton} disabled={saving} onClick={() => onOpenChange(false)}>
                                {tx('Cancel')}
                            </Button>
                            {review && review.items.length > 0 && (
                                <Button
                                    className={cn(dialogButton)}
                                    disabled={saving || tickedItems.length === 0}
                                    onClick={() => void save()}
                                >
                                    {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                                    {saving && progress
                                        ? tx(`Saving ${progress.done} of ${progress.total}…`)
                                        : tx(`Create ${tickedItems.length} new ${tickedItems.length === 1 ? 'version' : 'versions'}`)}
                                </Button>
                            )}
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
