'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LanguageSwitcher } from '@/components/i18n/language-switcher'
import { useTranslation } from '@/lib/i18n/context'
import { OnboardingStepper } from './OnboardingStepper'
import type { BaseOnboardingStep } from '@/lib/base-onboarding'

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
        <div className="relative flex min-h-screen flex-col bg-[var(--wv-cotton-100)] text-[var(--wv-neel-900)]">
            {/* Top Navigation Header */}
            <header className="safe-area-header px-safe sticky top-0 z-30 border-b border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-0)]/90 backdrop-blur-md">
                <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
                    <div className="flex items-center gap-3">
                        <Link href="/owner/estimator" className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-[var(--wv-brand-accent-strong)] rounded-lg">
                            <Image
                                src="/images/WeavlyLogo.png"
                                alt="Weavly"
                                width={110}
                                height={38}
                                priority
                                className="h-8 w-auto object-contain"
                            />
                        </Link>
                        <div className="hidden h-5 w-px bg-[var(--wv-cotton-300)] sm:block" />
                        <span className="hidden text-xs font-semibold text-[var(--wv-neel-500)] sm:inline">
                            {tx('Factory Setup')}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <LanguageSwitcher placement="bottom" className="bg-[var(--wv-cotton-200)] text-xs" />
                    </div>
                </div>

                {/* Progress Stepper (hidden on completed screen) */}
                {!isCompleted && (
                    <div className="border-t border-[var(--wv-cotton-200)] bg-[var(--wv-cotton-100)]/70 px-4 py-2 sm:px-6">
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
            <main className="flex-1 px-4 pt-6 pb-[calc(7rem+var(--safe-area-bottom))] sm:px-6 sm:pt-8">
                <div className="mx-auto max-w-5xl">
                    {children}
                </div>
            </main>

            {/* Sticky Action Footer (hidden on completed screen) */}
            {!isCompleted && (
                <footer className="px-safe fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--wv-cotton-300)] bg-[var(--wv-cotton-0)]/95 pt-3.5 pb-[calc(0.875rem+var(--safe-area-bottom))] backdrop-blur-md">
                    <div className="mx-auto flex max-w-5xl items-center justify-between px-4 sm:px-6">
                        <div>
                            {onBack && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onBack}
                                    disabled={isSaving}
                                    className="gap-2 text-xs font-semibold text-[var(--wv-neel-600)] hover:text-[var(--wv-neel-900)]"
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
                                    className="text-xs font-medium text-[var(--wv-neel-600)] hover:text-[var(--wv-neel-900)]"
                                >
                                    {tx("I'll add these later")}
                                </Button>
                            )}

                            <Button
                                type="button"
                                onClick={onSaveAndContinue}
                                disabled={isSaving}
                                className="min-w-[140px] gap-2 bg-[var(--wv-action-primary)] text-xs font-bold text-white shadow-sm hover:bg-[var(--wv-action-primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--wv-brand-accent-strong)]"
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
