import type { AllTourPreferences, TourId, TourPreferenceRecord } from './tour-types'
import { recordTourEventAction } from '@/app/actions/tour-preferences'

function getLocalPrefsKey(userId: string): string {
    return `weavly:tour-prefs:v1:${userId}`
}

/**
 * Reads local storage preferences for a specific authenticated user.
 * Returns an empty object if storage is inaccessible or userId is missing.
 */
export function getLocalTourPreferences(userId: string): AllTourPreferences {
    if (typeof window === 'undefined' || !userId) return {}
    try {
        const raw = localStorage.getItem(getLocalPrefsKey(userId))
        if (!raw) return {}
        return JSON.parse(raw) as AllTourPreferences
    } catch {
        return {}
    }
}

/**
 * Saves tour preference updates to local storage namespaced by userId as fallback.
 */
export function saveLocalTourPreference(
    userId: string,
    tourId: TourId,
    update: Partial<TourPreferenceRecord>
): void {
    if (typeof window === 'undefined' || !userId) return
    try {
        const current = getLocalTourPreferences(userId)
        const record = current[tourId] ?? {}
        const mergedRecord: TourPreferenceRecord = {
            ...record,
            ...update,
            version: 'v1',
        }
        // Stronger history preservation: never let a weaker state overwrite dismissed or completed
        if (record.completed) mergedRecord.completed = true
        if (record.dismissed) mergedRecord.dismissed = true
        if (record.firstShown) mergedRecord.firstShown = record.firstShown

        current[tourId] = mergedRecord
        localStorage.setItem(getLocalPrefsKey(userId), JSON.stringify(current))
    } catch {
        // Storage restricted or quota exceeded
    }
}

export interface TourStatus {
    isFirstEligibleVisit: boolean
    isDismissed: boolean
    isCompleted: boolean
    hasStarted: boolean
    isSuppressed: boolean
}

/**
 * Resolves the persistent status of a tour for a given user.
 */
export function getTourStatus(
    tourId: TourId,
    userMetadata?: Record<string, unknown> | null,
    userId?: string,
    orgId?: string
): TourStatus {
    const tourPrefs = (userMetadata?.tour_preferences as AllTourPreferences | undefined)?.[tourId]
    const localPrefs = userId ? getLocalTourPreferences(userId)[tourId] : undefined

    // Check legacy fields
    let legacyDismissed = false
    if (tourId === 'cost-estimate') {
        legacyDismissed = userMetadata?.cost_estimate_tutorial_dismissed === true
        if (!legacyDismissed && typeof window !== 'undefined' && userId && orgId) {
            try {
                if (localStorage.getItem(`weavly:cost-estimate-tutorial:v1:${orgId}:${userId}`) === 'done') {
                    legacyDismissed = true
                }
            } catch {}
        }
    } else if (tourId === 'rate-book') {
        legacyDismissed = userMetadata?.ratebook_tutorial_dismissed === true
        if (!legacyDismissed && typeof window !== 'undefined' && userId && orgId) {
            try {
                if (localStorage.getItem(`weavly:ratebook-tutorial:v1:${orgId}:${userId}`) === 'done') {
                    legacyDismissed = true
                }
            } catch {}
        }
    }

    const isDismissed = Boolean(
        tourPrefs?.dismissed ||
        localPrefs?.dismissed ||
        legacyDismissed
    )

    const isCompleted = Boolean(
        tourPrefs?.completed ||
        localPrefs?.completed
    )

    const hasStarted = Boolean(
        tourPrefs?.firstStarted ||
        localPrefs?.firstStarted
    )

    const hasBeenShown = Boolean(
        tourPrefs?.firstShown ||
        localPrefs?.firstShown ||
        isDismissed ||
        isCompleted ||
        hasStarted
    )

    // Suppressed means future visits will show the quiet button instead of the invitation
    const isSuppressed = hasBeenShown || isDismissed || isCompleted

    // First eligible visit means the invitation has never been shown, dismissed, or completed
    const isFirstEligibleVisit = !isSuppressed

    return {
        isFirstEligibleVisit,
        isDismissed,
        isCompleted,
        hasStarted,
        isSuppressed,
    }
}

/**
 * Records an invitation impression.
 */
export async function persistTourImpression(tourId: TourId, userId?: string): Promise<void> {
    if (userId) {
        saveLocalTourPreference(userId, tourId, { firstShown: new Date().toISOString() })
    }
    try {
        await recordTourEventAction({ tourId, action: 'shown' })
    } catch {}
}

/**
 * Records an explicit dismissal.
 */
export async function persistTourDismissal(tourId: TourId, userId?: string): Promise<void> {
    if (userId) {
        saveLocalTourPreference(userId, tourId, { dismissed: true })
    }
    try {
        await recordTourEventAction({ tourId, action: 'dismissed' })
    } catch {}
}

/**
 * Records tour start.
 */
export async function persistTourStarted(tourId: TourId, userId?: string): Promise<void> {
    if (userId) {
        saveLocalTourPreference(userId, tourId, { firstStarted: true })
    }
    try {
        await recordTourEventAction({ tourId, action: 'started' })
    } catch {}
}

/**
 * Records tour completion.
 */
export async function persistTourCompleted(tourId: TourId, userId?: string): Promise<void> {
    if (userId) {
        saveLocalTourPreference(userId, tourId, { completed: true })
    }
    try {
        await recordTourEventAction({ tourId, action: 'completed' })
    } catch {}
}
