'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TourId, TourPresentation, AllTourPreferences } from '@/lib/tours/tour-types'
import { getTourDefinition } from '@/lib/tours/tour-registry'
import {
    getTourPresentation,
    getLocalTourPreferences,
    persistTourDismissal,
    persistTourImpression,
    persistTourStarted,
} from '@/lib/tours/tour-preferences'

export interface UseTourInvitationProps {
    tourId: TourId
    userId?: string
    userMetadata?: Record<string, unknown> | null
    orgId?: string
    onLaunch?: () => void | Promise<void>
}

export interface UseTourInvitationReturn {
    presentation: TourPresentation
    isStarting: boolean
    handleDismiss: () => void
    handleLaunch: () => Promise<void>
    tourDefinition: ReturnType<typeof getTourDefinition>
}

export function useTourInvitation({ tourId, userId, userMetadata, orgId, onLaunch }: UseTourInvitationProps): UseTourInvitationReturn {
    const tourDefinition = useMemo(() => getTourDefinition(tourId), [tourId])
    const identity = JSON.stringify([tourId, userId, orgId])
    const [decidedIdentity, setDecidedIdentity] = useState<string | null>(null)
    const presentation = decidedIdentity === identity ? 'replay' : getTourPresentation(tourId, userMetadata, userId, orgId)
    const [isStarting, setIsStarting] = useState(false)
    const launching = useRef(false)
    const impressions = useRef(new Set<string>())

    useEffect(() => {
        if (presentation !== 'invite' || impressions.current.has(identity)) return
        impressions.current.add(identity)
        const account = (userMetadata?.tour_preferences as AllTourPreferences | undefined)?.[tourId]
        const local = userId ? getLocalTourPreferences(userId)[tourId] : undefined
        if (!account?.firstShown && !local?.firstShown) void persistTourImpression(tourId, userId)
    }, [presentation, identity, tourId, userId, userMetadata])

    const handleDismiss = useCallback(() => {
        setDecidedIdentity(identity)
        void persistTourDismissal(tourId, userId)
    }, [identity, tourId, userId])

    const handleLaunch = useCallback(async () => {
        if (launching.current) return
        launching.current = true
        setIsStarting(true)
        try {
            await onLaunch?.()
            setDecidedIdentity(identity)
            void persistTourStarted(tourId, userId)
        } finally {
            launching.current = false
            setIsStarting(false)
        }
    }, [identity, onLaunch, tourId, userId])

    return { presentation, isStarting, handleDismiss, handleLaunch, tourDefinition }
}
