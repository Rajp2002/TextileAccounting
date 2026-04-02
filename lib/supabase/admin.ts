import { createClient } from '@supabase/supabase-js'

/**
 * createAdminClient — service_role Supabase client
 *
 * CRITICAL: Only import this in Server Actions and Route Handlers.
 * NEVER expose this to client components — it bypasses ALL RLS.
 *
 * Used for:
 * - createOrganization(): creating auth users + organizations atomically
 * - joinOrganization(): creating supervisor auth users + profiles
 * - Any operation requiring service_role to write without RLS
 */
export function createAdminClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        throw new Error(
            '[Supabase Admin] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set. ' +
            'Check your .env.local or Vercel environment variable configuration.'
        )
    }

    return createClient(url, serviceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    })
}
