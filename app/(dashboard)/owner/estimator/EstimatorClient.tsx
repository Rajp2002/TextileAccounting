'use client'
import type {SavedFreeCosting} from '@/lib/free-costing-window'
import {FreeRecalculationWindow} from '@/components/estimator/FreeRecalculationWindow'

import dynamic from 'next/dynamic'
import { useMobileKeyboard } from '@/hooks/use-mobile-keyboard'
import { useReducer, useEffect, useLayoutEffect, useMemo, useCallback, useState, useRef, useId } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { nanoid } from 'nanoid'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CostEstimateTutorial } from '@/components/estimator/CostEstimateTutorial'
import { Label } from '@/components/ui/label'
import { LiquidSegmented } from '@/components/ui/liquid-segmented'
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
    ChevronRight,
    Scissors,
    Coins,
    Banknote,
    History,
    Search,
    X,
    AlertTriangle,
    RotateCcw,
    AlertCircle,
    Info,
    Play,
    Check,
    CheckCircle2,
    Minus,
    ReceiptText,
    FileDown,
    MoreHorizontal,
    BookOpen,
} from 'lucide-react'
import { useTranslation } from '@/lib/i18n/context'
import {
    type SavedYarnOption,
    type YarnSuggestionSelection,
    applyYarnSuggestionToRow,
    type RateBookYarnRecord,
    buildSavedYarnOptions,
    filterYarnOptions,
} from '@/lib/estimator-yarn-suggestions'
import {
    calcFullTotals,
    buildCostingResult,
    getBreakEvenScenario,
    calcPerPickCostFromWeavingRate,
    makeDefaultEstimateState,
    DEFAULT_WARP_ROW,
    DEFAULT_WEFT_ROW,
    DEFAULT_OVERHEAD_ITEMS,
    DEFAULT_FACTORY_SECTIONS,
    DEFAULT_WARP_CRIMP_PCT,
    ensureOverheadIntegrity,
    resolveOverheadItemAmount,
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
    upsertFactoryCostProfile,
    dismissFactoryCostWizard,
    archiveTemplate,
    renameTemplate,
} from './actions'
import { useFreeMeter } from '@/hooks/use-free-meter'
import { FreeUsageCard } from '@/components/estimator/FreeUsageCard'
import { FreeTransactionRecovery } from '@/components/estimator/FreeTransactionRecovery'
import { FreeSavedReceipt } from '@/components/estimator/FreeSavedReceipt'
import { FreeLeaveDialog } from '@/components/estimator/FreeLeaveDialog'
import { UpgradeBenefitsPreview } from '@/components/estimator/UpgradeBenefitsPreview'
import { useFreeLeaveGuard, type FreeLeaveReason } from '@/hooks/use-free-leave-guard'
import { freeLeaveReason as decideFreeLeaveReason, freePageSnapshot } from '@/lib/free-leave-guard'
import { freePreflight } from '@/lib/free-transaction'
import { warningAcknowledgementKey } from '@/lib/warning-acknowledgement'
import { freeText, type FreeText } from '@/lib/i18n/free-tier'
import { freeMobileText } from '@/lib/i18n/free-mobile'
import { liteEstimatorText } from '@/lib/i18n/lite-estimator'
import { getFreeCostingSections, type FreeCostingSection } from '@/lib/free-costing-sections'
import { FreeCostingChecklist } from '@/components/estimator/FreeCostingChecklist'
import { useGutterDock } from '@/hooks/use-gutter-dock'
import { makeFreeEstimate } from '@/lib/free-estimator-defaults'
import { LocalSaveStatus } from '@/components/local-save-status'
import { isDraftStored, useAutosave } from '@/hooks/useAutosave'
import { usePwaRefreshGuard } from '@/hooks/use-pwa-refresh-guard'
import { usePwaInstallBlocker } from '@/hooks/use-pwa-install-blocker'
import { reportPwaWorkflowSuccess } from '@/lib/pwa-workflow-success'
import { toast, userFacingError } from '@/lib/app-notifications'
import {
    handleEnterKeyNavigation,
    findNavigableFormInputs,
    focusAndSelectInput,
    scrollInputIntoComfortableView,
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
import { safeBaseReturnPath } from '@/lib/base-production-navigation'
const FactoryCostWizard = dynamic(() => import('./FactoryCostWizard'), {
    ssr: false,
    loading: () => null,
})
import {
    getFirstEstimatorValidationMessage,
    getEstimatorReadiness,
    getYarnDensityWarning,
    requiresFactoryCapacity,
    validateEstimatorSnapshot,
} from '@/lib/estimator-validation'
import { shouldAutoRestoreEstimatorDraft } from '@/lib/estimator-drafts'
import type { EstimatorDraftInput, EstimatorQuoteStatus } from '@/lib/estimator-drafts'
import { summarizeCostingInputChanges } from '@/lib/costing-input-changes'
import { createClientRequestUuid } from '@/lib/client-request-id'
import { runMutationWithTimeout } from '@/lib/mutation-outcome'
import { reconcileTemplateRateUpdate } from '@/lib/template-rate-reconciliation'
import { buildQualityConstructionCue, matchesQualitySearch } from '@/lib/quality-recall'
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
import { resolveAppliedQualityBasis, restoreSavedQualityCostingAssumptions, type SavedQualityCostingReuse } from '@/lib/saved-costings'
import { trackPlanEvent } from '@/lib/plan-analytics'
import { formatEstimatorPlaceholder, type EstimatorPlaceholderKind } from '@/lib/estimator-placeholder'
import { LiveValue } from '@/components/ui/live-value'

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
    default_warping_mode?: 'in_house' | 'outsourced' | null
    default_sizing_mode?: 'in_house' | 'outsourced' | null
    warping_mode?: 'in_house' | 'outsourced' | null
    sizing_mode?: 'in_house' | 'outsourced' | null
    is_configured: boolean
}>

function profileHasSavedBaseline(profile?: FactoryCostProfile) {
    return hasMeaningfulFactoryCostBaseline(profile)
}

/**
 * Older profiles could derive electricity or depreciation from machine count.
 * The simplified expense model preserves the last resolved rupee amount, then
 * treats every row as an owner-entered monthly expense from that point onward.
 */
