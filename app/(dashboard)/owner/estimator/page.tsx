'use client'

import { useReducer, useEffect, useMemo, useCallback, useState } from 'react'
import { nanoid } from 'nanoid'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
    Calculator,
    TrendingUp,
    Save,
    Package,
    Loader2,
    Calendar,
    Sparkles,
    FlaskConical,
    BookmarkPlus,
    ArrowRight,
    Layers,
    Plus,
    Trash2,
    Gauge,
    Wind,
    Palette,
    ChevronDown,
    ChevronUp,
    Scissors,
} from 'lucide-react'
import {
    calcFullTotals,
    makeDefaultEstimateState,
    DEFAULT_WARP_ROW,
    DEFAULT_WEFT_ROW,
    type EstimateState,
    type WarpRow,
    type WeftRow,
    type FactorySections,
    type EstimatorV3Totals,
} from '@/lib/estimator'
import {
    getFactoryCostProfile,
    getEstimatorTemplates,
    saveAsFabricTemplate,
    saveEstimatorQuoteV3,
    convertQuoteToOrder,
} from './actions'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

type Action =
    | { type: 'INIT_FROM_PROFILE'; data: { profile: any; sections: FactorySections } }
    | { type: 'APPLY_TEMPLATE'; template: any }
    | { type: 'SET'; field: keyof EstimateState; value: any }
    | { type: 'ADD_WARP_ROW' }
    | { type: 'UPDATE_WARP_ROW'; id: string; field: keyof WarpRow; value: any }
    | { type: 'REMOVE_WARP_ROW'; id: string }
    | { type: 'ADD_WEFT_ROW' }
    | { type: 'UPDATE_WEFT_ROW'; id: string; field: keyof WeftRow; value: any }
    | { type: 'REMOVE_WEFT_ROW'; id: string }
    | { type: 'ENABLE_SECTION'; section: keyof FactorySections }

