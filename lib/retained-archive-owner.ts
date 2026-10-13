import 'server-only'

import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { getCachedOrgPlanAccess } from '@/lib/subscription'
import { hasOwnerArchiveAccess } from '@/lib/subscription-access'

/**
 * The archive stays available after paid access ends, including for a former
 * Free account whose paid plan expired. A pure Free account is sent to its
 * Free workspace, as before. This is read-only and grants nothing else.
 * Every owner archive action (JSON and CSV) calls this first.
 */
export async function requireRetainedArchiveOwner() {
    const session = await requireRole(['owner'], { allowFreeAccount: true })
    if (!hasOwnerArchiveAccess(await getCachedOrgPlanAccess(session.profile.org_id))) redirect('/free')
    return session
}
