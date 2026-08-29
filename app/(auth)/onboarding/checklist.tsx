'use client'

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    Activity,
    ArrowRight,
    Calculator,
    Calendar,
    CheckCircle2,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    IndianRupee,
    Layers,
    Link2,
    Loader2,
    Server,
    Sparkles,
    Store,
    Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import { getOnboardingStatus, markOnboardingComplete } from '@/app/(auth)/actions/auth'
import { updateOrganizationProductionMode } from '@/app/(dashboard)/owner/actions'
import { BrandBackground } from '@/components/brand-background'
import { LoomiAvatar } from '@/components/onboarding/loomi-avatar'
import { PRODUCTION_MODE_OPTIONS, type ProductionMode } from '@/lib/production-mode'

// ─── Types ──────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
    hasProductionMode: boolean
    hasMachine: boolean
    hasWorker: boolean
    hasPayrollConfig: boolean
    hasPlan: boolean
    isComplete: boolean
}

interface Props { initialStatus: OnboardingStatus }

function ProductionModeForm({ onDone }: { onDone: () => void }) {
    const [selected, setSelected] = useState<ProductionMode>('market_run')
    const [saving, setSaving] = useState(false)

    const handleSave = async () => {
        setSaving(true)
        const res = await updateOrganizationProductionMode(selected)
        setSaving(false)

        if (res?.error) {
            toast.error(res.error)
            return
        }

        toast.success('Production mode saved')
        onDone()
    }

    return (
        <div className="space-y-4 border-t border-gray-100 pt-4">
            <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-900">How do you usually produce fabric?</p>
                <p className="text-sm text-gray-500">This only changes which workflows Weavly shows first. You can change it later.</p>
            </div>

            <div className="grid gap-3">
                {PRODUCTION_MODE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelected(option.value)}
                        className={cn(
                            'rounded-xl border p-4 text-left transition-all',
                            selected === option.value
                                ? 'border-amber-400 bg-amber-50 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/40'
                        )}
                    >
                        <span className="block text-sm font-bold text-gray-900">{option.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-gray-500">{option.description}</span>
                    </button>
                ))}
            </div>

            <Button onClick={handleSave} disabled={saving} className="h-10 w-full bg-amber-600 font-semibold text-white hover:bg-amber-700">
                {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save production mode'}
            </Button>
        </div>
    )
}

const STEPS = [
    {
        key: 'hasProductionMode' as keyof OnboardingStatus,
        icon: Store,
        title: 'Choose production mode',
        description: 'Tell Weavly whether you produce for market stock, orders, or both.',
        form: ProductionModeForm,
    },
]

const TOUR_STEPS = [
    {
        icon: Store,
        label: 'Factory path',
        title: 'Choose how this factory usually runs.',
        body: 'Market stock, party orders, or both decides which workflows Weavly keeps closest.',
    },
    {
        icon: Calculator,
        label: 'Cost Estimate',
        title: 'Create the first fabric Cost Estimate after setup.',
        body: 'The estimator turns Fabric Quality, yarn, wage rate, and overhead into a Market Run or Party Order the factory can follow.',
    },
    {
        icon: ClipboardList,
        label: 'First run',
        title: 'Start an order or market run when you are ready.',
        body: 'If the chosen production workflow needs a loom, Weavly will ask for one at that moment—not during this first setup.',
    },
    {
        icon: Link2,
        label: 'Loom link',
        title: 'Connect the run to the loom floor.',
        body: 'Assignments answer who is running the loom and what fabric the loom is producing.',
    },
    {
        icon: Activity,
        label: 'Shift production',
        title: 'Log the first shift production.',
        body: 'When production logging needs a worker, Weavly will guide you to add one in context.',
    },
    {
        icon: IndianRupee,
        label: 'Dispatch',
        title: 'Finish with dispatch and commercials.',
        body: 'Once fabric leaves the factory, Weavly keeps Sale, Dispatch, Party Receipt Confirmation, Amount Due, and profit distinct.',
    },
]