function estimateReducer(state: EstimateState, action: Action): EstimateState {
    switch (action.type) {
        case 'INIT_FROM_PROFILE': {
            const { profile, sections } = action.data
            return {
                ...state,
                warpingRatePerKg:   Number(profile.warping_rate_per_kg ?? 2),
                sizingRatePerKg:    Number(profile.sizing_rate_per_kg  ?? 1.5),
                windingRatePerKg:   Number(profile.winding_rate_per_kg ?? 0),
                overheadPct:        Number(profile.overhead_pct        ?? 8),
                commissionPct:      Number(profile.default_commission_pct  ?? 2),
                transportPerM:      Number(profile.default_transport_per_m ?? 0),
                enabledSections:    { ...sections },
            }
        }
        case 'APPLY_TEMPLATE': {
            const tpl = action.template
            // V3 template with full row arrays
            if (tpl.warp_rows && tpl.warp_rows.length > 0) {
                return {
                    ...state,
                    warpRows: tpl.warp_rows.map((r: WarpRow) => ({ ...r, id: nanoid() })),
                    weftRows: tpl.weft_rows && tpl.weft_rows.length > 0
                        ? tpl.weft_rows.map((r: WeftRow) => ({ ...r, id: nanoid() }))
                        : state.weftRows,
                    tapeLengthM:      Number(tpl.tape_length_m ?? state.tapeLengthM),
                    perPickCostPaisa: Number(tpl.per_pick_cost_paise ?? state.perPickCostPaisa),
                }
            }
            // Legacy V1 template — map single-row fields
            return {
                ...state,
                warpRows: [{
                    id:          nanoid(),
                    calcDenier:  Number(tpl.calculated_yarn_denier ?? tpl.yarn_denier ?? 75),
                    beamEnds:    Number(tpl.beam_ends ?? 3200),
                    yarnRate:    Number(tpl.default_yarn_rate ?? 107),
                    gstPct:      5,
                    shortagePct: 5,
                }],
                weftRows: [{
                    id:          nanoid(),
                    picks:       Number(tpl.ppi ?? 68),
                    reedSpace:   Number(tpl.reed_space ?? 110),
                    calcDenier:  Number(tpl.weft_denier ?? 75),
                    yarnRate:    Number(tpl.default_yarn_rate ?? 107),
                    gstPct:      5,
                    shortagePct: 3,
                }],
                tapeLengthM:      Number(tpl.tape_length_m ?? state.tapeLengthM),
                perPickCostPaisa: Number(tpl.per_pick_cost_paise ?? state.perPickCostPaisa),
            }
        }
        case 'SET':
            return { ...state, [action.field]: action.value }
        case 'ADD_WARP_ROW':
            return { ...state, warpRows: [...state.warpRows, { id: nanoid(), ...DEFAULT_WARP_ROW }] }
        case 'UPDATE_WARP_ROW':
            return {
                ...state,
                warpRows: state.warpRows.map(r =>
                    r.id === action.id ? { ...r, [action.field]: action.value } : r
                ),
            }
        case 'REMOVE_WARP_ROW':
            if (state.warpRows.length <= 1) return state
            return { ...state, warpRows: state.warpRows.filter(r => r.id !== action.id) }
        case 'ADD_WEFT_ROW':
            return { ...state, weftRows: [...state.weftRows, { id: nanoid(), ...DEFAULT_WEFT_ROW }] }
        case 'UPDATE_WEFT_ROW':
            return {
                ...state,
                weftRows: state.weftRows.map(r =>
                    r.id === action.id ? { ...r, [action.field]: action.value } : r
                ),
            }
        case 'REMOVE_WEFT_ROW':
            if (state.weftRows.length <= 1) return state
            return { ...state, weftRows: state.weftRows.filter(r => r.id !== action.id) }
        case 'ENABLE_SECTION':
            return {
                ...state,
                enabledSections: { ...state.enabledSections, [action.section]: true },
            }
        default:
            return state
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon, accent = 'indigo', children }: {
    title:    string
    icon:     React.ElementType
    accent?:  'indigo' | 'emerald' | 'amber' | 'violet' | 'teal' | 'rose'
    children?: React.ReactNode
}) {
    const colors: Record<string, string> = {
        indigo:  'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
        emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
        amber:   'text-amber-400 bg-amber-500/10 border-amber-500/30',
        violet:  'text-violet-400 bg-violet-500/10 border-violet-500/30',
        teal:    'text-teal-400 bg-teal-500/10 border-teal-500/30',
        rose:    'text-rose-400 bg-rose-500/10 border-rose-500/30',
    }
    const [textColor, bg, border] = colors[accent].split(' ')
    return (
        <div className={`rounded-2xl overflow-hidden border ${border} ${bg}`}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${textColor}`} />
                    <span className="text-sm font-bold text-white">{title}</span>
                </div>
                {children}
            </div>
        </div>
    )
}

function NumField({
    label, value, onChange, unit, step = 1, min = 0, hint,
}: {
    label: string; value: number; onChange: (v: number) => void
    unit?: string; step?: number; min?: number; hint?: string
}) {
    return (
        <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</Label>
            <div className="relative">
                <Input
                    type="number"
                    step={step}
                    min={min}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="h-10 text-sm font-mono font-bold text-center pr-9 bg-slate-900 border-slate-700 text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                />
                {unit && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-medium pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {hint && <p className="text-[10px] text-slate-600">{hint}</p>}
        </div>
    )
}

function CostPill({ label, value }: { label: string; value: number }) {
    if (value <= 0) return null
    return (
        <span className="shrink-0 text-[10px] bg-slate-800 text-slate-300 rounded-full px-2.5 py-0.5 font-mono border border-slate-700">
            {label} ₹{value.toFixed(2)}
        </span>
    )
}

// Yarn row component (shared for warp + weft with conditional fields)
function WarpRowCard({
    row, index, onUpdate, onRemove, canRemove, kgPer100m, costPer100m,
}: {
    row:        WarpRow
    index:      number
    onUpdate:   (field: keyof WarpRow, value: any) => void
    onRemove:   () => void
    canRemove:  boolean
    kgPer100m:  number
    costPer100m: number
}) {
    return (
        <div className="bg-slate-900/70 rounded-xl border border-slate-700/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">
                    Warp Component {index + 1}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                        {kgPer100m.toFixed(3)} kg/100m · ₹{costPer100m.toFixed(2)}/100m
                    </span>
                    {canRemove && (
                        <button onClick={onRemove} className="text-slate-600 hover:text-rose-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <NumField label="Calc Denier" value={row.calcDenier} onChange={v => onUpdate('calcDenier', v)} unit="D" step={0.5} />
                <NumField label="Beam Ends" value={row.beamEnds} onChange={v => onUpdate('beamEnds', v)} hint="This component only" />
                <NumField label="₹ / kg" value={row.yarnRate} onChange={v => onUpdate('yarnRate', v)} unit="₹/kg" step={1} />
                <NumField label="GST" value={row.gstPct} onChange={v => onUpdate('gstPct', v)} unit="%" step={0.5} />
                <NumField label="Shortage" value={row.shortagePct} onChange={v => onUpdate('shortagePct', v)} unit="%" step={0.5} hint="Wastage/shrinkage %" />
            </div>
        </div>
    )
}

function WeftRowCard({
    row, index, onUpdate, onRemove, canRemove, kgPer100m, costPer100m,
}: {
    row:        WeftRow
    index:      number
    onUpdate:   (field: keyof WeftRow, value: any) => void
    onRemove:   () => void
    canRemove:  boolean
    kgPer100m:  number
    costPer100m: number
}) {
    return (
        <div className="bg-slate-900/70 rounded-xl border border-slate-700/60 p-3 space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-bold">
                    Weft Component {index + 1}
                </span>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-mono">
                        {kgPer100m.toFixed(3)} kg/100m · ₹{costPer100m.toFixed(2)}/100m
                    </span>
                    {canRemove && (
                        <button onClick={onRemove} className="text-slate-600 hover:text-rose-400 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
                <NumField label="Picks (PPI)" value={row.picks} onChange={v => onUpdate('picks', v)} hint="Picks per inch" />
                <NumField label="Reed Space" value={row.reedSpace} onChange={v => onUpdate('reedSpace', v)} unit="cm" />
                <NumField label="Calc Denier" value={row.calcDenier} onChange={v => onUpdate('calcDenier', v)} unit="D" step={0.5} />
                <NumField label="₹ / kg" value={row.yarnRate} onChange={v => onUpdate('yarnRate', v)} unit="₹/kg" step={1} />
                <NumField label="GST" value={row.gstPct} onChange={v => onUpdate('gstPct', v)} unit="%" step={0.5} />
                <NumField label="Shortage" value={row.shortagePct} onChange={v => onUpdate('shortagePct', v)} unit="%" step={0.5} />
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EstimatorPage() {
    const router = useRouter()
    const [state, dispatch] = useReducer(estimateReducer, makeDefaultEstimateState())
    const [loading,   setLoading]   = useState(true)
    const [saving,    setSaving]    = useState(false)
    const [converting, setConverting] = useState(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templates, setTemplates] = useState<any[]>([])

    // Order info (separate from EstimateState as they're display-only on convert)
    const [partyName,       setPartyName]       = useState('')
    const [qualityLabel,    setQualityLabel]    = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const [targetMeters,    setTargetMeters]    = useState(1000)
    const [deadline,        setDeadline]        = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))

    // Dialogs
    const [showSaveTemplate, setShowSaveTemplate] = useState(false)
    const [showConvert,      setShowConvert]      = useState(false)
    const [templateName,     setTemplateName]     = useState('')

    // Load factory profile + templates
    useEffect(() => {
        async function load() {
            setLoading(true)
            const [pRes, tRes] = await Promise.all([
                getFactoryCostProfile(),
                getEstimatorTemplates(),
            ])
            if (pRes.data) {
                dispatch({
                    type: 'INIT_FROM_PROFILE',
                    data: {
                        profile:  pRes.data,
                        sections: pRes.data.enabled_sections ?? {
                            winding: false, processing: false, finishing: false, commission: true, transport: false,
                        },
                    },
                })
            }
            if (tRes.data) setTemplates(tRes.data)
            setLoading(false)
        }
        load()
    }, [])

    // All derived numbers from a single memo
    const totals: EstimatorV3Totals = useMemo(() => calcFullTotals(state), [state])

    const applyTemplate = useCallback((tpl: any) => {
        dispatch({ type: 'APPLY_TEMPLATE', template: tpl })
        setQualityLabel(tpl.name)
        toast.success(`Applied "${tpl.name}"`)
    }, [])

    // ── Save as fabric template ──────────────────────────────────────────
    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return toast.error('Enter a name for this fabric')
        setSavingTemplate(true)
        const res = await saveAsFabricTemplate({
            name:             templateName.trim(),
            warpRows:         state.warpRows,
            weftRows:         state.weftRows,
            tapeLengthM:      state.tapeLengthM,
            perPickCostPaisa: state.perPickCostPaisa,
        })
        setSavingTemplate(false)
        if (res.success) {
            const tRes = await getEstimatorTemplates()
            if (tRes.data) setTemplates(tRes.data)
            setShowSaveTemplate(false)
            setTemplateName('')
            toast.success('Fabric template saved!')
        } else {
            toast.error(res.error ?? 'Failed to save template')
        }
    }

    // ── Convert to order ─────────────────────────────────────────────────
    const handleConvertToOrder = async () => {
        if (!partyName.trim())   return toast.error('Party name is required')
        if (!qualityLabel.trim()) return toast.error('Quality label is required')
        if (!deadline)            return toast.error('Delivery date is required')
        setConverting(true)
        const res = await convertQuoteToOrder({
            party_name:          partyName.trim(),
            quality_label:       qualityLabel.trim(),
            warp_instruction:    warpInstruction.trim() || undefined,
            weft_instruction:    weftInstruction.trim() || undefined,
            total_target_meters: targetMeters,
            deadline,
            estimate:            state,
            quote_price_per_m:   totals.orderQuote?.quotePricePerM ?? totals.totalProductionCostPerM,
            totalProductionCostPerM: totals.totalProductionCostPerM,
        })
        setConverting(false)
        if (res.success) {
            setShowConvert(false)
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

    const { orderQuote } = totals
    const hasOrderQty    = !!(state.orderQuantityM && state.orderQuantityM > 0)

    return (
        <div className="min-h-screen bg-slate-950 text-white">

            {/* ── STICKY HEADER ───────────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-slate-950/96 backdrop-blur-xl border-b border-slate-800 shadow-lg shadow-slate-950/60">
                <div className="px-4 py-3 max-w-2xl mx-auto space-y-2">

                    {/* Row 1: core numbers + actions */}
                    <div className="flex items-center gap-3">
                        {/* Production cost */}
                        <div className="min-w-0">
                            <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Production / m</p>
                            <p className="text-2xl font-black font-mono text-white leading-none">
                                ₹{totals.totalProductionCostPerM.toFixed(2)}
                            </p>
                        </div>

                        {hasOrderQty && orderQuote && (
                            <>
                                <div className="h-8 w-px bg-slate-700 shrink-0" />
                                {/* Quote price */}
                                <div className="min-w-0">
                                    <p className="text-[9px] uppercase tracking-widest text-indigo-400 font-bold">Quote / m</p>
                                    <p className="text-2xl font-black font-mono text-indigo-400 leading-none">
                                        ₹{orderQuote.quotePricePerM.toFixed(2)}
                                    </p>
                                </div>
                                <div className="h-8 w-px bg-slate-700 shrink-0" />
                                {/* Total */}
                                <div className="min-w-0 flex-1">
                                    <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold">Total</p>
                                    <p className="text-xl font-black font-mono text-emerald-400 leading-none">
                                        ₹{orderQuote.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Action buttons */}
                        <div className="flex flex-col gap-1.5 ml-auto shrink-0">
                            <Button
                                size="sm"
                                className="h-8 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs gap-1.5"
                                onClick={() => setShowConvert(true)}
                            >
                                <Package className="h-3 w-3" /> Order
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-8 border-slate-700 text-slate-300 hover:text-white text-xs gap-1.5"
                                onClick={() => setShowSaveTemplate(true)}
                            >
                                <BookmarkPlus className="h-3 w-3" /> Save
                            </Button>
                        </div>
                    </div>

                    {/* Row 2: margin slider (when order qty entered) */}
                    {hasOrderQty && orderQuote && (
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 text-right">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Margin</p>
                                <p className="text-sm font-black text-amber-400">{state.profitPct.toFixed(1)}%</p>
                            </div>
                            <input
                                type="range"
                                min={0} max={40} step={0.5}
                                value={state.profitPct}
                                onChange={e => dispatch({ type: 'SET', field: 'profitPct', value: Number(e.target.value) })}
                                className="flex-1 h-1.5 rounded-full bg-slate-700 appearance-none cursor-pointer accent-amber-500"
                            />
                            <div className="shrink-0 text-left">
                                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Profit</p>
                                <p className="text-sm font-black text-emerald-400">
                                    ₹{orderQuote.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Row 3: cost breakdown pills */}
                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                        <CostPill label="🧶 Warp"           value={totals.warpCostPerM} />
                        <CostPill label="🧵 Weft"           value={totals.weftCostPerM} />
                        <CostPill label="⚙️ Weave"          value={totals.weaveCostPerM} />
                        <CostPill label="🔀 Warp+Size"      value={totals.warpingAndSizingPerM} />
                        {totals.windingPerM > 0     && <CostPill label="🌀 Winding"    value={totals.windingPerM} />}
                        {totals.processingPerM > 0  && <CostPill label="🎨 Processing" value={totals.processingPerM} />}
                        {totals.finishingPerM > 0   && <CostPill label="✨ Finishing"  value={totals.finishingPerM} />}
                        <CostPill label="🏭 Overhead"       value={totals.overheadPerM} />
                    </div>
                </div>
            </div>

            {/* ── MAIN CONTENT ─────────────────────────────────────────── */}
            <div className="px-4 py-5 space-y-5 max-w-2xl mx-auto pb-28">

                {/* ── Saved Fabrics ── */}
                {templates.length > 0 && (
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">Saved Fabrics</p>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {templates.map(tpl => (
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

                {/* ── Section 1: Order Details ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-violet-500/10">
                        <Layers className="h-4 w-4 text-violet-400" />
                        <span className="text-sm font-bold text-white">Order Details</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Party Name</Label>
                                <Input
                                    placeholder="e.g. Sundaram Textiles"
                                    value={partyName}
                                    onChange={e => setPartyName(e.target.value)}
                                    className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Quality Label</Label>
                                <Input
                                    placeholder="e.g. Canvas Shine, Japan Satin, Micro Crepe"
                                    value={qualityLabel}
                                    onChange={e => setQualityLabel(e.target.value)}
                                    className="h-11 bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Warp Spec</Label>
                                <Input
                                    placeholder="50/48 + 70/36 + Rainbow"
                                    value={warpInstruction}
                                    onChange={e => setWarpInstruction(e.target.value)}
                                    className="h-11 text-sm bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500"
                                />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Weft Spec</Label>
                                <Input
                                    placeholder="50/48"
                                    value={weftInstruction}
                                    onChange={e => setWeftInstruction(e.target.value)}
                                    className="h-11 text-sm bg-slate-900 border-slate-700 text-white placeholder:text-slate-600 focus:border-violet-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section 2: Warp Yarn Rows ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-indigo-500/10">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-indigo-400" />
                            <span className="text-sm font-bold text-white">Warp Yarn</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                                {totals.totalWarpKgPer100m.toFixed(3)} kg/100m
                            </span>
                            <Badge variant="outline" className="text-[10px] border-indigo-500/40 text-indigo-300">
                                ₹{totals.warpCostPerM.toFixed(2)}/m
                            </Badge>
                        </div>
                    </div>
                    <div className="p-4 space-y-3">
                        {totals.warpRows.map((row, i) => (
                            <WarpRowCard
                                key={row.id}
                                row={row}
                                index={i}
                                kgPer100m={row.kgPer100m}
                                costPer100m={row.costPer100m}
                                canRemove={state.warpRows.length > 1}
                                onUpdate={(field, val) => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value: val })}
                                onRemove={() => dispatch({ type: 'REMOVE_WARP_ROW', id: row.id })}
                            />
                        ))}
                        <button
                            onClick={() => dispatch({ type: 'ADD_WARP_ROW' })}
                            className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Warp Component
                        </button>
                        {/* Tape length for beam preview */}
                        <div className="flex items-center justify-between pt-1">
                            <div className="space-y-1 w-40">
                                <NumField label="Tape Length" value={state.tapeLengthM} onChange={v => dispatch({ type: 'SET', field: 'tapeLengthM', value: v })} unit="m" hint="Metres per beam" />
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-slate-500">Beam capacity</p>
                                <p className="text-sm font-bold font-mono text-emerald-400">≈ {totals.estimatedBeamCapacityM.toFixed(0)} m</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section 3: Weft Yarn Rows ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-emerald-500/10">
                        <div className="flex items-center gap-2">
                            <Scissors className="h-4 w-4 text-emerald-400" />
                            <span className="text-sm font-bold text-white">Weft Yarn</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                                {totals.totalAllYarnKgPer100m.toFixed(3)} kg/100m total
                            </span>
                            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-300">
                                ₹{totals.weftCostPerM.toFixed(2)}/m
                            </Badge>
                        </div>
                    </div>
                    <div className="p-4 space-y-3">
                        {totals.weftRows.map((row, i) => (
                            <WeftRowCard
                                key={row.id}
                                row={row}
                                index={i}
                                kgPer100m={row.kgPer100m}
                                costPer100m={row.costPer100m}
                                canRemove={state.weftRows.length > 1}
                                onUpdate={(field, val) => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value: val })}
                                onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })}
                            />
                        ))}
                        <button
                            onClick={() => dispatch({ type: 'ADD_WEFT_ROW' })}
                            className="w-full py-2 rounded-xl border border-dashed border-slate-600 text-slate-500 hover:text-emerald-400 hover:border-emerald-500/50 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Weft Component
                        </button>
                    </div>
                </div>

                {/* ── Section 4: Weave Cost ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-amber-500/10">
                        <div className="flex items-center gap-2">
                            <Gauge className="h-4 w-4 text-amber-400" />
                            <span className="text-sm font-bold text-white">Weave Cost</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-300">
                            ₹{totals.weaveCostPerM.toFixed(2)}/m
                        </Badge>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                            <NumField
                                label="Per-pick Cost"
                                value={state.perPickCostPaisa}
                                onChange={v => dispatch({ type: 'SET', field: 'perPickCostPaisa', value: v })}
                                unit="₹/pick"
                                step={0.01}
                                hint="e.g. 0.16 = 16 paise/pick"
                            />
                            <div className="flex flex-col justify-end">
                                <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700 text-center">
                                    <p className="text-[10px] text-slate-500">Total picks (sum PPI)</p>
                                    <p className="text-lg font-black font-mono text-amber-400">
                                        {state.weftRows.reduce((s, r) => s + r.picks, 0)}
                                    </p>
                                    <p className="text-[10px] text-slate-600">× ₹{state.perPickCostPaisa} = ₹{totals.weaveCostPerM.toFixed(2)}/m</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Section 5: Warping + Sizing ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-teal-500/10">
                        <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-teal-400" />
                            <span className="text-sm font-bold text-white">Warping + Sizing</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400 font-mono">
                                {totals.totalWarpKgPer100m.toFixed(3)} kg warp/100m
                            </span>
                            <Badge variant="outline" className="text-[10px] border-teal-500/40 text-teal-300">
                                ₹{totals.warpingAndSizingPerM.toFixed(3)}/m
                            </Badge>
                        </div>
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-2 gap-3">
                            <NumField
                                label="Warping Rate"
                                value={state.warpingRatePerKg}
                                onChange={v => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: v })}
                                unit="₹/kg"
                                step={0.25}
                            />
                            <NumField
                                label="Sizing Rate"
                                value={state.sizingRatePerKg}
                                onChange={v => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: v })}
                                unit="₹/kg"
                                step={0.25}
                            />
                        </div>
                        <p className="text-[10px] text-slate-600 mt-2">
                            Auto-computed: {totals.totalWarpKgPer100m.toFixed(3)} kg/100m × (₹{state.warpingRatePerKg} + ₹{state.sizingRatePerKg}) / 100 = ₹{totals.warpingAndSizingPerM.toFixed(4)}/m
                        </p>
                    </div>
                </div>

                {/* ── Section 6: Winding (optional) ── */}
                {state.enabledSections.winding ? (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-blue-500/10">
                            <div className="flex items-center gap-2">
                                <Wind className="h-4 w-4 text-blue-400" />
                                <span className="text-sm font-bold text-white">Winding</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-blue-500/40 text-blue-300">
                                ₹{totals.windingPerM.toFixed(3)}/m
                            </Badge>
                        </div>
                        <div className="p-4">
                            <NumField
                                label="Winding Rate"
                                value={state.windingRatePerKg}
                                onChange={v => dispatch({ type: 'SET', field: 'windingRatePerKg', value: v })}
                                unit="₹/kg"
                                step={0.25}
                                hint={`Applies to all yarn: ${totals.totalAllYarnKgPer100m.toFixed(3)} kg/100m`}
                            />
                        </div>
                    </div>
                ) : (
                    <button
                        onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'winding' })}
                        className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-600 hover:text-blue-400 hover:border-blue-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                    >
                        <Plus className="h-3.5 w-3.5" /> Add Winding to this quote
                    </button>
                )}

                {/* ── Section 7: Processing / Finishing (optional) ── */}
                {(state.enabledSections.processing || state.enabledSections.finishing) ? (
                    <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                        <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-rose-500/10">
                            <div className="flex items-center gap-2">
                                <Palette className="h-4 w-4 text-rose-400" />
                                <span className="text-sm font-bold text-white">Post-Weaving</span>
                            </div>
                            <Badge variant="outline" className="text-[10px] border-rose-500/40 text-rose-300">
                                ₹{(totals.processingPerM + totals.finishingPerM).toFixed(2)}/m
                            </Badge>
                        </div>
                        <div className="p-4 grid grid-cols-2 gap-3">
                            {state.enabledSections.processing && (
                                <NumField
                                    label="Processing / Dyeing"
                                    value={state.processingRatePerM}
                                    onChange={v => dispatch({ type: 'SET', field: 'processingRatePerM', value: v })}
                                    unit="₹/m"
                                    step={0.5}
                                />
                            )}
                            {state.enabledSections.finishing && (
                                <NumField
                                    label="Finishing"
                                    value={state.finishingRatePerM}
                                    onChange={v => dispatch({ type: 'SET', field: 'finishingRatePerM', value: v })}
                                    unit="₹/m"
                                    step={0.5}
                                />
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'processing' })}
                            className="flex-1 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-600 hover:text-rose-400 hover:border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Processing
                        </button>
                        <button
                            onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'finishing' })}
                            className="flex-1 py-2.5 rounded-xl border border-dashed border-slate-700 text-slate-600 hover:text-rose-400 hover:border-rose-500/40 text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add Finishing
                        </button>
                    </div>
                )}

                {/* ── Section 8: Overhead ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-violet-500/10">
                        <div className="flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-violet-400" />
                            <span className="text-sm font-bold text-white">Overhead</span>
                        </div>
                        <Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-300">
                            ₹{totals.overheadPerM.toFixed(2)}/m
                        </Badge>
                    </div>
                    <div className="p-4">
                        <NumField
                            label="Overhead %"
                            value={state.overheadPct}
                            onChange={v => dispatch({ type: 'SET', field: 'overheadPct', value: v })}
                            unit="%"
                            step={0.5}
                            hint={`${state.overheadPct}% of ₹${totals.directCostPerM.toFixed(2)} direct cost = ₹${totals.overheadPerM.toFixed(2)}/m`}
                        />
                    </div>
                </div>

                {/* ── Section 9: Order Quantity ── */}
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-700/50 flex items-center gap-2 bg-slate-700/30">
                        <Package className="h-4 w-4 text-slate-400" />
                        <span className="text-sm font-bold text-white">Order Quantity</span>
                        <span className="text-[11px] text-slate-500 ml-1">— fills in the quote above</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <NumField
                            label="Order Metres"
                            value={state.orderQuantityM ?? 0}
                            onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: v > 0 ? v : null })}
                            unit="m"
                            step={100}
                            hint="Enter to see total quote value and profit"
                        />
                        {hasOrderQty && orderQuote && (
                            <>
                                {state.enabledSections.commission && (
                                    <NumField
                                        label="Commission %"
                                        value={state.commissionPct}
                                        onChange={v => dispatch({ type: 'SET', field: 'commissionPct', value: v })}
                                        unit="%"
                                        step={0.5}
                                    />
                                )}
                                {state.enabledSections.transport && (
                                    <NumField
                                        label="Transport ₹/m"
                                        value={state.transportPerM}
                                        onChange={v => dispatch({ type: 'SET', field: 'transportPerM', value: v })}
                                        unit="₹/m"
                                        step={0.1}
                                    />
                                )}
                                {/* Quote summary card */}
                                <div className="bg-indigo-600/10 border border-indigo-500/30 rounded-xl p-4 space-y-2.5 mt-2">
                                    <p className="text-[10px] uppercase tracking-widest text-indigo-400 font-bold">Quote Summary</p>
                                    <div className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Quote price</span>
                                            <span className="font-black font-mono text-white text-base">₹{orderQuote.quotePricePerM.toFixed(2)}/m</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Total order value</span>
                                            <span className="font-bold font-mono text-indigo-400">₹{orderQuote.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-slate-400">Gross profit</span>
                                            <span className={`font-bold font-mono ${orderQuote.grossProfitRupees >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                ₹{orderQuote.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                {' '}({orderQuote.actualMarginPct.toFixed(1)}%)
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── SAVE AS TEMPLATE DIALOG ──────────────────────────────── */}
            <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white">Save as Base Fabric</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <p className="text-sm text-slate-400">
                            Save all {state.warpRows.length} warp + {state.weftRows.length} weft components as a reusable fabric template.
                        </p>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Fabric Name</Label>
                            <Input
                                placeholder="e.g. Canvas Shine, 60g Georgette"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                                className="h-11 bg-slate-800 border-slate-600 text-white"
                                autoFocus
                            />
                        </div>
                        <div className="bg-slate-800/60 rounded-xl p-3 border border-slate-700 space-y-1 text-[11px] text-slate-400">
                            {state.warpRows.map((r, i) => (
                                <div key={r.id}>Warp {i+1}: {r.beamEnds} ends × {r.calcDenier}D @ ₹{r.yarnRate}/kg</div>
                            ))}
                            {state.weftRows.map((r, i) => (
                                <div key={r.id}>Weft {i+1}: {r.picks} PPI × {r.reedSpace}cm × {r.calcDenier}D @ ₹{r.yarnRate}/kg</div>
                            ))}
                            <div className="border-t border-slate-700 pt-1 mt-1">Weave: {state.weftRows.reduce((s,r) => s+r.picks,0)} picks × ₹{state.perPickCostPaisa}/pick</div>
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="border-slate-700 text-slate-400" onClick={() => setShowSaveTemplate(false)}>Cancel</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-500" onClick={handleSaveTemplate} disabled={savingTemplate}>
                            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
                            Save Template
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── CONVERT TO ORDER DIALOG ──────────────────────────────── */}
            <Dialog open={showConvert} onOpenChange={setShowConvert}>
                <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm mx-auto">
                    <DialogHeader>
                        <DialogTitle className="text-white flex items-center gap-2">
                            <Package className="h-5 w-5 text-indigo-400" /> Convert to Floor Order
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        {/* Job card preview */}
                        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
                            <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Job Card Preview</p>
                            <div className="space-y-1 text-sm">
                                {qualityLabel && <div className="flex justify-between"><span className="text-slate-400">Quality</span><span className="font-bold">{qualityLabel}</span></div>}
                                {partyName    && <div className="flex justify-between"><span className="text-slate-400">Party</span><span>{partyName}</span></div>}
                                <div className="flex justify-between">
                                    <span className="text-slate-400">Quote</span>
                                    <span className="font-bold text-indigo-400 font-mono">
                                        ₹{(totals.orderQuote?.quotePricePerM ?? totals.totalProductionCostPerM).toFixed(2)}/m
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Target Metres</Label>
                            <Input
                                type="number"
                                value={targetMeters}
                                onChange={e => setTargetMeters(Number(e.target.value))}
                                className="h-11 font-mono font-bold text-center bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5">
                                <Calendar className="h-3 w-3" /> Delivery Date
                            </Label>
                            <Input
                                type="date"
                                value={deadline}
                                onChange={e => setDeadline(e.target.value)}
                                className="h-11 bg-slate-800 border-slate-600 text-white"
                            />
                        </div>
                        <p className="text-[11px] text-slate-500">
                            Order will be created in <strong className="text-slate-400">Pending Setup</strong> state. The supervisor assigns machines next.
                        </p>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" className="border-slate-700 text-slate-400" onClick={() => setShowConvert(false)}>Cancel</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-500 font-bold gap-2" onClick={handleConvertToOrder} disabled={converting}>
                            {converting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                            Create Floor Order
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