function makeExpenseItemsManual(items: unknown[], loomCount: number): OverheadItem[] {
    return ensureOverheadIntegrity(items).map(item => ({
        ...item,
        monthlyAmount: resolveOverheadItemAmount(item, loomCount),
        source: item.source === 'fixed_worker_derived' ? item.source : 'manual',
        isLocked: false,
        meta: undefined,
    }))
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
        warpingMode: (profile.default_warping_mode ?? profile.warping_mode ?? base.warpingMode) as 'in_house' | 'outsourced',
        sizingMode: (profile.default_sizing_mode ?? profile.sizing_mode ?? base.sizingMode) as 'in_house' | 'outsourced',
        isConfigured: profileHasSavedBaseline(profile),
    }

    if (Array.isArray(profile.overhead_items) && profile.overhead_items.length > 0) {
        next = { ...next, overheadItems: makeExpenseItemsManual(profile.overhead_items, next.loomCount) }
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

const MAX_YARN_COMPONENTS = 20
const DEFAULT_YARN_COMPONENT_COUNT = 1

function normalizeYarnComponentCount(value: number) {
    const count = Math.floor(Number(value))
    if (!Number.isFinite(count)) return 1
    return Math.min(MAX_YARN_COMPONENTS, Math.max(1, count))
}

function makeNewWarpRow(): WarpRow {
    return { id: nanoid(), ...DEFAULT_WARP_ROW, label: '' }
}

function makeNewWeftRow(): WeftRow {
    return { id: nanoid(), ...DEFAULT_WEFT_ROW, label: '' }
}

function resizeYarnRows<T>(rows: T[], requestedCount: number, makeRow: () => T) {
    const count = normalizeYarnComponentCount(requestedCount)
    if (count <= rows.length) return rows.slice(0, count)

    return [
        ...rows,
        ...Array.from({ length: count - rows.length }, () => makeRow()),
    ]
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
    | { type: 'SET_WARP_COMPONENT_COUNT'; count: number }
    | { type: 'UPDATE_WARP_ROW'; id: string; field: keyof WarpRow; value: WarpRowValue }
    | { type: 'SELECT_WARP_YARN'; id: string; yarn: YarnSuggestionSelection }
    | { type: 'REMOVE_WARP_ROW'; id: string }
    | { type: 'ADD_WEFT_ROW' }
    | { type: 'SET_WEFT_COMPONENT_COUNT'; count: number }
    | { type: 'UPDATE_WEFT_ROW'; id: string; field: keyof WeftRow; value: WeftRowValue }
    | { type: 'SELECT_WEFT_YARN'; id: string; yarn: YarnSuggestionSelection }
    | { type: 'REMOVE_WEFT_ROW'; id: string }
    | { type: 'ENABLE_SECTION'; section: keyof FactorySections }
    | { type: 'ADD_OVERHEAD_ITEM' }
    | { type: 'UPDATE_OVERHEAD_ITEM'; id: string; field: 'label' | 'monthlyAmount' | 'isLocked'; value: OverheadItemValue }
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
                overheadItems:      makeExpenseItemsManual(savedItems ?? state.overheadItems, Number(profile.loom_count ?? state.loomCount)),
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
            // The quality's own direct overhead first, else the reused
            // costing's basis; never the editor's leftover overhead.
            const appliedBasis = resolveAppliedQualityBasis(tpl, restoredAssumptions)
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
                    ...appliedBasis,
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
                ...appliedBasis,
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
            return { ...state, warpRows: [...state.warpRows, makeNewWarpRow()] }
        case 'SET_WARP_COMPONENT_COUNT':
            return { ...state, warpRows: resizeYarnRows(state.warpRows, action.count, makeNewWarpRow) }
        case 'UPDATE_WARP_ROW':
            return {
                ...state,
                warpRows: state.warpRows.map(r =>
                    r.id === action.id ? { ...r, [action.field]: action.value } : r
                ),
            }
        case 'SELECT_WARP_YARN':
            // The chosen yarn's density arrives with its unit, or not at all;
            // an unknown density is cleared rather than inherited.
            return {
                ...state,
                warpRows: state.warpRows.map(r => r.id === action.id ? applyYarnSuggestionToRow(r, action.yarn) : r),
            }
        case 'REMOVE_WARP_ROW':
            if (state.warpRows.length <= 1) return state
            return { ...state, warpRows: state.warpRows.filter(r => r.id !== action.id) }
        case 'ADD_WEFT_ROW':
            return { ...state, weftRows: [...state.weftRows, makeNewWeftRow()] }
        case 'SET_WEFT_COMPONENT_COUNT':
            return { ...state, weftRows: resizeYarnRows(state.weftRows, action.count, makeNewWeftRow) }
        case 'UPDATE_WEFT_ROW':
            return {
                ...state,
                weftRows: state.weftRows.map(r =>
                    r.id === action.id ? { ...r, [action.field]: action.value } : r
                ),
            }
        case 'SELECT_WEFT_YARN':
            // The chosen yarn's density arrives with its unit, or not at all;
            // an unknown density is cleared rather than inherited.
            return {
                ...state,
                weftRows: state.weftRows.map(r => r.id === action.id ? applyYarnSuggestionToRow(r, action.yarn) : r),
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
            const next = buildEstimatorBaseline(
                profile
                    ? { ...profile, enabled_sections: profile.enabled_sections ?? sections }
                    : { enabled_sections: sections },
                workers,
            )
            return {
                ...next,
                // Retain configured status if the account was already configured
                isConfigured: state.isConfigured || next.isConfigured,
            }
        }
        case 'RESTORE_DRAFT':
            return {
                ...action.draftState,
                // A restored draft should never downgrade an already configured account.
                isConfigured: state.isConfigured || Boolean(action.draftState.isConfigured),
                overheadItems: makeExpenseItemsManual(action.draftState.overheadItems, action.draftState.loomCount),
            }
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

function ComponentCountField({
    label,
    value,
    onChange,
    accent,
    hint,
    unit,
}: {
    label: string
    value: number
    onChange: (value: number) => void
    accent: 'warp' | 'weft'
    hint: string
    unit: string
}) {
    const inputId = useId()
    const [draftValue, setDraftValue] = useState(String(value))

    useEffect(() => {
        setDraftValue(String(value))
    }, [value])

    const commitValue = (rawValue: string) => {
        const parsed = parseNumericInput(rawValue, { min: 1 })
        if (parsed === null) {
            setDraftValue(String(value))
            return
        }

        const nextValue = normalizeYarnComponentCount(parsed)
        setDraftValue(String(nextValue))
        onChange(nextValue)
    }

    const parsedDraftValue = parseNumericInput(draftValue, { min: 1 })
    const hasInvalidDraft = draftValue.trim() !== ''
        && (parsedDraftValue === null || !Number.isInteger(parsedDraftValue))

    return (
        <div className="min-w-0 space-y-1.5">
            <Label htmlFor={inputId} className="flex h-8 items-end text-[11px] font-semibold uppercase leading-tight tracking-[0.05em] text-[var(--color-muted)]">
                {label}
            </Label>
            <div className="relative" data-estimator-component-count>
                <Input
                    id={inputId}
                    data-estimator-field={`${accent}ComponentCount`}
                    data-testid={`${accent}-component-count`}
                    aria-describedby={`${inputId}-help`}
                    aria-invalid={hasInvalidDraft || undefined}
                    inputMode="numeric"
                    type="number"
                    min={1}
                    max={MAX_YARN_COMPONENTS}
                    step={1}
                    value={draftValue}
                    onFocus={event => event.currentTarget.select()}
                    onPointerDown={event => {
                        // A pointer press after focus can collapse the selection
                        // made above. Preserve it so typing replaces the current
                        // value instead of appending to it (1 + 2 => 12).
                        if (event.currentTarget === document.activeElement) return
                        event.preventDefault()
                        event.currentTarget.focus()
                        event.currentTarget.select()
                    }}
                    placeholder={String(DEFAULT_YARN_COMPONENT_COUNT)}
                    onChange={event => {
                        const rawValue = event.target.value
                        setDraftValue(rawValue)
                        const parsed = parseNumericInput(rawValue, { min: 1 })
                        if (parsed !== null && Number.isInteger(parsed)) {
                            onChange(normalizeYarnComponentCount(parsed))
                        }
                    }}
                    onBlur={() => commitValue(draftValue)}
                    className={`h-11 rounded-[9px] border bg-[var(--color-canvas-white)] px-24 text-center text-xs sm:text-sm font-mono font-semibold text-[var(--color-yarn-orange)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] transition-all placeholder:text-[var(--color-placeholder)] placeholder:font-normal focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${hasInvalidDraft ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] hover:border-[var(--color-hairline-strong)]'}`}
                />
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-[var(--color-muted)]">
                    {unit}
                </span>
            </div>
            <p id={`${inputId}-help`} className="text-[11px] font-medium leading-tight text-[var(--color-muted)]">
                {hint}
            </p>
        </div>
    )
}

function expandYarnComponentRows(accent: 'warp' | 'weft', count: number) {
    if (typeof window === 'undefined') return

    window.setTimeout(() => {
        const rowPrefix = accent === 'warp' ? 'warpRows' : 'weftRows'
        for (let index = 0; index < count; index += 1) {
            const row = document.querySelector<HTMLElement>(`[data-estimator-row="${rowPrefix}.${index}"]`)
            row?.dispatchEvent(new CustomEvent('expand-row', { bubbles: true }))
        }
    }, 0)
}

function YarnComponentCountFields({
    warpCount,
    weftCount,
    dispatch,
}: {
    warpCount: number
    weftCount: number
    dispatch: React.Dispatch<Action>
}) {
    const { t } = useTranslation()

    const changeCount = (accent: 'warp' | 'weft', requestedCount: number) => {
        const currentCount = accent === 'warp' ? warpCount : weftCount
        const nextCount = normalizeYarnComponentCount(requestedCount)
        if (nextCount === currentCount) return

        dispatch({
            type: accent === 'warp' ? 'SET_WARP_COMPONENT_COUNT' : 'SET_WEFT_COMPONENT_COUNT',
            count: nextCount,
        })

        if (nextCount > currentCount) {
            expandYarnComponentRows(accent, nextCount)
        }
    }

    return (
        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-4">
            <ComponentCountField
                label={t('estimator.quality.warpComponents')}
                value={warpCount}
                onChange={count => changeCount('warp', count)}
                accent="warp"
                hint={t('estimator.quality.componentCountHint')}
                unit={t('estimator.quality.componentsSuffix')}
            />
            <ComponentCountField
                label={t('estimator.quality.weftComponents')}
                value={weftCount}
                onChange={count => changeCount('weft', count)}
                accent="weft"
                hint={t('estimator.quality.componentCountHint')}
                unit={t('estimator.quality.componentsSuffix')}
            />
        </div>
    )
}

function SectionHeader({ title, icon: Icon, accent = 'warp', badgeContent, detail, step, tutorialSection }: {
    title:    string
    icon:     React.ElementType
    accent?:  EstimatorAccent
    badgeContent?: React.ReactNode
    detail?: React.ReactNode
    step?: number
    tutorialSection?: number
}) {
    const colorClass = getAccentStyles(accent)
    return (
        <div data-tutorial-section={tutorialSection} className="flex flex-col gap-3 border-b border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
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

function EstimatorCard({ children, accent = 'neutral', audit = false, 'data-tour-anchor': tourAnchor }: { children: React.ReactNode; accent?: EstimatorAccent; audit?: boolean; 'data-tour-anchor'?: string }) {
    const accentClass = getAccentStyles(accent).rail
    return (
        <Card
            data-estimator-audit={audit || undefined}
            data-enter-scroll-target="true"
            data-tour-anchor={tourAnchor}
            onFocusCapture={event => {
                const field = event.target
                if (!(field instanceof HTMLElement) || !event.currentTarget.contains(field)) return
                if (!field.matches('input, textarea, select, [role="combobox"]')) return
                // Let pointer selection and browser focus scrolling finish first.
                requestAnimationFrame(() => {
                    if (document.activeElement === field) scrollInputIntoComfortableView(field)
                })
            }}
            className="relative mb-3 overflow-hidden rounded-[14px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] shadow-[0_8px_28px_rgba(30,37,40,0.045)]">
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
    ghostValue,
    ghostPlaceholder,
    placeholderKind = 'example',
    fieldKey,
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
    placeholderKind?: EstimatorPlaceholderKind
    fieldKey?: string
}) {
    const decrement = () => onChange(Math.max(0, Number((value - step).toFixed(2))))
    const increment = () => onChange(Number((value + step).toFixed(2)))
    const isGhostValue = ghostValue !== undefined && value === ghostValue
    const placeholderClass = 'placeholder:text-[var(--color-placeholder)] placeholder:font-normal'
    const valueClass = 'text-[var(--color-yarn-orange)]'
    return (
        <div data-estimator-field={fieldKey} className="min-w-0 space-y-2">
            <Label className="block text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted)]">
                {label}
            </Label>
            <div data-estimator-stepper className="inline-flex h-11 overflow-hidden rounded-[9px] border border-[var(--color-hairline)] bg-white shadow-[0_1px_2px_rgba(30,37,40,0.04)]">
                <button
                    type="button"
                    onClick={decrement}
                    aria-label={`Decrease ${label}`}
                    className="flex w-11 items-center justify-center border-r border-[var(--color-hairline)] text-[var(--color-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-yarn-orange)]"
                >
                    <Minus className="h-3.5 w-3.5" />
                </button>
                <Input
                    aria-label={`${label} (${unit})`}
                    type="number"
                    value={isGhostValue ? '' : value}
                    placeholder={isGhostValue ? formatEstimatorPlaceholder(ghostPlaceholder ?? ghostValue, placeholderKind) : undefined}
                    step={step}
                    min={0}
                    onFocus={event => event.currentTarget.select()}
                    onPointerDown={event => {
                        if (event.currentTarget === document.activeElement) return
                        event.preventDefault()
                        event.currentTarget.focus()
                        event.currentTarget.select()
                    }}
                    onChange={e => {
                        const next = parseNonNegativeInput(e.target.value)
                        if (next !== null) onChange(next)
                    }}
                    className={`h-full w-16 rounded-none border-0 bg-white p-0 text-center font-mono text-sm font-semibold ${valueClass} ${placeholderClass} shadow-none focus-visible:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
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
    label, value, onChange, unit, step = 1, min = 0, hint, warning, onDismissWarning, placeholder, attentionWhenEmpty = false, preserveZero = false, ghostValue, fieldKey, placeholderKind = 'example', needsVerification = false,
}: {
    label: string; value: number | null; onChange: (v: number | null) => void
    unit?: string; step?: number; min?: number; hint?: string; warning?: string; fieldKey?: string
    onDismissWarning?: () => void; placeholder?: string; attentionWhenEmpty?: boolean; preserveZero?: boolean; ghostValue?: number; placeholderKind?: EstimatorPlaceholderKind; needsVerification?: boolean
}) {
    const inputId = useId()
    const [focused, setFocused] = useState(false)
    const [draftText, setDraftText] = useState<string | null>(null)
    const isEmpty = attentionWhenEmpty && (!value || value <= 0)
    // Estimator defaults are stored as numeric zero for calculations, but an
    // empty control with a zero placeholder is a better editing experience:
    // the first digit typed replaces the visual default instead of appending
    // to it (for example, entering 55 must never appear as 055).
    const isGhostValue = ghostValue !== undefined && value === ghostValue
    const calculatedDisplayValue = isGhostValue || (value === 0 && !preserveZero) ? '' : (value ?? '')
    const displayValue = focused && draftText !== null ? draftText : calculatedDisplayValue
    const displayPlaceholder = isGhostValue || (value === 0 && !preserveZero)
        ? formatEstimatorPlaceholder(placeholder ?? (ghostValue !== undefined ? String(ghostValue) : '0'), placeholderKind)
        : placeholder
    const placeholderClass = 'placeholder:text-[var(--color-placeholder)] placeholder:font-normal'
    return (
        <div className="space-y-1.5 min-w-0" data-estimator-field={fieldKey}>
            <Label htmlFor={inputId} className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">{label}</Label>
            <div className="relative group" data-estimator-unit-field={unit || undefined} style={unit ? { '--estimator-unit-length': Math.max(2, unit.length) } as React.CSSProperties : undefined}>
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
                    onFocus={event => {
                        setFocused(true)
                        setDraftText(null)
                        event.currentTarget.select()
                    }}
                    onPointerDown={event => {
                        if (event.currentTarget === document.activeElement) return
                        event.preventDefault()
                        event.currentTarget.focus()
                        event.currentTarget.select()
                    }}
                    onBlur={() => {
                        setFocused(false)
                        setDraftText(null)
                    }}
                    onChange={e => {
                        const raw = e.target.value
                        setDraftText(raw)
                        const val = parseNumericInput(raw, { min })
                        onChange(val)
                    }}
                    className={`h-11 text-xs sm:text-sm font-mono font-semibold text-center ${unit ? 'px-10 sm:px-14' : 'px-3'} border ${placeholderClass} focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[9px] text-[var(--color-yarn-orange)] shadow-[0_1px_2px_rgba(30,37,40,0.035)] ${
                        isEmpty ? 'bg-[var(--color-warning-amber-soft)] border-[var(--color-warning-amber)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : needsVerification ? 'border-[var(--wv-ochre-400)] bg-[var(--wv-ochre-50)]/50 text-[var(--wv-ochre-900)] ring-1 ring-[var(--wv-ochre-400)]/40' : 'bg-[var(--color-canvas-white)] border-[var(--color-hairline)] hover:border-[var(--color-hairline-strong)]'
                    }`}
                />
                {unit && (
                    <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--color-muted)] font-medium pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>
            {isEmpty && <p id={`${inputId}-help`} className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required</p>}
            {needsVerification && !isEmpty && (
                <p className="text-[10px] font-semibold text-[var(--wv-ochre-800)] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--wv-ochre-400)] shrink-0 inline-block" />
                    Auto-filled · Verify
                </p>
            )}
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
                            className="estimator-touch-target rounded px-1 text-left text-xs text-[var(--wv-cotton-500)] underline hover:text-[var(--wv-neel-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wv-brand-accent-strong)]"
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
    needsVerification = false,
}: {
    row: YarnDensityRow
    onChange: (field: YarnDensityField, value: YarnLinearDensityUnit | number | null) => void
    needsVerification?: boolean
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
            needsVerification={needsVerification}
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
            <div className="relative group" data-estimator-unit-field={unit} style={{ '--estimator-unit-length': Math.max(4, unit.length) } as React.CSSProperties}>
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
                    className={`h-11 text-xs sm:text-sm font-mono font-semibold text-center px-12 sm:px-16 placeholder:text-[var(--color-placeholder)] placeholder:font-normal focus:border-brand-accent focus:ring-1 focus:ring-brand-accent/15 transition-all shadow-[0_1px_2px_rgba(30,37,40,0.035)] group-hover:border-[var(--color-hairline-strong)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none rounded-[9px] text-[var(--color-yarn-orange)] ${isEmpty ? 'bg-[var(--color-warning-amber-soft)] border-[var(--color-warning-amber)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'bg-white border-[var(--color-hairline)]'}`}
                />
                <span className="absolute right-3.5 sm:right-4 top-1/2 -translate-y-1/2 text-xs text-[var(--wv-cotton-500)] font-bold pointer-events-none">
                    {unit}
                </span>
            </div>
            <div className="flex flex-col gap-0.5 mt-1">
                {isEmpty && <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required</p>}
                {value > 0 && (
                    <p className="text-[10px] text-[var(--color-factory-green)] font-semibold leading-tight flex items-center gap-1 bg-[var(--color-factory-green-soft)] py-0.5 px-2 rounded-md self-start border border-[var(--wv-moss-200)]">
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
    metered = false,
    compactLite = false,
    persistenceLabel,
    awaitingCalculation = false,
    inputSections = [],
    onSelectSection,
    visible,
    keyboardVisible,
    activeName,
    freeSnapshot,
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
    open: controlledOpen,
    onOpenChange: setControlledOpen,
    isTutorialActive = false,
}: {
    metered?: boolean
    compactLite?: boolean
    persistenceLabel?: string
    awaitingCalculation?: boolean
    inputSections?: FreeCostingSection[]
    onSelectSection?: (section: FreeCostingSection) => void
    visible: boolean
    keyboardVisible: boolean
    activeName: string
    freeSnapshot?: { label: string; revision: number }
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
    open?: boolean
    onOpenChange?: (open: boolean) => void
    isTutorialActive?: boolean
}) {
    const { tx, language } = useTranslation()
    const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
    const open = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen
    const setOpen = setControlledOpen ?? setUncontrolledOpen
    const shortcutRef = useRef<HTMLDivElement>(null)
    const actionHeightProperty = compactLite ? '--lite-mobile-action-height' : '--free-mobile-action-height'
    // Reserve the actual action height, including translated/enlarged labels.
    // Keep that clearance while the keyboard or result sheet hides the dock.
    useEffect(() => {
        const node = shortcutRef.current
        if ((!metered && !compactLite) || !node) return
        const measure = () => {
            const height = node.getBoundingClientRect().height
            if (height > 0) document.documentElement.style.setProperty(actionHeightProperty, `${Math.ceil(height)}px`)
        }
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(node)
        return () => observer.disconnect()
    }, [metered, compactLite, actionHeightProperty, visible, keyboardVisible, open])
    useEffect(() => () => {
        if (metered || compactLite) document.documentElement.style.removeProperty(actionHeightProperty)
    }, [metered, compactLite, actionHeightProperty])
    const compactFreePreview = metered && !hasValidCostResult && !isTutorialActive
    const adaptiveFreeModal = metered && !isTutorialActive
    const hasValidPrice = hasValidCostResult && quoteIsValid
    const hasReviewState = needsReview || missingIssueCount > 0 || (!awaitingCalculation && (!hasValidCostResult || !quoteIsValid))
    const readyToCalculate = awaitingCalculation && !hasReviewState
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
            : readyToCalculate ? freeText(language, 'readyToCalculate') : 'Review the costing inputs'
    const shortcutBadge = hasValidCostResult && hasValidPrice
        ? 'Live'
        : missingIssueCount > 0
            ? String(Math.min(missingIssueCount, 9))
            : readyToCalculate ? '→' : '!'

    return (
        <>
            {visible && !keyboardVisible && !open && (
                <div
                    ref={shortcutRef}
                    data-free-mobile-action={metered || undefined}
                    data-lite-mobile-action={compactLite || undefined}
                    className="fixed mobile-floating-action bottom-6 right-4 z-40 md:bottom-7 md:right-7 lg:right-6 xl:right-8"
                    data-testid="mobile-live-estimate-shortcut"
                    data-tour-floating="true"
                >
                    <button
                        type="button"
                        data-tutorial-section={9}
                        data-estimator-field="liveCostShortcut"
                        aria-label={compactLite ? liteEstimatorText(language, hasValidCostResult ? 'viewLabel' : 'reviewLabel', { value: productionCostPerM.toFixed(2), count: missingIssueCount, state: persistenceLabel ?? liteEstimatorText(language, 'live') }) : metered ? freeMobileText(language, hasValidCostResult ? 'saved' : 'review') : `View live cost estimate. ${shortcutLabel}`}
                        aria-expanded={open}
                        aria-controls="mobile-live-estimate-panel"
                        onClick={() => setOpen(true)}
                        className="group flex items-center justify-end gap-3 sm:gap-3.5 rounded-full border-2 border-[var(--color-yarn-orange)]/25 bg-[var(--color-canvas-white)]/95 p-2 pl-4 sm:p-2.5 sm:pl-5 text-left shadow-[0_12px_32px_rgba(30,37,40,0.18),0_2px_8px_rgba(30,37,40,0.06)] backdrop-blur-xl transition-all duration-200 motion-reduce:transition-none hover:border-[var(--color-yarn-orange)]/45 hover:shadow-[0_16px_38px_rgba(30,37,40,0.22),0_4px_12px_rgba(30,37,40,0.08)] hover:-translate-y-0.5 active:translate-y-0 active:shadow-[0_8px_20px_rgba(30,37,40,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)] focus-visible:ring-offset-2"
                    >
                        <span className="free-mobile-action-label min-w-0 max-w-[12rem] sm:max-w-[14.5rem] pr-1">
                            <span className="free-mobile-action-eyebrow block text-[11px] sm:text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-yarn-orange-dark)]">{compactLite ? <><span className="lite-mobile-only" data-i18n-skip="true">{liteEstimatorText(language, 'live')}</span><span className="lite-desktop-only">{tx('Live cost')}</span></> : metered ? <><span className="free-mobile-only">{freeMobileText(language, hasValidCostResult ? 'saved' : 'review')}</span><span className="free-desktop-only">{tx('Live cost')}</span></> : tx('Live cost')}</span>
                            <span className="mt-0.5 block truncate text-[13px] sm:text-[15px] font-bold text-[var(--color-ink)]">
                                {compactLite ? <><span className="lite-mobile-only" data-i18n-skip="true">{hasValidCostResult ? `₹${productionCostPerM.toFixed(2)}/m` : liteEstimatorText(language, 'complete')}</span><span className="lite-desktop-only">{hasValidCostResult ? 'View costing' : 'Complete inputs'}</span></> : metered ? <><span className="free-mobile-only">{hasValidCostResult ? validityLabel : readyToCalculate ? freeText(language, 'readyToCalculate') : freeMobileText(language, 'complete')}</span><span className="free-desktop-only">{hasValidCostResult ? 'View costing' : readyToCalculate ? freeText(language, 'readyToCalculate') : 'Complete inputs'}</span></> : hasValidCostResult ? 'View costing' : readyToCalculate ? freeText(language, 'readyToCalculate') : 'Complete inputs'}
                            </span>
                            {compactLite && <span className="lite-mobile-only lite-estimator-outcome text-xs text-muted-foreground" data-i18n-skip="true">{persistenceLabel}</span>}
                        </span>
                        <span className="free-mobile-action-icon relative flex h-[52px] w-[52px] sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-full bg-[var(--color-warning-amber-soft)] text-[var(--color-yarn-orange-dark)] transition-colors group-hover:bg-[var(--color-yarn-orange)] group-hover:text-white">
                            <Calculator className="h-6 w-6" aria-hidden="true" />
                            <span
                                aria-hidden="true"
                                className={`absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-[var(--color-canvas-white)] px-1 text-[10px] font-bold leading-none text-white shadow-sm ${hasValidCostResult && hasValidPrice ? 'bg-[var(--color-factory-green)]' : 'bg-[var(--color-warning-amber)]'}`}
                            >
                                {shortcutBadge === 'Live' ? <span className="h-2 w-2 rounded-full bg-white" /> : shortcutBadge}
                            </span>
                        </span>
                    </button>
                </div>
            )}

            <Sheet
                open={open}
                onOpenChange={(nextOpen) => {
                    if (isTutorialActive && !nextOpen) {
                        return
                    }
                    setOpen(nextOpen)
                }}
                modal={!isTutorialActive}
            >
                <SheetContent
                    id="mobile-live-estimate-panel"
                    side="bottom"
                    hideOverlay={isTutorialActive}
                    showCloseButton={!isTutorialActive}
                    onOpenAutoFocus={(e) => {
                        if (isTutorialActive) {
                            e.preventDefault()
                        }
                    }}
                    onPointerDownOutside={(e) => {
                        if (isTutorialActive) {
                            e.preventDefault()
                        }
                    }}
                    onInteractOutside={(e) => {
                        if (isTutorialActive) {
                            e.preventDefault()
                        }
                    }}
                    data-free-preview={adaptiveFreeModal ? compactFreePreview ? "inputs" : "result" : undefined}
                    data-lite-cost-result={compactLite || undefined}
                    className={`max-h-[min(84dvh,44rem)] overflow-y-auto rounded-t-[22px] border-x-0 border-b-0 px-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-0 md:inset-x-0 md:mx-auto md:h-auto md:overflow-y-auto md:rounded-b-[22px] md:border md:border-[var(--color-hairline)] ${adaptiveFreeModal ? `gap-0 [&>*]:shrink-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2 md:max-h-[calc(100dvh-3rem)] ${compactFreePreview ? "md:w-[min(calc(100vw-3rem),32rem)]" : "md:w-[min(calc(100vw-3rem),38rem)]"}` : "md:bottom-6 md:top-6 md:max-h-none md:w-[min(calc(100vw-3rem),38rem)]"} ${isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''}`}
                >
                    <SheetHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-warning-amber-soft)]/70 px-5 pb-4 pt-5 pr-16 text-left">
                        <SheetTitle className="text-[17px]">{metered ? <><span className="free-mobile-only">{freeMobileText(language, hasValidCostResult ? 'saved' : 'review')}</span><span className="free-desktop-only">{tx('Live cost')}</span></> : tx('Live cost')}</SheetTitle>
                        <SheetDescription data-free-result-identity={metered || undefined} className="truncate text-[12px] font-semibold text-[var(--color-ink)]">
                            {metered ? <><span className="free-mobile-only" data-i18n-skip="true" lang={language}>{freeSnapshot ? freeMobileText(language, 'savedIdentity', freeSnapshot) : activeName}</span><span className="free-desktop-only">{activeName}{versionLabel ? ` · ${versionLabel}` : ''}</span></> : <>{activeName}{versionLabel ? ` · ${versionLabel}` : ''}</>}
                        </SheetDescription>
                        {!compactFreePreview && <p className="mt-1 text-[10px] font-medium text-[var(--color-muted)]">{metered ? hasValidCostResult ? freeText(language, 'savedRevisionHint') : freeText(language, 'resultAfterCalculation') : 'Updates live as you edit the estimate.'}</p>}
                        {compactLite && <p className="lite-mobile-only mt-1 text-sm text-body" data-i18n-skip="true">{persistenceLabel}</p>}
                    </SheetHeader>

                    {compactFreePreview ? (
                        <FreeCostingChecklist sections={inputSections} onSelect={section => {
                            setOpen(false)
                            onSelectSection?.(section)
                        }} />
                    ) : <>
                    <div data-estimator-field="liveCostReadiness" className={`mx-5 mt-4 flex items-start gap-2 rounded-[10px] border px-3 py-2.5 text-[11px] leading-4 ${validityClassName}`} role="status" aria-live="polite">
                        <ValidityIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                            <span className="font-semibold">{validityLabel}</span>
                            <span className="ml-1.5 font-medium opacity-85">{validityDescription}</span>
                        </div>
                    </div>

                    <div data-estimator-field="liveCostMetrics" className="space-y-2.5">
                        <div className="grid grid-cols-2 gap-2.5 px-5 pt-4" aria-label="Live cost metrics">
                            <div className="min-w-0 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-3">
                                <p className="text-[10px] font-semibold leading-4 text-[var(--color-muted)]">Production cost / m</p>
                                <p className="mt-1 break-words font-mono text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink)]">
                                    <LiveValue value={hasValidCostResult ? `₹${productionCostPerM.toFixed(2)}` : '—'} />
                                </p>
                            </div>
                            <div className="min-w-0 rounded-[12px] border border-[var(--color-yarn-orange)]/25 bg-[var(--color-warning-amber-soft)]/55 px-3 py-3">
                                <p className="text-[10px] font-semibold leading-4 text-[var(--color-muted)]">Suggested price / m</p>
                                <p className="mt-1 break-words font-mono text-[1.45rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-yarn-orange)]">
                                    <LiveValue value={hasValidPrice ? `₹${suggestedSellingPricePerM.toFixed(2)}` : '—'} />
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 px-5 pt-2.5">
                            <div className={`min-w-0 rounded-[12px] border px-3 py-3 ${marginSurface}`}>
                                <p className={`text-[10px] font-semibold leading-4 ${marginTone}`}>Estimated margin at this price</p>
                                <p className={`mt-1 break-words font-mono text-[1.25rem] font-semibold leading-none tracking-tight tabular-nums ${marginTone}`}>
                                    <LiveValue value={actualMarginPct === null ? '—' : `${actualMarginPct >= 0 ? '+' : ''}${actualMarginPct.toFixed(1)}%`} />
                                </p>
                            </div>
                            <div className="min-w-0 rounded-[12px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-3">
                                <p className="text-[10px] font-semibold leading-4 text-[var(--color-muted)]">Break-even price / m</p>
                                <p className="mt-1 break-words font-mono text-[1.25rem] font-semibold leading-none tracking-tight tabular-nums text-[var(--color-ink)]">
                                    <LiveValue value={hasValidCostResult && breakEvenPricePerM != null ? `₹${breakEvenPricePerM.toFixed(2)}` : '—'} />
                                </p>
                            </div>
                        </div>

                        {hasOrderQty && expectedProfitTotal != null && (
                            <div className="mx-5 mt-2.5 flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                <span className="text-[11px] font-semibold text-[var(--color-muted)]">Expected profit</span>
                                <span className={`font-mono text-[13px] font-semibold tabular-nums ${expectedProfitTotal < 0 ? 'text-[var(--color-risk-red)]' : 'text-[var(--color-factory-green)]'}`}>
                                    <LiveValue value={`₹${expectedProfitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} />
                                </span>
                            </div>
                        )}
                    </div>

                    {assumptions && <div data-estimator-field="liveCostAssumptions" className="px-5 pt-3">{assumptions}</div>}

                    {hasReviewState ? (
                        <button
                            type="button"
                            onClick={() => {
                                if (isTutorialActive) return
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
                        <p className="px-5 pt-4 text-[10px] font-medium leading-4 text-[var(--color-muted)]">{metered ? hasValidCostResult ? 'This completed costing is saved. Open Saved Costings to view or export it later.' : freeText(language, 'calculateToSeeResult') : 'Use the estimate above while reviewing the form, then save when the costing is ready.'}</p>
                    )}

                    </>}

                    {actions && (
                        <div data-estimator-field="liveCostActions" className={`border-t border-[var(--color-hairline)]/80 px-5 pb-1 pt-4 ${adaptiveFreeModal && !compactFreePreview ? "mt-4" : ""}`}>
                            {typeof actions === 'function' ? actions(() => { if (!isTutorialActive) setOpen(false) }) : actions}
                        </div>
                    )}
                </SheetContent>
            </Sheet>
        </>
    )
}

function CostingAssumptionsSummary({
    result,
    expanded,
    onToggle,
}: {
    result: CostingResultSnapshot
    expanded: boolean
    onToggle: () => void
}) {
    const assumptions = result.assumptions
    const overhead = assumptions?.overhead
    const quantity = assumptions?.quantity.activeRate ?? result.quantityM
    const hasQuantity = quantity != null && Number.isFinite(quantity) && quantity > 0
    const productionCostAvailable = Number.isFinite(result.productionCostPerM) && result.productionCostPerM > 0
    const calculationIncomplete = !assumptions
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
                                    <p className="mt-0.5 text-[11px] leading-4 text-[var(--color-muted)]">Optional; per-metre price unchanged</p>
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

                        <details className="ui-details border-t border-[var(--color-hairline)]/70 px-3 py-2.5 sm:px-4">
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
    fullReuse,
    compact = false,
}: {
    state: EstimateState
    result: CostingResultSnapshot
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
                Included in this costing snapshot:
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
    freeCanCalculate,
    savingQuote,
    savingTemplate,
    appliedTemplate,
    hasActiveQualityRecipeChanges,
    canPersistCostResult,
    hasValidCostResult,
    qualityLabel,
    totalProductionCostPerM,
    exportReady,
    firstCostingReadinessMessage,
    actionReadinessMessage,
    actionReadinessId,
    topCostingActionLabel,
    onSaveCosting,
    onExport,
    onUpdateQuality,
    onSaveAsNewQuality,
    onNewQuality,
    onDismiss,
}: {
    freeCanCalculate?: boolean
    savingQuote: boolean
    savingTemplate: boolean
    appliedTemplate: EstimatorTemplate | null
    hasActiveQualityRecipeChanges: boolean
    canPersistCostResult: boolean
    hasValidCostResult: boolean
    qualityLabel: string
    totalProductionCostPerM: number
    exportReady: boolean
    firstCostingReadinessMessage: string | null
    actionReadinessMessage: string | null
    actionReadinessId: string
    topCostingActionLabel: string
    onSaveCosting: () => void
    onExport: () => void
    onUpdateQuality: () => void
    onSaveAsNewQuality: () => void
    onNewQuality: () => void
    onDismiss: () => void
}) {
    const { t, language } = useTranslation()
    const saveCostingDisabled = freeCanCalculate !== undefined ? !freeCanCalculate : savingQuote
        || !canPersistCostResult
        || !hasValidCostResult
        || !qualityLabel.trim()
        || totalProductionCostPerM <= 0
    const qualitySaveLabel = appliedTemplate && hasActiveQualityRecipeChanges
        ? 'Quality changed · Update Quality'
        : appliedTemplate
            ? 'Quality unchanged'
            : 'Save as Quality'
    const runAction = (action: () => void) => {
        onDismiss()
        action()
    }

    if (freeCanCalculate !== undefined) return (
        <div className="space-y-3" data-testid="live-cost-action-hub">
            <Button type="button" data-testid="save-costing-action" variant="default"
                className="h-auto min-h-[44px] w-full whitespace-normal rounded-xl px-4 py-3 text-sm font-semibold"
                disabled={saveCostingDisabled} aria-busy={savingQuote}
                onClick={() => runAction(onSaveCosting)}>
                {savingQuote ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Calculator className="h-4 w-4 shrink-0" />}
                {topCostingActionLabel}
            </Button>
            {!hasValidCostResult && <p className="text-center text-xs leading-relaxed text-muted-foreground">{freeText(language, 'compactCreationPolicy')}</p>}
            {hasValidCostResult && <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                <Button type="button" variant="ghost" className="h-auto min-h-[44px] whitespace-normal text-xs" disabled={!exportReady} onClick={() => runAction(onExport)}>
                    <FileDown className="h-3.5 w-3.5" />{freeText(language, 'exportCosting')}
                </Button>
                <Button type="button" variant="ghost" className="h-auto min-h-[44px] whitespace-normal text-xs" onClick={() => runAction(onNewQuality)}>
                    <Plus className="h-3.5 w-3.5" />{freeText(language, 'startNewCosting')}
                </Button>
            </div>}
        </div>
    )

    return (
        <div className="space-y-3" data-testid="live-cost-action-hub">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--color-yarn-orange-dark)]">Actions</p>
                    <p className="mt-0.5 text-[10px] font-medium leading-4 text-[var(--color-muted)]">{freeCanCalculate !== undefined ? hasValidCostResult ? 'Export the saved result or start another costing.' : freeText(language, 'resultAfterCalculation') : 'Save the current result, reuse the recipe, or open a utility.'}</p>
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
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
                <div data-testid="save-costing-action-top" className="min-w-0 sm:col-span-2">
                    <Button
                        id="btn-save-accept"
                        data-testid="save-costing-action"
                        type="button"
                        size="sm"
                        variant="default"
                        className="h-12 w-full rounded-xl bg-loom px-4 text-[13px] font-semibold text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                        onClick={() => runAction(onSaveCosting)}
                        disabled={saveCostingDisabled}
                        aria-busy={savingQuote}
                        aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                        aria-label={topCostingActionLabel}
                        title={firstCostingReadinessMessage ?? (saveCostingDisabled ? 'Complete the required inputs before saving.' : undefined)}
                    >
                        {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                        <span className="truncate">{topCostingActionLabel}</span>
                    </Button>
                </div>
            </div>

            {freeCanCalculate === undefined && <><div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-2">
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
                    id="save-quality-and-costing"
                    data-testid="save-as-new-quality"
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(onSaveAsNewQuality)}
                    className="h-10 min-w-0 flex-1 rounded-[9px] border-[var(--color-yarn-orange)]/35 bg-white px-3 text-[12px] font-semibold text-[var(--color-yarn-orange-dark)] hover:border-[var(--color-yarn-orange)] hover:bg-[var(--color-warning-amber-soft)] sm:flex-none"
                    title={t('estimator.quality.saveQualityAndCostingHint')}
                    aria-label={t('estimator.quality.saveQualityAndCosting')}
                >
                    <BookmarkPlus className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t('estimator.quality.saveQualityAndCosting')}</span>
                </Button>
                {appliedTemplate && !hasActiveQualityRecipeChanges && (
                    <span className="text-[10px] font-medium text-[var(--color-muted)]">{qualitySaveLabel}</span>
                )}
            </div>
            <p className="px-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                {t('estimator.quality.saveQualityAndCostingHint')}
            </p></>}

            {actionReadinessMessage && (
                <p id={actionReadinessId} role="status" className="rounded-lg border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-2 text-[11px] font-medium leading-relaxed text-[var(--wv-ochre-800)]">
                    {actionReadinessMessage}
                </p>
            )}
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
    suggestions = [],
    onSelectYarn,
    preferredCategory,
}: {
    label: string
    value: string
    placeholder: string
    ghostValue?: string
    onChange: (value: string) => void
    suggestions?: SavedYarnOption[]
    onSelectYarn?: (yarn: SavedYarnOption) => void
    preferredCategory?: 'yarn_warp' | 'yarn_weft'
}) {
    const ghostText = ghostValue ?? placeholder
    const isGhostValue = Boolean(value?.trim()) && value.trim() === ghostText.trim()
    const inputValue = isGhostValue ? '' : value
    const displayPlaceholder = formatEstimatorPlaceholder(ghostText)
    const [isOpen, setIsOpen] = useState(false)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const containerRef = useRef<HTMLDivElement>(null)

    const filteredOptions = useMemo(() => {
        if (!suggestions || suggestions.length === 0) return []
        return filterYarnOptions(suggestions, inputValue, preferredCategory, 8)
    }, [suggestions, inputValue, preferredCategory])

    useEffect(() => {
        if (!isOpen) return
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen])

    const handleSelect = (yarn: SavedYarnOption) => {
        if (onSelectYarn) {
            onSelectYarn(yarn)
        } else {
            onChange(yarn.name)
        }
        setIsOpen(false)
        setHighlightedIndex(-1)
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            setIsOpen(true)
            return
        }
        if (!isOpen) return

        if (e.key === 'Escape' || (e.key === 'Enter' && highlightedIndex < 0)) {
            setIsOpen(false)
            setHighlightedIndex(-1)
            return
        }
        if (filteredOptions.length === 0) return

        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHighlightedIndex(prev => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
        } else if (e.key === 'Enter') {
            if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
                e.preventDefault()
                handleSelect(filteredOptions[highlightedIndex])
            }
        }
    }

    return (
        <div
            data-estimator-field="label"
            className="space-y-1.5 min-w-0 relative"
            ref={containerRef}
            onBlur={e => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setIsOpen(false)
                    setHighlightedIndex(-1)
                }
            }}
        >
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                {label}
            </Label>
            <div className="relative">
                <Input
                    aria-label={label}
                    value={inputValue}
                    placeholder={displayPlaceholder}
                    onFocus={() => {
                        if (suggestions.length > 0) setIsOpen(true)
                    }}
                    onChange={e => {
                        onChange(e.target.value)
                        if (!isOpen && suggestions.length > 0) setIsOpen(true)
                        setHighlightedIndex(-1)
                    }}
                    onKeyDown={handleKeyDown}
                    className={`h-11 rounded-[9px] border font-semibold placeholder:text-[var(--color-placeholder)] placeholder:font-normal focus:border-[var(--color-yarn-orange)] focus:ring-[var(--color-yarn-orange)]/10 ${
                        suggestions.length > 0 ? 'pr-8 ' : ''
                    }${
                        value?.trim() ? 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)] text-[var(--color-yarn-orange)]' : 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]'
                    }`}
                />
                {suggestions.length > 0 && (
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setIsOpen(prev => !prev)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--wv-cotton-500)] hover:text-[var(--wv-neel-700)] p-1"
                        aria-label="Toggle saved yarns dropdown"
                    >
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                )}
            </div>
            {!value?.trim() && <p className="text-[10px] text-[var(--color-warning-amber)]">Required</p>}

            {isOpen && filteredOptions.length > 0 && (
                <div
                    data-testid="yarn-ratebook-dropdown"
                    className="absolute left-0 top-full mt-1.5 z-50 w-[360px] sm:w-[440px] max-w-[calc(100vw-2.5rem)] rounded-[14px] border border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-0)] shadow-[0_16px_40px_-6px_rgba(15,23,42,0.18),0_4px_16px_-2px_rgba(15,23,42,0.08)] ring-1 ring-black/5 overflow-hidden"
                >
                    <div className="sticky top-0 z-10 bg-[var(--wv-cotton-100)]/95 backdrop-blur-xs px-3.5 py-2 border-b border-[var(--wv-cotton-200)] flex items-center justify-between text-[10px] font-bold text-[var(--wv-neel-500)] uppercase tracking-wider">
                        <div className="flex items-center gap-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-[var(--wv-cotton-500)] shrink-0" />
                            <span>Saved Yarns ({filteredOptions.length})</span>
                        </div>
                        <span className="text-[10px] font-normal text-[var(--wv-cotton-500)] lowercase tracking-normal">auto-fills denier & rate</span>
                    </div>
                    <ul className="max-h-64 overflow-y-auto divide-y divide-[var(--wv-cotton-200)]/70 p-1.5">
                        {filteredOptions.map((opt, idx) => {
                            const isSelected = idx === highlightedIndex
                            return (
                                <li key={`${opt.name}-${opt.category}-${idx}`}>
                                    <button
                                        type="button"
                                        onMouseDown={e => {
                                            // Prevent input blur before click registers
                                            e.preventDefault()
                                        }}
                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                        onClick={() => handleSelect(opt)}
                                        className={`w-full text-left p-2.5 rounded-[9px] transition-colors flex flex-col gap-1.5 ${
                                            isSelected ? 'bg-[var(--wv-ochre-50)]/90 ring-1 ring-[var(--wv-ochre-200)] text-[var(--wv-neel-900)]' : 'hover:bg-[var(--wv-cotton-100)]/90 text-[var(--wv-neel-800)]'
                                        }`}
                                    >
                                        {/* Line 1: Full, readable yarn name + Rate badge */}
                                        <div className="flex items-start justify-between gap-3 min-w-0">
                                            <span className="text-xs font-bold text-[var(--wv-neel-900)] leading-snug break-words">
                                                {opt.name}
                                            </span>
                                            {opt.yarnRate > 0 && (
                                                <span className="font-mono text-xs font-bold text-[var(--wv-moss-700)] bg-[var(--wv-moss-50)] border border-[var(--wv-moss-200)] px-2 py-0.5 rounded-md shrink-0 whitespace-nowrap shadow-xs">
                                                    ₹{opt.yarnRate}/kg
                                                </span>
                                            )}
                                        </div>

                                        {/* Line 2: Density, Category, and Provenance */}
                                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                            {opt.denier > 0 && (
                                                <span className="font-mono font-bold text-[var(--wv-lagoon-700)] bg-[var(--wv-lagoon-50)] border border-[var(--wv-lagoon-200)] px-1.5 py-0.2 rounded shrink-0">
                                                    {opt.density?.unit === 'cotton_count_ne' ? `${opt.density.value} Ne · ` : ''}{Number(opt.denier.toFixed(2))} D
                                                </span>
                                            )}
                                            <span className="inline-flex items-center px-1.5 py-0.2 rounded bg-[var(--wv-cotton-200)] text-[var(--wv-neel-700)] font-semibold uppercase tracking-wider text-[9px] shrink-0">
                                                {opt.category === 'yarn_warp' ? 'Warp' : opt.category === 'yarn_weft' ? 'Weft' : 'Warp / Weft'}
                                            </span>
                                            <span className="text-[var(--wv-cotton-400)]">·</span>
                                            <span className="text-[var(--wv-cotton-500)] font-medium truncate max-w-[200px]">
                                                {opt.source === 'rate_book' ? 'Rate Book' : opt.qualityNames?.[0] ? opt.qualityNames[0] : 'Saved Quality'}
                                            </span>
                                        </div>
                                    </button>
                                </li>
                            )
                        })}
                    </ul>
                    <div className="bg-[var(--wv-cotton-100)]/90 px-3 py-1.5 border-t border-[var(--wv-cotton-200)] flex items-center justify-between text-[10px] text-[var(--wv-cotton-500)]">
                        <span>Use ↑ ↓ to navigate · Enter to select</span>
                        <span>Esc to close</span>
                    </div>
                </div>
            )}
            {isOpen && filteredOptions.length === 0 && inputValue.trim().length > 0 && (
                <div
                    className="absolute left-0 top-full mt-1.5 z-50 w-[320px] max-w-[calc(100vw-2.5rem)] rounded-[12px] border border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-0)] p-3 shadow-xl ring-1 ring-black/5"
                >
                    <p className="text-xs font-semibold text-[var(--wv-neel-700)]">No matching saved yarn</p>
                    <p className="mt-0.5 text-[11px] text-[var(--wv-cotton-500)]">
                        &quot;{inputValue}&quot; will be used as a custom component name.
                    </p>
                </div>
            )}
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
        <div data-estimator-field="calculationMode" className="space-y-1.5 min-w-[140px]">
            <Label className="flex items-end h-8 text-[11px] uppercase tracking-[0.05em] font-semibold text-[var(--color-muted)] leading-tight">
                Mode
            </Label>
            <LiquidSegmented
                fullWidth
                aria-label="Yarn calculation mode"
                value={value}
                onValueChange={onChange}
                options={[{ value: 'formula', label: 'Formula' }, { value: 'manual', label: 'Manual kg' }]}
            />
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
    unverifiedNotice,
    onConfirmVerification,
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
    unverifiedNotice?: { denier: boolean; rate: boolean; denierVal: number; rateVal: number; yarnName: string }
    onConfirmVerification?: () => void
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
    const isExpanded = expanded

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
            data-enter-scroll-target="true"
            data-testid={`yarn-component-${accent}-${index}`}
            onKeyDown={handleRowKeyDown}
            className={`group ${isExpanded ? 'overflow-visible' : 'overflow-hidden'} rounded-[12px] border transition-colors bg-[var(--color-canvas-white)] shadow-[0_1px_8px_rgba(30,37,40,0.035)] ${
                isComplete ? 'border-[var(--wv-moss-200)]' : 'border-[var(--color-hairline)]'
            }`}
        >
            <div className={`flex min-w-0 items-stretch gap-1 border-b border-[var(--color-hairline)] ${c.strip}`}>
                <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${displayName} details`}
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
                                ? 'border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)] shadow-sm'
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
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wv-moss-700)]">
                                    <Check className="h-2.5 w-2.5 stroke-[2.5]" /> Done
                                </span>
                            )}
                            {unverifiedNotice && (unverifiedNotice.denier || unverifiedNotice.rate) && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-2 py-0.5 text-[10px] font-semibold text-[var(--wv-ochre-800)]">
                                    Verify Denier & Rate
                                </span>
                            )}
                        </span>
                        <span className="mt-0.5 block break-words text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                            {title} · {showCalculatedValues ? `Base weight ${kgPer100m.toFixed(3)} kg/100m` : (isComplete ? 'Complete' : 'Complete inputs')}
                            {ratePerKg != null && ratePerKg > 0 ? ` · ₹${ratePerKg.toFixed(2)}/kg` : ''}
                        </span>
                    </span>
                    <span data-estimator-row-cost className="flex min-w-[4.25rem] shrink-0 flex-col items-end gap-1 text-right">
                        <span className={`break-words font-mono text-[12px] font-semibold tabular-nums ${showCalculatedValues ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}>
                            {showCalculatedValues ? `Base cost ₹${costPerM.toFixed(2)}/m` : '—'}
                        </span>
                        {adjustmentPct != null && showCalculatedValues && (
                            <span className={`max-w-full break-words rounded-[6px] border px-1.5 py-0.5 text-[9px] font-semibold leading-3 ${c.badge}`}>
                                Applied later {adjustmentPct.toFixed(1)}%
                            </span>
                        )}
                    </span>
                    <ChevronDown className={`h-4 w-4 shrink-0 text-[var(--color-muted)] transition-transform duration-200 motion-reduce:transition-none ${isExpanded ? 'rotate-180' : ''}`} aria-hidden="true" />
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
            {isExpanded && (
                <div id={detailsId} className="border-t border-[var(--color-hairline)]/70 bg-white">
                    {adjustmentDetail && showCalculatedValues && (
                        <p className="border-b border-[var(--color-hairline)]/70 px-4 py-2 text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                            Manual workflow: calculate this base weight and cost first. {adjustmentDetail}
                        </p>
                    )}
                    {unverifiedNotice && (unverifiedNotice.denier || unverifiedNotice.rate) && (
                        <div
                            data-testid="yarn-auto-propagate-verification-banner"
                            className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[9px] border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-2.5 text-xs text-[var(--wv-ochre-900)] shadow-xs transition-all"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--wv-ochre-200)] text-[var(--wv-ochre-800)] font-bold text-xs">
                                    !
                                </span>
                                <div className="text-[11px] leading-tight">
                                    <span className="font-semibold text-[var(--wv-ochre-800)]">Auto-filled from Rate Book:</span>{' '}
                                    <span>
                                        {unverifiedNotice.denier && unverifiedNotice.rate
                                            ? `Denier (${unverifiedNotice.denierVal} D) & Yarn Rate (₹${unverifiedNotice.rateVal}/kg)`
                                            : unverifiedNotice.denier
                                            ? `Denier (${unverifiedNotice.denierVal} D)`
                                            : `Yarn Rate (₹${unverifiedNotice.rateVal}/kg)`}
                                        . Please verify these parameters.
                                    </span>
                                </div>
                            </div>
                            {onConfirmVerification && (
                                <button
                                    type="button"
                                    onClick={onConfirmVerification}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-[6px] bg-[var(--wv-action-primary)] px-2.5 py-1 text-[11px] font-semibold text-white shadow-xs hover:bg-[var(--wv-action-primary-hover)] active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wv-brand-accent-strong)]"
                                >
                                    <Check className="h-3 w-3 stroke-[2.5]" />
                                    Confirm Values
                                </button>
                            )}
                        </div>
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
        ? formatEstimatorPlaceholder(calculatedRatePerM.toFixed(2))
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
                <div data-estimator-field="weavingRateMode" className="flex min-w-0 flex-wrap items-center gap-2" role="group" aria-label="Weaving rate input mode">
                    <span className="text-[10px] font-medium text-[var(--color-muted)]">Enter as</span>
                    <LiquidSegmented
                        size="sm"
                        aria-label="Weaving rate input mode"
                        className="max-w-full"
                        optionClassName="whitespace-normal"
                        value={inputMode}
                        onValueChange={handleInputModeChange}
                        options={[{ value: 'perMeter', label: 'Weaving rate (₹/m)' }, { value: 'perPick', label: 'Paisa per pick' }]}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <Label htmlFor={rateInputId} className="flex h-8 items-end text-[10px] font-medium uppercase tracking-wider text-[var(--color-warning-amber)]">
                        {inputMode === 'perMeter' ? 'Weaving rate — REQUIRED' : 'Paisa per pick — REQUIRED'}
                    </Label>
                    <div className="relative" data-estimator-unit-field={inputMode === 'perMeter' ? '₹/m' : 'paise/pick'} style={{ '--estimator-unit-length': inputMode === 'perMeter' ? 3 : 10 } as React.CSSProperties}>
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
                            className={`h-11 rounded-[9px] border px-16 text-center text-xs font-semibold placeholder:text-[var(--color-placeholder)] placeholder:font-normal shadow-[0_1px_2px_rgba(30,37,40,0.035)] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${isRateEmpty ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)] text-[var(--color-yarn-orange)]'}`}
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
                <div className="flex items-start gap-2.5 rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-3 text-xs text-[var(--wv-ochre-800)] shadow-sm">
                    <span className="shrink-0 text-sm">⚠️</span>
                    <div>
                        <p className="font-bold">Unusually High Weave Cost ({formatCalculatedMoney(totals.weaveCostPerM, hasValidCostResult, '/m')})</p>
                        <p className="mt-0.5 font-medium text-[var(--wv-ochre-800)]">Check that the weaving rate and unit are correct.</p>
                    </div>
                </div>
            )}
        </div>
    )
}

function QuickCostingView({
    constructionFields,
    state,
    dispatch,
    totals,
    costingResult,
    hasValidCostResult,
    qualityLabel,
    setQualityLabel,
    qualityLocked,
    widthUnit,
    onWidthUnitChange,
    onOpenOverheadDetails,
    onOverheadModeChange,
    weavingRateInputMode,
    onWeavingRateInputModeChange,
    directWeavingRateInput,
    onDirectWeavingRateInputChange,
    savedYarnOptions,
    unverifiedYarnRows,
    onConfirmYarnVerification,
    onYarnFieldManualEdit,
    onSelectWarpYarn,
    onSelectWeftYarn,
}: {
    constructionFields: React.ReactNode
    state: EstimateState
    dispatch: React.Dispatch<Action>
    totals: EstimatorV3Totals
    costingResult: CostingResultSnapshot
    hasValidCostResult: boolean
    qualityLabel: string
    setQualityLabel: (value: string) => void
    qualityLocked: boolean
    widthUnit: 'cm' | 'inch'
    onWidthUnitChange: (value: 'cm' | 'inch') => void
    onOpenOverheadDetails: () => void
    onOverheadModeChange: (mode: OverheadMode) => void
    weavingRateInputMode: WeavingRateInputMode
    onWeavingRateInputModeChange: (mode: WeavingRateInputMode) => void
    directWeavingRateInput: string
    onDirectWeavingRateInputChange: (value: string) => void
    savedYarnOptions?: SavedYarnOption[]
    unverifiedYarnRows?: Record<string, { yarnName: string; denier: boolean; rate: boolean; autoFilledDenier: number; autoFilledRate: number }>
    onConfirmYarnVerification?: (rowId: string) => void
    onYarnFieldManualEdit?: (rowId: string, field: 'calcDenier' | 'yarnRate') => void
    onSelectWarpYarn?: (rowId: string, yarn: SavedYarnOption) => void
    onSelectWeftYarn?: (rowId: string, yarn: SavedYarnOption) => void
}) {
    const { t } = useTranslation()
    const directRateMissing = state.overheadMode === 'direct' && (!state.overheadOverridePerM || state.overheadOverridePerM <= 0)
    // Overhead can be valid before the rest of the costing is complete. Do not
    // hide this active rate behind unrelated construction-field validation.
    const overheadReady = state.overheadMode === 'direct'
        ? !directRateMissing
        : state.monthlyOutputM > 0 && totals.overheadTotalMonthly > 0
    const activeOverheadPerM = state.overheadMode === 'direct'
        ? state.overheadOverridePerM ?? 0
        : costingResult.overheadPerM

    return (
        <div
            className="space-y-3"
            data-enter-navigate-container="true"
            onKeyDown={handleEnterKeyNavigation}
        >
            <EstimatorCard accent="neutral" data-tour-anchor="estimator.quick-basics">
                <SectionHeader title="Quality basics" icon={Layers} accent="neutral" step={1} tutorialSection={2} />
                <CardContent className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
                    <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase text-[var(--wv-neel-500)]">Fabric quality name — REQUIRED</Label>
                        <Input
                            data-estimator-field="qualityLabel"
                            aria-label="Fabric quality name"
                            value={qualityLabel}
                            readOnly={qualityLocked}
                            onChange={event => setQualityLabel(event.target.value)}
                            placeholder="e.g. 60g Georgette, D.246, Japan Satin"
                            className="h-11 border-[var(--wv-cotton-400)] font-bold"
                        />
                        <p className="text-[10px] font-medium leading-normal text-[var(--wv-cotton-500)]">Use the name your staff and repeat customers will recognise.</p>
                    </div>
                    <div className="sm:col-span-2">{constructionFields}</div>
                    <NumField fieldKey="warpCrimpPct"
                        label="Warp crimp (take-up)"
                        value={state.warpCrimpPct}
                        onChange={value => dispatch({ type: 'SET', field: 'warpCrimpPct', value: value ?? 0 })}
                        unit="%"
                        step={0.5}
                        preserveZero
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
                        placeholderKind="applied-default"
                        hint="Used when a yarn row has no row-specific waste."
                    />
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="warp" data-tour-anchor="estimator.quick-warp">
                <SectionHeader
                    title="Warp yarn"
                    icon={Sparkles}
                    accent="warp"
                    step={2}
                    tutorialSection={3}
                    detail={<p className="text-[11px] text-[var(--color-muted)]">{state.warpRows.length} component{state.warpRows.length === 1 ? '' : 's'} · crimp {state.warpCrimpPct || 0}% + waste {state.yarnShortagePct || 0}%</p>}
                    badgeContent={<SectionCostPill value={totals.yarnBaseWarpPerM} valid={hasValidCostResult} />}
                />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    {state.warpRows.map((row, index) => {
                        const unverified = unverifiedYarnRows?.[row.id]
                        return (
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
                            unverifiedNotice={unverified ? {
                                denier: unverified.denier,
                                rate: unverified.rate,
                                denierVal: unverified.autoFilledDenier,
                                rateVal: unverified.autoFilledRate,
                                yarnName: unverified.yarnName,
                            } : undefined}
                            onConfirmVerification={() => onConfirmYarnVerification?.(row.id)}
                        >
                            <CalculationModeField
                                value={row.calculationMode === 'manual' ? 'manual' : 'formula'}
                                onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'calculationMode', value })}
                            />
                            <LayerNameField
                                label="Yarn component name"
                                value={row.label ?? ''}
                                placeholder={`Warp ${index + 1}`}
                                ghostValue={`Warp ${index + 1}`}
                                suggestions={savedYarnOptions}
                                preferredCategory="yarn_warp"
                                onSelectYarn={yarn => onSelectWarpYarn?.(row.id, yarn)}
                                onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'label', value })}
                            />
                            {row.calculationMode === 'manual' ? (
                                <NumField fieldKey="manualKgPer100m" label="Warp consumption" value={row.manualKgPer100m ?? null} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'manualKgPer100m', value })} unit="kg/100m" step={0.001} placeholder="e.g. 3.25" attentionWhenEmpty />
                            ) : (
                                <>
                                    <YarnDensityFields
                                        row={row}
                                        needsVerification={unverified?.denier}
                                        onChange={(field, value) => {
                                            if (field === 'calcDenier') {
                                                onYarnFieldManualEdit?.(row.id, 'calcDenier')
                                            }
                                            dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value })
                                        }}
                                    />
                                    <NumField fieldKey="beamEnds" label="Beam ends — REQUIRED" value={row.beamEnds} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: value ?? 0 })} placeholder="e.g. 3200" attentionWhenEmpty />
                                </>
                            )}
                            <NumField fieldKey="shortagePct" label="Waste" value={row.shortagePct} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} placeholderKind="applied-default" hint={`Blank uses ${state.yarnShortagePct ?? 0}% default; 0 overrides`} />
                            <NumField
                                fieldKey="yarnRate"
                                label={`${t('common.current_yarn_rate')} — REQUIRED`}
                                value={row.yarnRate}
                                needsVerification={unverified?.rate}
                                onChange={value => {
                                    onYarnFieldManualEdit?.(row.id, 'yarnRate')
                                    dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: value ?? 0 })
                                }}
                                unit="₹/kg"
                                step={1}
                                placeholder="e.g. 110"
                                attentionWhenEmpty
                            />
                            <NumField fieldKey="gstPct" label="GST" value={row.gstPct} onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: value ?? 0 })} unit="%" step={0.5} placeholder="e.g. 5" />
                        </RowCard>
                    )})}
                    <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-[10px] border-dashed border-[#C6D9EA] bg-[#F7FBFD] text-[var(--color-info-blue)]" onClick={() => dispatch({ type: 'ADD_WARP_ROW' })}>
                        <Plus className="h-4 w-4" /> Add warp yarn component
                    </Button>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="weft" data-tour-anchor="estimator.quick-weft">
                <SectionHeader
                    title="Weft yarn"
                    icon={Scissors}
                    accent="weft"
                    step={3}
                    tutorialSection={4}
                    badgeContent={
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5">
                                <button
                                    type="button"
                                    onClick={() => onWidthUnitChange('cm')}
                                    aria-pressed={widthUnit === 'cm'}
                                    className={`mobile-touch-target px-2 py-1 text-[10px] font-semibold uppercase ${widthUnit === 'cm' ? 'rounded bg-white text-[var(--color-factory-green)] shadow-sm' : 'text-[var(--color-muted)]'}`}
                                >
                                    cm
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onWidthUnitChange('inch')}
                                    aria-pressed={widthUnit === 'inch'}
                                    className={`mobile-touch-target px-2 py-1 text-[10px] font-semibold uppercase ${widthUnit === 'inch' ? 'rounded bg-white text-[var(--color-factory-green)] shadow-sm' : 'text-[var(--color-muted)]'}`}
                                >
                                    inch
                                </button>
                            </div>
                            <SectionCostPill value={totals.yarnBaseWeftPerM} valid={hasValidCostResult} />
                        </div>
                    }
                />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    {state.weftRows.map((row, index) => {
                        const effectiveCostingWidthCm = getEffectiveCostingWidthCm(row)
                        const unverified = unverifiedYarnRows?.[row.id]
                        return (
                            <RowCard
                                key={row.id}
                                title="Weft yarn"
                                index={index}
                                componentName={row.label}
                                ratePerKg={row.yarnRate}
                                accent="emerald"
                                canRemove={state.weftRows.length > 1}
                                onRemove={() => dispatch({ type: 'REMOVE_WEFT_ROW', id: row.id })}
                                kgPer100m={totals.weftRows[index]?.baseKgPer100mUsed ?? 0}
                                costPer100m={totals.weftRows[index]?.baseCostPer100m ?? 0}
                                adjustmentPct={totals.weftRows[index]?.totalAdjustmentPct ?? 0}
                                adjustmentDetail={formatWasteProvenance(row.shortagePct, totals.weftRows[index]?.defaultWastePct ?? state.yarnShortagePct, totals.weftRows[index]?.wastePct ?? state.yarnShortagePct, totals.weftRows[index]?.totalAdjustmentPct ?? 0)}
                                showCalculatedValues={hasValidCostResult}
                                isComplete={isWeftRowFilled(row)}
                                unverifiedNotice={unverified ? {
                                    denier: unverified.denier,
                                    rate: unverified.rate,
                                    denierVal: unverified.autoFilledDenier,
                                    rateVal: unverified.autoFilledRate,
                                    yarnName: unverified.yarnName,
                                } : undefined}
                                onConfirmVerification={() => onConfirmYarnVerification?.(row.id)}
                            >
                                <CalculationModeField value={row.calculationMode === 'manual' ? 'manual' : 'formula'} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'calculationMode', value })} />
                                <LayerNameField
                                    label="Yarn component name"
                                    value={row.label ?? ''}
                                    placeholder={`Weft ${index + 1}`}
                                    ghostValue={`Weft ${index + 1}`}
                                    suggestions={savedYarnOptions}
                                    preferredCategory="yarn_weft"
                                    onSelectYarn={yarn => onSelectWeftYarn?.(row.id, yarn)}
                                    onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'label', value })}
                                />
                                <NumField fieldKey="picks" label="Picks — REQUIRED" value={row.picks} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'picks', value: value ?? 0 })} unit="PPI" placeholder="e.g. 68" hint="PPI means picks per inch: weft threads in one inch." attentionWhenEmpty />
                                <WidthField label={`Effective costing width (finished width)${row.calculationMode === 'manual' ? '' : ' — REQUIRED'}`} value={effectiveCostingWidthCm} onChange={value => { dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'effectiveCostingWidthCm', value }); dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'reedSpace', value }) }} unit={widthUnit} placeholder={widthUnit === 'inch' ? 'e.g. 63' : 'e.g. 160'} hint={row.calculationMode === 'manual' ? 'Finished cloth width; saved for audit.' : 'Finished cloth width, not reed width; used with PPI.'} attentionWhenEmpty={row.calculationMode !== 'manual'} />
                                {row.calculationMode === 'manual' ? (
                                    <NumField fieldKey="manualKgPer100m" label="Weft consumption" value={row.manualKgPer100m ?? null} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'manualKgPer100m', value })} unit="kg/100m" step={0.001} placeholder="e.g. 2.75" attentionWhenEmpty />
                                ) : (
                                    <YarnDensityFields
                                        row={row}
                                        needsVerification={unverified?.denier}
                                        onChange={(field, value) => {
                                            if (field === 'calcDenier') {
                                                onYarnFieldManualEdit?.(row.id, 'calcDenier')
                                            }
                                            dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value })
                                        }}
                                    />
                                )}
                                <NumField fieldKey="shortagePct" label="Waste" value={row.shortagePct} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} placeholderKind="applied-default" hint={`Blank uses ${state.yarnShortagePct ?? 0}% default; 0 overrides`} />
                                <NumField
                                    fieldKey="yarnRate"
                                    label={`${t('common.current_yarn_rate')} — REQUIRED`}
                                    value={row.yarnRate}
                                    needsVerification={unverified?.rate}
                                    onChange={value => {
                                        onYarnFieldManualEdit?.(row.id, 'yarnRate')
                                        dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: value ?? 0 })
                                    }}
                                    unit="₹/kg"
                                    step={1}
                                    placeholder="e.g. 110"
                                    attentionWhenEmpty
                                />
                                <NumField fieldKey="gstPct" label="GST" value={row.gstPct} onChange={value => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'gstPct', value: value ?? 0 })} unit="%" step={0.5} placeholder="e.g. 5" />
                            </RowCard>
                        )
                    })}
                    <Button type="button" variant="outline" className="h-11 w-full gap-2 rounded-[10px] border-dashed border-[#CDE5D3] bg-[#F7FCF8] text-[var(--color-factory-green)]" onClick={() => dispatch({ type: 'ADD_WEFT_ROW' })}>
                        <Plus className="h-4 w-4" /> Add weft yarn component
                    </Button>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="weave" data-tour-anchor="estimator.quick-weaving">
                <SectionHeader title="Weaving cost" icon={Gauge} accent="weave" step={4} tutorialSection={5} badgeContent={<SectionCostPill value={totals.weaveCostPerM} valid={hasValidCostResult} />} />
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

            <EstimatorCard accent="post" data-tour-anchor="estimator.quick-warping">
                <SectionHeader title="Warping and sizing" icon={TrendingUp} accent="post" step={5} tutorialSection={6} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} valid={hasValidCostResult} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {/* Warping Group */}
                        <div className="space-y-3">
                            <div data-estimator-field="warpingMode" className="space-y-1.5 min-w-0">
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
                                <LiquidSegmented aria-label="Warping method" fullWidth value={state.warpingMode} onValueChange={value => dispatch({ type: 'SET', field: 'warpingMode', value })} options={[{ value: 'in_house', label: 'In-house' }, { value: 'outsourced', label: 'Outsourced' }]} />
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
                            <div data-estimator-field="sizingMode" className="space-y-1.5 min-w-0">
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
                                <LiquidSegmented aria-label="Sizing method" fullWidth value={state.sizingMode} onValueChange={value => dispatch({ type: 'SET', field: 'sizingMode', value })} options={[{ value: 'in_house', label: 'In-house' }, { value: 'outsourced', label: 'Outsourced' }]} />
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

            <EstimatorCard accent="overhead" data-tour-anchor="estimator.quick-overhead">
                <SectionHeader title="Factory overhead" icon={Calculator} accent="overhead" step={6} tutorialSection={7} badgeContent={<SectionCostPill value={activeOverheadPerM} valid={overheadReady} />} />
                <CardContent className="space-y-4 p-4 sm:p-5">
                    <div className="space-y-2">
                        <LiquidSegmented
                            fullWidth
                            aria-label="Factory overhead method"
                            optionClassName="whitespace-normal py-2 text-center"
                            value={state.overheadMode}
                            onValueChange={onOverheadModeChange}
                            options={[
                                { value: 'direct', label: 'Direct overhead rate', attrs: { 'data-estimator-field': 'directOverheadMethod' } },
                                { value: 'monthly_expenses', label: 'Monthly expenses ÷ output', attrs: { 'data-estimator-field': 'monthlyOverheadMethod' } },
                            ]}
                        />
                        <p className="text-[11px] leading-relaxed text-[var(--color-muted)]" aria-live="polite">
                            {state.overheadMode === 'direct' ? 'Enter the rate used in this costing; it is never inferred.' : 'Use saved monthly expenses ÷ standard production.'}
                        </p>
                    </div>
                    {state.overheadMode === 'direct' ? (
                        <NumField fieldKey="overheadOverridePerM" label="Direct factory overhead — REQUIRED" value={state.overheadOverridePerM} onChange={value => dispatch({ type: 'SET', field: 'overheadOverridePerM', value })} unit="₹/m" step={0.1} placeholder="e.g. 12.50" attentionWhenEmpty />
                    ) : (
                        <Button data-estimator-field="monthlyOverhead" type="button" variant="outline" className="h-11 w-full justify-between gap-2" onClick={onOpenOverheadDetails}>
                            <span className="flex items-center gap-1.5"><Calculator className="h-3.5 w-3.5" /> Edit monthly overhead details</span>
                            {state.monthlyOutputM > 0 && <span className="font-mono text-[10px] font-normal text-[var(--color-muted)]">{state.monthlyOutputM.toLocaleString('en-IN')} m/mo</span>}
                        </Button>
                    )}
                    {directRateMissing && <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Enter a direct rate greater than ₹0/m before saving.</p>}
                    <div className="flex items-center justify-between rounded-[10px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                        <div>
                            <p className="text-[11px] font-medium text-[var(--color-muted)]">Used in this costing</p>
                            {overheadReady && <p className="mt-0.5 text-[10px] text-[var(--color-muted)]">Included in the production cost as the active factory-overhead rate.</p>}
                        </div>
                        <span className={`font-mono text-base font-semibold ${overheadReady ? 'text-[var(--color-factory-green)]' : 'text-[var(--color-warning-amber)]'}`}>{formatCalculatedMoney(activeOverheadPerM, overheadReady, '/m')}</span>
                    </div>
                    <div className="rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-2 text-[10px] text-[var(--color-muted)]">
                        <span className="font-semibold text-[var(--color-body)]">Source:</span> {assumptionSourceLabel(state.overheadMode === 'direct' ? 'direct_rate' : 'monthly_expenses')}
                        {' · '}
                        <span className="font-semibold text-[var(--color-body)]">Reference:</span> {costingResult.overheadReferencePerM == null ? 'not entered' : `₹${costingResult.overheadReferencePerM.toFixed(2)}/m`}
                        {' · '}
                        <span className="font-semibold text-[var(--color-body)]">Impact:</span> {formatSignedRupees(costingResult.overheadPriceImpactPerM)}/m cost
                    </div>
                </CardContent>
            </EstimatorCard>

            <EstimatorCard accent="neutral" data-tour-anchor="estimator.quick-pricing">
                <SectionHeader
                    title={t("estimator.simulation.base_title")}
                    detail={<p className="text-[11px] text-[var(--color-muted)] font-normal">{t("estimator.simulation.base_description")}</p>}
                    icon={Coins}
                    accent="neutral"
                    step={7}
                    tutorialSection={8}
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

