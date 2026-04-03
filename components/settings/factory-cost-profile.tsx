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
            <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
                {label}
            </Label>
            <div className="relative">
                <Input
                    type="number"
                    step={step}
                    min={0}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="h-10 text-sm font-mono pr-12 bg-white border-gray-200 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/20"
                />
                {unit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {hint && <p className="text-[11px] text-gray-400">{hint}</p>}
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
        <div className="flex items-center justify-between py-2.5 border-b border-gray-100 last:border-0">
            <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function FactoryCostProfile() {
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
            <Card className="shadow-sm border-gray-200 mt-6">
                <CardContent className="flex items-center justify-center h-40">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="shadow-sm border-gray-200 mt-6">
            <CardHeader>
                <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    <CardTitle>Factory Cost Profile</CardTitle>
                </div>
                <CardDescription>
                    Default rates that pre-fill every new estimate. Change them once here, all new quotes pick up the new values automatically.
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-8">

                {/* ── Factory Type Presets ── */}
                <div className="space-y-3">
                    <Label className="text-sm font-semibold text-gray-700">Factory Type</Label>
                    <p className="text-xs text-gray-400">Select your factory type to configure which cost sections apply. Fine-tune with the toggles below.</p>
                    <div className="grid grid-cols-2 gap-2.5">
                        {FACTORY_PRESETS.map(preset => (
                            <button
                                key={preset.id}
                                onClick={() => applyPreset(preset)}
                                className={`text-left p-3.5 rounded-xl border-2 transition-all duration-150 ${
                                    activePreset === preset.id
                                        ? 'border-indigo-500 bg-indigo-50 ring-1 ring-indigo-300'
                                        : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                                }`}
                            >
                                <div className="text-xl mb-1">{preset.emoji}</div>
                                <div className="font-semibold text-sm text-gray-900">{preset.label}</div>
                                <div className="text-xs text-gray-500 mt-0.5 leading-snug">{preset.description}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Pre-Weaving Rates ── */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <Label className="text-sm font-semibold text-gray-700">Pre-Weaving Rates</Label>
                    </div>
                    <p className="text-xs text-gray-400">Charged per kg of warp yarn by the warping/sizing unit. The estimator auto-computes the ₹/m cost from total warp KG.</p>
                    <div className="grid grid-cols-2 gap-4">
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
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <Percent className="h-4 w-4 text-violet-500" />
                        <Label className="text-sm font-semibold text-gray-700">Overhead</Label>
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
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100">
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                        <Label className="text-sm font-semibold text-gray-700">Selling Defaults</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                            <p className="text-xs text-gray-400 col-span-2 italic">
                                Enable commission or transport sections below to configure selling defaults.
                            </p>
                        )}
                    </div>
                </div>

                {/* ── Optional Section Toggles ── */}
                <div className="space-y-1">
                    <div className="flex items-center gap-2 pb-1 border-b border-gray-100 mb-2">
                        <Label className="text-sm font-semibold text-gray-700">Optional Cost Sections</Label>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                        Enabled sections appear in the estimator for every new quote. Disabled sections are hidden — keeping the form clean for factories that don't use them.
                    </p>
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

                <Button
                    className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold gap-2"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save Factory Profile
                </Button>
            </CardContent>
        </Card>
    )
}
