'use client'

import dynamic from 'next/dynamic'
import { useReducer, useEffect, useMemo, useCallback, useState, useRef, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { nanoid } from 'nanoid'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    ChevronLeft,
    ChevronRight,
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
    Info,
    Zap,
    Play,
    Check,
    CheckCircle2,
    Minus,
    ReceiptText,
    FileDown,
    MoreHorizontal,
} from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useTranslation } from '@/lib/i18n/context'
import {
    calcFullTotals,
    buildCostingResult,
    runScenarios,
    calcPerPickCostFromWeavingRate,
    makeDefaultEstimateState,
    DEFAULT_WARP_ROW,
    DEFAULT_WEFT_ROW,
    DEFAULT_OVERHEAD_ITEMS,
    DEFAULT_FACTORY_SECTIONS,
    DEFAULT_WARP_CRIMP_PCT,
    ensureOverheadIntegrity,
    getEffectiveYarnDenier,
    getEffectiveCostingWidthCm,
    isWarpRowFilled,
    isWeftRowFilled,
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
    type CostingResultSnapshot,
} from '@/lib/estimator'
import {
    getFactoryCostProfile,
    getEstimatorSecondaryData,
    getEstimatorTemplates,
    saveAsFabricTemplate,
    saveEstimatorQuoteV3,
    getCostingSaveReceipt,
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
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    handleEnterKeyNavigation,
    findNavigableFormInputs,
    focusAndSelectInput,
    DEFAULT_INPUT_SELECTOR,
    isElementNavigable,
} from '@/lib/form-navigation'
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
    Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ConfirmActionDialog } from '@/components/ConfirmActionDialog'
import { ContextualMachineDialog } from '@/components/onboarding/contextual-machine-dialog'
const FactoryCostWizard = dynamic(() => import('./FactoryCostWizard'), {
    ssr: false,
    loading: () => null,
})
import {
    getEstimatorWorkflowConfig,
    type EstimatorWorkflowMode,
    type ProductionMode,
} from '@/lib/production-mode'
import {
    getFirstEstimatorValidationMessage,
    getEstimatorReadiness,
    getYarnDensityWarning,
    requiresFactoryCapacity,
    validateEstimatorSnapshot,
} from '@/lib/estimator-validation'
import { shouldAutoRestoreEstimatorDraft } from '@/lib/estimator-drafts'
import type { EstimatorDraftInput, EstimatorQuoteStatus } from '@/lib/estimator-drafts'
import { summarizeCostingInputChanges } from '@/lib/costing-save-trust'
import { createClientRequestUuid } from '@/lib/client-request-id'
import { runMutationWithTimeout } from '@/lib/mutation-outcome'
import { getEstimatorFieldTarget } from '@/lib/estimator-field-target'
import { BasePlanFactoryGlossary } from '@/components/estimator/BasePlanFactoryGlossary'
import { ArchivePolicyNotice } from '@/components/records/ArchivePolicyNotice'
import { RouteMilestones } from '@/components/performance/route-milestones'
import { PageHeader } from '@/components/ui/page-header'
import { createCostingExportModel } from '@/lib/estimator-export'
import type { CostingRecordKind } from '@/lib/costing-workspace'
import { parseNonNegativeInput, parseNumericInput } from '@/lib/numeric-input'
import { initWebVitals } from '@/lib/web-vitals'
import { calculateRateImpact } from '@/lib/estimator-rate-impact'
import { RateImpactSummary } from '@/components/estimator/RateImpactSummary'
import { nextCostingJourney, type CostingJourney, type CostingJourneySource } from '@/lib/costing-journey'
import {
    getMatchingFactoryProfileId,
    hasMeaningfulFactoryCostBaseline,
    type FactoryProfileId,
} from '@/lib/factory-cost-profiles'
import { formatTimestampDate } from '@/lib/format'
import { formatSuratDateTime } from '@/lib/time'
import { restoreSavedQualityCostingAssumptions, type SavedQualityCostingReuse } from '@/lib/saved-costings'
import { trackPlanEvent } from '@/lib/plan-analytics'

const CostingExportDialog = dynamic(
    () => import('@/components/estimator/CostingExportDialog').then(module => module.CostingExportDialog),
    { ssr: false, loading: () => null },
)

const COSTING_SAVE_GUIDANCE_STORAGE_KEY = 'weavly-estimator-costing-save-guidance-dismissed'

function getCostingSaveGuidanceStorageKey(orgId: string, userId: string) {
    return `${COSTING_SAVE_GUIDANCE_STORAGE_KEY}:${orgId}:${userId}`
}

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

function profileHasSavedBaseline(profile?: FactoryCostProfile) {
    return hasMeaningfulFactoryCostBaseline(profile)
}

type SaveAsNewQualityRollback = {
    appliedTemplate: EstimatorTemplate | null
    templateName: string
    qualityLabel: string
    sourceQuoteId: string | null
    sourceQuoteUpdatedAt: string | null
    sourceQuoteVersionNumber: number | null
    sourceQuoteCreatedAt: string | null
    sourceQuoteStatus: EstimatorQuoteStatus | null
    sourceState: EstimateState | null
    sourceFactoryProfileUpdatedAt: string | null
    sourceRecordKind: CostingRecordKind | null
    clientRequestId: string | null
}

type WarningContinuation = () => void | Promise<unknown>

function buildEstimatorBaseline(
    profile?: FactoryCostProfile,
    workers: FixedWorkerOverhead[] = [],
): EstimateState {
    const base = makeDefaultEstimateState()
    if (!profile) return base
    const initialProfile = profile

    const sections = profile.enabled_sections ?? {
        winding: false,
        processing: false,
        finishing: false,
        commission: false,
        transport: false,
    }

    let next: EstimateState = {
        ...base,
        warpingRatePerKg: Number(profile.warping_rate_per_kg ?? base.warpingRatePerKg),
        sizingRatePerKg: Number(profile.sizing_rate_per_kg ?? base.sizingRatePerKg),
        windingRatePerKg: Number(profile.winding_rate_per_kg ?? base.windingRatePerKg),
        warpRows: base.warpRows.map((row, index) => index === 0
            ? {
                ...row,
                label: profile.default_warp_yarn_name || row.label,
                yarnRate: Number(profile.default_warp_yarn_rate_per_kg ?? row.yarnRate),
            }
            : row),
        weftRows: base.weftRows.map((row, index) => index === 0
            ? {
                ...row,
                label: profile.default_weft_yarn_name || row.label,
                yarnRate: Number(profile.default_weft_yarn_rate_per_kg ?? row.yarnRate),
            }
            : row),
        processingRatePerM: Number(profile.default_processing_rate_per_m ?? base.processingRatePerM),
        finishingRatePerM: Number(profile.default_finishing_rate_per_m ?? base.finishingRatePerM),
        overheadPct: 0,
        commissionPct: Number(profile.default_commission_pct ?? base.commissionPct),
        profitPct:         Number(initialProfile.default_margin_pct ?? base.profitPct),
        transportPerM: Number(profile.default_transport_per_m ?? base.transportPerM),
        enabledSections: { ...sections },
        // The saved number is authoritative. Older profiles could retain
        // monthly_output_m without flipping is_configured, and hiding it here
        // made Settings saves disappear from a fresh estimator load.
        monthlyOutputM: Number(profile.monthly_output_m ?? base.monthlyOutputM),
        overheadOverridePerM: profile.overhead_override_per_m != null
            ? Number(profile.overhead_override_per_m)
            : base.overheadOverridePerM,
        overheadMode: resolveOverheadMode(profile),
        loomCount: Number(profile.loom_count ?? base.loomCount),
        monthlyWorkingDays: Number(profile.monthly_working_days ?? base.monthlyWorkingDays),
        avgOutputPerLoomPerDay: Number(profile.avg_output_per_loom_per_day ?? base.avgOutputPerLoomPerDay),
        yarnShortagePct: profile.yarn_shortage_pct != null
            ? Number(profile.yarn_shortage_pct)
            : base.yarnShortagePct,
        warpCrimpPct: profile.warp_crimp_pct != null
            ? Number(profile.warp_crimp_pct)
            : base.warpCrimpPct,
        isConfigured: profileHasSavedBaseline(profile),
    }

    if (Array.isArray(profile.overhead_items) && profile.overhead_items.length > 0) {
        next = { ...next, overheadItems: ensureOverheadIntegrity(profile.overhead_items) }
    } else if (workers.length > 0) {
        const fixedItems: OverheadItem[] = workers.map(worker => ({
            id: `fw-${worker.id}`,
            label: `${worker.name} (${worker.role})`,
            monthlyAmount: Number(worker.monthly_salary),
            source: 'fixed_worker_derived' as const,
            workerId: worker.id,
            category: 'custom' as const,
            isPreset: false,
            isLocked: false,
        }))
        next = {
            ...next,
            overheadItems: [
                ...ensureOverheadIntegrity(DEFAULT_OVERHEAD_ITEMS.map(item => ({ ...item, id: nanoid() }))),
                ...ensureOverheadIntegrity(fixedItems),
            ],
        }
    }

    return next
}

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
    warping_mode?: 'in_house' | 'outsourced' | null
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
    /** Base-only latest costing inputs used for full-costing Saved Quality reuse. */
    latest_costing_reuse?: SavedQualityCostingReuse | null
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
    warpingMode: string | null | undefined
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
        warpingMode: recipe.warpingMode ?? null,
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
        warpingMode: template.warping_mode,
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
        warpingMode: state.warpingMode,
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
                monthlyOutputM:     Number(profile.monthly_output_m ?? 0),
                overheadOverridePerM: profile.overhead_override_per_m != null ? Number(profile.overhead_override_per_m) : null,
                overheadMode:        resolveOverheadMode(profile),
                overheadPct:        0,
                yarnShortagePct:    profile.yarn_shortage_pct != null ? Number(profile.yarn_shortage_pct) : state.yarnShortagePct,
                warpCrimpPct:       profile.warp_crimp_pct != null ? Number(profile.warp_crimp_pct) : state.warpCrimpPct,
                commissionPct:      Number(profile.default_commission_pct  ?? 0),
                profitPct:          Number(profile.default_margin_pct ?? state.profitPct),
                transportPerM:      Number(profile.default_transport_per_m ?? 0),
                enabledSections:    { ...sections },
                isConfigured:       profileHasSavedBaseline(profile),
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
            // Base Saved Quality reuse is deliberately full-costing reuse.
            // The live template rows below carry the current Rate Book values;
            // the linked costing snapshot restores the saved overhead,
            // commercial, quantity, and enablement context.
            const restoredAssumptions = restoreSavedQualityCostingAssumptions(state, tpl.latest_costing_reuse)
            // Explicit null fallbacks for pre-loom-type templates (Gap 4)
            // Ensures undefined template fields never corrupt existing session state.
            const loomFields = {
                loomType:              (tpl.loom_type ?? null) as LoomType | null,
                loomRpm:               tpl.loom_rpm != null ? Number(tpl.loom_rpm) : null,
                loomPowerKw:           tpl.loom_power_kw != null ? Number(tpl.loom_power_kw) : null,
                loomRpmIsCustomised:   false,
                loomPowerKwIsCustomised: false,
                warpingMode:            (tpl.warping_mode ?? 'in_house') as 'in_house' | 'outsourced',
                sizingMode:            (tpl.sizing_mode ?? 'in_house') as 'in_house' | 'outsourced',
                hoursPerShift:         tpl.hours_per_shift != null ? Number(tpl.hours_per_shift) : state.hoursPerShift,
            }
            if (tpl.warp_rows && tpl.warp_rows.length > 0) {
                return {
                    ...restoredAssumptions,
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
                ...restoredAssumptions,
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
            return { ...state, warpRows: [...state.warpRows, { id: nanoid(), ...DEFAULT_WARP_ROW, label: '' }] }
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
            return { ...state, weftRows: [...state.weftRows, { id: nanoid(), ...DEFAULT_WEFT_ROW, label: '' }] }
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
            const { profile, sections, workers } = action.data

            // Reset must use the same baseline builder as the first render. Keeping
            // one builder prevents a New Quality action from retaining stale rows,
            // rates, overhead items, or profile defaults from the previous recipe.
            return buildEstimatorBaseline(
                profile
                    ? { ...profile, enabled_sections: profile.enabled_sections ?? sections }
                    : { enabled_sections: sections },
                workers,
            )
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
        <div className="flex flex-col gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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
    ghostValue,
    ghostPlaceholder,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    unit?: string
    step?: number
    hint?: string
    accent?: EstimatorAccent
    ghostValue?: number
    ghostPlaceholder?: string
}) {
    const accentStyles = getAccentStyles(accent)
    const decrement = () => onChange(Math.max(0, Number((value - step).toFixed(2))))
    const increment = () => onChange(Number((value + step).toFixed(2)))
    const isGhostValue = ghostValue !== undefined && value === ghostValue
    return (
        <div className="min-w-0 space-y-2">
            <Label className={`block text-[11px] font-semibold uppercase tracking-[0.05em] ${accentStyles.text}`}>
                {label}
            </Label>
            <div className="inline-flex h-11 overflow-hidden rounded-[9px] border border-[var(--color-hairline)] bg-white shadow-[0_1px_2px_rgba(30,37,40,0.04)]">
                <button
                    type="button"
                    onClick={decrement}
                    aria-label={`Decrease ${label}`}
                    className="flex w-11 items-center justify-center border-r border-[var(--color-hairline)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)]"
                >
                    <Minus className="h-3.5 w-3.5" />
                </button>
                <Input
                    type="number"
                    value={isGhostValue ? '' : value}
                    placeholder={isGhostValue ? (ghostPlaceholder ?? String(ghostValue)) : undefined}
                    step={step}
                    min={0}
                    onChange={e => {
                        const next = parseNonNegativeInput(e.target.value)
                        if (next !== null) onChange(next)
                    }}
                    className="h-full w-16 rounded-none border-0 bg-white p-0 text-center font-mono text-sm font-semibold text-[var(--color-ink)] placeholder:text-[var(--color-muted)] shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="flex w-11 items-center justify-center border-l border-r border-[var(--color-hairline)] text-xs font-semibold text-[var(--color-muted)]">
                    {unit}
                </span>
                <button
                    type="button"
                    onClick={increment}
                    aria-label={`Increase ${label}`}
                    className="flex w-11 items-center justify-center text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)]"
                >
                    <Plus className="h-3.5 w-3.5" />
                </button>
            </div>
            {hint && <p className="text-[11px] font-medium leading-tight text-[var(--color-muted)]">{hint}</p>}
        </div>
    )
}

