'use client'

import { useReducer, useEffect, useMemo, useCallback, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
    History,
    Search,
    X,
    AlertTriangle,
    RotateCcw,
    Lock,
    AlertCircle,
    Zap,
    Play,
    CheckCircle2,
    Minus,
    ReceiptText,
    FileDown,
} from 'lucide-react'
import { motion } from 'framer-motion'
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
    cottonCountNeToDenier,
    denierToCottonCountNe,
    getEffectiveYarnDenier,
    getEffectiveCostingWidthCm,
    getWidthWarnings,
    LOOM_TYPE_DEFAULTS,
    type LoomType,
    type YarnCalculationMode,
    type YarnLinearDensityUnit,
    type EstimateState,
    type WarpRow,
    type WeftRow,
    type OverheadItem,
    type ElectricityMeta,
    type DepreciationMeta,
    type FactorySections,
    type EstimatorV3Totals,
} from '@/lib/estimator'
import { LoomConfigSection } from './LoomConfigSection'
import {
    getFactoryCostProfile,
    getEstimatorTemplates,
    saveAsFabricTemplate,
    saveEstimatorQuoteV3,
    getFixedWorkersForOverhead,
    deleteTemplate,
    updateTemplateRates,
    updateFabricTemplate,
    renameTemplate,
    getLastQuoteForParty,
    getMonthlyOutputSuggestion,
    upsertFactoryCostProfile,
    createMarketRunFromEstimator,
    startPartyOrderFromEstimator,
} from './actions'
import { useAutosave } from '@/hooks/useAutosave'
import { toast } from 'sonner'
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import FactoryCostWizard from './FactoryCostWizard'
import {
    getEstimatorWorkflowConfig,
    type EstimatorWorkflowMode,
    type ProductionMode,
} from '@/lib/production-mode'
import {
    getFirstEstimatorValidationMessage,
    validateEstimatorSnapshot,
} from '@/lib/estimator-validation'
import { shouldAutoRestoreEstimatorDraft } from '@/lib/estimator-drafts'
import { createClientRequestUuid } from '@/lib/client-request-id'
import { CostingExportDialog } from '@/components/estimator/CostingExportDialog'
import { createCostingExportModel } from '@/lib/estimator-export'
import type { CostingRecordKind } from '@/lib/costing-workspace'

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

type FixedWorkerOverhead = { id: number; name: string; role: string; monthly_salary: number }

type FactoryCostProfile = Partial<{
    factory_id: string
    warping_rate_per_kg: number | string | null
    sizing_rate_per_kg: number | string | null
    winding_rate_per_kg: number | string | null
    overhead_pct: number | string | null
    default_commission_pct: number | string | null
    default_transport_per_m: number | string | null
    default_warp_yarn_name: string | null
    default_warp_yarn_rate_per_kg: number | string | null
    default_weft_yarn_name: string | null
    default_weft_yarn_rate_per_kg: number | string | null
    default_processing_rate_per_m: number | string | null
    default_finishing_rate_per_m: number | string | null
    enabled_sections: FactorySections
    overhead_items: unknown[]
    monthly_output_m: number | string | null
    overhead_override_per_m: number | string | null
    loom_count: number | string | null
    monthly_working_days: number | string | null
    avg_output_per_loom_per_day: number | string | null
    yarn_shortage_pct: number | string | null
    warp_crimp_pct: number | string | null
    is_configured: boolean
}>

type EstimatorTemplate = {
    id: string
    name: string
    updated_at: string
    warp_rows?: WarpRow[] | null
    weft_rows?: WeftRow[] | null
    loom_type?: LoomType | null
    loom_rpm?: number | string | null
    loom_power_kw?: number | string | null
    sizing_mode?: 'in_house' | 'outsourced' | null
    hours_per_shift?: number | string | null
    tape_length_m?: number | string | null
    warp_crimp_pct?: number | string | null
    per_pick_cost_paise?: number | string | null
    yarn_shortage_pct?: number | string | null
    overhead_override_per_m?: number | string | null
    calculated_yarn_denier?: number | string | null
    yarn_denier?: number | string | null
    beam_ends?: number | string | null
    ppi?: number | string | null
    reed_space?: number | string | null
    weft_denier?: number | string | null
    default_yarn_rate?: number | string | null
    is_active?: boolean
    content_text?: string
}

type EstimateStatePatch = Partial<EstimateState>
type EstimateStateValue = EstimateState[keyof EstimateState]
type WarpRowValue = WarpRow[keyof WarpRow]
type WeftRowValue = WeftRow[keyof WeftRow]
type OverheadItemValue = OverheadItem['label'] | OverheadItem['monthlyAmount'] | OverheadItem['isLocked']
type OverheadMetaPatch =
    | ({ type: 'electricity' } & Partial<Omit<ElectricityMeta, 'type'>>)
    | ({ type: 'depreciation' } & Partial<Omit<DepreciationMeta, 'type'>>)

function mergeOverheadMeta(current: OverheadItem['meta'], patch: OverheadMetaPatch): OverheadItem['meta'] {
    if (patch.type === 'electricity') {
        const base: ElectricityMeta = current?.type === 'electricity'
            ? current
            : { type: 'electricity', mode: patch.mode ?? 'manual' }
        return { ...base, ...patch }
    }

    const base: DepreciationMeta = current?.type === 'depreciation'
        ? current
        : {
            type: 'depreciation',
            avgCostPerLoom: patch.avgCostPerLoom ?? 0,
            usefulLifeYears: patch.usefulLifeYears ?? 10,
        }
    return { ...base, ...patch }
}

type Action =
    | { type: 'INIT_FROM_PROFILE'; data: { profile: FactoryCostProfile; sections: FactorySections } }
    | { type: 'MERGE_FIXED_WORKERS'; workers: FixedWorkerOverhead[] }
    | { type: 'APPLY_TEMPLATE'; template: EstimatorTemplate }
    | { type: 'SET'; field: keyof EstimateState; value: EstimateStateValue }
    | { type: 'SET_LOOM_TYPE'; loomType: LoomType | null }
    | { type: 'SET_LOOM_RPM'; rpm: number | null }
    | { type: 'SET_LOOM_POWER_KW'; kw: number | null }
    | { type: 'ADD_WARP_ROW' }
    | { type: 'UPDATE_WARP_ROW'; id: string; field: keyof WarpRow; value: WarpRowValue }
    | { type: 'REMOVE_WARP_ROW'; id: string }
    | { type: 'ADD_WEFT_ROW' }
    | { type: 'UPDATE_WEFT_ROW'; id: string; field: keyof WeftRow; value: WeftRowValue }
    | { type: 'REMOVE_WEFT_ROW'; id: string }
    | { type: 'ENABLE_SECTION'; section: keyof FactorySections }
    | { type: 'ADD_OVERHEAD_ITEM' }
    | { type: 'UPDATE_OVERHEAD_ITEM'; id: string; field: 'label' | 'monthlyAmount' | 'isLocked'; value: OverheadItemValue }
    | { type: 'UPDATE_OVERHEAD_ITEM_META'; id: string; meta: OverheadMetaPatch }
    | { type: 'REMOVE_OVERHEAD_ITEM'; id: string }
    | { type: 'RESTORE_DRAFT'; draftState: EstimateState }
    | { type: 'RESET'; data: { profile?: FactoryCostProfile; sections: FactorySections; workers: FixedWorkerOverhead[] } }

