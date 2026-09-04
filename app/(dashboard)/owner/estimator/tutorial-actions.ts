'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/** A user preference only; never used for authorization. No client-supplied user ID. */
export async function dismissCostEstimateTutorial(): Promise<{ success: boolean }> {
    const { user } = await requireRole(['owner'])
    if (user.user_metadata?.cost_estimate_tutorial_dismissed === true) return { success: true }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.updateUser({
        data: { cost_estimate_tutorial_dismissed: true },
    })
    if (error || data.user?.user_metadata?.cost_estimate_tutorial_dismissed !== true) {
        return { success: false }
    }
    revalidatePath('/owner/estimator')
    return { success: true }
}
