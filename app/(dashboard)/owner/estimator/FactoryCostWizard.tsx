'use client'

import { useState } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { 
    Calculator, 
    Zap, 
    ArrowRight, 
    CheckCircle2, 
    Settings2,
    Building2,
    Briefcase,
    X
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type EstimateState, type OverheadItem, ensureOverheadIntegrity } from '@/lib/estimator'
import { validateFactoryCostProfile, type EstimatorValidationIssue } from '@/lib/estimator-validation'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { nanoid } from 'nanoid'
import { parseNonNegativeInput, parseNumericInput } from '@/lib/numeric-input'
import { FACTORY_COST_PRESETS, type FactoryProfileId } from '@/lib/factory-cost-profiles'
import { handleEnterKeyNavigation } from '@/lib/form-navigation'
import { formatEstimatorPlaceholder, type EstimatorPlaceholderKind } from '@/lib/estimator-placeholder'

type FactoryCostWizardData = Partial<EstimateState> & {
    yarnReviewIntervalDays: number
    factoryProfileKey: FactoryProfileId
}

interface FactoryCostWizardProps {
    initialState: EstimateState
    initialYarnReviewIntervalDays: number
    onComplete: (data: FactoryCostWizardData) => Promise<void>
    onDismiss?: () => void
    saving: boolean
}

function getFactoryDefaultValue(label: string, initialState: EstimateState): number {
    switch (label) {
        case 'Warping': return initialState.warpingRatePerKg
        case 'Sizing': return initialState.sizingRatePerKg
        case 'Winding': return initialState.windingRatePerKg
        case 'Processing': return initialState.processingRatePerM
        case 'Finishing': return initialState.finishingRatePerM
        case 'Broker commission': return initialState.commissionPct || 0
        case 'Target margin': return initialState.profitPct || 10
        case 'Transport charge': return initialState.transportPerM
        case 'Warp crimp': return initialState.warpCrimpPct
        case 'Default yarn waste': return initialState.yarnShortagePct
        default: return 0
    }
}

