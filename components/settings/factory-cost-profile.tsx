'use client'

import { useState, useEffect, useId } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Zap, Calculator, Building2, Plus, Trash2, TrendingUp, Truck, Users2, Wind, Sparkles } from 'lucide-react'
import { getFactoryCostProfile, upsertFactoryCostProfile } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from '@/lib/app-notifications'
import { DEFAULT_OVERHEAD_ITEMS, ensureOverheadIntegrity, type FactorySections, type OverheadItem, type OverheadMode } from '@/lib/estimator'
import { cn } from '@/lib/utils'
import { parseNonNegativeInput, parseNumericInput } from '@/lib/numeric-input'
import { nanoid } from 'nanoid'

// ─── Factory type presets ─────────────────────────────────────────────────────

interface FactoryPreset {
    id:          string
    label:       string
    description: string
    emoji:       string
    sections:    FactorySections
}

const FACTORY_PRESETS: FactoryPreset[] = [
    {
        id:          'grey_weaver',
        label:       'Grey Weaver',
        description: 'Grey fabric weaving only; no dyeing or finishing.',
        emoji:       '🧶',
        sections:    { winding: false, processing: false, finishing: false, commission: true, transport: false },
    },
    {
        id:          'processed_fabric',
        label:       'Processed / Dyed',
        description: 'Weaves and arranges dyeing or printing before delivery.',
        emoji:       '🎨',
        sections:    { winding: false, processing: true, finishing: true, commission: true, transport: false },
    },
    {
        id:          'job_weaver',
        label:       'Job Weaver',
        description: 'Weaves on job-work basis. Yarn arrives on hanks — winding needed.',
        emoji:       '🔧',
        sections:    { winding: true, processing: false, finishing: false, commission: false, transport: false },
    },
    {
        id:          'full_mill',
        label:       'Full Integrated Mill',
        description: 'End-to-end production including dyeing, finishing, and delivery.',
        emoji:       '🏭',
        sections:    { winding: true, processing: true, finishing: true, commission: true, transport: true },
    },
]

