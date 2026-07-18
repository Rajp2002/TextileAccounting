'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
    checkRateLimit,
    getDestructiveLimiter,
    revokeUserSession,
} from '@/lib/rate-limit'

const SupervisorIdSchema = z.string().uuid('Invalid supervisor account.')

export type ConnectedSupervisor = {
    id: string
    fullName: string
    email: string | null
    phone: string | null
}

export async function getConnectedSupervisors(): Promise<
    { data: ConnectedSupervisor[]; error?: never } | { data?: never; error: string }
> {
    const { profile } = await requireRole(['owner'])
    const admin = createAdminClient()
    const { data, error } = await admin
        .from('profiles')
        .select('id, full_name, email, phone')
        .eq('org_id', profile.org_id)
        .eq('role', 'supervisor')
        .is('access_revoked_at', null)
        .order('full_name', { ascending: true })

    if (error) {
        console.error('Failed to load connected supervisors:', error)
        return { error: 'Unable to load connected supervisors. Please try again.' }
    }

    return {
        data: (data ?? []).map((supervisor) => ({
            id: supervisor.id,
            fullName: supervisor.full_name?.trim() || 'Supervisor',
            email: supervisor.email || null,
            phone: supervisor.phone || null,
        })),
    }
}

export async function removeSupervisorAccess(
    supervisorId: string,
    confirmationName: string
): Promise<{ success: true } | { error: string }> {
    const parsedId = SupervisorIdSchema.safeParse(supervisorId)
    if (!parsedId.success) return { error: parsedId.error.issues[0]?.message || 'Invalid supervisor account.' }

    const { user, profile } = await requireRole(['owner'])
    const rateLimit = await checkRateLimit(getDestructiveLimiter, `remove-supervisor:${user.id}`)
    if (!rateLimit.success) {
        return { error: 'Too many access changes. Please wait a moment and try again.' }
    }

    const admin = createAdminClient()
    const { data: supervisor, error: lookupError } = await admin
        .from('profiles')
        .select('id, full_name')
        .eq('id', parsedId.data)
        .eq('org_id', profile.org_id)
        .eq('role', 'supervisor')
        .is('access_revoked_at', null)
        .maybeSingle()

    if (lookupError) {
        console.error('Failed to verify supervisor access:', lookupError)
        return { error: 'Unable to verify this supervisor. Please try again.' }
    }
    if (!supervisor) return { error: 'This supervisor is no longer connected to your factory.' }

    const expectedName = supervisor.full_name?.trim() || 'Supervisor'
    if (confirmationName.trim().toLocaleLowerCase() !== expectedName.toLocaleLowerCase()) {
        return { error: `Type ${expectedName} exactly to confirm.` }
    }

    // Ban first so a profile write can never revoke the in-app check while
    // accidentally leaving the account able to refresh or create sessions.
    const { error: banError } = await admin.auth.admin.updateUserById(parsedId.data, {
        ban_duration: '876000h',
    })
    if (banError) {
        console.error('Failed to ban removed supervisor account:', banError)
        return { error: 'Unable to remove supervisor access. No changes were made.' }
    }

    const revokedAt = new Date().toISOString()
    const { data: revokedProfile, error: profileError } = await admin
        .from('profiles')
        .update({
            access_revoked_at: revokedAt,
            access_revoked_by: user.id,
        })
        .eq('id', parsedId.data)
        .eq('org_id', profile.org_id)
        .eq('role', 'supervisor')
        .is('access_revoked_at', null)
        .select('id')
        .maybeSingle()

    if (profileError || !revokedProfile) {
        console.error('Failed to mark supervisor profile as revoked:', profileError)
        const { error: rollbackError } = await admin.auth.admin.updateUserById(parsedId.data, {
            ban_duration: 'none',
        })
        if (rollbackError) console.error('Failed to roll back supervisor auth ban:', rollbackError)
        return { error: 'Unable to remove supervisor access. No profile changes were made.' }
    }

    // Existing access tokens can otherwise remain valid briefly. The app checks
    // this marker before loading any protected server route or action.
    await revokeUserSession(parsedId.data)

    const { error: auditError } = await admin.from('audit_log').insert({
        org_id: profile.org_id,
        table_name: 'profiles',
        record_id: parsedId.data,
        action: 'UPDATE',
        old_data: { access_status: 'connected' },
        new_data: { access_status: 'revoked', access_revoked_at: revokedAt },
        changed_by: user.id,
    })
    if (auditError) console.error('Failed to audit supervisor access removal:', auditError)

    revalidatePath('/owner/settings')
    return { success: true }
}
