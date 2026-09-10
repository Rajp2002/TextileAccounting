'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TourId, TourPresentation } from '@/lib/tours/tour-types'
import { getTourDefinition } from '@/lib/tours/tour-registry'
import {
    getTourStatus,
    persistTourDismissal,
    persistTourImpression,
    persistTourStarted,
} from '@/lib/tours/tour-preferences'
import { claimSessionAnimation, isReducedMotionPreferred } from '@/lib/tours/session-coordinator'

export interface UseTourInvitationProps {
    tourId: TourId
    userId?: string
    userMetadata?: Record<string, any> | null
    orgId?: string
    onLaunch?: () => void | Promise<void>
}

export interface UseTourInvitationReturn {
    presentation: TourPresentation
    isHaloActive: boolean
    isStarting: boolean
    handleDismiss: () => void
    handleLaunch: () => Promise<void>
    tourDefinition: ReturnType<typeof getTourDefinition>
}

export function useTourInvitation({
    tourId,
    userId,
    userMetadata,
    orgId,
    onLaunch,
}: UseTourInvitationProps): UseTourInvitationReturn {
    const tourDefinition = useMemo(() => getTourDefinition(tourId), [tourId])

    // Initial presentation determination based on existing persistent history
    const initialStatus = useMemo(() => {
        return getTourStatus(tourId, userMetadata, userId, orgId)
    }, [tourId, userMetadata, userId, orgId])

    // Visit-scoped presentation decision:
    // If it's a first eligible visit, show invitation for the duration of this visit
    // until explicit dismissal or user leaves.
    const [presentation, setPresentation] = useState<TourPresentation>(() => {
        return initialStatus.isFirstEligibleVisit ? 'invitation' : 'quiet'
    })

    const [isHaloActive, setIsHaloActive] = useState(false)
    const [isStarting, setIsStarting] = useState(false)
    const impressionRecorded = useRef(false)
    const haloTimerRef = useRef<number | null>(null)
    const userInteractedRef = useRef(false)

    // Stop halo helper
    const stopHalo = useCallback(() => {
        setIsHaloActive(false)
        if (haloTimerRef.current) {
            window.clearTimeout(haloTimerRef.current)
            haloTimerRef.current = null
        }
    }, [])

    // Record impression once when invitation is rendered on a first eligible visit
    useEffect(() => {
        if (presentation === 'invitation' && !impressionRecorded.current) {
            impressionRecorded.current = true
            void persistTourImpression(tourId, userId)
        }
    }, [presentation, tourId, userId])

    // Session animation budget & halo timing
    useEffect(() => {
        if (presentation !== 'invitation') return
        if (tourDefinition.emphasis !== 'halo') return
        if (userInteractedRef.current) return
        if (isReducedMotionPreferred()) return

        // Settle briefly after mount before requesting budget
        const startTimer = window.setTimeout(() => {
            if (userInteractedRef.current) return
            if (document.hidden) return

            const granted = claimSessionAnimation(userId ?? '')
            if (granted) {
                setIsHaloActive(true)
                // Halo runs for exactly 2 cycles of 1.2s = 2.4s (2400ms)
                haloTimerRef.current = window.setTimeout(() => {
                    setIsHaloActive(false)
                    haloTimerRef.current = null
                }, 2400)
            }
        }, 150)

        return () => {
            window.clearTimeout(startTimer)
            if (haloTimerRef.current) {
                window.clearTimeout(haloTimerRef.current)
            }
        }
    }, [presentation, tourDefinition.emphasis, userId])

    // Halt halo permanently on user workflow interaction (typing, workflow clicks, focus, scroll)
    useEffect(() => {
        if (!isHaloActive) return

        const onUserInteraction = (event: Event) => {
            // Passive pointer move is NOT an interaction
            if (event.type === 'pointermove' || event.type === 'mousemove') return

            userInteractedRef.current = true
            stopHalo()
        }

        const onVisibilityChange = () => {
            if (document.hidden) {
                userInteractedRef.current = true
                stopHalo()
            }
        }

        const events = ['keydown', 'pointerdown', 'scroll', 'touchstart']
        events.forEach(eventName => {
            window.addEventListener(eventName, onUserInteraction, { capture: true, passive: true })
        })
        document.addEventListener('visibilitychange', onVisibilityChange)

        return () => {
            events.forEach(eventName => {
                window.removeEventListener(eventName, onUserInteraction, true)
            })
            document.removeEventListener('visibilitychange', onVisibilityChange)
        }
    }, [isHaloActive, stopHalo])

    // Explicit dismissal: immediately transitions to quiet button and records dismissal
    const handleDismiss = useCallback(() => {
        stopHalo()
        setPresentation('quiet')
        void persistTourDismissal(tourId, userId)
    }, [stopHalo, tourId, userId])

    // Explicit launch: coalesces rapid double clicks, halts halo, triggers tour
    const handleLaunch = useCallback(async () => {
        if (isStarting) return
        stopHalo()
        setIsStarting(true)

        try {
            await onLaunch?.()
            void persistTourStarted(tourId, userId)
        } finally {
            setIsStarting(false)
        }
    }, [isStarting, stopHalo, onLaunch, tourId, userId])

    return {
        presentation,
        isHaloActive,
        isStarting,
        handleDismiss,
        handleLaunch,
        tourDefinition,
    }
}
