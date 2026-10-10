'use client'

import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import {
    Calculator,
    Zap,
    ArrowLeft,
    ArrowRight,
    Check,
    X
} from 'lucide-react'
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
import { formatEstimatorPlaceholder } from '@/lib/estimator-placeholder'

type FactoryCostWizardData = Partial<EstimateState> & {
    yarnReviewIntervalDays: number
    factoryProfileKey: FactoryProfileId
}

interface FactoryCostWizardProps {
    initialState: EstimateState
    initialYarnReviewIntervalDays: number
    onComplete: (data: FactoryCostWizardData) => Promise<void>
    onDismiss?: () => void
    /** Closes the wizard without recording a dismissal; the owner can reopen it. */
    onClose?: () => void
    saving: boolean
}

type WizardStep = 'choice' | 'fast' | 'detailed' | 'detailed-expenses' | 'defaults'

// Values the owner has not entered stay blank: a zero rate is shown as an
// empty field with a "0" hint, never as an example that looks like real data.
const enteredValue = (value: number) => (Number.isFinite(value) && value > 0 ? value : '')

const fieldLabelClass = 'text-sm font-medium text-[var(--wv-text-body)]'
const fieldHintClass = 'text-xs leading-relaxed text-[var(--wv-text-secondary)]'

function UnitInput({ unit, prefix, children }: { unit?: string; prefix?: string; children: ReactNode }) {
    return (
        <div className="relative">
            {prefix && <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-[var(--wv-text-secondary)]">{prefix}</span>}
            {children}
            {unit && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[var(--wv-text-secondary)]">{unit}</span>}
        </div>
    )
}

function ErrorNote({ message }: { message: string | null }) {
    if (!message) return null
    return (
        <p role="alert" className="rounded-lg border border-[var(--wv-status-danger-border)] bg-[var(--wv-status-danger-bg)] px-3 py-2 text-sm leading-relaxed text-[var(--wv-status-danger-fg)]">
            {message}
        </p>
    )
}

export default function FactoryCostWizard({ initialState, initialYarnReviewIntervalDays, onComplete, onDismiss, onClose, saving }: FactoryCostWizardProps) {
    const [step, setStep] = useState<WizardStep>('choice')
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

    // A direct rate is a price-changing assumption. Keep it blank until the
    // owner enters one instead of presenting an example as if it were real.
    // When the owner already typed one in the costing, it is carried in here.
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

    const totalSteps = setupPath === 'direct' ? 3 : 4
    const stepNumber = step === 'choice' ? 1
        : step === 'fast' || step === 'detailed' ? 2
        : step === 'detailed-expenses' ? 3
        : totalSteps

    const goTo = (next: WizardStep) => {
        setValidationError(null)
        setStep(next)
    }

    const validateCapacityInputs = () => {
        if (!Number.isFinite(loomCount) || loomCount <= 0) return 'Enter at least one loom before continuing.'
        if (!Number.isFinite(workingDays) || workingDays <= 0) return 'Enter positive working days before continuing.'
        if (!Number.isFinite(avgOutput) || avgOutput <= 0) return 'Enter positive daily output per loom before continuing.'
        if (!Number.isFinite(monthlyOutput) || monthlyOutput <= 0) return 'Enter the standard monthly production used for costing before continuing.'
        return null
    }

    const handleDirectContinue = () => {
        if (overheadPerM == null || overheadPerM <= 0) {
            setValidationError('Enter the direct factory cost per metre before continuing.')
            return
        }
        goTo('defaults')
    }

    const handleCapacityContinue = () => {
        const error = validateCapacityInputs()
        if (error) {
            setValidationError(error)
            return
        }
        goTo('detailed-expenses')
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
        goTo('defaults')
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
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
        exit: { opacity: 0, y: -8, transition: { duration: 0.15 } }
    }

    const backTarget: WizardStep | null = step === 'fast' || step === 'detailed' ? 'choice'
        : step === 'detailed-expenses' ? 'detailed'
        : step === 'defaults' ? (setupPath === 'direct' ? 'fast' : 'detailed-expenses')
        : null

    const expenseFields: Array<[string, string, number, (next: number) => void, string]> = [
        ['wizard-rent', 'Rent / Lease', rent, setRent, 'e.g. 1,00,000'],
        ['wizard-electricity', 'Electricity and power', electricity, setElectricity, 'e.g. 25,000'],
        ['wizard-staff', 'Fixed staff salaries', staff, setStaff, 'e.g. 50,000'],
        ['wizard-others', 'Other (repairs, oil and so on)', others, setOthers, 'e.g. 10,000'],
    ]

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="factory-cost-wizard-title"
            className="safe-area-page fixed inset-0 z-[100] flex items-end justify-center bg-[var(--wv-neel-950)]/40 backdrop-blur-[2px] [--page-gutter-x:0px] [--page-gutter-y:0px] sm:items-center sm:[--page-gutter-x:1rem] sm:[--page-gutter-y:1rem]"
        >
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="w-full sm:max-w-lg"
                >
                    <div className="relative flex max-h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom)-1rem)] flex-col overflow-hidden rounded-t-[14px] border border-[var(--wv-border-default)] bg-[var(--wv-bg-surface)] text-[var(--wv-text-primary)] shadow-[var(--shadow-modal)] sm:max-h-[calc(100dvh-var(--safe-area-top)-var(--safe-area-bottom)-2rem)] sm:rounded-[14px]">
                        <header className="flex items-center gap-2 border-b border-[var(--wv-border-subtle)] px-4 py-3 sm:px-6">
                            {backTarget ? (
                                <button
                                    type="button"
                                    onClick={() => goTo(backTarget)}
                                    aria-label="Back"
                                    className="-ml-2 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--wv-text-secondary)] transition-colors hover:bg-[var(--wv-bg-subtle)] hover:text-[var(--wv-text-primary)]"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                </button>
                            ) : null}
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-[var(--wv-text-secondary)]">Factory setup · Step {stepNumber} of {totalSteps}</p>
                                <div className="mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full bg-[var(--wv-cotton-300)]" aria-hidden="true">
                                    <div className="ui-meter-fill h-full rounded-full bg-[var(--wv-brand-accent)]" style={{ width: `${(stepNumber / totalSteps) * 100}%` }} />
                                </div>
                            </div>
                            {(onClose ?? onDismiss) && (
                                <button
                                    type="button"
                                    onClick={onClose ?? onDismiss}
                                    aria-label="Close setup wizard"
                                    className="-mr-2 flex h-10 w-10 items-center justify-center rounded-lg text-[var(--wv-text-secondary)] transition-colors hover:bg-[var(--wv-bg-subtle)] hover:text-[var(--wv-text-primary)]"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            )}
                        </header>

                        <div
                            className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6"
                            data-enter-navigate-container="true"
                            onKeyDown={handleEnterKeyNavigation}
                        >
                            {step === 'choice' && (
                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <h2 id="factory-cost-wizard-title" className="text-xl font-semibold tracking-tight text-[var(--wv-text-primary)]">
                                            Set up your grey-fabric costing
                                        </h2>
                                        <p className="text-sm leading-relaxed text-[var(--wv-text-secondary)]">
                                            Your factory cost and usual rates fill every new costing, so you enter them once. How do you work out factory cost today?
                                        </p>
                                    </div>
                                    <div className="grid gap-3">
                                        <button
                                            type="button"
                                            onClick={() => { setSetupPath('direct'); goTo('fast') }}
                                            className="flex min-h-11 items-start gap-3 rounded-xl border border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] p-4 text-left transition-colors hover:border-[var(--wv-border-strong)] hover:bg-[var(--wv-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wv-border-focus)]"
                                        >
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wv-ochre-50)]">
                                                <Zap className="h-5 w-5 text-[var(--wv-ochre-800)]" />
                                            </span>
                                            <span className="min-w-0 space-y-0.5">
                                                <span className="block text-sm font-semibold text-[var(--wv-text-primary)]">I know my factory cost per metre</span>
                                                <span className="block text-sm text-[var(--wv-text-secondary)]">Enter the ₹/m figure you already use.</span>
                                            </span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSetupPath('monthly_expenses'); goTo('detailed') }}
                                            className="flex min-h-11 items-start gap-3 rounded-xl border border-[var(--wv-border-control)] bg-[var(--wv-bg-surface)] p-4 text-left transition-colors hover:border-[var(--wv-border-strong)] hover:bg-[var(--wv-bg-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wv-border-focus)]"
                                        >
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--wv-neel-50)]">
                                                <Calculator className="h-5 w-5 text-[var(--wv-neel-900)]" />
                                            </span>
                                            <span className="min-w-0 space-y-0.5">
                                                <span className="block text-sm font-semibold text-[var(--wv-text-primary)]">Work it out from monthly expenses</span>
                                                <span className="block text-sm text-[var(--wv-text-secondary)]">Enter looms, output and expenses. Weavly divides them into ₹/m.</span>
                                            </span>
                                        </button>
                                    </div>
                                    {onDismiss && (
                                        <button
                                            type="button"
                                            onClick={onDismiss}
                                            className="flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-medium text-[var(--wv-text-secondary)] transition-colors hover:text-[var(--wv-text-primary)]"
                                        >
                                            Skip for now · I&apos;ve already set this up
                                        </button>
                                    )}
                                </div>
                            )}

                            {step === 'fast' && (
                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <h2 id="factory-cost-wizard-title" className="text-xl font-semibold tracking-tight text-[var(--wv-text-primary)]">Your factory cost per metre</h2>
                                        <p className={fieldHintClass}>The rate your unit already uses for rent, power, staff, repairs and other fixed costs. Weavly never guesses this number.</p>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="wizard-direct-overhead" className={fieldLabelClass}>Factory cost per metre</Label>
                                        <UnitInput prefix="₹" unit="/m">
                                            <Input
                                                id="wizard-direct-overhead"
                                                type="number"
                                                min={0}
                                                step={0.01}
                                                value={overheadPerM ?? ''}
                                                placeholder="e.g. 12.50"
                                                onChange={(e) => setOverheadPerM(parseNonNegativeInput(e.target.value))}
                                                aria-invalid={Boolean(validationError) || undefined}
                                                className="h-12 rounded-lg pl-8 pr-12 font-mono text-lg font-semibold"
                                            />
                                        </UnitInput>
                                    </div>
                                    <ErrorNote message={validationError} />
                                </div>
                            )}

                            {step === 'detailed' && (
                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <h2 id="factory-cost-wizard-title" className="text-xl font-semibold tracking-tight text-[var(--wv-text-primary)]">Factory capacity</h2>
                                        <p className={fieldHintClass}>Monthly expenses are divided by the metres you normally weave.</p>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="space-y-1.5">
                                            <Label htmlFor="wizard-loom-count" className={fieldLabelClass}>Number of looms</Label>
                                            <Input
                                                id="wizard-loom-count"
                                                type="number"
                                                inputMode="numeric"
                                                min={1}
                                                step={1}
                                                value={loomCount || ''}
                                                placeholder="e.g. 24"
                                                onChange={e => setLoomCount(parseNonNegativeInput(e.target.value) ?? 0)}
                                                aria-invalid={loomCount <= 0}
                                                className="h-11 font-mono"
                                            />
                                        </div>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="wizard-working-days" className={fieldLabelClass}>Working days a month</Label>
                                                <Input
                                                    id="wizard-working-days"
                                                    type="number"
                                                    inputMode="numeric"
                                                    min={1}
                                                    step={1}
                                                    value={workingDays === (initialState.monthlyWorkingDays || 26) ? '' : workingDays}
                                                    placeholder={formatEstimatorPlaceholder(initialState.monthlyWorkingDays || 26, 'applied-default')}
                                                    onChange={e => setWorkingDays(parseNumericInput(e.target.value, { min: 1 }) ?? 0)}
                                                    aria-invalid={workingDays <= 0}
                                                    className="h-11 font-mono"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="wizard-avg-output" className={fieldLabelClass}>Metres per loom a day</Label>
                                                <Input
                                                    id="wizard-avg-output"
                                                    type="number"
                                                    min={0.01}
                                                    step={0.01}
                                                    value={avgOutput === (initialState.avgOutputPerLoomPerDay || 50) ? '' : avgOutput}
                                                    placeholder={formatEstimatorPlaceholder(initialState.avgOutputPerLoomPerDay || 50, 'applied-default')}
                                                    onChange={e => setAvgOutput(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    aria-invalid={avgOutput <= 0}
                                                    className="h-11 font-mono"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between gap-3 rounded-lg bg-[var(--wv-bg-subtle)] px-3 py-2.5 text-sm">
                                            <span className="text-[var(--wv-text-secondary)]">At full capacity</span>
                                            <span className="font-mono font-medium text-[var(--wv-text-primary)]">
                                                {loomCount > 0 && workingDays > 0 && avgOutput > 0 ? `${(loomCount * workingDays * avgOutput).toLocaleString('en-IN')} m a month` : '—'}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <Label htmlFor="wizard-monthly-output" className={fieldLabelClass}>Normal monthly production</Label>
                                            <UnitInput unit="m">
                                                <Input
                                                    id="wizard-monthly-output"
                                                    type="number"
                                                    min={1}
                                                    value={monthlyOutput || ''}
                                                    placeholder="e.g. 45,000"
                                                    onChange={event => setMonthlyOutput(parseNumericInput(event.target.value, { min: 1 }) ?? 0)}
                                                    aria-invalid={monthlyOutput <= 0}
                                                    className="h-11 pr-10 font-mono"
                                                />
                                            </UnitInput>
                                            <p className={fieldHintClass}>Use what you usually weave in a month, not the maximum the looms can do.</p>
                                        </div>
                                    </div>
                                    <ErrorNote message={validationError} />
                                    {!capacityInputsReady && !validationError && <p id="factory-capacity-hint" className={fieldHintClass}>Fill in all four numbers to continue.</p>}
                                </div>
                            )}

                            {step === 'detailed-expenses' && (
                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <h2 id="factory-cost-wizard-title" className="text-xl font-semibold tracking-tight text-[var(--wv-text-primary)]">Monthly expenses</h2>
                                        <p className={fieldHintClass}>Enter what you spend in a normal month. Leave a field empty if it does not apply.</p>
                                    </div>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {expenseFields.map(([id, label, value, setter, placeholder]) => (
                                            <div key={id} className="space-y-1.5">
                                                <Label htmlFor={id} className={fieldLabelClass}>{label}</Label>
                                                <UnitInput prefix="₹">
                                                    <Input
                                                        id={id}
                                                        type="number"
                                                        min={0}
                                                        value={enteredValue(value)}
                                                        placeholder={placeholder}
                                                        onChange={e => setter(parseNonNegativeInput(e.target.value) ?? 0)}
                                                        className="h-11 pl-7 font-mono"
                                                    />
                                                </UnitInput>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--wv-border-subtle)] bg-[var(--wv-bg-subtle)] px-4 py-3">
                                        <div className="min-w-0 space-y-0.5">
                                            <p className="text-sm font-medium text-[var(--wv-text-primary)]">Factory cost</p>
                                            <p className="text-xs text-[var(--wv-text-secondary)]">
                                                {monthlyOutput > 0
                                                    ? `₹${monthlyExpenseTotal.toLocaleString('en-IN')} a month ÷ ${monthlyOutput.toLocaleString('en-IN')} m`
                                                    : 'Enter standard monthly production before reviewing cost'}
                                            </p>
                                        </div>
                                        <p className="shrink-0 font-mono text-lg font-semibold text-[var(--wv-text-primary)]">
                                            {monthlyExpensesReady ? `₹${(monthlyExpenseTotal / monthlyOutput).toFixed(2)}` : '—'}
                                            <span className="ml-1 text-xs font-normal text-[var(--wv-text-secondary)]">/m</span>
                                        </p>
                                    </div>
                                    <ErrorNote message={validationError} />
                                    {!monthlyExpensesReady && !validationError && <p id="factory-expenses-hint" className={fieldHintClass}>Enter at least one monthly expense to continue.</p>}
                                </div>
                            )}

                            {step === 'defaults' && (
                                <div className="space-y-5">
                                    <div className="space-y-1.5">
                                        <h2 id="factory-cost-wizard-title" className="text-xl font-semibold tracking-tight text-[var(--wv-text-primary)]">Your usual rates</h2>
                                        <p className={fieldHintClass}>These fill every new costing and can be changed per costing. Leave a field empty for charges you do not use.</p>
                                    </div>
                                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                                            const inputId = `wizard-default-${String(label).toLowerCase().replace(/\s+/g, '-')}`
                                            return (
                                                <div key={String(label)} className="space-y-1.5">
                                                    <Label htmlFor={inputId} className={fieldLabelClass}>{String(label)}</Label>
                                                    <UnitInput unit={String(unit)}>
                                                        <Input
                                                            id={inputId}
                                                            type="number"
                                                            min={0}
                                                            max={label === 'Broker commission' || label === 'Target margin' ? 99.99 : undefined}
                                                            step={Number(inputStep)}
                                                            value={enteredValue(Number(value))}
                                                            placeholder="0"
                                                            onChange={event => (setter as (next: number) => void)(parseNonNegativeInput(event.target.value) ?? 0)}
                                                            className="h-11 pr-14 font-mono"
                                                        />
                                                    </UnitInput>
                                                </div>
                                            )
                                        })}
                                        <div className="space-y-1.5">
                                            <Label htmlFor="onboarding-yarn-review" className={fieldLabelClass}>Review yarn rates</Label>
                                            <select
                                                id="onboarding-yarn-review"
                                                value={yarnReviewIntervalDays}
                                                onChange={event => setYarnReviewIntervalDays(parseNumericInput(event.target.value, { min: 1 }) ?? 1)}
                                                className="h-11 w-full cursor-pointer rounded-lg border border-hairline bg-surface px-3 text-sm text-ink shadow-xs focus-visible:border-[var(--wv-border-focus)] focus-visible:ring-[var(--wv-border-focus)]"
                                            >
                                                <option value={30}>Every 30 days</option>
                                                <option value={60}>Every 60 days</option>
                                                <option value={90}>Every 3 months</option>
                                                <option value={180}>Every 6 months</option>
                                                <option value={365}>Every 12 months</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className={fieldHintClass}>
                                        Your target margin gives the suggested selling price. You can change any of these later in Settings.
                                    </p>
                                    <ErrorNote message={validationError} />
                                </div>
                            )}
                        </div>

                        {step !== 'choice' && (
                            <footer className="border-t border-[var(--wv-border-subtle)] px-4 py-3 sm:px-6">
                                {step === 'fast' && (
                                    <Button size="lg" onClick={handleDirectContinue} className="w-full">
                                        Continue
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}
                                {step === 'detailed' && (
                                    <Button
                                        size="lg"
                                        onClick={handleCapacityContinue}
                                        disabled={!capacityInputsReady}
                                        aria-describedby={!capacityInputsReady ? 'factory-capacity-hint' : undefined}
                                        className="w-full"
                                    >
                                        Continue
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}
                                {step === 'detailed-expenses' && (
                                    <Button
                                        size="lg"
                                        onClick={handleExpensesContinue}
                                        disabled={!monthlyExpensesReady}
                                        aria-describedby={!monthlyExpensesReady ? 'factory-expenses-hint' : undefined}
                                        className="w-full"
                                    >
                                        Continue
                                        <ArrowRight className="h-4 w-4" />
                                    </Button>
                                )}
                                {step === 'defaults' && (
                                    <Button
                                        size="lg"
                                        onClick={handleFinish}
                                        disabled={saving}
                                        aria-busy={saving}
                                        className="w-full"
                                    >
                                        {saving ? 'Saving…' : 'Save factory setup'}
                                        {!saving && <Check className="h-4 w-4" />}
                                    </Button>
                                )}
                            </footer>
                        )}
                    </div>
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
                        <DialogTitle>Check these values</DialogTitle>
                        <DialogDescription>
                            They may be right for your factory, but they are outside the usual range. Confirm them before saving.
                        </DialogDescription>
                    </DialogHeader>
                    <ul className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-[var(--wv-status-warning-border)] bg-[var(--wv-status-warning-bg)] p-3">
                        {pendingWarnings.map(warning => (
                            <li key={`${warning.field}:${warning.message}`} className="flex gap-2 text-sm text-[var(--wv-status-warning-fg)]">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--wv-status-warning-fg)]" />
                                <span>{warning.message}</span>
                            </li>
                        ))}
                    </ul>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            setPendingCompletion(null)
                            setPendingWarnings([])
                        }}>Go back</Button>
                        <Button onClick={confirmPendingCompletion}>
                            Values are correct
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
