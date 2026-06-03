'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import {
    CheckCircle2,
    Store,
    Server,
    Palette,
    Users,
    UserPlus,
    ShieldCheck,
    Calendar,
    CreditCard,
    ArrowRight,
    SkipForward,
    X,
    Sparkles,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────────────────────

export interface SetupChecklist {
    hasProductionMode: boolean
    hasMachine: boolean
    hasQuality: boolean
    hasMeterWorker: boolean
    hasFixedWorker: boolean
    hasSupervisor: boolean
    hasPayrollConfig: boolean
    hasPlan: boolean
}

interface SetupPanelProps {
    checklist: SetupChecklist
}

// ─── Step Definitions ───────────────────────────────────────────────────────────

const SETUP_STEPS = [
    {
        key: 'hasProductionMode' as keyof SetupChecklist,
        icon: Store,
        title: 'Choose production mode',
        description: 'Tell Weavly if you produce for market stock, orders, or both.',
        href: '/onboarding',
        ctaLabel: 'Set up',
        accentClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        skippable: false,
    },
    {
        key: 'hasMachine' as keyof SetupChecklist,
        icon: Server,
        title: 'Add your looms',
        description: 'Add all the machines/looms in your factory.',
        href: '/owner/machines',
        ctaLabel: 'Add looms',
        accentClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        skippable: false,
    },
    {
        key: 'hasQuality' as keyof SetupChecklist,
        icon: Palette,
        title: 'Add your first quality',
        description: 'Define a fabric quality inside the estimator flow.',
        href: '/owner/estimator',
        ctaLabel: 'Create quality',
        accentClass: 'text-violet-600',
        bgClass: 'bg-violet-50',
        skippable: false,
    },
    {
        key: 'hasMeterWorker' as keyof SetupChecklist,
        icon: Users,
        title: 'Add piece-rate workers',
        description: 'Workers tracked for production and payroll.',
        href: '/owner/fixed-workers',
        ctaLabel: 'Add workers',
        accentClass: 'text-emerald-600',
        bgClass: 'bg-emerald-50',
        skippable: false,
    },
    {
        key: 'hasFixedWorker' as keyof SetupChecklist,
        icon: UserPlus,
        title: 'Add fixed/salary staff',
        description: 'Salaried workers with attendance-based pay.',
        href: '/owner/fixed-workers',
        ctaLabel: 'Add staff',
        accentClass: 'text-blue-600',
        bgClass: 'bg-blue-50',
        skippable: true,
        skipLabel: "Skip — I don't have salary staff",
    },
    {
        key: 'hasSupervisor' as keyof SetupChecklist,
        icon: ShieldCheck,
        title: 'Invite your supervisor',
        description: 'A supervisor account is needed to log daily production.',
        href: '/owner/settings',
        ctaLabel: 'Get join code',
        accentClass: 'text-orange-600',
        bgClass: 'bg-orange-50',
        skippable: false,
        extraContext: true,
    },
    {
        key: 'hasPayrollConfig' as keyof SetupChecklist,
        icon: Calendar,
        title: 'Set your pay cycle',
        description: 'Define the monthly payroll period and pay date.',
        href: '/owner/payroll',
        ctaLabel: 'Configure payroll',
        accentClass: 'text-violet-600',
        bgClass: 'bg-violet-50',
        skippable: false,
    },
    {
        key: 'hasPlan' as keyof SetupChecklist,
        icon: CreditCard,
        title: 'Choose your plan',
        description: 'Start a free 7-day trial or subscribe. No card required for trial.',
        href: '/owner/billing',
        ctaLabel: 'View plans',
        accentClass: 'text-amber-600',
        bgClass: 'bg-amber-50',
        skippable: false,
    },
] as const

const SKIP_STORAGE_KEY = 'weavly_skip_fixed_staff'
const TOTAL_STEPS = SETUP_STEPS.length

// ─── Step List (shared between desktop and mobile) ──────────────────────────────

