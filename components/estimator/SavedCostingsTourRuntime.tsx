'use client'

import { useMemo, type RefObject } from 'react'
import { GuidedTour } from '@/components/tours/GuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { savedCostingControlLabels, savedCostingStepCopy } from '@/lib/i18n/saved-costings-tutorial'
import { savedCostingTourSpecs, savedCostingTourValues, type SavedCostingEnding, type SavedCostingStep } from '@/lib/saved-costings-tour'

export default function SavedCostingsTourRuntime({ step, onStepChange, onComplete, free, production, comparison, ending, userId, launcher, returnFocus }: {
    step: SavedCostingStep; onStepChange: (step: SavedCostingStep | null) => void; onComplete?: () => void
    free: boolean; production: boolean; comparison: boolean; ending: SavedCostingEnding; userId?: string
    launcher: RefObject<HTMLElement | null>; returnFocus: RefObject<HTMLElement | null>
}) {
    const { language, t, tx } = useTranslation()
    const values = useMemo(() => savedCostingTourValues(), [])
    const steps = savedCostingTourSpecs(free, production, comparison, ending)
    const controls = savedCostingControlLabels(t, tx, free)
    return <GuidedTour tourId="saved-costings" steps={steps} step={step}
        copy={id => savedCostingStepCopy(language, id, { free, ending, controls, values })}
        onStepChange={onStepChange} onDone={comparison ? undefined : onComplete}
        launcher={launcher} returnFocus={returnFocus} recordCompletion={!comparison} userId={userId} />
}
