import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { getVerifiedIdentity } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { SUPERVISOR_HOME_PATH } from '@/lib/supervisor-access'

export type SupervisorStatus = 'none' | 'pending' | 'approved'

export type SupervisorSession = {
    userId: string
    fullName: string
    status: SupervisorStatus
    orgId: string | null
    factoryName: string | null
    planActive: boolean
    locked: boolean
    today: string
}

type StatusRow = {
    status: SupervisorStatus
    org_id: string | null
    factory_name: string | null
    plan_active: boolean
    locked: boolean
    today: string
}

/**
 * The signed-in supervisor and their factory status, once per request.
 * Supervisors have no profile org, so requireRole()/getCachedSession() never
 * admit them; this is their separate guard. Authorization is re-checked by
 * every supervisor database function.
 */
export const getSupervisorSession = cache(async (): Promise<SupervisorSession | null> => {
    const identity = await getVerifiedIdentity()
    if (!identity || identity.profile.role !== 'supervisor') return null

    const supabase = await createClient()
    const { data, error } = await supabase.rpc('get_supervisor_status')
    if (error || !data) throw new Error('Supervisor status could not be loaded.')

    const row = data as StatusRow
    return {
        userId: identity.user.id,
        fullName: identity.profile.full_name ?? '',
        status: row.status,
        orgId: row.org_id,
        factoryName: row.factory_name,
        planActive: row.plan_active === true,
        locked: row.locked === true,
        today: row.today,
    }
})

/** For the daily sheet and its actions: an approved supervisor of an active, unlocked factory. */
export async function requireActiveSupervisor(): Promise<SupervisorSession & { orgId: string }> {
    const session = await getSupervisorSession()
    if (!session) redirect('/login')
    if (session.status !== 'approved' || !session.orgId || !session.planActive || session.locked) {
        redirect(SUPERVISOR_HOME_PATH)
    }
    return { ...session, orgId: session.orgId }
}
