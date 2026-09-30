import type { AllTourPreferences, TourId, TourPreferenceRecord, TourPresentation } from './tour-types'
import { getTourDefinition } from './tour-registry'
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
        const parsed = JSON.parse(raw)
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as AllTourPreferences : {}
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
        if (record.firstStarted) mergedRecord.firstStarted = true
        if (record.completed) mergedRecord.completed = true
        if (record.dismissed) mergedRecord.dismissed = true
        if (record.firstShown) mergedRecord.firstShown = record.firstShown

        current[tourId] = mergedRecord
        localStorage.setItem(getLocalPrefsKey(userId), JSON.stringify(current))
    } catch {
        // Storage restricted or quota exceeded
    }
}

/** An impression is not a decision; account, local and legacy decisions are sticky. */
export function getTourPresentation(
    tourId: TourId,
    userMetadata?: Record<string, unknown> | null,
    userId?: string,
    orgId?: string
): TourPresentation {
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

    return legacyDismissed || [tourPrefs, localPrefs].some(record =>
        record?.dismissed === true || record?.firstStarted === true || record?.completed === true
    ) ? 'replay' : 'invite'
}

/**
 * Records an invitation impression.
 */
export async function persistTourImpression(tourId: TourId, userId?: string): Promise<void> {
    if (userId && getLocalTourPreferences(userId)[tourId]?.firstShown) return
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
export async function persistTourCompleted(
    tourId: TourId,
    userId?: string,
    contentVersion = getTourDefinition(tourId).contentVersion
): Promise<void> {
    if (userId) {
        saveLocalTourPreference(userId, tourId, { completed: true, completedVersion: contentVersion })
    }
    try {
        await recordTourEventAction({ tourId, action: 'completed', contentVersion })
    } catch {}
}
