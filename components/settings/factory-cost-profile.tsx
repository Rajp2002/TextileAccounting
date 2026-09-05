'use client'

import { useState, useEffect, useId, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Zap, Calculator, TrendingUp, Truck, Users2, Wind, Sparkles, CheckCircle2, AlertCircle, RefreshCw, ChevronDown } from 'lucide-react'
import { applyMonthlyDerivedOverhead, getFactoryCostProfile, upsertFactoryCostProfile } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from '@/lib/app-notifications'
import { DEFAULT_FACTORY_SECTIONS, DEFAULT_OVERHEAD_ITEMS, ensureOverheadIntegrity, type FactorySections, type OverheadItem, type OverheadMode } from '@/lib/estimator'
import { cn } from '@/lib/utils'
import { userFacingError } from '@/lib/app-notifications'
import { parseNonNegativeInput, parseNumericInput } from '@/lib/numeric-input'
import { nanoid } from 'nanoid'
import {
    FACTORY_COST_PRESETS,
    getMatchingFactoryProfileId,
    hasMeaningfulFactoryCostBaseline,
    type FactoryProfileId,
} from '@/lib/factory-cost-profiles'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { useTranslation } from '@/lib/i18n/context'
import { validateFactoryCostProfile } from '@/lib/estimator-validation'
import { MonthlyOverheadCalculator } from '@/components/settings/monthly-overhead-calculator'
import { deriveCostingOverheadPerMetre, ensureMonthlyOverheadPresetCoverage, formatIndianMoney, getMonthlyOverheadTotal } from '@/lib/monthly-overhead'
import { trackPlanEvent } from '@/lib/plan-analytics'

// ─── NumericInput helper ──────────────────────────────────────────────────────

function RateInput({
    id,
    field,
    label,
    value,
    displayValue,
    onChange,
    unit,
    hint,
    step = 0.5,
    icon: Icon,
}: {
    id?:       string
    field?:    string
    label:    string
    value:    number
    displayValue?: number
    onChange: (v: number) => void
    unit?:    string
    hint?:    string
    step?:    number
    icon?:    React.ElementType
}) {
    const inputId = useId()
    const resolvedInputId = id ?? inputId
    const { tx } = useTranslation()

    return (
        <div className="space-y-1.5">
            <Label htmlFor={resolvedInputId} className="flex items-center gap-1.5 text-xs font-semibold text-body">
                {Icon && <Icon className="h-3.5 w-3.5 text-subtle" />}
                {tx(label)}
            </Label>
            <div className="relative">
                <Input
                    id={resolvedInputId}
                    data-factory-field={field}
                    type="number"
                    step={step}
                    min={0}
                    value={displayValue ?? value}
                    onChange={e => onChange(parseNonNegativeInput(e.target.value) ?? 0)}
                    className="h-10 border-hairline bg-canvas/80 pr-12 font-mono text-sm focus-visible:border-saffron"
                />
                {unit && (
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                        {tx(unit)}
                    </span>
                )}
            </div>
            {hint && <p className="text-[11px] text-muted-foreground">{tx(hint)}</p>}
        </div>
    )
}

function OptionalAssumptionDisclosure({
    title,
    summary,
    description,
    enabled,
    open,
    onOpenChange,
    onEnabledChange,
    children,
}: {
    title: string
    summary: string
    description: string
    enabled: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
    onEnabledChange: (enabled: boolean) => void
    children?: React.ReactNode
}) {
    const { tx } = useTranslation()
    const switchId = useId()

    return (
        <details
            open={open}
            onToggle={event => onOpenChange(event.currentTarget.open)}
            className="premium-disclosure-card group overflow-hidden rounded-lg border border-hairline bg-surface/95"
        >
            <summary
                className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden"
                onClick={event => {
                    // The switch is an interactive child of summary. Let
                    // Radix handle the switch click without also toggling the
                    // native details element.
                    if (event.target instanceof Element && event.target.closest('[data-slot="switch"]')) {
                        event.preventDefault()
                    }
                }}
            >
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-ink">{tx(title)}</span>
                        <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                            enabled ? 'bg-success-soft text-success' : 'bg-canvas text-muted-foreground',
                        )}>
                            {enabled ? tx('Enabled') : tx('Off')}
                        </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tx(enabled ? summary : description)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    <Switch
                        id={switchId}
                        checked={enabled}
                        aria-label={`${tx(title)} ${tx('enabled')}`}
                        onCheckedChange={onEnabledChange}
                    />
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                </div>
            </summary>
            {enabled && (
                <div className="premium-disclosure-content space-y-4 border-t border-hairline/70 px-4 pb-4 pt-4">
                    {children}
                </div>
            )}
        </details>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

type OptionalSectionKey = 'winding' | 'processing' | 'finishing' | 'commission' | 'transport' | 'review'

const DEFAULT_OPTIONAL_OPEN: Record<OptionalSectionKey, boolean> = {
    winding: false,
    processing: false,
    finishing: false,
    commission: false,
    transport: false,
    review: false,
}

