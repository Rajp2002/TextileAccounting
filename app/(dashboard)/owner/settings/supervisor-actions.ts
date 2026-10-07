'use server'

import { z } from 'zod'
import { requireRole, requireWritableOrg } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrgTier } from '@/lib/subscription'
import { hasCapability } from '@/lib/subscription-access'
import { revokeUserSession } from '@/lib/rate-limit'
import type { SupervisorTextKey } from '@/lib/i18n/supervisor-access'

// Owner management of Base supervisors. The database functions re-check the
// owner, Base access and the organization lock; these actions add the app's
// usual entitlement gate and the auth-account side effects.

export type SupervisorPerson = {
    userId: string
    fullName: string
    email: string | null
    phone: string | null
    requestedAt: string
    decidedAt: string | null
}

export type SupervisorAccessState = {
    joiningEnabled: boolean
    code: string | null
    pending: SupervisorPerson[]
    approved: SupervisorPerson[]
}

type ActionResult = { data: SupervisorAccessState } | { error: SupervisorTextKey }

type RawPerson = { user_id: string; full_name: string | null; email: string | null; phone: string | null; requested_at: string; decided_at?: string | null }
type RawState = { joining_enabled: boolean; code: string | null; pending: RawPerson[]; approved: RawPerson[] }

const UserIdSchema = z.string().uuid()

function toState(raw: RawState): SupervisorAccessState {
    const person = (row: RawPerson): SupervisorPerson => ({
        userId: row.user_id, fullName: row.full_name ?? '', email: row.email, phone: row.phone,
        requestedAt: row.requested_at, decidedAt: row.decided_at ?? null,
    })
    return { joiningEnabled: raw.joining_enabled, code: raw.code, pending: raw.pending.map(person), approved: raw.approved.map(person) }
}

/** Resolves for a Base owner (writable when `write`), otherwise throws. */
async function requireBaseOwner(write: boolean) {
    const { profile } = write ? await requireWritableOrg(['owner']) : await requireRole(['owner'])
    if (!hasCapability(await getOrgTier(profile.org_id), 'production')) throw new Error('Base production is required')
}

async function readState(): Promise<ActionResult> {
    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_supervisor_access')
    if (error || !data) return { error: 'loadFailed' }
    return { data: toState(data as RawState) }
}

async function run(write: boolean, work: () => Promise<{ error: unknown } | null>): Promise<ActionResult> {
    try {
        await requireBaseOwner(write)
        const outcome = await work()
        if (outcome?.error) {
            console.error('[supervisor-access]', outcome.error)
            return { error: 'actionFailed' }
        }
        return await readState()
    } catch (error) {
        // Next redirects are control flow, not failures.
        if (error && typeof error === 'object' && 'digest' in error && String((error as { digest?: unknown }).digest).startsWith('NEXT_REDIRECT')) throw error
        console.error('[supervisor-access]', error instanceof Error ? error.message : error)
        return { error: 'actionFailed' }
    }
}

export async function getSupervisorAccessAction(): Promise<ActionResult> {
    return run(false, async () => null)
}

export async function setSupervisorJoiningAction(enabled: boolean): Promise<ActionResult> {
    if (typeof enabled !== 'boolean') return { error: 'actionFailed' }
    return run(true, async () => {
        const { error } = await (await createClient()).rpc('set_supervisor_joining', { p_enabled: enabled })
        return { error }
    })
}

export async function regenerateSupervisorCodeAction(): Promise<ActionResult> {
    return run(true, async () => {
        const { error } = await (await createClient()).rpc('regenerate_supervisor_join_code')
        return { error }
    })
}

export async function approveSupervisorAction(userId: string): Promise<ActionResult> {
    if (!UserIdSchema.safeParse(userId).success) return { error: 'actionFailed' }
    return run(true, async () => {
        const { error } = await (await createClient()).rpc('approve_supervisor', { p_user_id: userId })
        return { error }
    })
}

/** A pending request has written nothing: delete the profile, then the account, so the email can join again. */
export async function declineSupervisorAction(userId: string): Promise<ActionResult> {
    if (!UserIdSchema.safeParse(userId).success) return { error: 'actionFailed' }
    return run(true, async () => {
        const { error } = await (await createClient()).rpc('decline_supervisor', { p_user_id: userId })
        if (error) return { error }
        await revokeUserSession(userId)
        const { error: deleteError } = await createAdminClient().auth.admin.deleteUser(userId)
        // The request is already gone; a leftover account has no profile and no access.
        if (deleteError) console.error('[supervisor-access] declined account was not deleted', deleteError.message)
        return null
    })
}

/** Keeps the profile so saved sheets stay attributed; access ends at once. */
export async function removeSupervisorAction(userId: string): Promise<ActionResult> {
    if (!UserIdSchema.safeParse(userId).success) return { error: 'actionFailed' }
    return run(true, async () => {
        const { error } = await (await createClient()).rpc('remove_supervisor', { p_user_id: userId })
        if (error) return { error }
        await revokeUserSession(userId)
        return null
    })
}