function NumField({
    label, value, onChange, unit, step = 1, min = 0, hint, warning, onDismissWarning, placeholder, attentionWhenEmpty = false, preserveZero = false, ghostValue, fieldKey,
}: {
    label: string; value: number | null; onChange: (v: number | null) => void
    unit?: string; step?: number; min?: number; hint?: string; warning?: string; fieldKey?: string
    onDismissWarning?: () => void; placeholder?: string; attentionWhenEmpty?: boolean; preserveZero?: boolean; ghostValue?: number
}) {
    const inputId = useId()
    const isEmpty = attentionWhenEmpty && (!value || value <= 0)
    // Estimator defaults are stored as numeric zero for calculations, but an
    // empty control with a zero placeholder is a better editing experience:
    // the first digit typed replaces the visual default instead of appending
    // to it (for example, entering 55 must never appear as 055).
    const isGhostValue = ghostValue !== undefined && value === ghostValue
    const displayValue = isGhostValue || (value === 0 && !preserveZero) ? '' : (value ?? '')
    const displayPlaceholder = isGhostValue || (value === 0 && !preserveZero)
        ? (placeholder ?? (ghostValue !== undefined ? String(ghostValue) : '0'))
        : placeholder
    return (
        <div className="space-y-1.5 min-w-0" data-estimator-field={fieldKey}>
            <Label htmlFor={inputId} className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">{label}</Label>
            <div className="relative group">
                <Input
                    id={inputId}
                    inputMode="decimal"
                    aria-invalid={isEmpty || undefined}
                    aria-describedby={isEmpty || warning || hint ? `${inputId}-help` : undefined}
                    type="number"
                    step={step}
                    min={min}
                    placeholder={displayPlaceholder}
                    value={displayValue}
                    onChange={e => {
                        const val = parseNumericInput(e.target.value, { min })
                        onChange(val)
                    }}
                    className={`h-11 text-xs sm:text-sm font-mono font-semibold text-center pr-10 sm:pr-14 border placeholder:text-[var(--color-muted)] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[9px] text-[var(--color-yarn-orange)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] ${
                        isEmpty ? 'bg-[var(--color-warning-amber-soft)] border-[var(--color-warning-amber)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'bg-[var(--color-canvas-white)] border-[var(--color-hairline)] hover:border-[var(--color-hairline-strong)]'
                    }`}
                />
                {unit && (
                    <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)] font-medium pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {isEmpty && <p id={`${inputId}-help`} className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required</p>}
            {warning ? (
                <div className="flex flex-col gap-0.5 mt-1">
                    <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-[var(--color-warning-amber)] shrink-0" />
                        <p id={!isEmpty ? `${inputId}-help` : undefined} className="text-[10px] font-medium leading-tight text-[var(--color-warning-amber)]">{warning}</p>
                    </div>
                    {onDismissWarning && (
                        <button
                            type="button"
                            onClick={onDismissWarning}
                            className="estimator-touch-target rounded px-1 text-left text-xs text-slate-400 underline hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]"
                        >
                            Dismiss
                        </button>
                    )}
                </div>
            ) : hint && !isEmpty ? (
                <p id={`${inputId}-help`} className="text-[11px] text-[var(--color-muted)] font-medium leading-tight mt-1">{hint}</p>
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
    const effectiveDenier = getEffectiveYarnDenier(row)
    const densityWarning = getYarnDensityWarning(effectiveDenier)

    return (
        <NumField
            fieldKey="calcDenier"
            label="Denier — REQUIRED"
            value={effectiveDenier}
            onChange={value => {
                // Keep previously saved cotton-count rows editable as denier
                // rows now that the unit selector is no longer exposed.
                if (row.linearDensityUnit === 'cotton_count_ne') {
                    onChange('linearDensityUnit', 'denier')
                    onChange('cottonCountNe', null)
                }
                onChange('calcDenier', value ?? 0)
            }}
            unit="D"
            step={0.1}
            placeholder="e.g. 75"
            hint="Enter total linear density after any ply or doubling"
            warning={densityWarning}
            attentionWhenEmpty
        />
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
    placeholder,
    attentionWhenEmpty = false,
}: {
    label: string
    value: number
    onChange: (v: number) => void
    unit: 'cm' | 'inch'
    hint?: string
    warning?: string
    onUseInches?: () => void
    placeholder?: string
    attentionWhenEmpty?: boolean
}) {
    const isEmpty = attentionWhenEmpty && (!value || value <= 0)
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
        <div data-estimator-field="effectiveCostingWidthCm" className="space-y-1.5 min-w-0">
            <Label className={`flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold leading-tight ${isEmpty ? 'text-[var(--color-warning-amber)]' : 'text-[var(--color-muted)]'}`}>
                {label}
            </Label>
            <div className="relative group">
                <Input
                    aria-label={label}
                    type="number"
                    // Finished width is routinely fractional (for example,
                    // 121.92 cm = 48 inches). Keep the native number input's
                    // validity rules aligned with the values the estimator
                    // already accepts and persists.
                    step={0.01}
                    min={0}
                    placeholder={placeholder}
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
                    aria-invalid={isEmpty || undefined}
                    className={`h-11 text-xs sm:text-sm font-mono font-semibold text-center pr-12 sm:pr-16 placeholder:text-[var(--color-muted)] focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-[0_1px_2px_rgba(30,37,40,0.035)] group-hover:border-[var(--color-hairline-strong)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[9px] text-[var(--color-yarn-orange)] ${isEmpty ? 'bg-[var(--color-warning-amber-soft)] border-[var(--color-warning-amber)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'bg-white border-[var(--color-hairline)]'}`}
                />
                <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold pointer-events-none">
                    {unit}
                </span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
                {isEmpty && <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required</p>}
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
                                className="estimator-touch-target shrink-0 rounded border border-[var(--color-warning-amber)] px-2 py-1 text-[9px] font-bold underline-offset-2 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]"
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

function formatCalculatedMoney(value: number, valid: boolean, suffix = '') {
    return valid ? `₹${value.toFixed(2)}${suffix}` : '—'
}

function formatSignedRupees(value: number | null | undefined): string {
    if (value == null || Math.abs(value) < 0.005) return '₹0.00'
    return `${value > 0 ? '+' : '−'}₹${Math.abs(value).toFixed(2)}`
}

function assumptionSourceLabel(source: string): string {
    switch (source) {
        case 'direct_rate': return 'Direct rate entered'
        case 'monthly_expenses': return 'Monthly expenses ÷ output'
        case 'manual_input': return 'Estimator input'
        case 'not_set': return 'Not set'
        default: return 'Saved snapshot'
    }
}

function MobileLiveEstimateShortcut({
    visible,
    keyboardVisible,
    expanded,
    activeName,
    versionLabel,
    validityLabel,
    validityDescription,
    validityClassName,
    validityIcon: ValidityIcon,
    hasValidCostResult,
    quoteIsValid,
    productionCostPerM,
    suggestedSellingPricePerM,
    actualMarginPct,
    breakEvenPricePerM,
    missingIssueCount,
    needsReview,
    readinessMessage,
    onJumpToInput,
    assumptions,
    actions,
    expectedProfitTotal,
    hasOrderQty,
}: {
    visible: boolean
    keyboardVisible: boolean
    expanded: boolean
    activeName: string
    versionLabel?: string
    validityLabel: string
    validityDescription: string
    validityClassName: string
    validityIcon: React.ElementType
    hasValidCostResult: boolean
    quoteIsValid: boolean
    productionCostPerM: number
    suggestedSellingPricePerM: number
    actualMarginPct: number | null
    breakEvenPricePerM: number | null
    missingIssueCount: number
    needsReview: boolean
    readinessMessage: string | null
    onJumpToInput: () => void
    assumptions?: React.ReactNode
    actions?: React.ReactNode | ((onDismiss: () => void) => React.ReactNode)
    expectedProfitTotal?: number | null
    hasOrderQty?: boolean
}) {
    const [open, setOpen] = useState(false)
    const hasValidPrice = hasValidCostResult && quoteIsValid
    const hasReviewState = needsReview || missingIssueCount > 0 || !hasValidCostResult || !quoteIsValid
    const marginTone = actualMarginPct === null
        ? 'text-[var(--color-muted)]'
        : actualMarginPct > 0
            ? 'text-[var(--color-factory-green)]'
            : actualMarginPct < 0
                ? 'text-[var(--color-risk-red)]'
                : 'text-[var(--color-warning-amber)]'
    const marginSurface = actualMarginPct === null
        ? 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)]'
        : actualMarginPct > 0
            ? 'border-[#CDE5D3] bg-[var(--color-factory-green-soft)]'
            : actualMarginPct < 0
                ? 'border-[#E7C3BB] bg-[var(--color-risk-red-soft)]'
                : 'border-[var(--color-warning-amber-soft)] bg-[var(--color-warning-amber-soft)]/55'
    const shortcutLabel = hasValidCostResult
        ? `Production cost ₹${productionCostPerM.toFixed(2)} per metre`
        : missingIssueCount > 0
            ? `${missingIssueCount} costing input${missingIssueCount === 1 ? '' : 's'} need review`
            : 'Review the costing inputs'
    const shortcutBadge = hasValidCostResult && hasValidPrice
        ? 'Live'
        : missingIssueCount > 0
            ? String(Math.min(missingIssueCount, 9))
            : '!'

    return (
        <>
            {visible && !keyboardVisible && !open && (
                <div
                    className="fixed bottom-[calc(76px+env(safe-area-inset-bottom,0px))] right-4 z-40 md:bottom-6 md:right-6 min-[1660px]:right-[16rem]"
                    data-testid="mobile-live-estimate-shortcut"
                >
                    <button
                        type="button"
                        aria-label={`View live cost estimate. ${shortcutLabel}`}
                        aria-expanded={open}
                        aria-controls="mobile-live-estimate-panel"
                        onClick={() => setOpen(true)}
                        className={`group flex items-center justify-end gap-2 rounded-full border border-[var(--color-yarn-orange)]/20 bg-[var(--color-canvas-white)]/95 p-1.5 text-left shadow-[0_8px_24px_rgba(30,37,40,0.16)] backdrop-blur-xl transition-[width,transform,box-shadow] duration-200 motion-reduce:transition-none hover:shadow-[0_10px_28px_rgba(30,37,40,0.20)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] focus-visible:ring-offset-2 ${expanded ? 'pl-3' : ''}`}
                    >
                        {expanded && (
                            <span className="min-w-0 max-w-[10.5rem] pr-1">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-yarn-orange-dark)]">Live cost</span>
                                <span className="mt-0.5 block truncate text-[12px] font-semibold text-[var(--color-ink)]">
                                    {hasValidCostResult ? `₹${productionCostPerM.toFixed(2)}/m` : 'Complete inputs'}
                                </span>
                            </span>
                        )}
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-amber-soft)] text-[var(--color-yarn-orange-dark)] transition-colors group-hover:bg-[var(--color-yarn-orange)] group-hover:text-white">
                            <Calculator className="h-5 w-5" aria-hidden="true" />
                            <span
                                aria-hidden="true"
                                className={`absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[var(--color-canvas-white)] px-0.5 text-[8px] font-bold leading-none text-white ${hasValidCostResult && hasValidPrice ? 'bg-[var(--color-factory-green)]' : 'bg-[var(--color-warning-amber)]'}`}
                            >
                                {shortcutBadge === 'Live' ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : shortcutBadge}
                            </span>
                        </span>
                    </button>
                </div>
            )}

            <Sheet open={open} onOpenChange={setOpen}>
                <SheetContent
                    id="mobile-live-estimate-panel"
                    side="bottom"
                    className="max-h-[min(84dvh,44rem)] overflow-y-auto rounded-t-[22px] border-x-0 border-b-0 px-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-0 md:inset-x-0 md:bottom-6 md:top-6 md:mx-auto md:h-auto md:max-h-none md:w-[min(calc(100vw-3rem),38rem)] md:overflow-y-auto md:rounded-b-[22px] md:border md:border-[var(--color-hairline)]"
                >
                    <SheetHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-warning-amber-soft)]/70 px-5 pb-4 pt-5 pr-16 text-left">
                        <SheetTitle className="text-[17px]">Live cost estimate</SheetTitle>
                        <SheetDescription className="truncate text-[12px] font-semibold text-[var(--color-ink)]">
                            {activeName}{versionLabel ? ` · ${versionLabel}` : ''}
                        </SheetDescription>
                        <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">Updates live as you edit the estimate.</p>
                    </SheetHeader>

                    <div className={`mx-5 mt-4 flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[11px] leading-4 ${validityClassName}`} role="status" aria-live="polite">
                        <ValidityIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                            <span className="font-semibold">{validityLabel}</span>
                            <span className="ml-1.5 font-medium opacity-85">{validityDescription}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 px-5 pt-4" aria-label="Live cost metrics">
                        <div className="min-w-0 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-3">
                            <p className="text-[10px] font-semibold leading-4 text-[var(--color-muted)]">Production cost / m</p>
                            <p className="mt-1 break-words font-mono text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink)]">
                                {hasValidCostResult ? `₹${productionCostPerM.toFixed(2)}` : '—'}
                            </p>
                        </div>
                        <div className="min-w-0 rounded-[12px] border border-[var(--color-yarn-orange)]/25 bg-[var(--color-warning-amber-soft)]/55 px-3 py-3">
                            <p className="text-[10px] font-semibold leading-4 text-[var(--color-muted)]">Suggested price / m</p>
                            <p className="mt-1 break-words font-mono text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-yarn-orange)]">
                                {hasValidPrice ? `₹${suggestedSellingPricePerM.toFixed(2)}` : '—'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 px-5 pt-2.5">
                        <div className={`min-w-0 rounded-[12px] border px-3 py-3 ${marginSurface}`}>
                            <p className={`text-[10px] font-semibold leading-4 ${marginTone}`}>Actual margin</p>
                            <p className={`mt-1 break-words font-mono text-[1.25rem] font-semibold leading-none tracking-tight tabular-nums ${marginTone}`}>
                                {actualMarginPct === null ? '—' : `${actualMarginPct >= 0 ? '+' : ''}${actualMarginPct.toFixed(1)}%`}
                            </p>
                        </div>
                        <div className="min-w-0 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-3">
                            <p className="text-[10px] font-semibold leading-4 text-[var(--color-muted)]">Break-even price / m</p>
                            <p className="mt-1 break-words font-mono text-[1.25rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink)]">
                                {hasValidCostResult && breakEvenPricePerM != null ? `₹${breakEvenPricePerM.toFixed(2)}` : '—'}
                            </p>
                        </div>
                    </div>

                    {hasOrderQty && expectedProfitTotal != null && (
                        <div className="mx-5 mt-2.5 flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2.5">
                            <span className="text-[11px] font-semibold text-[var(--color-muted)]">Expected profit</span>
                            <span className={`font-mono text-[13px] font-semibold tabular-nums ${expectedProfitTotal < 0 ? 'text-[var(--color-risk-red)]' : 'text-[var(--color-factory-green)]'}`}>
                                ₹{expectedProfitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    )}

                    {assumptions && <div className="px-5 pt-3">{assumptions}</div>}

                    {hasReviewState ? (
                        <button
                            type="button"
                            onClick={() => {
                                setOpen(false)
                                onJumpToInput()
                            }}
                            className="mx-5 mt-4 flex min-h-12 w-[calc(100%-2.5rem)] items-center justify-between gap-3 rounded-[11px] border border-[var(--color-warning-amber)]/35 bg-[var(--color-warning-amber-soft)] px-3.5 py-2.5 text-left text-[11px] text-[var(--color-warning-amber)] transition-colors hover:bg-[var(--color-warning-amber-soft)]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]"
                        >
                            <span className="min-w-0">
                                <span className="block font-semibold">Review highlighted inputs</span>
                                <span className="mt-0.5 block truncate font-medium opacity-85">{readinessMessage ?? 'Complete the required inputs to use this price.'}</span>
                            </span>
                            <ChevronUp className="h-4 w-4 shrink-0" aria-hidden="true" />
                        </button>
                    ) : (
                        <p className="px-5 pt-4 text-[10px] font-medium leading-4 text-[var(--color-muted)]">Use the estimate above while reviewing the form, then save when the costing is ready.</p>
                    )}

                    {actions && (
                        <div className="border-t border-[var(--color-hairline)]/80 px-5 pb-1 pt-4">
                            {typeof actions === 'function' ? actions(() => setOpen(false)) : actions}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </>
    )
}

function CostingAssumptionsSummary({
    result,
    isStandaloneCostingSession,
    expanded,
    onToggle,
}: {
    result: CostingResultSnapshot
    isStandaloneCostingSession: boolean
    expanded: boolean
    onToggle: () => void
}) {
    const assumptions = result.assumptions
    const overhead = assumptions?.overhead
    const quantity = assumptions?.quantity.activeRate ?? result.quantityM
    const hasQuantity = quantity != null && Number.isFinite(quantity) && quantity > 0
    const productionCostAvailable = Number.isFinite(result.productionCostPerM) && result.productionCostPerM > 0
    const calculationIncomplete = !assumptions || (!isStandaloneCostingSession && hasQuantity && !result.quoteIsValid)
    const warningItems = [
        !hasQuantity ? 'Quantity not set' : null,
        !productionCostAvailable ? 'Required cost unavailable' : null,
        calculationIncomplete ? 'Calculation incomplete' : null,
    ].filter((warning): warning is string => Boolean(warning))
    const targetMargin = assumptions?.margin.activeRate ?? result.targetMarginPct
    const commission = assumptions?.commission.activeRate ?? result.commissionPct
    const overheadRate = overhead?.activeRatePerM ?? result.overheadPerM
    const overheadDescription = overhead
        ? overhead.source === 'monthly_expenses' ? 'Monthly expenses ÷ output' : 'Direct rate entered'
        : result.overheadMode === 'monthly_expenses' ? 'Monthly expenses ÷ output' : 'Direct rate entered'
    const hasWinding = result.breakdown?.windingPerM != null && result.breakdown.windingPerM > 0
    const hasProcessing = result.breakdown?.processingPerM != null && result.breakdown.processingPerM > 0
    const hasFinishing = result.breakdown?.finishingPerM != null && result.breakdown.finishingPerM > 0
    const activeAssumptionsCount = (assumptions ? 4 : 0) + (hasWinding ? 1 : 0) + (hasProcessing ? 1 : 0) + (hasFinishing ? 1 : 0)
    const formatPercent = (value: number) => Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
    const displayQualityWarning = warningItems.length > 0

    return (
        <section
            data-testid="costing-assumptions-summary"
            aria-label="Pricing assumptions"
            className="overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-canvas)]/70"
        >
            <button
                type="button"
                data-testid="pricing-assumptions-trigger"
                aria-expanded={expanded}
                aria-controls="pricing-assumptions-details"
                aria-label={`Pricing assumptions. ${activeAssumptionsCount} active. ${formatPercent(targetMargin)} target margin. ${formatPercent(commission)} commission.${displayQualityWarning ? ` ${warningItems.join(', ')}.` : ''}`}
                onClick={onToggle}
                className="estimator-touch-target flex w-full items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors motion-reduce:transition-none hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] sm:px-4"
            >
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13px] font-semibold text-[var(--color-ink)]">Pricing assumptions</span>
                        {displayQualityWarning && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning-amber-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-warning-amber)]">
                                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                {warningItems.length} {warningItems.length === 1 ? 'warning' : 'warnings'}
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 break-words text-[11px] font-medium leading-4 text-[var(--color-muted)]">
                        {activeAssumptionsCount} active · {formatPercent(targetMargin)} target margin · {formatPercent(commission)} commission
                        {displayQualityWarning && <span className="sr-only"> · {warningItems.join(', ')}</span>}
                    </p>
                </div>
                <ChevronDown
                    className={`h-5 w-5 shrink-0 text-[var(--color-muted)] transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                />
            </button>

            <div
                id="pricing-assumptions-details"
                aria-hidden={!expanded}
                data-state={expanded ? 'open' : 'closed'}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
            >
                <div className="min-h-0 overflow-hidden">
                    <div className="border-t border-[var(--color-hairline)]/80">
                        <div className="divide-y divide-[var(--color-hairline)]/70" role="list" aria-label="Pricing assumption details">
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Overhead</p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">{overheadDescription}</p>
                                </div>
                                <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">₹{overheadRate.toFixed(2)}/m</p>
                            </div>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Commission</p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Selling commission</p>
                                </div>
                                <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">{formatPercent(commission)}</p>
                            </div>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Transport</p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Delivery cost per metre</p>
                                </div>
                                <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">₹{result.transportPerM.toFixed(2)}/m</p>
                            </div>
                            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                <div className="min-w-0">
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Target margin</p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Applied above break-even</p>
                                </div>
                                <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">{formatPercent(targetMargin)}</p>
                            </div>
                            {hasWinding && (
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-[var(--color-ink)]">Winding</p>
                                        <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Active winding assumption</p>
                                    </div>
                                    <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">₹{result.breakdown.windingPerM.toFixed(2)}/m</p>
                                </div>
                            )}
                            {hasProcessing && (
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-[var(--color-ink)]">Processing / Dyeing</p>
                                        <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Active processing assumption</p>
                                    </div>
                                    <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">₹{result.breakdown.processingPerM.toFixed(2)}/m</p>
                                </div>
                            )}
                            {hasFinishing && (
                                <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4" role="listitem">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-[var(--color-ink)]">Finishing</p>
                                        <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Active finishing assumption</p>
                                    </div>
                                    <p className="max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums text-[var(--color-ink)]">₹{result.breakdown.finishingPerM.toFixed(2)}/m</p>
                                </div>
                            )}
                            <div className={`grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-3 px-3 py-3 sm:px-4 ${!hasQuantity ? 'bg-[var(--color-warning-amber-soft)]/35' : ''}`} role="listitem">
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-ink)]">
                                        Quantity
                                        {!hasQuantity && <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning-amber)]" aria-label="Quantity not set" />}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">{isStandaloneCostingSession ? 'Optional; per-metre price unchanged' : 'Required before saving a quote'}</p>
                                </div>
                                <p className={`max-w-[48vw] break-words text-right font-mono text-[12px] font-semibold tabular-nums ${hasQuantity ? 'text-[var(--color-ink)]' : 'text-[var(--color-warning-amber)]'}`}>{hasQuantity ? `${quantity.toLocaleString('en-IN')} m` : 'Not set'}</p>
                            </div>
                        </div>

                        {warningItems.length > 0 && (
                            <p className="flex items-start gap-1.5 border-t border-[var(--color-hairline)]/70 px-3 py-2.5 text-[11px] font-medium leading-4 text-[var(--color-warning-amber)] sm:px-4" role="status">
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{warningItems.join(' · ')}</span>
                            </p>
                        )}

                        <details className="border-t border-[var(--color-hairline)]/70 px-3 py-2.5 sm:px-4">
                            <summary tabIndex={expanded ? 0 : -1} className="estimator-touch-target flex cursor-pointer list-none items-center gap-2 text-[11px] font-semibold text-[var(--color-muted)] outline-none focus-visible:text-[var(--color-yarn-orange-dark)] [&::-webkit-details-marker]:hidden">
                                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                Technical details
                            </summary>
                            <p className="pb-1 pl-5 text-[10px] leading-4 text-[var(--color-muted)]">
                                Calculation snapshot <code className="font-mono text-[var(--color-body)]">{result.calculationVersion}</code> · {result.roundingPolicy}
                            </p>
                        </details>
                    </div>
                </div>
            </div>
        </section>
    )
}

function CostingSaveReview({
    state,
    result,
    isStandaloneCostingSession,
    fullReuse,
    compact = false,
}: {
    state: EstimateState
    result: CostingResultSnapshot
    isStandaloneCostingSession: boolean
    fullReuse?: boolean
    compact?: boolean
}) {
    const formatPercent = (value: number) => Number.isInteger(value) ? `${value}%` : `${value.toFixed(1)}%`
    const formatRate = (value: number) => `₹${value.toFixed(2)}`
    const quantity = result.quantityM != null && result.quantityM > 0
        ? `${result.quantityM.toLocaleString('en-IN')} m`
        : 'Not set · per-metre costing only'
    const yarnRates = [
        ...state.warpRows.map(row => `Warp ${row.label?.trim() || 'layer'} ₹${Number(row.yarnRate || 0).toFixed(2)}/kg`),
        ...state.weftRows.map(row => `Weft ${row.label?.trim() || 'layer'} ₹${Number(row.yarnRate || 0).toFixed(2)}/kg`),
    ]
    const optionalSections: Array<[keyof FactorySections, string]> = [
        ['winding', 'Winding'],
        ['processing', 'Processing'],
        ['finishing', 'Finishing'],
        ['commission', 'Commission'],
        ['transport', 'Transport'],
    ]
    const enabledSections = optionalSections
        .filter(([section]) => state.enabledSections[section])
        .map(([, label]) => label)
    const disabledSections = optionalSections
        .filter(([section]) => !state.enabledSections[section])
        .map(([, label]) => label)
    const contentClass = compact ? 'px-3 py-2.5' : 'px-4 py-3.5'

    return (
        <section
            data-testid="costing-save-review"
            aria-label="Save review"
            className={`rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] ${contentClass}`}
        >
            <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--color-yarn-orange-dark)]">Save review</p>
            <p className="mt-1 text-[11px] font-medium leading-4 text-[var(--color-muted)]">
                Included in this {isStandaloneCostingSession ? 'costing snapshot' : 'quotation'}:
            </p>
            <div className="mt-2 grid gap-x-4 gap-y-1.5 text-[11px] sm:grid-cols-2">
                <p><span className="font-semibold text-[var(--color-ink)]">Yarn rate basis:</span> {yarnRates.join(' · ') || 'No yarn rows'}</p>
                <p><span className="font-semibold text-[var(--color-ink)]">Overhead:</span> {result.overheadMode === 'monthly_expenses' ? 'Monthly expenses ÷ output' : 'Direct rate'} · {formatRate(result.overheadPerM)}/m</p>
                <p><span className="font-semibold text-[var(--color-ink)]">Commission:</span> {result.commissionPct > 0 ? `Included · ${formatPercent(result.commissionPct)}` : '0% · no price impact'}</p>
                <p><span className="font-semibold text-[var(--color-ink)]">Transport:</span> {result.transportPerM > 0 ? `Included · ${formatRate(result.transportPerM)}/m` : '₹0.00/m · no price impact'}</p>
                <p><span className="font-semibold text-[var(--color-ink)]">Target margin:</span> {formatPercent(result.targetMarginPct)}</p>
                <p><span className="font-semibold text-[var(--color-ink)]">Quantity:</span> {quantity}</p>
                <p className="sm:col-span-2"><span className="font-semibold text-[var(--color-ink)]">Sections on:</span> {enabledSections.join(', ') || 'Core costing only'}{disabledSections.length > 0 ? ` · off: ${disabledSections.join(', ')}` : ''}</p>
            </div>
            {fullReuse && (
                <p className="mt-2 rounded-md border border-[var(--color-info-blue)]/25 bg-[var(--color-info-blue-soft)] px-2.5 py-2 text-[11px] font-medium leading-4 text-[var(--color-info-blue)]">
                    Full costing reuse: reopening this Saved Quality restores the recipe, these current yarn rates, overhead basis, commercial values, quantity, and section on/off states. Existing costing snapshots stay unchanged.
                </p>
            )}
        </section>
    )
}

function EstimatorLiveCostActions({
    isStandaloneCostingSession,
    mode,
    canUseProduction,
    allowsPartyOrders,
    allowsMarketRuns,
    sourceQuoteId,
    savingQuote,
    savingTemplate,
    appliedTemplate,
    hasActiveQualityRecipeChanges,
    canPersistCostResult,
    hasValidCostResult,
    quoteIsValid,
    qualityLabel,
    totalProductionCostPerM,
    hasOrderQty,
    partyName,
    exportReady,
    firstCostingReadinessMessage,
    actionReadinessMessage,
    actionReadinessId,
    topCostingActionLabel,
    onSaveCosting,
    onStartPartyOrder,
    onSaveAccepted,
    onExport,
    onSaveDraft,
    onStartMarketRun,
    onSwitchMarket,
    onSwitchQuote,
    onUpdateQuality,
    onSaveAsNewQuality,
    onNewQuality,
    onDismiss,
}: {
    isStandaloneCostingSession: boolean
    mode: EstimatorWorkflowMode
    canUseProduction: boolean
    allowsPartyOrders: boolean
    allowsMarketRuns: boolean
    sourceQuoteId: string | null
    savingQuote: boolean
    savingTemplate: boolean
    appliedTemplate: EstimatorTemplate | null
    hasActiveQualityRecipeChanges: boolean
    canPersistCostResult: boolean
    hasValidCostResult: boolean
    quoteIsValid: boolean
    qualityLabel: string
    totalProductionCostPerM: number
    hasOrderQty: boolean
    partyName: string
    exportReady: boolean
    firstCostingReadinessMessage: string | null
    actionReadinessMessage: string | null
    actionReadinessId: string
    topCostingActionLabel: string
    onSaveCosting: () => void
    onStartPartyOrder: () => void
    onSaveAccepted: () => void
    onExport: () => void
    onSaveDraft: () => void
    onStartMarketRun: () => void
    onSwitchMarket: () => void
    onSwitchQuote: () => void
    onUpdateQuality: () => void
    onSaveAsNewQuality: () => void
    onNewQuality: () => void
    onDismiss: () => void
}) {
    const requiresCommercialContext = !isStandaloneCostingSession
    const saveCostingDisabled = savingQuote
        || !canPersistCostResult
        || !hasValidCostResult
        || !qualityLabel.trim()
        || totalProductionCostPerM <= 0
        || (requiresCommercialContext && !hasOrderQty)
        || (requiresCommercialContext && !partyName.trim())
        || (requiresCommercialContext && !quoteIsValid)
    const qualitySaveLabel = appliedTemplate && hasActiveQualityRecipeChanges
        ? 'Quality changed · Update Quality'
        : appliedTemplate
            ? 'Quality unchanged'
            : 'Save as Quality'
    const runAction = (action: () => void) => {
        onDismiss()
        action()
    }

    return (
        <div className="space-y-3" data-testid="live-cost-action-hub">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-yarn-orange-dark)]">Actions</p>
                    <p className="mt-0.5 text-[10px] font-medium leading-4 text-[var(--color-muted)]">Save the current result, reuse the recipe, or open a utility.</p>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            aria-label="More costing actions"
                            title="More costing actions"
                            className="h-10 w-10 shrink-0 rounded-[10px] border-[var(--color-hairline)] bg-white"
                        >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem disabled={!exportReady} onSelect={() => runAction(onExport)}>
                            <FileDown className="h-4 w-4" aria-hidden="true" />
                            Export Cost Sheet
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => runAction(onNewQuality)}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            New Quality / Reset
                        </DropdownMenuItem>
                        {canUseProduction && !isStandaloneCostingSession && allowsMarketRuns && (
                            <DropdownMenuItem onSelect={() => runAction(onSwitchMarket)}>
                                <Gauge className="h-4 w-4" aria-hidden="true" />
                                Market Run
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {(mode === 'quote' || isStandaloneCostingSession) ? (
                <div className="grid gap-2 sm:grid-cols-2">
                    {canUseProduction && !isStandaloneCostingSession && (
                        <Button
                            id="btn-start-party-order"
                            type="button"
                            size="sm"
                            className="h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)]"
                            onClick={() => runAction(onStartPartyOrder)}
                            disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totalProductionCostPerM <= 0 || !quoteIsValid}
                            aria-busy={savingQuote}
                        >
                            {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Play className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">Start Party Order</span>
                        </Button>
                    )}
                    <div data-testid="save-costing-action-top" className={`min-w-0 ${canUseProduction && !isStandaloneCostingSession ? 'sm:col-span-1' : 'sm:col-span-2'}`}>
                        <Button
                            id="btn-save-accept"
                            data-testid="save-costing-action"
                            type="button"
                            size="sm"
                            variant="default"
                            className="h-12 w-full rounded-[10px] bg-[var(--color-yarn-orange)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] disabled:cursor-not-allowed disabled:opacity-55"
                            onClick={() => runAction(isStandaloneCostingSession ? onSaveCosting : onSaveAccepted)}
                            disabled={saveCostingDisabled}
                            aria-busy={savingQuote}
                            aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                            aria-label={isStandaloneCostingSession ? topCostingActionLabel : sourceQuoteId ? 'Save quotation with current status' : 'Save and accept quotation'}
                            title={firstCostingReadinessMessage ?? (saveCostingDisabled ? 'Complete the required inputs before saving.' : undefined)}
                        >
                            {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{isStandaloneCostingSession ? topCostingActionLabel : sourceQuoteId ? 'Save Quotation' : 'Save & Accept'}</span>
                        </Button>
                    </div>
                    {canUseProduction && !isStandaloneCostingSession && (
                        <Button
                            id="btn-save-quote"
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-12 rounded-[10px] border-[var(--color-hairline)] bg-white px-4 text-[13px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                            onClick={() => runAction(onSaveDraft)}
                            disabled={savingQuote || !quoteIsValid}
                            aria-busy={savingQuote}
                        >
                            {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Save className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">Save Quotation</span>
                        </Button>
                    )}
                    {canUseProduction && !isStandaloneCostingSession && !allowsPartyOrders && (
                        <Button type="button" variant="outline" size="sm" onClick={() => runAction(onSwitchMarket)} disabled={savingQuote} className="h-12 rounded-[10px]">
                            <Gauge className="h-3.5 w-3.5" /> Market Run
                        </Button>
                    )}
                </div>
            ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                    <Button
                        id="btn-start-market-run"
                        type="button"
                        size="sm"
                        className="h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-4 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => runAction(onStartMarketRun)}
                        disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totalProductionCostPerM <= 0 || !quoteIsValid}
                        aria-busy={savingQuote}
                    >
                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Gauge className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">Start Market Run</span>
                    </Button>
                    {allowsPartyOrders && (
                        <Button type="button" size="sm" variant="outline" className="h-12 rounded-[10px]" onClick={() => runAction(onSaveDraft)} disabled={savingQuote || !quoteIsValid}>
                            <Save className="h-3.5 w-3.5" /> <span className="truncate">Save Quotation</span>
                        </Button>
                    )}
                    {allowsPartyOrders && (
                        <Button type="button" size="sm" variant="outline" className="h-12 rounded-[10px]" onClick={() => runAction(onSwitchQuote)} disabled={savingQuote}>
                            <Play className="h-3.5 w-3.5" /> <span className="truncate">Party Order</span>
                        </Button>
                    )}
                </div>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-2">
                {appliedTemplate && hasActiveQualityRecipeChanges && (
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => runAction(onUpdateQuality)}
                        disabled={savingTemplate}
                        aria-busy={savingTemplate}
                        className="h-10 min-w-0 flex-1 rounded-[9px] border-[var(--color-yarn-orange)]/35 bg-white px-3 text-[12px] font-semibold text-[var(--color-yarn-orange-dark)] hover:bg-[var(--color-warning-amber-soft)] sm:flex-none"
                    >
                        {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        <span className="truncate">{qualitySaveLabel}</span>
                    </Button>
                )}
                <Button
                    type="button"
                    data-testid="save-as-new-quality"
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(onSaveAsNewQuality)}
                    className="h-10 min-w-0 flex-1 rounded-[9px] border-[var(--color-hairline)] bg-white px-3 text-[12px] font-semibold text-[var(--color-body)] hover:border-[var(--color-yarn-orange)] hover:bg-[var(--color-warning-amber-soft)] hover:text-[var(--color-yarn-orange-dark)] sm:flex-none"
                >
                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">Save as Quality</span>
                </Button>
                {appliedTemplate && !hasActiveQualityRecipeChanges && (
                    <span className="text-[10px] font-medium text-[var(--color-muted)]">{qualitySaveLabel}</span>
                )}
            </div>

            {actionReadinessMessage && (
                <p id={actionReadinessId} role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium leading-relaxed text-amber-800">
                    {actionReadinessMessage}
                </p>
            )}
        </div>
    )
}

function CapacityMetricField({
    label, value, unit, onChange, hint, ghostValue, placeholder,
}: {
    label: string
    value: number | null
    unit: string
    onChange: (value: number | null) => void
    hint?: string
    ghostValue?: number
    placeholder?: string
}) {
    const isGhostValue = ghostValue !== undefined && value === ghostValue
    return (
        <div className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2.5">
            <Label className="text-[10px] font-medium uppercase tracking-[0.05em] text-[var(--color-muted)]">{label}</Label>
            <div className="mt-1 flex items-end gap-1">
                <Input
                    type="number"
                    value={isGhostValue ? '' : (value ?? '')}
                    placeholder={isGhostValue ? (placeholder ?? String(ghostValue)) : placeholder}
                    onChange={e => onChange(parseNonNegativeInput(e.target.value))}
                    className="h-7 border-0 bg-transparent p-0 text-lg font-semibold text-[var(--color-ink)] placeholder:text-[var(--color-muted)] shadow-none focus-visible:ring-0"
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
    ghostValue,
    onChange,
}: {
    label: string
    value: string
    placeholder: string
    ghostValue?: string
    onChange: (value: string) => void
}) {
    const ghostText = ghostValue ?? placeholder
    const isGhostValue = Boolean(value?.trim()) && value.trim() === ghostText.trim()
    const inputValue = isGhostValue ? '' : value
    return (
        <div data-estimator-field="label" className="space-y-1.5 min-w-0">
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                {label}
            </Label>
            <Input
                    aria-label={label}
                value={inputValue}
                placeholder={isGhostValue ? ghostText : placeholder}
                onChange={e => onChange(e.target.value)}
                className={`h-11 rounded-[9px] border font-semibold placeholder:text-[var(--color-muted)] focus:border-[var(--color-yarn-orange)] focus:ring-[var(--color-yarn-orange)]/10 ${
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
            <div className="grid min-h-[52px] grid-cols-2 rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
                {(['formula', 'manual'] as YarnCalculationMode[]).map(mode => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => onChange(mode)}
                        aria-pressed={value === mode}
                        className={`min-h-11 rounded-[7px] px-1 text-[11px] font-semibold whitespace-nowrap transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
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

function formatWasteProvenance(
    rowWaste: number | null,
    defaultWaste: number,
    appliedWaste: number,
    formulaAdjustment: number,
) {
    const source = rowWaste !== null && rowWaste !== undefined ? 'Override' : 'Default'
    const sourceValue = rowWaste !== null && rowWaste !== undefined ? rowWaste : defaultWaste
    return `${source} ${sourceValue.toFixed(1)}% → applied after base yarn costing ${appliedWaste.toFixed(1)}% · total adjustment ${formulaAdjustment.toFixed(1)}%`
}

function RowCard({
    title,
    index,
    componentName,
    ratePerKg,
    onRemove,
    canRemove,
    kgPer100m,
    costPer100m,
    adjustmentPct,
    adjustmentDetail,
    showCalculatedValues = true,
    children,
    accent = 'indigo',
    isComplete = false,
}: {
    title: string
    index: number
    componentName?: string
    ratePerKg?: number
    onRemove: () => void
    canRemove: boolean
    kgPer100m: number
    costPer100m: number
    adjustmentPct?: number
    adjustmentDetail?: string
    showCalculatedValues?: boolean
    children: React.ReactNode
    accent?: 'indigo' | 'emerald'
    isComplete?: boolean
}) {
    const colors = {
        indigo:  { strip: 'bg-[#F6FAFD]', badge: 'bg-[#EEF5FB] text-[var(--color-info-blue)] border-[#D7E7F1]' },
        emerald: { strip: 'bg-[#F7FCF8]', badge: 'bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)] border-[#CDE5D3]' },
    }
    const c = colors[accent]
    const [expanded, setExpanded] = useState(false)
    const expandedManuallyRef = useRef(false)
    const cardRef = useRef<HTMLDivElement | null>(null)
    const detailsId = `yarn-component-${accent}-${index}-details`
    const displayName = componentName?.trim() || `${title} ${index + 1}`
    const costPerM = costPer100m / 100

    useEffect(() => {
        const mediaQuery = window.matchMedia('(min-width: 768px)')
        const syncToViewport = () => {
            if (!expandedManuallyRef.current) setExpanded(mediaQuery.matches)
        }
        syncToViewport()
        mediaQuery.addEventListener?.('change', syncToViewport)
        return () => mediaQuery.removeEventListener?.('change', syncToViewport)
    }, [])

    useEffect(() => {
        const el = cardRef.current
        if (!el) return
        const handleExpand = (e: Event) => {
            const customEvent = e as CustomEvent<{ focusFirst?: boolean }>
            expandedManuallyRef.current = true
            setExpanded(true)
            if (customEvent.detail?.focusFirst) {
                setTimeout(() => {
                    if (!cardRef.current) return
                    const inputs = findNavigableFormInputs(cardRef.current)
                    if (inputs.length > 0) {
                        focusAndSelectInput(inputs[0])
                    }
                }, 50)
            }
        }
        el.addEventListener('expand-row', handleExpand)
        return () => el.removeEventListener('expand-row', handleExpand)
    }, [])

    const handleRowKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== 'Enter' || event.shiftKey) return
        const isComposing = event.nativeEvent.isComposing
        if (isComposing) return
        if (event.defaultPrevented) return

        const target = event.target as HTMLElement | null
        if (!target || !cardRef.current) return
        if (target.tagName?.toUpperCase() === 'BUTTON') return

        const inputs = findNavigableFormInputs(cardRef.current)
        if (inputs.length === 0) return

        const currentIndex = inputs.indexOf(target)
        if (currentIndex === -1) return

        // If this is the last navigable input inside this card
        if (currentIndex === inputs.length - 1) {
            if (isComplete) {
                event.preventDefault()
                event.stopPropagation()

                // Minimize current card
                expandedManuallyRef.current = true
                setExpanded(false)

                // Advance to next row card or next form field
                const allRowCards = Array.from(document.querySelectorAll<HTMLElement>('[data-estimator-row]'))
                const currentCardIndex = allRowCards.indexOf(cardRef.current)

                if (currentCardIndex !== -1 && currentCardIndex < allRowCards.length - 1) {
                    const nextCard = allRowCards[currentCardIndex + 1]
                    nextCard.dispatchEvent(new CustomEvent('expand-row', {
                        bubbles: true,
                        detail: { focusFirst: true }
                    }))
                } else {
                    const container = cardRef.current.closest<HTMLElement>('[data-enter-navigate-container]') || document.body
                    const containerInputs = Array.from(container.querySelectorAll<HTMLElement>(DEFAULT_INPUT_SELECTOR))
                    const cardInputSet = new Set(inputs)
                    const targetIndexInContainer = containerInputs.indexOf(target)
                    let nextInput: HTMLElement | null = null

                    for (let i = targetIndexInContainer + 1; i < containerInputs.length; i++) {
                        const candidate = containerInputs[i]
                        if (!cardInputSet.has(candidate) && isElementNavigable(candidate)) {
                            nextInput = candidate
                            break
                        }
                    }

                    if (nextInput) {
                        setTimeout(() => {
                            focusAndSelectInput(nextInput!)
                        }, 50)
                    }
                }
            } else {
                // Find first incomplete input in this card
                const firstIncomplete = inputs.find(input => {
                    const inputEl = input as HTMLInputElement
                    const val = Number(inputEl.value)
                    return inputEl.value === '' || (Number.isFinite(val) && val <= 0)
                })
                if (firstIncomplete && firstIncomplete !== target) {
                    event.preventDefault()
                    event.stopPropagation()
                    focusAndSelectInput(firstIncomplete)
                }
            }
        }
    }

    return (
        <div
            ref={cardRef}
            data-estimator-row={`${accent === 'indigo' ? 'warpRows' : 'weftRows'}.${index}`}
            data-testid={`yarn-component-${accent}-${index}`}
            onKeyDown={handleRowKeyDown}
            className={`group overflow-hidden rounded-[12px] border transition-colors bg-[var(--color-canvas-white)] shadow-[0_1px_8px_rgba(30,37,40,0.035)] ${
                isComplete ? 'border-emerald-200/90' : 'border-[var(--color-hairline)]'
            }`}
        >
            <div className={`flex min-w-0 items-stretch gap-1 border-b border-[var(--color-hairline)] ${c.strip}`}>
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={detailsId}
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${displayName} details`}
                    onClick={() => {
                        expandedManuallyRef.current = true
                        setExpanded(value => !value)
                    }}
                    className="estimator-touch-target flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left outline-none transition-colors hover:bg-white/70 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] sm:px-4"
                >
                    <span
                        aria-label={isComplete ? `${displayName} complete` : `Step ${index + 1}`}
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] border font-semibold transition-colors duration-200 ${
                            isComplete
                                ? 'border-[#A3E0B5] bg-[#E8F8EE] text-[var(--color-factory-green)] shadow-sm'
                                : `${c.badge} text-[10px] uppercase tracking-[0.05em]`
                        }`}
                    >
                        {isComplete ? (
                            <Check className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
                        ) : (
                            index + 1
                        )}
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5 flex-wrap">
                            <span className="block break-words text-[13px] font-semibold leading-4 text-[var(--color-ink)]">{displayName}</span>
                            {isComplete && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                                    <Check className="h-2.5 w-2.5 stroke-[2.5]" /> Done
                                </span>
                            )}
                        </span>
                        <span className="mt-0.5 block break-words text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                            {title} · {showCalculatedValues ? `Base weight ${kgPer100m.toFixed(3)} kg/100m` : (isComplete ? 'Complete' : 'Complete inputs')}
                            {ratePerKg != null && ratePerKg > 0 ? ` · ₹${ratePerKg.toFixed(2)}/kg` : ''}
                        </span>
                    </span>
                    <span className="flex min-w-[4.25rem] shrink-0 flex-col items-end gap-1 text-right">
                        <span className={`break-words font-mono text-[12px] font-semibold tabular-nums ${showCalculatedValues ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}>
                            {showCalculatedValues ? `Base cost ₹${costPerM.toFixed(2)}/m` : '—'}
                        </span>
                        {adjustmentPct != null && showCalculatedValues && (
                            <span className={`max-w-full break-words rounded-[6px] border px-1.5 py-0.5 text-[9px] font-semibold leading-3 ${c.badge}`}>
                                Applied later {adjustmentPct.toFixed(1)}%
                            </span>
                        )}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform duration-200 motion-reduce:transition-none ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                {canRemove && (
                    <button
                        type="button"
                        aria-label={`Remove ${title}`}
                        title={`Remove ${displayName}`}
                        onClick={onRemove}
                        className="estimator-touch-target mr-1 inline-flex shrink-0 items-center justify-center rounded-md px-2 text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-risk-red)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] sm:mr-2"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>
            {expanded && (
                <div id={detailsId} className="border-t border-[var(--color-hairline)]/70 bg-white">
                    {adjustmentDetail && showCalculatedValues && (
                        <p className="border-b border-[var(--color-hairline)]/70 px-4 py-2 text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                            Manual workflow: calculate this base weight and cost first. {adjustmentDetail}
                        </p>
                    )}
                    {/* Warp rows have eight formula fields; four desktop columns keep the
                        fields balanced across two readable rows instead of leaving GST alone. */}
                    <div className={`grid gap-4 px-4 py-4 sm:grid-cols-2 md:grid-cols-3 [&_button]:text-xs [&_input]:text-sm [&_label]:text-xs [&_select]:text-sm ${accent === 'indigo' ? 'lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4' : 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-5'}`}>
                        {children}
                    </div>
                </div>
            )}
        </div>
    )
}

type WeavingRateInputMode = 'perMeter' | 'perPick'

function getDirectWeavingRateInput(
    perPickCostPaisa: number | string | null | undefined,
    weftRows: Array<Pick<WeftRow, 'picks'>>,
) {
    const totalPicks = weftRows.reduce((sum, row) => sum + Number(row.picks ?? 0), 0)
    const ratePerMeter = Number(perPickCostPaisa ?? 0) * totalPicks
    return Number.isFinite(ratePerMeter) && ratePerMeter > 0
        ? ratePerMeter.toFixed(2)
        : ''
}

function getTemplateDirectWeavingRateInput(template: EstimatorTemplate, state: EstimateState) {
    const weftRows = template.weft_rows && template.weft_rows.length > 0
        ? template.weft_rows
        : state.weftRows
    return getDirectWeavingRateInput(
        template.per_pick_cost_paise ?? state.perPickCostPaisa,
        weftRows,
    )
}

function WeavingRateFields({
    state,
    dispatch,
    totals,
    hasValidCostResult,
    inputMode,
    onInputModeChange,
    directRateInput,
    onDirectRateInputChange,
}: {
    state: EstimateState
    dispatch: React.Dispatch<Action>
    totals: EstimatorV3Totals
    hasValidCostResult: boolean
    inputMode: WeavingRateInputMode
    onInputModeChange: (mode: WeavingRateInputMode) => void
    directRateInput: string
    onDirectRateInputChange: (value: string) => void
}) {
    const totalPicks = state.weftRows.reduce((sum, row) => sum + row.picks, 0)
    const calculatedRatePerM = totalPicks > 0 ? state.perPickCostPaisa * totalPicks : 0
    const directRatePlaceholder = inputMode === 'perMeter' && calculatedRatePerM > 0
        ? calculatedRatePerM.toFixed(2)
        : inputMode === 'perMeter' ? 'e.g. 8.00' : 'e.g. 16'
    const paisaPerPickDisplay = state.perPickCostPaisa > 0
        ? Math.round(state.perPickCostPaisa * 100 * 10000) / 10000
        : ''
    const rateInputId = inputMode === 'perMeter' ? 'weaving-rate-per-meter' : 'weaving-rate-paisa-per-pick'
    const isRateEmpty = inputMode === 'perMeter'
        ? (parseNonNegativeInput(directRateInput) ?? 0) <= 0
        : state.perPickCostPaisa <= 0

    // If the owner enters the direct ₹/m rate before completing the PPI
    // fields, apply it as soon as total picks become available.
    useEffect(() => {
        if (inputMode !== 'perMeter') return
        const directRate = parseNonNegativeInput(directRateInput)
        if (directRate === null || totalPicks <= 0) return
        const nextPerPickCost = calcPerPickCostFromWeavingRate(directRate, totalPicks)
        if (nextPerPickCost !== state.perPickCostPaisa) {
            dispatch({ type: 'SET', field: 'perPickCostPaisa', value: nextPerPickCost })
        }
    }, [directRateInput, dispatch, inputMode, state.perPickCostPaisa, totalPicks])

    const handleInputModeChange = (nextMode: WeavingRateInputMode) => {
        onDirectRateInputChange('')
        onInputModeChange(nextMode)
    }

    return (
        <div className="space-y-3 rounded-[10px] border border-[var(--color-warning-amber-soft)] bg-[var(--color-canvas)] px-3 py-3 sm:px-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <Banknote className="h-4 w-4 text-[var(--color-warning-amber)]" />
                    <p className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-warning-amber)]">Weaving rate input</p>
                </div>
                <div className="flex items-center gap-2" role="group" aria-label="Weaving rate input mode">
                    <span className="text-[10px] font-medium text-[var(--color-muted)]">Enter as</span>
                    <div className="inline-flex rounded-[8px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] p-0.5">
                        <button
                            type="button"
                            aria-pressed={inputMode === 'perMeter'}
                            onClick={() => handleInputModeChange('perMeter')}
                            className={`rounded-[6px] px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${inputMode === 'perMeter' ? 'bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-body)]'}`}
                        >
                            Weaving rate (₹/m)
                        </button>
                        <button
                            type="button"
                            aria-pressed={inputMode === 'perPick'}
                            onClick={() => handleInputModeChange('perPick')}
                            className={`rounded-[6px] px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${inputMode === 'perPick' ? 'bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-body)]'}`}
                        >
                            Paisa per pick
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={rateInputId} className="flex h-8 items-end text-[10px] font-medium uppercase tracking-wider text-[var(--color-warning-amber)]">
                        {inputMode === 'perMeter' ? 'Weaving rate — REQUIRED' : 'Paisa per pick — REQUIRED'}
                    </Label>
                    <div className="relative">
                        <Input
                            id={rateInputId}
                            data-estimator-field="perPickCostPaisa"
                            aria-label={inputMode === 'perMeter' ? 'Weaving rate in rupees per metre' : 'Paisa per pick'}
                            type="number"
                            min={0}
                            step={inputMode === 'perMeter' ? 0.01 : 0.1}
                            placeholder={directRatePlaceholder}
                            value={inputMode === 'perMeter' ? directRateInput : paisaPerPickDisplay}
                            onChange={event => {
                                const raw = event.target.value
                                if (inputMode === 'perMeter') {
                                    onDirectRateInputChange(raw)
                                    const directRate = parseNonNegativeInput(raw)
                                    if (directRate === null) {
                                        dispatch({ type: 'SET', field: 'perPickCostPaisa', value: 0 })
                                    } else if (totalPicks > 0) {
                                        dispatch({
                                            type: 'SET',
                                            field: 'perPickCostPaisa',
                                            value: calcPerPickCostFromWeavingRate(directRate, totalPicks),
                                        })
                                    }
                                    return
                                }

                                const paisa = parseNonNegativeInput(raw)
                                if (paisa === null) {
                                    onDirectRateInputChange('')
                                    dispatch({ type: 'SET', field: 'perPickCostPaisa', value: 0 })
                                    return
                                }
                                onDirectRateInputChange('')
                                dispatch({ type: 'SET', field: 'perPickCostPaisa', value: paisa / 100 })
                            }}
                            onFocus={event => {
                                if (inputMode === 'perMeter') event.currentTarget.select()
                            }}
                            aria-invalid={isRateEmpty || undefined}
                            className={`h-11 rounded-[9px] border pr-16 text-center text-xs font-semibold text-[var(--color-warning-amber)] placeholder:text-[var(--color-muted)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isRateEmpty ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] placeholder:text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)]'}`}
                        />
                        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-medium text-[var(--color-muted)]">
                            {inputMode === 'perMeter' ? '₹/m' : 'paise/pick'}
                        </span>
                    </div>
                    <InlineInputWarning show={isRateEmpty}>Required</InlineInputWarning>
                    {inputMode === 'perMeter' && (
                        <p className="text-[10px] font-medium leading-tight text-[var(--color-muted)]">
                            Converted from {totalPicks} total picks to paise per pick.
                        </p>
                    )}
                </div>

                <div className="rounded-[10px] border border-[var(--color-warning-amber-soft)] bg-[var(--color-canvas-white)] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-warning-amber)]">Calculated loom cost</p>
                    <p className="mt-1 font-mono text-xl font-semibold text-[var(--color-warning-amber)]">{formatCalculatedMoney(totals.weaveCostPerM, hasValidCostResult, '/m')}</p>
                    <p className="mt-1 text-[10px] text-[var(--color-muted)]">
                        {totalPicks} total picks × {paisaPerPickDisplay || '—'} paise per pick
                    </p>
                </div>
            </div>

            {hasValidCostResult && totals.weaveCostPerM > 100 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 shadow-sm">
                    <span className="shrink-0 text-sm">⚠️</span>
                    <div>
                        <p className="font-bold">Unusually High Weave Cost ({formatCalculatedMoney(totals.weaveCostPerM, hasValidCostResult, '/m')})</p>
                        <p className="mt-0.5 font-medium text-amber-700">Check that the weaving rate and unit are correct.</p>
                    </div>
                </div>
            )}
        </div>
    )
}

