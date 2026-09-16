'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'
import type { TourId, TourPreferenceRecord } from '@/lib/tours/tour-types'

/**
 * Server action to record tour lifecycle events in user_metadata.
 * Isolated to authenticated caller with no client-controlled user ID.
 */
export async function recordTourEventAction({
    tourId,
    action,
}: {
    tourId: TourId
    action: 'shown' | 'dismissed' | 'started' | 'completed'
}): Promise<{ success: boolean; data?: Record<string, any> }> {
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
            if (!updatedRecord.firstShown) updatedRecord.firstShown = now
        }

        const newTourPrefs = {
            ...existingTourPrefs,
            [tourId]: updatedRecord,
        }

        const updateData: Record<string, any> = {
            tour_preferences: newTourPrefs,
        }

        // Backwards compatibility with legacy keys
        if (action === 'dismissed' || action === 'completed') {
            if (tourId === 'cost-estimate') {
                updateData.cost_estimate_tutorial_dismissed = true
            } else if (tourId === 'rate-book') {
                updateData.ratebook_tutorial_dismissed = true
            }
        }

        const supabase = await createClient()
        const { data, error } = await supabase.auth.updateUser({
            data: updateData,
        })

        if (error || !data.user) {
            return { success: false }
        }

        // Stock tour preferences need no board refresh: new initialData resets
        // the live history filters and could disturb an in-progress stock entry.
        // Local preferences update immediately; account metadata persists above.
        if (tourId === 'production') {
            revalidatePath('/owner/production')
        } else if (tourId === 'payroll') {
            revalidatePath('/owner/payroll')
        } else if (tourId === 'machines') {
            revalidatePath('/owner/machines')
        } else if (tourId === 'workers') {
            revalidatePath('/owner/workers')
        } else if (tourId === 'configuration') {
            revalidatePath('/owner/operations')
            revalidatePath('/owner/assignments')
        } else if (tourId === 'cost-estimate') {
            revalidatePath('/owner/estimator')
            revalidatePath('/free')
        } else if (tourId === 'rate-book') {
            revalidatePath('/owner/rates')
        } else if (tourId === 'saved-costings') {
            revalidatePath('/owner/quotes')
            revalidatePath('/free/costings')
        }

        return { success: true, data: updateData }
    } catch {
        return { success: false }
    }
}
