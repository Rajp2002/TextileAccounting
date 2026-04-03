'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Calculator,
    TrendingUp,
    AlertTriangle,
    Save,
    ChevronDown,
    ChevronUp,
    Package,
    Settings2,
    Loader2,
    Calendar,
    Sparkles,
    FlaskConical,
    TriangleAlert,
    Check,
    X,
    BookmarkPlus,
    ArrowRight,
    Layers,
} from 'lucide-react'
import { calculateLandedCost, runStressTests, EstimatorInputs, DEFAULT_ESTIMATOR_INPUTS } from '@/lib/estimator'
import {
    getEstimatorSettings,
    getEstimatorTemplates,
    saveEstimatorQuote,
    saveAsFabricTemplate,
    convertQuoteToOrder,
} from './actions'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'

// ─── NumericField helper ──────────────────────────────────────────────────────
function NumericField({
    label,
    value,
    onChange,
    unit,
    step = 1,
    min = 0,
    hint,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    unit?: string
    step?: number
    min?: number
    hint?: string
}) {
    return (
        <div className="space-y-1.5">
            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                {label}
            </Label>
            <div className="relative">
                <Input
                    type="number"
                    step={step}
                    min={min}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="h-12 text-base font-mono font-bold text-center pr-10 bg-slate-900 border-slate-700 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30"
                />
                {unit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 font-medium pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {hint && <p className="text-[10px] text-slate-500">{hint}</p>}
        </div>
    )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({
    title,
    icon: Icon,
    children,
    accent = 'indigo',
}: {
    title: string
    icon: React.ElementType
    children: React.ReactNode
    accent?: 'indigo' | 'emerald' | 'amber' | 'violet'
}) {
    const colors = {
        indigo: 'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
        emerald: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
        amber: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
        violet: 'text-violet-400 border-violet-500/40 bg-violet-500/10',
    }
    return (
        <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
            <div className={`px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 ${colors[accent].split(' ').slice(2).join(' ')}`}>
                <Icon className={`h-4 w-4 ${colors[accent].split(' ')[0]}`} />
                <span className="text-sm font-bold text-white">{title}</span>
            </div>
            <div className="p-4 space-y-4">{children}</div>
        </div>
    )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function EstimatorPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [converting, setConverting] = useState(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [settings, setSettings] = useState<any>(null)
    const [templates, setTemplates] = useState<any[]>([])
    const [showConvertDialog, setShowConvertDialog] = useState(false)
    const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false)
    const [templateName, setTemplateName] = useState('')

    // ── Order info ────────────────────────────────────────────────────────
    const [partyName, setPartyName] = useState('')
    const [qualityLabel, setQualityLabel] = useState('')          // e.g. "Canvas Shine"
    const [warpInstruction, setWarpInstruction] = useState('')    // e.g. "50/48 + 70/36 + Rainbow"
    const [weftInstruction, setWeftInstruction] = useState('')    // e.g. "50/48"
    const [targetMeters, setTargetMeters] = useState(10000)
    const [deadline, setDeadline] = useState(
        format(addDays(new Date(), 30), 'yyyy-MM-dd')
    )

    // ── Yarn specs ────────────────────────────────────────────────────────
    const [yarnDenier, setYarnDenier] = useState(DEFAULT_ESTIMATOR_INPUTS.yarn_denier)
    const [calcDenier, setCalcDenier] = useState(DEFAULT_ESTIMATOR_INPUTS.calculated_yarn_denier)
    const [beamEnds, setBeamEnds] = useState(DEFAULT_ESTIMATOR_INPUTS.beam_ends)
    const [picksCm, setPicksCm] = useState(DEFAULT_ESTIMATOR_INPUTS.picks_per_cm)
    const [reedSpace, setReedSpace] = useState(DEFAULT_ESTIMATOR_INPUTS.reed_space_cm)
    const [weftDenier, setWeftDenier] = useState(DEFAULT_ESTIMATOR_INPUTS.weft_denier)
    const [tapeLength, setTapeLength] = useState(DEFAULT_ESTIMATOR_INPUTS.tape_length_m)
    const [shrinkage, setShrinkage] = useState(DEFAULT_ESTIMATOR_INPUTS.shrinkage_pct)

    // ── Financials ────────────────────────────────────────────────────────
    const [yarnRate, setYarnRate] = useState(DEFAULT_ESTIMATOR_INPUTS.yarn_rate_per_kg)
    const [machineRate, setMachineRate] = useState(DEFAULT_ESTIMATOR_INPUTS.machine_rate_per_m)
    const [marginPct, setMarginPct] = useState(DEFAULT_ESTIMATOR_INPUTS.margin_pct)
    const [gstPct, setGstPct] = useState(DEFAULT_ESTIMATOR_INPUTS.gst_pct)
    const [dailyOverhead, setDailyOverhead] = useState(0)
    const [activeMachines, setActiveMachines] = useState(24)

    // ── Load settings & templates ─────────────────────────────────────────
    useEffect(() => {
        async function load() {
            setLoading(true)
            const [sRes, tRes] = await Promise.all([
                getEstimatorSettings(),
                getEstimatorTemplates(),
            ])
            if (sRes.data) {
                const s = sRes.data
                setMachineRate(Number(s.machine_rate_per_m ?? 1.5))
                setDailyOverhead(Number(s.daily_overhead ?? 0))
                setActiveMachines(Number(s.total_active_machines ?? 24))
                setGstPct(Number(s.gst_rate ?? 5))
                setSettings(s)
            }
            if (tRes.data) setTemplates(tRes.data)
            setLoading(false)
        }
        load()
    }, [])

    // ── Live calculation ──────────────────────────────────────────────────
    const inputs: EstimatorInputs = useMemo(
        () => ({
            yarn_denier: yarnDenier,
            calculated_yarn_denier: calcDenier,
            beam_ends: beamEnds,
            picks_per_cm: picksCm,
            reed_space_cm: reedSpace,
            weft_denier: weftDenier,
            tape_length_m: tapeLength,
            shrinkage_pct: shrinkage,
            yarn_rate_per_kg: yarnRate,
            machine_rate_per_m: machineRate,
            daily_overhead: dailyOverhead,
            total_active_machines: activeMachines,
            margin_pct: marginPct,
            gst_pct: gstPct,
        }),
        [
            yarnDenier, calcDenier, beamEnds, picksCm, reedSpace, weftDenier,
            tapeLength, shrinkage, yarnRate, machineRate, marginPct, gstPct,
            dailyOverhead, activeMachines,
        ]
    )

    const result = useMemo(() => calculateLandedCost(inputs), [inputs])
    const stressTests = useMemo(() => runStressTests(inputs), [inputs])

    // ── Apply template ────────────────────────────────────────────────────
    const applyTemplate = useCallback((tpl: any) => {
        setQualityLabel(tpl.name)
        if (tpl.yarn_denier) setYarnDenier(Number(tpl.yarn_denier))
        if (tpl.calculated_yarn_denier) setCalcDenier(Number(tpl.calculated_yarn_denier))
        if (tpl.beam_ends) setBeamEnds(Number(tpl.beam_ends))
        if (tpl.ppi) setPicksCm(Number(tpl.ppi))
        if (tpl.reed_space) setReedSpace(Number(tpl.reed_space))
        if (tpl.weft_denier) setWeftDenier(Number(tpl.weft_denier))
        if (tpl.tape_length_m) setTapeLength(Number(tpl.tape_length_m))
        if (tpl.shrinkage_pct) setShrinkage(Number(tpl.shrinkage_pct))
        if (tpl.default_yarn_rate) setYarnRate(Number(tpl.default_yarn_rate))
        if (tpl.machine_rate_per_m) setMachineRate(Number(tpl.machine_rate_per_m))
        toast.success(`Applied "${tpl.name}" specs`)
    }, [])

    // ── Save as template ──────────────────────────────────────────────────
    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return toast.error('Enter a name for this fabric')
        setSavingTemplate(true)
        const res = await saveAsFabricTemplate({
            name: templateName.trim(),
            yarn_denier: yarnDenier,
            calculated_yarn_denier: calcDenier,
            beam_ends: beamEnds,
            picks_per_cm: picksCm,
            reed_space_cm: reedSpace,
            weft_denier: weftDenier,
            tape_length_m: tapeLength,
            shrinkage_pct: shrinkage,
            machine_rate_per_m: machineRate,
            default_yarn_rate: yarnRate,
        })
        setSavingTemplate(false)
        if (res.success) {
            const [tRes] = await Promise.all([getEstimatorTemplates()])
            if (tRes.data) setTemplates(tRes.data)
            setShowSaveTemplateDialog(false)
            setTemplateName('')
            toast.success('Fabric template saved!')
        } else {
            toast.error(res.error ?? 'Failed to save template')
        }
    }

    // ── Convert to order ──────────────────────────────────────────────────
    const handleConvertToOrder = async () => {
        if (!partyName.trim()) return toast.error('Party name is required')
        if (!qualityLabel.trim()) return toast.error('Quality label is required')
        if (!deadline) return toast.error('Delivery date is required')

        setConverting(true)
        const res = await convertQuoteToOrder({
            party_name: partyName.trim(),
            quality_label: qualityLabel.trim(),
            warp_instruction: warpInstruction.trim() || undefined,
            weft_instruction: weftInstruction.trim() || undefined,
            total_target_meters: targetMeters,
            deadline,
            yarn_denier: yarnDenier,
            calculated_yarn_denier: calcDenier,
            beam_ends: beamEnds,
            picks_per_cm: picksCm,
            reed_space_cm: reedSpace,
            weft_denier: weftDenier,
            tape_length_m: tapeLength,
            shrinkage_pct: shrinkage,
            yarn_rate_per_kg: yarnRate,
            machine_rate_per_m: machineRate,
            daily_overhead: dailyOverhead,
            quote_price_per_m: result.quote_price_per_m,
            margin_pct: marginPct,
        })
        setConverting(false)
        if (res.success) {
            setShowConvertDialog(false)
            toast.success('Order created! Pending setup on the floor.')
            router.push('/owner/orders')
        } else {
            toast.error(res.error ?? 'Failed to create order')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950 text-white">
            {/* ── STICKY HEADER — Live Quote Banner ─────────────────────── */}
            <div className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-xl border-b border-slate-800 shadow-lg shadow-slate-950/50">
                <div className="px-4 py-3 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                Cost / meter
                            </p>
                            <p className="text-3xl font-black font-mono text-white leading-none">
                                ₹{result.landed_cost_per_m.toFixed(2)}
                            </p>
                        </div>
                        <div className="h-10 w-px bg-slate-700" />
                        <div className="flex-1">
                            <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">
                                Quote @ {marginPct}% margin
                            </p>
                            <p className="text-3xl font-black font-mono text-indigo-400 leading-none">
                                ₹{result.quote_price_per_m.toFixed(2)}
                            </p>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Button
                                size="sm"
                                className="h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5"
                                onClick={() => setShowConvertDialog(true)}
                            >
                                <Package className="h-3.5 w-3.5" />
                                Order
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 border-slate-700 text-slate-300 hover:text-white text-xs gap-1.5"
                                onClick={() => setShowSaveTemplateDialog(true)}
                            >
                                <BookmarkPlus className="h-3.5 w-3.5" />
                                Save
                            </Button>
                        </div>
                    </div>

                    {/* Cost breakdown mini pills */}
                    <div className="flex gap-2 mt-2 overflow-x-auto no-scrollbar pb-0.5">
                        <span className="shrink-0 text-[10px] bg-slate-800 text-slate-300 rounded-full px-2 py-0.5 font-mono border border-slate-700">
                            🧶 Material ₹{result.material_cost_per_m.toFixed(2)}
                        </span>
                        <span className="shrink-0 text-[10px] bg-slate-800 text-slate-300 rounded-full px-2 py-0.5 font-mono border border-slate-700">
                            ⚙️ Machine ₹{result.machine_cost_per_m.toFixed(2)}
                        </span>
                        {result.overhead_cost_per_m > 0 && (
                            <span className="shrink-0 text-[10px] bg-slate-800 text-slate-300 rounded-full px-2 py-0.5 font-mono border border-slate-700">
                                🏭 Overhead ₹{result.overhead_cost_per_m.toFixed(2)}
                            </span>
                        )}
                        {gstPct > 0 && (
                            <span className="shrink-0 text-[10px] bg-slate-800 text-slate-300 rounded-full px-2 py-0.5 font-mono border border-slate-700">
                                📋 GST ₹{result.gst_amount_per_m.toFixed(2)}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
            <div className="px-4 py-5 space-y-4 max-w-2xl mx-auto pb-24">

                {/* Templates row */}
                {templates.length > 0 && (
                    <div>
                        <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mb-2">
                            Saved Fabrics
                        </p>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {templates.map((tpl) => (
                                <button
                                    key={tpl.id}
                                    onClick={() => applyTemplate(tpl)}
                                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold border transition-all ${
                                        qualityLabel === tpl.name
                                            ? 'bg-indigo-600 border-indigo-500 text-white'
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                                    }`}
                                >
                                    {tpl.name}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Section 1: Order Info ─────────────────────────────── */}
                <Section title="Order Details" icon={Layers} accent="violet">
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Party Name
                            </Label>
                            <Input
                                placeholder="e.g. Sundaram Textiles"
                                value={partyName}
                                onChange={(e) => setPartyName(e.target.value)}
                                className="h-12 text-base bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Quality Label
                            </Label>
                            <Input
                                placeholder="e.g. Canvas Shine, Japan Satin, Micro Crepe"
                                value={qualityLabel}
                                onChange={(e) => setQualityLabel(e.target.value)}
                                className="h-12 text-base bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Warp Spec
                            </Label>
                            <Input
                                placeholder="50/48 + 70/36 + Rainbow"
                                value={warpInstruction}
                                onChange={(e) => setWarpInstruction(e.target.value)}
                                className="h-12 text-sm bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Weft Spec
                            </Label>
                            <Input
                                placeholder="50/48"
                                value={weftInstruction}
                                onChange={(e) => setWeftInstruction(e.target.value)}
                                className="h-12 text-sm bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-indigo-500"
                            />
                        </div>
                    </div>
                </Section>

                {/* ── Section 2: Yarn Specs ─────────────────────────────── */}
                <Section title="Yarn Technical Specs" icon={Sparkles} accent="indigo">
                    <div className="grid grid-cols-2 gap-3">
                        <NumericField
                            label="Yarn Denier"
                            value={yarnDenier}
                            onChange={setYarnDenier}
                            unit="D"
                            hint="Single-end yarn denier"
                        />
                        <NumericField
                            label="Calc. Denier"
                            value={calcDenier}
                            onChange={setCalcDenier}
                            unit="D"
                            hint="After doubling/folding"
                        />
                        <NumericField
                            label="Beam Ends"
                            value={beamEnds}
                            onChange={setBeamEnds}
                            hint="Total warp ends on beam"
                        />
                        <NumericField
                            label="Weft Denier"
                            value={weftDenier}
                            onChange={setWeftDenier}
                            unit="D"
                            hint="Weft yarn denier"
                        />
                        <NumericField
                            label="Picks / cm"
                            value={picksCm}
                            onChange={setPicksCm}
                            step={0.5}
                            hint="Picks per centimeter"
                        />
                        <NumericField
                            label="Reed Space"
                            value={reedSpace}
                            onChange={setReedSpace}
                            unit="cm"
                            hint="Fabric width in cm"
                        />
                        <NumericField
                            label="Tape Length"
                            value={tapeLength}
                            onChange={setTapeLength}
                            unit="m"
                            hint="Meters per beam tape"
                        />
                        <NumericField
                            label="Shrinkage"
                            value={shrinkage}
                            onChange={setShrinkage}
                            unit="%"
                            step={0.5}
                            hint="Combined warp + weft %"
                        />
                    </div>
                    {/* Beam capacity preview */}
                    <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700 flex items-center justify-between">
                        <span className="text-xs text-slate-400">Estimated meters / beam</span>
                        <span className="font-mono font-bold text-emerald-400 text-sm">
                            ≈ {result.estimated_beam_meters.toFixed(0)}m
                        </span>
                    </div>
                </Section>

                {/* ── Section 3: Yarn Rate Slider ───────────────────────── */}
                <Section title="Market Yarn Rate" icon={TrendingUp} accent="emerald">
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-sm text-slate-400">Current Rate</p>
                                <p className="text-3xl font-black font-mono text-emerald-400">
                                    ₹{yarnRate}
                                    <span className="text-sm text-slate-500 ml-1 font-normal">/kg</span>
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500">Material cost</p>
                                <p className="text-xl font-bold font-mono text-white">
                                    ₹{result.material_cost_per_m.toFixed(2)}/m
                                </p>
                            </div>
                        </div>
                        <input
                            type="range"
                            min={80}
                            max={350}
                            step={1}
                            value={yarnRate}
                            onChange={(e) => setYarnRate(Number(e.target.value))}
                            className="w-full h-2 rounded-full bg-slate-700 appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                            <span>₹80</span>
                            <span>₹350</span>
                        </div>
                    </div>

                    {/* Also let user punch it in directly */}
                    <div className="space-y-1.5">
                        <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                            Or type exact rate
                        </Label>
                        <Input
                            type="number"
                            value={yarnRate}
                            onChange={(e) => setYarnRate(Number(e.target.value))}
                            className="h-12 text-base font-mono font-bold text-center bg-slate-900 border-slate-700 text-white focus:border-emerald-500"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <NumericField
                            label="Machine Rate"
                            value={machineRate}
                            onChange={setMachineRate}
                            unit="₹/m"
                            step={0.05}
                            hint="Flat ₹ per meter produced"
                        />
                        <NumericField
                            label="Daily Overhead"
                            value={dailyOverhead}
                            onChange={setDailyOverhead}
                            unit="₹/day"
                            hint="Rent + admin salaries"
                        />
                    </div>
                </Section>

                {/* ── Section 4: Margin & Quote ─────────────────────────── */}
                <Section title="Margin & Quote Price" icon={Calculator} accent="amber">
                    <div className="flex items-center justify-between mb-3">
                        <div>
                            <p className="text-sm text-slate-400">Desired Margin</p>
                            <p className="text-3xl font-black text-amber-400">
                                {marginPct}%
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] text-slate-500">Profit per meter</p>
                            <p className="text-xl font-bold font-mono text-emerald-400">
                                +₹{result.profit_per_m.toFixed(2)}
                            </p>
                        </div>
                    </div>
                    <input
                        type="range"
                        min={0}
                        max={50}
                        step={0.5}
                        value={marginPct}
                        onChange={(e) => setMarginPct(Number(e.target.value))}
                        className="w-full h-2 rounded-full bg-slate-700 appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between text-[10px] text-slate-600 mt-1">
                        <span>0%</span>
                        <span>50%</span>
                    </div>

                    {/* GST toggle */}
                    <div className="grid grid-cols-2 gap-3 mt-2">
                        <NumericField
                            label="GST %"
                            value={gstPct}
                            onChange={setGstPct}
                            unit="%"
                            step={0.5}
                        />
                        <div className="bg-indigo-600/20 border border-indigo-500/40 rounded-xl p-3 flex flex-col items-center justify-center">
                            <p className="text-[10px] text-indigo-300 font-bold uppercase tracking-widest">
                                Quote Price
                            </p>
                            <p className="text-2xl font-black font-mono text-indigo-300 mt-0.5">
                                ₹{result.quote_price_per_m.toFixed(2)}
                            </p>
                            <p className="text-[10px] text-slate-500">per meter</p>
                        </div>
                    </div>
                </Section>

                {/* ── Section 5: Stress Test ──────────────────────────── */}
                <Section title="Risk Scenarios" icon={FlaskConical} accent="amber">
                    <div className="space-y-2">
                        {stressTests.map((test) => (
                            <div
                                key={test.scenario}
                                className="flex items-center justify-between bg-slate-900/60 rounded-xl px-3 py-2.5 border border-slate-700"
                            >
                                <span className="text-xs text-slate-400">{test.scenario}</span>
                                <span className="text-sm font-bold font-mono text-rose-400">
                                    +₹{test.delta.toFixed(2)}/m
                                </span>
                            </div>
                        ))}
                        <p className="text-[10px] text-slate-600 text-center pt-1">
                            Impact on your landed cost if these scenarios occur
                        </p>
                    </div>
                </Section>
            </div>

            {/* ── SAVE AS TEMPLATE DIALOG ──────────────────────────────── */}
            <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white">Save as Base Fabric</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-slate-400">
                            Name this fabric template so you can load these specs instantly next time.
                        </p>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Fabric Name
                            </Label>
                            <Input
                                placeholder="e.g. Canvas Shine, 60g Georgette"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                                className="h-12 bg-slate-800 border-slate-600 text-white"
                                autoFocus
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500">
                            <div>Denier: {yarnDenier}D / {calcDenier}D calc</div>
                            <div>Beam Ends: {beamEnds}</div>
                            <div>Picks: {picksCm}/cm</div>
                            <div>Reed: {reedSpace}cm</div>
                            <div>Shrinkage: {shrinkage}%</div>
                            <div>Rate: ₹{yarnRate}/kg</div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="border-slate-700 text-slate-400"
                            onClick={() => setShowSaveTemplateDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-500"
                            onClick={handleSaveTemplate}
                            disabled={savingTemplate}
                        >
                            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── CONVERT TO ORDER DIALOG ──────────────────────────────── */}
            <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Package className="h-5 w-5 text-indigo-400" />
                            Convert to Floor Order
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {/* Job Card Preview */}
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2.5">
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                                Job Card Preview
                            </p>
                            <div className="space-y-1.5 text-sm">
                                {qualityLabel && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Quality</span>
                                        <span className="font-bold text-white">{qualityLabel}</span>
                                    </div>
                                )}
                                {partyName && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Party</span>
                                        <span className="text-white">{partyName}</span>
                                    </div>
                                )}
                                {warpInstruction && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Warp</span>
                                        <span className="text-white font-mono text-xs">{warpInstruction}</span>
                                    </div>
                                )}
                                {weftInstruction && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">Weft</span>
                                        <span className="text-white font-mono text-xs">{weftInstruction}</span>
                                    </div>
                                )}
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Quote</span>
                                    <span className="font-bold text-indigo-400 font-mono">
                                        ₹{result.quote_price_per_m.toFixed(2)}/m
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400">
                                Target Meters
                            </Label>
                            <Input
                                type="number"
                                value={targetMeters}
                                onChange={(e) => setTargetMeters(Number(e.target.value))}
                                className="h-12 font-mono font-bold text-center bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[11px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> Delivery Date
                            </Label>
                            <Input
                                type="date"
                                value={deadline}
                                onChange={(e) => setDeadline(e.target.value)}
                                className="h-12 bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Order will be created in <strong className="text-slate-400">Pending Setup</strong> state. The supervisor assigns machines next.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button
                            variant="outline"
                            className="border-slate-700 text-slate-400"
                            onClick={() => setShowConvertDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            className="bg-indigo-600 hover:bg-indigo-500 font-bold gap-2"
                            onClick={handleConvertToOrder}
                            disabled={converting}
                        >
                            {converting ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <ArrowRight className="h-4 w-4" />
                            )}
                            Create Floor Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
