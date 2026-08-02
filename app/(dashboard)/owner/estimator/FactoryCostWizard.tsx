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
    Briefcase
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

type FactoryCostWizardData = Partial<EstimateState> & {
    yarnReviewIntervalDays: number
    factoryProfileKey: FactoryProfileId
}

interface FactoryCostWizardProps {
    initialState: EstimateState
    initialYarnReviewIntervalDays: number
    onComplete: (data: FactoryCostWizardData) => Promise<void>
    saving: boolean
}

export default function FactoryCostWizard({ initialState, initialYarnReviewIntervalDays, onComplete, saving }: FactoryCostWizardProps) {
    const [step, setStep] = useState<'intro' | 'profile' | 'choice' | 'fast' | 'detailed' | 'detailed-expenses' | 'defaults'>('intro')
    const [setupPath, setSetupPath] = useState<'direct' | 'monthly_expenses'>(initialState.overheadMode === 'direct' ? 'direct' : 'monthly_expenses')
    const [validationError, setValidationError] = useState<string | null>(null)
    const [pendingCompletion, setPendingCompletion] = useState<FactoryCostWizardData | null>(null)
    const [pendingWarnings, setPendingWarnings] = useState<EstimatorValidationIssue[]>([])
    const [selectedProfileId, setSelectedProfileId] = useState<FactoryProfileId | null>(null)
    const [selectedSections, setSelectedSections] = useState({ ...initialState.enabledSections })
    
    // Local state for the wizard inputs
    // A direct rate is a price-changing assumption. Keep it blank until the
    // owner enters one instead of presenting an example as if it were real.
    const [overheadPerM, setOverheadPerM] = useState<number | null>(initialState.overheadOverridePerM ?? null)
    const [loomCount, setLoomCount] = useState<number>(initialState.loomCount || 0)
    const [workingDays, setWorkingDays] = useState<number>(initialState.monthlyWorkingDays || 26)
    const [avgOutput, setAvgOutput] = useState<number>(initialState.avgOutputPerLoomPerDay || 50)
    const [monthlyOutput, setMonthlyOutput] = useState<number>(initialState.monthlyOutputM || 0)
    
    // Monthly expenses for detailed path
    const [rent, setRent] = useState<number>(() => initialState.overheadItems.find(item => item.category === 'rent')?.monthlyAmount ?? 0)
    const [electricity, setElectricity] = useState<number>(() => initialState.overheadItems.find(item => item.category === 'electricity')?.monthlyAmount ?? 0)
    const [staff, setStaff] = useState<number>(() => initialState.overheadItems.find(item => item.category === 'admin')?.monthlyAmount ?? 0)
    const [others, setOthers] = useState<number>(() => initialState.overheadItems
        .filter(item => !['rent', 'electricity', 'admin'].includes(item.category))
        .reduce((sum, item) => sum + item.monthlyAmount, 0))
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

    const applyFactoryProfile = (profileId: FactoryProfileId) => {
        const preset = FACTORY_COST_PRESETS.find(candidate => candidate.id === profileId)
        if (!preset) return
        setSelectedProfileId(profileId)
        setSelectedSections({ ...preset.sections })
        if (!preset.sections.winding) setWindingRate(0)
        if (!preset.sections.processing) setProcessingRate(0)
        if (!preset.sections.finishing) setFinishingRate(0)
        if (!preset.sections.commission) setCommissionPct(0)
        if (!preset.sections.transport) setTransportRate(0)
        setValidationError(null)
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
            factoryProfileKey: selectedProfileId ?? 'custom',
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
        if (!selectedProfileId) {
            setValidationError('Choose your factory type before finishing setup.')
            setStep('profile')
            return
        }
        const data = getCompletionData()
        if (setupPath === 'direct' && (overheadPerM == null || overheadPerM <= 0)) {
            setValidationError('Enter the direct factory cost per metre before saving these defaults.')
            setStep('fast')
            return
        }
        if (setupPath === 'monthly_expenses' && monthlyOutput <= 0) {
            setValidationError('Enter the actual monthly output used to divide factory expenses.')
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <AnimatePresence mode="wait">
                <motion.div
                    key={step}
                    variants={containerVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="w-full max-w-lg"
                >
                    <Card className="border-none shadow-2xl overflow-hidden bg-white/95 backdrop-blur-xl">
                        {/* Progress Bar */}
                        <div className="h-1.5 w-full bg-slate-100 flex">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-500" 
                                style={{ width: `${
                                    step === 'intro' ? 10 : 
                                    step === 'profile' ? 28 :
                                    step === 'choice' ? 42 :
                                    step === 'fast' ? 58 :
                                    step === 'detailed' ? 58 :
                                    step === 'detailed-expenses' ? 76 : 100
                                }%` }} 
                            />
                        </div>

                        <CardContent className="p-8">
                            {step === 'intro' && (
                                <div className="space-y-6 text-center">
                                    <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center">
                                        <Building2 className="h-8 w-8 text-indigo-600" />
                                    </div>
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Set up your factory costing</h2>
                                        <p className="text-slate-500 text-sm leading-relaxed">
                                            Choose the type of work you do. We&apos;ll show only the charges relevant to your unit, then use your actual factory expenses to calculate a trustworthy ₹/m cost.
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={() => setStep('profile')}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all shadow-lg shadow-indigo-200"
                                    >
                                        Get Started
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {step === 'profile' && (
                                <div className="space-y-5">
                                    <div className="space-y-1 text-center">
                                        <h2 className="text-xl font-bold text-slate-900">Choose your factory type</h2>
                                        <p className="text-xs leading-relaxed text-slate-500">This is a preview until you save it. You can change the optional charges later.</p>
                                    </div>
                                    <div className="grid gap-2.5">
                                        {FACTORY_COST_PRESETS.map(profile => (
                                            <button
                                                key={profile.id}
                                                type="button"
                                                aria-pressed={selectedProfileId === profile.id}
                                                onClick={() => applyFactoryProfile(profile.id)}
                                                className={`flex items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-colors ${selectedProfileId === profile.id ? 'border-indigo-500 bg-indigo-50/70' : 'border-slate-100 hover:border-indigo-300 hover:bg-indigo-50/30'}`}
                                            >
                                                <span className="text-xl">{profile.emoji}</span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="flex flex-wrap items-center gap-2 text-sm font-black text-slate-900">
                                                        {profile.label}
                                                        {profile.recommended && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-700">Recommended</span>}
                                                    </span>
                                                    <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{profile.description}</span>
                                                </span>
                                                {selectedProfileId === profile.id && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedProfileId && (
                                        <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-700">
                                            <strong>{FACTORY_COST_PRESETS.find(profile => profile.id === selectedProfileId)?.label}</strong> is selected. Processing, finishing, broker commission, and transport are off unless this setup requires them or you enable them later.
                                        </p>
                                    )}
                                    {!selectedProfileId && (
                                        <p id="factory-profile-selection-hint" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-amber-800">
                                            Choose the factory type that best matches your unit before continuing.
                                        </p>
                                    )}
                                    <Button
                                        type="button"
                                        disabled={!selectedProfileId}
                                        aria-describedby={!selectedProfileId ? 'factory-profile-selection-hint' : undefined}
                                        onClick={() => setStep('choice')}
                                        className="h-12 w-full rounded-full bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
                                    >
                                        Continue to factory expenses
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {step === 'choice' && (
                                <div className="space-y-6">
                                    <div className="text-center space-y-1">
                                        <h2 className="text-xl font-bold text-slate-900">How would you like to set up?</h2>
                                        <p className="text-xs text-slate-500">Choose the method that suits you best.</p>
                                    </div>
                                    <div className="grid gap-4">
                                        <button 
                                            onClick={() => { setSetupPath('direct'); setStep('fast') }}
                                            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Zap className="h-6 w-6 text-amber-500" />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900">I know my factory cost per metre</div>
                                                <div className="text-xs text-slate-500">Enter the ₹/m factory cost you already use.</div>
                                            </div>
                                        </button>
                                        <button 
                                            onClick={() => { setSetupPath('monthly_expenses'); setStep('detailed') }}
                                            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Calculator className="h-6 w-6 text-indigo-500" />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900">Calculate from monthly expenses</div>
                                                <div className="text-xs text-slate-500">Enter expenses and output; we&apos;ll calculate ₹/m for you.</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 'fast' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('profile')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-slate-900">Enter your factory cost per metre</h2>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-wider font-black text-slate-500">Direct factory overhead (₹/m) — REQUIRED</Label>
                                            <div className="relative">
                                                <Input 
                                                    type="number"
                                                    value={overheadPerM ?? ''}
                                                    placeholder="Enter your rate"
                                                    onChange={(e) => setOverheadPerM(parseNonNegativeInput(e.target.value))}
                                                    className="h-14 text-2xl font-black text-indigo-600 pl-8 pr-12 rounded-xl border-slate-200 focus:ring-indigo-500/20"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">/m</span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                                            Enter the rate your unit already uses for rent, power, staff, repairs, and other fixed costs. No direct rate is inferred.
                                        </p>
                                    </div>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-red-700">
                                            {validationError}
                                        </p>
                                    )}
                                    <Button 
                                        onClick={() => setStep('defaults')}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200"
                                    >
                                        Next: Cost Defaults
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {step === 'detailed' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('choice')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-slate-900">Factory Capacity</h2>
                                    </div>
                                    <div className="grid gap-4">
                                        <div className="space-y-1.5">
                                            <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Total Loom Count</Label>
                                            <Input 
                                                type="number" 
                                                value={loomCount} 
                                                onChange={e => setLoomCount(parseNonNegativeInput(e.target.value) ?? 0)}
                                                className="h-10 font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Working Days / Month</Label>
                                                <Input 
                                                    type="number" 
                                                    value={workingDays} 
                                                onChange={e => setWorkingDays(parseNumericInput(e.target.value, { min: 1 }) ?? 1)}
                                                    className="h-10 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Average m / Loom / Day</Label>
                                                <Input 
                                                    type="number" 
                                                    value={avgOutput} 
                                                onChange={e => setAvgOutput(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-10 font-bold"
                                                />
                                            </div>
                                        </div>
                                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-bold text-indigo-600">Est. Monthly Production</span>
                                                <span className="text-sm font-black text-indigo-700">{(loomCount * workingDays * avgOutput).toLocaleString()}m</span>
                                            </div>
                                        </div>
                                        <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                            <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Monthly output used for costing</Label>
                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={monthlyOutput || ''}
                                                    onChange={event => setMonthlyOutput(parseNumericInput(event.target.value, { min: 1 }) ?? 0)}
                                                     placeholder="e.g. 45,000"
                                                    className="h-10 pr-10 font-mono font-bold"
                                                />
                                                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">m/mo</span>
                                            </div>
                                            <p className="text-[10px] leading-relaxed text-slate-500">Use realistic actual output, not maximum rated capacity, when dividing monthly expenses.</p>
                                        </div>
                                    </div>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-red-700">
                                            {validationError}
                                        </p>
                                    )}
                                    <Button 
                                        onClick={() => setStep('detailed-expenses')}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold"
                                    >
                                        Next: Monthly Expenses
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {step === 'detailed-expenses' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('detailed')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-slate-900">Monthly Expenses (₹)</h2>
                                    </div>
                                    <div className="grid gap-3">
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                                <Building2 className="h-4 w-4 text-slate-500" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-slate-400">Rent / Lease</Label>
                                                <Input 
                                                    type="number" 
                                                    value={rent} 
                                                onChange={e => setRent(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                                <Zap className="h-4 w-4 text-amber-500" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-slate-400">Electricity & Power</Label>
                                                <Input 
                                                    type="number" 
                                                    value={electricity} 
                                                    onChange={e => setElectricity(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                                <Briefcase className="h-4 w-4 text-blue-500" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-slate-400">Fixed Staff Salary</Label>
                                                <Input 
                                                    type="number" 
                                                    value={staff} 
                                                    onChange={e => setStaff(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50">
                                            <div className="w-8 h-8 rounded-lg bg-white shadow-sm flex items-center justify-center shrink-0">
                                                <Settings2 className="h-4 w-4 text-slate-400" />
                                            </div>
                                            <div className="grow">
                                                <Label className="text-[9px] uppercase font-bold text-slate-400">Others (Repairs, Oil, etc.)</Label>
                                                <Input 
                                                    type="number" 
                                                    value={others} 
                                                    onChange={e => setOthers(parseNonNegativeInput(e.target.value) ?? 0)}
                                                    className="h-8 border-none bg-transparent font-black p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Calculated factory cost</div>
                                                <div className="text-xs text-emerald-500">₹{(rent + electricity + staff + others).toLocaleString()} per month ÷ {monthlyOutput.toLocaleString()} m output</div>
                                            </div>
                                            <div className="text-xl font-black text-emerald-700">
                                                ₹{(monthlyOutput > 0 ? (rent + electricity + staff + others) / monthlyOutput : 0).toFixed(2)}
                                                <span className="text-xs ml-1">/m</span>
                                            </div>
                                        </div>
                                    </div>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-red-700">
                                            {validationError}
                                        </p>
                                    )}

                                    <Button 
                                        onClick={() => setStep('defaults')}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200"
                                    >
                                        Next: Cost Defaults
                                        <ArrowRight className="ml-2 h-4 w-4" />
                                    </Button>
                                </div>
                            )}

                            {step === 'defaults' && (
                                <div className="space-y-5">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep(setupPath === 'direct' ? 'fast' : 'detailed-expenses')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <div>
                                            <h2 className="text-lg font-black text-slate-900">Cost Estimate Defaults</h2>
                                            <p className="text-xs text-slate-500">These values pre-fill every new costing. Enter 0 for charges you do not use.</p>
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
                                        ).map(([label, value, setter, unit, inputStep]) => (
                                            <div key={String(label)} className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                                <Label className="text-[10px] font-black uppercase tracking-wider text-slate-500">{String(label)}</Label>
                                                <div className="relative">
                                                    <Input
                                                        type="number"
                                                        min={0}
                                                        max={label === 'Broker commission' || label === 'Target margin' ? 99.99 : undefined}
                                                        step={Number(inputStep)}
                                                        value={Number(value)}
                                                        onChange={event => (setter as (next: number) => void)(parseNonNegativeInput(event.target.value) ?? 0)}
                                                        className="h-11 pr-14 font-mono font-bold"
                                                    />
                                                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">{String(unit)}</span>
                                                </div>
                                            </div>
                                        ))}
                                        <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                                            <Label htmlFor="onboarding-yarn-review" className="text-[10px] font-black uppercase tracking-wider text-slate-500">Review yarn rates</Label>
                                            <select
                                                id="onboarding-yarn-review"
                                                value={yarnReviewIntervalDays}
                                                onChange={event => setYarnReviewIntervalDays(parseNumericInput(event.target.value, { min: 1 }) ?? 1)}
                                                className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-800"
                                            >
                                                <option value={30}>Every 30 days</option>
                                                <option value={60}>Every 60 days</option>
                                                <option value={90}>Every 3 months</option>
                                                <option value={180}>Every 6 months</option>
                                                <option value={365}>Every 12 months</option>
                                            </select>
                                        </div>
                                    </div>
                                    <p className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-[11px] leading-relaxed text-indigo-700">
                                        Your target margin powers the suggested selling price. Yarn review reminders and all defaults can be changed later in Settings.
                                    </p>
                                    {validationError && (
                                        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold leading-relaxed text-red-700">
                                            {validationError}
                                        </p>
                                    )}
                                    <Button
                                        onClick={handleFinish}
                                        disabled={saving}
                                        aria-busy={saving}
                                        className="h-12 w-full rounded-full bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700"
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
                        <DialogTitle className="text-amber-800">Review unusual setup values</DialogTitle>
                        <DialogDescription>
                            These values may be correct for your factory, but they are outside the usual costing range. Confirm them before saving your factory baseline.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50 p-3">
                        {pendingWarnings.map(warning => (
                            <div key={`${warning.field}:${warning.message}`} className="flex gap-2 text-sm text-amber-900">
                                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                                <span>{warning.message}</span>
                            </div>
                        ))}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => {
                            setPendingCompletion(null)
                            setPendingWarnings([])
                        }}>Go back</Button>
                        <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={confirmPendingCompletion}>
                            I reviewed these values
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
