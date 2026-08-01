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
    Archive,
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
    Pencil,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/context'
import {
    calcFullTotals,
    buildCostingResult,
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
    type OverheadMode,
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
    updateTemplateRates,
    updateFabricTemplate,
    getLastQuoteForParty,
    getMonthlyOutputSuggestion,
    upsertFactoryCostProfile,
    createMarketRunFromEstimator,
    startPartyOrderFromEstimator,
    archiveTemplate,
    renameTemplate,
} from './actions'
import { useAutosave } from '@/hooks/useAutosave'
import { toast } from '@/lib/app-notifications'
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import FactoryCostWizard from './FactoryCostWizard'
import {
    getEstimatorWorkflowConfig,
    type EstimatorWorkflowMode,
    type ProductionMode,
} from '@/lib/production-mode'
import {
    getFirstEstimatorValidationMessage,
    getYarnDensityWarning,
    validateEstimatorSnapshot,
} from '@/lib/estimator-validation'
import { shouldAutoRestoreEstimatorDraft } from '@/lib/estimator-drafts'
import type { EstimatorAutosaveData } from '@/lib/estimator-drafts'
import { createClientRequestUuid } from '@/lib/client-request-id'
import { CostingExportDialog } from '@/components/estimator/CostingExportDialog'
import { createCostingExportModel } from '@/lib/estimator-export'
import type { CostingRecordKind } from '@/lib/costing-workspace'
import { parseNonNegativeInput, parseNumericInput } from '@/lib/numeric-input'
import { getMatchingFactoryProfileId, type FactoryProfileId } from '@/lib/factory-cost-profiles'

// ─────────────────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────────────────

type FixedWorkerOverhead = { id: number; name: string; role: string; monthly_salary: number }

type FactoryCostProfile = Partial<{
    factory_id: string
    updated_at: string
    factory_profile_key: FactoryProfileId | null
    warping_rate_per_kg: number | string | null
    sizing_rate_per_kg: number | string | null
    winding_rate_per_kg: number | string | null
    overhead_pct: number | string | null
    overhead_mode: OverheadMode | null
    default_commission_pct: number | string | null
    default_margin_pct: number | string | null
    default_transport_per_m: number | string | null
    yarn_review_interval_days: number | string | null
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

function resolveOverheadMode(profile: Pick<FactoryCostProfile, 'overhead_mode' | 'overhead_override_per_m'> | null | undefined): OverheadMode {
    if (profile?.overhead_mode === 'direct') return 'direct'
    if (profile?.overhead_mode === 'monthly_expenses') return 'monthly_expenses'
    return profile?.overhead_override_per_m != null ? 'direct' : 'monthly_expenses'
}

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

function normalizeRecipeRows(rows: Array<Record<string, unknown>> | null | undefined) {
    return (rows ?? []).map(row => Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'id')))
}

function recipeSignature(recipe: {
    warpRows: WarpRow[]
    weftRows: WeftRow[]
    tapeLengthM: number | string | null | undefined
    warpCrimpPct: number | string | null | undefined
    perPickCostPaisa: number | string | null | undefined
    yarnShortagePct: number | string | null | undefined
    overheadOverridePerM: number | string | null | undefined
    loomType: string | null | undefined
    loomRpm: number | string | null | undefined
    loomPowerKw: number | string | null | undefined
    sizingMode: string | null | undefined
    hoursPerShift: number | string | null | undefined
}) {
    return JSON.stringify({
        warpRows: normalizeRecipeRows(recipe.warpRows as unknown as Array<Record<string, unknown>>),
        weftRows: normalizeRecipeRows(recipe.weftRows as unknown as Array<Record<string, unknown>>),
        tapeLengthM: Number(recipe.tapeLengthM ?? 0),
        warpCrimpPct: Number(recipe.warpCrimpPct ?? 0),
        perPickCostPaisa: Number(recipe.perPickCostPaisa ?? 0),
        yarnShortagePct: Number(recipe.yarnShortagePct ?? 0),
        overheadOverridePerM: recipe.overheadOverridePerM == null ? null : Number(recipe.overheadOverridePerM),
        loomType: recipe.loomType ?? null,
        loomRpm: recipe.loomRpm == null ? null : Number(recipe.loomRpm),
        loomPowerKw: recipe.loomPowerKw == null ? null : Number(recipe.loomPowerKw),
        sizingMode: recipe.sizingMode ?? null,
        hoursPerShift: recipe.hoursPerShift == null ? null : Number(recipe.hoursPerShift),
    })
}

function hasSavedQualityRecipeChanges(template: EstimatorTemplate, state: EstimateState) {
    return recipeSignature({
        warpRows: template.warp_rows ?? [],
        weftRows: template.weft_rows ?? [],
        tapeLengthM: template.tape_length_m,
        warpCrimpPct: template.warp_crimp_pct,
        perPickCostPaisa: template.per_pick_cost_paise,
        yarnShortagePct: template.yarn_shortage_pct,
        overheadOverridePerM: template.overhead_override_per_m,
        loomType: template.loom_type,
        loomRpm: template.loom_rpm,
        loomPowerKw: template.loom_power_kw,
        sizingMode: template.sizing_mode,
        hoursPerShift: template.hours_per_shift,
    }) !== recipeSignature({
        warpRows: state.warpRows,
        weftRows: state.weftRows,
        tapeLengthM: state.tapeLengthM,
        warpCrimpPct: state.warpCrimpPct,
        perPickCostPaisa: state.perPickCostPaisa,
        yarnShortagePct: state.yarnShortagePct,
        overheadOverridePerM: state.overheadOverridePerM,
        loomType: state.loomType,
        loomRpm: state.loomRpm,
        loomPowerKw: state.loomPowerKw,
        sizingMode: state.sizingMode,
        hoursPerShift: state.hoursPerShift,
    })
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
                monthlyOutputM:     profile.is_configured ? Number(profile.monthly_output_m ?? 0) : 0,
                overheadOverridePerM: profile.overhead_override_per_m != null ? Number(profile.overhead_override_per_m) : null,
                overheadMode:        resolveOverheadMode(profile),
                overheadPct:        0,
                yarnShortagePct:    profile.yarn_shortage_pct != null ? Number(profile.yarn_shortage_pct) : state.yarnShortagePct,
                warpCrimpPct:       profile.warp_crimp_pct != null ? Number(profile.warp_crimp_pct) : state.warpCrimpPct,
                commissionPct:      Number(profile.default_commission_pct  ?? 0),
                profitPct:          Number(profile.default_margin_pct ?? state.profitPct),
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
                    overheadMode: tpl.overhead_override_per_m !== undefined && tpl.overhead_override_per_m !== null ? 'direct' : state.overheadMode,
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
                overheadMode: tpl.overhead_override_per_m !== undefined && tpl.overhead_override_per_m !== null ? 'direct' : state.overheadMode,
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
            return { ...state, warpRows: [...state.warpRows, { id: nanoid(), ...DEFAULT_WARP_ROW, label: `Warp ${state.warpRows.length + 1}` }] }
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
            return { ...state, weftRows: [...state.weftRows, { id: nanoid(), ...DEFAULT_WEFT_ROW, label: `Weft ${state.weftRows.length + 1}` }] }
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
                overheadPct:       0,
                commissionPct:     Number(profile.default_commission_pct ?? base.commissionPct),
                transportPerM:     Number(profile.default_transport_per_m ?? base.transportPerM),
                enabledSections:   sections,
                monthlyOutputM:    profile.is_configured ? Number(profile.monthly_output_m ?? base.monthlyOutputM) : 0,
                overheadOverridePerM: profile.overhead_override_per_m != null ? Number(profile.overhead_override_per_m) : base.overheadOverridePerM,
                overheadMode:        resolveOverheadMode(profile),
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
                    onChange={e => {
                        const next = parseNonNegativeInput(e.target.value)
                        if (next !== null) onChange(next)
                    }}
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
                        const val = parseNumericInput(e.target.value, { min })
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
                        <p className="text-[10px] font-medium leading-tight text-[var(--color-warning-amber)]">{warning}</p>
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
    const densityWarning = getYarnDensityWarning(effectiveDenier)

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
                label={`${unit === 'cotton_count_ne' ? 'English cotton count' : 'Effective denier'} — REQUIRED`}
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
                warning={densityWarning}
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
    onUseInches,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    unit: 'cm' | 'inch'
    hint?: string
    warning?: string
    onUseInches?: () => void
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
                        const raw = parseNonNegativeInput(e.target.value) ?? 0
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
                        <span className="min-w-0 flex-1">{warning}</span>
                        {onUseInches && (
                            <button
                                type="button"
                                onClick={onUseInches}
                                className="shrink-0 rounded border border-[var(--color-warning-amber)] px-1.5 py-0.5 text-[9px] font-bold underline-offset-2 hover:bg-white"
                            >
                                Use inches
                            </button>
                        )}
                    </p>
                )}
                {hint && <p className="text-[10px] text-[var(--color-muted)] font-medium leading-tight pl-1">{hint}</p>}
            </div>
        </div>
    )
}

function SectionCostPill({ value, valid = true }: { value: number; valid?: boolean }) {
    if (!valid) {
        return (
            <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-1 text-[13px] font-semibold text-[var(--color-muted)]">
                —
            </span>
        )
    }
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
                    onChange={e => onChange(parseNonNegativeInput(e.target.value))}
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
                        <button aria-label={`Remove ${title}`} title={`Remove ${title}`} onClick={onRemove} className="rounded-md p-1 text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-risk-red)]">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            </div>
            <div className={`grid gap-4 px-4 py-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${accent === 'indigo' ? '2xl:grid-cols-7' : '2xl:grid-cols-5'}`}>
                {children}
            </div>
        </div>
    )
}

