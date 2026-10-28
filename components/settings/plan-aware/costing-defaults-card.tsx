'use client'

import React, { useState, useId, useRef } from 'react'
import { Calculator, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
import { toast, userFacingError } from '@/lib/app-notifications'
import { useSavedFlash } from '@/hooks/use-saved-flash'
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
    mobileFeedback?: boolean
}

export function CostingDefaultsCard({
    initialDefaults,
    onDefaultsUpdated,
    onDirtyChange,
    mobileFeedback = false,
}: CostingDefaultsCardProps) {
    const { t, tx } = useTranslation()
    const [justSaved, flashSaved] = useSavedFlash()
    const wasteInputId = useId()
    const marginInputId = useId()

    const [formState, setFormState] = useState<CostingDefaultsData>(initialDefaults)
    const [savedState, setSavedState] = useState<CostingDefaultsData>(initialDefaults)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
    const submittingRef = useRef(false)
    const [saveError, setSaveError] = useState<string | null>(null)
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
        setSaveError(null)
    }

    const handleDiscard = () => {
        setFormState(savedState)
        setFieldErrors({})
        setStaleError(null)
        onDirtyChange?.(false)
        setSaveError(null)
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
        if (mobileFeedback && submittingRef.current) return
        const errors = validate()
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors)
            return
        }

        submittingRef.current = true
        setIsSubmitting(true)
        setSaveError(null)
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
                    const message = tx(userFacingError(result.error, 'Failed to save costing defaults'))
                    if (mobileFeedback) setSaveError(message)
                    toast.error(message)
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
                flashSaved()
            }
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to save costing defaults'
            if (mobileFeedback) setSaveError(tx(message))
            toast.error(tx(message))
        } finally {
            submittingRef.current = false
            setIsSubmitting(false)
        }
    }

    return (
        <section
            aria-labelledby="costing-defaults-heading"
            className="rounded-2xl border border-hairline bg-surface p-5 shadow-xs sm:p-6"
        >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-hairline/80 pb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-saffron-soft text-saffron-deep">
                            <Calculator className="h-4 w-4" aria-hidden="true" />
                        </span>
                        <h2 id="costing-defaults-heading" className="text-base font-semibold text-ink">
                            {tx('Costing defaults')}
                        </h2>
                    </div>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                        {tx('Set the starting values for new costings. You can change them for each costing.')}
                    </p>
                </div>
                <Badge variant="outline" className="text-xs font-medium text-muted-foreground">
                    {tx('Costing defaults: Used as starting values for new costings in this factory.')}
                </Badge>
            </div>

            {mobileFeedback && saveError && <p role="alert" className="mt-4 text-sm text-risk">{saveError}</p>}
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
                                {tx('Used for any yarn that has no wastage of its own.')}
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
                        <LiquidSegmented
                            fullWidth
                            className="mt-0.5"
                            aria-label={tx('Default overhead method')}
                            disabled={isSubmitting}
                            value={formState.overheadMode}
                            onValueChange={(value) => updateField('overheadMode', value)}
                            options={[
                                { value: 'direct', label: tx('Direct (₹/m)') },
                                { value: 'monthly_expenses', label: tx('Monthly Expenses') },
                            ]}
                        />
                        <p className="text-xs text-muted-foreground">
                            {tx('Starting overhead calculation approach for new estimates.')}
                        </p>
                    </div>

                    {/* CD04: Default Warping Method */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-ink">
                            {tx('Default warping method')}
                        </Label>
                        <LiquidSegmented
                            fullWidth
                            className="mt-0.5"
                            aria-label={tx('Default warping method')}
                            disabled={isSubmitting}
                            value={formState.warpingMode}
                            onValueChange={(value) => updateField('warpingMode', value)}
                            options={[
                                { value: 'in_house', label: tx('In-house') },
                                { value: 'outsourced', label: tx('Outsourced') },
                            ]}
                        />
                        <p className="text-xs text-muted-foreground">
                            {tx('In-house warping is included in factory overhead; outsourced uses rate per kg.')}
                        </p>
                    </div>

                    {/* CD05: Default Sizing Method */}
                    <div className="space-y-2">
                        <Label className="text-sm font-semibold text-ink">
                            {tx('Default sizing method')}
                        </Label>
                        <LiquidSegmented
                            fullWidth
                            className="mt-0.5"
                            aria-label={tx('Default sizing method')}
                            disabled={isSubmitting}
                            value={formState.sizingMode}
                            onValueChange={(value) => updateField('sizingMode', value)}
                            options={[
                                { value: 'in_house', label: tx('In-house') },
                                { value: 'outsourced', label: tx('Outsourced') },
                            ]}
                        />
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
                            className={`min-h-11 rounded-xl bg-loom px-5 font-bold text-white shadow-xs hover:bg-loom-elevated transition-colors ${justSaved && !isDirty ? 'disabled:opacity-100' : ''}`}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                                    {tx('Saving…')}
                                </>
                            ) : justSaved && !isDirty ? (
                                <>
                                    <CheckCircle2 className="ui-success-pop h-4 w-4" aria-hidden="true" />
                                    {t('base_plan.status.saved')}
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
