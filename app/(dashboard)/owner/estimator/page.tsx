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
    Coins,
    Banknote,
    Truck,
    CheckCircle2,
    History,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
    calcFullTotals,
    makeDefaultEstimateState,
    DEFAULT_WARP_ROW,
    DEFAULT_WEFT_ROW,
    DEFAULT_OVERHEAD_ITEMS,
    type EstimateState,
    type WarpRow,
    type WeftRow,
    type OverheadItem,
    type FactorySections,
    type EstimatorV3Totals,
} from '@/lib/estimator'
import {
    getFactoryCostProfile,
    getEstimatorTemplates,
    saveAsFabricTemplate,
    saveEstimatorQuoteV3,
    convertQuoteToOrder,
    getFixedWorkersForOverhead,
    deleteTemplate,
    updateTemplateRates,
    renameTemplate,
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
    | { type: 'MERGE_FIXED_WORKERS'; workers: { id: number; name: string; role: string; monthly_salary: number }[] }
    | { type: 'APPLY_TEMPLATE'; template: any }
    | { type: 'SET'; field: keyof EstimateState; value: any }
    | { type: 'ADD_WARP_ROW' }
    | { type: 'UPDATE_WARP_ROW'; id: string; field: keyof WarpRow; value: any }
    | { type: 'REMOVE_WARP_ROW'; id: string }
    | { type: 'ADD_WEFT_ROW' }
    | { type: 'UPDATE_WEFT_ROW'; id: string; field: keyof WeftRow; value: any }
    | { type: 'REMOVE_WEFT_ROW'; id: string }
    | { type: 'ENABLE_SECTION'; section: keyof FactorySections }
    | { type: 'ADD_OVERHEAD_ITEM' }
    | { type: 'UPDATE_OVERHEAD_ITEM'; id: string; field: 'label' | 'monthlyAmount'; value: any }
    | { type: 'REMOVE_OVERHEAD_ITEM'; id: string }

function estimateReducer(state: EstimateState, action: Action): EstimateState {
    switch (action.type) {
        case 'INIT_FROM_PROFILE': {
            const { profile, sections } = action.data
            // Hydrate overhead items from saved profile if present, else keep defaults
            const savedItems: OverheadItem[] | undefined =
                Array.isArray(profile.overhead_items) && profile.overhead_items.length > 0
                    ? profile.overhead_items
                    : undefined
            return {
                ...state,
                warpingRatePerKg:   Number(profile.warping_rate_per_kg ?? 2),
                sizingRatePerKg:    Number(profile.sizing_rate_per_kg  ?? 1.5),
                windingRatePerKg:   Number(profile.winding_rate_per_kg ?? 0),
                overheadItems:      savedItems ?? state.overheadItems,
                monthlyOutputM:     Number(profile.monthly_output_m ?? 10000),
                overheadOverridePerM: profile.overhead_override_per_m != null ? Number(profile.overhead_override_per_m) : null,
                overheadPct:        0,
                yarnShortagePct:    Number(profile.yarn_shortage_pct ?? 10),
                commissionPct:      Number(profile.default_commission_pct  ?? 2),
                transportPerM:      Number(profile.default_transport_per_m ?? 0),
                enabledSections:    { ...sections },
            }
        }
        case 'MERGE_FIXED_WORKERS': {
            const { workers } = action
            // Remove any existing fixed_worker_derived items, then re-add freshly from DB
            const manualItems = state.overheadItems.filter(i => i.source !== 'fixed_worker_derived')
            const workerItems: OverheadItem[] = workers.map(w => ({
                id:            `fw-${w.id}`,
                label:         `${w.name} (${w.role})`,
                monthlyAmount: Number(w.monthly_salary),
                source:        'fixed_worker_derived' as const,
                workerId:      w.id,
            }))
            return { ...state, overheadItems: [...manualItems, ...workerItems] }
        }
        case 'APPLY_TEMPLATE': {
            const tpl = action.template
            if (tpl.warp_rows && tpl.warp_rows.length > 0) {
                return {
                    ...state,
                    warpRows: tpl.warp_rows.map((r: WarpRow) => ({ ...r, id: nanoid() })),
                    weftRows: tpl.weft_rows && tpl.weft_rows.length > 0
                        ? tpl.weft_rows.map((r: WeftRow) => ({ ...r, id: nanoid() }))
                        : state.weftRows,
                    tapeLengthM:      Number(tpl.tape_length_m ?? state.tapeLengthM),
                    perPickCostPaisa: Number(tpl.per_pick_cost_paise ?? state.perPickCostPaisa),
                    yarnShortagePct:  Number(tpl.yarn_shortage_pct ?? state.yarnShortagePct),
                    overheadOverridePerM: tpl.overhead_override_per_m !== undefined && tpl.overhead_override_per_m !== null ? Number(tpl.overhead_override_per_m) : state.overheadOverridePerM,
                }
            }
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
                overheadOverridePerM: tpl.overhead_override_per_m !== undefined && tpl.overhead_override_per_m !== null ? Number(tpl.overhead_override_per_m) : state.overheadOverridePerM,
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
        case 'ADD_OVERHEAD_ITEM':
            return {
                ...state,
                overheadItems: [
                    ...state.overheadItems,
                    { id: nanoid(), label: 'New Item', monthlyAmount: 0, source: 'manual' as const },
                ],
            }
        case 'UPDATE_OVERHEAD_ITEM':
            return {
                ...state,
                overheadItems: state.overheadItems.map(item =>
                    item.id === action.id ? { ...item, [action.field]: action.value } : item
                ),
            }
        case 'REMOVE_OVERHEAD_ITEM':
            return {
                ...state,
                overheadItems: state.overheadItems.filter(item => item.id !== action.id),
            }
        default:
            return state
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({ title, icon: Icon, accent = 'indigo', badgeContent }: {
    title:    string
    icon:     React.ElementType
    accent?:  'indigo' | 'emerald' | 'amber' | 'violet' | 'rose' | 'orange'
    badgeContent?: React.ReactNode
}) {
    const variants: Record<string, string> = {
        indigo:  'bg-indigo-50 text-indigo-600 border-indigo-100',
        emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
        amber:   'bg-amber-50 text-amber-600 border-amber-100',
        violet:  'bg-violet-50 text-violet-600 border-violet-100',
        rose:    'bg-rose-50 text-rose-600 border-rose-100',
        orange:  'bg-orange-50 text-orange-600 border-orange-100',
    }
    const colorClass = variants[accent]
    return (
        <div className={`px-4 py-3 flex items-center justify-between border-b ${colorClass.split(' ')[2]} ${colorClass.split(' ')[0]}`}>
            <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg bg-white/80 shadow-sm`}>
                    <Icon className={`h-4 w-4 ${colorClass.split(' ')[1]}`} />
                </div>
                <span className="text-sm font-bold tracking-tight">{title}</span>
            </div>
            {badgeContent}
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
        <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{label}</Label>
            <div className="relative group">
                <Input
                    type="number"
                    step={step}
                    min={min}
                    value={value}
                    onChange={e => onChange(Number(e.target.value))}
                    className="h-10 text-sm font-mono font-bold text-center pr-9 bg-white border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-sm group-hover:border-slate-300"
                />
                {unit && (
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {hint && <p className="text-[10px] text-slate-400 font-medium leading-none">{hint}</p>}
        </div>
    )
}

function CostPill({ label, value, type = 'default' }: { label: string; value: number; type?: 'default' | 'warp' | 'weft' | 'weave' | 'primary' }) {
    if (value <= 0) return null
    const base = "shrink-0 text-[10px] rounded-full px-2.5 py-0.5 font-mono font-bold border transition-all"
    const variants: Record<string, string> = {
        default: "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300",
        warp:    "bg-indigo-50 text-indigo-700 border-indigo-100 hover:border-indigo-200",
        weft:    "bg-emerald-50 text-emerald-700 border-emerald-100 hover:border-emerald-200",
        weave:   "bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-200",
        primary: "bg-orange-50 text-orange-700 border-orange-100 hover:border-orange-200",
    }
    return (
        <span className={`${base} ${variants[type] || variants.default}`}>
            {label} ₹{value.toFixed(2)}
        </span>
    )
}

function RowCard({
    title, index, onRemove, canRemove, kgPer100m, costPer100m, children, accent = 'indigo'
}: {
    title: string; index: number; onRemove: () => void; canRemove: boolean
    kgPer100m: number; costPer100m: number; children: React.ReactNode; accent?: 'indigo' | 'emerald'
}) {
    const colors = {
        indigo:  { text: 'text-indigo-600', bg: 'bg-indigo-50/50', border: 'border-indigo-100' },
        emerald: { text: 'text-emerald-600', bg: 'bg-emerald-50/50', border: 'border-emerald-100' },
    }
    const c = colors[accent]
    return (
        <div className={`rounded-xl border ${c.border} ${c.bg} p-3.5 space-y-3.5 relative overflow-hidden group`}>
            {/* Component label */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-widest font-black ${c.text}`}>
                        {title} {index + 1}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-white border-slate-200 text-slate-500 font-mono">
                        {kgPer100m.toFixed(3)} kg/100m
                    </Badge>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-500 font-bold font-mono">
                        ₹{costPer100m.toFixed(2)}/100m
                    </span>
                    {canRemove && (
                        <button onClick={onRemove} className="text-slate-300 hover:text-red-500 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 relative z-10">
                {children}
            </div>
            {/* Subtle row indicator */}
            <div className={`absolute left-0 top-0 bottom-0 w-1 ${accent === 'indigo' ? 'bg-indigo-500/20' : 'bg-emerald-500/20'}`} />
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function EstimatorPage() {
    const router = useRouter()
    const { t } = useTranslation()
    const [state, dispatch] = useReducer(estimateReducer, makeDefaultEstimateState())
    const [loading,   setLoading]   = useState(true)
    const [saving,    setSaving]    = useState(false)
    const [converting, setConverting] = useState(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templates, setTemplates] = useState<any[]>([])

    const [partyName,       setPartyName]       = useState('')
    const [qualityLabel,    setQualityLabel]    = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const [targetMeters,    setTargetMeters]    = useState(1000)
    const [deadline,        setDeadline]        = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))

    const [showSaveTemplate, setShowSaveTemplate] = useState(false)
    const [showConvert,      setShowConvert]      = useState(false)
    const [templateName,     setTemplateName]     = useState('')

    // Template management — "edit rates" sheet
    const [editRatesTpl,     setEditRatesTpl]     = useState<any | null>(null)
    const [editingTplName,   setEditingTplName]   = useState('')
    const [editingWarpRates, setEditingWarpRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [editingWeftRates, setEditingWeftRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [savingRates,      setSavingRates]      = useState(false)
    const [deletingTpl,      setDeletingTpl]      = useState<string | null>(null)

    useEffect(() => {
        async function load() {
            setLoading(true)
            const [pRes, tRes, wRes] = await Promise.all([
                getFactoryCostProfile(),
                getEstimatorTemplates(),
                getFixedWorkersForOverhead(),
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
            // Merge fixed workers into overhead items (only if not already saved in profile)
            if (wRes.data && wRes.data.length > 0) {
                // If profile had no saved overhead_items, we merge workers into the defaults
                const profileHasItems = Array.isArray(pRes.data?.overhead_items) && pRes.data.overhead_items.length > 0
                if (!profileHasItems) {
                    dispatch({ type: 'MERGE_FIXED_WORKERS', workers: wRes.data })
                }
            }
            setLoading(false)
        }
        load()
    }, [])

    const totals: EstimatorV3Totals = useMemo(() => calcFullTotals(state), [state])

    const applyTemplate = useCallback((tpl: any) => {
        dispatch({ type: 'APPLY_TEMPLATE', template: tpl })
        setQualityLabel(tpl.name)
        toast.success(`${t('estimator.toast.applied_template')} ${tpl.name}`)
    }, [t])

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return toast.error(t('estimator.toast.save_template_name_error'))
        setSavingTemplate(true)
        const res = await saveAsFabricTemplate({
            name:             templateName.trim(),
            warpRows:         state.warpRows,
            weftRows:         state.weftRows,
            tapeLengthM:      state.tapeLengthM,
            perPickCostPaisa: state.perPickCostPaisa,
            yarnShortagePct:  state.yarnShortagePct,
            overheadOverridePerM: state.overheadOverridePerM,
        })
        setSavingTemplate(false)
        if (res.success) {
            const tRes = await getEstimatorTemplates()
            if (tRes.data) setTemplates(tRes.data)
            setShowSaveTemplate(false)
            setTemplateName('')
            toast.success(t('estimator.toast.saved_template'))
        } else {
            toast.error(res.error ?? 'Failed to save template')
        }
    }

    /** Open the "update rates" sheet for a template. */
    const openEditRates = useCallback((tpl: any) => {
        const warpRows: WarpRow[] = tpl.warp_rows ?? []
        const weftRows: WeftRow[] = tpl.weft_rows ?? []
        setEditRatesTpl(tpl)
        setEditingTplName(tpl.name)
        setEditingWarpRates(warpRows.map((r: WarpRow) => ({ id: r.id, yarnRate: r.yarnRate })))
        setEditingWeftRates(weftRows.map((r: WeftRow) => ({ id: r.id, yarnRate: r.yarnRate })))
    }, [])

    /** Persist updated rates to template row AND apply to the estimator. */
    const handleSaveRatesAndApply = async () => {
        if (!editRatesTpl) return
        setSavingRates(true)

        // 1. Rename if changed
        if (editingTplName.trim() && editingTplName.trim() !== editRatesTpl.name) {
            const renameRes = await renameTemplate(editRatesTpl.id, editingTplName.trim())
            if (renameRes.error) {
                setSavingRates(false)
                toast.error(`${t('estimator.toast.rename_failed')} ${renameRes.error}`)
                return
            }
        }

        // 2. Update rates
        const updatedWarp: WarpRow[] = (editRatesTpl.warp_rows ?? []).map((r: WarpRow) => ({
            ...r,
            yarnRate: editingWarpRates.find(x => x.id === r.id)?.yarnRate ?? r.yarnRate,
        }))
        const updatedWeft: WeftRow[] = (editRatesTpl.weft_rows ?? []).map((r: WeftRow) => ({
            ...r,
            yarnRate: editingWeftRates.find(x => x.id === r.id)?.yarnRate ?? r.yarnRate,
        }))
        
        const res = await updateTemplateRates({ id: editRatesTpl.id, warpRows: updatedWarp, weftRows: updatedWeft })
        setSavingRates(false)
        if (res.error) { toast.error(res.error); return }

        // Success: refresh and apply
        const tRes = await getEstimatorTemplates()
        if (tRes.data) setTemplates(tRes.data)
        
        dispatch({
            type: 'APPLY_TEMPLATE',
            template: { ...editRatesTpl, name: editingTplName.trim(), warp_rows: updatedWarp, weft_rows: updatedWeft }
        })
        setQualityLabel(editingTplName.trim())
        setEditRatesTpl(null)
        toast.success(t('estimator.toast.updated_applied'))
    }

    /** Apply template directly (without editing rates). */
    const handleApplyCurrentRates = () => {
        if (!editRatesTpl) return
        dispatch({ type: 'APPLY_TEMPLATE', template: editRatesTpl })
        setQualityLabel(editRatesTpl.name)
        setEditRatesTpl(null)
        toast.success(`${t('estimator.toast.applied_as_is')} ${editRatesTpl.name}`)
    }

    const handleDeleteTemplate = async (id: string) => {
        setDeletingTpl(id)
        const res = await deleteTemplate(id)
        setDeletingTpl(null)
        if (res.error) { toast.error(res.error); return }
        setTemplates(prev => prev.filter(t => t.id !== id))
        toast.success(t('estimator.toast.template_deleted'))
    }

    const handleConvertToOrder = async () => {
        if (!partyName.trim())   return toast.error(t('estimator.toast.party_required'))
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
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
            toast.success(t('estimator.toast.converted_success'))
            router.push('/owner/orders')
        } else {
            toast.error(res.error ?? 'Failed to create order')
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-20">
                <Loader2 className="h-10 w-10 animate-spin text-brand-accent/40" />
            </div>
        )
    }

    const { orderQuote } = totals
    const hasOrderQty    = !!(state.orderQuantityM && state.orderQuantityM > 0)

    return (
        <div className="space-y-6 pb-20">

            {/* ── STICKY HUD ───────────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border/50 shadow-sm -mt-6 pt-6 pb-4 px-4 mx-[-24px] sm:mx-[-32px] md:mx-[-40px]">
                <div className="max-w-4xl mx-auto space-y-4">

                    <div className="flex items-center gap-4">
                        {/* Production Cost */}
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{t('estimator.hud.prod_cost')}</p>
                            <p className="text-2xl font-black font-mono text-slate-900 leading-none">
                                ₹{totals.totalProductionCostPerM.toFixed(2)}
                            </p>
                        </div>

                        {hasOrderQty && orderQuote && (
                            <>
                                <div className="h-8 w-px bg-slate-200 shrink-0 hidden sm:block" />
                                {/* Quote Price */}
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-brand-accent font-black">{t('estimator.hud.quote_per_m')}</p>
                                    <p className="text-3xl font-black font-mono text-brand-accent leading-none">
                                        ₹{orderQuote.quotePricePerM.toFixed(2)}
                                    </p>
                                </div>
                                <div className="h-8 w-px bg-slate-200 shrink-0 hidden md:block" />
                                {/* Total Value */}
                                <div className="min-w-0 flex-1 hidden md:block text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold">{t('estimator.hud.total_order')}</p>
                                    <p className="text-xl font-black font-mono text-slate-900 leading-none">
                                        ₹{orderQuote.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 ml-auto shrink-0 self-center">
                            <Button
                                size="sm"
                                className="h-9 px-4 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs gap-2 shadow-lg shadow-brand-accent/15"
                                onClick={() => setShowConvert(true)}
                            >
                                <Package className="h-3.5 w-3.5" /> {t('estimator.hud.order_btn')}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-9 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs gap-2 font-bold"
                                onClick={() => setShowSaveTemplate(true)}
                            >
                                <BookmarkPlus className="h-3.5 w-3.5" /> {t('estimator.hud.save_template_btn')}
                            </Button>
                        </div>
                    </div>

                    {/* HUD Row 2: Margin slider */}
                    {hasOrderQty && orderQuote && (
                        <div className="flex items-center gap-4 bg-orange-50/50 p-2.5 rounded-xl border border-orange-100">
                            <div className="shrink-0">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('estimator.hud.margin')}</p>
                                <p className="text-sm font-black text-brand-accent leading-none">{state.profitPct.toFixed(1)}%</p>
                            </div>
                            <input
                                type="range"
                                min={0} max={40} step={0.5}
                                value={state.profitPct}
                                onChange={e => dispatch({ type: 'SET', field: 'profitPct', value: Number(e.target.value) })}
                                className="flex-1 h-2 rounded-full bg-slate-200 appearance-none cursor-pointer accent-brand-accent"
                            />
                            <div className="shrink-0 text-right">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('estimator.hud.net_profit')}</p>
                                <p className="text-sm font-black text-emerald-600 leading-none">
                                    ₹{orderQuote.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* HUD Row 3: Pills */}
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pt-1">
                        <CostPill label="🧶 Warp"           value={totals.warpCostPerM}    type="warp" />
                        <CostPill label="🧵 Weft"           value={totals.weftCostPerM}    type="weft" />
                        <CostPill label="⚙️ Weave"          value={totals.weaveCostPerM}   type="weave" />
                        <CostPill label="🔀 Warp+Size"      value={totals.warpingAndSizingPerM} />
                        {totals.windingPerM > 0     && <CostPill label="🌀 Winding"    value={totals.windingPerM} />}
                        {totals.processingPerM > 0  && <CostPill label="🎨 Processing" value={totals.processingPerM} type="primary" />}
                        {totals.finishingPerM > 0   && <CostPill label="✨ Finishing"  value={totals.finishingPerM} type="primary" />}
                        <CostPill label="🏭 Overhead"       value={totals.overheadPerM} />
                    </div>
                </div>
            </div>

            {/* ── MAIN FORM ────────────────────────────────────────────── */}
            <div className="max-w-4xl mx-auto space-y-6">

                {/* Fabric Templates Row */}
                {templates.length > 0 && (
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <History className="h-3.5 w-3.5 text-slate-400" />
                            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-black">{t('estimator.templates.label')}</p>
                            <span className="ml-auto text-[10px] text-slate-400 font-medium">{t('estimator.templates.hint')}</span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                            {templates.map(tpl => (
                                <div key={tpl.id} className="relative shrink-0 group">
                                    <button
                                        onClick={() => applyTemplate(tpl)}
                                        onContextMenu={e => { e.preventDefault(); openEditRates(tpl) }}
                                        className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all shadow-sm ${
                                            qualityLabel === tpl.name
                                                ? 'bg-brand-accent border-brand-accent text-white shadow-brand-accent/20'
                                                : 'bg-white border-slate-200 text-slate-600 hover:border-brand-accent/50 hover:bg-slate-50'
                                        } pr-8`}
                                    >
                                        {tpl.name}
                                    </button>
                                    {/* Edit rates button — visible on hover */}
                                    <button
                                        onClick={e => { e.stopPropagation(); openEditRates(tpl) }}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-md hover:bg-brand-accent/10 text-slate-400 hover:text-brand-accent"
                                        title={t('estimator.templates.edit_rates_title')}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 1. Order Basics */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.order_basics.title')} icon={Layers} accent="indigo" />
                    <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.order_basics.party')}</Label>
                                <Input
                                    value={partyName}
                                    onChange={e => setPartyName(e.target.value)}
                                    placeholder="Sundaram Textiles"
                                    className="font-bold border-slate-200 h-11"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.order_basics.quality_label')}</Label>
                                <Input
                                    value={qualityLabel}
                                    onChange={e => setQualityLabel(e.target.value)}
                                    placeholder="Japan Satin, Canvas Shine"
                                    className="font-bold border-slate-200 h-11"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.order_basics.warp_construction')}</Label>
                                <Input
                                    value={warpInstruction}
                                    onChange={e => setWarpInstruction(e.target.value)}
                                    placeholder="50/48 + Rainbow"
                                    className="text-sm font-medium border-slate-200 h-11"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.order_basics.weft_construction')}</Label>
                                <Input
                                    value={weftInstruction}
                                    onChange={e => setWeftInstruction(e.target.value)}
                                    placeholder="50/48 - 68 Picks"
                                    className="text-sm font-medium border-slate-200 h-11"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. Warp Yarn Rows */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader 
                        title={t('estimator.warp.title')} 
                        icon={Sparkles} 
                        accent="indigo"
                        badgeContent={<div className="text-[11px] font-mono font-bold text-indigo-700 bg-white/60 px-2 py-0.5 rounded-md border border-indigo-100">₹{totals.warpCostPerM.toFixed(2)}/m</div>}
                    />
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-4">
                            {state.warpRows.map((row, i) => (
                                <RowCard
                                    key={row.id}
                                    title={t('estimator.warp.layer')}
                                    index={i}
                                    accent="indigo"
                                    canRemove={state.warpRows.length > 1}
                                    onRemove={() => dispatch({ type: 'REMOVE_WARP_ROW', id: row.id })}
                                    kgPer100m={totals.warpRows[i]?.kgPer100m ?? 0}
                                    costPer100m={totals.warpRows[i]?.costPer100m ?? 0}
                                >
                                    <NumField label={t('estimator.field_labels.calc_denier')} value={row.calcDenier} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calcDenier', value: v })} unit="D" step={0.5} />
                                    <NumField label={t('estimator.field_labels.beam_ends')} value={row.beamEnds} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: v })} />
                                    <NumField label={t('estimator.field_labels.rate_kg')} value={row.yarnRate} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: v })} step={1} />
                                    <NumField label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: v })} step={0.5} />
                                </RowCard>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-slate-300 py-6 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition-all gap-2"
                            onClick={() => dispatch({ type: 'ADD_WARP_ROW' })}
                        >
                            <Plus className="h-4 w-4" /> {t('estimator.warp.add_blend')}
                        </Button>
                        <div className="pt-4 flex items-center justify-between border-t border-slate-100">
                           <div className="w-32"><NumField label={t('estimator.warp.tape_len')} value={state.tapeLengthM} onChange={v => dispatch({ type: 'SET', field: 'tapeLengthM', value: v })} unit="m" /></div>
                           <div className="text-right">
                               <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{t('estimator.warp.beam_capacity')}</p>
                               <p className="text-lg font-black font-mono text-indigo-600 leading-none">≈ {totals.estimatedBeamCapacityM.toFixed(0)} m</p>
                           </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. Weft Yarn Rows */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader 
                        title={t('estimator.weft.title')} 
                        icon={Scissors} 
                        accent="emerald"
                        badgeContent={<div className="text-[11px] font-mono font-bold text-emerald-700 bg-white/60 px-2 py-0.5 rounded-md border border-emerald-100">₹{totals.weftCostPerM.toFixed(2)}/m</div>}
                    />
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-4">
                            {state.weftRows.map((row, i) => (
                                <RowCard
                                    key={row.id}
                                    title={t('estimator.weft.layer')}
                                    index={i}
                                    accent="emerald"
                                    canRemove={state.weftRows.length > 1}
                                    onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })}
                                    kgPer100m={totals.weftRows[i]?.kgPer100m ?? 0}
                                    costPer100m={totals.weftRows[i]?.costPer100m ?? 0}
                                >
                                    <NumField label={t('estimator.field_labels.picks_ppi')} value={row.picks} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: v })} />
                                    <NumField label={t('estimator.field_labels.cloth_width')} value={row.reedSpace} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: v })} unit="cm" hint={t('estimator.weft.cloth_width_hint')} />
                                    <NumField label={t('estimator.field_labels.calc_denier')} value={row.calcDenier} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calcDenier', value: v })} unit="D" step={0.5} />
                                    <NumField label={t('estimator.field_labels.rate_kg')} value={row.yarnRate} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: v })} />
                                    <NumField label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: v })} step={0.5} />
                                </RowCard>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            className="w-full border-dashed border-slate-300 py-6 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all gap-2"
                            onClick={() => dispatch({ type: 'ADD_WEFT_ROW' })}
                        >
                            <Plus className="h-4 w-4" /> {t('estimator.weft.add_weft')}
                        </Button>
                    </CardContent>
                </Card>

                {/* 4. Weave Cost */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.weave.title')} icon={Gauge} accent="amber" />
                    <CardContent className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                            <NumField 
                                label={t('estimator.weave.looms_charge')} 
                                value={state.perPickCostPaisa} 
                                onChange={v => dispatch({ type: 'SET', field: 'perPickCostPaisa', value: v })} 
                                unit="₹/pick"
                                step={0.01} 
                                hint={t('estimator.weave.paise_hint')}
                            />
                            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-100 flex items-center justify-between">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest leading-none mb-1">{t('estimator.weave.ppi_impact')}</p>
                                    <p className="text-sm font-bold text-slate-600">{state.weftRows.reduce((a,b)=>a+b.picks, 0)} {t('estimator.weave.picks')}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-amber-600/70 tracking-widest leading-none mb-1">{t('estimator.weave.cost_per_m')}</p>
                                    <p className="text-xl font-black font-mono text-amber-700">₹{totals.weaveCostPerM.toFixed(2)}</p>
                                </div>
                            </div>
                       </div>

                        {/* Combined Yarn Shortage */}
                        <div className="mt-5 pt-4 border-t border-amber-100">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                                <NumField
                                    label={t('estimator.weave.shortage_title')}
                                    value={state.yarnShortagePct}
                                    onChange={v => dispatch({ type: 'SET', field: 'yarnShortagePct', value: v })}
                                    unit="%"
                                    step={0.5}
                                    hint={t('estimator.weave.shortage_hint')}
                                />
                                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                    <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                                        <span>{t('estimator.weave.base_yarn')}</span>
                                        <span className="font-mono font-bold text-slate-700">₹{(totals.yarnBaseWarpPerM + totals.yarnBaseWeftPerM).toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-amber-600 font-medium">
                                        <span>+ {state.yarnShortagePct}% {t('estimator.weave.shortage_row')}</span>
                                        <span className="font-mono font-bold">+₹{totals.yarnShortageCostPerM.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between text-[11px] font-black border-t border-slate-200 pt-1.5 text-slate-800">
                                        <span>{t('estimator.weave.total_yarn')}</span>
                                        <span className="font-mono">₹{(totals.warpCostPerM + totals.weftCostPerM).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 5. Warping & Sizing */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.warping_sizing.title')} icon={TrendingUp} accent="violet" />
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <NumField label={t('estimator.warping_sizing.warping_per_kg')} value={state.warpingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: v })} step={0.1} />
                            <NumField label={t('estimator.warping_sizing.sizing_per_kg')} value={state.sizingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: v })} step={0.1} />
                        </div>
                        <div className="text-[10px] font-medium text-slate-400 italic">
                            {t('estimator.warping_sizing.applied_on')} {totals.totalWarpKgPer100m.toFixed(2)} {t('estimator.warping_sizing.warp_consumption')}
                        </div>
                    </CardContent>
                </Card>

                {/* 5b. Factory Overhead — Itemized Breakdown */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader
                        title={t('estimator.overhead.title')}
                        icon={Calculator}
                        accent="rose"
                        badgeContent={
                            <div className="flex items-center gap-2">
                                <span className="text-[11px] font-mono font-bold text-rose-700 bg-white/60 px-2 py-0.5 rounded-md border border-rose-100">
                                    ₹{totals.overheadPerM.toFixed(2)}/m
                                </span>
                                <span className="text-[10px] font-bold text-slate-400 bg-white/60 px-2 py-0.5 rounded-md border border-slate-200">
                                    {totals.effectiveOverheadPct.toFixed(1)}% {t('estimator.overhead.effective_pct')}
                                </span>
                            </div>
                        }
                    />
                    <CardContent className="p-5 space-y-5">

                        {/* Facility & Running Costs */}
                        <div className="space-y-2">
                            <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{t('estimator.overhead.facility_costs')}</p>
                            <div className="space-y-2">
                                {state.overheadItems
                                    .filter(item => item.source === 'manual')
                                    .map(item => (
                                        <div key={item.id} className="flex items-center gap-2 bg-rose-50/40 border border-rose-100 rounded-xl px-3 py-2">
                                            <Input
                                                value={item.label}
                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'label', value: e.target.value })}
                                                className="flex-1 h-8 text-xs font-semibold border-0 bg-transparent focus:bg-white focus:border-rose-200 focus:ring-1 focus:ring-rose-200/50 transition-all px-2"
                                                placeholder={t('estimator.overhead.item_placeholder')}
                                            />
                                            <div className="relative shrink-0 w-36">
                                                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={500}
                                                    value={item.monthlyAmount}
                                                    onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: Number(e.target.value) })}
                                                    className="h-8 text-xs font-mono font-bold text-right pr-10 pl-6 border-rose-100 focus:border-rose-300 bg-white"
                                                />
                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">/mo</span>
                                            </div>
                                            <button
                                                onClick={() => dispatch({ type: 'REMOVE_OVERHEAD_ITEM', id: item.id })}
                                                className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))
                                }
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full border-dashed border-rose-200 text-[10px] font-bold text-rose-500 hover:bg-rose-50 hover:border-rose-300 transition-all gap-1.5 h-8 uppercase tracking-widest"
                                onClick={() => dispatch({ type: 'ADD_OVERHEAD_ITEM' })}
                            >
                                <Plus className="h-3 w-3" /> {t('estimator.overhead.add_cost_item')}
                            </Button>
                        </div>

                        {/* Fixed Salary Workers — DB derived */}
                        {state.overheadItems.filter(i => i.source === 'fixed_worker_derived').length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{t('estimator.overhead.fixed_salary_workers')}</p>
                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 bg-violet-50 border-violet-100 text-violet-600 font-bold">
                                        {t('estimator.overhead.pulled_from_registry')}
                                    </Badge>
                                </div>
                                <div className="space-y-2">
                                    {state.overheadItems
                                        .filter(item => item.source === 'fixed_worker_derived')
                                        .map(item => (
                                            <div key={item.id} className="flex items-center gap-2 bg-violet-50/40 border border-violet-100 rounded-xl px-3 py-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[11px] font-bold text-slate-700 truncate">{item.label}</p>
                                                    <p className="text-[9px] text-violet-500 font-semibold uppercase tracking-wider">Fixed Salary</p>
                                                </div>
                                                <div className="relative shrink-0 w-36">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step={500}
                                                        value={item.monthlyAmount}
                                                        onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: Number(e.target.value) })}
                                                        className="h-8 text-xs font-mono font-bold text-right pr-10 pl-6 border-violet-100 focus:border-violet-300 bg-white"
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">/mo</span>
                                                </div>
                                                <button
                                                    onClick={() => dispatch({ type: 'REMOVE_OVERHEAD_ITEM', id: item.id })}
                                                    className="text-slate-300 hover:text-red-500 transition-colors shrink-0"
                                                    title="Exclude from overhead"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    }
                                </div>
                                <p className="text-[10px] text-violet-400 italic font-medium px-1">
                                    {t('estimator.overhead.pre_filled_note')}
                                </p>
                            </div>
                        )}

                        {/* Monthly Output Denominator + Summary */}
                        <div className="pt-4 border-t border-rose-100 space-y-3">
                            <div className="flex items-end gap-4">
                                <div className="flex-1 space-y-1.5">
                                    <Label className="text-[10px] uppercase tracking-wider font-black text-slate-500">{t('estimator.overhead.monthly_output')}</Label>
                                    <div className="relative">
                                        <Input
                                            type="number"
                                            min={1}
                                            step={500}
                                            value={state.monthlyOutputM}
                                            onChange={e => dispatch({ type: 'SET', field: 'monthlyOutputM', value: Number(e.target.value) })}
                                            className="h-10 text-sm font-mono font-bold text-center pr-9 bg-white border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-sm"
                                        />
                                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">m</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-medium">{t('estimator.overhead.output_hint')}</p>
                                </div>
                                <div className="shrink-0 text-right pb-7">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">{t('estimator.overhead.total_monthly')}</p>
                                    <p className="text-lg font-black font-mono text-rose-600 leading-none">
                                        ₹{totals.overheadTotalMonthly.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            </div>

                            {/* Direct Override Input */}
                            <div className={`rounded-xl border-2 transition-all ${
                                state.overheadOverridePerM != null && state.overheadOverridePerM > 0
                                    ? 'border-amber-400 bg-amber-50/60'
                                    : 'border-dashed border-slate-200 bg-slate-50/40'
                            } px-4 py-3 space-y-2`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-600">
                                            {t('estimator.overhead.direct_override_title')}
                                        </p>
                                        <p className="text-[10px] text-slate-400 font-medium">
                                            {state.overheadOverridePerM != null && state.overheadOverridePerM > 0
                                                ? t('estimator.overhead.override_active_note')
                                                : t('estimator.overhead.override_bypass_note')}
                                        </p>
                                    </div>
                                    {state.overheadOverridePerM != null && state.overheadOverridePerM > 0 && (
                                        <button
                                            onClick={() => dispatch({ type: 'SET', field: 'overheadOverridePerM', value: null })}
                                            className="text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-2 py-1 transition-all"
                                        >
                                            {t('estimator.overhead.clear')}
                                        </button>
                                    )}
                                </div>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none">₹</span>
                                    <Input
                                        type="number"
                                        min={0}
                                        step={0.5}
                                        placeholder="e.g. 12.50"
                                        value={state.overheadOverridePerM ?? ''}
                                        onChange={e => {
                                            const v = e.target.value
                                            dispatch({ type: 'SET', field: 'overheadOverridePerM', value: v === '' ? null : Number(v) })
                                        }}
                                        className={`h-10 text-sm font-mono font-bold pl-8 pr-14 transition-all ${
                                            state.overheadOverridePerM != null && state.overheadOverridePerM > 0
                                                ? 'border-amber-400 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-300/50'
                                                : 'border-slate-200 bg-white focus:border-slate-300'
                                        }`}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₹/m</span>
                                </div>
                            </div>

                            {/* Live Summary */}
                            <div className="flex items-center justify-between bg-rose-50/70 border border-rose-100 rounded-xl px-4 py-3">
                                <div>
                                    <p className="text-[10px] font-black uppercase tracking-widest text-rose-600/80 leading-none mb-1">{t('estimator.overhead.overhead_per_m')}</p>
                                    <p className="text-2xl font-black font-mono text-rose-700 leading-none">₹{totals.overheadPerM.toFixed(2)}</p>
                                    {state.overheadOverridePerM != null && state.overheadOverridePerM > 0 && (
                                        <p className="text-[9px] text-amber-600 font-bold mt-0.5">⚡ direct override</p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">{t('estimator.overhead.effective_rate')}</p>
                                    <p className="text-2xl font-black font-mono text-slate-700 leading-none">{totals.effectiveOverheadPct.toFixed(1)}%</p>
                                    <p className="text-[9px] text-slate-400 mt-0.5">{t('estimator.overhead.of_direct_cost')} ₹{totals.directCostPerM.toFixed(2)}/m</p>
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>



                {/* 6. Optional Sections */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.post_processing.title')} icon={Palette} accent="orange" />
                    <CardContent className="p-5 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {state.enabledSections.winding ? (
                                <NumField label={t('estimator.field_labels.winding_per_kg')} value={state.windingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'windingRatePerKg', value: v })} unit="₹/kg" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'winding' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.winding')}</button>
                            )}
                            {state.enabledSections.processing ? (
                                <NumField label={t('estimator.field_labels.dyeing_processing')} value={state.processingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'processingRatePerM', value: v })} unit="₹/m" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'processing' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.processing')}</button>
                            )}
                            {state.enabledSections.finishing ? (
                                <NumField label={t('estimator.field_labels.finishing_per_m')} value={state.finishingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'finishingRatePerM', value: v })} unit="₹/m" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'finishing' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.finishing')}</button>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* 7. Simulation / Order */}
                <Card className="border-border/60 shadow-sm overflow-hidden bg-slate-50/20">
                    <SectionHeader title={t('estimator.simulation.title')} icon={Coins} accent="emerald" />
                    <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <NumField 
                                label={t('estimator.field_labels.simulation_qty')} 
                                value={state.orderQuantityM ?? 1000} 
                                onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: v > 0 ? v : null })} 
                                unit="m" 
                                step={100}
                                hint={t('estimator.simulation.quantity_hint')}
                            />
                            {hasOrderQty && (
                                <>
                                    <NumField label={t('estimator.field_labels.broker_comm')} value={state.commissionPct} onChange={v => dispatch({ type: 'SET', field: 'commissionPct', value: v })} unit="%" step={0.5} />
                                    <NumField label={t('estimator.field_labels.transport_per_m')} value={state.transportPerM} onChange={v => dispatch({ type: 'SET', field: 'transportPerM', value: v })} unit="₹/m" step={0.1} />
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── DIALOGS ────────────────────────────────────────────────── */}

            {/* Save Template Dialog */}
            <Dialog open={showSaveTemplate} onOpenChange={setShowSaveTemplate}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('estimator.save_template_dialog.title')}</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.save_template_dialog.quality_name_label')}</Label>
                            <Input
                                placeholder="Japan Satin, Canvas Shine"
                                value={templateName}
                                onChange={e => setTemplateName(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
                                autoFocus
                            />
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 leading-relaxed space-y-1">
                            <p>{t('estimator.save_template_dialog.saves_note_prefix')} {state.warpRows.length} {t('estimator.save_template_dialog.saves_note_warp')} {state.weftRows.length} {t('estimator.save_template_dialog.saves_note_weft')}</p>
                            <p className="text-slate-400">{t('estimator.save_template_dialog.rate_note')}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowSaveTemplate(false)}>{t('estimator.save_template_dialog.cancel')}</Button>
                        <Button className="bg-brand-accent text-white" onClick={handleSaveTemplate} disabled={savingTemplate}>
                            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {t('estimator.save_template_dialog.confirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Template Rates Dialog */}
            <Dialog open={!!editRatesTpl} onOpenChange={open => { if (!open) setEditRatesTpl(null) }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            {t('estimator.edit_template_dialog.title')} {editRatesTpl?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-3 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.edit_template_dialog.quality_name_label')}</Label>
                            <Input
                                value={editingTplName}
                                onChange={e => setEditingTplName(e.target.value)}
                                className="font-bold border-slate-200"
                            />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {t('estimator.edit_template_dialog.structure_note_prefix')} <span className="font-bold text-slate-700">{t('estimator.edit_template_dialog.structure_note_and')}</span> {t('estimator.edit_template_dialog.structure_note_suffix')}
                        </p>

                        {/* Warp rates */}
                        {editingWarpRates.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-widest font-black text-indigo-600">{t('estimator.edit_template_dialog.warp_rates')}</p>
                                {(editRatesTpl?.warp_rows ?? []).map((row: WarpRow, i: number) => (
                                    <div key={row.id} className="flex items-center gap-3 bg-indigo-50/50 border border-indigo-100 rounded-xl px-3 py-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold text-slate-700">{row.label ?? `Warp ${i + 1}`}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{row.calcDenier}D · {row.beamEnds} ends · {row.gstPct}% GST</p>
                                        </div>
                                        <div className="relative shrink-0 w-32">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={editingWarpRates.find(x => x.id === row.id)?.yarnRate ?? row.yarnRate}
                                                onChange={e => setEditingWarpRates(prev =>
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: Number(e.target.value) } : x)
                                                )}
                                                className="h-8 text-xs font-mono font-bold text-right pr-10 pl-6 border-indigo-100 focus:border-indigo-300 bg-white"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">/kg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Weft rates */}
                        {editingWeftRates.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-widest font-black text-emerald-600">{t('estimator.edit_template_dialog.weft_rates')}</p>
                                {(editRatesTpl?.weft_rows ?? []).map((row: WeftRow, i: number) => (
                                    <div key={row.id} className="flex items-center gap-3 bg-emerald-50/50 border border-emerald-100 rounded-xl px-3 py-2.5">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-bold text-slate-700">{row.label ?? `Weft ${i + 1}`}</p>
                                            <p className="text-[10px] text-slate-400 font-mono">{row.calcDenier}D · {row.picks} PPI · {row.gstPct}% GST</p>
                                        </div>
                                        <div className="relative shrink-0 w-32">
                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={editingWeftRates.find(x => x.id === row.id)?.yarnRate ?? row.yarnRate}
                                                onChange={e => setEditingWeftRates(prev =>
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: Number(e.target.value) } : x)
                                                )}
                                                className="h-8 text-xs font-mono font-bold text-right pr-10 pl-6 border-emerald-100 focus:border-emerald-300 bg-white"
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">/kg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Delete zone */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                            <button
                                onClick={() => {
                                    if (editRatesTpl && window.confirm(t('estimator.edit_template_dialog.delete_confirm').replace('{name}', editRatesTpl.name))) {
                                        handleDeleteTemplate(editRatesTpl.id)
                                        setEditRatesTpl(null)
                                    }
                                }}
                                disabled={deletingTpl === editRatesTpl?.id}
                                className="text-[11px] font-bold text-red-400 hover:text-red-600 transition-colors flex items-center gap-1"
                            >
                                    <Trash2 className="h-3 w-3" />
                                    {t('estimator.edit_template_dialog.delete_button')}
                                </button>
                                <p className="text-[10px] text-slate-400">{t('estimator.edit_template_dialog.delete_note')}</p>
                        </div>
                    </div>
                    <DialogFooter className="flex-col sm:flex-row gap-2">
                        <Button variant="ghost" size="sm" onClick={handleApplyCurrentRates} className="text-slate-500">
                            {t('estimator.edit_template_dialog.apply_as_is')}
                        </Button>
                        <Button className="bg-brand-accent text-white" onClick={handleSaveRatesAndApply} disabled={savingRates}>
                            {savingRates ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {t('estimator.edit_template_dialog.save_apply')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Convert Dialog */}
            <Dialog open={showConvert} onOpenChange={setShowConvert}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                           <Banknote className="h-5 w-5 text-emerald-500" />
                           {t('estimator.convert_dialog.title')}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-2 space-y-4">
                        {/* ── Cost Summary Recap ── */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                            <div className="px-3 py-2 bg-slate-100 border-b border-slate-200">
                                <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{t('estimator.convert_dialog.cost_summary_title')}</p>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500 font-medium">{t('estimator.convert_dialog.prod_cost')}</span>
                                    <span className="font-mono font-bold text-sm text-slate-800">₹{totals.totalProductionCostPerM.toFixed(2)}/m</span>
                                </div>
                                {totals.orderQuote && (
                                    <>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500 font-medium">{t('estimator.convert_dialog.quote_price')}</span>
                                            <span className="font-mono font-bold text-base text-brand-accent">₹{totals.orderQuote?.quotePricePerM.toFixed(2)}/m</span>
                                        </div>
                                        <div className="flex justify-between items-center border-t border-slate-200 pt-2">
                                            <span className="text-xs text-slate-500 font-medium">
                                                {t('estimator.convert_dialog.total_order_value')}
                                                <span className="ml-1 text-slate-400">({targetMeters.toLocaleString('en-IN')}m)</span>
                                            </span>
                                            <span className="font-mono font-black text-sm text-emerald-700">
                                                ₹{totals.orderQuote?.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-slate-500 font-medium">{t('estimator.convert_dialog.gross_profit')}</span>
                                            <span className="font-mono font-bold text-sm text-emerald-600">
                                                ₹{totals.orderQuote?.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                <span className="text-slate-400 font-normal"> ({state.profitPct.toFixed(1)}%)</span>
                                            </span>
                                        </div>
                                    </>
                                )}
                                {!totals.orderQuote && (
                                    <p className="text-[11px] text-slate-400 italic">{t('estimator.convert_dialog.order_qty_hint')}</p>
                                )}
                                {/* Cost stack mini-pills */}
                                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
                                    {totals.warpCostPerM > 0 && <span className="text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 px-2 py-0.5 rounded-full font-mono">🧶 ₹{totals.warpCostPerM.toFixed(2)}</span>}
                                    {totals.weftCostPerM > 0 && <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-2 py-0.5 rounded-full font-mono">🧵 ₹{totals.weftCostPerM.toFixed(2)}</span>}
                                    {totals.weaveCostPerM > 0 && <span className="text-[10px] bg-amber-50 text-amber-600 border border-amber-100 px-2 py-0.5 rounded-full font-mono">⚙️ ₹{totals.weaveCostPerM.toFixed(2)}</span>}
                                    {totals.overheadPerM > 0 && <span className="text-[10px] bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded-full font-mono">🏭 ₹{totals.overheadPerM.toFixed(2)}</span>}
                                </div>
                            </div>
                        </div>

                        {/* ── Order Fields ── */}
                        <div className="grid grid-cols-2 gap-3">
                           <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.convert_dialog.total_metres')}</Label>
                                <Input type="number" value={targetMeters} onChange={e => setTargetMeters(Number(e.target.value))} className="font-mono font-bold" />
                           </div>
                           <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-black text-slate-500">{t('estimator.convert_dialog.deadline')}</Label>
                                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} />
                           </div>
                        </div>
                        <p className="text-[11px] text-slate-500 text-center px-4 leading-relaxed">
                            {t('estimator.convert_dialog.success_note_prefix')} <span className="text-indigo-600 font-bold">{t('estimator.convert_dialog.success_note_orders')}</span> {t('estimator.convert_dialog.success_note_suffix')}
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowConvert(false)}>{t('estimator.convert_dialog.dismiss')}</Button>
                        <Button className="bg-brand-accent text-white w-full sm:w-auto" onClick={handleConvertToOrder} disabled={converting}>
                            {converting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                            {t('estimator.convert_dialog.start_production')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
