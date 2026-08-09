import 'server-only'

import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

/**
 * Request-scoped organization data shared by the owner shell and owner pages.
 * Keeping this behind React.cache() avoids repeating the same organization
 * read when a page needs the production mode or display name already used by
 * the sidebar.
 */
export const getCachedOwnerOrganization = cache(async (orgId: string) => {
    const supabase = await createClient()

    return supabase
        .from('organizations')
        .select('id, name, production_mode, join_code, join_code_expires_at')
        .eq('id', orgId)
        .maybeSingle()
})