function OnboardingGuideCard() {
    const [tourIndex, setTourIndex] = useState(0)
    const tourStep = TOUR_STEPS[tourIndex]
    const TourIcon = tourStep.icon
    const isLastStep = tourIndex === TOUR_STEPS.length - 1

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="mb-5 overflow-hidden rounded-2xl border border-saffron/20 bg-white/90 shadow-sm backdrop-blur-sm"
        >
            <div className="flex gap-3 p-4">
                <LoomiAvatar size="lg" />
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-saffron/10 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-saffron-deep">
                            <Sparkles className="h-3 w-3" />
                            Loomi guide
                        </span>
                        <span className="text-[11px] font-semibold text-subtle">60-second tour</span>
                    </div>
                    <h2 className="text-base font-bold leading-snug text-ink">
                        Set up only the basics. Factory Today will guide the real production loop.
                    </h2>
                    <p className="mt-1 text-sm leading-relaxed text-body">
                        Loomi will keep this first pass short, then continue one next action at a time after you enter the dashboard.
                    </p>
                </div>
            </div>

            <div className="border-t border-saffron/10 bg-saffron/5 px-4 py-3">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={tourStep.label}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex items-start gap-3"
                        aria-live="polite"
                    >
                        <motion.div
                            initial={{ scale: 0.92, rotate: -3 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-saffron-deep shadow-sm"
                        >
                            <TourIcon className="h-4 w-4" />
                        </motion.div>
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold uppercase tracking-wide text-saffron-deep">
                                {tourIndex + 1}/{TOUR_STEPS.length} · {tourStep.label}
                            </p>
                            <p className="mt-0.5 text-sm font-bold leading-tight text-ink">{tourStep.title}</p>
                            <p className="mt-1 text-xs leading-relaxed text-body">{tourStep.body}</p>
                        </div>
                    </motion.div>
                </AnimatePresence>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                        {TOUR_STEPS.map((step, index) => (
                            <motion.button
                                key={step.label}
                                type="button"
                                onClick={() => setTourIndex(index)}
                                whileTap={{ scale: 0.9 }}
                                className={cn(
                                    'h-2 rounded-full transition-all',
                                    index === tourIndex ? 'w-6 bg-saffron' : 'w-2 bg-saffron/25 hover:bg-saffron/45'
                                )}
                                aria-label={`Show tour step ${index + 1}`}
                            />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            disabled={tourIndex === 0}
                            onClick={() => setTourIndex((current) => Math.max(0, current - 1))}
                            className="text-saffron-deep disabled:opacity-30"
                        >
                            Back
                        </Button>
                        <Button
                            type="button"
                            size="xs"
                            onClick={() => setTourIndex((current) => isLastStep ? 0 : current + 1)}
                            className="bg-saffron text-white hover:bg-saffron-deep"
                        >
                            {isLastStep ? 'Replay' : 'Next'}
                            <ArrowRight className="h-3 w-3" />
                        </Button>
                    </div>
                </div>
            </div>
        </motion.div>
    )
}

function DeferredSetupCard({ status }: { status: OnboardingStatus }) {
    const items = [
        { label: 'Looms', detail: 'Add when starting a Full Suite production run.', icon: Server, done: status.hasMachine },
        { label: 'Workers', detail: 'Add when recording production.', icon: Users, done: status.hasWorker },
        { label: 'Payroll', detail: 'Configure when you are ready to pay workers.', icon: Calendar, done: status.hasPayrollConfig },
    ]

    return (
        <div className="mb-6 rounded-xl border border-dashed border-gray-300 bg-white/70 p-4">
            <div>
                <p className="text-sm font-semibold text-gray-900">Set these up when you need them</p>
                <p className="mt-1 text-xs leading-relaxed text-gray-500">None of these block your first costing or dashboard visit.</p>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {items.map((item) => {
                    const Icon = item.icon
                    return (
                        <div key={item.label} className="flex items-start gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', item.done ? 'text-emerald-500' : 'text-gray-400')} />
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-800">{item.label}{item.done ? ' · ready' : ''}</p>
                                <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{item.detail}</p>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ─── Main Component ───────────────────────────────────────────────────────────────

export default function OnboardingChecklist({ initialStatus }: Props) {
    const queryClient = useQueryClient()
    const [status, setStatus] = useState<OnboardingStatus>(initialStatus)
    const [openStep, setOpenStep] = useState<string | null>(
        STEPS.find((step) => !initialStatus[step.key])?.key ?? null
    )
    const [refreshing, setRefreshing] = useState(false)
    const [completing, setCompleting] = useState(false)

    const completedCount = status.hasProductionMode ? 1 : 0
    const progressPct = (completedCount / STEPS.length) * 100

    const refresh = async () => {
        setRefreshing(true)
        try {
            const newStatus = await getOnboardingStatus()
            setStatus(newStatus)
            if (newStatus.isComplete) {
                toast.success('Setup complete! You can now go to the dashboard.')
                setOpenStep(null)
            }
        } catch {
            toast.error('Failed to refresh. Please try again.')
        } finally {
            setRefreshing(false)
        }
    }

    const executeGoToDashboard = async () => {
        setCompleting(true)

        // Mark the organization before refreshing the session. This lets the
        // middleware stop redirecting the owner back to this page. The call is
        // intentionally non-fatal because the middleware also has a DB fallback.
        try {
            const markRes = await markOnboardingComplete()
            if (markRes?.error) {
                console.warn('[OnboardingChecklist] markOnboardingComplete returned error:', markRes.error)
            }
        } catch (error) {
            console.warn('[OnboardingChecklist] markOnboardingComplete threw (non-fatal):', error)
        }

        try {
            const supabase = createClient()
            await supabase.auth.refreshSession()
        } catch (error) {
            console.warn('[OnboardingChecklist] Session refresh failed, proceeding anyway:', error)
        }

        try {
            queryClient.clear()
        } catch (error) {
            console.warn('[OnboardingChecklist] Failed to clear query client:', error)
        }

        window.location.href = '/owner/today'
    }

    const handleStepDone = async (key: string) => {
        const newStatus = { ...status, [key]: true } as OnboardingStatus
        newStatus.isComplete = newStatus.hasProductionMode && newStatus.hasPlan
        setStatus(newStatus)

        if (newStatus.isComplete) {
            toast.success('All done! Redirecting to dashboard...')
            setOpenStep(null)
            await executeGoToDashboard()
        } else {
            const next = STEPS.find((step) => !newStatus[step.key])
            setOpenStep(next?.key ?? null)
        }
    }

    const handleGoToDashboard = async () => {
        if (!status.isComplete) return
        await executeGoToDashboard()
    }

    return (
        <div className="relative isolate flex min-h-screen items-start justify-center overflow-hidden bg-background p-4 pt-8">
            <BrandBackground variant="auth" />
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-xl"
            >
                <div className="mb-8 text-center">
                    <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 shadow-sm">
                        <Layers className="h-7 w-7 text-amber-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Start with the basics</h1>
                    <p className="mt-1 text-sm text-gray-500">Configure your factory path now. Add operational details when you use them.</p>

                    <div className="mt-5 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                            <motion.div
                                className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progressPct}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                        <span className="w-12 text-right text-sm font-semibold tabular-nums text-gray-700">
                            {completedCount}/{STEPS.length}
                        </span>
                    </div>
                </div>

                <OnboardingGuideCard />

                <div className="mb-4 space-y-3">
                    {STEPS.map((step, index) => {
                        const done = !!status[step.key]
                        const isOpen = openStep === step.key
                        const Icon = step.icon
                        const FormComponent = step.form

                        return (
                            <motion.div
                                key={step.key}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.07 }}
                                className={cn(
                                    'overflow-hidden rounded-xl border-2 transition-all duration-200',
                                    done ? 'border-emerald-200 bg-emerald-50/40' : isOpen ? 'border-amber-300 bg-amber-50/30 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                                )}
                            >
                                <button
                                    type="button"
                                    disabled={done}
                                    onClick={() => setOpenStep(isOpen ? null : step.key)}
                                    className="flex w-full items-center gap-4 p-4 text-left"
                                >
                                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', done ? 'bg-emerald-100' : 'bg-gray-100')}>
                                        {done ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <Icon className="h-5 w-5 text-gray-500" />}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className={cn('text-sm font-semibold', done ? 'text-emerald-700 line-through decoration-1' : 'text-gray-900')}>
                                            {step.title}
                                        </p>
                                        {!done && <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{step.description}</p>}
                                        {done && <p className="mt-0.5 text-xs font-medium text-emerald-600">Done ✓</p>}
                                    </div>
                                    {!done && (isOpen ? <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />)}
                                </button>

                                <AnimatePresence>
                                    {isOpen && !done && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.22, ease: 'easeInOut' }}
                                            className="overflow-hidden"
                                        >
                                            <div className="px-4 pb-4">
                                                <FormComponent onDone={() => handleStepDone(step.key)} />
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        )
                    })}
                </div>

                <DeferredSetupCard status={status} />

                <div className="space-y-3">
                    <Button
                        id="go-to-dashboard-btn"
                        onClick={handleGoToDashboard}
                        disabled={!status.isComplete || completing}
                        className={cn(
                            'h-12 w-full text-base font-semibold transition-all',
                            status.isComplete ? 'bg-amber-600 text-white shadow-md shadow-amber-200 hover:bg-amber-700' : 'cursor-not-allowed bg-gray-100 text-gray-400'
                        )}
                    >
                        {completing ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading dashboard...</> : <span className="flex items-center gap-2">Go to dashboard <ArrowRight className="h-4 w-4" /></span>}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={refresh}
                        disabled={refreshing || completing}
                        className="w-full text-xs text-gray-400 hover:text-gray-600"
                    >
                        {refreshing ? <><Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> Checking...</> : 'Refresh status'}
                    </Button>
                </div>

                <p className="mt-5 pb-8 text-center text-xs text-gray-400">
                    Looms, workers, and payroll can be added later from the workflow that needs them.
                </p>
            </motion.div>
        </div>
    )
}
