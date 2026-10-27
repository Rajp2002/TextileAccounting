'use client'

import { useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { Loader2, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RangeSlider } from '@/components/ui/range-slider'
import { cn } from '@/lib/utils'
import { createClientRequestUuid } from '@/lib/client-request-id'
import { fillCopy } from '@/lib/i18n/fill'
import { costingMarginText } from '@/lib/i18n/costing-margin'
import { useTranslation } from '@/lib/i18n/context'
import {
    evaluateMarginAdjustment,
    marginBounds,
    marginsDiffer,
    previewMargin,
    snapMargin,
} from '@/lib/costing-margin'
import type { CostingResultSnapshot, EstimateState } from '@/lib/estimator'
import { sellingPriceFormula } from '@/lib/saved-costing-formula'
import { FormulaExpression, FormulaGroup, FormulaInput, type FormulaInputKind } from '@/components/estimator/SavedCostingFormula'

/** Margin text: ochre under 10%, madder when a costing loses money, ink otherwise. */
export function marginTone(margin: number | null) {
    if (margin == null) return 'text-muted-foreground'
    if (margin < 0) return 'text-[var(--wv-madder-600)]'
    return margin < 10 ? 'text-[var(--wv-ochre-800)]' : 'text-ink'
}

/** Why a costing's margin is shown without a slider. */
export type MarginReadOnlyReason = 'archived' | 'older' | 'checked'

type ScopeProps = {
    /** The saved costing's inputs, rebuilt as an estimate; null when they cannot be rebuilt. */
    base: EstimateState | null
    /** The saved result: what the costing says today, and what Reset returns to. */
    saved: CostingResultSnapshot
    /** Set when the caller already knows this version cannot change (archived, not the latest, unchecked). */
    readOnly: MarginReadOnlyReason | null
    /** Version numbers for the Save label and the older-version note. */
    versionNumber: number
    latestVersionNumber: number
    /** Examples can be dragged but never saved. */
    isSample?: boolean
    priceLabel: string
    /** Saves the margin as the next version. Resolves true when it was saved. */
    onSave: (marginPct: number, clientRequestId: string) => Promise<boolean>
    children: (scope: { paused: boolean; pausedTitle: string | undefined; economics: ReactNode }) => ReactNode
}

function money(value: number) {
    return `₹${value.toFixed(2)}`
}

/**
 * Holds the what-if margin for one saved costing. It lives inside the open
 * breakdown, so every way of closing it (X, backdrop, Esc, a route change)
 * unmounts it and the next open starts from the saved margin; nothing is ever
 * stored until Save. While the margin differs from the saved one, `paused` tells
 * the breakdown to hold the actions that would read the costing, so none of them
 * quietly uses a number that has not been saved.
 */
export function CostingMarginScope({ base, saved, readOnly, versionNumber, latestVersionNumber, isSample = false, priceLabel, onSave, children }: ScopeProps) {
    const { language } = useTranslation()
    const copy = costingMarginText[language]
    const sliderId = useId()
    const savedMargin = saved.targetMarginPct
    const [draft, setDraft] = useState(savedMargin)
    const [saving, setSaving] = useState(false)
    const requestRef = useRef<{ marginPct: number; id: string } | null>(null)

    const adjustability = useMemo(
        () => (readOnly || !base ? null : evaluateMarginAdjustment(base, saved)),
        [base, readOnly, saved],
    )
    const editable = adjustability?.adjustable === true && base != null
    const bounds = useMemo(() => marginBounds(savedMargin, saved.commissionPct), [savedMargin, saved.commissionPct])

    const marginPct = editable ? draft : savedMargin
    const dirty = editable && marginsDiffer(draft, savedMargin)
    // A costing that cannot be adjusted keeps the figure it always showed: the margin its saved price really earns.
    const readOutPct = editable ? draft : saved.actualMarginPct
    const shown = useMemo(
        () => (dirty && base ? previewMargin(base, draft) : saved),
        [base, dirty, draft, saved],
    )

    const move = (next: number) => setDraft(snapMargin(next, bounds))
    const reset = () => setDraft(savedMargin)
    const save = async () => {
        if (!dirty || saving) return
        if (!requestRef.current || requestRef.current.marginPct !== draft) requestRef.current = { marginPct: draft, id: createClientRequestUuid() }
        setSaving(true)
        try {
            if (await onSave(draft, requestRef.current.id)) requestRef.current = null
        } finally {
            setSaving(false)
        }
    }

    const reason = readOnly ?? (!base || (adjustability && !adjustability.adjustable) ? 'checked' : null)
    const readOnlyNote = reason === 'archived'
        ? copy.readOnlyArchived
        : reason === 'older'
            ? fillCopy(copy.readOnlyOlder, { n: latestVersionNumber })
            : reason === 'checked' ? copy.readOnlyChecked : null
    const pct = (value: number) => `${value.toFixed(1)}%`
    const nextVersion = latestVersionNumber + 1

    // The price is worked from the production cost above it. A read-only costing shows the sum
    // only while its saved price still earns the saved margin; a typed-in price has no sum.
    const priceFormula = editable || Math.abs(saved.actualMarginPct - saved.targetMarginPct) < 0.05 ? sellingPriceFormula(shown) : null
    const pill = (kind: FormulaInputKind, text: string) => <FormulaInput kind={kind}>{text}</FormulaInput>

    const economics = (
        <div className="grid overflow-hidden rounded-xl border border-hairline">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2 px-4 py-3.5">
                <div className="min-w-0">
                    <p className="text-[15px] font-semibold leading-7 text-ink">{priceLabel}</p>
                    {priceFormula && (
                        <p className="text-sm leading-7 text-body" data-i18n-skip="true" lang={language}>
                            <FormulaExpression
                                op="÷"
                                terms={[
                                    priceFormula.transportPerM != null
                                        ? <FormulaGroup key="cost"><FormulaExpression terms={[money(shown.productionCostPerM), pill('rate', fillCopy(copy.transportTerm, { amount: priceFormula.transportPerM.toFixed(2) }))]} op="+" /></FormulaGroup>
                                        : money(shown.productionCostPerM),
                                    <FormulaGroup key="share">
                                        <FormulaExpression
                                            op="−"
                                            terms={[
                                                '1',
                                                ...(priceFormula.commissionPct != null ? [pill('percent', fillCopy(copy.commissionTerm, { pct: priceFormula.commissionPct.toFixed(1) }))] : []),
                                                pill('percent', fillCopy(copy.marginTerm, { pct: priceFormula.marginPct.toFixed(1) })),
                                            ]}
                                        />
                                    </FormulaGroup>,
                                ]}
                            />
                        </p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-ink tabular-nums">{money(shown.suggestedSellingPricePerM)}<span className="ml-0.5 text-sm font-medium tracking-normal text-muted-foreground">/m</span></p>
                    <p className="text-[13px] text-muted-foreground tabular-nums">{fillCopy(copy.profit, { amount: money(shown.profitPerM) })}</p>
                </div>
            </div>
            <div className="border-t border-hairline p-4">
                <div className="flex items-center justify-between gap-3">
                    {editable
                        ? <label htmlFor={sliderId} className="text-[13px] text-muted-foreground">{copy.title}</label>
                        : <p className="text-[13px] text-muted-foreground">{copy.actual}</p>}
                    <div className="flex items-center gap-1.5">
                        {editable && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={saving || marginPct <= bounds.min}
                                onClick={() => move(marginPct - bounds.step)}
                                aria-label={fillCopy(copy.lower, { step: bounds.step })}
                                className="size-10 max-md:size-11"
                            >
                                <Minus aria-hidden="true" />
                            </Button>
                        )}
                        <output htmlFor={editable ? sliderId : undefined} className={cn('min-w-[4.75rem] text-center text-2xl font-semibold tracking-[-0.02em] tabular-nums', marginTone(readOutPct))}>{pct(readOutPct)}</output>
                        {editable && (
                            <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                disabled={saving || marginPct >= bounds.max}
                                onClick={() => move(marginPct + bounds.step)}
                                aria-label={fillCopy(copy.raise, { step: bounds.step })}
                                className="size-10 max-md:size-11"
                            >
                                <Plus aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                </div>
                {editable && (
                    <RangeSlider
                        id={sliderId}
                        min={bounds.min}
                        max={bounds.max}
                        step={bounds.step}
                        value={snapMargin(draft, bounds)}
                        disabled={saving}
                        aria-valuetext={fillCopy(copy.valueText, { pct: marginPct.toFixed(1), price: shown.suggestedSellingPricePerM.toFixed(2) })}
                        onValueChange={move}
                        className="mt-1"
                    />
                )}
                {dirty ? (
                    <div className="mt-1 grid gap-3 sm:flex sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-x-3">
                            <p className="text-[13px] text-muted-foreground tabular-nums">{fillCopy(copy.savedWas, { pct: pct(savedMargin), amount: `${money(saved.suggestedSellingPricePerM)}` })}</p>
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={reset}
                                disabled={saving}
                                aria-label={fillCopy(copy.resetLabel, { pct: pct(savedMargin) })}
                                className="-ml-1 h-10 px-2 underline decoration-hairline-strong underline-offset-4 max-md:min-h-11"
                            >
                                {copy.reset}
                            </Button>
                        </div>
                        <Button type="button" onClick={save} disabled={saving} aria-busy={saving} className="h-10 max-md:min-h-11 max-sm:w-full">
                            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                            {saving ? copy.saving : fillCopy(copy.save, { n: nextVersion })}
                        </Button>
                    </div>
                ) : (
                    <p className={cn('text-[13px] leading-5 text-muted-foreground', editable ? 'mt-1' : 'mt-2')}>
                        {readOnlyNote ?? (isSample ? copy.sampleHelp : copy.help)}
                    </p>
                )}
                {dirty && (
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{fillCopy(copy.saveNote, { old: versionNumber, n: nextVersion })}</p>
                )}
            </div>
        </div>
    )

    return <>{children({ paused: dirty, pausedTitle: dirty ? copy.pausedAction : undefined, economics })}</>
}
