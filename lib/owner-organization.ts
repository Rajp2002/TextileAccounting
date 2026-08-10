import 'server-only'

import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

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
 */
export const getCachedOwnerOrganization = cache(async (ownerId: string, organizationId: string) => {
    const admin = createAdminClient()

    return admin
        .from('organizations')
        .select('id, name, production_mode, join_code, join_code_expires_at, onboarding_complete, is_locked_down')
        .eq('id', organizationId)
        .eq('owner_id', ownerId)
        .maybeSingle()
})
