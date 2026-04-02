'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
    CheckCircle2, Circle, ArrowRight, Loader2,
    Cpu, Layers, Users, ChevronRight
} from 'lucide-react'
import { getOnboardingStatus } from '@/app/(auth)/actions/auth'
import { cn } from '@/lib/utils'
import { motion } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

interface OnboardingStatus {
    hasMachine: boolean
    hasQuality: boolean
    hasWorker: boolean
    isComplete: boolean
}

interface Props {
    initialStatus: OnboardingStatus
}

const steps = [
    {
        key: 'hasMachine' as keyof OnboardingStatus,
        icon: Cpu,
        title: 'Add your first machine',
        description: 'Machines are the primary production units that workers operate.',
        href: '/owner/machines',
        cta: 'Add machine',
        color: 'blue',
    },
    {
        key: 'hasQuality' as keyof OnboardingStatus,
        icon: Layers,
        title: 'Define a yarn quality',
        description: 'Qualities set target yield, sale price, and piece-rate for workers.',
        href: '/owner/inventory',
        cta: 'Add quality',
        color: 'violet',
    },
    {
        key: 'hasWorker' as keyof OnboardingStatus,
        icon: Users,
        title: 'Add your first worker',
        description: 'Workers are linked to machines and tracked for payroll.',
        href: '/owner/workers',
        cta: 'Add worker',
        color: 'emerald',
    },
]

export default function OnboardingChecklist({ initialStatus }: Props) {
    const router = useRouter()
    const [status, setStatus] = useState<OnboardingStatus>(initialStatus)
    const [refreshing, setRefreshing] = useState(false)
    const [completing, setCompleting] = useState(false)

    const completedCount = [status.hasMachine, status.hasQuality, status.hasWorker].filter(Boolean).length

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            const newStatus = await getOnboardingStatus()
            setStatus(newStatus)
            if (newStatus.isComplete) {
                toast.success('Setup complete! Redirecting to dashboard...')
            }
        } catch {
            toast.error('Failed to refresh status')
        } finally {
            setRefreshing(false)
        }
    }

    const handleGoToDashboard = async () => {
        if (!status.isComplete) return
        setCompleting(true)

        // Force a session refresh so the JWT picks up onboarding_complete = true
        const supabase = createClient()
        await supabase.auth.refreshSession()

        router.push('/owner/analytics')
    }

    const handleStepClick = (href: string) => {
        // Open in same tab — the back button returns to /onboarding
        router.push(href)
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-4">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-lg"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-100 mb-4">
                        <Layers className="h-7 w-7 text-amber-700" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Set up your factory</h1>
                    <p className="text-gray-500 mt-1 text-sm">
                        Complete these steps to start tracking production
                    </p>

                    {/* Progress bar */}
                    <div className="mt-4 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <motion.div
                                className="h-full bg-amber-500 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${(completedCount / 3) * 100}%` }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                            />
                        </div>
                        <span className="text-sm font-medium text-gray-600 tabular-nums w-12 text-right">
                            {completedCount}/3
                        </span>
                    </div>
                </div>

                {/* Steps */}
                <div className="space-y-3 mb-6">
                    {steps.map((step, i) => {
                        const done = status[step.key] === true
                        const Icon = step.icon

                        return (
                            <motion.div
                                key={step.key}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.08 }}
                            >
                                <button
                                    onClick={() => !done && handleStepClick(step.href)}
                                    disabled={done}
                                    className={cn(
                                        'w-full text-left rounded-xl border-2 p-4 transition-all duration-200',
                                        done
                                            ? 'border-emerald-200 bg-emerald-50/50 cursor-default'
                                            : 'border-gray-200 bg-white hover:border-amber-300 hover:shadow-sm hover:-translate-y-0.5 cursor-pointer'
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Status icon */}
                                        <div className={cn(
                                            'flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
                                            done ? 'bg-emerald-100' : 'bg-gray-100'
                                        )}>
                                            {done
                                                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                                                : <Icon className="h-5 w-5 text-gray-500" />
                                            }
                                        </div>

                                        {/* Text */}
                                        <div className="flex-1 min-w-0">
                                            <p className={cn(
                                                'font-semibold text-sm',
                                                done ? 'text-emerald-700 line-through decoration-1' : 'text-gray-900'
                                            )}>
                                                {step.title}
                                            </p>
                                            {!done && (
                                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                                    {step.description}
                                                </p>
                                            )}
                                            {done && (
                                                <p className="text-xs text-emerald-600 mt-0.5 font-medium">Done ✓</p>
                                            )}
                                        </div>

                                        {/* Action */}
                                        {!done && (
                                            <div className="flex-shrink-0 flex items-center gap-1 text-amber-700 text-sm font-medium">
                                                {step.cta}
                                                <ChevronRight className="h-4 w-4" />
                                            </div>
                                        )}
                                    </div>
                                </button>
                            </motion.div>
                        )
                    })}
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    <Button
                        id="go-to-dashboard-btn"
                        onClick={handleGoToDashboard}
                        disabled={!status.isComplete || completing}
                        className="w-full h-12 text-base font-semibold"
                    >
                        {completing ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Loading dashboard...
                            </>
                        ) : (
                            <span className="flex items-center gap-2">
                                Go to dashboard
                                <ArrowRight className="h-4 w-4" />
                            </span>
                        )}
                    </Button>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        disabled={refreshing || completing}
                        className="w-full text-gray-500 hover:text-gray-700"
                    >
                        {refreshing ? (
                            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Checking...</>
                        ) : (
                            'Refresh status'
                        )}
                    </Button>
                </div>

                <p className="text-center text-xs text-gray-400 mt-6">
                    Each step connects to a full management page. You can always come back here.
                </p>
            </motion.div>
        </div>
    )
}
