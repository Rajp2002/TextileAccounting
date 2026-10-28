import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionHint } from '@/lib/auth'
import { startEarly } from '@/lib/start-early'
import { getCachedOrgPlanAccess } from '@/lib/subscription'

/**
 * Request-scoped organization data shared by the owner shell and owner pages.
 * Keeping this behind React.cache() avoids repeating the same organization
 * read when a page needs data already used by the sidebar.
 *
 * The caller must first verify the authenticated owner with requireRole(). The
 * service-role read is then constrained by both that verified user id and the
 * organization id from their database profile. This avoids a false RLS miss
 * during the post-login Server Component request without allowing a caller to
 * select an arbitrary tenant.
 *
 * base_onboarding rides along so the owner layout's Base setup check reads
 * this same row instead of making its own organization read.
 */
export const getCachedOwnerOrganization = cache(async (ownerId: string, organizationId: string) => {
    const admin = createAdminClient()

    return admin
        .from('organizations')
        .select('id, name, production_mode, onboarding_complete, is_locked_down, base_onboarding')
        .eq('id', organizationId)
        .eq('owner_id', ownerId)
        .maybeSingle()
})

/**
 * Starts the owner shell's plan and organization reads with Proxy's session
 * hint, while requireRole is still verifying the identity. The layout and its
 * boundaries then await the same request-scoped reads when the verified ids
 * match; a stale hint only costs a discarded read.
 */
export async function startOwnerShellReads() {
    const hint = await getSessionHint()
    if (!hint?.orgId) return
    startEarly(getCachedOrgPlanAccess(hint.orgId))
    startEarly(getCachedOwnerOrganization(hint.userId, hint.orgId))
}