function SetupStepList({ checklist, skippedFixed, onSkipFixed }: {
    checklist: SetupChecklist
    skippedFixed: boolean
    onSkipFixed: () => void
}) {
    const getStepStatus = useCallback((step: typeof SETUP_STEPS[number]) => {
        if (step.key === 'hasFixedWorker' && skippedFixed) return 'completed'
        return checklist[step.key] ? 'completed' : 'incomplete'
    }, [checklist, skippedFixed])

    const completedCount = SETUP_STEPS.reduce((count, step) => {
        return count + (getStepStatus(step) === 'completed' ? 1 : 0)
    }, 0)

    const progressPct = (completedCount / TOTAL_STEPS) * 100

    // Find the first incomplete step (the "current" step)
    const currentStepKey = SETUP_STEPS.find(s => getStepStatus(s) === 'incomplete')?.key ?? null

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="h-4 w-4 text-saffron" />
                    <h2 className="text-sm font-bold text-ink uppercase tracking-wide">Factory Setup</h2>
                </div>
                <p className="text-xs text-body mt-0.5">{completedCount} of {TOTAL_STEPS} steps complete</p>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-saffron to-amber-400 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${progressPct}%` }}
                        transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                </div>
            </div>

            {/* Step list */}
            <div className="flex-1 overflow-y-auto px-5 pb-5">
                <div className="relative">
                    {/* Vertical connector line */}
                    <div className="absolute left-[15px] top-4 bottom-4 w-px bg-gray-200" />

                    <div className="space-y-1">
                        {SETUP_STEPS.map((step, i) => {
                            const status = getStepStatus(step)
                            const isCurrent = step.key === currentStepKey
                            const Icon = step.icon

                            return (
                                <motion.div
                                    key={step.key}
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.04 }}
                                >
                                    <div
                                        className={cn(
                                            'relative rounded-xl transition-all duration-200',
                                            isCurrent
                                                ? 'bg-white border border-saffron/30 shadow-sm p-3'
                                                : 'p-3',
                                        )}
                                    >
                                        <div className="flex items-start gap-3">
                                            {/* Step circle */}
                                            <div className={cn(
                                                'relative z-10 flex items-center justify-center w-[30px] h-[30px] rounded-full shrink-0 transition-all duration-200',
                                                status === 'completed'
                                                    ? 'bg-emerald-100'
                                                    : isCurrent
                                                        ? 'bg-saffron/10 ring-2 ring-saffron/30'
                                                        : 'bg-gray-100'
                                            )}>
                                                {status === 'completed' ? (
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                ) : (
                                                    <span className={cn(
                                                        'text-xs font-bold',
                                                        isCurrent ? 'text-saffron' : 'text-gray-400'
                                                    )}>
                                                        {i + 1}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Step content */}
                                            <div className="flex-1 min-w-0">
                                                <p className={cn(
                                                    'text-sm font-semibold leading-tight',
                                                    status === 'completed'
                                                        ? 'text-emerald-700 line-through decoration-1'
                                                        : isCurrent ? 'text-ink' : 'text-body'
                                                )}>
                                                    {step.title}
                                                </p>

                                                {status === 'completed' && (
                                                    <p className="text-[11px] text-emerald-500 font-medium mt-0.5">Done ✓</p>
                                                )}

                                                {/* Expanded content for current step */}
                                                {isCurrent && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        className="mt-1.5"
                                                    >
                                                        <p className="text-xs text-body leading-relaxed">
                                                            {step.description}
                                                        </p>

                                                        {/* Supervisor extra context */}
                                                        {step.key === 'hasSupervisor' && (
                                                            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200/60 px-3 py-2">
                                                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                                                    If you don&apos;t have a separate supervisor, create a second account for yourself using the join code from Settings.
                                                                </p>
                                                                <p className="text-[11px] text-amber-600 mt-1 italic">
                                                                    🔜 Future update: production logging from owner account.
                                                                </p>
                                                            </div>
                                                        )}

                                                        {/* Supervisor status indicator */}
                                                        {step.key === 'hasSupervisor' && (
                                                            <div className={cn(
                                                                'mt-2 flex items-center gap-1.5 text-[11px] font-medium rounded-md px-2 py-1 w-fit',
                                                                checklist.hasSupervisor
                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                    : 'bg-red-50 text-red-600'
                                                            )}>
                                                                {checklist.hasSupervisor ? '✅ Supervisor joined' : '⚠️ No supervisor yet'}
                                                            </div>
                                                        )}

                                                        <Link
                                                            href={step.href}
                                                            className={cn(
                                                                'mt-2.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5',
                                                                'text-xs font-semibold text-white transition-colors',
                                                                'bg-saffron hover:bg-saffron-deep'
                                                            )}
                                                        >
                                                            <Icon className="h-3.5 w-3.5" />
                                                            {step.ctaLabel}
                                                            <ArrowRight className="h-3 w-3" />
                                                        </Link>

                                                        {/* Skip button for fixed staff step */}
                                                        {step.key === 'hasFixedWorker' && (
                                                            <button
                                                                type="button"
                                                                onClick={onSkipFixed}
                                                                className="mt-1.5 flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                                                            >
                                                                <SkipForward className="h-3 w-3" />
                                                                Skip — I don&apos;t have salary staff
                                                            </button>
                                                        )}
                                                    </motion.div>
                                                )}

                                                {/* Upcoming step — show description in muted */}
                                                {!isCurrent && status !== 'completed' && (
                                                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">
                                                        {step.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-5 pb-4 pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 text-center">
                    All settings can be changed later.
                </p>
            </div>
        </div>
    )
}

// ─── Desktop Panel ──────────────────────────────────────────────────────────────

export function SetupPanel({ checklist }: SetupPanelProps) {
    const [skippedFixed, setSkippedFixed] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    useEffect(() => {
        setSkippedFixed(localStorage.getItem(SKIP_STORAGE_KEY) === 'true')
    }, [])

    const handleSkipFixed = () => {
        localStorage.setItem(SKIP_STORAGE_KEY, 'true')
        setSkippedFixed(true)
    }

    // Check if all steps are complete
    const isAllComplete = SETUP_STEPS.every(step => {
        if (step.key === 'hasFixedWorker' && skippedFixed) return true
        return checklist[step.key]
    })

    if (isAllComplete || dismissed) return null

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.3 }}
            className="hidden md:flex flex-col sticky top-6 h-fit max-h-[calc(100vh-3rem)] rounded-2xl border border-saffron/15 bg-white/80 backdrop-blur-sm shadow-[0_4px_24px_-4px_rgba(226,112,37,0.08)] overflow-hidden"
        >
            <SetupStepList
                checklist={checklist}
                skippedFixed={skippedFixed}
                onSkipFixed={handleSkipFixed}
            />
        </motion.div>
    )
}

// ─── Mobile Floating Button + Modal ─────────────────────────────────────────────

export function SetupFloatingButton({ checklist }: SetupPanelProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [skippedFixed, setSkippedFixed] = useState(false)

    useEffect(() => {
        setSkippedFixed(localStorage.getItem(SKIP_STORAGE_KEY) === 'true')
    }, [])

    const handleSkipFixed = () => {
        localStorage.setItem(SKIP_STORAGE_KEY, 'true')
        setSkippedFixed(true)
    }

    const completedCount = SETUP_STEPS.reduce((count, step) => {
        if (step.key === 'hasFixedWorker' && skippedFixed) return count + 1
        return count + (checklist[step.key] ? 1 : 0)
    }, 0)

    const isAllComplete = completedCount === TOTAL_STEPS

    if (isAllComplete) return null

    const progressPct = (completedCount / TOTAL_STEPS) * 100
    // SVG circle math
    const radius = 22
    const circumference = 2 * Math.PI * radius
    const strokeDashoffset = circumference - (progressPct / 100) * circumference

    return (
        <>
            {/* Floating circle button */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        whileTap={{ scale: 0.9 }}
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className={cn(
                            'md:hidden fixed z-50 flex items-center justify-center',
                            'w-14 h-14 rounded-full',
                            'bg-[#111111] shadow-xl shadow-black/20',
                            'bottom-[calc(80px+env(safe-area-inset-bottom,0px))] right-4',
                        )}
                        aria-label={`Factory setup: ${completedCount} of ${TOTAL_STEPS} complete`}
                    >
                        {/* Progress ring */}
                        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 56 56">
                            <circle
                                cx="28" cy="28" r={radius}
                                fill="none"
                                stroke="rgba(255,255,255,0.1)"
                                strokeWidth="3"
                            />
                            <motion.circle
                                cx="28" cy="28" r={radius}
                                fill="none"
                                stroke="#E27025"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                initial={{ strokeDashoffset: circumference }}
                                animate={{ strokeDashoffset }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                        </svg>
                        {/* Center text */}
                        <span className="relative text-[11px] font-bold text-white">
                            {completedCount}/{TOTAL_STEPS}
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Modal overlay */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="md:hidden fixed inset-0 z-[60] flex items-end justify-center"
                    >
                        {/* Backdrop */}
                        <motion.div
                            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Modal content */}
                        <motion.div
                            initial={{ y: '100%', opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                            className={cn(
                                'relative z-10 w-full max-h-[85vh] rounded-t-2xl',
                                'bg-white overflow-hidden flex flex-col',
                                'shadow-[0_-8px_30px_-4px_rgba(0,0,0,0.2)]',
                                'pb-safe',
                            )}
                        >
                            {/* Modal drag handle + close */}
                            <div className="flex items-center justify-between px-4 pt-3 pb-1">
                                <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto" />
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                                    aria-label="Close setup panel"
                                >
                                    <X className="h-4 w-4 text-gray-400" />
                                </button>
                            </div>

                            <SetupStepList
                                checklist={checklist}
                                skippedFixed={skippedFixed}
                                onSkipFixed={handleSkipFixed}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    )
}
