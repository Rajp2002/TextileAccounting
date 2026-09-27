'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import type { TourId, TourPreferenceRecord } from '@/lib/tours/tour-types'

/**
 * Server action to record tour lifecycle events in user_metadata.
 * Isolated to authenticated caller with no client-controlled user ID.
 */
export async function recordTourEventAction({
    tourId,
    action,
    contentVersion,
}: {
    tourId: TourId
    action: 'shown' | 'dismissed' | 'started' | 'completed'
    contentVersion?: string
}): Promise<{ success: boolean; data?: Record<string, unknown> }> {
    if (contentVersion !== undefined && (typeof contentVersion !== 'string' || contentVersion.length > 16 || !/^v\d+$/.test(contentVersion))) return { success: false }
    try {
        const { user } = await requireRole(['owner'], { allowFreeAccount: true })
        const existingTourPrefs = (user.user_metadata?.tour_preferences as Record<string, TourPreferenceRecord>) ?? {}
        const currentRecord: TourPreferenceRecord = existingTourPrefs[tourId] ?? {}

        const now = new Date().toISOString()
        const updatedRecord: TourPreferenceRecord = { ...currentRecord, version: 'v1' }

        if (action === 'shown') {
            if (!updatedRecord.firstShown) {
                updatedRecord.firstShown = now
            }
        } else if (action === 'dismissed') {
            updatedRecord.dismissed = true
            if (!updatedRecord.firstShown) updatedRecord.firstShown = now
        } else if (action === 'started') {
            updatedRecord.firstStarted = true
            if (!updatedRecord.firstShown) updatedRecord.firstShown = now
        } else if (action === 'completed') {
            updatedRecord.completed = true
            if (contentVersion !== undefined) updatedRecord.completedVersion = contentVersion
            if (!updatedRecord.firstShown) updatedRecord.firstShown = now
        }

        const newTourPrefs = {
            ...existingTourPrefs,
            [tourId]: updatedRecord,
        }

        const updateData: Record<string, unknown> = {
            tour_preferences: newTourPrefs,
        }

        const supabase = await createClient()
        const { data, error } = await supabase.auth.updateUser({
            data: updateData,
        })

        if (error || !data.user) {
            return { success: false }
        }

        return { success: true, data: updateData }
    } catch {
        return { success: false }
    }
}