function matchingPresetId(sections: FactorySections): string | null {
    const match = FACTORY_PRESETS.find(preset =>
        (Object.keys(preset.sections) as Array<keyof FactorySections>)
            .every(section => preset.sections[section] === sections[section]),
    )
    return match?.id ?? null
}

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

    return (
        <div className="space-y-1.5">
            <Label htmlFor={inputId} className="flex items-center gap-1.5 text-xs font-semibold text-body">
                {Icon && <Icon className="h-3.5 w-3.5 text-subtle" />}
                {label}
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
                        {unit}
                    </span>
                )}
            </div>
            {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
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

    return (
        <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-lg border border-hairline bg-canvas/55 px-4 py-3">
            <div className="min-w-0">
                <Label htmlFor={switchId} className="text-sm font-semibold text-ink">{label}</Label>
                <p id={descriptionId} className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
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
    const [loading, setLoading]   = useState(true)
    const [saving, setSaving]     = useState(false)
    const [activePreset, setActivePreset] = useState<string | null>(null)

    const [rates, setRates] = useState({
        warping_rate_per_kg:     2.00,
        sizing_rate_per_kg:      1.50,
        winding_rate_per_kg:     0,
        default_commission_pct:  2.00,
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
        commission: true,
        transport:  false,
    })
    const [overheadMode, setOverheadMode] = useState<OverheadMode>('monthly_expenses')
    const [directOverheadPerM, setDirectOverheadPerM] = useState(0)
    const [overheadItems, setOverheadItems] = useState<OverheadItem[]>(() => ensureOverheadIntegrity(
        DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() })),
    ))
    const [monthlyOutputM, setMonthlyOutputM] = useState(10000)
    const [loomCount, setLoomCount] = useState(0)
    const [monthlyWorkingDays, setMonthlyWorkingDays] = useState(26)
    const [avgOutputPerLoomPerDay, setAvgOutputPerLoomPerDay] = useState(50)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const res = await getFactoryCostProfile()
            if (res.data) {
                const d = res.data
                setRates({
                    warping_rate_per_kg:     Number(d.warping_rate_per_kg    ?? 2.00),
                    sizing_rate_per_kg:      Number(d.sizing_rate_per_kg     ?? 1.50),
                    winding_rate_per_kg:     Number(d.winding_rate_per_kg    ?? 0),
                    default_commission_pct:  Number(d.default_commission_pct ?? 2.00),
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
                setMonthlyOutputM(Number(d.monthly_output_m ?? 10000))
                setLoomCount(Number(d.loom_count ?? 0))
                setMonthlyWorkingDays(Number(d.monthly_working_days ?? 26))
                setAvgOutputPerLoomPerDay(Number(d.avg_output_per_loom_per_day ?? 50))
                if (d.enabled_sections) {
                    const loadedSections = d.enabled_sections as FactorySections
                    setSections(loadedSections)
                    setActivePreset(matchingPresetId(loadedSections))
                }
            }
            setLoading(false)
        }
        load()
    }, [])

    const applyPreset = (preset: FactoryPreset) => {
        setActivePreset(preset.id)
        setSections({ ...preset.sections })
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
        setSaving(true)
        const res = await upsertFactoryCostProfile({
            ...rates,
            overhead_mode: overheadMode,
            enabled_sections: sections,
            overhead_items: overheadItems,
            monthly_output_m: monthlyOutputM,
            overhead_override_per_m: overheadMode === 'direct' ? directOverheadPerM : null,
            loom_count: loomCount,
            monthly_working_days: monthlyWorkingDays,
            avg_output_per_loom_per_day: avgOutputPerLoomPerDay,
        })
        if (res.success) {
            toast.success(standaloneEstimator ? 'Estimator defaults saved' : 'Factory cost profile saved')
        } else {
            toast.error(res.error ?? 'Failed to save profile')
        }
        setSaving(false)
    }

    const updateRate = (field: keyof typeof rates) => (v: number) =>
        setRates(prev => ({ ...prev, [field]: v }))

    const updateSection = (field: keyof FactorySections) => (v: boolean) =>
        setSections(prev => ({ ...prev, [field]: v }))

    const updateOverheadItem = (id: string, field: 'label' | 'monthlyAmount', value: string | number) => {
        setOverheadItems(items => items.map(item => item.id === id ? { ...item, [field]: value } : item))
    }

    const addOverheadItem = () => {
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

    return (
        <Card className={cn("rounded-lg border-hairline bg-surface/95 shadow-[var(--shadow-card)]", className)}>
            <CardHeader className="gap-2 border-b border-hairline/70 pb-4">
                <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-saffron" />
                    <CardTitle className="text-base">{standaloneEstimator ? 'Cost Estimate Defaults' : 'Factory Cost Profile'}</CardTitle>
                </div>
                <CardDescription>
                    {standaloneEstimator
                        ? 'Default rates and costing sections that pre-fill every new costing.'
                        : 'Default rates that pre-fill every new estimate. Change them once here, all new quotes pick up the new values automatically.'}
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">

                {/* ── Factory Type Presets ── */}
                <div className="space-y-3">
                    <div>
                        <Label className="text-sm font-semibold text-body">{standaloneEstimator ? 'Cost Estimate Profile' : 'Factory Type'}</Label>
                        <p className="mt-1 text-xs text-muted-foreground">{standaloneEstimator ? 'Choose the closest costing profile, then fine-tune the enabled charges below.' : 'Select your factory type to configure which cost sections apply. Fine-tune with the toggles below.'}</p>
                    </div>
                    <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                        {FACTORY_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyPreset(preset)}
                                className={`min-h-[112px] rounded-lg border p-3.5 text-left transition-all duration-150 ${
                                    activePreset === preset.id
                                        ? 'border-saffron bg-saffron-soft/65 shadow-sm ring-2 ring-saffron/15'
                                        : 'border-hairline bg-canvas/55 hover:border-hairline-strong hover:bg-surface'
                                }`}
                            >
                                <div className="text-xl mb-1">{preset.emoji}</div>
                                <div className="text-sm font-semibold text-ink">{preset.label}</div>
                                <div className="mt-0.5 text-xs leading-snug text-muted-foreground">{preset.description}</div>
                            </button>
                        ))}
                    </div>
                    {activePreset === 'grey_weaver' && (
                        <p className="rounded-lg border border-saffron/20 bg-saffron-soft/25 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
                            Grey Weaver keeps the estimator focused on yarn, weaving, overhead, and selling cost. Dyeing and finishing remain off unless you enable them below.
                        </p>
                    )}
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
                        <Label className="text-sm font-semibold text-body">Factory Overhead</Label>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Choose once how your unit recovers fixed costs. This method and the values below pre-fill every new costing; a single costing can still be edited without changing these defaults.
                    </p>

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                        <button
                            type="button"
                            aria-pressed={overheadMode === 'direct'}
                            onClick={() => setOverheadMode('direct')}
                            className={cn(
                                'rounded-lg border px-4 py-3 text-left transition-colors',
                                overheadMode === 'direct'
                                    ? 'border-saffron bg-saffron-soft/55 ring-2 ring-saffron/15'
                                    : 'border-hairline bg-canvas/55 hover:border-hairline-strong',
                            )}
                        >
                            <div className="text-sm font-semibold text-ink">Direct overhead rate</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Use the ₹/m rate you already trust.</div>
                        </button>
                        <button
                            type="button"
                            aria-pressed={overheadMode === 'monthly_expenses'}
                            onClick={() => setOverheadMode('monthly_expenses')}
                            className={cn(
                                'rounded-lg border px-4 py-3 text-left transition-colors',
                                overheadMode === 'monthly_expenses'
                                    ? 'border-saffron bg-saffron-soft/55 ring-2 ring-saffron/15'
                                    : 'border-hairline bg-canvas/55 hover:border-hairline-strong',
                            )}
                        >
                            <div className="text-sm font-semibold text-ink">Monthly expenses ÷ output</div>
                            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">Calculate ₹/m from rent, power, salaries, and actual output.</div>
                        </button>
                    </div>

                    {overheadMode === 'direct' ? (
                        <div className="rounded-lg border border-saffron/30 bg-saffron-soft/30 p-4">
                            <RateInput
                                label="Direct factory overhead"
                                value={directOverheadPerM}
                                onChange={setDirectOverheadPerM}
                                unit="₹/m"
                                step={0.1}
                                hint="Required while Direct overhead rate is selected."
                                icon={Calculator}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4 rounded-lg border border-hairline bg-canvas/45 p-4">
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <RateInput
                                    label="Actual monthly output"
                                    value={monthlyOutputM}
                                    onChange={setMonthlyOutputM}
                                    unit="m/mo"
                                    step={100}
                                    hint="Used to divide monthly expenses."
                                />
                                <RateInput
                                    label="Active looms"
                                    value={loomCount}
                                    onChange={setLoomCount}
                                    unit="looms"
                                    step={1}
                                />
                                <RateInput
                                    label="Working days"
                                    value={monthlyWorkingDays}
                                    onChange={setMonthlyWorkingDays}
                                    unit="days/mo"
                                    step={1}
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <RateInput
                                    label="Average output per loom"
                                    value={avgOutputPerLoomPerDay}
                                    onChange={setAvgOutputPerLoomPerDay}
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
                                                    value={item.label}
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
                                                    aria-label={`Remove ${item.label}`}
                                                    onClick={() => setOverheadItems(items => items.filter(candidate => candidate.id !== item.id))}
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
                                label="Commission"
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
                                label="Transport"
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
                            label="Commission"
                            description={standaloneEstimator ? 'Broker or agent commission included in the final price.' : 'Broker or agent commission included in the buyer quote.'}
                            checked={sections.commission}
                            onChange={updateSection('commission')}
                        />
                        <SectionToggle
                            label="Transport"
                            description={standaloneEstimator ? 'Include delivery cost in the costing when transport applies.' : 'Factory delivers fabric directly rather than buyer collecting.'}
                            checked={sections.transport}
                            onChange={updateSection('transport')}
                        />
                    </div>
                </div>

                <div className="flex justify-end border-t border-hairline/70 pt-5">
                    <Button
                        variant="saffron"
                        className="w-full gap-2 sm:w-auto"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {standaloneEstimator ? 'Save Estimator Defaults' : 'Save Factory Profile'}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