const FREE_CHANGE_LABELS: Record<ReturnType<typeof summarizeCostingInputChanges>[number], FreeText> = {
    rate: 'changeRate', waste: 'changeWaste', width: 'changeWidth', margin: 'changeMargin', commission: 'changeCommission',
    transport: 'changeTransport', quantity: 'changeQuantity', overhead: 'changeOverhead', construction: 'changeConstruction',
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
    initialFreeCosting,
    initialTemplates,
    initialWorkers,
    userId,
    orgId,
    canUseProductionPipeline,
    staleDefaultRateNames,
    organizationName,
    tutorialDismissed,
    userMetadata,
    wizardDismissed = false,
    freeMode = false,
    mobileTier,
    onFreeUpgrade,
    disableAutosave = false,
}: {
    initialFreeCosting?: SavedFreeCosting
    freeMode?: boolean
    /** Presentation only; server capabilities still authorize every operation. */
    mobileTier?: import('@/lib/subscription-access').SubscriptionTier
    onFreeUpgrade?: (tier: import('@/lib/subscription-access').SubscriptionTier) => void
    disableAutosave?: boolean
    tutorialDismissed: boolean
    userMetadata?: Record<string, unknown> | null
    wizardDismissed?: boolean
    initialProfile?: FactoryCostProfile
    initialTemplates?: EstimatorTemplate[]
    initialWorkers?: FixedWorkerOverhead[]
    userId: string
    orgId: string
    canUseProductionPipeline: boolean
    staleDefaultRateNames: string[]
    organizationName: string
}) {
    const { t, tx, language } = useTranslation()
    const searchParams = useSearchParams()
    const router = useRouter()
    const productionReturnTo = safeBaseReturnPath(searchParams.get('returnTo'))
    const liteMode = !freeMode && mobileTier === 'lite'
    const compactMobile = freeMode || liteMode
    const helpId = freeMode ? 'free-estimator-help' : 'lite-estimator-help'

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
        if (freeMode) return {...(initialFreeCosting?.estimate ?? makeFreeEstimate()), isConfigured:true}
        const effectiveProfile = initialProfile ? {
            ...initialProfile,
            is_configured: Boolean(initialProfile.is_configured || wizardDismissed),
        } : (wizardDismissed ? ({ is_configured: true } as unknown as FactoryCostProfile) : undefined)
        return buildEstimatorBaseline(effectiveProfile, initialWorkers ?? [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []) // Run once — initialProfile is stable

    const [state, rawDispatch] = useReducer(estimateReducer, initialState)
    const currentProfileRef = useRef<FactoryCostProfile | null | undefined>(initialProfile)
    const [loading,   setLoading]   = useState(false)
    const [saving,    setSaving]    = useState(false)
    const [savingQuote, setSavingQuote] = useState(false)
    const saveQuoteLockRef = useRef(false)
    const [savingTemplate, setSavingTemplate] = useState(false)
    const [templates, setTemplates] = useState<EstimatorTemplate[]>(initialTemplates ?? [])
    const [templatesLoaded, setTemplatesLoaded] = useState(initialTemplates !== undefined)
    const [secondaryError, setSecondaryError] = useState<string | null>(null)
    const secondaryDataRequestRef = useRef<ReturnType<typeof getEstimatorSecondaryData> | null>(null)

    // The direct ₹/m entry is the default; the per-pick mode remains available
    // for factories that already keep their rate book in paise per pick.
    const [weavingRateInputMode, setWeavingRateInputMode] = useState<WeavingRateInputMode>('perMeter')
    const [directWeavingRateInput, setDirectWeavingRateInput] = useState<string>(initialFreeCosting ? getDirectWeavingRateInput(initialFreeCosting.estimate.perPickCostPaisa, initialFreeCosting.estimate.weftRows) : '')

    const [partyName,       setPartyName]       = useState('')
    const [staleRateNames,  setStaleRateNames]  = useState(staleDefaultRateNames)
    const [rateBookYarns,   setRateBookYarns]   = useState<RateBookYarnRecord[]>([])
    const [unverifiedYarnRows, setUnverifiedYarnRows] = useState<Record<string, {
        denier: boolean
        rate: boolean
        autoFilledDenier: number
        autoFilledRate: number
        yarnName: string
    }>>({})

    const savedYarnOptions = useMemo(() => {
        return buildSavedYarnOptions(rateBookYarns, templates)
    }, [rateBookYarns, templates])

    const handleConfirmYarnVerification = useCallback((rowId: string) => {
        setUnverifiedYarnRows(prev => {
            if (!prev[rowId]) return prev
            const next = { ...prev }
            delete next[rowId]
            return next
        })
    }, [])

    const handleYarnFieldManualEdit = useCallback((rowId: string, field: 'calcDenier' | 'yarnRate') => {
        setUnverifiedYarnRows(prev => {
            const existing = prev[rowId]
            if (!existing) return prev
            const isDenier = field === 'calcDenier'
            const remainingDenier = isDenier ? false : existing.denier
            const remainingRate = isDenier ? existing.rate : false
            if (!remainingDenier && !remainingRate) {
                const next = { ...prev }
                delete next[rowId]
                return next
            }
            return {
                ...prev,
                [rowId]: {
                    ...existing,
                    denier: remainingDenier,
                    rate: remainingRate,
                }
            }
        })
    }, [])

    const [qualityLabel,    setQualityLabel]    = useState(initialFreeCosting?.label ?? '')
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
            workspace: 'standalone_costing',
        })
    }, [])

    useEffect(() => {
        if (freeMode) return
        return initWebVitals({
            route: '/owner/estimator',
            language: (language === 'hi' || language === 'gu') ? language : 'en',
        })
    }, [language, freeMode])
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
    const freeMeter = useFreeMeter(freeMode, state, qualityLabel, onFreeUpgrade, initialFreeCosting)
    const { isDocked: isFreeUsageDocked, dockStyle: freeUsageDockStyle, containerRef: estimatorGutterRef } = useGutterDock({
        sidebarWidth: 248,
        cardWidth: 248,
        minClearance: 16,
    })
    const freeCanCalculate = !!freeMeter.status?.estimationEnabled && (freeMeter.completed ? freeMeter.editRemainingMs > 0 : freeMeter.status.quota.remaining > 0) && !freeMeter.busy && (!freeMeter.completed || freeMeter.stale)
    const [lastSavedCosting, setLastSavedCosting] = useState<{ id: string; version: number; savedAt: string; model: ReturnType<typeof createCostingExportModel> } | null>(null)

    function openProductionFromCosting(costingId: string) {
        const params = new URLSearchParams({ tab: 'jobs', costingId })
        if (productionReturnTo) params.set('returnTo', productionReturnTo)
        void trackPlanEvent('production_cta_clicked', { source: 'estimator_save_confirmation' })
        router.push(`/owner/production?${params}`)
    }
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
        status: 'draft' | 'accepted'
    } | null>(null)
    const [pendingQualityVersionSave, setPendingQualityVersionSave] = useState<{
        status: 'draft' | 'accepted'
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
    // LT03: a rate update whose answer was lost stays unresolved until it is
    // reconciled against the saved quality. Page memory only.
    const [rateUpdateUnknown, setRateUpdateUnknown] = useState<{
        templateId: string
        templateName: string
        expectedUpdatedAt: string
        proposedWarp: WarpRow[]
        proposedWeft: WeftRow[]
    } | null>(null)
    const [rateUpdateCheck, setRateUpdateCheck] = useState<null | 'checking' | 'check_failed' | 'conflict' | 'missing'>(null)
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
    const qualityPickerTriggerRef = useRef<HTMLButtonElement>(null)

    const [showAdvancedOverhead, setShowAdvancedOverhead] = useState(false)
    const [entryMode, setEntryMode] = useState<'quick' | 'detailed'>('quick')
    const [isTutorialActive, setIsTutorialActive] = useState(false)
    const [liveEstimateOpen, setLiveEstimateOpen] = useState(false)
    const [assumptionsExpanded, setAssumptionsExpanded] = useState(false)
    const [showCostingSaveGuidance, setShowCostingSaveGuidance] = useState(true)
    const assumptionsManuallyToggledRef = useRef(false)
    const tutorialViewRef = useRef({ entryMode, showAdvancedOverhead, liveEstimateOpen, showQualityLibrary, assumptionsExpanded })
    const tutorialPreparingRef = useRef(false)
    const skipRestoredAssumptionsEffect = useRef(false)
    useEffect(() => {
        tutorialViewRef.current = { entryMode, showAdvancedOverhead, liveEstimateOpen, showQualityLibrary, assumptionsExpanded }
    }, [entryMode, showAdvancedOverhead, liveEstimateOpen, showQualityLibrary, assumptionsExpanded])
    const prepareTutorial = useCallback(() => {
        const previous = { ...tutorialViewRef.current }
        tutorialPreparingRef.current = true
        setEntryMode('quick')
        setShowAdvancedOverhead(false)
        setShowQualityLibrary(false)
        setLiveEstimateOpen(false)
        return () => {
            tutorialPreparingRef.current = false
            skipRestoredAssumptionsEffect.current = previous.entryMode !== 'quick'
            setEntryMode(previous.entryMode)
            setShowAdvancedOverhead(previous.showAdvancedOverhead)
            setLiveEstimateOpen(previous.liveEstimateOpen)
            setShowQualityLibrary(previous.showQualityLibrary)
            setAssumptionsExpanded(previous.assumptionsExpanded)
        }
    }, [])
    const [mobileCostingShortcutVisible] = useState(true)
    const mobileKeyboardVisible = useMobileKeyboard()

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
        if (tutorialPreparingRef.current) return
        if (skipRestoredAssumptionsEffect.current) {
            skipRestoredAssumptionsEffect.current = false
            return
        }
        if (assumptionsManuallyToggledRef.current) return
        const isDesktop = window.matchMedia('(min-width: 768px)').matches
        setAssumptionsExpanded(entryMode === 'detailed' && isDesktop)
    }, [entryMode])

    const toggleAssumptions = useCallback(() => {
        assumptionsManuallyToggledRef.current = true
        setAssumptionsExpanded(current => !current)
    }, [])


    // Autosave — scoped per user (orgId-userId) so multi-user on same device is safe
    const validateEstimatorDraftState = useCallback((candidate: unknown): candidate is EstimateState => {
        if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false
        const value = candidate as Partial<EstimateState>
        return Array.isArray(value.warpRows)
            && Array.isArray(value.weftRows)
            && Boolean(value.enabledSections && typeof value.enabledSections === 'object')
    }, [])

    const shouldPersistEstimatorDraft = useCallback((data: EstimatorDraftInput<EstimateState>) => {
        return Boolean(
            data.sourceQuoteId
            || data.qualityLabel.trim()
            || data.partyName.trim()
            || data.warpInstruction.trim()
            || data.weftInstruction.trim()
            // The hook separately requires an explicit user edit before its
            // background autosave runs. Comparing the complete estimator state
            // here ensures less-common inputs (overhead, widths, toggles, loom
            // settings, etc.) are not lost merely because no yarn row or
            // quantity has been entered yet.
            || JSON.stringify(data.state) !== JSON.stringify(initialState),
        )
    }, [initialState])

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
        draftSaveStatus,
        draftConflict,
        acknowledgeDraftConflict,
    } = useAutosave<EstimateState>({
        enabled: !freeMode && !disableAutosave,
        orgId,
        userId,
        debounceMs: 2000,
        shouldPersist: shouldPersistEstimatorDraft,
        validateState: validateEstimatorDraftState,
    })

    // Reducer updates from visible controls are user edits. Keeping this
    // boundary explicit means Reset, Restore, and successful Save can update
    // several fields without those programmatic changes recreating a stale
    // local draft.
    const dispatch = useCallback((action: Action) => {
        if (freeMode && freeMeter.pending) return
        if (action.type === 'APPLY_TEMPLATE') startJourney('saved_quality')
        markUserEdit()
        setHasUnsavedEdits(true)
        setLastSavedCosting(null)
        rawDispatch(action)
    }, [freeMode, freeMeter.pending, markUserEdit, startJourney])
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

    const handleSelectWarpYarn = useCallback((rowId: string, yarn: SavedYarnOption) => {
        dispatch({
            type: 'SELECT_WARP_YARN',
            id: rowId,
            yarn: { name: yarn.name, density: yarn.density ?? null, yarnRate: yarn.yarnRate },
        })
        setUnverifiedYarnRows(prev => ({
            ...prev,
            [rowId]: {
                denier: (yarn.denier ?? 0) > 0,
                rate: yarn.yarnRate > 0,
                autoFilledDenier: yarn.denier ?? 0,
                autoFilledRate: yarn.yarnRate,
                yarnName: yarn.name,
            },
        }))
    }, [dispatch])

    const handleSelectWeftYarn = useCallback((rowId: string, yarn: SavedYarnOption) => {
        dispatch({
            type: 'SELECT_WEFT_YARN',
            id: rowId,
            yarn: { name: yarn.name, density: yarn.density ?? null, yarnRate: yarn.yarnRate },
        })
        setUnverifiedYarnRows(prev => ({
            ...prev,
            [rowId]: {
                denier: (yarn.denier ?? 0) > 0,
                rate: yarn.yarnRate > 0,
                autoFilledDenier: yarn.denier ?? 0,
                autoFilledRate: yarn.yarnRate,
                yarnName: yarn.name,
            },
        }))
    }, [dispatch])

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

    usePwaInstallBlocker(Boolean(saving || savingQuote || savingTemplate || savingRates || checkingSave || freeMeter.pending || freeMeter.busy || draftConflict || (freeMode ? freeMeter.stale : hasUnsavedEdits)))
    usePwaRefreshGuard(() => {
        if (saving || savingQuote || savingTemplate || savingRates || checkingSave || saveQuoteLockRef.current || freeMeter.pending) return false
        if (draftConflict) return false
        if (!hasUnsavedEdits && draftSaveStatus !== 'pending' && draftSaveStatus !== 'error') return true
        // Free sessions cannot recover a paid-plan draft. Pending restore/conflict
        // decisions must never be overwritten merely to install an update.
        if (freeMode || disableAutosave) return false
        return isDraftStored(saveDraftNow(buildCurrentDraft()))
    })
    // Free, and the paid estimator it becomes in place, keep work only in page
    // memory: an unconfirmed or still-tracked request, or anything the owner
    // typed (inputs, names, notes) that differs from the last confirmed save.
    const freePage = useMemo(
        () => freePageSnapshot({ state, qualityLabel, warpInstruction, weftInstruction }),
        [state, qualityLabel, warpInstruction, weftInstruction],
    )
    const freeLeaveReason: FreeLeaveReason = decideFreeLeaveReason({
        guarded: freeMode || disableAutosave,
        unresolved: freeMeter.pending || freeMeter.unreconciled.some(entry => entry.check !== 'found'),
        hasUnsavedEdits,
        page: freePage,
        savedPage: freeMeter.completed?.page ?? null,
    })
    const freeLeave = useFreeLeaveGuard(freeLeaveReason)
    // Restored costings have no receipt; only a save confirmed in this session
    // should leave the calculator. Keep any newer edits or unresolved work here.
    const savedFreeCosting = freeMode && freeMeter.completed?.quota ? freeMeter.completed : null
    const redirectedFreeCosting = useRef<typeof freeMeter.completed>(null)
    useEffect(() => {
        if (savedFreeCosting && !freeLeaveReason && redirectedFreeCosting.current !== savedFreeCosting) {
            redirectedFreeCosting.current = savedFreeCosting
            router.push(`/free/costings?costing=${encodeURIComponent(savedFreeCosting.id)}`)
        }
    }, [savedFreeCosting, freeLeaveReason, router])
    const [freePlansOpen, setFreePlansOpen] = useState(false)
    const [estimatorHelpOpen, setEstimatorHelpOpen] = useState(false)
    useEffect(() => {
        if (!estimatorHelpOpen || !window.matchMedia('(max-width: 767.98px), (pointer: coarse) and (max-height: 500px) and (max-width: 1023.98px)').matches) return
        const frame = requestAnimationFrame(() => document.getElementById(`${helpId}-close`)?.focus())
        return () => cancelAnimationFrame(frame)
    }, [estimatorHelpOpen, helpId])
    const openFreePlans = useCallback(() => {
        setFreePlansOpen(true)
        window.requestAnimationFrame(() => document.getElementById('free-plan-comparison')?.scrollIntoView({ block: 'start' }))
    }, [])

    const applyEstimatorDraft = useCallback((checkpoint?: EstimatorDraftInput<EstimateState>) => {
        const restored = checkpoint ?? restoreDraft()
        if (!restored) return
        suppressAutosaveUntilChanged({ preserveDraftStatus: !checkpoint })
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
            requireTapeLength: false,
            requireCapacity: requiresFactoryCapacity(restored.state, false),
        })
        setShowValidation(!restoredValidation.valid)
        if (!restoredValidation.valid) {
            toast.error(tx('This Cost Estimate draft is incomplete. Check the highlighted fields before saving.'))
        } else {
            toast.success(tx(restored.sourceQuoteId
                ? restored.sourceRecordKind === 'costing' ? 'Costing specifications loaded' : 'Quotation specifications loaded'
                : 'Cost Estimate draft restored'))
        }
    }, [restoreDraft, suppressAutosaveUntilChanged, templates, tx, startJourney])

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
        if (freeMode || initialProfile !== undefined) return
        async function load() {
            setLoading(true)
            const pRes = await getFactoryCostProfile({ createIfMissing: false })
            if (pRes.data) {
                currentProfileRef.current = pRes.data
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

    // Saved qualities, ui-only worker inputs, party suggestions, and
    // review badges are independent of the blank editor. Hydrate them after
    // the primary task is interactive and never replace values entered by the
    // owner while the secondary request is in flight.
    useEffect(() => {
        if (freeMode || initialTemplates !== undefined) return
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
                setStaleRateNames(result.staleDefaultRateNames ?? [])
                setRateBookYarns(result.rateBookYarns ?? [])

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
    }, [freeMode, initialProfile, initialTemplates])

    // Update the recoverable input at commit, before pagehide/visibility events;
    // the storage write itself remains debounced by the autosave hook.
    useLayoutEffect(() => {
        if (!orgId) return
        saveDraft(buildCurrentDraft(
            quoteRequestIdRef.current,
            sourceRecordKind ?? 'costing',
        ))
    }, [buildCurrentDraft, orgId, saveDraft, sourceRecordKind, state])

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

    const requireCapacityForCurrentCosting = requiresFactoryCapacity(state, false)
    const estimatorValidation = useMemo(
        () => validateEstimatorSnapshot(state, {
            requireTapeLength: false,
            requireCapacity: requireCapacityForCurrentCosting,
        }),
        [requireCapacityForCurrentCosting, state],
    )
    const firstEstimatorValidationMessage = useMemo(
        () => getFirstEstimatorValidationMessage(estimatorValidation),
        [estimatorValidation],
    )
    const estimatorWarnings = useMemo(
        () => estimatorValidation.warnings ?? [],
        [estimatorValidation.warnings],
    )
    // An approval covers the exact inputs reviewed; any effective edit needs a fresh one.
    const warningKey = useMemo(
        () => warningAcknowledgementKey(estimatorWarnings, state),
        [estimatorWarnings, state],
    )
    const warningsAcknowledged = !warningKey || acknowledgedWarningKey === warningKey
    const totals: EstimatorV3Totals = useMemo(() => {
        try {
            if (freeMode) return freeMeter.completed?.totals ?? calcFullTotals(makeFreeEstimate())
            return calcFullTotals(state)
        } catch {
            // A restored or manually tampered payload can contain a non-finite
            // value. Keep the page recoverable while field validation explains
            // what must be fixed; never let Decimal terminate the render.
            return calcFullTotals(makeDefaultEstimateState())
        }
    }, [state, freeMode, freeMeter.completed])
    const costingResult = useMemo(() => freeMode ? freeMeter.completed?.result ?? buildCostingResult(makeFreeEstimate(),totals) : buildCostingResult(state, totals), [state, totals, freeMode, freeMeter.completed])
    const awaitingCalculation = freeMode && (!freeMeter.completed || freeMeter.stale)
    const costingReadiness = useMemo(
        () => getEstimatorReadiness({
            validation: estimatorValidation,
            result: costingResult,
            totals,
            warningsAcknowledged,
            awaitingCalculation,
        }),
        [costingResult, estimatorValidation, totals, warningsAcknowledged, awaitingCalculation],
    )
    // Keep the monthly-expense reference available even when the costing is
    // currently using a direct ₹/m rate. This is transparency only; it never
    // overrides the selected calculation method.
    const monthlyOverheadReference = state.monthlyOutputM > 0
        ? totals.overheadTotalMonthly / state.monthlyOutputM
        : 0
    const hasValidCostResult = freeMode ? !!freeMeter.completed : costingReadiness.canDisplayMoney
    const canPersistCostResult = freeMode ? !!freeMeter.completed && !freeMeter.stale : costingReadiness.canPersist
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
        ? createCostingExportModel({ qualityLabel, state: freeMode && freeMeter.completed ? freeMeter.completed.estimate : state, totals, result: costingResult })
        : null,
    [canPersistCostResult, costingResult, qualityLabel, state, totals, freeMode, freeMeter.completed])

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
        reportPwaWorkflowSuccess('costing')
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
    const breakEvenScenario = useMemo(
        () => freeMode ? undefined : getBreakEvenScenario(state, totals),
        [state, totals, freeMode],
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
            ? templates.filter(template => matchesQualitySearch(template, templateSearch))
            : templates,
    [templates, templateSearch])
    const hasActiveQualityRecipeChanges = appliedTemplate
        ? hasSavedQualityRecipeChanges(appliedTemplate, state)
        : false
    const topCostingActionLabel = freeMode ? freeText(language, freeMeter.completed ? 'recalculateSave' : 'calculateSave') : sourceQuoteId && sourceRecordKind === 'costing'
        ? t('tourControls.estimator.saveNewVersion')
        : t('tourControls.estimator.saveCosting')

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
        if (freeMode) return void toast.info(tx('Saved qualities require Lite'))
        setTemplateName(
            qualityLabel.trim()
            || appliedTemplate?.name
            || ''
        )
        setTemplateSaveError(null)
        setShowSaveTemplate(true)
    }, [appliedTemplate?.name, qualityLabel, freeMode, tx])

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
            requireCapacity: !appliedTemplate && requiresFactoryCapacity(state, false),
        })
        if (!templateValidation.valid) {
            toast.error(tx(getFirstEstimatorValidationMessage(templateValidation) ?? 'Complete the highlighted inputs before saving the quality.'))
            return true
        }
        return warningAlreadyReviewed ? false : requireWarningReview(continuation)
    }

    const handleSaveProfile = async (warningAlreadyReviewed = false) => {
        if (freeMode) return void toast.info(tx('Factory defaults require Lite'))
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
                // Expense-based defaults need only the monthly expense total
                // and the owner's representative monthly production estimate.
                // Capacity is not exposed in Lite and must not block this save.
                requireCapacity:         false,
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
        if (freeMode) return void toast.info(tx('Saved qualities require Lite'))
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
                    description: tx(`Quality and costing snapshot v${res.versionNumber ?? 1} saved together · ${formatSuratDateTime(res.updatedAt ?? new Date().toISOString())} · rate basis ₹${Number(state.warpRows[0]?.yarnRate ?? 0).toFixed(2)}/kg. Use Save Costing only when you intentionally want another costing version.`),
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
        if (freeMode && (freeMeter.pending || freeMeter.busy)) return
        if (freeMode) { freeMeter.reset(); router.replace('/free') }
        startJourney('blank')
        setLastSavedCosting(null)
        setQualityCheckpoint(null)
        setHasUnsavedEdits(false)
        if (freeMode) rawDispatch({type:'RESTORE_DRAFT',draftState:{...makeFreeEstimate(),isConfigured:true}})
        else rawDispatch({
            type: 'RESET',
            data: {
                profile: currentProfileRef.current ?? initialProfile,
                sections: (currentProfileRef.current ?? initialProfile)?.enabled_sections ?? DEFAULT_FACTORY_SECTIONS,
                workers: initialWorkers || [],
            },
        })
        setEntryMode('quick')
        assumptionsManuallyToggledRef.current = false
        setAssumptionsExpanded(false)
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
        // An unresolved update keeps its proposal on this page (LT03).
        const pending = rateUpdateUnknown?.templateId === tpl.id ? rateUpdateUnknown : null
        setEditRatesTpl(tpl)
        setEditingWarpRates((pending?.proposedWarp ?? warpRows).map((r: WarpRow) => ({ id: r.id, yarnRate: r.yarnRate })))
        setEditingWeftRates((pending?.proposedWeft ?? weftRows).map((r: WeftRow) => ({ id: r.id, yarnRate: r.yarnRate })))
        void trackPlanEvent('rate_review_requested')
    }, [rateUpdateUnknown])

    /** Apply a saved quality's stored rates to the estimator as a new costing. */
    const applySavedQualityRates = (applied: EstimatorTemplate, name: string) => {
        setDirectWeavingRateInput(getTemplateDirectWeavingRateInput(applied, state))
        dispatch({
            type: 'APPLY_TEMPLATE',
            template: applied,
        })
        setAppliedTemplate(applied)
        setQualityLabel(name)
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
    }

    /** Persist updated rates to template row AND apply to the estimator. */
    const handleSaveRatesAndApply = async (confirmed = false) => {
        if (!editRatesTpl || savingRatesRef.current) return
        if (saveQuoteLockRef.current || unconfirmedRequestId) return
        if (rateUpdateUnknown) return
        if (!confirmed && hasUnsavedEdits && shouldPersistEstimatorDraft(buildCurrentDraft())) {
            setPendingQualityChange({ name: editRatesTpl.name, apply: () => void handleSaveRatesAndApply(true) })
            return
        }
        setPendingQualityChange(null)
        setQualityCheckpoint({ draft: buildCurrentDraft(), template: appliedTemplate })
        savingRatesRef.current = true
        setSavingRates(true)
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
        const keepUnresolved = () => {
            setRateUpdateCheck(null)
            setRateUpdateUnknown({
                templateId: editRatesTpl.id,
                templateName: editRatesTpl.name,
                expectedUpdatedAt,
                proposedWarp: updatedWarp,
                proposedWeft: updatedWeft,
            })
        }
        try {
            const rateOutcome = await runMutationWithTimeout(() => updateTemplateRates({
                id: editRatesTpl.id,
                expectedUpdatedAt,
                warpRows: updatedWarp,
                weftRows: updatedWeft,
            }))
            if (rateOutcome.status === 'unknown') {
                keepUnresolved()
                return
            }
            const res = rateOutcome.value
            if (res.error) { toast.error(tx(userFacingError(res.error, 'Saved Quality could not be updated. Try again.'))); return }

            // Success: refresh and apply
            const tRes = await getEstimatorTemplates().catch(() => ({ data: undefined }))
            const refreshed = tRes.data?.find(template => template.id === editRatesTpl.id)
            if (tRes.data) setTemplates(tRes.data)

            const applied = refreshed ?? { ...editRatesTpl, warp_rows: updatedWarp, weft_rows: updatedWeft, updated_at: res.updatedAt ?? expectedUpdatedAt }
            applySavedQualityRates(applied, editRatesTpl.name)
            toast.success('noChange' in res && res.noChange
                ? t('estimator.sprint1.quality_no_change')
                : t('estimator.sprint1.rates_updated_no_snapshot'))
        } catch {
            // The request may have reached the server before the connection
            // failed. Keep the proposal unresolved; never resend it blindly.
            keepUnresolved()
        } finally {
            savingRatesRef.current = false
            setSavingRates(false)
        }
    }

    /**
     * Reconcile an unresolved rate update against the saved quality. Only an
     * unchanged version proves it did not commit; a matching quality is shown
     * as the quality's current rates, not as this request's success.
     */
    const checkUnresolvedRateUpdate = async () => {
        const pending = rateUpdateUnknown
        if (!pending || rateUpdateCheck === 'checking') return
        setRateUpdateCheck('checking')
        try {
            const tRes = await getEstimatorTemplates()
            if (!tRes.data) { setRateUpdateCheck('check_failed'); return }
            setTemplates(tRes.data)
            const current = tRes.data.find(template => template.id === pending.templateId) ?? null
            const reconciliation = reconcileTemplateRateUpdate({
                expectedUpdatedAt: pending.expectedUpdatedAt,
                proposedWarp: pending.proposedWarp,
                proposedWeft: pending.proposedWeft,
                current,
            })
            if (reconciliation === 'not_applied') {
                setRateUpdateUnknown(null)
                setRateUpdateCheck(null)
                toast.info(tx('The rates were not saved. You can save them again.'))
                return
            }
            if (reconciliation === 'matches_proposal' && current) {
                setRateUpdateUnknown(null)
                setRateUpdateCheck(null)
                applySavedQualityRates(current, current.name)
                toast.success(tx('The saved quality now has these rates.'))
                return
            }
            setRateUpdateCheck(reconciliation === 'missing' ? 'missing' : 'conflict')
        } catch {
            setRateUpdateCheck('check_failed')
        }
    }

    const discardUnresolvedRateUpdate = () => {
        setRateUpdateUnknown(null)
        setRateUpdateCheck(null)
        setEditRatesTpl(null)
    }

    /** Apply template directly (without editing rates). */
    const handleApplyCurrentRates = (confirmed = false) => {
        if (!editRatesTpl || savingRatesRef.current) return
        if (saveQuoteLockRef.current || unconfirmedRequestId) return
        if (rateUpdateUnknown) return
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

    const handleSaveQuote = async (
        status: 'draft' | 'accepted' = 'draft',
        staleRatesAcknowledged = false,
        qualityUpdateDecision?: 'version_only' | 'version_and_quality',
        warningAlreadyReviewed = false,
    ) => {
        if (freeMode) {
            // Same shared validation as a paid save, on the current inputs and
            // before any request. The server repeats it and stays authoritative.
            const preflight = freePreflight(estimatorValidation, warningAlreadyReviewed || warningsAcknowledged)
            if (preflight.action === 'fix') {
                jumpToEstimatorIssue(preflight.field)
                return void toast.error(tx(firstEstimatorValidationMessage ?? 'Complete the highlighted inputs before saving.'))
            }
            if (preflight.action === 'review') return void requireWarningReview(() => handleSaveQuote(status, staleRatesAcknowledged, qualityUpdateDecision, true))
            return void freeMeter.submit(preflight.acknowledged, freePage)
        }
        if (saveQuoteLockRef.current || savingQuote) return
        if (unconfirmedRequestId) return
        setShowValidation(true)
        if (!hasValidCostResult) {
            return toast.error(tx(firstCostingReadinessMessage ?? 'Complete the highlighted inputs before saving.'))
        }
        if (!costingStartedRef.current) {
            costingStartedRef.current = true
            void trackPlanEvent('costing_started', { source: 'estimator' })
        }
        if (!warningAlreadyReviewed && requireWarningReview(() => handleSaveQuote(
            status,
            staleRatesAcknowledged,
            qualityUpdateDecision,
            true,
        ))) return

        // A party name only survives from a reopened legacy record; costings
        // never require one.
        const resolvedPartyName = partyName.trim() || null

        if (!qualityLabel.trim()) return toast.error(t('estimator.toast.quality_required'))
        if (staleRateNames.length > 0 && !staleRatesAcknowledged) {
            setPendingStaleRateSave({ status })
            return
        }

        const shouldOfferSavedQualityUpdate = Boolean(appliedTemplate)
            && hasSavedQualityRecipeChanges(appliedTemplate!, state)

        if (shouldOfferSavedQualityUpdate && !qualityUpdateDecision) {
            setPendingQualityVersionSave({ status })
            return
        }

        const browserIsOnline = typeof navigator === 'undefined' || navigator.onLine
        if (!browserIsOnline) {
            // Only a written draft is on this device. With drafts off (the
            // Free wrapper after activation) the inputs live in this page.
            const offlineDraft = saveDraftNow(buildCurrentDraft(undefined, 'costing'))
            toast.error(tx('Reconnect before saving'), {
                description: isDraftStored(offlineDraft)
                    ? tx('Your Cost Estimate and save identity are stored on this device.')
                    : offlineDraft === 'disabled'
                        ? tx('This Cost Estimate is kept on this page only. Keep the page open until you reconnect, then save.')
                        : offlineDraft === 'blocked'
                            ? tx('A recovered draft is waiting for your choice, so this Cost Estimate is not stored on this device yet. Keep the page open until you reconnect.')
                            : tx('Browser storage is unavailable, so keep this page open until you reconnect.'),
                duration: Infinity,
            })
            return
        }

        const clientRequestId = quoteRequestIdRef.current ?? createClientRequestUuid()
        quoteRequestIdRef.current = clientRequestId

        // Flush both the current inputs and request identity before the action.
        // If the response is lost after commit, reopening and retrying reuses the
        // same idempotency key instead of creating a duplicate.
        const draftStoredBeforeSubmit = isDraftStored(saveDraftNow(buildCurrentDraft(clientRequestId, 'costing')))

        saveQuoteLockRef.current = true
        setSavingQuote(true)

        try {
            void trackPlanEvent('save_attempted', {
                record_kind: 'costing',
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
                    status,
                    recordKind:              'costing',
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
                    record_kind: 'costing',
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
                    record_kind: 'costing',
                    edited: wasEditingCosting,
                })
                void trackPlanEvent('costing_saved', {
                    record_kind: 'costing',
                    edited: wasEditingCosting,
                })
                if (wasEditingCosting) {
                    void trackPlanEvent('costing_recalculated', { source: 'saved_costing' })
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
                    tx(('noChange' in res && res.noChange)
                        ? t('estimator.sprint1.costing_no_change', { version: String(('versionNumber' in res && res.versionNumber) || 1) })
                        : (qualityUpdateDecision === 'version_and_quality'
                            ? `${wasEditingCosting ? 'New costing version' : 'Costing'} saved and Saved Quality updated`
                            : (wasEditingCosting ? 'New costing version saved' : 'Costing saved'))),
                    {
                        description: tx(`Costing snapshot v${savedVersion} · ${formatSuratDateTime(savedAt)} · rate basis ₹${Number(state.warpRows[0]?.yarnRate ?? 0).toFixed(2)}/kg${sourceQuoteStatus ? ` · status preserved as ${sourceQuoteStatus}` : ''}.`),
                    },
                )
                if (res.quoteId) {
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
                    record_kind: 'costing',
                })
                toast.error(tx(userFacingError(res.error, 'The Customer Quotation could not be saved. Try again.')))
            }
        } catch (error) {
            if (clientRequestId) {
                setUnconfirmedRequestId(clientRequestId)
                await checkUnconfirmedSave(clientRequestId)
                return
            }
            void trackPlanEvent('save_failed', {
                record_kind: 'costing',
            })
            console.error('Failed to save estimator quote:', error)
            toast.error(tx(userFacingError(error, 'Failed to save the Cost Estimate. Try again.')), {
                description: draftStoredBeforeSubmit
                    ? tx('Your Cost Estimate and retry identity remain saved on this device.')
                    : undefined,
            })
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
        && (freeMode || breakEvenScenario?.quotePricePerM != null)
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
        : costingReadiness.status === 'calculation_required'
            ? null
            : !hasValidCostResult
            ? (firstCostingReadinessMessage ?? 'Complete the highlighted Cost Estimate inputs before saving.')
            : !qualityLabel.trim()
                ? 'Enter a Fabric Quality name before saving.'
                : totals.totalProductionCostPerM <= 0
                    ? 'Enter valid yarn and weaving inputs so Production Cost / m is above ₹0.'
                    : null
    // Field names only; no new money is computed before the explicit, metered calculation.
    const freeChangedFields = freeMode && freeMeter.stale && freeMeter.completed
        ? summarizeCostingInputChanges(freeMeter.completed.estimate, state).map(change => freeText(language, FREE_CHANGE_LABELS[change]))
        : []
    const freeStaleDescription = [
        freeText(language, 'inputsChangedNotRecalculated'),
        freeChangedFields.length > 0 ? freeText(language, 'changedSince', { fields: freeChangedFields.join(', ') }) : '',
        freeText(language, freeMeter.editRemainingMs > 0 ? 'revisionNoCharge' : 'revisionExpired'),
    ].filter(Boolean).join(' ')
    const validityStatus = freeMode && freeMeter.stale ? { label: freeText(language, 'lastSavedResult'), description: freeStaleDescription, icon: AlertTriangle, className: 'border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] text-[var(--wv-ochre-900)]' } : costingReadiness.status === 'calculation_required'
        ? {
            label: freeText(language, 'readyToCalculate'),
            description: freeText(language, 'calculateToSeeResult'),
            icon: Calculator,
            className: 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[var(--color-ink)]',
        }
        : costingReadiness.status === 'ready'
        ? {
            label: 'Estimate ready for review',
            description: 'Price and break-even are calculated from the current inputs.',
            icon: CheckCircle2,
            className: 'border-[var(--wv-moss-200)] bg-[var(--wv-moss-50)] text-[var(--wv-moss-700)]',
        }
        : costingReadiness.status === 'warning_ack_required'
            ? {
                label: 'Review values before saving',
                description: awaitingCalculation ? freeText(language, 'reviewBeforeCalculation') : 'The price is visible, but unusual inputs need acknowledgement.',
                icon: AlertTriangle,
                className: 'border-[var(--color-warning-amber-soft)] bg-[var(--color-warning-amber-soft)]/70 text-[var(--color-warning-amber)]',
            }
            : {
            label: 'Costing not ready',
            description: 'Complete the highlighted inputs before using this price.',
            icon: AlertCircle,
            className: 'border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] text-[var(--wv-madder-600)]',
        }
    const freeIncompleteBeforeSubmit = freeMode && !showValidation && !estimatorValidation.valid
    const litePristineIncomplete = liteMode && !showValidation && !hasUnsavedEdits && !sourceQuoteId && !appliedTemplate && !estimatorValidation.valid
    const litePersistenceLabel = unconfirmedRequestId ? tx('Save not yet confirmed')
        : savingQuote ? tx('Saving costing…')
        : lastSavedCosting && !hasUnsavedEdits ? liteEstimatorText(language, 'saved', { version: lastSavedCosting.version })
        : hasUnsavedEdits || (appliedTemplate && !sourceQuoteId) ? liteEstimatorText(language, 'unsaved') : liteEstimatorText(language, 'live')
    const firstEstimatorIssueField = estimatorValidation.issues[0]?.field
        ?? costingReadiness.issues[0]?.field
        ?? null
    const jumpToEstimatorIssue = (field: string | null) => {
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
    const jumpToFirstEstimatorIssue = () => jumpToEstimatorIssue(firstEstimatorIssueField)
    const freeReviewFields = freeMeter.transaction.phase === 'review' ? freeMeter.transaction.fields : []
    // The shared validator's own message for each field the server flagged.
    const freeReviewMessages = estimatorWarnings.filter(warning => freeReviewFields.includes(warning.field)).map(warning => tx(warning.message))
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
    const constructionFields = (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-[var(--wv-neel-500)]">{t('estimator.order_basics.warp_construction')}</Label>
                <Input
                    data-estimator-field="warpConstruction"
                    aria-label="Warp yarn construction"
                    value={warpInstruction === lastGeneratedWarp.current ? '' : warpInstruction}
                    onChange={e => setWarpInstructionFromUser(e.target.value)}
                    placeholder={formatEstimatorPlaceholder(lastGeneratedWarp.current || '50/48 + Rainbow')}
                    className="text-sm font-medium placeholder:text-[var(--wv-cotton-500)] border-[var(--wv-cotton-400)] h-11"
                />
            </div>
            <div className="space-y-1.5">
                <Label className="text-[10px] uppercase font-bold text-[var(--wv-neel-500)]">{t('estimator.order_basics.weft_construction')}</Label>
                <Input
                    data-estimator-field="weftConstruction"
                    aria-label="Weft yarn construction"
                    value={weftInstruction === lastGeneratedWeft.current ? '' : weftInstruction}
                    onChange={e => setWeftInstructionFromUser(e.target.value)}
                    placeholder={formatEstimatorPlaceholder(lastGeneratedWeft.current || '50/48 - 68 Picks')}
                    className="text-sm font-medium placeholder:text-[var(--wv-cotton-500)] border-[var(--wv-cotton-400)] h-11"
                />
            </div>
        </div>
    )

    return (
        <div ref={estimatorGutterRef} data-free-costing={freeMode || undefined} data-lite-costing={liteMode || undefined} data-sentry-block={freeMode || undefined} className="ui-route-enter estimator-mobile-form space-y-5 pb-floating-button md:pb-20 relative">
            <span hidden data-signin-ready="true" />
            <RouteMilestones
                route={freeMode ? '/free' : '/owner/estimator'}
                shellVisible
                primaryUsable
                secondaryReady={templatesLoaded}
            />
            <PageHeader
                title={tx('Cost estimate')}
                className={freeMode ? 'free-mobile-page-header' : liteMode ? 'lite-mobile-page-header' : undefined}
                actions={compactMobile ? <Button id={`${helpId}-trigger`} type="button" variant="ghost" className={freeMode ? 'free-mobile-help-trigger' : 'lite-mobile-help-trigger'} aria-expanded={estimatorHelpOpen || isTutorialActive} aria-controls={helpId} disabled={isTutorialActive} onClick={() => setEstimatorHelpOpen(open => !open)} data-i18n-skip="true"><BookOpen className="h-4 w-4" aria-hidden="true" />{freeMode ? freeMobileText(language, 'help') : liteEstimatorText(language, 'help')}</Button> : undefined}
            />
            {!freeMode && !disableAutosave && (
                <LocalSaveStatus
                    className={pageShellClass}
                    status={savingQuote ? 'server-saving' : lastSavedCosting && !hasUnsavedEdits && !unconfirmedRequestId ? 'server-saved' : draftSaveStatus}
                />
            )}
            {(freeMode || disableAutosave && freeMeter.unreconciled.length > 0) && (
                <FreeTransactionRecovery
                    className="estimator-workspace-shell px-4 sm:px-6 lg:px-0"
                    transaction={freeMeter.transaction}
                    busy={freeMeter.busy}
                    reviewMessages={freeReviewMessages}
                    onConfirm={freeMeter.confirmReview}
                    onCorrect={() => {
                        freeMeter.correctReview()
                        jumpToEstimatorIssue(freeReviewFields[0] ?? null)
                    }}
                    onRetry={freeMeter.retry}
                    onRelease={freeMeter.release}
                    onViewPlans={openFreePlans}
                    unreconciled={freeMeter.unreconciled}
                    onCheckUnreconciled={freeMeter.checkUnreconciled}
                    onDismissUnreconciled={freeMeter.dismissUnreconciled}
                />
            )}
            {freeMode && freePlansOpen && (
                <div id="free-plan-comparison" className="scroll-mt-4">
                    <UpgradeBenefitsPreview open onOpenChange={setFreePlansOpen} onActivated={() => void freeMeter.refresh()} />
                </div>
            )}
            {(freeMode || disableAutosave) && (
                <FreeLeaveDialog reason={freeLeaveReason} open={freeLeave.pendingHref !== null} onStay={freeLeave.stay} onLeave={freeLeave.leave} />
            )}

            {unconfirmedRequestId && (
                <section role="status" className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] p-4 text-sm text-[var(--wv-ochre-900)]">
                    <h2 className="font-semibold">{tx('Save not yet confirmed')}</h2>
                    <p className="mt-1">{saveCheckMessage || tx('Checking the original save. Keep this page open; editing is paused to protect your submitted costing.')}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button variant="outline" disabled={checkingSave || savingQuote} onClick={() => void checkUnconfirmedSave(unconfirmedRequestId)}>
                            {checkingSave && <Loader2 className="h-4 w-4 animate-spin" />}{tx('Check save status')}
                        </Button>
                        {pendingSaveRequestRef.current && <Button disabled={checkingSave || savingQuote} onClick={() => void retrySubmittedSave()}>{tx('Retry original save')}</Button>}
                        <Button variant="ghost" onClick={() => router.push(freeMode ? '/free/costings' : '/owner/quotes')}>{tx('Check Saved Costings')}</Button>
                    </div>
                </section>
            )}
            {lastSavedCosting && !unconfirmedRequestId && (
                <section role="status" className="rounded-xl border border-[var(--color-factory-green)]/25 bg-[var(--color-factory-green-soft)] p-4">
                    <h2 className="font-semibold">{tx('Saved to factory')} · {lastSavedCosting.model.qualityLabel} · v{lastSavedCosting.version}</h2>
                    <p className="mt-1 text-xs text-[var(--color-muted)]">{formatSuratDateTime(lastSavedCosting.savedAt)}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                        <Button onClick={() => { setExportSavedCosting(true); setShowExportDialog(true) }}>{tx('Create customer quotation')}</Button>
                        {canUseProductionPipeline && <Button variant="outline" onClick={() => openProductionFromCosting(lastSavedCosting.id)}><Play className="h-3.5 w-3.5" /> {tx('Start Production')}</Button>}
                        <Button variant="outline" onClick={() => router.push(freeMode ? '/free/costings' : '/owner/quotes')}>{tx('View saved costings')}</Button>
                        <Button variant="ghost" onClick={() => setShowConfirmNewQuality(true)}>{tx('Start another quality')}</Button>
                    </div>
                </section>
            )}
            <fieldset className="contents" onChangeCapture={event => {
                if (!journey && event.target instanceof HTMLElement && event.target.closest('[data-estimator-field]')) startJourney('blank')
            }} disabled={savingQuote || Boolean(unconfirmedRequestId) || freeMode && freeMeter.pending} inert={savingQuote || Boolean(unconfirmedRequestId) || freeMode && freeMeter.pending}>
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
            {!state.isConfigured && !wizardDismissed && (
                <FactoryCostWizard 
                    initialState={state}
                    initialYarnReviewIntervalDays={Number(initialProfile?.yarn_review_interval_days ?? 90)}
                    saving={saving}
                    onDismiss={async () => {
                        rawDispatch({ type: 'SET', field: 'isConfigured', value: true })
                        if (currentProfileRef.current) {
                            currentProfileRef.current = { ...currentProfileRef.current, is_configured: true }
                        }
                        try {
                            await dismissFactoryCostWizard()
                        } catch {
                            // Non-fatal
                        }
                        toast.info(tx('Factory setup dismissed. You can configure defaults anytime in Settings.'))
                    }}
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
                                if (currentProfileRef.current) {
                                    currentProfileRef.current = {
                                        ...currentProfileRef.current,
                                        ...data,
                                        is_configured: true,
                                    } as FactoryCostProfile
                                }
                                void dismissFactoryCostWizard()
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
                                    {'Updating saved Cost Estimate '}
                                    <span className="font-bold">{draft.qualityLabel || 'Untitled'}</span>
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
                    <p role="status" aria-live="polite" className="rounded-lg border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-4 py-2 text-xs font-semibold text-[var(--wv-ochre-900)]">
                        Draft recovery is unavailable on this device right now. Keep this page open until the Cost Estimate is explicitly saved.
                    </p>
                </div>
            )}

            {draftConflict && (
                <div className={`${pageShellClass} mb-2`}>
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--wv-lagoon-200)] bg-[var(--wv-lagoon-50)] px-4 py-3 text-xs font-semibold text-[var(--wv-neel-900)]">
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
                                className="min-h-10 rounded-lg bg-[var(--wv-lagoon-700)] px-3 text-white"
                            >
                                Reload newer draft
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showValidation && estimatorWarnings.length > 0 && (
                <div className={`${pageShellClass} mb-2`}>
                    <div className="rounded-xl border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-4 py-3 text-[var(--wv-ochre-900)]">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wv-ochre-800)]" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold">Review unusual values before saving</p>
                                <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-[var(--wv-ochre-800)]">
                                    {estimatorWarnings.slice(0, 4).map(warning => (
                                        <li key={`${warning.field}:${warning.message}`}>{warning.message}</li>
                                    ))}
                                </ul>
                                {estimatorWarnings.length > 4 && (
                                    <p className="mt-1 text-xs font-semibold text-[var(--wv-ochre-800)]">+{estimatorWarnings.length - 4} more unusual value(s)</p>
                                )}
                                <p className="mt-2 text-[11px] font-medium text-[var(--wv-ochre-800)]">Costing can be reviewed, but a save or quotation requires acknowledgement.</p>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                className="shrink-0 border-[var(--wv-ochre-200)] bg-white text-[var(--wv-ochre-800)] hover:bg-[var(--wv-ochre-50)]"
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
                    <div className="rounded-xl border border-[var(--wv-madder-200)] bg-[var(--wv-madder-50)] px-4 py-3 text-[var(--wv-madder-600)]">
                        <div className="flex items-start gap-3">
                            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--wv-madder-600)]" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-bold">Complete the highlighted inputs before saving</p>
                                <ul className="mt-1 space-y-0.5 text-xs leading-relaxed text-[var(--wv-madder-600)]">
                                    {estimatorValidation.issues.slice(0, 6).map(issue => (
                                        <li key={`${issue.field}:${issue.message}`}>{issue.message}</li>
                                    ))}
                                </ul>
                                {estimatorValidation.issues.length > 6 && (
                                    <p className="mt-1 text-xs font-semibold text-[var(--wv-madder-600)]">+{estimatorValidation.issues.length - 6} more input issue(s)</p>
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
                                    className="shrink-0 border-[var(--wv-madder-200)] bg-white text-[var(--wv-madder-600)] hover:bg-[var(--wv-madder-50)]"
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
                <aside
                    className="estimator-left-rail space-y-3"
                    id={compactMobile ? helpId : undefined}
                    data-free-help-expanded={freeMode ? estimatorHelpOpen || isTutorialActive : undefined}
                    data-lite-help-expanded={liteMode ? estimatorHelpOpen || isTutorialActive : undefined}
                    aria-label="Estimator guides and tools"
                >
                    {compactMobile && <Button id={`${helpId}-close`} variant="ghost" className={freeMode ? 'free-mobile-help-trigger' : 'lite-mobile-help-trigger'} disabled={isTutorialActive} onClick={() => { setEstimatorHelpOpen(false); document.getElementById(`${helpId}-trigger`)?.focus() }}><X className="h-4 w-4" />{tx('Close')}</Button>}
                    {compactMobile && <p className={`${freeMode ? 'free-mobile-only' : 'lite-mobile-only'} text-sm leading-relaxed text-body`}>{tx('Quick and Detailed use the same calculation. Detailed shows additional assumptions.')}</p>}
                    <CostEstimateTutorial
                        accountDismissed={tutorialDismissed}
                        userMetadata={userMetadata}
                        enabled={state.isConfigured && !saving}
                        freePlan={freeMode}
                        existingCosting={Boolean(sourceQuoteId && sourceRecordKind === 'costing')}
                        productionPipeline={canUseProductionPipeline}
                        orgId={orgId}
                        userId={userId}
                        onPrepare={prepareTutorial}
                        onOpenLiveCostModal={setLiveEstimateOpen}
                        onActiveChange={setIsTutorialActive}
                    />
                </aside>

                <div className="estimator-workspace-main min-w-0">
                    <div className="relative min-w-0">
                    {/* ── STICKY QUOTE COCKPIT ─────────────────────────────── */}
                    <div
                        data-testid="estimator-primary-cockpit"
                        aria-hidden="true"
                        className="hidden"
                    >
                <div className={`${hudShellClass} ui-focus-surface`}>
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
                            <LiquidSegmented
                                className="shrink-0 self-start"
                                role="tablist"
                                aria-label={entryMode === 'quick' ? tx('Essential construction inputs · same calculation engine') : tx('Full technical inputs & factory assumptions · same calculation engine')}
                                value={entryMode}
                                onValueChange={handleEntryModeChange}
                                options={[
                                    { value: 'quick', label: 'Quick', controls: 'estimator-form-panel', title: tx('Essential construction inputs · same calculation engine') },
                                    { value: 'detailed', label: tx('Detailed'), controls: 'estimator-form-panel', title: tx('Full technical inputs & factory assumptions · same calculation engine') },
                                ]}
                            />
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
                                            <LiveValue value={hasValidCostResult ? `₹${costingResult.productionCostPerM.toFixed(2)}` : '—'} />
                                        </p>
                                        {breakEvenMatchesProductionCost && (
                                            <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]" title={t('estimator.price_helpers.break_even_hint')}>Break-even floor</p>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="mb-1 text-[11px] font-semibold leading-4 text-[var(--color-muted)]" aria-label={t('estimator.price_helpers.suggested_selling_price')}>
                                            {t('common.suggested_selling_price_per_m')}
                                        </p>
                                        <p className="max-w-full break-words font-mono text-[clamp(1.45rem,7vw,2.2rem)] font-semibold leading-[1.05] tracking-tight tabular-nums text-[var(--color-yarn-orange)]">
                                            <LiveValue value={hasValidCostResult && costingResult.quoteIsValid ? `₹${costingResult.suggestedSellingPricePerM.toFixed(2)}` : '—'} />
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
                                                    : 'text-[var(--color-warning-amber)]'}`}>Estimated margin at this price</p>
                                        <p className={`max-w-full break-words font-mono text-[clamp(1.3rem,6vw,1.75rem)] font-semibold leading-[1.05] tracking-tight tabular-nums ${displayMarginPct === null
                                            ? 'text-[var(--color-muted)]'
                                            : displayMarginPct > 0
                                                ? 'text-[var(--color-factory-green)]'
                                                : displayMarginPct < 0
                                                    ? 'text-[var(--color-risk-red)]'
                                                    : 'text-[var(--color-warning-amber)]'}`}>
                                            <LiveValue value={displayMarginPct === null ? '—' : `${displayMarginPct >= 0 ? '+' : ''}${displayMarginPct.toFixed(1)}%`} />
                                        </p>
                                        <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]">
                                            {displayMarginPct === null ? 'Complete estimate' : displayMarginPct > 0 ? 'Above break-even' : displayMarginPct < 0 ? 'Below break-even' : 'At break-even'}
                                        </p>
                                    </div>
                                    {!breakEvenMatchesProductionCost && <div className="min-w-0 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-2.5 py-2 sm:px-3">
                                        <p className="mb-1 text-[11px] font-semibold leading-4 text-[var(--color-muted)]" aria-label={t('estimator.price_helpers.break_even')}>Break-even price / m</p>
                                        <p className="max-w-full break-words font-mono text-[clamp(1.3rem,6vw,1.75rem)] font-semibold leading-[1.05] tracking-tight tabular-nums text-[var(--color-ink)]">
                                            <LiveValue value={hasValidCostResult && (freeMode || breakEvenScenario?.quotePricePerM != null)
                                                ? `₹${costingResult.breakEvenPricePerM.toFixed(2)}`
                                                : '—'} />
                                        </p>
                                        <p className="mt-1 text-[10px] font-medium leading-4 text-[var(--color-muted)]" title={t('estimator.price_helpers.break_even_hint')}>Minimum at 0% margin</p>
                                    </div>}
                                    </div>
                                </div>

                                {hasOrderQty && (
                                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-[var(--color-hairline)]/80 pt-3">
                                        <span className="text-[11px] font-semibold text-[var(--color-muted)]">Expected profit</span>
                                        <span className={`font-mono text-[14px] font-semibold tabular-nums ${costingResult.expectedProfitTotal != null && costingResult.expectedProfitTotal < 0 ? 'text-[var(--color-risk-red)]' : 'text-[var(--color-factory-green)]'}`}>
                                            <LiveValue value={hasValidCostResult && costingResult.quoteIsValid && costingResult.expectedProfitTotal != null
                                                ? `₹${costingResult.expectedProfitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : '—'} />
                                        </span>
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">for {Number(state.orderQuantityM).toLocaleString('en-IN')} m</span>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex h-2.5 overflow-hidden rounded-full bg-[var(--color-surface-soft)]" aria-label="Cost composition">
                                        {costSegments.length > 0 ? costSegments.map(segment => (
                                            <div
                                                key={segment.label}
                                                className={`ui-meter-fill ${segment.color} min-w-[3px] border-r border-white last:border-r-0`}
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
                                {appliedTemplate && (
                                    <p
                                        data-testid="saved-quality-reuse-status"
                                        className="rounded-lg border border-[var(--wv-lagoon-200)] bg-[var(--wv-lagoon-50)] px-3 py-2 text-[11px] font-medium leading-4 text-[var(--wv-lagoon-700)]"
                                    >
                                        {appliedTemplate.latest_costing_reuse
                                            ? 'Full costing reuse is active: current yarn rates are combined with the latest saved costing assumptions.'
                                            : 'This Saved Quality has no linked costing snapshot yet. Current factory defaults are being used for the costing assumptions.'}
                                    </p>
                                )}
                            </div>

                            <CostingAssumptionsSummary
                                result={costingResult}
                                expanded={assumptionsExpanded}
                                onToggle={toggleAssumptions}
                            />
                        </div>

                        {!freeMode && showCostingSaveGuidance && (
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

                            {/* Costing remains the primary action. */}
                            <Button
                                id="legacy-btn-save-accept"
                                data-testid="legacy-save-costing-action"
                                size="sm"
                                variant="default"
                                className="col-span-2 h-12 rounded-xl bg-loom px-5 text-[14px] font-semibold text-white shadow-xs transition-all duration-150 hover:bg-loom-elevated hover:text-white motion-safe:hover:-translate-y-0.5 active:scale-[0.98] sm:col-span-1"
                                onClick={() => handleSaveQuote('draft')}
                                disabled={freeMode ? !freeCanCalculate : savingQuote || !hasValidCostResult || !qualityLabel.trim() || totals.totalProductionCostPerM <= 0}
                                aria-describedby={actionReadinessMessage ? actionReadinessId : undefined}
                                aria-busy={savingQuote}
                                aria-label={sourceQuoteId
                                    ? 'Save new immutable costing version'
                                    : 'Save costing snapshot'}
                                title={firstCostingReadinessMessage ?? ((!qualityLabel.trim() || totals.totalProductionCostPerM <= 0)
                                    ? tx('Complete quality and cost inputs first.')
                                    : undefined)}
                            >
                                {savingQuote ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                <span className="truncate">{tx(sourceQuoteId ? 'Save New Version' : 'Save Costing')}</span>
                            </Button>

                            <Button
                                id="legacy-btn-export-cost-sheet"
                                size="sm"
                                variant="outline"
                                className="h-12 rounded-xl border border-hairline bg-surface px-5 text-[14px] font-semibold text-ink shadow-xs hover:bg-surface-soft"
                                onClick={() => setShowExportDialog(true)}
                                disabled={!exportModel}
                                aria-describedby={!exportModel ? 'export-cost-sheet-hint' : undefined}
                                title={exportModel ? tx('Create an internal cost sheet or customer quotation') : tx('Correct the highlighted inputs before exporting')}
                            >
                                <FileDown className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{tx('Export Cost Sheet')}</span>
                            </Button>

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
                            {!exportModel && (
                                <p id="export-cost-sheet-hint" className="w-full text-xs font-medium leading-relaxed text-[var(--wv-ochre-800)]">
                                    {tx('Complete the highlighted inputs before creating an Internal Cost Sheet or Customer Quotation.')}
                                </p>
                            )}
                            <p className="text-[11px] font-medium leading-relaxed text-[var(--color-muted)]">
                                {freeMode ? `${freeText(language, 'freeCreationPolicy')} ${freeText(language, 'calculatePolicy')}` : sourceQuoteId
                                    ? tx('Save New Version creates a new immutable costing snapshot. Earlier versions keep their original economics.')
                                    : tx('Save Costing creates the reusable quality and its first immutable costing version.')}
                            </p>
                        </div>
                    </div>

                    {actionReadinessMessage && (
                        <p id={`${actionReadinessId}-legacy`} role="status" className="mt-2 rounded-lg border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3 py-2 text-xs font-medium leading-relaxed text-[var(--wv-ochre-800)]">
                            {actionReadinessMessage}
                        </p>
                    )}

                    {costingResult.quoteIsValid && (
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
                                            <LiveValue value={hasValidCostResult && costingResult.expectedProfitTotal !== null
                                                ? `₹${costingResult.expectedProfitTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                : '—'} />
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
                    <div id="estimator-form-panel" className={`${pageShellClass} mt-5 space-y-7`} data-costing-tutorial-root="true">
            {freeMode && (
                <FreeUsageCard
                    quota={freeMeter.status?.quota}
                    loading={freeMeter.busy || (!freeMeter.status && !freeMeter.statusError)}
                    error={freeMeter.statusError}
                    stale={Boolean(freeMeter.statusError && freeMeter.status)}
                    unverified={freeMeter.balanceUnverified}
                    isPending={freeMeter.pending}
                    onRefresh={freeMeter.refresh}
                    onViewPlans={openFreePlans}
                    isDocked={isFreeUsageDocked}
                    dockStyle={freeUsageDockStyle}
                    className={!isFreeUsageDocked ? 'mb-4' : undefined}
                />
            )}

                {freeMode && freeMeter.completed && (
                    <div className="space-y-3">
                        <div className="rounded-lg border border-hairline bg-surface p-3">
                            <FreeRecalculationWindow
                                remainingMs={freeMeter.editRemainingMs}
                                onRecalculate={() => void handleSaveQuote()}
                                disabled={!freeCanCalculate}
                            />
                            <p className="mt-2 text-xs text-subtle">
                                {freeText(language, freeMeter.editRemainingMs > 0 ? 'revisionNoCharge' : 'revisionExpired')}
                            </p>
                        </div>
                        {freeMeter.completed.quota && !freeMeter.stale && (
                            <FreeSavedReceipt
                                label={freeMeter.completed.label}
                                confirmedAt={freeMeter.completed.confirmedAt}
                                quota={freeMeter.completed.quota}
                                costingsUsed={freeMeter.completed.costingsUsed}
                            />
                        )}
                    </div>
                )}

                {/* ── CURRENT QUALITY + MODE ─────────────────────────────── */}
                <Sheet
                    open={!freeMode && showQualityLibrary}
                    onOpenChange={(nextOpen) => {
                        if (isTutorialActive && !nextOpen) {
                            return
                        }
                        setShowQualityLibrary(nextOpen)
                    }}
                    modal={!isTutorialActive}
                >
                    <section
                        id="active-quality"
                        data-slot="card"
                        data-free-record-loaded={freeMode ? Boolean(freeMeter.completed) : undefined}
                        data-lite-record-loaded={liteMode ? Boolean(appliedTemplate || sourceQuoteId) : undefined}
                        aria-labelledby="active-quality-title"
                        className="ui-focus-surface rounded-[14px] border border-[var(--color-hairline)] bg-white/95 px-4 py-3 shadow-[var(--shadow-card)] sm:px-5"
                    >
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                            <div className="free-mobile-quality-identity min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-yarn-orange-dark)]">Current quality</p>
                                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                                    <h2 id="active-quality-title" className="max-w-full break-words text-[15px] font-bold leading-5 text-[var(--color-ink)]">
                                        {liteMode ? <><span className="lite-mobile-only" data-i18n-skip="true">{appliedTemplate ? liteEstimatorText(language, 'recipe', {name: appliedTemplate.name}) : qualityLabel.trim() || liteEstimatorText(language, 'new')}</span><span className="lite-desktop-only">{appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}</span></> : freeMode && freeMeter.completed ? <><span className="free-mobile-only">{freeMobileText(language, 'savedIdentity', {label: freeMeter.completed.label, revision: freeMeter.completed.editWindow?.revision ?? 1})}</span><span className="free-desktop-only">{appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}</span></> : appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}
                                    </h2>
                                    {sourceQuoteId && sourceRecordKind === 'costing' && (
                                        <span className="text-[10px] font-medium text-[var(--color-muted)]">{liteMode ? <><span className="lite-mobile-only" data-i18n-skip="true">{liteEstimatorText(language, 'sourceVersion', {version: sourceQuoteVersionNumber ?? 1})}</span><span className="lite-desktop-only">Costing v{sourceQuoteVersionNumber ?? 1}</span></> : <>Costing v{sourceQuoteVersionNumber ?? 1}</>}</span>
                                    )}
                                </div>
                                <p className="mt-1 text-[11px] font-medium leading-4 text-[var(--color-muted)]">
                                    {tx(appliedTemplate ? 'Saved recipe loaded. Review rates before saving.' : 'New construction. Enter the required inputs below.')}
                                    <span className="mt-1 block">{tx('Quick and Detailed use the same calculation. Detailed shows additional assumptions.')}</span>
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <LiquidSegmented
                                    role="tablist"
                                    aria-label={liteMode ? liteEstimatorText(language, 'mode') : freeMode ? freeMobileText(language, 'mode') : entryMode === 'quick' ? tx('Quick Costing · same calculation engine') : tx('Full technical inputs & factory assumptions · same calculation engine')}
                                    data-tutorial-section={1}
                                    data-estimator-field="entryMode"
                                    value={entryMode}
                                    onValueChange={handleEntryModeChange}
                                    options={[
                                        { value: 'quick', label: freeMode ? freeText(language, 'quick') : 'Quick', controls: 'estimator-form-panel', title: tx('Quick Costing · same calculation engine') },
                                        { value: 'detailed', label: tx('Detailed'), controls: 'estimator-form-panel', title: tx('Full technical inputs & factory assumptions · same calculation engine') },
                                    ]}
                                />
                            </div>
                        </div>
                        <button
                            ref={qualityPickerTriggerRef}
                            type="button"
                            data-testid="saved-quality-quick-picker"
                            disabled={freeMode}
                            style={freeMode ? {display:'none'} : undefined}
                            data-tutorial-section={10}
                            data-estimator-field="savedQualities"
                            data-slot="card"
                            onClick={() => setShowQualityLibrary(true)}
                            aria-haspopup="dialog"
                            aria-expanded={showQualityLibrary}
                            aria-label={liteMode ? liteEstimatorText(language, templatesLoaded && templates.length > 0 ? 'count' : 'browse', {count: templates.length}) : templatesLoaded && templates.length > 0 ? `Tap to view ${templates.length} saved ${templates.length === 1 ? 'quality' : 'qualities'}` : tx('Saved qualities library')}
                            className="mt-3 flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] border border-[var(--color-hairline)] bg-[var(--color-surface-soft)]/60 px-3.5 py-2.5 text-left transition-colors hover:border-[var(--color-yarn-orange)]/45 hover:bg-[var(--color-warning-amber-soft)]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-yarn-orange)]/35"
                        >
                            <span className="min-w-0">
                                <span className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-muted)]">{liteMode ? <><span className="lite-mobile-only" data-i18n-skip="true">{liteEstimatorText(language, 'qualities')}{templatesLoaded && templates.length > 0 ? ` · ${templates.length}` : ''}</span><span className="lite-desktop-only">Saved qualities</span></> : 'Saved qualities'}</span>
                                <span className="lite-quality-picker-description mt-0.5 block truncate text-[12px] font-medium text-[var(--color-body)]">
                                    {templatesLoaded && templates.length > 0
                                        ? `Tap to view ${templates.length} saved ${templates.length === 1 ? 'quality' : 'qualities'}`
                                        : tx('Tap to browse saved qualities library or save this recipe')}
                                </span>
                            </span>
                            <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--color-yarn-orange-dark)]">
                                {templatesLoaded && templates.length > 0 ? 'View' : 'Open'}
                                <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                            </span>
                        </button>
                        <div data-testid="costing-validity" data-free-incomplete={freeIncompleteBeforeSubmit || undefined} data-lite-incomplete={litePristineIncomplete || undefined} className={`mt-3 flex min-h-10 items-center gap-2 rounded-[10px] border px-3 py-2 text-[11px] leading-4 ${validityStatus.className}`} role="status" aria-live="polite">
                            <validityStatus.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                            <span className="font-semibold">{litePristineIncomplete ? <><span className="lite-mobile-only" data-i18n-skip="true">{liteEstimatorText(language, 'complete')}</span><span className="lite-desktop-only">{validityStatus.label}</span></> : freeIncompleteBeforeSubmit ? <><span className="free-mobile-only">{freeMobileText(language, 'complete')}</span><span className="free-desktop-only">{validityStatus.label}</span></> : validityStatus.label}</span>
                            <span className="hidden font-medium opacity-85 sm:inline">{validityStatus.description}</span>
                        </div>
                        {freeMode && awaitingCalculation && estimatorValidation.valid && (
                            <Button className="mt-3 h-auto min-h-11 w-full whitespace-normal" disabled={!freeCanCalculate} onClick={() => void handleSaveQuote()}>
                                <Calculator className="mr-2 h-4 w-4 shrink-0" />
                                {topCostingActionLabel}
                            </Button>
                        )}
                    </section>

                    <SheetContent
                        id="saved-qualities-sheet-panel"
                        data-lite-quality-sheet={liteMode || undefined}
                        side="bottom"
                        hideOverlay={isTutorialActive}
                        showCloseButton={!isTutorialActive}
                        onCloseAutoFocus={(e) => {
                            if (liteMode && !isTutorialActive) {
                                e.preventDefault()
                                if (!showConfirmNewQuality && !pendingQualityChange) {
                                    qualityPickerTriggerRef.current?.focus()
                                }
                            }
                        }}
                        onOpenAutoFocus={(e) => {
                            if (isTutorialActive) {
                                e.preventDefault()
                            }
                        }}
                        onPointerDownOutside={(e) => {
                            if (isTutorialActive) {
                                e.preventDefault()
                            }
                        }}
                        onInteractOutside={(e) => {
                            if (isTutorialActive) {
                                e.preventDefault()
                            }
                        }}
                        className={`max-h-[min(88dvh,48rem)] overflow-y-auto rounded-t-[22px] border-x-0 border-b-0 px-0 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-0 md:top-1/2 md:bottom-auto md:left-1/2 md:right-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[min(calc(100vw-3rem),48rem)] md:rounded-[22px] md:border md:border-[var(--color-hairline)] ${isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''}`}
                    >
                        <SheetHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-warning-amber-soft)]/70 px-5 pb-4 pt-5 pr-16 text-left">
                            <SheetTitle className="text-[17px]">{tx('Change quality')}</SheetTitle>
                            <SheetDescription className="text-[12px] font-medium text-[var(--color-muted)]">Search and select a saved fabric recipe. Your current costing stays in place until you choose one.</SheetDescription>
                        </SheetHeader>
                        <div className="p-4 sm:p-5">
                            {liteMode && <Button variant="outline" className="lite-mobile-only mb-3 h-auto min-h-11 whitespace-normal" onClick={() => { setShowQualityLibrary(false); setShowConfirmNewQuality(true) }} data-i18n-skip="true"><Plus className="h-4 w-4" />{liteEstimatorText(language, 'new')}</Button>}
                            {liteMode && !templatesLoaded && <p className="lite-mobile-only mb-3 text-sm" role="status">{tx('Loading saved qualities…')}</p>}
                            {templatesLoaded && templates.length > 0 && (
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" />
                                    <input
                                        type="search"
                                        value={templateSearch}
                                        onChange={e => setTemplateSearch(e.target.value)}
                                        placeholder={t('estimator.quality.searchPlaceholder').replace('{count}', String(templates.length))}
                                        aria-label={tx('Search saved qualities')}
                                        className="h-12 w-full rounded-[11px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-10 pr-10 text-[13px] font-medium text-[var(--color-ink)] placeholder:font-normal placeholder:text-[var(--color-placeholder)] placeholder:font-normal focus:border-[var(--color-yarn-orange)] focus:outline-none focus:ring-2 focus:ring-[var(--color-yarn-orange)]/15"
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
                    data-estimator-field="savedQualityPicker"
                    aria-labelledby="saved-qualities-title"
                    aria-busy={!templatesLoaded}
                    className="ui-focus-surface mt-4 overflow-hidden rounded-[16px] border border-[var(--color-hairline)] bg-white/95 shadow-[var(--shadow-card)]"
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
                            <div className="rounded-[12px] border border-[var(--wv-ochre-200)] bg-[var(--wv-ochre-50)] px-3.5 py-3.5 text-xs font-medium text-[var(--wv-ochre-900)]" role="status">
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
                                    <div
                                        id="saved-quality-rail"
                                        className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2"
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
                                                className={`group flex w-full min-w-0 items-stretch overflow-hidden rounded-[12px] border transition-colors ${
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
                                                        <span title={tpl.name} className={`block line-clamp-2 break-words text-[13px] font-bold leading-5 ${isActive ? 'text-[var(--color-yarn-orange-dark)]' : 'text-[var(--color-ink)]'}`}>{tpl.name}</span>
                                                        {(() => {
                                                            const cue = buildQualityConstructionCue(tpl)
                                                            return cue ? <span data-quality-cue className="mt-0.5 block break-words font-mono text-[10px] font-semibold leading-4 text-[var(--color-body)]">{cue}</span> : null
                                                        })()}
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

                {entryMode === 'quick' && !showAdvancedOverhead ? (
                    <div key="quick" className="ui-content-swap">
                    <QuickCostingView
                        constructionFields={constructionFields}
                        state={state}
                        dispatch={dispatch}
                        totals={totals}
                        costingResult={costingResult}
                        hasValidCostResult={hasValidCostResult}
                        qualityLabel={qualityLabel}
                        setQualityLabel={setQualityLabelFromUser}
                        qualityLocked={Boolean(appliedTemplate)}
                        widthUnit={widthUnit}
                        onWidthUnitChange={setWidthUnit}
                        onOpenOverheadDetails={() => setShowAdvancedOverhead(true)}
                        onOverheadModeChange={handleOverheadModeChange}
                        weavingRateInputMode={weavingRateInputMode}
                        onWeavingRateInputModeChange={setWeavingRateInputMode}
                        directWeavingRateInput={directWeavingRateInput}
                        onDirectWeavingRateInputChange={setDirectWeavingRateInput}
                        savedYarnOptions={savedYarnOptions}
                        unverifiedYarnRows={unverifiedYarnRows}
                        onConfirmYarnVerification={handleConfirmYarnVerification}
                        onYarnFieldManualEdit={handleYarnFieldManualEdit}
                        onSelectWarpYarn={handleSelectWarpYarn}
                        onSelectWeftYarn={handleSelectWeftYarn}
                    />
                    </div>
                ) : (
                <div
                    key="detailed"
                    className="ui-content-swap space-y-7"
                    data-enter-navigate-container="true"
                    onKeyDown={handleEnterKeyNavigation}
                >
                {/* 1. Costing Basics */}
                <EstimatorCard accent="neutral">
                    <SectionHeader title={t('estimator.order_basics.title')} icon={Layers} accent="neutral" step={1} tutorialSection={2} />
                    <CardContent className="p-4 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Fabric / Quality Name (visible in both modes) */}
                            <div className="col-span-1 md:col-span-2 space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-[var(--wv-neel-500)]">
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
                                    }}
                                    placeholder="e.g. 60g Georgette, D.246, Japan Satin"
                                    className="font-bold border-[var(--wv-cotton-400)] h-11"
                                />
                                <p className="text-[10px] text-[var(--wv-cotton-500)] font-medium leading-normal">
                                    {appliedTemplate ? t('estimator.sprint1.saved_quality_name_stable') : t('estimator.quality.fabricQualityNameHelper')}
                                </p>
                            </div>
                        </div>

                        <div className="border-t border-[var(--wv-cotton-200)] pt-1">
                            <YarnComponentCountFields
                                warpCount={state.warpRows.length}
                                weftCount={state.weftRows.length}
                                dispatch={dispatch}
                            />
                        </div>

                        {constructionFields}
                        {/* Global Defaults Block */}
                        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-4 rounded-[13px] border border-[#D7E7F1] bg-[#F7FBFD] p-4">
                            <div className="min-w-0">
                                <StepperField
                                    fieldKey="warpCrimpPct"
                                    label="Warp Crimp (Take-up)"
                                    value={state.warpCrimpPct || 0}
                                    onChange={v => dispatch({ type: 'SET', field: 'warpCrimpPct', value: v })}
                                    hint="Beam shrink relative to tape length"
                                    accent="warp"
                                />
                            </div>
                            <div className="min-w-0">
                                <StepperField
                                    fieldKey="yarnShortagePct"
                                    label="Default Yarn Waste"
                                    value={state.yarnShortagePct || 0}
                                    onChange={v => dispatch({ type: 'SET', field: 'yarnShortagePct', value: v })}
                                    ghostValue={0}
                                    ghostPlaceholder="0"
                                    placeholderKind="applied-default"
                                    hint="Blank row waste uses this default. Row value 0 means no waste."
                                    accent="warp"
                                />
                            </div>
                            <div className="col-span-full flex items-center gap-4 border-t border-[#D7E7F1] pt-4">
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

                    </CardContent>
                </EstimatorCard>

                {/* 2. Warp Yarn Rows */}
                <EstimatorCard accent="warp">
                    <SectionHeader
                        title={t('estimator.warp.title')}
                        icon={Sparkles}
                        accent="warp"
                        step={2}
                        tutorialSection={3}
                        detail={<p className="text-[11px] text-[var(--color-muted)]">Default rows: {state.warpCrimpPct || 0}% crimp + {state.yarnShortagePct || 0}% waste → <span className="font-semibold text-[var(--color-warning-amber)]">{(state.warpCrimpPct || 0) + (state.yarnShortagePct || 0)}% total</span></p>}
                        badgeContent={<SectionCostPill value={totals.yarnBaseWarpPerM} valid={hasValidCostResult} />}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="space-y-4">
                            {state.warpRows.map((row, i) => {
                                const unverified = unverifiedYarnRows[row.id]
                                return (
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
                                    unverifiedNotice={unverified ? {
                                        denier: unverified.denier,
                                        rate: unverified.rate,
                                        denierVal: unverified.autoFilledDenier,
                                        rateVal: unverified.autoFilledRate,
                                        yarnName: unverified.yarnName,
                                    } : undefined}
                                    onConfirmVerification={() => handleConfirmYarnVerification(row.id)}
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
                                        suggestions={savedYarnOptions}
                                        preferredCategory="yarn_warp"
                                        onSelectYarn={yarn => handleSelectWarpYarn(row.id, yarn)}
                                        onChange={value => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'label', value })}
                                    />
                                    {row.calculationMode === 'manual' ? (
                                        <NumField fieldKey="manualKgPer100m" label="Warp Yarn consumption (kg/100m)" value={row.manualKgPer100m ?? null} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'manualKgPer100m', value: v })} unit="kg" step={0.001} placeholder="e.g. 3.25" hint="Kilograms of Warp Yarn needed for 100 metres; not m/kg yield." attentionWhenEmpty />
                                    ) : (
                                        <>
                                            <YarnDensityFields
                                                row={row}
                                                needsVerification={unverified?.denier}
                                                onChange={(field, value) => {
                                                    if (field === 'calcDenier') {
                                                        handleYarnFieldManualEdit(row.id, 'calcDenier')
                                                    }
                                                    dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field, value })
                                                }}
                                            />
                                            <NumField fieldKey="beamEnds" label={`${t('estimator.field_labels.beam_ends')} — REQUIRED`} value={row.beamEnds} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'beamEnds', value: v ?? 0 })} placeholder="e.g. 3200" attentionWhenEmpty />
                                        </>
                                    )}
                                    <NumField fieldKey="shortagePct" label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} placeholderKind="applied-default" hint={`Blank uses ${state.yarnShortagePct}% default; 0 overrides`} warning={row.shortagePct !== null && row.shortagePct > 15 ? 'High waste %' : undefined} />
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
                                                onChange={v => {
                                                    handleYarnFieldManualEdit(row.id, 'yarnRate')
                                                    dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })
                                                }} 
                                                step={1}
                                                placeholder="e.g. 110"
                                                attentionWhenEmpty
                                                needsVerification={unverified?.rate}
                                                warning={isUnusuallyLow && !isDismissed ? 'Unusually low' : undefined}
                                                onDismissWarning={() => setDismissedWarnings(prev => [...prev, warningId])}
                                            />
                                        )
                                    })()}
                                    <NumField fieldKey="gstPct" label={t('estimator.field_labels.gst_pct')} value={row.gstPct} onChange={v => dispatch({ type: 'UPDATE_WARP_ROW', id: row.id, field: 'gstPct', value: v ?? 0 })} step={0.5} placeholder="e.g. 5" />
                                </RowCard>
                            )})}
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-14 w-full rounded-[12px] border-dashed border-[#C6D9EA] bg-[#F7FBFD] text-[var(--color-info-blue)] hover:border-[var(--color-info-blue)] hover:bg-[#EEF5FB] transition-all gap-2"
                            onClick={() => dispatch({ type: 'ADD_WARP_ROW' })}
                        >
                            <Plus className="h-4 w-4" /> {t('estimator.warp.add_blend')}
                        </Button>
                    </CardContent>
                </EstimatorCard>

                {/* 3. Weft Yarn Rows */}
                <EstimatorCard accent="weft">
                    <SectionHeader 
                        title={t('estimator.weft.title')} 
                        icon={Scissors} 
                        accent="weft"
                        step={3}
                        tutorialSection={4}
                        badgeContent={
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] p-0.5 shadow-[0_1px_2px_rgba(30,37,40,0.03)]">
                                    <button
                                        type="button"
                                        onClick={() => setWidthUnit('cm')}
                                        aria-pressed={widthUnit === 'cm'}
                                        className={`mobile-touch-target px-2.5 py-1 text-[11px] font-semibold uppercase rounded-md transition-all ${
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
                                        aria-pressed={widthUnit === 'inch'}
                                        className={`mobile-touch-target px-2.5 py-1 text-[11px] font-semibold uppercase rounded-md transition-all ${
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
                            const appliedWaste = state.weftRows.map(row => row.shortagePct ?? state.yarnShortagePct)
                            const appliedWasteLabel = appliedWaste.map((value, index) => `Row ${index + 1}: ${Number(value).toFixed(1)}%`).join(' · ')
                            const effectiveWasteLabel = state.weftRows.map((row, index) => {
                                const auditRow = awaitingCalculation ? undefined : totals.weftRows[index]
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
                                const unverified = unverifiedYarnRows[row.id]

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
                                        unverifiedNotice={unverified ? {
                                            denier: unverified.denier,
                                            rate: unverified.rate,
                                            denierVal: unverified.autoFilledDenier,
                                            rateVal: unverified.autoFilledRate,
                                            yarnName: unverified.yarnName,
                                        } : undefined}
                                        onConfirmVerification={() => handleConfirmYarnVerification(row.id)}
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
                                            suggestions={savedYarnOptions}
                                            preferredCategory="yarn_weft"
                                            onSelectYarn={yarn => handleSelectWeftYarn(row.id, yarn)}
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
                                                needsVerification={unverified?.denier}
                                                onChange={(field, value) => {
                                                    if (field === 'calcDenier') {
                                                        handleYarnFieldManualEdit(row.id, 'calcDenier')
                                                    }
                                                    dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field, value })
                                                }}
                                            />
                                        )}
                                        <NumField fieldKey="shortagePct" label="Waste %" value={row.shortagePct} onChange={v => dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'shortagePct', value: v })} unit="%" step={0.5} preserveZero placeholder={String(state.yarnShortagePct ?? 0)} placeholderKind="applied-default" hint={`Blank uses ${state.yarnShortagePct}% default; 0 overrides`} warning={row.shortagePct !== null && row.shortagePct > 15 ? 'High waste %' : undefined} />
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
                                                    onChange={v => {
                                                        handleYarnFieldManualEdit(row.id, 'yarnRate')
                                                        dispatch({ type: 'UPDATE_WEFT_ROW', id: row.id, field: 'yarnRate', value: v ?? 0 })
                                                    }}
                                                    placeholder="e.g. 110"
                                                    attentionWhenEmpty
                                                    needsVerification={unverified?.rate}
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
                    <SectionHeader title={t('estimator.weave.title')} icon={Gauge} accent="weave" step={4} tutorialSection={5} badgeContent={<SectionCostPill value={totals.weaveCostPerM} valid={hasValidCostResult} />} />
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
                    <SectionHeader title={t('estimator.warping_sizing.title')} icon={TrendingUp} accent="post" step={5} tutorialSection={6} badgeContent={<SectionCostPill value={totals.warpingAndSizingPerM} valid={hasValidCostResult} />} />
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
                                    <LiquidSegmented data-estimator-field="warpingMode" aria-label="Warping method" fullWidth value={state.warpingMode} onValueChange={value => dispatch({ type: 'SET', field: 'warpingMode', value })} options={[{ value: 'in_house', label: 'In-house', id: 'warping-mode-in-house' }, { value: 'outsourced', label: 'Outsourced', id: 'warping-mode-outsourced' }]} />
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
                                    <LiquidSegmented data-estimator-field="sizingMode" aria-label="Sizing method" fullWidth value={state.sizingMode} onValueChange={value => dispatch({ type: 'SET', field: 'sizingMode', value })} options={[{ value: 'in_house', label: 'In-house', id: 'sizing-mode-in-house' }, { value: 'outsourced', label: 'Outsourced', id: 'sizing-mode-outsourced' }]} />
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

                        <div className="text-[10px] font-medium text-[var(--wv-cotton-500)] italic">
                            {t('estimator.warping_sizing.applied_on')} {hasValidCostResult && !awaitingCalculation ? totals.totalWarpKgPer100m.toFixed(2) : '—'} {t('estimator.warping_sizing.warp_consumption')}
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
                        tutorialSection={7}
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

                            <div className="space-y-2">
                        <LiquidSegmented
                            fullWidth
                            aria-label="Factory overhead method"
                            optionClassName="whitespace-normal py-2 text-center"
                            value={state.overheadMode}
                            onValueChange={handleOverheadModeChange}
                            options={[
                                { value: 'direct', label: 'Direct overhead rate', attrs: { 'data-estimator-field': 'directOverheadMethod' } },
                                { value: 'monthly_expenses', label: 'Calculate from monthly expenses', attrs: { 'data-estimator-field': 'monthlyOverheadMethod' } },
                            ]}
                        />
                        <p className="text-[11px] leading-relaxed text-[var(--color-muted)]" aria-live="polite">
                            {state.overheadMode === 'direct' ? 'Enter the rate used in this costing; it is never inferred.' : 'Use saved expenses and standard monthly production.'}
                        </p>
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
                                                        data-estimator-field="overheadOverridePerM"
                                                        type="number"
                                                        min={0}
                                                        step={0.1}
                                                        placeholder="e.g. 12.50"
                                                        value={state.overheadOverridePerM ?? ''}
                                                        onChange={e => dispatch({ type: 'SET', field: 'overheadOverridePerM', value: parseNonNegativeInput(e.target.value) })}
                                                        aria-label="Direct factory overhead per metre"
                                                        aria-invalid={state.overheadOverridePerM == null || state.overheadOverridePerM <= 0 || undefined}
                                                        className={`h-10 w-full rounded-[9px] pl-8 pr-4 text-sm font-medium placeholder:text-[var(--color-placeholder)] placeholder:font-normal [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/30 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${state.overheadOverridePerM == null || state.overheadOverridePerM <= 0 ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)] text-[var(--color-yarn-orange)]'}`}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {hasValidCostResult && state.overheadOverridePerM != null && state.overheadOverridePerM < monthlyOverheadReference && (
                                            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-dashed border-[var(--color-hairline)]">
                                                <AlertTriangle className="h-3 w-3 text-[var(--wv-ochre-800)] shrink-0" />
                                                <p className="text-[10px] font-bold text-[var(--wv-ochre-800)] leading-tight">
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
                                    <p className="mt-1 text-[11px] leading-relaxed text-[var(--color-muted)]">Saved rent, power, salaries, and other expenses are divided by standard monthly production. Open the expense editor to review them.</p>
                                    <p className="mt-2 text-[11px] font-semibold text-[var(--color-factory-green)]">Current calculated overhead: {formatCalculatedMoney(costingResult.overheadPerM, hasValidCostResult, '/m')}</p>
                                </div>
                            )}
                        </div>

                        {state.overheadMode === 'direct' && (
                            <p className="rounded-md bg-[var(--color-surface-soft)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--color-muted)]">
                                The direct ₹/m rate is active for this costing. Monthly expenses stay saved as a reference and will be used when you switch back to monthly-expense mode.
                            </p>
                        )}

                        {/* Monthly expense editor trigger */}
                                        <div className="border-t border-[var(--color-hairline)] pt-4">
                                            <button
                                                data-estimator-field="monthlyOverhead"
                                                type="button"
                                                onClick={() => setShowAdvancedOverhead(true)}
                                                aria-haspopup="dialog"
                                                className="flex items-center justify-between w-full rounded-lg bg-[var(--color-surface-soft)] px-3 py-2 text-xs font-bold text-[var(--color-body)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface)] transition-all"
                                            >
                                                <span className="flex items-center gap-2">
                                                    <Calculator className="h-3.5 w-3.5 text-[var(--color-yarn-orange)]" />
                                                    <span>Monthly expenses</span>
                                                </span>
                                                <div className="flex items-center gap-2">
                                                    {totals.overheadTotalMonthly > 0 && (
                                                        <span className="text-[10px] font-mono text-[var(--color-muted)] font-normal mr-2">
                                                             Total: ₹{totals.overheadTotalMonthly.toLocaleString('en-IN')}/mo
                                                        </span>
                                                    )}
                                                    <ChevronRight className="h-4 w-4 text-[var(--wv-cotton-500)]" />
                                                </div>
                                            </button>
                                        </div>

                                        {/* Owner-entered monthly expense dialog */}
                                        <Dialog
                                            open={showAdvancedOverhead}
                                            onOpenChange={(nextOpen) => {
                                                if (isTutorialActive && !nextOpen) {
                                                    return
                                                }
                                                setShowAdvancedOverhead(nextOpen)
                                            }}
                                            modal={!isTutorialActive}
                                        >
                                            <DialogContent
                                                id="monthly-expenses-dialog-panel"
                                                hideOverlay={isTutorialActive}
                                                showCloseButton={!isTutorialActive}
                                                onOpenAutoFocus={(e) => {
                                                    if (isTutorialActive) {
                                                        e.preventDefault()
                                                    }
                                                }}
                                                onPointerDownOutside={(e) => {
                                                    if (isTutorialActive) {
                                                        e.preventDefault()
                                                    }
                                                }}
                                                onInteractOutside={(e) => {
                                                    if (isTutorialActive) {
                                                        e.preventDefault()
                                                    }
                                                }}
                                                className={`max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-4xl ${isTutorialActive ? '!animate-none !transition-none data-[state=open]:!animate-none data-[state=open]:!transition-none' : ''}`}
                                            >
                                                <DialogHeader className="border-b border-[var(--color-hairline)] bg-[var(--color-warning-amber-soft)]/70 px-5 pb-4 pt-5 pr-14 text-left sm:px-6">
                                                    <DialogTitle className="flex items-center gap-2 text-[17px]">
                                                        <Calculator className="h-4 w-4 text-[var(--color-yarn-orange)]" />
                                                        Monthly expenses
                                                    </DialogTitle>
                                                    <DialogDescription className="text-[12px]">
                                                        Enter your typical monthly expenses and a rough estimate of total monthly production. These two figures determine the overhead per metre.
                                                    </DialogDescription>
                                                </DialogHeader>
                                                <div id="estimator-monthly-expenses" className="min-h-0 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
                                                <div data-estimator-field="monthlyExpensesBreakdown" className="space-y-2">
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <div>
                                                            <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted)]">Monthly expenses</p>
                                                            <p className="mt-1 text-[10px] text-[var(--color-muted)]">Enter the rupee amount you expect to pay in a typical month.</p>
                                                        </div>
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

                                                            return (
                                                                <div key={item.id} className="group relative py-2.5">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="flex-1">
                                                                            <Input
                                                                                value={!isPreset && item.label === 'New Item' ? '' : item.label}
                                                                                placeholder={!isPreset && item.label === 'New Item' ? 'Item name' : undefined}
                                                                                disabled={isPreset}
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'label', value: e.target.value })}
                                                                                className={`h-7 border-0 bg-transparent p-0 text-[13px] font-medium placeholder:text-[var(--color-placeholder)] placeholder:font-normal focus:ring-0 ${isPreset ? 'text-[var(--color-ink)]' : 'text-[var(--color-muted)]'}`}
                                                                            />
                                                                        </div>

                                                                        <div className="relative shrink-0 w-32">
                                                                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">₹</span>
                                                                            <Input
                                                                                type="number"
                                                                                value={item.monthlyAmount === 0 ? '' : item.monthlyAmount}
                                                                                placeholder="e.g. 25,000"
                                                                                onChange={e => dispatch({ type: 'UPDATE_OVERHEAD_ITEM', id: item.id, field: 'monthlyAmount', value: parseNonNegativeInput(e.target.value) ?? 0 })}
                                                                                className="h-8 min-w-[120px] rounded-[7px] border border-[var(--color-hairline)] bg-[var(--color-canvas-white)] pl-6 pr-9 text-right text-[11px] font-medium text-[var(--color-yarn-orange)] placeholder:text-[var(--color-placeholder)] placeholder:font-normal [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                                                            />
                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-[var(--color-muted)] font-medium pointer-events-none">/mo</span>
                                                                        </div>

                                                                        {!isPreset && (
                                                                            <button 
                                                                                type="button"
                                                                                onClick={() => dispatch({ type: 'REMOVE_OVERHEAD_ITEM', id: item.id })}
                                                                                className="text-[var(--wv-cotton-400)] hover:text-[var(--wv-madder-600)] opacity-0 group-hover:opacity-100 transition-all"
                                                                            >
                                                                                <Trash2 className="h-3.5 w-3.5" />
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="space-y-4 border-t border-[var(--color-hairline)] pt-4">
                                                    <div data-estimator-field="monthlyProductionM" className="space-y-1.5">
                                                        <Label className={`text-[10px] font-medium uppercase ${state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) ? 'text-[var(--color-warning-amber)]' : 'text-[var(--color-muted)]'}`}>Typical monthly production (m){state.overheadMode === 'monthly_expenses' ? ' — REQUIRED' : ''}</Label>
                                                        <div className="relative">
                                                            <Input
                                                                type="number"
                                                                value={state.monthlyOutputM || ''}
                                                                placeholder="e.g. 90,000"
                                                                onChange={e => dispatch({ type: 'SET', field: 'monthlyOutputM', value: parseNonNegativeInput(e.target.value) ?? 0 })}
                                                                aria-invalid={state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) || undefined}
                                                                className={`h-10 rounded-[9px] pr-9 text-center text-sm font-medium placeholder:text-[var(--color-placeholder)] placeholder:font-normal [appearance:textfield] focus:border-[var(--color-yarn-orange)] focus:ring-1 focus:ring-[var(--color-yarn-orange)]/15 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) ? 'border-[var(--color-warning-amber)] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)] placeholder:text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-canvas-white)] text-[var(--color-yarn-orange)]'}`}
                                                            />
                                                            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-[var(--color-muted)] font-medium pointer-events-none">m/mo</span>
                                                        </div>
                                                        <p className="text-[10px] leading-relaxed text-[var(--color-muted)]">Use a normal, representative month. This is an owner estimate, not a machine-capacity calculation.</p>
                                                        {state.overheadMode === 'monthly_expenses' && (!state.monthlyOutputM || state.monthlyOutputM <= 0) && (
                                                            <p className="text-[10px] font-semibold text-[var(--color-warning-amber)]">Required for monthly-expense overhead.</p>
                                                        )}
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">Total monthly expenses</p>
                                                            <p className={`text-base font-semibold ${totals.overheadTotalMonthly <= 0 ? 'text-[var(--color-risk-red)]' : 'text-[var(--color-ink)]'}`}>
                                                                ₹{totals.overheadTotalMonthly.toLocaleString('en-IN')}
                                                            </p>
                                                        </div>
                                                        <div className="rounded-[9px] bg-[var(--color-surface-soft)] px-3 py-2.5">
                                                            <p className="text-[10px] text-[var(--color-muted)]">Expense-derived overhead</p>
                                                            <p className={`text-base font-semibold ${monthlyOverheadReference > 0 ? 'text-[var(--color-factory-green)]' : 'text-[var(--color-ink)]'}`}>{formatCalculatedMoney(monthlyOverheadReference, state.monthlyOutputM > 0, '/m')}</p>
                                                        </div>
                                                    </div>
                                                    {isZeroConfig && (
                                                        <p className="text-[11px] text-[var(--color-warning-amber)]">Factory expense items total is zero. Estimates may miss fixed cost recovery.</p>
                                                    )}
                                                </div>
                                                </div>
                                                <DialogFooter className="border-t border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-5 py-3 sm:px-6" showCloseButton={!isTutorialActive}>
                                                    <Button type="button" onClick={() => void handleSaveProfile()} disabled={saving || freeMode} hidden={freeMode}>
                                                        {saving ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Save className="mr-1 h-3 w-3" />}
                                                        {t('estimator.sprint1.save_baseline')}
                                                    </Button>
                                                </DialogFooter>
                                            </DialogContent>
                                        </Dialog>

                                        {/* Live Summary */}
                                        <div className="flex items-center justify-between bg-[var(--wv-madder-50)]/70 border border-[var(--wv-madder-200)]/70 rounded-xl px-4 py-3">
                                            <div>
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--wv-madder-600)]/80 leading-none mb-1">{t('estimator.overhead.overhead_per_m')}</p>
                                                <p className="text-2xl font-semibold font-mono text-[var(--wv-madder-600)] leading-none">{formatCalculatedMoney(costingResult.overheadPerM, hasValidCostResult)}</p>
                                                {state.overheadOverridePerM != null && state.overheadOverridePerM > 0 && (
                                                    <p className="text-[9px] text-[var(--wv-ochre-800)] font-bold mt-0.5">⚡ direct rate selected</p>
                                                )}
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--wv-neel-500)] leading-none mb-1">Method</p>
                                                <p className="text-sm font-semibold text-[var(--wv-neel-700)] leading-tight">{state.overheadMode === 'direct' ? 'Direct rate' : 'Monthly expenses'}</p>
                                                <p className="text-[9px] text-[var(--wv-cotton-500)] mt-0.5">{state.overheadMode === 'direct' ? 'saved ₹/m input' : 'saved expenses ÷ output'}</p>
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
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'winding' })} className="h-10 rounded-xl border border-dashed border-[var(--wv-cotton-300)] text-[10px] font-bold text-[var(--wv-cotton-500)] flex items-center justify-center gap-1.5 hover:bg-[var(--wv-cotton-100)] hover:text-[var(--wv-neel-600)] transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.winding')}</button>
                            )}
                            {state.enabledSections.processing ? (
                                <NumField fieldKey="processingRatePerM" label={t('estimator.field_labels.dyeing_processing')} value={state.processingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'processingRatePerM', value: v ?? 0 })} unit="₹/m" placeholder="e.g. 2" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'processing' })} className="h-10 rounded-xl border border-dashed border-[var(--wv-cotton-300)] text-[10px] font-bold text-[var(--wv-cotton-500)] flex items-center justify-center gap-1.5 hover:bg-[var(--wv-cotton-100)] hover:text-[var(--wv-neel-600)] transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.processing')}</button>
                            )}
                            {state.enabledSections.finishing ? (
                                <NumField fieldKey="finishingRatePerM" label={t('estimator.field_labels.finishing_per_m')} value={state.finishingRatePerM} onChange={v => dispatch({ type: 'SET', field: 'finishingRatePerM', value: v ?? 0 })} unit="₹/m" placeholder="e.g. 1.50" />
                            ) : (
                                <button onClick={() => dispatch({ type: 'ENABLE_SECTION', section: 'finishing' })} className="h-10 rounded-xl border border-dashed border-[var(--wv-cotton-300)] text-[10px] font-bold text-[var(--wv-cotton-500)] flex items-center justify-center gap-1.5 hover:bg-[var(--wv-cotton-100)] hover:text-[var(--wv-neel-600)] transition-all uppercase tracking-widest"><Plus className="h-3 w-3" /> {t('estimator.post_processing.finishing')}</button>
                            )}
                        </div>
                    </CardContent>
                </EstimatorCard>

                {/* 8. Cost Audit */}
                <EstimatorCard accent="neutral" audit>
                    <SectionHeader
                        title="Cost Breakdown"
                        icon={ReceiptText}
                        accent="neutral"
                        step={8}
                        detail={<p className="text-[11px] text-[var(--color-muted)]">{hasValidCostResult ? 'Engine audit used for the final production cost.' : awaitingCalculation && estimatorValidation.valid ? freeText(language, 'resultAfterCalculation') : 'Complete the required inputs to calculate the final production cost.'}</p>}
                        badgeContent={hasValidCostResult
                            ? <SectionCostPill value={totals.audit.productionCostPerMeter} />
                            : <span className="rounded-full border border-[var(--color-hairline)] bg-[var(--color-surface-soft)] px-3 py-1 text-[13px] font-semibold text-[var(--color-muted)]">{costingReadiness.status === 'calculation_required' ? freeText(language, 'readyToCalculate') : 'Incomplete'}</span>}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        {!hasValidCostResult ? (
                            <div id={validationSummaryId} role={showValidation && costingReadiness.status !== 'calculation_required' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-[12px] border p-4 ${showValidation && costingReadiness.status !== 'calculation_required' ? 'border-[#EFD7A4] bg-[var(--color-warning-amber-soft)] text-[var(--color-warning-amber)]' : 'border-[var(--color-hairline)] bg-[var(--color-surface-soft)] text-[var(--color-muted)]'}`}>
                                {costingReadiness.status === 'calculation_required' ? <Calculator className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
                                <div>
                                    <p className="text-sm font-semibold">{awaitingCalculation && estimatorValidation.valid ? validityStatus.label : 'Costing incomplete'}</p>
                                    <p className="mt-1 text-xs font-medium leading-relaxed">{awaitingCalculation && estimatorValidation.valid ? validityStatus.description : showValidation ? (firstCostingReadinessMessage ?? 'Correct the highlighted inputs to see a reliable cost breakdown.') : 'Enter your fabric quality and yarn numbers to see a reliable cost breakdown.'}</p>
                                    {!(awaitingCalculation && estimatorValidation.valid) && <p className="mt-1 text-[11px] leading-relaxed">Draft values are not treated as a final result while a required input is blank or zero.</p>}
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

                                <div data-estimator-audit-equation className="mt-3 grid grid-cols-[1fr_auto_1fr_auto_1fr] items-end gap-2 rounded-[10px] border border-[#CDE5D3] bg-[var(--color-factory-green-soft)] p-3">
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
                                <div data-estimator-audit-stack className="mt-2 divide-y divide-[var(--color-hairline)]">
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
                        title={t('estimator.simulation.base_title')}
                        detail={<p className="text-[11px] text-[var(--color-muted)] font-normal">{t('estimator.simulation.base_description')}</p>}
                        icon={Coins}
                        accent="weft"
                        step={9}
                        tutorialSection={8}
                    />
                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <NumField fieldKey="orderQuantityM"
                                label={t('estimator.field_labels.simulation_qty')}
                                value={state.orderQuantityM}
                                onChange={v => dispatch({ type: 'SET', field: 'orderQuantityM', value: v })}
                                unit="m"
                                step={100}
                                placeholder="e.g. 5000"
                                hint="Optional for a saved costing; enter it when you want order-level profit."
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
                metered={freeMode}
                compactLite={liteMode}
                persistenceLabel={liteMode ? litePersistenceLabel : undefined}
                awaitingCalculation={awaitingCalculation}
                inputSections={freeMode ? getFreeCostingSections(estimatorValidation, qualityLabel, warningsAcknowledged) : undefined}
                onSelectSection={section => {
                    if (DETAILED_ESTIMATOR_ISSUE_FIELDS.has(section.field) || findEstimatorIssueTarget(section.field)) jumpToEstimatorIssue(section.field)
                    else {
                        window.setTimeout(() => {
                            const heading = document.querySelector<HTMLElement>(`[data-tutorial-section="${section.number}"]`)
                            heading?.scrollIntoView({ behavior: 'auto', block: 'center' })
                            if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) }
                        }, 80)
                    }
                }}
                open={liveEstimateOpen}
                onOpenChange={setLiveEstimateOpen}
                isTutorialActive={isTutorialActive}
                visible={mobileCostingShortcutVisible}
                keyboardVisible={mobileKeyboardVisible}
                activeName={freeMode && freeMeter.completed ? freeMeter.completed.label : liteMode ? qualityLabel.trim() || liteEstimatorText(language, 'new') : appliedTemplate?.name ?? (qualityLabel.trim() || 'New quality')}
                freeSnapshot={freeMode && freeMeter.completed ? { label: freeMeter.completed.label, revision: freeMeter.completed.editWindow?.revision ?? 1 } : undefined}
                versionLabel={freeMode && freeMeter.completed ? `v${freeMeter.completed.editWindow?.revision ?? 1}` : sourceQuoteId && sourceRecordKind === 'costing'
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
                breakEvenPricePerM={hasValidCostResult && (freeMode || breakEvenScenario?.quotePricePerM != null) ? costingResult.breakEvenPricePerM : null}
                missingIssueCount={estimatorValidation.issues.length}
                needsReview={costingReadiness.status === 'blocked' || costingReadiness.status === 'warning_ack_required'}
                readinessMessage={firstCostingReadinessMessage}
                onJumpToInput={jumpToFirstEstimatorIssue}
                hasOrderQty={costingResult.quantityM !== null && costingResult.quantityM > 0}
                expectedProfitTotal={costingResult.expectedProfitTotal}
                assumptions={!freeMode || freeMeter.completed ? (
                    <CostingAssumptionsSummary
                        result={costingResult}
                        expanded={assumptionsExpanded}
                        onToggle={toggleAssumptions}
                    />
                ) : undefined}
                actions={(onDismiss) => (
                    <EstimatorLiveCostActions
                        freeCanCalculate={freeMode ? freeCanCalculate && estimatorValidation.valid && !!qualityLabel.trim() : undefined}
                        savingQuote={savingQuote}
                        savingTemplate={savingTemplate}
                        appliedTemplate={appliedTemplate}
                        hasActiveQualityRecipeChanges={hasActiveQualityRecipeChanges}
                        canPersistCostResult={canPersistCostResult}
                        hasValidCostResult={hasValidCostResult}
                        qualityLabel={qualityLabel}
                        totalProductionCostPerM={totals.totalProductionCostPerM}
                        exportReady={Boolean(exportModel)}
                        firstCostingReadinessMessage={firstCostingReadinessMessage}
                        actionReadinessMessage={actionReadinessMessage}
                        actionReadinessId={actionReadinessId}
                        topCostingActionLabel={topCostingActionLabel}
                        onSaveCosting={() => void handleSaveQuote('draft')}
                        onExport={() => setShowExportDialog(true)}
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

            {showExportDialog && (
                <CostingExportDialog
                    open
                    onOpenChange={open => { setShowExportDialog(open); if (!open) setExportSavedCosting(false) }}
                    model={exportSavedCosting && lastSavedCosting ? lastSavedCosting.model : exportModel}
                    defaultCustomerName=""
                    defaultBusinessName={organizationName}
                    defaultMode={exportSavedCosting ? 'customer' : 'internal'}
                    sourceQuoteId={exportSavedCosting ? lastSavedCosting?.id : undefined}
                    sourceRecordKind={exportSavedCosting ? 'costing' : undefined}
                    documentReference={exportSavedCosting && lastSavedCosting ? `${lastSavedCosting.model.qualityLabel} · v${lastSavedCosting.version}` : undefined}
                    documentSource={exportSavedCosting && lastSavedCosting ? { kind: 'saved', qualityLabel: lastSavedCosting.model.qualityLabel, version: lastSavedCosting.version, savedAt: lastSavedCosting.savedAt } : { kind: 'working' }}
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
                                if (pending) void handleSaveQuote(pending.status, true, undefined, true)
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
                        fullReuse={Boolean(appliedTemplate?.latest_costing_reuse)}
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
                                if (pending) void handleSaveQuote(pending.status, true, 'version_only', true)
                            }}
                        >
                            {t('estimator.sprint1.save_version_only')}
                        </Button>
                        <Button
                            className="bg-[var(--color-yarn-orange)] text-white hover:bg-[var(--color-yarn-orange-dark)]"
                            onClick={() => {
                                const pending = pendingQualityVersionSave
                                setPendingQualityVersionSave(null)
                                if (pending) void handleSaveQuote(pending.status, true, 'version_and_quality', true)
                            }}
                        >
                            {t('estimator.sprint1.save_version_update_quality', { name: appliedTemplate?.name })}
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
                        fullReuse={Boolean(appliedTemplate?.latest_costing_reuse)}
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
                open={!freeMode && showSaveTemplate}
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
                        <DialogTitle>{t('estimator.quality.saveQualityAndCostingTitle')}</DialogTitle>
                        <DialogDescription>{t('estimator.quality.saveQualityAndCostingDescription')}</DialogDescription>
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
                            <p className="text-[var(--color-muted)]">{t('estimator.quality.rateNote')} {t('estimator.quality.saveQualityAndCostingHint')}</p>
                        </div>
                        <CostingSaveReview
                            state={state}
                            result={costingResult}
                            fullReuse
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            rollbackSaveAsNewQualityDialog()
                            setShowSaveTemplate(false)
                            setTemplateSaveError(null)
                        }}>{t('estimator.quality.cancel')}</Button>
                        <Button data-testid="save-quality-and-costing-confirm" className="bg-brand-accent text-white" onClick={() => void handleSaveTemplate()} disabled={savingTemplate} aria-busy={savingTemplate}>
                            {savingTemplate ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            {t('estimator.quality.saveQualityAndCosting')}
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
                        {!renameValue.trim() && <p id="rename-quality-help" className="text-xs font-medium text-[var(--wv-ochre-800)]">{tx('Enter a Fabric Quality name before saving.')}</p>}
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
                                        <div data-estimator-proposed-rate className="relative shrink-0 w-36">
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
                                        <div data-estimator-proposed-rate className="relative shrink-0 w-36">
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
                    {rateUpdateUnknown && (
                        <div data-lite-rate-unknown role="status" className="space-y-3 rounded-xl border border-hairline bg-surface-soft p-3 text-sm text-body">
                            <p className="font-semibold">
                                {rateUpdateCheck === 'conflict'
                                    ? tx('This saved quality changed elsewhere and does not have these rates. Close this and reopen the quality to review its current rates.')
                                    : rateUpdateCheck === 'missing'
                                        ? tx('This saved quality is no longer available.')
                                        : tx('We could not confirm whether the rate update for {name} was saved. Your proposed rates are kept on this page. Check the saved quality before saving again.', { name: rateUpdateUnknown.templateName })}
                            </p>
                            {rateUpdateCheck === 'check_failed' && <p>{tx('Could not check right now. Try again.')}</p>}
                            <p className="text-xs text-[var(--color-muted)]">{tx('This check is kept only while this page is open.')}</p>
                            <div className="flex flex-wrap gap-2">
                                {rateUpdateCheck !== 'conflict' && rateUpdateCheck !== 'missing' && (
                                    <Button type="button" size="sm" onClick={() => void checkUnresolvedRateUpdate()} disabled={rateUpdateCheck === 'checking'} aria-busy={rateUpdateCheck === 'checking'} className="min-h-11">
                                        {rateUpdateCheck === 'checking' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                        {tx('Check saved rates')}
                                    </Button>
                                )}
                                {(rateUpdateCheck === 'conflict' || rateUpdateCheck === 'missing') && (
                                    <Button type="button" size="sm" variant="outline" onClick={discardUnresolvedRateUpdate} className="min-h-11">
                                        {tx('Discard this proposal')}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex flex-col sm:flex-row gap-3 mt-2">
                        <Button
                            variant="ghost" 
                            size="sm" 
                            onClick={() => handleApplyCurrentRates()}
                            disabled={savingRates || Boolean(rateUpdateUnknown)}
                            className="rounded-xl font-bold text-[var(--color-muted)] hover:bg-[var(--color-surface-soft)]"
                        >
                            {tx('Use saved rates')}
                        </Button>
                        <Button 
                            className="bg-brand-accent text-white font-semibold rounded-xl h-12 sm:h-11 shadow-lg shadow-brand-accent/20 hover:shadow-xl hover:shadow-brand-accent/30 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none sm:min-w-[180px]" 
                            onClick={() => void handleSaveRatesAndApply()}
                            disabled={savingRates || Boolean(rateUpdateUnknown)}
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
