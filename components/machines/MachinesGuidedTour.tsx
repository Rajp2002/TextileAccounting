'use client'

import dynamic from 'next/dynamic'
import type { RefObject } from 'react'
import type { GuidedTour as GuidedTourComponent } from '@/components/tours/GuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { machinesStepCopy, machinesTourControlLabels } from '@/lib/i18n/machines-tutorial'
import { machinesTourSpecs, type MachinesTourStep } from '@/lib/machines-tour'

const GuidedTour = dynamic(() => import('@/components/tours/GuidedTour').then(module => module.GuidedTour), { ssr: false }) as typeof GuidedTourComponent

export default function MachinesGuidedTour({ step, onStepChange, launcher, returnFocus, userId }: {
    step: MachinesTourStep
    onStepChange: (step: MachinesTourStep | null) => void
    launcher: RefObject<HTMLElement | null>
    returnFocus: RefObject<HTMLElement | null>
    userId?: string
}) {
    const { tx, t, language } = useTranslation()
    const controls = machinesTourControlLabels(tx, t)
    return <>
        {/* Scope the close affordance to the existing read-only sample portal.
            The live MachineEditor and its dirty-check stay unchanged. */}
        <style>{'[data-machines-tour-preview="true"] > [data-slot="dialog-close"], [data-machines-tour-preview="true"] [data-slot="dialog-footer"] button[type="button"] { display: none; }'}</style>
        <GuidedTour tourId="machines" steps={machinesTourSpecs} step={step}
            copy={id => machinesStepCopy(language, id, controls)} onStepChange={onStepChange}
            launcher={launcher} returnFocus={returnFocus} userId={userId} />
    </>
}
