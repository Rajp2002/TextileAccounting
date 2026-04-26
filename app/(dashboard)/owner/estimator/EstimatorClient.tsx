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
    Sparkles,
    BookmarkPlus,
    Layers,
    Plus,
    Trash2,
    Gauge,
    Palette,
    ChevronDown,
    ChevronUp,
    Scissors,
    Coins,
    Banknote,
    CheckCircle2,
    History,
    Search,
    X,
    AlertTriangle,
    RotateCcw,
    Lock,
    AlertCircle,
    Zap,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/context'
import {
    calcFullTotals,
    runScenarios,
    makeDefaultEstimateState,
    DEFAULT_WARP_ROW,
    DEFAULT_WEFT_ROW,
    DEFAULT_OVERHEAD_ITEMS,
    DEFAULT_FACTORY_SECTIONS,
    ensureOverheadIntegrity,
    type EstimateState,
    type WarpRow,
    type WeftRow,
    type OverheadItem,
    type ElectricityMeta,
    type DepreciationMeta,
    type FactorySections,
    type EstimatorV3Totals,
    type ScenarioResult,
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
    updateFabricTemplate,
    renameTemplate,
    getLastQuoteForParty,
    getMonthlyOutputSuggestion,
    upsertFactoryCostProfile,
} from './actions'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAutosave } from '@/hooks/useAutosave'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { format, addDays } from 'date-fns'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { useRouter } from 'next/navigation'
import FactoryCostWizard from './FactoryCostWizard'

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
    | { type: 'UPDATE_OVERHEAD_ITEM'; id: string; field: 'label' | 'monthlyAmount' | 'isLocked'; value: any }
    | { type: 'UPDATE_OVERHEAD_ITEM_META'; id: string; meta: any }
    | { type: 'REMOVE_OVERHEAD_ITEM'; id: string }
    | { type: 'RESTORE_DRAFT'; draftState: EstimateState }
    | { type: 'RESET'; data: { profile: any; sections: FactorySections; workers: any[] } }

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
                overheadItems:      ensureOverheadIntegrity(savedItems ?? state.overheadItems),
                monthlyOutputM:     Number(profile.monthly_output_m ?? 10000),
                overheadOverridePerM: profile.overhead_override_per_m != null ? Number(profile.overhead_override_per_m) : null,
                overheadPct:        0,
                yarnShortagePct:    profile.yarn_shortage_pct != null ? Number(profile.yarn_shortage_pct) : state.yarnShortagePct,
                warpCrimpPct:       profile.warp_crimp_pct != null ? Number(profile.warp_crimp_pct) : state.warpCrimpPct,
                commissionPct:      Number(profile.default_commission_pct  ?? 2),
                transportPerM:      Number(profile.default_transport_per_m ?? 0),
                enabledSections:    { ...sections },
                isConfigured:       profile.is_configured ?? false,
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
                category:      'custom',
                isPreset:      false,
                isLocked:      false,
            }))
            return { 
                ...state, 
                overheadItems: [
                    ...state.overheadItems.filter(i => i.source !== 'fixed_worker_derived'), 
                    ...ensureOverheadIntegrity(workerItems)
                ] 
            }
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
                    warpCrimpPct:     tpl.warp_crimp_pct != null ? Number(tpl.warp_crimp_pct) : state.warpCrimpPct,
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
                    shortagePct: null,
                }],
                weftRows: [{
                    id:          nanoid(),
                    picks:       Number(tpl.ppi ?? 68),
                    reedSpace:   Number(tpl.reed_space ?? 110),
                    calcDenier:  Number(tpl.weft_denier ?? 75),
                    yarnRate:    Number(tpl.default_yarn_rate ?? 107),
                    gstPct:      5,
                    shortagePct: null,
                }],
                tapeLengthM:      Number(tpl.tape_length_m ?? state.tapeLengthM),
                warpCrimpPct:     tpl.warp_crimp_pct != null ? Number(tpl.warp_crimp_pct) : state.warpCrimpPct,
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
                    { id: nanoid(), label: 'New Item', monthlyAmount: 0, source: 'manual' as const, category: 'custom', isPreset: false, isLocked: false },
                ],
            }
        case 'UPDATE_OVERHEAD_ITEM':
            return {
                ...state,
                overheadItems: state.overheadItems.map(item =>
                    item.id === action.id ? { ...item, [action.field]: action.value } : item
                ),
            }
        case 'UPDATE_OVERHEAD_ITEM_META':
            return {
                ...state,
                overheadItems: state.overheadItems.map(item =>
                    item.id === action.id ? { ...item, meta: { ...item.meta, ...action.meta } } : item
                ),
            }
        case 'REMOVE_OVERHEAD_ITEM':
            return {
                ...state,
                overheadItems: state.overheadItems.filter(item => item.id !== action.id),
            }
        case 'RESET': {
            const { profile, sections, workers } = action.data
            const base = makeDefaultEstimateState()
            
            // Create the profile-synced default state (same logic as initialState useMemo)
            let next = {
                ...base,
                warpingRatePerKg:  Number(profile.warping_rate_per_kg  ?? base.warpingRatePerKg),
                sizingRatePerKg:   Number(profile.sizing_rate_per_kg   ?? base.sizingRatePerKg),
                windingRatePerKg:  Number(profile.winding_rate_per_kg  ?? base.windingRatePerKg),
                overheadPct:       Number(profile.overhead_pct         ?? base.overheadPct),
                commissionPct:     Number(profile.default_commission_pct ?? base.commissionPct),
                transportPerM:     Number(profile.default_transport_per_m ?? base.transportPerM),
                enabledSections:   sections,
                monthlyOutputM:    Number(profile.monthly_output_m     ?? base.monthlyOutputM),
                overheadOverridePerM: profile.overhead_override_per_m != null ? Number(profile.overhead_override_per_m) : base.overheadOverridePerM,
                loomCount:         Number(profile.loom_count           ?? base.loomCount),
                monthlyWorkingDays: Number(profile.monthly_working_days ?? base.monthlyWorkingDays),
                avgOutputPerLoomPerDay: Number(profile.avg_output_per_loom_per_day ?? base.avgOutputPerLoomPerDay),
                yarnShortagePct:   profile.yarn_shortage_pct != null ? Number(profile.yarn_shortage_pct) : base.yarnShortagePct,
                warpCrimpPct:      profile.warp_crimp_pct != null ? Number(profile.warp_crimp_pct) : base.warpCrimpPct,
                isConfigured:      profile.is_configured ?? false,
            }

            if (Array.isArray(profile.overhead_items) && profile.overhead_items.length > 0) {
                next = { ...next, overheadItems: ensureOverheadIntegrity(profile.overhead_items) }
            } else if (workers && workers.length > 0) {
                const fixedItems = workers.map((w: any) => ({
                    id:            `fw-${w.id}`,
                    label:         `${w.name} (${w.role})`,
                    monthlyAmount: Number(w.monthly_salary),
                    source:        'fixed_worker_derived' as const,
                    workerId:      w.id,
                    category:      'custom' as const,
                    isPreset:      false,
                    isLocked:      false,
                }))
                next = { ...next, overheadItems: ensureOverheadIntegrity(fixedItems) }
            }
            return next
        }
        case 'RESTORE_DRAFT':
            return action.draftState
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
    label, value, onChange, unit, step = 1, min = 0, hint, warning, onDismissWarning,
}: {
    label: string; value: number | null; onChange: (v: number | null) => void
    unit?: string; step?: number; min?: number; hint?: string; warning?: string
    onDismissWarning?: () => void
}) {
    return (
        <div className="space-y-1.5 min-w-0">
            <Label className="block text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold text-slate-500 whitespace-nowrap overflow-visible">{label}</Label>
            <div className="relative group">
                <Input
                    type="number"
                    step={step}
                    min={min}
                    value={value ?? ''}
                    onChange={e => {
                        const val = e.target.value === '' ? null : Number(e.target.value)
                        onChange(val)
                    }}
                    className="h-9 sm:h-10 text-xs sm:text-sm font-mono font-black text-center pr-10 sm:pr-14 bg-white border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-sm group-hover:border-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-full text-orange-600"
                />
                {unit && (
                    <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-[9px] sm:text-[10px] text-slate-400 font-bold pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {warning ? (
                <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" />
                        <p className="text-[9.5px] font-bold text-amber-600 truncate">{warning}</p>
                    </div>
                    {onDismissWarning && (
                        <button 
                            onClick={onDismissWarning}
                            className="text-[8px] text-slate-400 hover:text-slate-600 underline text-left pl-4"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            ) : hint ? (
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium leading-tight mt-1">{hint}</p>
            ) : null}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] uppercase tracking-widest font-black ${c.text}`}>
                        {title} {index + 1}
                    </span>
                    <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1.5 py-0 h-4 bg-white border-slate-200 text-slate-500 font-mono">
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

export default function EstimatorClient({
    initialProfile,
    initialTemplates,
    initialWorkers,
}: {
    initialProfile?: any
    initialTemplates?: any[]
    initialWorkers?: { id: number; name: string; role: string; monthly_salary: number }[]
}) {
    const router = useRouter()
    const { t } = useTranslation()

    // Build the initial state synchronously from server-provided data (no loading flash)
    const initialState = useMemo(() => {
        const base = makeDefaultEstimateState()
        if (!initialProfile) return base

        // Apply profile — mirrors INIT_FROM_PROFILE reducer case
        const sections = initialProfile.enabled_sections ?? {
            winding: false, processing: false, finishing: false, commission: true, transport: false,
        }
        let next = {
            ...base,
            warpingRatePerKg:  Number(initialProfile.warping_rate_per_kg  ?? base.warpingRatePerKg),
            sizingRatePerKg:   Number(initialProfile.sizing_rate_per_kg   ?? base.sizingRatePerKg),
            windingRatePerKg:  Number(initialProfile.winding_rate_per_kg  ?? base.windingRatePerKg),
            overheadPct:       Number(initialProfile.overhead_pct         ?? base.overheadPct),
            commissionPct:     Number(initialProfile.default_commission_pct ?? base.commissionPct),
            transportPerM:     Number(initialProfile.default_transport_per_m ?? base.transportPerM),
            enabledSections:   sections,
            monthlyOutputM:    Number(initialProfile.monthly_output_m     ?? base.monthlyOutputM),
            overheadOverridePerM: initialProfile.overhead_override_per_m !== undefined && initialProfile.overhead_override_per_m !== null
                ? Number(initialProfile.overhead_override_per_m) : base.overheadOverridePerM,
            loomCount:         Number(initialProfile.loom_count           ?? base.loomCount),
            monthlyWorkingDays: Number(initialProfile.monthly_working_days ?? base.monthlyWorkingDays),
            avgOutputPerLoomPerDay: Number(initialProfile.avg_output_per_loom_per_day ?? base.avgOutputPerLoomPerDay),
            yarnShortagePct:   initialProfile.yarn_shortage_pct != null ? Number(initialProfile.yarn_shortage_pct) : base.yarnShortagePct,
            warpCrimpPct:      initialProfile.warp_crimp_pct != null ? Number(initialProfile.warp_crimp_pct) : base.warpCrimpPct,
            isConfigured:      initialProfile.is_configured ?? false,
        }
        // Apply overhead items from profile if saved, otherwise merge fixed workers
        if (Array.isArray(initialProfile.overhead_items) && initialProfile.overhead_items.length > 0) {
            next = { ...next, overheadItems: ensureOverheadIntegrity(initialProfile.overhead_items) }
        } else if (initialWorkers && initialWorkers.length > 0) {
            const fixedItems = initialWorkers.map(w => ({
                id:            `fw-${w.id}`,
                label:         `${w.name} (${w.role})`,
                monthlyAmount: Number(w.monthly_salary),
                source:        'fixed_worker_derived' as const,
                workerId:      w.id,
                category:      'custom' as const,
                isPreset:      false,
                isLocked:      false,
            }))
            // Re-ensure integrity even for freshly mapped items to be absolutely safe
            next = { ...next, overheadItems: [...ensureOverheadIntegrity(DEFAULT_OVERHEAD_ITEMS.map(i => ({ ...i, id: nanoid() }))), ...ensureOverheadIntegrity(fixedItems)] }
        }
        return next
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run once — initialProfile is stable

    const [state, dispatch] = useReducer(estimateReducer, initialState)
    const [loading,   setLoading]   = useState(false)
    const [saving,    setSaving]    = useState(false)
    const [converting, setConverting] = useState(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templates, setTemplates] = useState<any[]>(initialTemplates ?? [])
    const [outputSuggestion, setOutputSuggestion] = useState<EstimateState['outputSuggestion'] | null>(null)
    const [isSuggestingOutput, setIsSuggestingOutput] = useState(false)

    // Loom wage per meter input — bidirectional with perPickCostPaisa
    const [wagePerMInput, setWagePerMInput] = useState<string>('')

    const [partyName,       setPartyName]       = useState('')
    const [qualityLabel,    setQualityLabel]    = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const [targetMeters,    setTargetMeters]    = useState(1000)
    const [deadline,        setDeadline]        = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
    const [orderNotes,      setOrderNotes]      = useState('')

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
    const [appliedTemplate,   setAppliedTemplate]   = useState<any>(null)
    const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([])

    // Template search
    const [templateSearch,   setTemplateSearch]   = useState('')

    // Scenario panel
    const [showScenarios,      setShowScenarios]      = useState(false)
    const [customTargetPrice,  setCustomTargetPrice]  = useState<string>('')

    // Party rate memory — debounced with 800ms + 3-char min
    const [partyHint, setPartyHint] = useState<{
        quality_label: string; quote_price_per_meter: number; created_at: string
    } | null>(null)
    const partyLookupTimerRef = useState<ReturnType<typeof setTimeout> | null>(null)

    // Autosave — scoped per user (orgId-userId) so multi-user on same device is safe
    const orgId  = initialProfile?.factory_id ?? ''
    const userId = typeof window !== 'undefined'
        ? (() => { try { return localStorage.getItem('weavly-uid') ?? '' } catch { return '' } })()
        : ''
    const { hasDraft, draft, restoreDraft, dismissDraft, clearDraft, saveDraft } = useAutosave({
        orgId, userId, debounceMs: 2000,
    })

    // Fallback fetch: only runs if no initial data was server-provided
    useEffect(() => {
        if (initialProfile !== undefined) return
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
            if (wRes.data && wRes.data.length > 0) {
                const profileHasItems = Array.isArray(pRes.data?.overhead_items) && pRes.data.overhead_items.length > 0
                if (!profileHasItems) {
                    dispatch({ type: 'MERGE_FIXED_WORKERS', workers: wRes.data })
                }
            }
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Autosave: persist on every state change (debounced)
    useEffect(() => {
        if (!orgId) return
        saveDraft({ state, partyName, qualityLabel, warpInstruction, weftInstruction })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, partyName, qualityLabel, warpInstruction, weftInstruction])

    // Party rate memory — debounced 800ms, 3-char minimum
    useEffect(() => {
        if (partyLookupTimerRef[0]) clearTimeout(partyLookupTimerRef[0])
        if (partyName.trim().length < 3) { setPartyHint(null); return }
        const timer = setTimeout(async () => {
            const res = await getLastQuoteForParty(partyName.trim())
            if (res.data) setPartyHint(res.data)
            else setPartyHint(null)
        }, 800)
        partyLookupTimerRef[0] = timer
        return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partyName])

    const totals: EstimatorV3Totals = useMemo(() => calcFullTotals(state), [state])
    const scenarios = useMemo(() =>
        runScenarios(state, totals, customTargetPrice ? Number(customTargetPrice) : undefined),
    [state, totals, customTargetPrice])

    const filteredTemplates = useMemo(() =>
        templateSearch.trim()
            ? templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
            : templates,
    [templates, templateSearch])

    const handleAutoSuggestOutput = async () => {
        setIsSuggestingOutput(true)
        try {
            const res = await getMonthlyOutputSuggestion()
            if (res.error) {
                toast.error('Failed to get suggestion')
            } else if (res.data) {
                setOutputSuggestion(res.data)
            }
        } catch (e) {
            toast.error('Error fetching suggestion')
        } finally {
            setIsSuggestingOutput(false)
        }
    }

    const applyTemplate = useCallback((tpl: any) => {
        dispatch({ type: 'APPLY_TEMPLATE', template: tpl })
        setAppliedTemplate(tpl)
        setQualityLabel(tpl.name)
        toast.success(`${t('estimator.toast.applied_template')} ${tpl.name}`)
    }, [t])

    const handleSaveProfile = async () => {
        setSaving(true)
        try {
            const res = await upsertFactoryCostProfile({
                warping_rate_per_kg:     state.warpingRatePerKg,
                sizing_rate_per_kg:      state.sizingRatePerKg,
                winding_rate_per_kg:     state.windingRatePerKg,
                overhead_pct:            state.overheadPct,
                default_commission_pct:  state.commissionPct,
                default_transport_per_m: state.transportPerM,
                enabled_sections:        state.enabledSections,
                overhead_items:          state.overheadItems,
                monthly_output_m:        state.monthlyOutputM,
                loom_count:              state.loomCount,
                monthly_working_days:    state.monthlyWorkingDays,
                avg_output_per_loom_per_day: state.avgOutputPerLoomPerDay,
                yarn_shortage_pct:       state.yarnShortagePct,
                warp_crimp_pct:          state.warpCrimpPct,
            })

            if (res.success) {
                dispatch({ type: 'SET', field: 'isConfigured', value: true })
                toast.success('Factory baseline updated successfully!')
            } else {
                toast.error(res.error || 'Failed to save profile')
            }
        } catch (e) {
            toast.error('Error saving profile')
        } finally {
            setSaving(false)
        }
    }

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) return toast.error(t('estimator.toast.save_template_name_error'))
        setSavingTemplate(true)
        const res = await saveAsFabricTemplate({
            name:             templateName.trim(),
            warpRows:         state.warpRows,
            weftRows:         state.weftRows,
            tapeLengthM:      state.tapeLengthM,
            warpCrimpPct:     state.warpCrimpPct,
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
            clearDraft()
            toast.success(t('estimator.toast.saved_template'))
        } else {
            toast.error(res.error ?? 'Failed to save template')
        }
    }

    const handleUpdateTemplate = async () => {
        if (!appliedTemplate) return
        setSavingTemplate(true)
        const updatedName = qualityLabel.trim() || appliedTemplate.name
        const res = await updateFabricTemplate({
            id:               appliedTemplate.id,
            name:             updatedName,
            warpRows:         state.warpRows,
            weftRows:         state.weftRows,
            tapeLengthM:      state.tapeLengthM,
            warpCrimpPct:     state.warpCrimpPct,
            perPickCostPaisa: state.perPickCostPaisa,
            yarnShortagePct:  state.yarnShortagePct,
            overheadOverridePerM: state.overheadOverridePerM,
        })
        setSavingTemplate(false)
        
        if (res.success) {
            const tRes = await getEstimatorTemplates()
            if (tRes.data) setTemplates(tRes.data)
            setAppliedTemplate({ ...appliedTemplate, name: updatedName })
            toast.success(`Updated '${updatedName}' successfully!`)
        } else {
            toast.error(res.error ?? 'Failed to update template')
        }
    }

    const handleResetEstimator = () => {
        if (window.confirm('Reset estimator to standard profile defaults? All unsaved changes will be lost.')) {
            dispatch({ 
                type: 'RESET', 
                data: { 
                    profile: initialProfile, 
                    sections: initialProfile?.enabled_sections ?? DEFAULT_FACTORY_SECTIONS,
                    workers: initialWorkers || []
                } 
            })
            setAppliedTemplate(null)
            setQualityLabel('')
            setPartyName('')
            setTargetMeters(0)
            setCustomTargetPrice('')
            clearDraft()
            toast.success('Estimator reset to profile defaults')
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
        setAppliedTemplate({ ...editRatesTpl, name: editingTplName.trim(), warp_rows: updatedWarp, weft_rows: updatedWeft })
        setQualityLabel(editingTplName.trim())
        setEditRatesTpl(null)
        toast.success(t('estimator.toast.updated_applied'))
    }

    /** Apply template directly (without editing rates). */
    const handleApplyCurrentRates = () => {
        if (!editRatesTpl) return
        dispatch({ type: 'APPLY_TEMPLATE', template: editRatesTpl })
        setAppliedTemplate(editRatesTpl)
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
        if (!partyName.trim())    return toast.error(t('estimator.toast.party_required'))
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        setConverting(true)
        const res = await convertQuoteToOrder({
            party_name:          partyName.trim(),
            quality_label:       qualityLabel.trim(),
            warp_instruction:    warpInstruction.trim() || undefined,
            weft_instruction:    weftInstruction.trim() || undefined,
            notes:               orderNotes.trim() || undefined,
            total_target_meters: targetMeters,
            deadline,
            estimate:            state,
            quote_price_per_m:   totals.orderQuote?.quotePricePerM ?? totals.totalProductionCostPerM,
            totalProductionCostPerM: totals.totalProductionCostPerM,
        })
        setConverting(false)
        if (res.success) {
            setShowConvert(false)
            clearDraft()
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

    // Validation: Pilot Safety Rails
    const isZeroConfig = state.overheadItems.filter(i => i.isPreset).every(i => (i.monthlyAmount || 0) === 0)
    const electricityItem = state.overheadItems.find(i => i.category === 'electricity')
    const hasElectricityLeak = electricityItem && (
        (electricityItem.isLocked && electricityItem.meta?.type === 'electricity' && (
            (electricityItem.meta.unitsPerLoomPerMonth || 0) === 0 || 
            (electricityItem.meta.ratePerUnit || 0) === 0
        )) ||
        (!electricityItem.isLocked && (electricityItem.monthlyAmount || 0) === 0)
    )

    return (
        <div className="space-y-6 pb-20 relative">
            {!state.isConfigured && (
                <FactoryCostWizard 
                    initialState={state}
                    saving={saving}
                    onComplete={async (data) => {
                        setSaving(true)
                        // Map camelCase EstimateState keys to snake_case DB keys
                        const res = await upsertFactoryCostProfile({
                            warping_rate_per_kg:     state.warpingRatePerKg,
                            sizing_rate_per_kg:      state.sizingRatePerKg,
                            winding_rate_per_kg:     state.windingRatePerKg,
                            overhead_pct:            state.overheadPct,
                            default_commission_pct:  state.commissionPct,
                            default_transport_per_m: state.transportPerM,
                            enabled_sections:        state.enabledSections,
                            yarn_shortage_pct:       state.yarnShortagePct,
                            warp_crimp_pct:          state.warpCrimpPct,
                            // Overridden by wizard data
                            overhead_items:          data.overheadItems ?? state.overheadItems,
                            monthly_output_m:        data.monthlyOutputM ?? state.monthlyOutputM,
                            overhead_override_per_m: data.overhead_override_per_m !== undefined ? data.overhead_override_per_m : state.overheadOverridePerM,
                            loom_count:              data.loomCount ?? state.loomCount,
                            monthly_working_days:    data.monthlyWorkingDays ?? state.monthlyWorkingDays,
                            avg_output_per_loom_per_day: data.avgOutputPerLoomPerDay ?? state.avgOutputPerLoomPerDay,
                            is_configured:           true,
                        })
                        if (res.success) {
                            // Update local state and close wizard
                            Object.entries(data).forEach(([key, val]) => {
                                const stateKey = key === 'overhead_override_per_m' ? 'overheadOverridePerM' : key;
                                dispatch({ type: 'SET', field: stateKey as any, value: val })
                            })
                            dispatch({ type: 'SET', field: 'isConfigured', value: true })
                            toast.success('Factory baseline configured successfully!')
                        } else {
                            toast.error(res.error || 'Failed to save configuration')
                        }
                        setSaving(false)
                    }}
                />
            )}

            {/* ── DRAFT RESTORE BANNER ─────────────────────────────── */}
            {hasDraft && draft && (
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800 flex-1">
                            <span className="font-bold">Unsaved draft</span> from{' '}
                            {new Date(draft.savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                            {draft.partyName && <span className="text-amber-600"> · {draft.partyName}</span>}
                        </p>
                        <button
                            onClick={() => {
                                const d = restoreDraft()
                                if (!d) return
                                dispatch({ type: 'RESTORE_DRAFT', draftState: d.state })
                                setPartyName(d.partyName)
                                setQualityLabel(d.qualityLabel)
                                setWarpInstruction(d.warpInstruction)
                                setWeftInstruction(d.weftInstruction)
                                toast.success('Draft restored')
                            }}
                            className="text-xs font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
                        >Restore</button>
                        <button
                            onClick={dismissDraft}
                            className="ml-1 text-amber-500 hover:text-amber-700"
                        ><X className="h-4 w-4" /></button>
                    </div>
                </div>
            )}

            {/* ── STICKY HUD ───────────────────────────────────────── */}
            <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-border/50 shadow-sm -mt-6 pt-4 sm:pt-6 pb-3 sm:pb-4 px-4 mx-[-24px] sm:mx-[-32px] md:mx-[-40px]">
                <div className="max-w-4xl mx-auto space-y-3 sm:space-y-4">

                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 sm:gap-4">
                        {/* Production Cost */}
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-0.5">{t('estimator.hud.prod_cost')}</p>
                            <p className="text-xl sm:text-2xl font-black font-mono text-slate-900 leading-none">
                                ₹{totals.totalProductionCostPerM.toFixed(2)}
                            </p>
                        </div>

                        {hasOrderQty && orderQuote && (
                            <>
                                <div className="h-6 sm:h-8 w-px bg-slate-200 shrink-0 hidden sm:block" />
                                {/* Quote Price */}
                                <div className="min-w-0">
                                    <p className="text-[10px] uppercase tracking-wider text-brand-accent font-black mb-0.5">{t('estimator.hud.quote_per_m')}</p>
                                    <p className="text-xl sm:text-3xl font-black font-mono text-brand-accent leading-none">
                                        ₹{orderQuote.quotePricePerM.toFixed(2)}
                                    </p>
                                </div>
                                <div className="h-8 w-px bg-slate-200 shrink-0 hidden md:block" />
                                {/* Total Value */}
                                <div className="min-w-0 flex-1 hidden md:block text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-emerald-600 font-bold mb-0.5">{t('estimator.hud.total_order')}</p>
                                    <p className="text-xl font-black font-mono text-slate-900 leading-none">
                                        ₹{orderQuote.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                    </p>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 ml-auto shrink-0 self-center w-full sm:w-auto mt-1 sm:mt-0 pt-2 sm:pt-0 border-t border-slate-100 sm:border-0 order-last sm:order-none justify-end">
                            <Button
                                size="sm"
                                className="flex-1 sm:flex-none h-9 px-3 sm:px-4 bg-brand-accent hover:bg-brand-accent/90 text-white font-bold text-xs gap-1.5 sm:gap-2 shadow-lg shadow-brand-accent/15"
                                onClick={() => setShowConvert(true)}
                            >
                                <Package className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t('estimator.hud.order_btn')}</span>
                            </Button>

                            {appliedTemplate ? (
                                <div className="flex items-center">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-9 px-3 sm:px-4 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs gap-1.5 sm:gap-2 font-bold"
                                        onClick={handleUpdateTemplate}
                                        disabled={savingTemplate}
                                    >
                                        {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
                                        <span className="truncate">Update {appliedTemplate.name}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setAppliedTemplate(null)}
                                        className="h-9 px-2 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors ml-1"
                                        title="Detach template (Go back to 'Save' mode)"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="flex-1 sm:flex-none h-9 px-3 sm:px-4 border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-xs gap-1.5 sm:gap-2 font-bold"
                                    onClick={() => {
                                        setTemplateName(qualityLabel.trim())
                                        setShowSaveTemplate(true)
                                    }}
                                >
                                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{t('estimator.hud.save_template_btn')}</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* HUD Row 2: Margin slider */}
                    {hasOrderQty && orderQuote && (
                        <div className="flex items-center gap-2 sm:gap-4 bg-orange-50/50 p-2 sm:p-2.5 rounded-xl border border-orange-100">
                            <div className="shrink-0 w-16 sm:w-auto">
                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('estimator.hud.margin')}</p>
                                <p className="text-sm font-black text-brand-accent leading-none mt-0.5">{state.profitPct.toFixed(1)}%</p>
                            </div>
                            <input
                                type="range"
                                min={0} max={40} step={0.5}
                                value={state.profitPct}
                                onChange={e => dispatch({ type: 'SET', field: 'profitPct', value: Number(e.target.value) })}
                                className="flex-1 h-2 rounded-full bg-slate-200 appearance-none cursor-pointer accent-brand-accent"
                            />
                            <div className="shrink-0 text-right w-20 sm:w-auto">
                                <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold uppercase tracking-wider">{t('estimator.hud.net_profit')}</p>
                                <p className="text-[13px] sm:text-sm font-black text-emerald-600 leading-none mt-0.5">
                                    ₹{orderQuote.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* HUD Row 2b: Contribution Margin Floor (visible when order qty set) */}
                    {hasOrderQty && (
                        <div className="flex items-center gap-4 px-1">
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Break-even (full)</span>
                                <span className="text-[11px] font-black font-mono text-slate-600">₹{totals.totalProductionCostPerM.toFixed(2)}/m</span>
                            </div>
                            <span className="text-slate-300">·</span>
                            <div className="flex items-center gap-1.5">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Direct-only floor</span>
                                <span className="text-[11px] font-black font-mono text-emerald-600" title="Minimum price to cover variable costs only (yarn + weave + warping)">
                                    ₹{totals.directCostPerM.toFixed(2)}/m
                                </span>
                            </div>
                        </div>
                    )}

                    {/* HUD Row 3: Pills */}
                    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar pt-0.5">
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
                            <p className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">{t('estimator.templates.label')}</p>
                            <span className="ml-auto text-[10px] text-slate-400 font-medium">{t('estimator.templates.hint')}</span>
                        </div>
                        {/* Search — only shown when there are more than 5 templates */}
                        {templates.length > 5 && (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={templateSearch}
                                    onChange={e => setTemplateSearch(e.target.value)}
                                    placeholder={`Search ${templates.length} templates…`}
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-accent/20 focus:border-brand-accent"
                                />
                                {templateSearch && (
                                    <button
                                        onClick={() => setTemplateSearch('')}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                                {templateSearch && (
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        {filteredTemplates.length} of {templates.length} templates
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={handleResetEstimator}
                                className="shrink-0 rounded-xl px-3 h-[38px] border-dashed border-slate-300 text-slate-400 hover:text-brand-accent hover:border-brand-accent hover:bg-brand-accent/5 transition-all gap-1.5 font-bold"
                             >
                                <RotateCcw className="h-3.5 w-3.5" />
                                {t('estimator.templates.reset_btn') || 'Reset'}
                             </Button>

                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setTemplateName(qualityLabel.trim() || appliedTemplate?.name || '')
                                    setShowSaveTemplate(true)
                                }}
                                className="shrink-0 rounded-xl px-4 h-[38px] border-indigo-200 bg-indigo-50/30 text-indigo-600 hover:bg-indigo-100/50 hover:border-indigo-300 transition-all gap-1.5 font-bold shadow-sm"
                             >
                                <Plus className="h-3.5 w-3.5" />
                                {t('estimator.templates.save_btn') || 'Save'}
                             </Button>
                            {filteredTemplates.map(tpl => (
                                <div key={tpl.id} className="relative shrink-0 group flex items-center">
                                    <button
                                        onClick={() => applyTemplate(tpl)}
                                        onContextMenu={e => { e.preventDefault(); openEditRates(tpl) }}
                                        className={`rounded-xl px-4 py-2 text-xs font-bold border transition-all shadow-sm ${
                                            qualityLabel === tpl.name
                                                ? 'bg-brand-accent border-brand-accent text-white shadow-brand-accent/20'
                                                : 'bg-white border-slate-200 text-slate-600 group-hover:border-brand-accent/50 group-hover:bg-slate-50'
                                        } pr-14`}
                                    >
                                        {tpl.name}
                                    </button>
                                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={e => { e.stopPropagation(); openEditRates(tpl) }}
                                            className="p-1 rounded-md hover:bg-brand-accent/10 text-slate-400 hover:text-brand-accent transition-colors"
                                            title={t('estimator.templates.edit_rates_title')}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                        </button>
                                        <button
                                            onClick={e => {
                                                e.stopPropagation();
                                                if (window.confirm(t('estimator.edit_template_dialog.delete_confirm').replace('{name}', tpl.name))) {
                                                    handleDeleteTemplate(tpl.id)
                                                }
                                            }}
                                            disabled={deletingTpl === tpl.id}
                                            className="p-1 rounded-md hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
                                            title={t('estimator.edit_template_dialog.delete_button')}
                                        >
                                            {deletingTpl === tpl.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {filteredTemplates.length === 0 && templateSearch && (
                                <p className="text-xs text-slate-400 italic py-2">No templates match "{templateSearch}"</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 1. Order Basics */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.order_basics.title')} icon={Layers} accent="indigo" />
                    <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">{t('estimator.order_basics.party')}</Label>
                                <Input
                                    value={partyName}
                                    onChange={e => setPartyName(e.target.value)}
                                    placeholder="Sundaram Textiles"
                                    className="font-bold border-slate-200 h-11"
                                />
                                {partyHint && (
                                    <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                        <span className="text-blue-500">💡</span>
                                        Last quote:{' '}
                                        <span className="font-bold text-slate-700">₹{partyHint.quote_price_per_meter.toFixed(2)}/m</span>
                                        {' '}for <span className="font-medium">{partyHint.quality_label}</span>
                                        {' '}· {new Date(partyHint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                    </p>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">{t('estimator.order_basics.quality_label')}</Label>
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
                                <Label className="text-[10px] uppercase font-bold text-slate-500">{t('estimator.order_basics.warp_construction')}</Label>
                                <Input
                                    value={warpInstruction}
                                    onChange={e => setWarpInstruction(e.target.value)}
                                    placeholder="50/48 + Rainbow"
                                    className="text-sm font-medium border-slate-200 h-11"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">{t('estimator.order_basics.weft_construction')}</Label>
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
                        {/* Global Defaults Block */}
                        <div className="border border-indigo-100 rounded-xl mb-6 bg-indigo-50/30 overflow-hidden">
                            <div className="flex gap-4 p-3 border-b border-indigo-100/50">
                                <div className="flex-1 space-y-1">
                                    <Label className="text-[10px] uppercase font-bold text-indigo-700">Warp Crimp (Take-up)</Label>
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            type="number"
                                            value={state.warpCrimpPct}
                                            onChange={e => dispatch({ type: 'SET', field: 'warpCrimpPct', value: Number(e.target.value) })}
                                            className="w-20 h-8 font-mono text-xs bg-white"
                                            step={0.5}
                                        />
                                        <span className="text-[10px] font-bold text-slate-500">%</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 leading-tight">Beam shrink relative to tape length</p>
                                </div>
                                <div className="flex-1 space-y-1 border-l border-indigo-100 pl-4">
                                    <Label className="text-[10px] uppercase font-bold text-indigo-700">Default Yarn Waste</Label>
                                    <div className="flex gap-2 items-center">
                                        <Input
                                            type="number"
                                            value={state.yarnShortagePct}
                                            onChange={e => dispatch({ type: 'SET', field: 'yarnShortagePct', value: Number(e.target.value) })}
                                            className="w-20 h-8 font-mono text-xs bg-white"
                                            step={0.5}
                                        />
                                        <span className="text-[10px] font-bold text-slate-500">%</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 leading-tight">Fallback waste % if row is 0%</p>
                                </div>
                            </div>
                            <div className="bg-indigo-50/80 px-4 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Calculator className="h-3.5 w-3.5 text-indigo-500" />
                                    <span className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider">Effective Total Shortage</span>
                                </div>
                                <span className="text-[11px] font-mono font-black text-indigo-700 flex items-center gap-2">
                                    <span>{state.warpCrimpPct || 0}% + {state.yarnShortagePct || 0}% =</span>
                                    <span className="text-sm bg-white px-2 py-0.5 rounded border border-indigo-200">{(state.warpCrimpPct || 0) + (state.yarnShortagePct || 0)}%</span>
                                </span>
                            </div>
                        </div>

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
                                    <NumField label={t('estimator.field_labels.calc_denier')} value={row.calcDenier} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calcDenier', value: v ?? 0 })} unit="D" step={0.5} />
                                    <NumField label={t('estimator.field_labels.beam_ends')} value={row.beamEnds} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: v ?? 0 })} />
                                    <NumField label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} hint={`or ${state.yarnShortagePct}% default`} warning={row.shortagePct !== null && (row.shortagePct > 15 || (row.shortagePct === 0 && state.yarnShortagePct > 15)) ? 'High waste %' : undefined} />
                                    {(() => {
                                        const templateRate = appliedTemplate?.warp_rows?.[i]?.yarnRate ?? null
                                        const isUnusuallyLow = templateRate !== null
                                            ? row.yarnRate < templateRate * 0.6
                                            : row.yarnRate > 0 && row.yarnRate < 50
                                        const warningId = `warp-${row.id}-rate`
                                        const isDismissed = dismissedWarnings.includes(warningId)
                                        return (
                                            <NumField 
                                                label={t('estimator.field_labels.rate_kg')} 
                                                value={row.yarnRate} 
                                                onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })} 
                                                step={1} 
                                                warning={isUnusuallyLow && !isDismissed ? 'Unusually low' : undefined}
                                                onDismissWarning={() => setDismissedWarnings(prev => [...prev, warningId])}
                                            />
                                        )
                                    })()}
                                    <NumField label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: v ?? 0 })} step={0.5} />
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
                        {/* Tape Length + Beam Capacity + Beams Needed */}
                        {(() => {
                            const beamM = totals.estimatedBeamCapacityM
                            const orderQty = state.orderQuantityM ?? (targetMeters > 0 ? targetMeters : null)
                            const beamsNeeded = (beamM > 0 && orderQty && orderQty > 0)
                                ? Math.ceil(orderQty / beamM)
                                : null
                            return (
                                <div className="pt-4 border-t border-slate-100 space-y-3">
                                    {/* Row 1: Tape Length input + Cloth/Beam display */}
                                    <div className="flex items-end justify-between gap-4">
                                        <div className="w-40">
                                            <NumField
                                                label={t('estimator.warp.tape_len')}
                                                value={state.tapeLengthM}
                                                onChange={v => dispatch({ type: 'SET', field: 'tapeLengthM', value: v ?? 0 })}
                                                unit="m"
                                            />
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] uppercase font-black text-slate-400 tracking-wider">{t('estimator.warp.beam_capacity')}</p>
                                            <p className="text-lg font-black font-mono text-indigo-600 leading-none">
                                                {beamM > 0 ? `≈ ${beamM.toFixed(0)} m` : '— m'}
                                            </p>
                                            <p className="text-[9px] text-slate-400 mt-0.5">cloth per beam</p>
                                        </div>
                                    </div>
                                    {/* Row 2: Beams Needed pill (only when tape length is set) */}
                                    {beamM > 0 && (
                                        <div className="flex items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-indigo-500 shrink-0" />
                                                <div>
                                                    <p className="text-[10px] uppercase font-black text-indigo-600 tracking-wider">Beams Needed</p>
                                                    {beamsNeeded !== null ? (
                                                        <p className="text-[9px] text-slate-500 font-medium">
                                                            for {(orderQty!).toLocaleString('en-IN')} m order
                                                            {state.orderQuantityM ? '' : ' (from simulation qty)'}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[9px] text-slate-400 font-medium">
                                                            set an order qty to see count
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                {beamsNeeded !== null ? (
                                                    <>
                                                        <p className="text-2xl font-black font-mono text-indigo-700 leading-none">{beamsNeeded}</p>
                                                        <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                                                            beams × {beamM.toFixed(0)} m
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-xl font-black font-mono text-slate-300 leading-none">—</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
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
                        {/* Global Defaults Sync Readout */}
                        <div className="border border-emerald-100 rounded-xl mb-6 bg-emerald-50/30 overflow-hidden">
                            <div className="bg-emerald-50/80 px-4 py-2 flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <Calculator className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Effective Total Shortage</span>
                                </div>
                                <span className="text-[11px] font-mono font-black text-emerald-700 flex items-center gap-2">
                                    <span>{state.warpCrimpPct || 0}% + {state.yarnShortagePct || 0}% =</span>
                                    <span className="text-sm bg-white px-2 py-0.5 rounded border border-emerald-200">{(state.warpCrimpPct || 0) + (state.yarnShortagePct || 0)}%</span>
                                </span>
                            </div>
                            <div className="px-4 py-1.5 bg-white/50 border-t border-emerald-100/50">
                                <p className="text-[9px] text-slate-400 font-medium leading-tight italic">Synced with Warp Crimp to ensure loom-wide shortage parity</p>
                            </div>
                        </div>

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
                                    <NumField label={t('estimator.field_labels.picks_ppi')} value={row.picks} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: v ?? 0 })} />
                                    <NumField label={t('estimator.field_labels.cloth_width')} value={row.reedSpace} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: v ?? 0 })} unit="cm" hint={t('estimator.weft.cloth_width_hint')} />
                                    <NumField label={t('estimator.field_labels.calc_denier')} value={row.calcDenier} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calcDenier', value: v ?? 0 })} unit="D" step={0.5} />
                                    <NumField label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} hint={`or ${state.yarnShortagePct}% default`} warning={row.shortagePct !== null && (row.shortagePct > 15 || (row.shortagePct === 0 && state.yarnShortagePct > 15)) ? 'High waste %' : undefined} />
                                    {(() => {
                                        const templateRate = appliedTemplate?.weft_rows?.[i]?.yarnRate ?? null
                                        const isUnusuallyLow = templateRate !== null
                                            ? row.yarnRate < templateRate * 0.6
                                            : row.yarnRate > 0 && row.yarnRate < 50
                                        const warningId = `weft-${row.id}-rate`
                                        const isDismissed = dismissedWarnings.includes(warningId)
                                        return (
                                            <NumField 
                                                label={t('estimator.field_labels.rate_kg')} 
                                                value={row.yarnRate} 
                                                onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })} 
                                                warning={isUnusuallyLow && !isDismissed ? 'Unusually low' : undefined}
                                                onDismissWarning={() => setDismissedWarnings(prev => [...prev, warningId])}
                                            />
                                        )
                                    })()}
                                    <NumField label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: v ?? 0 })} step={0.5} />
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
                    <CardContent className="p-5 space-y-5">

                        {/* ── Loom Wage per Meter → auto-derives paisa/pick ── */}
                        {(() => {
                            const totalPicks = state.weftRows.reduce((a, b) => a + b.picks, 0)
                            const derivedWagePerM = totalPicks > 0
                                ? (state.perPickCostPaisa * totalPicks).toFixed(2)
                                : '0.00'
                            return (
                                <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/40 p-4 space-y-3">
                                    <div className="flex items-center gap-2">
                                        <Banknote className="h-4 w-4 text-amber-600" />
                                        <p className="text-[11px] uppercase tracking-widest font-black text-amber-700">Loom Weave Wage</p>
                                        <span className="ml-auto text-[10px] text-amber-500 font-medium bg-amber-100 px-2 py-0.5 rounded-full">₹/m ↔ paisa/pick</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Input: ₹ per meter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-amber-700/80">Wage per Meter (₹/m)</Label>
                                            <div className="relative group">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500 pointer-events-none">₹</span>
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.5}
                                                    placeholder={derivedWagePerM}
                                                    value={wagePerMInput}
                                                    onChange={e => {
                                                        const raw = e.target.value
                                                        setWagePerMInput(raw)
                                                        const wageNum = Number(raw)
                                                        if (!isNaN(wageNum) && wageNum > 0 && totalPicks > 0) {
                                                            const derived = wageNum / totalPicks
                                                            dispatch({ type: 'SET', field: 'perPickCostPaisa', value: Math.round(derived * 10000) / 10000 })
                                                        }
                                                    }}
                                                    onBlur={() => setWagePerMInput('')}
                                                    className="h-11 text-sm font-mono font-bold text-center pl-8 pr-14 bg-white border-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-300/30 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-full"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">/m</span>
                                            </div>
                                            <p className="text-[10px] text-amber-600/70 font-medium">e.g. 8 for ₹8 per meter loom wage</p>
                                        </div>

                                        {/* Display: derived paisa/pick + live impact */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">Paisa per Pick (₹/pick)</Label>
                                            <div className="relative group">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.001}
                                                    value={state.perPickCostPaisa}
                                                    onChange={e => {
                                                        const v = Number(e.target.value)
                                                        dispatch({ type: 'SET', field: 'perPickCostPaisa', value: v })
                                                        setWagePerMInput('')
                                                    }}
                                                    className="h-11 text-sm font-mono font-bold text-center pr-16 bg-white border-slate-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-300/30 transition-all shadow-sm group-hover:border-slate-300 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-full"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">/pick</span>
                                            </div>
                                            <p className="text-[10px] text-slate-400 font-medium">Direct entry or auto-derived from ₹/m above</p>
                                        </div>
                                    </div>

                                    {/* Live equivalence banner */}
                                    <div className="flex items-center justify-between bg-white/70 border border-amber-100 rounded-lg px-3 py-2">
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">At {totalPicks} picks</span>
                                            <span className="text-[10px] text-slate-400">→</span>
                                            <span className="text-[11px] font-black font-mono text-amber-800">₹{derivedWagePerM}/m</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-slate-400 font-medium">Weave cost</span>
                                            <span className="text-sm font-black font-mono text-amber-700">₹{totals.weaveCostPerM.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            )
                        })()}

                    </CardContent>
                </Card>

                {/* 5. Warping & Sizing */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.warping_sizing.title')} icon={TrendingUp} accent="violet" />
                    <CardContent className="p-4 space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <NumField label={t('estimator.warping_sizing.warping_per_kg')} value={state.warpingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: v ?? 0 })} step={0.1} />
                            <NumField label={t('estimator.warping_sizing.sizing_per_kg')} value={state.sizingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: v ?? 0 })} step={0.1} />
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
                                    {totals.capacityUtilisationPct.toFixed(1)}% Capacity
                                </span>
                            </div>
                        }
                    />
                    <CardContent className="p-5 space-y-6">
                        
                        {/* A. Factory Capacity Section */}
                        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <div className="flex items-center gap-2">
                                    <Zap className="h-3.5 w-3.5 text-brand-accent" />
                                    <h4 className="text-[10px] uppercase font-black text-slate-500 tracking-wider leading-none">Factory Capacity Configuration</h4>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[9px] font-bold text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 px-2"
                                    onClick={handleSaveProfile}
                                    disabled={saving}
                                >
                                    {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                    Update Baseline
                                </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                                <NumField 
                                    label="Loom Count" 
                                    value={state.loomCount} 
                                    onChange={v => dispatch({ type: 'SET', field: 'loomCount', value: v ?? 0 })} 
                                    unit="looms" 
                                />
                                <NumField 
                                    label="Avg Daily Output" 
                                    value={state.avgOutputPerLoomPerDay} 
                                    onChange={v => dispatch({ type: 'SET', field: 'avgOutputPerLoomPerDay', value: v ?? 0 })} 
                                    unit="m/day" 
                                />
                                <NumField 
                                    label="Working Days" 
                                    value={state.monthlyWorkingDays} 
                                    onChange={v => dispatch({ type: 'SET', field: 'monthlyWorkingDays', value: v ?? 0 })} 
                                    unit="days" 
                                    hint="Standard 26-day month"
                                />
                            </div>
                            {state.loomCount > 0 && state.avgOutputPerLoomPerDay > 0 && (
                                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50">
                                    <span className="text-[10px] font-bold text-slate-400">Monthly Rated Capacity:</span>
                                    <span className="text-xs font-mono font-bold text-slate-600">{totals.ratedCapacityM.toLocaleString()} metres</span>
                                </div>
                            )}
                        </div>

                        {/* B. Itemized Overhead Rows */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">Monthly Fixed Costs</p>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[9px] font-bold text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                                    onClick={() => dispatch({ type: 'ADD_OVERHEAD_ITEM' })}
                                >
                                    <Plus className="h-3 w-3 mr-1" /> New Item
                                </Button>
                            </div>
                            
                            <div className="space-y-2">
                                {totals.resolvedItems.map(item => {
                                    const isPreset = item.isPreset
                                    const isLocked = item.isLocked
                                    const isElectricity = item.category === 'electricity'
                                    const isDepreciation = item.category === 'depreciation'
                                    
                                    return (
                                        <div key={item.id} className={`group relative flex flex-col gap-2 rounded-xl border p-3 transition-colors ${
                                            isLocked ? 'bg-indigo-50/30 border-indigo-100' : 'bg-white border-slate-200'
                                        }`}>
                                            <div className="flex items-center gap-3">
                                                {/* Label / Preset Indicator */}
                                                <div className="flex-1 flex items-center gap-2">
                                                    {isLocked && <Lock className="h-3 w-3 text-indigo-400 shrink-0" />}
                                                    <Input
                                                        value={item.label}
                                                        disabled={isPreset}
                                                        onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'label', value: e.target.value })}
                                                        className={`h-7 text-xs font-bold border-0 bg-transparent p-0 focus:ring-0 ${isPreset ? 'text-slate-700' : 'text-slate-500'}`}
                                                    />
                                                </div>

                                                {/* Amount Display/Input */}
                                                <div className="relative shrink-0 w-32">
                                                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">₹</span>
                                                    <Input
                                                        type="number"
                                                        value={item.monthlyAmount}
                                                        disabled={isLocked}
                                                        onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: Number(e.target.value) })}
                                                        className={`h-8 text-[11px] font-mono font-bold text-right pr-9 pl-6 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-full ${
                                                            isLocked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200'
                                                        }`}
                                                    />
                                                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">/mo</span>
                                                </div>

                                                {!isPreset && (
                                                    <button onClick={() => dispatch({ type: 'REMOVE_OVERHEAD_ITEM', id: item.id })} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Specialized Config Panels */}
                                            {isElectricity && item.meta && (
                                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1 pt-2 border-t border-indigo-100/50">
                                                    <div className="flex items-center gap-2">
                                                        <input 
                                                            type="checkbox" 
                                                            checked={(item.meta as ElectricityMeta)?.mode === 'per_loom'} 
                                                            onChange={e => dispatch({
                                                                type: 'UPDATE_OVERHEAD_ITEM',
                                                                id: item.id,
                                                                field: 'isLocked',
                                                                value: e.target.checked
                                                            })}
                                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3 w-3"
                                                        />
                                                        <span className="text-[9.5px] font-bold text-slate-500">Per Loom Helper</span>
                                                    </div>
                                                    {item.isLocked && (
                                                        <>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[8px] uppercase font-black text-slate-400">Units/Loom</span>
                                                                <Input 
                                                                    type="number" 
                                                                    value={(item.meta as ElectricityMeta)?.unitsPerLoomPerMonth ?? 0} 
                                                                    onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { unitsPerLoomPerMonth: Number(e.target.value), type: 'electricity', mode: 'per_loom' } })}
                                                                    className="h-6 text-[10px] font-mono font-bold px-1.5"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-0.5">
                                                                <span className="text-[8px] uppercase font-black text-slate-400">Rate/Unit</span>
                                                                <Input 
                                                                    type="number" 
                                                                    value={(item.meta as ElectricityMeta)?.ratePerUnit ?? 0} 
                                                                    onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { ratePerUnit: Number(e.target.value), type: 'electricity', mode: 'per_loom' } })}
                                                                    className="h-6 text-[10px] font-mono font-bold px-1.5"
                                                                />
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {isDepreciation && item.meta && (
                                                <div className="grid grid-cols-2 gap-3 mt-1 pt-2 border-t border-indigo-100/50">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[8px] uppercase font-black text-slate-400">Machine Value (avg/loom)</span>
                                                        <div className="relative">
                                                            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-400 font-bold pointer-events-none">₹</span>
                                                            <Input 
                                                                type="number" 
                                                                value={(item.meta as DepreciationMeta)?.avgCostPerLoom ?? 1000000} 
                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { avgCostPerLoom: Number(e.target.value), type: 'depreciation' } })}
                                                                className="h-7 text-[10px] font-mono font-bold pl-4 pr-1.5"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col gap-1">
                                                        <span className="text-[8px] uppercase font-black text-slate-400">Lifespan (Years)</span>
                                                        <Input 
                                                            type="number" 
                                                            value={(item.meta as DepreciationMeta)?.usefulLifeYears ?? 10} 
                                                            onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { usefulLifeYears: Number(e.target.value), type: 'depreciation' } })}
                                                            className="h-7 text-[10px] font-mono font-bold px-2"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* C. Denominator & Summary Block */}
                        <div className="pt-4 border-t border-slate-100 space-y-4">
                            <div className="flex flex-col sm:flex-row gap-4">
                                {/* Monthly Output & Suggestions */}
                                <div className="flex-1 space-y-3">
                                    <div className="space-y-1.5">
                                        <div className="flex items-center justify-between">
                                            <Label className="text-[10px] uppercase font-black text-slate-500">Monthly Output (Actual/Target)</Label>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                onClick={handleAutoSuggestOutput}
                                                disabled={isSuggestingOutput}
                                                className="h-5 px-2 text-[10px] font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                                            >
                                                {isSuggestingOutput ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                                Suggest
                                            </Button>
                                        </div>
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                value={state.monthlyOutputM}
                                                onChange={e => dispatch({ type: 'SET', field: 'monthlyOutputM', value: Number(e.target.value) })}
                                                className="h-10 text-sm font-mono font-bold text-center pr-9 bg-white border-slate-200 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">m</span>
                                        </div>
                                    </div>

                                    {/* Output Suggestion Panel */}
                                    {outputSuggestion && (
                                        <motion.div 
                                            initial={{ opacity: 0, y: -10 }} 
                                            animate={{ opacity: 1, y: 0 }}
                                            className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 space-y-2"
                                        >
                                            <p className="text-[9.5px] font-bold text-indigo-700 flex items-center gap-1.5">
                                                <History className="h-3 w-3" /> Historical Output Scaling (to 26 days)
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button 
                                                    onClick={() => { dispatch({ type: 'SET', field: 'monthlyOutputM', value: outputSuggestion.avg30Days }); setOutputSuggestion(null); }}
                                                    className="bg-white border border-indigo-100 rounded-lg p-2 text-left hover:border-indigo-300 transition-all group"
                                                >
                                                    <p className="text-[8px] uppercase font-black text-slate-400">Last 30 Days</p>
                                                    <p className="text-xs font-mono font-bold text-indigo-600 group-hover:text-indigo-700">{outputSuggestion.avg30Days.toLocaleString()}m</p>
                                                </button>
                                                <button 
                                                    onClick={() => { dispatch({ type: 'SET', field: 'monthlyOutputM', value: outputSuggestion.avg90Days }); setOutputSuggestion(null); }}
                                                    className="bg-white border border-indigo-100 rounded-lg p-2 text-left hover:border-indigo-300 transition-all group"
                                                >
                                                    <p className="text-[8px] uppercase font-black text-slate-400">Last 90 Days</p>
                                                    <p className="text-xs font-mono font-bold text-indigo-600 group-hover:text-indigo-700">{outputSuggestion.avg90Days.toLocaleString()}m</p>
                                                </button>
                                            </div>
                                        </motion.div>
                                    )}
                                </div>

                                {/* Overhead Summary Block */}
                                <div className="shrink-0 sm:w-48 bg-orange-50/50 rounded-xl p-4 border-2 border-orange-100 space-y-4 shadow-sm">
                                    <div className="space-y-1">
                                        <p className="text-[9px] uppercase font-black text-orange-600/70 tracking-wider">Total Monthly Cost</p>
                                        <div className="flex items-baseline gap-1 text-orange-600">
                                            <span className="text-sm font-bold opacity-70">₹</span>
                                            <span className="text-2xl font-black font-mono tracking-tighter">
                                                {totals.overheadTotalMonthly.toLocaleString('en-IN')}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="space-y-2 border-t border-orange-200/50 pt-3">
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">100% Capacity Cost</span>
                                            <div className="flex items-baseline gap-0.5 text-emerald-600">
                                                <span className="text-[8px] font-bold">₹</span>
                                                <span className="text-[10px] font-mono font-bold">{totals.overheadPerMAtCapacity.toFixed(2)}/m</span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-baseline">
                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tight">Your Actual Cost</span>
                                            <div className="flex items-baseline gap-0.5 text-rose-600">
                                                <span className="text-[8px] font-bold">₹</span>
                                                <span className="text-[11px] font-mono font-black">{totals.overheadPerM.toFixed(2)}/m</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Validation Banners (Pilot Safety Rails) */}
                            <div className="space-y-2">
                                {isZeroConfig && (
                                    <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                                        <AlertTriangle className="h-4 w-4 text-rose-500 shrink-0" />
                                        <div>
                                            <p className="text-[11px] font-black text-rose-700">⚠️ Overhead Configuration Missing</p>
                                            <p className="text-[9.5px] font-bold text-rose-600/80 leading-tight">All factory overhead presets are currently at ₹0. Your estimates will be significantly inaccurate until you provide your monthly fixed costs.</p>
                                        </div>
                                    </div>
                                )}
                                
                                {hasElectricityLeak && (
                                    <div className="flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                                        <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                                        <div>
                                            <p className="text-[11px] font-black text-amber-700">⚠️ Electricity Helper Inactive</p>
                                            <p className="text-[9.5px] font-bold text-amber-600/80 leading-tight">The electricity calculator is enabled but missing units or rate data. Power costs are currently not being recovered.</p>
                                        </div>
                                    </div>
                                )}

                                {totals.costOfIdleCapacityMonthly > 500 && (
                                    <div className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50/50 p-3">
                                        <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                                        <div>
                                            <p className="text-[11px] font-black text-rose-700">Cost of Idle Capacity: ₹{totals.costOfIdleCapacityMonthly.toLocaleString('en-IN')}/mo</p>
                                            <p className="text-[9.5px] font-bold text-rose-600/80 leading-tight">Your factory is running at {totals.capacityUtilisationPct.toFixed(1)}% capacity. You are effectively losing money on unrecovered fixed costs.</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Direct Override Input & Safety Rail */}
                            <div className={`rounded-xl border-2 transition-all ${
                                state.overheadOverridePerM != null && state.overheadOverridePerM > 0
                                    ? 'border-amber-400 bg-amber-50/60'
                                    : 'border-dashed border-slate-200 bg-slate-50/40'
                            } px-4 py-3 space-y-2`}>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-600">Direct Overhead Override (₹/m)</p>
                                        <p className="text-[9.5px] text-slate-400 font-medium">Use this to force a specific overhead rate, e.g. from historical data</p>
                                    </div>
                                    {state.overheadOverridePerM != null && state.overheadOverridePerM > 0 && (
                                        <button
                                            onClick={() => dispatch({ type: 'SET', field: 'overheadOverridePerM', value: null })}
                                            className="text-[10px] font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg px-2 py-1 transition-all"
                                        >
                                            Clear
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
                                        className={`h-10 text-sm font-mono font-bold pl-10 pr-20 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-full ${
                                            state.overheadOverridePerM != null && state.overheadOverridePerM > 0
                                                ? 'border-amber-400 bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-300/50'
                                                : 'border-slate-300 bg-white/50'
                                        }`}
                                    />
                                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">PER METRE</span>
                                </div>

                                {state.overheadOverridePerM != null && state.overheadOverridePerM < totals.overheadPerM && (
                                    <div className="flex items-center gap-2 pt-1">
                                        <AlertTriangle className="h-3 w-3 text-amber-600" />
                                        <p className="text-[10px] font-bold text-amber-700">
                                            Safety Alert: Override (₹{state.overheadOverridePerM}) is LOWER than actual computed cost (₹{totals.overheadPerM.toFixed(2)}).
                                            This order will NOT recover ₹{(totals.overheadPerM - state.overheadOverridePerM).toFixed(2)} in overhead per metre.
                                        </p>
                                    </div>
                                )}
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
                        </CardContent>
                    </Card>



                {/* 6. Optional Sections */}
                <Card className="border-border/60 shadow-sm overflow-hidden">
                    <SectionHeader title={t('estimator.post_processing.title')} icon={Palette} accent="orange" />
                    <CardContent className="p-5 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {state.enabledSections.winding ? (
                                <NumField label={t('estimator.field_labels.winding_per_kg')} value={state.windingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'windingRatePerKg', value: v ?? 0 })} unit="₹/kg" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'winding' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.winding')}</button>
                            )}
                            {state.enabledSections.processing ? (
                                <NumField label={t('estimator.field_labels.dyeing_processing')} value={state.processingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'processingRatePerM', value: v ?? 0 })} unit="₹/m" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'processing' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.processing')}</button>
                            )}
                            {state.enabledSections.finishing ? (
                                <NumField label={t('estimator.field_labels.finishing_per_m')} value={state.finishingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'finishingRatePerM', value: v ?? 0 })} unit="₹/m" />
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
                                onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: (v !== null && v > 0) ? v : null })} 
                                unit="m" 
                                step={100}
                                hint={t('estimator.simulation.quantity_hint')}
                            />
                            {hasOrderQty && (
                                <>
                                    <NumField label={t('estimator.field_labels.broker_comm')} value={state.commissionPct} onChange={v => dispatch({ type: 'SET', field: 'commissionPct', value: v ?? 0 })} unit="%" step={0.5} />
                                    <NumField label={t('estimator.field_labels.transport_per_m')} value={state.transportPerM} onChange={v => dispatch({ type: 'SET', field: 'transportPerM', value: v ?? 0 })} unit="₹/m" step={0.1} />
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── SCENARIO ANALYSIS (STRESS TESTS) ───────────────────────── */}
            {hasOrderQty && totals.orderQuote && (
                <div className="max-w-4xl mx-auto space-y-2">
                    <button
                        onClick={() => setShowScenarios(!showScenarios)}
                        className="flex items-center gap-2 w-full px-4 py-3 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-200 transition-colors"
                    >
                        <Zap className="h-4 w-4 text-indigo-500" />
                        <span className="text-sm font-bold text-slate-700">Scenario Analysis (Stress Tests)</span>
                        <Badge variant="outline" className="ml-2 bg-indigo-50 text-indigo-700 border-indigo-200">{scenarios.length} scenarios</Badge>
                        {showScenarios ? <ChevronUp className="h-4 w-4 text-slate-400 ml-auto" /> : <ChevronDown className="h-4 w-4 text-slate-400 ml-auto" />}
                    </button>
                    
                    {showScenarios && (
                        <Card className="border-indigo-100 shadow-sm overflow-hidden bg-indigo-50/20">
                            <CardContent className="p-4 space-y-4">
                                <div className="space-y-3">
                                    {scenarios.map(scen => (
                                        <div key={scen.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-slate-100 rounded-lg shadow-sm gap-2">
                                            <div className="space-y-0.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-bold text-slate-800">{scen.label}</span>
                                                    {scen.costDeltaPct !== 0 && (
                                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${scen.costDeltaPct > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {scen.costDeltaPct > 0 ? '+' : ''}{scen.costDeltaPct.toFixed(1)}% cost
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-[11px] text-slate-500">{scen.description}</p>
                                            </div>
                                            <div className="flex gap-4 sm:text-right shrink-0">
                                                <div>
                                                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Prod Cost</p>
                                                    <p className="text-sm font-mono font-bold text-slate-700">₹{scen.totalProductionCostPerM.toFixed(2)}/m</p>
                                                </div>
                                                {scen.profitDelta !== null && (
                                                    <div>
                                                        <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold mb-0.5">Profit Impact</p>
                                                        <p className={`text-sm font-mono font-bold ${scen.profitDelta < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                                            {scen.profitDelta > 0 ? '+' : ''}{scen.profitDelta < 0 ? '-' : ''}₹{Math.abs(scen.profitDelta).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex items-center gap-3 pt-3 border-t border-indigo-100">
                                    <Label className="text-xs font-bold text-indigo-700 whitespace-nowrap">Test Custom Price:</Label>
                                    <div className="relative flex-1 max-w-[150px]">
                                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">₹</span>
                                        <Input 
                                            type="number"
                                            value={customTargetPrice}
                                            onChange={e => setCustomTargetPrice(e.target.value)}
                                            placeholder="e.g. 21.50"
                                            className="h-8 pl-6 pr-2 text-xs font-mono font-bold border-indigo-200"
                                        />
                                    </div>
                                    <span className="text-[10px] text-indigo-400">Owner sets price, we show resulting margin</span>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

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
                                className="font-bold border-slate-200 focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 rounded-xl h-11 transition-all"
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
                                    <div key={row.id} className="flex items-center gap-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl px-4 py-3 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-700 tracking-tight">{row.label ?? `Warp ${i + 1}`}</p>
                                            <p className="text-[10px] text-slate-500 font-medium font-mono">{row.calcDenier}D · {row.beamEnds} ends · {row.gstPct}% GST</p>
                                        </div>
                                        <div className="relative shrink-0 w-36">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold pointer-events-none">₹</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={editingWarpRates.find(x => x.id === row.id)?.yarnRate ?? row.yarnRate}
                                                onChange={e => setEditingWarpRates(prev =>
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: Number(e.target.value) } : x)
                                                )}
                                                className="h-10 text-sm font-mono font-black text-right pr-12 pl-8 border-indigo-100 focus:border-indigo-300 bg-white rounded-xl shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">/kg</span>
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
                                    <div key={row.id} className="flex items-center gap-4 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl px-4 py-3 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-700 tracking-tight">{row.label ?? `Weft ${i + 1}`}</p>
                                            <p className="text-[10px] text-slate-500 font-medium font-mono">{row.calcDenier}D · {row.picks} PPI · {row.gstPct}% GST</p>
                                        </div>
                                        <div className="relative shrink-0 w-36">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-bold pointer-events-none">₹</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={editingWeftRates.find(x => x.id === row.id)?.yarnRate ?? row.yarnRate}
                                                onChange={e => setEditingWeftRates(prev =>
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: Number(e.target.value) } : x)
                                                )}
                                                className="h-10 text-sm font-mono font-black text-right pr-12 pl-8 border-emerald-100 focus:border-emerald-300 bg-white rounded-xl shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 font-bold pointer-events-none">/kg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Delete zone */}
                        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2">
                            <button
                                onClick={() => {
                                    if (editRatesTpl && window.confirm(t('estimator.edit_template_dialog.delete_confirm').replace('{name}', editRatesTpl.name))) {
                                        handleDeleteTemplate(editRatesTpl.id)
                                        setEditRatesTpl(null)
                                    }
                                }}
                                disabled={deletingTpl === editRatesTpl?.id}
                                className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('estimator.edit_template_dialog.delete_button')}
                            </button>
                            <p className="text-[10px] text-slate-400 font-medium">{t('estimator.edit_template_dialog.delete_note')}</p>
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
                        <Button
                            variant="ghost" 
                            size="sm" 
                            onClick={handleApplyCurrentRates} 
                            className="text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                        >
                            {t('estimator.edit_template_dialog.apply_as_is')}
                        </Button>
                        <Button 
                            className="bg-brand-accent text-white font-black rounded-xl h-12 sm:h-11 shadow-lg shadow-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/30 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none sm:min-w-[180px]" 
                            onClick={handleSaveRatesAndApply} 
                            disabled={savingRates}
                        >
                            {savingRates ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            <span className="text-sm">
                                {t('estimator.edit_template_dialog.save_apply')}
                            </span>
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
                                <p className="text-[10px] uppercase tracking-widest font-black text-slate-500">{t('estimator.convert_dialog.cost_summary')}</p>
                            </div>
                            <div className="p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500 font-medium">{t('estimator.convert_dialog.production_cost')}</span>
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
                                {/* Loom Worker Wage — shown always so owner confirms rate before converting */}
                                {(() => {
                                    const totalPicks = state.weftRows.reduce((s, r) => s + (r.picks ?? 0), 0)
                                    const workerRate = totalPicks * (state.perPickCostPaisa ?? 0)
                                    if (workerRate <= 0) return null
                                    return (
                                        <div className="flex justify-between items-center border-t border-amber-100 pt-2 mt-1">
                                            <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                                                🪡 Loom Worker Wage
                                            </span>
                                            <span className="font-mono font-bold text-sm text-amber-700">
                                                ₹{workerRate.toFixed(2)}/m
                                                <span className="text-slate-400 font-normal text-[10px] ml-1">
                                                    ({totalPicks} picks × ₹{state.perPickCostPaisa}/pick)
                                                </span>
                                            </span>
                                        </div>
                                    )
                                })()}
                                {/* Target Beams — Calculated */}
                                {totals.estimatedBeamCapacityM > 0 && targetMeters > 0 && (
                                    <div className="flex justify-between items-center border-t border-indigo-100 pt-2 mt-1">
                                        <span className="text-xs text-indigo-700 font-semibold flex items-center gap-1">
                                            🎯 Beams Required
                                        </span>
                                        <span className="font-mono font-bold text-sm text-indigo-700">
                                            {Math.ceil(targetMeters / totals.estimatedBeamCapacityM)} beams
                                            <span className="text-slate-400 font-normal text-[10px] ml-1">
                                                (≈ {totals.estimatedBeamCapacityM.toFixed(0)}m/beam)
                                            </span>
                                        </span>
                                    </div>
                                )}
                                {!totals.orderQuote && (
                                    <p className="text-[11px] text-slate-400 italic">{t('estimator.convert_dialog.set_qty_hint')}</p>
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
                        <div className="space-y-1.5">
                             <Label className="text-[10px] uppercase font-black text-slate-500">Special Instructions / Notes</Label>
                             <Textarea
                                 value={orderNotes}
                                 onChange={e => setOrderNotes(e.target.value)}
                                 placeholder="e.g. Needs extra sizing, early delivery for first 2 beams..."
                                 className="resize-none h-16 text-xs"
                             />
                        </div>
                        <p className="text-[11px] text-slate-500 text-center px-4 leading-relaxed">
                            {t('estimator.convert_dialog.order_ready_note_prefix')} <span className="text-indigo-600 font-bold">{t('estimator.convert_dialog.order_ready_note_section')}</span> {t('estimator.convert_dialog.order_ready_note_suffix')}
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
