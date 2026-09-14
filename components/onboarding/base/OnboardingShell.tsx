'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useTranslation } from '@/lib/i18n/context'
import { OnboardingStepper } from './OnboardingStepper'
import type { BaseOnboardingStep } from '@/lib/base-onboarding'
import { cn } from '@/lib/utils'

interface OnboardingShellProps {
    children: React.ReactNode
    currentStep: BaseOnboardingStep
    completedSteps: string[]
    onStepClick?: (step: BaseOnboardingStep) => void
    onBack?: () => void
    onSaveAndContinue: () => void
    onSkip?: () => void
    canSkip?: boolean
    saveLabel?: string
    isSaving?: boolean
    isCompleted?: boolean
}

export function OnboardingShell({
    children,
    currentStep,
    completedSteps,
    onStepClick,
    onBack,
    onSaveAndContinue,
    onSkip,
    canSkip = false,
    saveLabel,
    isSaving = false,
    isCompleted = false,
}: OnboardingShellProps) {
    const { tx } = useTranslation()

    return (
        <div className="relative flex min-h-screen flex-col bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
            {/* Top Navigation Header */}
            <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/90">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <Link href="/owner/today" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded-lg">
                            <Image
                                src="/images/WeavlyLogo.png"
                                alt="Weavly"
                                width={110}
                                height={38}
                                priority
                                className="h-8 w-auto object-contain"
                            />
                        </Link>
                        <div className="hidden h-5 w-px bg-stone-200 sm:block dark:bg-stone-700" />
                        <span className="hidden text-xs font-semibold text-stone-500 sm:inline dark:text-stone-400">
                            {tx('Factory Setup')}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher placement="bottom" className="bg-stone-100 text-xs dark:bg-stone-800" />
                    </div>
                </div>

                {/* Progress Stepper (hidden on completed screen) */}
                {!isCompleted && (
                    <div className="border-t border-stone-100 bg-stone-50/70 px-4 py-2 dark:border-stone-800/80 dark:bg-stone-900/40 sm:px-6">
                        <div className="mx-auto max-w-5xl">
                            <OnboardingStepper
                                currentStep={currentStep}
                                completedSteps={completedSteps}
                                onStepClick={onStepClick}
                            />
                        </div>
                    </div>
                )}
            </header>

            {/* Main Content Area */}
            <main className="flex-1 px-4 py-6 pb-28 sm:px-6 sm:py-8">
                <div className="mx-auto max-w-5xl">
                    {children}
                </div>
            </main>

            {/* Sticky Action Footer (hidden on completed screen) */}
            {!isCompleted && (
                <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-stone-200 bg-white/95 py-3.5 backdrop-blur-md dark:border-stone-800 dark:bg-stone-900/95">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
                        <div>
                            {onBack && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onBack}
                                    disabled={isSaving}
                                    className="gap-2 text-xs font-semibold text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                                >
                                    <ArrowLeft className="h-4 w-4" />
                                    <span>{tx('Back')}</span>
                                </Button>
                            )}
                        </div>

                        <div className="flex items-center gap-3">
                            {canSkip && onSkip && (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onSkip}
                                    disabled={isSaving}
                                    className="text-xs font-medium text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100"
                                >
                                    {tx("I'll add these later")}
                                </Button>
                            )}

                            <Button
                                type="button"
                                onClick={onSaveAndContinue}
                                disabled={isSaving}
                                className="min-w-[140px] gap-2 bg-amber-600 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-700"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        <span>{tx('Saving...')}</span>
                                    </>
                                ) : (
                                    <>
                                        <span>{tx(saveLabel || 'Save & Continue')}</span>
                                        <ArrowRight className="h-4 w-4" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    )
}
