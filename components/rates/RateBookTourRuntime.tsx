'use client'

import type { RefObject } from 'react'
import { GuidedTour } from '@/components/tours/GuidedTour'
import { useTranslation } from '@/lib/i18n/context'
import { rateBookControlLabels, rateBookStepCopy } from '@/lib/i18n/rate-book-tutorial'
import { rateBookTourSpecs, type RateBookStep } from '@/lib/rate-book-tour'

export default function RateBookTourRuntime({ step, onStepChange, onDone, sampleRow, hasRealRates, userId, launcher, returnFocus }: {
    step: RateBookStep; onStepChange: (step: RateBookStep | null) => void
    onDone?: () => void
    sampleRow: boolean; hasRealRates: boolean; userId: string
    launcher: RefObject<HTMLElement | null>; returnFocus: RefObject<HTMLElement | null>
}) {
    const { language, t, tx } = useTranslation()
    const controls = rateBookControlLabels(t, tx)
    return <GuidedTour tourId="rate-book" steps={rateBookTourSpecs(sampleRow, hasRealRates)} step={step}
        copy={id => rateBookStepCopy(language, id, hasRealRates, controls)} onStepChange={onStepChange} onDone={onDone}
        launcher={launcher} returnFocus={returnFocus} userId={userId} />
}
