'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { TourId } from './tour-types'

/**
 * A tour teaches the REAL page. When the account has nothing to show yet, the tour renders the same page
 * component with sample data instead of a hand-built copy of it, so the tour and the product can never drift.
 *
 * The page stays inert while a tour runs (see useGuidedTourModal), so nothing here can reach real data. This
 * context carries the two things a real component cannot infer: that it is showing a sample, and which step is
 * being taught, so it can open the real dialog or sheet that step is about.
 */
export type TourSample = { tourId: TourId; step: string }

const TourSampleContext = createContext<TourSample | null>(null)

export function TourSampleProvider({ tourId, step, children }: TourSample & { children: ReactNode }) {
    const value = useMemo(() => ({ tourId, step }), [tourId, step])
    return <TourSampleContext.Provider value={value}>{children}</TourSampleContext.Provider>
}

/** The sample this component is rendering for `tourId`, or null in the normal page. */
export function useTourSample(tourId?: TourId): TourSample | null {
    const sample = useContext(TourSampleContext)
    return sample && (!tourId || sample.tourId === tourId) ? sample : null
}