// setPartyName={setPartyName} remains the QuickCostingView prop contract; the owner wrapper marks a user edit.
function QuickCostingView({
    state,
    dispatch,
    totals,
    costingResult,
    hasValidCostResult,
    qualityLabel,
    setQualityLabel,
    partyName,
    setPartyName,
    partyNames,
    partyHint,
    showPartyField,
    qualityLocked,
    canUseProduction,
    widthUnit,
    onWidthUnitChange,
    onOpenOverheadDetails,
    onOverheadModeChange,
    weavingRateInputMode,
    onWeavingRateInputModeChange,
    directWeavingRateInput,
    onDirectWeavingRateInputChange,
}: {
    state: EstimateState
    dispatch: React.Dispatch<Action>
    totals: EstimatorV3Totals
    costingResult: CostingResultSnapshot
    hasValidCostResult: boolean
    qualityLabel: string
    setQualityLabel: (value: string) => void
    partyName: string
    setPartyName: (value: string) => void
    partyNames: string[]
    partyHint: { quality_label: string; quote_price_per_meter: number; created_at: string } | null
    showPartyField: boolean
    qualityLocked: boolean
    canUseProduction: boolean
    widthUnit: 'cm' | 'inch'
    onWidthUnitChange: (value: 'cm' | 'inch') => void
    onOpenOverheadDetails: () => void
    onOverheadModeChange: (mode: OverheadMode) => void
    weavingRateInputMode: WeavingRateInputMode
    onWeavingRateInputModeChange: (mode: WeavingRateInputMode) => void
    directWeavingRateInput: string
    onDirectWeavingRateInputChange: (value: string) => void
}) {
    const { t } = useTranslation()
    const directRateMissing = state.overheadMode === 'direct' && (!state.overheadOverridePerM || state.overheadOverridePerM <= 0)

    return (
        <div
            className="space-y-3"
            data-enter-navigate-container="true"
            onKeyDown={handleEnterKeyNavigation}
        >
            <EstimatorCard accent="neutral">
                <SectionHeader title="Quality basics" icon={Layers} accent="neutral" step={1} />
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                    {showPartyField && (
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label className="text-[10px] font-bold uppercase text-slate-500">Party / Customer</Label>
                            <Input
                                list="quick-estimator-party-options"
                                value={partyName}
                                onChange={event => setPartyName(event.target.value)}
                                placeholder="e.g. Sundaram Textiles"
                                className="h-11 border-slate-200 font-bold"
                            />
                            <datalist id="quick-estimator-party-options">
                                {partyNames.map(name => <option key={name} value={name} />)}
                            </datalist>
                            <p className="text-[10px] font-medium leading-normal text-slate-400">Required for a broader factory quotation or party-order workflow.</p>
                            {partyHint && (
                                <p className="flex items-center gap-1 text-[10px] text-slate-500">
                                    <span className="text-blue-500">💡</span>
                                    Last quotation: <span className="font-bold text-slate-700">₹{partyHint.quote_price_per_meter.toFixed(2)}/m</span>
                                    {' '}for <span className="font-medium">{partyHint.quality_label}</span>
                                </p>
                            )}
                        </div>
                    )}
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase text-slate-500">Fabric quality name — REQUIRED</Label>
                        <Input
                            data-estimator-field="qualityLabel"
                            aria-label="Fabric quality name"
                            value={qualityLabel}
                            readOnly={qualityLocked}
                            onChange={event => setQualityLabel(event.target.value)}
                            placeholder="e.g. 60g Georgette, D.246, Japan Satin"
                            className="h-11 border-slate-200 font-bold"
                        />
                        <p className="text-[10px] font-medium leading-normal text-slate-400">Use the name your staff and repeat customers will recognise.</p>
                    </div>
                    <NumField fieldKey="warpCrimpPct"
                        label="Warp crimp (take-up)"
                        value={state.warpCrimpPct}
                        onChange={value => dispatch({ type: 'SET', field: 'warpCrimpPct', value: value ?? 0 })}
                        unit="%"
                        step={0.5}
                        ghostValue={DEFAULT_WARP_CRIMP_PCT}
                        placeholder={String(DEFAULT_WARP_CRIMP_PCT)}
                        hint="Applied to warp consumption and beam planning."
                    />
                    <NumField fieldKey="yarnShortagePct"
                        label="Default yarn waste"
                        value={state.yarnShortagePct}
                        onChange={value => dispatch({ type: 'SET', field: 'yarnShortagePct', value: value ?? 0 })}
                        unit="%"
                        step={0.5}
                        preserveZero
                        ghostValue={0}
                        placeholder="0"
                        hint="Used when a yarn row has no row-specific waste."
                    />
                    {canUseProduction && (
                        <NumField fieldKey="tapeLengthM"
                            label="Tape length per beam"
                            value={state.tapeLengthM}
                            onChange={value => dispatch({ type: 'SET', field: 'tapeLengthM', value: value ?? 0 })}
                            unit="m"
                            placeholder="e.g. 1000"
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
                    badgeContent={<SectionCostPill value={totals.yarnBaseWarpPerM} valid={hasValidCostResult} />}
                />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    {state.warpRows.map((row, index) => (
                        <RowCard
                            key={row.id}
                            title="Warp yarn"
                            index={index}
                            componentName={row.label}
                            ratePerKg={row.yarnRate}
                            accent="indigo"
                            canRemove={state.warpRows.length > 1}
                            onRemove={() => dispatch({ type: 'REMOVE_WARP_ROW', id: row.id })}
                            kgPer100m={totals.warpRows[index]?.baseKgPer100mUsed ?? 0}
                            costPer100m={totals.warpRows[index]?.baseCostPer100m ?? 0}
                            adjustmentPct={totals.warpRows[index]?.totalAdjustmentPct ?? 0}
                            adjustmentDetail={formatWasteProvenance(
                                row.shortagePct,
                                totals.warpRows[index]?.defaultWastePct ?? state.yarnShortagePct,
                                totals.warpRows[index]?.wastePct ?? state.yarnShortagePct,
                                totals.warpRows[index]?.totalAdjustmentPct ?? 0,
                            )}
                            showCalculatedValues={hasValidCostResult}
                            isComplete={isWarpRowFilled(row)}
                        >
                            <CalculationModeField
                                value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calculationMode', value })}
                            />
                            <LayerNameField label="Yarn component name" value={row.label ?? ''} placeholder={`Warp ${index + 1}`} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'label', value })} />
                            {row.calculationMode === 'manual' ? (
                                <NumField fieldKey="manualKgPer100m" label="Warp consumption" value={row.manualKgPer100m ?? null} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'manualKgPer100m', value })} unit="kg/100m" step={0.001} placeholder="e.g. 3.25" attentionWhenEmpty />
                            ) : (
                                <>
                                    <YarnDensityFields row={row} onChange={(field, value) => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value })} />
                                    <NumField fieldKey="beamEnds" label="Beam ends — REQUIRED" value={row.beamEnds} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: value ?? 0 })} placeholder="e.g. 3200" attentionWhenEmpty />
                                </>
                            )}
                            <NumField fieldKey="shortagePct" label="Waste" value={row.shortagePct} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} hint={`Blank uses ${state.yarnShortagePct ?? 0}% default; 0 overrides`} />
                            <NumField fieldKey="yarnRate" label={`${t('common.current_yarn_rate')} — REQUIRED`} value={row.yarnRate} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: value ?? 0 })} unit="₹/kg" step={1} placeholder="e.g. 110" attentionWhenEmpty />
                            <NumField fieldKey="gstPct" label="GST" value={row.gstPct} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: value ?? 0 })} unit="%" step={0.5} placeholder="e.g. 5" />
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
                    badgeContent={<div className="flex items-center gap-2"><div className="flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5"><button type="button" onClick={() => onWidthUnitChange('cm')} className={`px-2 py-1 text-[10px] font-semibold uppercase ${widthUnit === 'cm' ? 'rounded bg-white text-[var(--color-factory-green)] shadow-sm' : 'text-[var(--color-muted)]'}`}>cm</button><button type="button" onClick={() => onWidthUnitChange('inch')} className={`px-2 py-1 text-[10px] font-semibold uppercase ${widthUnit === 'inch' ? 'rounded bg-white text-[var(--color-factory-green)] shadow-sm' : 'text-[var(--color-muted)]'}`}>inch</button></div><SectionCostPill value={totals.yarnBaseWeftPerM} valid={hasValidCostResult} /></div>}
                />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    {state.weftRows.map((row, index) => {
                        const effectiveCostingWidthCm = getEffectiveCostingWidthCm(row)
                        return (
                            <RowCard key={row.id} title="Weft yarn" index={index} componentName={row.label} ratePerKg={row.yarnRate} accent="emerald" canRemove={state.weftRows.length > 1} onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })} kgPer100m={totals.weftRows[index]?.baseKgPer100mUsed ?? 0} costPer100m={totals.weftRows[index]?.baseCostPer100m ?? 0} adjustmentPct={totals.weftRows[index]?.totalAdjustmentPct ?? 0} adjustmentDetail={formatWasteProvenance(row.shortagePct, totals.weftRows[index]?.defaultWastePct ?? state.yarnShortagePct, totals.weftRows[index]?.wastePct ?? state.yarnShortagePct, totals.weftRows[index]?.totalAdjustmentPct ?? 0)} showCalculatedValues={hasValidCostResult} isComplete={isWeftRowFilled(row)}>
                                <CalculationModeField value={row.calculationMode === 'manual' ? 'manual' : 'formula'} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calculationMode', value })} />
                                <LayerNameField label="Yarn component name" value={row.label ?? ''} placeholder={`Weft ${index + 1}`} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'label', value })} />
                                <NumField fieldKey="picks" label="Picks — REQUIRED" value={row.picks} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: value ?? 0 })} unit="PPI" placeholder="e.g. 68" hint="PPI means picks per inch: weft threads in one inch." attentionWhenEmpty />
                                <WidthField label={`Effective costing width (finished width)${row.calculationMode === 'manual' ? '' : ' — REQUIRED'}`} value={effectiveCostingWidthCm} onChange={value => { dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value }); dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value }) }} unit={widthUnit} placeholder={widthUnit === 'inch' ? 'e.g. 63' : 'e.g. 160'} hint={row.calculationMode === 'manual' ? 'Finished cloth width; saved for audit.' : 'Finished cloth width, not reed width; used with PPI.'} attentionWhenEmpty={row.calculationMode !== 'manual'} />
                                {row.calculationMode === 'manual' ? (
                                    <NumField fieldKey="manualKgPer100m" label="Weft consumption" value={row.manualKgPer100m ?? null} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'manualKgPer100m', value })} unit="kg/100m" step={0.001} placeholder="e.g. 2.75" attentionWhenEmpty />
                                ) : (
                                    <YarnDensityFields row={row} onChange={(field, value) => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value })} />
                                )}
                                <NumField fieldKey="shortagePct" label="Waste" value={row.shortagePct} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} hint={`Blank uses ${state.yarnShortagePct ?? 0}% default; 0 overrides`} />
                            <NumField fieldKey="yarnRate" label={`${t('common.current_yarn_rate')} — REQUIRED`} value={row.yarnRate} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: value ?? 0 })} unit="₹/kg" step={1} placeholder="e.g. 110" attentionWhenEmpty />
                                <NumField fieldKey="gstPct" label="GST" value={row.gstPct} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: value ?? 0 })} unit="%" step={0.5} placeholder="e.g. 5" />
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
                    <WeavingRateFields
                        state={state}
                        dispatch={dispatch}
                        totals={totals}
                        hasValidCostResult={hasValidCostResult}
                        inputMode={weavingRateInputMode}
                        onInputModeChange={onWeavingRateInputModeChange}
                        directRateInput={directWeavingRateInput}
                        onDirectRateInputChange={onDirectWeavingRateInputChange}
                    />
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="post">
                <SectionHeader title="Warping and sizing" icon={TrendingUp} accent="post" step={5} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} valid={hasValidCostResult} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Warping Group */}
                        <div className="space-y-3">
                            <div className="space-y-1.5 min-w-0">
                                <div className="flex items-end justify-between h-8">
                                    <Label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                                        Warping
                                    </Label>
                                    {state.warpingMode === 'in_house' && (
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">
                                            ₹0 · in overhead
                                        </span>
                                    )}
                                </div>
                                <div className="grid h-11 grid-cols-2 rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'SET', field: 'warpingMode', value: 'in_house' })}
                                        aria-pressed={state.warpingMode === 'in_house'}
                                        className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                            state.warpingMode === 'in_house'
                                                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        In-house
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'SET', field: 'warpingMode', value: 'outsourced' })}
                                        aria-pressed={state.warpingMode === 'outsourced'}
                                        className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                            state.warpingMode === 'outsourced'
                                                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        Outsourced
                                    </button>
                                </div>
                            </div>
                            {state.warpingMode === 'outsourced' && (
                                <NumField
                                    fieldKey="warpingRatePerKg"
                                    label="Warping rate"
                                    value={state.warpingRatePerKg}
                                    onChange={value => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: value ?? 0 })}
                                    unit="₹/kg"
                                    step={0.1}
                                    placeholder="e.g. 8"
                                    attentionWhenEmpty
                                />
                            )}
                        </div>

                        {/* Sizing Group */}
                        <div className="space-y-3">
                            <div className="space-y-1.5 min-w-0">
                                <div className="flex items-end justify-between h-8">
                                    <Label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                                        Sizing
                                    </Label>
                                    {state.sizingMode === 'in_house' && (
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">
                                            ₹0 · in overhead
                                        </span>
                                    )}
                                </div>
                                <div className="grid h-11 grid-cols-2 rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'in_house' })}
                                        aria-pressed={state.sizingMode === 'in_house'}
                                        className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                            state.sizingMode === 'in_house'
                                                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        In-house
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'outsourced' })}
                                        aria-pressed={state.sizingMode === 'outsourced'}
                                        className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                            state.sizingMode === 'outsourced'
                                                ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                        }`}
                                    >
                                        Outsourced
                                    </button>
                                </div>
                            </div>
                            {state.sizingMode === 'outsourced' && (
                                <NumField
                                    fieldKey="sizingRatePerKg"
                                    label="Sizing rate"
                                    value={state.sizingRatePerKg}
                                    onChange={value => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: value ?? 0 })}
                                    unit="₹/kg"
                                    step={0.5}
                                    placeholder="e.g. 10"
                                    attentionWhenEmpty
                                />
                            )}
                        </div>
                    </div>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="overhead">
                <SectionHeader title="Factory overhead" icon={Calculator} accent="overhead" step={6} badgeContent={<SectionCostPill value={costingResult.overheadPerM} valid={hasValidCostResult} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <button type="button" aria-pressed={state.overheadMode === 'direct'} onClick={() => onOverheadModeChange('direct')} className={`rounded-[10px] border px-3 py-3 text-left ${state.overheadMode === 'direct' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)]'}`}>
                            <p className="text-[12px] font-semibold text-[var(--color-ink)]">Direct overhead rate</p>
                            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Enter the rate used in this costing; it is never inferred.</p>
                        </button>
                        <button type="button" aria-pressed={state.overheadMode === 'monthly_expenses'} onClick={() => onOverheadModeChange('monthly_expenses')} className={`rounded-[10px] border px-3 py-3 text-left ${state.overheadMode === 'monthly_expenses' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)]'}`}>
                            <p className="text-[12px] font-semibold text-[var(--color-ink)]">Monthly expenses ÷ output</p>
                            <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Use saved monthly expenses ÷ standard production.</p>
                        </button>
                    </div>
                    {state.overheadMode === 'direct' ? (
                        <NumField fieldKey="overheadOverridePerM" label="Direct factory overhead — REQUIRED" value={state.overheadOverridePerM} onChange={value => dispatch({ type: 'SET', field: 'overheadOverridePerM', value })} unit="₹/m" step={0.1} placeholder="e.g. 12.50" attentionWhenEmpty />
                    ) : (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                            <NumField fieldKey="monthlyOutputM" label="Standard monthly production" value={state.monthlyOutputM} onChange={value => dispatch({ type: 'SET', field: 'monthlyOutputM', value: value ?? 0 })} unit="m/mo" step={100} placeholder="e.g. 90,000" attentionWhenEmpty hint="Normal monthly running metres used as the costing denominator." />
                            <Button type="button" variant="outline" className="h-11 gap-1.5" onClick={onOpenOverheadDetails}><Calculator className="h-3.5 w-3.5" /> Edit expenses</Button>
                        </div>
                    )}
                    {directRateMissing && <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Enter a direct rate greater than ₹0/m before saving.</p>}
                    <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                        <span className="text-[11px] font-medium text-[var(--color-muted)]">Used in this costing</span>
                        <span className="font-mono text-base font-semibold text-[var(--color-risk-red)]">{formatCalculatedMoney(costingResult.overheadPerM, hasValidCostResult, '/m')}</span>
                    </div>
                    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-[10px] text-[var(--color-muted)]">
                        <span className="font-semibold text-[var(--color-body)]">Source:</span> {assumptionSourceLabel(costingResult.overheadSource)}
                        {' · '}
                        <span className="font-semibold text-[var(--color-body)]">Reference:</span> {costingResult.overheadReferencePerM == null ? 'not entered' : `₹${costingResult.overheadReferencePerM.toFixed(2)}/m`}
                        {' · '}
                        <span className="font-semibold text-[var(--color-body)]">Impact:</span> {formatSignedRupees(costingResult.overheadPriceImpactPerM)}/m cost
                    </div>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="neutral">
                <SectionHeader
                    title={t("estimator.simulation.base_title")}
                    detail={<p className="text-[11px] text-[var(--color-muted)] font-normal">{t("estimator.simulation.base_description")}</p>}
                    icon={Coins}
                    accent="neutral"
                    step={7}
                />
                <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-5">
                    <NumField fieldKey="profitPct" label="Target margin" value={state.profitPct} onChange={value => dispatch({ type: 'SET', field: 'profitPct', value: value ?? 0 })} unit="%" step={0.5} placeholder="e.g. 10" hint="Your desired profit above break-even." />
                    <NumField fieldKey="commissionPct" label="Broker commission" value={state.commissionPct} onChange={value => dispatch({ type: 'SET', field: 'commissionPct', value: value ?? 0 })} unit="%" step={0.5} placeholder="e.g. 2" hint="Broker or agent share of the selling price." />
                    <NumField fieldKey="transportPerM" label="Transport charge" value={state.transportPerM} onChange={value => dispatch({ type: 'SET', field: 'transportPerM', value: value ?? 0 })} unit="₹/m" step={0.1} placeholder="e.g. 1.50" hint="Delivery cost added per metre." />
                    <NumField fieldKey="orderQuantityM" label="Costing quantity" value={state.orderQuantityM} onChange={value => dispatch({ type: 'SET', field: 'orderQuantityM', value })} unit="m" step={100} placeholder="Optional" hint="Needed for order-level profit and quotations." />
                </CardContent>
            </EstimatorCard>
        </div>
    )
}

const DETAILED_ESTIMATOR_ISSUE_FIELDS = new Set([
    'loomType',
    'loomRpm',
    'loomPowerKw',
    'hoursPerShift',
    'loomCount',
    'monthlyWorkingDays',
    'avgOutputPerLoomPerDay',
])

const ESTIMATOR_ISSUE_LABEL_MATCHERS: Array<{ matches: (field: string) => boolean; labels: string[] }> = [
    { matches: field => field.endsWith('.calcDenier') || field.endsWith('.effectiveDenier'), labels: ['denier'] },
    { matches: field => field.endsWith('.beamEnds'), labels: ['beam ends'] },
    { matches: field => field.endsWith('.picks'), labels: ['picks'] },
    { matches: field => field.endsWith('.effectiveCostingWidthCm'), labels: ['effective costing width'] },
    { matches: field => field.endsWith('.yarnRate'), labels: ['current yarn rate', 'yarn rate'] },
    { matches: field => field.endsWith('.gstPct'), labels: ['gst'] },
    { matches: field => field.endsWith('.manualKgPer100m'), labels: ['consumption'] },
    { matches: field => field === 'tapeLengthM', labels: ['tape length'] },
    { matches: field => field === 'perPickCostPaisa', labels: ['weaving rate', 'weave rate'] },
    { matches: field => field === 'warpingRatePerKg', labels: ['warping rate'] },
    { matches: field => field === 'sizingRatePerKg', labels: ['sizing rate'] },
    { matches: field => field === 'windingRatePerKg', labels: ['winding rate'] },
    { matches: field => field === 'processingRatePerM', labels: ['processing rate', 'processing'] },
    { matches: field => field === 'finishingRatePerM', labels: ['finishing rate', 'finishing'] },
    { matches: field => field === 'overheadOverridePerM', labels: ['direct factory overhead', 'direct overhead rate'] },
    { matches: field => field === 'monthlyOutputM', labels: ['standard monthly production', 'monthly production'] },
    { matches: field => field === 'commissionPct', labels: ['broker commission', 'commission %'] },
    { matches: field => field === 'profitPct', labels: ['target margin', 'profit margin'] },
    { matches: field => field === 'transportPerM', labels: ['transport charge', 'transport per meter'] },
    { matches: field => field === 'orderQuantityM', labels: ['costing quantity', 'order quantity'] },
    { matches: field => field === 'warpCrimpPct', labels: ['warp crimp'] },
    { matches: field => field === 'yarnShortagePct', labels: ['default yarn waste'] },
]

function findEstimatorIssueTarget(field: string): { element: HTMLElement; inputElement?: HTMLElement; isYarnRow: boolean } | null {
    if (typeof document === 'undefined') return null
    const target = getEstimatorFieldTarget(field)
    const row = target.row ? document.querySelector<HTMLElement>(`[data-estimator-row="${target.row}"]`) : null
    if (target.row && !row) return null
    const scope = row ?? document
    const control = target.field ? Array.from(scope.querySelectorAll<HTMLElement>('[data-estimator-field]')).find(element => element.dataset.estimatorField?.toLowerCase() === target.field?.toLowerCase()) : null
    if (control) {
        const input = control.matches('input, select, textarea') ? control : control.querySelector<HTMLElement>('input, select, textarea')
        return { element: row ?? control, inputElement: input ?? undefined, isYarnRow: Boolean(row) }
    }
    if (row) return { element: row, isYarnRow: true }
    const matcher = ESTIMATOR_ISSUE_LABEL_MATCHERS.find(candidate => candidate.matches(field))
    const label = matcher && Array.from(document.querySelectorAll('label')).find(candidate => matcher.labels.some(term => candidate.textContent?.trim().toLowerCase().includes(term)))
    return label?.parentElement ? { element: label.parentElement, isYarnRow: false } : null
}

