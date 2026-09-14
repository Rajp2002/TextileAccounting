'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { toast } from '@/lib/app-notifications'
import { useTranslation } from '@/lib/i18n/context'
import type {
    BaseOnboardingDraft,
    BaseOnboardingStep,
    FactoryReadiness,
} from '@/lib/base-onboarding'
import { ONBOARDING_STEPS } from '@/lib/base-onboarding'
import {
    saveBaseOnboardingDraftAction,
    saveBaseOnboardingFactoryAction,
    saveBaseOnboardingDefaultsAction,
    saveBaseOnboardingMachinesBulkAction,
    saveBaseOnboardingWorkersBulkAction,
    saveBaseOnboardingPayrollAction,
    completeBaseOnboardingAction,
} from '@/app/(auth)/onboarding/base/actions'
import { OnboardingShell } from './OnboardingShell'
import { Step1Factory } from './Step1Factory'
import { Step2Defaults } from './Step2Defaults'
import { Step3Machines } from './Step3Machines'
import { Step4Workers } from './Step4Workers'
import { Step5Payroll } from './Step5Payroll'
import { Step6Review } from './Step6Review'
import { CompletionScreen } from './CompletionScreen'

interface BaseOnboardingWizardProps {
    orgId: string
    initialDraft: BaseOnboardingDraft
    initialReadiness: FactoryReadiness
    hasSavedCostings: boolean
    isAlreadyCompleted?: boolean
}

