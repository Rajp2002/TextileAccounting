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
                                    isClickable ? 'cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-800' : 'cursor-default'
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-all',
                                        isCompleted
                                            ? 'bg-amber-600 text-white'
                                            : isCurrent
                                            ? 'border-2 border-amber-600 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                            : 'border border-stone-300 bg-stone-100 text-stone-400 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-500'
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
                                            ? 'font-bold text-stone-900 dark:text-stone-100'
                                            : isCompleted
                                            ? 'text-stone-700 dark:text-stone-300'
                                            : 'text-stone-400 dark:text-stone-500'
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
                                            ? 'bg-amber-600'
                                            : 'bg-stone-200 dark:bg-stone-700'
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
