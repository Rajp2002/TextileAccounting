'use client'

import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/i18n/context'
import { ONBOARDING_STEPS, type BaseOnboardingStep } from '@/lib/base-onboarding'

interface OnboardingStepperProps {
    currentStep: BaseOnboardingStep
    completedSteps: string[]
    onStepClick?: (step: BaseOnboardingStep) => void
}

const STEP_LABELS: Record<BaseOnboardingStep, string> = {
    factory: 'Factory',
    defaults: 'Defaults',
    machines: 'Machines',
    workers: 'Workers',
    payroll: 'Payroll',
    review: 'Review',
    completed: 'Completed',
}

export function OnboardingStepper({
    currentStep,
    completedSteps,
    onStepClick,
}: OnboardingStepperProps) {
    const { tx } = useTranslation()
    const currentIndex = ONBOARDING_STEPS.indexOf(currentStep)

    return (
        <nav aria-label="Onboarding Progress" className="w-full">
            <ol className="flex items-center justify-between gap-1 sm:gap-2">
                {ONBOARDING_STEPS.map((step, index) => {
                    const isCompleted = completedSteps.includes(step) || index < currentIndex
                    const isCurrent = step === currentStep
                    const isClickable = isCompleted && onStepClick

                    return (
                        <li key={step} className="flex flex-1 items-center">
                            <button
                                type="button"
                                disabled={!isClickable}
                                onClick={() => isClickable && onStepClick(step)}
                                className={cn(
                                    'group flex w-full items-center gap-2 rounded-lg p-1.5 text-left transition-all',
                                    isClickable ? 'cursor-pointer hover:bg-[var(--wv-cotton-200)]' : 'cursor-default'
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                                        isCompleted
                                            ? 'bg-[var(--wv-moss-700)] text-white'
                                            : isCurrent
                                            ? 'border-2 border-[var(--wv-brand-accent)] bg-[var(--wv-saffron-50)] text-[var(--wv-brand-ink)] font-bold'
                                            : 'border border-[var(--wv-cotton-400)] bg-[var(--wv-cotton-200)] text-[var(--wv-cotton-500)]'
                                    )}
                                >
                                    {isCompleted ? (
                                        <Check className="h-3.5 w-3.5 stroke-[3]" />
                                    ) : (
                                        index + 1
                                    )}
                                </span>

                                <span
                                    className={cn(
                                        'hidden text-xs font-medium transition-colors md:inline',
                                        isCurrent
                                            ? 'font-bold text-[var(--wv-neel-900)]'
                                            : isCompleted
                                            ? 'text-[var(--wv-neel-700)]'
                                            : 'text-[var(--wv-cotton-500)]'
                                    )}
                                >
                                    {tx(STEP_LABELS[step])}
                                </span>
                            </button>

                            {index < ONBOARDING_STEPS.length - 1 && (
                                <div
                                    className={cn(
                                        'hidden h-0.5 w-4 shrink-0 transition-colors sm:block lg:w-8',
                                        index < currentIndex
                                            ? 'bg-[var(--wv-brand-accent)]'
                                            : 'bg-[var(--wv-cotton-300)]'
                                    )}
                                />
                            )}
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