export function BaseOnboardingWizard({
    orgId,
    initialDraft,
    initialReadiness,
    hasSavedCostings,
    isAlreadyCompleted = false,
}: BaseOnboardingWizardProps) {
    const { tx } = useTranslation()
    const storageKey = `weavly_base_onboarding_draft_${orgId}`

    const [draft, setDraft] = useState<BaseOnboardingDraft>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(storageKey)
                if (stored) {
                    const parsed = JSON.parse(stored) as BaseOnboardingDraft
                    if (parsed && parsed.version === initialDraft.version) {
                        return { ...initialDraft, ...parsed }
                    }
                }
            } catch {
                // Ignore parsing errors
            }
        }
        return initialDraft
    })

    const [currentStep, setCurrentStep] = useState<BaseOnboardingStep>(
        isAlreadyCompleted ? 'completed' : draft.currentStep || 'factory'
    )
    const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
        const list: string[] = []
        if (initialReadiness.defaultsConfigured) list.push('defaults')
        if (initialReadiness.machinesConfigured) list.push('machines')
        if (initialReadiness.workersConfigured) list.push('workers')
        if (initialReadiness.payrollConfigured) list.push('payroll')
        return list
    })
    const [stepError, setStepError] = useState<string>('')
    const [isSaving, setIsSaving] = useState<boolean>(false)

    // Save draft to localStorage and debounce server sync
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(storageKey, JSON.stringify({ ...draft, currentStep }))
            } catch {
                // Ignore storage quota
            }
        }

        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        autoSaveTimerRef.current = setTimeout(() => {
            void saveBaseOnboardingDraftAction({ ...draft, currentStep })
        }, 1500)

        return () => {
            if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
        }
    }, [draft, currentStep, storageKey])

    const markStepCompleted = (step: BaseOnboardingStep) => {
        if (!completedSteps.includes(step)) {
            setCompletedSteps(prev => [...prev, step])
        }
    }

    // Step 1: Factory Profile Submit
    const handleSaveFactory = async () => {
        const name = (draft.factory.name || '').trim()
        if (!name) {
            setStepError('Please enter your factory name.')
            return
        }

        setIsSaving(true)
        setStepError('')
        const res = await saveBaseOnboardingFactoryAction({
            name,
            ownerContact: draft.factory.ownerContact,
        })
        setIsSaving(false)

        if (res.error) {
            setStepError(res.error)
            return
        }

        markStepCompleted('factory')
        setCurrentStep('defaults')
    }

    // Step 2: Defaults Submit
    const handleSaveDefaults = async () => {
        if (draft.defaults.yarnShortagePct < 0 || draft.defaults.yarnShortagePct > 100) {
            setStepError('Please enter a valid wastage percentage (0 to 100%).')
            return
        }
        if (draft.defaults.defaultMarginPct < 0 || draft.defaults.defaultMarginPct >= 100) {
            setStepError('Please enter a valid profit margin percentage (0 to 99.99%).')
            return
        }

        setIsSaving(true)
        setStepError('')
        const res = await saveBaseOnboardingDefaultsAction(draft.defaults)
        setIsSaving(false)

        if (res.error) {
            setStepError(res.error)
            return
        }

        markStepCompleted('defaults')
        setCurrentStep('machines')
    }

    // Step 3: Machines Submit
    const handleSaveMachines = async () => {
        // Collect all non-empty machines across all types
        const allMachines: Array<{ name: string; machineType: string; customLabel?: string }> = []
        for (const [type, rows] of Object.entries(draft.machines)) {
            for (const row of rows) {
                const trimmed = (row.name || '').trim()
                if (trimmed) {
                    allMachines.push({
                        name: trimmed,
                        machineType: row.machineType || type,
                        customLabel: row.customLabel,
                    })
                }
            }
        }

        setIsSaving(true)
        setStepError('')
        const res = await saveBaseOnboardingMachinesBulkAction(allMachines)
        setIsSaving(false)

        if (res.error) {
            setStepError(res.error)
            return
        }

        markStepCompleted('machines')
        setCurrentStep('workers')
    }

    const handleSkipMachines = () => {
        setStepError('')
        setDraft(prev => ({
            ...prev,
            skippedSteps: Array.from(new Set([...prev.skippedSteps, 'machines'])),
        }))
        setCurrentStep('workers')
    }

    // Step 4: Workforce Submit
    const handleSaveWorkers = async () => {
        const allWorkers: Array<{
            name: string
            payType: 'piece_rate' | 'fixed_monthly'
            monthlySalary?: number
            role?: string
            startDate?: string
        }> = []

        for (const w of draft.workers.pieceRate) {
            const trimmed = (w.name || '').trim()
            if (trimmed) {
                allWorkers.push({
                    name: trimmed,
                    payType: 'piece_rate',
                })
            }
        }

        for (const w of draft.workers.fixedSalary) {
            const trimmed = (w.name || '').trim()
            if (trimmed) {
                allWorkers.push({
                    name: trimmed,
                    payType: 'fixed_monthly',
                    monthlySalary: Number(w.monthlySalary) || 0,
                    role: w.role,
                    startDate: w.startDate,
                })
            }
        }

        setIsSaving(true)
        setStepError('')
        const res = await saveBaseOnboardingWorkersBulkAction(allWorkers)
        setIsSaving(false)

        if (res.error) {
            setStepError(res.error)
            return
        }

        markStepCompleted('workers')
        setCurrentStep('payroll')
    }

    const handleSkipWorkers = () => {
        setStepError('')
        setDraft(prev => ({
            ...prev,
            skippedSteps: Array.from(new Set([...prev.skippedSteps, 'workers'])),
        }))
        setCurrentStep('payroll')
    }

    // Step 5: Payroll Submit
    const handleSavePayroll = async () => {
        setIsSaving(true)
        setStepError('')
        const res = await saveBaseOnboardingPayrollAction(draft.payroll)
        setIsSaving(false)

        if (res.error) {
            setStepError(res.error)
            return
        }

        markStepCompleted('payroll')
        setCurrentStep('review')
    }

    const handleSkipPayroll = () => {
        setStepError('')
        setDraft(prev => ({
            ...prev,
            skippedSteps: Array.from(new Set([...prev.skippedSteps, 'payroll'])),
        }))
        setCurrentStep('review')
    }

    // Step 6: Review & Finalize
    const handleFinalizeOnboarding = async () => {
        setIsSaving(true)
        setStepError('')
        const res = await completeBaseOnboardingAction()
        setIsSaving(false)

        if (res.error) {
            setStepError(res.error)
            return
        }

        if (typeof window !== 'undefined') {
            localStorage.removeItem(storageKey)
        }

        toast.success(tx('Factory initialization complete!'))
        setCurrentStep('completed')
    }

    // Generic Back Button
    const handleBack = () => {
        setStepError('')
        const idx = ONBOARDING_STEPS.indexOf(currentStep)
        if (idx > 0) {
            setCurrentStep(ONBOARDING_STEPS[idx - 1])
        }
    }

    // Generic Save & Continue dispatcher
    const handleSaveAndContinue = () => {
        switch (currentStep) {
            case 'factory':
                void handleSaveFactory()
                break
            case 'defaults':
                void handleSaveDefaults()
                break
            case 'machines':
                void handleSaveMachines()
                break
            case 'workers':
                void handleSaveWorkers()
                break
            case 'payroll':
                void handleSavePayroll()
                break
            case 'review':
                void handleFinalizeOnboarding()
                break
            default:
                break
        }
    }

    // Generic Skip dispatcher
    const handleSkip = () => {
        if (currentStep === 'machines') handleSkipMachines()
        else if (currentStep === 'workers') handleSkipWorkers()
        else if (currentStep === 'payroll') handleSkipPayroll()
    }

    // Count summary for completion screen
    let totalMachines = 0
    for (const rows of Object.values(draft.machines)) {
        totalMachines += rows.filter(r => r.name && r.name.trim()).length
    }
    const totalWorkers =
        draft.workers.pieceRate.filter(r => r.name && r.name.trim()).length +
        draft.workers.fixedSalary.filter(r => r.name && r.name.trim()).length

    return (
        <OnboardingShell
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={step => {
                setStepError('')
                setCurrentStep(step)
            }}
            onBack={currentStep !== 'factory' && currentStep !== 'completed' ? handleBack : undefined}
            onSaveAndContinue={handleSaveAndContinue}
            onSkip={['machines', 'workers', 'payroll'].includes(currentStep) ? handleSkip : undefined}
            canSkip={['machines', 'workers', 'payroll'].includes(currentStep)}
            saveLabel={
                currentStep === 'factory'
                    ? 'Continue to Defaults'
                    : currentStep === 'review'
                    ? 'Finish Factory Setup'
                    : 'Save & Continue'
            }
            isSaving={isSaving}
            isCompleted={currentStep === 'completed'}
        >
            {currentStep === 'factory' && (
                <Step1Factory
                    factoryName={draft.factory.name}
                    ownerContact={draft.factory.ownerContact || ''}
                    onChangeFactoryName={name => setDraft(prev => ({ ...prev, factory: { ...prev.factory, name } }))}
                    onChangeOwnerContact={contact => setDraft(prev => ({ ...prev, factory: { ...prev.factory, ownerContact: contact } }))}
                    error={stepError}
                />
            )}

            {currentStep === 'defaults' && (
                <Step2Defaults
                    defaults={draft.defaults}
                    onChangeDefaults={defs => setDraft(prev => ({ ...prev, defaults: defs }))}
                    error={stepError}
                />
            )}

            {currentStep === 'machines' && (
                <Step3Machines
                    machines={draft.machines}
                    onChangeMachines={machs => setDraft(prev => ({ ...prev, machines: machs }))}
                    error={stepError}
                />
            )}

            {currentStep === 'workers' && (
                <Step4Workers
                    workers={draft.workers}
                    onChangeWorkers={wrks => setDraft(prev => ({ ...prev, workers: wrks }))}
                    error={stepError}
                />
            )}

            {currentStep === 'payroll' && (
                <Step5Payroll
                    payroll={draft.payroll}
                    onChangePayroll={pay => setDraft(prev => ({ ...prev, payroll: pay }))}
                    error={stepError}
                />
            )}

            {currentStep === 'review' && (
                <Step6Review
                    draft={draft}
                    readiness={initialReadiness}
                    onEditStep={step => {
                        setStepError('')
                        setCurrentStep(step)
                    }}
                    error={stepError}
                />
            )}

            {currentStep === 'completed' && (
                <CompletionScreen
                    factoryName={draft.factory.name}
                    machineCount={totalMachines || initialReadiness.machineCount}
                    workerCount={totalWorkers || initialReadiness.workerCount.total}
                    hasSavedCostings={hasSavedCostings}
                />
            )}
        </OnboardingShell>
    )
}