function estimateReducer(state: EstimateState, action: Action): EstimateState {
    switch (action.type) {
        case 'INIT_FROM_PROFILE': {
            const { profile, sections } = action.data
            // Hydrate overhead items from saved profile if present, else keep defaults
            const savedItems =
                Array.isArray(profile.overhead_items) && profile.overhead_items.length > 0
                    ? profile.overhead_items
                    : undefined
            return {
                ...state,
                warpingRatePerKg:   Number(profile.warping_rate_per_kg ?? 2),
                sizingRatePerKg:    Number(profile.sizing_rate_per_kg  ?? 1.5),
                windingRatePerKg:   Number(profile.winding_rate_per_kg ?? 0),
                warpRows:           state.warpRows.map((row, index) => index === 0 ? { ...row, label: profile.default_warp_yarn_name || row.label, yarnRate: Number(profile.default_warp_yarn_rate_per_kg ?? row.yarnRate) } : row),
                weftRows:           state.weftRows.map((row, index) => index === 0 ? { ...row, label: profile.default_weft_yarn_name || row.label, yarnRate: Number(profile.default_weft_yarn_rate_per_kg ?? row.yarnRate) } : row),
                processingRatePerM: Number(profile.default_processing_rate_per_m ?? state.processingRatePerM),
                finishingRatePerM:  Number(profile.default_finishing_rate_per_m ?? state.finishingRatePerM),
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
            // Explicit null fallbacks for pre-loom-type templates (Gap 4)
            // Ensures undefined template fields never corrupt existing session state.
            const loomFields = {
                loomType:              (tpl.loom_type ?? null) as LoomType | null,
                loomRpm:               tpl.loom_rpm != null ? Number(tpl.loom_rpm) : null,
                loomPowerKw:           tpl.loom_power_kw != null ? Number(tpl.loom_power_kw) : null,
                loomRpmIsCustomised:   false,
                loomPowerKwIsCustomised: false,
                sizingMode:            (tpl.sizing_mode ?? 'in_house') as 'in_house' | 'outsourced',
                hoursPerShift:         tpl.hours_per_shift != null ? Number(tpl.hours_per_shift) : state.hoursPerShift,
            }
            if (tpl.warp_rows && tpl.warp_rows.length > 0) {
                return {
                    ...state,
                    ...loomFields,
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
                ...loomFields,
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
        case 'SET_LOOM_TYPE': {
            const lt = action.loomType
            if (!lt) return { ...state, loomType: null, loomRpm: null, loomPowerKw: null, loomRpmIsCustomised: false, loomPowerKwIsCustomised: false }
            const defaults = LOOM_TYPE_DEFAULTS[lt]
            return {
                ...state,
                loomType: lt,
                // Auto-fill from class defaults; null for 'other' so user must enter
                loomRpm:    defaults.rpm !== null ? defaults.rpm : null,
                loomPowerKw: defaults.powerKw !== null ? defaults.powerKw : null,
                loomRpmIsCustomised:   false,
                loomPowerKwIsCustomised: false,
            }
        }
        case 'SET_LOOM_RPM':
            return { ...state, loomRpm: action.rpm, loomRpmIsCustomised: true }
        case 'SET_LOOM_POWER_KW':
            return { ...state, loomPowerKw: action.kw, loomPowerKwIsCustomised: true }
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
                    item.id === action.id ? { ...item, meta: mergeOverheadMeta(item.meta, action.meta) } : item
                ),
            }
        case 'REMOVE_OVERHEAD_ITEM':
            return {
                ...state,
                overheadItems: state.overheadItems.filter(item => item.id !== action.id),
            }
        case 'RESET': {
            const { sections, workers } = action.data
            const profile = action.data.profile ?? {}
            const base = makeDefaultEstimateState()
            
            // Create the profile-synced default state (same logic as initialState useMemo)
            let next = {
                ...base,
                warpingRatePerKg:  Number(profile.warping_rate_per_kg  ?? base.warpingRatePerKg),
                sizingRatePerKg:   Number(profile.sizing_rate_per_kg   ?? base.sizingRatePerKg),
                windingRatePerKg:  Number(profile.winding_rate_per_kg  ?? base.windingRatePerKg),
                warpRows:          base.warpRows.map((row, index) => index === 0 ? { ...row, label: profile.default_warp_yarn_name || row.label, yarnRate: Number(profile.default_warp_yarn_rate_per_kg ?? row.yarnRate) } : row),
                weftRows:          base.weftRows.map((row, index) => index === 0 ? { ...row, label: profile.default_weft_yarn_name || row.label, yarnRate: Number(profile.default_weft_yarn_rate_per_kg ?? row.yarnRate) } : row),
                processingRatePerM: Number(profile.default_processing_rate_per_m ?? base.processingRatePerM),
                finishingRatePerM: Number(profile.default_finishing_rate_per_m ?? base.finishingRatePerM),
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
                const fixedItems = workers.map((w) => ({
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

type EstimatorAccent = 'warp' | 'weft' | 'weave' | 'overhead' | 'post' | 'neutral'

function getAccentStyles(accent: EstimatorAccent = 'neutral') {
    const styles: Record<EstimatorAccent, {
        icon: string
        marker: string
        text: string
        rail: string
        panel: string
        ring: string
    }> = {
        warp: {
            icon: 'bg-[#EEF5FB] text-[var(--color-info-blue)] border-[#D7E7F1]',
            marker: 'bg-[#EEF5FB] text-[var(--color-info-blue)] border-[#D7E7F1]',
            text: 'text-[var(--color-info-blue)]',
            rail: 'bg-[var(--color-info-blue)]',
            panel: 'border-[#D7E7F1] bg-[#F7FBFD]',
            ring: 'focus:border-[var(--color-info-blue)] focus:ring-[var(--color-info-blue)]/15',
        },
        weft: {
            icon: 'bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)] border-[#CDE5D3]',
            marker: 'bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)] border-[#CDE5D3]',
            text: 'text-[var(--color-factory-green)]',
            rail: 'bg-[var(--color-factory-green)]',
            panel: 'border-[#CDE5D3] bg-[#F7FCF8]',
            ring: 'focus:border-[var(--color-factory-green)] focus:ring-[var(--color-factory-green)]/15',
        },
        weave: {
            icon: 'bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] border-[#EFD7A4]',
            marker: 'bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] border-[#EFD7A4]',
            text: 'text-[var(--color-warning-amber)]',
            rail: 'bg-[var(--color-warning-amber)]',
            panel: 'border-[#EFD7A4] bg-[#FFFBF2]',
            ring: 'focus:border-[var(--color-warning-amber)] focus:ring-[var(--color-warning-amber)]/15',
        },
        overhead: {
            icon: 'bg-[var(--color-risk-red-soft)] text-[var(--color-risk-red)] border-[#EEC6BD]',
            marker: 'bg-[var(--color-risk-red-soft)] text-[var(--color-risk-red)] border-[#EEC6BD]',
            text: 'text-[var(--color-risk-red)]',
            rail: 'bg-[var(--color-risk-red)]',
            panel: 'border-[#EEC6BD] bg-[#FFF7F5]',
            ring: 'focus:border-[var(--color-risk-red)] focus:ring-[var(--color-risk-red)]/15',
        },
        post: {
            icon: 'bg-[var(--color-surface-soft)] text-[var(--color-muted)] border-[var(--color-hairline)]',
            marker: 'bg-[var(--color-surface-soft)] text-[var(--color-muted)] border-[var(--color-hairline)]',
            text: 'text-[var(--color-muted)]',
            rail: 'bg-[var(--color-hairline-strong)]',
            panel: 'border-[var(--color-hairline)] bg-[var(--color-canvas)]',
            ring: 'focus:border-[var(--color-yarn-orange)] focus:ring-[var(--color-yarn-orange)]/15',
        },
        neutral: {
            icon: 'bg-[var(--color-surface-soft)] text-[var(--color-muted)] border-[var(--color-hairline)]',
            marker: 'bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] border-[#EFD7A4]',
            text: 'text-[var(--color-muted)]',
            rail: 'bg-[var(--color-yarn-orange)]',
            panel: 'border-[var(--color-hairline)] bg-[var(--color-canvas)]',
            ring: 'focus:border-[var(--color-yarn-orange)] focus:ring-[var(--color-yarn-orange)]/15',
        },
    }
    return styles[accent]
}

function SectionHeader({ title, icon: Icon, accent = 'warp', badgeContent, detail, step }: {
    title:    string
    icon:     React.ElementType
    accent?:  EstimatorAccent
    badgeContent?: React.ReactNode
    detail?: React.ReactNode
    step?: number
}) {
    const colorClass = getAccentStyles(accent)
    return (
        <div className="flex flex-col gap-3 border-b border-[var(--color-hairline)] bg-gradient-to-r from-white to-[var(--color-canvas)]/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
                {step != null && (
                    <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] border text-[12px] font-semibold ${colorClass.marker}`}>
                        {step}
                    </span>
                )}
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border ${colorClass.icon}`}>
                    <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                    <span className="text-[15px] font-semibold text-[var(--color-ink)]">{title}</span>
                    {detail}
                </div>
            </div>
            {badgeContent && <div className="shrink-0 self-start sm:self-center">{badgeContent}</div>}
        </div>
    )
}

function EstimatorCard({ children, accent = 'neutral' }: { children: React.ReactNode; accent?: EstimatorAccent }) {
    const accentClass = getAccentStyles(accent).rail
    return (
        <Card className="relative mb-3 overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] shadow-[0_8px_28px_rgba(30,37,40,0.045)]">
            <div className={`absolute left-0 top-0 h-full w-[3px] ${accentClass}`} />
            {children}
        </Card>
    )
}

function StepperField({
    label,
    value,
    onChange,
    unit = '%',
    step = 0.5,
    hint,
    accent = 'warp',
}: {
    label: string
    value: number
    onChange: (v: number) => void
    unit?: string
    step?: number
    hint?: string
    accent?: EstimatorAccent
}) {
    const accentStyles = getAccentStyles(accent)
    const decrement = () => onChange(Math.max(0, Number((value - step).toFixed(2))))
    const increment = () => onChange(Number((value + step).toFixed(2)))
    return (
        <div className="min-w-0 space-y-2">
            <Label className={`block text-[11px] font-semibold uppercase tracking-[0.05em] ${accentStyles.text}`}>
                {label}
            </Label>
            <div className="inline-flex h-10 overflow-hidden rounded-[9px] border border-[var(--color-hairline)] bg-white shadow-[0_1px_2px_rgba(30,37,40,0.04)]">
                <button
                    type="button"
                    onClick={decrement}
                    className="flex w-10 items-center justify-center border-r border-[var(--color-hairline)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                >
                    <Minus className="h-3.5 w-3.5" />
                </button>
                <Input
                    type="number"
                    value={value}
                    step={step}
                    min={0}
                    onChange={e => onChange(Number(e.target.value))}
                    className="h-full w-16 rounded-none border-0 bg-white p-0 text-center font-mono text-sm font-semibold text-[var(--color-ink)] shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="flex w-10 items-center justify-center border-l border-r border-[var(--color-hairline)] text-xs font-semibold text-[var(--color-muted)]">
                    {unit}
                </span>
                <button
                    type="button"
                    onClick={increment}
                    className="flex w-10 items-center justify-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>
            {hint && <p className="text-[11px] font-medium leading-tight text-[var(--color-muted)]">{hint}</p>}
        </div>
    )
}

function NumField({
    label, value, onChange, unit, step = 1, min = 0, hint, warning, onDismissWarning, placeholder, attentionWhenEmpty = false,
}: {
    label: string; value: number | null; onChange: (v: number | null) => void
    unit?: string; step?: number; min?: number; hint?: string; warning?: string
    onDismissWarning?: () => void; placeholder?: string; attentionWhenEmpty?: boolean
}) {
    const isEmpty = attentionWhenEmpty && (!value || value <= 0)
    // Estimator defaults are stored as numeric zero for calculations, but an
    // empty control with a zero placeholder is a better editing experience:
    // the first digit typed replaces the visual default instead of appending
    // to it (for example, entering 55 must never appear as 055).
    const displayValue = value === 0 ? '' : (value ?? '')
    const displayPlaceholder = value === 0 ? (placeholder ?? '0') : placeholder
    return (
        <div className="space-y-1.5 min-w-0">
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">{label}</Label>
            <div className="relative group">
                <Input
                    type="number"
                    step={step}
                    min={min}
                    placeholder={displayPlaceholder}
                    value={displayValue}
                    onChange={e => {
                        const val = e.target.value === '' ? null : Number(e.target.value)
                        onChange(val)
                    }}
                    className={`h-11 text-xs sm:text-sm font-mono font-semibold text-center pr-10 sm:pr-14 border focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[9px] text-[var(--color-yarn-orange)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] ${
                        isEmpty ? 'bg-[var(--color-warning-amber-soft)] border-[var(--color-warning-amber)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'bg-[var(--color-canvas-white)] border-[var(--color-hairline)] hover:border-[var(--color-hairline-strong)]'
                    }`}
                />
                {unit && (
                    <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)] font-medium pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {isEmpty && <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required</p>}
            {warning ? (
                <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-[var(--color-warning-amber)] shrink-0" />
                        <p className="text-[10px] font-medium text-[var(--color-warning-amber)] truncate">{warning}</p>
                    </div>
                    {onDismissWarning && (
                        <button 
                            onClick={onDismissWarning}
                            className="text-xs text-slate-400 hover:text-slate-600 underline text-left pl-4"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            ) : hint && !isEmpty ? (
                <p className="text-[11px] text-[var(--color-muted)] font-medium leading-tight mt-1">{hint}</p>
            ) : null}
        </div>
    )
}

type YarnDensityRow = Pick<WarpRow | WeftRow, 'id' | 'linearDensityUnit' | 'cottonCountNe' | 'calcDenier'>
type YarnDensityField = 'linearDensityUnit' | 'cottonCountNe' | 'calcDenier'

function YarnDensityFields({
    row,
    onChange,
}: {
    row: YarnDensityRow
    onChange: (field: YarnDensityField, value: YarnLinearDensityUnit | number | null) => void
}) {
    const unit = row.linearDensityUnit === 'cotton_count_ne' ? 'cotton_count_ne' : 'denier'
    const countNe = Number(row.cottonCountNe ?? 0)
    const effectiveDenier = getEffectiveYarnDenier(row)

    const changeUnit = (nextUnit: YarnLinearDensityUnit) => {
        if (nextUnit === 'cotton_count_ne') {
            const nextCount = countNe > 0 ? countNe : denierToCottonCountNe(Number(row.calcDenier ?? 0))
            onChange('cottonCountNe', nextCount > 0 ? nextCount : null)
            onChange('calcDenier', nextCount > 0 ? cottonCountNeToDenier(nextCount) : 0)
        } else {
            onChange('calcDenier', effectiveDenier)
        }
        onChange('linearDensityUnit', nextUnit)
    }

    return (
        <>
            <div className="min-w-0 space-y-1.5">
                <Label
                    htmlFor={`yarn-density-unit-${row.id}`}
                    className="flex h-8 items-end text-[11px] font-semibold uppercase leading-tight tracking-[0.05em] text-[var(--color-muted)]"
                >
                    Yarn numbering
                </Label>
                <select
                    id={`yarn-density-unit-${row.id}`}
                    value={unit}
                    onChange={event => changeUnit(event.target.value as YarnLinearDensityUnit)}
                    className="h-11 w-full rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] px-3 text-xs font-semibold text-[var(--color-ink)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] transition-all hover:border-[var(--color-hairline-strong)] focus:border-[var(--color-yarn-orange)] focus:outline-none focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 sm:text-sm"
                >
                    <option value="denier">Denier (D)</option>
                    <option value="cotton_count_ne">English cotton count (Ne)</option>
                </select>
            </div>
            <NumField
                label={unit === 'cotton_count_ne' ? 'English cotton count' : 'Effective denier'}
                value={unit === 'cotton_count_ne' ? (countNe || null) : row.calcDenier}
                onChange={value => {
                    if (unit === 'cotton_count_ne') {
                        onChange('cottonCountNe', value)
                        onChange('calcDenier', value && value > 0 ? cottonCountNeToDenier(value) : 0)
                    } else {
                        onChange('calcDenier', value ?? 0)
                    }
                }}
                unit={unit === 'cotton_count_ne' ? 'Ne' : 'D'}
                step={0.1}
                hint={unit === 'cotton_count_ne' && effectiveDenier > 0
                    ? `Converted for costing: ${effectiveDenier.toFixed(3)} D (5315 ÷ Ne)`
                    : 'Enter total linear density after any ply or doubling'}
                attentionWhenEmpty
            />
        </>
    )
}

function WidthField({
    label,
    value,
    onChange,
    unit,
    hint,
    warning,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    unit: 'cm' | 'inch'
    hint?: string
    warning?: string
}) {
    const displayValue = useMemo(() => {
        if (!value) return ''
        if (unit === 'inch') {
            const inches = value / 2.54
            return Number(inches.toFixed(2))
        }
        return value
    }, [value, unit])

    const secondaryReadout = useMemo(() => {
        if (!value) return ''
        if (unit === 'cm') {
            const inches = value / 2.54
            const roundedInches = Math.round(inches)
            if (Math.abs(inches - roundedInches) < 0.15) {
                return `≈ ${roundedInches} inches`
            }
            return `≈ ${inches.toFixed(1)} inches`
        } else {
            const roundedCm = Math.round(value)
            if (Math.abs(value - roundedCm) < 0.3) {
                return `≈ ${roundedCm} cm`
            }
            return `≈ ${value.toFixed(1)} cm`
        }
    }, [value, unit])

    return (
        <div className="space-y-1.5 min-w-0">
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                {label}
            </Label>
            <div className="relative group">
                <Input
                    type="number"
                    step={unit === 'cm' ? 1 : 0.1}
                    min={0}
                    value={displayValue}
                    onChange={e => {
                        const raw = e.target.value === '' ? 0 : Number(e.target.value)
                        if (unit === 'inch') {
                            const cm = raw * 2.54
                            onChange(Number(cm.toFixed(4)))
                        } else {
                            onChange(raw)
                        }
                    }}
                    className="h-11 text-xs sm:text-sm font-mono font-semibold text-center pr-12 sm:pr-16 bg-white border-[var(--color-hairline)] focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-[0_1px_2px_rgba(30,37,40,0.035)] group-hover:border-[var(--color-hairline-strong)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[9px] text-[var(--color-yarn-orange)]"
                />
                <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">
                    {unit}
                </span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
                {value > 0 && (
                    <p className="text-[10px] text-[var(--color-factory-green)] font-semibold leading-tight flex items-center gap-1 bg-[var(--color-factory-green-soft)] py-0.5 px-2 rounded-md self-start border border-[#CDE5D3]">
                        {secondaryReadout}
                    </p>
                )}
                {warning && (
                    <p className="flex items-start gap-1 rounded-md border border-[var(--color-warning-amber-soft)] bg-[var(--color-warning-amber-soft)] px-2 py-1 text-[10px] font-semibold leading-tight text-[var(--color-warning-amber)]">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{warning}</span>
                    </p>
                )}
                {hint && <p className="text-[10px] text-[var(--color-muted)] font-medium leading-tight pl-1">{hint}</p>}
            </div>
        </div>
    )
}

function SectionCostPill({ value }: { value: number }) {
    const hasCost = value > 0
    return (
        <span className={`rounded-full border px-3 py-1 text-[13px] font-semibold shadow-[0_1px_2px_rgba(30,37,40,0.035)] ${
            hasCost
                ? 'border-[#CDE5D3] bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)]'
                : 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[var(--color-muted)]'
        }`}>
            ₹{value.toFixed(2)}/m
        </span>
    )
}

function CapacityMetricField({
    label, value, unit, onChange, hint,
}: {
    label: string
    value: number | null
    unit: string
    onChange: (value: number | null) => void
    hint?: string
}) {
    return (
        <div className="rounded-[10px] border border-[var(--color-hairline)] bg-gradient-to-br from-[var(--color-canvas)] to-[var(--color-surface-soft)] px-3 py-2.5">
            <Label className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</Label>
            <div className="mt-1 flex items-end gap-1">
                <Input
                    type="number"
                    value={value ?? ''}
                    onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
                    className="h-7 border-0 bg-transparent p-0 text-lg font-semibold text-[var(--color-ink)] shadow-none focus-visible:ring-0"
                />
                <span className="pb-0.5 text-[11px] font-medium text-[var(--color-muted)]">{unit}</span>
            </div>
            {hint && <p className="mt-1 text-[10px] text-[var(--color-muted)]">{hint}</p>}
        </div>
    )
}

function InlineInputWarning({ show, children }: { show: boolean; children: React.ReactNode }) {
    if (!show) return null
    return <p className="text-[10px] text-[var(--color-warning-amber)]">{children}</p>
}

function LayerNameField({
    label,
    value,
    placeholder,
    onChange,
}: {
    label: string
    value: string
    placeholder: string
    onChange: (value: string) => void
}) {
    return (
        <div className="space-y-1.5 min-w-0">
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                {label}
            </Label>
            <Input
                value={value}
                placeholder={placeholder}
                onChange={e => onChange(e.target.value)}
                className={`h-11 rounded-[9px] border font-semibold focus:border-[var(--color-yarn-orange)] focus:ring-[var(--color-yarn-orange)]/10 ${
                    value?.trim() ? 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)]' : 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]'
                }`}
            />
            {!value?.trim() && <p className="text-[10px] text-[var(--color-warning-amber)]">Required</p>}
        </div>
    )
}

function CalculationModeField({
    value,
    onChange,
}: {
    value: YarnCalculationMode
    onChange: (value: YarnCalculationMode) => void
}) {
    return (
        <div className="space-y-1.5 min-w-[140px]">
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                Mode
            </Label>
            <div className="grid h-11 grid-cols-2 rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
                {(['formula', 'manual'] as YarnCalculationMode[]).map(mode => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onChange(mode)}
                        className={`rounded-[7px] px-1 text-[11px] font-semibold whitespace-nowrap transition-all ${
                            value === mode
                                ? 'border border-[var(--color-hairline)] bg-white text-[var(--color-ink)] shadow-sm'
                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                        }`}
                    >
                        {mode === 'formula' ? 'Formula' : 'Manual kg'}
                    </button>
                ))}
            </div>
        </div>
    )
}

function findMissingLayerLabel(warpRows: WarpRow[], weftRows: WeftRow[]) {
    const missingWarpIndex = warpRows.findIndex(row => !row.label?.trim())
    if (missingWarpIndex >= 0) return `Warp ${missingWarpIndex + 1}`

    const missingWeftIndex = weftRows.findIndex(row => !row.label?.trim())
    if (missingWeftIndex >= 0) return `Weft ${missingWeftIndex + 1}`

    return null
}

function trimLayerLabels<T extends WarpRow | WeftRow>(rows: T[]) {
    return rows.map(row => ({ ...row, label: row.label?.trim() }))
}

function RowCard({
    title, index, onRemove, canRemove, kgPer100m, costPer100m, adjustmentPct, children, accent = 'indigo'
}: {
    title: string; index: number; onRemove: () => void; canRemove: boolean
    kgPer100m: number; costPer100m: number; adjustmentPct?: number; children: React.ReactNode; accent?: 'indigo' | 'emerald'
}) {
    const colors = {
        indigo:  { strip: 'bg-[#F6FAFD]', badge: 'bg-[#EEF5FB] text-[var(--color-info-blue)] border-[#D7E7F1]', dot: 'bg-[var(--color-info-blue)]' },
        emerald: { strip: 'bg-[#F7FCF8]', badge: 'bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)] border-[#CDE5D3]', dot: 'bg-[var(--color-factory-green)]' },
    }
    const c = colors[accent]
    return (
        <div className="group overflow-hidden rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] shadow-[0_1px_8px_rgba(30,37,40,0.035)]">
            <div className={`flex flex-col gap-2 border-b border-[var(--color-hairline)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${c.strip}`}>
                <div className="flex min-w-0 items-center gap-2">
                    <span className={`rounded-[6px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${c.badge}`}>
                        {title} {index + 1}
                    </span>
                    <span className={`h-2 w-2 rounded-full ${c.dot}`} />
                    <Badge variant="outline" className="h-4 border-0 bg-transparent px-0 py-0 text-[11px] font-semibold text-[var(--color-muted)]">
                        {kgPer100m.toFixed(3)} kg/100m
                    </Badge>
                    {adjustmentPct != null && (
                        <Badge variant="outline" className={`h-5 rounded-[6px] px-1.5 py-0 text-[10px] font-semibold ${c.badge}`}>
                            Adj {adjustmentPct.toFixed(1)}%
                        </Badge>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <span className="text-xs font-semibold text-[var(--color-muted)]">
                        ₹{costPer100m.toFixed(2)}/100m
                    </span>
                    <ChevronUp className="h-4 w-4 text-[var(--color-muted)]" />
                    {canRemove && (
                        <button onClick={onRemove} className="rounded-md p-1 text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-risk-red)]">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className={`grid gap-4 px-4 py-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${accent === 'indigo' ? '2xl:grid-cols-7' : '2xl:grid-cols-9'}`}>
                {children}
            </div>
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
    userId,
    orgId,
    canUseProduction,
    productionMode,
    staleDefaultRateNames,
    organizationName,
}: {
    initialProfile?: FactoryCostProfile
    initialTemplates?: EstimatorTemplate[]
    initialWorkers?: FixedWorkerOverhead[]
    userId: string
    orgId: string
    canUseProduction: boolean
    productionMode: ProductionMode
    staleDefaultRateNames: string[]
    organizationName: string
}) {
    const { t, tx } = useTranslation()
    const searchParams = useSearchParams()
    const router = useRouter()

    const estimatorWorkflow = getEstimatorWorkflowConfig(productionMode, searchParams.get('mode'))
    const [mode, setMode] = useState<EstimatorWorkflowMode>(
        canUseProduction ? estimatorWorkflow.initialMode : 'quote'
    )
    const { allowsPartyOrders, allowsMarketRuns } = estimatorWorkflow

    const [widthUnit, setWidthUnit] = useState<'cm' | 'inch'>('inch')
    const [hasLoadedWidthUnit, setHasLoadedWidthUnit] = useState(false)

    useEffect(() => {
        const saved = localStorage.getItem('weavly-estimator-width-unit')
        if (saved === 'cm' || saved === 'inch') setWidthUnit(saved)
        setHasLoadedWidthUnit(true)
    }, [])

    useEffect(() => {
        if (!hasLoadedWidthUnit) return
        if (typeof window !== 'undefined') {
            localStorage.setItem('weavly-estimator-width-unit', widthUnit)
        }
    }, [hasLoadedWidthUnit, widthUnit])

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
            warpRows:          base.warpRows.map((row, index) => index === 0 ? { ...row, label: initialProfile.default_warp_yarn_name || row.label, yarnRate: Number(initialProfile.default_warp_yarn_rate_per_kg ?? row.yarnRate) } : row),
            weftRows:          base.weftRows.map((row, index) => index === 0 ? { ...row, label: initialProfile.default_weft_yarn_name || row.label, yarnRate: Number(initialProfile.default_weft_yarn_rate_per_kg ?? row.yarnRate) } : row),
            processingRatePerM: Number(initialProfile.default_processing_rate_per_m ?? base.processingRatePerM),
            finishingRatePerM: Number(initialProfile.default_finishing_rate_per_m ?? base.finishingRatePerM),
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
    const [savingQuote, setSavingQuote] = useState(false)
    const saveQuoteLockRef = useRef(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templates, setTemplates] = useState<EstimatorTemplate[]>(initialTemplates ?? [])
    const [outputSuggestion, setOutputSuggestion] = useState<EstimateState['outputSuggestion'] | null>(null)
    const [isSuggestingOutput, setIsSuggestingOutput] = useState(false)

    // Loom wage per meter input — bidirectional with perPickCostPaisa
    const [wagePerMInput, setWagePerMInput] = useState<string>('')

    const [partyName,       setPartyName]       = useState('')
    const [qualityLabel,    setQualityLabel]    = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const lastGeneratedWarp = useRef<string | null>(null)
    const lastGeneratedWeft = useRef<string | null>(null)
    const [sourceQuoteId, setSourceQuoteId] = useState<string | null>(null)
    const [sourceQuoteUpdatedAt, setSourceQuoteUpdatedAt] = useState<string | null>(null)
    const [sourceRecordKind, setSourceRecordKind] = useState<CostingRecordKind | null>(null)
    const isStandaloneCostingSession = !canUseProduction || sourceRecordKind === 'costing'
    const quoteRequestIdRef = useRef<string | null>(null)
    const autoRestoredDraftSavedAtRef = useRef<number | null>(null)

    const [showSaveTemplate, setShowSaveTemplate] = useState(false)
    const [showExportDialog, setShowExportDialog] = useState(false)
    const [pendingStaleRateSave, setPendingStaleRateSave] = useState<{
        targetMode: 'quote' | 'market'
        status: 'draft' | 'accepted'
        recordKindOverride?: 'costing' | 'quotation'
    } | null>(null)
    const [templateName,     setTemplateName]     = useState('')
    const [templateSaveError, setTemplateSaveError] = useState<string | null>(null)

    // Template management — "edit rates" sheet
    const [editRatesTpl,     setEditRatesTpl]     = useState<EstimatorTemplate | null>(null)
    const [editingTplName,   setEditingTplName]   = useState('')
    const [editingWarpRates, setEditingWarpRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [editingWeftRates, setEditingWeftRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [savingRates,      setSavingRates]      = useState(false)
    const [deletingTpl,      setDeletingTpl]      = useState<string | null>(null)
    const [appliedTemplate,   setAppliedTemplate]   = useState<EstimatorTemplate | null>(null)
    const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([])
    const [showConfirmNewQuality, setShowConfirmNewQuality] = useState(false)

    // Template search
    const [templateSearch,   setTemplateSearch]   = useState('')

    // Scenario panel
    const [showScenarios,      setShowScenarios]      = useState(false)
    const [customTargetPrice,  setCustomTargetPrice]  = useState<string>('')
    const [showAdvancedOverhead, setShowAdvancedOverhead] = useState(false)

    // Party rate memory — debounced with 800ms + 3-char min
    const [partyHint, setPartyHint] = useState<{
        quality_label: string; quote_price_per_meter: number; created_at: string
    } | null>(null)
    const partyLookupTimerRef = useState<ReturnType<typeof setTimeout> | null>(null)

    // Autosave — scoped per user (orgId-userId) so multi-user on same device is safe
    const { hasDraft, draft, restoreDraft, dismissDraft, clearDraft, saveDraft, saveDraftNow } = useAutosave<EstimateState>({
        orgId, userId, debounceMs: 2000,
    })

    const buildCurrentDraft = useCallback((
        clientRequestId = quoteRequestIdRef.current,
        recordKindOverride?: 'costing' | 'quotation',
    ) => ({
        state,
        partyName,
        qualityLabel,
        warpInstruction,
        weftInstruction,
        sourceQuoteId: sourceQuoteId ?? undefined,
        sourceQuoteUpdatedAt: sourceQuoteUpdatedAt ?? undefined,
        sourceRecordKind: recordKindOverride ?? sourceRecordKind ?? undefined,
        clientRequestId: clientRequestId ?? undefined,
    }), [
        partyName,
        qualityLabel,
        sourceQuoteId,
        sourceQuoteUpdatedAt,
        sourceRecordKind,
        state,
        warpInstruction,
        weftInstruction,
    ])

    const applyEstimatorDraft = useCallback(() => {
        const restored = restoreDraft()
        if (!restored) return
        lastGeneratedWarp.current = null
        lastGeneratedWeft.current = null

        dispatch({ type: 'RESTORE_DRAFT', draftState: restored.state })
        setPartyName(restored.partyName)
        setQualityLabel(restored.qualityLabel)
        setWarpInstruction(restored.warpInstruction)
        setWeftInstruction(restored.weftInstruction)
        setSourceQuoteId(restored.sourceQuoteId ?? null)
        setSourceQuoteUpdatedAt(restored.sourceQuoteUpdatedAt ?? null)
        setSourceRecordKind(restored.sourceRecordKind ?? null)
        quoteRequestIdRef.current = restored.clientRequestId ?? null
        toast.success(restored.sourceQuoteId
            ? restored.sourceRecordKind === 'costing' ? 'Costing specifications loaded' : 'Quotation specifications loaded'
            : 'Cost Estimate draft restored')
    }, [restoreDraft])

    useEffect(() => {
        if (!hasDraft || !draft || !shouldAutoRestoreEstimatorDraft(draft)) return
        if (autoRestoredDraftSavedAtRef.current === draft.savedAt) return

        // React StrictMode can replay mount effects. savedAt identifies this
        // handoff so an explicit Open & Update / Duplicate action is applied
        // once without affecting the manual recovery flow for ordinary drafts.
        autoRestoredDraftSavedAtRef.current = draft.savedAt
        applyEstimatorDraft()
    }, [applyEstimatorDraft, draft, hasDraft])

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
        saveDraft({
            state,
            partyName,
            qualityLabel,
            warpInstruction,
            weftInstruction,
            sourceQuoteId: sourceQuoteId ?? undefined,
            sourceQuoteUpdatedAt: sourceQuoteUpdatedAt ?? undefined,
        })
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, partyName, qualityLabel, warpInstruction, weftInstruction, sourceQuoteId, sourceQuoteUpdatedAt])

    // Sync partyName with qualityLabel in market mode for database/draft compatibility
    useEffect(() => {
        if (mode === 'market') {
            setPartyName(qualityLabel)
        }
    }, [qualityLabel, mode])

    // Auto-fill warpInstruction based on warp rows' labels
    useEffect(() => {
        const currentWarpLabels = state.warpRows
            .map(row => row.label?.trim())
            .filter(Boolean)
            .join(' + ')

        if (lastGeneratedWarp.current === null) {
            lastGeneratedWarp.current = currentWarpLabels
        }

        if (warpInstruction !== currentWarpLabels) {
            if (!warpInstruction || warpInstruction === lastGeneratedWarp.current) {
                setWarpInstruction(currentWarpLabels)
                lastGeneratedWarp.current = currentWarpLabels
            }
        }
    }, [state.warpRows, warpInstruction])

    // Auto-fill weftInstruction based on weft rows' labels and picks
    useEffect(() => {
        const weftLabels = state.weftRows
            .map(row => row.label?.trim())
            .filter(Boolean)
            .join(' + ')
        const totalPicks = state.weftRows.reduce((sum, row) => sum + (row.picks || 0), 0)

        let currentWeftGen = ''
        if (weftLabels && totalPicks > 0) {
            currentWeftGen = `${weftLabels} - ${totalPicks} Picks`
        } else if (weftLabels) {
            currentWeftGen = weftLabels
        } else if (totalPicks > 0) {
            currentWeftGen = `${totalPicks} Picks`
        }

        if (lastGeneratedWeft.current === null) {
            lastGeneratedWeft.current = currentWeftGen
        }

        if (weftInstruction !== currentWeftGen) {
            if (!weftInstruction || weftInstruction === lastGeneratedWeft.current) {
                setWeftInstruction(currentWeftGen)
                lastGeneratedWeft.current = currentWeftGen
            }
        }
    }, [state.weftRows, weftInstruction])

    // Party rate memory — debounced 800ms, 3-char minimum
    useEffect(() => {
        if (isStandaloneCostingSession) { setPartyHint(null); return }
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
    }, [isStandaloneCostingSession, partyName])

    const estimatorValidation = useMemo(() => validateEstimatorSnapshot(state), [state])
    const firstEstimatorValidationMessage = useMemo(
        () => getFirstEstimatorValidationMessage(estimatorValidation),
        [estimatorValidation],
    )
    const totals: EstimatorV3Totals = useMemo(() => {
        try {
            return calcFullTotals(state)
        } catch {
            // A restored or manually tampered payload can contain a non-finite
            // value. Keep the page recoverable while field validation explains
            // what must be fixed; never let Decimal terminate the render.
            return calcFullTotals(makeDefaultEstimateState())
        }
    }, [state])
    const hasValidCostResult = estimatorValidation.valid
        && Number.isFinite(totals.totalProductionCostPerM)
        && totals.totalProductionCostPerM >= 0
    const validationSummaryId = 'estimator-save-validation-summary'
    const exportModel = useMemo(() => hasValidCostResult
        ? createCostingExportModel({ qualityLabel, state, totals })
        : null,
    [hasValidCostResult, qualityLabel, state, totals])
    const scenarios = useMemo(() =>
        runScenarios(state, totals, customTargetPrice ? Number(customTargetPrice) : undefined),
    [state, totals, customTargetPrice])
    const breakEvenScenario = useMemo(
        () => scenarios.find(scenario => scenario.id === 'break-even'),
        [scenarios],
    )

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
        } catch {
            toast.error('Error fetching suggestion')
        } finally {
            setIsSuggestingOutput(false)
        }
    }

    const applyTemplate = useCallback((tpl: EstimatorTemplate) => {
        dispatch({ type: 'APPLY_TEMPLATE', template: tpl })
        setAppliedTemplate(tpl)
        setQualityLabel(tpl.name)
        setWarpInstruction('')
        setWeftInstruction('')
        lastGeneratedWarp.current = null
        lastGeneratedWeft.current = null
        toast.success(`${t('estimator.quality.applied')} ${tpl.name}`)
    }, [t])

    const openSaveTemplateDialog = useCallback(() => {
        setTemplateName(
            qualityLabel.trim()
            || appliedTemplate?.name
            || (mode === 'market' ? partyName.trim() : '')
        )
        setTemplateSaveError(null)
        setShowSaveTemplate(true)
    }, [appliedTemplate?.name, mode, partyName, qualityLabel])

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
        } catch {
            toast.error('Error saving profile')
        } finally {
            setSaving(false)
        }
    }

    const handleSaveTemplate = async () => {
        if (!templateName.trim()) {
            const message = t('estimator.quality.nameRequired')
            setTemplateSaveError(message)
            toast.error(message)
            return
        }
        const missingLayer = findMissingLayerLabel(state.warpRows, state.weftRows)
        if (missingLayer) {
            return toast.error(t('estimator.quality.layerNameRequired').replace('{layer}', missingLayer))
        }

        const warpRows = trimLayerLabels(state.warpRows)
        const weftRows = trimLayerLabels(state.weftRows)

        const savedName = templateName.trim().replace(/\s+/g, ' ')
        setTemplateSaveError(null)
        setSavingTemplate(true)
        try {
            const res = await saveAsFabricTemplate({
                name:             savedName,
                warpRows,
                weftRows,
                tapeLengthM:      state.tapeLengthM,
                warpCrimpPct:     state.warpCrimpPct,
                perPickCostPaisa: state.perPickCostPaisa,
                yarnShortagePct:  state.yarnShortagePct,
                overheadOverridePerM: state.overheadOverridePerM,
                loomType:         state.loomType,
                loomRpm:          state.loomRpm,
                loomPowerKw:      state.loomPowerKw,
                sizingMode:       state.sizingMode,
                hoursPerShift:    state.hoursPerShift,
            })
            if (res.success) {
                const tRes = await getEstimatorTemplates()
                if (tRes.data) {
                    setTemplates(tRes.data)
                    const savedTemplate = tRes.data.find(t => t.name === savedName)
                    if (savedTemplate) setAppliedTemplate(savedTemplate)
                }
                setQualityLabel(savedName)
                setShowSaveTemplate(false)
                setTemplateName('')
                setTemplateSaveError(null)
                clearDraft()
                toast.success(t('estimator.quality.saved'))
            } else {
                const message = res.error ?? t('estimator.quality.saveFailed')
                setTemplateSaveError(message)
                toast.error(message)
            }
        } catch {
            const message = t('estimator.quality.saveFailed')
            setTemplateSaveError(message)
            toast.error(message)
        } finally {
            setSavingTemplate(false)
        }
    }

    const handleUpdateTemplate = async () => {
        if (!appliedTemplate) return
        const missingLayer = findMissingLayerLabel(state.warpRows, state.weftRows)
        if (missingLayer) {
            return toast.error(t('estimator.quality.layerNameRequired').replace('{layer}', missingLayer))
        }

        const warpRows = trimLayerLabels(state.warpRows)
        const weftRows = trimLayerLabels(state.weftRows)

        setSavingTemplate(true)
        const updatedName = qualityLabel.trim() || appliedTemplate.name
        const res = await updateFabricTemplate({
            id:               appliedTemplate.id,
            expectedUpdatedAt: appliedTemplate.updated_at,
            name:             updatedName,
            warpRows,
            weftRows,
            tapeLengthM:      state.tapeLengthM,
            warpCrimpPct:     state.warpCrimpPct,
            perPickCostPaisa: state.perPickCostPaisa,
            yarnShortagePct:  state.yarnShortagePct,
            overheadOverridePerM: state.overheadOverridePerM,
            loomType:         state.loomType,
            loomRpm:          state.loomRpm,
            loomPowerKw:      state.loomPowerKw,
            sizingMode:       state.sizingMode,
            hoursPerShift:    state.hoursPerShift,
        })
        setSavingTemplate(false)
        
        if (res.success) {
            const tRes = await getEstimatorTemplates()
            const refreshed = tRes.data?.find(template => template.id === appliedTemplate.id)
            if (tRes.data) setTemplates(tRes.data)
            setAppliedTemplate(refreshed ?? {
                ...appliedTemplate,
                name: updatedName,
                updated_at: res.updatedAt ?? appliedTemplate.updated_at,
            })
            toast.success(t('estimator.toast.updated_applied'))
        } else {
            toast.error(res.error ?? t('estimator.quality.updateFailed'))
        }
    }

    const handleNewQualityConfirm = () => {
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
        setWarpInstruction('')
        setWeftInstruction('')
        lastGeneratedWarp.current = null
        lastGeneratedWeft.current = null
        setSourceQuoteId(null)
        setSourceQuoteUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        setCustomTargetPrice('')
        clearDraft()
        setShowConfirmNewQuality(false)
        toast.success(tx('Started blank quality recipe'))
    }

    /** Open the "update rates" sheet for a template. */
    const openEditRates = useCallback((tpl: EstimatorTemplate) => {
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
        let expectedUpdatedAt = editRatesTpl.updated_at

        // 1. Rename if changed
        if (editingTplName.trim() && editingTplName.trim() !== editRatesTpl.name) {
            const renameRes = await renameTemplate(editRatesTpl.id, editingTplName.trim(), expectedUpdatedAt)
            if (renameRes.error) {
                setSavingRates(false)
                toast.error(`${t('estimator.toast.rename_failed')} ${renameRes.error}`)
                return
            }
            expectedUpdatedAt = renameRes.updatedAt ?? expectedUpdatedAt
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
        
        const res = await updateTemplateRates({
            id: editRatesTpl.id,
            expectedUpdatedAt,
            warpRows: updatedWarp,
            weftRows: updatedWeft,
        })
        setSavingRates(false)
        if (res.error) { toast.error(res.error); return }

        // Success: refresh and apply
        const tRes = await getEstimatorTemplates()
        const refreshed = tRes.data?.find(template => template.id === editRatesTpl.id)
        if (tRes.data) setTemplates(tRes.data)
        
        dispatch({
            type: 'APPLY_TEMPLATE',
            template: refreshed ?? { ...editRatesTpl, name: editingTplName.trim(), warp_rows: updatedWarp, weft_rows: updatedWeft, updated_at: res.updatedAt ?? expectedUpdatedAt }
        })
        setAppliedTemplate(refreshed ?? { ...editRatesTpl, name: editingTplName.trim(), warp_rows: updatedWarp, weft_rows: updatedWeft, updated_at: res.updatedAt ?? expectedUpdatedAt })
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

    const handleDeleteTemplate = async (template: EstimatorTemplate) => {
        setDeletingTpl(template.id)
        const res = await deleteTemplate(template.id, template.updated_at)
        setDeletingTpl(null)
        if (res.error) { toast.error(res.error); return }
        setTemplates(prev => prev.filter(t => t.id !== template.id))
        if (appliedTemplate?.id === template.id) setAppliedTemplate(null)
        toast.success(t('estimator.quality.deleted'))
    }

    const handleSaveQuote = async (
        targetMode: 'quote' | 'market' = mode,
        status: 'draft' | 'accepted' = 'draft',
        staleRatesAcknowledged = false,
        recordKindOverride?: 'costing' | 'quotation',
    ) => {
        if (saveQuoteLockRef.current || savingQuote) return
        const saveAsStandaloneCosting = isStandaloneCostingSession || recordKindOverride === 'costing'
        const effectiveTargetMode = saveAsStandaloneCosting ? 'quote' : targetMode
        if (firstEstimatorValidationMessage) {
            return toast.error(firstEstimatorValidationMessage)
        }
        if (!saveAsStandaloneCosting && canUseProduction && effectiveTargetMode === 'quote' && !allowsPartyOrders) {
            return toast.error('Party quotations are unavailable in Market Run only mode')
        }
        if (effectiveTargetMode === 'market' && !allowsMarketRuns) {
            return toast.error('Market Runs are unavailable in Order-Based only mode')
        }

        const resolvedPartyName = saveAsStandaloneCosting
            ? qualityLabel.trim()
            : effectiveTargetMode === 'market'
            ? (qualityLabel.trim() || partyName.trim()) 
            : partyName.trim()

        if (!resolvedPartyName) {
            return toast.error(saveAsStandaloneCosting ? 'Quality name is required' : effectiveTargetMode === 'market' ? 'Fabric Label is required' : t('estimator.toast.party_required'))
        }
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (!state.orderQuantityM || state.orderQuantityM <= 0) {
            return toast.error('Set a quantity before saving')
        }
        if (staleDefaultRateNames.length > 0 && !staleRatesAcknowledged) {
            setPendingStaleRateSave({ targetMode, status, recordKindOverride })
            return
        }

        const browserIsOnline = typeof navigator === 'undefined' || navigator.onLine
        if (!browserIsOnline) {
            const draftSaved = saveDraftNow(buildCurrentDraft(undefined, saveAsStandaloneCosting ? 'costing' : 'quotation'))
            toast.error('Reconnect before saving', {
                description: draftSaved
                    ? 'Your Cost Estimate and save identity are stored on this device.'
                    : 'Browser storage is unavailable, so keep this page open until you reconnect.',
                duration: Infinity,
            })
            return
        }

        const clientRequestId = effectiveTargetMode === 'quote'
            ? quoteRequestIdRef.current ?? createClientRequestUuid()
            : null
        if (clientRequestId) quoteRequestIdRef.current = clientRequestId

        // Flush both the current inputs and request identity before the action.
        // If the response is lost after commit, reopening and retrying reuses the
        // same idempotency key instead of creating a duplicate.
        const draftSavedBeforeSubmit = saveDraftNow(buildCurrentDraft(clientRequestId, saveAsStandaloneCosting ? 'costing' : 'quotation'))

        saveQuoteLockRef.current = true
        setSavingQuote(true)

        try {
            if (effectiveTargetMode === 'market') {
                const res = await createMarketRunFromEstimator({
                    fabricLabel:             resolvedPartyName,
                    qualityLabel:            qualityLabel.trim(),
                    warpInstruction:         warpInstruction.trim() || undefined,
                    weftInstruction:         weftInstruction.trim() || undefined,
                    targetMeters:            state.orderQuantityM,
                    estimate:                state,
                    totalProductionCostPerM: totals.totalProductionCostPerM,
                    notes:                   '',
                    deadline:                new Date(new Date().getTime() + 30 * 86400000).toISOString().split('T')[0] // 30 days default
                })
                if (res.error) {
                    toast.error(res.error)
                } else {
                    clearDraft()
                    setSourceQuoteId(null)
                    setSourceQuoteUpdatedAt(null)
                    setSourceRecordKind(null)
                    quoteRequestIdRef.current = null
                    toast.success('Market Run created successfully')
                    router.push(`/owner/market-runs/${res.marketRunId}`)
                }
            } else {
                const res = await saveEstimatorQuoteV3({
                    clientRequestId:          clientRequestId!,
                    partyName:               resolvedPartyName,
                    qualityLabel:            qualityLabel.trim(),
                    warpInstruction:         warpInstruction.trim() || undefined,
                    weftInstruction:         weftInstruction.trim() || undefined,
                    estimate:                state,
                    quotePricePerM:          totals.orderQuote?.quotePricePerM ?? totals.totalProductionCostPerM,
                    totalProductionCostPerM: totals.totalProductionCostPerM,
                    status:                  status,
                    recordKind:              saveAsStandaloneCosting ? 'costing' : 'quotation',
                    sourceQuoteId:           sourceQuoteId ?? undefined,
                    expectedSourceUpdatedAt: sourceQuoteUpdatedAt ?? undefined,
                })
                if (res.success) {
                    clearDraft()
                    setSourceQuoteId(null)
                    setSourceQuoteUpdatedAt(null)
                    setSourceRecordKind(null)
                    quoteRequestIdRef.current = null
                    toast.success(!saveAsStandaloneCosting
                        ? (status === 'accepted' ? 'Quotation saved and accepted!' : t('estimator.toast.converted_success'))
                        : (sourceQuoteId ? 'New costing version saved' : 'Costing saved'))
                    router.push('/owner/quotes')
                } else {
                    toast.error(res.error ?? 'Failed to save quote')
                }
            }
        } catch (error) {
            console.error('Failed to save estimator quote:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to save quote', {
                description: draftSavedBeforeSubmit
                    ? 'Your Cost Estimate and retry identity remain saved on this device.'
                    : undefined,
            })
        } finally {
            setSavingQuote(false)
            saveQuoteLockRef.current = false
        }
    }

    const handleStartPartyOrder = async () => {
        if (saveQuoteLockRef.current || savingQuote) return
        if (!partyName.trim()) return toast.error(t('estimator.toast.party_required'))
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (!state.orderQuantityM || state.orderQuantityM <= 0) {
            return toast.error('Set a quantity before starting the order')
        }

        const quotePricePerM = totals.orderQuote?.quotePricePerM
        if (!quotePricePerM || quotePricePerM <= 0 || totals.totalProductionCostPerM <= 0) {
            return toast.error('Complete the estimate before starting the order')
        }

        saveQuoteLockRef.current = true
        setSavingQuote(true)

        try {
            const result = await startPartyOrderFromEstimator({
                estimatorState: state,
                partyName: partyName.trim(),
                qualityLabel: qualityLabel.trim(),
                warpInstruction: warpInstruction.trim() || undefined,
                weftInstruction: weftInstruction.trim() || undefined,
                targetMeters: state.orderQuantityM,
                deadline: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
                quotePricePerM,
                costPerM: totals.totalProductionCostPerM,
            })

            if ('error' in result) {
                toast.error(result.error ?? 'Failed to start party order')
                return
            }

            clearDraft()
            setSourceQuoteId(null)
            setSourceQuoteUpdatedAt(null)
            setSourceRecordKind(null)
            quoteRequestIdRef.current = null
            toast.success('Party order started')
            router.push(`/owner/orders?orderId=${result.orderId}`)
        } catch (error) {
            console.error('Failed to start party order:', error)
            toast.error(error instanceof Error ? error.message : 'Failed to start party order')
        } finally {
            setSavingQuote(false)
            saveQuoteLockRef.current = false
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
    const pageShellClass = "w-full px-4 sm:px-6 lg:px-0"
    const hudShellClass = "w-full rounded-[18px] border border-[var(--color-hairline)] bg-white/95 px-4 py-4 shadow-[0_14px_40px_rgba(30,37,40,0.10)] backdrop-blur sm:px-5"
    const postProcessingCostPerM = totals.windingPerM + totals.processingPerM + totals.finishingPerM
    const displayMarginPct = Number.isFinite(orderQuote?.actualMarginPct)
        ? orderQuote?.actualMarginPct ?? state.profitPct
        : state.profitPct
    const costSegments = [
        { label: 'Warp Yarn', value: totals.warpCostPerM, color: 'bg-[var(--color-yarn-orange)]', text: 'text-[var(--color-yarn-orange)]' },
        { label: 'Weft Yarn', value: totals.weftCostPerM, color: 'bg-[#D2A149]', text: 'text-[#9B6B19]' },
        { label: 'Weave', value: totals.weaveCostPerM, color: 'bg-[var(--color-info-blue)]', text: 'text-[var(--color-info-blue)]' },
        { label: 'Warping', value: totals.warpingAndSizingPerM, color: 'bg-[var(--color-factory-green)]', text: 'text-[var(--color-factory-green)]' },
        { label: 'Overhead', value: totals.overheadPerM, color: 'bg-[var(--color-risk-red)]', text: 'text-[var(--color-risk-red)]' },
        { label: 'Post', value: postProcessingCostPerM, color: 'bg-[var(--color-warning-amber)]', text: 'text-[var(--color-warning-amber)]' },
    ].filter(segment => segment.value > 0)
    const costStackTotal = costSegments.reduce((sum, segment) => sum + segment.value, 0)
    const auditLayerRows = [
        ...totals.audit.warp.layers.map(layer => ({ ...layer, section: 'Warp' })),
        ...totals.audit.weft.layers.map(layer => ({ ...layer, section: 'Weft' })),
    ]
    const auditCostLines = [
        { label: 'Warp yarn', value: totals.audit.warp.totalCostPerMeter },
        { label: 'Weft yarn', value: totals.audit.weft.totalCostPerMeter },
        { label: 'Weave / loom', value: totals.audit.weaveCostPerMeter },
        { label: 'Warping + sizing', value: totals.audit.warpingAndSizingCostPerMeter },
        { label: 'Post-processing', value: totals.audit.postProcessingCostPerMeter },
        { label: 'Factory overhead / other', value: totals.audit.overheadCostPerMeter },
    ].filter(line => line.value > 0)
    return (
        <div className="estimator-mobile-form space-y-5 pb-floating-button md:pb-20 relative">
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
                            overhead_override_per_m: data.overheadOverridePerM !== undefined ? data.overheadOverridePerM : state.overheadOverridePerM,
                            loom_count:              data.loomCount ?? state.loomCount,
                            monthly_working_days:    data.monthlyWorkingDays ?? state.monthlyWorkingDays,
                            avg_output_per_loom_per_day: data.avgOutputPerLoomPerDay ?? state.avgOutputPerLoomPerDay,
                            is_configured:           true,
                        })
                        if (res.success) {
                            // Update local state and close wizard
                            Object.entries(data).forEach(([key, val]) => {
                                dispatch({ type: 'SET', field: key as keyof EstimateStatePatch, value: val as EstimateStateValue })
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
                <div className={pageShellClass}>
                    <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                        <RotateCcw className="h-4 w-4 text-amber-600 shrink-0" />
                        <p className="text-sm text-amber-800 flex-1">
                            {draft.sourceQuoteId ? (
                                <>
                                    {draft.sourceRecordKind === 'costing' ? 'Updating saved Cost Estimate ' : canUseProduction ? 'Recalculating Cost Estimate from Quotation for ' : 'Updating saved Cost Estimate '}
                                    <span className="font-bold">{draft.sourceRecordKind === 'costing' || !canUseProduction ? (draft.qualityLabel || 'Untitled') : (draft.partyName || 'Unknown Party')}</span>
                                    {draft.qualityLabel && <span className="text-amber-600"> ({draft.qualityLabel})</span>}
                                    {canUseProduction && draft.sourceRecordKind !== 'costing' && ' — editable Quotations update in place; accepted Quotations create a linked version'}
                                    {draft.sourceRecordKind === 'costing' && ' — saving creates a new costing version without changing the original'}
                                </>
                            ) : (
                                <>
                                    <span className="font-bold">Unsaved draft</span> from{' '}
                                    {new Date(draft.savedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    {canUseProduction && draft.partyName && <span className="text-amber-600"> · {draft.partyName}</span>}
                                </>
                            )}
                        </p>
                        <button
                            onClick={applyEstimatorDraft}
                            className="text-xs font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 shrink-0"
                        >
                            {draft.sourceQuoteId ? 'Load Specs' : 'Restore'}
                        </button>
                        <button
                            onClick={dismissDraft}
                            className="ml-1 text-amber-500 hover:text-amber-700"
                        ><X className="h-4 w-4" /></button>
                    </div>
                </div>
            )}

            {/* ── STICKY QUOTE COCKPIT ─────────────────────────────── */}
            <div className="sticky top-3 z-40 -mt-3 py-3">
                <div className={hudShellClass}>
                    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
                        <div className="min-w-0 space-y-3">
                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:items-end 2xl:gap-1.5">
                                <div className="min-w-0">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">{t('estimator.hud.prod_cost')}</p>
                                    <p className="font-mono text-[28px] font-semibold leading-none text-[var(--color-ink)] sm:text-[32px] 2xl:text-[22px]">
                                        {hasValidCostResult ? `₹${totals.totalProductionCostPerM.toFixed(2)}` : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">per metre</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                                        {mode === 'market' ? 'Target selling price' : canUseProduction ? t('estimator.hud.quote_per_m') : 'Suggested selling price'}
                                    </p>
                                    <p className="font-mono text-[28px] font-semibold leading-none text-[var(--color-yarn-orange)] sm:text-[32px] 2xl:text-[22px]">
                                        {hasValidCostResult && orderQuote?.isValid ? `₹${orderQuote.quotePricePerM.toFixed(2)}` : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">per metre</p>
                                </div>
                                <div className="min-w-0 rounded-[12px] border border-[#CDE5D3] bg-[var(--color-factory-green-soft)] px-3 py-2 2xl:px-2 2xl:py-1.5">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-factory-green)]">{t('estimator.hud.margin')}</p>
                                    <p className="font-mono text-[28px] font-semibold leading-none text-[var(--color-factory-green)] 2xl:text-[20px]">
                                        {displayMarginPct >= 0 ? '+' : ''}{displayMarginPct.toFixed(1)}%
                                    </p>
                                </div>
                                <div className="min-w-0 border-l-0 border-[var(--color-hairline)] xl:border-l xl:pl-4 2xl:pl-2">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Break-even price</p>
                                    <p className="font-mono text-[24px] font-semibold leading-none text-[var(--color-ink)] 2xl:text-[20px]">
                                        {hasValidCostResult && breakEvenScenario?.quotePricePerM != null
                                            ? `₹${breakEvenScenario.quotePricePerM.toFixed(2)}`
                                            : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">minimum at 0% margin</p>
                                </div>
                                <div className="min-w-0 border-l-0 border-[var(--color-hairline)] xl:border-l xl:pl-4 2xl:pl-2">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Expected profit</p>
                                    <p className="font-mono text-[24px] font-semibold leading-none text-[var(--color-factory-green)] 2xl:text-[20px]">
                                        {hasValidCostResult && hasOrderQty && orderQuote?.isValid
                                            ? `₹${orderQuote.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                                            : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">
                                        {hasOrderQty ? `for ${Number(state.orderQuantityM).toLocaleString('en-IN')} m` : 'set costing quantity'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-soft)]">
                                    {costSegments.length > 0 ? costSegments.map(segment => (
                                        <div
                                            key={segment.label}
                                            className={`${segment.color} min-w-[3px] border-r border-white last:border-r-0`}
                                            style={{ width: `${Math.max(3, (segment.value / costStackTotal) * 100)}%` }}
                                        />
                                    )) : (
                                        <div className="w-full bg-[var(--color-hairline)]" />
                                    )}
                                </div>
                                <div className="flex gap-x-4 gap-y-1 overflow-x-auto pb-1 text-[11px] font-semibold no-scrollbar">
                                    {(costSegments.length > 0 ? costSegments : [{ label: 'Warp Yarn', value: 0, color: 'bg-[var(--color-yarn-orange)]', text: 'text-[var(--color-yarn-orange)]' }]).map(segment => (
                                        <span key={segment.label} className={`inline-flex shrink-0 items-center gap-1.5 ${segment.text}`}>
                                            <span className={`h-2 w-2 rounded-full ${segment.color}`} />
                                            {segment.label}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end 2xl:w-[520px]">

                            {mode === 'quote' || isStandaloneCostingSession ? (
                                <>
                                    {/* PRIMARY: atomically create the accepted quote and live order */}
                                    {canUseProduction && !isStandaloneCostingSession && <Button
                                        id="btn-start-party-order"
                                        size="sm"
                                        className="col-span-2 h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] sm:col-span-1"
                                        onClick={handleStartPartyOrder}
                                        disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid}
                                        title={(!hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid)
                                            ? 'Complete party, quality, quantity, and cost result first.'
                                            : undefined
                                        }
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Play className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">Start Party Order</span>
                                    </Button>}

                                    {/* SECONDARY: retain an accepted quote without starting production */}
                                    <Button
                                        id="btn-save-accept"
                                        size="sm"
                                        variant="outline"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => handleSaveQuote('quote', isStandaloneCostingSession ? 'draft' : 'accepted')}
                                        disabled={savingQuote || !estimatorValidation.valid || !hasOrderQty || (!isStandaloneCostingSession && !partyName.trim()) || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid}
                                        aria-describedby={!estimatorValidation.valid ? validationSummaryId : undefined}
                                        title={firstEstimatorValidationMessage ?? ((!hasOrderQty || (!isStandaloneCostingSession && !partyName.trim()) || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid)
                                            ? (!isStandaloneCostingSession ? 'Complete party, quality, quantity, and cost result first.' : 'Complete quality, costing quantity, and cost result first.')
                                            : undefined)}
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">{!isStandaloneCostingSession ? 'Save & Accept' : (sourceQuoteId ? 'Save New Version' : 'Save Costing')}</span>
                                    </Button>

                                    {isStandaloneCostingSession && (
                                        <Button
                                            id="btn-export-cost-sheet"
                                            size="sm"
                                            variant="outline"
                                            className="h-12 rounded-[10px] border border-[var(--color-yarn-orange)] bg-white px-5 text-[14px] font-semibold text-[var(--color-yarn-orange-dark)] hover:bg-[var(--color-warning-amber-soft)]"
                                            onClick={() => setShowExportDialog(true)}
                                            disabled={!exportModel}
                                            title={exportModel ? 'Create an internal cost sheet or customer quotation' : 'Correct the highlighted inputs before exporting'}
                                        >
                                            <FileDown className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">Export Cost Sheet</span>
                                        </Button>
                                    )}

                                    {/* TERTIARY: Save Quote */}
                                    {canUseProduction && !isStandaloneCostingSession && <Button
                                        id="btn-save-quote"
                                        size="sm"
                                        variant="outline"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => handleSaveQuote('quote', 'draft')}
                                        disabled={savingQuote || !orderQuote?.isValid}
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Save className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">Save Quotation</span>
                                    </Button>}

                                    {canUseProduction && !isStandaloneCostingSession && (
                                        <Button
                                            id="btn-save-costing"
                                            size="sm"
                                            variant="outline"
                                            className="h-12 rounded-[10px] border border-[var(--color-yarn-orange)] bg-white px-5 text-[14px] font-semibold text-[var(--color-yarn-orange-dark)] hover:bg-[var(--color-warning-amber-soft)]"
                                            onClick={() => handleSaveQuote('quote', 'draft', false, 'costing')}
                                            disabled={savingQuote || !estimatorValidation.valid || !hasOrderQty || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid}
                                            aria-describedby={!estimatorValidation.valid ? validationSummaryId : undefined}
                                            title={firstEstimatorValidationMessage ?? 'Save an internal costing without creating a customer quotation'}
                                        >
                                            <Save className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">Save Costing</span>
                                        </Button>
                                    )}

                                    {/* TERTIARY: Switch to Market mode */}
                                    {canUseProduction && !isStandaloneCostingSession && allowsMarketRuns && (
                                        <Button
                                            id="btn-switch-market"
                                            size="sm"
                                            variant="ghost"
                                            className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                            onClick={() => setMode('market')}
                                        >
                                            <Gauge className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">Market Run</span>
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* PRIMARY: Start Market Run */}
                                    <Button
                                        id="btn-start-market-run"
                                        size="sm"
                                        className="col-span-2 h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] sm:col-span-1"
                                        onClick={() => handleSaveQuote('market')}
                                        disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid}
                                        title={(!hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid)
                                            ? 'Complete Fabric Quality, quantity, and Cost Estimate first.'
                                            : undefined
                                        }
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Gauge className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">Start Market Run</span>
                                    </Button>

                                    {/* SECONDARY: Save Quote (draft) */}
                                    {allowsPartyOrders && <Button
                                        id="btn-save-quote-market"
                                        size="sm"
                                        variant="outline"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => handleSaveQuote('quote')}
                                        disabled={savingQuote || !orderQuote?.isValid}
                                    >
                                        <Save className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">Save Quotation</span>
                                    </Button>}

                                    <Button
                                        id="btn-save-costing-market"
                                        size="sm"
                                        variant="outline"
                                        className="h-12 rounded-[10px] border border-[var(--color-yarn-orange)] bg-white px-5 text-[14px] font-semibold text-[var(--color-yarn-orange-dark)] hover:bg-[var(--color-warning-amber-soft)]"
                                        onClick={() => handleSaveQuote('quote', 'draft', false, 'costing')}
                                        disabled={savingQuote || !estimatorValidation.valid || !hasOrderQty || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !orderQuote?.isValid}
                                        aria-describedby={!estimatorValidation.valid ? validationSummaryId : undefined}
                                        title={firstEstimatorValidationMessage ?? 'Save this analysis without starting production'}
                                    >
                                        <Save className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">Save Costing</span>
                                    </Button>

                                    {/* TERTIARY: Transition to Party Order mode */}
                                    {allowsPartyOrders && <Button
                                        id="btn-start-party-order-market"
                                        size="sm"
                                        variant="ghost"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => setMode('quote')}
                                        disabled={savingQuote}
                                    >
                                        <Play className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">Party Order</span>
                                    </Button>}
                                </>
                            )}

                            {/* Save / Update Quality template button */}
                            {appliedTemplate ? (
                                <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1 sm:col-span-1 sm:flex-nowrap">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-12 min-w-0 max-w-full flex-1 rounded-[10px] border border-[var(--color-hairline)] bg-white px-4 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)] sm:flex-none"
                                        onClick={handleUpdateTemplate}
                                        disabled={savingTemplate}
                                    >
                                        {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
                                        <span className="truncate">Update {appliedTemplate.name}</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setTemplateName(`${appliedTemplate.name} Copy`)
                                            setTemplateSaveError(null)
                                            setShowSaveTemplate(true)
                                        }}
                                        className="h-12 px-3 text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                                        title="Create an intentional copy with a new name"
                                        aria-label={`Duplicate ${appliedTemplate.name}`}
                                    >
                                        <BookmarkPlus className="mr-1.5 h-4 w-4" />
                                        Duplicate
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setAppliedTemplate(null)}
                                        className="h-12 px-2 text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                                        title={t('estimator.quality.detachTooltip')}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ) : (
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-12 flex-none rounded-[10px] px-4 text-[14px] font-semibold text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                                    onClick={() => {
                                        setTemplateName(qualityLabel.trim())
                                        setTemplateSaveError(null)
                                        setShowSaveTemplate(true)
                                    }}
                                    aria-label="Save as New Quality"
                                >
                                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                                    <span className="truncate sm:hidden">New Quality</span>
                                    <span className="hidden truncate sm:inline">Save as New Quality</span>
                                </Button>
                            )}
                        </div>
                    </div>

                    {hasOrderQty && orderQuote && (
                        <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-hairline)] pt-3">
                            <div className="shrink-0">
                                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('estimator.hud.margin')}</p>
                            </div>
                            <input
                                type="range"
                                min={0} max={100} step={0.5}
                                value={state.profitPct}
                                onChange={e => dispatch({ type: 'SET', field: 'profitPct', value: Number(e.target.value) })}
                                className="h-5 flex-1 modern-slider"
                            />
                            <p className="shrink-0 text-sm font-semibold text-[var(--color-yarn-orange)]">{state.profitPct.toFixed(1)}%</p>
                            <div className="h-6 w-px bg-[var(--color-hairline)]" />
                            <div className="shrink-0 text-right">
                                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('estimator.hud.net_profit')}</p>
                                <p className="text-sm font-semibold leading-none text-[var(--color-factory-green)]">
                                    ₹{orderQuote.grossProfitRupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── MAIN FORM ────────────────────────────────────────────── */}
            <div className={`${pageShellClass} space-y-7`}>
                {/* Saved Qualities Row */}
                {templates.length > 0 && (
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap items-center gap-2">
                            <History className="h-3.5 w-3.5 text-[var(--color-muted)]" />
                            <p className="text-[11px] font-medium uppercase tracking-widest text-[var(--color-muted)]">{t('estimator.quality.myQualities')}</p>
                            <span className="ml-auto hidden text-[11px] text-[var(--color-muted)] xs:inline">{t('estimator.quality.hint')}</span>
                        </div>
                        <p className="text-xs text-[var(--color-muted)] leading-normal">{t('estimator.quality.myQualitiesHelper')}</p>
                        {/* Search — only shown when there are more than 5 qualities */}
                        {templates.length > 5 && (
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={templateSearch}
                                    onChange={e => setTemplateSearch(e.target.value)}
                                    placeholder={t('estimator.quality.searchPlaceholder').replace('{count}', String(templates.length))}
                                    className="w-full rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] py-1.5 pl-8 pr-8 text-xs focus:border-[var(--color-yarn-orange)] focus:outline-none focus:ring-2 focus:ring-[var(--color-yarn-orange)]/20"
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
                                        {t('estimator.quality.searchResults')
                                            .replace('{shown}', String(filteredTemplates.length))
                                            .replace('{total}', String(templates.length))}
                                    </p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 snap-x">
                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowConfirmNewQuality(true)
                                }}
                                className="h-8 shrink-0 snap-start rounded-full border border-dashed border-[var(--color-hairline)] bg-transparent px-3.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                             >
                                <Plus className="h-3.5 w-3.5" />
                                {t('estimator.quality.newQuality')}
                             </Button>

                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    openSaveTemplateDialog()
                                }}
                                className="h-8 shrink-0 snap-start rounded-full border border-[var(--color-hairline)] bg-transparent px-3.5 text-xs font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                             >
                                <Save className="h-3.5 w-3.5" />
                                {t('estimator.quality.saveCurrentAsQuality')}
                             </Button>
                            {filteredTemplates.map(tpl => {
                                const isActive = appliedTemplate?.id === tpl.id || (!tpl.id && qualityLabel === tpl.name);
                                return (
                                    <div key={tpl.id} className="relative shrink-0 snap-start group flex items-center">
                                        <button
                                            onClick={() => applyTemplate(tpl)}
                                            onContextMenu={e => { e.preventDefault(); openEditRates(tpl) }}
                                            className={`min-w-28 rounded-full border px-4 py-2 text-xs font-medium transition-all ${
                                                isActive
                                                    ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)] text-[var(--color-yarn-orange-dark)]'
                                                    : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)] text-[var(--color-muted)] hover:border-[var(--color-yarn-orange)]'
                                            } pr-16`}
                                        >
                                            {tpl.name}
                                        </button>
                                        <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-95 hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={e => { e.stopPropagation(); openEditRates(tpl) }}
                                                className={`p-1 h-6 w-6 flex items-center justify-center rounded-lg transition-all ${
                                                    isActive
                                                        ? 'bg-white/20 text-white hover:bg-white/30 border border-white/10'
                                                        : 'bg-slate-50 text-slate-500 hover:text-brand-accent hover:bg-brand-accent/10 border border-slate-200/60 shadow-sm'
                                                }`}
                                                title={t('estimator.quality.editRatesTitle')}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            </button>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    if (window.confirm(t('estimator.quality.deleteConfirm').replace('{name}', tpl.name))) {
                                                        handleDeleteTemplate(tpl)
                                                    }
                                                }}
                                                disabled={deletingTpl === tpl.id}
                                                className={`p-1 h-6 w-6 flex items-center justify-center rounded-lg transition-all ${
                                                    isActive
                                                        ? 'bg-white text-rose-600 hover:bg-rose-50 border border-slate-100 shadow-sm'
                                                        : 'bg-slate-50 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200/60 shadow-sm'
                                                }`}
                                                title={t('estimator.quality.deleteButton')}
                                            >
                                                {deletingTpl === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredTemplates.length === 0 && templateSearch && (
                                <p className="text-xs text-slate-400 italic py-2">{t('estimator.quality.noMatch').replace('{query}', templateSearch)}</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 1. Costing Basics */}
                <EstimatorCard accent="neutral">
                    <SectionHeader title={t('estimator.order_basics.title')} icon={Layers} accent="neutral" step={1} />
                    <CardContent className="p-4 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Party / Customer (only visible in quote mode) */}
                            {canUseProduction && !isStandaloneCostingSession && mode !== 'market' && (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-500">
                                        {t('estimator.order_basics.party')}
                                    </Label>
                                    <Input
                                        value={partyName}
                                        onChange={e => setPartyName(e.target.value)}
                                        placeholder="e.g. Sundaram Textiles"
                                        className="font-bold border-slate-200 h-11"
                                    />
                                    {partyHint && (
                                        <p className="text-[10px] text-slate-500 flex items-center gap-1">
                                            <span className="text-blue-500">💡</span>
                                            Last Quotation:{' '}
                                            <span className="font-bold text-slate-700">₹{partyHint.quote_price_per_meter.toFixed(2)}/m</span>
                                            {' '}for <span className="font-medium">{partyHint.quality_label}</span>
                                            {' '}· {new Date(partyHint.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Fabric / Quality Name (visible in both modes) */}
                            <div className={isStandaloneCostingSession || mode === 'market' ? "col-span-1 md:col-span-2 space-y-1.5" : "space-y-1.5"}>
                                <Label className="text-[10px] uppercase font-bold text-slate-500">
                                    {t('estimator.order_basics.fabric_quality_name')}
                                </Label>
                                <Input
                                    value={qualityLabel}
                                    onChange={e => {
                                        const val = e.target.value
                                        setQualityLabel(val)
                                        if (isStandaloneCostingSession || mode === 'market') {
                                            setPartyName(val)
                                        }
                                    }}
                                    placeholder="e.g. 60g Georgette, D.246, Japan Satin"
                                    className="font-bold border-slate-200 h-11"
                                />
                                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                                    {t('estimator.quality.fabricQualityNameHelper')}
                                </p>
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
                </EstimatorCard>

                {/* 2. Warp Yarn Rows */}
                <EstimatorCard accent="warp">
                    <SectionHeader 
                        title={t('estimator.warp.title')} 
                        icon={Sparkles} 
                        accent="warp"
                        step={2}
                        detail={<p className="text-[11px] text-[var(--color-muted)]">Default rows: {state.warpCrimpPct || 0}% crimp + {state.yarnShortagePct || 0}% waste → <span className="font-semibold text-[var(--color-warning-amber)]">{(state.warpCrimpPct || 0) + (state.yarnShortagePct || 0)}% total</span></p>}
                        badgeContent={<SectionCostPill value={totals.warpCostPerM} />}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        {/* Global Defaults Block */}
                        <div className="mb-6 grid overflow-hidden rounded-[13px] border border-[#D7E7F1] bg-[#F7FBFD] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.9fr)]">
                            <div className="border-b border-[#D7E7F1] p-4 sm:border-b-0 sm:border-r">
                                <StepperField
                                    label="Warp Crimp (Take-up)"
                                    value={state.warpCrimpPct || 0}
                                    onChange={v => dispatch({ type: 'SET', field: 'warpCrimpPct', value: v })}
                                    hint="Beam shrink relative to tape length"
                                    accent="warp"
                                />
                            </div>
                            <div className="border-b border-[#D7E7F1] p-4 sm:border-b-0 sm:border-r">
                                <StepperField
                                    label="Default Yarn Waste"
                                    value={state.yarnShortagePct || 0}
                                    onChange={v => dispatch({ type: 'SET', field: 'yarnShortagePct', value: v })}
                                    hint="Blank row waste uses this default. Row value 0 means no waste."
                                    accent="warp"
                                />
                            </div>
                            <div className="flex items-center justify-between gap-4 p-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Calculator className="h-3.5 w-3.5 text-[var(--color-info-blue)]" />
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-info-blue)]">Effective Total Shortage</span>
                                    </div>
                                    <p className="mt-2 font-mono text-sm font-semibold text-[var(--color-info-blue)]">
                                        {state.warpCrimpPct || 0}% <span className="px-2 text-[var(--color-muted)]">+</span> {state.yarnShortagePct || 0}% <span className="px-2 text-[var(--color-muted)]">=</span>
                                        <span className="ml-1 rounded-[7px] border border-[#C6D9EA] bg-white px-2.5 py-1 text-base">
                                            {(state.warpCrimpPct || 0) + (state.yarnShortagePct || 0)}%
                                        </span>
                                    </p>
                                </div>
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
                                    adjustmentPct={totals.warpRows[i]?.totalAdjustmentPct ?? 0}
                                >
                                    <CalculationModeField
                                        value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                        onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calculationMode', value })}
                                    />
                                    <LayerNameField
                                        label={t('estimator.field_labels.layer_name')}
                                        value={row.label ?? ''}
                                        placeholder={`${t('estimator.warp.layer')} ${i + 1}`}
                                        onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'label', value })}
                                    />
                                    {row.calculationMode === 'manual' ? (
                                        <NumField label="Warp Yarn consumption (kg/100m)" value={row.manualKgPer100m ?? null} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'manualKgPer100m', value: v })} unit="kg" step={0.001} hint="Kilograms of Warp Yarn needed for 100 metres; not m/kg yield." attentionWhenEmpty />
                                    ) : (
                                        <>
                                            <YarnDensityFields
                                                row={row}
                                                onChange={(field, value) => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value })}
                                            />
                                            <NumField label={t('estimator.field_labels.beam_ends')} value={row.beamEnds} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: v ?? 0 })} />
                                        </>
                                    )}
                                    <NumField label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} hint={`Blank uses ${state.yarnShortagePct}% default; 0 overrides`} warning={row.shortagePct !== null && row.shortagePct > 15 ? 'High waste %' : undefined} />
                                    {(() => {
                                        const templateRate = appliedTemplate?.warp_rows?.[i]?.yarnRate ?? null
                                        const isUnusuallyLow = templateRate !== null
                                            ? row.yarnRate < templateRate * 0.6
                                            : row.yarnRate > 0 && row.yarnRate < 50
                                        const warningId = `warp-${row.id}-rate`
                                        const isDismissed = dismissedWarnings.includes(warningId)
                                        return (
                                            <NumField 
                                                label={`${t('estimator.field_labels.rate_kg')} — REQUIRED`} 
                                                value={row.yarnRate} 
                                                onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })} 
                                                step={1} 
                                                attentionWhenEmpty
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
                            className="h-14 w-full rounded-[12px] border-dashed border-[#C6D9EA] bg-[#F7FBFD] text-[var(--color-info-blue)] hover:border-[var(--color-info-blue)] hover:bg-[#EEF5FB] transition-all gap-2"
                            onClick={() => dispatch({ type: 'ADD_WARP_ROW' })}
                        >
                            <Plus className="h-4 w-4" /> {t('estimator.warp.add_blend')}
                        </Button>
                        {/* Tape Length + Beam Capacity + Beams Needed */}
                        {(() => {
                            const beamM = totals.estimatedBeamCapacityM
                            const orderQty = state.orderQuantityM
                            const beamsNeeded = (beamM > 0 && orderQty && orderQty > 0)
                                ? Math.ceil(orderQty / beamM)
                                : null
                            return (
                                <div className="space-y-4 border-t border-[var(--color-hairline)] pt-5">
                                    {/* Row 1: Tape Length input + Cloth/Beam display */}
                                    <div className="grid gap-4 md:grid-cols-[180px_minmax(0,1fr)] md:items-end">
                                        <div>
                                            <NumField
                                                label={t('estimator.warp.tape_len')}
                                                value={state.tapeLengthM}
                                                onChange={v => dispatch({ type: 'SET', field: 'tapeLengthM', value: v ?? 0 })}
                                                unit="m"
                                            />
                                        </div>
                                        <div className="rounded-[12px] border border-[#D7E7F1] bg-[#F7FBFD] px-4 py-3 text-right">
                                            <p className="text-[10px] uppercase font-semibold text-[var(--color-muted)] tracking-[0.06em]">{t('estimator.warp.beam_capacity')}</p>
                                            <p className="mt-1 font-mono text-xl font-semibold leading-none text-[var(--color-info-blue)]">
                                                {beamM > 0 ? `≈ ${beamM.toFixed(0)} m` : '— m'}
                                            </p>
                                            <p className="mt-1 text-[10px] text-[var(--color-muted)]">cloth per beam</p>
                                        </div>
                                    </div>
                                    {/* Row 2: Beams Needed pill (only when tape length is set) */}
                                    {beamM > 0 && (
                                        <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[#D7E7F1] bg-[#F7FBFD] px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <Layers className="h-4 w-4 text-[var(--color-info-blue)] shrink-0" />
                                                <div>
                                                    <p className="text-[10px] uppercase font-semibold text-[var(--color-info-blue)] tracking-wider">Beams Needed</p>
                                                    {beamsNeeded !== null ? (
                                                    <p className="text-[9px] text-slate-500 font-medium">
                                                            for {(orderQty!).toLocaleString('en-IN')} m order
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
                                                        <p className="text-2xl font-semibold font-mono text-[var(--color-info-blue)] leading-none">{beamsNeeded}</p>
                                                        <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                                                            beams × {beamM.toFixed(0)} m
                                                        </p>
                                                    </>
                                                ) : (
                                                    <p className="text-xl font-semibold font-mono text-slate-300 leading-none">—</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}
                    </CardContent>
                </EstimatorCard>

                {/* 3. Weft Yarn Rows */}
                <EstimatorCard accent="weft">
                    <SectionHeader 
                        title={t('estimator.weft.title')} 
                        icon={Scissors} 
                        accent="weft"
                        step={3}
                        badgeContent={
                            <div className="flex items-center gap-3">
                                <div className="flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5 shadow-[0_1px_2px_rgba(30,37,40,0.03)]">
                                    <button
                                        type="button"
                                        onClick={() => setWidthUnit('cm')}
                                        className={`px-2.5 py-1 text-[11px] font-semibold uppercase rounded-md transition-all ${
                                            widthUnit === 'cm'
                                                ? 'bg-white text-[var(--color-factory-green)] shadow-sm border border-[var(--color-hairline)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        cm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWidthUnit('inch')}
                                        className={`px-2.5 py-1 text-[11px] font-semibold uppercase rounded-md transition-all ${
                                            widthUnit === 'inch'
                                                ? 'bg-white text-[var(--color-factory-green)] shadow-sm border border-[var(--color-hairline)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        inch
                                    </button>
                                </div>
                                <SectionCostPill value={totals.weftCostPerM} />
                            </div>
                        }
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        {/* Global Defaults Sync Readout */}
                        <div className="mb-6 overflow-hidden rounded-[13px] border border-[#CDE5D3] bg-[#F7FCF8]">
                            <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <Calculator className="h-3.5 w-3.5 text-[var(--color-factory-green)]" />
                                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-factory-green)]">Effective Weft Waste</span>
                                    </div>
                                    <p className="mt-1 text-[11px] font-medium text-[var(--color-muted)]">Weft uses waste only. Warp crimp does not apply to weft yarn.</p>
                                </div>
                                <span className="flex items-center gap-2 font-mono text-sm font-semibold text-[var(--color-factory-green)]">
                                    <span>{state.yarnShortagePct || 0}%</span>
                                    <span className="rounded-[7px] border border-[#CDE5D3] bg-white px-2.5 py-1 text-base">waste</span>
                                </span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            {state.weftRows.map((row, i) => {
                                const finishedWidthCm = row.finishedWidthCm ?? row.reedSpace
                                const effectiveCostingWidthCm = getEffectiveCostingWidthCm(row)
                                const rawEffectiveWidth = widthUnit === 'inch' ? effectiveCostingWidthCm / 2.54 : effectiveCostingWidthCm
                                const effectiveWidthWarning = getWidthWarnings({
                                    finishedWidthCm,
                                    effectiveCostingWidthCm,
                                    inputUnit: widthUnit,
                                    rawInputValue: rawEffectiveWidth,
                                })[0]?.message

                                return (
                                    <RowCard
                                        key={row.id}
                                        title={t('estimator.weft.layer')}
                                        index={i}
                                        accent="emerald"
                                        canRemove={state.weftRows.length > 1}
                                        onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })}
                                        kgPer100m={totals.weftRows[i]?.kgPer100m ?? 0}
                                        costPer100m={totals.weftRows[i]?.costPer100m ?? 0}
                                        adjustmentPct={totals.weftRows[i]?.totalAdjustmentPct ?? 0}
                                    >
                                        <CalculationModeField
                                            value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                            onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calculationMode', value })}
                                        />
                                        <LayerNameField
                                            label={t('estimator.field_labels.layer_name')}
                                            value={row.label ?? ''}
                                            placeholder={`${t('estimator.weft.layer')} ${i + 1}`}
                                            onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'label', value })}
                                        />
                                        <NumField label={t('estimator.field_labels.picks_ppi')} value={row.picks} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: v ?? 0 })} />
                                        <WidthField
                                            label="Finished / market pano"
                                            value={finishedWidthCm}
                                            onChange={v => {
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'finishedWidthCm', value: v })
                                                if (effectiveCostingWidthCm <= 0) {
                                                    dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value: v })
                                                    dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: v })
                                                }
                                            }}
                                            unit={widthUnit}
                                            hint="Market/finished pano"
                                        />
                                        <WidthField
                                            label="Effective costing width"
                                            value={effectiveCostingWidthCm}
                                            onChange={v => {
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value: v })
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: v })
                                            }}
                                            unit={widthUnit}
                                            hint={row.calculationMode === 'manual' ? 'Saved for audit; manual kg bypasses formula' : 'Used for weft yarn formula'}
                                            warning={effectiveWidthWarning}
                                        />
                                        {row.calculationMode === 'manual' ? (
                                            <NumField label="Weft Yarn consumption (kg/100m)" value={row.manualKgPer100m ?? null} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'manualKgPer100m', value: v })} unit="kg" step={0.001} hint="Kilograms of Weft Yarn needed for 100 metres; not m/kg yield." attentionWhenEmpty />
                                        ) : (
                                            <YarnDensityFields
                                                row={row}
                                                onChange={(field, value) => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value })}
                                            />
                                        )}
                                        <NumField label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} hint={`Blank uses ${state.yarnShortagePct}% default; 0 overrides`} warning={row.shortagePct !== null && row.shortagePct > 15 ? 'High waste %' : undefined} />
                                        {(() => {
                                            const templateRate = appliedTemplate?.weft_rows?.[i]?.yarnRate ?? null
                                            const isUnusuallyLow = templateRate !== null
                                                ? row.yarnRate < templateRate * 0.6
                                                : row.yarnRate > 0 && row.yarnRate < 50
                                            const warningId = `weft-${row.id}-rate`
                                            const isDismissed = dismissedWarnings.includes(warningId)
                                            return (
                                                <NumField
                                                    label={`${t('estimator.field_labels.rate_kg')} — REQUIRED`}
                                                    value={row.yarnRate}
                                                    onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })}
                                                    attentionWhenEmpty
                                                    warning={isUnusuallyLow && !isDismissed ? 'Unusually low' : undefined}
                                                    onDismissWarning={() => setDismissedWarnings(prev => [...prev, warningId])}
                                                />
                                            )
                                        })()}
                                        <NumField label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: v ?? 0 })} step={0.5} />
                                    </RowCard>
                                )
                            })}
                        </div>
                        <Button
                            variant="outline"
                            className="h-14 w-full rounded-[12px] border-dashed border-[#CDE5D3] bg-[#F7FCF8] text-[var(--color-factory-green)] hover:border-[var(--color-factory-green)] hover:bg-[var(--color-factory-green-soft)] transition-all gap-2"
                            onClick={() => dispatch({ type: 'ADD_WEFT_ROW' })}
                        >
                            <Plus className="h-4 w-4" /> {t('estimator.weft.add_weft')}
                        </Button>
                    </CardContent>
                </EstimatorCard>

                {/* 4. Weave Cost */}
                <EstimatorCard accent="weave">
                    <SectionHeader title={t('estimator.weave.title')} icon={Gauge} accent="weave" step={4} badgeContent={<SectionCostPill value={totals.weaveCostPerM} />} />
                    <CardContent className="p-5 sm:p-6 space-y-6">

                        {/* ── Loom Type Selector ── renders above Loom Wage ── */}
                        {(() => {
                            const totalPicks = state.weftRows.reduce((a, b) => a + b.picks, 0)
                            return (
                                <LoomConfigSection
                                    state={state}
                                    totalPicks={totalPicks}
                                    onSetLoomType={lt => dispatch({ type: 'SET_LOOM_TYPE', loomType: lt })}
                                    onSetLoomRpm={rpm => dispatch({ type: 'SET_LOOM_RPM', rpm })}
                                    onSetLoomPowerKw={kw => dispatch({ type: 'SET_LOOM_POWER_KW', kw })}
                                    onSetHoursPerShift={h => dispatch({ type: 'SET', field: 'hoursPerShift', value: h })}
                                    onSuggestOutput={dailyM => dispatch({ type: 'SET', field: 'avgOutputPerLoomPerDay', value: dailyM })}
                                />
                            )
                        })()}

                        {/* ── Loom Wage per Meter → auto-derives paisa/pick ── */}
                        {(() => {
                            const totalPicks = state.weftRows.reduce((a, b) => a + b.picks, 0)
                            const perPickCostRupees = state.perPickCostPaisa
                            const paisaPerPickDisplay = Math.round(perPickCostRupees * 100 * 10000) / 10000
                            const derivedWagePerM = totalPicks > 0
                                ? (perPickCostRupees * totalPicks).toFixed(2)
                                : '0.00'
                            return (
                                <div className="rounded-[10px] border border-[var(--color-warning-amber-soft)] bg-[var(--color-canvas)] px-4 py-3.5">
                                    <div className="flex items-center gap-2">
                                        <Banknote className="h-4 w-4 text-[var(--color-warning-amber)]" />
                                        <p className="text-[11px] font-semibold uppercase text-[var(--color-warning-amber)]">Loom Weave Wage</p>
                                        <span className="ml-auto rounded-full bg-[var(--color-warning-amber-soft)] px-2 py-0.5 text-[10px] text-[var(--color-warning-amber)]">₹/m ↔ paise/pick</span>
                                    </div>

                                    <div className="mt-3 grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_auto_1fr]">
                                        {/* Input: ₹ per meter */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-warning-amber)]">Wage per Meter (₹/m)</Label>
                                            <div className="relative group">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)] pointer-events-none">₹</span>
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
                                                    className="h-10 rounded-[10px] border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-8 pr-14 text-center text-sm font-medium [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">/m</span>
                                            </div>
                                            <InlineInputWarning show={state.perPickCostPaisa <= 0}>Required</InlineInputWarning>
                                        </div>

                                        <div className="hidden rounded-[6px] bg-[var(--color-warning-amber-soft)] px-2 py-1 text-center text-[11px] text-[var(--color-warning-amber)] md:block">↔</div>

                                        {/* Display: derived paise/pick + live impact */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider font-medium text-[var(--color-muted)]">Paisa per pick</Label>
                                            <div className="relative group">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    step={0.1}
                                                    value={paisaPerPickDisplay}
                                                    onChange={e => {
                                                        const v = Number(e.target.value)
                                                        dispatch({ type: 'SET', field: 'perPickCostPaisa', value: v / 100 })
                                                        setWagePerMInput('')
                                                    }}
                                                    className={`h-10 rounded-[10px] border pr-16 text-center text-sm font-medium [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
                                                        state.perPickCostPaisa <= 0 ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)]'
                                                    }`}
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">paise</span>
                                            </div>
                                            <InlineInputWarning show={state.perPickCostPaisa <= 0}>Required</InlineInputWarning>
                                        </div>
                                    </div>

                                    <div className="mt-3 flex items-center justify-between border-t border-[var(--color-warning-amber-soft)] pt-3">
                                        <span className="text-[11px] text-[var(--color-warning-amber)]">At {totalPicks} picks</span>
                                        <span className="text-sm font-semibold text-[var(--color-warning-amber)]">₹{totals.weaveCostPerM.toFixed(2)}/m</span>
                                    </div>

                                    {/* Unusually High Weave Cost Warning */}
                                    {totals.weaveCostPerM > 100 && (
                                        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs flex items-start gap-2.5 shadow-sm">
                                            <span className="text-sm shrink-0">⚠️</span>
                                            <div>
                                                <p className="font-bold">Unusually High Weave Cost (₹{totals.weaveCostPerM.toFixed(2)}/m)</p>
                                                <p className="text-amber-700 mt-0.5 font-medium">This weave cost looks unusually high. Did you mean paise per pick?</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })()}

                    </CardContent>
                </EstimatorCard>

                {/* 5. Warping & Sizing */}
                <EstimatorCard accent="post">
                    <SectionHeader title={t('estimator.warping_sizing.title')} icon={TrendingUp} accent="post" step={5} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} />} />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <NumField label={t('estimator.warping_sizing.warping_per_kg')} value={state.warpingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: v ?? 0 })} step={0.1} />
                        </div>

                        {/* Sizing: in-house vs outsourced toggle (Gap fix: zero is now explicit) */}
                        <div className="space-y-3 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                            <p className="text-[11px] uppercase font-semibold text-[var(--color-warning-amber)] tracking-[0.06em]">Sizing</p>
                            <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        id="sizing-mode-in-house"
                                        type="radio"
                                        name="sizing-mode"
                                        value="in_house"
                                        checked={state.sizingMode === 'in_house'}
                                        onChange={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'in_house' })}
                                        className="accent-[var(--color-yarn-orange)] h-3.5 w-3.5"
                                    />
                                    <span className="text-xs font-semibold text-[var(--color-body)] group-hover:text-[var(--color-ink)]">
                                        In-house <span className="text-[10px] text-[var(--color-muted)] font-normal">(already in overhead)</span>
                                    </span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer group">
                                    <input
                                        id="sizing-mode-outsourced"
                                        type="radio"
                                        name="sizing-mode"
                                        value="outsourced"
                                        checked={state.sizingMode === 'outsourced'}
                                        onChange={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'outsourced' })}
                                        className="accent-[var(--color-yarn-orange)] h-3.5 w-3.5"
                                    />
                                    <span className="text-xs font-semibold text-[var(--color-body)] group-hover:text-[var(--color-ink)]">Outsourced</span>
                                </label>
                            </div>
                            {state.sizingMode === 'outsourced' && (
                                <div className="space-y-1.5 pt-1">
                                    <NumField
                                        label="Sizing Rate (₹/kg)"
                                        value={state.sizingRatePerKg}
                                        onChange={v => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: v ?? 0 })}
                                        step={0.5}
                                        hint="Typical Surat outsourced sizing: ₹8–15/kg"
                                    />
                                </div>
                            )}
                            {state.sizingMode === 'in_house' && (
                                <p className="text-[11px] text-[var(--color-muted)] font-medium italic">
                                    Sizing cost is ₹0 — treated as part of factory overhead above.
                                </p>
                            )}
                        </div>

                        <div className="text-[10px] font-medium text-slate-400 italic">
                            {t('estimator.warping_sizing.applied_on')} {totals.totalWarpKgPer100m.toFixed(2)} {t('estimator.warping_sizing.warp_consumption')}
                        </div>
                    </CardContent>
                </EstimatorCard>

                {/* 5b. Factory Overhead — Itemized Breakdown */}
                <EstimatorCard accent="overhead">
                    <SectionHeader
                        title={t('estimator.overhead.title')}
                        icon={Calculator}
                        accent="overhead"
                        step={6}
                        badgeContent={
                            <div className="flex items-center gap-2">
                                <SectionCostPill value={totals.overheadPerM} />
                            </div>
                        }
                    />
                    <CardContent className="p-5 sm:p-6 space-y-6">
                        {/* Direct Overhead Input / Override (Improved UI) */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)] leading-none">Direct Overhead Rate</h4>
                            </div>

                            <div className="rounded-[9px] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[13px] font-medium text-[var(--color-ink)]">Direct overhead override</p>
                                                <p className="text-[11px] text-[var(--color-muted)]">Force a specific overhead rate from historical data</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {state.overheadOverridePerM != null && state.overheadOverridePerM > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => dispatch({ type: 'SET', field: 'overheadOverridePerM', value: null })}
                                                        className="text-[10px] font-medium text-[var(--color-warning-amber)] hover:underline mr-1"
                                                    >
                                                        Clear
                                                    </button>
                                                )}
                                                <div className="relative w-full sm:w-[140px]">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)] pointer-events-none">₹</span>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step={0.5}
                                                        placeholder="e.g. 12.50"
                                                        value={state.overheadOverridePerM ?? ''}
                                                        onChange={e => {
                                                            const v = e.target.value;
                                                            dispatch({ type: 'SET', field: 'overheadOverridePerM', value: v === '' ? null : Number(v) });
                                                        }}
                                                        className="h-10 w-full rounded-[9px] border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-8 pr-4 text-sm font-medium [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {state.overheadOverridePerM != null && state.overheadOverridePerM < totals.overheadPerM && (
                                            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-dashed border-[var(--color-hairline)]">
                                                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                                <p className="text-[10px] font-bold text-amber-700 leading-tight">
                                                    Safety Alert: Override (₹{state.overheadOverridePerM}) is LOWER than actual computed cost (₹{totals.overheadPerM.toFixed(2)}).
                                                    This order will NOT recover ₹{(totals.overheadPerM - state.overheadOverridePerM).toFixed(2)} in overhead per metre.
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>


                                        {/* Advanced Settings Collapsible Toggle */}
                                        <div className="border-t border-[var(--color-hairline)] pt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowAdvancedOverhead(!showAdvancedOverhead)}
                                                className="flex items-center justify-between w-full rounded-lg bg-[var(--color-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-all"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Calculator className="h-3.5 w-3.5 text-[var(--color-yarn-orange)]" />
                                                    <span>Advanced Capacity & Fixed Cost Breakdown</span>
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {!showAdvancedOverhead && totals.overheadTotalMonthly > 0 && (
                                                        <span className="text-[10px] font-mono text-[var(--color-muted)] font-normal mr-2">
                                                            Total: ₹{totals.overheadTotalMonthly.toLocaleString('en-IN')}/mo
                                                        </span>
                                                    )}
                                                    {showAdvancedOverhead ? (
                                                        <ChevronUp className="h-4 w-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    )}
                                                </div>
                                            </button>
                                        </div>

                                        {/* Advanced Capacity & Fixed Cost Section (Collapsible) */}
                                        {showAdvancedOverhead && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                className="space-y-6 pt-2"
                                            >
                                                {/* A. Factory Capacity Section */}
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between gap-2 mb-1">
                                                        <div className="flex items-center gap-2">
                                                            <Zap className="h-3.5 w-3.5 text-[var(--color-yarn-orange)]" />
                                                            <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)] leading-none">Factory Capacity Configuration</h4>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-6 px-2 text-[11px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                                                            onClick={handleSaveProfile}
                                                            disabled={saving}
                                                        >
                                                            {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />}
                                                            Update Baseline
                                                        </Button>
                                                    </div>
                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                        <CapacityMetricField
                                                            label="Machine Count"
                                                            value={state.loomCount} 
                                                            onChange={v => dispatch({ type: 'SET', field: 'loomCount', value: v ?? 0 })} 
                                                            unit="machines"
                                                        />
                                                        <CapacityMetricField
                                                            label="Avg Daily Output" 
                                                            value={state.avgOutputPerLoomPerDay} 
                                                            onChange={v => dispatch({ type: 'SET', field: 'avgOutputPerLoomPerDay', value: v ?? 0 })} 
                                                            unit="m/day" 
                                                        />
                                                        <CapacityMetricField
                                                            label="Working Days" 
                                                            value={state.monthlyWorkingDays} 
                                                            onChange={v => dispatch({ type: 'SET', field: 'monthlyWorkingDays', value: v ?? 0 })} 
                                                            unit="days" 
                                                            hint="Standard 26-day month"
                                                        />
                                                    </div>
                                                    {state.loomCount > 0 && state.avgOutputPerLoomPerDay > 0 && (
                                                        <div className="flex items-center justify-between border-t border-[var(--color-hairline)] pt-2">
                                                            <span className="text-[10px] font-medium text-[var(--color-muted)]">Monthly Rated Capacity:</span>
                                                            <span className="text-xs font-mono font-medium text-[var(--color-ink)]">{totals.ratedCapacityM.toLocaleString()} metres</span>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* B. Itemized Overhead Rows */}
                                                <div className="space-y-2">
                                                    <div className="mt-4 mb-2 flex items-center justify-between">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Monthly Fixed Costs</p>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-7 rounded-[6px] border border-dashed border-[var(--color-hairline)] px-2 text-[11px] font-medium text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                                                            onClick={() => dispatch({ type: 'ADD_OVERHEAD_ITEM' })}
                                                        >
                                                            <Plus className="h-3 w-3 mr-1" /> New Item
                                                        </Button>
                                                    </div>

                                                    <div className="divide-y divide-[var(--color-hairline)]">
                                                        {totals.resolvedItems.map(item => {
                                                            const isPreset = item.isPreset
                                                            const isLocked = item.isLocked
                                                            const isElectricity = item.category === 'electricity'
                                                            const isDepreciation = item.category === 'depreciation'

                                                            return (
                                                                <div key={item.id} className={`group relative flex flex-col gap-2 py-2.5 ${isLocked ? 'opacity-50' : ''}`}>
                                                                    <div className="flex items-center gap-3">
                                                                        {/* Label / Preset Indicator */}
                                                                        <div className="flex-1 flex items-center gap-2">
                                                                            {isLocked && <Lock className="h-3 w-3 text-[var(--color-muted)] shrink-0" />}
                                                                            <Input
                                                                                value={item.label}
                                                                                disabled={isPreset}
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'label', value: e.target.value })}
                                                                                className={`h-7 border-0 bg-transparent p-0 text-[13px] font-medium focus:ring-0 ${isPreset ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
                                                                            />
                                                                            {isLocked && <span className="rounded-[4px] bg-[var(--color-surface-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">auto-calc</span>}
                                                                            {isElectricity && <span className="rounded-[4px] bg-[var(--color-surface-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">per machine helper</span>}
                                                                        </div>

                                                                        {/* Amount Display/Input */}
                                                                        <div className="relative shrink-0 w-32">
                                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">₹</span>
                                                                            <Input
                                                                                type="number"
                                                                                value={item.monthlyAmount}
                                                                                disabled={isLocked}
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: Number(e.target.value) })}
                                                                                className="h-8 min-w-[120px] rounded-[7px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-6 pr-9 text-right text-[11px] font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                            />
                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--color-muted)] font-medium pointer-events-none">/mo</span>
                                                                        </div>

                                                                        {!isPreset && (
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => dispatch({ type: 'REMOVE_OVERHEAD_ITEM', id: item.id })}
                                                                                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                                                            >
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
                                                                                <span className="text-[9.5px] font-bold text-slate-500">Per Machine Helper</span>
                                                                            </div>
                                                                            {item.isLocked && (
                                                                                <>
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[8px] uppercase font-semibold text-slate-400">Units/Machine</span>
                                                                                        <Input 
                                                                                            type="number" 
                                                                                            value={(item.meta as ElectricityMeta)?.unitsPerLoomPerMonth ?? 0} 
                                                                                            onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { unitsPerLoomPerMonth: Number(e.target.value), type: 'electricity', mode: 'per_loom' } })}
                                                                                            className="h-6 text-[10px] font-mono font-bold px-1.5"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[8px] uppercase font-semibold text-slate-400">Rate/Unit</span>
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
                                                                                <span className="text-[8px] uppercase font-semibold text-slate-400">Machine Value (average/machine)</span>
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
                                                                                <span className="text-[8px] uppercase font-semibold text-slate-400">Lifespan (Years)</span>
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
                                                <div className="space-y-4 border-t border-[var(--color-hairline)] pt-4">
                                                    <div className="space-y-2">
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Monthly Output</p>
                                                        {/* Monthly Output & Suggestions */}
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-[10px] font-medium uppercase text-[var(--color-muted)]">Monthly Output (Actual/Target)</Label>
                                                                    {canUseProduction && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={handleAutoSuggestOutput}
                                                                            disabled={isSuggestingOutput}
                                                                            className="h-5 px-2 text-[10px] font-medium text-[var(--color-yarn-orange)] hover:bg-[var(--color-surface-soft)]"
                                                                        >
                                                                            {isSuggestingOutput ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                                                            Suggest
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="number"
                                                                        value={state.monthlyOutputM}
                                                                        onChange={e => dispatch({ type: 'SET', field: 'monthlyOutputM', value: Number(e.target.value) })}
                                                                        className="h-10 rounded-[9px] border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pr-9 text-center text-sm font-medium [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                    />
                                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">m</span>
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
                                                                            type="button"
                                                                            onClick={() => { dispatch({ type: 'SET', field: 'monthlyOutputM', value: outputSuggestion.avg30Days }); setOutputSuggestion(null); }}
                                                                            className="bg-white border border-indigo-100 rounded-lg p-2 text-left hover:border-indigo-300 transition-all group"
                                                                        >
                                                                            <p className="text-[8px] uppercase font-semibold text-slate-400">Last 30 Days</p>
                                                                            <p className="text-xs font-mono font-bold text-indigo-600 group-hover:text-indigo-700">{outputSuggestion.avg30Days.toLocaleString()}m</p>
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => { dispatch({ type: 'SET', field: 'monthlyOutputM', value: outputSuggestion.avg90Days }); setOutputSuggestion(null); }}
                                                                            className="bg-white border border-indigo-100 rounded-lg p-2 text-left hover:border-indigo-300 transition-all group"
                                                                        >
                                                                            <p className="text-[8px] uppercase font-semibold text-slate-400">Last 90 Days</p>
                                                                            <p className="text-xs font-mono font-bold text-indigo-600 group-hover:text-indigo-700">{outputSuggestion.avg90Days.toLocaleString()}m</p>
                                                                        </button>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">Total monthly cost</p>
                                                            <p className={`text-base font-semibold ${totals.overheadTotalMonthly <= 0 ? 'text-[var(--color-risk-red)]' : 'text-[var(--color-ink)]'}`}>
                                                                ₹{totals.overheadTotalMonthly.toLocaleString('en-IN')}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">100% capacity cost</p>
                                                            <p className="text-base font-semibold text-[var(--color-ink)]">₹{totals.overheadPerMAtCapacity.toFixed(2)}/m</p>
                                                        </div>
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">Your actual cost</p>
                                                            <p className={`text-base font-semibold ${totals.overheadPerM > 0 ? 'text-[var(--color-factory-green)]' : 'text-[var(--color-ink)]'}`}>₹{totals.overheadPerM.toFixed(2)}/m</p>
                                                        </div>
                                                    </div>
                                                    {isZeroConfig && (
                                                        <p className="text-[11px] text-[var(--color-warning-amber)]">Factory overhead items total is zero. Estimates may miss fixed cost recovery.</p>
                                                    )}

                                                    <div className="space-y-2">
                                                        {totals.costOfIdleCapacityMonthly > 500 && (
                                                            <div className="flex items-center gap-3 rounded-[10px] border border-[var(--color-risk-red-soft)] bg-[var(--color-risk-red-soft)] p-3">
                                                                <AlertCircle className="h-4 w-4 text-[var(--color-risk-red)] shrink-0" />
                                                                <div>
                                                                    <p className="text-[11px] font-semibold text-[var(--color-risk-red)]">Cost of Idle Capacity: ₹{totals.costOfIdleCapacityMonthly.toLocaleString('en-IN')}/mo</p>
                                                                    <p className="text-[9.5px] font-medium text-[var(--color-risk-red)] leading-tight">Your factory is running at {totals.capacityUtilisationPct.toFixed(1)}% capacity. You are effectively losing money on unrecovered fixed costs.</p>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}

                                        {/* Live Summary */}
                                        <div className="flex items-center justify-between bg-rose-50/70 border border-rose-100 rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-rose-600/80 leading-none mb-1">{t('estimator.overhead.overhead_per_m')}</p>
                                                <p className="text-2xl font-semibold font-mono text-rose-700 leading-none">₹{totals.overheadPerM.toFixed(2)}</p>
                                                {state.overheadOverridePerM != null && state.overheadOverridePerM > 0 && (
                                                    <p className="text-[9px] text-amber-600 font-bold mt-0.5">⚡ direct override</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 leading-none mb-1">{t('estimator.overhead.effective_rate')}</p>
                                                <p className="text-2xl font-semibold font-mono text-slate-700 leading-none">{totals.effectiveOverheadPct.toFixed(1)}%</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5">{t('estimator.overhead.of_direct_cost')} ₹{totals.directCostPerM.toFixed(2)}/m</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </EstimatorCard>



                {/* 6. Optional Sections */}
                <EstimatorCard accent="post">
                    <SectionHeader title={t('estimator.post_processing.title')} icon={Palette} accent="post" step={7} />
                    <CardContent className="p-5 sm:p-6 space-y-6">
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
                </EstimatorCard>

                {/* 8. Cost Audit */}
                <EstimatorCard accent="neutral">
                    <SectionHeader
                        title="Cost Breakdown"
                        icon={ReceiptText}
                        accent="neutral"
                        step={8}
                        detail={<p className="text-[11px] text-[var(--color-muted)]">Engine audit used for the final production cost.</p>}
                        badgeContent={<SectionCostPill value={totals.audit.productionCostPerMeter} />}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)]">
                            <div className="hidden grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.9fr_0.8fr_0.8fr] gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] md:grid">
                                <span>Yarn</span>
                                <span>Mode</span>
                                <span>Base kg/100m</span>
                                <span>Adjust</span>
                                <span>Final kg/100m</span>
                                <span>Rate</span>
                                <span className="text-right">Cost</span>
                            </div>
                            <div className="divide-y divide-[var(--color-hairline)] bg-white">
                                {auditLayerRows.map(layer => (
                                    <div key={`${layer.section}-${layer.id}`} className="grid gap-2 px-3 py-3 text-xs md:grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.9fr_0.8fr_0.8fr] md:gap-3 md:items-center">
                                        <div>
                                            <p className="font-semibold text-[var(--color-ink)]">{layer.name}</p>
                                            <p className="text-[10px] font-medium text-[var(--color-muted)]">{layer.section}</p>
                                            {layer.mode === 'formula' ? (
                                                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--color-muted)]">
                                                    {layer.section === 'Warp'
                                                        ? `${layer.calcDenier.toFixed(2)}D × ${layer.beamEnds ?? 0} ends / 90000 = ${layer.formulaKgPer100m.toFixed(3)} kg/100m`
                                                        : `${layer.calcDenier.toFixed(2)}D × ${layer.picks ?? 0} PPI × ${(layer.effectiveCostingWidthInches ?? 0).toFixed(1)} in / 90000 = ${layer.formulaKgPer100m.toFixed(3)} kg/100m`}
                                                </p>
                                            ) : (
                                                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--color-muted)]">
                                                    Manual base: {(layer.manualKgPer100m ?? layer.baseKgPer100mUsed).toFixed(3)} kg/100m
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-mono font-semibold text-[var(--color-muted)]">{layer.mode === 'manual' ? 'Manual' : 'Formula'}</p>
                                            <p className="text-[10px] font-medium leading-tight text-[var(--color-muted)]">{layer.formulaDescription}</p>
                                        </div>
                                        <p className="font-mono text-[var(--color-ink)]">{layer.baseKgPer100mUsed.toFixed(3)}</p>
                                        <div>
                                            <p className="font-mono text-[var(--color-warning-amber)]">{layer.totalAdjustmentPct.toFixed(1)}%</p>
                                            <p className="text-[10px] font-medium leading-tight text-[var(--color-muted)]">{layer.crimpPct.toFixed(1)}% crimp + {layer.wastePct.toFixed(1)}% waste</p>
                                        </div>
                                        <p className="font-mono text-[var(--color-ink)]">{layer.finalKgPer100m.toFixed(3)}</p>
                                        <p className="font-mono text-[var(--color-ink)]">₹{layer.ratePerKg.toFixed(0)}/kg</p>
                                        <p className="text-right font-mono font-semibold text-[var(--color-factory-green)]">₹{layer.costPerMeter.toFixed(2)}/m</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Yarn subtotal</p>
                                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                    <div>
                                        <p className="text-[10px] text-[var(--color-muted)]">Base before adjustment</p>
                                        <p className="font-mono text-base font-semibold text-[var(--color-ink)]">₹{totals.audit.yarnBaseCostPerMeter.toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[var(--color-muted)]">Waste/crimp add-on</p>
                                        <p className="font-mono text-base font-semibold text-[var(--color-warning-amber)]">₹{totals.audit.yarnAdjustmentCostPerMeter.toFixed(2)}/m</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-[var(--color-muted)]">Yarn after adjustment</p>
                                        <p className="font-mono text-base font-semibold text-[var(--color-factory-green)]">₹{totals.audit.yarnTotalCostPerMeter.toFixed(2)}/m</p>
                                    </div>
                                </div>
                            </div>
                            <div className="rounded-[12px] border border-[var(--color-hairline)] bg-white p-4">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Production stack</p>
                                <div className="mt-2 divide-y divide-[var(--color-hairline)]">
                                    {auditCostLines.map(line => (
                                        <div key={line.label} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                                            <span className="font-medium text-[var(--color-muted)]">{line.label}</span>
                                            <span className="font-mono font-semibold text-[var(--color-ink)]">₹{line.value.toFixed(2)}/m</span>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between gap-3 pt-2 text-sm">
                                        <span className="font-semibold text-[var(--color-ink)]">Production cost</span>
                                        <span className="font-mono font-semibold text-[var(--color-factory-green)]">₹{totals.audit.productionCostPerMeter.toFixed(2)}/m</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </EstimatorCard>

                {/* 9. Simulation / Order */}
                <EstimatorCard accent="weft">
                    <SectionHeader title={mode === 'market' ? t('estimator.simulation.market_title') : t('estimator.simulation.title')} icon={Coins} accent="weft" step={9} />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            <NumField 
                                label={mode === 'market' ? t('estimator.field_labels.market_target') : t('estimator.field_labels.simulation_qty')}
                                value={state.orderQuantityM} 
                                onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: v })} 
                                unit="m" 
                                step={100}
                                placeholder="1000"
                                attentionWhenEmpty
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
                </EstimatorCard>
            </div>

            {/* ── SCENARIO ANALYSIS (STRESS TESTS) ───────────────────────── */}
            {hasOrderQty && totals.orderQuote && (
                <div className={`${pageShellClass} space-y-2`}>
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
                            <CardContent className="p-5 sm:p-6 space-y-5">
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

            <CostingExportDialog
                open={showExportDialog}
                onOpenChange={setShowExportDialog}
                model={exportModel}
                defaultCustomerName={!isStandaloneCostingSession ? partyName : ''}
                defaultBusinessName={organizationName}
            />

            <Dialog open={Boolean(pendingStaleRateSave)} onOpenChange={open => { if (!open) setPendingStaleRateSave(null) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            Review overdue costing rates
                        </DialogTitle>
                        <DialogDescription>
                            This estimate uses defaults whose review date has passed. You can still save deliberately, or review them first.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Overdue defaults</p>
                        <p className="mt-1 text-sm font-medium text-amber-950">{staleDefaultRateNames.join(', ')}</p>
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => { setPendingStaleRateSave(null); router.push('/owner/rates') }}>
                            Review Rates
                        </Button>
                        <Button
                            className="bg-[var(--color-yarn-orange)] text-white hover:bg-[var(--color-yarn-orange-dark)]"
                            onClick={() => {
                                const pending = pendingStaleRateSave
                                setPendingStaleRateSave(null)
                                if (pending) void handleSaveQuote(pending.targetMode, pending.status, true, pending.recordKindOverride)
                            }}
                        >
                            Save with These Rates
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Start New Quality Dialog */}
            <Dialog open={showConfirmNewQuality} onOpenChange={setShowConfirmNewQuality}>
                <DialogContent className="sm:max-w-[400px] bg-white border border-slate-100 shadow-xl rounded-2xl p-6">
                    <DialogHeader className="space-y-3">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-center text-lg font-bold text-slate-900">
                            Start new quality / Reset?
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Clear the current estimator inputs while keeping saved qualities.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="text-center text-sm text-slate-500 py-2 leading-relaxed">
                        This will clear the current estimator inputs. Saved qualities will not be affected.
                    </div>
                    <DialogFooter className="flex sm:justify-center gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmNewQuality(false)}
                            className="w-full sm:w-auto border-slate-200 text-slate-600 hover:bg-slate-50"
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleNewQualityConfirm}
                            className="w-full sm:w-auto bg-brand-accent hover:bg-brand-accent/90 text-white font-medium shadow-sm"
                        >
                            Reset & Start
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save Quality Dialog */}
            <Dialog
                open={showSaveTemplate}
                onOpenChange={open => {
                    setShowSaveTemplate(open)
                    if (!open) setTemplateSaveError(null)
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Save as New Quality</DialogTitle>
                        <DialogDescription>Create a separate reusable quality. To change the open quality, close this dialog and use Update.</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="save-quality-name" className="text-[10px] uppercase font-semibold text-slate-500">{t('estimator.quality.qualityNameLabel')}</Label>
                            <Input
                                id="save-quality-name"
                                placeholder="Japan Satin, Canvas Shine"
                                value={templateName}
                                onChange={e => {
                                    setTemplateName(e.target.value)
                                    if (templateSaveError) setTemplateSaveError(null)
                                }}
                                onKeyDown={e => e.key === 'Enter' && !savingTemplate && handleSaveTemplate()}
                                aria-invalid={Boolean(templateSaveError)}
                                aria-describedby={templateSaveError ? 'save-quality-name-error' : undefined}
                                autoFocus
                            />
                            {templateSaveError && (
                                <p id="save-quality-name-error" role="alert" className="text-xs font-medium text-destructive">
                                    {templateSaveError}
                                </p>
                            )}
                        </div>
                        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 leading-relaxed space-y-1">
                            <p>{t('estimator.quality.savesNotePrefix')} {state.warpRows.length} {t('estimator.quality.savesNoteWarp')} {state.weftRows.length} {t('estimator.quality.savesNoteWeft')}</p>
                            <p className="text-slate-400">{t('estimator.quality.rateNote')}</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            setShowSaveTemplate(false)
                            setTemplateSaveError(null)
                        }}>{t('estimator.quality.cancel')}</Button>
                        <Button className="bg-brand-accent text-white" onClick={handleSaveTemplate} disabled={savingTemplate}>
                            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {t('estimator.quality.confirmSave')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Quality Rates Dialog */}
            <Dialog open={!!editRatesTpl} onOpenChange={open => { if (!open) setEditRatesTpl(null) }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            {t('estimator.quality.editDialogTitle')} {editRatesTpl?.name}
                        </DialogTitle>
                        <DialogDescription>Update the saved quality label and default rates.</DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-semibold text-slate-500">{t('estimator.quality.qualityNameLabel')}</Label>
                            <Input
                                value={editingTplName}
                                onChange={e => setEditingTplName(e.target.value)}
                                className="font-bold border-slate-200 focus:border-brand-accent focus:ring-4 focus:ring-brand-accent/5 rounded-xl h-11 transition-all"
                            />
                        </div>
                        <p className="text-xs text-slate-500 leading-relaxed">
                            {t('estimator.quality.structureNotePrefix')} <span className="font-bold text-slate-700">{t('estimator.quality.structureNoteAnd')}</span> {t('estimator.quality.structureNoteSuffix')}
                        </p>

                        {/* Warp rates */}
                        {editingWarpRates.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] uppercase tracking-widest font-semibold text-indigo-600">{t('estimator.quality.warpRates')}</p>
                                {(editRatesTpl?.warp_rows ?? []).map((row: WarpRow, i: number) => (
                                    <div key={row.id} className="flex items-center gap-4 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl px-4 py-3 shadow-sm transition-all hover:border-indigo-200 hover:bg-indigo-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-700 tracking-tight">{row.label?.trim() || `Warp ${i + 1}`}</p>
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
                                                className="h-10 text-sm font-mono font-semibold text-right pr-12 pl-8 border-indigo-100 focus:border-indigo-300 bg-white rounded-xl shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                <p className="text-[10px] uppercase tracking-widest font-semibold text-emerald-600">{t('estimator.quality.weftRates')}</p>
                                {(editRatesTpl?.weft_rows ?? []).map((row: WeftRow, i: number) => (
                                    <div key={row.id} className="flex items-center gap-4 bg-emerald-50/50 border border-emerald-100/50 rounded-2xl px-4 py-3 shadow-sm transition-all hover:border-emerald-200 hover:bg-emerald-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold text-slate-700 tracking-tight">{row.label?.trim() || `Weft ${i + 1}`}</p>
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
                                                className="h-10 text-sm font-mono font-semibold text-right pr-12 pl-8 border-emerald-100 focus:border-emerald-300 bg-white rounded-xl shadow-inner [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                    if (editRatesTpl && window.confirm(t('estimator.quality.deleteConfirm').replace('{name}', editRatesTpl.name))) {
                                        handleDeleteTemplate(editRatesTpl)
                                        setEditRatesTpl(null)
                                    }
                                }}
                                disabled={deletingTpl === editRatesTpl?.id}
                                className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('estimator.quality.deleteButton')}
                            </button>
                            <p className="text-[10px] text-slate-400 font-medium">{t('estimator.quality.deleteNote')}</p>
                        </div>
                    </div>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
                        <Button
                            variant="ghost" 
                            size="sm" 
                            onClick={handleApplyCurrentRates} 
                            className="text-slate-500 font-bold hover:bg-slate-50 rounded-xl"
                        >
                            {t('estimator.quality.applyAsIs')}
                        </Button>
                        <Button 
                            className="bg-brand-accent text-white font-semibold rounded-xl h-12 sm:h-11 shadow-lg shadow-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/30 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none sm:min-w-[180px]" 
                            onClick={handleSaveRatesAndApply} 
                            disabled={savingRates}
                        >
                            {savingRates ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                            <span className="text-sm">
                                {t('estimator.quality.saveApply')}
                            </span>
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


        </div>
    )
}
