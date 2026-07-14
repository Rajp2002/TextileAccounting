/**
 * Supabase SSR stores the session in one auth cookie or a set of numbered
 * chunks. PKCE verifier cookies are intentionally excluded: they do not prove
 * that a browser already has an authenticated session.
 */
export function isSupabaseAuthSessionCookie(
    name: string,
    projectId = process.env.NEXT_PUBLIC_SUPABASE_PROJECT_ID
): boolean {
    if (projectId) {
        const authCookieName = `sb-${projectId}-auth-token`
        return name === authCookieName || name.startsWith(`${authCookieName}.`)
    }

    return /^sb-[a-z0-9]+-auth-token(?:\.\d+)?$/i.test(name)
}
