'use client'

import { useState, useEffect, useId, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Zap, Calculator, Building2, Plus, Trash2, TrendingUp, Truck, Users2, Wind, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { getFactoryCostProfile, upsertFactoryCostProfile } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from '@/lib/app-notifications'
import { DEFAULT_FACTORY_SECTIONS, DEFAULT_OVERHEAD_ITEMS, ensureOverheadIntegrity, type FactorySections, type OverheadItem, type OverheadMode } from '@/lib/estimator'
import { cn } from '@/lib/utils'
import { userFacingError } from '@/lib/app-notifications'
import { parseNonNegativeInput, parseNumericInput } from '@/lib/numeric-input'
import { nanoid } from 'nanoid'
import { FACTORY_COST_PRESETS, getMatchingFactoryProfileId, type FactoryProfileId } from '@/lib/factory-cost-profiles'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { useTranslation } from '@/lib/i18n/context'

// ─── NumericInput helper ──────────────────────────────────────────────────────

function RateInput({
    label,
    value,
    onChange,
    unit,
    hint,
    step = 0.5,
    icon: Icon,
}: {
    label:    string
    value:    number
    onChange: (v: number) => void
    unit?:    string
    hint?:    string
    step?:    number
    icon?:    React.ElementType
}) {
    const inputId = useId()
    const { tx } = useTranslation()

    return (
        <div className="space-y-1.5">
            <Label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-semibold text-body">
                {Icon && <Icon className="h-3.5 w-3.5 text-subtle" />}
                {tx(label)}
            </Label>
            <div className="relative">
                <Input
                    id={inputId}
                    type="number"
                    step={step}
                    min={0}
                    value={value}
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

// ─── SectionToggle helper ─────────────────────────────────────────────────────

function SectionToggle({
    label,
    description,
    checked,
    onChange,
}: {
    label:       string
    description: string
    checked:     boolean
    onChange:    (v: boolean) => void
}) {
    const switchId = useId()
    const descriptionId = `${switchId}-description`
    const { tx } = useTranslation()

    return (
        <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-lg border border-hairline bg-canvas/55 px-4 py-3">
            <div className="min-w-0">
                <Label htmlFor={switchId} className="text-sm font-semibold text-ink">{tx(label)}</Label>
                <p id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{tx(description)}</p>
            </div>
            <Switch
                id={switchId}
                aria-describedby={descriptionId}
                checked={checked}
                onCheckedChange={onChange}
            />
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FactoryCostProfile({ className, standaloneEstimator = false }: { className?: string; standaloneEstimator?: boolean }) {
    const { tx } = useTranslation()
    const [loading, setLoading]   = useState(true)
    const [loadError, setLoadError] = useState<string | null>(null)
    const [saving, setSaving]     = useState(false)
    const [activePreset, setActivePreset] = useState<FactoryProfileId | null>(null)
    const [presetToReplace, setPresetToReplace] = useState<(typeof FACTORY_COST_PRESETS)[number] | null>(null)
    const [dirty, setDirty] = useState(false)
    const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)

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
            setDirectOverheadPerM(Number(d.overhead_override_per_m ?? 0))
            setOverheadItems(ensureOverheadIntegrity(
                Array.isArray(d.overhead_items) && d.overhead_items.length > 0
                    ? d.overhead_items
                    : DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() })),
            ))
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
    }, [])

    useEffect(() => {
        void loadProfile()
    }, [loadProfile])

    const applyPresetImmediately = (preset: (typeof FACTORY_COST_PRESETS)[number]) => {
        setActivePreset(preset.id)
        setSections({ ...preset.sections })
        setDirty(true)
    }

    const applyPreset = (preset: (typeof FACTORY_COST_PRESETS)[number]) => {
        if (dirty && activePreset !== preset.id) {
            setPresetToReplace(preset)
            return
        }
        applyPresetImmediately(preset)
    }

    const handleSave = async () => {
        if (overheadMode === 'direct' && directOverheadPerM <= 0) {
            toast.error('Enter a direct overhead rate greater than ₹0/m.')
            return
        }
        if (overheadMode === 'monthly_expenses' && monthlyOutputM <= 0) {
            toast.error('Enter the actual monthly output used to divide expenses.')
            return
        }
        if (overheadMode === 'monthly_expenses' && overheadItems.reduce((total, item) => total + Math.max(0, Number(item.monthlyAmount) || 0), 0) <= 0) {
            toast.error('Enter at least one monthly factory expense before saving these defaults.')
            return
        }
        setSaving(true)
        try {
            const res = await upsertFactoryCostProfile({
                ...rates,
                overhead_mode: overheadMode,
            factory_profile_key: activePreset === 'custom'
                ? 'custom'
                : getMatchingFactoryProfileId(sections) ?? activePreset ?? 'custom',
                enabled_sections: sections,
                overhead_items: overheadItems,
                monthly_output_m: monthlyOutputM,
                overhead_override_per_m: overheadMode === 'direct' ? directOverheadPerM : null,
                loom_count: loomCount,
                monthly_working_days: monthlyWorkingDays,
                avg_output_per_loom_per_day: avgOutputPerLoomPerDay,
                expectedUpdatedAt: lastSavedAt ?? undefined,
            })
            if (res.success) {
                setLastSavedAt(res.updatedAt ?? lastSavedAt)
                setDirty(false)
                toast.success('Saved for new Cost Estimates')
            } else {
                toast.error(userFacingError(res.error, 'Factory costing defaults could not be saved. Try again.'))
            }
        } catch {
            toast.error('The defaults could not be saved. Your changes are still here — try again.')
        } finally {
            setSaving(false)
        }
    }

    const updateRate = (field: keyof typeof rates) => (v: number) => {
        setDirty(true)
        setRates(prev => ({ ...prev, [field]: v }))
    }

    const updateSection = (field: keyof FactorySections) => (v: boolean) => {
        setDirty(true)
        const next = { ...sections, [field]: v }
        setSections(next)
        setActivePreset(current => current === 'custom' ? 'custom' : getMatchingFactoryProfileId(next) ?? 'custom')
    }

    const updateOverheadItem = (id: string, field: 'label' | 'monthlyAmount', value: string | number) => {
        setDirty(true)
        setOverheadItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item))
    }

    const addOverheadItem = () => {
        setDirty(true)
        setOverheadItems(items => [...items, {
            id: nanoid(),
            label: 'New monthly expense',
            monthlyAmount: 0,
            source: 'manual',
            category: 'custom',
            isPreset: false,
            isLocked: false,
        }])
    }

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
                        ? 'Defaults that pre-fill new Cost Estimates. Your current estimate stays separate.'
                        : 'Defaults for new estimates only. Existing saved costings keep the numbers captured when they were saved.')}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">

                {/* ── Factory Type Presets ── */}
                <div className="space-y-3">
                    <div>
                        <Label className="text-sm font-semibold text-body">{tx(standaloneEstimator ? 'How should Weavly start your setup?' : 'How does your factory work?')}</Label>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tx('Pick the closest starting point. It only turns optional cost sections on or off; you can fine-tune the amounts below.')}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                        {FACTORY_COST_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                type="button"
                                onClick={() => applyPreset(preset)}
                                aria-label={`${tx('Use')} ${tx(preset.label)} factory setup`}
                                className={`min-h-[112px] rounded-lg border p-3.5 text-left transition-all duration-150 ${
                                    activePreset === preset.id
                                        ? 'border-saffron bg-saffron-soft/65 shadow-sm ring-2 ring-saffron/15'
                                        : preset.recommended
                                            ? 'border-saffron/45 bg-saffron-soft/20 hover:border-saffron hover:bg-saffron-soft/40'
                                            : 'border-hairline bg-canvas/55 hover:border-hairline-strong hover:bg-surface'
                                }`}
                            >
                                <div className="text-xl mb-1">{preset.emoji}</div>
                                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                                    {tx(preset.label)}
                                    {preset.recommended && <span className="rounded-full bg-saffron-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-saffron-dark">{tx('Recommended')}</span>}
                                </div>
                                <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{tx(preset.description)}</div>
                            </button>
                        ))}
                    </div>
                    {activePreset === 'grey_weaver' && (
                        <p className="rounded-lg border border-saffron/20 bg-saffron-soft/25 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            {tx('Grey Weaver keeps the estimator focused on yarn, weaving, warping, sizing, and factory expenses. Processing, finishing, broker commission, and transport are off until you enable them.')}
                        </p>
                    )}
                    <p className="rounded-lg border border-info/20 bg-info/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                        {tx(dirty ? 'Changes are staged here and are not saved yet.' : 'Only an explicit save changes defaults for future Cost Estimates.')}
                    </p>
                </div>

                {/* ── Pre-Weaving Rates ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <Zap className="h-4 w-4 text-warning" />
                        <Label className="text-sm font-semibold text-body">Pre-Weaving Rates</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">Charged per kg of warp yarn by the warping/sizing unit. The estimator auto-computes the ₹/m cost from total warp KG.</p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                        <RateInput
                            label="Warping Rate"
                            value={rates.warping_rate_per_kg}
                            onChange={updateRate('warping_rate_per_kg')}
                            unit="₹/kg"
                            step={0.25}
                            icon={Zap}
                        />
                        <RateInput
                            label="Sizing Rate"
                            value={rates.sizing_rate_per_kg}
                            onChange={updateRate('sizing_rate_per_kg')}
                            unit="₹/kg"
                            step={0.25}
                        />
                        {sections.winding && (
                            <RateInput
                                label="Winding Rate"
                                value={rates.winding_rate_per_kg}
                                onChange={updateRate('winding_rate_per_kg')}
                                unit="₹/kg"
                                step={0.25}
                                hint="Applies to total yarn (warp + weft)"
                                icon={Wind}
                            />
                        )}
                    </div>
                </div>

                {/* ── Overhead ── */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <Calculator className="h-4 w-4 text-info" />
                        <Label className="text-sm font-semibold text-body">Factory Expenses</Label>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Choose once how your unit recovers fixed costs. This method and the values below pre-fill every new costing; a single costing can still be edited without changing these defaults.
                    </p>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <button
                            type="button"
                            aria-pressed={overheadMode === 'direct'}
                            onClick={() => { setDirty(true); setOverheadMode('direct') }}
                            className={cn(
                                'rounded-lg border px-4 py-3 text-left transition-colors',
                                overheadMode === 'direct'
                                    ? 'border-saffron bg-saffron-soft/55 ring-2 ring-saffron/15'
                                    : 'border-hairline bg-canvas/55 hover:border-hairline-strong',
                            )}
                        >
                            <div className="text-sm font-semibold text-ink">I already know my factory cost per metre</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Use a ₹/m rate you already trust; no monthly expense breakdown is needed.</div>
                        </button>
                        <button
                            type="button"
                            aria-pressed={overheadMode === 'monthly_expenses'}
                            onClick={() => { setDirty(true); setOverheadMode('monthly_expenses') }}
                            className={cn(
                                'rounded-lg border px-4 py-3 text-left transition-colors',
                                overheadMode === 'monthly_expenses'
                                    ? 'border-saffron bg-saffron-soft/55 ring-2 ring-saffron/15'
                                    : 'border-hairline bg-canvas/55 hover:border-hairline-strong',
                            )}
                        >
                            <div className="flex items-center gap-2 text-sm font-semibold text-ink"><span>Calculate from monthly expenses</span><span className="rounded-full bg-saffron-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-saffron-deep">Recommended</span></div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Weavly divides rent, power, salaries, and other monthly costs by your actual output.</div>
                        </button>
                    </div>
                    <p className="rounded-lg border border-info/20 bg-info-soft/55 px-3 py-2 text-xs leading-relaxed text-info">
                        {overheadMode === 'monthly_expenses'
                            ? 'Recommended for most factories: enter real monthly expenses and output so the per-metre cost is easy to explain.'
                            : 'Use direct ₹/m when your factory already maintains a trusted per-metre overhead rate.'}
                    </p>

                    {overheadMode === 'direct' ? (
                        <div className="rounded-lg border border-saffron/30 bg-saffron-soft/30 p-4">
                            <RateInput
                                label="Direct factory cost per metre"
                                value={directOverheadPerM}
                                onChange={value => { setDirty(true); setDirectOverheadPerM(value) }}
                                unit="₹/m"
                                step={0.1}
                                hint="Required when direct factory cost per metre is selected."
                                icon={Calculator}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 rounded-lg border border-hairline bg-canvas/45 p-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <RateInput
                                    label="Actual monthly output"
                                    value={monthlyOutputM}
                                    onChange={value => { setDirty(true); setMonthlyOutputM(value) }}
                                    unit="m/mo"
                                    step={100}
                                    hint="Used to divide monthly expenses."
                                />
                                <RateInput
                                    label="Active looms"
                                    value={loomCount}
                                    onChange={value => { setDirty(true); setLoomCount(value) }}
                                    unit="looms"
                                    step={1}
                                />
                                <RateInput
                                    label="Working days"
                                    value={monthlyWorkingDays}
                                    onChange={value => { setDirty(true); setMonthlyWorkingDays(value) }}
                                    unit="days/mo"
                                    step={1}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <RateInput
                                    label="Average output per loom"
                                    value={avgOutputPerLoomPerDay}
                                    onChange={value => { setDirty(true); setAvgOutputPerLoomPerDay(value) }}
                                    unit="m/day"
                                    step={1}
                                    hint="Capacity reference only; actual monthly output above is used for costing."
                                />
                                <div className="flex items-end rounded-lg border border-hairline bg-surface px-3 py-2.5 text-xs text-muted-foreground">
                                    <span>Monthly expenses are persistent and can be updated whenever electricity, salary, rent, or output changes.</span>
                                </div>
                                <p className="text-[11px] leading-relaxed text-muted-foreground">
                                    Preset expense names stay fixed so costings use the same categories. Locked amounts are maintained by the linked factory record.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-semibold text-ink">Monthly expenses</p>
                                        <p className="text-xs text-muted-foreground">Enter the unit&apos;s recurring factory costs.</p>
                                    </div>
                                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addOverheadItem}>
                                        <Plus className="h-3.5 w-3.5" /> Add expense
                                    </Button>
                                </div>
                                <div className="divide-y divide-hairline rounded-lg border border-hairline bg-surface">
                                    {overheadItems.map(item => (
                                        <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_96px_auto] items-center gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:gap-3">
                                            <div className="flex min-w-0 items-center gap-2">
                                                {item.category === 'rent' ? <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <Calculator className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                                                <Input
                                                    aria-label={`${item.label} expense name`}
                                                    value={item.isPreset ? tx(item.label) : item.label}
                                                    disabled={item.isPreset}
                                                    onChange={event => updateOverheadItem(item.id, 'label', event.target.value)}
                                                    className="h-8 min-w-0 border-0 bg-transparent px-0 text-sm font-medium shadow-none focus-visible:ring-0"
                                                />
                                            </div>
                                            <div className="relative">
                                                <Input
                                                    aria-label={`${item.label} monthly amount`}
                                                    type="number"
                                                    min={0}
                                                    step={100}
                                                    value={item.monthlyAmount}
                                                    disabled={item.isLocked}
                                                    onChange={event => updateOverheadItem(item.id, 'monthlyAmount', parseNonNegativeInput(event.target.value) ?? 0)}
                                                    className="h-8 pr-12 text-right font-mono text-xs"
                                                />
                                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">₹/mo</span>
                                            </div>
                                            {!item.isPreset && (
                                                <button
                                                    type="button"
                                                    aria-label={`${tx('Remove')} ${item.label}`}
                                                    onClick={() => { setDirty(true); setOverheadItems(items => items.filter(candidate => candidate.id !== item.id)) }}
                                                    className="rounded p-1 text-muted-foreground hover:bg-rose-50 hover:text-rose-600"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* ── Post-Weaving Defaults ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <Sparkles className="h-4 w-4 text-saffron" />
                        <Label className="text-sm font-semibold text-body">Post-Weaving Rates</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        {sections.processing && (
                            <RateInput
                                label="Processing / Dyeing"
                                value={rates.default_processing_rate_per_m}
                                onChange={updateRate('default_processing_rate_per_m')}
                                unit="₹/m"
                                step={0.1}
                            />
                        )}
                        {sections.finishing && (
                            <RateInput
                                label="Finishing"
                                value={rates.default_finishing_rate_per_m}
                                onChange={updateRate('default_finishing_rate_per_m')}
                                unit="₹/m"
                                step={0.1}
                            />
                        )}
                        {!sections.processing && !sections.finishing && (
                            <p className="text-xs italic text-muted-foreground">Enable processing or finishing below to configure its default rate.</p>
                        )}
                    </div>
                </div>

                {/* ── Selling Defaults ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <Label className="text-sm font-semibold text-body">Selling Defaults</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <RateInput
                            label="Target Margin"
                            value={rates.default_margin_pct}
                            onChange={updateRate('default_margin_pct')}
                            unit="%"
                            step={0.5}
                            hint="Pre-fills the suggested selling price. You can adjust it in each cost estimate."
                            icon={TrendingUp}
                        />
                        {sections.commission && (
                            <RateInput
                                label="Broker commission"
                                value={rates.default_commission_pct}
                                onChange={updateRate('default_commission_pct')}
                                unit="%"
                                step={0.5}
                                hint="Broker/agent commission %"
                                icon={Users2}
                            />
                        )}
                        {sections.transport && (
                            <RateInput
                                label="Transport charge"
                                value={rates.default_transport_per_m}
                                onChange={updateRate('default_transport_per_m')}
                                unit="₹/m"
                                step={0.1}
                                hint="Delivery cost per metre"
                                icon={Truck}
                            />
                        )}
                        {!sections.commission && !sections.transport && (
                            <p className="col-span-2 text-xs italic text-muted-foreground">
                                Enable commission or transport sections below to configure selling defaults.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Yarn Rate Reviews ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <Sparkles className="h-4 w-4 text-saffron" />
                        <Label className="text-sm font-semibold text-body">Yarn Rate Reviews</Label>
                    </div>
                    <div className="max-w-md space-y-1.5">
                        <Label htmlFor="yarn-review-period" className="text-xs font-semibold text-body">Review yarn rates every</Label>
                        <select
                            id="yarn-review-period"
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

                {/* ── Optional Section Toggles ── */}
                <div className="space-y-3">
                    <div className="mb-2 border-b border-hairline/70 pb-2">
                        <Label className="text-sm font-semibold text-body">Optional Cost Sections</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {standaloneEstimator ? 'Enabled sections appear in every new costing. Disabled sections stay out of the form.' : 'Enabled sections appear in the estimator for every new quote. Disabled sections are hidden, keeping the form clean for factories that do not use them.'}
                    </p>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
                        <SectionToggle
                            label="Winding"
                            description="Yarn arrives on hanks and needs rewinding onto cones before warping."
                            checked={sections.winding}
                            onChange={updateSection('winding')}
                        />
                        <SectionToggle
                            label="Processing / Dyeing"
                            description="Fabric is sent for dyeing or printing after weaving."
                            checked={sections.processing}
                            onChange={updateSection('processing')}
                        />
                        <SectionToggle
                            label="Finishing"
                            description="Calendering, heat-setting, or other post-processing."
                            checked={sections.finishing}
                            onChange={updateSection('finishing')}
                        />
                        <SectionToggle
                            label="Broker commission"
                            description={standaloneEstimator ? 'Broker or agent commission included in the final price.' : 'Broker or agent commission included in the buyer quote.'}
                            checked={sections.commission}
                            onChange={updateSection('commission')}
                        />
                        <SectionToggle
                            label="Transport charge"
                            description={standaloneEstimator ? 'Include delivery cost in the costing when transport applies.' : 'Factory delivers fabric directly rather than buyer collecting.'}
                            checked={sections.transport}
                            onChange={updateSection('transport')}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-hairline/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-h-5 items-center gap-2 text-xs" aria-live="polite">
                        {saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-saffron" /> <span className="text-muted-foreground">Saving for new Cost Estimates…</span></> : dirty ? <><AlertCircle className="h-3.5 w-3.5 text-warning" /> <span className="text-warning-foreground">Not saved yet</span></> : lastSavedAt ? <><CheckCircle2 className="h-3.5 w-3.5 text-success" /> <span className="text-success">Saved for new Cost Estimates</span></> : <span className="text-muted-foreground">Preview only until saved</span>}
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