function QuickCostingView({
    state,
    dispatch,
    totals,
    hasValidCostResult,
    qualityLabel,
    setQualityLabel,
    qualityLocked,
    canUseProduction,
    widthUnit,
    onWidthUnitChange,
    onOpenDetailed,
    onOpenOverheadDetails,
    onOverheadModeChange,
    onSuggestOutput,
}: {
    state: EstimateState
    dispatch: React.Dispatch<Action>
    totals: EstimatorV3Totals
    hasValidCostResult: boolean
    qualityLabel: string
    setQualityLabel: (value: string) => void
    qualityLocked: boolean
    canUseProduction: boolean
    widthUnit: 'cm' | 'inch'
    onWidthUnitChange: (value: 'cm' | 'inch') => void
    onOpenDetailed: () => void
    onOpenOverheadDetails: () => void
    onOverheadModeChange: (mode: OverheadMode) => void
    onSuggestOutput: (dailyOutputM: number) => void
}) {
    const totalPicks = state.weftRows.reduce((sum, row) => sum + row.picks, 0)
    const directRateMissing = state.overheadMode === 'direct' && (!state.overheadOverridePerM || state.overheadOverridePerM <= 0)

    return (
        <div className="space-y-3">
            <section className="rounded-[14px] border border-[var(--color-yarn-orange)]/25 bg-gradient-to-r from-[var(--color-warning-amber-soft)]/70 to-white px-4 py-4 shadow-[0_6px_20px_rgba(30,37,40,0.04)] sm:px-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-[var(--color-yarn-orange)]" />
                            <h2 className="text-[15px] font-semibold text-[var(--color-ink)]">Quick Costing</h2>
                            <span className="rounded-full border border-[var(--color-yarn-orange)]/25 bg-white px-2 py-0.5 text-[10px] font-semibold text-[var(--color-yarn-orange-dark)]">same calculation engine</span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--color-body)]/75">Enter the numbers you use for a quality. Advanced capacity and monthly expense details stay out of the way until you need them.</p>
                    </div>
                    <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={onOpenDetailed}>
                        <Calculator className="h-3.5 w-3.5" /> Detailed view
                    </Button>
                </div>
            </section>

            <EstimatorCard accent="neutral">
                <SectionHeader title="Quality basics" icon={Layers} accent="neutral" step={1} />
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Fabric quality name — REQUIRED</Label>
                        <Input
                            value={qualityLabel}
                            readOnly={qualityLocked}
                            onChange={event => setQualityLabel(event.target.value)}
                            placeholder="e.g. 60g Georgette, D.246, Japan Satin"
                            className="h-11 border-slate-200 font-bold"
                        />
                        <p className="text-[10px] font-medium leading-normal text-slate-400">Use the name your staff and repeat customers will recognise.</p>
                    </div>
                    <NumField
                        label="Warp crimp (take-up)"
                        value={state.warpCrimpPct}
                        onChange={value => dispatch({ type: 'SET', field: 'warpCrimpPct', value: value ?? 0 })}
                        unit="%"
                        step={0.5}
                        hint="Applied to warp consumption and beam planning."
                    />
                    <NumField
                        label="Default yarn waste"
                        value={state.yarnShortagePct}
                        onChange={value => dispatch({ type: 'SET', field: 'yarnShortagePct', value: value ?? 0 })}
                        unit="%"
                        step={0.5}
                        hint="Used when a yarn row has no row-specific waste."
                    />
                    {canUseProduction && (
                        <NumField
                            label="Tape length per beam"
                            value={state.tapeLengthM}
                            onChange={value => dispatch({ type: 'SET', field: 'tapeLengthM', value: value ?? 0 })}
                            unit="m"
                            attentionWhenEmpty
                            hint="Required for beam planning and party orders."
                        />
                    )}
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="warp">
                <SectionHeader
                    title="Warp yarn"
                    icon={Sparkles}
                    accent="warp"
                    step={2}
                    detail={<p className="text-[11px] text-[var(--color-muted)]">{state.warpRows.length} component{state.warpRows.length === 1 ? '' : 's'} · crimp {state.warpCrimpPct || 0}% + waste {state.yarnShortagePct || 0}%</p>}
                    badgeContent={<SectionCostPill value={totals.warpCostPerM} valid={hasValidCostResult} />}
                />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    {state.warpRows.map((row, index) => (
                        <RowCard
                            key={row.id}
                            title="Warp yarn"
                            index={index}
                            accent="indigo"
                            canRemove={state.warpRows.length > 1}
                            onRemove={() => dispatch({ type: 'REMOVE_WARP_ROW', id: row.id })}
                            kgPer100m={totals.warpRows[index]?.kgPer100m ?? 0}
                            costPer100m={totals.warpRows[index]?.costPer100m ?? 0}
                            adjustmentPct={totals.warpRows[index]?.totalAdjustmentPct ?? 0}
                        >
                            <CalculationModeField
                                value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calculationMode', value })}
                            />
                            <LayerNameField label="Yarn component name" value={row.label ?? ''} placeholder={`Warp ${index + 1}`} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'label', value })} />
                            {row.calculationMode === 'manual' ? (
                                <NumField label="Warp consumption" value={row.manualKgPer100m ?? null} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'manualKgPer100m', value })} unit="kg/100m" step={0.001} attentionWhenEmpty />
                            ) : (
                                <>
                                    <YarnDensityFields row={row} onChange={(field, value) => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value })} />
                                    <NumField label="Beam ends" value={row.beamEnds} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: value ?? 0 })} />
                                </>
                            )}
                            <NumField label="Waste" value={row.shortagePct} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value })} unit="%" step={0.5} hint={`Blank uses ${state.yarnShortagePct || 0}% default`} />
                            <NumField label="Yarn rate — REQUIRED" value={row.yarnRate} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: value ?? 0 })} unit="₹/kg" step={1} attentionWhenEmpty />
                            <NumField label="GST" value={row.gstPct} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: value ?? 0 })} unit="%" step={0.5} />
                        </RowCard>
                    ))}
                    <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-[10px] border-dashed border-[#C6D9EA] bg-[#F7FBFD] text-[var(--color-info-blue)]" onClick={() => dispatch({ type: 'ADD_WARP_ROW' })}>
                        <Plus className="h-4 w-4" /> Add warp yarn component
                    </Button>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="weft">
                <SectionHeader
                    title="Weft yarn"
                    icon={Scissors}
                    accent="weft"
                    step={3}
                    badgeContent={<div className="flex items-center gap-2"><div className="flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5"><button type="button" onClick={() => onWidthUnitChange('cm')} className={`px-2 py-1 text-[10px] font-semibold uppercase ${widthUnit === 'cm' ? 'rounded bg-white text-[var(--color-factory-green)] shadow-sm' : 'text-[var(--color-muted)]'}`}>cm</button><button type="button" onClick={() => onWidthUnitChange('inch')} className={`px-2 py-1 text-[10px] font-semibold uppercase ${widthUnit === 'inch' ? 'rounded bg-white text-[var(--color-factory-green)] shadow-sm' : 'text-[var(--color-muted)]'}`}>inch</button></div><SectionCostPill value={totals.weftCostPerM} valid={hasValidCostResult} /></div>}
                />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    {state.weftRows.map((row, index) => {
                        const effectiveCostingWidthCm = getEffectiveCostingWidthCm(row)
                        return (
                            <RowCard key={row.id} title="Weft yarn" index={index} accent="emerald" canRemove={state.weftRows.length > 1} onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })} kgPer100m={totals.weftRows[index]?.kgPer100m ?? 0} costPer100m={totals.weftRows[index]?.costPer100m ?? 0} adjustmentPct={totals.weftRows[index]?.totalAdjustmentPct ?? 0}>
                                <CalculationModeField value={row.calculationMode === 'manual' ? 'manual' : 'formula'} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calculationMode', value })} />
                                <LayerNameField label="Yarn component name" value={row.label ?? ''} placeholder={`Weft ${index + 1}`} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'label', value })} />
                                <NumField label="Picks" value={row.picks} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: value ?? 0 })} unit="PPI" />
                                <WidthField label="Effective costing width" value={effectiveCostingWidthCm} onChange={value => { dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value }); dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value }) }} unit={widthUnit} hint={row.calculationMode === 'manual' ? 'Saved for audit' : 'Used in weft formula'} />
                                {row.calculationMode === 'manual' ? (
                                    <NumField label="Weft consumption" value={row.manualKgPer100m ?? null} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'manualKgPer100m', value })} unit="kg/100m" step={0.001} attentionWhenEmpty />
                                ) : (
                                    <YarnDensityFields row={row} onChange={(field, value) => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value })} />
                                )}
                                <NumField label="Waste" value={row.shortagePct} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value })} unit="%" step={0.5} hint={`Blank uses ${state.yarnShortagePct || 0}% default`} />
                                <NumField label="Yarn rate — REQUIRED" value={row.yarnRate} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: value ?? 0 })} unit="₹/kg" step={1} attentionWhenEmpty />
                                <NumField label="GST" value={row.gstPct} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: value ?? 0 })} unit="%" step={0.5} />
                            </RowCard>
                        )
                    })}
                    <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-[10px] border-dashed border-[#CDE5D3] bg-[#F7FCF8] text-[var(--color-factory-green)]" onClick={() => dispatch({ type: 'ADD_WEFT_ROW' })}>
                        <Plus className="h-4 w-4" /> Add weft yarn component
                    </Button>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="weave">
                <SectionHeader title="Weaving cost" icon={Gauge} accent="weave" step={4} badgeContent={<SectionCostPill value={totals.weaveCostPerM} valid={hasValidCostResult} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <NumField label="Weaving rate" value={state.perPickCostPaisa * 100} onChange={value => dispatch({ type: 'SET', field: 'perPickCostPaisa', value: (value ?? 0) / 100 })} unit="paise/pick" step={0.1} attentionWhenEmpty hint={`At ${totalPicks} picks: ₹${totals.weaveCostPerM.toFixed(2)}/m`} />
                        <div className="rounded-[10px] border border-[var(--color-warning-amber-soft)] bg-[var(--color-canvas)] px-3 py-2.5">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-warning-amber)]">Calculated loom cost</p>
                            <p className="mt-1 font-mono text-xl font-semibold text-[var(--color-warning-amber)]">₹{totals.weaveCostPerM.toFixed(2)}/m</p>
                            <p className="mt-1 text-[10px] text-[var(--color-muted)]">{totalPicks} total picks × paise per pick</p>
                        </div>
                    </div>
                    <details className="rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3">
                        <summary className="cursor-pointer text-xs font-semibold text-[var(--color-body)]">Optional loom class and output suggestion</summary>
                        <div className="mt-3">
                            <LoomConfigSection
                                state={state}
                                totalPicks={totalPicks}
                                onSetLoomType={loomType => dispatch({ type: 'SET_LOOM_TYPE', loomType })}
                                onSetLoomRpm={rpm => dispatch({ type: 'SET_LOOM_RPM', rpm })}
                                onSetLoomPowerKw={kw => dispatch({ type: 'SET_LOOM_POWER_KW', kw })}
                                onSetHoursPerShift={hours => dispatch({ type: 'SET', field: 'hoursPerShift', value: hours })}
                                onSuggestOutput={onSuggestOutput}
                            />
                        </div>
                    </details>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="post">
                <SectionHeader title="Warping and sizing" icon={TrendingUp} accent="post" step={5} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} valid={hasValidCostResult} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <NumField label="Warping rate" value={state.warpingRatePerKg} onChange={value => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: value ?? 0 })} unit="₹/kg" step={0.1} />
                        <div className="space-y-2 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-warning-amber)]">Sizing</p>
                            <div className="flex flex-wrap gap-3 text-xs font-semibold text-[var(--color-body)]">
                                <label className="flex items-center gap-1.5"><input type="radio" name="quick-sizing-mode" checked={state.sizingMode === 'in_house'} onChange={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'in_house' })} /> In-house</label>
                                <label className="flex items-center gap-1.5"><input type="radio" name="quick-sizing-mode" checked={state.sizingMode === 'outsourced'} onChange={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'outsourced' })} /> Outsourced</label>
                            </div>
                            {state.sizingMode === 'outsourced' ? <NumField label="Sizing rate" value={state.sizingRatePerKg} onChange={value => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: value ?? 0 })} unit="₹/kg" step={0.5} /> : <p className="text-[10px] italic text-[var(--color-muted)]">In-house sizing is treated as factory overhead.</p>}
                        </div>
                    </div>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="overhead">
                <SectionHeader title="Factory expenses" icon={Calculator} accent="overhead" step={6} badgeContent={<SectionCostPill value={totals.overheadPerM} valid={hasValidCostResult} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button type="button" aria-pressed={state.overheadMode === 'direct'} onClick={() => onOverheadModeChange('direct')} className={`rounded-[10px] border px-3 py-3 text-left ${state.overheadMode === 'direct' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)]'}`}>
                            <p className="text-[12px] font-semibold text-[var(--color-ink)]">I know my factory cost per metre</p>
                            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Use a trusted ₹/m input.</p>
                        </button>
                        <button type="button" aria-pressed={state.overheadMode === 'monthly_expenses'} onClick={() => onOverheadModeChange('monthly_expenses')} className={`rounded-[10px] border px-3 py-3 text-left ${state.overheadMode === 'monthly_expenses' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)]'}`}>
                            <p className="text-[12px] font-semibold text-[var(--color-ink)]">Calculate from monthly expenses</p>
                            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Use saved factory expenses.</p>
                        </button>
                    </div>
                    {state.overheadMode === 'direct' ? (
                        <NumField label="Direct factory overhead — REQUIRED" value={state.overheadOverridePerM} onChange={value => dispatch({ type: 'SET', field: 'overheadOverridePerM', value })} unit="₹/m" step={0.1} attentionWhenEmpty />
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <NumField label="Actual monthly output" value={state.monthlyOutputM} onChange={value => dispatch({ type: 'SET', field: 'monthlyOutputM', value: value ?? 0 })} unit="m/mo" step={100} attentionWhenEmpty hint="Saved expenses are divided by this output." />
                            <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={onOpenOverheadDetails}><Calculator className="h-3.5 w-3.5" /> Edit expenses</Button>
                        </div>
                    )}
                    {directRateMissing && <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Enter a direct rate greater than ₹0/m before saving.</p>}
                    <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                        <span className="text-[11px] font-medium text-[var(--color-muted)]">Used in this costing</span>
                        <span className="font-mono text-base font-semibold text-[var(--color-risk-red)]">₹{totals.overheadPerM.toFixed(2)}/m</span>
                    </div>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="neutral">
                <SectionHeader title="Selling and quantity (optional for Base)" icon={Coins} accent="neutral" step={7} />
                <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
                    <NumField label="Target margin" value={state.profitPct} onChange={value => dispatch({ type: 'SET', field: 'profitPct', value: value ?? 0 })} unit="%" step={0.5} />
                    <NumField label="Broker commission" value={state.commissionPct} onChange={value => dispatch({ type: 'SET', field: 'commissionPct', value: value ?? 0 })} unit="%" step={0.5} />
                    <NumField label="Transport charge" value={state.transportPerM} onChange={value => dispatch({ type: 'SET', field: 'transportPerM', value: value ?? 0 })} unit="₹/m" step={0.1} />
                    <NumField label="Costing quantity" value={state.orderQuantityM} onChange={value => dispatch({ type: 'SET', field: 'orderQuantityM', value })} unit="m" step={100} placeholder="Optional" hint="Needed for order-level profit and quotations." />
                </CardContent>
            </EstimatorCard>
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
    initialPartyNames,
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
    initialPartyNames: string[]
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
            winding: false, processing: false, finishing: false, commission: false, transport: false,
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
            overheadPct:       0,
            commissionPct:     Number(initialProfile.default_commission_pct ?? base.commissionPct),
            profitPct:         Number(initialProfile.default_margin_pct ?? base.profitPct),
            transportPerM:     Number(initialProfile.default_transport_per_m ?? base.transportPerM),
            enabledSections:   sections,
            monthlyOutputM:    initialProfile.is_configured ? Number(initialProfile.monthly_output_m ?? base.monthlyOutputM) : 0,
            overheadOverridePerM: initialProfile.overhead_override_per_m !== undefined && initialProfile.overhead_override_per_m !== null
                ? Number(initialProfile.overhead_override_per_m) : base.overheadOverridePerM,
            overheadMode:        resolveOverheadMode(initialProfile),
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
    const [partyNames,      setPartyNames]      = useState(initialPartyNames)
    const [qualityLabel,    setQualityLabel]    = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const lastGeneratedWarp = useRef<string | null>(null)
    const lastGeneratedWeft = useRef<string | null>(null)
    const [sourceQuoteId, setSourceQuoteId] = useState<string | null>(null)
    const [sourceQuoteUpdatedAt, setSourceQuoteUpdatedAt] = useState<string | null>(null)
    const [sourceQuoteVersionNumber, setSourceQuoteVersionNumber] = useState<number | null>(null)
    const [sourceQuoteCreatedAt, setSourceQuoteCreatedAt] = useState<string | null>(null)
    const [sourceFactoryProfileUpdatedAt, setSourceFactoryProfileUpdatedAt] = useState<string | null>(null)
    const [sourceRecordKind, setSourceRecordKind] = useState<CostingRecordKind | null>(null)
    const isStandaloneCostingSession = !canUseProduction || sourceRecordKind === 'costing'
    const quoteRequestIdRef = useRef<string | null>(null)
    const autoRestoredDraftSavedAtRef = useRef<number | null>(null)

    const [showSaveTemplate, setShowSaveTemplate] = useState(false)
    const [renameTpl, setRenameTpl] = useState<EstimatorTemplate | null>(null)
    const [renameValue, setRenameValue] = useState('')
    const [renameError, setRenameError] = useState<string | null>(null)
    const [renamingTpl, setRenamingTpl] = useState(false)
    const [showDiscardDraft, setShowDiscardDraft] = useState(false)
    const [showExportDialog, setShowExportDialog] = useState(false)
    const [pendingStaleRateSave, setPendingStaleRateSave] = useState<{
        targetMode: 'quote' | 'market'
        status: 'draft' | 'accepted'
        recordKindOverride?: 'costing' | 'quotation'
    } | null>(null)
    const [pendingQualityVersionSave, setPendingQualityVersionSave] = useState<{
        targetMode: 'quote' | 'market'
        status: 'draft' | 'accepted'
        recordKindOverride?: 'costing' | 'quotation'
    } | null>(null)
    const [factoryBaselineUpdatedAt, setFactoryBaselineUpdatedAt] = useState<string | null>(initialProfile?.updated_at ?? null)
    const [templateName,     setTemplateName]     = useState('')
    const [templateSaveError, setTemplateSaveError] = useState<string | null>(null)

    // Template management — "edit rates" sheet
    const [editRatesTpl,     setEditRatesTpl]     = useState<EstimatorTemplate | null>(null)
    const [editingTplName,   setEditingTplName]   = useState('')
    const [editingWarpRates, setEditingWarpRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [editingWeftRates, setEditingWeftRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [savingRates,      setSavingRates]      = useState(false)
    const [deletingTpl,      setDeletingTpl]      = useState<string | null>(null)
    const [templateToArchive, setTemplateToArchive] = useState<EstimatorTemplate | null>(null)
    const [appliedTemplate,   setAppliedTemplate]   = useState<EstimatorTemplate | null>(null)
    const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([])
    const [acknowledgedWarningKey, setAcknowledgedWarningKey] = useState<string | null>(null)
    const [showWarningAcknowledgement, setShowWarningAcknowledgement] = useState(false)
    const [showConfirmNewQuality, setShowConfirmNewQuality] = useState(false)
    const [showValidation, setShowValidation] = useState(false)

    // Template search
    const [templateSearch,   setTemplateSearch]   = useState('')

    const [showAdvancedOverhead, setShowAdvancedOverhead] = useState(false)
    const [entryMode, setEntryMode] = useState<'quick' | 'detailed'>(canUseProduction ? 'detailed' : 'quick')

    // Party rate memory — debounced with 800ms + 3-char min
    const [partyHint, setPartyHint] = useState<{
        quality_label: string; quote_price_per_meter: number; created_at: string
    } | null>(null)
    const partyLookupTimerRef = useState<ReturnType<typeof setTimeout> | null>(null)

    // Autosave — scoped per user (orgId-userId) so multi-user on same device is safe
    const shouldPersistEstimatorDraft = useCallback((data: Omit<EstimatorAutosaveData<EstimateState>, 'savedAt'>) => {
        const hasWarpInput = data.state.warpRows.some(row => Number(row.calcDenier) > 0 || Number(row.beamEnds) > 0 || Number(row.yarnRate) > 0 || Number(row.manualKgPer100m) > 0)
        const hasWeftInput = data.state.weftRows.some(row => Number(row.calcDenier) > 0 || Number(row.picks) > 0 || Number(row.yarnRate) > 0 || Number(row.manualKgPer100m) > 0)
        return Boolean(
            data.sourceQuoteId
            || data.qualityLabel.trim()
            || data.partyName.trim()
            || hasWarpInput
            || hasWeftInput
            || ((hasWarpInput || hasWeftInput) && (data.warpInstruction.trim() || data.weftInstruction.trim()))
            || Number(data.state.perPickCostPaisa) > 0
            || data.state.orderQuantityM != null,
        )
    }, [])

    const { hasDraft, draft, restoreDraft, dismissDraft, clearDraft, saveDraft, saveDraftNow, suppressAutosaveUntilChanged } = useAutosave<EstimateState>({
        orgId,
        userId,
        debounceMs: 2000,
        shouldPersist: data => shouldPersistEstimatorDraft(data as Omit<EstimatorAutosaveData<EstimateState>, 'savedAt'>),
    })

    const buildCurrentDraft = useCallback((
        clientRequestId = quoteRequestIdRef.current,
        recordKindOverride?: CostingRecordKind,
    ) => ({
        state,
        partyName,
        qualityLabel,
        warpInstruction,
        weftInstruction,
        sourceQuoteId: sourceQuoteId ?? undefined,
        sourceQuoteUpdatedAt: sourceQuoteUpdatedAt ?? undefined,
        sourceQuoteVersionNumber: sourceQuoteVersionNumber ?? undefined,
        sourceQuoteCreatedAt: sourceQuoteCreatedAt ?? undefined,
        sourceFactoryProfileUpdatedAt: sourceFactoryProfileUpdatedAt ?? undefined,
        sourceRecordKind: recordKindOverride ?? sourceRecordKind ?? undefined,
        templateId: appliedTemplate?.id,
        clientRequestId: clientRequestId ?? undefined,
    }), [
        appliedTemplate?.id,
        partyName,
        qualityLabel,
        sourceQuoteId,
        sourceQuoteUpdatedAt,
        sourceQuoteVersionNumber,
        sourceQuoteCreatedAt,
        sourceFactoryProfileUpdatedAt,
        sourceRecordKind,
        state,
        warpInstruction,
        weftInstruction,
    ])

    const applyEstimatorDraft = useCallback(() => {
        const restored = restoreDraft()
        if (!restored) return
        suppressAutosaveUntilChanged()
        lastGeneratedWarp.current = null
        lastGeneratedWeft.current = null

        dispatch({ type: 'RESTORE_DRAFT', draftState: restored.state })
        setPartyName(restored.partyName)
        setQualityLabel(restored.qualityLabel)
        setWarpInstruction(restored.warpInstruction)
        setWeftInstruction(restored.weftInstruction)
        setSourceQuoteId(restored.sourceQuoteId ?? null)
        setSourceQuoteUpdatedAt(restored.sourceQuoteUpdatedAt ?? null)
        setSourceQuoteVersionNumber(restored.sourceQuoteVersionNumber ?? null)
        setSourceQuoteCreatedAt(restored.sourceQuoteCreatedAt ?? null)
        setSourceFactoryProfileUpdatedAt(restored.sourceFactoryProfileUpdatedAt ?? null)
        setSourceRecordKind(restored.sourceRecordKind ?? null)
        setAppliedTemplate(templates.find(template => template.id === restored.templateId) ?? null)
        quoteRequestIdRef.current = restored.clientRequestId ?? null
        setDismissedWarnings([])
        setAcknowledgedWarningKey(null)
        setShowWarningAcknowledgement(false)
        const restoredValidation = validateEstimatorSnapshot(restored.state, { requireTapeLength: canUseProduction })
        setShowValidation(!restoredValidation.valid)
        if (!restoredValidation.valid) {
            toast.error('This Cost Estimate draft is incomplete. Check the highlighted fields before saving.')
        } else {
            toast.success(restored.sourceQuoteId
                ? restored.sourceRecordKind === 'costing' ? 'Costing specifications loaded' : 'Quotation specifications loaded'
                : 'Cost Estimate draft restored')
        }
    }, [canUseProduction, restoreDraft, suppressAutosaveUntilChanged, templates])

    useEffect(() => {
        if (!hasDraft || !draft || !shouldAutoRestoreEstimatorDraft(draft)) return
        if (autoRestoredDraftSavedAtRef.current === draft.savedAt) return

        // React StrictMode can replay mount effects. savedAt identifies this
        // handoff so an explicit Open & Update / Start From action is applied
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
                setFactoryBaselineUpdatedAt(pRes.data.updated_at ?? null)
                dispatch({
                    type: 'INIT_FROM_PROFILE',
                    data: {
                        profile:  pRes.data,
                        sections: pRes.data.enabled_sections ?? {
                            winding: false, processing: false, finishing: false, commission: false, transport: false,
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
        saveDraft(buildCurrentDraft(
            quoteRequestIdRef.current,
            sourceRecordKind ?? (isStandaloneCostingSession ? 'costing' : 'quotation'),
        ))
    }, [buildCurrentDraft, isStandaloneCostingSession, orgId, saveDraft, sourceRecordKind, state])

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
        if (mode === 'market' || isStandaloneCostingSession) { setPartyHint(null); return }
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
    }, [isStandaloneCostingSession, mode, partyName])

    const estimatorValidation = useMemo(
        () => validateEstimatorSnapshot(state, { requireTapeLength: canUseProduction }),
        [canUseProduction, state],
    )
    const firstEstimatorValidationMessage = useMemo(
        () => getFirstEstimatorValidationMessage(estimatorValidation),
        [estimatorValidation],
    )
    const estimatorWarnings = useMemo(
        () => estimatorValidation.warnings ?? [],
        [estimatorValidation.warnings],
    )
    const warningKey = useMemo(
        () => estimatorWarnings.map(warning => `${warning.field}:${warning.message}`).join('|'),
        [estimatorWarnings],
    )
    const warningsAcknowledged = !warningKey || acknowledgedWarningKey === warningKey
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
    const costingResult = useMemo(() => buildCostingResult(state, totals), [state, totals])
    // Keep the monthly-expense reference available even when the costing is
    // currently using a direct ₹/m rate. This is transparency only; it never
    // overrides the selected calculation method.
    const monthlyOverheadReference = state.monthlyOutputM > 0
        ? totals.overheadTotalMonthly / state.monthlyOutputM
        : 0
    const hasValidCostResult = estimatorValidation.valid
        && Number.isFinite(totals.totalProductionCostPerM)
        && totals.totalProductionCostPerM >= 0
    const validationSummaryId = 'estimator-save-validation-summary'
    const exportModel = useMemo(() => hasValidCostResult
        ? createCostingExportModel({ qualityLabel, state, totals, result: costingResult })
        : null,
    [costingResult, hasValidCostResult, qualityLabel, state, totals])
    const scenarios = useMemo(() => runScenarios(state, totals), [state, totals])
    const breakEvenScenario = useMemo(
        () => scenarios.find(scenario => scenario.id === 'break-even'),
        [scenarios],
    )
    const handleOverheadModeChange = useCallback((nextMode: OverheadMode) => {
        dispatch({ type: 'SET', field: 'overheadMode', value: nextMode })
        if (nextMode === 'monthly_expenses') {
            // Switching away from a direct rate must be explicit in state so
            // the calculation engine cannot silently keep using the old rate.
            dispatch({ type: 'SET', field: 'overheadOverridePerM', value: null })
            return
        }
        if (state.overheadOverridePerM == null || state.overheadOverridePerM <= 0) {
            const suggestedRate = totals.overheadPerM > 0 ? Number(totals.overheadPerM.toFixed(2)) : null
            dispatch({ type: 'SET', field: 'overheadOverridePerM', value: suggestedRate })
        }
    }, [state.overheadOverridePerM, totals.overheadPerM])
    const handleSuggestOutput = useCallback((dailyOutputM: number) => {
        dispatch({ type: 'SET', field: 'avgOutputPerLoomPerDay', value: dailyOutputM })
        if (state.overheadMode === 'monthly_expenses' && state.loomCount > 0 && state.monthlyWorkingDays > 0) {
            const suggestedMonthlyOutput = Math.round(dailyOutputM * state.loomCount * state.monthlyWorkingDays)
            dispatch({ type: 'SET', field: 'monthlyOutputM', value: suggestedMonthlyOutput })
            toast.success(`Applied ${suggestedMonthlyOutput.toLocaleString('en-IN')} m/month to monthly overhead output.`)
        } else {
            toast.success('Daily output updated as a capacity reference. Monthly overhead output was not changed.')
        }
    }, [state.loomCount, state.monthlyWorkingDays, state.overheadMode])

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
        // Choosing a Saved Quality is a fresh estimate context. It must not
        // silently keep the costing version that was previously open, or a
        // later Save New Version could attach the wrong recipe to that history.
        setSourceQuoteId(null)
        setSourceQuoteUpdatedAt(null)
        setSourceQuoteVersionNumber(null)
        setSourceQuoteCreatedAt(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
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

    const requireWarningReview = () => {
        if (warningsAcknowledged) return false
        setShowWarningAcknowledgement(true)
        return true
    }

    const handleSaveProfile = async () => {
        if (requireWarningReview()) return
        setSaving(true)
        try {
            const res = await upsertFactoryCostProfile({
                warping_rate_per_kg:     state.warpingRatePerKg,
                sizing_rate_per_kg:      state.sizingRatePerKg,
                winding_rate_per_kg:     state.windingRatePerKg,
                overhead_mode:          state.overheadMode,
                factory_profile_key:    getMatchingFactoryProfileId(state.enabledSections) ?? 'custom',
                default_commission_pct:  state.commissionPct,
                default_margin_pct:      state.profitPct,
                default_transport_per_m: state.transportPerM,
                yarn_review_interval_days: Number(initialProfile?.yarn_review_interval_days ?? 90),
                default_processing_rate_per_m: state.processingRatePerM,
                default_finishing_rate_per_m: state.finishingRatePerM,
                enabled_sections:        state.enabledSections,
                overhead_items:          state.overheadItems,
                monthly_output_m:        state.monthlyOutputM,
                overhead_override_per_m: state.overheadMode === 'direct' ? state.overheadOverridePerM : null,
                loom_count:              state.loomCount,
                monthly_working_days:    state.monthlyWorkingDays,
                avg_output_per_loom_per_day: state.avgOutputPerLoomPerDay,
                yarn_shortage_pct:       state.yarnShortagePct,
                warp_crimp_pct:          state.warpCrimpPct,
                expectedUpdatedAt:       factoryBaselineUpdatedAt ?? undefined,
            })

            if (res.success) {
                dispatch({ type: 'SET', field: 'isConfigured', value: true })
                setFactoryBaselineUpdatedAt(res.updatedAt ?? factoryBaselineUpdatedAt)
                toast.success(t('estimator.sprint1.baseline_updated'))
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
        if (requireWarningReview()) return

        const warpRows = trimLayerLabels(state.warpRows)
        const weftRows = trimLayerLabels(state.weftRows)

        const savedName = templateName.trim().replace(/\s+/g, ' ')
        setTemplateSaveError(null)
        setSavingTemplate(true)
        try {
            const res = await saveAsFabricTemplate({
                name:             savedName,
                partyName:        partyName.trim() || undefined,
                warpRows,
                weftRows,
                tapeLengthM:      state.tapeLengthM,
                warpCrimpPct:     state.warpCrimpPct,
                perPickCostPaisa: state.perPickCostPaisa,
                yarnShortagePct:  state.yarnShortagePct,
                overheadMode:     state.overheadMode,
                overheadOverridePerM: state.overheadOverridePerM,
                loomType:         state.loomType,
                loomRpm:          state.loomRpm,
                loomPowerKw:      state.loomPowerKw,
                sizingMode:       state.sizingMode,
                hoursPerShift:    state.hoursPerShift,
                estimate:         { ...state, warpRows, weftRows },
            })
            if (res.success) {
                const tRes = await getEstimatorTemplates()
                if (tRes.data) {
                    setTemplates(tRes.data)
                    const savedTemplate = tRes.data.find(t => t.name === savedName)
                    if (savedTemplate) setAppliedTemplate(savedTemplate)
                }
                setQualityLabel(savedName)
                setSourceQuoteId(null)
                setSourceQuoteUpdatedAt(null)
                setSourceQuoteVersionNumber(null)
                setSourceQuoteCreatedAt(null)
                setSourceFactoryProfileUpdatedAt(null)
                setSourceRecordKind(null)
                quoteRequestIdRef.current = null
                setShowSaveTemplate(false)
                setTemplateName('')
                setTemplateSaveError(null)
                clearDraft()
                suppressAutosaveUntilChanged()
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
        if (requireWarningReview()) return

        const warpRows = trimLayerLabels(state.warpRows)
        const weftRows = trimLayerLabels(state.weftRows)

        setSavingTemplate(true)
        const res = await updateFabricTemplate({
            id:               appliedTemplate.id,
            expectedUpdatedAt: appliedTemplate.updated_at,
            // A Saved Quality keeps its identity. A different construction is
            // saved with "Save as New Quality" instead of being renamed here.
            name:             appliedTemplate.name,
            warpRows,
            weftRows,
            tapeLengthM:      state.tapeLengthM,
            warpCrimpPct:     state.warpCrimpPct,
            perPickCostPaisa: state.perPickCostPaisa,
            yarnShortagePct:  state.yarnShortagePct,
            overheadMode:     state.overheadMode,
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
                updated_at: res.updatedAt ?? appliedTemplate.updated_at,
            })
            toast.success('noChange' in res && res.noChange
                ? t('estimator.sprint1.quality_no_change')
                : t('estimator.sprint1.quality_updated_no_snapshot'))
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
        setSourceQuoteVersionNumber(null)
        setSourceQuoteCreatedAt(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        clearDraft()
        suppressAutosaveUntilChanged()
        setShowValidation(false)
        setDismissedWarnings([])
        setAcknowledgedWarningKey(null)
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
        const expectedUpdatedAt = editRatesTpl.updated_at

        // Update rates only. The quality name is an identity and is not edited
        // from this dialog; use "Save as New Quality" for a new construction.
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
            template: refreshed ?? { ...editRatesTpl, warp_rows: updatedWarp, weft_rows: updatedWeft, updated_at: res.updatedAt ?? expectedUpdatedAt }
        })
        setAppliedTemplate(refreshed ?? { ...editRatesTpl, warp_rows: updatedWarp, weft_rows: updatedWeft, updated_at: res.updatedAt ?? expectedUpdatedAt })
        setQualityLabel(editRatesTpl.name)
        setSourceQuoteId(null)
        setSourceQuoteUpdatedAt(null)
        setSourceQuoteVersionNumber(null)
        setSourceQuoteCreatedAt(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        setEditRatesTpl(null)
        toast.success('noChange' in res && res.noChange
            ? t('estimator.sprint1.quality_no_change')
            : t('estimator.sprint1.rates_updated_no_snapshot'))
    }

    /** Apply template directly (without editing rates). */
    const handleApplyCurrentRates = () => {
        if (!editRatesTpl) return
        dispatch({ type: 'APPLY_TEMPLATE', template: editRatesTpl })
        setAppliedTemplate(editRatesTpl)
        setQualityLabel(editRatesTpl.name)
        setSourceQuoteId(null)
        setSourceQuoteUpdatedAt(null)
        setSourceQuoteVersionNumber(null)
        setSourceQuoteCreatedAt(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        setEditRatesTpl(null)
        toast.success(`${t('estimator.toast.applied_as_is')} ${editRatesTpl.name}`)
    }

    const handleRenameTemplate = async () => {
        if (!renameTpl) return
        setRenamingTpl(true)
        setRenameError(null)
        const res = await renameTemplate(renameTpl.id, renameValue, renameTpl.updated_at)
        setRenamingTpl(false)
        if (res.error) {
            setRenameError(res.error)
            return
        }
        const normalizedName = renameValue.trim().replace(/\s+/g, ' ')
        const refreshed = { ...renameTpl, name: normalizedName, updated_at: res.updatedAt ?? renameTpl.updated_at }
        setTemplates(previous => previous.map(template => template.id === renameTpl.id ? refreshed : template))
        if (appliedTemplate?.id === renameTpl.id) {
            setAppliedTemplate(refreshed)
            setQualityLabel(normalizedName)
        }
        setRenameTpl(null)
        toast.success('noChange' in res && res.noChange
            ? t('estimator.sprint1.quality_no_change')
            : t('estimator.sprint1.quality_name_corrected'))
    }

    const handleArchiveTemplate = async (template: EstimatorTemplate) => {
        setDeletingTpl(template.id)
        const res = await archiveTemplate(template.id, template.updated_at)
        setDeletingTpl(null)
        if (res.error) { toast.error(res.error); return }
        setTemplates(prev => prev.filter(t => t.id !== template.id))
        if (appliedTemplate?.id === template.id) setAppliedTemplate(null)
        toast.success('Quality archived. It remains available in History and can be restored.')
    }

    const handleSaveQuote = async (
        targetMode: 'quote' | 'market' = mode,
        status: 'draft' | 'accepted' = 'draft',
        staleRatesAcknowledged = false,
        recordKindOverride?: 'costing' | 'quotation',
        qualityUpdateDecision?: 'version_only' | 'version_and_quality',
    ) => {
        if (saveQuoteLockRef.current || savingQuote) return
        setShowValidation(true)
        const saveAsStandaloneCosting = isStandaloneCostingSession || recordKindOverride === 'costing'
        const effectiveTargetMode = saveAsStandaloneCosting ? 'quote' : targetMode
        if (firstEstimatorValidationMessage) {
            return toast.error(firstEstimatorValidationMessage)
        }
        if (requireWarningReview()) return
        if (!saveAsStandaloneCosting && canUseProduction && effectiveTargetMode === 'quote' && !allowsPartyOrders) {
            return toast.error('Party quotations are unavailable in Market Run only mode')
        }
        if (effectiveTargetMode === 'market' && !allowsMarketRuns) {
            return toast.error('Market Runs are unavailable in Order-Based only mode')
        }

        const resolvedPartyName = effectiveTargetMode === 'market'
            ? (qualityLabel.trim() || partyName.trim())
            : saveAsStandaloneCosting
                ? (partyName.trim() || null)
                : partyName.trim()

        if (!saveAsStandaloneCosting && !resolvedPartyName) {
            return toast.error(effectiveTargetMode === 'market' ? 'Fabric Label is required' : t('estimator.toast.party_required'))
        }
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (!saveAsStandaloneCosting && (!state.orderQuantityM || state.orderQuantityM <= 0)) {
            return toast.error('Set a quantity before saving')
        }
        if (staleDefaultRateNames.length > 0 && !staleRatesAcknowledged) {
            setPendingStaleRateSave({ targetMode, status, recordKindOverride })
            return
        }

        const shouldOfferSavedQualityUpdate = effectiveTargetMode === 'quote'
            && saveAsStandaloneCosting
            && Boolean(appliedTemplate)
            && hasSavedQualityRecipeChanges(appliedTemplate!, state)

        if (shouldOfferSavedQualityUpdate && !qualityUpdateDecision) {
            setPendingQualityVersionSave({ targetMode, status, recordKindOverride })
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
                const targetMeters = state.orderQuantityM
                if (!targetMeters || targetMeters <= 0) {
                    toast.error('Set a quantity before saving')
                    return
                }
                const res = await createMarketRunFromEstimator({
                    fabricLabel:             resolvedPartyName ?? '',
                    qualityLabel:            qualityLabel.trim(),
                    warpInstruction:         warpInstruction.trim() || undefined,
                    weftInstruction:         weftInstruction.trim() || undefined,
                    targetMeters,
                    estimate:                state,
                    totalProductionCostPerM: costingResult.productionCostPerM,
                    notes:                   '',
                    deadline:                new Date(new Date().getTime() + 30 * 86400000).toISOString().split('T')[0], // 30 days default
                    templateId:              appliedTemplate?.id,
                })
                if (res.error) {
                    toast.error(res.error)
                } else {
                    clearDraft()
                    suppressAutosaveUntilChanged()
                    setSourceQuoteId(null)
                    setSourceQuoteUpdatedAt(null)
                    setSourceQuoteVersionNumber(null)
                    setSourceQuoteCreatedAt(null)
                    setSourceFactoryProfileUpdatedAt(null)
                    setSourceRecordKind(null)
                    quoteRequestIdRef.current = null
                    toast.success('Market Run started and costing saved')
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
                    quotePricePerM:          costingResult.suggestedSellingPricePerM,
                    totalProductionCostPerM: costingResult.productionCostPerM,
                    status:                  status,
                    recordKind:              saveAsStandaloneCosting ? 'costing' : 'quotation',
                    sourceQuoteId:           sourceQuoteId ?? undefined,
                    expectedSourceUpdatedAt: sourceQuoteUpdatedAt ?? undefined,
                    templateId:              appliedTemplate?.id,
                    expectedTemplateUpdatedAt: appliedTemplate?.updated_at,
                    // Reopening a historical Cost Estimate keeps the
                    // baseline provenance that belongs to its inputs. A
                    // changed factory default is for future estimates; it
                    // must not make an edited old estimate look as though
                    // the new default supplied all of its numbers.
                    factoryProfileUpdatedAt: (sourceQuoteId
                        ? sourceFactoryProfileUpdatedAt ?? factoryBaselineUpdatedAt
                        : factoryBaselineUpdatedAt) ?? undefined,
                    updateSavedQuality: qualityUpdateDecision === 'version_and_quality',
                })
                if (res.success) {
                    const wasEditingCosting = Boolean(sourceQuoteId)
                    if (resolvedPartyName) {
                        setPartyNames(current => {
                            if (current.some(name => name.toLocaleLowerCase('en-IN') === resolvedPartyName.toLocaleLowerCase('en-IN'))) {
                                return current
                            }
                            return [resolvedPartyName, ...current].slice(0, 25)
                        })
                    }
                    clearDraft()
                    suppressAutosaveUntilChanged()
                    setSourceQuoteId(null)
                    setSourceQuoteUpdatedAt(null)
                    setSourceQuoteVersionNumber(null)
                    setSourceQuoteCreatedAt(null)
                    setSourceFactoryProfileUpdatedAt(null)
                    setSourceRecordKind(null)
                    quoteRequestIdRef.current = null
                    toast.success(!saveAsStandaloneCosting
                        ? (status === 'accepted' ? 'Quotation saved and accepted!' : t('estimator.toast.converted_success'))
                        : ('noChange' in res && res.noChange)
                            ? t('estimator.sprint1.costing_no_change', { version: String(('versionNumber' in res && res.versionNumber) || 1) })
                            : (qualityUpdateDecision === 'version_and_quality'
                                ? `${wasEditingCosting ? 'New costing version' : 'Costing'} saved and Saved Quality updated`
                                : (wasEditingCosting ? 'New costing version saved' : 'Costing saved')))
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
        setShowValidation(true)
        if (firstEstimatorValidationMessage) return toast.error(firstEstimatorValidationMessage)
        if (requireWarningReview()) return
        if (!partyName.trim()) return toast.error(t('estimator.toast.party_required'))
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (!state.orderQuantityM || state.orderQuantityM <= 0) {
            return toast.error('Set a quantity before starting the order')
        }

        const quotePricePerM = costingResult.suggestedSellingPricePerM
        if (!quotePricePerM || quotePricePerM <= 0 || costingResult.productionCostPerM <= 0) {
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
                costPerM: costingResult.productionCostPerM,
            })

            if ('error' in result) {
                toast.error(result.error ?? 'Failed to start party order')
                return
            }

            clearDraft()
            suppressAutosaveUntilChanged()
            setSourceQuoteId(null)
            setSourceQuoteUpdatedAt(null)
            setSourceQuoteVersionNumber(null)
            setSourceQuoteCreatedAt(null)
            setSourceFactoryProfileUpdatedAt(null)
            setSourceRecordKind(null)
            quoteRequestIdRef.current = null
            toast.success('Party order started and costing saved')
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
    const showPartyField = canUseProduction && !isStandaloneCostingSession && mode !== 'market'
    const requiresCommercialContext = !isStandaloneCostingSession

    // Validation: Pilot Safety Rails
    const isZeroConfig = state.overheadMode === 'monthly_expenses'
        && state.overheadItems.filter(i => i.isPreset).every(i => (i.monthlyAmount || 0) === 0)
    const pageShellClass = "w-full px-4 sm:px-6 lg:px-0"
    const hudShellClass = "w-full rounded-[18px] border border-[var(--color-hairline)] bg-white/95 px-4 py-4 shadow-[0_14px_40px_rgba(30,37,40,0.10)] backdrop-blur sm:px-5"
    const postProcessingCostPerM = totals.windingPerM + totals.processingPerM + totals.finishingPerM
    const displayMarginPct = estimatorValidation.valid
        && hasOrderQty
        && orderQuote?.isValid
        && Number.isFinite(costingResult.actualMarginPct)
        ? costingResult.actualMarginPct
        : null
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
    const yarnGroupTotals = {
        warp: {
            blendCount: totals.audit.warp.layers.length,
            base: totals.yarnBaseWarpPerM,
            adjustment: Math.max(0, totals.audit.warp.totalCostPerMeter - totals.yarnBaseWarpPerM),
            adjusted: totals.audit.warp.totalCostPerMeter,
        },
        weft: {
            blendCount: totals.audit.weft.layers.length,
            base: totals.yarnBaseWeftPerM,
            adjustment: Math.max(0, totals.audit.weft.totalCostPerMeter - totals.yarnBaseWeftPerM),
            adjusted: totals.audit.weft.totalCostPerMeter,
        },
    }
    const auditCostLines = [
        { label: 'Adjusted warp yarn', value: totals.audit.warp.totalCostPerMeter },
        { label: 'Adjusted weft yarn', value: totals.audit.weft.totalCostPerMeter },
        { label: 'Weave / loom', value: totals.audit.weaveCostPerMeter },
        { label: 'Warping + sizing', value: totals.audit.warpingAndSizingCostPerMeter },
        { label: 'Post-processing', value: totals.audit.postProcessingCostPerMeter },
        { label: 'Factory expenses / other', value: totals.audit.overheadCostPerMeter },
    ].filter(line => line.value > 0)
    return (
        <div className="estimator-mobile-form space-y-5 pb-floating-button md:pb-20 relative">
            {!state.isConfigured && (
                <FactoryCostWizard 
                    initialState={state}
                    initialYarnReviewIntervalDays={Number(initialProfile?.yarn_review_interval_days ?? 90)}
                    saving={saving}
                    onComplete={async (data) => {
                        setSaving(true)
                        try {
                            // Map camelCase EstimateState keys to snake_case DB keys.
                            const res = await upsertFactoryCostProfile({
                                warping_rate_per_kg:     data.warpingRatePerKg ?? state.warpingRatePerKg,
                                sizing_rate_per_kg:      data.sizingRatePerKg ?? state.sizingRatePerKg,
                                winding_rate_per_kg:     data.windingRatePerKg ?? state.windingRatePerKg,
                                overhead_mode:          data.overheadMode ?? state.overheadMode,
                                factory_profile_key:    data.factoryProfileKey,
                                default_commission_pct:  data.commissionPct ?? state.commissionPct,
                                default_margin_pct:      data.profitPct ?? state.profitPct,
                                default_transport_per_m: data.transportPerM ?? state.transportPerM,
                                yarn_review_interval_days: data.yarnReviewIntervalDays,
                                default_processing_rate_per_m: data.processingRatePerM ?? state.processingRatePerM,
                                default_finishing_rate_per_m: data.finishingRatePerM ?? state.finishingRatePerM,
                                enabled_sections:        data.enabledSections ?? state.enabledSections,
                                yarn_shortage_pct:       data.yarnShortagePct ?? state.yarnShortagePct,
                                warp_crimp_pct:          data.warpCrimpPct ?? state.warpCrimpPct,
                                // Overridden by wizard data
                                overhead_items:          data.overheadItems ?? state.overheadItems,
                                monthly_output_m:        data.monthlyOutputM ?? state.monthlyOutputM,
                                overhead_override_per_m: data.overheadMode === 'monthly_expenses'
                                    ? null
                                    : data.overheadOverridePerM !== undefined
                                        ? data.overheadOverridePerM
                                        : state.overheadOverridePerM,
                                loom_count:              data.loomCount ?? state.loomCount,
                                monthly_working_days:    data.monthlyWorkingDays ?? state.monthlyWorkingDays,
                                avg_output_per_loom_per_day: data.avgOutputPerLoomPerDay ?? state.avgOutputPerLoomPerDay,
                                is_configured:           true,
                                expectedUpdatedAt:       factoryBaselineUpdatedAt ?? undefined,
                            })
                            if (res.success) {
                                // Update local state and close wizard.
                                Object.entries(data).filter(([key]) => key !== 'yarnReviewIntervalDays' && key !== 'factoryProfileKey').forEach(([key, val]) => {
                                    dispatch({ type: 'SET', field: key as keyof EstimateStatePatch, value: val as EstimateStateValue })
                                })
                                dispatch({ type: 'SET', field: 'isConfigured', value: true })
                                setFactoryBaselineUpdatedAt(res.updatedAt ?? factoryBaselineUpdatedAt)
                                toast.success('Factory costing saved for new Cost Estimates')
                            } else {
                                toast.error(res.error || 'The factory costing could not be saved. Try again.')
                            }
                        } catch {
                            toast.error('The factory costing could not be saved. Try again.')
                        } finally {
                            setSaving(false)
                        }
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
                                    {draft.sourceRecordKind === 'costing' && draft.sourceQuoteVersionNumber && (
                                        <span className="ml-1 text-amber-700">· Editing costing v{draft.sourceQuoteVersionNumber}</span>
                                    )}
                                    {draft.sourceRecordKind === 'costing' && draft.sourceQuoteCreatedAt && (
                                        <span className="ml-1 text-amber-600">· saved {new Date(draft.sourceQuoteCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    )}
                                    {canUseProduction && draft.sourceRecordKind !== 'costing' && ' — editable Quotations update in place; accepted Quotations create a linked version'}
                                    {draft.sourceRecordKind === 'costing' && ' — saving creates a new costing version without changing the original'}
                                </>
                            ) : (
                                <>
                                    <span className="font-bold">Unsaved Cost Estimate</span> from{' '}
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
                            onClick={() => setShowDiscardDraft(true)}
                            className="ml-1 text-amber-500 hover:text-amber-700"
                            aria-label="Dismiss unsaved Cost Estimate draft"
                        ><X className="h-4 w-4" /></button>
                    </div>
                </div>
            )}

            {showValidation && estimatorWarnings.length > 0 && (
                <div className={`${pageShellClass} mb-2`}>
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold">Review unusual values before saving</p>
                                <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-amber-800">
                                    {estimatorWarnings.slice(0, 4).map(warning => (
                                        <li key={`${warning.field}:${warning.message}`}>{warning.message}</li>
                                    ))}
                                </ul>
                                {estimatorWarnings.length > 4 && (
                                    <p className="mt-1 text-xs font-semibold text-amber-700">+{estimatorWarnings.length - 4} more unusual value(s)</p>
                                )}
                                <p className="mt-2 text-[11px] font-medium text-amber-700">Costing can be reviewed, but a save or quotation requires acknowledgement.</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
                                onClick={() => setShowWarningAcknowledgement(true)}
                            >
                                Review
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {showValidation && !estimatorValidation.valid && (
                <div id={validationSummaryId} className={`${pageShellClass} mb-2`} role="alert">
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-red-900">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                            <div className="min-w-0">
                                <p className="text-sm font-bold">Complete the highlighted inputs before saving</p>
                                <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-red-800">
                                    {estimatorValidation.issues.slice(0, 6).map(issue => (
                                        <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
                                    ))}
                                </ul>
                                {estimatorValidation.issues.length > 6 && (
                                    <p className="mt-1 text-xs font-semibold text-red-700">+{estimatorValidation.issues.length - 6} more input issue(s)</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── STICKY QUOTE COCKPIT ─────────────────────────────── */}
            <div className="sticky top-3 z-40 -mt-3 py-3">
                <div className={hudShellClass}>
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[var(--color-hairline)] pb-2 text-[11px] text-[var(--color-muted)]">
                        <span className="font-semibold uppercase tracking-[0.08em] text-[var(--color-body)]">{t('estimator.sprint1.active_record')}</span>
                        <span>{t('estimator.sprint1.quality')}: <strong className="text-[var(--color-ink)]">{appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}</strong></span>
                        {sourceQuoteId && sourceRecordKind === 'costing' && (
                            <span>{t('estimator.sprint1.costing')}: <strong className="text-[var(--color-ink)]">v{sourceQuoteVersionNumber ?? 1}</strong>{sourceQuoteCreatedAt ? ` · ${new Date(sourceQuoteCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                        )}
                        {sourceQuoteId && sourceRecordKind === 'costing' && !sourceFactoryProfileUpdatedAt ? (
                            <span>{t('estimator.sprint1.baseline_not_recorded')}</span>
                        ) : sourceFactoryProfileUpdatedAt ? (
                            <span>{t('estimator.sprint1.baseline_captured')}: <strong className="text-[var(--color-ink)]">{new Date(sourceFactoryProfileUpdatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong></span>
                        ) : (
                            <span>{t('estimator.sprint1.baseline_current')}</span>
                        )}
                        {!sourceQuoteId && <span>{t('estimator.sprint1.new_costing_snapshot')}</span>}
                        <div className="ml-auto flex items-center gap-1 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5" role="tablist" aria-label="Estimator entry mode">
                            <button type="button" role="tab" aria-selected={entryMode === 'quick'} onClick={() => setEntryMode('quick')} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${entryMode === 'quick' ? 'bg-white text-[var(--color-yarn-orange-dark)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>Quick</button>
                            <button type="button" role="tab" aria-selected={entryMode === 'detailed'} onClick={() => setEntryMode('detailed')} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${entryMode === 'detailed' ? 'bg-white text-[var(--color-yarn-orange-dark)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>Detailed</button>
                        </div>
                    </div>
                    <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
                        <div className="min-w-0 space-y-3">
                            <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:items-end 2xl:gap-1.5 ${canUseProduction ? 'xl:grid-cols-5' : 'xl:grid-cols-4'}`}>
                                <div className="min-w-0">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">{t('estimator.price_helpers.production_cost')}</p>
                                    <p className="font-mono text-[28px] font-semibold leading-none text-[var(--color-ink)] sm:text-[32px] 2xl:text-[22px]">
                                        {hasValidCostResult ? `₹${costingResult.productionCostPerM.toFixed(2)}` : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">per metre</p>
                                </div>
                                <div className="min-w-0">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">
                                        {mode === 'market' ? 'Target selling price' : t('estimator.price_helpers.suggested_selling_price')}
                                    </p>
                                    <p className="font-mono text-[28px] font-semibold leading-none text-[var(--color-yarn-orange)] sm:text-[32px] 2xl:text-[22px]">
                                        {hasValidCostResult && orderQuote?.isValid ? `₹${costingResult.suggestedSellingPricePerM.toFixed(2)}` : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">per metre</p>
                                </div>
                                <div className="min-w-0 rounded-[12px] border border-[#CDE5D3] bg-[var(--color-factory-green-soft)] px-3 py-2 2xl:px-2 2xl:py-1.5">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-factory-green)]">Actual margin</p>
                                    <p className="font-mono text-[28px] font-semibold leading-none text-[var(--color-factory-green)] 2xl:text-[20px]">
                                        {displayMarginPct === null ? '—' : `${displayMarginPct >= 0 ? '+' : ''}${displayMarginPct.toFixed(1)}%`}
                                    </p>
                                </div>
                                <div className="min-w-0 border-l-0 border-[var(--color-hairline)] xl:border-l xl:pl-4 2xl:pl-2">
                                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">{t('estimator.price_helpers.break_even')}</p>
                                    <p className="font-mono text-[24px] font-semibold leading-none text-[var(--color-ink)] 2xl:text-[20px]">
                                        {hasValidCostResult && breakEvenScenario?.quotePricePerM != null
                                            ? `₹${costingResult.breakEvenPricePerM.toFixed(2)}`
                                            : '—'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">{t('estimator.price_helpers.break_even_hint')}</p>
                                </div>
                                {hasOrderQty && (
                                    <div className="min-w-0 border-l-0 border-[var(--color-hairline)] xl:border-l xl:pl-4 2xl:pl-2">
                                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Expected profit</p>
                                        <p className="font-mono text-[24px] font-semibold leading-none text-[var(--color-factory-green)] 2xl:text-[20px]">
                                            {hasValidCostResult && orderQuote?.isValid
                                                ? `₹${(costingResult.expectedProfitTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : '—'}
                                        </p>
                                        <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">
                                            {hasOrderQty ? `for ${Number(state.orderQuantityM).toLocaleString('en-IN')} m` : 'set costing quantity'}
                                        </p>
                                    </div>
                                )}
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

                                    {/* Base keeps costing as the primary action; Full Suite retains quote acceptance styling. */}
                                    <Button
                                        id="btn-save-accept"
                                        size="sm"
                                        variant={isStandaloneCostingSession ? 'default' : 'outline'}
                                        className={isStandaloneCostingSession
                                            ? 'col-span-2 h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] sm:col-span-1'
                                            : 'h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]'}
                                        onClick={() => handleSaveQuote('quote', isStandaloneCostingSession ? 'draft' : 'accepted')}
                                        disabled={savingQuote || !estimatorValidation.valid || (requiresCommercialContext && !hasOrderQty) || (requiresCommercialContext && !partyName.trim()) || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || (requiresCommercialContext && !orderQuote?.isValid)}
                                        aria-describedby={!estimatorValidation.valid ? validationSummaryId : undefined}
                                        title={firstEstimatorValidationMessage ?? (((requiresCommercialContext && !hasOrderQty) || (requiresCommercialContext && !partyName.trim()) || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || (requiresCommercialContext && !orderQuote?.isValid))
                                            ? (requiresCommercialContext ? 'Complete customer, quality, quantity, and cost result first.' : 'Complete quality and cost inputs first.')
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
                                            aria-describedby={!exportModel ? 'export-cost-sheet-hint' : undefined}
                                            title={exportModel ? 'Create an internal cost sheet or customer quotation' : 'Correct the highlighted inputs before exporting'}
                                        >
                                            <FileDown className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">Export Cost Sheet</span>
                                        </Button>
                                    )}

                                    {isStandaloneCostingSession && !exportModel && (
                                        <p id="export-cost-sheet-hint" className="col-span-2 text-xs font-medium leading-relaxed text-amber-700 sm:col-span-1">
                                            Complete the highlighted inputs before creating an Internal Cost Sheet or Customer Quotation.
                                        </p>
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
                                        <span className="truncate">Update Saved Quality</span>
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            // A copy starts a new template and costing lineage. Keep
                                            // the loaded recipe, but detach every source identity.
                                            setTemplateName(`${appliedTemplate.name} - New`)
                                            setAppliedTemplate(null)
                                            setSourceQuoteId(null)
                                            setSourceQuoteUpdatedAt(null)
                                            setSourceQuoteVersionNumber(null)
                                            setSourceQuoteCreatedAt(null)
                                            setSourceFactoryProfileUpdatedAt(null)
                                            setSourceRecordKind(null)
                                            quoteRequestIdRef.current = null
                                            setTemplateSaveError(null)
                                            setShowSaveTemplate(true)
                                        }}
                                        className="h-12 px-3 text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                                        title="Use this saved quality as the starting point for a new one"
                                        aria-label={`Start from ${appliedTemplate.name}`}
                                    >
                                        <BookmarkPlus className="mr-1.5 h-4 w-4" />
                                        Start From
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

                    {(!canUseProduction || hasOrderQty) && orderQuote && (
                        <div className="mt-4 flex items-center gap-3 border-t border-[var(--color-hairline)] pt-3">
                            <div className="shrink-0">
                                <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('estimator.hud.margin')}</p>
                            </div>
                            <input
                                type="range"
                                min={0} max={100} step={0.5}
                                value={state.profitPct}
                                onChange={e => dispatch({ type: 'SET', field: 'profitPct', value: parseNonNegativeInput(e.target.value) ?? 0 })}
                                className="h-5 flex-1 modern-slider"
                            />
                            <p className="shrink-0 text-sm font-semibold text-[var(--color-yarn-orange)]">{state.profitPct.toFixed(1)}%</p>
                            {hasOrderQty && (
                                <>
                                    <div className="h-6 w-px bg-[var(--color-hairline)]" />
                                    <div className="shrink-0 text-right">
                                        <p className="text-[11px] font-semibold text-[var(--color-muted)]">{t('estimator.hud.net_profit')}</p>
                                        <p className="text-sm font-semibold leading-none text-[var(--color-factory-green)]">
                                            ₹{(costingResult.expectedProfitTotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ── MAIN FORM ────────────────────────────────────────────── */}
            <div className={`${pageShellClass} space-y-7`}>
                {/* Saved Qualities Row */}
                {templates.length > 0 && (
                    <section className="overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-white/95 shadow-[0_8px_24px_rgba(30,37,40,0.055)]">
                        <div className="flex items-start gap-3 border-b border-[var(--color-hairline)] bg-gradient-to-r from-[var(--color-warning-amber-soft)]/65 to-white px-4 py-3.5 sm:px-5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-yarn-orange)]/20 bg-white text-[var(--color-yarn-orange)] shadow-[0_2px_8px_rgba(217,107,28,0.10)]">
                                <History className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-baseline gap-3">
                                    <h2 className="text-[15px] font-semibold leading-5 text-[var(--color-ink)]">{t('estimator.quality.myQualities')}</h2>
                                    <span className="ml-auto hidden text-[11px] font-medium text-[var(--color-muted)] sm:inline">{t('estimator.quality.hint')}</span>
                                </div>
                                <p className="mt-0.5 text-xs font-medium leading-5 text-[var(--color-body)]/75">{t('estimator.quality.myQualitiesHelper')}</p>
                            </div>
                        </div>
                        <div className="space-y-3 px-4 py-4 sm:px-5">
                        {/* Search — only shown when there are more than 5 qualities */}
                        {templates.length > 5 && (
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                                <input
                                    type="text"
                                    value={templateSearch}
                                    onChange={e => setTemplateSearch(e.target.value)}
                                    placeholder={t('estimator.quality.searchPlaceholder').replace('{count}', String(templates.length))}
                                    className="h-10 w-full rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-10 pr-9 text-[13px] font-medium text-[var(--color-ink)] placeholder:font-normal placeholder:text-[var(--color-muted)] focus:border-[var(--color-yarn-orange)] focus:outline-none focus:ring-2 focus:ring-[var(--color-yarn-orange)]/15"
                                />
                                {templateSearch && (
                                    <button
                                        onClick={() => setTemplateSearch('')}
                                        className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                                        aria-label="Clear quality search"
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
                        <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 snap-x">
                             <Button
                                size="sm"
                                onClick={() => {
                                    openSaveTemplateDialog()
                                }}
                                className="h-10 shrink-0 snap-start rounded-[10px] bg-[var(--color-yarn-orange)] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(217,107,28,0.22)] hover:bg-[var(--color-yarn-orange-dark)]"
                             >
                                <Save className="h-4 w-4" />
                                {t('estimator.quality.saveCurrentAsQuality')}
                             </Button>

                             <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                    setShowConfirmNewQuality(true)
                                }}
                                className="h-10 shrink-0 snap-start rounded-[10px] border border-[var(--color-hairline-strong)] bg-white px-4 text-[13px] font-semibold text-[var(--color-body)] shadow-[0_1px_3px_rgba(30,37,40,0.04)] hover:border-[var(--color-yarn-orange)] hover:bg-[var(--color-warning-amber-soft)] hover:text-[var(--color-yarn-orange-dark)]"
                             >
                                <Plus className="h-4 w-4" />
                                {t('estimator.quality.newQuality')}
                             </Button>
                            {filteredTemplates.map(tpl => {
                                const isActive = appliedTemplate?.id === tpl.id || (!tpl.id && qualityLabel === tpl.name);
                                return (
                                    <div
                                        key={tpl.id}
                                        className={`group flex h-10 shrink-0 snap-start items-stretch overflow-hidden rounded-[10px] border shadow-[0_1px_3px_rgba(30,37,40,0.04)] transition-colors ${
                                            isActive
                                                ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)]'
                                                : 'border-[var(--color-hairline)] bg-white hover:border-[var(--color-hairline-strong)]'
                                        }`}
                                    >
                                        <button
                                            onClick={() => applyTemplate(tpl)}
                                            onContextMenu={e => { e.preventDefault(); openEditRates(tpl) }}
                                            className={`min-w-28 px-4 text-left text-[13px] font-semibold transition-colors ${
                                                isActive ? 'text-[var(--color-yarn-orange-dark)]' : 'text-[var(--color-body)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            {tpl.name}
                                        </button>
                                        <div className={`flex items-center gap-0.5 border-l px-1 ${isActive ? 'border-[var(--color-yarn-orange)]/25' : 'border-[var(--color-hairline)]'}`}>
                                            <button
                                                onClick={e => { e.stopPropagation(); openEditRates(tpl) }}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-yarn-orange-dark)]"
                                                title={t('estimator.quality.editRatesTitle')}
                                                aria-label={`${t('estimator.quality.editRatesTitle')}: ${tpl.name}`}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            </button>
                                            <button
                                                onClick={e => { e.stopPropagation(); setRenameTpl(tpl); setRenameValue(tpl.name); setRenameError(null) }}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-yarn-orange-dark)]"
                                                title="Rename quality"
                                                aria-label={`Rename quality: ${tpl.name}`}
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={e => {
                                                    e.stopPropagation();
                                                    setTemplateToArchive(tpl)
                                                }}
                                                disabled={deletingTpl === tpl.id}
                                                className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                                                title="Archive quality"
                                                aria-label={`Archive quality: ${tpl.name}`}
                                            >
                                                {deletingTpl === tpl.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
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
                    </section>
                )}

                {entryMode === 'quick' ? (
                    <QuickCostingView
                        state={state}
                        dispatch={dispatch}
                        totals={totals}
                        hasValidCostResult={hasValidCostResult}
                        qualityLabel={qualityLabel}
                        setQualityLabel={setQualityLabel}
                        qualityLocked={Boolean(appliedTemplate)}
                        canUseProduction={canUseProduction}
                        widthUnit={widthUnit}
                        onWidthUnitChange={setWidthUnit}
                        onOpenDetailed={() => setEntryMode('detailed')}
                        onOpenOverheadDetails={() => {
                            setEntryMode('detailed')
                            setShowAdvancedOverhead(true)
                        }}
                        onOverheadModeChange={handleOverheadModeChange}
                        onSuggestOutput={handleSuggestOutput}
                    />
                ) : (
                <>
                {/* 1. Costing Basics */}
                <EstimatorCard accent="neutral">
                    <SectionHeader title={t('estimator.order_basics.title')} icon={Layers} accent="neutral" step={1} />
                    <CardContent className="p-4 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Customer is quotation context only. Standalone Base costings are quality-first. */}
                            {showPartyField && (
                                <div className="space-y-1.5">
                                    <Label className="text-[10px] uppercase font-bold text-slate-500">
                                        {t('estimator.order_basics.party')}
                                    </Label>
                                    <Input
                                        list="estimator-party-options"
                                        value={partyName}
                                        onChange={e => setPartyName(e.target.value)}
                                        placeholder="e.g. Sundaram Textiles"
                                        className="font-bold border-slate-200 h-11"
                                    />
                                    <datalist id="estimator-party-options">
                                        {partyNames.map(name => <option key={name} value={name} />)}
                                    </datalist>
                                    <p className="text-[10px] text-slate-400 font-medium leading-normal">
                                        Select a recent customer or type a new one.
                                    </p>
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
                            <div className={mode === 'market' || !showPartyField ? "col-span-1 md:col-span-2 space-y-1.5" : "space-y-1.5"}>
                                <Label className="text-[10px] uppercase font-bold text-slate-500">
                                    {t('estimator.order_basics.fabric_quality_name')}
                                </Label>
                                <Input
                                    value={qualityLabel}
                                    readOnly={Boolean(appliedTemplate)}
                                    aria-readonly={appliedTemplate ? 'true' : undefined}
                                    title={appliedTemplate ? t('estimator.sprint1.saved_quality_name_stable') : undefined}
                                    onChange={e => {
                                        if (appliedTemplate) return
                                        const val = e.target.value
                                        setQualityLabel(val)
                                        if (mode === 'market') {
                                            setPartyName(val)
                                        }
                                    }}
                                    placeholder="e.g. 60g Georgette, D.246, Japan Satin"
                                    className="font-bold border-slate-200 h-11"
                                />
                                <p className="text-[10px] text-slate-400 font-medium leading-normal">
                                    {appliedTemplate ? t('estimator.sprint1.saved_quality_name_stable') : t('estimator.quality.fabricQualityNameHelper')}
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
                        badgeContent={<SectionCostPill value={totals.warpCostPerM} valid={hasValidCostResult} />}
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
                        {/* Beam planning only applies to production-enabled plans with order quantities. */}
                        {canUseProduction && (() => {
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
                                                attentionWhenEmpty
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
                                <SectionCostPill value={totals.weftCostPerM} valid={hasValidCostResult} />
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
                                const effectiveCostingWidthCm = getEffectiveCostingWidthCm(row)
                                const rawEffectiveWidth = widthUnit === 'inch' ? effectiveCostingWidthCm / 2.54 : effectiveCostingWidthCm
                                const effectiveWidthWarning = getWidthWarnings({
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
                                            label="Effective costing width"
                                            value={effectiveCostingWidthCm}
                                            onChange={v => {
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value: v })
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: v })
                                            }}
                                            unit={widthUnit}
                                            hint={row.calculationMode === 'manual' ? 'Saved for audit; manual kg bypasses formula' : 'Used for weft yarn formula'}
                                            warning={effectiveWidthWarning}
                                            onUseInches={effectiveWidthWarning && widthUnit === 'cm'
                                                ? () => {
                                                    const inches = effectiveCostingWidthCm
                                                    const convertedCm = Number((inches * 2.54).toFixed(4))
                                                    dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value: convertedCm })
                                                    dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: convertedCm })
                                                }
                                                : undefined}
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
                    <SectionHeader title={t('estimator.weave.title')} icon={Gauge} accent="weave" step={4} badgeContent={<SectionCostPill value={totals.weaveCostPerM} valid={hasValidCostResult} />} />
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
                                    onSuggestOutput={handleSuggestOutput}
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
                                                        const wageNum = parseNonNegativeInput(raw)
                                                        if (wageNum !== null && wageNum > 0 && totalPicks > 0) {
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
                                                        const v = parseNonNegativeInput(e.target.value)
                                                        if (v === null) return
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
                    <SectionHeader title={t('estimator.warping_sizing.title')} icon={TrendingUp} accent="post" step={5} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} valid={hasValidCostResult} />} />
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

                {/* 5b. Factory Expenses — Itemized Breakdown */}
                <EstimatorCard accent="overhead">
                    <SectionHeader
                        title={t('estimator.overhead.title')}
                        icon={Calculator}
                        accent="overhead"
                        step={6}
                        badgeContent={
                            <div className="flex items-center gap-2">
                                <SectionCostPill value={totals.overheadPerM} valid={hasValidCostResult} />
                            </div>
                        }
                    />
                    <CardContent className="p-5 sm:p-6 space-y-6">
                        {/* Overhead method — the calculation engine remains shared. */}
                        <div className="space-y-3">
                            <div>
                                <h4 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)] leading-none">How should factory expenses be calculated?</h4>
                                <p className="mt-1 text-[11px] text-[var(--color-muted)]">This changes the current Cost Estimate. Save separately if you want it used for new Cost Estimates.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                <button type="button" aria-pressed={state.overheadMode === 'direct'} onClick={() => handleOverheadModeChange('direct')} className={`rounded-[10px] border px-3 py-3 text-left transition-colors ${state.overheadMode === 'direct' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)] ring-1 ring-[var(--color-yarn-orange)]/20' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-hairline-strong)]'}`}>
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">I know my factory cost per metre</p>
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">Use one trusted ₹/m factory rate.</p>
                                </button>
                                <button type="button" aria-pressed={state.overheadMode === 'monthly_expenses'} onClick={() => handleOverheadModeChange('monthly_expenses')} className={`rounded-[10px] border px-3 py-3 text-left transition-colors ${state.overheadMode === 'monthly_expenses' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)] ring-1 ring-[var(--color-yarn-orange)]/20' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-hairline-strong)]'}`}>
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Calculate from monthly expenses</p>
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">Use saved expenses and actual monthly output.</p>
                                </button>
                            </div>

                            {state.overheadMode === 'direct' ? (
                            <div className="rounded-[9px] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[13px] font-medium text-[var(--color-ink)]">Direct factory cost per metre (₹/m)</p>
                                                <p className="text-[11px] text-[var(--color-muted)]">Required when you choose a direct factory cost per metre.</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="relative w-full sm:w-[140px]">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--color-muted)] pointer-events-none">₹</span>
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        step={0.1}
                                                        placeholder="e.g. 12.50"
                                                        value={state.overheadOverridePerM ?? ''}
                                                        onChange={e => dispatch({ type: 'SET', field: 'overheadOverridePerM', value: parseNonNegativeInput(e.target.value) })}
                                                        className={`h-10 w-full rounded-[9px] bg-[var(--color-canvas-white)] pl-8 pr-4 text-sm font-medium [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${state.overheadOverridePerM == null || state.overheadOverridePerM <= 0 ? 'border-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)]'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {state.overheadOverridePerM != null && state.overheadOverridePerM < monthlyOverheadReference && (
                                            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-dashed border-[var(--color-hairline)]">
                                                <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
                                                <p className="text-[10px] font-bold text-amber-700 leading-tight">
                                                    Safety Alert: Direct rate (₹{state.overheadOverridePerM}) is LOWER than the monthly-expense reference (₹{monthlyOverheadReference.toFixed(2)}).
                                                    This costing will not recover ₹{(monthlyOverheadReference - state.overheadOverridePerM).toFixed(2)} per metre against that reference.
                                                </p>
                                            </div>
                                        )}
                                        {(state.overheadOverridePerM == null || state.overheadOverridePerM <= 0) && (
                                            <p className="mt-2 text-[10px] font-semibold text-[var(--color-warning-amber)]">Enter a rate greater than ₹0/m before saving.</p>
                                        )}
                                    </div>
                            ) : (
                                <div className="rounded-[9px] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3.5 py-3">
                                    <p className="text-[12px] font-medium text-[var(--color-ink)]">Monthly expenses are active</p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">Saved rent, power, salaries, and other expenses are divided by actual monthly output. Expand the section below to edit them.</p>
                                    <p className="mt-2 text-[11px] font-semibold text-[var(--color-factory-green)]">Current calculated overhead: ₹{totals.overheadPerM.toFixed(2)}/m</p>
                                </div>
                            )}
                        </div>

                        {state.overheadMode === 'direct' && (
                            <p className="rounded-md bg-[var(--color-surface-soft)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--color-muted)]">
                                The direct ₹/m rate is active for this costing. Monthly expenses below stay saved as a reference and will be used when you switch back to monthly-expense mode.
                            </p>
                        )}

                        {/* Advanced Settings Collapsible Toggle */}
                                        <div className="border-t border-[var(--color-hairline)] pt-4">
                                            <button
                                                type="button"
                                                onClick={() => setShowAdvancedOverhead(!showAdvancedOverhead)}
                                                className="flex items-center justify-between w-full rounded-lg bg-[var(--color-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-all"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Calculator className="h-3.5 w-3.5 text-[var(--color-yarn-orange)]" />
                                                    <span>Monthly expenses & capacity</span>
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
                                                            {t('estimator.sprint1.save_baseline')}
                                                        </Button>
                                                    </div>
                                                    <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">
                                                        {t('estimator.sprint1.baseline_future_only')}
                                                    </p>
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
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: parseNonNegativeInput(e.target.value) ?? 0 })}
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
                                                                                            onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { unitsPerLoomPerMonth: parseNonNegativeInput(e.target.value) ?? 0, type: 'electricity', mode: 'per_loom' } })}
                                                                                            className="h-6 text-[10px] font-mono font-bold px-1.5"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[8px] uppercase font-semibold text-slate-400">Rate/Unit</span>
                                                                                        <Input 
                                                                                            type="number" 
                                                                                            value={(item.meta as ElectricityMeta)?.ratePerUnit ?? 0} 
                                                                                            onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { ratePerUnit: parseNonNegativeInput(e.target.value) ?? 0, type: 'electricity', mode: 'per_loom' } })}
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
                                                                                        onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { avgCostPerLoom: parseNonNegativeInput(e.target.value) ?? 0, type: 'depreciation' } })}
                                                                                        className="h-7 text-[10px] font-mono font-bold pl-4 pr-1.5"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-[8px] uppercase font-semibold text-slate-400">Lifespan (Years)</span>
                                                                                <Input 
                                                                                    type="number" 
                                                                                    value={(item.meta as DepreciationMeta)?.usefulLifeYears ?? 10} 
                                                                                    onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { usefulLifeYears: parseNumericInput(e.target.value, { min: 1 }) ?? 1, type: 'depreciation' } })}
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
                                                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Output used for monthly overhead</p>
                                                        {/* Monthly Output & Suggestions */}
                                                        <div className="space-y-3">
                                                            <div className="space-y-1.5">
                                                                <div className="flex items-center justify-between">
                                                                    <Label className="text-[10px] font-medium uppercase text-[var(--color-muted)]">Actual monthly output (m)</Label>
                                                                    {canUseProduction && state.overheadMode === 'monthly_expenses' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={handleAutoSuggestOutput}
                                                                            disabled={isSuggestingOutput}
                                                                            className="h-5 px-2 text-[10px] font-medium text-[var(--color-yarn-orange)] hover:bg-[var(--color-surface-soft)]"
                                                                        >
                                                                            {isSuggestingOutput ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                                                                            Suggest from history
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <div className="relative">
                                                                    <Input
                                                                        type="number"
                                                                        value={state.monthlyOutputM}
                                                                        onChange={e => dispatch({ type: 'SET', field: 'monthlyOutputM', value: parseNonNegativeInput(e.target.value) ?? 0 })}
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
                                                                <p className="text-[10px] text-[var(--color-muted)]">{state.overheadMode === 'direct' ? 'Monthly-expense reference' : 'Rated capacity cost'}</p>
                                                            <p className="text-base font-semibold text-[var(--color-ink)]">₹{(state.overheadMode === 'direct' ? monthlyOverheadReference : totals.overheadPerMAtCapacity).toFixed(2)}/m</p>
                                                        </div>
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">Your actual cost</p>
                                                            <p className={`text-base font-semibold ${totals.overheadPerM > 0 ? 'text-[var(--color-factory-green)]' : 'text-[var(--color-ink)]'}`}>₹{totals.overheadPerM.toFixed(2)}/m</p>
                                                        </div>
                                                    </div>
                                                    {isZeroConfig && (
                                                        <p className="text-[11px] text-[var(--color-warning-amber)]">Factory expense items total is zero. Estimates may miss fixed cost recovery.</p>
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
                                                    <p className="text-[9px] text-amber-600 font-bold mt-0.5">⚡ direct rate selected</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 leading-none mb-1">Method</p>
                                                <p className="text-sm font-semibold text-slate-700 leading-tight">{state.overheadMode === 'direct' ? 'Direct rate' : 'Monthly expenses'}</p>
                                                <p className="text-[9px] text-slate-400 mt-0.5">{state.overheadMode === 'direct' ? 'saved ₹/m input' : 'saved expenses ÷ output'}</p>
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
                        detail={<p className="text-[11px] text-[var(--color-muted)]">{hasValidCostResult ? 'Engine audit used for the final production cost.' : 'Complete the required inputs to calculate the final production cost.'}</p>}
                        badgeContent={hasValidCostResult
                            ? <SectionCostPill value={totals.audit.productionCostPerMeter} />
                            : <span className="rounded-full border border-[#EFD7A4] bg-[var(--color-warning-amber-soft)] px-3 py-1 text-[13px] font-semibold text-[var(--color-warning-amber)]">Incomplete</span>}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        {!hasValidCostResult ? (
                            <div id={validationSummaryId} role={showValidation ? 'alert' : undefined} className={`flex items-start gap-3 rounded-[12px] border p-4 ${showValidation ? 'border-[#EFD7A4] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[var(--color-muted)]'}`}>
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <div>
                                    <p className="text-sm font-semibold">Costing incomplete</p>
                                    <p className="mt-1 text-xs font-medium leading-relaxed">{showValidation ? (firstEstimatorValidationMessage ?? 'Correct the highlighted inputs to see a reliable cost breakdown.') : 'Enter your fabric quality and yarn numbers to see a reliable cost breakdown.'}</p>
                                    <p className="mt-1 text-[11px] leading-relaxed">Draft values are not treated as a final result while a required input is blank or zero.</p>
                                </div>
                            </div>
                        ) : (
                        <>
                        <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)]">
                            <div className="hidden grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.9fr_0.8fr_0.8fr] gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] md:grid">
                                <span>Yarn</span>
                                <span>Mode</span>
                                <span>Base kg/100m</span>
                                <span>Adjust</span>
                                <span>Final kg/100m</span>
                                <span>Rate</span>
                                <span className="text-right">Adjusted cost</span>
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
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Adjusted yarn calculation</p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">Each section first adds all of its blends, then applies the relevant adjustment.</p>
                                </div>

                                <div className="mt-4 space-y-3">
                                    {([
                                        {
                                            label: 'Warp',
                                            note: 'wastage + crimp',
                                            totals: yarnGroupTotals.warp,
                                        },
                                        {
                                            label: 'Weft',
                                            note: 'wastage only',
                                            totals: yarnGroupTotals.weft,
                                        },
                                    ] as const).map(group => (
                                        <div key={group.label} className="rounded-[10px] border border-[var(--color-hairline)] bg-white p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div>
                                                    <p className="text-xs font-semibold text-[var(--color-ink)]">{group.label} yarn</p>
                                                    <p className="text-[10px] text-[var(--color-muted)]">{group.totals.blendCount} {group.totals.blendCount === 1 ? 'blend' : 'blends'} combined</p>
                                                </div>
                                                <p className="text-[10px] font-medium text-[var(--color-muted)]">{group.note}</p>
                                            </div>
                                            <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2">
                                                <div>
                                                    <p className="text-[9px] leading-tight text-[var(--color-muted)]">Base {group.label.toLowerCase()} total</p>
                                                    <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-ink)]">₹{group.totals.base.toFixed(2)}</p>
                                                </div>
                                                <span className="pb-0.5 text-sm font-semibold text-[var(--color-muted)]">+</span>
                                                <div>
                                                    <p className="text-[9px] leading-tight text-[var(--color-muted)]">{group.label === 'Warp' ? 'Waste + crimp' : 'Waste add-on'}</p>
                                                    <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-warning-amber)]">₹{group.totals.adjustment.toFixed(2)}</p>
                                                </div>
                                                <span className="pb-0.5 text-sm font-semibold text-[var(--color-muted)]">=</span>
                                                <div>
                                                    <p className="text-[9px] leading-tight text-[var(--color-muted)]">Adjusted {group.label.toLowerCase()}</p>
                                                    <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-factory-green)]">₹{group.totals.adjusted.toFixed(2)}/m</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-3 flex flex-col gap-2 rounded-[10px] border border-[#CDE5D3] bg-[var(--color-factory-green-soft)] p-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-factory-green)]">Final adjusted yarn rate</p>
                                        <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Adjusted warp ₹{yarnGroupTotals.warp.adjusted.toFixed(2)} + adjusted weft ₹{yarnGroupTotals.weft.adjusted.toFixed(2)}</p>
                                    </div>
                                    <p className="font-mono text-lg font-semibold text-[var(--color-factory-green)]">₹{totals.audit.yarnTotalCostPerMeter.toFixed(2)}/m</p>
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
                        </>
                        )}
                    </CardContent>
                </EstimatorCard>

                {/* 9. Quotation assumptions / Order simulation */}
                <EstimatorCard accent="weft">
                    <SectionHeader title={!canUseProduction ? t('estimator.simulation.base_title') : mode === 'market' ? t('estimator.simulation.market_title') : t('estimator.simulation.title')} icon={Coins} accent="weft" step={9} />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                            <NumField
                                label={mode === 'market' ? t('estimator.field_labels.market_target') : t('estimator.field_labels.simulation_qty')}
                                value={state.orderQuantityM}
                                onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: v })}
                                unit="m"
                                step={100}
                                placeholder="5000"
                                attentionWhenEmpty={requiresCommercialContext}
                                hint={requiresCommercialContext ? t('estimator.simulation.quantity_hint') : 'Optional for a saved costing; enter it when you want order-level profit.'}
                            />
                            {(!canUseProduction || hasOrderQty) && (
                                <>
                                    <NumField label={t('estimator.field_labels.broker_comm')} value={state.commissionPct} onChange={v => dispatch({ type: 'SET', field: 'commissionPct', value: v ?? 0 })} unit="%" step={0.5} />
                                    <NumField label={t('estimator.field_labels.transport_per_m')} value={state.transportPerM} onChange={v => dispatch({ type: 'SET', field: 'transportPerM', value: v ?? 0 })} unit="₹/m" step={0.1} />
                                </>
                            )}
                        </div>
                    </CardContent>
                </EstimatorCard>
                </>
                )}
            </div>

            {/* ── DIALOGS ────────────────────────────────────────────────── */}

            <CostingExportDialog
                open={showExportDialog}
                onOpenChange={setShowExportDialog}
                model={exportModel}
                defaultCustomerName={showPartyField ? partyName : ''}
                defaultBusinessName={organizationName}
                defaultMode={isStandaloneCostingSession ? 'internal' : 'customer'}
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

            <Dialog open={Boolean(pendingQualityVersionSave)} onOpenChange={open => { if (!open) setPendingQualityVersionSave(null) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <History className="h-5 w-5 text-[var(--color-yarn-orange)]" />
                            {t('estimator.sprint1.save_new_version')}
                        </DialogTitle>
                        <DialogDescription>
                            {t('estimator.sprint1.recipe_changed', { name: appliedTemplate?.name })}{' '}
                            {t('estimator.sprint1.version_explanation')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3 text-sm text-[var(--color-body)]">
                        <p className="font-semibold text-[var(--color-ink)]">
                            {sourceQuoteVersionNumber
                                ? t('estimator.sprint1.next_version', { version: sourceQuoteVersionNumber + 1 })
                                : t('estimator.sprint1.next_version_generic')}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[var(--color-muted)]">
                            {t('estimator.sprint1.future_quality_explanation')}
                        </p>
                    </div>
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" onClick={() => setPendingQualityVersionSave(null)}>
                            {t('estimator.sprint1.cancel')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const pending = pendingQualityVersionSave
                                setPendingQualityVersionSave(null)
                                if (pending) void handleSaveQuote(pending.targetMode, pending.status, true, pending.recordKindOverride, 'version_only')
                            }}
                        >
                            {t('estimator.sprint1.save_version_only')}
                        </Button>
                        <Button
                            className="bg-[var(--color-yarn-orange)] text-white hover:bg-[var(--color-yarn-orange-dark)]"
                            onClick={() => {
                                const pending = pendingQualityVersionSave
                                setPendingQualityVersionSave(null)
                                if (pending) void handleSaveQuote(pending.targetMode, pending.status, true, pending.recordKindOverride, 'version_and_quality')
                            }}
                        >
                            {t('estimator.sprint1.save_version_update_quality')}
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

            {/* Unusual-value acknowledgement */}
            <Dialog open={showWarningAcknowledgement} onOpenChange={setShowWarningAcknowledgement}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="h-5 w-5" /> Review unusual values
                        </DialogTitle>
                        <DialogDescription>
                            These values may be valid for a special fabric, but they are outside the usual costing range. Confirm them before saving a costing or quotation.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                        {estimatorWarnings.map(warning => (
                            <div key={`${warning.field}:${warning.message}`} className="flex gap-2 text-sm text-amber-900">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                                <span>{warning.message}</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowWarningAcknowledgement(false)}>Go back</Button>
                        <Button
                            className="bg-amber-600 text-white hover:bg-amber-700"
                            onClick={() => {
                                setAcknowledgedWarningKey(warningKey)
                                setShowWarningAcknowledgement(false)
                            }}
                        >
                            I reviewed these values
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

            {/* Rename Quality Dialog */}
            <Dialog open={Boolean(renameTpl)} onOpenChange={open => { if (!open) { setRenameTpl(null); setRenameError(null) } }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('estimator.sprint1.correct_quality_name')}</DialogTitle>
                        <DialogDescription>{t('estimator.sprint1.correct_quality_name_help')}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5 py-4">
                        <Label htmlFor="rename-quality-name">{t('estimator.quality.qualityNameLabel')}</Label>
                        <Input
                            id="rename-quality-name"
                            value={renameValue}
                            onChange={event => { setRenameValue(event.target.value); setRenameError(null) }}
                            maxLength={120}
                            aria-invalid={Boolean(renameError)}
                            aria-describedby={renameError ? 'rename-quality-error' : undefined}
                            autoFocus
                        />
                        {renameError && <p id="rename-quality-error" role="alert" className="text-xs font-medium text-destructive">{renameError}</p>}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setRenameTpl(null)}>Cancel</Button>
                        <Button onClick={handleRenameTemplate} disabled={renamingTpl || !renameValue.trim()}>{renamingTpl && <Loader2 className="h-4 w-4 animate-spin" />} {t('estimator.sprint1.save_name_correction')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Draft dismissal confirmation */}
            <Dialog open={showDiscardDraft} onOpenChange={setShowDiscardDraft}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Discard this device draft?</DialogTitle>
                        <DialogDescription>This removes the unfinished Cost Estimate saved on this device. Saved qualities, costings, and quotations are not affected.</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDiscardDraft(false)}>Keep draft</Button>
                        <Button variant="destructive" onClick={() => { dismissDraft(); setShowDiscardDraft(false); setShowValidation(false); setDismissedWarnings([]); setAcknowledgedWarningKey(null); setShowWarningAcknowledgement(false); toast.success('Cost Estimate draft discarded') }}>Discard draft</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmActionDialog
                open={Boolean(templateToArchive)}
                onOpenChange={open => { if (!open) setTemplateToArchive(null) }}
                title={t('estimator.quality.archiveTitle')}
                description={templateToArchive ? t('estimator.quality.archiveDescription', { name: templateToArchive.name }) : ''}
                confirmLabel={t('estimator.quality.archiveConfirm')}
                isDestructive
                isLoading={Boolean(templateToArchive && deletingTpl === templateToArchive.id)}
                onConfirm={async () => {
                    if (!templateToArchive) return
                    const target = templateToArchive
                    await handleArchiveTemplate(target)
                    if (editRatesTpl?.id === target.id) setEditRatesTpl(null)
                    setTemplateToArchive(null)
                }}
            />

            {/* Edit Quality Rates Dialog */}
            <Dialog open={!!editRatesTpl} onOpenChange={open => { if (!open) setEditRatesTpl(null) }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            {t('estimator.quality.editDialogTitle')} {editRatesTpl?.name}
                        </DialogTitle>
                        <DialogDescription>{t('estimator.sprint1.edit_quality_rates')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-3 space-y-5">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] uppercase font-semibold text-slate-500">{t('estimator.quality.qualityNameLabel')}</Label>
                            <Input
                                value={editingTplName}
                                readOnly
                                aria-readonly="true"
                                title={t('estimator.sprint1.saved_quality_name_stable')}
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
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: parseNonNegativeInput(e.target.value) ?? 0 } : x)
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
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: parseNonNegativeInput(e.target.value) ?? 0 } : x)
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
                                    if (editRatesTpl) setTemplateToArchive(editRatesTpl)
                                }}
                                disabled={deletingTpl === editRatesTpl?.id}
                                className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-red-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                Archive quality
                            </button>
                            <p className="text-[10px] text-slate-400 font-medium">Archived qualities remain in History and can be restored.</p>
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