export function FactoryCostProfile({ className, standaloneEstimator = false }: { className?: string; standaloneEstimator?: boolean }) {
    const { tx } = useTranslation()
    const [loading, setLoading]   = useState(true)
    const [salaryStaff, setSalaryStaff] = useState<Array<{ id: string; name: string; monthlySalary: number }>>([])
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving]     = useState(false)
    const [activePreset, setActivePreset] = useState<FactoryProfileId | null>(null)
    const [presetToReplace, setPresetToReplace] = useState<(typeof FACTORY_COST_PRESETS)[number] | null>(null)
    const [dirty, setDirty] = useState(false)
    const [nonOverheadDirty, setNonOverheadDirty] = useState(false)
    const [saveError, setSaveError] = useState<string | null>(null)
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
    const [lastSavedOverheadMode, setLastSavedOverheadMode] = useState<OverheadMode>('monthly_expenses')
    const [hasMeaningfulBaseline, setHasMeaningfulBaseline] = useState(false)
    const [coreOpen, setCoreOpen] = useState(true)
    const [capacityOpen, setCapacityOpen] = useState(!standaloneEstimator)
    const [optionalGroupOpen, setOptionalGroupOpen] = useState(false)
    const [optionalOpen, setOptionalOpen] = useState<Record<OptionalSectionKey, boolean>>(DEFAULT_OPTIONAL_OPEN)

    const [rates, setRates] = useState({
        warping_rate_per_kg:     2.00,
        sizing_rate_per_kg:      1.50,
        winding_rate_per_kg:     0,
        default_commission_pct:  0,
        default_margin_pct:      10.00,
        default_transport_per_m: 0,
        yarn_review_interval_days: 90,
        default_processing_rate_per_m: 0,
        default_finishing_rate_per_m: 0,
    })

    const [sections, setSections] = useState<FactorySections>({
        winding:    false,
        processing: false,
        finishing:  false,
        commission: false,
        transport:  false,
    })
    const [overheadMode, setOverheadMode] = useState<OverheadMode>('monthly_expenses')
    const [directOverheadPerM, setDirectOverheadPerM] = useState(0)
    const [overheadItems, setOverheadItems] = useState<OverheadItem[]>(() => ensureOverheadIntegrity(
        DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() })),
    ))
    const [monthlyOutputM, setMonthlyOutputM] = useState(0)
    const [monthlyCalculatorOpen, setMonthlyCalculatorOpen] = useState(false)
    const [loomCount, setLoomCount] = useState(0)
    const [monthlyWorkingDays, setMonthlyWorkingDays] = useState(26)
    const [avgOutputPerLoomPerDay, setAvgOutputPerLoomPerDay] = useState(50)

    const loadProfile = useCallback(async () => {
        setLoading(true)
        setLoadError(null)
        try {
            const res = await getFactoryCostProfile()
            if (!res.data) {
                setLoadError(userFacingError(res.error, 'Factory costing defaults could not be loaded. Refresh and try again.'))
                return
            }

            const d = res.data
            setLastSavedAt(d.updated_at ?? null)
            const meaningfulBaseline = hasMeaningfulFactoryCostBaseline(d)
            setHasMeaningfulBaseline(meaningfulBaseline)
            // Returning owners usually visit Settings to confirm one value, not
            // to reread the entire setup. Keep a meaningful saved profile
            // compact while leaving first-run setup open. This intentionally
            // uses the shared baseline logic rather than only is_configured so
            // older valid profiles remain returning-owner profiles.
            setCoreOpen(!meaningfulBaseline)
            setRates({
                warping_rate_per_kg:     Number(d.warping_rate_per_kg    ?? 2.00),
                sizing_rate_per_kg:      Number(d.sizing_rate_per_kg     ?? 1.50),
                winding_rate_per_kg:     Number(d.winding_rate_per_kg    ?? 0),
                default_commission_pct:  Number(d.default_commission_pct ?? 0),
                default_margin_pct:      Number(d.default_margin_pct     ?? 10.00),
                default_transport_per_m: Number(d.default_transport_per_m ?? 0),
                yarn_review_interval_days: Number(d.yarn_review_interval_days ?? 90),
                default_processing_rate_per_m: Number(d.default_processing_rate_per_m ?? 0),
                default_finishing_rate_per_m: Number(d.default_finishing_rate_per_m ?? 0),
            })
            const loadedMode: OverheadMode = d.overhead_mode === 'direct'
                || (d.overhead_mode == null && d.overhead_override_per_m != null)
                ? 'direct'
                : 'monthly_expenses'
            setOverheadMode(loadedMode)
            setLastSavedOverheadMode(loadedMode)
            // Capacity is useful decision support, but it is not part of the
            // monthly overhead basis. Keep Lite compact and let the owner open
            // it only when they want capacity warnings/utilisation context.
            setCapacityOpen(standaloneEstimator
                ? false
                : loadedMode === 'monthly_expenses' && (
                    Number(d.loom_count ?? 0) <= 0
                    || Number(d.monthly_working_days ?? 0) <= 0
                    || Number(d.avg_output_per_loom_per_day ?? 0) <= 0
                ))
            setDirectOverheadPerM(Number(d.overhead_override_per_m ?? 0))
            setSalaryStaff(d.base_salary_staff ?? [])
            setOverheadItems(ensureMonthlyOverheadPresetCoverage(ensureOverheadIntegrity(
                Array.isArray(d.overhead_items) && d.overhead_items.length > 0
                    ? d.overhead_items
                    : DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() })),
            )))
            // Persisted values are authoritative even for profiles created by an
            // older release that did not set is_configured after the first save.
            setMonthlyOutputM(Number(d.monthly_output_m ?? 0))
            setLoomCount(Number(d.loom_count ?? 0))
            setMonthlyWorkingDays(Number(d.monthly_working_days ?? 26))
            setAvgOutputPerLoomPerDay(Number(d.avg_output_per_loom_per_day ?? 50))

            const loadedSections: FactorySections = {
                ...DEFAULT_FACTORY_SECTIONS,
                ...(d.enabled_sections as Partial<FactorySections> | null | undefined),
            }
            setSections(loadedSections)
            setOptionalOpen({
                winding: loadedSections.winding && Number(d.winding_rate_per_kg ?? 0) <= 0,
                processing: loadedSections.processing && Number(d.default_processing_rate_per_m ?? 0) <= 0,
                finishing: loadedSections.finishing && Number(d.default_finishing_rate_per_m ?? 0) <= 0,
                commission: loadedSections.commission && Number(d.default_commission_pct ?? 0) <= 0,
                transport: loadedSections.transport && Number(d.default_transport_per_m ?? 0) <= 0,
                review: Number(d.yarn_review_interval_days ?? 90) < 1
                    || Number(d.yarn_review_interval_days ?? 90) > 1095
                    || !Number.isInteger(Number(d.yarn_review_interval_days ?? 90)),
            })
            const persistedProfile = d.factory_profile_key as FactoryProfileId | undefined
            setActivePreset(
                persistedProfile && persistedProfile !== 'unselected'
                    ? persistedProfile
                    : getMatchingFactoryProfileId(loadedSections) || 'custom',
            )
        } catch (error) {
            setLoadError(userFacingError(error, 'Factory costing defaults could not be loaded. Refresh and try again.'))
        } finally {
            setLoading(false)
        }
    }, [standaloneEstimator])

    useEffect(() => {
        void loadProfile()
    }, [loadProfile])

    const markDirty = (scope: 'overhead' | 'other' = 'other') => {
        setDirty(true)
        if (scope === 'other') setNonOverheadDirty(true)
        setSaveError(null)
    }

    const applyPresetImmediately = (preset: (typeof FACTORY_COST_PRESETS)[number]) => {
        setActivePreset(preset.id)
        setSections({ ...preset.sections })
        markDirty()
    }

    const applyPreset = (preset: (typeof FACTORY_COST_PRESETS)[number]) => {
        if (dirty && activePreset !== preset.id) {
            setPresetToReplace(preset)
            return
        }
        applyPresetImmediately(preset)
    }

    const buildSavePayload = () => ({
        ...rates,
        overhead_mode: overheadMode,
        factory_profile_key: activePreset === 'custom'
            ? 'custom' as const
            : getMatchingFactoryProfileId(sections) ?? activePreset ?? 'custom' as const,
        enabled_sections: sections,
        overhead_items: overheadItems,
        monthly_output_m: monthlyOutputM,
        overhead_override_per_m: overheadMode === 'direct' ? directOverheadPerM : derivedOverheadPerM,
        loom_count: loomCount,
        monthly_working_days: monthlyWorkingDays,
        avg_output_per_loom_per_day: avgOutputPerLoomPerDay,
        // Disabled assumptions are intentionally neutral in the save payload.
        // Their draft values remain available if the owner enables them again
        // before saving, but an inactive option cannot block this save.
        winding_rate_per_kg: sections.winding ? rates.winding_rate_per_kg : 0,
        default_processing_rate_per_m: sections.processing ? rates.default_processing_rate_per_m : 0,
        default_finishing_rate_per_m: sections.finishing ? rates.default_finishing_rate_per_m : 0,
        default_commission_pct: sections.commission ? rates.default_commission_pct : 0,
        default_transport_per_m: sections.transport ? rates.default_transport_per_m : 0,
    })

    const getSaveValidation = () => {
        const payload = buildSavePayload()
        const validation = validateFactoryCostProfile(payload)
        const validationIssues = validation.valid ? [] : validation.issues
        return {
            payload,
            validation,
            // Monthly overhead only needs standard production and monthly expenses.
            // Capacity fields remain validated when supplied, but do not block
            // a valid Lite costing baseline.
            issues: validationIssues,
        }
    }

    const disclosureForField = (field: string) => {
        if (field === 'loom_count' || field === 'monthly_working_days' || field === 'avg_output_per_loom_per_day') return 'capacity' as const
        if (field === 'winding_rate_per_kg') return 'winding' as const
        if (field === 'default_processing_rate_per_m') return 'processing' as const
        if (field === 'default_finishing_rate_per_m') return 'finishing' as const
        if (field === 'default_commission_pct') return 'commission' as const
        if (field === 'default_transport_per_m') return 'transport' as const
        if (field === 'yarn_review_interval_days') return 'review' as const
        return 'core' as const
    }

    const fieldElementId = (field: string) => {
        if (field.startsWith('overhead_items.')) {
            const index = Number(field.split('.')[1])
            const item = Number.isInteger(index) ? overheadItems[index] : undefined
            return item ? `factory-overhead-${item.id}-monthly-amount` : 'factory-monthly-output'
        }
        const ids: Record<string, string> = {
            warping_rate_per_kg: 'factory-warping-rate',
            sizing_rate_per_kg: 'factory-sizing-rate',
            winding_rate_per_kg: 'factory-winding-rate',
            default_processing_rate_per_m: 'factory-processing-rate',
            default_finishing_rate_per_m: 'factory-finishing-rate',
            default_commission_pct: 'factory-commission-rate',
            default_transport_per_m: 'factory-transport-rate',
            default_margin_pct: 'factory-target-margin',
            yarn_review_interval_days: 'factory-yarn-review-period',
            overhead_override_per_m: 'factory-direct-overhead',
            monthly_output_m: 'factory-monthly-output',
            overhead_items: overheadItems[0] ? `factory-overhead-${overheadItems[0].id}-monthly-amount` : 'factory-monthly-output',
            loom_count: 'factory-loom-count',
            monthly_working_days: 'factory-working-days',
            avg_output_per_loom_per_day: 'factory-output-per-loom',
        }
        return ids[field]
    }

    const openDisclosureForField = (field: string) => {
        const disclosure = disclosureForField(field)
        if (disclosure === 'core' || disclosure === 'capacity') setCoreOpen(true)
        if (disclosure === 'capacity') setCapacityOpen(true)
        if (disclosure !== 'core' && disclosure !== 'capacity') {
            setOptionalOpen(current => ({ ...current, [disclosure]: true }))
        }
    }

    const focusInvalidField = (field: string) => {
        const id = fieldElementId(field)
        if (!id || typeof window === 'undefined') return
        window.setTimeout(() => {
            const element = document.getElementById(id)
            if (!(element instanceof HTMLElement)) return
            element.focus()
            element.scrollIntoView({ block: 'center', behavior: 'smooth' })
        }, 0)
    }

    const inferServerValidationField = (message: string) => {
        const normalized = message.toLowerCase()
        if (normalized.includes('loom')) return 'loom_count'
        if (normalized.includes('working days')) return 'monthly_working_days'
        if (normalized.includes('daily output') || normalized.includes('per loom')) return 'avg_output_per_loom_per_day'
        if (normalized.includes('monthly output')) return 'monthly_output_m'
        if (normalized.includes('monthly factory expense')) return 'overhead_items'
        if (normalized.includes('direct overhead')) return 'overhead_override_per_m'
        if (normalized.includes('winding')) return 'winding_rate_per_kg'
        if (normalized.includes('processing')) return 'default_processing_rate_per_m'
        if (normalized.includes('finishing')) return 'default_finishing_rate_per_m'
        if (normalized.includes('commission')) return 'default_commission_pct'
        if (normalized.includes('transport')) return 'default_transport_per_m'
        if (normalized.includes('review')) return 'yarn_review_interval_days'
        return null
    }

    const handleSaveFailure = (message: string, field?: string | null) => {
        setSaveError(message)
        setDirty(true)
        if (field) {
            openDisclosureForField(field)
            focusInvalidField(field)
        }
        toast.error(message)
    }

    const handleSave = async () => {
        const { payload, validation, issues } = getSaveValidation()
        const firstIssue = issues[0]
        if (firstIssue) {
            handleSaveFailure(firstIssue.message, firstIssue.field)
            return
        }
        if (validation.warnings?.[0]) openDisclosureForField(validation.warnings[0].field)

        setSaveError(null)
        setSaving(true)
        try {
            const res = await upsertFactoryCostProfile({
                ...payload,
                requireCapacity: false,
                expectedUpdatedAt: lastSavedAt ?? undefined,
            })
            if (res.success) {
                setLastSavedAt(res.updatedAt ?? lastSavedAt)
                if (lastSavedOverheadMode !== overheadMode) {
                    void trackPlanEvent(overheadMode === 'direct'
                        ? 'overhead_source_changed_to_manual'
                        : 'overhead_source_changed_to_monthly')
                }
                setLastSavedOverheadMode(overheadMode)
                setDirty(false)
                setNonOverheadDirty(false)
                setHasMeaningfulBaseline(true)
                toast.success('Saved for new cost estimates')
            } else {
                const message = userFacingError(res.error, 'Factory costing defaults could not be saved. Try again.')
                handleSaveFailure(message, inferServerValidationField(message))
            }
        } catch (error) {
            handleSaveFailure(userFacingError(error, 'The defaults could not be saved. Your changes are still here — try again.'))
        } finally {
            setSaving(false)
        }
    }

    const updateRate = (field: keyof typeof rates) => (v: number) => {
        markDirty()
        setRates(prev => ({ ...prev, [field]: v }))
    }

    const updateSection = (field: keyof FactorySections) => (v: boolean) => {
        markDirty()
        const next = { ...sections, [field]: v }
        setSections(next)
        setActivePreset(current => current === 'custom' ? 'custom' : getMatchingFactoryProfileId(next) ?? 'custom')
        if (v) setOptionalOpen(current => ({ ...current, [field]: true }))
    }

    const handleApplyMonthlyOverhead = async ({
        expenses,
        standardMonthlyProductionMetres,
    }: {
        expenses: OverheadItem[]
        standardMonthlyProductionMetres: number
        derivedOverheadPerMetre: number
    }): Promise<{ success: true } | { success: false; error: string }> => {
        if (!lastSavedAt) {
            return { success: false, error: tx('The factory baseline is not ready. Refresh and try again.') }
        }

        try {
            const res = await applyMonthlyDerivedOverhead({
                expenses,
                standardMonthlyProductionMetres,
                expectedUpdatedAt: lastSavedAt,
            })
            if (!res.success) {
                return { success: false, error: userFacingError(res.error, 'The overhead could not be applied. Try again.') }
            }

            const sourceChanged = lastSavedOverheadMode !== 'monthly_expenses'
            setOverheadItems(res.expenses ?? expenses)
            setMonthlyOutputM(standardMonthlyProductionMetres)
            setOverheadMode('monthly_expenses')
            setLastSavedOverheadMode('monthly_expenses')
            setLastSavedAt(res.updatedAt ?? lastSavedAt)
            setHasMeaningfulBaseline(true)
            setDirty(nonOverheadDirty)
            setSaveError(null)
            void trackPlanEvent('monthly_overhead_config_saved')
            void trackPlanEvent('derived_overhead_applied')
            if (sourceChanged) void trackPlanEvent('overhead_source_changed_to_monthly')
            toast.success(tx('Recommended overhead applied to new and repriced costings'))
            return { success: true }
        } catch (error) {
            return { success: false, error: userFacingError(error, 'The overhead could not be applied. Try again.') }
        }
    }

    const selectedPreset = FACTORY_COST_PRESETS.find(preset => preset.id === activePreset)
        ?? FACTORY_COST_PRESETS.find(preset => preset.id === 'custom')
    const monthlyExpenseTotal = getMonthlyOverheadTotal(overheadItems)
    const derivedOverheadPerM = deriveCostingOverheadPerMetre(overheadItems, monthlyOutputM)
    const currentOverheadPerM = overheadMode === 'monthly_expenses'
        ? derivedOverheadPerM ?? 0
        : directOverheadPerM
    const hasSavedMonthlyConfiguration = monthlyOutputM > 0 && derivedOverheadPerM != null
    const enabledOptionalSections = (Object.values(sections) as boolean[]).filter(Boolean).length
    const overheadSummary = overheadMode === 'direct'
        ? `${tx('Direct factory cost')} · ${formatIndianMoney(directOverheadPerM, 2)}/${tx('m')}`
        : `${tx('Monthly expenses')} ÷ ${tx('standard production')} · ${monthlyOutputM.toLocaleString('en-IN')} ${tx('m/mo')}`
    const outputBasisSummary = overheadMode === 'monthly_expenses'
        ? `${monthlyOutputM.toLocaleString('en-IN')} ${tx('m/mo')}`
        : tx('Not used with direct overhead')
    const expenseBasisSummary = overheadMode === 'monthly_expenses'
        ? `${formatIndianMoney(monthlyExpenseTotal)}/${tx('mo')}`
        : tx('Direct ₹/m rate')
    const capacityReferenceConfigured = loomCount > 0 && monthlyWorkingDays > 0 && avgOutputPerLoomPerDay > 0
    const capacitySummary = capacityReferenceConfigured
        ? `${loomCount} ${tx('looms')} · ${monthlyWorkingDays} ${tx('days/mo')} · ${avgOutputPerLoomPerDay} ${tx('m/day')}`
        : tx('Optional · used only for capacity warnings')
    const activeOptionalSummary = [
        sections.winding ? `${tx('Winding')} ₹${rates.winding_rate_per_kg.toFixed(2)}/kg` : null,
        sections.processing ? `${tx('Processing')} ₹${rates.default_processing_rate_per_m.toFixed(2)}/${tx('m')}` : null,
        sections.finishing ? `${tx('Finishing')} ₹${rates.default_finishing_rate_per_m.toFixed(2)}/${tx('m')}` : null,
        sections.commission ? `${tx('Commission')} ${rates.default_commission_pct.toFixed(2)}%` : null,
        sections.transport ? `${tx('Transport')} ₹${rates.default_transport_per_m.toFixed(2)}/${tx('m')}` : null,
    ].filter((value): value is string => Boolean(value))

    if (loading) {
        return (
            <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
                <CardContent className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-saffron" />
                </CardContent>
            </Card>
        )
    }

    if (loadError) {
        return (
            <Card role="alert" className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
                <CardContent className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                        <div className="space-y-1">
                            <p className="text-sm font-semibold text-ink">{tx(standaloneEstimator ? 'Cost Estimate Defaults are unavailable' : 'Factory Cost Profile is unavailable')}</p>
                            <p className="text-sm leading-relaxed text-muted-foreground">{loadError}</p>
                        </div>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void loadProfile()}>
                        <RefreshCw className="h-3.5 w-3.5" />
                        {tx('Retry')}
                    </Button>
                </CardContent>
            </Card>
        )
    }

    return (
        <>
        <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
            <CardHeader className="gap-2 border-b border-hairline/70 pb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-saffron" />
                    <CardTitle className="text-base">{tx(standaloneEstimator ? 'Cost Estimate Defaults' : 'Factory Cost Profile')}</CardTitle>
                </div>
                <CardDescription>
                    {tx(standaloneEstimator
                        ? 'Defaults apply only to new Cost Estimates. Saved Costings keep the rates and assumptions captured when they were saved.'
                        : 'Set the defaults used when you create a new cost estimate. Changing these defaults does not update saved costings or previous versions. Existing saved costings keep the numbers captured when they were saved.')}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-5">

                {!standaloneEstimator && (
                    <div className="rounded-lg border border-hairline bg-canvas/45 p-4">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)] sm:items-end">
                            <div className="space-y-1.5">
                                <Label htmlFor="factory-setup" className="text-sm font-semibold text-body">{tx('Factory setup')}</Label>
                                <select
                                    id="factory-setup"
                                    value={activePreset ?? 'custom'}
                                    onChange={event => {
                                        const preset = FACTORY_COST_PRESETS.find(candidate => candidate.id === event.target.value)
                                        if (preset) applyPreset(preset)
                                    }}
                                    className="h-10 w-full rounded-md border border-hairline bg-surface px-3 text-sm font-medium text-ink"
                                >
                                    {FACTORY_COST_PRESETS.map(preset => (
                                        <option key={preset.id} value={preset.id}>
                                            {tx(preset.label)}{preset.recommended ? ` — ${tx('Recommended')}` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{tx('Starting point only')}</p>
                                <p className="mt-1 text-sm leading-relaxed text-body">{tx(selectedPreset?.description ?? 'Choose the optional charges your factory uses. You can change the amounts below.')}</p>
                            </div>
                        </div>
                        <p className="mt-3 rounded-lg border border-info/20 bg-info-soft/55 px-3 py-2 text-xs leading-relaxed text-info">
                            {tx(dirty ? 'Changes are staged here and are not saved yet.' : 'Only an explicit save changes defaults for future Cost Estimates.')}
                        </p>
                    </div>
                )}

                <details
                    open={coreOpen}
                    onToggle={event => setCoreOpen(event.currentTarget.open)}
                    className="premium-disclosure-card group overflow-hidden rounded-lg border border-hairline bg-surface/95"
                >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <Calculator className="h-4 w-4 text-saffron" />
                                <h3 className="text-sm font-semibold text-ink">{tx('Core costing defaults')}</h3>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tx('The few inputs that make a new estimate trustworthy: yarn preparation, factory expenses, and target margin.')}</p>
                            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-hairline/60 pt-3 text-left sm:grid-cols-4">
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{tx('Output basis')}</p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-ink">{outputBasisSummary}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{tx('Expense basis')}</p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-ink">{expenseBasisSummary}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{tx('Overhead')}</p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-ink">{overheadMode === 'direct' ? `${formatIndianMoney(directOverheadPerM, 2)}/${tx('m')}` : tx('Monthly expenses')}</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Target margin</p>
                                    <p className="mt-0.5 truncate text-xs font-semibold text-ink">{rates.default_margin_pct.toFixed(2)}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-right">
                            <span className="text-xs font-semibold text-saffron-deep">{hasMeaningfulBaseline ? tx('Edit defaults') : tx('Set up defaults')}</span>
                            <span className="hidden text-xs font-medium text-muted-foreground sm:inline">{overheadSummary}</span>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
                        </div>
                    </summary>

                    <div className="premium-disclosure-content space-y-6 border-t border-hairline/70 px-4 pb-5 pt-5 sm:px-5">
                        {/* ── Pre-Weaving Rates ── */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                                <Zap className="h-4 w-4 text-warning" />
                                <Label className="text-sm font-semibold text-body">{tx(standaloneEstimator ? 'Warp preparation' : 'Pre-Weaving Rates')}</Label>
                            </div>
                            <p className="text-xs text-muted-foreground">{tx(standaloneEstimator ? 'Warping and outsourced sizing charges per kg of warp yarn. The estimator converts them to ₹/m from total warp kg.' : 'Charged per kg of warp yarn by the warping/sizing unit. The estimator auto-computes the ₹/m cost from total warp KG.')}</p>
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                                <RateInput
                                    id="factory-warping-rate"
                                    field="warping_rate_per_kg"
                                    label="Warping Rate"
                                    value={rates.warping_rate_per_kg}
                                    onChange={updateRate('warping_rate_per_kg')}
                                    unit="₹/kg"
                                    step={0.25}
                                    icon={Zap}
                                />
                                <RateInput
                                    id="factory-sizing-rate"
                                    field="sizing_rate_per_kg"
                                    label="Sizing Rate"
                                    value={rates.sizing_rate_per_kg}
                                    onChange={updateRate('sizing_rate_per_kg')}
                                    unit="₹/kg"
                                    step={0.25}
                                />
                            </div>
                        </div>

                        {/* ── Current Costing Overhead ── */}
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                                <Calculator className="h-4 w-4 text-info" />
                                <Label className="text-sm font-semibold text-body">{tx('Current Costing Overhead')}</Label>
                            </div>
                            <div className="rounded-xl border border-hairline bg-canvas/45 p-4">
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                                    <div className="min-w-0 flex-1">
                                        <RateInput
                                            id="factory-direct-overhead"
                                            field="overhead_override_per_m"
                                            label="Manual Overhead"
                                            value={currentOverheadPerM}
                                            displayValue={overheadMode === 'monthly_expenses' ? Number(currentOverheadPerM.toFixed(2)) : undefined}
                                            onChange={value => {
                                                markDirty('overhead')
                                                setDirectOverheadPerM(value)
                                                setOverheadMode('direct')
                                            }}
                                            unit="₹/m"
                                            step={0.01}
                                            hint={overheadMode === 'monthly_expenses'
                                                ? 'Derived from monthly expenses. Editing this value switches the source to Manual.'
                                                : 'Enter the working overhead rate to use in new and repriced costings.'}
                                            icon={Calculator}
                                        />
                                    </div>
                                    <span className={cn(
                                        'w-fit rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
                                        overheadMode === 'monthly_expenses'
                                            ? 'bg-info-soft text-info'
                                            : 'bg-surface text-muted-foreground',
                                    )}>
                                        {tx(overheadMode === 'monthly_expenses' ? 'Derived from monthly expenses' : 'Manual')}
                                    </span>
                                </div>
                                {overheadMode === 'monthly_expenses' && (
                                    <p className="mt-3 text-xs text-body">
                                        {`${formatIndianMoney(monthlyExpenseTotal)} ${tx('monthly overhead')} / ${monthlyOutputM.toLocaleString('en-IN')} ${tx('m')} ${tx('standard production')}`}
                                    </p>
                                )}
                                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-hairline pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="gap-2"
                                        onClick={() => {
                                            setMonthlyCalculatorOpen(true)
                                            void trackPlanEvent('monthly_overhead_modal_opened')
                                        }}
                                    >
                                        <Calculator className="h-4 w-4" /> {tx(overheadMode === 'monthly_expenses'
                                            ? 'Edit Monthly Overhead'
                                            : hasSavedMonthlyConfiguration
                                                ? 'Use Monthly Overhead'
                                                : 'Calculate from Monthly Overhead')}
                                    </Button>
                                    {overheadMode === 'monthly_expenses' && (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                markDirty('overhead')
                                                setDirectOverheadPerM(currentOverheadPerM)
                                                setOverheadMode('direct')
                                            }}
                                        >
                                            {tx('Switch to Manual Overhead')}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            <details
                                open={capacityOpen}
                                onToggle={event => setCapacityOpen(event.currentTarget.open)}
                                className="premium-disclosure-card group rounded-lg border border-hairline bg-surface px-3 py-2.5"
                            >
                                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-semibold text-body outline-none focus-visible:ring-2 focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden">
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2">
                                            <span>{tx('Capacity reference')}</span>
                                            {standaloneEstimator && <span className="rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{tx('Optional')}</span>}
                                        </span>
                                        {standaloneEstimator && <span className="mt-1 block text-[11px] font-normal leading-relaxed text-muted-foreground">{capacitySummary}</span>}
                                    </span>
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-180 motion-reduce:transition-none" />
                                </summary>
                                <div className="premium-disclosure-content mt-3 grid grid-cols-1 gap-4 border-t border-hairline/70 pt-3 sm:grid-cols-3">
                                    <RateInput id="factory-loom-count" field="loom_count" label="Active looms" value={loomCount} onChange={value => { markDirty(); setLoomCount(value) }} unit="looms" step={1} />
                                    <RateInput id="factory-working-days" field="monthly_working_days" label="Working days" value={monthlyWorkingDays} onChange={value => { markDirty(); setMonthlyWorkingDays(value) }} unit="days/mo" step={1} />
                                    <RateInput id="factory-output-per-loom" field="avg_output_per_loom_per_day" label="Average output per loom" value={avgOutputPerLoomPerDay} onChange={value => { markDirty(); setAvgOutputPerLoomPerDay(value) }} unit="m/day" step={1} hint="Reference for capacity warnings only; standard monthly production is the costing denominator." />
                                </div>
                            </details>
                        </div>

                        {/* ── Selling Defaults ── */}
                        <div className="space-y-3 rounded-lg border border-hairline bg-canvas/45 p-4">
                            <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                                <TrendingUp className="h-4 w-4 text-success" />
                                <Label className="text-sm font-semibold text-body">{tx('Pricing default')}</Label>
                            </div>
                            <div className="max-w-xs">
                                <RateInput
                                    id="factory-target-margin"
                                    field="default_margin_pct"
                                    label={standaloneEstimator ? 'Target margin (% of selling price)' : 'Target Margin'}
                                    value={rates.default_margin_pct}
                                    onChange={updateRate('default_margin_pct')}
                                    unit="%"
                                    step={0.5}
                                    hint="Pre-fills the suggested selling price. You can adjust it in each cost estimate."
                                    icon={TrendingUp}
                                />
                            </div>
                        </div>
                    </div>
                </details>

                <details
                    open={standaloneEstimator ? optionalGroupOpen : true}
                    onToggle={event => {
                        if (standaloneEstimator) setOptionalGroupOpen(event.currentTarget.open)
                    }}
                    className={cn(standaloneEstimator && 'premium-disclosure-card group overflow-hidden rounded-lg border border-hairline bg-canvas/35')}
                >
                    <summary className={cn(
                        'flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden',
                        !standaloneEstimator && 'hidden',
                    )}>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-ink">{tx('Optional costing assumptions')}</span>
                                <span className="shrink-0 rounded-full bg-canvas px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                                    {enabledOptionalSections ? `${enabledOptionalSections} ${tx('enabled')}` : tx('None enabled')}
                                </span>
                            </div>
                            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
                                {activeOptionalSummary.length > 0
                                    ? `${tx('Active:')} ${activeOptionalSummary.join(' · ')}`
                                    : tx('Add winding, processing, finishing, commission, or transport only when it applies.')}
                            </p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className={cn(
                        standaloneEstimator
                            ? 'premium-disclosure-content border-t border-hairline/70 px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4'
                            : 'space-y-4',
                    )}>
                    {!standaloneEstimator && (
                        <div className="space-y-2 rounded-lg border border-hairline bg-canvas/35 p-3">
                            <div className="flex items-center justify-between gap-3">
                                <div>
                            <p className="text-sm font-semibold text-ink">{tx('Optional costing assumptions')}</p>
                            <p className="text-xs leading-relaxed text-muted-foreground">{tx('Enable only the charges your factory uses. Each assumption opens its own focused disclosure.')}</p>
                                </div>
                                <span className="shrink-0 text-xs font-semibold text-muted-foreground">{enabledOptionalSections ? `${enabledOptionalSections} ${tx('enabled')}` : tx('None enabled')}</span>
                            </div>
                            {activeOptionalSummary.length > 0 && (
                                <p className="text-xs leading-relaxed text-body">{tx('Active:')} {activeOptionalSummary.join(' · ')}</p>
                            )}
                        </div>
                    )}
                    <div className={cn(
                        standaloneEstimator ? 'grid grid-cols-1 gap-3 md:grid-cols-2' : 'space-y-4',
                    )}>
                <OptionalAssumptionDisclosure
                    title="Winding"
                    summary={`₹${rates.winding_rate_per_kg.toFixed(2)}/kg · applies to total yarn`}
                    description="Yarn arrives on hanks and needs rewinding onto cones before warping."
                    enabled={sections.winding}
                    open={optionalOpen.winding}
                    onOpenChange={open => setOptionalOpen(current => ({ ...current, winding: open }))}
                    onEnabledChange={updateSection('winding')}
                >
                    <RateInput
                        id="factory-winding-rate"
                        field="winding_rate_per_kg"
                        label="Winding Rate"
                        value={rates.winding_rate_per_kg}
                        onChange={updateRate('winding_rate_per_kg')}
                        unit="₹/kg"
                        step={0.25}
                        hint="Applies to total yarn (warp + weft)."
                        icon={Wind}
                    />
                </OptionalAssumptionDisclosure>

                <OptionalAssumptionDisclosure
                    title="Processing / Dyeing"
                    summary={`₹${rates.default_processing_rate_per_m.toFixed(2)}/m`}
                    description="Fabric is sent for dyeing or printing after weaving."
                    enabled={sections.processing}
                    open={optionalOpen.processing}
                    onOpenChange={open => setOptionalOpen(current => ({ ...current, processing: open }))}
                    onEnabledChange={updateSection('processing')}
                >
                    <RateInput
                        id="factory-processing-rate"
                        field="default_processing_rate_per_m"
                        label="Processing / Dyeing"
                        value={rates.default_processing_rate_per_m}
                        onChange={updateRate('default_processing_rate_per_m')}
                        unit="₹/m"
                        step={0.1}
                    />
                </OptionalAssumptionDisclosure>

                <OptionalAssumptionDisclosure
                    title="Finishing"
                    summary={`₹${rates.default_finishing_rate_per_m.toFixed(2)}/m`}
                    description="Calendering, heat-setting, or other post-processing."
                    enabled={sections.finishing}
                    open={optionalOpen.finishing}
                    onOpenChange={open => setOptionalOpen(current => ({ ...current, finishing: open }))}
                    onEnabledChange={updateSection('finishing')}
                >
                    <RateInput
                        id="factory-finishing-rate"
                        field="default_finishing_rate_per_m"
                        label="Finishing"
                        value={rates.default_finishing_rate_per_m}
                        onChange={updateRate('default_finishing_rate_per_m')}
                        unit="₹/m"
                        step={0.1}
                    />
                </OptionalAssumptionDisclosure>

                <OptionalAssumptionDisclosure
                    title="Broker commission"
                    summary={`${rates.default_commission_pct.toFixed(2)}%`}
                    description={standaloneEstimator ? 'Broker or agent commission included in the final price.' : 'Broker or agent commission included in the buyer quote.'}
                    enabled={sections.commission}
                    open={optionalOpen.commission}
                    onOpenChange={open => setOptionalOpen(current => ({ ...current, commission: open }))}
                    onEnabledChange={updateSection('commission')}
                >
                    <RateInput
                        id="factory-commission-rate"
                        field="default_commission_pct"
                        label="Broker commission"
                        value={rates.default_commission_pct}
                        onChange={updateRate('default_commission_pct')}
                        unit="%"
                        step={0.5}
                        hint="Broker/agent commission %."
                        icon={Users2}
                    />
                </OptionalAssumptionDisclosure>

                <OptionalAssumptionDisclosure
                    title="Transport charge"
                    summary={`₹${rates.default_transport_per_m.toFixed(2)}/m`}
                    description={standaloneEstimator ? 'Include delivery cost in the costing when transport applies.' : 'Factory delivers fabric directly rather than buyer collecting.'}
                    enabled={sections.transport}
                    open={optionalOpen.transport}
                    onOpenChange={open => setOptionalOpen(current => ({ ...current, transport: open }))}
                    onEnabledChange={updateSection('transport')}
                >
                    <RateInput
                        id="factory-transport-rate"
                        field="default_transport_per_m"
                        label="Transport charge"
                        value={rates.default_transport_per_m}
                        onChange={updateRate('default_transport_per_m')}
                        unit="₹/m"
                        step={0.1}
                        hint="Delivery cost per metre."
                        icon={Truck}
                    />
                </OptionalAssumptionDisclosure>

                <details
                    open={optionalOpen.review}
                    onToggle={event => setOptionalOpen(current => ({ ...current, review: event.currentTarget.open }))}
                    className={cn(
                        'premium-disclosure-card group overflow-hidden rounded-lg border border-hairline bg-surface/95',
                        standaloneEstimator && 'md:col-span-2',
                    )}
                >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-saffron/40 [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                            <span className="text-sm font-semibold text-ink">Review cadence</span>
                            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Review yarn rates every {rates.yarn_review_interval_days} days.</p>
                        </div>
                        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
                    </summary>
                    <div className="premium-disclosure-content border-t border-hairline/70 px-4 pb-4 pt-4">
                        <div className="max-w-md space-y-1.5">
                            <Label htmlFor="factory-yarn-review-period" className="text-xs font-semibold text-body">Review yarn rates every</Label>
                            <select
                                id="factory-yarn-review-period"
                                data-factory-field="yarn_review_interval_days"
                                value={rates.yarn_review_interval_days}
                                onChange={event => updateRate('yarn_review_interval_days')(parseNumericInput(event.target.value, { min: 1 }) ?? 1)}
                                className="h-10 w-full rounded-md border border-hairline bg-canvas/80 px-3 text-sm font-medium text-ink"
                            >
                                <option value={30}>30 days</option>
                                <option value={60}>60 days</option>
                                <option value={90}>3 months</option>
                                <option value={180}>6 months</option>
                                <option value={365}>12 months</option>
                            </select>
                            <p className="text-[11px] text-muted-foreground">This cadence applies to all active yarns. The Yarn Rate Book will flag rates as they approach review.</p>
                        </div>
                    </div>
                </details>
                    </div>
                    </div>
                </details>

                {saveError && (
                    <div role="alert" className="rounded-lg border border-risk/25 bg-risk/5 px-3 py-2.5 text-sm leading-relaxed text-risk">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{saveError}</span>
                        </div>
                    </div>
                )}

                <div className="flex flex-col gap-3 border-t border-hairline/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-h-5 items-center gap-2 text-xs" aria-live="polite">
                        {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-saffron" /> <span className="text-muted-foreground">Saving…</span></> : dirty || saveError ? <><AlertCircle className="h-3.5 w-3.5 text-warning" /> <span className="text-warning-foreground">Changes not saved</span></> : lastSavedAt && hasMeaningfulBaseline ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> <span className="text-success">Saved for new cost estimates</span></> : <span className="text-muted-foreground">Not saved yet</span>}
                    </div>
                    <Button
                        variant="saffron"
                        className="w-full gap-2 sm:w-auto"
                        onClick={handleSave}
                        disabled={saving}
                        aria-busy={saving}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save for new Cost Estimates
                    </Button>
                </div>
            </CardContent>
        </Card>
        {monthlyCalculatorOpen && (
            <MonthlyOverheadCalculator
                open
                onOpenChange={setMonthlyCalculatorOpen}
                savedItems={overheadItems}
                salaryStaff={salaryStaff}
                savedStandardProductionMetres={monthlyOutputM}
                currentOverheadPerMetre={currentOverheadPerM}
                initialView={overheadMode === 'direct' && hasSavedMonthlyConfiguration ? 'summary' : 'edit'}
                onApply={handleApplyMonthlyOverhead}
            />
        )}
        <ConfirmActionDialog
            open={Boolean(presetToReplace)}
            onOpenChange={open => { if (!open) setPresetToReplace(null) }}
            title="Replace staged defaults?"
            description={presetToReplace
                ? `Your unsaved setup will be replaced with the ${presetToReplace.label} preset. Saved Costings and the currently saved factory defaults will not change.`
                : ''}
            confirmLabel="Replace staged defaults"
            onConfirm={() => {
                if (presetToReplace) applyPresetImmediately(presetToReplace)
                setPresetToReplace(null)
            }}
        />
        </>
    )
}
