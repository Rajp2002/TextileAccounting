'use server'

import { createClient } from '@/lib/supabase/server'
import { requireRole } from '@/lib/auth'
import { revalidatePath } from 'next/cache'

/** A user preference only; never used for authorization. No client-supplied user ID. */
export async function dismissRatebookTutorial(): Promise<{ success: boolean }> {
    const { user } = await requireRole(['owner'])
    if (user.user_metadata?.ratebook_tutorial_dismissed === true) return { success: true }

    const supabase = await createClient()
    const { data, error } = await supabase.auth.updateUser({
        data: { ratebook_tutorial_dismissed: true },
    })
    if (error || data.user?.user_metadata?.ratebook_tutorial_dismissed !== true) {
        return { success: false }
    }
    revalidatePath('/owner/rates')
    return { success: true }
}