function focusEstimatorIssueTarget(field: string) {
    const target = findEstimatorIssueTarget(field)
    const fallback = typeof document === 'undefined' ? null : document.getElementById('estimator-save-validation-summary')
    const element = target?.element ?? fallback
    if (!element) return
    if (target?.isYarnRow) element.querySelector<HTMLButtonElement>('button[aria-expanded="false"]')?.click()
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    element.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' })
    window.setTimeout(() => {
        // Fields may mount only after opening the collapsed yarn component.
        const opened = findEstimatorIssueTarget(field)
        const input = opened?.inputElement ?? opened?.element.querySelector<HTMLElement>('input, select, textarea')
        if (input) input.focus({ preventScroll: true })
        else { element.tabIndex = -1; element.focus({ preventScroll: true }) }
    }, target?.isYarnRow ? 180 : 0)
}

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
    const { t, tx, language } = useTranslation()
    const searchParams = useSearchParams()
    const router = useRouter()
    const prefersReducedMotion = useReducedMotion()

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
        return buildEstimatorBaseline(initialProfile, initialWorkers ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run once — initialProfile is stable

    const [state, rawDispatch] = useReducer(estimateReducer, initialState)
    const [loading,   setLoading]   = useState(false)
    const [saving,    setSaving]    = useState(false)
    const [savingQuote, setSavingQuote] = useState(false)
    const saveQuoteLockRef = useRef(false)
    const [showMachineSetup, setShowMachineSetup] = useState(false)
    const machineSetupContinuationRef = useRef<(() => void) | null>(null)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templates, setTemplates] = useState<EstimatorTemplate[]>(initialTemplates ?? [])
    const [templatesLoaded, setTemplatesLoaded] = useState(initialTemplates !== undefined)
    const [secondaryError, setSecondaryError] = useState<string | null>(null)
    const secondaryDataRequestRef = useRef<ReturnType<typeof getEstimatorSecondaryData> | null>(null)
    const [outputSuggestion, setOutputSuggestion] = useState<EstimateState['outputSuggestion'] | null>(null)
    const [isSuggestingOutput, setIsSuggestingOutput] = useState(false)

    // The direct ₹/m entry is the default; the per-pick mode remains available
    // for factories that already keep their rate book in paise per pick.
    const [weavingRateInputMode, setWeavingRateInputMode] = useState<WeavingRateInputMode>('perMeter')
    const [directWeavingRateInput, setDirectWeavingRateInput] = useState<string>('')

    const [partyName,       setPartyName]       = useState('')
    const [partyNames,      setPartyNames]      = useState(initialPartyNames)
    const [staleRateNames,  setStaleRateNames]  = useState(staleDefaultRateNames)
    const [qualityLabel,    setQualityLabel]    = useState('')
    const [warpInstruction, setWarpInstruction] = useState('')
    const [weftInstruction, setWeftInstruction] = useState('')
    const lastGeneratedWarp = useRef<string | null>(null)
    const lastGeneratedWeft = useRef<string | null>(null)
    const [sourceQuoteId, setSourceQuoteId] = useState<string | null>(null)
    const [sourceQuoteUpdatedAt, setSourceQuoteUpdatedAt] = useState<string | null>(null)
    const [sourceQuoteVersionNumber, setSourceQuoteVersionNumber] = useState<number | null>(null)
    const [sourceQuoteCreatedAt, setSourceQuoteCreatedAt] = useState<string | null>(null)
    const [sourceQuoteStatus, setSourceQuoteStatus] = useState<EstimatorQuoteStatus | null>(null)
    const [sourceState, setSourceState] = useState<EstimateState | null>(null)
    const [sourceFactoryProfileUpdatedAt, setSourceFactoryProfileUpdatedAt] = useState<string | null>(null)
    const [sourceRecordKind, setSourceRecordKind] = useState<CostingRecordKind | null>(null)
    const [appliedTemplate,   setAppliedTemplate]   = useState<EstimatorTemplate | null>(null)
    const estimatorOpenedRef = useRef(false)
    const costingStartedRef = useRef(false)

    const [journey, setJourney] = useState<CostingJourney | null>(null)
    const validResultTrackedRef = useRef<number | null>(null)
    const startJourney = useCallback((source: CostingJourneySource) => {
        setJourney(previous => nextCostingJourney(previous, source))
        costingStartedRef.current = false
        if (source === 'blank') void trackPlanEvent('blank_start')
        if (source === 'saved_quality') void trackPlanEvent('saved_quality_start')
    }, [])

    useEffect(() => {
        if (estimatorOpenedRef.current) return
        estimatorOpenedRef.current = true
        void trackPlanEvent('estimator_opened', {
            workspace: canUseProduction ? 'full_suite' : 'standalone_costing',
        })
    }, [canUseProduction])

    useEffect(() => {
        return initWebVitals({
            route: '/owner/estimator',
            language: (language === 'hi' || language === 'gu') ? language : 'en',
        })
    }, [language])
    const isStandaloneCostingSession = !canUseProduction || sourceRecordKind === 'costing'
    const versionInputChanges = useMemo(
        () => summarizeCostingInputChanges(sourceState, state),
        [sourceState, state],
    )
    const versionInputChangeSummary = versionInputChanges.length > 0
        ? versionInputChanges.join(', ')
        : null
    const quoteRequestIdRef = useRef<string | null>(null)
    const [unconfirmedRequestId, setUnconfirmedRequestId] = useState<string | null>(null)
    const [checkingSave, setCheckingSave] = useState(false)
    const [saveCheckMessage, setSaveCheckMessage] = useState('')
    const pendingSaveRequestRef = useRef<Parameters<typeof saveEstimatorQuoteV3>[0] | null>(null)
    const reportedSaveRequestsRef = useRef(new Set<string>())
    const [lastSavedCosting, setLastSavedCosting] = useState<{ id: string; version: number; savedAt: string; model: ReturnType<typeof createCostingExportModel> } | null>(null)
    const [exportSavedCosting, setExportSavedCosting] = useState(false)
    const [hasUnsavedEdits, setHasUnsavedEdits] = useState(false)
    const [pendingQualityChange, setPendingQualityChange] = useState<{ name: string; apply: () => void } | null>(null)
    const [qualityCheckpoint, setQualityCheckpoint] = useState<{ draft: EstimatorDraftInput<EstimateState>; template: EstimatorTemplate | null } | null>(null)
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
    const [editingWarpRates, setEditingWarpRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [editingWeftRates, setEditingWeftRates] = useState<{ id: string; yarnRate: number }[]>([])
    const [savingRates,      setSavingRates]      = useState(false)
    const savingRatesRef = useRef(false)
    const rateImpact = useMemo(() => editRatesTpl ? calculateRateImpact(
        estimateReducer(state, { type: 'APPLY_TEMPLATE', template: editRatesTpl }),
        editingWarpRates.map(row => row.yarnRate),
        editingWeftRates.map(row => row.yarnRate),
    ) : null, [state, editRatesTpl, editingWarpRates, editingWeftRates])
    const [deletingTpl,      setDeletingTpl]      = useState<string | null>(null)
    const [templateToArchive, setTemplateToArchive] = useState<EstimatorTemplate | null>(null)
    const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([])
    const [acknowledgedWarningKey, setAcknowledgedWarningKey] = useState<string | null>(null)
    const [showWarningAcknowledgement, setShowWarningAcknowledgement] = useState(false)
    const [warningSavePending, setWarningSavePending] = useState(false)
    const warningContinuationRef = useRef<WarningContinuation | null>(null)
    const saveAsNewQualityRollbackRef = useRef<SaveAsNewQualityRollback | null>(null)
    const [showConfirmNewQuality, setShowConfirmNewQuality] = useState(false)
    const [showValidation, setShowValidation] = useState(false)

    // Template search
    const [templateSearch,   setTemplateSearch]   = useState('')
    const [showQualityLibrary, setShowQualityLibrary] = useState(false)
    const savedQualitiesRailRef = useRef<HTMLDivElement>(null)
    const [savedQualitiesScrollState, setSavedQualitiesScrollState] = useState({
        canScrollLeft: false,
        canScrollRight: false,
    })

    const [showAdvancedOverhead, setShowAdvancedOverhead] = useState(false)
    const [entryMode, setEntryMode] = useState<'quick' | 'detailed'>('quick')
    const [assumptionsExpanded, setAssumptionsExpanded] = useState(false)
    const [showCostingSaveGuidance, setShowCostingSaveGuidance] = useState(true)
    const assumptionsManuallyToggledRef = useRef(false)
    const mobileShortcutSeenRef = useRef(false)
    const mobileShortcutLabelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [mobileCostingShortcutVisible] = useState(true)
    const [mobileCostingShortcutExpanded, setMobileCostingShortcutExpanded] = useState(false)
    const [mobileKeyboardVisible, setMobileKeyboardVisible] = useState(false)

    useEffect(() => {
        try {
            setShowCostingSaveGuidance(
                localStorage.getItem(getCostingSaveGuidanceStorageKey(orgId, userId)) !== 'dismissed',
            )
        } catch {
            // If browser storage is unavailable, keep the guidance available for this session.
            setShowCostingSaveGuidance(true)
        }
    }, [orgId, userId])

    const dismissCostingSaveGuidance = useCallback(() => {
        setShowCostingSaveGuidance(false)
        try {
            localStorage.setItem(getCostingSaveGuidanceStorageKey(orgId, userId), 'dismissed')
        } catch {
            // Dismissal still applies for the current session when storage is unavailable.
        }
    }, [orgId, userId])

    const handleEntryModeChange = useCallback((nextMode: 'quick' | 'detailed') => {
        setEntryMode(nextMode)
        if (!assumptionsManuallyToggledRef.current) {
            setAssumptionsExpanded(false)
        }
    }, [])

    useEffect(() => {
        if (assumptionsManuallyToggledRef.current) return
        const isDesktop = window.matchMedia('(min-width: 768px)').matches
        setAssumptionsExpanded(entryMode === 'detailed' && isDesktop)
    }, [entryMode])

    const toggleAssumptions = useCallback(() => {
        assumptionsManuallyToggledRef.current = true
        setAssumptionsExpanded(current => !current)
    }, [])

    useEffect(() => {
        if (mobileKeyboardVisible) {
            setMobileCostingShortcutExpanded(false)
            return
        }
        if (!mobileCostingShortcutVisible || mobileShortcutSeenRef.current) return

        mobileShortcutSeenRef.current = true
        setMobileCostingShortcutExpanded(true)
        if (mobileShortcutLabelTimerRef.current) clearTimeout(mobileShortcutLabelTimerRef.current)
        mobileShortcutLabelTimerRef.current = setTimeout(() => {
            setMobileCostingShortcutExpanded(false)
            mobileShortcutLabelTimerRef.current = null
        }, 3200)

        return () => {
            if (mobileShortcutLabelTimerRef.current) {
                clearTimeout(mobileShortcutLabelTimerRef.current)
                mobileShortcutLabelTimerRef.current = null
            }
        }
    }, [mobileCostingShortcutVisible, mobileKeyboardVisible])

    useEffect(() => {
        const viewport = window.visualViewport
        if (!viewport) return

        const initialHeight = viewport.height
        const syncKeyboard = () => {
            setMobileKeyboardVisible(initialHeight - viewport.height > 150)
        }

        syncKeyboard()
        viewport.addEventListener('resize', syncKeyboard)
        viewport.addEventListener('scroll', syncKeyboard)
        return () => {
            viewport.removeEventListener('resize', syncKeyboard)
            viewport.removeEventListener('scroll', syncKeyboard)
        }
    }, [])

    // Party rate memory — debounced with 800ms + 3-char min
    const [partyHint, setPartyHint] = useState<{
        quality_label: string; quote_price_per_meter: number; created_at: string
    } | null>(null)
    const partyLookupTimerRef = useState<ReturnType<typeof setTimeout> | null>(null)

    // Autosave — scoped per user (orgId-userId) so multi-user on same device is safe
    const validateEstimatorDraftState = useCallback((candidate: unknown): candidate is EstimateState => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false
        const value = candidate as Partial<EstimateState>
        return Array.isArray(value.warpRows)
            && Array.isArray(value.weftRows)
            && Boolean(value.enabledSections && typeof value.enabledSections === 'object')
    }, [])

    const shouldPersistEstimatorDraft = useCallback((data: EstimatorDraftInput<EstimateState>) => {
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

    const {
        hasDraft,
        draft,
        restoreDraft,
        dismissDraft,
        clearDraft,
        saveDraft,
        saveDraftNow,
        suppressAutosaveUntilChanged,
        markUserEdit,
        storageStatus,
        draftConflict,
        acknowledgeDraftConflict,
    } = useAutosave<EstimateState>({
        orgId,
        userId,
        debounceMs: 2000,
        shouldPersist: data => shouldPersistEstimatorDraft(data as EstimatorDraftInput<EstimateState>),
        validateState: validateEstimatorDraftState,
    })

    // Reducer updates from visible controls are user edits. Keeping this
    // boundary explicit means Reset, Restore, and successful Save can update
    // several fields without those programmatic changes recreating a stale
    // local draft.
    const dispatch = useCallback((action: Action) => {
        if (action.type === 'APPLY_TEMPLATE') startJourney('saved_quality')
        markUserEdit()
        setHasUnsavedEdits(true)
        setLastSavedCosting(null)
        rawDispatch(action)
    }, [markUserEdit, startJourney])
    const setPartyNameFromUser = useCallback((value: string) => {
        markUserEdit()
        setHasUnsavedEdits(true)
        setPartyName(value)
    }, [markUserEdit])
    const setQualityLabelFromUser = useCallback((value: string) => {
        markUserEdit()
        setHasUnsavedEdits(true)
        setQualityLabel(value)
    }, [markUserEdit])
    const setWarpInstructionFromUser = useCallback((value: string) => {
        markUserEdit()
        setHasUnsavedEdits(true)
        setWarpInstruction(value)
    }, [markUserEdit])
    const setWeftInstructionFromUser = useCallback((value: string) => {
        markUserEdit()
        setHasUnsavedEdits(true)
        setWeftInstruction(value)
    }, [markUserEdit])

    const buildCurrentDraft = useCallback((
        clientRequestId = quoteRequestIdRef.current,
        recordKindOverride?: CostingRecordKind,
    ) => ({
        state,
        partyName,
        qualityLabel,
        warpInstruction,
        weftInstruction,
        pendingSaveRequest: pendingSaveRequestRef.current ?? undefined,
        sourceQuoteId: sourceQuoteId ?? undefined,
        sourceQuoteUpdatedAt: sourceQuoteUpdatedAt ?? undefined,
        sourceQuoteVersionNumber: sourceQuoteVersionNumber ?? undefined,
        sourceQuoteCreatedAt: sourceQuoteCreatedAt ?? undefined,
        sourceQuoteStatus: sourceQuoteStatus ?? undefined,
        sourceState: sourceState ?? undefined,
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
        sourceQuoteStatus,
        sourceState,
        sourceFactoryProfileUpdatedAt,
        sourceRecordKind,
        state,
        warpInstruction,
        weftInstruction,
    ])

    const applyEstimatorDraft = useCallback((checkpoint?: EstimatorDraftInput<EstimateState>) => {
        const restored = checkpoint ?? restoreDraft()
        if (!restored) return
        suppressAutosaveUntilChanged()
        lastGeneratedWarp.current = null
        lastGeneratedWeft.current = null

        startJourney(restored.sourceQuoteId ? 'saved_costing' : 'restored_draft')
        rawDispatch({ type: 'RESTORE_DRAFT', draftState: restored.state })
        setDirectWeavingRateInput(getDirectWeavingRateInput(
            restored.state.perPickCostPaisa,
            restored.state.weftRows,
        ))
        setPartyName(restored.partyName)
        setQualityLabel(restored.qualityLabel)
        setWarpInstruction(restored.warpInstruction)
        setWeftInstruction(restored.weftInstruction)
        setSourceQuoteId(restored.sourceQuoteId ?? null)
        setSourceQuoteUpdatedAt(restored.sourceQuoteUpdatedAt ?? null)
        setSourceQuoteVersionNumber(restored.sourceQuoteVersionNumber ?? null)
        setSourceQuoteCreatedAt(restored.sourceQuoteCreatedAt ?? null)
        setSourceQuoteStatus(restored.sourceQuoteStatus ?? null)
        setSourceState(restored.sourceState ?? null)
        setSourceFactoryProfileUpdatedAt(restored.sourceFactoryProfileUpdatedAt ?? null)
        setSourceRecordKind(restored.sourceRecordKind ?? null)
        setAppliedTemplate(templates.find(template => template.id === restored.templateId) ?? null)
        quoteRequestIdRef.current = restored.clientRequestId ?? null
        pendingSaveRequestRef.current = restored.pendingSaveRequest ?? null
        setUnconfirmedRequestId(restored.pendingSaveRequest ? restored.clientRequestId ?? null : null)
        setHasUnsavedEdits(!restored.sourceState || JSON.stringify(restored.sourceState) !== JSON.stringify(restored.state))
        setLastSavedCosting(null)
        void trackPlanEvent('draft_restored')
        if (restored.sourceQuoteId) {
            void trackPlanEvent('costing_reopened', {
                record_kind: restored.sourceRecordKind === 'quotation' ? 'quotation' : 'costing',
            })
        }
        setDismissedWarnings([])
        setAcknowledgedWarningKey(null)
        warningContinuationRef.current = null
        setWarningSavePending(false)
        setShowWarningAcknowledgement(false)
        const restoredValidation = validateEstimatorSnapshot(restored.state, {
            requireTapeLength: canUseProduction,
            requireCapacity: requiresFactoryCapacity(
                restored.state,
                canUseProduction && restored.sourceRecordKind !== 'costing',
            ),
        })
        setShowValidation(!restoredValidation.valid)
        if (!restoredValidation.valid) {
            toast.error(tx('This Cost Estimate draft is incomplete. Check the highlighted fields before saving.'))
        } else {
            toast.success(tx(restored.sourceQuoteId
                ? restored.sourceRecordKind === 'costing' ? 'Costing specifications loaded' : 'Quotation specifications loaded'
                : 'Cost Estimate draft restored'))
        }
    }, [canUseProduction, restoreDraft, suppressAutosaveUntilChanged, templates, tx, startJourney])

    const draftDetectedTrackedRef = useRef(false)
    useEffect(() => {
        if (hasDraft && draft && !draftDetectedTrackedRef.current) {
            draftDetectedTrackedRef.current = true
            void trackPlanEvent('draft_detected')
        }
    }, [draft, hasDraft])

    useEffect(() => {
        if (!hasDraft || !draft || !shouldAutoRestoreEstimatorDraft(draft)) return
        if (autoRestoredDraftSavedAtRef.current === draft.savedAt) return

        // React StrictMode can replay mount effects. savedAt identifies this
        // handoff so an explicit Open & Update / Use as Starting Point action is applied
        // once without affecting the manual recovery flow for ordinary drafts.
        autoRestoredDraftSavedAtRef.current = draft.savedAt
        applyEstimatorDraft()
    }, [applyEstimatorDraft, draft, hasDraft])

    // Fallback fetch for an older caller that did not provide the critical
    // factory profile. It remains read-only; first-visit profile creation is
    // reserved for the explicit settings editor.
    useEffect(() => {
        if (initialProfile !== undefined) return
        async function load() {
            setLoading(true)
            const pRes = await getFactoryCostProfile({ createIfMissing: false })
            if (pRes.data) {
                setFactoryBaselineUpdatedAt(pRes.data.updated_at ?? null)
                rawDispatch({
                    type: 'INIT_FROM_PROFILE',
                    data: {
                        profile:  pRes.data,
                        sections: pRes.data.enabled_sections ?? {
                            winding: false, processing: false, finishing: false, commission: false, transport: false,
                        },
                    },
                })
            }
            setLoading(false)
        }
        load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Saved qualities, premium-only worker inputs, party suggestions, and
    // review badges are independent of the blank editor. Hydrate them after
    // the primary task is interactive and never replace values entered by the
    // owner while the secondary request is in flight.
    useEffect(() => {
        if (initialTemplates !== undefined) return
        let cancelled = false
        setSecondaryError(null)

        // Keep one request per mounted estimator. React can replay effects and
        // the profile object can change identity during a route refresh; a
        // second request must not reset the already-ready quality library.
        const secondaryDataRequest = secondaryDataRequestRef.current
            ?? (secondaryDataRequestRef.current = getEstimatorSecondaryData())

        void secondaryDataRequest
            .then(result => {
                if (cancelled) return
                if (result.error) {
                    setSecondaryError(result.error)
                    setTemplatesLoaded(true)
                    return
                }

                setTemplates(result.templates ?? [])
                setPartyNames(result.partyNames ?? [])
                setStaleRateNames(result.staleDefaultRateNames ?? [])

                const profileHasItems = Array.isArray(initialProfile?.overhead_items)
                    && initialProfile.overhead_items.length > 0
                if (!profileHasItems && (result.workers ?? []).length > 0) {
                    rawDispatch({ type: 'MERGE_FIXED_WORKERS', workers: result.workers ?? [] })
                }
                setTemplatesLoaded(true)
            })
            .catch(error => {
                if (cancelled) return
                setSecondaryError(error instanceof Error ? error.message : 'Estimator secondary data could not be loaded.')
                setTemplatesLoaded(true)
            })

        return () => {
            cancelled = true
        }
    }, [initialProfile, initialTemplates])

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

    const requireCapacityForCurrentCosting = requiresFactoryCapacity(
        state,
        canUseProduction && !isStandaloneCostingSession,
    )
    const estimatorValidation = useMemo(
        () => validateEstimatorSnapshot(state, {
            requireTapeLength: canUseProduction,
            requireCapacity: requireCapacityForCurrentCosting,
        }),
        [canUseProduction, requireCapacityForCurrentCosting, state],
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
    const costingReadiness = useMemo(
        () => getEstimatorReadiness({
            validation: estimatorValidation,
            result: costingResult,
            totals,
            warningsAcknowledged,
        }),
        [costingResult, estimatorValidation, totals, warningsAcknowledged],
    )
    // Keep the monthly-expense reference available even when the costing is
    // currently using a direct ₹/m rate. This is transparency only; it never
    // overrides the selected calculation method.
    const monthlyOverheadReference = state.monthlyOutputM > 0
        ? totals.overheadTotalMonthly / state.monthlyOutputM
        : 0
    const hasValidCostResult = costingReadiness.canDisplayMoney
    const canPersistCostResult = costingReadiness.canPersist
    const firstCostingReadinessMessage = costingReadiness.issues[0]?.message ?? firstEstimatorValidationMessage

    useEffect(() => {
        if (hasValidCostResult && journey && validResultTrackedRef.current !== journey.sequence) {
            validResultTrackedRef.current = journey.sequence
            void trackPlanEvent('valid_result_reached', {
                has_quantity: Boolean(state.orderQuantityM && state.orderQuantityM > 0),
                journey_source: journey.source,
            })
        }
    }, [hasValidCostResult, journey, state.orderQuantityM])

    const validationSummaryId = 'estimator-save-validation-summary'
    const exportModel = useMemo(() => canPersistCostResult
        ? createCostingExportModel({ qualityLabel, state, totals, result: costingResult })
        : null,
    [canPersistCostResult, costingResult, qualityLabel, state, totals])

    const reportConfirmedSave = (request: Parameters<typeof saveEstimatorQuoteV3>[0] | null, savedId: string) => {
        if (!request?.clientRequestId || reportedSaveRequestsRef.current.has(request.clientRequestId)) return
        reportedSaveRequestsRef.current.add(request.clientRequestId)
        const newVersion = Boolean(request.sourceQuoteId && request.sourceQuoteId !== savedId)
        void trackPlanEvent('save_succeeded', { record_kind: request.recordKind ?? 'quotation', is_new_version: newVersion })
        if (newVersion) void trackPlanEvent('new_version_created', { record_kind: request.recordKind ?? 'quotation' })
    }

    const confirmSavedCosting = (receipt: { id: string; version_number: number; updated_at: string; created_at: string }) => {
        const submitted = pendingSaveRequestRef.current
        const savedState = submitted?.estimate ?? state
        const savedTotals = calcFullTotals(savedState)
        const savedModel = createCostingExportModel({ qualityLabel: submitted?.qualityLabel ?? qualityLabel, state: savedState, totals: savedTotals, result: buildCostingResult(savedState, savedTotals), createdAt: receipt.created_at })
        setUnconfirmedRequestId(null)
        setSaveCheckMessage('')
        pendingSaveRequestRef.current = null
        quoteRequestIdRef.current = null
        clearDraft()
        suppressAutosaveUntilChanged()
        setHasUnsavedEdits(false)
        setQualityCheckpoint(null)
        setSourceQuoteId(receipt.id)
        setSourceQuoteUpdatedAt(receipt.updated_at)
        setSourceQuoteCreatedAt(receipt.created_at)
        setSourceQuoteVersionNumber(receipt.version_number)
        setSourceRecordKind('costing')
        setSourceState(savedState)
        setSourceFactoryProfileUpdatedAt(submitted?.factoryProfileUpdatedAt ?? sourceFactoryProfileUpdatedAt ?? factoryBaselineUpdatedAt)
        setLastSavedCosting({ id: receipt.id, version: receipt.version_number, savedAt: receipt.created_at, model: savedModel })
    }

    const refreshSavedQualityTokens = async () => {
        const refreshed = await getEstimatorTemplates().catch(() => null)
        if (refreshed?.data) {
            setTemplates(refreshed.data)
            setAppliedTemplate(current => current ? refreshed.data.find(template => template.id === current.id) ?? current : current)
        }
    }

    const checkUnconfirmedSave = async (requestId: string) => {
        setCheckingSave(true)
        setSaveCheckMessage('')
        try {
            const outcome = await runMutationWithTimeout(() => getCostingSaveReceipt(requestId), 8_000)
            if (outcome.status === 'completed' && outcome.value.status === 'saved') {
                reportConfirmedSave(pendingSaveRequestRef.current, outcome.value.receipt.id)
                if (outcome.value.receipt.record_kind === 'costing') {
                    confirmSavedCosting(outcome.value.receipt)
                    await refreshSavedQualityTokens()
                }
                else router.push('/owner/quotes')
            } else {
                setSaveCheckMessage(tx('The save is not confirmed yet. Your original inputs and request identity are preserved.'))
            }
        } catch {
            setSaveCheckMessage(tx('Save status is unavailable. Reconnect and check again.'))
        } finally {
            setCheckingSave(false)
        }
    }

    const retrySubmittedSave = async () => {
        const request = pendingSaveRequestRef.current
        if (!request || checkingSave || savingQuote || saveQuoteLockRef.current) return
        saveQuoteLockRef.current = true
        setCheckingSave(true)
        try {
            const outcome = await runMutationWithTimeout(() => saveEstimatorQuoteV3(request))
            if (outcome.status === 'completed' && outcome.value.success && outcome.value.quoteId) {
                const result = outcome.value
                reportConfirmedSave(request, result.quoteId)
                if (request.recordKind === 'costing') {
                    confirmSavedCosting({ id: result.quoteId, version_number: result.versionNumber ?? 1, updated_at: result.updatedAt, created_at: ('createdAt' in result && result.createdAt) || result.updatedAt })
                    await refreshSavedQualityTokens()
                } else router.push('/owner/quotes')
            } else if (outcome.status === 'completed') {
                // A definite server rejection releases editing, but preserves the entered draft.
                setUnconfirmedRequestId(null)
                pendingSaveRequestRef.current = null
                quoteRequestIdRef.current = null
                saveDraftNow(buildCurrentDraft(null))
                toast.error(tx(userFacingError(outcome.value.error, 'The costing could not be saved. Review the inputs and retry.')))
            } else setSaveCheckMessage(tx('The save is not confirmed yet. Your original inputs and request identity are preserved.'))
        } catch {
            setSaveCheckMessage(tx('Save status is unavailable. Reconnect and check again.'))
        } finally { setCheckingSave(false); saveQuoteLockRef.current = false }
    }
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
        }
        // Direct mode deliberately leaves the field empty until Rajesh enters
        // a rate. A monthly calculation is a reference, never an auto-filled
        // direct assumption.
    }, [dispatch])
    const filteredTemplates = useMemo(() =>
        templateSearch.trim()
            ? templates.filter(t => t.name.toLowerCase().includes(templateSearch.toLowerCase()))
            : templates,
    [templates, templateSearch])
    const hasActiveQualityRecipeChanges = appliedTemplate
        ? hasSavedQualityRecipeChanges(appliedTemplate, state)
        : false
    const topCostingActionLabel = sourceQuoteId && sourceRecordKind === 'costing'
        ? 'Save New Version'
        : 'Save Costing'

    const updateSavedQualitiesScrollState = useCallback(() => {
        const rail = savedQualitiesRailRef.current
        if (!rail) return

        const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
        const nextState = {
            canScrollLeft: rail.scrollLeft > 2,
            canScrollRight: rail.scrollLeft < maxScrollLeft - 2,
        }

        setSavedQualitiesScrollState(current => (
            current.canScrollLeft === nextState.canScrollLeft
                && current.canScrollRight === nextState.canScrollRight
                ? current
                : nextState
        ))
    }, [])

    useEffect(() => {
        const rail = savedQualitiesRailRef.current
        if (!rail) return

        updateSavedQualitiesScrollState()
        rail.addEventListener('scroll', updateSavedQualitiesScrollState, { passive: true })
        window.addEventListener('resize', updateSavedQualitiesScrollState)

        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(updateSavedQualitiesScrollState)
            : null
        resizeObserver?.observe(rail)

        return () => {
            rail.removeEventListener('scroll', updateSavedQualitiesScrollState)
            window.removeEventListener('resize', updateSavedQualitiesScrollState)
            resizeObserver?.disconnect()
        }
    }, [filteredTemplates, showQualityLibrary, updateSavedQualitiesScrollState])

    const scrollSavedQualities = useCallback((direction: 'left' | 'right') => {
        const rail = savedQualitiesRailRef.current
        if (!rail) return

        const firstCard = rail.querySelector<HTMLElement>('[data-saved-quality-card]')
        const railStyles = window.getComputedStyle(rail)
        const gap = Number.parseFloat(railStyles.columnGap || railStyles.gap) || 0
        const distance = firstCard
            ? firstCard.getBoundingClientRect().width + gap
            : Math.max(240, Math.round(rail.clientWidth * 0.8))
        const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth)
        const nextScrollLeft = Math.min(
            maxScrollLeft,
            Math.max(0, rail.scrollLeft + (direction === 'left' ? -distance : distance)),
        )

        rail.scrollTo({ left: nextScrollLeft, behavior: 'smooth' })
    }, [])

    const handleAutoSuggestOutput = async () => {
        setIsSuggestingOutput(true)
        try {
            const res = await getMonthlyOutputSuggestion()
            if (res.error) {
                toast.error(tx('Failed to get suggestion'))
            } else if (res.data) {
                setOutputSuggestion(res.data)
            }
        } catch {
            toast.error(tx('Error fetching suggestion'))
        } finally {
            setIsSuggestingOutput(false)
        }
    }

    const applyTemplate = useCallback((tpl: EstimatorTemplate, confirmed = false) => {
        if (saveQuoteLockRef.current || unconfirmedRequestId) return
        if (!confirmed && hasUnsavedEdits && shouldPersistEstimatorDraft(buildCurrentDraft())) {
            setPendingQualityChange({ name: tpl.name, apply: () => applyTemplate(tpl, true) })
            return
        }
        setQualityCheckpoint({ draft: buildCurrentDraft(), template: appliedTemplate })
        setDirectWeavingRateInput(getTemplateDirectWeavingRateInput(tpl, state))
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
        setSourceQuoteStatus(null)
        setSourceState(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        setWarpInstruction('')
        setWeftInstruction('')
        lastGeneratedWarp.current = null
        lastGeneratedWeft.current = null
        setShowQualityLibrary(false)
        setPendingQualityChange(null)
        setHasUnsavedEdits(false)
        setLastSavedCosting(null)
        void trackPlanEvent('saved_quality_selected', {
            has_rates: Boolean(tpl.warp_rows?.[0]?.yarnRate),
        })
        void trackPlanEvent('quality_reused', { source: 'estimator_quality_library' })
        toast.success(tx(`${t('estimator.quality.applied')} ${tpl.name}`))
    }, [dispatch, state, t, tx, appliedTemplate, buildCurrentDraft, hasUnsavedEdits, shouldPersistEstimatorDraft, unconfirmedRequestId])

    const openSaveTemplateDialog = useCallback(() => {
        setTemplateName(
            qualityLabel.trim()
            || appliedTemplate?.name
            || (mode === 'market' ? partyName.trim() : '')
        )
        setTemplateSaveError(null)
        setShowSaveTemplate(true)
    }, [appliedTemplate?.name, mode, partyName, qualityLabel])

    const openSaveAsNewQualityDialog = useCallback(() => {
        if (!appliedTemplate) {
            openSaveTemplateDialog()
            return
        }

        // A copy starts a new template and costing lineage. Keep the loaded
        // recipe, but detach every source identity before asking for the new
        // quality name.
        saveAsNewQualityRollbackRef.current = {
            appliedTemplate,
            templateName,
            qualityLabel,
            sourceQuoteId,
            sourceQuoteUpdatedAt,
            sourceQuoteVersionNumber,
            sourceQuoteCreatedAt,
            sourceQuoteStatus,
            sourceState,
            sourceFactoryProfileUpdatedAt,
            sourceRecordKind,
            clientRequestId: quoteRequestIdRef.current,
        }
        setTemplateName(`${appliedTemplate.name} - New`)
        setAppliedTemplate(null)
        setSourceQuoteId(null)
        setSourceQuoteUpdatedAt(null)
        setSourceQuoteVersionNumber(null)
        setSourceQuoteCreatedAt(null)
        setSourceQuoteStatus(null)
        setSourceState(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        setTemplateSaveError(null)
        setShowSaveTemplate(true)
    }, [
        appliedTemplate,
        openSaveTemplateDialog,
        qualityLabel,
        sourceFactoryProfileUpdatedAt,
        sourceQuoteCreatedAt,
        sourceQuoteId,
        sourceQuoteStatus,
        sourceQuoteUpdatedAt,
        sourceQuoteVersionNumber,
        sourceRecordKind,
        sourceState,
        templateName,
    ])

    const rollbackSaveAsNewQualityDialog = useCallback(() => {
        const rollback = saveAsNewQualityRollbackRef.current
        if (!rollback) return

        setAppliedTemplate(rollback.appliedTemplate)
        setTemplateName(rollback.templateName)
        setQualityLabel(rollback.qualityLabel)
        setSourceQuoteId(rollback.sourceQuoteId)
        setSourceQuoteUpdatedAt(rollback.sourceQuoteUpdatedAt)
        setSourceQuoteVersionNumber(rollback.sourceQuoteVersionNumber)
        setSourceQuoteCreatedAt(rollback.sourceQuoteCreatedAt)
        setSourceQuoteStatus(rollback.sourceQuoteStatus)
        setSourceState(rollback.sourceState)
        setSourceFactoryProfileUpdatedAt(rollback.sourceFactoryProfileUpdatedAt)
        setSourceRecordKind(rollback.sourceRecordKind)
        quoteRequestIdRef.current = rollback.clientRequestId
        saveAsNewQualityRollbackRef.current = null
        suppressAutosaveUntilChanged()
    }, [suppressAutosaveUntilChanged])

    const requireWarningReview = (continuation?: WarningContinuation) => {
        if (warningsAcknowledged) return false
        warningContinuationRef.current = continuation ?? null
        setWarningSavePending(Boolean(continuation))
        setShowWarningAcknowledgement(true)
        return true
    }

    const requireTemplateReadiness = (
        continuation?: WarningContinuation,
        warningAlreadyReviewed = false,
    ) => {
        // Updating an existing quality changes the reusable recipe only. A new
        // quality also creates its initial costing snapshot. Capacity is
        // required when that snapshot uses monthly expenses, or when the Full
        // Suite workflow will use it for production.
        const templateValidation = validateEstimatorSnapshot(state, {
            requireTapeLength: false,
            requireCapacity: !appliedTemplate && requiresFactoryCapacity(state, canUseProduction),
        })
        if (!templateValidation.valid) {
            toast.error(tx(getFirstEstimatorValidationMessage(templateValidation) ?? 'Complete the highlighted inputs before saving the quality.'))
            return true
        }
        return warningAlreadyReviewed ? false : requireWarningReview(continuation)
    }

    const handleSaveProfile = async (warningAlreadyReviewed = false) => {
        if (!warningAlreadyReviewed && requireWarningReview(() => handleSaveProfile(true))) return
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
                rawDispatch({ type: 'SET', field: 'isConfigured', value: true })
                setFactoryBaselineUpdatedAt(res.updatedAt ?? factoryBaselineUpdatedAt)
                toast.success(t('estimator.sprint1.baseline_updated'))
            } else {
                toast.error(tx(userFacingError(res.error, 'Factory costing defaults could not be saved. Try again.')))
            }
        } catch {
            toast.error(tx('Error saving profile'))
        } finally {
            setSaving(false)
        }
    }

    const handleSaveTemplate = async (warningAlreadyReviewed = false) => {
        if (!templateName.trim()) {
            const message = t('estimator.quality.nameRequired')
            setTemplateSaveError(message)
            toast.error(tx(message))
            return
        }
        const missingLayer = findMissingLayerLabel(state.warpRows, state.weftRows)
        if (missingLayer) {
            return toast.error(tx(t('estimator.quality.layerNameRequired').replace('{layer}', missingLayer)))
        }
        if (requireTemplateReadiness(() => handleSaveTemplate(true), warningAlreadyReviewed)) return

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
                warpingMode:      state.warpingMode,
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
                setSourceQuoteStatus(null)
                setSourceState(null)
                setSourceFactoryProfileUpdatedAt(null)
                setSourceRecordKind(null)
                quoteRequestIdRef.current = null
                saveAsNewQualityRollbackRef.current = null
                setShowSaveTemplate(false)
                setTemplateName('')
                setTemplateSaveError(null)
                clearDraft()
                suppressAutosaveUntilChanged()
                void trackPlanEvent('quality_created', { source: 'estimator' })
                toast.success(t('estimator.quality.saved'), {
                    description: tx(`Recipe saved for reuse. Costing snapshot v${res.versionNumber ?? 1} · ${formatSuratDateTime(res.updatedAt ?? new Date().toISOString())} · rate basis ₹${Number(state.warpRows[0]?.yarnRate ?? 0).toFixed(2)}/kg. Use Save Costing only when you intentionally want another costing version.`),
                })
            } else {
                const message = res.error ?? t('estimator.quality.saveFailed')
                setTemplateSaveError(message)
                toast.error(tx(message))
            }
        } catch {
            const message = t('estimator.quality.saveFailed')
            setTemplateSaveError(message)
            toast.error(tx(message))
        } finally {
            setSavingTemplate(false)
        }
    }

    const handleUpdateTemplate = async (warningAlreadyReviewed = false) => {
        if (!appliedTemplate) return
        const missingLayer = findMissingLayerLabel(state.warpRows, state.weftRows)
        if (missingLayer) {
            return toast.error(tx(t('estimator.quality.layerNameRequired').replace('{layer}', missingLayer)))
        }
        if (requireTemplateReadiness(() => handleUpdateTemplate(true), warningAlreadyReviewed)) return

        const warpRows = trimLayerLabels(state.warpRows)
        const weftRows = trimLayerLabels(state.weftRows)

        setSavingTemplate(true)
        const res = await updateFabricTemplate({
            id:               appliedTemplate.id,
            expectedUpdatedAt: appliedTemplate.updated_at,
            // A Saved Quality keeps its identity. A different construction is
            // saved as a separate quality instead of being renamed here.
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
            warpingMode:      state.warpingMode,
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
            toast.error(tx(userFacingError(res.error, t('estimator.quality.updateFailed'))))
        }
    }

    const handleNewQualityConfirm = () => {
        if (saveQuoteLockRef.current || unconfirmedRequestId) return
        startJourney('blank')
        setLastSavedCosting(null)
        setQualityCheckpoint(null)
        setHasUnsavedEdits(false)
        rawDispatch({
            type: 'RESET',
            data: {
                profile: initialProfile,
                sections: initialProfile?.enabled_sections ?? DEFAULT_FACTORY_SECTIONS,
                workers: initialWorkers || [],
            },
        })
        setMode(canUseProduction ? estimatorWorkflow.initialMode : 'quote')
        setEntryMode('quick')
        assumptionsManuallyToggledRef.current = false
        setAssumptionsExpanded(false)
        setOutputSuggestion(null)
        setWeavingRateInputMode('perMeter')
        setDirectWeavingRateInput('')
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
        setSourceQuoteStatus(null)
        setSourceState(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        autoRestoredDraftSavedAtRef.current = null
        if (partyLookupTimerRef[0]) clearTimeout(partyLookupTimerRef[0])
        partyLookupTimerRef[1](null)
        setPartyHint(null)
        setTemplateSearch('')
        setTemplateName('')
        setTemplateSaveError(null)
        setShowSaveTemplate(false)
        setRenameTpl(null)
        setRenameValue('')
        setRenameError(null)
        setEditRatesTpl(null)
        setEditingWarpRates([])
        setEditingWeftRates([])
        setTemplateToArchive(null)
        setDeletingTpl(null)
        setShowDiscardDraft(false)
        setShowExportDialog(false)
        setPendingStaleRateSave(null)
        setPendingQualityVersionSave(null)
        warningContinuationRef.current = null
        saveAsNewQualityRollbackRef.current = null
        clearDraft()
        suppressAutosaveUntilChanged()
        setShowValidation(false)
        setDismissedWarnings([])
        setAcknowledgedWarningKey(null)
        setShowWarningAcknowledgement(false)
        setWarningSavePending(false)
        setShowAdvancedOverhead(false)
        setShowConfirmNewQuality(false)
        setShowQualityLibrary(false)
        toast.success(tx('Started blank quality recipe'))
    }

    /** Open the "update rates" sheet for a template. */
    const openEditRates = useCallback((tpl: EstimatorTemplate) => {
        const warpRows: WarpRow[] = tpl.warp_rows ?? []
        const weftRows: WeftRow[] = tpl.weft_rows ?? []
        setEditRatesTpl(tpl)
        setEditingWarpRates(warpRows.map((r: WarpRow) => ({ id: r.id, yarnRate: r.yarnRate })))
        setEditingWeftRates(weftRows.map((r: WeftRow) => ({ id: r.id, yarnRate: r.yarnRate })))
        void trackPlanEvent('rate_review_requested')
    }, [])

    /** Persist updated rates to template row AND apply to the estimator. */
    const handleSaveRatesAndApply = async (confirmed = false) => {
        if (!editRatesTpl || savingRatesRef.current) return
        if (saveQuoteLockRef.current || unconfirmedRequestId) return
        if (!confirmed && hasUnsavedEdits && shouldPersistEstimatorDraft(buildCurrentDraft())) {
            setPendingQualityChange({ name: editRatesTpl.name, apply: () => void handleSaveRatesAndApply(true) })
            return
        }
        setPendingQualityChange(null)
        setQualityCheckpoint({ draft: buildCurrentDraft(), template: appliedTemplate })
        savingRatesRef.current = true
        setSavingRates(true)
        try {
            const expectedUpdatedAt = editRatesTpl.updated_at

            // Update rates only. The quality name is an identity and is not edited
            // from this dialog; save a separate quality for a new construction.
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
            if (res.error) { toast.error(tx(userFacingError(res.error, 'Saved Quality could not be updated. Try again.'))); return }

            // Success: refresh and apply
            const tRes = await getEstimatorTemplates().catch(() => ({ data: undefined }))
            const refreshed = tRes.data?.find(template => template.id === editRatesTpl.id)
            if (tRes.data) setTemplates(tRes.data)

            const applied = refreshed ?? { ...editRatesTpl, warp_rows: updatedWarp, weft_rows: updatedWeft, updated_at: res.updatedAt ?? expectedUpdatedAt }
            setDirectWeavingRateInput(getTemplateDirectWeavingRateInput(applied, state))
            dispatch({
                type: 'APPLY_TEMPLATE',
                template: applied,
            })
            setAppliedTemplate(applied)
            setQualityLabel(editRatesTpl.name)
            setSourceQuoteId(null)
            setSourceQuoteUpdatedAt(null)
            setSourceQuoteVersionNumber(null)
            setSourceQuoteCreatedAt(null)
            setSourceQuoteStatus(null)
            setSourceState(null)
            setSourceFactoryProfileUpdatedAt(null)
            setSourceRecordKind(null)
            quoteRequestIdRef.current = null
            setEditRatesTpl(null)
            setShowQualityLibrary(false)
            void trackPlanEvent('current_rate_applied', { rate_source: 'proposed_recipe_rates' })
            setHasUnsavedEdits(false)
            toast.success('noChange' in res && res.noChange
                ? t('estimator.sprint1.quality_no_change')
                : t('estimator.sprint1.rates_updated_no_snapshot'))
        } catch {
            toast.error(tx('Rate update could not be confirmed. Reopen the quality to check its saved rates before trying again.'))
        } finally {
            savingRatesRef.current = false
            setSavingRates(false)
        }
    }

    /** Apply template directly (without editing rates). */
    const handleApplyCurrentRates = (confirmed = false) => {
        if (!editRatesTpl || savingRatesRef.current) return
        if (saveQuoteLockRef.current || unconfirmedRequestId) return
        if (!confirmed && hasUnsavedEdits && shouldPersistEstimatorDraft(buildCurrentDraft())) {
            setPendingQualityChange({ name: editRatesTpl.name, apply: () => handleApplyCurrentRates(true) })
            return
        }
        setPendingQualityChange(null)
        setQualityCheckpoint({ draft: buildCurrentDraft(), template: appliedTemplate })
        setDirectWeavingRateInput(getTemplateDirectWeavingRateInput(editRatesTpl, state))
        dispatch({ type: 'APPLY_TEMPLATE', template: editRatesTpl })
        setAppliedTemplate(editRatesTpl)
        setQualityLabel(editRatesTpl.name)
        setSourceQuoteId(null)
        setSourceQuoteUpdatedAt(null)
        setSourceQuoteVersionNumber(null)
        setSourceQuoteCreatedAt(null)
        setSourceQuoteStatus(null)
        setSourceState(null)
        setSourceFactoryProfileUpdatedAt(null)
        setSourceRecordKind(null)
        quoteRequestIdRef.current = null
        setEditRatesTpl(null)
        setShowQualityLibrary(false)
        void trackPlanEvent('current_rate_applied', { rate_source: 'saved_recipe_rates' })
        setHasUnsavedEdits(false)
        toast.success(tx(`${t('estimator.toast.applied_as_is')} ${editRatesTpl.name}`))
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
        if (res.error) { toast.error(tx(userFacingError(res.error, 'Quality could not be archived. Try again.'))); return }
        setTemplates(prev => prev.filter(t => t.id !== template.id))
        if (appliedTemplate?.id === template.id) setAppliedTemplate(null)
        toast.success(tx('Quality archived. It remains available in History and can be restored.'))
    }

    const requestMachineSetup = (continuation: () => void) => {
        machineSetupContinuationRef.current = continuation
        setShowMachineSetup(true)
    }

    const handleMachineSetupOpenChange = (open: boolean) => {
        setShowMachineSetup(open)
        if (!open) machineSetupContinuationRef.current = null
    }

    const handleMachineAdded = () => {
        const continuation = machineSetupContinuationRef.current
        machineSetupContinuationRef.current = null
        setShowMachineSetup(false)
        continuation?.()
    }

    const handleSaveQuote = async (
        targetMode: 'quote' | 'market' = mode,
        status: 'draft' | 'accepted' = 'draft',
        staleRatesAcknowledged = false,
        recordKindOverride?: 'costing' | 'quotation',
        qualityUpdateDecision?: 'version_only' | 'version_and_quality',
        warningAlreadyReviewed = false,
    ) => {
        if (saveQuoteLockRef.current || savingQuote) return
        if (unconfirmedRequestId) return
        setShowValidation(true)
        const saveAsStandaloneCosting = isStandaloneCostingSession || recordKindOverride === 'costing'
        const effectiveTargetMode = saveAsStandaloneCosting ? 'quote' : targetMode
        const statusForSave: 'draft' | 'sent' | 'accepted' | 'rejected' = !saveAsStandaloneCosting
            && sourceQuoteId
            && sourceQuoteStatus
            ? sourceQuoteStatus
            : status
        if (!hasValidCostResult) {
            return toast.error(tx(firstCostingReadinessMessage ?? 'Complete the highlighted inputs before saving.'))
        }
        if (!costingStartedRef.current) {
            costingStartedRef.current = true
            void trackPlanEvent('costing_started', { source: 'estimator' })
        }
        if (!warningAlreadyReviewed && requireWarningReview(() => handleSaveQuote(
            targetMode,
            status,
            staleRatesAcknowledged,
            recordKindOverride,
            qualityUpdateDecision,
            true,
        ))) return
        if (!saveAsStandaloneCosting && canUseProduction && effectiveTargetMode === 'quote' && !allowsPartyOrders) {
            return toast.error(tx('Party quotations are unavailable in Market Run only mode'))
        }
        if (effectiveTargetMode === 'market' && !allowsMarketRuns) {
            return toast.error(tx('Market Runs are unavailable in Order-Based only mode'))
        }

        const resolvedPartyName = effectiveTargetMode === 'market'
            ? (qualityLabel.trim() || partyName.trim())
            : saveAsStandaloneCosting
                ? (partyName.trim() || null)
                : partyName.trim()

        if (!saveAsStandaloneCosting && !resolvedPartyName) {
            return toast.error(effectiveTargetMode === 'market' ? tx('Fabric Label is required') : t('estimator.toast.party_required'))
        }
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (!saveAsStandaloneCosting && (!state.orderQuantityM || state.orderQuantityM <= 0)) {
            return toast.error(tx('Set a quantity before saving'))
        }
        if (staleRateNames.length > 0 && !staleRatesAcknowledged) {
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
            toast.error(tx('Reconnect before saving'), {
                description: draftSaved
                    ? tx('Your Cost Estimate and save identity are stored on this device.')
                    : tx('Browser storage is unavailable, so keep this page open until you reconnect.'),
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
                    toast.error(tx('Set a quantity before saving'))
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
                if ('error' in res) {
                    if ('setupRequired' in res && res.setupRequired === 'machine') {
                        requestMachineSetup(() => {
                            void handleSaveQuote(targetMode, status, true, recordKindOverride, qualityUpdateDecision, true)
                        })
                        return
                    }
                    toast.error(tx(userFacingError(res.error, 'The Market Run could not be started. Try again.')))
                } else {
                    clearDraft()
                    suppressAutosaveUntilChanged()
                    setSourceQuoteId(null)
                    setSourceQuoteUpdatedAt(null)
                    setSourceQuoteVersionNumber(null)
                    setSourceQuoteCreatedAt(null)
                    setSourceQuoteStatus(null)
                    setSourceState(null)
                    setSourceFactoryProfileUpdatedAt(null)
                    setSourceRecordKind(null)
                    quoteRequestIdRef.current = null
                    toast.success(tx('Market Run started and costing saved'))
                    router.push(`/owner/market-runs/${res.marketRunId}`)
                }
            } else {
                void trackPlanEvent('save_attempted', {
                    record_kind: saveAsStandaloneCosting ? 'costing' : 'quotation',
                    is_new_version: Boolean(sourceQuoteId),
                })
                const saveRequest: Parameters<typeof saveEstimatorQuoteV3>[0] = {
                        clientRequestId:          clientRequestId!,
                        partyName:               resolvedPartyName,
                        qualityLabel:            qualityLabel.trim(),
                        warpInstruction:         warpInstruction.trim() || undefined,
                        weftInstruction:         weftInstruction.trim() || undefined,
                        estimate:                state,
                        quotePricePerM:          costingResult.suggestedSellingPricePerM,
                        totalProductionCostPerM: costingResult.productionCostPerM,
                        status:                  statusForSave,
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
                }
                pendingSaveRequestRef.current = saveRequest
                saveDraftNow({ ...buildCurrentDraft(clientRequestId, saveRequest.recordKind), pendingSaveRequest: saveRequest })
                const mutationOutcome = await runMutationWithTimeout(() => saveEstimatorQuoteV3(saveRequest), 15_000)

                if (mutationOutcome.status === 'unknown') {
                    setUnconfirmedRequestId(clientRequestId)
                    void trackPlanEvent('save_outcome_unknown', {
                        record_kind: saveAsStandaloneCosting ? 'costing' : 'quotation',
                    })
                    // The persistent recovery panel is the single source of save status.
                    if (clientRequestId) await checkUnconfirmedSave(clientRequestId)
                    return
                }

                const res = mutationOutcome.value
                if (res.success) {
                    const wasEditingCosting = Boolean(sourceQuoteId)
                    if (res.quoteId) reportConfirmedSave(saveRequest, res.quoteId)
                    void trackPlanEvent('costing_completed', {
                        record_kind: saveAsStandaloneCosting ? 'costing' : 'quotation',
                        edited: wasEditingCosting,
                    })
                    void trackPlanEvent('costing_saved', {
                        record_kind: saveAsStandaloneCosting ? 'costing' : 'quotation',
                        edited: wasEditingCosting,
                    })
                    if (wasEditingCosting && saveAsStandaloneCosting) {
                        void trackPlanEvent('costing_recalculated', { source: 'saved_costing' })
                    }
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
                    setSourceQuoteStatus(null)
                    setSourceState(null)
                    setSourceFactoryProfileUpdatedAt(null)
                    setSourceRecordKind(null)
                    quoteRequestIdRef.current = null
                    const savedVersion = 'versionNumber' in res && res.versionNumber ? res.versionNumber : 1
                    const savedAt = 'updatedAt' in res && res.updatedAt ? res.updatedAt : new Date().toISOString()
                    toast.success(
                        tx(!saveAsStandaloneCosting
                            ? (statusForSave === 'accepted' ? 'Quotation saved and accepted!' : t('estimator.toast.converted_success'))
                            : ('noChange' in res && res.noChange)
                                ? t('estimator.sprint1.costing_no_change', { version: String(('versionNumber' in res && res.versionNumber) || 1) })
                                : (qualityUpdateDecision === 'version_and_quality'
                                    ? `${wasEditingCosting ? 'New costing version' : 'Costing'} saved and Saved Quality updated`
                                    : (wasEditingCosting ? 'New costing version saved' : 'Costing saved'))),
                        {
                            description: tx(`${!saveAsStandaloneCosting ? 'Quotation' : 'Costing snapshot'} v${savedVersion} · ${formatSuratDateTime(savedAt)} · rate basis ₹${Number(state.warpRows[0]?.yarnRate ?? 0).toFixed(2)}/kg${sourceQuoteStatus ? ` · status preserved as ${sourceQuoteStatus}` : ''}.`),
                        },
                    )
                    if (saveAsStandaloneCosting && res.quoteId) {
                        confirmSavedCosting({ id: res.quoteId, version_number: savedVersion, updated_at: savedAt, created_at: ('createdAt' in res && res.createdAt) || savedAt })
                        // Saving may also update the reusable recipe's concurrency token.
                        await refreshSavedQualityTokens()
                    } else router.push('/owner/quotes')
                } else {
                    setUnconfirmedRequestId(null)
                    pendingSaveRequestRef.current = null
                    quoteRequestIdRef.current = null
                    saveDraftNow(buildCurrentDraft(null))
                    void trackPlanEvent('save_failed', {
                        record_kind: saveAsStandaloneCosting ? 'costing' : 'quotation',
                    })
                    toast.error(tx(userFacingError(res.error, 'The Customer Quotation could not be saved. Try again.')))
                }
            }
        } catch (error) {
            if (effectiveTargetMode === 'quote' && clientRequestId) {
                setUnconfirmedRequestId(clientRequestId)
                await checkUnconfirmedSave(clientRequestId)
                return
            }
            void trackPlanEvent('save_failed', {
                record_kind: saveAsStandaloneCosting ? 'costing' : 'quotation',
            })
            console.error('Failed to save estimator quote:', error)
            toast.error(tx(userFacingError(error, 'Failed to save the Cost Estimate. Try again.')), {
                description: draftSavedBeforeSubmit
                    ? tx('Your Cost Estimate and retry identity remain saved on this device.')
                    : undefined,
            })
        } finally {
            setSavingQuote(false)
            saveQuoteLockRef.current = false
        }
    }

    const handleStartPartyOrder = async (warningAlreadyReviewed = false) => {
        if (saveQuoteLockRef.current || savingQuote) return
        setShowValidation(true)
        if (!hasValidCostResult) return toast.error(tx(firstCostingReadinessMessage ?? 'Complete the highlighted inputs before starting the party order.'))
        if (!warningAlreadyReviewed && requireWarningReview(() => handleStartPartyOrder(true))) return
        if (!partyName.trim()) return toast.error(t('estimator.toast.party_required'))
        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (!state.orderQuantityM || state.orderQuantityM <= 0) {
            return toast.error(tx('Set a quantity before starting the order'))
        }

        const quotePricePerM = costingResult.suggestedSellingPricePerM
        if (!quotePricePerM || quotePricePerM <= 0 || costingResult.productionCostPerM <= 0) {
            return toast.error(tx('Complete the estimate before starting the order'))
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
                if ('setupRequired' in result && result.setupRequired === 'machine') {
                    requestMachineSetup(() => {
                        void handleStartPartyOrder(true)
                    })
                    return
                }
                toast.error(tx(userFacingError(result.error, 'Party Order could not be started. Try again.')))
                return
            }

            clearDraft()
            suppressAutosaveUntilChanged()
            setSourceQuoteId(null)
            setSourceQuoteUpdatedAt(null)
            setSourceQuoteVersionNumber(null)
            setSourceQuoteCreatedAt(null)
            setSourceQuoteStatus(null)
            setSourceState(null)
            setSourceFactoryProfileUpdatedAt(null)
            setSourceRecordKind(null)
            quoteRequestIdRef.current = null
            toast.success(tx('Party order started and costing saved'))
            router.push(`/owner/orders?orderId=${result.orderId}`)
        } catch (error) {
            console.error('Failed to start party order:', error)
            toast.error(tx(userFacingError(error, 'Party Order could not be started. Check the estimate and try again.')))
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

    const hasOrderQty    = !!(state.orderQuantityM && state.orderQuantityM > 0)
    const showPartyField = canUseProduction && !isStandaloneCostingSession && mode !== 'market'
    const requiresCommercialContext = !isStandaloneCostingSession
    const actionReadinessId = 'estimator-action-readiness'
    // Validation: Pilot Safety Rails
    const isZeroConfig = state.overheadMode === 'monthly_expenses'
        && state.overheadItems.filter(i => i.isPreset).every(i => (i.monthlyAmount || 0) === 0)
    const pageShellClass = "w-full px-4 sm:px-6 lg:px-0"
    const hudShellClass = "w-full rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] px-3 py-3 shadow-[var(--shadow-card)] sm:px-5 sm:py-4"
    const postProcessingCostPerM = totals.windingPerM + totals.processingPerM + totals.finishingPerM
    const displayMarginPct = hasValidCostResult
        && costingResult.quoteIsValid
        && Number.isFinite(costingResult.actualMarginPct)
        ? costingResult.actualMarginPct
        : null
    const breakEvenMatchesProductionCost = hasValidCostResult
        && costingResult.quoteIsValid
        && breakEvenScenario?.quotePricePerM != null
        && costingResult.breakEvenPricePerM.toFixed(2) === costingResult.productionCostPerM.toFixed(2)
    const costSegments = hasValidCostResult ? [
        { label: 'Base Warp Yarn', value: totals.yarnBaseWarpPerM, color: 'bg-[var(--color-yarn-orange)]', text: 'text-[var(--color-yarn-orange)]' },
        { label: 'Base Weft Yarn', value: totals.yarnBaseWeftPerM, color: 'bg-[var(--color-warning-amber)]', text: 'text-[var(--color-warning-amber)]' },
        { label: 'Yarn Waste / Crimp', value: totals.yarnShortageCostPerM, color: 'bg-[#C98A2E]', text: 'text-[#9A651E]' },
        { label: 'Weave', value: totals.weaveCostPerM, color: 'bg-[var(--color-info-blue)]', text: 'text-[var(--color-info-blue)]' },
        { label: 'Warping', value: totals.warpingAndSizingPerM, color: 'bg-[var(--color-factory-green)]', text: 'text-[var(--color-factory-green)]' },
        { label: 'Overhead', value: costingResult.overheadPerM, color: 'bg-[var(--color-risk-red)]', text: 'text-[var(--color-risk-red)]' },
        { label: 'Post', value: postProcessingCostPerM, color: 'bg-[var(--color-warning-amber)]', text: 'text-[var(--color-warning-amber)]' },
    ].filter(segment => segment.value > 0) : []
    const costStackTotal = costSegments.reduce((sum, segment) => sum + segment.value, 0)
    const actionReadinessMessage = savingQuote
        ? 'Saving costing…'
        : !hasValidCostResult
            ? (firstCostingReadinessMessage ?? 'Complete the highlighted Cost Estimate inputs before saving.')
            : !qualityLabel.trim()
                ? 'Enter a Fabric Quality name before saving.'
                : totals.totalProductionCostPerM <= 0
                    ? 'Enter valid yarn and weaving inputs so Production Cost / m is above ₹0.'
                    : requiresCommercialContext && !partyName.trim()
                        ? 'Enter the Customer (Party) before preparing a quotation.'
                        : requiresCommercialContext && !hasOrderQty
                            ? 'Enter the quantity for this Cost Estimate before preparing a quotation.'
                            : requiresCommercialContext && !costingResult.quoteIsValid
                                ? 'Review the quotation assumptions before saving.'
                                : null
    const validityStatus = costingReadiness.status === 'ready'
        ? {
            label: 'Costing valid',
            description: 'Price and break-even are calculated from the current inputs.',
            icon: CheckCircle2,
            className: 'border-[#CDE5D3] bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)]',
        }
        : costingReadiness.status === 'warning_ack_required'
            ? {
                label: 'Review values before saving',
                description: 'The price is visible, but unusual inputs need acknowledgement.',
                icon: AlertTriangle,
                className: 'border-[var(--color-warning-amber-soft)] bg-[var(--color-warning-amber-soft)]/70 text-[var(--color-warning-amber)]',
            }
            : {
            label: 'Costing not ready',
            description: 'Complete the highlighted inputs before using this price.',
            icon: AlertCircle,
            className: 'border-[#E7C3BB] bg-[var(--color-risk-red-soft)] text-[var(--color-risk-red)]',
        }
    const firstEstimatorIssueField = estimatorValidation.issues[0]?.field
        ?? costingReadiness.issues[0]?.field
        ?? null
    const jumpToFirstEstimatorIssue = () => {
        const field = firstEstimatorIssueField
        const needsDetailedView = field != null && DETAILED_ESTIMATOR_ISSUE_FIELDS.has(field)
        if (needsDetailedView && entryMode !== 'detailed') {
            handleEntryModeChange('detailed')
        }
        if (needsDetailedView) setShowAdvancedOverhead(true)
        setShowValidation(true)

        window.setTimeout(() => {
            focusEstimatorIssueTarget(field ?? 'costingResult')
        }, needsDetailedView ? 240 : 80)
    }
    const auditLayerRows = [
        ...totals.audit.warp.layers.map(layer => ({ ...layer, section: 'Warp' })),
        ...totals.audit.weft.layers.map(layer => ({ ...layer, section: 'Weft' })),
    ]
    const yarnBaseCostPerM = totals.yarnBaseWarpPerM + totals.yarnBaseWeftPerM
    const auditCostLines = [
        { label: 'Base yarn subtotal', value: yarnBaseCostPerM },
        { label: 'Yarn wastage / crimp', value: totals.yarnShortageCostPerM },
        { label: 'Weave / loom', value: totals.audit.weaveCostPerMeter },
        { label: 'Warping + sizing', value: totals.audit.warpingAndSizingCostPerMeter },
        { label: 'Post-processing', value: totals.audit.postProcessingCostPerMeter },
        { label: 'Factory expenses / other', value: totals.audit.overheadCostPerMeter },
    ].filter(line => line.value > 0)
    return (
        <div className="premium-route-enter estimator-mobile-form space-y-5 pb-floating-button md:pb-20 relative">
            <RouteMilestones
                route="/owner/estimator"
                shellVisible
                primaryUsable
                secondaryReady={templatesLoaded}
            />
            <PageHeader
                icon={Calculator}
                title={mode === 'market' ? tx('Market estimate') : tx('Cost estimate')}
                description={tx('Build a reusable fabric cost estimate from yarn, loom, factory, and pricing inputs. Save the result when it is ready.')}
                actions={(
                    <Button variant="outline" onClick={() => router.push('/owner/quotes')}>
                        <History className="h-4 w-4" /> {tx('Saved costings')}
                    </Button>
                )}
            />
            {unconfirmedRequestId && (
                <section role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
                    <h2 className="font-semibold">{tx('Save not yet confirmed')}</h2>
                    <p className="mt-1">{saveCheckMessage || tx('Checking the original save. Keep this page open; editing is paused to protect your submitted costing.')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" disabled={checkingSave || savingQuote} onClick={() => void checkUnconfirmedSave(unconfirmedRequestId)}>
                            {checkingSave && <Loader2 className="h-4 w-4 animate-spin" />}{tx('Check save status')}
                        </Button>
                        {pendingSaveRequestRef.current && <Button disabled={checkingSave || savingQuote} onClick={() => void retrySubmittedSave()}>{tx('Retry original save')}</Button>}
                        <Button variant="ghost" onClick={() => router.push('/owner/quotes')}>{tx('Check Saved Costings')}</Button>
                    </div>
                </section>
            )}
            {lastSavedCosting && !unconfirmedRequestId && (
                <section role="status" className="rounded-xl border border-[var(--color-factory-green)]/25 bg-[var(--color-factory-green-soft)] p-4">
                    <h2 className="font-semibold">{tx('Saved to factory')} · {lastSavedCosting.model.qualityLabel} · v{lastSavedCosting.version}</h2>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{formatSuratDateTime(lastSavedCosting.savedAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => { setExportSavedCosting(true); setShowExportDialog(true) }}>{tx('Create customer quotation')}</Button>
                        <Button variant="outline" onClick={() => router.push('/owner/quotes')}>{tx('View saved costings')}</Button>
                        <Button variant="ghost" onClick={() => setShowConfirmNewQuality(true)}>{tx('Start another quality')}</Button>
                    </div>
                </section>
            )}
            <fieldset className="contents" onChangeCapture={event => {
                if (!journey && event.target instanceof HTMLElement && event.target.closest('[data-estimator-field]')) startJourney('blank')
            }} disabled={savingQuote || Boolean(unconfirmedRequestId)} inert={savingQuote || Boolean(unconfirmedRequestId)}>
            {qualityCheckpoint && !hasUnsavedEdits && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-hairline)] px-4 py-2 text-sm">
                    <span>{tx('Quality changed. Previous work is available until you edit or save.')}</span>
                    <Button variant="ghost" onClick={() => {
                        applyEstimatorDraft(qualityCheckpoint.draft)
                        setAppliedTemplate(templates.find(template => template.id === qualityCheckpoint.template?.id) ?? qualityCheckpoint.template)
                        saveDraftNow(qualityCheckpoint.draft)
                        setQualityCheckpoint(null)
                    }}>{tx('Undo quality change')}</Button>
                </div>
            )}
            {!state.isConfigured && (
                <FactoryCostWizard 
                    initialState={state}
                    initialYarnReviewIntervalDays={Number(initialProfile?.yarn_review_interval_days ?? 90)}
                    canUseFactoryProfiles={canUseProduction}
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
                                requireCapacity:         true,
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
                                    rawDispatch({ type: 'SET', field: key as keyof EstimateStatePatch, value: val as EstimateStateValue })
                                })
                                rawDispatch({ type: 'SET', field: 'isConfigured', value: true })
                                setFactoryBaselineUpdatedAt(res.updatedAt ?? factoryBaselineUpdatedAt)
                                toast.success(tx('Factory costing saved for new Cost Estimates'))
                            } else {
                                toast.error(tx(userFacingError(res.error, 'The factory costing could not be saved. Try again.')))
                            }
                        } catch {
                            toast.error(tx('The factory costing could not be saved. Try again.'))
                        } finally {
                            setSaving(false)
                        }
                    }}
                />
            )}

            {/* ── DRAFT RESTORE BANNER ─────────────────────────────── */}
            {hasDraft && draft && (
                <div className={pageShellClass}>
                    <div
                        className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-warning-amber)]/25 bg-[var(--color-warning-amber-soft)] px-4 py-3"
                        role="region"
                        aria-label="Unsaved Cost Estimate recovery"
                    >
                        <RotateCcw className="h-4 w-4 text-[var(--color-warning-amber)] shrink-0" />
                        <p className="text-sm text-[var(--color-warning-amber)] flex-1">
                            {draft.sourceQuoteId ? (
                                <>
                                    {draft.sourceRecordKind === 'costing' ? 'Updating saved Cost Estimate ' : canUseProduction ? 'Recalculating Cost Estimate from Quotation for ' : 'Updating saved Cost Estimate '}
                                    <span className="font-bold">{draft.sourceRecordKind === 'costing' || !canUseProduction ? (draft.qualityLabel || 'Untitled') : (draft.partyName || 'Unknown Party')}</span>
                                    {draft.qualityLabel && <span className="text-[var(--color-warning-amber)]"> ({draft.qualityLabel})</span>}
                                    {draft.sourceRecordKind === 'costing' && draft.sourceQuoteVersionNumber && (
                                        <span className="ml-1 text-[var(--color-warning-amber)]">· Editing costing v{draft.sourceQuoteVersionNumber}</span>
                                    )}
                                    {draft.sourceRecordKind === 'costing' && draft.sourceQuoteCreatedAt && (
                                        <span className="ml-1 text-[var(--color-warning-amber)]">· saved {formatTimestampDate(draft.sourceQuoteCreatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                    )}
                                    {draft.sourceRecordKind === 'costing' && ' · a new version will preserve the original'}
                                </>
                            ) : (
                                <>
                                    <span className="font-bold">Unsaved Cost Estimate</span> from{' '}
                                    {formatSuratDateTime(draft.createdAt)}
                                    {canUseProduction && draft.partyName && <span className="text-[var(--color-warning-amber)]"> · {draft.partyName}</span>}
                                </>
                            )}
                        </p>
                        <button
                            type="button"
                            onClick={() => applyEstimatorDraft()}
                            aria-label="Restore draft"
                            className="min-h-11 shrink-0 rounded-lg px-2 text-xs font-bold text-[var(--color-warning-amber)] underline underline-offset-2 hover:bg-[var(--color-warning-amber-soft)] hover:text-[var(--color-ink)]"
                        >
                            Resume
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowDiscardDraft(true)}
                            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[var(--color-warning-amber)] hover:bg-[var(--color-warning-amber-soft)] hover:text-[var(--color-ink)]"
                            aria-label="Discard draft"
                        ><X className="h-3.5 w-3.5" aria-hidden="true" /> <span>Discard</span></button>
                    </div>
                </div>
            )}

            {storageStatus === 'unavailable' && (
                <div className={`${pageShellClass} mb-2`}>
                    <p role="status" aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">
                        Draft recovery is unavailable on this device right now. Keep this page open until the Cost Estimate is explicitly saved.
                    </p>
                </div>
            )}

            {draftConflict && (
                <div className={`${pageShellClass} mb-2`}>
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-xs font-semibold text-sky-950">
                        <span className="min-w-0 flex-1">
                            {draftConflict.kind === 'cleared'
                                ? 'This draft was cleared in another tab. Your current tab has not been changed.'
                                : 'A newer draft was written in another tab. Your current tab has not been replaced.'}
                        </span>
                        <button
                            type="button"
                            onClick={acknowledgeDraftConflict}
                            className="min-h-10 rounded-lg px-3 underline underline-offset-2"
                        >
                            Keep this tab
                        </button>
                        {draftConflict.kind === 'updated' && (
                            <button
                                type="button"
                                onClick={() => window.location.reload()}
                                className="min-h-10 rounded-lg bg-sky-700 px-3 text-white"
                            >
                                Reload newer draft
                            </button>
                        )}
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
                                onClick={() => {
                                    warningContinuationRef.current = null
                                    setWarningSavePending(false)
                                    setShowWarningAcknowledgement(true)
                                }}
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
                            <div className="min-w-0 flex-1">
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
                            {estimatorValidation.issues.some(issue => (
                                issue.field === 'loomCount'
                                || issue.field === 'monthlyWorkingDays'
                                || issue.field === 'avgOutputPerLoomPerDay'
                                || issue.field === 'monthlyOutputM'
                            )) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="shrink-0 border-red-300 bg-white text-red-800 hover:bg-red-100"
                                    onClick={() => {
                                        handleEntryModeChange('detailed')
                                        setShowAdvancedOverhead(true)
                                    }}
                                >
                                    Open capacity inputs
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Keep the editing surface full width. On wide desktop the live
                estimate and reference links move into the spare viewport rail
                instead of taking space from the estimator canvas. */}
            <div className="estimator-workspace-shell">
                <div className="estimator-workspace-main min-w-0">
                    <div className="relative min-w-0">
                    {/* ── STICKY QUOTE COCKPIT ─────────────────────────────── */}
                    <div
                        data-testid="estimator-primary-cockpit"
                        aria-hidden="true"
                        className="hidden"
                    >
                <div className={`${hudShellClass} premium-focus-surface`}>
                    <div className="mb-4 border-b border-[var(--color-hairline)] pb-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                                    <p className="text-[12px] font-semibold tracking-[0.02em] text-[var(--color-ink)]" aria-label={t('estimator.sprint1.active_record')}>Active cost estimate</p>
                                    <span className="max-w-full break-words rounded-full border border-[var(--color-yarn-orange)]/25 bg-[var(--color-warning-amber-soft)]/60 px-2 py-0.5 text-[10px] font-semibold text-[var(--color-yarn-orange-dark)]">
                                        <span className="sr-only">{t('estimator.sprint1.quality')}: </span>{appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}
                                    </span>
                                    {sourceQuoteId && sourceRecordKind === 'costing' && (
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">{t('estimator.sprint1.costing')} v{sourceQuoteVersionNumber ?? 1}{sourceQuoteCreatedAt ? ` · ${formatTimestampDate(sourceQuoteCreatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}` : ''}</span>
                                    )}
                                </div>
                                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                                    <span className="inline-flex min-w-0 items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-factory-green)]" aria-hidden="true" />
                                        {sourceQuoteId && sourceRecordKind === 'costing' && !sourceFactoryProfileUpdatedAt
                                            ? t('estimator.sprint1.baseline_not_recorded')
                                            : sourceFactoryProfileUpdatedAt
                                                ? `${t('estimator.sprint1.baseline_captured')}: ${formatTimestampDate(sourceFactoryProfileUpdatedAt, { day: 'numeric', month: 'short', year: 'numeric' })}`
                                                : 'Current factory baseline'}
                                    </span>
                                    {!sourceQuoteId && <span aria-label={t('estimator.sprint1.new_costing_snapshot')}>New costing snapshot</span>}
                                </div>
                                {sourceQuoteId && (
                                    <p className="mt-2 max-w-3xl text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                                        {versionInputChangeSummary
                                            ? `Changed inputs since v${sourceQuoteVersionNumber ?? 1}: ${versionInputChangeSummary}. Create new version is deliberate; review this summary before saving.`
                                            : `No costing inputs changed since v${sourceQuoteVersionNumber ?? 1}. Saving again keeps the same version and will not create a duplicate snapshot.`}
                                        {sourceRecordKind === 'quotation' && sourceQuoteStatus && ` Existing quotation status stays ${sourceQuoteStatus} until you use the allowed status action.`}
                                    </p>
                                )}
                            </div>
                            <div className="flex shrink-0 items-center gap-1 self-start rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5" role="tablist" aria-label={entryMode === 'quick' ? tx('Essential construction inputs · same calculation engine') : tx('Full technical inputs & factory assumptions · same calculation engine')}>
                                <button type="button" role="tab" aria-selected={entryMode === 'quick'} aria-controls="estimator-form-panel" title={tx('Essential construction inputs · same calculation engine')} onClick={() => handleEntryModeChange('quick')} className={`premium-segment estimator-touch-target rounded-lg px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] ${entryMode === 'quick' ? 'bg-[var(--color-surface)] text-[var(--color-yarn-orange-dark)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>Quick</button>
                                <button type="button" role="tab" aria-selected={entryMode === 'detailed'} aria-controls="estimator-form-panel" title={tx('Full technical inputs & factory assumptions · same calculation engine')} onClick={() => handleEntryModeChange('detailed')} className={`premium-segment estimator-touch-target rounded-lg px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] ${entryMode === 'detailed' ? 'bg-[var(--color-surface)] text-[var(--color-yarn-orange-dark)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>Detailed</button>
                            </div>
                        </div>
                    </div>
                    <div data-testid="legacy-costing-validity" className={`mb-4 flex min-h-11 items-start gap-2.5 rounded-[10px] border px-3 py-2.5 text-[11px] leading-4 ${validityStatus.className}`} role="status" aria-live="polite">
                        <validityStatus.icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                            <span className="font-semibold">{validityStatus.label}</span>
                            <span className="ml-1.5 font-medium opacity-85">{validityStatus.description}</span>
                        </div>
                    </div>
                    <div className={entryMode === 'detailed' ? 'space-y-5' : 'grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-start'}>
                        <div className={entryMode === 'detailed' ? 'grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.42fr)] lg:items-start' : 'min-w-0 space-y-3'}>
                            <div className="min-w-0 space-y-4">
                                <div className={`grid min-w-0 grid-cols-2 gap-3 sm:gap-4 ${breakEvenMatchesProductionCost ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
                                    <div className="min-w-0">
                                        <p className="mb-1 text-[11px] font-semibold leading-4 text-[var(--color-muted)]" aria-label={t('estimator.price_helpers.production_cost')}>Production cost / m</p>
                                        <p className="max-w-full break-words font-mono text-[clamp(1.45rem,7vw,2.2rem)] font-semibold leading-[1.05] tracking-tight tabular-nums text-[var(--color-ink)]">
                                            {hasValidCostResult ? `₹${costingResult.productionCostPerM.toFixed(2)}` : '—'}
                                        </p>
                                        {breakEvenMatchesProductionCost && (
                                            <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]" title={t('estimator.price_helpers.break_even_hint')}>Break-even floor</p>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="mb-1 text-[11px] font-semibold leading-4 text-[var(--color-muted)]" aria-label={t('estimator.price_helpers.suggested_selling_price')}>
                                            {mode === 'market' ? 'Target price / m' : t('common.suggested_selling_price_per_m')}
                                        </p>
                                        <p className="max-w-full break-words font-mono text-[clamp(1.45rem,7vw,2.2rem)] font-semibold leading-[1.05] tracking-tight tabular-nums text-[var(--color-yarn-orange)]">
                                            {hasValidCostResult && costingResult.quoteIsValid ? `₹${costingResult.suggestedSellingPricePerM.toFixed(2)}` : '—'}
                                        </p>
                                    </div>
                                    <div className={`col-span-2 grid gap-3 border-y border-[var(--color-hairline)]/80 py-3 sm:gap-4 ${breakEvenMatchesProductionCost ? 'grid-cols-1 xl:col-span-1' : 'grid-cols-2 xl:col-span-2'} xl:border-y-0 xl:border-l xl:pl-4 xl:py-0`}>
                                    <div className={`min-w-0 rounded-[10px] border px-2.5 py-2 sm:px-3 ${displayMarginPct === null
                                        ? 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)]'
                                        : displayMarginPct > 0
                                            ? 'border-[#CDE5D3] bg-[var(--color-factory-green-soft)]'
                                            : displayMarginPct < 0
                                                ? 'border-[#E7C3BB] bg-[var(--color-risk-red-soft)]'
                                                : 'border-[var(--color-warning-amber-soft)] bg-[var(--color-warning-amber-soft)]/55'}`}>
                                        <p className={`mb-1 text-[11px] font-semibold leading-4 ${displayMarginPct === null
                                            ? 'text-[var(--color-muted)]'
                                            : displayMarginPct > 0
                                                ? 'text-[var(--color-factory-green)]'
                                                : displayMarginPct < 0
                                                    ? 'text-[var(--color-risk-red)]'
                                                    : 'text-[var(--color-warning-amber)]'}`}>Actual margin</p>
                                        <p className={`max-w-full break-words font-mono text-[clamp(1.3rem,6vw,1.75rem)] font-semibold leading-[1.05] tracking-tight tabular-nums ${displayMarginPct === null
                                            ? 'text-[var(--color-muted)]'
                                            : displayMarginPct > 0
                                                ? 'text-[var(--color-factory-green)]'
                                                : displayMarginPct < 0
                                                    ? 'text-[var(--color-risk-red)]'
                                                    : 'text-[var(--color-warning-amber)]'}`}>
                                            {displayMarginPct === null ? '—' : `${displayMarginPct >= 0 ? '+' : ''}${displayMarginPct.toFixed(1)}%`}
                                        </p>
                                        <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                                            {displayMarginPct === null ? 'Complete estimate' : displayMarginPct > 0 ? 'Above break-even' : displayMarginPct < 0 ? 'Below break-even' : 'At break-even'}
                                        </p>
                                    </div>
                                    {!breakEvenMatchesProductionCost && <div className="min-w-0 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-2.5 py-2 sm:px-3">
                                        <p className="mb-1 text-[11px] font-semibold leading-4 text-[var(--color-muted)]" aria-label={t('estimator.price_helpers.break_even')}>Break-even price / m</p>
                                        <p className="max-w-full break-words font-mono text-[clamp(1.3rem,6vw,1.75rem)] font-semibold leading-[1.05] tracking-tight tabular-nums text-[var(--color-ink)]">
                                            {hasValidCostResult && breakEvenScenario?.quotePricePerM != null
                                                ? `₹${costingResult.breakEvenPricePerM.toFixed(2)}`
                                                : '—'}
                                        </p>
                                        <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]" title={t('estimator.price_helpers.break_even_hint')}>Minimum at 0% margin</p>
                                    </div>}
                                    </div>
                                </div>

                                {hasOrderQty && (
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[var(--color-hairline)]/80 pt-3">
                                        <span className="text-[11px] font-semibold text-[var(--color-muted)]">Expected profit</span>
                                        <span className={`font-mono text-[14px] font-semibold tabular-nums ${costingResult.expectedProfitTotal != null && costingResult.expectedProfitTotal < 0 ? 'text-[var(--color-risk-red)]' : 'text-[var(--color-factory-green)]'}`}>
                                            {hasValidCostResult && costingResult.quoteIsValid && costingResult.expectedProfitTotal != null
                                                ? `₹${costingResult.expectedProfitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : '—'}
                                        </span>
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">for {Number(state.orderQuantityM).toLocaleString('en-IN')} m</span>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-soft)]" aria-label="Cost composition">
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

                                <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 border-t border-[var(--color-hairline)]/80 pt-3">
                                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-muted)]">Material context</span>
                                    <span className="max-w-full break-words text-[12px] font-semibold text-[var(--color-ink)]">{appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}</span>
                                    <span className="text-[11px] font-medium text-[var(--color-muted)]">· Warp yarn {state.warpRows.length} component{state.warpRows.length === 1 ? '' : 's'} · Weft yarn {state.weftRows.length} component{state.weftRows.length === 1 ? '' : 's'}</span>
                                </div>
                                {appliedTemplate && !canUseProduction && (
                                    <p
                                        data-testid="saved-quality-reuse-status"
                                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] font-medium leading-4 text-blue-900"
                                    >
                                        {appliedTemplate.latest_costing_reuse
                                            ? 'Full costing reuse is active: current yarn rates are combined with the latest saved costing assumptions.'
                                            : 'This Saved Quality has no linked costing snapshot yet. Current factory defaults are being used for the costing assumptions.'}
                                    </p>
                                )}
                            </div>

                            <CostingAssumptionsSummary
                                result={costingResult}
                                isStandaloneCostingSession={isStandaloneCostingSession}
                                expanded={assumptionsExpanded}
                                onToggle={toggleAssumptions}
                            />
                        </div>

                        {showCostingSaveGuidance && (
                            <div
                                data-testid="costing-save-guidance"
                                role="note"
                                aria-label="Costing save guidance"
                                className="flex items-start gap-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2 text-[10px] font-medium leading-4 text-[var(--color-muted)] 2xl:col-span-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <p><span className="font-semibold text-[var(--color-ink)]">Save quality/recipe:</span> reusable construction and assumptions.</p>
                                    <p><span className="font-semibold text-[var(--color-ink)]">Save costing snapshot:</span> frozen result for this rate/date/quantity.</p>
                                    <p><span className="font-semibold text-[var(--color-ink)]">Create new version:</span> deliberate action with the changed-input summary above; an ordinary repeat save does not create a duplicate.</p>
                                </div>
                                <button
                                    type="button"
                                    className="estimator-touch-target -my-1 -mr-2 inline-flex shrink-0 items-center justify-center rounded-md px-2 text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)]"
                                    onClick={dismissCostingSaveGuidance}
                                    aria-label="Dismiss costing save guidance"
                                    title="Dismiss costing save guidance"
                                >
                                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                            </div>
                        )}

                        <div className="space-y-2 2xl:w-[520px]">
                            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">

                            {mode === 'quote' || isStandaloneCostingSession ? (
                                <>
                                    {/* PRIMARY: atomically create the accepted quote and live order */}
                                    {canUseProduction && !isStandaloneCostingSession && <Button
                                        id="legacy-btn-start-party-order"
                                        size="sm"
                                        className="col-span-2 h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] sm:col-span-1"
                                        onClick={() => void handleStartPartyOrder()}
                                        disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !costingResult.quoteIsValid}
                                        aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                                        aria-busy={savingQuote}
                                        title={(!hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !costingResult.quoteIsValid)
                                            ? tx('Complete party, quality, quantity, and cost result first.')
                                            : undefined
                                        }
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Play className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">{tx('Start Party Order')}</span>
                                    </Button>}

                                    {/* Base keeps costing as the primary action; Full Suite retains quote acceptance styling. */}
                                    <Button
                                        id="legacy-btn-save-accept"
                                        data-testid="legacy-save-costing-action"
                                        size="sm"
                                        variant={isStandaloneCostingSession ? 'default' : 'outline'}
                                        className={isStandaloneCostingSession
                                            ? 'col-span-2 h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] sm:col-span-1'
                                            : 'h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]'}
                                        onClick={() => handleSaveQuote('quote', isStandaloneCostingSession ? 'draft' : 'accepted')}
                                        disabled={savingQuote || !hasValidCostResult || (requiresCommercialContext && !hasOrderQty) || (requiresCommercialContext && !partyName.trim()) || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || (requiresCommercialContext && !costingResult.quoteIsValid)}
                                        aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                                        aria-busy={savingQuote}
                                        aria-label={!isStandaloneCostingSession
                                            ? sourceQuoteId ? 'Save quotation with current status' : 'Save and accept quotation'
                                            : sourceQuoteId
                                                ? 'Save new immutable costing version'
                                                : 'Save costing snapshot'}
                                        title={firstCostingReadinessMessage ?? (((requiresCommercialContext && !hasOrderQty) || (requiresCommercialContext && !partyName.trim()) || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || (requiresCommercialContext && !costingResult.quoteIsValid))
                                            ? (requiresCommercialContext ? tx('Complete customer, quality, quantity, and cost result first.') : tx('Complete quality and cost inputs first.'))
                                            : undefined)}
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">{tx(!isStandaloneCostingSession ? (sourceQuoteId ? 'Save Quotation' : 'Save & Accept') : (sourceQuoteId ? 'Save New Version' : 'Save Costing'))}</span>
                                    </Button>

                                    {isStandaloneCostingSession && (
                                        <Button
                                            id="legacy-btn-export-cost-sheet"
                                            size="sm"
                                            variant="outline"
                                            className="h-12 rounded-[10px] border border-[var(--color-yarn-orange)] bg-white px-5 text-[14px] font-semibold text-[var(--color-yarn-orange-dark)] hover:bg-[var(--color-warning-amber-soft)]"
                                            onClick={() => setShowExportDialog(true)}
                                            disabled={!exportModel}
                                            aria-describedby={!exportModel ? 'export-cost-sheet-hint' : undefined}
                                            title={exportModel ? tx('Create an internal cost sheet or customer quotation') : tx('Correct the highlighted inputs before exporting')}
                                        >
                                            <FileDown className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{tx('Export Cost Sheet')}</span>
                                        </Button>
                                    )}

                                    {/* TERTIARY: Save Quote */}
                                    {canUseProduction && !isStandaloneCostingSession && <Button
                                        id="legacy-btn-save-quote"
                                        size="sm"
                                        variant="outline"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => handleSaveQuote('quote', 'draft')}
                                        disabled={savingQuote || !costingResult.quoteIsValid}
                                        aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                                        aria-busy={savingQuote}
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Save className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">{tx('Save Quotation')}</span>
                                    </Button>}

                                    {/* TERTIARY: Switch to Market mode */}
                                    {canUseProduction && !isStandaloneCostingSession && allowsMarketRuns && (
                                        <Button
                                            id="legacy-btn-switch-market"
                                            size="sm"
                                            variant="ghost"
                                            className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                            onClick={() => setMode('market')}
                                        >
                                            <Gauge className="h-3.5 w-3.5 shrink-0" />
                                            <span className="truncate">{tx('Market Run')}</span>
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <>
                                    {/* PRIMARY: Start Market Run */}
                                    <Button
                                        id="legacy-btn-start-market-run"
                                        size="sm"
                                        className="col-span-2 h-12 rounded-[10px] bg-[var(--color-yarn-orange)] px-5 text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(217,107,28,0.24)] hover:bg-[var(--color-yarn-orange-dark)] sm:col-span-1"
                                        onClick={() => handleSaveQuote('market')}
                                        disabled={savingQuote || !hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !costingResult.quoteIsValid}
                                        aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                                        aria-busy={savingQuote}
                                        title={(!hasOrderQty || !partyName.trim() || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0 || !costingResult.quoteIsValid)
                                            ? tx('Complete Fabric Quality, quantity, and Cost Estimate first.')
                                            : undefined
                                        }
                                    >
                                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <Gauge className="h-3.5 w-3.5 shrink-0" />}
                                        <span className="truncate">{tx('Start Market Run')}</span>
                                    </Button>

                                    {/* SECONDARY: Save Quote (draft) */}
                                    {allowsPartyOrders && <Button
                                        id="legacy-btn-save-quote-market"
                                        size="sm"
                                        variant="outline"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => handleSaveQuote('quote')}
                                        disabled={savingQuote || !costingResult.quoteIsValid}
                                        aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                                        aria-busy={savingQuote}
                                    >
                                        <Save className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{tx('Save Quotation')}</span>
                                    </Button>}

                                    {/* TERTIARY: Transition to Party Order mode */}
                                    {allowsPartyOrders && <Button
                                        id="legacy-btn-start-party-order-market"
                                        size="sm"
                                        variant="ghost"
                                        className="h-12 rounded-[10px] border border-[var(--color-hairline)] bg-white px-5 text-[14px] font-semibold text-[var(--color-body)] hover:bg-[var(--color-surface-soft)]"
                                        onClick={() => setMode('quote')}
                                        disabled={savingQuote}
                                    >
                                        <Play className="h-3.5 w-3.5 shrink-0" />
                                        <span className="truncate">{tx('Party Order')}</span>
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
                                        onClick={() => void handleUpdateTemplate()}
                                        disabled={savingTemplate || !hasActiveQualityRecipeChanges}
                                        aria-busy={savingTemplate}
                                        title={!hasActiveQualityRecipeChanges ? tx('No Saved Quality changes to update') : undefined}
                                    >
                                        {savingTemplate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 text-brand-accent shrink-0" />}
                                        <span className="truncate">{tx(savingTemplate ? 'Saving Fabric Quality…' : 'Update Fabric Quality')}</span>
                                    </Button>
                                    <Button
                                        data-testid="legacy-save-as-new-quality"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openSaveAsNewQualityDialog()}
                                        className="h-12 min-w-0 rounded-[10px] border border-[var(--color-hairline)] bg-white px-4 text-[14px] font-semibold text-[var(--color-body)] hover:border-[var(--color-yarn-orange)] hover:bg-[var(--color-warning-amber-soft)] hover:text-[var(--color-yarn-orange-dark)]"
                                        title={tx('Use this recipe as the starting point for a separate quality')}
                                        aria-label={tx(`Use ${appliedTemplate.name} as a starting point; save as a new quality`)}
                                    >
                                        <BookmarkPlus className="mr-1.5 h-4 w-4" />
                                        <span className="truncate">{tx('Save as separate quality')}</span>
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
                            ) : null}
                            </div>
                            {isStandaloneCostingSession && !exportModel && (
                                <p id="export-cost-sheet-hint" className="w-full text-xs font-medium leading-relaxed text-amber-700">
                                    {tx('Complete the highlighted inputs before creating an Internal Cost Sheet or Customer Quotation.')}
                                </p>
                            )}
                            <p className="text-[11px] font-medium leading-relaxed text-[var(--color-muted)]">
                                {isStandaloneCostingSession
                                        ? sourceQuoteId
                                        ? tx('Save New Version creates a new immutable costing snapshot. Earlier versions keep their original economics.')
                                        : tx('Save Costing creates the reusable quality and its first immutable costing version.')
                                    : tx('Save & Accept stores the quotation and moves it into the accepted workflow.')}
                            </p>
                        </div>
                    </div>

                    {actionReadinessMessage && (
                        <p id={`${actionReadinessId}-legacy`} role="status" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium leading-relaxed text-amber-800">
                            {actionReadinessMessage}
                        </p>
                    )}

                    {(!canUseProduction || hasOrderQty) && costingResult.quoteIsValid && (
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
                                            {hasValidCostResult && costingResult.expectedProfitTotal !== null
                                                ? `₹${costingResult.expectedProfitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : '—'}
                                        </p>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
                    </div>
                    </div>

                    {/* ── MAIN FORM ────────────────────────────────────────────── */}
                    <div id="estimator-form-panel" className={`${pageShellClass} mt-5 space-y-7`}>

                {/* ── CURRENT QUALITY + MODE ─────────────────────────────── */}
                <Sheet open={showQualityLibrary} onOpenChange={setShowQualityLibrary}>
                    <section
                        id="active-quality"
                        aria-labelledby="active-quality-title"
                        className="premium-focus-surface rounded-[14px] border border-[var(--color-hairline)] bg-white/95 px-4 py-3 shadow-[var(--shadow-card)] sm:px-5"
                    >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-yarn-orange-dark)]">Current quality</p>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                                    <h2 id="active-quality-title" className="max-w-full break-words text-[15px] font-bold leading-5 text-[var(--color-ink)]">
                                        {appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}
                                    </h2>
                                    {sourceQuoteId && sourceRecordKind === 'costing' && (
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">Costing v{sourceQuoteVersionNumber ?? 1}</span>
                                    )}
                                </div>
                                <p className="mt-1 text-[11px] font-medium leading-4 text-[var(--color-muted)]">
                                    {tx(appliedTemplate ? 'Saved recipe loaded. Review rates before saving.' : 'New construction. Enter the required inputs below.')}
                                    <span className="mt-1 block">{tx('Quick and Detailed use the same calculation. Detailed shows additional assumptions.')}</span>
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                {(!templatesLoaded || templates.length === 0) && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowQualityLibrary(true)}
                                    className="h-11 justify-center rounded-[10px] border-[var(--color-hairline-strong)] bg-white px-4 text-[12px] font-semibold text-[var(--color-body)] hover:border-[var(--color-yarn-orange)] hover:bg-[var(--color-warning-amber-soft)] hover:text-[var(--color-yarn-orange-dark)]"
                                >
                                    <BookmarkPlus className="h-3.5 w-3.5" />
                                    Change quality
                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </Button>
                                )}
                                <div className="flex items-center rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5" role="tablist" aria-label={entryMode === 'quick' ? tx('Quick Costing · same calculation engine') : tx('Full technical inputs & factory assumptions · same calculation engine')}>
                                    <button type="button" role="tab" aria-selected={entryMode === 'quick'} aria-controls="estimator-form-panel" title={tx('Quick Costing · same calculation engine')} onClick={() => handleEntryModeChange('quick')} className={`premium-segment estimator-touch-target rounded-lg px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] ${entryMode === 'quick' ? 'bg-[var(--color-surface)] text-[var(--color-yarn-orange-dark)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>Quick</button>
                                    <button type="button" role="tab" aria-selected={entryMode === 'detailed'} aria-controls="estimator-form-panel" title={tx('Full technical inputs & factory assumptions · same calculation engine')} onClick={() => handleEntryModeChange('detailed')} className={`premium-segment estimator-touch-target rounded-lg px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] ${entryMode === 'detailed' ? 'bg-[var(--color-surface)] text-[var(--color-yarn-orange-dark)] shadow-sm' : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'}`}>Detailed</button>
                                </div>
                            </div>
                        </div>
                        {templatesLoaded && templates.length > 0 && (
                            <button
                                type="button"
                                data-testid="saved-quality-quick-picker"
                                onClick={() => setShowQualityLibrary(true)}
                                aria-haspopup="dialog"
                                aria-label={`Tap to view ${templates.length} saved ${templates.length === 1 ? 'quality' : 'qualities'}`}
                                className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]/60 px-3.5 py-2.5 text-left transition-colors hover:border-[var(--color-yarn-orange)]/45 hover:bg-[var(--color-warning-amber-soft)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]/35"
                            >
                                <span className="min-w-0">
                                    <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">Saved qualities</span>
                                    <span className="mt-0.5 block truncate text-[12px] font-medium text-[var(--color-body)]">Tap to view {templates.length} saved {templates.length === 1 ? 'quality' : 'qualities'}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--color-yarn-orange-dark)]">
                                    View
                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                </span>
                            </button>
                        )}
                        <div data-testid="costing-validity" className={`mt-3 flex min-h-10 items-center gap-2 rounded-[10px] border px-3 py-2 text-[11px] leading-4 ${validityStatus.className}`} role="status" aria-live="polite">
                            <validityStatus.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">{validityStatus.label}</span>
                            <span className="hidden font-medium opacity-85 sm:inline">{validityStatus.description}</span>
                        </div>
                    </section>

                    <SheetContent
                        side="bottom"
                        onOpenAutoFocus={event => event.preventDefault()}
                        className="max-h-[min(88dvh,48rem)] overflow-y-auto rounded-t-[22px] border-x-0 border-b-0 px-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-0 md:top-1/2 md:bottom-auto md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(calc(100vw-3rem),48rem)] md:rounded-[22px] md:border md:border-[var(--color-hairline)]"
                    >
                        <SheetHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-warning-amber-soft)]/70 px-5 pb-4 pt-5 pr-16 text-left">
                            <SheetTitle className="text-[17px]">Change quality</SheetTitle>
                            <SheetDescription className="text-[12px] font-medium text-[var(--color-muted)]">Search and select a saved fabric recipe. Your current costing stays in place until you choose one.</SheetDescription>
                        </SheetHeader>
                        <div className="p-4 sm:p-5">
                            {templatesLoaded && templates.length > 0 && (
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                                    <input
                                        type="search"
                                        value={templateSearch}
                                        onChange={e => setTemplateSearch(e.target.value)}
                                        placeholder={t('estimator.quality.searchPlaceholder').replace('{count}', String(templates.length))}
                                        aria-label={tx('Search saved qualities')}
                                        className="h-12 w-full rounded-[11px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-10 pr-10 text-[13px] font-medium text-[var(--color-ink)] placeholder:font-normal placeholder:text-[var(--color-muted)] focus:border-[var(--color-yarn-orange)] focus:outline-none focus:ring-2 focus:ring-[var(--color-yarn-orange)]/15"
                                    />
                                    {templateSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setTemplateSearch('')}
                                            className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)]"
                                            aria-label={tx('Clear quality search')}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            )}
                            {templatesLoaded && templates.length > 0 && templateSearch && (
                                <p className="mt-1.5 text-[10px] font-medium text-[var(--color-muted)]">
                                    {t('estimator.quality.searchResults')
                                        .replace('{shown}', String(filteredTemplates.length))
                                        .replace('{total}', String(templates.length))}
                                </p>
                            )}
                {/* ── SAVED FABRIC QUALITIES ─────────────────────────────── */}
                <section
                    id="saved-qualities"
                    aria-labelledby="saved-qualities-title"
                    aria-busy={!templatesLoaded}
                    className="premium-focus-surface mt-4 overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-white/95 shadow-[var(--shadow-card)]"
                >
                    <div className="border-b border-[var(--color-hairline)] bg-[var(--color-warning-amber-soft)]/70 px-4 py-4 sm:px-5 sm:py-5">
                        <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] border border-[var(--color-yarn-orange)]/25 bg-white text-[var(--color-yarn-orange)] shadow-[0_3px_10px_rgba(217,107,28,0.12)]">
                                <BookmarkPlus className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-col items-start gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-2.5 sm:gap-y-1">
                                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-yarn-orange-dark)]">{t('estimator.quality.savedQualitiesEyebrow')}</p>
                                    <span
                                        role="status"
                                        aria-live="polite"
                                        className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-[var(--color-yarn-orange)]/25 bg-white px-2 py-0.5 text-[10px] font-bold text-[var(--color-yarn-orange-dark)]"
                                    >
                                        {templatesLoaded ? t('estimator.quality.savedQualityCount', { count: templates.length }) : tx('Loading saved qualities…')}
                                    </span>
                                </div>
                                <h2 id="saved-qualities-title" className="mt-1 text-[17px] font-bold leading-5 text-[var(--color-ink)] sm:text-[18px]">{t('estimator.quality.myQualities')}</h2>
                                <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-[var(--color-body)]/80">{t('estimator.quality.myQualitiesHelper')}</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 px-4 py-4 sm:px-5 sm:py-5">
                        {secondaryError && (
                            <div className="rounded-[12px] border border-amber-300 bg-amber-50 px-3.5 py-3.5 text-xs font-medium text-amber-900" role="status">
                                {tx('Saved quality details are temporarily unavailable. The Cost Estimate remains ready to use.')}
                            </div>
                        )}
                        {!templatesLoaded ? null : templates.length === 0 ? (
                            <div className="flex items-start gap-3 rounded-[12px] border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-surface-soft)]/55 px-3.5 py-3.5 sm:items-center">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-[var(--color-yarn-orange)] shadow-sm">
                                    <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-[var(--color-ink)]">{t('estimator.quality.emptySavedTitle')}</p>
                                    <p className="mt-0.5 text-xs leading-5 text-[var(--color-muted)]">{t('estimator.quality.emptySavedDescription')}</p>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-muted)]">{t('estimator.quality.savedRecipesLabel')}</p>
                                    <p className="text-[10px] font-medium text-[var(--color-muted)]">{t('estimator.quality.hint')}</p>
                                </div>
                                <div className={filteredTemplates.length > 1 ? 'flex min-w-0 items-center gap-2' : 'min-w-0'}>
                                    {canUseProduction && filteredTemplates.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => scrollSavedQualities('left')}
                                            disabled={!savedQualitiesScrollState.canScrollLeft}
                                            aria-disabled={!savedQualitiesScrollState.canScrollLeft}
                                            aria-controls="saved-quality-rail"
                                            className="estimator-touch-target flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-body)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-yarn-orange)] hover:text-[var(--color-yarn-orange-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]/35 disabled:pointer-events-none disabled:opacity-35"
                                            aria-label={t('estimator.quality.previousSavedQualities')}
                                            title={t('estimator.quality.previousSavedQualities')}
                                        >
                                            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    )}
                                    <div
                                        id="saved-quality-rail"
                                        ref={savedQualitiesRailRef}
                                        className={canUseProduction ? "mobile-scroll-x flex min-w-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth no-scrollbar" : "grid min-w-0 flex-1 gap-2 sm:grid-cols-2"}
                                        role="list"
                                        aria-label={t('estimator.quality.savedRecipesLabel')}
                                    >
                                    {filteredTemplates.map(tpl => {
                                        const isActive = appliedTemplate?.id === tpl.id || (!tpl.id && qualityLabel === tpl.name);
                                        return (
                                            <div
                                                key={tpl.id}
                                                data-saved-quality-card
                                                role="listitem"
                                                className={`group flex w-full ${canUseProduction ? 'max-w-[340px] shrink-0 snap-start' : 'min-w-0'} items-stretch overflow-hidden rounded-[12px] border transition-colors ${
                                                    isActive
                                                        ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)]/70 shadow-[0_3px_10px_rgba(217,107,28,0.10)]'
                                                        : 'border-[var(--color-hairline)] bg-white hover:border-[var(--color-hairline-strong)] hover:shadow-[0_3px_10px_rgba(30,37,40,0.05)]'
                                                }`}
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => applyTemplate(tpl)}
                                                    onContextMenu={e => { e.preventDefault(); openEditRates(tpl) }}
                                                    aria-pressed={isActive}
                                                    aria-label={`${t('estimator.quality.applyHint')}: ${tpl.name}`}
                                                    className="flex min-h-[68px] min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left"
                                                >
                                                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border ${isActive ? 'border-[var(--color-yarn-orange)]/30 bg-white text-[var(--color-yarn-orange-dark)]' : 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[var(--color-muted)]'}`}>
                                                        {isActive ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : <BookmarkPlus className="h-4 w-4" aria-hidden="true" />}
                                                    </span>
                                                    <span className="min-w-0 flex-1">
                                                        <span className={`block truncate text-[13px] font-bold leading-5 ${isActive ? 'text-[var(--color-yarn-orange-dark)]' : 'text-[var(--color-ink)]'}`}>{tpl.name}</span>
                                                        <span className="mt-0.5 block text-[10px] font-medium leading-4 text-[var(--color-muted)]">{isActive ? t('estimator.quality.selectedLabel') : t('estimator.quality.applyHint')}</span>
                                                    </span>
                                                </button>
                                                <div className={`flex shrink-0 items-center gap-0.5 border-l px-1 ${isActive ? 'border-[var(--color-yarn-orange)]/25' : 'border-[var(--color-hairline)]'}`}>
                                                    <button
                                                        type="button"
                                                        onClick={e => { e.stopPropagation(); openEditRates(tpl) }}
                                                        className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-muted)] transition-colors hover:bg-white hover:text-[var(--color-yarn-orange-dark)]"
                                                        title={t('estimator.quality.editRatesTitle')}
                                                        aria-label={`${t('estimator.quality.editRatesTitle')}: ${tpl.name}`}
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                                    </button>
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={tx('Quality actions')}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onSelect={() => { setRenameTpl(tpl); setRenameValue(tpl.name); setRenameError(null) }}>{tx('Rename quality')}</DropdownMenuItem>
                                                            <DropdownMenuItem disabled={deletingTpl === tpl.id} onSelect={() => setTemplateToArchive(tpl)}>{tx('Archive quality')}</DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    </div>
                                    {canUseProduction && filteredTemplates.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => scrollSavedQualities('right')}
                                            disabled={!savedQualitiesScrollState.canScrollRight}
                                            aria-disabled={!savedQualitiesScrollState.canScrollRight}
                                            aria-controls="saved-quality-rail"
                                            className="estimator-touch-target flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] text-[var(--color-body)] shadow-[var(--shadow-card)] transition-colors hover:border-[var(--color-yarn-orange)] hover:text-[var(--color-yarn-orange-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]/35 disabled:pointer-events-none disabled:opacity-35"
                                            aria-label={t('estimator.quality.nextSavedQualities')}
                                            title={t('estimator.quality.nextSavedQualities')}
                                        >
                                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    )}
                                </div>
                                {filteredTemplates.length === 0 && templateSearch && (
                                    <p className="rounded-[10px] border border-dashed border-[var(--color-hairline-strong)] bg-[var(--color-surface-soft)] px-3 py-2.5 text-xs italic text-[var(--color-muted)]">{t('estimator.quality.noMatch').replace('{query}', templateSearch)}</p>
                                )}
                            </div>
                        )}
                    </div>
                </section>
                        </div>
                    </SheetContent>
                </Sheet>

                {entryMode === 'quick' ? (
                    <div key="quick" className="premium-content-swap">
                    <QuickCostingView
                        state={state}
                        dispatch={dispatch}
                        totals={totals}
                        costingResult={costingResult}
                        hasValidCostResult={hasValidCostResult}
                        qualityLabel={qualityLabel}
                        setQualityLabel={setQualityLabelFromUser}
                        partyName={partyName}
                        setPartyName={setPartyNameFromUser}
                        partyNames={partyNames}
                        partyHint={partyHint}
                        showPartyField={showPartyField}
                        qualityLocked={Boolean(appliedTemplate)}
                        canUseProduction={canUseProduction}
                        widthUnit={widthUnit}
                        onWidthUnitChange={setWidthUnit}
                        onOpenOverheadDetails={() => {
                            handleEntryModeChange('detailed')
                            setShowAdvancedOverhead(true)
                        }}
                        onOverheadModeChange={handleOverheadModeChange}
                        weavingRateInputMode={weavingRateInputMode}
                        onWeavingRateInputModeChange={setWeavingRateInputMode}
                        directWeavingRateInput={directWeavingRateInput}
                        onDirectWeavingRateInputChange={setDirectWeavingRateInput}
                    />
                    </div>
                ) : (
                <div
                    key="detailed"
                    className="premium-content-swap space-y-7"
                    data-enter-navigate-container="true"
                    onKeyDown={handleEnterKeyNavigation}
                >
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
                                        onChange={e => setPartyNameFromUser(e.target.value)}
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
                                            {' '}· {formatTimestampDate(partyHint.created_at, { day: 'numeric', month: 'short' })}
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
                                    data-estimator-field="qualityLabel"
                                    aria-label="Fabric quality name"
                                    value={qualityLabel}
                                    readOnly={Boolean(appliedTemplate)}
                                    aria-readonly={appliedTemplate ? 'true' : undefined}
                                    title={appliedTemplate ? t('estimator.sprint1.saved_quality_name_stable') : undefined}
                                    onChange={e => {
                                        if (appliedTemplate) return
                                        const val = e.target.value
                                        setQualityLabelFromUser(val)
                                        if (mode === 'market') {
                                            setPartyNameFromUser(val)
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
                                    value={warpInstruction === lastGeneratedWarp.current ? '' : warpInstruction}
                                    onChange={e => setWarpInstructionFromUser(e.target.value)}
                                    placeholder={lastGeneratedWarp.current || '50/48 + Rainbow'}
                                    className="text-sm font-medium placeholder:text-slate-400 border-slate-200 h-11"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-slate-500">{t('estimator.order_basics.weft_construction')}</Label>
                                <Input
                                    value={weftInstruction === lastGeneratedWeft.current ? '' : weftInstruction}
                                    onChange={e => setWeftInstructionFromUser(e.target.value)}
                                    placeholder={lastGeneratedWeft.current || '50/48 - 68 Picks'}
                                    className="text-sm font-medium placeholder:text-slate-400 border-slate-200 h-11"
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
                        badgeContent={<SectionCostPill value={totals.yarnBaseWarpPerM} valid={hasValidCostResult} />}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        {/* Global Defaults Block */}
                        <div className="mb-6 grid overflow-hidden rounded-[13px] border border-[#D7E7F1] bg-[#F7FBFD] sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(260px,0.9fr)]">
                            <div className="border-b border-[#D7E7F1] p-4 sm:border-b-0 sm:border-r">
                                <StepperField
                                    label="Warp Crimp (Take-up)"
                                    value={state.warpCrimpPct || 0}
                                    onChange={v => dispatch({ type: 'SET', field: 'warpCrimpPct', value: v })}
                                    ghostValue={DEFAULT_WARP_CRIMP_PCT}
                                    ghostPlaceholder={String(DEFAULT_WARP_CRIMP_PCT)}
                                    hint="Beam shrink relative to tape length"
                                    accent="warp"
                                />
                            </div>
                            <div className="border-b border-[#D7E7F1] p-4 sm:border-b-0 sm:border-r">
                                <StepperField
                                    label="Default Yarn Waste"
                                    value={state.yarnShortagePct || 0}
                                    onChange={v => dispatch({ type: 'SET', field: 'yarnShortagePct', value: v })}
                                    ghostValue={0}
                                    ghostPlaceholder="0"
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
                                    componentName={row.label}
                                    ratePerKg={row.yarnRate}
                                    accent="indigo"
                                    canRemove={state.warpRows.length > 1}
                                    onRemove={() => dispatch({ type: 'REMOVE_WARP_ROW', id: row.id })}
                                    kgPer100m={totals.warpRows[i]?.baseKgPer100mUsed ?? 0}
                                    costPer100m={totals.warpRows[i]?.baseCostPer100m ?? 0}
                                    adjustmentPct={totals.warpRows[i]?.totalAdjustmentPct ?? 0}
                                    adjustmentDetail={formatWasteProvenance(
                                        row.shortagePct,
                                        totals.warpRows[i]?.defaultWastePct ?? state.yarnShortagePct,
                                        totals.warpRows[i]?.wastePct ?? state.yarnShortagePct,
                                        totals.warpRows[i]?.totalAdjustmentPct ?? 0,
                                    )}
                                    showCalculatedValues={hasValidCostResult}
                                    isComplete={isWarpRowFilled(row)}
                                >
                                    <CalculationModeField
                                        value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                        onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calculationMode', value })}
                                    />
                                        <LayerNameField
                                            label={t('estimator.field_labels.layer_name')}
                                            value={row.label ?? ''}
                                            placeholder={`${t('estimator.warp.layer')} ${i + 1}`}
                                            ghostValue={`Warp ${i + 1}`}
                                            onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'label', value })}
                                        />
                                    {row.calculationMode === 'manual' ? (
                                        <NumField fieldKey="manualKgPer100m" label="Warp Yarn consumption (kg/100m)" value={row.manualKgPer100m ?? null} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'manualKgPer100m', value: v })} unit="kg" step={0.001} placeholder="e.g. 3.25" hint="Kilograms of Warp Yarn needed for 100 metres; not m/kg yield." attentionWhenEmpty />
                                    ) : (
                                        <>
                                            <YarnDensityFields
                                                row={row}
                                                onChange={(field, value) => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value })}
                                            />
                                            <NumField fieldKey="beamEnds" label={`${t('estimator.field_labels.beam_ends')} — REQUIRED`} value={row.beamEnds} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: v ?? 0 })} placeholder="e.g. 3200" attentionWhenEmpty />
                                        </>
                                    )}
                                    <NumField fieldKey="shortagePct" label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} hint={`Blank uses ${state.yarnShortagePct}% default; 0 overrides`} warning={row.shortagePct !== null && row.shortagePct > 15 ? 'High waste %' : undefined} />
                                    {(() => {
                                        const templateRate = appliedTemplate?.warp_rows?.[i]?.yarnRate ?? null
                                        const isUnusuallyLow = templateRate !== null
                                            ? row.yarnRate < templateRate * 0.6
                                            : row.yarnRate > 0 && row.yarnRate < 50
                                        const warningId = `warp-${row.id}-rate`
                                        const isDismissed = dismissedWarnings.includes(warningId)
                                        return (
                                            <NumField fieldKey="yarnRate"
                                                label={`${t('common.current_yarn_rate')} — REQUIRED`}
                                                value={row.yarnRate} 
                                                onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })} 
                                                step={1}
                                                placeholder="e.g. 110"
                                                attentionWhenEmpty
                                                warning={isUnusuallyLow && !isDismissed ? 'Unusually low' : undefined}
                                                onDismissWarning={() => setDismissedWarnings(prev => [...prev, warningId])}
                                            />
                                        )
                                    })()}
                                    <NumField fieldKey="gstPct" label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: v ?? 0 })} step={0.5} placeholder="e.g. 5" />
                                </RowCard>
                            ))}
                        </div>
                        <Button
                            type="button"
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
                                            <NumField fieldKey="tapeLengthM"
                                                label={t('estimator.warp.tape_len')}
                                                value={state.tapeLengthM}
                                                onChange={v => dispatch({ type: 'SET', field: 'tapeLengthM', value: v ?? 0 })}
                                                unit="m"
                                                placeholder="e.g. 1000"
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
                                <SectionCostPill value={totals.yarnBaseWeftPerM} valid={hasValidCostResult} />
                            </div>
                        }
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        {/* Keep the configured default separate from the row value
                            that the costing engine actually applies. */}
                        {(() => {
                            const appliedWaste = state.weftRows.map((row, index) => (
                                totals.weftRows[index]?.shortagePctUsed
                                ?? (row.shortagePct !== null && row.shortagePct !== undefined ? row.shortagePct : state.yarnShortagePct)
                            ))
                            const appliedWasteLabel = appliedWaste.map((value, index) => `Row ${index + 1}: ${Number(value).toFixed(1)}%`).join(' · ')
                            const effectiveWasteLabel = state.weftRows.map((row, index) => {
                                const auditRow = totals.weftRows[index]
                                const applied = auditRow?.wastePct ?? (row.shortagePct ?? state.yarnShortagePct)
                                const effective = auditRow?.totalAdjustmentPct ?? applied
                                return `Row ${index + 1}: ${Number(effective).toFixed(1)}%`
                            }).join(' · ')
                            return (
                                <div className="mb-6 overflow-hidden rounded-[13px] border border-[#CDE5D3] bg-[#F7FCF8]">
                                    <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                                <Calculator className="h-3.5 w-3.5 text-[var(--color-factory-green)]" />
                                                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-factory-green)]">Default weft waste</span>
                                            </div>
                                            <p className="mt-1 text-[11px] font-medium text-[var(--color-muted)]">Used only when a weft row has no row-specific value. A row value of 0 means no waste.</p>
                                        </div>
                                        <span className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold text-[var(--color-factory-green)]">
                                            <span>{state.yarnShortagePct ?? 0}%</span>
                                            <span className="rounded-[7px] border border-[#CDE5D3] bg-white px-2.5 py-1 text-base">default</span>
                                        </span>
                                    </div>
                                    <div className="border-t border-[#CDE5D3] px-4 py-2.5 text-[11px] font-semibold text-[var(--color-factory-green)]" data-testid="applied-weft-waste-summary">
                                        Applied to pricing: <span className="font-mono">{appliedWasteLabel}</span>
                                    </div>
                                    <div className="border-t border-[#CDE5D3] px-4 py-2.5 text-[11px] font-medium text-[var(--color-muted)]" data-testid="effective-weft-waste-summary">
                                        Wastage applied after base yarn costing: <span className="font-mono font-semibold text-[var(--color-ink)]">{effectiveWasteLabel}</span>
                                    </div>
                                </div>
                            )
                        })()}

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
                                        componentName={row.label}
                                        ratePerKg={row.yarnRate}
                                        accent="emerald"
                                        canRemove={state.weftRows.length > 1}
                                        onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })}
                                        kgPer100m={totals.weftRows[i]?.baseKgPer100mUsed ?? 0}
                                        costPer100m={totals.weftRows[i]?.baseCostPer100m ?? 0}
                                        adjustmentPct={totals.weftRows[i]?.totalAdjustmentPct ?? 0}
                                        adjustmentDetail={formatWasteProvenance(
                                            row.shortagePct,
                                            totals.weftRows[i]?.defaultWastePct ?? state.yarnShortagePct,
                                            totals.weftRows[i]?.wastePct ?? state.yarnShortagePct,
                                            totals.weftRows[i]?.totalAdjustmentPct ?? 0,
                                        )}
                                        showCalculatedValues={hasValidCostResult}
                                        isComplete={isWeftRowFilled(row)}
                                    >
                                        <CalculationModeField
                                            value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                            onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calculationMode', value })}
                                        />
                                        <LayerNameField
                                            label={t('estimator.field_labels.layer_name')}
                                            value={row.label ?? ''}
                                            placeholder={`${t('estimator.weft.layer')} ${i + 1}`}
                                            ghostValue={`Weft ${i + 1}`}
                                            onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'label', value })}
                                        />
                                        <NumField fieldKey="picks" label={`${t('estimator.field_labels.picks_ppi')} — REQUIRED`} value={row.picks} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: v ?? 0 })} placeholder="e.g. 68" attentionWhenEmpty />
                                        <WidthField
                                            label={`Effective costing width (finished width)${row.calculationMode === 'manual' ? '' : ' — REQUIRED'}`}
                                            value={effectiveCostingWidthCm}
                                            onChange={v => {
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value: v })
                                                dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value: v })
                                            }}
                                            unit={widthUnit}
                                            placeholder={widthUnit === 'inch' ? 'e.g. 63' : 'e.g. 160'}
                                            hint={row.calculationMode === 'manual' ? 'Saved for audit; manual kg bypasses formula' : 'Used for weft yarn formula'}
                                            warning={effectiveWidthWarning}
                                            attentionWhenEmpty={row.calculationMode !== 'manual'}
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
                                            <NumField fieldKey="manualKgPer100m" label="Weft Yarn consumption (kg/100m)" value={row.manualKgPer100m ?? null} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'manualKgPer100m', value: v })} unit="kg" step={0.001} placeholder="e.g. 2.75" hint="Kilograms of Weft Yarn needed for 100 metres; not m/kg yield." attentionWhenEmpty />
                                        ) : (
                                            <YarnDensityFields
                                                row={row}
                                                onChange={(field, value) => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value })}
                                            />
                                        )}
                                        <NumField fieldKey="shortagePct" label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} hint={`Blank uses ${state.yarnShortagePct}% default; 0 overrides`} warning={row.shortagePct !== null && row.shortagePct > 15 ? 'High waste %' : undefined} />
                                        {(() => {
                                            const templateRate = appliedTemplate?.weft_rows?.[i]?.yarnRate ?? null
                                            const isUnusuallyLow = templateRate !== null
                                                ? row.yarnRate < templateRate * 0.6
                                                : row.yarnRate > 0 && row.yarnRate < 50
                                            const warningId = `weft-${row.id}-rate`
                                            const isDismissed = dismissedWarnings.includes(warningId)
                                            return (
                                                <NumField fieldKey="yarnRate"
                                                    label={`${t('common.current_yarn_rate')} — REQUIRED`}
                                                    value={row.yarnRate}
                                                    onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })}
                                                    placeholder="e.g. 110"
                                                    attentionWhenEmpty
                                                    warning={isUnusuallyLow && !isDismissed ? 'Unusually low' : undefined}
                                                    onDismissWarning={() => setDismissedWarnings(prev => [...prev, warningId])}
                                                />
                                            )
                                        })()}
                                        <NumField fieldKey="gstPct" label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: v ?? 0 })} step={0.5} placeholder="e.g. 5" />
                                    </RowCard>
                                )
                            })}
                        </div>
                        <Button
                            type="button"
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
                        <WeavingRateFields
                            state={state}
                            dispatch={dispatch}
                            totals={totals}
                            hasValidCostResult={hasValidCostResult}
                            inputMode={weavingRateInputMode}
                            onInputModeChange={setWeavingRateInputMode}
                            directRateInput={directWeavingRateInput}
                            onDirectRateInputChange={setDirectWeavingRateInput}
                        />
                    </CardContent>
                </EstimatorCard>

                {/* 5. Warping & Sizing */}
                <EstimatorCard accent="post">
                    <SectionHeader title={t('estimator.warping_sizing.title')} icon={TrendingUp} accent="post" step={5} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} valid={hasValidCostResult} />} />
                    <CardContent className="p-5 sm:p-6 space-y-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            {/* Warping Group */}
                            <div className="space-y-3">
                                <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-end justify-between h-8">
                                        <Label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                                            {t('estimator.warping_sizing.warping')}
                                        </Label>
                                        {state.warpingMode === 'in_house' && (
                                            <span className="text-[10px] font-medium text-[var(--color-muted)]">
                                                ₹0 · in overhead
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid h-11 grid-cols-2 rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
                                        <button
                                            id="warping-mode-in-house"
                                            type="button"
                                            onClick={() => dispatch({ type: 'SET', field: 'warpingMode', value: 'in_house' })}
                                            aria-pressed={state.warpingMode === 'in_house'}
                                            className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                                state.warpingMode === 'in_house'
                                                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            In-house
                                        </button>
                                        <button
                                            id="warping-mode-outsourced"
                                            type="button"
                                            onClick={() => dispatch({ type: 'SET', field: 'warpingMode', value: 'outsourced' })}
                                            aria-pressed={state.warpingMode === 'outsourced'}
                                            className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                                state.warpingMode === 'outsourced'
                                                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            Outsourced
                                        </button>
                                    </div>
                                </div>
                                {state.warpingMode === 'outsourced' && (
                                    <NumField
                                        fieldKey="warpingRatePerKg"
                                        label={t('estimator.warping_sizing.warping_per_kg')}
                                        value={state.warpingRatePerKg}
                                        onChange={v => dispatch({ type: 'SET', field: 'warpingRatePerKg', value: v ?? 0 })}
                                        step={0.1}
                                        placeholder="e.g. 8"
                                        attentionWhenEmpty
                                    />
                                )}
                            </div>

                            {/* Sizing Group */}
                            <div className="space-y-3">
                                <div className="space-y-1.5 min-w-0">
                                    <div className="flex items-end justify-between h-8">
                                        <Label className="text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                                            {t('estimator.warping_sizing.sizing')}
                                        </Label>
                                        {state.sizingMode === 'in_house' && (
                                            <span className="text-[10px] font-medium text-[var(--color-muted)]">
                                                ₹0 · in overhead
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid h-11 grid-cols-2 rounded-[9px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-1">
                                        <button
                                            id="sizing-mode-in-house"
                                            type="button"
                                            onClick={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'in_house' })}
                                            aria-pressed={state.sizingMode === 'in_house'}
                                            className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                                state.sizingMode === 'in_house'
                                                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            In-house
                                        </button>
                                        <button
                                            id="sizing-mode-outsourced"
                                            type="button"
                                            onClick={() => dispatch({ type: 'SET', field: 'sizingMode', value: 'outsourced' })}
                                            aria-pressed={state.sizingMode === 'outsourced'}
                                            className={`h-full rounded-[7px] px-2 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)] ${
                                                state.sizingMode === 'outsourced'
                                                    ? 'bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
                                                    : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
                                            }`}
                                        >
                                            Outsourced
                                        </button>
                                    </div>
                                </div>
                                {state.sizingMode === 'outsourced' && (
                                    <NumField
                                        fieldKey="sizingRatePerKg"
                                        label={t('estimator.warping_sizing.sizing_per_kg')}
                                        value={state.sizingRatePerKg}
                                        onChange={v => dispatch({ type: 'SET', field: 'sizingRatePerKg', value: v ?? 0 })}
                                        step={0.5}
                                        placeholder="e.g. 10"
                                        hint="Typical Surat outsourced sizing: ₹8–15/kg"
                                        attentionWhenEmpty
                                    />
                                )}
                            </div>
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
                                <SectionCostPill value={costingResult.overheadPerM} valid={hasValidCostResult} />
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
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Direct overhead rate</p>
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">Enter the rate used in this costing; it is never inferred.</p>
                                </button>
                                <button type="button" aria-pressed={state.overheadMode === 'monthly_expenses'} onClick={() => handleOverheadModeChange('monthly_expenses')} className={`rounded-[10px] border px-3 py-3 text-left transition-colors ${state.overheadMode === 'monthly_expenses' ? 'border-[var(--color-yarn-orange)] bg-[var(--color-warning-amber-soft)] ring-1 ring-[var(--color-yarn-orange)]/20' : 'border-[var(--color-hairline)] bg-[var(--color-canvas)] hover:border-[var(--color-hairline-strong)]'}`}>
                                    <p className="text-[12px] font-semibold text-[var(--color-ink)]">Calculate from monthly expenses</p>
                                    <p className="mt-0.5 text-[10px] leading-relaxed text-[var(--color-muted)]">Use saved expenses and standard monthly production.</p>
                                </button>
                            </div>

                            {state.overheadMode === 'direct' ? (
                            <div className="rounded-[9px] border border-dashed border-[var(--color-hairline)] bg-[var(--color-canvas)] p-3.5">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                        <p className="text-[13px] font-medium text-[var(--color-ink)]">Direct factory cost per metre (₹/m) — REQUIRED</p>
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
                                                        aria-label="Direct factory overhead per metre"
                                                        aria-invalid={state.overheadOverridePerM == null || state.overheadOverridePerM <= 0 || undefined}
                                                        className={`h-10 w-full rounded-[9px] pl-8 pr-4 text-sm font-medium placeholder:text-[var(--color-muted)] [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${state.overheadOverridePerM == null || state.overheadOverridePerM <= 0 ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)]'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {hasValidCostResult && state.overheadOverridePerM != null && state.overheadOverridePerM < monthlyOverheadReference && (
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
                                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">Saved rent, power, salaries, and other expenses are divided by standard monthly production. Expand the section below to review them.</p>
                                    <p className="mt-2 text-[11px] font-semibold text-[var(--color-factory-green)]">Current calculated overhead: {formatCalculatedMoney(costingResult.overheadPerM, hasValidCostResult, '/m')}</p>
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
                                                aria-expanded={showAdvancedOverhead}
                                                aria-controls="estimator-monthly-expenses"
                                                className="flex items-center justify-between w-full rounded-lg bg-[var(--color-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-all"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Calculator className="h-3.5 w-3.5 text-[var(--color-yarn-orange)]" />
                                                    <span>Monthly expenses & capacity</span>
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {!showAdvancedOverhead && totals.overheadTotalMonthly > 0 && (
                                                        <span className="text-[10px] font-mono text-[var(--color-muted)] font-normal mr-2">
                                                            Total: {hasValidCostResult ? `₹${totals.overheadTotalMonthly.toLocaleString('en-IN')}/mo` : '—'}
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
                                                id="estimator-monthly-expenses"
                                                initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
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
                                                            onClick={() => void handleSaveProfile()}
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
                                                            ghostValue={0}
                                                            placeholder="e.g. 24"
                                                        />
                                                        <CapacityMetricField
                                                            label="Avg Daily Output" 
                                                            value={state.avgOutputPerLoomPerDay} 
                                                            onChange={v => dispatch({ type: 'SET', field: 'avgOutputPerLoomPerDay', value: v ?? 0 })} 
                                                            unit="m/day" 
                                                            ghostValue={50}
                                                            placeholder="50"
                                                        />
                                                        <CapacityMetricField
                                                            label="Working Days" 
                                                            value={state.monthlyWorkingDays} 
                                                            onChange={v => dispatch({ type: 'SET', field: 'monthlyWorkingDays', value: v ?? 0 })} 
                                                            unit="days" 
                                                            ghostValue={26}
                                                            placeholder="26"
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
                                                                                value={!isPreset && item.label === 'New Item' ? '' : item.label}
                                                                                placeholder={!isPreset && item.label === 'New Item' ? 'Item name' : undefined}
                                                                                disabled={isPreset}
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'label', value: e.target.value })}
                                                                                className={`h-7 border-0 bg-transparent p-0 text-[13px] font-medium placeholder:text-[var(--color-muted)] focus:ring-0 ${isPreset ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
                                                                            />
                                                                            {isLocked && <span className="rounded-[4px] bg-[var(--color-surface-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">auto-calc</span>}
                                                                            {isElectricity && <span className="rounded-[4px] bg-[var(--color-surface-soft)] px-1.5 py-0.5 text-[10px] text-[var(--color-muted)]">per machine helper</span>}
                                                                        </div>

                                                                        {/* Amount Display/Input */}
                                                                        <div className="relative shrink-0 w-32">
                                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">₹</span>
                                                                            <Input
                                                                                type="number"
                                                                                value={item.monthlyAmount === 0 ? '' : item.monthlyAmount}
                                                                                placeholder="e.g. 25,000"
                                                                                disabled={isLocked}
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: parseNonNegativeInput(e.target.value) ?? 0 })}
                                                                                className="h-8 min-w-[120px] rounded-[7px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-6 pr-9 text-right text-[11px] font-medium placeholder:text-[var(--color-muted)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
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
                                                                                            value={(item.meta as ElectricityMeta)?.unitsPerLoomPerMonth || ''}
                                                                                            placeholder="e.g. 500"
                                                                                            onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { unitsPerLoomPerMonth: parseNonNegativeInput(e.target.value) ?? 0, type: 'electricity', mode: 'per_loom' } })}
                                                                                            className="h-6 text-[10px] font-mono font-bold placeholder:text-[var(--color-muted)] px-1.5"
                                                                                        />
                                                                                    </div>
                                                                                    <div className="flex flex-col gap-0.5">
                                                                                        <span className="text-[8px] uppercase font-semibold text-slate-400">Rate/Unit</span>
                                                                                        <Input 
                                                                                            type="number" 
                                                                                            value={(item.meta as ElectricityMeta)?.ratePerUnit || ''}
                                                                                            placeholder="e.g. 8"
                                                                                            onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { ratePerUnit: parseNonNegativeInput(e.target.value) ?? 0, type: 'electricity', mode: 'per_loom' } })}
                                                                                            className="h-6 text-[10px] font-mono font-bold placeholder:text-[var(--color-muted)] px-1.5"
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
                                                                                        value={(item.meta as DepreciationMeta)?.avgCostPerLoom || ''}
                                                                                        placeholder="e.g. 10,00,000"
                                                                                        onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { avgCostPerLoom: parseNonNegativeInput(e.target.value) ?? 0, type: 'depreciation' } })}
                                                                                        className="h-7 text-[10px] font-mono font-bold placeholder:text-[var(--color-muted)] pl-4 pr-1.5"
                                                                                    />
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex flex-col gap-1">
                                                                                <span className="text-[8px] uppercase font-semibold text-slate-400">Lifespan (Years)</span>
                                                                                <Input 
                                                                                    type="number" 
                                                                                    value={(item.meta as DepreciationMeta)?.usefulLifeYears === 10 ? '' : ((item.meta as DepreciationMeta)?.usefulLifeYears ?? '')}
                                                                                    placeholder="10"
                                                                                    onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM_META', id: item.id, meta: { usefulLifeYears: parseNumericInput(e.target.value, { min: 1 }) ?? 1, type: 'depreciation' } })}
                                                                                    className="h-7 text-[10px] font-mono font-bold placeholder:text-[var(--color-muted)] px-2"
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
                                                                    <Label className={`text-[10px] font-medium uppercase ${state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) ? 'text-[var(--color-warning-amber)]' : 'text-[var(--color-muted)]'}`}>Standard monthly production (m){state.overheadMode === 'monthly_expenses' ? ' — REQUIRED' : ''}</Label>
                                                                    {canUseProduction && state.overheadMode === 'monthly_expenses' && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="sm"
                                                                            onClick={handleAutoSuggestOutput}
                                                                            disabled={isSuggestingOutput}
                                                                            aria-busy={isSuggestingOutput}
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
                                                                        value={state.monthlyOutputM || ''}
                                                                        placeholder="e.g. 10,000"
                                                                        onChange={e => dispatch({ type: 'SET', field: 'monthlyOutputM', value: parseNonNegativeInput(e.target.value) ?? 0 })}
                                                                        aria-invalid={state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) || undefined}
                                                                        className={`h-10 rounded-[9px] pr-9 text-center text-sm font-medium placeholder:text-[var(--color-muted)] [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)]'}`}
                                                                    />
                                                                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">m</span>
                                                                </div>
                                                                {state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) && (
                                                                    <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required for monthly-expense overhead.</p>
                                                                )}
                                                            </div>

                                                            {/* Output Suggestion Panel */}
                                                            {outputSuggestion && (
                                                                <motion.div 
                                                                    initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    className="space-y-2 rounded-xl border border-[var(--color-info-blue)]/25 bg-[var(--color-info-blue-soft)]/70 p-3"
                                                                >
                                                                    <p className="flex items-center gap-1.5 text-[9.5px] font-bold text-[var(--color-info-blue)]">
                                                                        <History className="h-3 w-3" /> Historical Output Scaling (to 26 days)
                                                                    </p>
                                                                    <div className="grid grid-cols-2 gap-2">
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => { dispatch({ type: 'SET', field: 'monthlyOutputM', value: outputSuggestion.avg30Days }); setOutputSuggestion(null); }}
                                                                            className="group rounded-lg border border-[var(--color-info-blue)]/25 bg-[var(--color-surface)] p-2 text-left transition-colors hover:border-[var(--color-info-blue)]"
                                                                        >
                                                                            <p className="text-[8px] font-semibold uppercase text-[var(--color-muted)]">Last 30 Days</p>
                                                                            <p className="font-mono text-xs font-bold text-[var(--color-info-blue)]">{outputSuggestion.avg30Days.toLocaleString()}m</p>
                                                                        </button>
                                                                        <button 
                                                                            type="button"
                                                                            onClick={() => { dispatch({ type: 'SET', field: 'monthlyOutputM', value: outputSuggestion.avg90Days }); setOutputSuggestion(null); }}
                                                                            className="group rounded-lg border border-[var(--color-info-blue)]/25 bg-[var(--color-surface)] p-2 text-left transition-colors hover:border-[var(--color-info-blue)]"
                                                                        >
                                                                            <p className="text-[8px] font-semibold uppercase text-[var(--color-muted)]">Last 90 Days</p>
                                                                            <p className="font-mono text-xs font-bold text-[var(--color-info-blue)]">{outputSuggestion.avg90Days.toLocaleString()}m</p>
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
                                                                {hasValidCostResult ? `₹${totals.overheadTotalMonthly.toLocaleString('en-IN')}` : '—'}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                                <p className="text-[10px] text-[var(--color-muted)]">{state.overheadMode === 'direct' ? 'Monthly-expense reference' : 'Rated capacity cost'}</p>
                                                            <p className="text-base font-semibold text-[var(--color-ink)]">{formatCalculatedMoney(state.overheadMode === 'direct' ? monthlyOverheadReference : totals.overheadPerMAtCapacity, hasValidCostResult, '/m')}</p>
                                                        </div>
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">Your actual cost</p>
                                                            <p className={`text-base font-semibold ${costingResult.overheadPerM > 0 ? 'text-[var(--color-factory-green)]' : 'text-[var(--color-ink)]'}`}>{formatCalculatedMoney(costingResult.overheadPerM, hasValidCostResult, '/m')}</p>
                                                        </div>
                                                    </div>
                                                    {isZeroConfig && (
                                                        <p className="text-[11px] text-[var(--color-warning-amber)]">Factory expense items total is zero. Estimates may miss fixed cost recovery.</p>
                                                    )}

                                                    <div className="space-y-2">
                                                        {hasValidCostResult && totals.costOfIdleCapacityMonthly > 500 && (
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
                                                <p className="text-2xl font-semibold font-mono text-rose-700 leading-none">{formatCalculatedMoney(costingResult.overheadPerM, hasValidCostResult)}</p>
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
                                <NumField fieldKey="windingRatePerKg" label={t('estimator.field_labels.winding_per_kg')} value={state.windingRatePerKg} onChange={v => dispatch({ type: 'SET', field: 'windingRatePerKg', value: v ?? 0 })} unit="₹/kg" placeholder="e.g. 4" hint={t('estimator.post_processing.winding_scope').replace('{kg}', totals.totalAllYarnKgPer100m.toFixed(2))} />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'winding' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.winding')}</button>
                            )}
                            {state.enabledSections.processing ? (
                                <NumField fieldKey="processingRatePerM" label={t('estimator.field_labels.dyeing_processing')} value={state.processingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'processingRatePerM', value: v ?? 0 })} unit="₹/m" placeholder="e.g. 2" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'processing' })} className="h-10 rounded-xl border border-dashed border-slate-200 text-[10px] font-bold text-slate-400 flex items-center justify-center gap-1.5 hover:bg-slate-50 hover:text-indigo-500 transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.processing')}</button>
                            )}
                            {state.enabledSections.finishing ? (
                                <NumField fieldKey="finishingRatePerM" label={t('estimator.field_labels.finishing_per_m')} value={state.finishingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'finishingRatePerM', value: v ?? 0 })} unit="₹/m" placeholder="e.g. 1.50" />
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
                                    <p className="mt-1 text-xs font-medium leading-relaxed">{showValidation ? (firstCostingReadinessMessage ?? 'Correct the highlighted inputs to see a reliable cost breakdown.') : 'Enter your fabric quality and yarn numbers to see a reliable cost breakdown.'}</p>
                                    <p className="mt-1 text-[11px] leading-relaxed">Draft values are not treated as a final result while a required input is blank or zero.</p>
                                </div>
                            </div>
                        ) : (
                        <>
                        <div className="overflow-hidden rounded-[12px] border border-[var(--color-hairline)]">
                            <div className="hidden grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.8fr_1.1fr] gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)] md:grid">
                                <span>Yarn</span>
                                <span>Mode</span>
                                <span>Base kg/100m</span>
                                <span>Rate</span>
                                <span className="text-right">Base cost</span>
                                <span>Applied after subtotal</span>
                            </div>
                            <div className="divide-y divide-[var(--color-hairline)] bg-white">
                                {auditLayerRows.map(layer => (
                                    <div key={`${layer.section}-${layer.id}`} className="grid gap-2 px-3 py-3 text-xs md:grid-cols-[1fr_0.8fr_0.9fr_0.8fr_0.8fr_1.1fr] md:gap-3 md:items-center">
                                        <div>
                                            <p className="font-semibold text-[var(--color-ink)]">{layer.name}</p>
                                            <p className="text-[10px] font-medium text-[var(--color-muted)]">{layer.section}</p>
                                            {layer.mode === 'formula' ? (
                                                <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--color-muted)]">
                                                    {layer.section === 'Warp'
                                                        ? `${layer.calcDenier.toFixed(2)}D × ${layer.beamEnds ?? 0} ends / 90000 = ${layer.formulaKgPer100m.toFixed(3)} kg/100m`
                                                        : `${layer.calcDenier.toFixed(2)}D × ${layer.picks ?? 0} PPI × ${(layer.effectiveCostingWidthInches ?? 0).toFixed(1)} in × ${layer.formulaLengthM.toFixed(3)}m / 9000000 = ${layer.formulaKgPer100m.toFixed(3)} kg/100m`}
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
                                        <p className="font-mono text-[var(--color-ink)]">₹{layer.ratePerKg.toFixed(0)}/kg</p>
                                        <p className="text-right font-mono font-semibold text-[var(--color-factory-green)]">₹{layer.baseCostPerMeter.toFixed(2)}/m</p>
                                        <div>
                                            <p className="font-mono text-[var(--color-warning-amber)]">{layer.totalAdjustmentPct.toFixed(1)}%</p>
                                            <p className="text-[10px] font-medium leading-tight text-[var(--color-muted)]">{layer.crimpPct.toFixed(1)}% crimp + {layer.wastePct.toFixed(1)}% applied waste</p>
                                            <p className="mt-1 text-[10px] font-medium leading-tight text-[var(--color-muted)]">
                                                Default waste {layer.defaultWastePct.toFixed(1)}% · {layer.wastePctSource === 'row_override' ? 'Override' : layer.wastePctSource === 'default' ? 'Default' : 'Saved value'} applied {layer.wastePct.toFixed(1)}%
                                            </p>
                                            <p className="text-[10px] font-semibold leading-tight text-[var(--color-ink)]">Added only after base yarn costs are summed.</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
                            <div className="rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] p-4">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Manual yarn-cost workflow</p>
                                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">Base weight × individual yarn rate (plus GST, if entered), sum all yarns, then apply wastage.</p>
                                </div>

                                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white p-3">
                                        <p className="text-[9px] uppercase tracking-[0.05em] text-[var(--color-muted)]">1 · Base warp yarn</p>
                                        <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-ink)]">₹{totals.yarnBaseWarpPerM.toFixed(2)}/m</p>
                                    </div>
                                    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-white p-3">
                                        <p className="text-[9px] uppercase tracking-[0.05em] text-[var(--color-muted)]">2 · Base weft yarn</p>
                                        <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-ink)]">₹{totals.yarnBaseWeftPerM.toFixed(2)}/m</p>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2 rounded-[10px] border border-[#CDE5D3] bg-[var(--color-factory-green-soft)] p-3">
                                    <div>
                                        <p className="text-[9px] leading-tight text-[var(--color-muted)]">3 · Base yarn subtotal</p>
                                        <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-ink)]">₹{yarnBaseCostPerM.toFixed(2)}</p>
                                    </div>
                                    <span className="pb-0.5 text-sm font-semibold text-[var(--color-muted)]">+</span>
                                    <div>
                                        <p className="text-[9px] leading-tight text-[var(--color-muted)]">4 · Wastage / crimp</p>
                                        <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-warning-amber)]">₹{totals.yarnShortageCostPerM.toFixed(2)}</p>
                                    </div>
                                    <span className="pb-0.5 text-sm font-semibold text-[var(--color-muted)]">=</span>
                                    <div>
                                        <p className="text-[9px] leading-tight text-[var(--color-muted)]">Adjusted yarn cost</p>
                                        <p className="mt-1 font-mono text-sm font-semibold text-[var(--color-factory-green)]">₹{totals.audit.yarnTotalCostPerMeter.toFixed(2)}/m</p>
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
                        </>
                        )}
                    </CardContent>
                </EstimatorCard>

                {/* 9. Quotation assumptions / Order simulation */}
                <EstimatorCard accent="weft">
                    <SectionHeader
                        title={!canUseProduction ? t('estimator.simulation.base_title') : mode === 'market' ? t('estimator.simulation.market_title') : t('estimator.simulation.title')}
                        detail={!canUseProduction ? <p className="text-[11px] text-[var(--color-muted)] font-normal">{t('estimator.simulation.base_description')}</p> : undefined}
                        icon={Coins}
                        accent="weft"
                        step={9}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <NumField fieldKey="orderQuantityM"
                                label={mode === 'market' ? t('estimator.field_labels.market_target') : t('estimator.field_labels.simulation_qty')}
                                value={state.orderQuantityM}
                                onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: v })}
                                unit="m"
                                step={100}
                                placeholder="5000"
                                attentionWhenEmpty={requiresCommercialContext}
                                hint={requiresCommercialContext ? t('estimator.simulation.quantity_hint') : 'Optional for a saved costing; enter it when you want order-level profit.'}
                            />
                            <NumField fieldKey="profitPct" label="Target margin" value={state.profitPct} onChange={v => dispatch({ type: 'SET', field: 'profitPct', value: v ?? 0 })} unit="%" step={0.5} placeholder="e.g. 10" />
                            <NumField fieldKey="commissionPct" label={t('estimator.field_labels.broker_comm')} value={state.commissionPct} onChange={v => dispatch({ type: 'SET', field: 'commissionPct', value: v ?? 0 })} unit="%" step={0.5} placeholder="e.g. 2" />
                            <NumField fieldKey="transportPerM" label={t('estimator.field_labels.transport_per_m')} value={state.transportPerM} onChange={v => dispatch({ type: 'SET', field: 'transportPerM', value: v ?? 0 })} unit="₹/m" step={0.1} placeholder="e.g. 1.50" />
                        </div>
                    </CardContent>
                </EstimatorCard>
                </div>
                )}
            </div>
            </div>

                <aside
                    className="estimator-reference-rail space-y-3"
                    aria-label="Estimator reference information"
                >
                    <BasePlanFactoryGlossary />
                    <ArchivePolicyNotice />
                </aside>
            </div>

            <MobileLiveEstimateShortcut
                visible={mobileCostingShortcutVisible}
                keyboardVisible={mobileKeyboardVisible}
                expanded={mobileCostingShortcutExpanded}
                activeName={appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}
                versionLabel={sourceQuoteId && sourceRecordKind === 'costing'
                    ? `Costing v${sourceQuoteVersionNumber ?? 1}`
                    : undefined}
                validityLabel={validityStatus.label}
                validityDescription={validityStatus.description}
                validityClassName={validityStatus.className}
                validityIcon={validityStatus.icon}
                hasValidCostResult={hasValidCostResult}
                quoteIsValid={costingResult.quoteIsValid}
                productionCostPerM={costingResult.productionCostPerM}
                suggestedSellingPricePerM={costingResult.suggestedSellingPricePerM}
                actualMarginPct={displayMarginPct}
                breakEvenPricePerM={hasValidCostResult && breakEvenScenario?.quotePricePerM != null ? costingResult.breakEvenPricePerM : null}
                missingIssueCount={estimatorValidation.issues.length}
                needsReview={costingReadiness.status !== 'ready'}
                readinessMessage={firstCostingReadinessMessage}
                onJumpToInput={jumpToFirstEstimatorIssue}
                hasOrderQty={hasOrderQty}
                expectedProfitTotal={costingResult.expectedProfitTotal}
                assumptions={(
                    <CostingAssumptionsSummary
                        result={costingResult}
                        isStandaloneCostingSession={isStandaloneCostingSession}
                        expanded={assumptionsExpanded}
                        onToggle={toggleAssumptions}
                    />
                )}
                actions={(onDismiss) => (
                    <EstimatorLiveCostActions
                        isStandaloneCostingSession={isStandaloneCostingSession}
                        mode={mode}
                        canUseProduction={canUseProduction}
                        allowsPartyOrders={allowsPartyOrders}
                        allowsMarketRuns={allowsMarketRuns}
                        sourceQuoteId={sourceQuoteId}
                        savingQuote={savingQuote}
                        savingTemplate={savingTemplate}
                        appliedTemplate={appliedTemplate}
                        hasActiveQualityRecipeChanges={hasActiveQualityRecipeChanges}
                        canPersistCostResult={canPersistCostResult}
                        hasValidCostResult={hasValidCostResult}
                        quoteIsValid={costingResult.quoteIsValid}
                        qualityLabel={qualityLabel}
                        totalProductionCostPerM={totals.totalProductionCostPerM}
                        hasOrderQty={hasOrderQty}
                        partyName={partyName}
                        exportReady={Boolean(exportModel)}
                        firstCostingReadinessMessage={firstCostingReadinessMessage}
                        actionReadinessMessage={actionReadinessMessage}
                        actionReadinessId={actionReadinessId}
                        topCostingActionLabel={topCostingActionLabel}
                        onSaveCosting={() => void handleSaveQuote('quote', 'draft')}
                        onStartPartyOrder={() => void handleStartPartyOrder()}
                        onSaveAccepted={() => void handleSaveQuote('quote', 'accepted')}
                        onExport={() => setShowExportDialog(true)}
                        onSaveDraft={() => void handleSaveQuote('quote', 'draft')}
                        onStartMarketRun={() => void handleSaveQuote('market')}
                        onSwitchMarket={() => setMode('market')}
                        onSwitchQuote={() => setMode('quote')}
                        onUpdateQuality={() => void handleUpdateTemplate()}
                        onSaveAsNewQuality={() => openSaveAsNewQualityDialog()}
                        onNewQuality={() => setShowConfirmNewQuality(true)}
                        onDismiss={onDismiss}
                    />
                )}
            />

            </fieldset>
            {/* ── DIALOGS ────────────────────────────────────────────────── */}

            <Dialog open={Boolean(pendingQualityChange)} onOpenChange={open => { if (!open) setPendingQualityChange(null) }}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tx('Switch quality with unfinished changes?')}</DialogTitle>
                        <DialogDescription>{tx('Your current inputs will be replaced. You can undo the switch before editing or saving the next quality.')}</DialogDescription>
                    </DialogHeader>
                    <p className="font-semibold">{pendingQualityChange?.name}</p>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPendingQualityChange(null)}>{tx('Keep working')}</Button>
                        <Button onClick={() => pendingQualityChange?.apply()}>{tx('Switch quality')}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ContextualMachineDialog
                open={showMachineSetup}
                onOpenChange={handleMachineSetupOpenChange}
                onMachineAdded={handleMachineAdded}
            />

            {showExportDialog && (
                <CostingExportDialog
                    open
                    onOpenChange={open => { setShowExportDialog(open); if (!open) setExportSavedCosting(false) }}
                    model={exportSavedCosting && lastSavedCosting ? lastSavedCosting.model : exportModel}
                    defaultCustomerName={showPartyField ? partyName : ''}
                    defaultBusinessName={organizationName}
                    defaultMode={exportSavedCosting ? 'customer' : isStandaloneCostingSession ? 'internal' : 'customer'}
                    sourceQuoteId={exportSavedCosting ? lastSavedCosting?.id : undefined}
                    sourceRecordKind={exportSavedCosting ? 'costing' : undefined}
                    documentReference={exportSavedCosting && lastSavedCosting ? `${lastSavedCosting.model.qualityLabel} · v${lastSavedCosting.version}` : undefined}
                />
            )}

            <Dialog open={Boolean(pendingStaleRateSave)} onOpenChange={open => { if (!open) setPendingStaleRateSave(null) }}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5 text-[var(--color-warning-amber)]" />
                            Review overdue costing rates
                        </DialogTitle>
                        <DialogDescription>
                            This estimate uses defaults whose review date has passed. You can still save deliberately, or review them first.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="rounded-lg border border-[var(--color-warning-amber)]/25 bg-[var(--color-warning-amber-soft)] px-4 py-3">
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--color-warning-amber)]">Overdue defaults</p>
                        <p className="mt-1 text-sm font-medium text-[var(--color-ink)]">{staleRateNames.join(', ')}</p>
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
                                if (pending) void handleSaveQuote(pending.targetMode, pending.status, true, pending.recordKindOverride, undefined, true)
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
                    <CostingSaveReview
                        state={state}
                        result={costingResult}
                        isStandaloneCostingSession={isStandaloneCostingSession}
                        fullReuse={Boolean(!canUseProduction && appliedTemplate?.latest_costing_reuse)}
                        compact
                    />
                    <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
                        <Button variant="ghost" onClick={() => setPendingQualityVersionSave(null)}>
                            {t('estimator.sprint1.cancel')}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => {
                                const pending = pendingQualityVersionSave
                                setPendingQualityVersionSave(null)
                                if (pending) void handleSaveQuote(pending.targetMode, pending.status, true, pending.recordKindOverride, 'version_only', true)
                            }}
                        >
                            {t('estimator.sprint1.save_version_only')}
                        </Button>
                        <Button
                            className="bg-[var(--color-yarn-orange)] text-white hover:bg-[var(--color-yarn-orange-dark)]"
                            onClick={() => {
                                const pending = pendingQualityVersionSave
                                setPendingQualityVersionSave(null)
                                if (pending) void handleSaveQuote(pending.targetMode, pending.status, true, pending.recordKindOverride, 'version_and_quality', true)
                            }}
                        >
                            {t('estimator.sprint1.save_version_update_quality')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Start New Quality Dialog */}
            <Dialog open={showConfirmNewQuality} onOpenChange={setShowConfirmNewQuality}>
                <DialogContent className="rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-panel)] sm:max-w-[400px]">
                    <DialogHeader className="space-y-3">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-factory-green-soft)] text-[var(--color-factory-green)]">
                            <Sparkles className="h-6 w-6" />
                        </div>
                        <DialogTitle className="text-center text-lg font-bold text-[var(--color-ink)]">
                            Start new quality / Reset?
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Clear the current estimator inputs while keeping saved qualities.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-2 text-center text-sm leading-relaxed text-[var(--color-muted)]">
                        This will clear the current estimator inputs. Saved qualities will not be affected.
                    </div>
                    <DialogFooter className="flex sm:justify-center gap-2 mt-4">
                        <Button
                            variant="outline"
                            onClick={() => setShowConfirmNewQuality(false)}
                            className="w-full border-[var(--color-hairline)] text-[var(--color-body)] hover:bg-[var(--color-surface-soft)] sm:w-auto"
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
            <Dialog
                open={showWarningAcknowledgement}
                onOpenChange={open => {
                    setShowWarningAcknowledgement(open)
                    if (!open) {
                        warningContinuationRef.current = null
                        setWarningSavePending(false)
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-[var(--color-warning-amber)]">
                            <AlertTriangle className="h-5 w-5" /> {tx('Review unusual values')}
                        </DialogTitle>
                        <DialogDescription>
                            {tx('These values may be valid for a special fabric, but they are outside the usual costing range. Confirm them before saving a costing or quotation.')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--color-warning-amber)]/25 bg-[var(--color-warning-amber-soft)] p-3">
                        {estimatorWarnings.map(warning => (
                            <div key={`${warning.field}:${warning.message}`} className="flex gap-2 text-sm text-[var(--color-ink)]">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-warning-amber)]" />
                                <span>{warning.message}</span>
                            </div>
                        ))}
                    </div>
                    <CostingSaveReview
                        state={state}
                        result={costingResult}
                        isStandaloneCostingSession={isStandaloneCostingSession}
                        fullReuse={Boolean(!canUseProduction && appliedTemplate?.latest_costing_reuse)}
                        compact
                    />
                    <DialogFooter>
                        <Button
                            variant="ghost"
                            onClick={() => {
                                warningContinuationRef.current = null
                                setWarningSavePending(false)
                                setShowWarningAcknowledgement(false)
                            }}
                        >
                            {tx('Go back')}
                        </Button>
                        <Button
                            className="bg-[var(--color-warning-amber)] text-white hover:bg-[var(--color-yarn-orange-dark)]"
                            onClick={() => {
                                const continuation = warningContinuationRef.current
                                warningContinuationRef.current = null
                                setWarningSavePending(false)
                                setAcknowledgedWarningKey(warningKey)
                                setShowWarningAcknowledgement(false)
                                if (continuation) {
                                    void Promise.resolve()
                                        .then(() => continuation())
                                        .catch(error => {
                                            console.error('Warning-reviewed save failed:', error)
                                            toast.error(tx('The save could not be completed. Try again.'))
                                        })
                                }
                            }}
                        >
                            {tx(warningSavePending ? 'Review and save' : 'I reviewed these values')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Save Quality Dialog */}
            <Dialog
                open={showSaveTemplate}
                onOpenChange={open => {
                    setShowSaveTemplate(open)
                    if (!open) {
                        rollbackSaveAsNewQualityDialog()
                        setTemplateSaveError(null)
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tx('Save as separate quality')}</DialogTitle>
                        <DialogDescription>{tx('Create a separate reusable quality. To change the open quality, close this dialog and use Update.')}</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="save-quality-name" className="text-[10px] font-semibold uppercase text-[var(--color-muted)]">{t('estimator.quality.qualityNameLabel')}</Label>
                            <Input
                                id="save-quality-name"
                                placeholder={tx('Japan Satin, Canvas Shine')}
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
                        <div className="space-y-1 rounded-xl border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-3.5 text-xs font-medium leading-relaxed text-[var(--color-body)]">
                            <p>{t('estimator.quality.savesNotePrefix')} {state.warpRows.length} {t('estimator.quality.savesNoteWarp')} {state.weftRows.length} {t('estimator.quality.savesNoteWeft')}</p>
                            <p className="text-[var(--color-muted)]">{t('estimator.quality.rateNote')} Current yarn rates are saved in the recipe; the first costing snapshot also records the full costing context.</p>
                        </div>
                        <CostingSaveReview
                            state={state}
                            result={costingResult}
                            isStandaloneCostingSession={isStandaloneCostingSession}
                            fullReuse={!canUseProduction}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            rollbackSaveAsNewQualityDialog()
                            setShowSaveTemplate(false)
                            setTemplateSaveError(null)
                        }}>{t('estimator.quality.cancel')}</Button>
                        <Button className="bg-brand-accent text-white" onClick={() => void handleSaveTemplate()} disabled={savingTemplate} aria-busy={savingTemplate}>
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
                        <Button variant="ghost" onClick={() => setRenameTpl(null)}>{tx('Cancel')}</Button>
                        <Button
                            onClick={handleRenameTemplate}
                            disabled={renamingTpl || !renameValue.trim()}
                            aria-describedby={!renameValue.trim() ? 'rename-quality-help' : undefined}
                            aria-busy={renamingTpl}
                        >
                            {renamingTpl && <Loader2 className="h-4 w-4 animate-spin" />} {renamingTpl ? tx('Saving name…') : t('estimator.sprint1.save_name_correction')}
                        </Button>
                        {!renameValue.trim() && <p id="rename-quality-help" className="text-xs font-medium text-amber-700">{tx('Enter a Fabric Quality name before saving.')}</p>}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Draft dismissal confirmation */}
            <Dialog open={showDiscardDraft} onOpenChange={setShowDiscardDraft}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{tx('Discard this device draft?')}</DialogTitle>
                        <DialogDescription>{tx('This removes the unfinished Cost Estimate saved on this device. Saved qualities, costings, and quotations are not affected.')}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDiscardDraft(false)}>{tx('Keep for later')}</Button>
                        <Button variant="destructive" onClick={() => { dismissDraft(); void trackPlanEvent('draft_discarded'); setShowDiscardDraft(false); setShowValidation(false); setDismissedWarnings([]); setAcknowledgedWarningKey(null); setShowWarningAcknowledgement(false); toast.success(tx('Cost Estimate draft discarded')) }}>{tx('Discard draft')}</Button>
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
            <Dialog open={!!editRatesTpl} onOpenChange={open => { if (!open && !savingRatesRef.current) setEditRatesTpl(null) }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            {t('estimator.quality.editDialogTitle')} {editRatesTpl?.name}
                        </DialogTitle>
                        <DialogDescription>{t('estimator.sprint1.edit_quality_rates')}</DialogDescription>
                    </DialogHeader>
                    <fieldset disabled={savingRates} className="py-3 space-y-5 min-w-0">
                        <p className="text-xs leading-relaxed text-[var(--color-muted)]">
                            {t('estimator.quality.structureNotePrefix')} <span className="font-bold text-[var(--color-body)]">{t('estimator.quality.structureNoteAnd')}</span> {t('estimator.quality.structureNoteSuffix')}
                        </p>

                        <p className="text-xs text-[var(--color-muted)]">{tx('Saved recipe rates are not a live market feed. Confirm them with your supplier.')}</p>
                        {/* Warp rates */}
                        {editingWarpRates.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-yarn-orange-dark)]">{t('estimator.quality.warpRates')}</p>
                                {(editRatesTpl?.warp_rows ?? []).map((row: WarpRow, i: number) => (
                                    <div key={row.id} className="flex items-center gap-4 rounded-xl border border-[var(--color-yarn-orange)]/20 bg-[var(--color-warning-amber-soft)]/45 px-4 py-3 shadow-sm transition-colors hover:border-[var(--color-yarn-orange)]/45 hover:bg-[var(--color-warning-amber-soft)]">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold tracking-tight text-[var(--color-body)]">{row.label?.trim() || `Warp ${i + 1}`}</p>
                                            <p className="font-mono text-[10px] font-medium text-[var(--color-muted)]">{row.calcDenier}D · {row.beamEnds} ends · {row.gstPct}% GST</p>
                                            <p className="text-xs tabular-nums text-[var(--color-muted)]">{tx('Saved rate')}: ₹{row.yarnRate.toFixed(2)}/kg</p>
                                        </div>
                                        <div className="relative shrink-0 w-36">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--color-muted)]">₹</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={editingWarpRates.find(x => x.id === row.id)?.yarnRate ?? row.yarnRate}
                                                aria-label={`${tx('Proposed warp rate')} ${i + 1} (₹/kg)`}
                                                inputMode="decimal"
                                                onChange={e => setEditingWarpRates(prev =>
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: parseNonNegativeInput(e.target.value) ?? 0 } : x)
                                                )}
                                                className="h-10 rounded-xl border-[var(--color-hairline)] bg-[var(--color-surface)] pl-8 pr-12 text-right font-mono text-sm font-semibold shadow-inner focus:border-[var(--color-yarn-orange)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-muted)]">/kg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Weft rates */}
                        {editingWeftRates.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--color-factory-green)]">{t('estimator.quality.weftRates')}</p>
                                {(editRatesTpl?.weft_rows ?? []).map((row: WeftRow, i: number) => (
                                    <div key={row.id} className="flex items-center gap-4 rounded-xl border border-[var(--color-factory-green)]/20 bg-[var(--color-factory-green-soft)]/70 px-4 py-3 shadow-sm transition-colors hover:border-[var(--color-factory-green)]/45 hover:bg-[var(--color-factory-green-soft)]">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[12px] font-bold tracking-tight text-[var(--color-body)]">{row.label?.trim() || `Weft ${i + 1}`}</p>
                                            <p className="font-mono text-[10px] font-medium text-[var(--color-muted)]">{row.calcDenier}D · {row.picks} PPI · {row.gstPct}% GST</p>
                                            <p className="text-xs tabular-nums text-[var(--color-muted)]">{tx('Saved rate')}: ₹{row.yarnRate.toFixed(2)}/kg</p>
                                        </div>
                                        <div className="relative shrink-0 w-36">
                                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-[var(--color-muted)]">₹</span>
                                            <Input
                                                type="number"
                                                min={0}
                                                step={1}
                                                value={editingWeftRates.find(x => x.id === row.id)?.yarnRate ?? row.yarnRate}
                                                aria-label={`${tx('Proposed weft rate')} ${i + 1} (₹/kg)`}
                                                inputMode="decimal"
                                                onChange={e => setEditingWeftRates(prev =>
                                                    prev.map(x => x.id === row.id ? { ...x, yarnRate: parseNonNegativeInput(e.target.value) ?? 0 } : x)
                                                )}
                                                className="h-10 rounded-xl border-[var(--color-hairline)] bg-[var(--color-surface)] pl-8 pr-12 text-right font-mono text-sm font-semibold shadow-inner focus:border-[var(--color-factory-green)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            />
                                            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-[var(--color-muted)]">/kg</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {rateImpact && <RateImpactSummary impact={rateImpact} hasSavedAssumptions={Boolean(editRatesTpl?.latest_costing_reuse)} tx={tx} />}
                    </fieldset>
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
                        <Button
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleApplyCurrentRates()}
                            disabled={savingRates}
                            className="rounded-xl font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                        >
                            {tx('Use saved rates')}
                        </Button>
                        <Button 
                            className="bg-brand-accent text-white font-semibold rounded-xl h-12 sm:h-11 shadow-lg shadow-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/30 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none sm:min-w-[180px]" 
                            onClick={() => void handleSaveRatesAndApply()}
                            disabled={savingRates}
                            aria-busy={savingRates}
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