export default function FactoryCostWizard({ initialState, initialYarnReviewIntervalDays, onComplete, onDismiss, saving }: FactoryCostWizardProps) {
    const [step, setStep] = useState<'intro' | 'choice' | 'fast' | 'detailed' | 'detailed-expenses' | 'defaults'>('intro')
    const [setupPath, setSetupPath] = useState<'direct' | 'monthly_expenses'>(initialState.overheadMode === 'direct' ? 'direct' : 'monthly_expenses')
    const [validationError, setValidationError] = useState<string | null>(null)
    const [pendingCompletion, setPendingCompletion] = useState<FactoryCostWizardData | null>(null)
    const [pendingWarnings, setPendingWarnings] = useState<EstimatorValidationIssue[]>([])
    const greyWeaverSections = FACTORY_COST_PRESETS.find(profile => profile.id === 'grey_weaver')?.sections ?? {
        winding: false,
        processing: false,
        finishing: false,
        commission: false,
        transport: false,
    }
    // Weavly costs grey-fabric weaving only; the factory-type chooser was never
    // shown on Free, Lite or Base.
    const [selectedSections] = useState({ ...greyWeaverSections })

    const initialRent = initialState.overheadItems.find(item => item.category === 'rent')?.monthlyAmount ?? 0
    const initialElectricity = initialState.overheadItems.find(item => item.category === 'electricity')?.monthlyAmount ?? 0
    const initialStaff = initialState.overheadItems.find(item => item.category === 'admin')?.monthlyAmount ?? 0
    const initialOtherExpenses = initialState.overheadItems
        .filter(item => !['rent', 'electricity', 'admin'].includes(item.category))
        .reduce((sum, item) => sum + item.monthlyAmount, 0)
    
    // Local state for the wizard inputs
    // A direct rate is a price-changing assumption. Keep it blank until the
    // owner enters one instead of presenting an example as if it were real.
    const [overheadPerM, setOverheadPerM] = useState<number | null>(initialState.overheadOverridePerM ?? null)
    const [loomCount, setLoomCount] = useState<number>(initialState.loomCount || 0)
    const [workingDays, setWorkingDays] = useState<number>(initialState.monthlyWorkingDays || 26)
    const [avgOutput, setAvgOutput] = useState<number>(initialState.avgOutputPerLoomPerDay || 50)
    const [monthlyOutput, setMonthlyOutput] = useState<number>(initialState.monthlyOutputM || 0)
    
    // Monthly expenses for detailed path
    const [rent, setRent] = useState<number>(initialRent)
    const [electricity, setElectricity] = useState<number>(initialElectricity)
    const [staff, setStaff] = useState<number>(initialStaff)
    const [others, setOthers] = useState<number>(initialOtherExpenses)
    const [warpingRate, setWarpingRate] = useState<number>(initialState.warpingRatePerKg)
    const [sizingRate, setSizingRate] = useState<number>(initialState.sizingRatePerKg)
    const [windingRate, setWindingRate] = useState<number>(initialState.windingRatePerKg)
    const [processingRate, setProcessingRate] = useState<number>(initialState.processingRatePerM)
    const [finishingRate, setFinishingRate] = useState<number>(initialState.finishingRatePerM)
    const [commissionPct, setCommissionPct] = useState<number>(initialState.commissionPct || 0)
    const [marginPct, setMarginPct] = useState<number>(initialState.profitPct || 10)
    const [yarnReviewIntervalDays, setYarnReviewIntervalDays] = useState<number>(initialYarnReviewIntervalDays || 90)
    const [transportRate, setTransportRate] = useState<number>(initialState.transportPerM)
    const [warpCrimpPct, setWarpCrimpPct] = useState<number>(initialState.warpCrimpPct)
    const [yarnWastePct, setYarnWastePct] = useState<number>(initialState.yarnShortagePct)

    const capacityInputsReady = [loomCount, workingDays, avgOutput, monthlyOutput]
        .every(value => Number.isFinite(value) && value > 0)
    const monthlyExpenseTotal = rent + electricity + staff + others
    const monthlyExpensesReady = capacityInputsReady && Number.isFinite(monthlyExpenseTotal) && monthlyExpenseTotal > 0

    const validateCapacityInputs = () => {
        if (!Number.isFinite(loomCount) || loomCount <= 0) return 'Enter at least one loom before continuing.'
        if (!Number.isFinite(workingDays) || workingDays <= 0) return 'Enter positive working days before continuing.'
        if (!Number.isFinite(avgOutput) || avgOutput <= 0) return 'Enter positive daily output per loom before continuing.'
        if (!Number.isFinite(monthlyOutput) || monthlyOutput <= 0) return 'Enter the standard monthly production used for costing before continuing.'
        return null
    }

    const handleCapacityContinue = () => {
        const error = validateCapacityInputs()
        if (error) {
            setValidationError(error)
            return
        }
        setValidationError(null)
        setStep('detailed-expenses')
    }

    const handleExpensesContinue = () => {
        const capacityError = validateCapacityInputs()
        if (capacityError) {
            setValidationError(capacityError)
            setStep('detailed')
            return
        }
        if (!Number.isFinite(monthlyExpenseTotal) || monthlyExpenseTotal <= 0) {
            setValidationError('Enter at least one monthly factory expense before continuing.')
            return
        }
        setValidationError(null)
        setStep('defaults')
    }

    const getOverheadSetup = (): Partial<EstimateState> => {
        if (setupPath === 'direct') {
            return { overheadMode: 'direct', overheadOverridePerM: overheadPerM }
        }
        const items: OverheadItem[] = [
            { id: nanoid(), label: 'Rent / Lease', monthlyAmount: rent, category: 'rent', isPreset: true, isLocked: false, source: 'manual' },
            { id: nanoid(), label: 'Electricity', monthlyAmount: electricity, category: 'electricity', isPreset: true, isLocked: false, source: 'manual' },
            { id: nanoid(), label: 'Fixed Salary Staff', monthlyAmount: staff, category: 'admin', isPreset: true, isLocked: false, source: 'manual' },
            { id: nanoid(), label: 'Other Expenses', monthlyAmount: others, category: 'custom', isPreset: true, isLocked: false, source: 'manual' },
        ]
        
        return {
            overheadMode: 'monthly_expenses',
            loomCount,
            monthlyWorkingDays: workingDays,
            avgOutputPerLoomPerDay: avgOutput,
            overheadItems: ensureOverheadIntegrity(items),
            monthlyOutputM: monthlyOutput,
            overheadOverridePerM: null,
        }
    }

    const getCompletionData = (): FactoryCostWizardData => ({
            ...getOverheadSetup(),
            warpingRatePerKg: warpingRate,
            sizingRatePerKg: sizingRate,
            windingRatePerKg: windingRate,
            processingRatePerM: processingRate,
            finishingRatePerM: finishingRate,
            commissionPct,
            profitPct: marginPct,
            yarnReviewIntervalDays,
            transportPerM: transportRate,
            warpCrimpPct,
            yarnShortagePct: yarnWastePct,
            enabledSections: { ...selectedSections },
            isConfigured: true,
            factoryProfileKey: 'grey_weaver',
        })

    const validateCompletion = (data: Partial<EstimateState> & { yarnReviewIntervalDays: number }) => validateFactoryCostProfile({
        warping_rate_per_kg: data.warpingRatePerKg ?? initialState.warpingRatePerKg,
        sizing_rate_per_kg: data.sizingRatePerKg ?? initialState.sizingRatePerKg,
        winding_rate_per_kg: data.windingRatePerKg ?? initialState.windingRatePerKg,
        overhead_mode: data.overheadMode ?? initialState.overheadMode,
        default_commission_pct: data.commissionPct ?? initialState.commissionPct,
        default_margin_pct: data.profitPct ?? initialState.profitPct,
        default_transport_per_m: data.transportPerM ?? initialState.transportPerM,
        yarn_review_interval_days: data.yarnReviewIntervalDays,
        default_processing_rate_per_m: data.processingRatePerM ?? initialState.processingRatePerM,
        default_finishing_rate_per_m: data.finishingRatePerM ?? initialState.finishingRatePerM,
        enabled_sections: data.enabledSections ?? selectedSections,
        monthly_output_m: data.monthlyOutputM ?? initialState.monthlyOutputM,
        overhead_override_per_m: data.overheadOverridePerM !== undefined ? data.overheadOverridePerM : initialState.overheadOverridePerM,
        loom_count: data.loomCount ?? initialState.loomCount,
        monthly_working_days: data.monthlyWorkingDays ?? initialState.monthlyWorkingDays,
        avg_output_per_loom_per_day: data.avgOutputPerLoomPerDay ?? initialState.avgOutputPerLoomPerDay,
        yarn_shortage_pct: data.yarnShortagePct ?? initialState.yarnShortagePct,
        warp_crimp_pct: data.warpCrimpPct ?? initialState.warpCrimpPct,
    })

    const handleFinish = async () => {
        const data = getCompletionData()
        if (setupPath === 'direct' && (overheadPerM == null || overheadPerM <= 0)) {
            setValidationError('Enter the direct factory cost per metre before saving these defaults.')
            setStep('fast')
            return
        }
        if (setupPath === 'monthly_expenses') {
            const capacityError = validateCapacityInputs()
            if (capacityError) {
                setValidationError(capacityError)
                setStep('detailed')
                return
            }
        }
        if (setupPath === 'monthly_expenses' && monthlyOutput <= 0) {
            setValidationError('Enter the standard monthly production used to divide factory expenses.')
            setStep('detailed')
            return
        }
        const monthlyExpenseTotal = data.overheadItems?.reduce((total, item) => total + Math.max(0, Number(item.monthlyAmount) || 0), 0) ?? 0
        if (setupPath === 'monthly_expenses' && monthlyExpenseTotal <= 0) {
            setValidationError('Enter at least one monthly factory expense before saving these defaults.')
            setStep('detailed-expenses')
            return
        }
        const validation = validateCompletion(data)
        setValidationError(null)
        if (!validation.valid) {
            setValidationError(validation.issues[0]?.message ?? 'Review the setup values before saving.')
            return
        }
        if (validation.warnings?.length) {
            setPendingCompletion(data)
            setPendingWarnings(validation.warnings)
            return
        }
        await onComplete(data)
    }

    const confirmPendingCompletion = async () => {
        if (!pendingCompletion) return
        const data = pendingCompletion
        setPendingCompletion(null)
        setPendingWarnings([])
        await onComplete(data)
    }

    const containerVariants: Variants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
        exit: { opacity: 0, y: -20, transition: { duration: 0.2 } }
    }

    return (
        <div className="safe-area-page fixed inset-0 z-[100] flex items-center justify-center [--page-gutter-x:1rem] [--page-gutter-y:1rem] bg-[var(--wv-neel-950)]/50 backdrop-blur-sm">
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="w-full max-w-lg max-h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom)-2rem)] overflow-y-auto"
                >
                    <Card className="border border-[var(--wv-border-default)] shadow-[var(--shadow-card)] overflow-hidden bg-[var(--wv-bg-surface)] text-[var(--wv-text-primary)] relative">
                        {onDismiss && (
                            <button
                                type="button"
                                onClick={onDismiss}
                                aria-label="Close setup wizard"
                                className="absolute top-3.5 right-3.5 z-20 rounded-full p-1.5 text-[var(--wv-text-secondary)] hover:bg-[var(--wv-bg-subtle)] hover:text-[var(--wv-text-primary)] transition-colors"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        )}
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-[var(--wv-cotton-300)] flex">
                            <div 
                                className="h-full bg-[var(--wv-brand-accent)] transition-all duration-500" 
                                style={{ width: `${
                                    step === 'intro' ? 10 : 
                                    step === 'choice' ? 42 :
                                    step === 'fast' ? 58 :
                                    step === 'detailed' ? 58 :
                                    step === 'detailed-expenses' ? 76 : 100
                                }%` }} 
                            />
                        </div>

                        <CardContent
                            className="p-8"
                            data-enter-navigate-container="true"
                            onKeyDown={handleEnterKeyNavigation}
                        >
                            {step === 'intro' && (
                                <div className="space-y-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-[var(--wv-neel-100)] rounded-2xl flex items-center justify-center">
                                        <Building2 className="h-8 w-8 text-[var(--wv-neel-900)]" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black tracking-tight text-[var(--wv-text-primary)]">
                                            Set up your grey-fabric costing
                                        </h2>
                                        <p className="text-[var(--wv-text-secondary)] text-sm leading-relaxed">
                                            Weavly is set up for grey fabric weaving. Enter your actual factory expenses and rates to calculate a trustworthy ₹/m cost.
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <Button 
                                            onClick={() => setStep('choice')}
                                            className="w-full h-12 bg-[var(--wv-action-primary)] hover:bg-[var(--wv-action-primary-hover)] text-[var(--wv-text-on-action)] rounded-xl font-bold transition-all shadow-sm"
                                        >
                                            Get Started
                                            <ArrowRight className="ml-2 h-4 w-4" />
                                        </Button>
                                        {onDismiss && (
                                            <button
                                                type="button"
                                                onClick={onDismiss}
                                                className="w-full text-center text-xs font-semibold text-[var(--wv-text-secondary)] hover:text-[var(--wv-text-primary)] transition-colors pt-1"
                                            >
                                                Skip for now · I&apos;ve already set this up
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {step === 'choice' && (
                                <div className="space-y-6">
                                    <div className="text-center space-y-1">
                                        <h2 className="text-xl font-bold text-[var(--wv-text-primary)]">How would you like to set up?</h2>
                                        <p className="text-xs text-[var(--wv-text-secondary)]">Choose the method that suits you best.</p>
                                    </div>
                                    <div className="grid gap-4">
                                        <button 
                                            onClick={() => { setSetupPath('direct'); setStep('fast') }}
                                            className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] hover:border-[var(--wv-border-strong)] hover:bg-[var(--wv-bg-subtle)] transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-[var(--wv-ochre-100)] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Zap className="h-6 w-6 text-[var(--wv-ochre-800)]" />
                                            </div>
                                            <div>
                                                <div className="font-black text-[var(--wv-text-primary)]">I know my factory cost per metre</div>
                                                <div className="text-xs text-[var(--wv-text-secondary)]">Enter the ₹/m factory cost you already use.</div>
                                            </div>
                                        </button>
                                        <button 
                                            onClick={() => { setSetupPath('monthly_expenses'); setStep('detailed') }}
                                            className="flex items-center gap-4 p-5 rounded-2xl border border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] hover:border-[var(--wv-border-strong)] hover:bg-[var(--wv-bg-subtle)] transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-[var(--wv-neel-100)] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Calculator className="h-6 w-6 text-[var(--wv-neel-900)]" />
                                            </div>
                                            <div>
                                                <div className="font-black text-[var(--wv-text-primary)]">Calculate from monthly expenses</div>
                                                <div className="text-xs text-[var(--wv-text-secondary)]">Enter expenses and output; we&apos;ll calculate ₹/m for you.</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 'fast' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('choice')} className="p-2 hover:bg-[var(--wv-bg-subtle)] rounded-lg text-[var(--wv-text-secondary)] hover:text-[var(--wv-text-primary)] transition-colors">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-[var(--wv-text-primary)]">Enter your factory cost per metre</h2>
                                    </div>
                                    <div className="p-6 bg-[var(--wv-bg-subtle)] rounded-xl border border-[var(--wv-border-subtle)] space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-wider font-black text-[var(--wv-text-secondary)]">Direct factory overhead (₹/m) — REQUIRED</Label>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    value={overheadPerM === (initialState.overheadOverridePerM ?? null) ? '' : (overheadPerM ?? '')}
                                                    placeholder={initialState.overheadOverridePerM != null ? formatEstimatorPlaceholder(initialState.overheadOverridePerM) : 'Enter your rate'}
                                                    onChange={(e) => setOverheadPerM(parseNonNegativeInput(e.target.value))}
                                                    className="h-14 text-2xl font-black text-[var(--wv-action-primary)] pl-8 pr-12 rounded-xl border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] focus:ring-[var(--wv-border-focus)] focus:border-[var(--wv-border-focus)]"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-[var(--wv-text-secondary)]">₹</span>
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-[var(--wv-text-secondary)]">/m</span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-[var(--wv-text-secondary)] leading-relaxed italic">
                                            Enter the rate your unit already uses for rent, power, staff, repairs, and other fixed costs. No direct rate is inferred.
                                        </p>
                                    </div>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-[var(--wv-status-danger-border)] bg-[var(--wv-status-danger-bg)] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[var(--wv-status-danger-fg)]">
                                            {validationError}
                                        </p>
                                    )}
                                    <Button 
                                        onClick={() => setStep('defaults')}
                                        className="w-full h-12 bg-[var(--wv-action-primary)] hover:bg-[var(--wv-action-primary-hover)] text-[var(--wv-text-on-action)] rounded-xl font-bold shadow-sm"
                                    >
                                        Next: Cost Defaults
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {step === 'detailed' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('choice')} className="p-2 hover:bg-[var(--wv-bg-subtle)] rounded-lg text-[var(--wv-text-secondary)] hover:text-[var(--wv-text-primary)] transition-colors">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-[var(--wv-text-primary)]">Factory Capacity</h2>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider font-bold text-[var(--wv-text-secondary)]">Total Loom Count</Label>
                                            <Input
                                                type="number"
                                                min={1}
                                                step={1}
                                                value={loomCount || ''}
                                                placeholder="e.g. 24"
                                                onChange={e => setLoomCount(parseNonNegativeInput(e.target.value) ?? 0)}
                                                aria-invalid={loomCount <= 0}
                                                className="h-10 font-bold"
                                            />
                                            {loomCount <= 0 && <p className="text-[10px] font-semibold text-[var(--wv-status-warning-fg)]">Required for a trustworthy factory baseline.</p>}
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider font-bold text-[var(--wv-text-secondary)]">Working Days / Month</Label>
                                                <Input 
                                                    type="number" 
                                                    min={1}
                                                    step={1}
                                                    value={workingDays === (initialState.monthlyWorkingDays || 26) ? '' : workingDays}
                                                    placeholder={formatEstimatorPlaceholder(initialState.monthlyWorkingDays || 26)}
                                                    onChange={e => setWorkingDays(parseNumericInput(e.target.value, { min: 1 }) ?? 0)}
                                                    aria-invalid={workingDays <= 0}
                                                    className="h-10 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider font-bold text-[var(--wv-text-secondary)]">Average m / Loom / Day</Label>
                                                <Input 
                                                    type="number" 
                                                    min={0.01}
                                                    step={0.01}
                                                    value={avgOutput === (initialState.avgOutputPerLoomPerDay || 50) ? '' : avgOutput}
                                                    placeholder={formatEstimatorPlaceholder(initialState.avgOutputPerLoomPerDay || 50)}
                                                    onChange={e => setAvgOutput(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    aria-invalid={avgOutput <= 0}
                                                    className="h-10 font-bold"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-[var(--wv-neel-50)] rounded-xl border border-[var(--wv-neel-200)]">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-[var(--wv-neel-900)]">Est. Monthly Production</span>
                                                <span className={`text-sm font-black ${capacityInputsReady ? 'text-[var(--wv-neel-900)]' : 'text-[var(--wv-status-warning-fg)]'}`}>
                                                    {capacityInputsReady ? `${(loomCount * workingDays * avgOutput).toLocaleString()}m` : 'Complete capacity inputs'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] p-3">
                                            <Label className="text-[10px] uppercase tracking-wider font-bold text-[var(--wv-text-secondary)]">Standard monthly production</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={monthlyOutput || ''}
                                                    placeholder="e.g. 45,000"
                                                    onChange={event => setMonthlyOutput(parseNumericInput(event.target.value, { min: 1 }) ?? 0)}
                                                    aria-invalid={monthlyOutput <= 0}
                                                    className="h-10 pr-10 font-mono font-bold"
                                                />
                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--wv-text-secondary)]">m/mo</span>
                                            </div>
                                            <p className="text-[10px] leading-relaxed text-[var(--wv-text-secondary)]">Use a normal representative production level, not maximum rated capacity, when dividing monthly expenses.</p>
                                        </div>
                                    </div>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-[var(--wv-status-danger-border)] bg-[var(--wv-status-danger-bg)] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[var(--wv-status-danger-fg)]">
                                            {validationError}
                                        </p>
                                    )}
                                    <Button 
                                        onClick={handleCapacityContinue}
                                        disabled={!capacityInputsReady}
                                        aria-describedby={!capacityInputsReady ? 'factory-capacity-hint' : undefined}
                                        className="w-full h-12 bg-[var(--wv-action-primary)] hover:bg-[var(--wv-action-primary-hover)] text-[var(--wv-text-on-action)] rounded-xl font-bold"
                                    >
                                        Next: Monthly Expenses
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                    {!capacityInputsReady && <p id="factory-capacity-hint" className="text-center text-[11px] font-semibold leading-relaxed text-[var(--wv-status-warning-fg)]">Enter positive loom count, working days, daily productivity, and standard monthly production to continue.</p>}
                                </div>
                            )}

                            {step === 'detailed-expenses' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('detailed')} className="p-2 hover:bg-[var(--wv-bg-subtle)] rounded-lg text-[var(--wv-text-secondary)] hover:text-[var(--wv-text-primary)] transition-colors">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-[var(--wv-text-primary)]">Monthly Expenses (₹)</h2>
                                    </div>
                                    <div className="grid gap-3">
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)]">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--wv-bg-surface)] shadow-xs flex items-center justify-center shrink-0">
                                                <Building2 className="h-4 w-4 text-[var(--wv-text-primary)]" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-[var(--wv-text-secondary)]">Rent / Lease</Label>
                                                <Input 
                                                    type="number" 
                                                    value={rent === initialRent ? '' : rent}
                                                    placeholder={initialRent > 0 ? String(initialRent) : 'e.g. 1,00,000'}
                                                    onChange={e => setRent(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black placeholder:text-[var(--wv-text-secondary)] p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)]">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--wv-bg-surface)] shadow-xs flex items-center justify-center shrink-0">
                                                <Zap className="h-4 w-4 text-[var(--wv-status-warning-fg)]" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-[var(--wv-text-secondary)]">Electricity & Power</Label>
                                                <Input 
                                                    type="number" 
                                                    value={electricity === initialElectricity ? '' : electricity}
                                                    placeholder={initialElectricity > 0 ? String(initialElectricity) : 'e.g. 25,000'}
                                                    onChange={e => setElectricity(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black placeholder:text-[var(--wv-text-secondary)] p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)]">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--wv-bg-surface)] shadow-xs flex items-center justify-center shrink-0">
                                                <Briefcase className="h-4 w-4 text-[var(--wv-action-primary)]" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-[var(--wv-text-secondary)]">Fixed Staff Salary</Label>
                                                <Input 
                                                    type="number" 
                                                    value={staff === initialStaff ? '' : staff}
                                                    placeholder={initialStaff > 0 ? String(initialStaff) : 'e.g. 50,000'}
                                                    onChange={e => setStaff(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black placeholder:text-[var(--wv-text-secondary)] p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)]">
                                            <div className="w-8 h-8 rounded-lg bg-[var(--wv-bg-surface)] shadow-xs flex items-center justify-center shrink-0">
                                                <Settings2 className="h-4 w-4 text-[var(--wv-text-secondary)]" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-[var(--wv-text-secondary)]">Others (Repairs, Oil, etc.)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={others === initialOtherExpenses ? '' : others}
                                                    placeholder={initialOtherExpenses > 0 ? String(initialOtherExpenses) : 'e.g. 10,000'}
                                                    onChange={e => setOthers(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black placeholder:text-[var(--wv-text-secondary)] p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className={`p-4 rounded-xl border ${monthlyExpensesReady ? 'bg-[var(--wv-status-success-bg)] border-[var(--wv-status-success-border)]' : 'bg-[var(--wv-status-warning-bg)] border-[var(--wv-status-warning-border)]'}`}>
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <div className={`text-[10px] font-bold uppercase tracking-tight ${monthlyExpensesReady ? 'text-[var(--wv-status-success-fg)]' : 'text-[var(--wv-status-warning-fg)]'}`}>{monthlyExpensesReady ? 'Calculated factory cost' : 'Factory cost needs inputs'}</div>
                                                <div className={`text-xs ${monthlyExpensesReady ? 'text-[var(--wv-status-success-fg)]' : 'text-[var(--wv-status-warning-fg)]'}`}>
                                                    {monthlyOutput > 0
                                                        ? `₹${monthlyExpenseTotal.toLocaleString()} per month ÷ ${monthlyOutput.toLocaleString()} m output`
                                                        : 'Enter standard monthly production before reviewing cost'}
                                                </div>
                                            </div>
                                            {monthlyExpensesReady ? (
                                                <div className="text-xl font-black text-[var(--wv-status-success-fg)]">
                                                    ₹{(monthlyExpenseTotal / monthlyOutput).toFixed(2)}
                                                    <span className="text-xs ml-1">/m</span>
                                                </div>
                                            ) : (
                                                <div className="text-right text-xs font-bold text-[var(--wv-status-warning-fg)]">Complete required inputs</div>
                                            )}
                                        </div>
                                    </div>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-[var(--wv-status-danger-border)] bg-[var(--wv-status-danger-bg)] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[var(--wv-status-danger-fg)]">
                                            {validationError}
                                        </p>
                                    )}

                                    <Button 
                                        onClick={handleExpensesContinue}
                                        disabled={!monthlyExpensesReady}
                                        aria-describedby={!monthlyExpensesReady ? 'factory-expenses-hint' : undefined}
                                        className="w-full h-12 bg-[var(--wv-action-primary)] hover:bg-[var(--wv-action-primary-hover)] text-[var(--wv-text-on-action)] rounded-xl font-bold shadow-sm"
                                    >
                                        Next: Cost Defaults
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                    {!monthlyExpensesReady && <p id="factory-expenses-hint" className="text-center text-[11px] font-semibold leading-relaxed text-[var(--wv-status-warning-fg)]">Enter positive capacity values and at least one monthly expense before continuing.</p>}
                                </div>
                            )}

                            {step === 'defaults' && (
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep(setupPath === 'direct' ? 'fast' : 'detailed-expenses')} className="rounded-lg p-2 text-[var(--wv-text-secondary)] hover:text-[var(--wv-text-primary)] hover:bg-[var(--wv-bg-subtle)] transition-colors">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <div>
                                            <h2 className="text-lg font-black text-[var(--wv-text-primary)]">Cost Estimate Defaults</h2>
                                            <p className="text-xs text-[var(--wv-text-secondary)]">These values pre-fill every new costing. Enter 0 for charges you do not use.</p>
                                        </div>
                                    </div>
                                    <div className="grid max-h-[55vh] grid-cols-1 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                                        {[
                                            ['Warping', warpingRate, setWarpingRate, '₹/kg', 0.25],
                                            ['Sizing', sizingRate, setSizingRate, '₹/kg', 0.25],
                                            ['Winding', windingRate, setWindingRate, '₹/kg', 0.25],
                                            ['Processing', processingRate, setProcessingRate, '₹/m', 0.1],
                                            ['Finishing', finishingRate, setFinishingRate, '₹/m', 0.1],
                                            ['Broker commission', commissionPct, setCommissionPct, '%', 0.5],
                                            ['Target margin', marginPct, setMarginPct, '%', 0.5],
                                            ['Transport charge', transportRate, setTransportRate, '₹/m', 0.1],
                                            ['Warp crimp', warpCrimpPct, setWarpCrimpPct, '%', 0.5],
                                            ['Default yarn waste', yarnWastePct, setYarnWastePct, '%', 0.5],
                                        ].filter(([label]) =>
                                            label === 'Processing' ? selectedSections.processing
                                            : label === 'Finishing' ? selectedSections.finishing
                                            : label === 'Winding' ? selectedSections.winding
                                            : label === 'Broker commission' ? selectedSections.commission
                                            : label === 'Transport charge' ? selectedSections.transport
                                            : true,
                                        ).map(([label, value, setter, unit, inputStep]) => {
                                            const ghostValue = getFactoryDefaultValue(String(label), initialState)
                                            const isGhostValue = Number(value) === ghostValue
                                            const placeholderKind: EstimatorPlaceholderKind = label === 'Default yarn waste' ? 'applied-default' : 'example'
                                            return (
                                                <div key={String(label)} className="space-y-1.5 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] p-3">
                                                    <Label className="text-[10px] font-black uppercase tracking-wider text-[var(--wv-text-secondary)]">{String(label)}</Label>
                                                    <div className="relative">
                                                        <Input
                                                            type="number"
                                                            min={0}
                                                            max={label === 'Broker commission' || label === 'Target margin' ? 99.99 : undefined}
                                                            step={Number(inputStep)}
                                                            value={isGhostValue ? '' : Number(value)}
                                                            placeholder={isGhostValue ? formatEstimatorPlaceholder(ghostValue, placeholderKind) : undefined}
                                                            onChange={event => (setter as (next: number) => void)(parseNonNegativeInput(event.target.value) ?? 0)}
                                                            className={`h-11 pr-14 font-mono font-bold ${placeholderKind === 'applied-default' ? 'text-[var(--wv-brand-accent-strong)] placeholder:text-[var(--wv-brand-accent-strong)]' : 'placeholder:text-[var(--wv-text-secondary)]'}`}
                                                        />
                                                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[var(--wv-text-secondary)]">{String(unit)}</span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <div className="space-y-1.5 rounded-xl border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] p-3">
                                            <Label htmlFor="onboarding-yarn-review" className="text-[10px] font-black uppercase tracking-wider text-[var(--wv-text-secondary)]">Review yarn rates</Label>
                                            <select
                                                id="onboarding-yarn-review"
                                                value={yarnReviewIntervalDays}
                                                onChange={event => setYarnReviewIntervalDays(parseNumericInput(event.target.value, { min: 1 }) ?? 1)}
                                                className="h-11 w-full rounded-xl border border-hairline bg-surface px-3 text-sm font-semibold text-ink shadow-2xs focus-visible:border-[var(--wv-border-focus)] focus-visible:ring-[var(--wv-border-focus)] cursor-pointer"
                                            >
                                                <option value={30}>Every 30 days</option>
                                                <option value={60}>Every 60 days</option>
                                                <option value={90}>Every 3 months</option>
                                                <option value={180}>Every 6 months</option>
                                                <option value={365}>Every 12 months</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="rounded-xl border border-[var(--wv-neel-200)] bg-[var(--wv-neel-50)] px-3 py-2 text-[11px] leading-relaxed text-[var(--wv-neel-900)]">
                                        Your target margin powers the suggested selling price. Yarn review reminders and all defaults can be changed later in Settings.
                                    </p>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-[var(--wv-status-danger-border)] bg-[var(--wv-status-danger-bg)] px-3 py-2 text-[11px] font-semibold leading-relaxed text-[var(--wv-status-danger-fg)]">
                                            {validationError}
                                        </p>
                                    )}
                                    <Button
                                        onClick={handleFinish}
                                        disabled={saving}
                                        aria-busy={saving}
                                        className="h-12 w-full rounded-xl bg-[var(--wv-action-primary)] font-bold text-[var(--wv-text-on-action)] shadow-sm hover:bg-[var(--wv-action-primary-hover)]"
                                    >
                                        {saving ? 'Saving...' : 'Finish Setup'}
                                        {!saving && <CheckCircle2 className="ml-2 h-4 w-4" />}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </AnimatePresence>

            <Dialog open={pendingCompletion !== null} onOpenChange={open => {
                if (!open) {
                    setPendingCompletion(null)
                    setPendingWarnings([])
                }
            }}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-[var(--wv-status-warning-fg)]">Review unusual setup values</DialogTitle>
                        <DialogDescription>
                            These values may be correct for your factory, but they are outside the usual costing range. Confirm them before saving your factory baseline.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--wv-status-warning-border)] bg-[var(--wv-status-warning-bg)] p-3">
                        {pendingWarnings.map(warning => (
                            <div key={`${warning.field}:${warning.message}`} className="flex gap-2 text-sm text-[var(--wv-status-warning-fg)]">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wv-status-warning-fg)]" />
                                <span>{warning.message}</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            setPendingCompletion(null)
                            setPendingWarnings([])
                        }}>Go back</Button>
                        <Button className="bg-[var(--wv-action-primary)] text-[var(--wv-text-on-action)] hover:bg-[var(--wv-action-primary-hover)]" onClick={confirmPendingCompletion}>
                            I reviewed these values
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
