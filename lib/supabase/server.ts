import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseAuthSessionCookieNames } from '@/lib/supabase/auth-cookie'

function createClientFromCookieStore(cookieStore: Awaited<ReturnType<typeof cookies>>) {
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll()
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    } catch {
                        // The `setAll` method was called from a Server Component.
                        // This can be ignored if you have middleware refreshing
                        // user sessions.
                    }
                },
            },
        }
    )
}

export async function createClient() {
    return createClientFromCookieStore(await cookies())
}

/**
 * Creates an auth client for an explicit credential sign-in without hydrating
 * an older browser session first. This prevents an invalid refresh token from
 * blocking signInWithPassword during client initialization.
 */
export async function createFreshAuthClient() {
    const cookieStore = await cookies()
    const sessionCookieNames = getSupabaseAuthSessionCookieNames(cookieStore.getAll())

    sessionCookieNames.forEach((name) => cookieStore.delete(name))

    return createClientFromCookieStore(cookieStore)
}
