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
import { nanoid } from 'nanoid'

interface FactoryCostWizardProps {
    initialState: EstimateState
    onComplete: (data: Partial<EstimateState>) => Promise<void>
    saving: boolean
}

export default function FactoryCostWizard({ initialState, onComplete, saving }: FactoryCostWizardProps) {
    const [step, setStep] = useState<'intro' | 'choice' | 'fast' | 'detailed' | 'detailed-expenses' | 'summary'>('intro')
    
    // Local state for the wizard inputs
    const [overheadPerM, setOverheadPerM] = useState<number>(13.5)
    const [loomCount, setLoomCount] = useState<number>(initialState.loomCount || 24)
    const [workingDays, setWorkingDays] = useState<number>(initialState.monthlyWorkingDays || 26)
    const [avgOutput, setAvgOutput] = useState<number>(initialState.avgOutputPerLoomPerDay || 50)
    
    // Monthly expenses for detailed path
    const [rent, setRent] = useState<number>(0)
    const [electricity, setElectricity] = useState<number>(0)
    const [staff, setStaff] = useState<number>(0)
    const [others, setOthers] = useState<number>(0)

    const handleFastPathFinish = async () => {
        await onComplete({
            overheadOverridePerM: overheadPerM,
            isConfigured: true
        })
    }

    const handleDetailedPathFinish = async () => {
        // Build overhead items from inputs
        const items: OverheadItem[] = [
            { id: nanoid(), label: 'Rent / Lease', monthlyAmount: rent, category: 'rent', isPreset: true, isLocked: false, source: 'manual' },
            { id: nanoid(), label: 'Electricity', monthlyAmount: electricity, category: 'electricity', isPreset: true, isLocked: false, source: 'manual' },
            { id: nanoid(), label: 'Fixed Salary Staff', monthlyAmount: staff, category: 'admin', isPreset: true, isLocked: false, source: 'manual' },
            { id: nanoid(), label: 'Other Expenses', monthlyAmount: others, category: 'custom', isPreset: true, isLocked: false, source: 'manual' },
        ]
        
        // Calculate monthly output
        const monthlyOutput = loomCount * avgOutput * workingDays

        await onComplete({
            loomCount,
            monthlyWorkingDays: workingDays,
            avgOutputPerLoomPerDay: avgOutput,
            overheadItems: ensureOverheadIntegrity(items),
            monthlyOutputM: monthlyOutput,
            overheadOverridePerM: null,
            isConfigured: true
        })
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
                                    step === 'choice' ? 30 : 
                                    step === 'fast' ? 70 : 
                                    step === 'detailed' ? 50 : 
                                    step === 'detailed-expenses' ? 80 : 100
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
                                        <h2 className="text-2xl font-black tracking-tight text-slate-900">Configure Your Factory</h2>
                                        <p className="text-slate-500 text-sm leading-relaxed">
                                            To give you accurate per-meter profits, we need to know your factory&apos;s baseline monthly expenses and capacity.
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={() => setStep('choice')}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold transition-all shadow-lg shadow-indigo-200"
                                    >
                                        Get Started
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
                                            onClick={() => setStep('fast')}
                                            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Zap className="h-6 w-6 text-amber-500" />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900">I know my Overhead / Meter</div>
                                                <div className="text-xs text-slate-500">Fastest way if you have a pre-calculated number (e.g. ₹13.50/m)</div>
                                            </div>
                                        </button>
                                        <button 
                                            onClick={() => setStep('detailed')}
                                            className="flex items-center gap-4 p-5 rounded-2xl border-2 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/50 transition-all text-left group"
                                        >
                                            <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                                <Calculator className="h-6 w-6 text-indigo-500" />
                                            </div>
                                            <div>
                                                <div className="font-black text-slate-900">Help me calculate it</div>
                                                <div className="text-xs text-slate-500">We&apos;ll guide you through loom count and monthly expenses</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {step === 'fast' && (
                                <div className="space-y-6">
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setStep('choice')} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400">
                                            <ArrowRight className="h-4 w-4 rotate-180" />
                                        </button>
                                        <h2 className="text-lg font-black text-slate-900">Enter Overhead Rate</h2>
                                    </div>
                                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
                                        <div className="space-y-2">
                                            <Label className="text-[10px] uppercase tracking-wider font-black text-slate-500">Factory Overhead (Per Meter)</Label>
                                            <div className="relative">
                                                <Input 
                                                    type="number"
                                                    value={overheadPerM}
                                                    onChange={(e) => setOverheadPerM(Number(e.target.value))}
                                                    className="h-14 text-2xl font-black text-indigo-600 pl-8 pr-12 rounded-xl border-slate-200 focus:ring-indigo-500/20"
                                                />
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-black text-slate-400">₹</span>
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">/m</span>
                                            </div>
                                        </div>
                                        <p className="text-[11px] text-slate-500 leading-relaxed italic">
                                            &quot;This should include rent, power, staff salaries, and repairs divided by your average monthly production.&quot;
                                        </p>
                                    </div>
                                    <Button 
                                        onClick={handleFastPathFinish}
                                        disabled={saving}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200"
                                    >
                                        {saving ? 'Saving...' : 'Finish Setup'}
                                        {!saving && <CheckCircle2 className="ml-2 h-4 w-4" />}
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
                                                onChange={e => setLoomCount(Number(e.target.value))}
                                                className="h-10 font-bold"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Working Days / Month</Label>
                                                <Input 
                                                    type="number" 
                                                    value={workingDays} 
                                                    onChange={e => setWorkingDays(Number(e.target.value))}
                                                    className="h-10 font-bold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Average m / Loom / Day</Label>
                                                <Input 
                                                    type="number" 
                                                    value={avgOutput} 
                                                    onChange={e => setAvgOutput(Number(e.target.value))}
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
                                    </div>
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
                                                    onChange={e => setRent(Number(e.target.value))}
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
                                                    onChange={e => setElectricity(Number(e.target.value))}
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
                                                    onChange={e => setStaff(Number(e.target.value))}
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
                                                    onChange={e => setOthers(Number(e.target.value))}
                                                    className="h-8 border-none bg-transparent font-black p-0 focus-visible:ring-0"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] font-bold text-emerald-600 uppercase tracking-tight">Calculated Overhead</div>
                                                <div className="text-xs text-emerald-500">Based on {(rent+electricity+staff+others).toLocaleString()} total cost</div>
                                            </div>
                                            <div className="text-xl font-black text-emerald-700">
                                                ₹{((rent+electricity+staff+others) / Math.max(1, (loomCount * workingDays * avgOutput))).toFixed(2)}
                                                <span className="text-xs ml-1">/m</span>
                                            </div>
                                        </div>
                                    </div>

                                    <Button 
                                        onClick={handleDetailedPathFinish}
                                        disabled={saving}
                                        className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold shadow-lg shadow-indigo-200"
                                    >
                                        {saving ? 'Saving...' : 'Complete Setup'}
                                        {!saving && <CheckCircle2 className="ml-2 h-4 w-4" />}
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            </AnimatePresence>
        </div>
    )
}
