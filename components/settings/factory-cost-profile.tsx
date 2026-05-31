'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Save, Zap, Percent, TrendingUp, Truck, Users2, Wind, Palette, Sparkles } from 'lucide-react'
import { getFactoryCostProfile, upsertFactoryCostProfile } from '@/app/(dashboard)/owner/estimator/actions'
import { toast } from 'sonner'
import type { FactorySections } from '@/lib/estimator'
import { cn } from '@/lib/utils'

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
        description: 'Weaves fabric and sells as-is. No dyeing or processing.',
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
    return (
        <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs font-semibold text-body">
                {Icon && <Icon className="h-3.5 w-3.5 text-subtle" />}
                {label}
            </Label>
            <div className="relative">
                <Input
                    type="number"
                    step={step}
                    min={0}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
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
    return (
        <div className="flex min-h-[72px] items-center justify-between gap-4 rounded-lg border border-hairline bg-canvas/55 px-4 py-3">
            <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FactoryCostProfile({ className }: { className?: string }) {
    const [loading, setLoading]   = useState(true)
    const [saving, setSaving]     = useState(false)
    const [activePreset, setActivePreset] = useState<string | null>(null)

    const [rates, setRates] = useState({
        warping_rate_per_kg:     2.00,
        sizing_rate_per_kg:      1.50,
        winding_rate_per_kg:     0,
        overhead_pct:            8.00,
        default_commission_pct:  2.00,
        default_transport_per_m: 0,
    })

    const [sections, setSections] = useState<FactorySections>({
        winding:    false,
        processing: false,
        finishing:  false,
        commission: true,
        transport:  false,
    })

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
                    overhead_pct:            Number(d.overhead_pct           ?? 8.00),
                    default_commission_pct:  Number(d.default_commission_pct ?? 2.00),
                    default_transport_per_m: Number(d.default_transport_per_m ?? 0),
                })
                if (d.enabled_sections) {
                    setSections(d.enabled_sections as FactorySections)
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
        setSaving(true)
        const res = await upsertFactoryCostProfile({
            ...rates,
            enabled_sections: sections,
        })
        if (res.success) {
            toast.success('Factory cost profile saved')
        } else {
            toast.error(res.error ?? 'Failed to save profile')
        }
        setSaving(false)
    }

    const updateRate = (field: keyof typeof rates) => (v: number) =>
        setRates(prev => ({ ...prev, [field]: v }))

    const updateSection = (field: keyof FactorySections) => (v: boolean) =>
        setSections(prev => ({ ...prev, [field]: v }))

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
                    <CardTitle className="text-base">Factory Cost Profile</CardTitle>
                </div>
                <CardDescription>
                    Default rates that pre-fill every new estimate. Change them once here, all new quotes pick up the new values automatically.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-5">

                {/* ── Factory Type Presets ── */}
                <div className="space-y-3">
                    <div>
                        <Label className="text-sm font-semibold text-body">Factory Type</Label>
                        <p className="mt-1 text-xs text-muted-foreground">Select your factory type to configure which cost sections apply. Fine-tune with the toggles below.</p>
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
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <Percent className="h-4 w-4 text-info" />
                        <Label className="text-sm font-semibold text-body">Overhead</Label>
                    </div>
                    <RateInput
                        label="Overhead %"
                        value={rates.overhead_pct}
                        onChange={updateRate('overhead_pct')}
                        unit="%"
                        step={0.5}
                        hint="Applied as % of direct production cost. Scales naturally with fabric complexity."
                        icon={Percent}
                    />
                </div>

                {/* ── Selling Defaults ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-hairline/70 pb-2">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <Label className="text-sm font-semibold text-body">Selling Defaults</Label>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                {/* ── Optional Section Toggles ── */}
                <div className="space-y-3">
                    <div className="mb-2 border-b border-hairline/70 pb-2">
                        <Label className="text-sm font-semibold text-body">Optional Cost Sections</Label>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Enabled sections appear in the estimator for every new quote. Disabled sections are hidden — keeping the form clean for factories that don't use them.
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
                            description="Broker or agent commission included in the buyer quote."
                            checked={sections.commission}
                            onChange={updateSection('commission')}
                        />
                        <SectionToggle
                            label="Transport"
                            description="Factory delivers fabric directly rather than buyer collecting."
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
                        Save Factory Profile
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
