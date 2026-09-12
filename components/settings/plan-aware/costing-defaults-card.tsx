'use client'

import React, { useState, useId } from 'react'
import { Calculator, Loader2, AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import { saveCostingDefaults, type CostingDefaultsInput } from '@/app/(dashboard)/owner/settings/actions'

export interface CostingDefaultsData {
    yarnShortagePct: number
    defaultMarginPct: number
    overheadMode: 'direct' | 'monthly_expenses'
    warpingMode: 'in_house' | 'outsourced'
    sizingMode: 'in_house' | 'outsourced'
    updatedAt?: string | null
}

interface CostingDefaultsCardProps {
    initialDefaults: CostingDefaultsData
    onDefaultsUpdated?: (newDefaults: CostingDefaultsData) => void
    onDirtyChange?: (dirty: boolean) => void
}

export function CostingDefaultsCard({
    initialDefaults,
    onDefaultsUpdated,
    onDirtyChange,
}: CostingDefaultsCardProps) {
    const { tx } = useTranslation()
    const wasteInputId = useId()
    const marginInputId = useId()

    const [formState, setFormState] = useState<CostingDefaultsData>(initialDefaults)
    const [savedState, setSavedState] = useState<CostingDefaultsData>(initialDefaults)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const [staleError, setStaleError] = useState<string | null>(null)

    // Check whether form differs from confirmed saved state
    const isDirty = (
        formState.yarnShortagePct !== savedState.yarnShortagePct ||
        formState.defaultMarginPct !== savedState.defaultMarginPct ||
        formState.overheadMode !== savedState.overheadMode ||
        formState.warpingMode !== savedState.warpingMode ||
        formState.sizingMode !== savedState.sizingMode
    )

    const updateField = <K extends keyof CostingDefaultsData>(field: K, value: CostingDefaultsData[K]) => {
        setFormState(prev => {
            const next = { ...prev, [field]: value }
            const dirty = (
                next.yarnShortagePct !== savedState.yarnShortagePct ||
                next.defaultMarginPct !== savedState.defaultMarginPct ||
                next.overheadMode !== savedState.overheadMode ||
                next.warpingMode !== savedState.warpingMode ||
                next.sizingMode !== savedState.sizingMode
            )
            onDirtyChange?.(dirty)
            return next
        })
        setFieldErrors(prev => {
            if (!prev[field]) return prev
            const copy = { ...prev }
            delete copy[field]
            return copy
        })
        setStaleError(null)
    }

    const handleDiscard = () => {
        setFormState(savedState)
        setFieldErrors({})
        setStaleError(null)
        onDirtyChange?.(false)
    }

    const validate = () => {
        const errors: Record<string, string> = {}
        if (Number.isNaN(formState.yarnShortagePct) || formState.yarnShortagePct < 0 || formState.yarnShortagePct > 100) {
            errors.yarnShortagePct = tx('Enter a wastage percentage between 0 and 100%')
        }
        if (Number.isNaN(formState.defaultMarginPct) || formState.defaultMarginPct < 0 || formState.defaultMarginPct >= 100) {
            errors.defaultMarginPct = tx('Enter a target margin percentage between 0 and 99.99%')
        }
        return errors
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const errors = validate()
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors)
            return
        }

        setIsSubmitting(true)
        setFieldErrors({})
        setStaleError(null)

        const payload: CostingDefaultsInput = {
            yarnShortagePct: formState.yarnShortagePct,
            defaultMarginPct: formState.defaultMarginPct,
            overheadMode: formState.overheadMode,
            warpingMode: formState.warpingMode,
            sizingMode: formState.sizingMode,
            expectedUpdatedAt: formState.updatedAt,
        }

        try {
            const result = await saveCostingDefaults(payload)
            if ('error' in result && result.error) {
                if ('stale' in result && result.stale) {
                    setStaleError(tx('These settings changed elsewhere. Review the latest values before saving.'))
                } else {
                    toast.error(tx(userFacingError(result.error, 'Failed to save costing defaults')))
                }
            } else if (result.success && result.defaults) {
                const confirmed: CostingDefaultsData = {
                    ...result.defaults,
                    updatedAt: result.updatedAt,
                }
                setSavedState(confirmed)
                setFormState(confirmed)
                onDefaultsUpdated?.(confirmed)
                onDirtyChange?.(false)
                toast.success(tx('Costing defaults saved for new costings'))
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save costing defaults'
            toast.error(tx(message))
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section
            aria-labelledby="costing-defaults-heading"
            className="rounded-2xl border border-hairline bg-surface p-6 shadow-xs sm:p-8"
        >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline/80 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                            <Calculator className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="costing-defaults-heading" className="text-lg font-bold tracking-tight text-ink">
                            {tx('Costing defaults')}
                        </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {tx('Set the starting values for new costings. You can change them for each costing.')}
                    </p>
                </div>
                <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground">
                    {tx('Costing defaults: Used as starting values for new costings in this factory.')}
                </Badge>
            </div>

            {staleError && (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-warning/30 bg-warning-soft p-3.5 text-sm text-ink" role="alert">
                    <AlertCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <p>{staleError}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-6">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* CD01: Default Yarn Wastage */}
                    <div className="space-y-2">
                        <Label htmlFor={wasteInputId} className="text-sm font-semibold text-ink">
                            {tx('Default yarn wastage')}
                        </Label>
                        <div className="relative">
                            <Input
                                id={wasteInputId}
                                type="number"
                                step="0.1"
                                min="0"
                                max="100"
                                value={formState.yarnShortagePct}
                                onChange={e => updateField('yarnShortagePct', Number(e.target.value))}
                                disabled={isSubmitting}
                                aria-invalid={!!fieldErrors.yarnShortagePct}
                                className="h-11 rounded-xl border-hairline bg-surface pr-10 font-mono tabular-nums text-sm focus-visible:border-loom"
                                placeholder="0"
                            />
                            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                                %
                            </span>
                        </div>
                        {fieldErrors.yarnShortagePct ? (
                            <p className="text-xs font-medium text-risk" role="alert">
                                {fieldErrors.yarnShortagePct}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {tx('Applied to yarn rows that do not specify an individual wastage override.')}
                            </p>
                        )}
                    </div>

                    {/* CD02: Default Profit Margin */}
                    <div className="space-y-2">
                        <Label htmlFor={marginInputId} className="text-sm font-semibold text-ink">
                            {tx('Default margin')}
                        </Label>
                        <div className="relative">
                            <Input
                                id={marginInputId}
                                type="number"
                                step="0.5"
                                min="0"
                                max="99.99"
                                value={formState.defaultMarginPct}
                                onChange={e => updateField('defaultMarginPct', Number(e.target.value))}
                                disabled={isSubmitting}
                                aria-invalid={!!fieldErrors.defaultMarginPct}
                                className="h-11 rounded-xl border-hairline bg-surface pr-10 font-mono tabular-nums text-sm focus-visible:border-loom"
                                placeholder="10"
                            />
                            <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                                %
                            </span>
                        </div>
                        {fieldErrors.defaultMarginPct ? (
                            <p className="text-xs font-medium text-risk" role="alert">
                                {fieldErrors.defaultMarginPct}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                {tx('Target gross margin on selling price pre-filled into new costings.')}
                            </p>
                        )}
                    </div>

                    {/* CD03: Default Overhead Method */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-ink">
                            {tx('Default overhead method')}
                        </Label>
                        <div className="grid grid-cols-2 gap-2 pt-0.5" role="radiogroup" aria-label={tx('Default overhead method')}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={formState.overheadMode === 'direct'}
                                onClick={() => updateField('overheadMode', 'direct')}
                                disabled={isSubmitting}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom/40 ${
                                    formState.overheadMode === 'direct'
                                        ? 'border-loom bg-loom text-white shadow-xs'
                                        : 'border-hairline bg-surface hover:bg-surface-soft text-body'
                                }`}
                            >
                                {tx('Direct (₹/m)')}
                            </button>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={formState.overheadMode === 'monthly_expenses'}
                                onClick={() => updateField('overheadMode', 'monthly_expenses')}
                                disabled={isSubmitting}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom/40 ${
                                    formState.overheadMode === 'monthly_expenses'
                                        ? 'border-loom bg-loom text-white shadow-xs'
                                        : 'border-hairline bg-surface hover:bg-surface-soft text-body'
                                }`}
                            >
                                {tx('Monthly Expenses')}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {tx('Starting overhead calculation approach for new estimates.')}
                        </p>
                    </div>

                    {/* CD04: Default Warping Method */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-ink">
                            {tx('Default warping method')}
                        </Label>
                        <div className="grid grid-cols-2 gap-2 pt-0.5" role="radiogroup" aria-label={tx('Default warping method')}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={formState.warpingMode === 'in_house'}
                                onClick={() => updateField('warpingMode', 'in_house')}
                                disabled={isSubmitting}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom/40 ${
                                    formState.warpingMode === 'in_house'
                                        ? 'border-loom bg-loom text-white shadow-xs'
                                        : 'border-hairline bg-surface hover:bg-surface-soft text-body'
                                }`}
                            >
                                {tx('In-house')}
                            </button>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={formState.warpingMode === 'outsourced'}
                                onClick={() => updateField('warpingMode', 'outsourced')}
                                disabled={isSubmitting}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom/40 ${
                                    formState.warpingMode === 'outsourced'
                                        ? 'border-loom bg-loom text-white shadow-xs'
                                        : 'border-hairline bg-surface hover:bg-surface-soft text-body'
                                }`}
                            >
                                {tx('Outsourced')}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {tx('In-house warping is included in factory overhead; outsourced uses rate per kg.')}
                        </p>
                    </div>

                    {/* CD05: Default Sizing Method */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-ink">
                            {tx('Default sizing method')}
                        </Label>
                        <div className="grid grid-cols-2 gap-2 pt-0.5" role="radiogroup" aria-label={tx('Default sizing method')}>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={formState.sizingMode === 'in_house'}
                                onClick={() => updateField('sizingMode', 'in_house')}
                                disabled={isSubmitting}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom/40 ${
                                    formState.sizingMode === 'in_house'
                                        ? 'border-loom bg-loom text-white shadow-xs'
                                        : 'border-hairline bg-surface hover:bg-surface-soft text-body'
                                }`}
                            >
                                {tx('In-house')}
                            </button>
                            <button
                                type="button"
                                role="radio"
                                aria-checked={formState.sizingMode === 'outsourced'}
                                onClick={() => updateField('sizingMode', 'outsourced')}
                                disabled={isSubmitting}
                                className={`flex min-h-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-loom/40 ${
                                    formState.sizingMode === 'outsourced'
                                        ? 'border-loom bg-loom text-white shadow-xs'
                                        : 'border-hairline bg-surface hover:bg-surface-soft text-body'
                                }`}
                            >
                                {tx('Outsourced')}
                            </button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {tx('In-house sizing is included in factory overhead; outsourced uses rate per kg.')}
                        </p>
                    </div>
                </div>

                {/* Footer Note and Form Actions */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline/80 pt-4">
                    <p className="text-xs font-medium text-muted-foreground">
                        {tx('Changes apply to new costings. Existing costings are not changed.')}
                    </p>
                    <div className="flex items-center gap-3">
                        {isDirty && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleDiscard}
                                disabled={isSubmitting}
                                className="min-h-11 rounded-xl px-4 font-medium"
                            >
                                {tx('Discard changes')}
                            </Button>
                        )}
                        <Button
                            type="submit"
                            disabled={!isDirty || isSubmitting}
                            className="min-h-11 rounded-xl bg-loom px-5 font-bold text-white shadow-xs hover:bg-loom-elevated transition-colors"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    {tx('Saving…')}
                                </>
                            ) : (
                                tx('Save costing defaults')
                            )}
                        </Button>
                    </div>
                </div>
            </form>
        </section>
    )
}
